// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { JhsError } from "../../core/jhs-error.js";

const SOURCES = Object.freeze([
    Object.freeze({ id: "jsdelivr", name: "jsDelivr (全球CDN)", catalogUrl: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Filetree.json", contentBaseUrl: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/", recommended: true }),
    Object.freeze({ id: "github-raw", name: "GitHub Raw (备用)", catalogUrl: "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json", contentBaseUrl: "https://raw.githubusercontent.com/gfriends/gfriends/master/Content/", recommended: false }),
]);

/** @param {unknown} payload @param {string} contentBaseUrl */
export function parseGfriendsCatalog(payload, contentBaseUrl) {
    const content = /** @type {any} */ (payload)?.Content;
    if (!content || typeof content !== "object" || Array.isArray(content)) throw new JhsError("INVALID_RESPONSE", "头像数据源缺少 Content", { source: "gfriends" });
    /** @type {Map<string, string[]>} */
    const index = new Map();
    for (const [folder, entries] of Object.entries(content)) {
        if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
        for (const [filename, rawPath] of Object.entries(entries)) {
            if (typeof rawPath !== "string") continue;
            let key = filename.replace(/\.jpg$/i, "").split("-")[0];
            if (key.startsWith("AI-Fix-")) key = key.slice(7);
            key = key.toLowerCase().trim();
            if (!key) continue;
            const queryIndex = rawPath.indexOf("?"), path = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath, query = queryIndex >= 0 ? rawPath.slice(queryIndex) : "";
            const url = `${contentBaseUrl}${encodeURIComponent(folder)}/${encodeURIComponent(path)}${query}`;
            const values = index.get(key) || [];
            if (!values.includes(url)) values.push(url);
            index.set(key, values);
        }
    }
    return index;
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createGfriendsAdapter(http) {
    return Object.freeze({
        contracts: ["ActorAvatar"],
        getSources: () => Object.freeze(SOURCES.map((source) => Object.freeze({ id: source.id, name: source.name, recommended: source.recommended }))),
        /** @param {string[]} names @param {{sourceId?: string, scope?: any}} [options] */
        async searchAvatars(names, options = {}) {
            const source = SOURCES.find((item) => item.id === (options.sourceId || SOURCES[0].id));
            if (!source) throw new JhsError("UNSUPPORTED", `未知头像数据源：${options.sourceId}`, { source: "gfriends" });
            const response = await http.request({
                providerId: `gfriends:${source.id}`, method: "GET", url: source.catalogUrl, responseType: "json",
                cacheScope: "public", ttlMs: 604_800_000, timeout: 20_000, urlPolicy: { trustClass: "builtin-public", hosts: [new URL(source.catalogUrl).hostname] },
            }, options.scope);
            const index = parseGfriendsCatalog(response.data, source.contentBaseUrl), results = new Set();
            names.map((name) => String(name).toLowerCase().trim()).filter(Boolean).forEach((name) => index.get(name)?.forEach((url) => results.add(url)));
            return Object.freeze([...results]);
        },
    });
}

export default defineIntegration({
    id: "gfriends", trustClass: "builtin-public", hosts: ["cdn.jsdelivr.net", "raw.githubusercontent.com"],
    capabilities: ["person.avatar-search"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createGfriendsAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "person.avatar-search": "public-7d" }, quality: "silver",
});
