// @ts-check

import { JhsError } from "../../core/jhs-error.js";

export class UserscriptHttpAdapter {
    /** @param {(options: Record<string, any>) => {abort?: () => void} | void} requestImplementation @param {typeof fetch | null} [fetchImplementation] */
    constructor(requestImplementation, fetchImplementation = globalThis.fetch?.bind(globalThis) ?? null) {
        if (typeof requestImplementation !== "function") throw new TypeError("GM_xmlhttpRequest is required");
        this.requestImplementation = requestImplementation, this.fetchImplementation = fetchImplementation;
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, timeout?: number, nativeTimeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, transport?: string, redirect?: "follow" | "error" | "manual"}} options */
    request(options) {
        if ("native-fetch" === options.transport && this.fetchImplementation) return this.requestWithNativeFetch(options).catch((error => {
            if (error instanceof JhsError && "ABORTED" === error.code) throw error;
            return this.requestWithUserscript(options);
        }));
        return this.requestWithUserscript(options);
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, nativeTimeout?: number, signal?: AbortSignal, redirect?: "follow" | "error" | "manual"}} options */
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
                method: options.method ?? "GET", headers: options.headers, body: /** @type {BodyInit | null | undefined} */ (options.body), signal: controller.signal, redirect: options.redirect,
            });
            const responseText = await response.text(), data = "json" === options.responseType ? JSON.parse(responseText) : responseText;
            return {
                status: response.status, data, responseText, finalUrl: response.url || options.url,
                responseHeaders: [ ...response.headers.entries() ].map((entry => entry.join(": "))).join("\r\n"),
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

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, timeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>, redirect?: "follow" | "error" | "manual"}} options */
    requestWithUserscript(options) {
        return new Promise((resolve, reject) => {
            let settled = false;
            /** @type {{abort?: () => void} | void} */
            let handle;
            /** @param {(value: any) => void} callback @param {any} value */
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                options.signal?.removeEventListener("abort", onAbort);
                callback(value);
            };
            const onAbort = () => {
                handle?.abort?.();
                finish(reject, new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter" }));
            };
            handle = this.requestImplementation({
                ...options.requestOptions,
                method: options.method ?? "GET", url: options.url, headers: options.headers,
                data: options.body, responseType: options.responseType, timeout: options.timeout, redirect: options.redirect,
                onload: (/** @type {any} */ response) => finish(resolve, {
                    status: response.status, data: response.response ?? response.responseText,
                    responseText: response.responseText ?? "", finalUrl: response.finalUrl || options.url,
                    responseHeaders: response.responseHeaders ?? "",
                }),
                onerror: (/** @type {unknown} */ cause) => finish(reject, new JhsError("NETWORK_ERROR", "网络请求失败", { source: "UserscriptHttpAdapter", cause, retryable: true })),
                ontimeout: () => finish(reject, new JhsError("TIMEOUT", "网络请求超时", { source: "UserscriptHttpAdapter", retryable: true })),
                onabort: () => finish(reject, new JhsError("ABORTED", "网络请求已取消", { source: "UserscriptHttpAdapter" })),
            });
            if (options.signal?.aborted) onAbort();
            else options.signal?.addEventListener("abort", onAbort, { once: true });
        });
    }
}
