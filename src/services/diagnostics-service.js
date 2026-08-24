// @ts-check

const SENSITIVE_KEY = /^(?:authorization|cookie|set-cookie|password|token|secret|credential)$/i;

/** @param {unknown} value @param {string} [key] @returns {unknown} */
function sanitize(value, key = "") {
    if (SENSITIVE_KEY.test(key)) return "[redacted]";
    if (Array.isArray(value)) return value.map((item) => sanitize(item));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
    if (typeof value !== "string") return value;
    return value.replace(/(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi, "$1[redacted]@");
}

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
        /** @type {string[]} */
        this.legacyPlugins = [];
        this.legacyStartup = null;
        /** @type {Array<Record<string, unknown>>} */
        this.legacyTimings = [];
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
            : error instanceof Error ? { message: error.message } : error && typeof error === "object" ? { ...error } : { message: String(error) };
        this.errors.push({ ...(/** @type {Record<string, any>} */ (sanitize(value))), timestamp: new Date().toISOString() });
        if (this.errors.length > 100) this.errors.shift();
    }
    /** @param {Record<string, unknown>} metadata */
    setBrowserMetadata(metadata) { this.browserMetadata = Object.freeze({ ...metadata }); }
    /** @param {string[]} names @param {Record<string, unknown>} startup @param {Array<Record<string, unknown>>} timings */
    setLegacyRuntime(names, startup, timings) {
        this.legacyPlugins = [...names];
        this.legacyStartup = Object.freeze({ ...startup });
        this.legacyTimings = timings.map((item) => Object.freeze({ ...item }));
    }
    clearErrors() { this.errors = []; }

    exportSnapshot() {
        const scopes = [...this.scopes.values()];
        return Object.freeze({
            activeFeatures: [...this.activeFeatures], activeContributions: [...this.activeContributions],
            startupTimings: Object.fromEntries(this.startupTimings), activeScopes: scopes,
            globalListeners: scopes.filter((scope) => scope.id === "app:root").reduce((sum, scope) => sum + Number(scope.listeners ?? 0), 0),
            observers: scopes.reduce((sum, scope) => sum + Number(scope.observers ?? 0), 0),
            requestConsumers: this.requestStats.consumers, underlyingRequests: this.requestStats.underlying,
            cacheHits: this.cacheStats.hits, cacheMisses: this.cacheStats.misses,
            providerHealth: Object.fromEntries(this.providerHealth), errors: this.errors.map((error) => ({ ...error })),
            legacyPlugins: [...this.legacyPlugins], legacyStartup: this.legacyStartup, legacyTimings: this.legacyTimings.map((item) => ({ ...item })),
            browser: this.browserMetadata, uptimeMs: performance.now() - this.startedAt,
        });
    }
}
