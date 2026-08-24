// @ts-check

import { JhsError } from "../../core/jhs-error.js";

export class UserscriptHttpAdapter {
    /** @param {(options: Record<string, any>) => {abort?: () => void} | void} requestImplementation */
    constructor(requestImplementation) {
        if (typeof requestImplementation !== "function") throw new TypeError("GM_xmlhttpRequest is required");
        this.requestImplementation = requestImplementation;
    }

    /** @param {{url: string, method?: string, headers?: Record<string, string>, body?: unknown, responseType?: string, timeout?: number, signal?: AbortSignal, requestOptions?: Record<string, unknown>}} options */
    request(options) {
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
                data: options.body, responseType: options.responseType, timeout: options.timeout,
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
