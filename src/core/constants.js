// @ts-check

import { detectSite } from "./site-context.js";

/** @type {any} */
export var e;
/** @type {any} */
export var t;
export var n = Object.defineProperty, a = (/** @type {any} */ e) => {
    throw TypeError(e);
}, i = (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ a) => ((/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ a) => t in e ? n(e, t, {
    enumerable: !0,
    configurable: !0,
    writable: !0,
    value: a
}) : e[t] = a)(e, "symbol" != typeof t ? t + "" : t, a), s = (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => (((/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
    t.has(e) || a("Cannot " + n);
})(e, t, "access private method"), n);

export let o = "", siteContext = { site: "unknown", hostname: "", isJavDB: false, isJavBus: false, is123Pan: false, isJavTrailers: false, isSubtitleCat: false }, r = false, l = false, c = false;
export const d = "filter", h = "favorite", g = "hasDown", p = "hasWatch", m = "屏蔽", u = "已屏蔽", f = "var(--jhs-status-filter-text)", v = "收藏", b = "已收藏", w = "var(--jhs-status-fav-text)", y = "已下载", x = "var(--jhs-status-down-text)", k = "已观看", S = "var(--jhs-status-watch-text)", C = "no", _ = "yes", T = "javdb", I = "javbus", B = "actor", P = "actress", D = "censored", A = "uncensored", L = [ {
    id: "video-mhb",
    quality: "dmb_w",
    text: "旧视频源-中画质宽版 (404p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "sm_s",
    text: "旧视频源-低画质 (240p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "dm_s",
    text: "旧视频源-中画质 (360p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "dmb_s",
    text: "旧视频源-中画质 (480p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "mhb_w",
    text: "旧视频源-高画质宽版 (404p)",
    canSelect: !1
}, {
    id: "video-mmb",
    quality: "mmb",
    text: "中画质 (432p)",
    canSelect: !0
}, {
    id: "video-mhb",
    quality: "mhb",
    text: "高画质 (576p)",
    canSelect: !0
}, {
    id: "video-hmb",
    quality: "hmb",
    text: "HD (720p)",
    canSelect: !0
}, {
    id: "video-hhb",
    quality: "hhb",
    text: "FullHD (1080p)",
    canSelect: !0
}, {
    id: "video-hhbs",
    quality: "hhbs",
    text: "FullHD (1080p60fps)",
    canSelect: !0
}, {
    id: "video-4k",
    quality: "4k",
    text: "4K (2160p)",
    canSelect: !0
}, {
    id: "video-4ks",
    quality: "4ks",
    text: "4K (2160p60fps)",
    canSelect: !0
} ];

/** 在 Composition Root 中一次性建立旧模块仍使用的站点兼容快照。 */
export function initializeRuntimeConstants(locationLike = window.location) {
    const detected = detectSite(locationLike);
    o = locationLike.href;
    siteContext = detected;
    r = detected.isJavDB;
    l = detected.isJavBus;
    c = o.includes("/search?q") || o.includes("/search/") || o.includes("/users/");
    return detected;
}

/** @param {string} e */
export function escapeHtml(e) { const t = document.createElement("span"); return t.textContent = e, t.innerHTML; }

export const CURRENT_DATA_VERSION = 2;

/** @param {unknown} value 规范化内部番号输入，无效值统一返回 null。 */
export function normalizeCarNum(value) {
    if ("string" != typeof value) return null;
    let carNum = value.trim();
    if (!carNum || [ "undefined", "null" ].includes(carNum.toLowerCase())) return null;
    carNum = carNum.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();
    return carNum ? tryCanonicalizeSimpleCarNum(carNum) : null;
}

const SIMPLE_CAR_PREFIXES = new Set([ "ABC", "ABP", "ADN", "ATID", "BF", "CAWD", "DLDSS", "DVAJ", "FSDSS", "HEYZO", "HMN", "IPX", "IPZZ", "JUQ", "JUL", "JUX", "MEYD", "MIAA", "MIDE", "MIDV", "MIMK", "MIRD", "NIMA", "PRED", "RBD", "SDDE", "SONE", "SSIS", "SSNI", "STARS", "URE", "VEC", "WAAA", "WANZ", "XVSR" ]);

/** 仅对明确白名单内的简单番号补充分隔符。 */
function tryCanonicalizeSimpleCarNum(/** @type {string} */ value) {
    const match = String(value || "").match(/^([A-Z]{2,8})(\d{2,7})$/);
    return match && SIMPLE_CAR_PREFIXES.has(match[1]) ? `${match[1]}-${match[2]}` : value;
}

/** @param {unknown[]} candidates 按调用方给定的可靠性顺序选择第一个有效番号。 */
export function firstValidCarNum(...candidates) {
    for (const candidate of candidates) {
        const carNum = normalizeCarNum(candidate);
        if (carNum) return carNum;
    }
    return null;
}

/** 断言详情信息解析器始终履行对象返回契约。 */
export function assertPageInfoContract(/** @type {unknown} */ pageInfo) {
    if (!pageInfo || "object" != typeof pageInfo || Array.isArray(pageInfo))
        throw new TypeError("getPageInfo() contract broken: expected object");
    return pageInfo;
}

/** 仅在样式注入阶段读取当前地址，避免模块导入产生浏览器环境副作用。 */
export function getJavBusHiddenNavCss() {
    return window.location.href.includes("hideNav=1") ? "\n         .navbar-default {\n            display: none !important;\n        }\n        body {\n            padding-top:0px!important;\n        }\n    " : "";
}

/* N (JavBus CSS) moved to css-injection.js */

/** 仅在样式注入阶段读取当前地址，避免模块导入产生浏览器环境副作用。 */
export function getJavDbHiddenNavCss() {
    return window.location.href.includes("hideNav=1") ? "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    " : "";
}

/* E (JavDB CSS) moved to css-injection.js */

/* F (global UI CSS) moved to css-injection.js */

export function H(/** @type {string} */ e) {
    if (e) if (e.includes("<style>")) document.head.insertAdjacentHTML("beforeend", e); else {
        const t = document.createElement("style");
        t.textContent = e, document.head.appendChild(t);
    }
}
