var e, t, n = Object.defineProperty, a = e => {
    throw TypeError(e);
}, i = (e, t, a) => ((e, t, a) => t in e ? n(e, t, {
    enumerable: !0,
    configurable: !0,
    writable: !0,
    value: a
}) : e[t] = a)(e, "symbol" != typeof t ? t + "" : t, a), s = (e, t, n) => (((e, t, n) => {
    t.has(e) || a("Cannot " + n);
})(e, t, "access private method"), n);

const o = window.location.href, r = o.includes("javdb"), l = o.includes("javbus") || o.includes("seejav") || o.includes("bus") || o.includes("javsee") || $("title").text().trim().startsWith("JavBus - AV"), c = o.includes("/search?q") || o.includes("/search/") || o.includes("/users/"), d = "filter", h = "favorite", g = "hasDown", p = "hasWatch", m = "屏蔽", u = "已屏蔽", f = "#de3333", v = "收藏", b = "已收藏", w = "#25b1dc", y = "已下载", x = "#7bc73b", k = "已观看", S = "#d7a80c", C = "no", _ = "yes", T = "javdb", I = "javbus", B = "actor", P = "actress", D = "censored", A = "uncensored", L = [ {
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

function escapeHtml(e) { const t = document.createElement("span"); return t.textContent = e, t.innerHTML; }

const CURRENT_DATA_VERSION = 1;

let M = "";

window.location.href.includes("hideNav=1") && (M = "\n         .navbar-default {\n            display: none !important;\n        }\n        body {\n            padding-top:0px!important;\n        }\n    ");

/* N (JavBus CSS) moved to css-injection.js */

let j = "";

window.location.href.includes("hideNav=1") && (j = "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ");

/* E (JavDB CSS) moved to css-injection.js */

/* F (global UI CSS) moved to css-injection.js */

function H(e) {
    if (e) if (e.includes("<style>")) document.head.insertAdjacentHTML("beforeend", e); else {
        const t = document.createElement("style");
        t.textContent = e, document.head.appendChild(t);
    }
}


