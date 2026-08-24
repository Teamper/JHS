// @ts-check

export class DiagnosticsService {
    constructor() {
        this.startedAt = performance.now();
        this.activeFeatures = new Set();
        this.activeContributions = new Set();
        this.startupTimings = new Map();
        this.scopes = new Map();
        this.requestStats = { consumers: 0, underlying: 0 };
        this.cacheStats = { hits: 0, misses: 0 };
        this.providerHealth = new Map();
        /** @type {Array<Record<string, any>>} */
        this.errors = [];
        this.browserMetadata = null;
    }

    /** @param {string} id @param {number} durationMs */
    recordStartup(id, durationMs) { this.startupTimings.set(id, durationMs); }
    /** @param {string} id @param {boolean} active */
    setFeature(id, active) { active ? this.activeFeatures.add(id) : this.activeFeatures.delete(id); }
    /** @param {string} id @param {boolean} active */
    setContribution(id, active) { active ? this.activeContributions.add(id) : this.activeContributions.delete(id); }
    /** @param {{id: string}} snapshot */
    updateScope(snapshot) { this.scopes.set(snapshot.id, Object.freeze({ ...snapshot })); }
    /** @param {number} consumers @param {number} underlying */
    updateRequests(consumers, underlying) { this.requestStats = { consumers, underlying }; }
    /** @param {boolean} hit */
    recordCache(hit) { hit ? this.cacheStats.hits += 1 : this.cacheStats.misses += 1; }
    /** @param {string} id @param {Record<string, unknown>} health */
    updateProvider(id, health) { this.providerHealth.set(id, Object.freeze({ ...health })); }
    /** @param {unknown} error */
    recordError(error) {
        const value = error && typeof error === "object" && "toJSON" in error && typeof error.toJSON === "function"
            ? error.toJSON()
            : { message: error instanceof Error ? error.message : String(error) };
        this.errors.push({ ...value, timestamp: new Date().toISOString() });
        if (this.errors.length > 100) this.errors.shift();
    }
    /** @param {Record<string, unknown>} metadata */
    setBrowserMetadata(metadata) { this.browserMetadata = Object.freeze({ ...metadata }); }

    exportSnapshot() {
        return Object.freeze({
            activeFeatures: [...this.activeFeatures], activeContributions: [...this.activeContributions],
            startupTimings: Object.fromEntries(this.startupTimings), activeScopes: [...this.scopes.values()],
            globalListeners: 0, observers: [...this.scopes.values()].reduce((sum, scope) => sum + Number(scope.observers ?? 0), 0),
            requestConsumers: this.requestStats.consumers, underlyingRequests: this.requestStats.underlying,
            cacheHits: this.cacheStats.hits, cacheMisses: this.cacheStats.misses,
            providerHealth: Object.fromEntries(this.providerHealth), errors: this.errors.map((error) => ({ ...error })),
            browser: this.browserMetadata, uptimeMs: performance.now() - this.startedAt,
        });
    }
}
