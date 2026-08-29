// @ts-check

const CACHE_TTL = 2_592_000_000, CACHE_LIMIT = 1_000, CACHE_KEY = "translation_cache_v2", V1_PREFIX = "translation:v1:";

export class TranslationService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations @param {import("./storage-service.js").StorageService | null} [storage] */
    constructor(integrations, storage = null) {
        this.integrations = integrations, this.storage = storage, this.memoryCache = new Map, this.inflight = new Map,
        this.legacyCache = null, this.hydrationPromise = null, this.cacheGeneration = 0, this.persistTimer = null;
    }
    /** @param {string} text @param {string} source @param {string} target */
    cacheKey(text, source, target) { return `${V1_PREFIX}${source}:${target}:${text}`; }
    readLegacyCache() {
        if (null !== this.legacyCache) return this.legacyCache;
        try { const value = JSON.parse(this.storage?.getLocal?.("jhs_translate") || "{}"); this.legacyCache = value && "object" === typeof value && !Array.isArray(value) ? value : {}; }
        catch { this.legacyCache = {}; }
        return this.legacyCache;
    }
    hydrate() {
        if (this.hydrationPromise) return this.hydrationPromise;
        const generation = this.cacheGeneration;
        return this.hydrationPromise = (async () => {
            if (!this.storage) return;
            const storage = this.storage, migrated = /** @type {string[]} */ ([]);
            let changed = !1;
            try {
                const cache = /** @type {{entries?: Record<string, any>} | null} */ (await storage.get(CACHE_KEY));
                for (const [key, entry] of Object.entries(cache?.entries || {})) {
                    if (generation === this.cacheGeneration && "string" === typeof entry?.value && Number(entry.expiresAt) > Date.now()) this.memoryCache.set(key, { value: entry.value, expiresAt: Number(entry.expiresAt), lastUsed: Number(entry.lastUsed) || Date.now() });
                    else changed = !0;
                }
                const keys = /** @type {string[]} */ (await storage.keys());
                for (const key of keys.filter((value => value.startsWith(V1_PREFIX)))) {
                    const entry = /** @type {any} */ (await storage.get(key));
                    generation === this.cacheGeneration && "string" === typeof entry?.value && Number(entry.expiresAt) > Date.now() && this.memoryCache.set(key, { value: entry.value, expiresAt: Number(entry.expiresAt), lastUsed: Number(entry.lastUsed) || Date.now() });
                    migrated.push(key), changed = !0;
                }
                if (generation === this.cacheGeneration && (this.prune() || changed)) void this.persistNow(generation).then((() => Promise.all(migrated.map((key => storage.remove(key)))))).catch((() => {}));
            } catch {}
        })();
    }
    prune() {
        const now = Date.now(); let changed = !1;
        for (const [key, entry] of this.memoryCache) entry.expiresAt <= now && (this.memoryCache.delete(key), changed = !0);
        const overflow = this.memoryCache.size - CACHE_LIMIT;
        if (overflow > 0) for (const [key] of [...this.memoryCache].sort(((a, b) => a[1].lastUsed - b[1].lastUsed)).slice(0, overflow)) this.memoryCache.delete(key), changed = !0;
        return changed;
    }
    schedulePersist() {
        if (!this.storage || null !== this.persistTimer) return;
        const generation = this.cacheGeneration;
        this.persistTimer = setTimeout((() => { this.persistTimer = null, void this.persistNow(generation).catch((() => {})); }), 300);
    }
    /** @param {number} [generation] */
    async persistNow(generation = this.cacheGeneration) {
        if (!this.storage || generation !== this.cacheGeneration) return;
        this.prune(), await this.storage.set(CACHE_KEY, { version: 2, entries: Object.fromEntries(this.memoryCache) });
    }
    /** @param {string} key @param {string} value @param {number} [generation] */
    remember(key, value, generation = this.cacheGeneration) {
        if (generation === this.cacheGeneration) { const now = Date.now(); this.memoryCache.set(key, { value, expiresAt: now + CACHE_TTL, lastUsed: now }), this.prune(), this.schedulePersist(); }
        return value;
    }
    async clearCache() {
        this.cacheGeneration += 1, null !== this.persistTimer && clearTimeout(this.persistTimer), this.persistTimer = null,
        this.memoryCache.clear(), this.legacyCache = {}, this.storage?.removeLocal?.("jhs_translate");
        if (this.storage) { const storage = this.storage; try { const keys = /** @type {string[]} */ (await storage.keys()); await storage.remove(CACHE_KEY), await Promise.all(keys.filter((key => key.startsWith(V1_PREFIX))).map((key => storage.remove(key)))); } catch {} }
        this.hydrationPromise = Promise.resolve();
    }
    async inspectCache() { return await this.hydrate(), this.prune(), { version: 2, size: this.memoryCache.size, entries: Object.fromEntries(this.memoryCache) }; }
    /** @param {string} text @param {{sourceLanguage?: string, targetLanguage?: string, cacheAlias?: string, scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async translate(text, options = {}) {
        const sourceLanguage = options.sourceLanguage ?? "ja", targetLanguage = options.targetLanguage ?? "zh-CN", key = this.cacheKey(text, sourceLanguage, targetLanguage), generation = this.cacheGeneration;
        let cached = this.memoryCache.get(key);
        if (cached?.expiresAt > Date.now()) return cached.lastUsed = Date.now(), this.schedulePersist(), cached.value;
        cached && this.memoryCache.delete(key);
        const legacy = options.cacheAlias && this.readLegacyCache()[options.cacheAlias];
        if ("ja" === sourceLanguage && "zh-CN" === targetLanguage && "string" === typeof legacy && legacy) return this.remember(key, legacy, generation);
        await this.hydrate(), cached = this.memoryCache.get(key);
        if (cached?.expiresAt > Date.now()) return cached.lastUsed = Date.now(), this.schedulePersist(), cached.value;
        const pending = this.inflight.get(key);
        if (pending) return pending;
        const request = (async () => {
            const manifest = this.integrations.list("text.translate")[0], adapter = manifest && this.integrations.getAdapter(manifest.id);
            if (typeof adapter?.translate !== "function") throw new TypeError(manifest ? `Translation operation is unavailable: ${manifest.id}` : "Translation provider is unavailable");
            const translated = await adapter.translate(text, { ...options, sourceLanguage, targetLanguage });
            return "string" === typeof translated ? this.remember(key, translated, generation) : translated;
        })().finally((() => this.inflight.delete(key)));
        return this.inflight.set(key, request), request;
    }
}
