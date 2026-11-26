// @ts-check
import { JhsError } from "../../core/jhs-error.js";
/** @param {any} options @param {AbortSignal} signal @param {import("../../services/external-url-policy.js").ExternalUrlPolicy} policy */
export async function extensionFetch(options, signal, policy) {
    let url = new URL(options.url);
    const urlPolicy = options.urlPolicy || { trustClass: "custom-public" };
    const headers = new Headers(options.headers);
    let anonymous = Boolean(options.anonymous);
    let method = options.method || "GET";
    let body = options.data;
    for (let hop = 0; hop <= 5; hop++) {
        policy.assertAllowed(url.href, urlPolicy);
        if (!await chrome.permissions.contains({ origins: [`${url.origin}/*`] })) throw Object.assign(new Error(`请先授权来源 ${url.origin}`), { code: "HOST_PERMISSION_REQUIRED" });
        const current = url;
        const result = await navigator.locks.request(`jhs-http:${current.href}`, { signal }, async () => {
            /** @type {chrome.declarativeNetRequest.ModifyHeaderInfo[]} */ const modifications = [];
            const fetchHeaders = new Headers(headers);
            for (const header of ["referer", "origin", "cookie", "user-agent"]) {
                if (!fetchHeaders.has(header)) continue;
                modifications.push({ header, operation: "set", value: fetchHeaders.get(header) || "" });
                fetchHeaders.delete(header);
            }
            const ruleId = modifications.length ? Math.floor(Math.random() * 1000000000) + 1 : null;
            /** @type {chrome.webRequest.OnHeadersReceivedDetails|undefined} */ let wire;
            /** @param {chrome.webRequest.OnHeadersReceivedDetails} details */
            const observe = details => { if (details.initiator === chrome.runtime.getURL("").replace(/\/$/, "")) wire = details; return undefined; };
            chrome.webRequest.onHeadersReceived.addListener(observe, { urls: [current.href], types: ["xmlhttprequest"] }, ["responseHeaders"]);
            try {
                if (ruleId) await chrome.declarativeNetRequest.updateSessionRules({ addRules: [{ id: ruleId, priority: 1, action: { type: "modifyHeaders", requestHeaders: modifications }, condition: { urlFilter: `|${current.href}|`, initiatorDomains: [chrome.runtime.id], resourceTypes: ["xmlhttprequest"] } }] });
                const response = await fetch(current.href, { method, headers: fetchHeaders, body, signal, credentials: anonymous ? "omit" : "include", redirect: "manual" });
                const status = response.status || wire?.statusCode || 0;
                const responseHeaders = wire?.responseHeaders?.map(item => `${item.name}: ${item.value || ""}`).join("\r\n") || [...response.headers].map(([name, value]) => `${name}: ${value}`).join("\r\n");
                if ([301, 302, 303, 307, 308].includes(status)) return { status, responseHeaders, response: "", responseText: "", finalUrl: current.href };
                const reader = response.body?.getReader();
                /** @type {Uint8Array[]} */ const chunks = [];
                let size = 0;
                if (reader) while (true) {
                    const part = await reader.read();
                    if (part.done) break;
                    size += part.value.length;
                    if (options.maxResponseBytes && size > options.maxResponseBytes) { await reader.cancel(); throw Object.assign(new Error("响应超过文件大小上限"), { code: "RESPONSE_TOO_LARGE" }); }
                    chunks.push(part.value);
                }
                const bytes = new Uint8Array(size);
                let offset = 0;
                for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
                const charset = responseHeaders.match(/content-type:[^\r\n]*charset\s*=\s*["']?([^;\s"']+)/i)?.[1] || "utf-8";
                const text = options.responseType === "arraybuffer" ? "" : new TextDecoder(charset).decode(bytes);
                let data = options.responseType === "arraybuffer" ? bytes.buffer : text;
                if (options.responseType === "json") {
                    try { data = JSON.parse(text || "null"); }
                    catch (cause) { if (status >= 200 && status < 300) throw new JhsError("PARSE_ERROR", "JSON 响应解析失败", { source: "ExtensionHttpAdapter", cause }); }
                }
                return { status, responseHeaders, response: data, responseText: options.responseType === "arraybuffer" ? "" : text, finalUrl: current.href };
            } finally {
                chrome.webRequest.onHeadersReceived.removeListener(observe);
                if (ruleId) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
            }
        });
        if (![301, 302, 303, 307, 308].includes(result.status) || options.redirect === "manual") return result;
        if (options.redirect === "error") throw Object.assign(new Error("请求发生了禁止的重定向"), { code: "INVALID_URL" });
        const location = result.responseHeaders.match(/^location:\s*(.+)$/im)?.[1];
        if (!location) throw new Error("跳转缺少 Location");
        const next = new URL(location.trim(), url);
        if (next.origin !== url.origin) { anonymous = true; headers.delete("Authorization"); headers.delete("Cookie"); headers.delete("Origin"); headers.delete("Referer"); }
        if (result.status === 303 || [301, 302].includes(result.status) && method === "POST") { method = "GET"; body = undefined; headers.delete("Content-Type"); }
        url = next;
    }
    throw Object.assign(new Error("请求跳转次数超过限制"), { code: "INVALID_URL" });
}
