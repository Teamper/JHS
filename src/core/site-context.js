// @ts-check

const JAVDB_HOST_PATTERN = /^(?:[a-z0-9-]+\.)?javdb(?:[a-z0-9-]*)\.com$/i;
const JAVBUS_HOST_MARKERS = ["javbus", "javsee", "seejav"];

/** @param {Location | URL | string} [locationLike] */
function normalizeLocation(locationLike = window.location) {
    if (locationLike instanceof URL) return locationLike;
    if ("string" === typeof locationLike) return new URL(locationLike);
    return new URL(locationLike.href || `${locationLike.protocol}//${locationLike.hostname}${locationLike.pathname || "/"}${locationLike.search || ""}`);
}
/** 仅按 hostname 识别脚本运行站点，避免 URL 查询串造成误判。 */
/** @param {Location | URL | string} [locationLike] */
export function detectSite(locationLike = window.location) {
    const locationUrl = normalizeLocation(locationLike);
    const hostname = locationUrl.hostname.toLowerCase().replace(/\.$/, "");
    const isJavDB = JAVDB_HOST_PATTERN.test(hostname);
    const isJavBus = JAVBUS_HOST_MARKERS.some((marker => hostname.includes(marker)));
    const is123Pan = "123pan.com" === hostname || hostname.endsWith(".123pan.com");
    const isJavTrailers = "javtrailers.com" === hostname || hostname.endsWith(".javtrailers.com");
    const isSubtitleCat = "subtitlecat.com" === hostname || hostname.endsWith(".subtitlecat.com");
    const site = isJavDB ? "javdb" : isJavBus ? "javbus" : is123Pan ? "123pan" : isJavTrailers ? "javtrailers" : isSubtitleCat ? "subtitlecat" : "unknown";
    return { site, hostname, isJavDB, isJavBus, is123Pan, isJavTrailers, isSubtitleCat };
}

/** 识别 JavDB 原生热播榜页面。 */
/** @param {Location | URL | string} [locationLike] */
export function isHitShowPage(locationLike = window.location) {
    const locationUrl = normalizeLocation(locationLike);
    return "/rankings/playback" === locationUrl.pathname;
}

/** Return the JavDB page's product meaning independently of its data transport. */
/** @param {Location | URL | string} [locationLike] */
export function classifyJavDbPage(locationLike = window.location) {
    const url = normalizeLocation(locationLike), path = url.pathname, params = url.searchParams;
    if (path === "/rankings/movies") return { kind: "movie-ranking", period: params.get("p") || "daily", category: params.get("t") || "censored" };
    if (path === "/rankings/playback") return { kind: "playback-ranking", period: params.get("p") || "daily", filter: params.get("t") || "high_score" };
    if (path === "/rankings/top") return { kind: "top250-ranking", selection: params.get("t") || "all", page: Math.max(1, Number(params.get("page")) || 1) };
    if (path === "/rankings/actors") return { kind: "actor-ranking" };
    if (path === "/rankings/fanza_award") return { kind: "award-ranking" };
    if (path === "/tags/fc2") return { kind: params.get("jhs_source") === "123av" ? "external-fc2-catalog" : "fc2-catalog" };
    if (path === "/search_advanced") return { kind: "advanced-search" };
    return { kind: "other" };
}

/** Map former JHS carrier URLs before plugins inspect the old 404 document. */
/** @param {Location | URL | string} locationLike */
export function resolveLegacyJavDbUrl(locationLike) {
    const url = normalizeLocation(locationLike);
    if (url.pathname !== "/advanced_search") return null;
    const params = url.searchParams, destination = new URL(url.href);
    if (params.get("handlePlayback") === "1") {
        destination.pathname = "/rankings/playback";
        destination.search = "";
        const period = params.get("period") || "daily";
        destination.searchParams.set("p", ["daily", "weekly", "monthly"].includes(period) ? period : "daily");
        destination.searchParams.set("t", "high_score");
    } else if (params.get("handleTop") === "1") {
        destination.pathname = "/rankings/top";
        destination.search = "";
        const type = params.get("handleType"), value = params.get("type_value") || "";
        if (type === "year" && /^\d{4}$/.test(value)) destination.searchParams.set("t", `y${value}`);
        if (type === "video_type" && /^[0-3]$/.test(value)) destination.searchParams.set("t", value);
        const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
        const nativePage = Math.floor(((page - 1) * 50) / 40) + 1;
        if (nativePage > 1) destination.searchParams.set("page", String(nativePage));
        if (["0", "1"].includes(params.get("has_cnsub") || "")) destination.searchParams.set("jhs_subtitle", params.get("has_cnsub") === "1" ? "with" : "without");
    } else if (params.get("type") === "100" && params.get("released_start") === "2099-09") {
        destination.pathname = "/tags/fc2";
        destination.search = "";
        destination.searchParams.set("c10", "1");
        destination.searchParams.set("jhs_source", "123av");
        for (const key of ["keyword", "page"]) if (params.has(key)) destination.searchParams.set(key, params.get(key) || "");
    } else destination.pathname = "/search_advanced";
    return destination.href;
}

/** 识别保留站点原生列表生命周期的页面。 */
/** @param {Location | URL | string} [locationLike] @param {boolean | null} [hasMovieList] */
function isNormalListPage(locationLike = window.location, hasMovieList = false) {
    const locationUrl = normalizeLocation(locationLike);
    return !isHitShowPage(locationUrl) && (Boolean(hasMovieList) || locationUrl.pathname === "/search_advanced");
}

/** 识别具备列表页能力的页面，包括原生热播榜。 */
/** @param {Location | URL | string} [locationLike] @param {boolean | null} [hasMovieList] */
export function isListPage(locationLike = window.location, hasMovieList = false) {
    return isHitShowPage(locationLike) || isNormalListPage(locationLike, hasMovieList);
}
