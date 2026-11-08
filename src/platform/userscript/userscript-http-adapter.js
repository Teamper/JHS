// @ts-check

import { JhsError } from "../../core/jhs-error.js";

export class UserscriptHttpAdapter {
    /** @param {(options: Record<string, any>) => {abort?: () => void} | void} requestImplementation @param {typeof fetch | null} [fetchImplementation] */
    constructor(requestImplementation, fetchImplementation = globalThis.fetch?.bind(globalThis) ?? null) {
        if (typeof requestImplementation !== "function") throw new TypeError("GM_xmlhttpRequest is required");
        this.requestImplementation = requestImplementation, this.fetchImplementation = fetchImplementation;
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, maxResponseBytes?: number, timeout?: number, nativeTimeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, transport?: string, nativeFallback?: boolean, onDispatch?: () => void, beforeSend?: () => Promise<any>}} options */
    request(options) {
        if (options.transport === "native-fetch" && options.nativeFallback === false && (!this.fetchImplementation || options.onDispatch)) return Promise.reject(new JhsError("UNSUPPORTED", "当前环境无法安全使用网页会话请求", { source: "UserscriptHttpAdapter" }));
        if ("native-fetch" === options.transport && !options.onDispatch && this.fetchImplementation) return this.requestWithNativeFetch(options).catch((error => {
            if (options.nativeFallback === false || error instanceof JhsError && ["ABORTED", "BUDGET_EXCEEDED", "UNSUPPORTED"].includes(error.code)) throw error;
            return this.requestWithUserscript(options).then((response) => ({
                ...response, nativeFallbackCode: error instanceof JhsError ? error.code : "UNKNOWN",
            }));
        }));
        return this.requestWithUserscript(options);
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, nativeTimeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, beforeSend?: () => Promise<any>}} options */
    async requestWithNativeFetch(options) {
        if (options.signal?.aborted) throw new JhsError("ABORTED", "网络请求已取消", {source:"UserscriptHttpAdapter"});
        const permit = options.beforeSend ? await options.beforeSend() : null;
        if (options.signal?.aborted) throw new JhsError("ABORTED", "网络请求已取消", {source:"UserscriptHttpAdapter"});
        const controller = new AbortController();
        let timedOut = false;
        const timeoutMs = Math.max(0, Number(options.nativeTimeout) || 0);
        const onAbort = () => controller.abort();
        const timeoutId = timeoutMs > 0 ? setTimeout((() => { timedOut = true, controller.abort(); }), timeoutMs) : null;
        options.signal?.addEventListener("abort", onAbort, { once: true });
        try {
            if (options.signal?.aborted) controller.abort();
            if (typeof permit === "function") permit();
            const response = await /** @type {typeof fetch} */ (this.fetchImplementation)(options.url, {
                method: options.method ?? "GET", headers: options.headers, body: /** @type {BodyInit | null | undefined} */ (options.body), signal: controller.signal,
                credentials: "same-origin",
                redirect: options.requestOptions?.redirect === "error" ? "error" : "follow",
                cache: options.requestOptions?.cache === "no-store" ? "no-store" : "default",
            });
            const responseText = await response.text(), data = "json" === options.responseType ? JSON.parse(responseText) : responseText;
            return {
                status: response.status, data, responseText, finalUrl: response.url || options.url,
                responseHeaders: [ ...response.headers.entries() ].map((entry => entry.join(": "))).join("\r\n"),
                transportUsed: "native-fetch",
            };
        } catch (cause) {
            if (cause instanceof JhsError) throw cause;
            if (options.signal?.aborted) throw new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter", cause });
            if (timedOut) throw new JhsError("TIMEOUT", "原生网络请求超时", { source: "UserscriptHttpAdapter", cause, retryable: true });
            throw new JhsError("NETWORK_ERROR", "原生网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true });
        } finally {
            null !== timeoutId && clearTimeout(timeoutId);
            options.signal?.removeEventListener("abort", onAbort);
        }
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, maxResponseBytes?: number, timeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, onDispatch?: () => void, beforeSend?: () => Promise<any>}} options */
    requestWithUserscript(options) {
        return new Promise((resolve, reject) => {
            let settled = false, abortRequested = false, aborted = false;
            /** @type {{abort?: () => void} | void} */
            let handle;
            /** @type {ReturnType<typeof setTimeout> | null} */
            let timeoutId = null;
            /** @param {(value: any) => void} callback @param {any} value */
            const finish = (callback, value) => {
                if (settled) return false;
                settled = true;
                if (timeoutId !== null) clearTimeout(timeoutId);
                options.signal?.removeEventListener("abort", onAbort);
                callback(value);
                return true;
            };
            const abortRequest = () => {
                abortRequested = true;
                if (!handle || aborted) return;
                aborted = true;
                try { handle.abort?.(); } catch { /* The settled result owns cancellation errors. */ }
            };
            const onAbort = () => {
                if (finish(reject, new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter" }))) abortRequest();
            };
            const onTimeout = () => {
                if (finish(reject, new JhsError("TIMEOUT", "网络请求超时", { source: "UserscriptHttpAdapter", retryable: true }))) abortRequest();
            };
            if (options.signal?.aborted) { onAbort(); return; }
            options.signal?.addEventListener("abort", onAbort, { once: true });
            const dispatch = (/** @type {unknown} */ permit = undefined) => {
                if (settled) return;
                const timeoutMs = Number(options.timeout);
                if (Number.isFinite(timeoutMs) && timeoutMs > 0) timeoutId = setTimeout(onTimeout, timeoutMs);
                // The callback may refuse dispatch. Once GM is invoked even a synchronous
                // error cannot prove that the remote mutation was not accepted.
                try { if (typeof permit === "function") permit(); options.onDispatch?.(); }
                catch (error) { finish(reject, error); return; }
                if (settled) return;
                try { handle = this.requestImplementation({
                    ...options.requestOptions,
                    method: options.method ?? "GET", url: options.url, headers: options.headers,
                    data: options.body, responseType: options.responseType, timeout: options.timeout,
                    onprogress: (/** @type {any} */ progress) => {
                        if (options.maxResponseBytes && (progress.loaded > options.maxResponseBytes || progress.lengthComputable && progress.total > options.maxResponseBytes)) {
                            if (finish(reject, new JhsError("RESPONSE_TOO_LARGE", "响应超过文件大小上限", { source: "UserscriptHttpAdapter" }))) abortRequest();
                        }
                    },
                    onload: (/** @type {any} */ response) => finish(resolve, {
                        status: response.status, data: response.response ?? response.responseText,
                        responseText: options.responseType === "arraybuffer" ? "" : response.responseText ?? "", finalUrl: response.finalUrl || options.url,
                        responseHeaders: response.responseHeaders ?? "",
                        transportUsed: "gm",
                    }),
                    onerror: (/** @type {unknown} */ cause) => finish(reject, new JhsError("NETWORK_ERROR", "网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true })),
                    ontimeout: onTimeout,
                    onabort: () => finish(reject, new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter" })),
                }); }
                catch (cause) { finish(reject, new JhsError("NETWORK_ERROR", "网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true })); }
                if (abortRequested) abortRequest();
            };
            if (options.beforeSend) Promise.resolve().then(() => options.beforeSend?.()).then(dispatch, error => finish(reject,error));
            else dispatch();
        });
    }
}
