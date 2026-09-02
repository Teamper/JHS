// @ts-check

const PUBLIC_CACHE_MAX_ENTRIES = 500, PUBLIC_CACHE_MAX_AGE_MS = 30 * 864e5, PUBLIC_PRUNE_INTERVAL = 64;

/** @param {string} value @returns {Promise<string>} */
async function digestKey(value) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte => byte.toString(16).padStart(2, "0"))).join("");
}

export class CacheService {
    /** @param {{namespaceVersion?: number, diagnostics?: import("./diagnostics-service.js").DiagnosticsService, storage?: import("./storage-service.js").StorageService}} [options] */
    constructor(options = {}) {
        this.namespaceVersion = options.namespaceVersion ?? 2;
        this.diagnostics = options.diagnostics ?? null;
        this.storage = options.storage ?? null;
        /** @type {Map<string, {value: unknown, expiresAt: number, negative: boolean}>} */
        this.publicCache = new Map();
        /** @type {Map<string, Map<string, {value: unknown, expiresAt: number, negative: boolean}>>} */
        this.sessionCaches = new Map();
        /** @type {Map<string, Promise<{hit: boolean, value: unknown, negative: boolean}>>} */
        this.publicReads = new Map();
        this.publicGenerations = new Map();
        this.publicNamespaces = new Set(["default"]);
        this.publicWritesSincePrune = 0;
        this.pruneScheduled = false;
        this.pruneRunning = false;
        /** @type {Promise<void> | null} */
        this.prunePromise = null;
    }

    get publicGeneration() { return this.publicGenerations.get("default") || 0; }
    /** @param {string} namespace */
    generation(namespace) { return this.publicGenerations.get(namespace) || 0; }
    get publicPrefix() { return this._publicPrefix("default"); }
    _publicPrefix(namespace = "default") { return `jhs_http_public_cache:v${this.namespaceVersion}:${encodeURIComponent(namespace)}:`; }

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

    /** @param {any} namespace @param {any} key @param {any} policy */
    async get(namespace, key, policy) {
        if (arguments.length === 2) policy = key, key = namespace, namespace = "default";
        namespace = String(namespace || "default");
        this.publicNamespaces.add(namespace);
        const store = this.storeFor(policy.scope, policy.sessionScopeId), cacheKey = `${namespace}:${this.namespaceVersion}:${key}`, now = Date.now(), storage = this.storage;
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
        const readKey = `${namespace}:${key}`;
        const pending = this.publicReads.get(readKey);
        if (pending) return pending;
        const generation = this.generation(namespace);
        const read = (async () => {
            const persistedKey = this._publicPrefix(namespace) + await digestKey(key);
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
            if (generation !== this.generation(namespace)) {
                this.diagnostics?.recordCache(false);
                return { hit: false, value: undefined, negative: false };
            }
            const normalized = { value: entry.value, expiresAt: entry.expiresAt, negative: entry.negative === true };
            this.publicCache.set(cacheKey, normalized);
            this.diagnostics?.recordCache(true);
            return { hit: true, value: normalized.value, negative: normalized.negative };
        })().finally(() => {
            if (this.publicReads.get(readKey) === read) this.publicReads.delete(readKey);
        });
        this.publicReads.set(readKey, read);
        return read;
    }

    /** @param {any} namespace @param {any} key @param {any} value @param {any} policy */
    async set(namespace, key, value, policy) {
        if (arguments.length === 3) policy = value, value = key, key = namespace, namespace = "default";
        namespace = String(namespace || "default");
        this.publicNamespaces.add(namespace);
        const ttlMs = Math.min(PUBLIC_CACHE_MAX_AGE_MS, Math.max(0, Number(policy.ttlMs) || 0));
        if (!ttlMs) return;
        if (policy.scope === "public" && policy.generation != null && policy.generation !== this.generation(namespace)) return;
        const entry = { value, expiresAt: Date.now() + ttlMs, negative: policy.negative ?? false }, store = this.storeFor(policy.scope, policy.sessionScopeId), cacheKey = `${namespace}:${this.namespaceVersion}:${key}`;
        const storage = this.storage;
        if (policy.scope !== "public" || !storage) {
            store?.set(cacheKey, entry);
            return;
        }
        if (policy.generation != null && policy.generation !== this.generation(namespace)) return;
        const persistedKey = this._publicPrefix(namespace) + await digestKey(key);
        if (policy.generation != null && policy.generation !== this.generation(namespace)) return;
        try {
            if (policy.generation != null && policy.generation !== this.generation(namespace)) return;
            await storage.set(persistedKey, { version: this.namespaceVersion, ...entry, lastUsed: Date.now() });
            if (policy.generation != null && policy.generation !== this.generation(namespace)) {
                await storage.remove(persistedKey).catch(() => {});
                return;
            }
            store?.set(cacheKey, entry);
            this.publicWritesSincePrune++;
            this.schedulePublicPrune();
        } catch {
            // 持久缓存是可丢弃加速层，存储故障不得让真实网络请求失败。
        }
    }

    /** Schedule bounded public-cache maintenance outside the request critical path. */
    schedulePublicPrune() {
        if (!this.storage || this.publicWritesSincePrune < PUBLIC_PRUNE_INTERVAL || this.pruneScheduled || this.pruneRunning) return this.prunePromise;
        this.pruneScheduled = true;
        const run = async () => {
            this.pruneScheduled = false;
            this.pruneRunning = true;
            this.publicWritesSincePrune = 0;
            try { await this.prunePublic(); }
            catch { /* 维护失败不影响缓存读写和真实网络请求。 */ }
            finally {
                this.pruneRunning = false;
                this.prunePromise = null;
                this.schedulePublicPrune();
            }
        };
        this.prunePromise = Promise.resolve().then(run);
        return this.prunePromise;
    }

    /** Wait for a deferred prune so destructive cache operations can establish a clean boundary. */
    async waitForPrune() {
        await this.prunePromise?.catch(() => {});
    }

    /** Remove expired entries and keep the persistent public namespace bounded. */
    async prunePublic() {
        if (!this.storage) return;
        let keys;
        try { keys = await this.storage.keys(); } catch { return; }
        const now = Date.now(), candidates = [];
        for (const key of /** @type {string[]} */ (keys).filter((/** @param {string} item */ item) => item.startsWith("jhs_http_public_cache:v"))) {
            const entry = await this.storage.get(key).catch(() => null);
            if (!entry || entry.version !== this.namespaceVersion || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
                await this.storage.remove(key).catch(() => {});
                continue;
            }
            candidates.push({ key, lastUsed: Number(entry.lastUsed) || 0 });
        }
        if (candidates.length > PUBLIC_CACHE_MAX_ENTRIES) {
            candidates.sort((left, right) => left.lastUsed - right.lastUsed);
            for (const item of candidates.slice(0, candidates.length - PUBLIC_CACHE_MAX_ENTRIES)) await this.storage.remove(/** @type {any} */ (item).key).catch(() => {});
        }
    }

    /** Clear the public L1 and persisted L2 namespace. */
    /** @param {string} namespace */
    async clearNamespace(namespace) {
        namespace = String(namespace || "default");
        this.publicGenerations.set(namespace, this.generation(namespace) + 1);
        for (const key of this.publicCache.keys()) if (key.startsWith(`${namespace}:`)) this.publicCache.delete(key);
        for (const key of this.publicReads.keys()) if (key.startsWith(`${namespace}:`)) this.publicReads.delete(key);
        await this.waitForPrune();
        const storage = this.storage;
        if (!storage) return;
        let keys;
        try { keys = await storage.keys(); } catch { return; }
        await Promise.all(keys.filter((/** @param {string} key */ key => key.startsWith(this._publicPrefix(namespace)))).map((/** @param {string} key */ key => storage.remove(key).catch(() => {}))));
    }

    async clearAll() {
        const namespaces = new Set(this.publicNamespaces);
        for (const namespace of namespaces) await this.clearNamespace(namespace);
        this.publicCache.clear(), this.publicReads.clear(), this.sessionCaches.clear();
        // Also remove persisted namespaces that were not touched in this tab.
        // This keeps the settings "clear all" action a true boundary across
        // tabs and avoids leaving stale v2 entries behind.
        if (this.storage) {
            try {
                const storage = this.storage, prefix = `jhs_http_public_cache:v${this.namespaceVersion}:`, keys = await storage.keys();
                await Promise.all(keys.filter((/** @type {string} */ key) => key.startsWith(prefix)).map((/** @type {string} */ key) => storage.remove(key).catch(() => {})));
            } catch { /* cache cleanup remains best effort */ }
        }
    }
    async clearPublic() { return this.clearAll(); }
    async invalidateNamespace() { return this.clearAll(); }
}
