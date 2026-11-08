// @ts-check
import { movieCodeKey, movieCodeTokens } from "./movie-code-evidence.js";

export const MEDIA_CONNECTIONS_KEY = "jhs_media_connections_v1";

/** @param {any} value */
export function normalizeMediaConnection(value) {
    if (!value || !["emby", "jellyfin"].includes(value.type)) throw new TypeError("请选择 Emby 或 Jellyfin");
    const address = String(value.address || "").trim();
    if (/\\|%(?:2f|5c|2e)/i.test(address)) throw new TypeError("服务器路径无效");
    const url = new URL(address);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new TypeError("服务器地址仅支持无凭证、无查询参数的 HTTP/HTTPS 地址");
    if (/%(?:2f|5c|2e)/i.test(url.pathname)) throw new TypeError("服务器路径无效");
    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    const id = String(value.id || ""), name = String(value.name || "").trim(), apiKey = String(value.apiKey || "").trim(), userId = String(value.userId || "").trim();
    if (!/^[\w-]{1,80}$/.test(id) || !name || name.length > 100 || !apiKey || apiKey.length > 4096 || /["\\\x00-\x20\x7f]/.test(apiKey)) throw new TypeError("服务器名称或 API Key 无效");
    if (userId && !/^[\w-]{1,80}$/.test(userId)) throw new TypeError("用户范围 ID 无效");
    return { id, name, type: String(value.type), address: url.href, apiKey, userId, enabled: value.enabled === true };
}

/** @param {unknown} value */
function mediaPathParts(value) {
    if (typeof value !== "string") return [];
    let path = value;
    if (/^https?:\/\//i.test(path)) {
        try { path = new URL(path).pathname; } catch { return []; }
        try { path = decodeURIComponent(path); } catch { /* Retain literal filename evidence. */ }
    }
    return path.split(/[\\/]+/).filter(Boolean);
}

/** Catalog database IDs have their own namespaces. Only explicit movie-code fields participate. @param {any} values */
function mediaIdentifierValues(values) {
    /** @type {string[]} */ const result = [];
    for (const [name, value] of Object.entries(values || {})) {
        if (typeof value !== "string" || /^(?:imdb|tmdb|tvdb|anidb|musicbrainz|tvmaze)$/i.test(name)) continue;
        const key = name.replace(/[\s_-]/g, "").toLowerCase();
        const text = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").trim().toUpperCase();
        if (["code", "moviecode", "avcode", "carnum"].includes(key)) result.push(text);
        else if (["fc2", "fc2ppv"].includes(key) && /^\d+$/.test(text)) result.push(`FC2-${text}`);
        else if (/^(?:FC2[\s_-]*(?:PPV[\s_-]*)?\d+|(?:[A-Z]{2,10}|\d{1,3}[A-Z]{2,8})[\s_-]+\d{2,}|\d{6}[\s_-]+\d{2,})$/.test(text)) result.push(text);
    }
    return result;
}

/** Titles and filenames establish identity before explicit code metadata and the nearest movie folder. @param {any} item @returns {string | null} */
export function mediaItemCode(item) {
    const paths = [item.Path, ...(item.MediaSources || []).map((/** @type {any} */ source) => source.Path)].map(mediaPathParts);
    const primary = [item.Name, item.OriginalTitle, ...paths.map(parts => parts.at(-1))].filter(value => typeof value === "string");
    let codes = movieCodeTokens(primary.join(" "));
    if (!codes.length) codes = movieCodeTokens(mediaIdentifierValues(item.ProviderIds).join(" "));
    if (!codes.length) {
        const folders = paths.map(parts => parts.slice(0, -1).reverse().find(part => movieCodeTokens(part).length)).filter(value => typeof value === "string");
        codes = movieCodeTokens(folders.join(" "));
    }
    if (!codes.length || codes.some(code => code !== codes[0])) return null;
    return codes[0];
}

/** @param {any} item @param {string} carNum */
export function matchesMediaItem(item, carNum) { return typeof carNum === "string" && mediaItemCode(item) === movieCodeKey(carNum); }

/** Preserve the reverse-proxy prefix, adding Emby's API suffix only once. @param {any} connection @param {string} endpoint */
export function mediaApiUrl(connection, endpoint) {
    const base = new URL(connection.address);
    if (connection.type === "emby" && !/(?:^|\/)(?:emby|mediabrowser)\/$/i.test(base.pathname)) base.pathname += "emby/";
    return new URL(endpoint, base);
}

/** Links contain identifiers only. @param {any} connection @param {string} itemId @param {string} serverId */
export function mediaItemLink(connection, itemId, serverId) {
    const base = new URL(connection.address);
    if (connection.type === "emby") base.pathname = base.pathname.replace(/(?:emby|mediabrowser)\/$/i, "");
    const url = new URL(connection.type === "jellyfin" ? "web/" : "web/index.html", base);
    const query = new URLSearchParams({ id: itemId, serverId });
    url.hash = `${connection.type === "jellyfin" ? "/" : "!/"}details?${query}`;
    if (connection.type === "emby") url.hash = `!/item?${query}`;
    return url.href;
}
