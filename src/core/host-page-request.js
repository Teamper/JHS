// @ts-check

/**
 * Fetches HTML from the current host through HttpService and its URL policy.
 * @param {{request: (options: Record<string, unknown>, scope?: import("./lifecycle-scope.js").LifecycleScope) => Promise<any>}} http
 * @param {string | URL} input
 * @param {import("./lifecycle-scope.js").LifecycleScope} [scope]
 */
export async function requestHostPage(http, input, scope) {
    const url = new URL(input, window.location.href);
    const response = await http.request({
        providerId: "host-page",
        method: "GET",
        url: url.href,
        responseType: "text",
        cacheScope: "none",
        urlPolicy: { trustClass: "builtin-public", hosts: [window.location.hostname], expectedOrigin: window.location.origin },
    }, scope);
    return String(response.data ?? response.responseText ?? "");
}
