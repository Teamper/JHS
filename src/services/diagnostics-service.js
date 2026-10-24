// @ts-check

const SENSITIVE_KEY = /^(?:authorization|proxyauthorization|cookie|setcookie|password|passwd|pwd|token|accesstoken|refreshtoken|authtoken|authortoken|appauthorization|secret|clientsecret|installationsecret|credential|credentials|apikey|webdavpassword|jhswebdavpassword|jhsappauthorization)$/i;

/** @param {string} key */
function isSensitiveKey(key) { return SENSITIVE_KEY.test(key.replace(/[^a-z0-9]/gi, "")); }

/** @param {unknown} value @param {string} [key] @returns {unknown} */
function sanitize(value, key = "") {
    if (isSensitiveKey(key)) return "[redacted]";
    if (Array.isArray(value)) return value.map((item) => sanitize(item));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
    if (typeof value !== "string") return value;
    return value.replace(/https?:\/\/[^\s<>"']+/gi, (raw) => {
        try {
            const url = new URL(raw);
            const sensitiveParams = [...url.searchParams.keys()].filter(isSensitiveKey);
            const credentials = Boolean(url.username || url.password);
            if (!credentials && !sensitiveParams.length) return raw;
            if (credentials) { url.username = "[redacted]"; url.password = ""; }
            for (const name of sensitiveParams) url.searchParams.set(name, "[redacted]");
            return url.href;
        } catch {
            return raw.replace(/^(https?:\/\/)[^/\s@]+@/i, "$1[redacted]@")
                .replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, separator, name) => {
                    let decoded = name;
                    try { decoded = decodeURIComponent(name); } catch { /* Match the literal key if malformed. */ }
                    return isSensitiveKey(decoded) ? `${separator}${name}=[redacted]` : match;
                });
        }
    });
}

export class DiagnosticsService {
    /** @param {{legacyHttp?: any}} [options] */
    constructor(options = {}) {
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
        /** @type {Array<{name: string, disableable: boolean}>} */
        this.legacyPluginDescriptors = [];
        this.legacyStartup = null;
        /** @type {Array<Record<string, unknown>>} */
        this.legacyTimings = [];
        this.legacyHttp = options.legacyHttp ?? null;
        this.networkController = null;
        /** @type {{longTasks: number, blockingMs: number, longFrames: number, interactions: number[]} | null} */ this.performanceCapture = null;
        this.performanceRecording = false;
        /** @type {PerformanceObserver[]} */ this.performanceObservers = [];
        /** @type {Map<string, {count: number, total: number}>} */ this.work = new Map();
        /** @type {Map<string, Record<string, number>>} */ this.computations = new Map();
    }

    /** Opt-in, bounded, numeric-only capture. No observer is attached during normal browsing.
     * @param {Window & typeof globalThis} [view] */
    startPerformanceCapture(view = window) {
        this.stopPerformanceCapture();
        this.work.clear(); this.computations.clear();
        this.performanceRecording = true;
        this.performanceCapture = { longTasks: 0, blockingMs: 0, longFrames: 0, interactions: /** @type {number[]} */ ([]) };
        const Observer = view.PerformanceObserver;
        if (!Observer) return;
        for (const type of ["longtask", "long-animation-frame", "event"]) {
            if (!Observer.supportedEntryTypes.includes(type)) continue;
            const observer = new Observer(list => {
                const capture = this.performanceCapture;
                if (!capture) return;
                for (const entry of list.getEntries()) {
                    if (type === "longtask") { capture.longTasks++; capture.blockingMs += Math.max(0, entry.duration - 50); }
                    else if (type === "long-animation-frame") capture.longFrames++;
                    else if (/** @type {any} */ (entry).interactionId) {
                        capture.interactions.push(entry.duration);
                        if (capture.interactions.length > 200) capture.interactions.shift();
                    }
                }
            });
            observer.observe(/** @type {PerformanceObserverInit} */ (type === "event" ? { type, durationThreshold: 16 } : { type }));
            this.performanceObservers.push(observer);
        }
    }
    stopPerformanceCapture() { this.performanceRecording = false; this.performanceObservers.forEach(observer => observer.disconnect()); this.performanceObservers = []; }
    /** @param {string} name @param {number} [amount] */
    recordWork(name, amount = 1) {
        if (!this.performanceRecording) return;
        const item = this.work.get(name) ?? { count: 0, total: 0 };
        item.count++; item.total += amount; this.work.set(name, item);
    }
    /** Numeric-only bounded phase accounting; callers supply no user data. @param {string} name @param {Record<string, number>} sample */
    recordComputation(name, sample) {
        if (!this.performanceRecording) return;
        const value = this.computations.get(name) ?? { calls: 0 };
        value.calls++;
        for (const key of ["cpuMs", "steps", "yields", "waitMs", "holdMs"]) if (Number.isFinite(sample[key])) value[key] = (value[key] || 0) + sample[key];
        for (const [key, source] of [["maxSliceMs", "maxSliceMs"], ["maxWaitMs", "waitMs"], ["maxHoldMs", "holdMs"]]) if (Number.isFinite(sample[source])) value[key] = Math.max(value[key] || 0, sample[source]);
        this.computations.delete(name); this.computations.set(name, value);
        if (this.computations.size > 32) { const first = this.computations.keys().next().value; if (first !== undefined) this.computations.delete(first); }
    }
    performanceSnapshot() {
        const capture = this.performanceCapture;
        if (!capture) return null;
        const durations = [...capture.interactions].sort((a, b) => a - b);
        return { longTasks: capture.longTasks, blockingMs: capture.blockingMs, longFrames: capture.longFrames,
            interactionP95: durations.length ? durations[Math.ceil(durations.length * .95) - 1] : null,
            sampledInteractions: durations.length, work: Object.fromEntries(this.work), computations: Object.fromEntries(this.computations) };
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
    updateProvider(id, health) { this.providerHealth.set(id, Object.freeze({ .../** @type {Record<string, unknown>} */ (sanitize(health)) })); }
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
    /** @param {Array<{name: string, disableable: boolean}>} descriptors @param {Record<string, unknown>} startup @param {Array<Record<string, unknown>>} timings */
    setLegacyRuntime(descriptors, startup, timings) {
        this.legacyPluginDescriptors = descriptors.map((item) => Object.freeze({ ...item }));
        this.legacyPlugins = Number(startup.registeredPlugins) > 0 ? descriptors.map((item) => item.name) : [];
        this.legacyStartup = Object.freeze({ ...startup });
        this.legacyTimings = timings.map((item) => Object.freeze({ ...item }));
    }
    clearErrors() { this.errors = []; }
    /** @param {any} controller */
    setNetworkController(controller) { this.networkController = controller; }
    getNetworkDiagnostics() {
        const controller = this.networkController ?? this.legacyHttp;
        return Object.freeze({
            circuitBreakers: controller?.getCircuitBreakerStatus?.() ?? {},
            domainStats: controller?.getDomainStats?.() ?? {},
        });
    }
    /** @param {string} domain */
    resetCircuitBreaker(domain) { (this.networkController ?? this.legacyHttp)?.resetCircuitBreaker?.(domain); }
    resetAllCircuitBreakers() { (this.networkController ?? this.legacyHttp)?.resetAllCircuitBreakers?.(); }
    clearDomainStats() { (this.networkController ?? this.legacyHttp)?.clearDomainStats?.(); }

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
            legacyPlugins: [...this.legacyPlugins], legacyPluginDescriptors: this.legacyPluginDescriptors.map((item) => ({ ...item })), legacyStartup: this.legacyStartup, legacyTimings: this.legacyTimings.map((item) => ({ ...item })),
            performance: this.performanceSnapshot(),
            browser: this.browserMetadata, uptimeMs: performance.now() - this.startedAt,
        });
    }
}
