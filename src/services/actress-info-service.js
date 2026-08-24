// @ts-check

export class ActressInfoService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations @param {import("./cache-service.js").CacheService} cache */
    constructor(integrations, cache) { this.integrations = integrations; this.cache = cache; }

    /** @param {string} name */
    profileUrl(name) {
        for (const manifest of this.integrations.list("person.actress-info")) {
            const adapter = this.integrations.getAdapter(manifest.id);
            if (typeof adapter.profileUrl === "function") return adapter.profileUrl(name);
        }
        return "";
    }

    /** @param {string} name @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async lookup(name, options = {}) {
        const normalized = String(name).trim() === "三上悠亞" ? "三上悠亜" : String(name).trim();
        if (!normalized) return null;
        const key = `actress-info:${normalized}`;
        const cached = this.cache.get(key, { scope: "public" });
        if (cached.hit) return cached.value;
        for (const manifest of this.integrations.list("person.actress-info")) {
            const adapter = this.integrations.getAdapter(manifest.id);
            if (typeof adapter.lookup !== "function") continue;
            const result = await adapter.lookup(normalized, options);
            this.cache.set(key, result, { scope: "public", ttlMs: 604_800_000, negative: !result });
            return result;
        }
        return null;
    }
}
