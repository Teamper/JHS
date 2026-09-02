// @ts-check

import { JhsError } from "../core/jhs-error.js";

/** @param {unknown} value @returns {string} */
function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    const object = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(",")}}`;
}

/** @param {string} value */
async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

/** @param {string | URL} input */
export function canonicalizeUrl(input) {
    const url = new URL(input);
    const entries = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
    url.search = "";
    for (const [key, value] of entries) url.searchParams.append(key, value);
    url.hash = "";
    return url.href;
}

/** @param {unknown} body @param {number} [status] */
export function isCloudflareChallenge(body, status = 0) {
    if (typeof body !== "string" || !body) return false;
    const text = body.toLowerCase(), hasTitle = /<title[^>]*>\s*just a moment(?:\.\.\.)?\s*<\/title>/i.test(body);
    const hasForm = /id=["']challenge-form["']/i.test(body), hasChallenge = text.includes("cf-chl-") || text.includes("cf_chl_opt");
    const hasPlatform = text.includes("/cdn-cgi/challenge-platform/") || text.includes("challenge-platform");
    return hasTitle || hasForm && (hasChallenge || hasPlatform) || [403, 429, 503].includes(status) && hasChallenge && hasPlatform;
}

/** @param {number} delayMs @param {AbortSignal | undefined} signal */
function waitForRetry(delayMs, signal) {
    if (delayMs <= 0) return Promise.resolve();
    return new Promise((/** @type {(value?: void) => void} */ resolve, reject) => {
        const finish = () => { signal?.removeEventListener("abort", onAbort), resolve(); };
        const timer = setTimeout(finish, delayMs), onAbort = () => {
            clearTimeout(timer), reject(new JhsError("ABORTED", "请求已取消", { source: "HttpService" }));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        Promise.resolve().then(() => signal?.aborted && onAbort());
    });
}

/** @param {Record<string, any>} options */
export async function createRequestKey(options) {
    const method = String(options.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
    const varyHeaders = [...new Set((options.varyHeaders ?? []).map((/** @type {unknown} */ header) => String(header).toLowerCase()))].sort();
    const varyValues = Object.fromEntries(varyHeaders.map((header) => [header, headers[header] ?? ""]));
    const key = {
        providerId: String(options.providerId), cacheNamespace: String(options.cacheNamespace ?? options.providerId ?? "default"), method, canonicalUrl: canonicalizeUrl(options.url),
        bodyHash: await sha256(stableSerialize(options.body ?? null)), responseType: String(options.responseType ?? "text"),
        cacheScope: String(options.cacheScope ?? "none"), varyHeadersHash: await sha256(stableSerialize(varyValues)),
        sessionScopeId: options.cacheScope === "session" ? String(options.sessionScopeId ?? "") : "",
    };
    if (key.cacheScope === "session" && !key.sessionScopeId) throw new TypeError("sessionScopeId is required for session requests");
    return Object.freeze(key);
}

export class HttpService {
    /** @param {{request: (options: any) => Promise<any>}} port @param {import("./external-url-policy.js").ExternalUrlPolicy} urlPolicy @param {{diagnostics?: import("./diagnostics-service.js").DiagnosticsService, cache?: import("./cache-service.js").CacheService}} [options] */
    constructor(port, urlPolicy, options = {}) {
        this.port = port;
        this.urlPolicy = urlPolicy;
        this.diagnostics = options.diagnostics ?? null;
        this.cache = options.cache ?? null;
        /** @type {Map<string, {promise: Promise<any>, controller: AbortController, consumers: number}>} */
        this.inflight = new Map();
        /** @type {Map<string, {state: "closed" | "open" | "half-open", failCount: number, openTime: number, cooldownMs: number, threshold: number, probing: boolean}>} */
        this.circuitBreakers = new Map();
        /** @type {Map<string, {count: number, errors: number, lastUsed: number}>} */
        this.domainStats = new Map();
    }

    /** @param {Record<string, any>} options @param {import("../core/lifecycle-scope.js").LifecycleScope} [scope] */
    async request(options, scope) {
        const method = String(options.method ?? "GET").toUpperCase();
        const cacheScope = options.cacheScope ?? "none";
        if (method !== "GET" && cacheScope !== "none") throw new TypeError("Mutation requests cannot use generic cache/dedupe");
        const urlPolicy = /** @type {{trustClass: string, hosts?: string[], expectedOrigin?: string}} */ (options.urlPolicy);
        const initialUrl = this.urlPolicy.assertAllowed(options.url, urlPolicy);
        if (method !== "GET" || cacheScope === "none") return this.executeUnderlying({ ...options, method, url: initialUrl.href, signal: scope?.signal }, urlPolicy);
        const cacheNamespace = String(options.cacheNamespace ?? options.providerId ?? "default");
        const requestKey = await createRequestKey({ ...options, method, url: initialUrl.href, cacheScope, cacheNamespace });
        const serializedKey = stableSerialize(requestKey);
        const cachePolicy = { scope: cacheScope, sessionScopeId: options.sessionScopeId };
        if (method === "GET" && cacheScope !== "none" && this.cache) {
            const cached = await this.cache.get(cacheNamespace, serializedKey, cachePolicy);
            if (cached.hit) return cached.value;
        }
        const cacheGeneration = cacheScope === "public" && this.cache ? this.cache.generation(cacheNamespace) : undefined;
        let entry = this.inflight.get(serializedKey);
        if (!entry) {
            const controller = new AbortController();
            entry = { controller, consumers: 0, promise: Promise.resolve() };
            entry.promise = this.executeUnderlying({ ...options, method, url: initialUrl.href, signal: controller.signal }, urlPolicy)
                .then(async (response) => {
                    if (this.cache && (cacheGeneration == null || cacheGeneration === this.cache.generation(cacheNamespace))) {
                        await this.cache.set(cacheNamespace, serializedKey, response, { ...cachePolicy, ttlMs: options.ttlMs ?? 0, negative: options.negative === true, generation: cacheGeneration });
                    }
                    return response;
                })
                .finally(() => {
                    this.inflight.delete(serializedKey);
                    this.updateDiagnostics();
                });
            this.inflight.set(serializedKey, entry);
        }
        return this.consume(entry, scope);
    }

    /** @param {Record<string, any>} options @param {{trustClass: string, hosts?: string[], expectedOrigin?: string}} urlPolicy */
    async executeUnderlying(options, urlPolicy) {
        const domain = new URL(options.url).hostname, retryCount = Math.max(0, Math.min(5, Number(options.retryCount ?? 0) || 0)), acceptableStatuses = new Set((options.acceptableStatuses ?? []).map((/** @type {unknown} */ status) => Number(status)).filter(Number.isFinite));
        let finalError = null;
        for (let attempt = 0; attempt <= retryCount; attempt += 1) {
            const blocked = this.checkCircuit(domain);
            if (blocked) {
                finalError = new JhsError("CIRCUIT_OPEN", `站点 ${domain} 已熔断，${blocked.remaining}秒后重试`, { source: options.providerId, details: { domain, remainingSeconds: blocked.remaining } });
                break;
            }
            const state = this.ensureCircuit(domain, options);
            if (state.state === "half-open") state.probing = true;
            try {
                const response = await this.port.request(options);
                this.urlPolicy.assertFinalUrl(response.finalUrl || options.url, urlPolicy);
                if (isCloudflareChallenge(response.responseText ?? response.data, response.status)) {
                    throw new JhsError("CF_BLOCKED", `Cloudflare challenge blocked: ${domain}`, {
                        source: options.providerId, details: { domain, status: Number(response.status) || 0, contentLength: String(response.responseText ?? "").length },
                    });
                }
                if (acceptableStatuses.has(Number(response.status))) {
                    this.recordSuccess(domain);
                    return response;
                }
                if (response.status >= 400) {
                    const code = [401, 403].includes(response.status) ? "AUTH_REQUIRED" : response.status === 404 ? "NOT_FOUND" : response.status === 429 ? "RATE_LIMITED" : "NETWORK_ERROR";
                    throw new JhsError(code, `HTTP ${response.status}`, { source: options.providerId, retryable: response.status === 429 || response.status >= 500, details: { status: response.status, domain } });
                }
                this.recordSuccess(domain);
                return response;
            } catch (error) {
                const normalized = JhsError.from(error, options.providerId);
                this.recordAttempt(domain, true);
                finalError = normalized;
                if (!normalized.retryable || attempt >= retryCount || normalized.code === "CF_BLOCKED") break;
                try { await waitForRetry(Number(options.retryDelayMs ?? 250) * (attempt + 1), options.signal); }
                catch (abortError) { finalError = JhsError.from(abortError, options.providerId); break; }
            }
        }
        if (finalError && ["NETWORK_ERROR", "TIMEOUT", "CF_BLOCKED"].includes(finalError.code)) this.recordBreakerFailure(domain, options);
        this.diagnostics?.recordError(finalError);
        throw finalError;
    }

    /** @param {string} domain @param {Record<string, any>} options */
    ensureCircuit(domain, options = {}) {
        let state = this.circuitBreakers.get(domain);
        if (!state) {
            state = { state: "closed", failCount: 0, openTime: 0, cooldownMs: Math.max(1000, Number(options.circuitCooldownMs ?? 60_000) || 60_000), threshold: Math.max(1, Number(options.circuitThreshold ?? 3) || 3), probing: false };
            this.circuitBreakers.set(domain, state);
        } else {
            if (options.circuitCooldownMs != null) state.cooldownMs = Math.max(1000, Number(options.circuitCooldownMs) || 60_000);
            if (options.circuitThreshold != null) state.threshold = Math.max(1, Number(options.circuitThreshold) || 3);
        }
        return state;
    }
    /** @param {string} domain */
    checkCircuit(domain) {
        const state = this.circuitBreakers.get(domain);
        if (!state) return null;
        if (state.state === "open") {
            const elapsed = Date.now() - state.openTime;
            if (elapsed < state.cooldownMs) return { state: "open", remaining: Math.ceil((state.cooldownMs - elapsed) / 1000) };
            state.state = "half-open", state.failCount = 0, state.probing = false;
        }
        return state.state === "half-open" && state.probing ? { state: "half-open", remaining: 0 } : null;
    }
    /** @param {string} domain */
    recordSuccess(domain) {
        const state = this.circuitBreakers.get(domain);
        if (state) state.state = "closed", state.failCount = 0, state.probing = false;
        this.recordAttempt(domain, false);
    }
    /** @param {string} domain @param {boolean} error */
    recordAttempt(domain, error) {
        const stats = this.domainStats.get(domain) ?? { count: 0, errors: 0, lastUsed: 0 };
        stats.count += 1, stats.errors += error ? 1 : 0, stats.lastUsed = Date.now(), this.domainStats.set(domain, stats);
    }
    /** @param {string} domain @param {Record<string, any>} options */
    recordBreakerFailure(domain, options = {}) {
        const state = this.ensureCircuit(domain, options);
        state.failCount += 1;
        if (state.state === "half-open" || state.failCount >= state.threshold) state.state = "open", state.openTime = Date.now(), state.probing = false;
    }
    /** @param {string} domain @param {Record<string, any>} options */
    recordFailure(domain, options = {}) {
        this.recordAttempt(domain, true);
        this.recordBreakerFailure(domain, options);
    }
    getCircuitBreakerStatus() { return Object.fromEntries([...this.circuitBreakers].map(([domain, state]) => [domain, { ...state }])); }
    getDomainStats() { return Object.fromEntries([...this.domainStats].map(([domain, stats]) => [domain, { ...stats }])); }
    /** @param {string} domain */
    resetCircuitBreaker(domain) { this.circuitBreakers.delete(domain); }
    resetAllCircuitBreakers() { this.circuitBreakers.clear(); }
    clearDomainStats() { this.domainStats.clear(); }

    /** @param {{promise: Promise<any>, controller: AbortController, consumers: number}} entry @param {import("../core/lifecycle-scope.js").LifecycleScope} [scope] */
    consume(entry, scope) {
        entry.consumers += 1;
        let released = false;
        const consumer = { release: () => {
            if (released) return;
            released = true;
            entry.consumers -= 1;
            if (entry.consumers === 0 && !this.isSettled(entry)) entry.controller.abort();
            this.updateDiagnostics();
        } };
        const removeFromScope = scope?.ownRequestConsumer(consumer);
        this.updateDiagnostics();
        let removeAbortListener = () => {};
        const result = scope ? Promise.race([
            entry.promise,
            new Promise((_, reject) => {
                const onAbort = () => reject(new JhsError("ABORTED", "LifecycleScope 已释放", { source: scope.id }));
                scope.signal.addEventListener("abort", onAbort, { once: true });
                removeAbortListener = () => scope.signal.removeEventListener("abort", onAbort);
            }),
        ]) : entry.promise;
        return result.finally(() => {
            removeAbortListener();
            removeFromScope?.();
            consumer.release();
        });
    }

    /** @param {{promise: Promise<any>}} entry */
    isSettled(entry) { return ![...this.inflight.values()].includes(/** @type {any} */ (entry)); }
    updateDiagnostics() {
        const consumers = [...this.inflight.values()].reduce((sum, entry) => sum + entry.consumers, 0);
        this.diagnostics?.updateRequests(consumers, this.inflight.size);
    }
}
