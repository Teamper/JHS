// @ts-check

export class ExtensionHttpAdapter {
    /** @param {{call: (method: string, args?: any[], signal?: AbortSignal) => Promise<any>}} client @param {import("../userscript/userscript-http-adapter.js").UserscriptHttpAdapter} pageTransport @param {boolean} [pageSession] */
    constructor(client, pageTransport, pageSession = true) { this.client = client; this.pageTransport = pageTransport; this.pageSession = pageSession; }
    /** @param {any} options */
    async request(options) {
        if (options.transport === "native-fetch" && this.pageSession) return this.pageTransport.request(options);
        const permit = await options.beforeSend?.();
        if (options.signal?.aborted) throw new DOMException("请求已取消", "AbortError");
        permit?.();
        options.onDispatch?.();
        const response = await this.client.call("http.request", [{
            ...options.requestOptions, url: options.url, method: options.method, headers: options.headers,
            data: options.body, responseType: options.responseType, timeout: options.timeout,
            maxResponseBytes: options.maxResponseBytes, urlPolicy: options.urlPolicy,
        }], options.signal);
        return { status: response.status, data: response.response, responseText: response.responseText, finalUrl: response.finalUrl, responseHeaders: response.responseHeaders, transportUsed: "extension" };
    }
}
