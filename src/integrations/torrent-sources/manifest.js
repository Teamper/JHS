// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { JhsError } from "../../core/jhs-error.js";

const SOURCES = Object.freeze([
    Object.freeze({ id: "u9a9", name: "U9A9", type: "网页来源", domain: "u9a9.com", baseUrl: "https://u9a9.com", priority: 20, enabled: true, searchPath: (/** @type {string} */ keyword) => `/?type=2&search=${encodeURIComponent(keyword)}` }),
    Object.freeze({ id: "u3c3", name: "U3C3", type: "网页来源", domain: "u3c3.com", baseUrl: "https://u3c3.com", priority: 30, enabled: true, searchPath: (/** @type {string} */ keyword) => `/?search2=a8lr16lo&search=${encodeURIComponent(keyword)}` }),
    Object.freeze({ id: "sukebei", name: "Sukebei", type: "网页来源", domain: "sukebei.nyaa.si", baseUrl: "https://sukebei.nyaa.si", priority: 40, enabled: true, searchPath: (/** @type {string} */ keyword) => `/?f=0&c=0_0&q=${encodeURIComponent(keyword)}` }),
    Object.freeze({ id: "btsow", name: "BTSOW", type: "API 来源", domain: "btsow.lol", baseUrl: "https://btsow.lol", priority: 50, enabled: true, searchPath: (/** @type {string} */ keyword) => `/search/${encodeURIComponent(keyword)}` }),
]);

/** @param {unknown} value @param {string} source */
function normalizeMagnet(value, source) {
    const item = /** @type {any} */ (value), magnet = String(item?.magnet || "");
    if (!magnet.startsWith("magnet:")) return null;
    return Object.freeze({ title: String(item.title || ""), magnet, size: String(item.size || ""), date: String(item.date || ""), seeders: Number(item.seeders) || 0, leechers: Number(item.leechers) || 0, source, files: Object.freeze([]) });
}

/** @param {string} html @param {string} keyword @param {string} source */
export function parseTorrentSource(html, keyword, source) {
    if (typeof html !== "string") throw new JhsError("INVALID_RESPONSE", "磁力来源响应不是 HTML", { source });
    const document = new DOMParser().parseFromString(html, "text/html"), challenge = `${document.title} ${document.body?.textContent || ""}`;
    if (/Just a moment|cf-chl-|Cloudflare/i.test(challenge)) throw new JhsError("CF_BLOCKED", "磁力来源被 Cloudflare 拦截", { source });
    return Object.freeze([...document.querySelectorAll(".torrent-list tbody tr")].flatMap((row) => {
        if (row.textContent?.includes("置顶")) return [];
        const titleNode = row.querySelector("td:nth-child(2) a"), title = titleNode?.getAttribute("title") || titleNode?.textContent?.trim() || "";
        if (!title.toLowerCase().includes(keyword.toLowerCase())) return [];
        const result = normalizeMagnet({
            title, magnet: row.querySelector('td:nth-child(3) a[href^="magnet:"]')?.getAttribute("href"),
            size: row.querySelector("td:nth-child(4)")?.textContent?.trim(), date: row.querySelector("td:nth-child(5)")?.textContent?.trim(),
            seeders: row.querySelector("td:nth-child(6)")?.textContent?.trim(), leechers: row.querySelector("td:nth-child(7)")?.textContent?.trim(),
        }, source);
        return result ? [result] : [];
    }));
}

/** @param {unknown} payload */
export function parseBtsowSource(payload) {
    let value = payload;
    if (typeof value === "string") {
        try { value = JSON.parse(value); }
        catch (cause) { throw new JhsError("INVALID_RESPONSE", "BTSOW 返回了无效 JSON", { source: "btsow", cause }); }
    }
    const items = /** @type {any} */ (value)?.data;
    if (!Array.isArray(items)) throw new JhsError("INVALID_RESPONSE", "BTSOW 响应缺少结果数组", { source: "btsow" });
    return Object.freeze(items.flatMap((/** @type {any} */ item) => {
        const timestamp = Number(item.lastUpdateTime), date = Number.isFinite(timestamp) ? new Date(1000 * timestamp).toISOString().slice(0, 10) : "";
        const result = normalizeMagnet({ title: item.name, magnet: `magnet:?xt=urn:btih:${item.hash}`, size: `${(Number(item.size) / 1073741824).toFixed(2)} GB`, date }, "btsow");
        return result ? [result] : [];
    }));
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createTorrentSourcesAdapter(http) {
    const find = (/** @type {string} */ id) => SOURCES.find((source) => source.id === id);
    return Object.freeze({
        contracts: ["Magnet", "MagnetSource"],
        getSources: () => Object.freeze(SOURCES.map((source) => Object.freeze({ id: source.id, name: source.name, type: source.type, domain: source.domain, baseUrl: source.baseUrl, priority: source.priority, enabled: source.enabled }))),
        /** @param {string} sourceId @param {string} keyword @param {{baseUrl?: string, scope?: any}} [options] */
        targetUrl(sourceId, keyword, options = {}) {
            const source = find(sourceId);
            if (!source) throw new JhsError("UNSUPPORTED", `未知磁力来源：${sourceId}`, { source: "torrent-sources" });
            const origin = new URL(options.baseUrl || source.baseUrl).origin;
            return `${origin}${source.searchPath(keyword)}`;
        },
        /** @param {string} sourceId @param {string} keyword @param {{baseUrl?: string, scope?: any}} [options] */
        async search(sourceId, keyword, options = {}) {
            const source = find(sourceId);
            if (!source) throw new JhsError("UNSUPPORTED", `未知磁力来源：${sourceId}`, { source: "torrent-sources" });
            const origin = new URL(options.baseUrl || source.baseUrl).origin, overridden = new URL(origin).hostname !== source.domain;
            const urlPolicy = overridden ? { trustClass: "custom-public", expectedOrigin: origin } : { trustClass: "builtin-public", hosts: [source.domain], expectedOrigin: origin };
            if (source.id === "btsow") {
                const response = await http.request({ providerId: "magnet:btsow", method: "POST", url: `${origin}/search`, body: JSON.stringify([{ search: keyword }, 50, 1]), headers: { "Content-Type": "application/json" }, responseType: "json", cacheScope: "none", urlPolicy }, options.scope);
                return parseBtsowSource(response.data);
            }
            const url = `${origin}${source.searchPath(keyword)}`;
            const response = await http.request({ providerId: `magnet:${source.id}`, method: "GET", url, responseType: "text", cacheScope: "public", ttlMs: 21_600_000, urlPolicy }, options.scope);
            return parseTorrentSource(response.data, keyword, source.id);
        },
    });
}

export default defineIntegration({
    id: "torrent-sources", trustClass: "builtin-public", hosts: ["u9a9.com", "u3c3.com", "sukebei.nyaa.si", "btsow.lol"],
    capabilities: ["magnet.search"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createTorrentSourcesAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "magnet.search": "source-configured" }, quality: "silver",
});
