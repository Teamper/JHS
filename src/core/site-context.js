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
