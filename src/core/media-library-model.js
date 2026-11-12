// @ts-check
import { movieCodeKey, movieCodeTokens } from "./movie-code-evidence.js";

export const MEDIA_CONNECTIONS_KEY = "jhs_media_connections_v1";

/** Local validation errors carry a field without including connection secrets. */
export class MediaConnectionValidationError extends TypeError {
    /** @param {string} field @param {string} message */
    constructor(field, message) {
        super(message);
        this.field = field;
    }
}

/** @param {any} value */
export function normalizeMediaConnection(value) {
    if (!value || !["emby", "jellyfin"].includes(value.type)) throw new MediaConnectionValidationError("type", "请选择 Emby 或 Jellyfin");
    const name = String(value.name || "").trim();
    if (!name) throw new MediaConnectionValidationError("name", "请填写服务器名称");
    if (name.length > 100) throw new MediaConnectionValidationError("name", "服务器名称不能超过 100 个字符");
    const address = String(value.address || "").trim();
    if (!address) throw new MediaConnectionValidationError("address", "请填写服务器地址");
    if (/\\|%(?:2f|5c|2e)/i.test(address)) throw new MediaConnectionValidationError("address", "服务器路径不能包含反斜杠或编码的路径分隔符");
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(address);
    const hasHostPort = /^[^/?#]+:\d+(?:[/?#]|$)/.test(address);
    let url;
    try { url = new URL(!hasScheme || hasHostPort ? `http://${address}` : address); }
    catch { throw new MediaConnectionValidationError("address", "服务器地址格式无效，请检查 IP、主机名和端口"); }
    if (!["http:", "https:"].includes(url.protocol)) throw new MediaConnectionValidationError("address", "服务器地址仅支持 HTTP/HTTPS");
    if (url.username || url.password) throw new MediaConnectionValidationError("address", "服务器地址不能包含用户名或密码，请单独填写 API Key");
    if (url.search || url.hash) throw new MediaConnectionValidationError("address", "服务器地址不能包含查询参数或片段，请只填写地址和代理子路径");
    if (/%(?:2f|5c|2e)/i.test(url.pathname)) throw new MediaConnectionValidationError("address", "服务器路径不能包含编码的路径分隔符");
    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    const id = String(value.id || ""), apiKey = String(value.apiKey || "").trim(), userId = String(value.userId || "").trim();
    if (!/^[\w-]{1,80}$/.test(id)) throw new MediaConnectionValidationError("id", "服务器配置标识无效，请重新添加服务器");
    if (!apiKey) throw new MediaConnectionValidationError("apiKey", "请填写 API Key");
    if (apiKey.length > 4096) throw new MediaConnectionValidationError("apiKey", "API Key 不能超过 4096 个字符");
    if (/["\\\x00-\x20\x7f]/.test(apiKey)) throw new MediaConnectionValidationError("apiKey", "API Key 格式无效，请检查空格、换行、引号或反斜杠");
    if (userId && !/^[\w-]{1,80}$/.test(userId)) throw new MediaConnectionValidationError("userId", "用户 ID 仅支持字母、数字、下划线和连字符，最多 80 个字符");
    return { id, name, type: String(value.type), address: url.href, apiKey, userId, enabled: value.enabled === true };
}

/** Bounded messages exclude upstream bodies, URLs and credential values. @param {any} error */
export function mediaConnectionErrorLabel(error) {
    if (error instanceof MediaConnectionValidationError) return error.message;
    const status = Number(error?.details?.status);
    /** @type {Record<number, string>} */
    const httpLabels = {
        401: "认证失败（HTTP 401），请检查 API Key 是否正确或已失效",
        403: "服务器拒绝访问（HTTP 403），请检查 API Key 和用户范围权限",
        404: "接口不存在（HTTP 404），请检查服务器类型、地址和代理子路径",
        429: "服务器请求过于频繁（HTTP 429），请稍后重试",
    };
    if (httpLabels[status]) return httpLabels[status];
    if (Number.isInteger(status) && status >= 500 && status <= 599) return `服务器响应异常（HTTP ${status}），请稍后重试`;
    if (Number.isInteger(status) && status >= 400 && status <= 499) return `服务器拒绝请求（HTTP ${status}），请检查连接配置`;
    if (error?.code === "INVALID_RESPONSE" || error?.code === "PARSE_ERROR") {
        return error?.details?.stage === "catalog" ? "媒体目录响应格式无效，请检查服务器类型、用户范围和代理配置" : "服务器身份响应格式无效，请检查服务器类型、地址和代理配置";
    }
    /** @type {Record<string, string>} */
    const labels = {
        AUTH_REQUIRED: "认证失败，请检查 API Key 和用户范围权限",
        NOT_FOUND: httpLabels[404],
        RATE_LIMITED: httpLabels[429],
        TIMEOUT: "连接超时，请检查服务器地址、端口和网络",
        NETWORK_ERROR: "网络请求失败，请检查地址、端口、网络及用户脚本的跨域访问授权",
        INVALID_URL: "请求地址校验失败，请检查服务器地址及重定向配置",
        ABORTED: "连接测试已取消",
        CIRCUIT_OPEN: "连续请求失败，连接已暂时暂停，请稍后重试",
        RESPONSE_TOO_LARGE: "服务器响应超过允许大小，请缩小用户范围后重试",
        CF_BLOCKED: "服务器返回了访问验证页面，请检查代理和访问规则",
        UNSUPPORTED: "当前环境不支持此连接请求，请检查用户脚本管理器与脚本权限",
    };
    if (error?.name === "AbortError") return labels.ABORTED;
    return Object.hasOwn(labels, error?.code) ? labels[error.code] : "媒体库请求发生未知错误，请重试";
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
