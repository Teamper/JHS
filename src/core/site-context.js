const JAVDB_HOST_PATTERN = /^(?:[a-z0-9-]+\.)?javdb(?:[a-z0-9-]*)\.com$/i;
const JAVBUS_HOST_MARKERS = ["javbus", "javsee", "seejav"];

/** 规范化 location、URL 或字符串输入。 */
function normalizeLocation(locationLike = window.location) {
    if (locationLike instanceof URL) return locationLike;
    if ("string" === typeof locationLike) return new URL(locationLike);
    return new URL(locationLike.href || `${locationLike.protocol}//${locationLike.hostname}${locationLike.pathname || "/"}${locationLike.search || ""}`);
}
/** 仅按 hostname 识别脚本运行站点，避免 URL 查询串造成误判。 */
function detectSite(locationLike = window.location) {
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

/** 识别由 JHS 接管渲染的 JavDB 热播榜页面。 */
function isHitShowPage(locationLike = window.location) {
    const locationUrl = normalizeLocation(locationLike);
    return "/advanced_search" === locationUrl.pathname && "1" === locationUrl.searchParams.get("handlePlayback");
}

/** 识别保留站点原生列表生命周期的页面。 */
function isNormalListPage(locationLike = window.location, hasMovieList = null) {
    const locationUrl = normalizeLocation(locationLike);
    const hasList = null === hasMovieList ? "undefined" != typeof $ && $(".movie-list").length > 0 : Boolean(hasMovieList);
    return !isHitShowPage(locationUrl) && (hasList || locationUrl.pathname.includes("advanced_search"));
}

/** 识别所有具备列表页能力的页面，包括 JHS 热播榜。 */
function isListPage(locationLike = window.location, hasMovieList = null) {
    return isHitShowPage(locationLike) || isNormalListPage(locationLike, hasMovieList);
}
