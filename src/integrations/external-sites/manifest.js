// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { JhsError } from "../../core/jhs-error.js";

const SITES = Object.freeze([
    Object.freeze({ id: "javTrailersBtn", name: "javTrailers", settingKey: "javTrailersUrl", defaultBaseUrl: "https://javtrailers.com", itemSelector: ".videos-list .video-link", textSelector: "p.card-text", hrefSelector: null, searchPath: (/** @type {string} */ value) => `/search/${value}` }),
    Object.freeze({ id: "jableBtn", name: "jable", settingKey: "jableUrl", defaultBaseUrl: "https://jable.tv", itemSelector: "#list_videos_videos_list_search_result .detail .title a", textSelector: null, hrefSelector: null, searchPath: (/** @type {string} */ value) => `/search/${value}/` }),
    Object.freeze({ id: "avgleBtn", name: "avgle", settingKey: "avgleUrl", defaultBaseUrl: "https://jav.rs", itemSelector: ".text-secondary", textSelector: null, hrefSelector: null, searchPath: (/** @type {string} */ value) => `/vod/search.html?wd=${value}` }),
    Object.freeze({ id: "missAvBtn", name: "missAv", settingKey: "missAvUrl", defaultBaseUrl: "https://missav.live", itemSelector: ".text-secondary", textSelector: null, hrefSelector: null, searchPath: (/** @type {string} */ value) => `/search/${value}` }),
    Object.freeze({ id: "supJavBtn", name: "supJav", settingKey: "supJavUrl", defaultBaseUrl: "https://supjav.com", itemSelector: ".posts post", textSelector: null, hrefSelector: null, titleAttribute: true, searchPath: (/** @type {string} */ value) => `/?s=${value}` }),
    Object.freeze({ id: "javDbBtn", name: "javDb", settingKey: "javDbUrl", defaultBaseUrl: "https://javdb.com", itemSelector: ".movie-list .item", textSelector: ".video-title", hrefSelector: "a", searchPath: (/** @type {string} */ value) => `/search?q=${value}` }),
    Object.freeze({ id: "javBusBtn", name: "javBus", settingKey: "javBusUrl", defaultBaseUrl: "https://www.javbus.com", itemSelector: ".container h3", textSelector: null, hrefSelector: null, directDetail: true, searchPath: (/** @type {string} */ value) => `/${value}` }),
]);

/** @param {any} site @param {Record<string, any>} settings */
function siteDefinition(site, settings) {
    const baseUrl = new URL(settings[site.settingKey] || site.defaultBaseUrl).origin;
    return Object.freeze({ id: site.id, name: site.name, baseUrl, searchUrl: (/** @type {string} */ carNum) => new URL(site.searchPath(encodeURIComponent(carNum)), `${baseUrl}/`).href });
}

/** @param {string} html @param {any} site @param {string} carNum @param {string} baseUrl */
export function parseExternalSiteResults(html, site, carNum, baseUrl) {
    if (typeof html !== "string") throw new JhsError("INVALID_RESPONSE", "外部站点响应不是 HTML", { source: site.id });
    const document = new DOMParser().parseFromString(html, "text/html"), results = [];
    for (const element of document.querySelectorAll(site.itemSelector)) {
        const textNode = site.textSelector ? element.querySelector(site.textSelector) : element;
        const text = site.titleAttribute ? element.getAttribute("title") || "" : textNode?.textContent?.trim() || "";
        if (!text.toLowerCase().includes(carNum.toLowerCase())) continue;
        if (site.directDetail) results.push(new URL(`/${encodeURIComponent(carNum)}`, `${baseUrl}/`).href);
        else {
            const hrefNode = site.hrefSelector ? element.querySelector(site.hrefSelector) : element, href = hrefNode?.getAttribute("href");
            if (!href) throw new JhsError("PARSE_ERROR", "外部站点结果缺少链接", { source: site.id });
            results.push(new URL(href, `${baseUrl}/`).href);
        }
    }
    return Object.freeze([...new Set(results)]);
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createExternalSitesAdapter(http) {
    return Object.freeze({
        contracts: ["ExternalSiteResult"],
        /** @param {Record<string, any>} [settings] */
        getSites(settings = {}) { return Object.freeze(SITES.map((site) => siteDefinition(site, settings))); },
        getNavigationLinks: () => Object.freeze([Object.freeze({ id: "theporndude", label: "ThePornDude", url: "https://theporndude.com/zh" })]),
        /** @param {string} siteId @param {string} carNum @param {{settings?: Record<string, any>, scope?: any}} [options] */
        async searchSite(siteId, carNum, options = {}) {
            const site = SITES.find((item) => item.id === siteId);
            if (!site) throw new JhsError("UNSUPPORTED", `未知外部站点：${siteId}`, { source: "external-sites" });
            const definition = siteDefinition(site, options.settings || {}), url = definition.searchUrl(carNum), target = new URL(url), builtinHost = new URL(site.defaultBaseUrl).hostname.replace(/^www\./, "");
            const urlPolicy = target.hostname === builtinHost || target.hostname.endsWith(`.${builtinHost}`)
                ? { trustClass: "builtin-public", hosts: [builtinHost], expectedOrigin: target.origin }
                : { trustClass: "custom-public", expectedOrigin: target.origin };
            const response = await http.request({ capability: "movie.external-sites", providerId: `external-site:${siteId}`, method: "GET", url, responseType: "text", urlPolicy }, options.scope);
            return Object.freeze({ searchUrl: url, matches: parseExternalSiteResults(response.data, site, carNum, definition.baseUrl) });
        },
    });
}

export default defineIntegration({
    id: "external-sites", trustClass: "builtin-public", hosts: ["javtrailers.com", "jable.tv", "jav.rs", "missav.live", "supjav.com", "javdb.com", "javbus.com", "theporndude.com"],
    capabilities: ["movie.external-sites", "navigation.external"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createExternalSitesAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.external-sites": "public-1d", "navigation.external": "none" }, quality: "silver",
});
