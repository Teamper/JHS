// @ts-check

import { JhsError } from "../../core/jhs-error.js";

export class UserscriptHttpAdapter {
    /** @param {(options: Record<string, any>) => {abort?: () => void} | void} requestImplementation @param {typeof fetch | null} [fetchImplementation] */
    constructor(requestImplementation, fetchImplementation = globalThis.fetch?.bind(globalThis) ?? null) {
        if (typeof requestImplementation !== "function") throw new TypeError("GM_xmlhttpRequest is required");
        this.requestImplementation = requestImplementation, this.fetchImplementation = fetchImplementation;
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, timeout?: number, nativeTimeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, transport?: string, onDispatch?: () => void}} options */
    request(options) {
        if ("native-fetch" === options.transport && !options.onDispatch && this.fetchImplementation) return this.requestWithNativeFetch(options).catch((error => {
            if (error instanceof JhsError && "ABORTED" === error.code) throw error;
            return this.requestWithUserscript(options).then((response) => ({
                ...response, nativeFallbackCode: error instanceof JhsError ? error.code : "UNKNOWN",
            }));
        }));
        return this.requestWithUserscript(options);
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, nativeTimeout?: number, signal?: AbortSignal}} options */
    async requestWithNativeFetch(options) {
        const controller = new AbortController();
        let timedOut = false;
        const timeoutMs = Math.max(0, Number(options.nativeTimeout) || 0);
        const onAbort = () => controller.abort();
        const timeoutId = timeoutMs > 0 ? setTimeout((() => { timedOut = true, controller.abort(); }), timeoutMs) : null;
        options.signal?.addEventListener("abort", onAbort, { once: true });
        try {
            if (options.signal?.aborted) controller.abort();
            const response = await /** @type {typeof fetch} */ (this.fetchImplementation)(options.url, {
                method: options.method ?? "GET", headers: options.headers, body: /** @type {BodyInit | null | undefined} */ (options.body), signal: controller.signal,
                credentials: "same-origin",
            });
            const responseText = await response.text(), data = "json" === options.responseType ? JSON.parse(responseText) : responseText;
            return {
                status: response.status, data, responseText, finalUrl: response.url || options.url,
                responseHeaders: [ ...response.headers.entries() ].map((entry => entry.join(": "))).join("\r\n"),
                transportUsed: "native-fetch",
            };
        } catch (cause) {
            if (options.signal?.aborted) throw new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter", cause });
            if (timedOut) throw new JhsError("TIMEOUT", "原生网络请求超时", { source: "UserscriptHttpAdapter", cause, retryable: true });
            throw new JhsError("NETWORK_ERROR", "原生网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true });
        } finally {
            null !== timeoutId && clearTimeout(timeoutId);
            options.signal?.removeEventListener("abort", onAbort);
        }
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, timeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, onDispatch?: () => void}} options */
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
            const timeoutMs = Number(options.timeout);
            if (Number.isFinite(timeoutMs) && timeoutMs > 0) timeoutId = setTimeout(onTimeout, timeoutMs);
            // The callback may refuse dispatch. Once GM is invoked even a synchronous
            // error cannot prove that the remote mutation was not accepted.
            try { options.onDispatch?.(); }
            catch (error) { finish(reject, error); return; }
            if (settled) return;
            try { handle = this.requestImplementation({
                ...options.requestOptions,
                method: options.method ?? "GET", url: options.url, headers: options.headers,
                data: options.body, responseType: options.responseType, timeout: options.timeout,
                onload: (/** @type {any} */ response) => finish(resolve, {
                    status: response.status, data: response.response ?? response.responseText,
                    responseText: response.responseText ?? "", finalUrl: response.finalUrl || options.url,
                    responseHeaders: response.responseHeaders ?? "",
                    transportUsed: "gm",
                }),
                onerror: (/** @type {unknown} */ cause) => finish(reject, new JhsError("NETWORK_ERROR", "网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true })),
                ontimeout: onTimeout,
                onabort: () => finish(reject, new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter" })),
            }); }
            catch (cause) { finish(reject, new JhsError("NETWORK_ERROR", "网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true })); }
            if (abortRequested) abortRequest();
        });
    }
}
