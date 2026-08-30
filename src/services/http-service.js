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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const REDIRECT_STRATEGIES = new Set(["follow", "error", "manual"]);

/** @param {unknown} value @param {string} trustClass */
function resolveRedirectStrategy(value, trustClass) {
    const strategy = value ?? (["custom-public", "user-local"].includes(trustClass) ? "error" : "follow");
    if (typeof strategy !== "string" || !REDIRECT_STRATEGIES.has(strategy)) throw new TypeError("redirectStrategy must be follow, error or manual");
    if (["custom-public", "user-local"].includes(trustClass) && strategy === "follow") {
        throw new JhsError("INVALID_URL", "用户控制来源必须使用可控的重定向策略", { source: "HttpService" });
    }
    return /** @type {"follow" | "error" | "manual"} */ (strategy);
}

/** @param {unknown} headers @returns {string | null} */
function getRedirectLocation(headers) {
    if (headers && typeof /** @type {any} */ (headers).get === "function") return /** @type {any} */ (headers).get("location");
    if (typeof headers !== "string") return null;
    const match = /(?:^|\r?\n)location\s*:\s*([^\r\n]+)/i.exec(headers);
    return match?.[1]?.trim() || null;
}

/** @param {Record<string, any>} options */
export async function createRequestKey(options) {
    const method = String(options.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
    const varyHeaders = [...new Set((options.varyHeaders ?? []).map((/** @type {unknown} */ header) => String(header).toLowerCase()))].sort();
    const varyValues = Object.fromEntries(varyHeaders.map((header) => [header, headers[header] ?? ""]));
    const key = {
        providerId: String(options.providerId), method, canonicalUrl: canonicalizeUrl(options.url),
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
        const urlPolicy = /** @type {{trustClass: string, hosts?: string[], expectedOrigin?: string, redirectStrategy?: string}} */ (options.urlPolicy);
        const initialUrl = this.urlPolicy.assertAllowed(options.url, urlPolicy);
        const redirectStrategy = resolveRedirectStrategy(options.redirectStrategy ?? urlPolicy.redirectStrategy, urlPolicy.trustClass);
        const requestOptions = { ...options, method, url: initialUrl.href, redirectStrategy, signal: scope?.signal };
        if (method !== "GET" || cacheScope === "none") return this.executeUnderlying(requestOptions, urlPolicy);
        const requestKey = await createRequestKey({ ...options, method, url: initialUrl.href, cacheScope });
        const serializedKey = stableSerialize(requestKey);
        const cachePolicy = { scope: cacheScope, sessionScopeId: options.sessionScopeId };
        if (method === "GET" && cacheScope !== "none" && this.cache) {
            const cached = this.cache.get(serializedKey, cachePolicy);
            if (cached.hit) return cached.value;
        }
        let entry = this.inflight.get(serializedKey);
        if (!entry) {
            const controller = new AbortController();
            entry = { controller, consumers: 0, promise: Promise.resolve() };
            entry.promise = this.executeUnderlying({ ...requestOptions, signal: controller.signal }, urlPolicy)
                .then((response) => {
                    this.cache?.set(serializedKey, response, { ...cachePolicy, ttlMs: options.ttlMs ?? 0, negative: options.negative === true });
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

    /** @param {Record<string, any>} options @param {{trustClass: string, hosts?: string[], expectedOrigin?: string, redirectStrategy?: string}} urlPolicy */
    async executeUnderlying(options, urlPolicy) {
        const redirectStrategy = resolveRedirectStrategy(options.redirectStrategy ?? urlPolicy.redirectStrategy, urlPolicy.trustClass);
        let requestUrl = options.url, redirectCount = 0;
        const retryCount = Math.max(0, Math.min(5, Number(options.retryCount ?? 0) || 0));
        let finalError = null;
        for (let attempt = 0; attempt <= retryCount; attempt += 1) {
            const domain = new URL(requestUrl).hostname;
            const blocked = this.checkCircuit(domain);
            if (blocked) {
                finalError = new JhsError("CIRCUIT_OPEN", `站点 ${domain} 已熔断，${blocked.remaining}秒后重试`, { source: options.providerId, details: { domain, remainingSeconds: blocked.remaining } });
                break;
            }
            const state = this.ensureCircuit(domain, options);
            if (state.state === "half-open") state.probing = true;
            try {
                const response = await this.port.request({ ...options, url: requestUrl, redirect: redirectStrategy });
                const responseUrl = response.finalUrl || requestUrl;
                if (REDIRECT_STATUSES.has(Number(response.status)) && redirectStrategy === "manual") {
                    const location = getRedirectLocation(response.responseHeaders);
                    if (!location) throw new JhsError("INVALID_URL", "重定向响应缺少 Location", { source: options.providerId, details: { status: response.status, domain } });
                    if (redirectCount >= 5) throw new JhsError("INVALID_URL", "重定向次数超过安全上限", { source: options.providerId, details: { domain } });
                    const nextUrl = new URL(location, responseUrl);
                    this.urlPolicy.assertAllowed(nextUrl, urlPolicy);
                    requestUrl = nextUrl.href, redirectCount += 1;
                    attempt -= 1;
                    continue;
                }
                if (REDIRECT_STATUSES.has(Number(response.status)) && redirectStrategy === "error") {
                    throw new JhsError("INVALID_URL", "请求重定向已被策略阻止", { source: options.providerId, details: { status: response.status, domain } });
                }
                this.urlPolicy.assertFinalUrl(responseUrl, urlPolicy);
                if (isCloudflareChallenge(response.responseText ?? response.data, response.status)) {
                    throw new JhsError("CF_BLOCKED", `Cloudflare challenge blocked: ${domain}`, {
                        source: options.providerId, details: { domain, status: Number(response.status) || 0, contentLength: String(response.responseText ?? "").length },
                    });
                }
                if (response.status >= 400) {
                    const code = [401, 403].includes(response.status) ? "AUTH_REQUIRED" : response.status === 404 ? "NOT_FOUND" : response.status === 429 ? "RATE_LIMITED" : "NETWORK_ERROR";
                    throw new JhsError(code, `HTTP ${response.status}`, { source: options.providerId, retryable: response.status === 429 || response.status >= 500, details: { status: response.status, domain } });
                }
                this.recordSuccess(domain);
                return response;
            } catch (error) {
                const normalized = JhsError.from(error, options.providerId);
                if (["NETWORK_ERROR", "TIMEOUT", "RATE_LIMITED", "CF_BLOCKED"].includes(normalized.code)) this.recordFailure(domain, options);
                finalError = normalized;
                if (!normalized.retryable || attempt >= retryCount || normalized.code === "CF_BLOCKED") break;
                try { await waitForRetry(Number(options.retryDelayMs ?? 250) * (attempt + 1), options.signal); }
                catch (abortError) { finalError = JhsError.from(abortError, options.providerId); break; }
            }
        }
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
        const stats = this.domainStats.get(domain) ?? { count: 0, errors: 0, lastUsed: 0 };
        stats.count += 1, stats.lastUsed = Date.now(), this.domainStats.set(domain, stats);
    }
    /** @param {string} domain @param {Record<string, any>} options */
    recordFailure(domain, options = {}) {
        const state = this.ensureCircuit(domain, options);
        state.failCount += 1;
        if (state.state === "half-open" || state.failCount >= state.threshold) state.state = "open", state.openTime = Date.now(), state.probing = false;
        const stats = this.domainStats.get(domain) ?? { count: 0, errors: 0, lastUsed: 0 };
        stats.count += 1, stats.errors += 1, stats.lastUsed = Date.now(), this.domainStats.set(domain, stats);
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
