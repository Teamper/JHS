// @ts-check

export class CacheService {
    /** @param {{namespaceVersion?: number, diagnostics?: import("./diagnostics-service.js").DiagnosticsService}} [options] */
    constructor(options = {}) {
        this.namespaceVersion = options.namespaceVersion ?? 1;
        this.diagnostics = options.diagnostics ?? null;
        /** @type {Map<string, {value: unknown, expiresAt: number, negative: boolean}>} */
        this.publicCache = new Map();
        /** @type {Map<string, Map<string, {value: unknown, expiresAt: number, negative: boolean}>>} */
        this.sessionCaches = new Map();
    }

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
    get(key, policy) {
        const store = this.storeFor(policy.scope, policy.sessionScopeId);
        const entry = store?.get(`${this.namespaceVersion}:${key}`);
        if (!entry || entry.expiresAt <= Date.now()) {
            if (entry) store?.delete(`${this.namespaceVersion}:${key}`);
            this.diagnostics?.recordCache(false);
            return { hit: false, value: undefined, negative: false };
        }
        this.diagnostics?.recordCache(true);
        return { hit: true, value: entry.value, negative: entry.negative };
    }

    /** @param {string} key @param {unknown} value @param {{scope: string, sessionScopeId?: string, ttlMs: number, negative?: boolean}} policy */
    set(key, value, policy) {
        const store = this.storeFor(policy.scope, policy.sessionScopeId);
        if (!store) return;
        store.set(`${this.namespaceVersion}:${key}`, { value, expiresAt: Date.now() + Math.max(0, policy.ttlMs), negative: policy.negative ?? false });
    }

    invalidateNamespace() {
        this.publicCache.clear();
        this.sessionCaches.clear();
    }
}
