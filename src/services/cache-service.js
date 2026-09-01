// @ts-check

const PUBLIC_CACHE_MAX_ENTRIES = 500, PUBLIC_CACHE_MAX_AGE_MS = 30 * 864e5;

/** @param {string} value @returns {Promise<string>} */
async function digestKey(value) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte => byte.toString(16).padStart(2, "0"))).join("");
}

export class CacheService {
    /** @param {{namespaceVersion?: number, diagnostics?: import("./diagnostics-service.js").DiagnosticsService, storage?: import("./storage-service.js").StorageService}} [options] */
    constructor(options = {}) {
        this.namespaceVersion = options.namespaceVersion ?? 1;
        this.diagnostics = options.diagnostics ?? null;
        this.storage = options.storage ?? null;
        /** @type {Map<string, {value: unknown, expiresAt: number, negative: boolean}>} */
        this.publicCache = new Map();
        /** @type {Map<string, Map<string, {value: unknown, expiresAt: number, negative: boolean}>>} */
        this.sessionCaches = new Map();
        /** @type {Map<string, Promise<{hit: boolean, value: unknown, negative: boolean}>>} */
        this.publicReads = new Map();
        this.publicGeneration = 0;
    }

    get publicPrefix() { return `jhs_http_public_cache:v${this.namespaceVersion}:`; }

    /** @param {string} scope @param {string} sessionScopeId */
    storeFor(scope, sessionScopeId = "") {
        if (scope === "public") return this.publicCache;
        if (scope === "session") {
            if (!sessionScopeId) throw new TypeError("sessionScopeId is required for session cache");
            let cache = this.sessionCaches.get(sessionScopeId);
            if (!cache) this.sessionCaches.set(sessionScopeId, cache = new Map());
            return cache;
        }
        return null;
    }

    /** @param {string} key @param {{scope: string, sessionScopeId?: string}} policy */
    async get(key, policy) {
        const store = this.storeFor(policy.scope, policy.sessionScopeId), cacheKey = `${this.namespaceVersion}:${key}`, now = Date.now(), storage = this.storage;
        const memoryEntry = store?.get(cacheKey);
        if (memoryEntry && memoryEntry.expiresAt > now) {
            this.diagnostics?.recordCache(true);
            return { hit: true, value: memoryEntry.value, negative: memoryEntry.negative };
        }
        if (memoryEntry) store?.delete(cacheKey);
        if (policy.scope !== "public" || !storage) {
            this.diagnostics?.recordCache(false);
            return { hit: false, value: undefined, negative: false };
        }
        const pending = this.publicReads.get(key);
        if (pending) return pending;
        const generation = this.publicGeneration;
        const read = (async () => {
            const persistedKey = this.publicPrefix + await digestKey(key);
            let entry;
            try { entry = await storage.get(persistedKey); } catch {
                this.diagnostics?.recordCache(false);
                return { hit: false, value: undefined, negative: false };
            }
            if (entry?.version !== this.namespaceVersion || !Number.isFinite(entry?.expiresAt) || entry.expiresAt <= now) {
                if (entry) await storage.remove(persistedKey).catch(() => {});
                this.diagnostics?.recordCache(false);
                return { hit: false, value: undefined, negative: false };
            }
            if (generation !== this.publicGeneration) {
                this.diagnostics?.recordCache(false);
                return { hit: false, value: undefined, negative: false };
            }
            const normalized = { value: entry.value, expiresAt: entry.expiresAt, negative: entry.negative === true };
            this.publicCache.set(cacheKey, normalized);
            this.diagnostics?.recordCache(true);
            return { hit: true, value: normalized.value, negative: normalized.negative };
        })().finally(() => {
            if (this.publicReads.get(key) === read) this.publicReads.delete(key);
        });
        this.publicReads.set(key, read);
        return read;
    }

    /** @param {string} key @param {unknown} value @param {{scope: string, sessionScopeId?: string, ttlMs: number, negative?: boolean}} policy */
    async set(key, value, policy) {
        const ttlMs = Math.min(PUBLIC_CACHE_MAX_AGE_MS, Math.max(0, Number(policy.ttlMs) || 0));
        if (!ttlMs) return;
        const entry = { value, expiresAt: Date.now() + ttlMs, negative: policy.negative ?? false }, store = this.storeFor(policy.scope, policy.sessionScopeId), cacheKey = `${this.namespaceVersion}:${key}`;
        store?.set(cacheKey, entry);
        const storage = this.storage;
        if (policy.scope !== "public" || !storage) return;
        const persistedKey = this.publicPrefix + await digestKey(key);
        try {
            await storage.set(persistedKey, { version: this.namespaceVersion, ...entry, lastUsed: Date.now() });
            await this.prunePublic();
        } catch {
            // 持久缓存是可丢弃加速层，存储故障不得让真实网络请求失败。
        }
    }

    /** Remove expired entries and keep the persistent public namespace bounded. */
    async prunePublic() {
        if (!this.storage) return;
        let keys;
        try { keys = await this.storage.keys(); } catch { return; }
        const now = Date.now(), candidates = [];
        for (const key of keys.filter((/** @param {string} item */ item => item.startsWith(this.publicPrefix)))) {
            const entry = await this.storage.get(key).catch(() => null);
            if (!entry || entry.version !== this.namespaceVersion || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
                await this.storage.remove(key).catch(() => {});
                continue;
            }
            candidates.push({ key, lastUsed: Number(entry.lastUsed) || 0 });
        }
        if (candidates.length > PUBLIC_CACHE_MAX_ENTRIES) {
            candidates.sort((left, right) => left.lastUsed - right.lastUsed);
            for (const item of candidates.slice(0, candidates.length - PUBLIC_CACHE_MAX_ENTRIES)) await this.storage.remove(item.key).catch(() => {});
        }
    }

    /** Clear the public L1 and persisted L2 namespace. */
    async clearPublic() {
        this.publicGeneration++;
        this.publicCache.clear();
        this.publicReads.clear();
        const storage = this.storage;
        if (!storage) return;
        let keys;
        try { keys = await storage.keys(); } catch { return; }
        await Promise.all(keys.filter((/** @param {string} key */ key => key.startsWith(this.publicPrefix))).map((/** @param {string} key */ key => storage.remove(key).catch(() => {}))));
    }

    async invalidateNamespace() {
        await this.clearPublic();
        this.sessionCaches.clear();
    }
}
