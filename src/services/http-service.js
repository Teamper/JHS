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
    }

    /** @param {Record<string, any>} options @param {import("../core/lifecycle-scope.js").LifecycleScope} [scope] */
    async request(options, scope) {
        const method = String(options.method ?? "GET").toUpperCase();
        const cacheScope = options.cacheScope ?? "none";
        if (method !== "GET" && cacheScope !== "none") throw new TypeError("Mutation requests cannot use generic cache/dedupe");
        const urlPolicy = /** @type {{trustClass: string, hosts?: string[], expectedOrigin?: string}} */ (options.urlPolicy);
        const initialUrl = this.urlPolicy.assertAllowed(options.url, urlPolicy);
        const requestKey = await createRequestKey({ ...options, method, url: initialUrl.href, cacheScope });
        const serializedKey = stableSerialize(requestKey);
        const cachePolicy = { scope: cacheScope, sessionScopeId: options.sessionScopeId };
        if (method === "GET" && cacheScope !== "none" && this.cache) {
            const cached = this.cache.get(serializedKey, cachePolicy);
            if (cached.hit) return cached.value;
        }
        if (method !== "GET" || cacheScope === "none") return this.executeUnderlying({ ...options, method, url: initialUrl.href }, urlPolicy);

        let entry = this.inflight.get(serializedKey);
        if (!entry) {
            const controller = new AbortController();
            entry = { controller, consumers: 0, promise: Promise.resolve() };
            entry.promise = this.executeUnderlying({ ...options, method, url: initialUrl.href, signal: controller.signal }, urlPolicy)
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

    /** @param {Record<string, any>} options @param {{trustClass: string, hosts?: string[], expectedOrigin?: string}} urlPolicy */
    async executeUnderlying(options, urlPolicy) {
        try {
            const response = await this.port.request(options);
            this.urlPolicy.assertFinalUrl(response.finalUrl || options.url, urlPolicy);
            if (response.status >= 400) throw new JhsError(response.status === 404 ? "NOT_FOUND" : "NETWORK_ERROR", `HTTP ${response.status}`, { source: options.providerId, retryable: response.status >= 500 });
            return response;
        } catch (error) {
            const normalized = JhsError.from(error, options.providerId);
            this.diagnostics?.recordError(normalized);
            throw normalized;
        }
    }

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
