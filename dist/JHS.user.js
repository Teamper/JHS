// ==UserScript==
// @name         JHS-YA
// @namespace    https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya
// @version      4.0.1
// @author       yaoser
// @description  Jav-鉴黄师个人维护版：收藏、屏蔽、标记已下载、演员黑名单、收藏演员同步、新作品检测、热播/Top250/Fc2ppv/评论增强、相关清单、WebDAV数据备份、以图识图、字幕搜索；支持 JavDB / JavBus。
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=javdb.com
// @homepageURL  https://github.com/Yaoser-x/JHS
// @supportURL   https://github.com/Yaoser-x/JHS/issues
// @match        https://javdb.com/*
// @match        https://www.javbus.com/*
// @match        *://*.123pan.com/*
// @include      https://javdb*.com/*
// @include      https://*javbus*/*
// @include      https://*javsee*/*
// @include      https://*seejav*/*
// @include      https://javtrailers.com/*
// @include      https://subtitlecat.com/*
// @exclude      https://*javbus*/forum/*
// @exclude      https://*javbus*/*actresses
// @exclude      https://*javsee*/forum/*
// @exclude      https://*javsee*/*actresses
// @exclude      https://*seejav*/forum/*
// @exclude      https://*seejav*/*actresses
// @require      https://update.greasyfork.org/scripts/540597/1613170/parallel_GM_xmlhttpRequest.js
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/dist/layer.min.js
// @require      https://cdn.jsdelivr.net/npm/blueimp-md5@2.19.0/js/md5.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.js
// @connect      xunlei.com
// @connect      geilijiasu.com
// @connect      ja.wikipedia.org
// @connect      beta.magnet.pics
// @connect      jdforrepam.com
// @connect      cc3001.dmm.co.jp
// @connect      cc3001.dmm.com
// @connect      www.dmm.co.jp
// @connect      www.dmm.com
// @connect      api.dmm.com
// @connect      special.dmm.co.jp
// @connect      adult.contents.fc2.com
// @connect      fc2ppvdb.com
// @connect      123av.com
// @connect      u3c3.com
// @connect      u9a9.com
// @connect      btsow.lol
// @connect      sukebei.nyaa.si
// @connect      javstore.net
// @connect      3xplanet.com
// @connect      javbest.net
// @connect      missav.live
// @connect      jable.tv
// @connect      www.av.gl
// @connect      jav.rs
// @connect      javtrailers.com
// @connect      javdb.com
// @connect      javbus.com
// @connect      www.123pan.com
// @connect      yun.123pan.com
// @connect      supjav.com
// @connect      translate-pa.googleapis.com
// @connect      127.0.0.1
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @run-at       document-idle
// @downloadURL https://github.com/Yaoser-x/JHS/releases/latest/download/JHS.user.js
// @updateURL https://raw.githubusercontent.com/Yaoser-x/JHS/main/JHS.user.js
// ==/UserScript==

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

const o = window.location.href, r = o.includes("javdb"), l = o.includes("javbus") || o.includes("seejav") || o.includes("bus") || o.includes("javsee") || $("title").text().trim().startsWith("JavBus - AV"), c = o.includes("/search?q") || o.includes("/search/") || o.includes("/users/"), d = "filter", h = "favorite", g = "hasDown", p = "hasWatch", m = "🚫 屏蔽", u = "🚫 已屏蔽", f = "#de3333", v = "⭐ 收藏", b = "⭐ 已收藏", w = "#25b1dc", y = "📥️ 已下载", x = "#7bc73b", k = "🔍 已观看", S = "#d7a80c", C = "no", _ = "yes", T = "javdb", I = "javbus", B = "actor", P = "actress", D = "censored", A = "uncensored", L = [ {
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

const N = `\n<style>\n    .top-bar {\n        z-index: 12345689 !important;\n    }\n    \n    ${M}\n\n    .masonry {\n        height: 100% !important;\n        width: 100% !important;\n        padding: 0 15px !important;\n    }\n    .masonry {\n        display: grid;\n        column-gap: 10px; /* 列间距*/\n        row-gap: 10px; /* 行间距 */\n        grid-template-columns: repeat(4, minmax(0, 1fr));\n        align-items: start;\n    }\n    .masonry .item {\n        /*position: initial !important;*/\n        top: initial !important;\n        left: initial !important;\n        float: none !important;\n        background-color:#c4b1b1;\n        position: relative !important;\n    }\n    \n    .masonry .item:hover {\n        box-shadow: 0 .5em 1em -.125em rgba(10, 10, 10, .1), 0 0 0 1px #485fc7;\n    }\n    .masonry .movie-box{\n        width: 100% !important;\n        height: 100% !important;\n        margin: 0 !important;\n        overflow: inherit !important;\n    }\n    .masonry .movie-box .photo-frame {\n        /*height: 70% !important;*/\n        height:auto !important;\n        margin: 0 !important;\n        position:relative; /* 方便预览视频定位*/\n    }\n    .masonry .movie-box img {\n        max-height: 500px;\n        height: 100% !important;\n        object-fit: contain;\n        object-position: top;\n    }\n    .masonry .movie-box img:hover {\n      transform: scale(1.04);\n      transition: transform 0.3s;\n    }\n    .masonry .photo-info{\n        /*height: 30% !important;*/\n    }\n    .masonry .photo-info span {\n      display: inline-block; /* 或者 block */\n      max-width: 100%;      /* 根据父容器限制宽度 */\n      white-space: nowrap;  /* 禁止换行 */\n      overflow: hidden;     /* 隐藏溢出内容 */\n      text-overflow: ellipsis; /* 显示省略号 */\n    }\n    \n    /* 无码页面的样式 */\n    .photo-frame .mheyzo,\n    .photo-frame .mcaribbeancom2{\n        margin-left: 0 !important;\n    }\n    .avatar-box{\n        width: 100% !important;\n        display: flex !important;\n        margin:0 !important;\n    }\n    .avatar-box .photo-info{\n        display: flex;\n        justify-content: center;\n        align-items: center;\n        gap: 30px;\n        flex-direction: row;\n        background-color:#fff !important;\n    }\n    \n    footer{\n        display: none!important;\n    }\n    \n        \n    .video-title {\n        white-space: normal !important;\n        height: 75px; /* 固定高度 容器就不会出现高低不一*/\n        \n        display: -webkit-box !important; /* 必须设置，使接下来的属性生效 */\n        -webkit-box-orient: vertical; /* 垂直方向堆叠行 */\n        -webkit-line-clamp: 3; /* 设置文本最多显示的行数*/\n    }\n\n    \n</style>\n`;

let j = "";

window.location.href.includes("hideNav=1") && (j = "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ");

const E = `\n<style>\n    ${j}\n    \n    .navbar {\n        z-index: 12345679 !important;\n        padding: 0 0;\n    }\n    \n    .navbar-link:not(.is-arrowless) {\n        padding-right: 33px;\n    }\n    \n    .sub-header,\n    /*#search-bar-container, !*搜索框*!*/\n    #footer,\n    /*.search-recent-keywords, !*搜索框底部热搜词条*!*/\n    .app-desktop-banner,\n    div[data-controller="movie-tab"] .tabs,\n    h3.main-title,\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(3), /* 相关清单*/\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(2), /* 短评按钮*/\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(1), /*磁力面板 按钮*/\n    .top-meta,\n    .float-buttons {\n        display: none !important;\n    }\n    \n    div.tabs.no-bottom,\n    .tabs ul {\n        border-bottom: none !important;\n    }\n    \n    \n    /* 视频列表项 相对相对 方便标签绝对定位*/\n    .movie-list .item {\n        position: relative !important;\n    }\n    \n    .video-title {\n        white-space: normal !important;\n        height: 80px; /* 固定高度 容器就不会出现高低不一*/\n        \n        display: -webkit-box; /* 必须设置，使接下来的属性生效 */\n        -webkit-box-orient: vertical; /* 垂直方向堆叠行 */\n        -webkit-line-clamp: 3; /* 设置文本最多显示的行数*/\n    }\n    \n    /* 列表页顶部分类自适应 */\n    .main-tabs, .tabs {\n        overflow-x:hidden;\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n    \n    .main-tabs ul, .tabs ul {\n        flex-wrap: wrap;\n        flex-grow: 0;\n    }\n    \n    \n    /* 二级工具栏 大小封面,可播放,含磁链...*/\n    .toolbar {\n        display: flex;\n    }\n\n</style>\n`;

const F = `\n<style>\n    /* 全局通用样式 */\n    .fr-btn {\n        float: right;\n        margin-left: 4px !important;\n    }\n    \n    .menu-box {\n        position: fixed;\n        right: 10px;\n        top: 50%;\n        transform: translateY(-50%);\n        display: flex;\n        flex-direction: column;\n        z-index: 1000;\n        gap: 6px;\n    }\n    \n    .menu-btn {\n        display: inline-block;\n        min-width: 80px;\n        padding: 7px 12px;\n        border-radius: 4px;\n        color: white !important;\n        text-decoration: none;\n        font-weight: bold;\n        font-size: 12px;\n        text-align: center;\n        cursor: pointer;\n        transition: all 0.3s ease;\n        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);\n        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);\n        border: none;\n        line-height: 1.3;\n        margin: 0;\n    }\n    \n    .menu-btn:hover {\n        transform: translateY(-1px);\n        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);\n        opacity: 0.9;\n    }\n    \n    .menu-btn:active {\n        transform: translateY(0);\n        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);\n    }\n    \n    .do-hide {\n        display: none !important;\n    }\n    \n    .main-tab-btn {\n        border-bottom:none !important; \n        border-radius:3px !important; \n        height: 30px; \n        margin-left: 5px !important; \n    }\n\n    .jhs-icon {\n        width: 16px;\n        height: 16px;\n    }\n    \n    .tool-box .jhs-icon {\n        width: 1.5rem;\n        height: 1.5rem; \n    }\n     \n    \n    /*表格内按钮溢出,防止被隐藏*/\n    .tabulator .tabulator-row .action-cell-dropdown {\n        overflow: visible !important;\n    }\n    /* 去除行内鼠标小手*/\n    .tabulator .tabulator-row.tabulator-selectable:hover {\n        cursor: default !important;\n    }\n    \n    /* 排序小箭头颜色 */\n    .tabulator .tabulator-col.tabulator-sortable[aria-sort="ascending"] .tabulator-arrow {\n        border-bottom-color: #337ab7 !important;\n    }\n    .tabulator .tabulator-col.tabulator-sortable[aria-sort="descending"] .tabulator-arrow {\n        border-top-color: #337ab7 !important;\n    }\n    \n    /* 针对折叠行的容器或内容进行样式修改 */\n    .tabulator-responsive-collapse {\n        border-top: none !important;\n    }\n    \n    .tabulator-responsive-collapse table{\n        margin-left: 50px !important;\n    }\n    \n    .tabulator-cell {\n        height:auto !important;\n    }\n    \n    /* 列允许换行,去除省略号 */\n    .tabulator .tabulator-cell {\n        white-space: normal !important; \n        text-overflow: clip !important; \n    }\n    \n    .tabulator-tableholder {\n        overflow-x: hidden !important;\n    }\n\n    ${function() {
    const e = [ ".jhs-scrollbar", ".content-panel", ".tabulator-tableholder", ".has-navbar-fixed-top", ".layui-layer-content" ], t = (e, t) => e.map((e => `${e}${t}`)).join(","), n = "::-webkit-scrollbar-track", a = "::-webkit-scrollbar-thumb", i = "::-webkit-scrollbar-thumb:hover";
    return `\n    ${t(e, "::-webkit-scrollbar")}{width:6px;height:6px;}\n    ${t(e, n)}{background:#f1f1f1;border-radius:10px;}\n    ${t(e, a)}{background:#888;border-radius:10px;}\n    ${t(e, i)}{background:#555;}\n    `.trim().replace(/\n/g, "");
}()}\n</style>\n`;

function H(e) {
    if (e) if (e.includes("<style>")) document.head.insertAdjacentHTML("beforeend", e); else {
        const t = document.createElement("style");
        t.textContent = e, document.head.appendChild(t);
    }
}

l && H(N), r && H(E), H("\n<style>\n    .a-normal, /* 白色 */\n    .a-primary, /* 浅蓝色 */\n    .a-success, /* 浅绿色 */\n    .a-danger, /* 浅粉色 */\n    .a-warning, /* 浅橙色 */\n    .a-info /* 灰色 */\n    {\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        padding: 6px 14px;\n        margin-right: 10px;\n        border-radius: 6px;\n        text-decoration: none;\n        font-size: 13px;\n        font-weight: 500;\n        transition: all 0.2s ease;\n        cursor: pointer;\n        border: 1px solid rgba(0, 0, 0, 0.08);\n        white-space: nowrap;\n    }\n    \n    .a-primary {\n        background: #e0f2fe;\n        color: #0369a1;\n        border-color: #bae6fd;\n    }\n    \n    .a-primary:hover {\n        background: #bae6fd;\n    }\n    \n    .a-success {\n        background: #dcfce7;\n        color: #166534;\n        border-color: #bbf7d0;\n    }\n    \n    .a-success:hover {\n        background: #bbf7d0;\n    }\n    \n    .a-danger {\n        background: #fee2e2;\n        color: #b91c1c;\n        border-color: #fecaca;\n    }\n    \n    .a-danger:hover {\n        background: #fecaca;\n    }\n    \n    .a-warning {\n        background: #ffedd5;\n        color: #9a3412;\n        border-color: #fed7aa;\n    }\n    \n    .a-warning:hover {\n        background: #fed7aa;\n    }\n    \n    .a-info {\n        background: #e2e8f0;\n        color: #334155;\n        border-color: #cbd5e1;\n    }\n    \n    .a-info:hover {\n        background: #cbd5e1;\n    }\n    \n    .a-normal {\n        background: transparent;\n        color: #64748b;\n        border-color: #cbd5e1;\n    }\n    \n    .a-normal:hover {\n        background: #f8fafc;\n    }\n</style>\n"),
H(F);

/** 按字段为数组数据构建运行时索引。 */
function createIndexedMap(items, key) {
    return new Map(items.filter((item => item && item[key])).map((item => [ item[key], item ])));
}

/** 为番号状态构建运行时 Set 索引。 */
function createStatusMap(items) {
    const statusMap = {
        [d]: new Set,
        [h]: new Set,
        [g]: new Set,
        [p]: new Set
    };
    items.forEach((item => {
        item && Object.prototype.hasOwnProperty.call(statusMap, item.status) && statusMap[item.status].add(item.carNum);
    }));
    return statusMap;
}

/** 统计指定字段的重复值。 */
function groupDuplicateItems(items, key) {
    const counts = new Map;
    items.forEach((item => {
        const value = item && item[key];
        value && counts.set(value, (counts.get(value) || 0) + 1);
    }));
    return Array.from(counts.entries()).filter((item => item[1] > 1));
}

/** 按字段去重，保留第一条记录并合并后续字段。 */
function dedupeByKey(items, key) {
    const seen = new Map, list = [];
    let changed = !1;
    for (const item of items) {
        const value = item && item[key];
        if (!value) {
            list.push(item);
            continue;
        }
        if (seen.has(value)) {
            Object.assign(seen.get(value), item), changed = !0;
        } else seen.set(value, item), list.push(item);
    }
    return {
        list,
        changed
    };
}

e = new WeakSet, t = async function(e, t, n) {
    let a;
    if (Array.isArray(e)) a = [ ...e ]; else {
        if (a = await this.forage.getItem(t) || [], a.includes(e)) {
            const t = `${e} ${n}已存在`;
            throw show.error(t), new Error(t);
        }
        a.push(e);
    }
    return await this._setItemAndInvalidate(t, a), a;
};

let z = class n {
    constructor() {
        var t, s, o;
        if (t = this, (s = e).has(t) ? a("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(t) : s.set(t, o),
        i(this, "car_list_key", "car_list"), i(this, "filter_keyword_title_key", "filter_keyword_title"),
        i(this, "filter_keyword_review_key", "filter_keyword_review"), i(this, "setting_key", "setting"),
        i(this, "blacklist_key", "blacklist"), i(this, "blacklist_car_list_key", "blacklist_car_list"),
        i(this, "third_party_cache_key", "third_party_ttl_cache"),
        i(this, "favorite_actresses_key", "favorite_actresses"), i(this, "highlighted_tags_key", "highlighted_tags"),
        i(this, "_actressLock", Promise.resolve()), i(this, "forage", localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: "JAV-JHS",
            version: 1,
            storeName: "appData"
        })), i(this, "cacheCarList", null), i(this, "cacheBlacklist", null),
        i(this, "cacheTitleFilterKeyword", null), i(this, "cacheFavoriteActresses", null),
        i(this, "cache_filter_actor_actress_car_list", null), i(this, "cacheSettingObj", null),
        i(this, "cacheCarMap", null), i(this, "cacheStatusMap", null),
        i(this, "cacheBlacklistMap", null), i(this, "cacheFavoriteActressMap", null),
        n.instance) throw new Error("StorageManager已被实例化过了!");
        n.instance = this;
    }
    async getDataVersion() { return await this.forage.getItem("data_version") || 0; }
    async setDataVersion(e) { await this.forage.setItem("data_version", e); }
    _invalidateCache(e = null) {
        (!e || e === this.car_list_key) && (this.cacheCarList = null, this.cacheCarMap = null, this.cacheStatusMap = null);
        (!e || e === this.blacklist_key) && (this.cacheBlacklist = null, this.cacheBlacklistMap = null);
        (!e || e === this.filter_keyword_title_key) && (this.cacheTitleFilterKeyword = null);
        (!e || e === this.favorite_actresses_key) && (this.cacheFavoriteActresses = null, this.cacheFavoriteActressMap = null);
        (!e || e === this.blacklist_car_list_key) && (this.cache_filter_actor_actress_car_list = null);
        (!e || e === this.setting_key) && (this.cacheSettingObj = null);
    }
    async _setItemAndInvalidate(e, t) {
        await this.forage.setItem(e, t);
        this._invalidateCache(e);
    }
    async withActressLock(fn) {
        let release;
        const lock = new Promise(r => release = r);
        const prev = this._actressLock;
        this._actressLock = this._actressLock.then(() => lock);
        await prev;
        try { return await fn(); } finally { release(); }
    }
    async _rawUpdateFavoriteActress(e) {
        const t = await this.getFavoriteActressList();
        const {starId: n, name: a, allName: i, avatar: s, lastCheckTime: o, newVideoList: r, lastPublishTime: l, actressType: c, remark: d} = e;
        if (!n) throw new Error("缺失starId");
        let h = t.find((e => e.starId === n));
        if (!h) return clog.error("未找到演员信息", n, a), !1;
        a && (h.name = a), i && (h.allName = i), s && (h.avatar = s), null != c && (h.actressType = c),
        o && (h.lastCheckTime = o), r && (h.newVideoList = r), l && (h.lastPublishTime = l),
        d && (h.remark = d), h.updateDate = utils.getNowStr(), await this._setItemAndInvalidate(this.favorite_actresses_key, t);
        return true;
    }
    async getCarList() {
        return null === this.cacheCarList && (this.cacheCarList = await this.forage.getItem(this.car_list_key) || []),
        this.cacheCarList;
    }
    async getCarMap() {
        if (null === this.cacheCarMap) {
            const e = await this.getCarList();
            this.cacheCarMap = createIndexedMap(e, "carNum");
        }
        return this.cacheCarMap;
    }
    async getStatusMap() {
        if (null === this.cacheStatusMap) {
            const e = await this.getCarList();
            this.cacheStatusMap = createStatusMap(e);
        }
        return this.cacheStatusMap;
    }
    async getCar(e) {
        return (await this.getCarMap()).get(e);
    }
    _saveSingleCar(e, t) {
        let {carNum: n, url: a, names: i, actionType: s, publishTime: o, starId: r} = e;
        if (!n) throw show.error("番号为空!"), new Error("番号为空!");
        if (!a) throw show.error("url为空!"), new Error("url为空!");
        a.includes("http") || (a = window.location.origin + a), i && (i = i.trim());
        let l = t.find((e => e.carNum === n));
        if (l) i && (l.names = i), a && (l.url = a), o && (l.publishTime = o), l.updateDate = utils.getNowStr(); else {
            let e = utils.getNowStr();
            l = {
                carNum: n,
                url: a,
                names: i,
                status: "",
                createDate: e,
                updateDate: e,
                publishTime: o
            }, r && (l.starId = r), t.push(l);
        }
        switch (s) {
          case d:
            if (l.status === d) {
                const e = `${n} 已在屏蔽列表中`;
                throw show.error(e), new Error(e);
            }
            l.status = d;
            break;

          case h:
            if (l.status === h) {
                const e = `${n} 已在收藏列表中`;
                throw show.error(e), new Error(e);
            }
            l.status = h;
            break;

          case g:
            if (l.status === g) { const e = `${n} 已标记为已下载`; throw show.error(e), new Error(e); }
            l.status = g;
            break;

          case p:
            if (l.status === p) { const e = `${n} 已标记为已观看`; throw show.error(e), new Error(e); }
            l.status = p;
            break;

          default:
            const e = "actionType错误, 请联系作者更正: " + s;
            throw show.error(e), new Error(e);
        }
    }
    async saveCar(e) {
        const t = await this.getCarList();
        this._saveSingleCar(e, t), await this._setItemAndInvalidate(this.car_list_key, t), await this.removeNewVideoList([ e.carNum ]);
    }
    async updateCarInfo(e) {
        let {carNum: t, url: n, names: a, actionType: i, publishTime: s, remark: o} = e;
        if (!t) throw show.error("番号为空!"), new Error("番号为空!");
        if (!n) throw show.error("url为空!"), new Error("url为空!");
        a && (a = a.trim());
        const r = await this.getCarList();
        let l = r.find((e => e.carNum === t));
        if (!l) {
            const e = "数据不存在: " + t;
            throw show.error(e), new Error(e);
        }
        switch (l.names = a, l.url = n, l.remark = o, l.updateDate = utils.getNowStr(),
        i) {
          case d:
            l.status = d;
            break;

          case h:
            l.status = h;
            break;

          case g:
            l.status = g;
            break;

          case p:
            l.status = p;
            break;

          default:
            const e = "actionType错误, 请联系作者更正: " + i;
            throw show.error(e), new Error(e);
        }
        await this._setItemAndInvalidate(this.car_list_key, r), await this.removeNewVideoList([ t ]);
    }
    async saveCarList(e) {
        if (!e || !Array.isArray(e) || 0 === e.length) throw show.error("记录列表为空!"), new Error("记录列表为空!");
        const t = await this.getCarList();
        for (const a of e) try {
            this._saveSingleCar(a, t);
        } catch (n) {
            throw n;
        }
        await this._setItemAndInvalidate(this.car_list_key, t), await this.removeNewVideoList(e.map((e => e.carNum)));
    }
    async removeNewVideoList(e) {
        return this.withActressLock(async () => {
            const t = await this.getFavoriteActressList();
            let n = !1;
            const a = t.map((t => {
                if (!t.newVideoList || !Array.isArray(t.newVideoList)) return t;
                const a = t.newVideoList.filter((a => {
                    const i = e.includes(a);
                    return i && (clog.log("移除关联女优新作品", t.name, a), n = !0), !i;
                }));
                const result = { ...t, newVideoList: a };
                if (a.length === 0 && t.lastPublishTime) result.lastPublishTime = null;
                return result;
            }));
            n && await this._setItemAndInvalidate(this.favorite_actresses_key, a);
        });
    }
    async removeCar(e) {
        const t = await this.getCarList(), n = t.length, a = t.filter((t => t.carNum !== e));
        return a.length === n ? (show.error(`${e} 不存在`), !1) : (await this._setItemAndInvalidate(this.car_list_key, a),
        !0);
    }
    async batchRemoveCars(e) {
        const t = await this.getCarList(), n = t.length, a = new Set(e), i = t.filter((e => !a.has(e.carNum))), s = n - i.length;
        return 0 !== s && (await this._setItemAndInvalidate(this.car_list_key, i), s);
    }
    async getBlacklist() {
        return null === this.cacheBlacklist && (this.cacheBlacklist = await this.forage.getItem(this.blacklist_key) || []),
        this.cacheBlacklist;
    }
    async getBlacklistMap() {
        if (null === this.cacheBlacklistMap) {
            const e = await this.getBlacklist();
            this.cacheBlacklistMap = createIndexedMap(e, "starId");
        }
        return this.cacheBlacklistMap;
    }
    async addBlacklistItem(e) {
        let {starId: t, name: n, allName: a, role: i, movieType: s, url: o} = e;
        if (!t) throw new Error("缺失starId");
        if (!n) throw new Error("缺失name");
        if (!i) throw new Error("缺失role");
        const r = await this.getBlacklist(), l = r.find((e => e.starId === t));
        if (l) l.url = o, l.role = i, l.movieType = s, clog.log("更新黑名单演员信息", l); else {
            const e = {
                starId: t,
                name: n,
                allName: a || [ n ],
                createTime: utils.getNowStr(),
                role: i,
                movieType: s,
                url: o
            };
            r.push(e), clog.log("增加黑名单演员信息", e);
        }
        await this._setItemAndInvalidate(this.blacklist_key, r);
    }
    async updateBlacklistItem(e) {
        if (!e || !e.starId) throw new Error("参数不全");
        const t = await this.getBlacklist(), n = t.find((t => t.starId === e.starId));
        if (!n) throw new Error(`未找到黑名单演员信息:${e.name} ${e.starId}`);
        e.checkTime && (n.checkTime = e.checkTime), e.lastPublishTime && (n.lastPublishTime = e.lastPublishTime),
        await this._setItemAndInvalidate(this.blacklist_key, t);
    }
    async deleteBlacklistItem(e) {
        const t = await this.getBlacklist(), n = t.filter((t => t.starId !== e));
        t.length !== n.length && await this._setItemAndInvalidate(this.blacklist_key, n);
    }
    async getBlacklistCarList() {
        return null !== this.cache_filter_actor_actress_car_list || (this.cache_filter_actor_actress_car_list = await this.forage.getItem(this.blacklist_car_list_key) || []),
        this.cache_filter_actor_actress_car_list;
    }
    async batchSaveBlacklistCarList(e) {
        const t = await this.getBlacklistCarList(), n = JSON.parse(JSON.stringify(t));
        let a = !1, i = [];
        for (const s of e) {
            n.find((e => e.carNum === s.carNum)) || (this._saveSingleCar(s, n), clog.log(`屏蔽演员番号: <span style="color: #f40">${s.names} ${s.carNum}</span>`),
            a = !0, i.push(s.carNum));
        }
        a && (await this._setItemAndInvalidate(this.blacklist_car_list_key, n), await this.removeNewVideoList(i),
        window.cleanCache_filter_actor_actress_car_list());
    }
    async removeBlacklistCarList(e) {
        const t = await this.getBlacklistCarList(), n = t.filter((t => t.starId !== e));
        n.length !== t.length && (await this._setItemAndInvalidate(this.blacklist_car_list_key, n),
        window.cleanCache_filter_actor_actress_car_list());
    }
    async getFavoriteActressList() {
        return null === this.cacheFavoriteActresses && (this.cacheFavoriteActresses = await this.forage.getItem(this.favorite_actresses_key) || []),
        this.cacheFavoriteActresses;
    }
    async getActressMap() {
        if (null === this.cacheFavoriteActressMap) {
            const e = await this.getFavoriteActressList();
            this.cacheFavoriteActressMap = createIndexedMap(e, "starId");
        }
        return this.cacheFavoriteActressMap;
    }
    async addFavoriteActressList(e) {
        return this.withActressLock(async () => {
        const t = await this.getFavoriteActressList();
        let n = 0;
        for (const a of e) {
            let {starId: e, name: i, allName: s, avatar: o, lastCheckTime: r, lastPublishTime: l, actressType: c} = a;
            if (!e) throw new Error("缺失starId");
            if (!i) throw new Error("缺失name");
            s || (s = [ i ]);
            const d = "(無碼)";
            if (!c) {
                c = i.includes(d) || s.some((e => e.includes(d))) ? A : D;
            }
            i = i.replace(d, ""), s = s.map((e => e.replace(d, "")));
            let h = t.find((t => t.starId === e));
            if (h) {
                h.avatar && h.avatar.includes("https") || o && (clog.log(o), h.avatar = o, clog.log(`<span style="color: #f40">补全女优头像: ${i}</span>`),
                n++), !h.actressType && c && (h.actressType = c, clog.log(`<span style="color: #f40">补全女优类别: ${i} ${c}</span>`),
                n++), h.name.includes(d) && (h.name = i, h.allName = s, clog.log(`<span style="color: #f40">更正女优名字: ${i} ${s}</span>`),
                n++);
                continue;
            }
            const g = utils.getNowStr();
            t.push({
                starId: e,
                name: i,
                allName: s,
                avatar: o,
                lastCheckTime: r,
                lastPublishTime: l,
                createDate: g,
                updateDate: g,
                actressType: c
            }), clog.log(`<span style="color: #f40">同步JavDB已收藏的演员: ${i}</span>`), n++;
        }
        return n > 0 ? await this._setItemAndInvalidate(this.favorite_actresses_key, t) : clog.log("信息已记录, 无需要进行同步收藏的演员"),
        n;
        });
    }
    async removeFavoriteActress(e) {
        return this.withActressLock(async () => {
            const t = await this.getFavoriteActressList(), n = t.length, a = t.filter((t => t.starId !== e));
            return a.length === n ? (clog.error(`移除演员失败, ${e} 不存在`), !1) : (await this._setItemAndInvalidate(this.favorite_actresses_key, a), !0);
        });
    }
    async updateFavoriteActress(e) {
        return this.withActressLock(() => this._rawUpdateFavoriteActress(e));
    }
    async getHighlightedTags() {
        return await this.forage.getItem(this.highlighted_tags_key) || [];
    }
    async setHighlightedTags(e) {
        return await this.forage.setItem(this.highlighted_tags_key, e);
    }
    async saveTitleFilterKeyword(n) {
        if (await s(this, e, t).call(this, n, this.filter_keyword_title_key, "标题关键词"), Array.isArray(n)) return null;
        return this.withActressLock(async () => {
        const a = await this.getFavoriteActressList();
        let i = !1;
        const o = a.map((e => {
            if (!e.newVideoList || !Array.isArray(e.newVideoList)) return e;
            const t = e.newVideoList.filter((t => {
                const a = t.startsWith(n);
                return a && (clog.log("移除关联女优新作品", e.name, t), i = !0), !a;
            }));
            return {
                ...e,
                newVideoList: t
            };
        }));
        i && await this._setItemAndInvalidate(this.favorite_actresses_key, o);
        });
    }
    async getTitleFilterKeyword() {
        return null === this.cacheTitleFilterKeyword && (this.cacheTitleFilterKeyword = await this.forage.getItem(this.filter_keyword_title_key) || []),
        this.cacheTitleFilterKeyword;
    }
    async getReviewFilterKeywordList() {
        return await this.forage.getItem(this.filter_keyword_review_key) || [];
    }
    async saveReviewFilterKeyword(n) {
        return s(this, e, t).call(this, n, this.filter_keyword_review_key, "评论关键词");
    }
    async getSetting(e = null, t) {
        this.cacheSettingObj || (this.cacheSettingObj = await this.forage.getItem(this.setting_key) || {});
        let n = this.cacheSettingObj;
        if (null === e) return n;
        const a = n[e];
        return a ? "true" === a || "false" === a ? "true" === a.toLowerCase() : "string" != typeof a || "" === a.trim() || isNaN(Number(a)) ? a : Number(a) : t;
    }
    async saveSetting(e) {
        e ? (await this._setItemAndInvalidate(this.setting_key, e), window.clean_cacheSettingObj()) : show.error("设置对象为空");
    }
    async saveSettingItem(e, t) {
        if (!e) return void show.error("key 不能为空");
        let n = await this.getSetting();
        n[e] = t, await this.saveSetting(n), window.clean_cacheSettingObj();
    }
    async importData(e) {
        await this.forage.clear(), this._invalidateCache();
        const t = [];
        for (const n in e) {
            const a = e[n], i = this._setItemAndInvalidate(n, a);
            t.push(i);
        }
        await Promise.all(t);
    }
    async exportData() {
        const e = {};
        if (await this.forage.iterate(((t, n) => {
            e[n] = t;
        })), 0 === Object.keys(e).length) throw new Error("没有可导出的数据");
        return e;
    }
    async getThirdPartyCache() {
        return await this.forage.getItem(this.third_party_cache_key) || {};
    }
    async setThirdPartyCache(e) {
        await this.forage.setItem(this.third_party_cache_key, e || {});
    }
    async clearThirdPartyCache() {
        await this.forage.removeItem(this.third_party_cache_key);
    }
    async getThirdPartyCacheStats() {
        const e = await this.getThirdPartyCache(), t = Date.now();
        let n = 0, a = 0;
        return Object.values(e).forEach((e => {
            n++, e && e.time && e.ttl && t - e.time < e.ttl && a++;
        })), {
            total: n,
            valid: a,
            expired: n - a
        };
    }
    async cachedRequest(e, t, n) {
        const a = Date.now(), i = await this.getThirdPartyCache(), s = i[e];
        if (s && s.time && a - s.time < (s.ttl || t)) return s.data;
        const o = await n();
        if (void 0 === o || null === o) return o;
        return i[e] = {
            time: a,
            ttl: t,
            data: o
        }, await this.setThirdPartyCache(i), o;
    }
    _groupDuplicateItems(e, t) {
        return groupDuplicateItems(e, t);
    }
    _dedupeByKey(e, t) {
        return dedupeByKey(e, t);
    }
    async inspectDataHealth() {
        const [e, t, n, a] = await Promise.all([ this.getCarList(), this.getFavoriteActressList(), this.getBlacklist(), this.getBlacklistCarList() ]), i = await this.getCarMap(), s = {
            checkedAt: utils.getNowStr(),
            totals: {
                carList: e.length,
                favoriteActresses: t.length,
                blacklist: n.length,
                blacklistCarList: a.length
            },
            fixable: [],
            readonly: []
        }, o = (e, t, n) => s.fixable.push({
            type: e,
            message: t,
            count: n
        }), r = (e, t, n) => s.readonly.push({
            type: e,
            message: t,
            count: n
        });
        const l = this._groupDuplicateItems(e, "carNum"), c = this._groupDuplicateItems(t, "starId"), d = this._groupDuplicateItems(n, "starId");
        l.length && o("duplicate-car", "重复番号记录", l.length), c.length && o("duplicate-actress", "重复收藏演员", c.length),
        d.length && o("duplicate-blacklist", "重复黑名单演员", d.length);
        const h = e.filter((e => e && e.actress)).length, g = a.filter((e => e && e.actress)).length, p = t.filter((e => e && Object.prototype.hasOwnProperty.call(e, "dbId"))).length, m = n.filter((e => e && ("key" in e || "recordTime" in e || "isActor" in e))).length;
        h + g + p + m > 0 && o("legacy-fields", "旧字段残留", h + g + p + m);
        const u = t.filter((e => e && e.name && !Array.isArray(e.allName))).length + n.filter((e => e && e.name && !Array.isArray(e.allName))).length;
        u && o("invalid-all-name", "演员别名不是数组", u);
        let f = 0;
        t.forEach((e => {
            Array.isArray(e?.newVideoList) && (f += e.newVideoList.filter((e => i.has(e))).length);
        })), f && o("stored-new-video", "新作品列表中已有鉴定记录", f);
        const v = e.filter((e => e && e.carNum && !e.url)).length;
        v && r("missing-url", "番号记录缺失 url，需要人工确认来源", v);
        const b = t.filter((e => e && !e.starId)).length + n.filter((e => e && !e.starId)).length;
        b && r("missing-star-id", "演员缺失 starId，需要人工确认身份", b);
        const w = new Set(n.map((e => e && e.starId)).filter(Boolean)), y = a.filter((e => e && e.starId && !w.has(e.starId))).length;
        return y && r("orphan-blacklist-car", "黑名单作品找不到关联演员", y), s;
    }
    async repairDataHealth() {
        let e = 0, t = await this.getCarList(), n = await this.getFavoriteActressList(), a = await this.getBlacklist(), i = await this.getBlacklistCarList();
        const s = this._dedupeByKey(t, "carNum");
        s.changed && (t = s.list, e++);
        const o = this._dedupeByKey(n, "starId");
        o.changed && (n = o.list, e++);
        const r = this._dedupeByKey(a, "starId");
        r.changed && (a = r.list, e++);
        t = t.map((t => {
            if (!t) return t;
            let n = !1;
            return void 0 !== t.actress && (t.names = t.actress, delete t.actress, n = !0), n && e++, t;
        })), i = i.map((t => {
            if (!t) return t;
            let n = !1;
            return void 0 !== t.actress && (t.names = t.actress, delete t.actress, n = !0), Object.prototype.hasOwnProperty.call(t, "type") && (delete t.type, n = !0),
            n && e++, t;
        })), n = n.map((t => {
            if (!t) return t;
            let n = !1;
            return Object.prototype.hasOwnProperty.call(t, "dbId") && (t.starId || (t.starId = t.dbId), delete t.dbId, n = !0), t.name && !Array.isArray(t.allName) && (t.allName = t.allName ? [ t.allName ] : [ t.name ],
            n = !0), n && e++, t;
        })), a = a.map((t => {
            if (!t) return t;
            let n = !1;
            return Object.prototype.hasOwnProperty.call(t, "isActor") && (t.role || (t.role = t.isActor ? B : P),
            delete t.isActor, n = !0), Object.prototype.hasOwnProperty.call(t, "recordTime") && (t.createTime || (t.createTime = t.recordTime), delete t.recordTime,
            n = !0), Object.prototype.hasOwnProperty.call(t, "key") && (delete t.key, n = !0), t.name && !Array.isArray(t.allName) && (t.allName = t.allName ? [ t.allName ] : [ t.name ],
            n = !0), n && e++, t;
        }));
        const l = new Set(t.filter((e => e && e.carNum)).map((e => e.carNum)));
        n = n.map((t => {
            if (!Array.isArray(t?.newVideoList)) return t;
            const n = t.newVideoList.filter((e => !l.has(e)));
            return n.length !== t.newVideoList.length && (t = {
                ...t,
                newVideoList: n
            }, 0 === n.length && t.lastPublishTime && (t.lastPublishTime = null), e++), t;
        })), await this._setItemAndInvalidate(this.car_list_key, t), await this._setItemAndInvalidate(this.favorite_actresses_key, n),
        await this._setItemAndInvalidate(this.blacklist_key, a), await this._setItemAndInvalidate(this.blacklist_car_list_key, i);
        return {
            fixedGroups: e,
            report: await this.inspectDataHealth()
        };
    }
    /** 数据迁移: 将旧版扁平键名重命名为新格式 */
    async merge_table_name() {
        let e = "filter_actor_actress_info_list", t = await this.forage.getItem(e) || [];
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.blacklist_key, t)),
        await this.forage.removeItem(e), e = "favorite_actresses_info_list", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.favorite_actresses_key, t)),
        await this.forage.removeItem(e), e = "car_list_filter_actor_actress", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.blacklist_car_list_key, t)),
        await this.forage.removeItem(e), e = "title_filter_keyword", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.filter_keyword_title_key, t)),
        await this.forage.removeItem(e), e = "review_filter_keyword", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.filter_keyword_review_key, t)),
        await this.forage.removeItem(e), e = "highlightedTags", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.highlighted_tags_key, t)),
        await this.forage.removeItem(e);
    }
    async clean_no_url_blacklist() {
        const [e, t] = await Promise.all([ this.getBlacklistCarList(), this.getBlacklist() ]);
        if (e.length && !e[0].actress) return;
        const n = new Set(t.map((e => e.name))), a = e.filter((e => !e.actress || n.has(e.actress)));
        e.length !== a.length && (clog.debug("清理 blacklistCarList 前", e.length), clog.debug("清理 blacklistCarList 后", a.length),
        await this._setItemAndInvalidate(this.blacklist_car_list_key, a));
        const i = new Set(a.map((e => e.actress)));
        let s = t.filter((e => i.has(e.name)));
        s = s.map((e => {
            const {key: t, recordTime: n, ...a} = e, i = a;
            return void 0 !== n && (i.createTime = n), i;
        })), (t.length !== s.length || t.some((e => "key" in e || "recordTime" in e))) && (clog.debug("清理 Blacklist 前", t.length),
        clog.debug("清理 Blacklist 后", s.length), await this._setItemAndInvalidate(this.blacklist_key, s));
    }
    async async_merge_other() {
        const e = await this.getSetting();
        let t = !1;
        const n = {
            enableCheckFilterActorActress: "enableCheckBlacklist",
            checkIntervalTime_filterActorActress: "checkBlacklist_intervalTime",
            checkIntervalTime_ruleTime: "checkNewVideo_ruleTime",
            checkIntervalTime_newVideo: "checkNewVideo_intervalTime",
            checkIntervalTime_favoriteActress: "checkFavoriteActress_IntervalTime"
        };
        for (const a in n) {
            const i = n[a];
            Object.prototype.hasOwnProperty.call(e, a) && (e[i] = e[a], delete e[a], t = !0);
        }
        e.checkFilterTime && (delete e.checkFilterTime, t = !0), e.checkFilterConcurrencyCount && (delete e.checkFilterConcurrencyCount,
        t = !0), e.checkFilterSleep && (delete e.checkFilterSleep, t = !0), t && (await this.saveSetting(e), clog.debug("配置数据已更正"));
    }
    /** 数据迁移: 补全黑名单条目缺失的 role/starId/allName/movieType 字段 */
    async merge_blacklist() {
        const e = await this.getBlacklist();
        if (!e || 0 === e.length) return;
        let t = !1;
        const n = e.map((e => {
            let n = !1;
            if (Object.prototype.hasOwnProperty.call(e, "isActor") && !e.role && (e.role = e.isActor ? B : P,
            delete e.isActor, n = !0), !e.starId && e.url) try {
                const t = new URL(e.url).pathname, a = t.split("/").filter((e => "" !== e.trim())).pop();
                e.starId !== a && (e.starId = a, n = !0);
            } catch (a) {
                clog.error("提取url-starId发生错误", e.url, a);
            }
            if (e.allName || (e.allName = e.name ? [ e.name ] : [], n = !0), e.movieType || (e.movieType = D,
            n = !0), e.url && e.url.includes("sort_type")) {
                const t = new URL(e.url);
                t.searchParams.delete("sort_type"), e.url = t.toString(), clog.debug("去除黑名单地址sort_type参数");
            }
            return n && (t = !0), e;
        }));
        t && (clog.debug("更正 Blacklist 数据结构"), await this._setItemAndInvalidate(this.blacklist_key, n));
        const a = await this.getBlacklistCarList();
        t = !1;
        const i = a.map((n => {
            if (!n.starId) {
                let a = e.find((e => e.name === n.actress));
                a && (n.starId = a.starId), t = !0;
            }
            return n.type && (delete n.type, t = !0), n;
        }));
        t && (clog.debug("更正 blacklistCarList 数据结构"), await this._setItemAndInvalidate(this.blacklist_car_list_key, i));
    }
    async merge_favoriteActress() {
        const e = await this.getFavoriteActressList();
        if (!e || 0 === e.length) return;
        let t = !1;
        const n = e.map((e => {
            let n = !1;
            return e.dbId && (e.starId = e.dbId, delete e.dbId, n = !0), n && (t = !0), e;
        }));
        t && (clog.debug("更正 favoriteActressesInfoList 数据结构"), await this._setItemAndInvalidate(this.favorite_actresses_key, n));
    }
    async merge_tow_car_list_table() {
        const e = await this.getBlacklistCarList(), t = await this.getCarList();
        let n = !1;
        const a = e.map((e => {
            let t = !1;
            return void 0 !== e.actress && (e.names = e.actress, delete e.actress, t = !0),
            t && (n = !0), e;
        }));
        n && (clog.debug("更正 blacklistCarList 数据结构 actress->names"), await this._setItemAndInvalidate(this.blacklist_car_list_key, a)),
        n = !1;
        const i = t.map((e => {
            let t = !1;
            return void 0 !== e.actress && (e.names = e.actress, delete e.actress, t = !0),
            t && (n = !0), e;
        }));
        n && (clog.debug("更正 carList 数据结构 actress->names"), await this._setItemAndInvalidate(this.car_list_key, i));
    }
};

const U = "https://jdforrepam.com/api";

/** 生成 JavDB API 请求签名 (HMAC-时间戳+盐+MD5, 20秒缓存) */
function O() {
    const e = "jhs_review_ts", t = "jhs_review_sign", n = Math.floor(Date.now() / 1e3);
    if (n - (localStorage.getItem(e) || 0) <= 20) return localStorage.getItem(t);
    const a = `${n}.lpw6vgqzsp.${md5(`${n}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return localStorage.setItem(e, n), localStorage.setItem(t, a), a;
}

const R = async (e, t = 1, n = 20) => {
    let a = `${U}/v1/movies/${e}/reviews`, i = {
        jdSignature: await O()
    };
    return await storageManager.cachedRequest(`reviews:${e}:${t}:${n}`, 864e5, (async () => {
        const e = await gmHttp.get(a, {
            page: t,
            sort_by: "hotly",
            limit: n
        }, i);
        if (!e?.data?.reviews) throw new Error(e?.message || "获取评论失败");
        return e.data.reviews;
    }));
}, V = async e => {
    let t = `${U}/v4/movies/${e}`, n = {
        jdSignature: await O()
    };
    const a = await storageManager.cachedRequest(`movie-detail:${e}`, 6048e5, (async () => {
        const e = await gmHttp.get(t, null, n);
        if (!e.data) throw new Error(e.message || "获取视频详情失败");
        return e;
    }));
    if (!a.data) throw show.error("获取视频详情失败: " + a.message), new Error(a.message);
    const i = a.data.movie, s = i.preview_images, o = [];
    return s.forEach((e => {
        o.push(e.large_url.replace("https://tp-iu.cmastd.com/rhe951l4q", "https://c0.jdbstatic.com"));
    })), {
        movieId: i.id,
        actors: i.actors,
        duration: i.duration,
        title: i.origin_title,
        carNum: i.number,
        score: i.score,
        releaseDate: i.release_date,
        watchedCount: i.watched_count,
        imgList: o
    };
}, K = async (e, t = 1, n = 20) => {
    let a = `${U}/v1/lists/related?movie_id=${e}&page=${t}&limit=${n}`, i = {
        jdSignature: await O()
    };
    const s = await storageManager.cachedRequest(`related:${e}:${t}:${n}`, 864e5, (async () => {
        const e = await gmHttp.get(a, null, i);
        if (!e?.data?.lists) throw new Error(e?.message || "获取相关清单失败");
        return e;
    })), o = [];
    return s.data.lists.forEach((e => {
        o.push({
            relatedId: e.id,
            name: e.name,
            movieCount: e.movies_count,
            collectionCount: e.collections_count,
            viewCount: e.views_count,
            createTime: utils.formatDate(e.created_at)
        });
    })), o;
}, W = async (e = "daily", t = "high_score") => {
    let n = `${U}/v1/rankings/playback?period=${e}&filter_by=${t}`, a = {
        jdSignature: await O()
    };
    return (await gmHttp.get(n, null, a)).data.movies;
}, q = async (e = "all", t = "", n = 1, a = 40) => {
    let i = `${U}/v1/movies/top?start_rank=1&type=${e}&type_value=${t}&ignore_watched=false&page=${n}&limit=${a}`;
    const l = localStorage.getItem("jhs_appAuthorization"), c = l ? await decryptData(l) : "";
    let s = {
        "user-agent": "Dart/3.5 (dart:io)",
        "accept-language": "zh-TW",
        host: "jdforrepam.com",
        authorization: "Bearer " + c,
        jdsignature: await O()
    };
    return await gmHttp.get(i, null, s);
};

class J {
    constructor() {
        return i(this, "intervalContainer", {}), i(this, "mimeTypes", {
            txt: "text/plain",
            html: "text/html",
            css: "text/css",
            csv: "text/csv",
            json: "application/json",
            xml: "application/xml",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            zip: "application/zip",
            rar: "application/x-rar-compressed",
            "7z": "application/x-7z-compressed",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            mp4: "video/mp4",
            webm: "video/webm",
            ogg: "audio/ogg"
        }), i(this, "timers", new Map), i(this, "insertStyle", (e => {
            e && (-1 === e.indexOf("<style>") && (e = "<style>" + e + "</style>"), $("head").append(e));
        })), i(this, "layerIndexStack", []), J.instance || (J.instance = this), J.instance;
    }
    importResource(e) {
        let t;
        e.indexOf("css") >= 0 ? (t = document.createElement("link"), t.setAttribute("rel", "stylesheet"),
        t.href = e) : (t = document.createElement("script"), t.setAttribute("type", "text/javascript"),
        t.src = e), document.documentElement.appendChild(t);
    }
    openPage(e, t, n, a) {
        if (n = n ?? !0, a && (a.ctrlKey || a.metaKey)) return void GM_openInTab(e.includes("http") ? e : window.location.origin + e, {
            insert: 0
        });
        let i = e;
        e.includes("/actors/") || e.includes("/star/") || (i = e.includes("?") ? `${e}&hideNav=1` : `${e}?hideNav=1`),
        layer.open({
            type: 2,
            title: t,
            content: i,
            scrollbar: !1,
            shadeClose: n,
            area: this.getResponsiveArea([ "85%", "90%" ]),
            isOutAnim: !1,
            anim: -1,
            success: (e, t) => {
                this.setupEscClose(t);
            }
        });
    }
    _handleGlobalEscKey(e) {
        if ("Escape" !== e.key && 27 !== e.keyCode) return;
        if (0 === this.layerIndexStack.length) return;
        const t = this.layerIndexStack[this.layerIndexStack.length - 1], n = $(`#layui-layer${t}`);
        let a = !1;
        if (n.find(".viewer-container").length > 0) a = !0; else {
            const e = n.find(`#layui-layer-iframe${t}`)[0];
            if (e && e.contentDocument) try {
                $(e.contentDocument).find(".viewer-container").length > 0 && (a = !0);
            } catch (i) {
                clog.warn("无法检查跨域 iframe 内的 .viewer-container");
            }
        }
        a || (this.layerIndexStack.pop(), layer.close(t));
    }
    setupEscClose(e) {
        var t;
        this._boundHandler || (this._boundHandler = this._handleGlobalEscKey.bind(this),
        $(document).off("keydown.globalLayerEsc"), $(document).on("keydown.globalLayerEsc", this._boundHandler)),
        -1 === this.layerIndexStack.indexOf(e) && this.layerIndexStack.push(e);
        const n = $(`#layui-layer-iframe${e}`), a = `keydown.layerEsc${e}`;
        try {
            const e = null == (t = n[0]) ? void 0 : t.contentDocument;
            if (e) {
                if ("yes" === n.attr("data-esc-bound")) return;
                $(e).off(a), $(e).on(a, this._boundHandler), n.attr("data-esc-bound", "yes");
            }
        } catch (i) {
            clog.error("iframe监听失败 (跨域或未加载完毕):", i);
        }
    }
    closePage() {
        storageManager.getSetting("needClosePage", "yes").then((e => {
            if ("yes" !== e) return;
            parent.document.documentElement.style.overflow = "auto";
            [ ".layui-layer-shade", ".layui-layer-move", ".layui-layer" ].forEach((function(e) {
                const t = parent.document.querySelectorAll(e);
                if (t.length > 0) {
                    const e = t.length > 1 ? t[t.length - 1] : t[0];
                    e.parentNode.removeChild(e);
                }
            })), window.close();
        }));
    }
    loopDetector(e, t, n = 20, a = 1e4, i = !0) {
        const s = Math.random(), o = (new Date).getTime(), r = e => {
            clearInterval(this.intervalContainer[s]), e && t && t(), delete this.intervalContainer[s];
        };
        this.intervalContainer[s] = setInterval((() => {
            const t = (new Date).getTime() - o;
            e() ? r(!0) : t >= a && r(i);
        }), n);
    }
    rightClick(e, t, n) {
        let a;
        "string" == typeof e ? a = document.querySelector(e) : e instanceof HTMLElement && (a = e),
        a || (console.warn("rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。"), a = document.body),
        "string" == typeof t && "" !== t.trim() ? a.addEventListener("contextmenu", (e => {
            const a = e.target.closest(t);
            a && n(e, a);
        })) : console.error("rightClick(), 必须提供有效的 targetSelector。");
    }
    q(e, t, n, a) {
        let i, s;
        e ? (i = e.clientX - 130, s = e.clientY - 120) : (i = window.innerWidth / 2 - 120,
        s = window.innerHeight / 2 - 120);
        let o = layer.confirm(t, {
            offset: [ s, i ],
            title: "提示",
            btn: [ "确定", "取消" ],
            shade: 0,
            zIndex: 999999991
        }, (function() {
            n && n(), layer.close(o);
        }), (function() {
            a && a();
        }));
    }
    getNowStr(e = "-", t = ":", n = null) {
        let a;
        a = n ? new Date(n) : new Date;
        const i = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0"), r = String(a.getHours()).padStart(2, "0"), l = String(a.getMinutes()).padStart(2, "0"), c = String(a.getSeconds()).padStart(2, "0");
        return `${[ i, s, o ].join(e)} ${[ r, l, c ].join(t)}`;
    }
    formatDate(e, t = "-", n = ":") {
        let a;
        if (e instanceof Date) a = e; else {
            if ("string" != typeof e) throw new Error("Invalid date input: must be Date object or date string");
            if (a = new Date(e), isNaN(a.getTime())) throw new Error("Invalid date string");
        }
        const i = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0"), r = String(a.getHours()).padStart(2, "0"), l = String(a.getMinutes()).padStart(2, "0"), c = String(a.getSeconds()).padStart(2, "0");
        return `${[ i, s, o ].join(t)} ${[ r, l, c ].join(n)}`;
    }
    getHourDifference(e, t) {
        const n = e.getTime(), a = t.getTime(), i = Math.abs(a - n) / 36e5;
        return Math.floor(i);
    }
    download(e, t) {
        show.info("开始请求下载...");
        const n = t.split(".").pop().toLowerCase();
        let a, i = this.mimeTypes[n] || "application/octet-stream";
        if (e instanceof Blob) a = e; else if (e instanceof ArrayBuffer || ArrayBuffer.isView(e)) a = new Blob([ e ], {
            type: i
        }); else if ("string" == typeof e && e.startsWith("data:")) {
            const t = atob(e.split(",")[1]), n = new ArrayBuffer(t.length), s = new Uint8Array(n);
            for (let e = 0; e < t.length; e++) s[e] = t.charCodeAt(e);
            a = new Blob([ s ], {
                type: i
            });
        } else a = new Blob([ e ], {
            type: i
        });
        const s = URL.createObjectURL(a), o = document.createElement("a");
        o.href = s, o.download = t, document.body.appendChild(o), o.click(), setTimeout((() => {
            document.body.removeChild(o), URL.revokeObjectURL(s);
        }), 100);
    }
    smoothScrollToTop(e = 500) {
        return new Promise((t => {
            const n = performance.now(), a = window.pageYOffset;
            window.requestAnimationFrame((function i(s) {
                const o = s - n, r = Math.min(o / e, 1), l = r < .5 ? 4 * r * r * r : 1 - Math.pow(-2 * r + 2, 3) / 2;
                window.scrollTo(0, a * (1 - l)), r < 1 ? window.requestAnimationFrame(i) : t();
            }));
        }));
    }
    simpleId() {
        return crypto.randomUUID().replace("-", "");
    }
    isUrl(e) {
        try {
            return new URL(e), !0;
        } catch (t) {
            return !1;
        }
    }
    setHrefParam(e, t) {
        const n = new URL(window.location.href);
        n.searchParams.set(e, t), window.history.pushState({}, "", n.toString());
    }
    getUrlParam(e, t) {
        const n = e.split("?")[1];
        if (!n) return null;
        const a = new RegExp(`(?:^|&)${t}=([^&]*)`), i = n.match(a);
        let s = "";
        return i && i[1] && (s = decodeURIComponent(i[1].replace(/\+/g, " "))), s ? "true" === s || "false" === s ? "true" === s.toLowerCase() : "string" != typeof s || "" === s.trim() || isNaN(Number(s)) ? s : Number(s) : s;
    }
    reBuildSignature() {
        return O();
    }
    getResponsiveArea(e) {
        const t = window.innerWidth;
        return t >= 1200 ? e || this.getDefaultArea() : t >= 768 ? [ "70%", "90%" ] : [ "95%", "95%" ];
    }
    getDefaultArea() {
        return [ "85%", "90%" ];
    }
    isMobile() {
        const e = navigator.userAgent.toLowerCase();
        return [ "iphone", "ipod", "ipad", "android", "blackberry", "windows phone", "nokia", "webos", "opera mini", "mobile", "mobi", "tablet" ].some((t => e.includes(t)));
    }
    copyToClipboard(e, t) {
        navigator.clipboard.writeText(t).then((() => show.info(`${e}已复制到剪切板, ${t}`))).catch((e => console.error("复制失败: ", e)));
    }
    htmlTo$dom(e) {
        const t = new DOMParser;
        return $(t.parseFromString(e, "text/html"));
    }
    addCookie(e, t = {}) {
        const {maxAge: n = 604800, path: a = "/", domain: i = "", secure: s = !1, sameSite: o = "Lax"} = t;
        e.split(";").forEach((e => {
            const t = e.trim();
            if (t) {
                const e = t.split("=");
                if (e.length >= 2 && e[0].trim()) {
                    let t = [ `${e[0].trim()}=${e.slice(1).join("=")}` ];
                    n > 0 && t.push(`max-age=${n}`), t.push(`path=${a}`), i && t.push(`domain=${i}`),
                    s && t.push("Secure"), o && t.push(`SameSite=${o}`), clog.debug("document.cookie = '" + t.join("; ") + "'"),
                    document.cookie = t.join("; ");
                }
            }
        }));
    }
    isHidden(e) {
        const t = e.jquery ? e[0] : e;
        return !t || (t.offsetWidth <= 0 && t.offsetHeight <= 0 || "none" === window.getComputedStyle(t).display);
    }
    time(e = "default", t = "s", n = 2) {
        if (this.timers.has(e)) {
            const t = this.timers.get(e), n = performance.now() - t.startTime;
            let a, i;
            return "s" === t.unit ? (a = (n / 1e3).toFixed(t.precision), i = "秒") : (a = n.toFixed(t.precision),
            i = "毫秒"), this.timers.delete(e), `${e}: ${a}${i}`;
        }
        this.timers.set(e, {
            startTime: performance.now(),
            unit: t,
            precision: n
        });
    }
    sleep(e = 1e3) {
        return new Promise((t => setTimeout(t, e)));
    }
    genericSort(e, t, n = !0) {
        if (!Array.isArray(e) || 0 === e.length) return [];
        if (!Array.isArray(t) || 0 === t.length) return [ ...e ];
        const a = [ ...e ], i = e => {
            if (e instanceof Date) return e;
            if ("string" == typeof e) {
                const t = new Date(e);
                if (!isNaN(t.getTime())) return t;
            }
            return e;
        };
        return a.sort(((e, a) => {
            for (const s of t) {
                const {key: t, order: o = "asc"} = s;
                let r = e, l = a;
                null != t && ("function" == typeof t ? (r = t(e), l = t(a)) : (r = e && "object" == typeof e ? e[t] : void 0,
                l = a && "object" == typeof a ? a[t] : void 0));
                const c = i(r), d = i(l);
                let h = 0;
                const g = null == r, p = null == l;
                if (g && p) return 0;
                if (g) return n ? 1 : -1;
                if (p) return n ? 1 : -1;
                if (h = c instanceof Date && d instanceof Date ? c.getTime() - d.getTime() : "number" == typeof r && "number" == typeof l ? r - l : "string" == typeof r && "string" == typeof l ? r.localeCompare(l) : String(r).localeCompare(String(l)),
                "desc" === o && (h *= -1), 0 !== h) return h;
            }
            return 0;
        }));
    }
    async retry(e, t = 3) {
        let n = 0;
        for (;n < t; ) try {
            const t = await e();
            return n > 0 && clog.debug(`[重试] 请求成功，共发起 ${n + 1} 次。`), t;
        } catch (a) {
            const e = String(a);
            if (e.includes("Just a moment") || e.includes("重定向") || e.toLowerCase().includes("404 not found")) throw a;
            if (n++, n === t) throw clog.debug(`[重试] 达到最大重试次数 (${t})，最终失败：`, a), a;
            clog.debug(`[重试] 请求失败，准备第 ${n + 1} 次重试, 错误信息: ${e}`);
        }
    }
}

unsafeWindow.utils = window.utils = new J, unsafeWindow.gmHttp = window.gmHttp = new class {
    async get(e, t = {}, n = {}, a) {
        return this.gmRequest("GET", e, null, t, n, a);
    }
    post(e, t = {}, n = {}) {
        n = {
            "Content-Type": "application/json",
            ...n
        };
        let a = JSON.stringify(t);
        return this.gmRequest("POST", e, a, null, n);
    }
    postForm(e, t = {}, n = {}) {
        n || (n = {}), n["Content-Type"] || (n["Content-Type"] = "application/x-www-form-urlencoded");
        let a = "";
        return t && Object.keys(t).length > 0 && (a = Object.entries(t).map((([e, t]) => `${e}=${t}`)).join("&")),
        this.gmRequest("POST", e, a, null, n);
    }
    postFileFormData(e, t = {}, n = {}) {
        n || (n = {});
        const a = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
        n["Content-Type"] = `multipart/form-data; boundary=${a}`;
        let i = "";
        return t && Object.keys(t).length > 0 && (i = Object.entries(t).map((([e, t]) => `--${a}\r\nContent-Disposition: form-data; name="${e}"\r\n\r\n${t}\r\n`)).join("")),
        i += `--${a}--`, this.gmRequest("POST", e, i, null, n);
    }
    async downloadFileInChunks(e, t = {}, n, a) {
        if (!n) throw new Error("请提供文件名 (filename) 用于保存。");
        const i = await storageManager.getSetting("httpTimeout", 5e3), s = await storageManager.getSetting("httpRetryCount", 3);
        let o, r;
        clog.log(`[${n}] 正在获取文件大小...`);
        try {
            const a = await utils.retry((() => new Promise(((n, a) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: e,
                    headers: {
                        ...t,
                        Range: "bytes=0-0"
                    },
                    timeout: i,
                    onload: n,
                    onerror: e => a(new Error("网络错误：无法获取文件大小")),
                    ontimeout: () => a(new Error("超时：获取文件大小"))
                });
            }))), s);
            if (206 !== a.status && 200 !== a.status) throw new Error(`请求文件大小失败，状态码: ${a.status}`);
            {
                const e = a.responseHeaders.match(/content-range:\s*bytes\s*\d+-\d+\/(\d+)/i), t = a.responseHeaders.match(/content-type:\s*([^\s;]+)/i);
                if (e && e[1]) o = parseInt(e[1], 10); else {
                    if (!a.responseHeaders.match(/content-length:\s*(\d+)/i) || 200 !== a.status) throw new Error("无法从响应头中获取文件总大小，服务器可能不支持 Range 请求。");
                    {
                        const e = a.responseHeaders.match(/content-length:\s*(\d+)/i);
                        o = parseInt(e[1], 10), clog.warn(`[${n}] 服务器返回 200 状态码，可能不支持 Range 请求。将尝试完整下载。`);
                    }
                }
                t && t[1] && (r = t[1]), clog.log(`[${n}] 文件总大小：${(o / 1024 / 1024).toFixed(2)} MB, MIME 类型: ${r || "未知"}`);
            }
        } catch (u) {
            throw clog.error(`[${n}] 获取文件大小失败:`, u.message), u;
        }
        if (!o || o <= 0) throw new Error("获取到的文件大小无效或服务器拒绝提供大小信息。");
        const l = 1048576, c = Math.ceil(o / l), d = [], h = new Array(c);
        clog.log(`[${n}] 文件将被分为 ${c} 块进行下载 (每块约 ${1..toFixed(2)} MB)`);
        for (let f = 0; f < c; f++) {
            const a = f * l, r = `bytes=${a}-${Math.min(a + l - 1, o - 1)}`, g = await utils.retry((() => new Promise(((a, s) => {
                const o = {
                    ...t,
                    Range: r,
                    Accept: "application/octet-stream"
                };
                GM_xmlhttpRequest({
                    method: "GET",
                    url: e,
                    headers: o,
                    timeout: i,
                    responseType: "arraybuffer",
                    onload: e => {
                        206 === e.status || 200 === e.status ? e.response instanceof ArrayBuffer ? (h[f] = e.response,
                        clog.log(`[${n}] 成功下载第 ${f + 1}/${c} 块 (${r})`), a()) : s(new Error(`第 ${f + 1} 块响应不是 ArrayBuffer。`)) : s(new Error(`第 ${f + 1} 块请求失败，状态码: ${e.status}`));
                    },
                    onerror: e => s(new Error(`第 ${f + 1} 块网络错误: ${e.error}`)),
                    ontimeout: () => s(new Error(`第 ${f + 1} 块超时。`))
                });
            }))), s);
            d.push(g);
        }
        try {
            await Promise.all(d), clog.log(`[${n}] 所有分块下载完成，开始合并...`);
        } catch (u) {
            throw clog.error(`[${n}] 分块下载过程中发生错误:`, u.message), u;
        }
        const g = new Blob(h);
        g.size !== o && clog.warn(`[${n}] 警告：合并后的 Blob 大小 (${g.size}) 与预期文件大小 (${o}) 不匹配！`);
        const p = await g.text();
        let m;
        m = a ? a(p) : p, utils.download(m, n), clog.log(`[${n}] 文件合并完成，已触发浏览器下载。`);
    }
    async gmRequest(e, t, n = {}, a = {}, i = {}, s = !1) {
        if (a && Object.keys(a).length) {
            const e = new URLSearchParams(a).toString();
            t += (t.includes("?") ? "&" : "?") + e;
        }
        const o = await storageManager.getSetting("httpTimeout", 5e3), r = await storageManager.getSetting("httpRetryCount", 3);
        return n || (n = void 0), await utils.retry((() => new Promise(((a, r) => {
            GM_xmlhttpRequest({
                method: e,
                url: t,
                headers: i,
                timeout: o,
                data: n,
                onload: e => {
                    try {
                        if (s && e.finalUrl !== t && r("请求被重定向了,URL是:" + e.finalUrl), e.status >= 200 && e.status < 300) if (e.responseText) try {
                            a(JSON.parse(e.responseText));
                        } catch (n) {
                            a(e.responseText);
                        } else a(e.responseText || e); else if (clog.error("请求失败,状态码:", e.status, t), e.responseText) try {
                            const t = JSON.parse(e.responseText);
                            r(t);
                        } catch {
                            r(new Error(e.responseText || `请求发生错误 ${e.status}`));
                        } else r(new Error(`请求发生错误 ${e.status}`));
                    } catch (n) {
                        r(n);
                    }
                },
                onerror: e => {
                    clog.error("网络错误:", t), r(new Error(e.error || "网络错误"));
                },
                ontimeout: () => {
                    r(new Error("请求超时: " + t));
                }
            });
        }))), r);
    }
}, unsafeWindow.storageManager = window.storageManager = new z;

const G = new BroadcastChannel("channel-refresh");

window.refresh = function() {
    G.postMessage({
        type: "refresh"
    });
};

window.cleanCache_filter_actor_actress_car_list = function() {
    G.postMessage({
        type: "cleanCache_filter_actor_actress_car_list"
    });
};

window.clean_cacheSettingObj = function() {
    G.postMessage({
        type: "clean_cacheSettingObj"
    });
};

document.head.insertAdjacentHTML("beforeend", '\n        <style>\n            .loading-container {\n                position: fixed;\n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                display: flex;\n                justify-content: center;\n                align-items: center;\n                background-color: rgba(0, 0, 0, 0.1);\n                z-index: 99999999;\n            }\n    \n            .loading-animation {\n                position: relative;\n                width: 60px;\n                height: 12px;\n                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);\n                border-radius: 6px;\n                animation: loading-animate 1.8s ease-in-out infinite;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before,\n            .loading-animation:after {\n                position: absolute;\n                display: block;\n                content: "";\n                animation: loading-animate 1.8s ease-in-out infinite;\n                height: 12px;\n                border-radius: 6px;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before {\n                top: -20px;\n                left: 10px;\n                width: 40px;\n                background: linear-gradient(90deg, #ff758c 0%, #ff7eb3 100%);\n            }\n    \n            .loading-animation:after {\n                bottom: -20px;\n                width: 35px;\n                background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 100%);\n            }\n    \n            @keyframes loading-animate {\n                0% {\n                    transform: translateX(40px);\n                }\n                50% {\n                    transform: translateX(-30px);\n                }\n                100% {\n                    transform: translateX(40px);\n                }\n            }\n        </style>\n    ');

unsafeWindow.loading = window.loading = function() {
    const e = document.createElement("div");
    e.className = "loading-container";
    const t = document.createElement("div");
    return t.className = "loading-animation", e.appendChild(t), document.body.appendChild(e),
    {
        close: () => {
            e && e.parentNode && e.parentNode.removeChild(e);
        }
    };
}, function() {
    const e = (e, t, n, a, i) => {
        let s;
        "object" == typeof n ? s = n : (s = "object" == typeof a ? a : i || {}, s.gravity = n || "top",
        s.position = "string" == typeof a ? a : "center"), s.gravity && "center" !== s.gravity || (s.offset = {
            y: "calc(50vh - 150px)"
        });
        const o = "#60A5FA", r = "#93C5FD", l = "#10B981", c = "#6EE7B7", d = "#EF4444", h = "#FCA5A5", g = {
            borderRadius: "12px",
            color: "white",
            padding: "12px 16px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            minWidth: "150px",
            textAlign: "center",
            zIndex: 999999999
        }, p = {
            text: e,
            duration: 1e3,
            close: !1,
            gravity: "top",
            position: "center",
            style: {
                info: {
                    ...g,
                    background: `linear-gradient(to right, ${o}, ${r})`
                },
                success: {
                    ...g,
                    background: `linear-gradient(to right, ${l}, ${c})`
                },
                error: {
                    ...g,
                    background: `linear-gradient(to right, ${d}, ${h})`
                }
            }[t],
            stopOnFocus: !0,
            oldestFirst: !1,
            ...s
        };
        -1 === p.duration && (p.close = !0);
        const m = Toastify(p);
        return m.showToast(), m.closeShow = () => {
            m.toastElement.remove();
        }, m;
    };
    unsafeWindow.show = window.show = {
        ok: (t, n = "center", a, i) => e(t, "success", n, a, i),
        error: (t, n = "center", a, i) => e(t, "error", n, a, i),
        info: (t, n = "center", a, i) => e(t, "info", n, a, i)
    };
}(), function() {
    function e(e = 10) {
        setTimeout((() => {
            const e = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = e > 0 ? "hidden" : "";
        }), e);
    }
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .viewer-canvas {\n                overflow: auto !important;\n            }\n            \n            .viewer-close {\n                background: rgba(255,0,0,0.6) !important;\n            }\n            .viewer-close:hover {\n                background: rgba(255,0,0,0.8) !important;\n            }\n        </style>\n    "),
    window.showImageViewer = function(t, n = "") {
        let a = null, i = !1;
        "string" == typeof t || t instanceof String ? (a = $('<div class="temporary-container" style="display:none;">').append(`<img src="${t}" alt="${n}">`).appendTo("body"),
        i = !0) : a = $(t);
        const s = {
            zIndex: 999999990,
            navbar: !1,
            zoomOnWheel: !1,
            zoomRatio: .1,
            toggleOnDblclick: !1,
            toolbar: {
                zoomIn: 1,
                zoomOut: 1,
                reset: 1,
                rotateLeft: 0,
                rotateRight: 0,
                flipHorizontal: 0,
                flipVertical: 0
            },
            title: !1,
            keyboard: !1,
            viewed() {
                o.zoomTo(1.4);
                let e = (o.viewerData.width - o.imageData.width) / 2;
                o.moveTo(e, 0);
            },
            shown() {
                i && a.remove(), document.documentElement.style.overflow = "hidden", document.body.style.overflow = "hidden",
                o.handleKeydown = function(t) {
                    "Escape" !== t.key && " " !== t.key || (t.preventDefault(), t.stopPropagation(),
                    o.destroy(), document.removeEventListener("keydown", o.handleKeydown), document.documentElement.style.overflow = "",
                    document.body.style.overflow = "", e());
                }, document.addEventListener("keydown", o.handleKeydown);
            },
            hidden() {
                o && o.handleKeydown && document.removeEventListener("keydown", o.handleKeydown),
                o.destroy(), document.documentElement.style.overflow = "", document.body.style.overflow = "",
                e();
            }
        }, o = new Viewer(a[0], s);
        o.show();
    };
}(), window.ImageHoverPreview = class {
    constructor(e = {}) {
        this.config = {
            selector: ".hover-preview",
            dataAttribute: "data-full",
            maxWidth: 1e3,
            maxHeight: 1e3,
            offsetX: 20,
            offsetY: 20,
            zIndex: 9999999999,
            transition: .2,
            autoAdjustPosition: !0,
            ...e
        }, this.preview = null, this.currentTarget = null, this.timer = null, this.imgElement = null,
        this.boundElements = new WeakSet, this.init();
    }
    init() {
        this.injectStyles(), this.createPreviewElement(), this.bindEvents();
    }
    injectStyles() {
        const e = `\n                <style>\n                    .image-hover-preview {\n                        position: fixed;\n                        display: none;\n                        z-index: ${this.config.zIndex};\n                        border-radius: 4px;\n                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n                        overflow: hidden;\n                        pointer-events: none;\n                        opacity: 0;\n                        transition: opacity ${this.config.transition}s ease;\n                        background-color: #fff;\n                    }\n                    \n                    .image-hover-preview.active {\n                        opacity: 1;\n                    }\n                    \n                    .image-hover-preview img {\n                        max-width: ${this.config.maxWidth}px;\n                        max-height: ${this.config.maxHeight}px;\n                        display: block;\n                        object-fit: contain;\n                    }\n                    \n                    .image-hover-preview::after {\n                        content: '';\n                        position: absolute;\n                        top: 0;\n                        left: 0;\n                        right: 0;\n                        bottom: 0;\n                        background: rgba(0, 0, 0, 0.03);\n                        pointer-events: none;\n                    }\n                    \n                    .image-hover-preview.loading::before {\n                        content: '加载中...';\n                        position: absolute;\n                        top: 50%;\n                        left: 50%;\n                        transform: translate(-50%, -50%);\n                        color: #666;\n                        font-size: 14px;\n                    }\n                </style>\n            `;
        document.head.insertAdjacentHTML("beforeend", e);
    }
    createPreviewElement() {
        this.preview = document.createElement("div"), this.preview.className = "image-hover-preview",
        document.body.appendChild(this.preview);
    }
    bindEvents() {
        document.querySelectorAll(this.config.selector).forEach((e => {
            this.boundElements.has(e) || (e.addEventListener("mouseenter", (e => this.handleMouseEnter(e))),
            e.addEventListener("mouseleave", (e => this.handleMouseLeave(e))), e.addEventListener("mousemove", (e => this.handleMouseMove(e))),
            this.boundElements.add(e));
        }));
    }
    handleMouseEnter(e) {
        clearTimeout(this.timer), this.currentTarget = e.currentTarget;
        const t = this.currentTarget.getAttribute(this.config.dataAttribute) || this.currentTarget.src;
        if (!t) return;
        this.preview.innerHTML = "", this.preview.classList.add("loading"), this.preview.style.display = "block",
        this.preview.classList.remove("active");
        const n = new Image;
        n.onload = () => {
            this.preview.classList.remove("loading"), this.preview.innerHTML = `<img src="${t}" alt="预览图">`,
            this.imgElement = this.preview.querySelector("img");
            const {width: a, height: i} = this.calculateImageSize(n);
            this.preview.style.width = `${a}px`, this.preview.style.height = `${i}px`, this.preview.offsetHeight,
            this.preview.classList.add("active"), this.handleMouseMove(e);
        }, n.onerror = () => {
            this.preview.classList.remove("loading"), this.preview.innerHTML = '<div style="padding:10px;color:#f00;">图片加载失败</div>';
        }, n.src = t;
    }
    calculateImageSize(e) {
        let t = e.naturalWidth, n = e.naturalHeight;
        if (t > this.config.maxWidth || n > this.config.maxHeight) {
            const e = Math.min(this.config.maxWidth / t, this.config.maxHeight / n);
            t *= e, n *= e;
        }
        return {
            width: t,
            height: n
        };
    }
    handleMouseMove(e) {
        if (!this.currentTarget || !this.preview.classList.contains("active")) return;
        let {offsetX: t, offsetY: n} = this.config, a = e.clientX + t, i = e.clientY + n;
        if (this.config.autoAdjustPosition) {
            const s = this.preview.offsetWidth, o = this.preview.offsetHeight;
            a + s > window.innerWidth && (a = e.clientX - s - t), i + o > window.innerHeight && (i = e.clientY - o - n),
            a = Math.max(0, a), i = Math.max(0, i);
        }
        this.preview.style.left = `${a}px`, this.preview.style.top = `${i}px`;
    }
    handleMouseLeave() {
        this.preview.classList.remove("active"), this.preview.style.display = "none", this.currentTarget = null,
        this.imgElement = null;
    }
    destroy() {
        document.querySelectorAll(this.config.selector).forEach((e => {
            this.boundElements.has(e) && (e.removeEventListener("mouseenter", this.handleMouseEnter),
            e.removeEventListener("mouseleave", this.handleMouseLeave), e.removeEventListener("mousemove", this.handleMouseMove),
            this.boundElements.delete(e));
        })), this.preview && this.preview.parentNode && this.preview.parentNode.removeChild(this.preview);
    }
}, async function() {
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .console-logger-container {\n                position: fixed;\n                bottom: 0;\n                right: 0;\n                z-index: 99999999;\n                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n                display: flex;\n                flex-direction: column; \n                align-items: flex-end;\n                width: fit-content;\n            }\n\n            .console-logger-toggle {\n                width: 40px;\n                height: 30px;\n                background: #2c3e50;\n                border-radius: 120px 10px 0 0;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                cursor: pointer;\n                box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);\n                transition: all 0.3s ease;\n                color: white;\n                font-size: 16px;\n            }\n\n            .console-logger-toggle:hover {\n                background: #34495e;\n            }\n\n            .console-logger-toggle::after {\n                content: '▼';\n                transition: transform 0.3s ease;\n            }\n\n            .console-logger-toggle.collapsed::after {\n                content: '▲';\n            }\n\n            .console-logger-window {\n                width: 400px;\n                height: 400px;\n                background: white;\n                border-radius: 10px 0 10px 10px;\n                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);\n                display: flex;\n                flex-direction: column;\n                overflow: hidden;\n                transform: translateY(0);\n                opacity: 1;\n                /* 简化过渡属性 */\n                transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.3s ease;\n            }\n\n            .console-logger-window.maximized {\n                width: 600px !important;\n                height: 85vh !important;\n                border-radius: 10px 0 0 10px; /* 调整圆角以匹配右下角 */\n            }\n\n            .console-logger-window.collapsed {\n                height: 0 !important;\n                min-height: 0 !important; \n                opacity: 0;\n            }\n\n            .console-logger-header {\n                background: #2c3e50;\n                color: white;\n                padding: 12px 15px;\n                display: flex;\n                justify-content: space-between;\n                align-items: center;\n                flex-shrink: 0;\n            }\n\n            .console-logger-title {\n                font-weight: 600;\n                font-size: 16px;\n            }\n\n            .console-logger-controls {\n                display: flex;\n                gap: 10px;\n            }\n\n            .console-logger-controls button {\n                background: transparent;\n                border: 1px solid rgba(255, 255, 255, 0.3);\n                padding: 5px 10px;\n                font-size: 12px;\n                color: white;\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n            }\n\n            .console-logger-controls button:hover {\n                background: rgba(255, 255, 255, 0.1);\n            }\n\n            /* 新增的按钮样式 */\n            .console-logger-maximize-toggle {\n                line-height: 1;\n                font-size: 14px !important; /* 使箭头看起来更大 */\n                padding: 5px 8px !important;\n            }\n            .console-logger-maximize-toggle::before {\n                content: '⇱'; /* Unicode symbol for maximized */\n            }\n            .console-logger-maximize-toggle.active::before {\n                content: '⇲'; /* Unicode symbol for minimized */\n            }\n\n\n            .console-logger-filters {\n                display: flex;\n                align-items: center;\n                gap: 5px;\n                padding: 10px;\n                background: #f8f9fa;\n                border-bottom: 1px solid #e9ecef;\n                flex-shrink: 0;\n                overflow-x: hidden; \n            }\n\n            /* 新增: 过滤器按钮组的容器，负责滚动 */\n            .console-logger-filter-group {\n                display: flex;\n                gap: 5px;\n                overflow-x: auto; /* 允许过滤器按钮滚动 */\n                flex-grow: 1; /* 占据剩余空间 */\n                padding-right: 10px; /* 避免滚动条影响按钮 */\n            }\n\n            .console-logger-filter {\n                padding: 5px 10px;\n                font-size: 12px;\n                border-radius: 15px;\n                background: #ecf0f1;\n                color: #7f8c8d;\n                border: 1px solid #ddd;\n                cursor: pointer;\n                transition: all 0.3s;\n                white-space: nowrap;\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-filter.active {\n                background: #3498db;\n                color: white;\n                border-color: #3498db;\n            }\n\n            /* 新增: 滚动到底部按钮的样式 (位于 filtersContainer 内部右侧) */\n            .console-logger-scroll-to-bottom {\n                background: #3498db;\n                border: none;\n                padding: 5px 10px;\n                font-size: 12px;\n                color: white;\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n                line-height: 1;\n                height: fit-content;\n                white-space: nowrap;\n                margin-left: auto; /* 将按钮推到最右侧 */\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-scroll-to-bottom:hover {\n                background: #2980b9;\n            }\n\n\n            .console-logger-content {\n                flex: 1;\n                overflow-y: auto;\n                padding: 10px;\n                background: #ffffff;\n                word-wrap: break-word;\n                text-align: left;\n            }\n\n            .console-logger-entry {\n                padding: 8px 10px;\n                margin-bottom: 3px;\n                border-radius: 4px;\n                font-size: 12px;\n                line-height: 1.4;\n                /*animation: consoleFadeIn 0.3s ease;*/\n                border-left: 3px solid transparent;\n            }\n\n            @keyframes consoleFadeIn {\n                from { opacity: 0; transform: translateY(5px); }\n                to { opacity: 1; transform: translateY(0); }\n            }\n\n            .console-logger-timestamp {\n                color: #7f8c8d;\n                font-size: 11px;\n                margin-right: 2px;\n            }\n\n            @media (max-width: 768px) {\n                .console-logger-container {\n                    right: 10px;\n                    bottom: 10px;\n                }\n\n                .console-logger-window {\n                    width: calc(100vw - 20px);\n                    height: 300px;\n                }\n            }\n            \n            .console-logger-message[data-type=\"json\"] {\n                white-space: pre-wrap; \n            }\n        </style>\n    ");
    const e = {
        base: {
            label: "信息",
            background: "#e8f4fd",
            borderLeftColor: "#3498db"
        },
        warn: {
            label: "警告",
            background: "#fef9e7",
            borderLeftColor: "#f39c12"
        },
        error: {
            label: "错误",
            background: "#fdedec",
            borderLeftColor: "#e74c3c"
        },
        debug: {
            label: "调试",
            background: "#f4f6f6",
            borderLeftColor: "#95a5a6"
        }
    }, t = {
        base: [ "base", "warn", "error" ],
        warn: [ "warn" ],
        error: [ "error" ],
        debug: [ "base", "warn", "error", "debug" ]
    }, n = await storageManager.getSetting("clogMsgCount", 2e3), a = "jhs_clog_maximize", i = "jhs_clog_expand", s = "jhs_clog_filter";
    class o {
        constructor() {
            const t = localStorage.getItem(s);
            this.currentFilter = t && e[t] ? t : "base", this.logs = [], this.isInitialized = !1,
            this.userScrolledUp = !1;
        }
        tryInitialize() {
            return "loading" !== document.readyState && (this.isInitialized || (this.init(),
            this.isInitialized = !0), !0);
        }
        init() {
            this.createContainer(), this.bindEvents(), this.checkInitialMaximizeState(), this.checkInitialCollapseState();
        }
        createContainer() {
            this.container = document.createElement("div"), this.container.className = "console-logger-container",
            this.container.style.display = "none", this.toggleBtn = document.createElement("div"),
            this.toggleBtn.className = "console-logger-toggle collapsed", this.container.appendChild(this.toggleBtn),
            this.window = document.createElement("div"), this.window.className = "console-logger-window collapsed";
            const t = document.createElement("div");
            t.className = "console-logger-header";
            const n = document.createElement("div");
            n.className = "console-logger-title", n.textContent = "JHS V3.6.0";
            const a = document.createElement("div");
            a.className = "console-logger-controls", this.maximizeBtn = document.createElement("button"),
            this.maximizeBtn.textContent = "", this.maximizeBtn.classList.add("console-logger-maximize-toggle"),
            a.appendChild(this.maximizeBtn);
            const i = document.createElement("button");
            i.textContent = "清空", i.addEventListener("click", (() => this.clear())), a.appendChild(i),
            t.appendChild(n), t.appendChild(a), this.filtersContainer = document.createElement("div"),
            this.filtersContainer.className = "console-logger-filters", this.filterButtonGroup = document.createElement("div"),
            this.filterButtonGroup.className = "console-logger-filter-group", this.filtersContainer.appendChild(this.filterButtonGroup),
            this.scrollToBottomBtn = document.createElement("button"), this.scrollToBottomBtn.className = "console-logger-scroll-to-bottom",
            this.scrollToBottomBtn.textContent = "到底部", this.filtersContainer.appendChild(this.scrollToBottomBtn),
            this.content = document.createElement("div"), this.content.className = "console-logger-content jhs-scrollbar",
            this.window.appendChild(t), this.window.appendChild(this.filtersContainer), this.window.appendChild(this.content),
            this.container.appendChild(this.window), document.body.appendChild(this.container),
            Object.keys(e).forEach((t => {
                const n = document.createElement("div");
                n.className = "console-logger-filter", t === this.currentFilter && n.classList.add("active"),
                n.textContent = e[t].label, n.dataset.type = t, n.addEventListener("click", (() => this.setFilter(t))),
                this.filterButtonGroup.appendChild(n);
            }));
        }
        bindEvents() {
            this.toggleBtn.addEventListener("click", (() => {
                this.toggleExpandCollapsed();
            })), this.maximizeBtn.addEventListener("click", (() => this.toggleMaximize())),
            this.scrollToBottomBtn.addEventListener("click", (() => {
                this.content.scrollTop = this.content.scrollHeight, this.userScrolledUp = !1;
            })), this.content.addEventListener("scroll", (() => {
                const e = this.content.scrollHeight - this.content.clientHeight <= this.content.scrollTop + 5;
                this.userScrolledUp = !e;
            })), this.content.addEventListener("wheel", (e => {
                const t = 0 === this.content.scrollTop, n = this.content.scrollHeight - this.content.clientHeight <= this.content.scrollTop + 1;
                (t && e.deltaY < 0 || n && e.deltaY > 0) && (e.preventDefault(), e.stopPropagation());
            }), {
                passive: !1
            });
        }
        toggleExpandCollapsed() {
            const e = this.window.classList.toggle("collapsed");
            this.toggleBtn.classList.toggle("collapsed"), e ? localStorage.setItem(i, "no") : (localStorage.setItem(i, "yes"),
            this.reRenderAllLogs());
        }
        checkInitialCollapseState() {
            const e = localStorage.getItem(i);
            e && "no" !== e ? (this.window.classList.toggle("collapsed"), this.toggleBtn.classList.toggle("collapsed"),
            setTimeout((() => {
                this.content.scrollTop = this.content.scrollHeight;
            }), 0)) : (this.window.classList.add("collapsed"), this.toggleBtn.classList.add("collapsed"));
        }
        checkInitialMaximizeState() {
            "maximized" === localStorage.getItem(a) && (this.window.classList.add("maximized"),
            this.maximizeBtn.classList.add("active"));
        }
        toggleMaximize() {
            const e = this.window.classList.toggle("maximized");
            this.maximizeBtn.classList.toggle("active", e), e ? localStorage.setItem(a, "maximized") : localStorage.setItem(a, "minimized"),
            this.window.classList.contains("collapsed") || (this.content.scrollTop = this.content.scrollHeight);
        }
        addLog(t, a = "base", ...i) {
            const s = this.tryInitialize();
            let o, r = [];
            e[a] ? (o = a, r = i) : (o = "base", r = [ a, ...i ]), o = e[o] ? o : "base";
            const l = [ t, ...r ];
            let c = "msg";
            const d = [];
            l.forEach((e => {
                if ("[object Error]" === Object.prototype.toString.call(e)) d.push(String(e)); else if ("object" == typeof e && null !== e) try {
                    d.push("<br/>" + JSON.stringify(e, null, 2)), c = "json";
                } catch (t) {
                    d.push(String(e)), c = "msg";
                } else d.push(String(e));
            }));
            let h = d.join("  ");
            h = h.replace(/(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi, (e => {
                const t = e.startsWith("http") || e.startsWith("ftp"), n = e.startsWith("//"), a = e.startsWith("www.");
                let i = e;
                return n ? i = `http:${e}` : !t && a && (i = `http://${e}`), `<a href="${i}" target="_blank">${e}</a>`;
            }));
            const g = {
                message: h,
                messageType: c,
                type: o,
                timestamp: new Date,
                id: Date.now() + Math.random()
            };
            if (this.logs.push(g), this.logs.length > n) {
                const e = this.logs[0];
                if (s) {
                    const t = this.content.querySelector(`.console-logger-entry[data-id="${e.id}"]`);
                    t && (this.logs.shift(), this.content.removeChild(t));
                }
            }
            s && this.renderLog(g);
        }
        log(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "base", ...n);
            }), 0);
        }
        error(...e) {
            const [t, ...n] = e;
            console.error(...e), setTimeout((() => {
                this.addLog(t, "error", ...n);
            }), 0);
        }
        warn(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "warn", ...n);
            }), 0);
        }
        debug(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "debug", ...n);
            }), 0);
        }
        renderLog(e) {
            if ("none" === this.container.style.display) return;
            if (this.window.classList.contains("collapsed")) return;
            if (!(t[this.currentFilter] || []).includes(e.type)) return;
            const n = this._createLogElement(e);
            this.content.appendChild(n), this.window.classList.contains("collapsed") || this.userScrolledUp || (this.content.scrollTop = this.content.scrollHeight);
        }
        reRenderAllLogs() {
            "none" !== this.container.style.display && (this.window.classList.contains("collapsed") || setTimeout((() => {
                if (this.content.innerHTML = "", 0 === this.logs.length) return;
                const e = t[this.currentFilter] || [], n = document.createDocumentFragment();
                this.logs.forEach((t => {
                    if (e.includes(t.type)) {
                        const e = this._createLogElement(t);
                        n.appendChild(e);
                    }
                })), this.content.appendChild(n), this.content.scrollTop = this.content.scrollHeight;
            }), 0));
        }
        _createLogElement(t) {
            const n = document.createElement("div");
            n.className = "console-logger-entry", n.dataset.type = t.type, n.dataset.id = t.id;
            const a = e[t.type] || e.base;
            n.style.borderLeft = "3px solid " + a.borderLeftColor, n.style.background = a.background;
            const i = (t.timestamp instanceof Date ? t.timestamp : new Date(t.timestamp)).toTimeString().split(" ")[0];
            return n.innerHTML = `\n                <span class="console-logger-timestamp">[${i}]</span>\n                <span class="console-logger-message" data-type="${t.messageType}">${t.message}</span>\n            `,
            n;
        }
        setFilter(e) {
            if (this.currentFilter === e) return;
            this.currentFilter = e, localStorage.setItem(s, e);
            this.filterButtonGroup.querySelectorAll(".console-logger-filter").forEach((t => {
                t.dataset.type === e ? t.classList.add("active") : t.classList.remove("active");
            })), this.reRenderAllLogs();
        }
        clear() {
            this.logs = [], this.content.innerHTML = "";
        }
        show() {
            (this.isInitialized && this.container || this.tryInitialize() && this.container) && (this.container.style.display = "",
            this.reRenderAllLogs());
        }
        hide() {
            this.isInitialized && this.container && (this.container.style.display = "none");
        }
        lowZIndex() {
            this.isInitialized && this.container && (this.container.style.zIndex = "12345678");
        }
        highZIndex() {
            this.isInitialized && this.container && (this.container.style.zIndex = "999999999");
        }
    }
    try {
        unsafeWindow.parent.clog && "function" == typeof unsafeWindow.parent.clog.log ? window.clog = unsafeWindow.clog = unsafeWindow.parent.clog : window.clog = unsafeWindow.clog = new o;
    } catch (r) {
        console.error("创建日志控制台出现异常", r), window.clog = unsafeWindow.clog = new o;
    }
    !function() {
        const e = window.clog || console;
        window.addEventListener("error", (function(t) {
            const n = t.filename, a = t.message;
            n.includes("javdb") || n.includes("javbus") || e.error(`[全局 Error 异常捕获] ${a} 来源: ${n}`);
        })), window.addEventListener("unhandledrejection", (function(t) {
            const n = t.reason, a = (null == n ? void 0 : n.message) ?? "";
            if (a.includes("play()")) return;
            if (a.includes("The element has no supported sources")) return show.error("播放失败, 请检查是否已对节点分流?"),
            void e.error("播放失败, 请检查是否已对节点分流?");
            if (a.includes("<span>1005</span>") && a.includes("fc2ppvdb")) return;
            const i = `[全局 Promise 异常捕获] ${n.message || n}`;
            e.error(i, n), t.preventDefault();
        }));
    }(), document.addEventListener("mousedown", (e => {
        const t = window.clog;
        if (!t.isInitialized || !t.container) return;
        const n = e.target, a = [ ".console-logger-container", ".layui-layer-shade", ".loading-container" ].join(",");
        n.closest(a) ? t.highZIndex() : t.lowZIndex();
    }));
}(), function() {
    function e(e, t, n) {
        const a = function(e) {
            const t = document.createElement("div");
            t.classList.add("js-tooltip");
            const n = document.createElement("div");
            return n.innerHTML = escapeHtml(e), t.appendChild(n), document.body.appendChild(t), t;
        }(t);
        a.style.display = "block";
        const i = e.getBoundingClientRect(), s = a.getBoundingClientRect();
        a.style.display = "none";
        const o = window.innerWidth, r = window.innerHeight;
        let l, c, d = n;
        const h = e => e >= 8 && e + s.height <= r - 8, g = e => e >= 8 && e + s.width <= o - 8, p = i.left + i.width / 2 - s.width / 2, m = i.top + i.height / 2 - s.height / 2;
        switch (n) {
          case "top":
            c = i.top - s.height - 0, c < 8 && h(i.bottom + 0) && (c = i.bottom + 0, d = "bottom");
            break;

          case "bottom":
            c = i.bottom + 0, c + s.height > r - 8 && h(i.top - s.height - 0) && (c = i.top - s.height - 0,
            d = "top");
            break;

          case "left":
            l = i.left - s.width - 0, l < 8 && g(i.right + 0) && (l = i.right + 0, d = "right");
            break;

          case "right":
            l = i.right + 0, l + s.width > o - 8 && g(i.left - s.width - 0) && (l = i.left - s.width - 0,
            d = "left");
        }
        const u = "left" === d || "right" === d;
        "top" === d || "bottom" === d ? (l = p, l < 8 ? l = 8 : l + s.width > o - 8 && (l = o - s.width - 8)) : u && (c = m,
        c < 8 ? c = 8 : c + s.height > r - 8 && (c = r - s.height - 8)), a.style.left = `${l}px`,
        a.style.top = `${c}px`, a.classList.add("is-active"), e.tooltipElement = a;
    }
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .js-tooltip {\n                /* 通用样式 */\n                position: fixed;\n                padding: 8px 12px; \n                border-radius: 6px; \n                white-space: normal;\n                max-width: 600px; \n                \n                pointer-events: none;\n                font-size: 14px;\n                line-height: 1.5;\n                z-index: 9999999999;\n                \n                background: #F0FDF4; \n                color: #166534;      \n                border: none; \n                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3); \n                \n                display: none; \n            }\n            .js-tooltip.is-active {\n                display: block !important;\n            }\n\n        </style>\n    ");
    const t = "[data-tip-top], [data-tip-bottom], [data-tip-left], [data-tip-right], [data-tip]";
    document.addEventListener("mouseover", (n => {
        const a = n.target.closest(t);
        if (a && !a.tooltipElement) {
            let t, n = "top";
            if (a.hasAttribute("data-tip-bottom") ? (t = a.getAttribute("data-tip-bottom"),
            n = "bottom") : a.hasAttribute("data-tip-left") ? (t = a.getAttribute("data-tip-left"),
            n = "left") : a.hasAttribute("data-tip-right") ? (t = a.getAttribute("data-tip-right"),
            n = "right") : a.hasAttribute("data-tip-top") ? (t = a.getAttribute("data-tip-top"),
            n = "top") : a.hasAttribute("data-tip") && (t = a.getAttribute("data-tip"), n = "top"),
            !t) return;
            a.hoverTimeout = setTimeout((() => {
                a.matches(":hover") && !a.tooltipElement && e(a, t, n);
            }), 50);
        }
    })), document.addEventListener("mouseout", (e => {
        const n = e.target.closest(t);
        var a;
        n && (n.hoverTimeout && (clearTimeout(n.hoverTimeout), n.hoverTimeout = null), n.contains(e.relatedTarget) || n.tooltipElement && ((a = n.tooltipElement) && a.parentNode && a.remove(),
        n.tooltipElement = null));
    }));
}();

class Y {
    constructor() {
        this.plugins = new Map;
    }
    register(e) {
        if ("function" != typeof e) throw new Error("插件必须是一个类");
        const t = new e;
        t.pluginManager = this;
        const n = t.getName();
        if (this.plugins.has(n)) throw new Error(`插件"${name}"已注册`);
        this.plugins.set(n, t);
    }
    getBean(e) {
        return this.plugins.get(e);
    }
    async processCss() {
        const e = (await Promise.allSettled(Array.from(this.plugins).map((async ([e, t]) => {
            try {
                if ("function" == typeof t.initCss) {
                    const n = await t.initCss();
                    return n && utils.insertStyle(n), {
                        name: e,
                        status: "fulfilled"
                    };
                }
                return {
                    name: e,
                    status: "skipped"
                };
            } catch (n) {
                return console.error(`插件 ${e} 加载 CSS 失败`, n), {
                    name: e,
                    status: "rejected",
                    error: n
                };
            }
        })))).filter((e => "rejected" === e.status));
        e.length && console.error("以下插件的 CSS 加载失败：", e.map((e => e.value.name)));
    }
    async processPlugins() {
        const e = (await Promise.allSettled(Array.from(this.plugins).map((async ([e, t]) => {
            try {
                if ("function" == typeof t.handle) return await t.handle(), {
                    name: e,
                    status: "fulfilled"
                };
            } catch (n) {
                return clog.error(`插件 ${e} 执行失败`, n), {
                    name: e,
                    status: "rejected",
                    error: n
                };
            }
        })))).filter((e => "rejected" === e.status));
        e.length && console.error("以下插件执行失败：", e.map((e => e.value.name)));
    }
}

class X {
    constructor() {
        i(this, "pluginManager", null), i(this, "settingSvg", '<svg t="1760926954860" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4947" width="200" height="200"><path d="M511.099222 365.825763c-80.7786 0-146.26579 65.482515-146.26579 146.259556 0 80.7786 65.48719 146.259556 146.26579 146.259556 80.777041 0 146.259556-65.480957 146.259556-146.259556C657.358779 431.308278 591.876263 365.825763 511.099222 365.825763L511.099222 365.825763zM511.099222 585.215097c-40.391637 0-73.136012-32.742816-73.136012-73.129778 0-40.391637 32.742816-73.129778 73.136012-73.129778 40.386962 0 73.129778 32.738141 73.129778 73.129778C584.229 552.472281 551.486184 585.215097 511.099222 585.215097L511.099222 585.215097zM511.099222 585.215097M900.893017 568.24369l-26.451395-15.268032c3.065451-27.021784 3.138697-54.472139 0.077922-81.822754l26.373473-15.225955c69.953678-40.391637 93.920921-129.844512 53.533959-199.799749-40.390079-69.95212-129.839837-93.925596-199.799749-53.533959l-26.373473 15.225955c-22.153219-16.330888-45.963059-29.99217-70.896534-40.843585l0-30.545416c0-80.777041-65.48719-146.259556-146.26579-146.259556-80.7786 0-146.259556 65.482515-146.259556 146.259556l0 30.515806c-12.377127 5.421811-24.587501 11.55583-36.562551 18.473743-11.97505 6.917913-23.396854 14.420242-34.277879 22.432179l-26.431136-15.258682c-69.958353-40.391637-159.406553-16.424395-199.79819 53.533959C27.378272 326.082437 51.343956 415.535311 121.299193 455.922273l26.449837 15.275825c-3.063892 27.020226-3.137139 54.465905-0.077922 81.822754l-26.373473 15.224397c-69.953678 40.391637-93.920921 129.841395-53.533959 199.799749 40.391637 69.95212 129.839837 93.920921 199.79819 53.533959l26.375032-15.224397c22.153219 16.32933 45.963059 29.984378 70.896534 40.843585l0 30.537624c0 80.7786 65.48719 146.26579 146.26579 146.26579 80.777041 0 146.259556-65.48719 146.259556-146.26579l0-30.515806c12.377127-5.415577 24.587501-11.55583 36.567226-18.467509 11.97505-6.917913 23.398412-14.420242 34.277879-22.432179l26.423343 15.258682c69.959912 40.391637 159.408111 16.418162 199.799749-53.533959C994.813938 698.085085 970.848254 608.635327 900.893017 568.24369L900.893017 568.24369zM891.096666 731.474653c-20.198936 34.982294-64.923035 46.962019-99.900654 26.770875l-63.331869-36.567226 0 0 0 0-7.988562-4.611422c-18.134004 18.450366-39.024886 34.787489-62.516805 48.353705-23.49971 13.559983-48.091888 23.482568-73.129778 29.964118l0 9.222846 0 0 0 65.828489 0 7.301289c0 40.391637-32.742816 73.136012-73.136012 73.136012-40.386962 0-73.129778-32.742816-73.129778-73.136012l0-7.402588 0-65.72719 0 0 0-9.300768c-50.682014-13.090892-97.855981-39.682547-135.652816-78.232109l-7.983886 4.606747 0 0-63.331869 36.567226c-34.977618 20.191144-79.706394 8.206743-99.900654-26.770875-20.192702-34.977618-8.206743-79.701718 26.770875-99.899095l6.341291-3.657657 0 0 64.972905-37.516316c-14.487254-52.005129-13.929333-106.151555 0.073247-156.593569l-8.057133-4.650384 0 0-63.331869-36.567226c-34.982294-20.192702-46.963578-64.923035-26.770875-99.900654 20.192702-34.97606 64.923035-46.962019 99.900654-26.763083l6.324148 3.649866 0 0 64.996282 37.528784c18.132445-18.450366 39.024886-34.790606 62.516805-48.353705 23.493477-13.559983 48.085654-23.485685 73.129778-29.964118l0-9.229079L437.960093 153.739276l0-7.309082c0-40.385404 32.742816-73.129778 73.129778-73.129778 40.391637 0 73.129778 32.744375 73.129778 73.129778l0 7.404147 0 65.72719 0 9.307001c50.686689 13.086217 97.862215 39.684106 135.657491 78.232109l48.487732-27.997368 22.828023-13.176607c34.977618-20.192702 79.701718-8.212977 99.89442 26.763083 20.198936 34.982294 8.212977 79.706394-26.764641 99.900654l-30.822819 17.79738-32.50905 18.769847 0 0 0 0-7.983886 4.605189c14.488813 52.009805 13.929333 106.159347-0.077922 156.599803l64.979139 37.511641 0 0 6.414537 3.701294C899.303409 651.772936 911.289368 696.498594 891.096666 731.474653L891.096666 731.474653zM891.096666 731.474653M197.330785 324.240361c-1.932465 3.232203-3.824411 6.497135-5.649343 9.785442L197.330785 324.240361 197.330785 324.240361zM197.330785 324.240361M830.515443 690.133926l-5.655577 9.804144C826.793889 696.699632 828.685835 693.433143 830.515443 690.133926L830.515443 690.133926zM830.515443 690.133926M505.297151 146.430195l11.304921 0C512.835324 146.369416 509.067017 146.374091 505.297151 146.430195L505.297151 146.430195zM505.297151 146.430195M516.898176 877.740444l-11.31583 0C509.350653 877.796547 513.125193 877.796547 516.898176 877.740444L516.898176 877.740444zM516.898176 877.740444" fill="#272636" p-id="4948"></path></svg>'),
        i(this, "editSvg", '<svg t="1760920692801" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3545" width="200" height="200"><path d="M1013.929675 128.26571a143.759824 143.759824 0 0 1 10.44409 53.858738 84.576649 84.576649 0 0 1-5.836403 30.308339 92.870485 92.870485 0 0 1-18.635533 29.284408 1314.726599 1314.726599 0 0 1-24.983901 24.574329c-7.372299 7.06512-13.82306 13.311095-19.249891 18.737926-6.143582 6.143582-12.082378 11.672806-17.406817 16.382886L720.266444 82.598415c9.317766-8.601015 20.478607-18.942712 33.277737-31.02509s23.448006-21.604931 31.946628-28.67005a102.085858 102.085858 0 0 1 68.193763-22.731255c11.263234 0.307179 22.116896 2.047861 32.560985 5.222045 10.546483 3.071791 19.659463 6.655547 27.441334 10.546483 16.280493 8.601015 34.301667 23.550399 54.063524 45.052936 19.864249 21.502538 35.120812 43.82422 46.076867 67.272226z m-907.20231 570.943576l32.560986-33.38013c17.099637-17.509209 38.397389-39.216533 64.098041-64.917186l84.986221-85.395793 94.303987-94.815953 250.350976-251.477299L850.817567 389.163169 600.46659 640.640468l-93.177663 94.815953c-31.02509 30.410732-58.978389 58.364031-83.859898 83.655111-24.779115 25.29108-45.360116 46.17926-61.743001 62.562146a504.797674 504.797674 0 0 1-55.804206 50.274981c-10.239304 7.884264-20.581 14.130239-31.537055 18.737926a507.152714 507.152714 0 0 1-47.715156 19.86425 1609.311367 1609.311367 0 0 1-131.063087 42.185931c-20.478607 5.426831-35.837563 8.908194-45.974474 10.546483-20.88818 2.35504-34.813633-0.819144-41.981145-9.42016-6.860333-8.601015-8.805801-22.93604-5.73401-43.312254a396.261054 396.261054 0 0 1 11.058448-47.305584c5.836403-20.683394 12.082378-42.185931 18.635532-64.40522 6.553154-22.219289 13.003916-42.697897 19.249891-61.435822 6.143582-18.635533 11.263234-31.537055 15.15417-38.602176 4.607687-10.853662 9.829732-20.785787 15.666135-29.796373a192.49891 192.49891 0 0 1 25.086294-29.796374z" fill="#FF9500" p-id="3546"></path></svg>'),
        i(this, "deleteSvg", '<svg t="1760921450746" class="jhs-icon icon" viewBox="0 0 1194 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4530" width="200" height="200"><path d="M761.086847 36.028779s309.754321-147.538628 424.952209 231.50509c2.047962 6.570546 71.337359 253.862013-220.838618 415.139055-12.970429 7.167869-267.515096 145.746661-370.339877 341.327076 0 0-90.963666-205.649563-393.379455-351.566888-6.399883-3.071944-304.549083-156.583796-163.751664-487.2444 3.669266-8.533177 163.666333-336.20717 466.423449-99.411511l24.575549 27.391498L387.931021 324.279495l237.648977 159.570408-109.139333 145.746661L625.579998 849.069874l-30.719437-205.820227 166.226286-169.81022-216.486698-168.103585L761.086847 36.028779z" fill="#F4382E" p-id="4531"></path></svg>'),
        i(this, "checkSvg", '<svg t="1760921633527" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5603" width="200" height="200"><path d="M924.928 544A413.76 413.76 0 0 1 544 924.736v3.264h-64v-3.2A413.696 413.696 0 0 1 99.072 544H96v-64h3.072A413.696 413.696 0 0 1 480 99.2V96h64v3.2a413.76 413.76 0 0 1 380.928 380.8h3.072v64h-3.072z m-64-64A350.016 350.016 0 0 0 544 163.2V288h-64V163.2A350.016 350.016 0 0 0 163.072 480H288v64H163.072A350.016 350.016 0 0 0 480 860.8V736h64v124.8a350.016 350.016 0 0 0 316.928-316.8H736v-64h124.928zM512 544a32 32 0 1 1 32-32 32 32 0 0 1-32 32z" fill="#333333" p-id="5604"></path></svg>'),
        i(this, "actressSvg", '<svg t="1760926744637" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1948" width="200" height="200"><path d="M265.950168 668.467036V209.809493A209.809493 209.809493 0 0 1 475.759661 0h40.949536A209.809493 209.809493 0 0 1 726.564189 209.809493v440.435" p-id="1949"></path><path d="M916.558657 825.861124a193.463804 193.463804 0 0 0-137.442564-155.83573l-186.001889-45.795231-10.487631-124.293214H424.106373L412.231008 624.025416l-170.623063 44.44162a193.452429 193.452429 0 0 0-133.666108 154.698244L76.410695 1023.192384h871.189985z" fill="#FFE7D9" p-id="1950"></path><path d="M668.472724 265.682859c68.431223-29.187919 96.140409 100.349111 5.20969 151.774902z" fill="#FFCFB5" p-id="1951"></path><path d="M676.378259 334.421203c1.137487-99.814492-38.674561-172.158671-38.674561-172.15867l-59.740822 11.920865a493.805894 493.805894 0 0 1-80.761583 9.099896 493.669396 493.669396 0 0 1-80.761583-9.099896l-59.683948-11.88674s-39.812048 72.344179-38.776934 172.15867l-1.080613 92.05683c5.209691 56.271486 92.4777 121.381247 195.022161 119.163147 61.196805 0.034125 165.59537-51.573665 165.59537-119.197272z" fill="#FFE7D9" p-id="1952"></path><path d="M322.198905 274.703131c-68.419848-29.187919-96.140409 100.349111-5.209691 151.774902z" fill="#FFCFB5" p-id="1953"></path><path d="M297.390311 812.461526H742.034014a38.458438 38.458438 0 0 1 38.458438 38.458439V1020.325917H258.931873V850.90859a38.458438 38.458438 0 0 1 38.458438-38.447064z" fill="#FFD527" p-id="1954"></path><path d="M690.539973 92.284327c-20.645391 84.287793-275.613121 235.323328-424.589805 117.525166l104.955934-95.548915 139.399042-64.529643z" p-id="1955"></path><path d="M285.321573 383.708519h33.624119v177.118114h-33.624119zM675.855015 383.708519h33.624118v177.118114h-33.624118z" fill="#FFD527" p-id="1956"></path></svg>'),
        i(this, "newSvg", '<svg t="1760926857487" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3954" width="200" height="200"><path d="M508.330667 733.994667c-11.008-7.338667-13.44-17.109333-7.338667-29.333334 28.117333-37.888 41.557333-98.986667 40.341333-183.317333v-165.013333c0-14.656 7.338667-23.210667 21.994667-25.664 37.888-1.216 82.496-5.504 133.845333-12.842667 13.44-2.432 21.376 3.072 23.829334 16.512 1.216 12.224-4.266667 19.562667-16.512 21.994667a1787.093333 1787.093333 0 0 1-113.664 11.008c-6.101333 0-9.173333 3.669333-9.173334 10.986666v84.330667h135.68c12.224 1.237333 18.944 7.957333 20.16 20.181333-1.216 10.986667-7.936 17.109333-20.16 18.346667h-36.672v223.658667c-1.216 12.202667-7.936 18.944-20.16 20.16-11.008-1.216-17.109333-7.957333-18.346666-20.16V501.162667h-60.48v18.346666c1.216 92.885333-13.44 161.92-44.010667 207.146667-6.101333 12.224-15.893333 14.677333-29.333333 7.338667z m-131.989334-282.325334c-1.237333 0-2.453333 0.618667-3.669333 1.834667h45.824a522.666667 522.666667 0 0 0 16.512-31.168c7.317333-12.224 12.224-20.778667 14.656-25.664 6.122667-11.008 15.274667-14.677333 27.52-11.008 9.770667 6.122667 12.202667 14.058667 7.317333 23.829333-4.906667 9.792-13.44 24.448-25.664 44.010667h49.493334c9.770667 1.216 15.274667 6.72 16.512 16.490667-1.237333 11.008-6.741333 17.109333-16.512 18.346666h-82.496a12.437333 12.437333 0 0 1 3.669333 9.173334v38.485333h69.653333c9.792 1.216 15.296 6.72 16.512 16.490667-1.216 11.008-6.72 17.130667-16.512 18.346666h-69.653333v108.16c0 34.218667-15.274667 51.946667-45.845333 53.162667h-16.490667a195.157333 195.157333 0 0 1-20.16 1.834667c-12.224 0-19.562667-6.72-22.016-20.16 1.237333-12.224 7.338667-18.944 18.346667-20.16 2.432 0 6.101333 0.597333 10.986666 1.834666h11.008c15.893333 0 23.829333-8.554667 23.829334-25.685333v-98.986667H314.026667c-11.008-1.216-17.109333-7.338667-18.346667-18.346666 1.237333-9.770667 7.338667-15.274667 18.346667-16.490667h75.157333V497.493333c0-3.669333 1.216-6.72 3.669333-9.173333h-89.813333c-11.029333-1.216-17.130667-7.317333-18.346667-18.325333 1.216-9.770667 7.317333-15.274667 18.346667-16.490667h56.810667c-3.669333-1.216-6.72-4.266667-9.173334-9.173333-1.216-1.216-3.050667-4.266667-5.482666-9.173334a758.336 758.336 0 0 0-14.677334-23.829333c-4.885333-9.770667-3.050667-17.706667 5.504-23.829333 11.008-3.669333 19.562667-1.216 25.664 7.338666 2.453333 2.432 6.122667 7.338667 11.008 14.656 6.101333 8.554667 9.770667 14.08 10.986667 16.512 4.906667 9.770667 2.453333 18.346667-7.317333 25.664z m-60.501333-71.509333c-9.792-1.216-15.274667-7.317333-16.512-18.346667 1.237333-9.749333 6.72-15.253333 16.512-16.490666h75.157333c-3.669333-12.202667-7.338667-21.973333-10.986666-29.333334-1.237333-12.202667 3.648-19.541333 14.656-21.973333 12.224-2.453333 21.397333 1.216 27.52 10.986667 0 1.216 0.597333 3.669333 1.813333 7.338666 4.906667 15.872 9.173333 26.88 12.842667 32.981334h60.48c11.008 1.237333 17.130667 6.741333 18.346666 16.512-1.216 11.008-7.338667 17.109333-18.346666 18.346666h-181.482667z m-14.677333 311.68c-8.533333-6.122667-10.986667-14.08-7.338667-23.829333a1659.648 1659.648 0 0 0 33.002667-66.005334c4.906667-9.792 12.224-12.842667 22.016-9.173333 9.770667 4.906667 13.44 12.224 10.986666 21.994667-3.669333 6.122667-9.173333 17.728-16.490666 34.837333-8.554667 15.893333-14.677333 27.52-18.346667 34.837333-4.885333 8.554667-12.821333 11.008-23.829333 7.338667z m201.664-25.664c-9.770667 4.885333-18.346667 2.432-25.664-7.338667a1138.56 1138.56 0 0 1-27.498667-44.010666c-4.885333-8.533333-3.050667-16.490667 5.504-23.829334 9.770667-3.669333 18.346667-1.216 25.664 7.338667l14.677333 21.994667c6.101333 9.770667 10.389333 17.109333 12.821334 21.994666 4.906667 8.554667 3.050667 16.512-5.504 23.850667z" fill="#333333" p-id="3955"></path><path d="M675.328 117.717333A425.429333 425.429333 0 0 0 512 85.333333C276.352 85.333333 85.333333 276.352 85.333333 512s191.018667 426.666667 426.666667 426.666667 426.666667-191.018667 426.666667-426.666667c0-56.746667-11.093333-112-32.384-163.328a21.333333 21.333333 0 0 0-39.402667 16.341333A382.762667 382.762667 0 0 1 896 512c0 212.074667-171.925333 384-384 384S128 724.074667 128 512 299.925333 128 512 128c51.114667 0 100.8 9.984 146.986667 29.12a21.333333 21.333333 0 0 0 16.341333-39.402667z" fill="#333333" p-id="3956"></path></svg>'),
        i(this, "refreshSvg", '<svg t="1760926993643" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5942" width="200" height="200"><path d="M511.966722 0a511.966722 511.966722 0 1 0 179.828311 32.445891l-22.46254 59.964102A447.970882 447.970882 0 1 1 511.966722 63.99584a31.99792 31.99792 0 0 0 0-63.99584z" fill="#333333" p-id="5943"></path><path d="M649.2378 9.151405A30.909991 30.909991 0 0 1 671.316364 0h193.267438a31.99792 31.99792 0 0 1 31.357962 31.99792c0 17.662852-13.759106 31.99792-31.357962 31.99792H703.954243v160.629559a31.99792 31.99792 0 0 1-31.99792 31.357962 31.485953 31.485953 0 0 1-31.99792-31.357962V31.357962c0-8.511447 3.647763-16.318939 9.343392-21.950573z" fill="#333333" p-id="5944"></path></svg>'),
        i(this, "blacklistSvg", '<svg t="1761386375897" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1936" width="200" height="200"><path d="M513.199827 65.667605c-246.537999 0-446.399933 199.861934-446.399933 446.399933 0 246.553349 199.861934 446.399933 446.399933 446.399933 246.553349 0 446.399933-199.846584 446.399933-446.399933C959.599759 265.529539 759.753175 65.667605 513.199827 65.667605zM513.199827 894.697075c-211.320916 0-382.629537-171.322947-382.629537-382.628514 0-94.183056 34.029024-180.417069 90.461291-247.080352l165.389818 165.389818c4.320399 39.651069 26.816762 73.840752 58.981323 94.068446-72.189136 27.369348-123.517151 97.156784-123.517151 178.936345l337.541643 0 100.846826 100.846826C693.608709 860.664981 607.375719 894.697075 513.199827 894.697075zM805.362956 759.14175 697.264982 651.0448c-16.556071-58.332547-60.10082-105.306394-116.275213-126.601396 35.888372-22.570042 59.752896-62.511729 59.752896-108.032482 0-70.436212-57.108672-127.542838-127.542838-127.542838-48.218188 0-90.184999 26.765597-111.865787 66.245773L266.120498 219.900316c66.663282-56.432267 152.897296-90.461291 247.079328-90.461291 211.304544 0 382.628514 171.308621 382.628514 382.629537C895.82834 606.244454 861.796246 692.476421 805.362956 759.14175z" fill="#272636" p-id="1937"></path></svg>'),
        i(this, "copySvg", '<svg t="1749017229420" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9184" width="200" height="200"><path d="M512 74.666667C270.933333 74.666667 74.666667 270.933333 74.666667 512S270.933333 949.333333 512 949.333333 949.333333 753.066667 949.333333 512 753.066667 74.666667 512 74.666667z m0 810.666666c-204.8 0-373.333333-168.533333-373.333333-373.333333S307.2 138.666667 512 138.666667 885.333333 307.2 885.333333 512 716.8 885.333333 512 885.333333z" fill="#666666" p-id="9185"></path><path d="M512 512m-42.666667 0a42.666667 42.666667 0 1 0 85.333334 0 42.666667 42.666667 0 1 0-85.333334 0Z" fill="#666666" p-id="9186"></path><path d="M341.333333 512m-42.666666 0a42.666667 42.666667 0 1 0 85.333333 0 42.666667 42.666667 0 1 0-85.333333 0Z" fill="#666666" p-id="9187"></path><path d="M682.666667 512m-42.666667 0a42.666667 42.666667 0 1 0 85.333333 0 42.666667 42.666667 0 1 0-85.333333 0Z" fill="#666666" p-id="9188"></path></svg>'),
        i(this, "titleSvg", '<svg t="1747553289744" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7507" width="200" height="200"><path d="M959.8 150.8c0-2.3-1.9-4.2-4.2-4.2H253.3c-2.3 0-4.2 1.9-4.2 4.2v115.9c0 2.3 1.9 4.2 4.2 4.2h702.3c2.3 0 4.2-1.9 4.2-4.2V150.8z" fill="" p-id="7508"></path><path d="M126.4 208.8m-62.2 0a62.2 62.2 0 1 0 124.4 0 62.2 62.2 0 1 0-124.4 0Z" fill="" p-id="7509"></path><path d="M851.5 453.7c0-2.1-1.8-3.9-3.9-3.9H252.9c-2.1 0-3.9 1.7-3.9 3.9v116.6c0 2.1 1.7 3.9 3.9 3.9h594.7c2.1 0 3.9-1.7 3.9-3.9V453.7z" fill="" p-id="7510"></path><path d="M126.4 512m-62.2 0a62.2 62.2 0 1 0 124.4 0 62.2 62.2 0 1 0-124.4 0Z" fill="" p-id="7511"></path><path d="M851.5 756.9c0-2.1-1.8-3.9-3.9-3.9H252.9c-2.1 0-3.9 1.8-3.9 3.9v116.6c0 2.1 1.7 3.9 3.9 3.9h594.7c2.1 0 3.9-1.7 3.9-3.9V756.9z" fill="" p-id="7512"></path><path d="M126.4 815.2m-62.2 0a62.2 62.2 0 1 0 124.4 0 62.2 62.2 0 1 0-124.4 0Z" fill="" p-id="7513"></path></svg>'),
        i(this, "carNumSvg", '<svg t="1747552574854" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3539" width="200" height="200"><path d="M920.337035 447.804932c-6.067182-6.067182-10.918677-11.643178-16.985859-17.71036l48.536436-30.334889-42.469254-109.207238-121.340579 12.134365c-6.067182-6.067182-6.067182-12.134365-12.134365-18.201547-12.134365-12.134365-18.201547-24.267706-24.267706-30.334889-24.26873-36.402071-30.334889-42.469254-54.603619-42.469254H339.116511c-18.201547 0-24.267706 6.067182-54.603619 42.469254-6.067182 6.067182-12.134365 18.201547-24.267706 30.334889 0 0-6.067182 6.067182-12.134365 18.201547l-115.27442-12.134365-48.536436 109.207238 51.090608 24.378223c-6.067182 6.067182-30.334889 34.660404-30.334889 34.660405l-15.542998 22.280446-12.282744 17.018605c-6.067182 12.134365-5.064342 10.868535-5.064342 29.070082v224.480635c0 36.402071 18.201547 60.670801 54.603618 60.670801h115.273397c36.402071 0 54.603619-24.267706 54.603619-54.603619v-18.201547h424.693562v18.201547c0 30.334889 18.201547 54.603619 54.603618 54.603619h115.273397c36.402071 0 60.670801-24.267706 60.670801-60.670801V539.300786c0-42.469254 0.685615-46.662763-11.44875-64.863287-4.731768-6.744611-11.94403-16.196891-20.101827-26.632567z m-35.186383-78.381161l-30.334889 18.201547-12.134365-12.134365c-6.067182-8.899694-12.134365-12.134365-12.134365-18.201547l42.469254-6.067183 12.134365 18.201548z m-533.899776-97.072873h339.755054l78.871325 103.140055H272.378527l78.872349-103.140055zM175.305655 357.290429h36.402071c-6.067182 6.067182-6.067182 12.134365-12.134365 18.201547l-18.201547 6.067183-18.201547-12.134365 12.135388-12.134365z m667.375743 394.35765h-54.603619V678.843936H242.043638v72.804143H132.837424V527.167444c0-12.134365-0.041956-20.662599 1.216711-23.556508 1.258667-2.89391 9.955746-16.924461 21.193695-29.173437l35.722596-38.276768h639.576607l21.917172 20.938891c6.067182 6.067182 21.847587 21.366633 25.712615 28.732392 7.621585 9.996678 6.973832 10.999518 13.041014 23.133883v242.682182h-48.536436zM242.043638 533.234627h133.474944v60.670801H242.043638v-60.670801z m412.559197 0h133.474944v60.670801H654.602835v-60.670801z" p-id="3540"></path></svg>'),
        i(this, "downSvg", '<svg t="1747552626242" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4551" width="200" height="200"><path d="M641.6 660l-8.64-64 32-4.32a211.2 211.2 0 0 0-26.72-420.32 215.36 215.36 0 0 0-213.12 192 94.56 94.56 0 0 0 0 11.52v41.28h-64V384v-7.04a153.12 153.12 0 0 1 0-19.52A279.84 279.84 0 0 1 636.16 108H640A275.2 275.2 0 0 1 673.28 656z" fill="#333333" p-id="4552"></path><path d="M490.4 446.24l-7.52-39.84a182.4 182.4 0 0 1 107.52-162.88l29.12-13.28L646.08 288l-29.12 13.28a117.92 117.92 0 0 0-70.08 101.28l6.24 30.4zM392.96 652.32h-78.72A202.24 202.24 0 0 1 256 256l30.72-9.12 18.24 61.28-30.72 9.12a138.24 138.24 0 0 0 39.68 270.72h78.72zM479.2 512h64v320h-64z" fill="#333333" p-id="4553"></path><path d="M510.4 908l-156.32-147.68 43.84-46.4 112.48 106.08 112.8-106.08 43.84 46.56-156.64 147.52z" fill="#333333" p-id="4554"></path></svg>'),
        i(this, "handleSvg", '<svg t="1749106236917" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2628" width="200" height="200"><path d="M838 989.48a32 32 0 0 1-22.5-9.22L519.3 687.6 207.48 980.8a32 32 0 0 1-54-23.32V136.52A98.54 98.54 0 0 1 252 38.1h519.6A98.52 98.52 0 0 1 870 136.52v820.96a32 32 0 0 1-32 32zM252 102.1a34.46 34.46 0 0 0-34.42 34.42v746.96L498 619.84a32 32 0 0 1 44.42 0.56L806 880.88V136.52a34.46 34.46 0 0 0-34.4-34.42z" p-id="2629"></path><path d="M648 604.92a28 28 0 0 1-16.46-5.34l-112.84-82-112.84 82a28 28 0 0 1-43.08-31.32l43.1-132.64-112.84-82a28 28 0 0 1 16.46-50.66h139.48L492 170.34a28 28 0 0 1 53.26 0l43.1 132.64h139.48a28 28 0 0 1 16.46 50.66l-112.84 82 43.1 132.64A28 28 0 0 1 648 604.92z m-129.3-150a27.86 27.86 0 0 1 16.46 5.36l59.58 43.28-22.76-70a28 28 0 0 1 10.02-31.28l59.58-43.3H568a28 28 0 0 1-26.64-19.34l-22.76-70-22.76 70a28 28 0 0 1-26.62 19.34h-73.64l59.58 43.3a28 28 0 0 1 10.16 31.3l-22.76 70 59.58-43.28a28 28 0 0 1 16.46-5.32z" p-id="2630"></path></svg>'),
        i(this, "siteSvg", '<svg t="1749107903569" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12439" width="200" height="200"><path d="M882.758621 133.674884C882.758621 59.84828 822.91034 0 749.083736 0 675.25715 0 615.40887 59.84828 615.40887 133.674884 615.40887 163.358402 625.152318 191.656395 642.813352 214.773283L670.872117 193.336726 648.314739 166.170836 253.911693 493.666092 276.469054 520.831982 302.371681 496.834595C277.256669 469.725608 241.995388 453.990153 204.295574 453.990153 130.46897 453.990153 70.62069 513.838433 70.62069 587.66502 70.62069 661.491624 130.46897 721.339904 204.295574 721.339904 255.555319 721.339904 301.619094 692.208675 324.036714 647.136344L276.646223 663.002394 706.082022 877.440106 721.856794 845.849335 690.37312 829.861888C680.932829 848.452414 675.940882 869.068818 675.940882 890.325116 675.940882 964.15172 735.789162 1024 809.615766 1024 883.442353 1024 943.290633 964.15172 943.290633 890.325116 943.290633 874.050807 940.36533 858.125365 934.723584 843.16446L868.645076 868.0826C871.294817 875.109252 872.669943 882.595452 872.669943 890.325116 872.669943 925.14899 844.439623 953.37931 809.615766 953.37931 774.791892 953.37931 746.561571 925.14899 746.561571 890.325116 746.561571 880.245089 748.902894 870.575616 753.340487 861.836782L769.436089 830.140063 737.631567 814.258564 308.195769 599.820853 276.554929 584.02108 260.805279 615.686903C250.212352 636.984797 228.494795 650.719214 204.295574 650.719214 169.4717 650.719214 141.241379 622.488894 141.241379 587.66502 141.241379 552.841163 169.4717 524.610842 204.295574 524.610842 222.12269 524.610842 238.680594 531.99985 250.566444 544.829369L273.29589 569.363385 299.026432 547.997855 693.429478 220.502616 719.514606 198.84265 698.930882 171.900169C690.596687 160.991373 686.029559 147.727007 686.029559 133.674884 686.029559 98.85101 714.25988 70.62069 749.083736 70.62069 783.90761 70.62069 812.137931 98.85101 812.137931 133.674884 812.137931 148.208022 807.249885 161.899255 798.379608 172.996785L853.543883 217.089695C872.331935 193.584128 882.758621 164.379366 882.758621 133.674884ZM749.083736 196.729062C729.149334 196.729062 710.818745 187.460449 698.930882 171.900169L642.813352 214.773283C667.922573 247.639305 706.904064 267.349751 749.083736 267.349751 790.225902 267.349751 828.357809 248.599782 853.543883 217.089695L798.379608 172.996785C786.455411 187.915034 768.530291 196.729062 749.083736 196.729062ZM337.970441 587.66502C337.970441 553.551854 325.093782 521.360666 302.371681 496.834595L250.566444 544.829369C261.309069 556.424898 267.349751 571.526356 267.349751 587.66502 267.349751 597.565263 265.091478 607.069184 260.805279 615.686903L324.036714 647.136344C333.156105 628.801148 337.970441 608.540036 337.970441 587.66502ZM809.615766 756.650249C758.753986 756.650249 712.986006 785.330865 690.37312 829.861888L753.340487 861.836782C764.027215 840.791658 785.603302 827.270938 809.615766 827.270938 836.08553 827.270938 859.461862 843.730308 868.645076 868.0826L934.723584 843.16446C915.252259 791.529949 865.714547 756.650249 809.615766 756.650249Z" fill="#389BFF" p-id="12440"></path></svg>'),
        i(this, "videoSvg", '<svg t="1749003664455" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1952" width="200" height="200"><path d="M825.6 153.6H198.4C124.5 153.6 64 214.1 64 288v448c0 73.9 60.5 134.4 134.4 134.4h627.2c73.9 0 134.4-60.5 134.4-134.4V288c0-73.9-60.5-134.4-134.4-134.4z m-138.2 44.8l112 112H706l-112-112h93.4z m-156.8 0l112 112H526.7l-112-112h115.9z m-179.2 0l112 112H347.5l-112-112h115.9zM108.8 288c0-41.4 28.4-76.1 66.7-86.3l108.7 108.7H108.8V288z m806.4 448c0 49.4-40.2 89.6-89.6 89.6H198.4c-49.4 0-89.6-40.2-89.6-89.6V355.2h806.4V736z m0-425.6h-52.5l-112-112h74.9c49.4 0 89.6 40.2 89.6 89.6v22.4z" p-id="1953"></path><path d="M454 687.2l149.3-77.6c27.5-13.8 27.5-53 0-66.8L468 472.2c-31.2-15.6-68 7.1-68 42v139.6c0 27.8 29.2 45.8 54 33.4zM444.8 512l134.4 67.2-134.4 67.2V512z" p-id="1954"></path></svg>'),
        i(this, "screenSvg", '<svg t="1750691468062" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2693" width="200" height="200"><path d="M288 160a64 64 0 0 0-64 64v576a64 64 0 0 0 64 64h448a64 64 0 0 0 64-64v-576a64 64 0 0 0-64-64h-448m0-64h448a128 128 0 0 1 128 128v576a128 128 0 0 1-128 128h-448a128 128 0 0 1-128-128v-576a128 128 0 0 1 128-128z" fill="#4078FD" p-id="2694"></path><path d="M416 352m-64 0a64 64 0 1 0 128 0 64 64 0 1 0-128 0Z" fill="#FE9C23" p-id="2695"></path><path d="M352 732.448a32 32 0 0 1-32-32v-160a32 32 0 0 1 44.224-29.568l130.112 53.632 153.952-169.984a32 32 0 0 1 55.712 21.472v284.448a32 32 0 0 1-32 32z m0-32h320z" fill="#4078FD" opacity=".2" p-id="2696"></path><path d="M672 416l-169.088 186.656-150.912-62.208v160h320V416m0-32a32 32 0 0 1 32 32v284.448a32 32 0 0 1-32 32h-320a32 32 0 0 1-32-32v-160a32 32 0 0 1 44.192-29.6l130.112 53.632 153.984-169.984a32 32 0 0 1 23.712-10.496z" fill="#4078FD" p-id="2697"></path></svg>'),
        i(this, "recoveryVideoSvg", '<svg t="1749003779161" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8204" width="200" height="200"><path d="M938.666667 553.92V768c0 64.8-52.533333 117.333333-117.333334 117.333333H202.666667c-64.8 0-117.333333-52.533333-117.333334-117.333333V256c0-64.8 52.533333-117.333333 117.333334-117.333333h618.666666c64.8 0 117.333333 52.533333 117.333334 117.333333v297.92z m-64-74.624V256a53.333333 53.333333 0 0 0-53.333334-53.333333H202.666667a53.333333 53.333333 0 0 0-53.333334 53.333333v344.48A290.090667 290.090667 0 0 1 192 597.333333a286.88 286.88 0 0 1 183.296 65.845334C427.029333 528.384 556.906667 437.333333 704 437.333333c65.706667 0 126.997333 16.778667 170.666667 41.962667z m0 82.24c-5.333333-8.32-21.130667-21.653333-43.648-32.917333C796.768 511.488 753.045333 501.333333 704 501.333333c-121.770667 0-229.130667 76.266667-270.432 188.693334-2.730667 7.445333-7.402667 20.32-13.994667 38.581333-7.68 21.301333-34.453333 28.106667-51.370666 13.056-16.437333-14.634667-28.554667-25.066667-36.138667-31.146667A222.890667 222.890667 0 0 0 192 661.333333c-14.464 0-28.725333 1.365333-42.666667 4.053334V768a53.333333 53.333333 0 0 0 53.333334 53.333333h618.666666a53.333333 53.333333 0 0 0 53.333334-53.333333V561.525333zM320 480a96 96 0 1 1 0-192 96 96 0 0 1 0 192z m0-64a32 32 0 1 0 0-64 32 32 0 0 0 0 64z" fill="#000000" p-id="8205"></path></svg>');
    }
    getName() {
        throw new Error(`${this.constructor.name} 未显示getName()`);
    }
    getBean(e) {
        return this.pluginManager.getBean(e);
    }
    async initCss() {
        return "";
    }
    async handle() {}
    getPageInfo() {
        let e, t, n, a, i, s = window.location.href;
        return r && (e = $('a[title="複製番號"]').attr("data-clipboard-text"), t = s.split("?")[0].split("#")[0],
        n = $(".female").prev().map(((e, t) => $(t).text())).get().join(" "), a = $(".male").prev().map(((e, t) => $(t).text())).get().join(" "),
        i = $('strong:contains("日期:")').parent(".panel-block").find(".value").text().trim()),
        l && (t = s.split("?")[0], e = t.split("/").filter(Boolean).pop().replace(/_\d{4}-\d{2}-\d{2}$/, ""),
        n = $('span[onmouseover*="star_"] a').map(((e, t) => $(t).text())).get().join(" "),
        a = "", i = $('span.header:contains("發行日期:")').parent("p").text().trim().replace("發行日期:", "").trim()),
        {
            carNum: e,
            url: t,
            actress: n,
            actors: a,
            publishTime: i
        };
    }
    getActressId() {
        const e = o.match(/\/actors\/([^/?]+)/);
        return e && e.length > 1 ? e[1] : null;
    }
    getActressPageInfo() {
        let e = window.location.href;
        if (!e.includes("/actors/") && !e.includes("/star/")) throw new Error("接口调用错误, 非演员详情页");
        let t = [], n = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
        n.length && n.text().trim().split(",").forEach((e => {
            t.push(e.trim());
        }));
        let a = $(".section-meta:not(:contains('影片'))");
        a.length && a.text().trim().split(",").forEach((e => {
            t.push(e.trim());
        }));
        let i = $(".section-meta:contains('男優')").length > 0 ? B : P, s = D;
        t.some((e => e.includes("無碼"))) && (s = A), e.includes("uncensored") && (s = A);
        let o = null, c = null;
        const d = new URL(e);
        if (r) {
            c = d.pathname.split("/").filter((e => "" !== e.trim())).pop();
            const e = d.searchParams;
            e.delete("sort_type"), e.delete("page"), o = d.toString();
        } else if (l) {
            const t = "/star/", n = e.split(t);
            if (n.length < 2) throw new Error("提取演员url失败");
            const a = n[0];
            c = n[1].split("/")[0], o = a + t + c;
        }
        return {
            starId: c,
            name: t[0],
            allName: t,
            role: i,
            movieType: s,
            blacklistUrl: o
        };
    }
    getSelector(e) {
        const t = e || (r ? T : l ? I : null), n = {
            javdb: {
                boxSelector: ".movie-list",
                itemSelector: ".movie-list .item",
                coverImgSelector: ".cover img",
                requestDomItemSelector: ".movie-list .item",
                nextPageSelector: ".pagination-next"
            },
            javbus: {
                boxSelector: ".masonry",
                itemSelector: ".masonry .item",
                coverImgSelector: ".masonry .movie-box .photo-frame img",
                requestDomItemSelector: "#waterfall .item",
                nextPageSelector: "#next"
            }
        };
        if (!t || !n[t]) throw new Error("类型错误: 无法确定选择器类型 (JavDb 或 JavBus)");
        return n[t];
    }
    parseMovieId(e) {
        return e.split("/").pop().split(/[?#]/)[0];
    }
    getBoxCarInfo(e) {
        var t, n, a;
        const i = e.find("a"), s = i.attr("href");
        let o = null, r = null, l = null;
        const c = e.find(".video-title");
        if (c.length > 0) {
            const n = c.find("strong");
            if (n.length > 0 && (o = n.text().trim()), r = null == (t = i.attr("title")) ? void 0 : t.trim(),
            !r) {
                const e = c.text().trim();
                r = o && e.includes(o) ? e.replace(o, "").trim() : e;
            }
            l = e.find(".meta").text().trim();
        }
        if (!o) {
            const t = e.find("img");
            t.length > 0 && (r = (null == (n = t.attr("title")) ? void 0 : n.trim()) || (null == (a = t.attr("data-title")) ? void 0 : a.trim()));
            const i = e.find("date").map(((e, t) => $(t).text().trim())).get(), s = e => /^\d{4}-\d{1,2}-\d{1,2}$/.test(e);
            l = i.find(s) || null, o = i.find((e => !s(e))) || null;
        }
        if (!o) {
            const t = "提取番号信息失败: carNum 为空";
            throw console.error("Error in getBoxCarInfo:", t, "Box Element:", e.get(0)), show.error(t),
            new Error(t);
        }
        return {
            carNum: o,
            url: s || "",
            title: r || "",
            publishTime: l || ""
        };
    }
    getBoxCarInfoList(e = null) {
        if (e || (e = $(this.getSelector().itemSelector)), 0 === e.length) return clog.error("获取当前列表页所有item的番号信息失败!"),
        [];
        const t = [];
        return e.each(((e, n) => {
            const a = $(n);
            try {
                const e = this.getBoxCarInfo(a);
                t.push(e);
            } catch (i) {
                clog.error("[getBoxCarInfoList] 提取单个 boxCar 信息失败:", i.message, "元素索引:", e);
            }
        })), t;
    }
    checkDuplicateCarNumbers(e, t) {
        if (!e || 0 === e.length || !t || 0 === t.length) return !1;
        const n = new Set(e.map((e => e.carNum)).filter((e => e)));
        if (0 === n.size) return !1;
        let a = 0;
        for (let i = 0; i < t.length; i++) {
            const e = t[i] ? t[i].carNum : null;
            if (e && n.has(e)) {
                if (a++, a >= 2) return clog.warn("警告: 检测到连续番号信息重复, 该类别可能已被限制页码。"), !0;
            } else a = 0;
        }
        return !1;
    }
}

class Q extends X {
    getName() {
        return "DetailPagePlugin";
    }
    constructor() {
        super();
    }
    handle() {
        window.isDetailPage && ($(".video-meta-panel a").each((function() {
            const e = $(this).attr("href");
            e && (e.startsWith("http://") || e.startsWith("https://") || e.startsWith("/")) && $(this).attr("target", "_blank");
        })));
    }
}

const Z = (e, t) => {
    if (!e || 0 === e.length) return null;
    const n = new Set(e);
    if (n.has(t)) return t;
    const a = L.map((e => e.quality)).reverse();
    for (const i of a) if (n.has(i)) return i;
    return e[0];
}, ee = "jhs_dmm_video";

class te {
    constructor(e, t = !0) {
        this.carNum = e, this.showErrorMessages = t;
    }
    _checkCache() {
        const e = localStorage.getItem(ee) ? JSON.parse(localStorage.getItem(ee)) : {};
        return e[this.carNum] ? (clog.debug("缓存中存在预览视频信息", e[this.carNum]), e[this.carNum]) : null;
    }
    _updateCache(e) {
        const t = localStorage.getItem(ee) ? JSON.parse(localStorage.getItem(ee)) : {};
        t[this.carNum] = e, clog.debug("成功解析出预览视频并已缓存:", e), localStorage.setItem(ee, JSON.stringify(t));
    }
    async _searchContentIds() {
        const e = this.carNum, t = e.replace(/-/g, ""), n = [ {
            keyword: e.replace("-", "00"),
            name: "00-替换关键词"
        }, {
            keyword: e,
            name: "原始番号关键词"
        }, {
            keyword: t,
            name: "无连字符关键词"
        } ], a = e.toLowerCase();
        for (const o of n) {
            const {keyword: e, name: n} = o, i = e.toLowerCase();
            clog.debug(`--- 尝试使用 ${n} (${e}) 进行 API 搜索 ---`);
            const r = `https://api.dmm.com/affiliate/v3/ItemList?${new URLSearchParams({
                api_id: "UrwskPfkqQ0DuVry2gYL",
                affiliate_id: "10278-996",
                output: "json",
                site: "FANZA",
                sort: "match",
                keyword: e
            }).toString()}`;
            let l;
            try {
                l = await gmHttp.get(r);
            } catch (s) {
                clog.error(`API 请求失败，跳过 ${n}:`, s);
                continue;
            }
            if (!l || !l.result || !l.result.result_count) {
                clog.debug("API 返回无结果，尝试下一个关键词。");
                continue;
            }
            const c = [];
            for (const s of l.result.items) {
                if (c.length >= 2) break;
                const e = s.content_id || "", o = s.maker_product || "";
                (e.includes(i.replace("-", "")) || a === o.toLowerCase() || e.includes(t.toLowerCase())) && (c.push({
                    serviceCode: s.service_code,
                    floorCode: s.floor_code,
                    contentId: e,
                    pageUrl: s.URL
                }), clog.debug(`[${n}] cid|makerProduct 匹配成功:`, e, o));
            }
            if (c.length > 0) {
                clog.debug(`--- 成功通过 ${n} 找到 Content IDs ---`);
                const t = $("#fanzaBtn");
                let a = `https://www.dmm.co.jp/search/=/searchstr=${e}`, i = "single";
                c.length > 1 ? (t.attr("href", a), t.append('<span class="site-tag" style="top:-15px">多结果</span>'),
                t.css("backgroundColor", "#7bc73b"), i = "multiple") : (a = c[0].pageUrl, t.attr("href", a),
                t.css("backgroundColor", "#7bc73b"));
                const s = "jhs_other_site_dmm", o = localStorage.getItem(s) ? JSON.parse(localStorage.getItem(s)) : {};
                return o[this.carNum] = {
                    type: i,
                    url: a
                }, localStorage.setItem(s, JSON.stringify(o)), c;
            }
            clog.debug(`[${n}] API 返回结果数 ${l.result.result_count}，但无精确匹配的 Content ID。`);
        }
        clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
        const i = $("#fanzaBtn");
        return i.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
        i.attr("title", "未查询到, 点击前往搜索页"), i.css("backgroundColor", "#de3333"), null;
    }
    async _extractTrailerLinks({contentId: e, serviceCode: t, floorCode: n}) {
        const a = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${e}/mtype=AhRVShI_/service=${t}/floor=${n}/mode=/`, i = await gmHttp.get(a, null, {
            "accept-language": "ja-JP,ja;q=0.9",
            Cookie: "age_check_done=1"
        });
        if ("string" != typeof i) throw clog.error(i), new Error("解析播放页内容失败, 非文本内容");
        if (i.includes("このサービスはお住まいの地域からは")) throw new Error("节点不可用，请将DMM域名分流到日本ip");
        const s = i.match(/const\s+args\s+=\s+(.*);/);
        if (!s) throw new Error("未在脚本中找到 const args = ... 变量");
        let o;
        try {
            ({bitrates: o} = JSON.parse(s[1]));
        } catch (d) {
            throw new Error(`解析播放器脚本 JSON 失败: ${d.message}`);
        }
        const r = {}, l = L.map((e => e.quality)).join("|"), c = new RegExp(`(${l})\\.mp4$`);
        if (!Array.isArray(o)) throw clog.error("解析画质链接失败: bitrates 字段不是一个数组或不存在"), new Error("解析画质链接失败: bitrates 字段不是一个数组或不存在");
        clog.debug("原始数据返回:", o);
        for (const h of o) {
            const e = null == h ? void 0 : h.src;
            if (!e || "string" != typeof e || !e.endsWith(".mp4")) continue;
            const t = e.match(c);
            let n = "";
            t && t[1] && (n = t[1]), n && !r[n] && (r[n] = e);
        }
        if (0 === Object.keys(r).length) throw new Error("未找到匹配要求的预览画质视频");
        return r;
    }
    async fetchVideo() {
        const e = this._checkCache();
        if (e) return e;
        let t;
        try {
            const e = this.carNum.toLowerCase();
            if (e.startsWith("heyzo") || /^(n\d+|\d+(-\d+)*)$/.test(e) || /^n\d+$/.test(e)) throw new Error("无码番号类型, 取消dmm解析");
            if (this.carNum.includes("VR-")) throw new Error("VR类型, 取消dmm解析");
            t = await this._searchContentIds();
        } catch (n) {
            clog.error("DMM API 搜索失败:", n);
            const e = $("#fanzaBtn");
            return e.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
            e.attr("title", "未查询到, 点击前往搜索页"), e.css("backgroundColor", "#de3333"), null;
        }
        if (!t || 0 === t.length) return null;
        try {
            const e = await Promise.any(t.map((e => this._extractTrailerLinks(e))));
            return this._updateCache(e), e;
        } catch (a) {
            const e = a.errors || [ a ];
            if (e.some((e => e.message.includes("节点不可用")))) this.showErrorMessages && show.error("节点不可用，请将DMM域名分流到日本ip"); else {
                const t = e[0].message || e[0];
                clog.error(`解析失败: ${t}`, e), this.showErrorMessages && show.error(`解析失败: ${t}`);
            }
            const t = $("#fanzaBtn");
            return t.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
            t.attr("title", "未查询到, 点击前往搜索页"), t.css("backgroundColor", "#de3333"), null;
        }
    }
}

const ne = async (e, t = !0) => new te(e, t).fetchVideo();

class ae extends X {
    getName() {
        return "PreviewVideoPlugin";
    }
    async initCss() {
        return "\n            .video-control-btn {\n                min-width:120px;\n                padding: 7px 12px;\n                font-size: 12px;\n                background: rgba(0,0,0,0.7);\n                color: white;\n                border: none;\n                border-radius: 4px;\n                cursor: pointer;\n            }\n            .video-control-btn.active {\n                background-color: #1890ff;\n                color: white;\n                font-weight: bold;\n                border: 2px solid #096dd9;\n            }\n        ";
    }
    async handle() {
        if (!isDetailPage) return;
        let e = await storageManager.getSetting();
        this.filterHotKey = e.filterHotKey, this.favoriteHotKey = e.favoriteHotKey, this.speedVideoHotKey = e.speedVideoHotKey;
        let t = $(".preview-video-container");
        t.on("click", (e => {
            utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
                this.handleVideo().then();
            }));
        }));
        await storageManager.getSetting("enableLoadPreviewVideo", _) !== _ || o.includes("autoPlay=1") || this.initDmm().then();
        let n = window.location.href;
        (n.includes("gallery-1") || n.includes("gallery-2")) && utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
            $(".fancybox-content #preview-video").length > 0 && this.handleVideo().then();
        })), n.includes("autoPlay=1") && t.length > 0 && t[0].click();
    }
    async initDmm() {
        try {
            const e = await ne(this.getPageInfo().carNum, !1);
            if (!e) return;
            let t = await storageManager.getSetting("videoQuality");
            clog.debug("解析其它画质预览视频", "设置-期望画质", t);
            const n = e[Z(Object.keys(e), t)];
            clog.log("切换其它画质预览视频: ", n);
            const a = $("#preview-video"), i = a.length ? a[0] : null, s = !i || utils.isHidden(a);
            if (a.length) {
                if (i) {
                    const e = i.currentTime;
                    a.attr("src", n), s || (clog.debug("播放器已手动打开, 变更进度条"), i.currentTime = e, i.play());
                }
            } else {
                clog.debug("JavDB没有视频播放元素, 开始创建...");
                const e = $(".column-video-cover img").attr("src");
                $(".preview-images").prepend(`\n                    <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">\n                        <span>預告片</span>\n                        <img src="${e}" class="video-cover" style="width: 150px; height: auto;" alt="">\n                    </a>\n                `);
                $(".preview-video-container").on("click", (e => {
                    utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (async () => {
                        await this.handleVideo();
                    }));
                }));
            }
        } catch (e) {
            clog.error("预加载dmm失败:", e);
        }
    }
    async handleVideo() {
        if (await storageManager.getSetting("enableLoadPreviewVideo", _) === C) return;
        const e = $("#preview-video");
        if (!e.length) return;
        const t = e.parent();
        t.css("position", "relative");
        const n = e[0], a = localStorage.getItem("jhs_videoMuted");
        a && (n.muted = "yes" === a), n.addEventListener("volumechange", (function() {
            localStorage.setItem("jhs_videoMuted", n.muted ? "yes" : "no");
        })), n.play();
        let i = this.getPageInfo().carNum;
        const s = await ne(i);
        let o = $("<div></div>").attr("id", "video-bottom-toolbar").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
            "flex-wrap": "wrap"
        }), r = $("<div></div>").css({
            display: "flex",
            gap: "5px",
            "align-items": "center"
        }), l = null;
        if (s) {
            let t = await storageManager.getSetting("videoQuality");
            l = Z(Object.keys(s), t);
            let a = s[l];
            e.attr("src") !== a && (e.attr("src", a), n.load(), n.play()), L.forEach((e => {
                let t = s[e.quality];
                if (t) {
                    const n = l === e.quality;
                    let a = $(`\n                    <button class="video-control-btn${n ? " active" : ""}" \n                            id="${e.id}" \n                            data-quality="${e.quality}"\n                            data-video-src="${t}"\n                            style="min-width: 40px; border: 1px solid #ccc; background-color: ${n ? "#007bff" : "#fff"}; color: ${n ? "white" : "black"};">\n                        ${e.text}\n                    </button>\n                `);
                    r.append(a);
                }
            }));
        }
        o.append(r);
        let c = $("<div></div>").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
            "margin-left": "auto"
        }), d = $(`<button class="menu-btn" id="video-filterBtn" style="min-width: 120px; background-color:#de3333;">屏蔽 ${this.filterHotKey ? "(" + this.filterHotKey + ")" : ""}</button>`);
        c.append(d);
        let h = $(`<button class="menu-btn" id="video-favoriteBtn" style="min-width: 120px; background-color:#25b1dc;">收藏 ${this.favoriteHotKey ? "(" + this.favoriteHotKey + ")" : ""}</button>`);
        c.append(h);
        let g = $(`<button class="menu-btn" id="speed-btn" style="min-width: 120px; background-color:#76b45d;">快进 ${this.speedVideoHotKey ? "(" + this.speedVideoHotKey + ")" : ""}</button>`);
        c.append(g), o.append(c), t.append(o), o.on("click", ".video-control-btn", (async t => {
            const a = $(t.currentTarget), i = a.data("video-src");
            if (!a.hasClass("active")) try {
                const t = n.currentTime;
                e.attr("src", i), n.load(), n.currentTime = t, await n.play(), o.find(".video-control-btn").removeClass("active").css({
                    "background-color": "#fff",
                    color: "black"
                }), a.addClass("active").css({
                    "background-color": "#007bff",
                    color: "white"
                });
            } catch (s) {
                console.error("切换画质失败:", s);
            }
        })), $("#speed-btn").on("click", (() => {
            this.getBean("DetailPageButtonPlugin").speedVideo();
        })), utils.rightClick(document.body, "#speed-btn", (e => {
            this.getBean("DetailPageButtonPlugin").filterOne(e);
        })), $("#video-filterBtn").on("click", (e => {
            this.getBean("DetailPageButtonPlugin").filterOne(e);
        })), $("#video-favoriteBtn").on("click", (e => {
            this.getBean("DetailPageButtonPlugin").favoriteOne(e);
        }));
    }
}

const ie = class e {
    constructor() {
        if (new.target === e) throw new Error("HotkeyManager cannot be instantiated.");
    }
    static registerHotkey(e, t, n = null) {
        if (Array.isArray(e)) {
            let a = [];
            return e.forEach((e => {
                if (!this.isHotkeyFormat(e)) throw new Error("快捷键格式错误");
                let i = this.recordHotkey(e, t, n);
                a.push(i);
            })), a;
        }
        if (!this.isHotkeyFormat(e)) throw new Error("快捷键格式错误");
        return this.recordHotkey(e, t, n);
    }
    static recordHotkey(e, t, n) {
        let a = Math.random().toString(36).substr(2);
        return this.registerHotKeyMap.set(a, {
            hotkeyString: e,
            callback: t,
            keyupCallback: n
        }), a;
    }
    static unregisterHotkey(e) {
        this.registerHotKeyMap.has(e) && this.registerHotKeyMap.delete(e);
    }
    static isHotkeyFormat(e) {
        return e.toLowerCase().split("+").map((e => e.trim())).every((e => [ "ctrl", "shift", "alt" ].includes(e) || 1 === e.length));
    }
    static judgeHotkey(e, t) {
        const n = e.toLowerCase().split("+").map((e => e.trim())), a = n.includes("ctrl"), i = n.includes("shift"), s = n.includes("alt"), o = n.find((e => "ctrl" !== e && "shift" !== e && "alt" !== e));
        return (this.isMac ? t.metaKey : t.ctrlKey) === a && t.shiftKey === i && t.altKey === s && t.key.toLowerCase() === o;
    }
};

i(ie, "isMac", 0 === navigator.platform.indexOf("Mac")), i(ie, "registerHotKeyMap", new Map),
i(ie, "handleKeydown", (e => {
    for (const [t, n] of ie.registerHotKeyMap) {
        let t = n.hotkeyString, a = n.callback;
        ie.judgeHotkey(t, e) && a(e);
    }
})), i(ie, "handleKeyup", (e => {
    for (const [t, n] of ie.registerHotKeyMap) {
        let t = n.hotkeyString, a = n.keyupCallback;
        a && (ie.judgeHotkey(t, e) && a(e));
    }
}));

let se = ie;

document.addEventListener("keydown", (e => {
    se.handleKeydown(e);
})), document.addEventListener("keyup", (e => {
    se.handleKeyup(e);
}));

class oe extends X {
    getName() {
        return "JavTrailersPlugin";
    }
    constructor() {
        super(), this.hasBand = !1;
    }
    handle() {
        let e = window.location.href;
        if (!e.includes("handle=1")) return;
        if ($("h1:contains('Page not found')").length) {
            clog.log("番号无法匹配, 跳搜索");
            let t = e.split("?")[0].split("video/")[1].toLowerCase().replace("00", "-");
            return void (window.location.href = "/search/" + encodeURIComponent(t) + window.location.search);
        }
        let t = $(".videos-list .video-link").toArray();
        if (t.length) {
            const n = e.split("?")[0].split("search/")[1].toLowerCase(), a = t.find((e => $(e).find(".vid-title").text().toLowerCase().includes(n)));
            if (a) return void (window.location.href = $(a).attr("href") + window.location.search);
        }
        this.handlePlayJavTrailers(), $("#videoPlayerContainer").on("click", (() => {
            this.handlePlayJavTrailers();
        })), window.addEventListener("message", (e => {
            let t = document.getElementById("vjs_video_3_html5_api");
            t && (t.currentTime += 5);
        }));
        const n = new URLSearchParams(window.location.search), a = n.get("filterHotKey"), i = n.get("favoriteHotKey"), s = n.get("speedVideoHotKey");
        a && se.registerHotkey(a, (() => window.parent.postMessage(a, "*"))), i && se.registerHotkey(i, (() => window.parent.postMessage(i, "*"))),
        s && se.registerHotkey(s, (() => {
            const e = document.getElementById("vjs_video_3_html5_api");
            e && (e.currentTime += 5);
        }));
    }
    handlePlayJavTrailers() {
        this.hasBand || (utils.loopDetector((() => 0 !== $("#vjs_video_3_html5_api").length), (() => {
            setTimeout((() => {
                this.hasBand = !0;
                let e = document.getElementById("vjs_video_3_html5_api");
                clog.debug(e), e.play(), e.currentTime = 5, e.addEventListener("timeupdate", (function() {
                    e.currentTime >= 14 && e.currentTime < 16 && (e.currentTime += 2);
                })), $("#vjs_video_3_html5_api").css({
                    position: "fixed",
                    width: "100vw",
                    height: "100vh",
                    objectFit: "cover",
                    zIndex: "999999999"
                }), $(".vjs-control-bar").css({
                    position: "fixed",
                    bottom: "20px",
                    zIndex: "999999999"
                });
            }), 100);
        })), utils.loopDetector((() => $("#vjs_video_3 canvas").length > 0), (() => {
            0 !== $("#vjs_video_3 canvas").length && $("#vjs_video_3 canvas").css({
                position: "fixed",
                width: "100vw",
                height: "100vh",
                objectFit: "cover",
                top: "0",
                right: "0",
                zIndex: "999999998"
            });
        })));
    }
}

class re extends X {
    getName() {
        return "SubTitleCatPlugin";
    }
    handle() {
        $(".t-banner-inner").hide(), $("#navbar").hide();
        let e = new URLSearchParams(window.location.search).get("search").toLowerCase(), t = $(".sub-table tr td a").toArray(), n = 0;
        t.forEach((t => {
            let a = $(t);
            a.text().toLowerCase().includes(e) ? n++ : a.parent().parent().hide();
        })), 0 === n && show.error("该番号无字幕!");
        const a = $(".sec-title"), i = a.html().replace(/^\d+/, n);
        a.html(i);
    }
}

class le extends X {
    getName() {
        return "Fc2Plugin";
    }
    async initCss() {
        return "\n            <style>\n                /* 弹层样式 */\n                .movie-detail-layer .layui-layer-title {\n                    font-size: 18px;\n                    color: #333;\n                    background: #f8f8f8;\n                }\n                \n                \n                /* 容器样式 */\n                .movie-detail-container {\n                    margin: 40px;\n                    height: 100%;\n                    background: #fff;\n                }\n                \n                .movie-poster-container {\n                    flex: 0 0 60%;\n                    padding: 15px;\n                }\n                \n                .right-box {\n                    flex: 1;\n                    padding: 20px;\n                    overflow-y: auto;\n                }\n                \n                /* 预告片iframe */\n                .movie-trailer {\n                    width: 100%;\n                    height: 100%;\n                    min-height: 400px;\n                    background: #000;\n                    border-radius: 4px;\n                }\n                \n                /* 电影信息样式 */\n                .movie-title {\n                    font-size: 24px;\n                    margin-bottom: 15px;\n                    color: #333;\n                }\n                \n                .movie-meta {\n                    margin-bottom: 20px;\n                    color: #666;\n                }\n                \n                .movie-meta span {\n                    margin-right: 15px;\n                }\n                \n                /* 演员列表 */\n                .actor-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 8px;\n                    margin-top: 10px;\n                }\n                \n                .actor-tag {\n                    padding: 4px 12px;\n                    background: #f0f0f0;\n                    border-radius: 15px;\n                    font-size: 12px;\n                    color: #555;\n                }\n                \n                /* 图片列表 */\n                .image-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 10px;\n                }\n                \n                .movie-image-thumb {\n                    width: 120px;\n                    height: 80px;\n                    object-fit: cover;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    transition: transform 0.3s;\n                }\n                \n                .movie-image-thumb:hover {\n                    transform: scale(1.05);\n                }\n                \n                /* 加载中和错误状态 */\n                .search-loading, .movie-error {\n                    padding: 40px;\n                    text-align: center;\n                    color: #999;\n                }\n                \n                .movie-error {\n                    color: #f56c6c;\n                }\n                \n                .fancybox-container{\n                    z-index:99999999\n                 }\n                 \n                 \n                 /* 错误提示样式 */\n                .movie-not-found, .movie-error {\n                    text-align: center;\n                    padding: 30px;\n                    color: #666;\n                }\n                \n                .movie-not-found h3, .movie-error h3 {\n                    color: #f56c6c;\n                    margin: 15px 0;\n                }\n                \n                .icon-warning, .icon-error {\n                    font-size: 50px;\n                    color: #e6a23c;\n                }\n                \n                .icon-error {\n                    color: #f56c6c;\n                }\n                \n                .fc2-movie-panel-info .panel-block {\n                    padding: 0 !important;\n                }\n            </style>\n        ";
    }
    handle() {
        let e = "/advanced_search?type=3&score_min=0&d=1";
        if ($('.navbar-item:contains("FC2")').attr("href", e), $('.tabs a:contains("FC2")').attr("href", e),
        o.includes("advanced_search?type=3")) {
            $("h2.section-title").contents().first().replaceWith("Fc2PPV"), $(".section .container > .box").remove();
        }
        if (o.includes("collection_codes?movieId")) {
            $("section").html("");
            const e = new URLSearchParams(window.location.search);
            let t = e.get("movieId"), n = e.get("carNum"), a = e.get("url");
            t && n && a && this.openFc2Dialog(t, n, a);
        }
    }
    openFc2Dialog(e, t, n) {
        let a = t.replace("FC2-", "");
        if (n.includes("123av")) return void this.getBean("Fc2By123AvPlugin").open123AvFc2Dialog(t, n);
        let i = `\n            <div class="movie-detail-container">\n                \x3c!--<div class="movie-poster-container">\n                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>\n                </div>--\x3e\n               \x3c!-- <div class="right-box">--\x3e\n                    <div class="movie-info-container">\n                        <div class="search-loading">加载中...</div>\n                    </div>\n                    \n                    <div class="movie-panel-info fc2-movie-panel-info" style="margin-top:20px"><strong>第三方资源: </strong></div>\n                    \n                    <div style="margin: 30px 0">\n                        <a id="filterBtn" class="menu-btn" style="background-color:${f}"><span>${m}</span></a>\n                        <a id="favoriteBtn" class="menu-btn" style="background-color:${w}"><span>${v}</span></a>\n                        <a id="hasDownBtn" class="menu-btn" style="background-color:${x}"><span>${y}</span></a>\n                        <a id="hasWatchBtn" class="menu-btn" style="background-color:${S};"><span>${k}</span></a>\n                        \n                        <a id="search-subtitle-btn" class="menu-btn fr-btn" style="background:linear-gradient(to bottom, #8d5656, rgb(196,159,91))">\n                            <span>字幕 (SubTitleCat)</span>\n                        </a>\n                        <a id="xunLeiSubtitleBtn" class="menu-btn fr-btn" style="background:linear-gradient(to left, #375f7c, #2196F3)">\n                            <span>字幕 (迅雷)</span>\n                        </a>\n                        <a id="magnetSearchBtn" class="menu-btn fr-btn" style="width: 120px; background: linear-gradient(to right, rgb(245,140,1), rgb(84,161,29)); color: white; text-align: center; padding: 8px 0;">\n                            <span>磁力搜索</span>\n                        </a>\n                    </div>\n                    <div class="message video-panel" style="margin-top:20px">\n                        <div id="magnets-content" class="magnet-links" style="margin: 0 0.75rem">\n                            <div class="search-loading">加载中...</div>\n                        </div>\n                    </div>\n                    <div id="reviews-content">\n                    </div>\n                    <div id="related-content">\n                    </div>\n                    <span id="data-actress" style="display: none"></span>\n                \x3c!--</div>--\x3e\n            </div>\n        `;
        layer.open({
            type: 1,
            title: t,
            content: i,
            area: utils.getResponsiveArea([ "70%", "90%" ]),
            skin: "movie-detail-layer",
            scrollbar: !1,
            success: (i, s) => {
                this.loadData(e, t), $("#favoriteBtn").on("click", (async e => {
                    const a = $("#data-actress").text(), i = $("#data-releaseDate").text();
                    await storageManager.saveCar({
                        carNum: t,
                        url: n,
                        names: a,
                        actionType: h,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#filterBtn").on("click", (e => {
                    utils.q(e, `是否屏蔽${t}?`, (async () => {
                        const e = $("#data-actress").text(), a = $("#data-releaseDate").text();
                        await storageManager.saveCar({
                            carNum: t,
                            url: n,
                            names: e,
                            actionType: d,
                            publishTime: a
                        }), window.refresh(), layer.closeAll(), window.location.href.includes("collection_codes?movieId") && utils.closePage();
                    }));
                })), $("#hasDownBtn").on("click", (async e => {
                    const a = $("#data-actress").text(), i = $("#data-releaseDate").text();
                    await storageManager.saveCar({
                        carNum: t,
                        url: n,
                        names: a,
                        actionType: g,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#hasWatchBtn").on("click", (async e => {
                    const a = $("#data-actress").text(), i = $("#data-releaseDate").text();
                    await storageManager.saveCar({
                        carNum: t,
                        url: n,
                        names: a,
                        actionType: p,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#search-subtitle-btn").on("click", (e => utils.openPage(`https://subtitlecat.com/index.php?search=${t}`, t, !1, e))),
                $("#xunLeiSubtitleBtn").on("click", (() => this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(t))),
                $("#magnetSearchBtn").on("click", (() => {
                    let e = this.getBean("MagnetHubPlugin").createMagnetHub(t);
                    layer.open({
                        type: 1,
                        title: "磁力搜索",
                        content: '<div id="magnetHubBox"></div>',
                        area: utils.getResponsiveArea([ "60%", "80%" ]),
                        scrollbar: !1,
                        success: () => {
                            $("#magnetHubBox").append(e);
                        }
                    });
                })), this.getBean("OtherSitePlugin").loadOtherSite(a, t).then(), utils.setupEscClose(s);
            },
            end() {
                window.location.href.includes("collection_codes?movieId") && utils.closePage();
            }
        });
    }
    loadData(e, t) {
        let n = t.replace("FC2-", "");
        this.handleMovieDetail(e), this.handleLongImg(n), this.handleMagnets(e);
        this.getBean("ReviewPlugin").showReview(e, $("#reviews-content")).then(), this.getBean("RelatedPlugin").showRelated($("#related-content"), e).then();
    }
    handleMovieDetail(e) {
        V(e).then((e => {
            const t = e.actors || [], n = e.imgList || [];
            let a = "";
            if (t.length > 0) {
                let e = "";
                for (let n = 0; n < t.length; n++) {
                    let i = t[n];
                    a += `<span class="actor-tag"><a href="/actors/${i.id}" target="_blank">${i.name}</a></span>`,
                    0 === i.gender && (e += i.name + " ");
                }
                $("#data-actress").text(e);
            } else a = '<span class="no-data">暂无演员信息</span>';
            let i = "";
            i = Array.isArray(n) && n.length > 0 ? n.map(((e, t) => `\n                <a href="${e}" data-fancybox="movie-gallery" data-caption="剧照 ${t + 1}">\n                    <img src="${e}" class="movie-image-thumb"  alt=""/>\n                </a>\n            `)).join("") : '<div class="no-data">暂无剧照</div>',
            $(".movie-info-container").html(`\n                <h3 class="movie-title"><strong class="current-title">${e.title || "无标题"}</strong></h3>\n                <div class="movie-meta">\n                    <span><strong>番号: </strong>${e.carNum || "未知"}</span>\n                    <span><strong>年份: </strong>${e.releaseDate || "未知"}</span>\n                    <span><strong>评分: </strong>${e.score || "无"}</span>\n                    <span><strong>时长: </strong>${e.duration + " m" || "无"}</span>\n                </div>\n                <div class="movie-meta">\n                    <span>\n                        <strong>站点: </strong>\n                        <a href="https://fc2ppvdb.com/articles/${e.carNum.replace("FC2-", "")}" target="_blank">fc2ppvdb</a>\n                        <a style="margin-left: 5px;" href="https://adult.contents.fc2.com/article/${e.carNum.replace("FC2-", "")}/" target="_blank">fc2电子市场</a>\n                    </span>\n                </div>\n                <div class="movie-actors">\n                    <div class="actor-list"><strong>主演: </strong>${a}</div>\n                </div>\n                <div class="movie-gallery" style="margin-top:10px">\n                    <strong>剧照: </strong>\n                    <div class="image-list">${i}</div>\n                </div>\n                <div id="data-releaseDate" style="display: none">${e.releaseDate || ""}</div>\n            `),
            this.getBean("TranslatePlugin").translate(e.carNum, !1).then();
        })).catch((e => {
            console.error(e), $(".movie-info-container").html(`\n                <div class="movie-error">加载失败: ${escapeHtml(e.message)}</div>\n            `);
        }));
    }
    handleLongImg(e) {
        utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
            $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container" style="overflow:hidden;max-height: 150px;max-width:150px; text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> ');
            const t = this.getBean("ScreenShotPlugin"), n = await t.getScreenshot(e);
            n && await t.addImg("缩略图", n);
        }));
    }
    handleMagnets(e) {
        (async e => {
            let t = `${U}/v1/movies/${e}/magnets`, n = {
                jdSignature: await O()
            };
            return (await gmHttp.get(t, null, n)).data.magnets;
        })(e).then((e => {
            let t = "";
            if (e.length > 0) for (let n = 0; n < e.length; n++) {
                let a = e[n], i = "";
                n % 2 == 0 && (i = "odd"), t += `\n                        <div class="item columns is-desktop ${i}">\n                            <div class="magnet-name column is-four-fifths">\n                                <a href="magnet:?xt=urn:btih:${a.hash}" title="右鍵點擊並選擇「複製鏈接地址」">\n                                    <span class="name">${a.name}</span>\n                                    <br>\n                                    <span class="meta">\n                                        ${(a.size / 1024).toFixed(2)}GB, ${a.files_count}個文件 \n                                     </span>\n                                    <br>\n                                    <div class="tags">\n                                        ${a.hd ? '<span class="tag is-primary is-small is-light">高清</span>' : ""}\n                                        ${a.cnsub ? '<span class="tag is-warning is-small is-light">字幕</span>' : ""}\n                                    </div>\n                                </a>\n                            </div>\n                            <div class="buttons column">\n                                <button class="button is-info is-small copy-to-clipboard" data-clipboard-text="magnet:?xt=urn:btih:${a.hash}" type="button">&nbsp;複製&nbsp;</button>\n                            </div>\n                            <div class="date column"><span class="time">${a.created_at}</span></div>\n                        </div>\n                    `;
            } else t = '<span class="no-data">暂无磁力信息</span>';
            $("#magnets-content").html(t)        })).catch((e => {
            console.error(e), $("#magnets-content").html(`\n                <div class="movie-error">加载失败: ${escapeHtml(e.message)}</div>\n            `);
        }));
    }
    async openFc2Page(e, t, n) {
        const a = this.getBean("OtherSitePlugin");
        let i = await a.getJavDbUrl();
        window.open(`${i}/users/collection_codes?movieId=${e}&carNum=${t}&url=${n}`);
    }
}

class ce extends X {
    getName() {
        return "HighlightMagnetPlugin";
    }
    doFilterMagnet() {
        this.handleDb(), this.handleBus();
    }
    handleDb() {
        if (!r) return;
        let e = $("#magnets-content .name");
        if (0 === e.length) return;
        const t = [ "4k", "-c", "-u", "-uc" ];
        let n = !1;
        e.each(((e, a) => {
            const i = $(a), s = i.text().toLowerCase(), o = t.some((e => s.includes(e)));
            i.parent().parent().parent().addClass("magnet-row"), s.includes("4k") && i.css("color", "#f40"),
            o && (n = !0, i.parent().parent().parent().addClass("high-quality"));
        })), n ? $("#magnets-content .magnet-row").not(".high-quality").hide() : $("#enable-magnets-filter").addClass("do-hide");
    }
    handleBus() {
        l && isDetailPage && utils.loopDetector((() => $("#magnet-table td a").length > 0), (() => {
            const e = $("#magnet-table tr"), t = [ "4k", "-c", "-u", "-uc" ];
            let n = !1;
            e.each(((e, a) => {
                const i = $(a), s = i.find("td:first-child"), o = s.find("a:first-child"), r = s.find("a:nth-child(2)"), l = o.text().toLowerCase();
                l.includes("4k") && o.css("color", "#f40");
                (t.some((e => l.includes(e))) || r.length && r.text().includes("字幕")) && (n = !0,
                i.addClass("high-quality"));
            })), n ? e.each(((e, t) => {
                const n = $(t);
                n.hasClass("high-quality") || n.hide();
            })) : $("#enable-magnets-filter").addClass("do-hide");
        }));
    }
    showAll() {
        if (r) {
            $("#magnets-content .item").toArray().forEach((e => $(e).show()));
        }
        l && $("#magnet-table tr").toArray().forEach((e => $(e).show()));
    }
}

class de extends X {
    getName() {
        return "FoldCategoryPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        return `\n            <style>\n                #tags a.tag, .tags a.tag {\n                    position:relative;\n                }\n                .highlight-btn {\n                    position: absolute;\n                    top: -10px;\n                    right: -10px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 50%;\n                    width: 24px;\n                    height: 24px;\n                    font-size: 14px;\n                    line-height: 24px;\n                    text-align: center;\n                    cursor: pointer;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n                    display: none;\n                    z-index: 999;\n                }\n                /* 当父元素被高亮时，按钮变为其他颜色 */\n                .highlighted .highlight-btn {\n                    background-color: #FF5722;\n                }\n                /* 高亮状态下的标签样式 */\n                .highlighted {\n                    /* 浅黄色 */\n                    border: ${e.highlightedTagNumber || 1}px solid ${e.highlightedTagColor || "#ce2222"};\n                }\n            </style>\n        `;
    }
    async handle() {
        window.isListPage && (o.includes("advanced_search") || (this.highlightTag(), utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            this.createFoldBtn();
        }), 1, 1e4, !0), $("#tags .tag-category .tag-expand").each(((e, t) => {
            $(t).parent().hasClass("collapse") && t.click();
        }))));
    }
    highlightTag() {
        (async () => {
            const e = await storageManager.getHighlightedTags();
            e && e.forEach((e => {
                $(`#tags a.tag:contains(${e})`).addClass("highlighted"), $(`.tags a.tag:contains(${e})`).addClass("highlighted");
            }));
        })().then(), $("#tags a.tag, .tags a.tag").hover((function() {
            const e = $(this), t = $('<button class="highlight-btn" title="高亮显示">★</button>');
            e.append(t), t.fadeIn(0);
        }), (function() {
            $(this).find(".highlight-btn").fadeOut(0, (function() {
                $(this).remove();
            }));
        })), $(document).on("click", ".highlight-btn", (async function(e) {
            e.stopPropagation(), e.preventDefault();
            const t = $(this).closest("a.tag"), n = t.clone();
            n.find(".highlight-btn").remove();
            const a = n.text().trim().replace(/\s*\(\d+\)$/, "");
            let i = await storageManager.getHighlightedTags();
            i.includes(a) ? (i = i.filter((e => e !== a)), t.removeClass("highlighted")) : (i.push(a),
            t.addClass("highlighted")), await storageManager.setHighlightedTags(i);
        }));
    }
    async createFoldBtn() {
        const e = await storageManager.getSetting("foldCategoryHotKey");
        let t = $("#tags"), n = $("#tags dl div.tag.is-info").map((function() {
            return $(this).text().replaceAll("\n", "").replaceAll(" ", "");
        })).get().join(" ");
        if (!n) return;
        $(".tabs").append(`\n            <div style="display: flex;align-items: center;flex-grow:1;justify-content: flex-end;">\n                <div>已选分类: <span id="jhs-check-tag">${n}</span></div>\n                <a class="menu-btn  main-tab-btn" id="foldCategoryBtn" style="background-color:#d23e60 !important;">\n                    <span></span>\n                    ${e ? ` (${e})` : ""}\n                    <i style="margin-left: 10px"></i>\n                </a>\n\n            </div>\n        `);
        let a = $("h2.section-title");
        if (a.length > 0 && (a.append('\n                <div id="foldCategoryBtn">\n                    <a class="menu-btn" style="background-color:#d23e60 !important;margin-left: 20px;border-bottom:none !important;border-radius:3px;">\n                        <span></span>\n                        <i style="margin-left: 10px"></i>\n                    </a>\n                </div>\n            '),
        t = $("section > div > div.box")), !t) return;
        let i = $("#foldCategoryBtn"), s = localStorage.getItem("jhs_foldCategory") === _, [o, r] = s ? [ "展开", "icon-angle-double-down" ] : [ "折叠", "icon-angle-double-up" ];
        i.find("span").text(o).end().find("i").attr("class", r), window.location.href.includes("noFold=1") || t[s ? "hide" : "show"](),
        i.on("click", (async e => {
            e.preventDefault(), s = !s, localStorage.setItem("jhs_foldCategory", s ? _ : C);
            const [n, a] = s ? [ "展开", "icon-angle-double-down" ] : [ "折叠", "icon-angle-double-up" ];
            i.find("span").text(n).end().find("i").attr("class", a), t[s ? "hide" : "show"]();
        }));
    }
}

class he extends X {
    constructor() {
        super(...arguments), i(this, "apiUrl", "https://ja.wikipedia.org/wiki/");
    }
    getName() {
        return "ActressInfoPlugin";
    }
    async handle() {
        "yes" === await storageManager.getSetting("enableLoadActressInfo", "yes") && this.loadActressInfo();
    }
    loadActressInfo() {
        this.handleDetailPage().then(), this.handleStarPage().then();
    }
    async initCss() {
        return "\n            <style>\n                .info-tag {\n                    background-color: #ecf5ff;\n                    display: inline-block;\n                    height: 32px;\n                    padding: 0 10px;\n                    line-height: 30px;\n                    font-size: 12px;\n                    color: #409eff;\n                    border: 1px solid #d9ecff;\n                    border-radius: 4px;\n                    box-sizing: border-box;\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    async handleDetailPage() {
        if ($(".actress-info").length > 0) return;
        let e = $(".female").prev().map(((e, t) => $(t).text().trim())).get();
        if (!e.length) return;
        const t = "jhs_actress_info", n = localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {};
        let a = null, i = "";
        for (let o = 0; o < e.length; o++) {
            let t = e[o];
            if (a = n[t], !a) try {
                a = await this.searchInfo(t), a && (n[t] = a);
            } catch (s) {
                console.error("该名称查询失败,尝试其它名称");
            }
            let r = "";
            r = a ? `\n                    <div class="panel-block actress-info">\n                        <strong>${t}:</strong>\n                        <a href="${a.url}" style="margin-left: 5px" target="_blank">\n                            <span class="info-tag">${a.birthday} ${a.age}</span>\n                            <span class="info-tag">${a.height} ${a.weight}</span>\n                            <span class="info-tag">${a.threeSizeText} ${a.braSize}</span>\n                        </a>\n                    </div>\n                ` : `<div class="panel-block actress-info"><a href="${this.apiUrl + t}" target="_blank"><strong>${t}:</strong></a></div> `,
            i += r;
        }
        $('strong:contains("演員")').parent().after(i), localStorage.setItem(t, JSON.stringify(n));
    }
    async handleStarPage() {
        if ($(".actress-info").length > 0) return;
        let e = [], t = $(".actor-section-name");
        t.length && t.text().trim().split(",").forEach((t => {
            e.push(t.trim());
        }));
        let n = $(".section-meta:not(:contains('影片'))");
        if (n.length && n.text().trim().split(",").forEach((t => {
            e.push(t.trim());
        })), !e.length) return;
        const a = "jhs_actress_info", i = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {};
        let s = null;
        for (let l = 0; l < e.length; l++) {
            let t = e[l];
            if (s = i[t], s) break;
            try {
                s = await this.searchInfo(t);
            } catch (r) {
                console.error("该名称查询失败,尝试其它名称");
            }
            if (s) break;
        }
        s && e.forEach((e => {
            i[e] = s;
        }));
        let o = '<div class="actress-info" style="font-size: 17px; font-weight: normal; margin-top: 5px;">无此相关演员信息</div>';
        s && (o = `\n                <a class="actress-info" href="${s.url}" target="_blank">\n                    <div style="font-size: 17px; font-weight: normal; margin-top: 5px;">\n                        <div style="display: flex; margin-bottom: 10px;">\n                            <span style="width: 300px;">出生日期: ${s.birthday}</span>\n                            <span style="width: 200px;">年龄: ${s.age}</span>\n                            <span style="width: 200px;">身高: ${s.height}</span>\n                        </div>\n                        <div style="display: flex; margin-bottom: 10px;">\n                            <span style="width: 300px;">体重: ${s.weight}</span>\n                            <span style="width: 200px;">三围: ${s.threeSizeText}</span>\n                            <span style="width: 200px;">罩杯: ${s.braSize}</span>\n                        </div>\n                    </div>\n                </a>\n            `),
        t.parent().append(o), localStorage.setItem(a, JSON.stringify(i));
    }
    async searchInfo(e) {
        "三上悠亞" === e && (e = "三上悠亜");
        let t = this.apiUrl + e;
        const n = await gmHttp.get(t), a = new DOMParser, i = $(a.parseFromString(n, "text/html"));
        let s = i.find('a[title="誕生日"]').parent().parent().find("td").text().trim(), o = i.find("th:contains('現年齢')").parent().find("td").text().trim() ? parseInt(i.find("th:contains('現年齢')").parent().find("td").text().trim()) + "岁" : "", r = i.find('tr:has(a[title="身長"]) td').text().trim().split(" ")[0] + "cm", l = i.find('tr:has(a[title="体重"]) td').text().trim().split("/")[1].trim();
        return "― kg" === l && (l = ""), {
            birthday: s,
            age: o,
            height: r,
            weight: l,
            threeSizeText: i.find('a[title="スリーサイズ"]').closest("tr").find("td").text().replace("cm", "").trim(),
            braSize: i.find('th:contains("ブラサイズ")').next("td").contents().first().text().trim(),
            url: t
        };
    }
}

class pe extends X {
    constructor() {
        super(), i(this, "$contentBox", $(".section .container"));
    }
    getName() {
        return "HitShowPlugin";
    }
    handle() {
        $('a[href*="rankings/playback"]').on("click", (e => {
            e.preventDefault(), e.stopPropagation(), window.location.href = "/advanced_search?handlePlayback=1&period=daily";
        })), this.handlePlayback().then();
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("热播"), e.css("marginBottom", "0"), $(".empty-message").remove(),
        $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>');
    }
    async handlePlayback() {
        if (!window.location.href.includes("handlePlayback=1")) return;
        let e = new URLSearchParams(window.location.search).get("period");
        this.toolBar(e), this.hookPage();
        let t = $(".movie-list");
        t.html("");
        let n = loading();
        let a = !1;
        for (let s = 1; s <= 3 && !a; s++) try {
            const n = await W(e);
            let i = this.markDataListHtml(n);
            t.html(i), this.loadScore(n), a = !0;
        } catch (i) {
            s < 3 ? (clog.error(`获取热播数据失败 (第 ${s} 次重试)`, i), await new Promise((e => setTimeout(e, 1e3)))) : clog.error("所有重试尝试均失败，无法获取数据。", i);
        } finally {
            (a || 3 === s) && n.close();
        }
    }
    toolBar(e) {
        let t = `\n            <div class="button-group" style="margin-top:18px">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small ${"daily" === e ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"weekly" === e ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"monthly" === e ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n                </div>\n            </div>\n        `;
        this.$contentBox.append(t);
    }
    getStarRating(e) {
        let t = "";
        const n = Math.floor(e);
        for (let a = 0; a < n; a++) t += '<i class="icon-star"></i>';
        for (let a = 0; a < 5 - n; a++) t += '<i class="icon-star gray"></i>';
        return t;
    }
    loadScore(e) {
        if (0 === e.length) return;
        (async () => {
            let t = "jhs_score_info";
            for (const a of e) try {
                const e = a.id;
                if (!$(`#score_${e}`).length) return;
                if ($(`#${e}`).is(":hidden")) continue;
                const n = localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {}, i = n[e];
                if (i) {
                    this.appendScoreHtml(e, i);
                    continue;
                }
                for (;!document.hasFocus(); ) await new Promise((e => setTimeout(e, 500)));
                const s = await V(e);
                let o = s.score, r = s.watchedCount, l = `\n                        <span class="value">\n                            <span class="score-stars">${this.getStarRating(o)}</span> \n                            &nbsp; ${o}分，由${r}人評價\n                        </span>\n                    `;
                this.appendScoreHtml(e, l), n[e] = l, localStorage.setItem(t, JSON.stringify(n)),
                await new Promise((e => setTimeout(e, 500)));
            } catch (n) {
                clog.error(`🚨 解析评分数据失败 | 编号: ${a.number}\n`, `错误详情: ${n.message}\n`, n.stack ? `调用栈:\n${n.stack}` : "");
            }
        })();
    }
    appendScoreHtml(e, t) {
        let n = $(`#score_${e}`);
        n.length && "" === n.html().trim() && n.slideUp(0, (function() {
            $(this).html(t).slideDown(500);
        }));
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach((e => {
            t += `\n                <div class="item" id="${e.id}">\n                    <a href="/v/${e.id}" class="box" title="${e.origin_title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${e.cover_url.replace("https://tp-iu.cmastd.com/rhe951l4q", "https://c0.jdbstatic.com")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${e.number}</strong> ${e.origin_title}</div>\n                        <div class="score" id="score_${e.id}">\n                        </div>\n                        <div class="meta">\n                            ${e.release_date}\n                        </div>\n                        <div class="tags has-addons">\n                           ${e.has_cnsub ? '<span class="tag is-warning">含中字磁鏈</span>' : e.magnets_count > 0 ? '<span class="tag is-success">含磁鏈</span>' : '<span class="tag is-info">无磁鏈</span>'}\n                           ${e.new_magnets ? '<span class="tag is-info">今日新種</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}

const me = "jhs_appAuthorization";

class ue extends X {
    constructor() {
        super(), i(this, "has_cnsub", ""), i(this, "$contentBox", $(".section .container")),
        i(this, "movies", []);
    }
    getName() {
        return "TOP250Plugin";
    }
    handle() {
        $('.main-tabs ul li:contains("猜你喜歡")').html('<a href="/rankings/top"><span>Top250</span></a>'),
        $('a[href*="rankings/top"]').on("click", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.target), n = (t.is("a") ? t : t.closest("a")).attr("href");
            let a = n.includes("?") ? n.split("?")[1] : n;
            const i = new URLSearchParams(a);
            this.checkLogin(e, i);
        })), this.handleTop().then();
    }
    hookPage() {
        $("h2.section-title").contents().first().replaceWith("Top250"), $(".empty-message").remove(),
        $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>'),
        this.renderPagination();
    }
    renderPagination() {
        const e = new URLSearchParams(window.location.search);
        let t = parseInt(e.get("page")) || 1;
        this.$contentBox.append((e => {
            const t = e >= 5;
            let n = "";
            for (let a = 1; a <= 5; a++) {
                n += `<li><a class="pagination-link ${e === a ? "is-current" : ""}" data-page="${a}">${a}</a></li>`;
            }
            return `\n                <nav class="pagination">\n                    <a class="pagination-previous ${e <= 1 ? "do-hide" : ""}" data-page="${e - 1}">上一頁</a>\n                    <a class="pagination-next ${t ? "do-hide" : ""}" data-page="${e + 1}">下一頁</a>\n                    \n                    <ul class="pagination-list">\n                        ${n}\n                    </ul>\n                </nav>\n            `;
        })(t)), this.$contentBox.on("click", ".pagination-link, .pagination-previous, .pagination-next", (t => {
            t.preventDefault();
            const n = parseInt($(t.currentTarget).data("page"));
            !isNaN(n) && n > 0 && (t => {
                e.set("page", t), window.history.pushState({}, "", "?" + e.toString()), window.location.reload();
            })(n);
        }));
    }
    async handleTop() {
        if (!window.location.href.includes("handleTop=1")) return;
        const e = new URLSearchParams(window.location.search);
        let t = e.get("handleType") || "all", n = e.get("type_value") || "";
        this.has_cnsub = e.get("has_cnsub") || "";
        let a = e.get("page") || 1;
        this.toolBar(t, n, a), this.hookPage();
        let i = $(".movie-list");
        i.html("");
        let s = loading();
        let o = !1;
        for (let l = 1; l <= 3 && !o; l++) try {
            const e = await q(t, n, a, 50);
            let r = e.success, l = e.message, c = e.action;
            if (1 === r) {
                let t = e.data.movies;
                if (0 === t.length) return show.error("无数据"), void s.close();
                this.movies = t;
                const n = t.filter((e => "1" === this.has_cnsub ? e.has_cnsub : "0" !== this.has_cnsub || !e.has_cnsub)), a = this.getBean("HitShowPlugin");
                let r = a.markDataListHtml(n);
                i.html(r), a.loadScore(n), o = !0;
            } else console.error(e), i.html(`<h3>${escapeHtml(l)}</h3>`), show.error(l), "JWTVerificationError" === c && (await localStorage.removeItem(me),
            await this.checkLogin(null, new URLSearchParams(window.location.search))), o = !0;
        } catch (r) {
            l < 3 ? (clog.error(`获取Top数据失败 (第 ${l} 次重试):`, r), await new Promise((e => setTimeout(e, 1e3)))) : (clog.error("所有重试尝试均失败，无法获取Top数据。", r),
            i.html("<h3>无法加载数据，请稍后再试。</h3>"));
        } finally {
            (o || 3 === l) && s.close();
        }
    }
    toolBar(e, t, n) {
        "5" === n.toString() && $(".pagination-next").remove(), $(".pagination-ellipsis").closest("li").remove(),
        $(".pagination-list li a").each((function() {
            parseInt($(this).text()) > 5 && $(this).closest("li").remove();
        }));
        let a = "";
        for (let s = (new Date).getFullYear(); s >= 2008; s--) a += `\n                <a style="padding:18px 18px !important;" \n                   class="button is-small ${t === s.toString() ? "is-info" : ""}" \n                   href="/advanced_search?handleTop=1&handleType=year&type_value=${s}&has_cnsub=${this.has_cnsub}">\n                  ${s}\n                </a>\n            `;
        let i = `\n            <div class="button-group">\n                <div class="buttons has-addons" id="conditionBox" style="margin-bottom: 0!important;">\n                    <a style="padding:18px 18px !important;" class="button is-small ${"all" === e ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=all&type_value=&has_cnsub=${this.has_cnsub}">全部</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"0" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=0&has_cnsub=${this.has_cnsub}">有码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"1" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=1&has_cnsub=${this.has_cnsub}">无码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"2" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=2&has_cnsub=${this.has_cnsub}">欧美</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"3" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=${this.has_cnsub}">Fc2</a>\n                    \n                    <a style="padding:18px 18px !important;margin-left: 50px" class="button is-small ${"1" === this.has_cnsub ? "is-info" : ""}" data-cnsub-value="1">含中字磁鏈</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"0" === this.has_cnsub ? "is-info" : ""}" data-cnsub-value="0">无字幕</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-cnsub-value="">重置</a>\n                </div>\n                \n                <div class="buttons has-addons" id="conditionBox">\n                    ${a}\n                </div>\n            </div>\n        `;
        this.$contentBox.append(i), $("a[data-cnsub-value]").on("click", (e => {
            const t = $(e.currentTarget).data("cnsub-value");
            this.has_cnsub = t.toString(), $("a[data-cnsub-value]").removeClass("is-info"),
            $(e.currentTarget).addClass("is-info"), $(".toolbar a.button").not("[data-cnsub-value]").each(((e, n) => {
                const a = $(n), i = new URL(a.attr("href"), window.location.origin);
                i.searchParams.set("has_cnsub", t), a.attr("href", i.toString());
            }));
            const n = this.movies.filter((e => "1" === this.has_cnsub ? e.has_cnsub : "0" !== this.has_cnsub || !e.has_cnsub)), a = this.getBean("HitShowPlugin");
            let i = a.markDataListHtml(n);
            $(".movie-list").html(i), a.loadScore(n);
        }));
    }
    async checkLogin(e, t) {
        if (!localStorage.getItem(me)) return show.error("该类别依赖移动端接口，请先完成登录"), void this.openLoginDialog();
        let n = "all", a = "", i = t.get("t") || "";
        /^y\d+$/.test(i) ? (n = "year", a = i.substring(1)) : "" !== i && (n = "video_type",
        a = i);
        let s = `/advanced_search?handleTop=1&handleType=${n}&type_value=${a}`;
        e && (e.ctrlKey || e.metaKey) ? GM_openInTab(window.location.origin + s, {
            insert: 0
        }) : window.location.href = s;
    }
    openLoginDialog() {
        layer.open({
            type: 1,
            title: "JavDB",
            closeBtn: 1,
            area: [ "360px", "auto" ],
            shadeClose: !1,
            content: '\n                <div style="padding: 30px; font-family: \'Helvetica Neue\', Arial, sans-serif;">\n                    <div style="margin-bottom: 25px;">\n                        <input type="text" id="username" name="username" \n                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px; \n                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;\n                                   background: #f9f9f9; color: #333;"\n                            placeholder="用户名 | 邮箱"\n                            onfocus="this.style.borderColor=\'#4a8bfc\'; this.style.background=\'#fff\'"\n                            onblur="this.style.borderColor=\'#e0e0e0\'; this.style.background=\'#f9f9f9\'">\n                    </div>\n                    \n                    <div style="margin-bottom: 15px;">\n                        <input type="password" id="password" name="password" \n                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px; \n                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;\n                                   background: #f9f9f9; color: #333;"\n                            placeholder="密码"\n                            onfocus="this.style.borderColor=\'#4a8bfc\'; this.style.background=\'#fff\'"\n                            onblur="this.style.borderColor=\'#e0e0e0\'; this.style.background=\'#f9f9f9\'">\n                    </div>\n                    \n                    <button id="loginBtn" \n                            style="width: 100%; padding: 12px; background: #4a8bfc; color: white; \n                                   border: none; border-radius: 4px; font-size: 15px; cursor: pointer;\n                                   transition: background 0.3s;"\n                            onmouseover="this.style.background=\'#3a7be0\'"\n                            onmouseout="this.style.background=\'#4a8bfc\'">\n                        登录\n                    </button>\n                </div>\n            ',
            success: (e, t) => {
                $("#loginBtn").click((function() {
                    const e = $("#username").val(), n = $("#password").val();
                    if (!e || !n) return void show.error("请输入用户名和密码");
                    let a = loading();
                    (async (e, t) => {
                        let n = `${U}/v1/sessions?username=${encodeURIComponent(e)}&password=${encodeURIComponent(t)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`, a = {
                            "user-agent": "Dart/3.5 (dart:io)",
                            "accept-language": "zh-TW",
                            "content-type": "multipart/form-data; boundary=--dio-boundary-2210433284",
                            jdsignature: await O()
                        };
                        return await gmHttp.post(n, null, a);
                    })(e, n).then((async e => {
                        let n = e.success;
                        if (0 === n) show.error(e.message); else {
                            if (1 !== n) throw clog.error("登录失败", e), new Error(e.message);
                            {
                                let n = e.data.token;
                                await localStorage.setItem(me, await encryptData(n)), show.ok("登录成功"), layer.close(t), window.location.href = "/advanced_search?handleTop=1&period=daily";
                            }
                        }
                    })).catch((e => {
                        clog.error("登录异常:", e), show.error(e.message);
                    })).finally((() => {
                        a.close();
                    }));
                }));
            }
        });
    }
}

class fe extends X {
    getName() {
        return "NavBarPlugin";
    }
    async initCss() {
        return "\n            .highlight-red {\n    /* 核心要求：高亮红色文本 */\n    color: red !important; \n    \n    /* 建议：增加字体加粗，效果更明显 */\n    font-weight: bold;\n    \n    /* 建议：增加背景色，效果更突出 */\n    /* background-color: yellow; */ \n}\n        ";
    }
    handle() {
        if (this.margeNav(), this.hookSearch(), this.hookOldSearch(), this.toggleOtherNavItem(),
        $(window).resize(this.toggleOtherNavItem), window.location.href.includes("/search")) {
            const e = new URLSearchParams(window.location.search);
            let t = e.get("q"), n = e.get("f");
            $("#search-keyword").val(t), n && $("#search-type").val(n), t && this.highlightKeyword(t);
        }
    }
    highlightKeyword(e) {
        const t = e.trim();
        if (!t) return;
        const n = t.toLowerCase();
        $(".video-title strong, .actor-box strong").each((function() {
            const e = $(this);
            e.text().toLowerCase().includes(n) && e.addClass("highlight-red");
        }));
    }
    hookSearch() {
        $("#navbar-menu-hero").after('\n            <div class="navbar-menu" id="search-box">\n                <div class="navbar-start" style="display: flex; align-items: center; gap: 5px;">\n                    <select id="search-type" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; background-color: #333; color: #eee; font-size: 14px; outline: none;">\n                        <option value="all">影片</option>\n                        <option value="actor">演員</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">導演</option>\n                        <option value="code">番號</option>\n                        <option value="list">清單</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="輸入影片番號，演員名等關鍵字進行檢索" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; flex-grow: 1; font-size: 14px; background-color: #333; color: #eee; outline: none;">\n                    <a href="/advanced_search?noFold=1" title="進階檢索" style="padding: 6px 12px; background-color: #444; border-radius: 4px; text-decoration: none; color: #ddd; font-size: 14px; border: 1px solid #555;"><span>...</span></a>\n                    <a id="search-img-btn" style="padding: 6px 16px; background-color: #444; color: #fff; border-radius: 4px; text-decoration: none; font-weight: 500; cursor: pointer; border: 1px solid #555;">识图</a>\n                    <a id="search-btn" style="padding: 6px 16px; background-color: #444; color: #fff; border-radius: 4px; text-decoration: none; font-weight: 500; cursor: pointer; border: 1px solid #555;">檢索</a>\n                </div>\n            </div>\n        '),
        $("#search-keyword").on("paste", (e => {
            const t = e.originalEvent.clipboardData.items;
            for (let n = 0; n < t.length; n++) if (-1 !== t[n].type.indexOf("image")) {
                const e = t[n].getAsFile();
                $("#search-keyword").blur();
                const a = this.getBean("SearchByImagePlugin");
                return void a.open((() => {
                    a.handleImageFile(e), a.resetSearchUI();
                }));
            }
            setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })).on("keypress", (e => {
            "Enter" === e.key && setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })), $("#search-btn").on("click", (e => {
            let t = $("#search-keyword").val(), n = $("#search-type option:selected").val();
            "" !== t && (window.location.href.includes("/search") ? window.location.href = "/search?q=" + t + "&f=" + n : window.open("/search?q=" + t + "&f=" + n));
        })), $("#search-img-btn").on("click", (() => {
            this.getBean("SearchByImagePlugin").open();
        }));
    }
    hookOldSearch() {
        const e = document.querySelector(".search-image");
        if (!e) return;
        const t = e.cloneNode(!0);
        e.parentNode.replaceChild(t, e), $("#button-search-image").attr("data-tooltip", "以图识图"),
        $(".search-image").on("click", (e => {
            this.getBean("SearchByImagePlugin").open();
        }));
    }
    margeNav() {
        $('a[href*="/feedbacks/new"]').remove(), $('a[href*="theporndude.com"]').remove(),
        $('a.navbar-link[href="/makers"]').parent().after('\n            <div class="navbar-item has-dropdown is-hoverable">\n                <a class="navbar-link">其它</a>\n                <div class="navbar-dropdown is-boxed">\n                  <a class="navbar-item" href="/feedbacks/new" target="_blank" >反饋</a>\n                  <a class="navbar-item" rel="nofollow noopener" target="_blank" href="https://theporndude.com/zh">ThePornDude</a>\n                </div>\n              </div>\n        ');
    }
    toggleOtherNavItem() {
        let e = $("#search-box"), t = $("#search-bar-container");
        $(window).width() < 1600 && $(window).width() > 1023 && (e.hide(), t.show()), $(window).width() > 1600 && (e.show(),
        t.hide());
    }
}

class ve {
    constructor() {
        this.queue = Promise.resolve();
    }
    addTask(e) {
        this.queue = this.queue.then((() => e())).catch((e => {
            clog.error("执行异步队列任务失败:", e);
        }));
    }
    async waitAllFinished() {
        return this.queue;
    }
}

class be extends X {
    constructor() {
        super(...arguments), i(this, "okBackgroundColor", "#7bc73b"), i(this, "errorBackgroundColor", "#de3333"),
        i(this, "warnBackgroundColor", "#d7a80c"), i(this, "domainErrorBackgroundColor", "#d7780c"),
        i(this, "siteConfigs", [ {
            id: "javTrailersBtn",
            getBaseUrl: async () => await this.getJavTrailersUrl(),
            itemSelector: ".videos-list .video-link",
            searchPath: (e, t) => `${e}/search/${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.find("p.card-text").text()
        }, {
            id: "123AvBtn",
            getBaseUrl: async () => await this.getAv123Url() + "/ja",
            itemSelector: ".box-item",
            searchPath: (e, t) => `${e}/search?keyword=${t}`,
            getDetailPageHref: e => e.find(".detail a").attr("href"),
            findCarNumOrTitle: e => e.find("img").attr("title")
        }, {
            id: "jableBtn",
            getBaseUrl: async () => await this.getjableUrl(),
            itemSelector: "#list_videos_videos_list_search_result .detail .title a",
            searchPath: (e, t) => `${e}/search/${t}/`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.text()
        }, {
            id: "avgleBtn",
            getBaseUrl: async () => await this.getAvgleUrl(),
            itemSelector: ".text-secondary",
            searchPath: (e, t) => `${e}/vod/search.html?wd=${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.text()
        }, {
            id: "missAvBtn",
            getBaseUrl: async () => await this.getMissAvUrl(),
            itemSelector: ".text-secondary",
            searchPath: (e, t) => `${e}/search/${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.text()
        }, {
            id: "supJavBtn",
            getBaseUrl: async () => await this.getSupJavUrl(),
            itemSelector: ".posts post",
            searchPath: (e, t) => `${e}/?s=${t}`,
            getDetailPageHref: (e, t, n) => e.attr("href"),
            findCarNumOrTitle: e => e.attr("title")
        }, {
            id: "javDbBtn",
            getBaseUrl: async () => await this.getJavDbUrl(),
            itemSelector: ".movie-list .item",
            searchPath: (e, t) => `${e}/search?q=${t}`,
            getDetailPageHref: e => e.find("a").attr("href"),
            findCarNumOrTitle: e => e.find(".video-title").text(),
            condition: e => l
        }, {
            id: "javBusBtn",
            getBaseUrl: async () => await this.getJavBusUrl(),
            itemSelector: ".container h3",
            searchPath: (e, t) => `${e}/${t}`,
            getDetailPageHref: (e, t, n) => `${t}/${n}`,
            findCarNumOrTitle: e => e.text(),
            condition: e => r && e && !e.includes("FC2")
        }, {
            id: "fanzaBtn",
            noHandle: !0,
            initUrl: e => `https://www.dmm.co.jp/search/=/searchstr=${e}`,
            condition: e => e && !e.includes("FC2")
        } ]), i(this, "settingCache", null), i(this, "lastFetchTime", 0), i(this, "CACHE_DURATION", 1e4);
    }
    getName() {
        return "OtherSitePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .site-btn {\n                    position: relative !important;\n                    min-width: 80px;\n                    display: inline-block;\n                    padding: 5px 10px;\n                    color: white !important;\n                    background-color:#938585;\n                    text-decoration: none;\n                    border-radius: 4px;\n                    text-align: center;\n                    margin-bottom: 5px;\n                }\n                .site-btn:hover {\n                    color: white;\n                    transform: translateY(-2px);\n                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);\n                }\n                .site-tag {\n                    position: absolute; \n                    top: -15px; \n                    right: 0; \n                    background-color: #ffc107; \n                    color: #333; \n                    font-size: 12px; \n                    padding: 2px 6px; \n                    border-radius: 4px;\n                }\n            </style>\n        ";
    }
    async handle() {
        isDetailPage && this.loadOtherSite(null, null, {
            autoDetect: !1
        }).then();
    }
    async loadOtherSite(e, t, n = {}) {
        if ("yes" !== await storageManager.getSetting("enableLoadOtherSite", "yes")) return;
        $("#otherSiteBox,#settingsArea").remove();
        e || (e = this.getPageInfo().carNum);
        const a = this.getEnabledSites(), i = `\n            <div id="otherSiteBox" class="panel-block" style="${r ? "margin-top:8px;font-size:13px" : "margin-top:10px;font-size:13px"}; user-select: none; ">\n                <div style="display: flex;gap: 5px;flex-wrap: wrap">\n                    ${this.siteConfigs.map((e => {
            if (e.sourceCarNum = t, e.condition && !1 === e.condition(e.sourceCarNum)) return "";
            return `<a target="_blank" class="site-btn" style="${a.includes(e.id) ? "" : "display:none"}" id="${e.id}"><span>${e.id.replace("Btn", "")}</span></a>`;
        })).join("")}\n                    <a id="detectOtherSiteBtn" class="site-btn" style="background-color:#1677ff"><span>检测外部站点</span></a>\n                    <a id="settingSiteBtn" class="site-btn"><span>设置</span></a>\n                </div>\n            </div>\n            \n            <div id="settingsArea" class="panel-block"  style="display: none; margin-top:10px; margin-bottom: 10px; user-select: none; ">\n                <div id="siteCheckboxes" style="display: flex;gap: 5px;flex-wrap: wrap">\n                </div>\n            </div>\n        `;
        $(".movie-panel-info").append(i), $(".container .info").append(i), $("#javTrailersBtn").on("click", (async t => {
            t.preventDefault();
            let n = await storageManager.getSetting();
            const a = n.filterHotKey, i = n.favoriteHotKey, s = n.speedVideoHotKey;
            let o = $("#javTrailersBtn").attr("href"), r = o + `?handle=1&filterHotKey=${a}&favoriteHotKey=${i}&speedVideoHotKey=${s}`;
            t && (t.ctrlKey || t.metaKey) && (r = o), utils.openPage(r, e, !1, t);
        })), await Promise.all(this.siteConfigs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.prepareSiteLink(e, t);
        }))), this.renderSettingsArea(), this.setupEventListeners(), $("#detectOtherSiteBtn").off("click").on("click", (t => {
            t.preventDefault(), this.detectOtherSites(e);
        })), n.autoDetect && await this.detectOtherSites(e);
    }
    async prepareSiteLink(e, t) {
        const n = $(`#${t.id}`);
        if (t.initUrl) return void (n.attr("href", t.initUrl(e)), n.css("backgroundColor", this.warnBackgroundColor),
        n.attr("title", "点击前往外部搜索页"));
        try {
            const a = await t.getBaseUrl(), i = t.searchPath(a, e);
            n.attr("href", i), n.attr("title", "点击前往外部搜索页；点击检测按钮后才自动检测"), n.css("backgroundColor", this.warnBackgroundColor);
        } catch (a) {
            n.attr("title", "外部站点地址未配置或不可用"), n.css("backgroundColor", this.domainErrorBackgroundColor);
        }
    }
    async detectOtherSites(e) {
        const t = $("#detectOtherSiteBtn"), n = t.text();
        return t.text("检测中").css("backgroundColor", "#938585"), await Promise.all(this.siteConfigs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.handleSite(e, t);
        }))), t.text(n).css("backgroundColor", "#1677ff");
    }
    async handleSite(e, t) {
        const n = $(`#${t.id}`);
        n.removeAttr("href").find(".site-tag").remove();
        if (t.initUrl && (n.attr("href", t.initUrl(e)), n.css("backgroundColor", this.warnBackgroundColor)),
        t.noHandle && !0 === t.noHandle) {
            const t = "jhs_other_site_dmm", a = (localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {})[e];
            a && ("single" === a.type ? (n.attr("href", a.url), n.css("backgroundColor", this.okBackgroundColor)) : "multiple" === a.type && (n.attr("href", a.url),
            n.append('<span class="site-tag" style="top:-15px">多结果</span>'), n.css("backgroundColor", this.okBackgroundColor)));
        } else try {
            if (n.attr("href")) return;
            if (utils.isHidden(n)) return;
            const a = "jhs_other_site", i = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {}, s = e + "_" + t.id.replace("Btn", ""), o = i[s], m = Date.now();
            if (o && o.time && m - o.time < 864e5) return void ("single" === o.type ? (n.attr("href", o.url), n.css("backgroundColor", this.okBackgroundColor)) : "multiple" === o.type && (n.attr("href", o.url),
            n.append('<span class="site-tag" style="top:-15px">多结果</span>'), n.css("backgroundColor", this.okBackgroundColor)));
            const r = await t.getBaseUrl(), l = t.searchPath(r, e);
            n.attr("href", l);
            const c = await storageManager.cachedRequest(`other-site:${t.id}:${e}`, 864e5, (() => gmHttp.get(l, null, t.headers, !0))), d = utils.htmlTo$dom(c), h = [];
            d.find(t.itemSelector).each(((n, a) => {
                const i = $(a);
                if (!t.findCarNumOrTitle(i).toLowerCase().includes(e.toLowerCase())) return;
                let s = t.getDetailPageHref(i, r, e);
                if (!s) throw new Error("解析href失败");
                s.includes("http") || (s = r + (s.startsWith("/") ? s : "/" + s)), h.push(s);
            }));
            let g = "", p = null;
            if (1 === h.length) {
                let e = h[0];
                n.attr("href", e), n.css("backgroundColor", this.okBackgroundColor), p = {
                type: "single",
                url: e,
                time: m
            };
            } else h.length > 1 ? (n.attr("href", l), g += '<span class="site-tag" style="top:-15px">多结果</span>',
            n.css("backgroundColor", this.okBackgroundColor), p = {
                type: "multiple",
                url: l,
                time: m
            }) : (n.attr("href", l), n.attr("title", "未查询到, 点击前往搜索页"), n.css("backgroundColor", this.errorBackgroundColor));
            p && (new ve).addTask((() => {
                const e = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {};
                e[s] = p, localStorage.setItem(a, JSON.stringify(e));
            })), g && n.append(g);
        } catch (a) {
            const e = String(a), i = t.id.replace("Btn", "");
            e.includes("Just a moment") ? (n.attr("title", "请求失败：Cloudflare 安全检查。"), n.css("backgroundColor", this.warnBackgroundColor),
            clog.warn(`检测第三方资源失败, ${i} 需Cloudflare安全检查`)) : e.includes("重定向") ? (n.attr("title", "域名失效"),
            n.css("backgroundColor", this.domainErrorBackgroundColor), clog.warn(`检测第三方资源失败, ${i} 域名被重定向`)) : e.includes("404 Page Not Found") ? (n.attr("title", "未查询到, 点击前往搜索页"),
            n.css("backgroundColor", this.errorBackgroundColor)) : (console.error(a), n.attr("title", "请求失败。"),
            n.css("backgroundColor", this.errorBackgroundColor), clog.warn(`检测第三方资源失败, ${i}`));
        }
    }
    async getSettingCache() {
        const e = Date.now();
        return (!this.settingCache || e - this.lastFetchTime > this.CACHE_DURATION) && (this.settingCache = await storageManager.getSetting(),
        this.lastFetchTime = e), this.settingCache;
    }
    async getMissAvUrl() {
        return (await this.getSettingCache()).missAvUrl || "https://missav.live";
    }
    async getjableUrl() {
        return (await this.getSettingCache()).jableUrl || "https://jable.tv";
    }
    async getAvgleUrl() {
        return (await this.getSettingCache()).avgleUrl || "https://jav.rs";
    }
    async getJavTrailersUrl() {
        return (await this.getSettingCache()).javTrailersUrl || "https://javtrailers.com";
    }
    async getAv123Url() {
        return (await this.getSettingCache()).av123Url || "https://123av.com";
    }
    async getJavDbUrl() {
        return (await this.getSettingCache()).javDbUrl || "https://javdb.com";
    }
    async getJavBusUrl() {
        return (await this.getSettingCache()).javBusUrl || "https://www.javbus.com";
    }
    async getSupJavUrl() {
        return (await this.getSettingCache()).supJavUrl || "https://supjav.com";
    }
    getEnabledSites() {
        const e = localStorage.getItem("jhs_enabled_sites");
        return e ? JSON.parse(e) : this.siteConfigs.map((e => e.id));
    }
    saveEnabledSites(e) {
        localStorage.setItem("jhs_enabled_sites", JSON.stringify(e));
    }
    renderSettingsArea() {
        const e = this.getEnabledSites(), t = document.getElementById("siteCheckboxes");
        t && (t.innerHTML = this.siteConfigs.map((t => {
            const n = e.includes(t.id);
            return `\n                <div style="margin-right: 15px; display: flex; align-items: ${r ? "center" : "flex-start"};">\n                    <input type="checkbox" id="checkbox-${t.id}" data-site-id="${t.id}" ${n ? "checked" : ""} style="margin-right: 8px; cursor: pointer;">\n                    <label for="checkbox-${t.id}" style="color: #333; font-weight: 500; cursor: pointer;">${t.id.replace("Btn", "")}</label>\n                </div>\n            `;
        })).join(""));
    }
    setupEventListeners() {
        const e = document.getElementById("settingsArea");
        document.addEventListener("click", (t => {
            if ("settingSiteBtn" === t.target.id || t.target.closest("#settingSiteBtn")) {
                const t = "none" === e.style.display || "" === e.style.display;
                e.style.display = t ? "block" : "none";
            }
        })), e.addEventListener("change", (t => {
            if ("checkbox" === t.target.type) {
                const n = t.target.getAttribute("data-site-id");
                if (t.target.checked) {
                    $(`#${n}`).show();
                    const e = this.getPageInfo().carNum, t = this.siteConfigs.find((e => e.id === n));
                    this.prepareSiteLink(e, t).then();
                } else $(`#${n}`).hide();
                const a = Array.from(e.querySelectorAll('input[type="checkbox"]:checked')).map((e => e.getAttribute("data-site-id")));
                this.saveEnabledSites(a);
            }
        }));
    }
}

class we extends X {
    getName() {
        return "BusDetailPagePlugin";
    }
    async initCss() {
        if (!window.isDetailPage) return "";
        $("h4:contains('推薦')").hide();
    }
    async handle() {
        if (window.location.href.includes("/star/")) {
            const e = $(".avatar-box");
            if (e.length > 0) {
                let t = e.parent();
                t.css("position", "initial"), t.insertBefore(t.parent());
            }
        }
        $(".genre a").each((function() {
            const e = $(this).attr("href");
            e && (e.startsWith("http://") || e.startsWith("https://") || e.startsWith("/")) && $(this).attr("target", "_blank");
        })), this.addCopyCarNumBtn();
    }
    addCopyCarNumBtn() {
        let e = null;
        const t = document.querySelectorAll("span.header");
        for (const n of t) if ("識別碼:" === n.textContent.trim()) {
            e = n;
            break;
        }
        if (e) {
            const t = e.nextElementSibling;
            if (t && "SPAN" === t.tagName) {
                const e = t.textContent.trim(), n = document.createElement("button");
                n.textContent = "复制", n.style.marginLeft = "10px", n.style.padding = "0 10px", n.style.cursor = "pointer",
                n.style.border = "1px solid #ccc", n.style.borderRadius = "5px", n.style.backgroundColor = "#f0f0f0",
                n.style.fontSize = "12px", n.addEventListener("click", (function(t) {
                    t.preventDefault();
                    const n = e => {
                        this.textContent = "已复制", setTimeout((() => {
                            this.textContent = "复制";
                        }), 1500);
                    };
                    navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(e).then((() => n())).catch((t => {
                        console.error("无法通过标准API复制:", t), alert("复制失败，请手动复制: " + e);
                    }));
                })), t.parentNode.insertBefore(n, t.nextSibling);
            }
        }
    }
}

class ye extends X {
    getName() {
        return "DetailPageButtonPlugin";
    }
    constructor() {
        super(), this.answerCount = 1;
    }
    async handle() {
        let e = await storageManager.getSetting();
        this.filterHotKey = e.filterHotKey, this.favoriteHotKey = e.favoriteHotKey, this.hasDownHotKey = e.hasDownHotKey,
        this.hasWatchHotKey = e.hasWatchHotKey, this.speedVideoHotKey = e.speedVideoHotKey,
        this.bindHotkey().then(), this.hideVideoControls(), window.isDetailPage && this.createMenuBtn();
    }
    async createMenuBtn() {
        const e = this.getPageInfo(), t = e.carNum, n = `\n            <div style="margin: 10px auto; display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap;gap: 20px;">\n                <div style="display: flex; gap: 10px; flex-wrap:wrap;">\n                    <a id="filterBtn" class="menu-btn" style="width: 120px; background-color:${f}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${m}</span>\n                    </a>\n                    <a id="favoriteBtn" class="menu-btn" style="width: 120px; background-color:${w}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${v}</span>\n                    </a>\n                    <a id="hasDownBtn" class="menu-btn" style="width: 120px; background-color:${x}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${y}</span>\n                    </a>\n                    <a id="hasWatchBtn" class="menu-btn" style="width: 120px; background-color:${S}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${k}</span>\n                    </a>\n                </div>\n        \n                <div style="display: flex; gap: 10px; flex-wrap:wrap;">\n                    <a id="enable-magnets-filter" class="menu-btn" style="width: 140px; background-color: #c2bd4c; color: white; text-align: center; padding: 8px 0;">\n                        <span id="magnets-span">关闭磁力过滤</span>\n                    </a>\n                    <a id="magnetSearchBtn" class="menu-btn" style="width: 120px; background: linear-gradient(to right, rgb(245,140,1), rgb(84,161,29)); color: white; text-align: center; padding: 8px 0;">\n                        <span>磁力搜索</span>\n                    </a>\n                    <a id="xunLeiSubtitleBtn" class="menu-btn" style="width: 120px; background: linear-gradient(to left, #375f7c, #2196F3); color: white; text-align: center; padding: 8px 0;">\n                        <span>字幕 (迅雷)</span>\n                    </a>\n                    <a id="search-subtitle-btn" class="menu-btn" style="width: 160px; background: linear-gradient(to bottom, #8d5656, rgb(196,159,91)); color: white; text-align: center; padding: 8px 0;">\n                        <span>字幕 (SubTitleCat)</span>\n                    </a>\n                </div>\n            </div>\n        `;
        r && $(".tabs").after(n), l && $("#mag-submit-show").before(n), $("#favoriteBtn").on("click", (() => this.favoriteOne())),
        $("#filterBtn").on("click", (e => this.filterOne(e))), $("#hasDownBtn").on("click", (async () => this.hasDownOne())),
        $("#hasWatchBtn").on("click", (async () => this.hasWatchOne())), $("#magnetSearchBtn").on("click", (() => {
            let t = this.getBean("MagnetHubPlugin").createMagnetHub(e.carNum);
            layer.open({
                type: 1,
                title: "磁力搜索 " + e.carNum,
                content: '<div id="magnetHubBox"></div>',
                area: utils.getResponsiveArea([ "60%", "80%" ]),
                scrollbar: !1,
                success: () => {
                    $("#magnetHubBox").append(t);
                }
            });
        }));
        const a = this.getBean("HighlightMagnetPlugin"), i = await storageManager.getSetting("enableMagnetsFilter", _);
        $("#magnets-span").text(i === _ ? "关闭磁力过滤" : "开启磁力过滤"), i === _ && a.doFilterMagnet(),
        $("#enable-magnets-filter").on("click", (e => {
            let t = $("#magnets-span");
            "关闭磁力过滤" === t.text() ? (a.showAll(), t.text("开启磁力过滤"), storageManager.saveSettingItem("enableMagnetsFilter", C)) : (a.doFilterMagnet(),
            t.text("关闭磁力过滤"), storageManager.saveSettingItem("enableMagnetsFilter", _));
        })), $("#search-subtitle-btn").on("click", (e => utils.openPage(`https://subtitlecat.com/index.php?search=${t}`, t, !1, e))),
        $("#xunLeiSubtitleBtn").on("click", (() => this.searchXunLeiSubtitle(t))), this.showStatus(t).then();
    }
    async showStatus(e) {
        const t = $("#filterBtn span"), n = $("#favoriteBtn span"), a = $("#hasDownBtn span"), i = $("#hasWatchBtn span"), s = e => e ? `(${e})` : "";
        t.text(`${m} ${s(this.filterHotKey)}`), n.text(`${v} ${s(this.favoriteHotKey)}`),
        a.text(`${y} ${s(this.hasDownHotKey)}`), i.text(`${k} ${s(this.hasWatchHotKey)}`);
        const o = await storageManager.getCar(e);
        if (o) switch (o.status) {
          case d:
            t.text(`${u} ${s(this.filterHotKey)}`);
            break;

          case h:
            n.text(`${b} ${s(this.favoriteHotKey)}`);
            break;

          case g:
            a.text(`📥️ 已标记下载 ${s(this.hasDownHotKey)}`);
            break;

          case p:
            i.text(`🔍 已标记观看 ${s(this.hasWatchHotKey)}`);
        }
    }
    async favoriteOne() {
        try {
            let e = this.getPageInfo();
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: h,
                publishTime: e.publishTime
            }), this.showStatus(e.carNum).then(), window.refresh(), utils.closePage();
        } catch (t) { console.error("收藏操作失败:", t), show.error("操作失败"); }
    }
    async hasDownOne() {
        try {
            let e = this.getPageInfo();
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: g,
                publishTime: e.publishTime
            }), this.showStatus(e.carNum).then(), window.refresh(), utils.closePage();
        } catch (t) { console.error("标记已下载失败:", t), show.error("操作失败"); }
    }
    async hasWatchOne() {
        try {
            let e = this.getPageInfo();
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: p,
                publishTime: e.publishTime
            }), this.showStatus(e.carNum).then(), window.refresh(), utils.closePage();
        } catch (t) { console.error("标记已观看失败:", t), show.error("操作失败"); }
    }
    searchXunLeiSubtitle(e) {
        let t = loading();
        gmHttp.get(`https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${e}`).then((t => {
            let n = t.data;
            n && 0 !== n.length ? layer.open({
                type: 1,
                title: "迅雷字幕",
                content: '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="xunlei-table-container" style="height: 100%;padding-bottom: 20px"></div>\n                    </div>\n                ',
                scrollbar: !1,
                area: utils.getResponsiveArea([ "60%", "70%" ]),
                anim: -1,
                success: (t, a) => {
                    new Tabulator("#xunlei-table-container", {
                        layout: "fitColumns",
                        placeholder: "暂无数据",
                        virtualDom: !0,
                        data: n,
                        responsiveLayout: "collapse",
                        responsiveLayoutCollapse: !0,
                        columnDefaults: {
                            headerHozAlign: "center",
                            hozAlign: "center"
                        },
                        columns: [ {
                            title: "文件名",
                            field: "name",
                            headerSort: !1,
                            responsive: 0
                        }, {
                            title: "类型",
                            field: "ext",
                            headerSort: !1,
                            responsive: 0
                        }, {
                            title: "操作",
                            responsive: 0,
                            headerSort: !1,
                            formatter: (t, n, a) => {
                                const i = t.getData();
                                return a((() => {
                                    const n = t.getElement().querySelector(".a-primary"), a = t.getElement().querySelector(".a-success");
                                    n && n.addEventListener("click", (async t => {
                                        let n = i.url, a = e + "." + i.ext;
                                        this.previewSubtitle(n, a);
                                    })), a && a.addEventListener("click", (async t => {
                                        let n = i.url, a = e + "." + i.ext, s = await gmHttp.get(n);
                                        utils.download(s, a);
                                    }));
                                })), '\n                                        <a class="a-primary">预览</a>\n                                        <a class="a-success">下载</a>\n                                    ';
                            }
                        } ],
                        locale: "zh-cn",
                        langs: {
                            "zh-cn": {
                                pagination: {
                                    first: "首页",
                                    first_title: "首页",
                                    last: "尾页",
                                    last_title: "尾页",
                                    prev: "上一页",
                                    prev_title: "上一页",
                                    next: "下一页",
                                    next_title: "下一页",
                                    all: "所有",
                                    page_size: "每页行数"
                                }
                            }
                        }
                    }), utils.setupEscClose(a);
                }
            }) : show.error("迅雷中找不到相关字幕!");
        })).catch((e => {
            console.error(e), show.error(e);
        })).finally((() => {
            t.close();
        }));
    }
    async filterOne(e, t) {
        e && e.preventDefault();
        let n = this.getPageInfo();
        t ? (await storageManager.saveCar({
            carNum: n.carNum,
            url: n.url,
            names: n.actress,
            actionType: d,
            publishTime: n.publishTime
        }), this.showStatus(n.carNum).then(), window.refresh(), utils.closePage(), layer.closeAll(),
        this.answerCount = 1) : utils.q(e, `是否屏蔽${n.carNum}?`, (async () => {
            await storageManager.saveCar({
                carNum: n.carNum,
                url: n.url,
                names: n.actress,
                actionType: d,
                publishTime: n.publishTime
            }), this.showStatus(n.carNum).then(), window.refresh(), utils.closePage();
        }), (() => {
            this.answerCount = 1;
        }));
    }
    speedVideo() {
        if ($("#preview-video").is(":visible")) {
            const e = document.getElementById("preview-video");
            return void (e && (e.muted = !1, e.controls = !1, e.currentTime + 5 < e.duration ? e.currentTime += 5 : (show.info("预览视频结束, 已回到开头"),
            e.currentTime = 1)));
        }
        const e = $('iframe[id^="layui-layer-iframe"]');
        if (e.length > 0) return void e[0].contentWindow.postMessage("speedVideo", "*");
        let t = $(".preview-video-container");
        if (t.length > 0) {
            t[0].click();
            const e = document.getElementById("preview-video");
            e && (e.currentTime += 5, e.muted = !1);
        } else $("#javTrailersBtn").click();
    }
    hideVideoControls() {
        $(document).on("mouseenter", "#preview-video", (function() {
            $(this).prop("controls", !0);
        }));
    }
    async bindHotkey() {
        const e = {};
        this.filterHotKey && (e[this.filterHotKey] = () => {
            this.answerCount >= 2 ? this.filterOne(null, !0) : this.filterOne(null), this.answerCount++;
        }), this.favoriteHotKey && (e[this.favoriteHotKey] = () => this.favoriteOne(null)),
        this.hasDownHotKey && (e[this.hasDownHotKey] = () => this.hasDownOne()), this.hasWatchHotKey && (e[this.hasWatchHotKey] = () => this.hasWatchOne()),
        this.speedVideoHotKey && (e[this.speedVideoHotKey] = () => this.speedVideo());
        const t = (e, t) => {
            se.registerHotkey(e, (n => {
                const a = document.activeElement;
                "INPUT" === a.tagName || "TEXTAREA" === a.tagName || a.isContentEditable || (window.isDetailPage ? t() : (e => {
                    const t = $(".layui-layer-content iframe");
                    0 !== t.length && t[0].contentWindow.postMessage(e, "*");
                })(e));
            }));
        };
        window.isDetailPage && window.addEventListener("message", (t => {
            e[t.data] && e[t.data]();
        })), Object.entries(e).forEach((([e, n]) => {
            t(e, n);
        }));
    }
    async previewSubtitle(e, t) {
        if (!e) return void console.error("未提供文件URL");
        const n = e.split(".").pop().toLowerCase();
        if ("ass" === n || "srt" === n) try {
            let a = await gmHttp.get(e), i = "字幕预览";
            "ass" === n ? i = "ASS字幕预览 - " + t : "srt" === n && (i = "SRT字幕预览 - " + t);
            const s = a.split("\n");
            let o = "";
            const r = String(s.length).length;
            s.forEach(((e, t) => {
                const n = String(t + 1).padStart(r, " ");
                o += `<span style="color:#AAA;">${n}. </span>${e}\n`;
            }));
            const l = o;
            layer.open({
                type: 1,
                title: i,
                area: [ "80%", "80%" ],
                scrollbar: !1,
                content: `<div style="padding:15px 5px;background:#1E1E1E;color:#FFF;font-family:Consolas,Monaco,monospace;white-space:pre-wrap;overflow:auto;height:100%;">${l}</div>`,
                btn: [ "下载", "关闭" ],
                btn1: function(e, n, i) {
                    return utils.download(a, t), !1;
                }
            });
        } catch (a) {
            show.error(`预览失败: ${a.message}`), console.error("预览字幕文件出错:", a);
        } else show.error("仅支持预览ASS和SRT字幕文件");
    }
}

class xe extends X {
    constructor() {
        super(...arguments), i(this, "tableObj", null);
    }
    getName() {
        return "HistoryPlugin";
    }
    async initCss() {
        return "\n            <style>\n                /* 下拉菜单容器（相对定位） */\n                .sub-btns {\n                    position: relative;\n                    display: inline-block;\n                }\n                \n                /* 下拉菜单内容（默认隐藏） */\n                .sub-btns-menu {\n                    display: none;\n                    position: absolute;\n                    right: 80px;\n                    top:-10px;\n                    background: white;\n                    padding:10px;\n                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);\n                    z-index: 100;\n                    border-radius: 4px;\n                    overflow: hidden;\n                }\n                \n                \n                /* 点击后显示菜单（JS 控制） */\n                .sub-btns-menu.show {\n                    display: flex !important;\n                    flex-direction: column;\n                }\n                \n                .table-link-param {\n                    cursor: pointer;\n                }\n            </style\n        ";
    }
    handleResize() {
        $(".navbar-search").is(":hidden") ? ($(".historyBtnBox").show(), $(".miniHistoryBtnBox").hide()) : ($(".historyBtnBox").hide(),
        $(".miniHistoryBtnBox").show());
    }
    handle() {
        r && ($(".navbar-end").prepend('<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <a id="historyBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-right:15px !important;">\n                        鉴定记录\n                    </a>\n                </div>'),
        $(".navbar-search").css("margin-left", "0").before('\n                <div class="navbar-item miniHistoryBtnBox">\n                    <a id="miniHistoryBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-left:0 !important;padding-right:0 !important;">\n                        鉴定记录\n                    </a>\n                </div>\n            '),
        this.handleResize(), $(window).resize((() => {
            this.handleResize();
        })), $("#historyBtn,#miniHistoryBtn").on("click", (e => this.openHistory()))), l && utils.loopDetector((() => $("#setting-btn").length), (() => {
            $("#top-right-box").append('\n                    <a id="historyBtn" class="menu-btn main-tab-btn" style="background-color:#b68625 !important;">\n                        鉴定记录\n                    </a>\n               '),
            $("#historyBtn,#miniHistoryBtn").on("click", (e => this.openHistory()));
        }), 1, 1e4, !1), this.bindClick();
    }
    openHistory() {
        let e = `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div id="filterBox" style="display: flex;gap: 5px;">\n                    <select id="dataType" style="text-align: center;min-width: 150px;">\n                        <option value="all" selected>所有</option>\n                        <option value="filter">${u}</option>\n                        <option value="favorite">${b}</option>\n                        <option value="hasDown">${y}</option>\n                        <option value="hasWatch">${k}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" style="padding: 4px 5px;">\n                    <a id="clearSearchbtn" class="a-info" style="margin-left: 0">重置</a>\n                </div>\n                <div id="allSelectBox" style="margin-top: 8px;display: none">\n                    <a class="menu-btn multiple-history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                    <a class="menu-btn multiple-history-hasWatchBtn" style="background-color:${S};margin-bottom: 5px">${k}</a>\n                    <a class="menu-btn multiple-history-hasDownBtn" style="background-color:${x};margin-bottom: 5px">${y}</a>\n                    <a class="menu-btn multiple-history-favoriteBtn" style="background-color:${w};margin-bottom: 5px">${v}</a>\n                    <a class="menu-btn multiple-history-filterBtn" style="background-color:${f};margin-bottom: 5px">${m}</a>\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px); overflow-x:hidden;"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "鉴定记录",
            content: e,
            scrollbar: !1,
            shadeClose: !0,
            area: utils.getResponsiveArea([ "70%", "90%" ]),
            anim: -1,
            success: async e => {
                await this.loadTableData(), $(".layui-layer-content").on("click", "#clearSearchbtn", (async e => {
                    $("#searchCarNum").val(""), $("#dataType").val("all"), await this.reloadTable(),
                    $("#allSelectBox").hide();
                })).on("focusout keydown", "#searchCarNum", (async e => {
                    if ("focusout" === e.type || "Enter" === e.key) {
                        if ("Enter" === e.key && e.preventDefault(), "keydown" === e.type && "Enter" !== e.key) return;
                        await this.reloadTable();
                    }
                })).on("click", ".table-link-param", (async e => {
                    let t = $(e.currentTarget);
                    $("#searchCarNum").val(t.text()), await this.reloadTable();
                })).on("change", "#dataType", (async () => {
                    await this.reloadTable();
                }));
            },
            end: () => {
                this.tableObj && (this.tableObj.destroy(), this.tableObj = null), window.refresh();
            }
        });
    }
    async reloadTable() {
        this.tableObj.deselectRow(), this.tableObj.setPage(1);
    }
    bindClick() {
        document.addEventListener("click", (function(e) {
            if (e.target.closest(".sub-btns-toggle")) {
                const t = e.target.closest(".sub-btns").querySelector(".sub-btns-menu");
                document.querySelectorAll(".sub-btns-menu.show").forEach((e => {
                    e !== t && e.classList.remove("show");
                })), t.classList.toggle("show");
            } else document.querySelectorAll(".sub-btns-menu.show").forEach((e => {
                e.classList.remove("show");
            }));
        })), $(document).on("click", ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasDownBtn, .history-hasWatchBtn, .history-detailBtn", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget), n = t.closest(".action-btns"), a = n.attr("data-car-num"), i = n.attr("data-href"), s = async e => {
                try {
                    await storageManager.saveCar({
                        carNum: a,
                        url: i,
                        names: null,
                        actionType: e
                    }), window.refresh(), await this.reloadTable();
                } catch (s) { console.error("历史记录操作失败:", s), show.error("操作失败"); }
            };
            t.hasClass("history-filterBtn") ? utils.q(e, `是否屏蔽${a}?`, (() => s(d))) : t.hasClass("history-favoriteBtn") ? s(h).then() : t.hasClass("history-hasDownBtn") ? s(g).then() : t.hasClass("history-hasWatchBtn") ? s(p).then() : t.hasClass("history-deleteBtn") ? this.handleDelete(e, a) : t.hasClass("history-detailBtn") && this.handleClickDetail(e, {
                carNum: a,
                url: i
            }).then();
        })), $(document).on("click", ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasDownBtn, .multiple-history-hasWatchBtn", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget);
            let n = this.tableObj.getSelectedData(), a = "", i = "";
            t.hasClass("multiple-history-filterBtn") ? (a = "屏蔽", i = d) : t.hasClass("multiple-history-favoriteBtn") ? (a = "收藏",
            i = h) : t.hasClass("multiple-history-hasDownBtn") ? (a = "已下载", i = g) : t.hasClass("multiple-history-hasWatchBtn") ? (a = "已观看",
            i = p) : t.hasClass("multiple-history-deleteBtn") && (a = "移除", i = "delete"), utils.q(e, `当前已勾选${n.length}条数据, 是否全标记为 ${a}?`, (async () => {
                let e = loading();
                try {
                    if ("delete" === i) {
                        const e = n.map((e => e.carNum)), t = await storageManager.batchRemoveCars(e);
                        t > 0 ? show.ok(`已成功删除 ${t} 个番号`) : !1 === t && show.error("提供的番号中没有一个存在于列表中。");
                    } else {
                        const e = JSON.parse(JSON.stringify(n));
                        e.forEach((e => {
                            e.actionType = i;
                        })), await storageManager.saveCarList(e), show.ok("操作成功");
                    }
                    this.tableObj.deselectRow(), this.reloadTable().then();
                } catch (t) {
                    console.error(t);
                } finally {
                    e.close();
                }
            }));
        }));
    }
    async getDataList(e, t, n) {
        let a = await storageManager.getCarList();
        this.allCount = a.length, this.filterCount = 0, this.favoriteCount = 0, this.hasDownCount = 0,
        this.hasWatchCount = 0, this.waitCheckCount = 0, a.forEach((e => {
            switch (e.status) {
              case d:
                this.filterCount++;
                break;

              case h:
                this.favoriteCount++;
                break;

              case g:
                this.hasDownCount++;
                break;

              case p:
                this.hasWatchCount++;
                break;

              default:
                this.waitCheckCount++;
            }
        })), $('#dataType option[value="all"]').text(`所有 (${this.allCount})`), $('#dataType option[value="waitCheck"]').text(`待鉴定 (${this.waitCheckCount})`),
        $('#dataType option[value="filter"]').text(`${u} (${this.filterCount})`),
        $('#dataType option[value="favorite"]').text(`${b} (${this.favoriteCount})`), $('#dataType option[value="hasDown"]').text(`${y} (${this.hasDownCount})`),
        $('#dataType option[value="hasWatch"]').text(`${k} (${this.hasWatchCount})`);
        const i = $("#dataType").val();
        let s = "all" === i ? a : "waitCheck" === i ? a.filter((e => "" === e.status || !e.status)) : a.filter((e => e.status === i));
        const o = $("#searchCarNum").val().trim();
        if (o) {
            let e = o.toLowerCase().replace("-c", "").replace("-uc", "").replace("-4k", "");
            s = s.filter((t => {
                const n = t.carNum.toLowerCase().includes(e);
                const a = (t.names ? t.names : "").toLowerCase().includes(e);
                return n || a;
            }));
        }
        if (n && n.length > 0) {
            const e = n[0], t = e.field, a = e.dir;
            s.sort(((e, n) => {
                const i = e[t], s = n[t], o = null == i || "" === i, r = null == s || "" === s;
                return o && !r ? 1 : !o && r ? -1 : o && r ? 0 : i < s ? "asc" === a ? -1 : 1 : i > s ? "asc" === a ? 1 : -1 : 0;
            }));
        }
        const r = s.length, l = Math.ceil(r / t), c = (e - 1) * t, m = c + t;
        return s = s.slice(c, m), {
            maxPage: l,
            dataList: s,
            totalCount: r
        };
    }
    async loadTableData() {
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: !0,
            pagination: !0,
            paginationMode: "remote",
            sortMode: "remote",
            ajaxURL: "queryRealm",
            dataLoader: !1,
            ajaxRequestFunc: async (e, t, n) => {
                const a = n.page, i = n.size, s = n.sort;
                return await this.getDataList(a, i, s);
            },
            dataReceiveParams: {
                last_page: "maxPage",
                last_row: "totalCount",
                data: "dataList"
            },
            paginationSize: 50,
            paginationSizeSelector: [ 50, 100, 1e3, 99999 ],
            paginationCounter: (e, t, n, a, i) => `共 ${a} 条记录`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: !0,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            selectableRowsPersistence: !1,
            index: "carNum",
            columns: [ {
                formatter: "rowSelection",
                titleFormatter: "rowSelection",
                hozAlign: "center",
                headerSort: !1,
                responsive: 0,
                width: 40,
                titleFormatterParams: {
                    rowRange: "active"
                },
                cellClick: (e, t) => {
                    t.getRow().toggleSelect();
                }
            }, {
                title: "番号",
                field: "carNum",
                width: 120,
                sorter: "string",
                responsive: 0,
                formatter: (e, t, n) => {
                    const a = e.getData().carNum, i = a.indexOf("-");
                    if (-1 === i) return a;
                    return `<a class="table-link-param">${a.substring(0, i + 1)}</a>${a.substring(i + 1)}`;
                }
            }, {
                title: "演员",
                field: "names",
                minWidth: 200,
                sorter: "string",
                responsive: 5,
                headerSort: !0,
                formatter: (e, t, n) => (e.getData().names || "").split(" ").filter((e => "" !== e.trim())).map((e => `<a class="table-link-param">${e}</a>`)).join(" ")
            }, {
                title: "创建时间",
                field: "createDate",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "修改时间",
                field: "updateDate",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "发行时间",
                field: "publishTime",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "来源",
                field: "url",
                width: 80,
                sorter: "string",
                responsive: 5,
                hozAlign: "left",
                formatter: (e, t, n) => {
                    let a = e.getData().url;
                    return a ? a.includes("javdb") ? '<span style="color:#d34f9e">Javdb</span>' : a.includes("javbus") ? '<span style="color:#eaa813">JavBus</span>' : a.includes("123av") ? '<span style="color:#eaa813">123Av</span>' : `<span style="color:#050505">${a}</span>` : "";
                }
            }, {
                title: "状态",
                field: "status",
                width: 100,
                sorter: "string",
                responsive: 1,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData().status;
                    let i = "", s = "";
                    switch (a) {
                      case "filter":
                        i = f, s = m;
                        break;

                      case "favorite":
                        i = w, s = v;
                        break;

                      case "hasDown":
                        i = x, s = y;
                        break;

                      case "hasWatch":
                        i = S, s = k;
                        break;

                      default:
                        s = a;
                    }
                    return `<span style="color:${i}">${s}</span>`;
                }
            }, {
                title: "备注",
                field: "remark",
                width: 100,
                sorter: "string",
                responsive: 6
            }, {
                title: "操作",
                sorter: "string",
                minWidth: 150,
                cssClass: "action-cell-dropdown",
                responsive: 0,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData();
                    return n((() => {
                        var t;
                        null == (t = e.getElement().querySelector(".history-editBtn")) || t.addEventListener("click", (e => {
                            this.editRecord(a);
                        }));
                    })), `\n                            <div class="action-btns" style="display: flex; gap: 5px;justify-content:center" data-car-num="${a.carNum}" data-href="${a.url ? a.url : ""}">\n                                <div class="sub-btns">\n                                    <a class="menu-btn sub-btns-toggle" style="background-color:#c59d36; color:white; margin-bottom: 5px;">\n                                        <span>✏️ 变更</span>\n                                    </a>\n                                    <div class="sub-btns-menu">\n                                        <a class="menu-btn history-editBtn" style="background-color:#007bff; color:white; margin-bottom: 5px;"> <span>✏️ 编辑</span> </a>\n                                        <a class="menu-btn history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                                        <a class="menu-btn history-hasWatchBtn" style="background-color:${S};margin-bottom: 5px">${k}</a>\n                                        <a class="menu-btn history-hasDownBtn" style="background-color:${x};margin-bottom: 5px">${y}</a>\n                                        <a class="menu-btn history-favoriteBtn" style="background-color:${w};margin-bottom: 5px">${v}</a>\n                                        <a class="menu-btn history-filterBtn" style="background-color:${f};margin-bottom: 5px">${m}</a>\n                                    </div>\n                                </div>\n                                \n                                <a class="menu-btn history-detailBtn" style="background-color:#3397de; color:white; margin-bottom: 5px;"> <span>📄 详情页</span> </a>\n                                \n                            </div>\n                        `;
                }
            } ],
            initialSort: [ {
                column: "updateDate",
                dir: "desc"
            } ],
            locale: "zh-cn",
            langs: {
                "zh-cn": {
                    pagination: {
                        first: "首页",
                        first_title: "首页",
                        last: "尾页",
                        last_title: "尾页",
                        prev: "上一页",
                        prev_title: "上一页",
                        next: "下一页",
                        next_title: "下一页",
                        all: "所有",
                        page_size: "每页行数"
                    }
                }
            }
        }), this.tableObj.on("rowSelectionChanged", ((e, t, n, a) => {
            const i = $("#allSelectBox"), s = $("#filterBox");
            e && e.length > 0 ? (s.hide(), i.show()) : (s.show(), i.hide());
        })), this.tableObj.on("rowDblClick", (function(e, t) {
            t.toggleSelect();
        })), this.tableObj.on("tableBuilt", (async () => {}));
    }
    handleDelete(e, t) {
        utils.q(e, `是否移除${t}?`, (async () => {
            await storageManager.removeCar(t), this.getBean("ListPagePlugin").showCarNumBox(t),
            this.reloadTable(null).then();
        }));
    }
    async handleClickDetail(e, t) {
        if (r) if (t.carNum.includes("FC2-")) {
            const e = this.parseMovieId(t.url);
            this.getBean("Fc2Plugin").openFc2Dialog(e, t.carNum, t.url);
        } else {
            if (!t.url) return void window.open("/search?q=" + t.carNum, "_blank");
            utils.openPage(t.url, t.carNum, !1, e);
        }
        if (l) {
            let n = t.url;
            if (n.includes("javdb")) if (t.carNum.includes("FC2-")) {
                const e = this.parseMovieId(n);
                await this.getBean("Fc2Plugin").openFc2Page(e, t.carNum, n);
            } else window.open(n, "_blank"); else utils.openPage(t.url, t.carNum, !1, e);
        }
    }
    async editRecord(e) {
        const t = e.carNum, n = e.names || "", a = e.url || "", i = e.status, s = e.remark || "", o = "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;", r = "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;", l = [ {
            value: d,
            text: m
        }, {
            value: h,
            text: v
        }, {
            value: g,
            text: y
        }, {
            value: p,
            text: k
        } ];
        clog.debug(l);
        const c = `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">番号:</label>\n                    <input type="text" id="edit-carNum" value="${t}" style="${r} background-color: #f0f0f0;" readonly>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员 (用空格隔开):</label>\n                    <textarea id="edit-names" style="${o}">${n}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">状态:</label>\n                    <select id="edit-status" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${"" === i ? "selected" : ""}>-- 请选择 --</option>\n                        ${l.map((e => `\n                            <option value="${e.value}" ${i === e.value ? "selected" : ""}>${e.text}</option>\n                        `)).join("")}\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">链接:</label>\n                    <input type="text" id="edit-url" value="${a}" style="${r}">\n                </div>\n                \n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                    <textarea id="edit-remark" style="${o}">${s}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑记录: ${t}`,
            area: [ "500px", "650px" ],
            content: c,
            btn: [ "保存", "取消" ],
            success: (e, t) => {
                const n = e => {
                    e.css("height", "auto"), e.css("height", e[0].scrollHeight + 15 + "px");
                }, a = $("#edit-names");
                a.on("input", (function() {
                    n($(this));
                })), n(a);
                const i = $("#edit-remark");
                i.on("input", (function() {
                    n($(this));
                })), n(i);
            },
            yes: async t => {
                const n = $("#edit-names").val().trim(), a = $("#edit-status").val(), i = $("#edit-url").val().trim(), s = $("#edit-remark").val().trim();
                if (!a) return show.error("请选择状态"), !1;
                const o = {
                    ...e,
                    names: n,
                    actionType: a,
                    url: i,
                    remark: s
                };
                await storageManager.updateCarInfo(o), this.tableObj.setData(), layer.close(t);
            }
        });
    }
}

class $e extends X {
    constructor() {
        super(...arguments), i(this, "floorIndex", 1), i(this, "isInit", !1);
    }
    getName() {
        return "ReviewPlugin";
    }
    async handle() {
        if (window.isDetailPage) {
            if (r) {
                const e = this.parseMovieId(window.location.href);
                await this.showReview(e), await this.getBean("RelatedPlugin").showRelated($("#magnets-content"), e);
            }
            if (l) {
                let e = this.getPageInfo().carNum;
                const t = await (async e => {
                    let t = `${U}/v2/search`, n = {
                        "user-agent": "Dart/3.5 (dart:io)",
                        "accept-language": "zh-TW",
                        host: "jdforrepam.com",
                        jdsignature: await O()
                    }, a = {
                        q: e,
                        page: 1,
                        type: "movie",
                        limit: 1,
                        movie_type: "all",
                        from_recent: "false",
                        movie_filter_by: "all",
                        movie_sort_by: "relevance"
                    };
                    return (await gmHttp.get(t, a, n)).data.movies;
                })(e);
                let n = null;
                for (let a = 0; a < t.length; a++) {
                    let i = t[a];
                    if (i.number.toLowerCase() === e.toLowerCase()) {
                        n = i.id;
                        break;
                    }
                }
                if (!n) return;
                this.showReview(n, $("#sample-waterfall")).then();
            }
        }
    }
    async showReview(e, t) {
        const n = await storageManager.getSetting("enableLoadReview", _), a = t || $("#magnets-content");
        a.append(`\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;" data-tip="想要发表评论? 滑上去, 点击上面的按钮-看过">❓ 评论区</span>\n                <a id="reviewsFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${n === _ ? "折叠" : "展开"}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${n === _ ? "▲" : "▼"}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `),
        $("#reviewsFold").on("click", (t => {
            t.preventDefault(), t.stopPropagation();
            const n = $("#reviewsFold .toggle-text"), a = $("#reviewsFold .toggle-icon"), i = "展开" === n.text();
            n.text(i ? "折叠" : "展开"), a.text(i ? "▲" : "▼"), i ? ($("#reviewsContainer").show(),
            $("#reviewsFooter").show(), this.isInit || (this.fetchAndDisplayReviews(e), this.isInit = !0),
            storageManager.saveSettingItem("enableLoadReview", _)) : ($("#reviewsContainer").hide(),
            $("#reviewsFooter").hide(), storageManager.saveSettingItem("enableLoadReview", C));
        })), a.append('<div id="reviewsContainer"></div>'), a.append('<div id="reviewsFooter"></div>'),
        n === _ && await this.fetchAndDisplayReviews(e);
    }
    async fetchAndDisplayReviews(e) {
        const t = $("#reviewsContainer"), n = $("#reviewsFooter");
        t.append('<div id="reviewsLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取评论中...</div>');
        const a = await storageManager.getSetting("reviewCount", 20);
        let i = null;
        try {
            i = await R(e, 1, a);
        } catch (o) {
            o.toString().includes("簽名已過期") && show.error("生成签名失败, 请检查系统时间及时区是否正确!"), clog.error("获取评论失败:", o),
            console.error("获取评论失败:", o);
        } finally {
            $("#reviewsLoading").remove();
        }
        if (!i) return t.append('\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取评论失败\n                    <a id="retryFetchReviews" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            '),
        void $("#retryFetchReviews").on("click", (async () => {
            $("#retryFetchReviews").parent().remove(), await this.fetchAndDisplayReviews(e);
        }));
        if (0 === i.length) return void t.append('<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无评论</div>');
        const s = await storageManager.getReviewFilterKeywordList();
        if (this.displayReviews(i, t, s), i.length === a) {
            n.html('\n                <button id="loadMoreReviews" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多评论\n                </button>\n                <div id="reviewsEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>\n            ');
            let i = 1, r = $("#loadMoreReviews");
            r.on("click", (async () => {
                let n;
                r.text("加载中...").prop("disabled", !0), i++;
                try {
                    n = await R(e, i, a);
                } catch (o) {
                    console.error("加载更多评论失败:", o);
                } finally {
                    r.text("加载失败, 请点击重试").prop("disabled", !1);
                }
                n && (this.displayReviews(n, t, s), n.length < a ? (r.remove(), $("#reviewsEnd").show()) : r.text("加载更多评论").prop("disabled", !1));
            }));
        } else n.html('<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>');
    }
    displayReviews(e, t, n) {
        if (!e.length) return;
        const o = [];
        e.forEach((e => {
            if (n.some((t => e.content.includes(t)))) return;
            const a = Array(e.score).fill('<i class="icon-star"></i>').join(""), i = e.content.replace(/ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+/g, (e => e.startsWith("ed2k://") ? `\n                            <span style="word-break: break-all;background: #e0f2fe;color: #0369a1;">${e}</span>\n\n                        ` : e.startsWith("magnet:") ? `\n                            <a href="${e}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${e}</a>\n\n                        ` : e.startsWith("http://") || e.startsWith("https://") ? `\n                            <a href="${e}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${e}</a>\n                        ` : e)), s = `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                    <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${this.floorIndex++}楼</span>\n                    ${e.username} &nbsp;&nbsp; <span class="score-stars">${a}</span> \n                    <span class="time">${utils.formatDate(e.created_at)}</span> \n                    &nbsp;&nbsp; 点赞:${e.likes_count}\n                    <p class="review-content" style="margin-top: 5px;"> ${i} </p>\n                </div>\n            `;
            o.push(s);
        })), o.length && t.append(o.join("")), this.rightClickFilter();
    }
    async rightClickFilter() {
        await storageManager.getSetting("enableTitleSelectFilter", _) === _ && utils.rightClick(document.body, ".review-content", (async e => {
            const t = window.getSelection().toString();
            t && (e.preventDefault(), await utils.q(e, `是否将 '${t}' 加入评论区关键词?`, (async () => {
                await storageManager.saveReviewFilterKeyword(t), show.ok("操作成功, 刷新页面后生效");
            })));
        }));
    }
}

class ke extends X {
    getName() {
        return "FilterTitleKeywordPlugin";
    }
    async handle() {
        if (!isDetailPage && !isFc2Page) return;
        if (await storageManager.getSetting("enableTitleSelectFilter", _) !== _) return;
        let e;
        r ? e = ".title strong, .current-title" : l && (e = "h3"), utils.rightClick(document.body, e, (e => {
            const t = window.getSelection().toString();
            if (t) {
                e.preventDefault();
                let n = {
                    clientX: e.clientX,
                    clientY: e.clientY + 80
                };
                utils.q(n, `是否屏蔽标题关键词 ${t}?`, (async () => {
                    await storageManager.saveTitleFilterKeyword(t), window.refresh(), utils.closePage();
                }));
            }
        }));
    }
}

class Se extends X {
    getName() {
        return "BlacklistPlugin";
    }
    async addBlacklist(e) {
        let t = {
            clientX: e.clientX,
            clientY: e.clientY + 80
        };
        const n = $("#addBlacklistBtn span").text().includes("已加入");
        let a, i;
        if (o.includes("/tags")) {
            const e = new URL(o);
            e.searchParams.delete("page");
            const t = $("#jhs-check-tag").text().trim();
            a = {
                starId: "no-" + t,
                name: "虚拟演员-" + t,
                allName: [ "虚拟演员" ],
                role: "虚拟演员",
                movieType: t,
                blacklistUrl: e.toString()
            }, i = `是否将分类 <span style="color: #f40">${t}</span> 加入到黑名单中?`, n && (i = `分类 <span style="color: #f40">${t}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
        } else a = this.getActressPageInfo(), i = `是否将该演员 <span style="color: #f40">${a.name}</span> 加入到黑名单中?`,
        n && (i = `演员 <span style="color: #f40">${a.name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
        const {starId: s, name: r, allName: c, role: d, movieType: h, blacklistUrl: g} = a;
        if (o.includes("page") && !o.includes("page=1") && (i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始"),
        l) {
            const e = o.split("/star/")[1].split("/");
            if (e.length > 1) {
                parseInt(e[1]) > 1 && (i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始");
            }
        }
        utils.q(t, i, (async () => {
            const e = this.getBean("TaskPlugin");
            navigator.locks.request(e.singleTaskKey, {
                ifAvailable: !0
            }, (async e => {
                if (clog.debug("获取锁", e), e) {
                    this.loadObj = loading();
                    try {
                        await storageManager.addBlacklistItem({
                            starId: s,
                            name: r,
                            allName: c,
                            role: d,
                            movieType: h,
                            url: g
                        }), await this.filterActorVideo(r, s);
                        const e = show.ok(`屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`, {
                            duration: -1,
                            close: !0,
                            onClick: () => {
                                e.closeShow(), window.location.href = this.lastPageLink;
                            }
                        });
                    } catch (t) {
                        clog.error(t);
                        const e = show.error("发生错误, 是否填转到解析失败的那一页? (点击并跳转)", {
                            duration: -1,
                            close: !0,
                            onClick: () => {
                                e.closeShow(), window.location.href = this.nextPageLink;
                            }
                        });
                    } finally {
                        this.loadObj.close();
                    }
                } else show.error("当前有定时任务在后台执行中, 无法发起此操作");
            })).catch((e => {
                console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
            }));
        }));
    }
    async resetBtnTip() {
        const e = this.getBean("TaskPlugin"), t = localStorage.getItem(e.lastCheckBlacklistTimeKey) || "无", n = await storageManager.getSetting("checkBlacklist_intervalTime", 12);
        this.checkBlacklist_ruleTime = await storageManager.getSetting("checkBlacklist_ruleTime", 8760),
        $("#checkBlacklistBtn").attr("data-tip", `上次检测时间: ${t}; 检测间隔时间: ${n}小时`);
    }
    async openBlacklistDialog() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting();
        let n = `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div style="display: flex;justify-content: space-between;">\n                    <div style="display: flex; gap:5px">\n                        <a id="checkBlacklistBtn" class="a-danger" data-tip="上次检测时间: ${localStorage.getItem(e.lastCheckBlacklistTimeKey) || "无"}; 检测间隔时间: ${t.checkBlacklist_intervalTime}小时">${this.blacklistSvg} &nbsp;手动检测黑名单</a>\n                        <a class="a-info" id="toSetting">${this.settingSvg} &nbsp;&nbsp; 配置</a>\n                    </div>\n                    <div style="display: flex; gap:5px">\n                        <select id="dataType" style="text-align: center;min-width: 150px;">\n                            <option value="" selected>所有</option>\n                            <option value="actor">男演员</option>\n                            <option value="actress">女演员</option>\n                        </select>\n                        <select id="statusType" style="text-align: center;min-width: 150px;">\n                            <option value="" selected>--检测状态--</option>\n                            <option value="normal">正常检测</option>\n                            <option value="stop">停止检测</option>\n                        </select>\n                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" style="text-align: center;min-width: 150px; ${r ? "" : "display: none;"}">\n                            <option value="" selected>--屏蔽类型--</option>\n                            <option value="hasT">按所选分类屏蔽</option>\n                            <option value="noT">未筛选分类</option>\n                        </select>\n                        <input id="searchValue" type="text" placeholder="搜索演员" style="padding: 4px 5px;">\n                        <a id="cleanQueryBtn" class="a-info" style="margin-left: 0">重置</a>\n                    </div>\n\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px);"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "演员黑名单",
            content: n,
            scrollbar: !1,
            area: utils.getResponsiveArea([ "80%", "90%" ]),
            anim: -1,
            success: async t => {
                await this.loadTableData(), $(".layui-layer-content").on("click", "#cleanQueryBtn", (async e => {
                    $("#searchValue").val(""), $("#dataType").val(""), $("#statusType").val(""), await this.reloadTable();
                })).on("focusout keydown", "#searchValue", (async e => {
                    if ("focusout" === e.type || "Enter" === e.key) {
                        if ("Enter" === e.key && e.preventDefault(), "keydown" === e.type && "Enter" !== e.key) return;
                        $("#dataType").val(""), await this.reloadTable();
                    }
                })).on("change", "#dataType", (async () => {
                    $("#searchValue").val(""), await this.reloadTable();
                })).on("change", "#statusType", (async () => {
                    await this.reloadTable();
                })).on("change", "#urlType", (async () => {
                    await this.reloadTable();
                })).on("click", "#toSetting", (() => {
                    this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
                        $("#setting-blacklist").css({
                            border: "1px solid #f40"
                        });
                    }));
                })).on("click", ".open-url", (e => {
                    e.preventDefault();
                    const t = $(e.currentTarget), n = t.attr("data-url"), a = t.attr("data-name");
                    utils.openPage(n, a, !0, e);
                })).on("click", "#checkBlacklistBtn", (t => {
                    utils.q({
                        clientX: t.clientX,
                        clientY: t.clientY + 20
                    }, "是否手动检测黑名单?", (() => {
                        navigator.locks.request(e.singleTaskKey, {
                            ifAvailable: !0
                        }, (async t => {
                            t ? (await e.loadConfig(), await e.checkBlacklist(!0)) : show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                        })).catch((e => {
                            console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                        }));
                    }));
                }));
            },
            end: () => {
                this.tableObj && (this.tableObj.destroy(), this.tableObj = null), window.refresh();
            }
        });
    }
    async reloadTable() {
        if (!this.tableObj) return;
        const e = await this.getTableData();
        this.tableObj.setData(e);
    }
    async getTableData() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getBlacklist(), n = await storageManager.getBlacklistCarList(), a = $("#searchValue").val(), i = $("#statusType").val(), s = $("#dataType"), o = s.val(), r = $("#urlType").val(), l = t.length;
        let c = 0, d = 0;
        const h = t.map((t => {
            t.role === B ? c++ : t.role === P && d++;
            let n = !1;
            return t.lastPublishTime && (n = !e.isUnnecessaryCheck(t.lastPublishTime, this.checkBlacklist_ruleTime)),
            {
                ...t,
                isUnCheck: n
            };
        })).filter((e => !(a && !e.name.includes(a)) && (("normal" !== i || !e.isUnCheck) && (!("stop" === i && !e.isUnCheck) && (o ? e.role === o : !("hasT" === r && !e.url.includes("t=")) && ("noT" !== r || !e.url.includes("t=")))))));
        s.html(`\n            <option value="">所有 (${l})</option>\n            <option value="actor">男演员 (${c})</option>\n            <option value="actress">女演员 (${d})</option>\n        `),
        s.val(o);
        const g = new Map;
        for (const m of n) {
            const e = m.starId;
            g.has(e) || g.set(e, []), g.get(e).push(m);
        }
        const p = h.map((e => {
            const t = e.starId, n = g.get(t) || [];
            return {
                ...e,
                carList: n,
                count: n.length
            };
        }));
        return this.currentCarCount = p.reduce(((e, t) => e + (t.count || 0)), 0), p;
    }
    async loadTableData() {
        this.checkBlacklist_ruleTime = await storageManager.getSetting("checkBlacklist_ruleTime") || 8760;
        const e = await this.getTableData();
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: !0,
            data: e,
            pagination: !0,
            paginationMode: "local",
            paginationSize: 20,
            paginationSizeSelector: [ 20, 50, 100, 1e3, 99999 ],
            paginationCounter: (e, t, n, a, i) => `演员: ${a} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" style="margin-left: 10px"></span>`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: !0,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            index: "starId",
            columns: [ {
                title: "演员",
                field: "name",
                sorter: "string",
                minWidth: 100,
                responsive: 0,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData();
                    return `<a class="open-url" data-url="${a.url}" href="${a.url}" data-name="${a.name}" target="_blank">${a.name}</a>`;
                }
            }, {
                title: "性别角色",
                field: "role",
                sorter: "string",
                width: 120,
                responsive: 5,
                formatter: (e, t, n) => {
                    const a = e.getData().role;
                    let i = a;
                    return a === B ? i = "男演员" : a === P && (i = "女演员"), i;
                }
            }, {
                title: "影视类别",
                field: "movieType",
                sorter: "string",
                width: 120,
                responsive: 5,
                formatter: (e, t, n) => {
                    const a = e.getData().movieType;
                    let i = a;
                    return a === D ? i = "有码" : a === A && (i = "无码"), i;
                }
            }, {
                title: "屏蔽类型",
                field: "url",
                sorter: "string",
                minWidth: 120,
                responsive: 4,
                visible: r,
                formatter: (e, t, n) => {
                    let a = e.getData().url.includes("t=");
                    return `<span style="${a ? "color:#cc4444" : ""}">${a ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
                }
            }, {
                title: "番号数量",
                field: "count",
                sorter: "number",
                width: 170,
                responsive: 1
            }, {
                title: "创建时间",
                field: "createTime",
                sorter: "string",
                width: 170,
                responsive: 5
            }, {
                title: "最后发行时间",
                field: "lastPublishTime",
                sorter: "string",
                width: 170,
                responsive: 1
            }, {
                title: "状态",
                field: "isUnCheck",
                sorter: "string",
                width: 120,
                responsive: 1,
                formatter: (e, t, n) => {
                    let a = "", i = "正常检测";
                    return e.getData().isUnCheck && (a = `停更${this.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`,
                    i = "停止检测"), `<span data-tip="${a}" style="${a ? "color: #cc4444;" : ""}">${i}</span>`;
                }
            }, {
                title: "操作",
                sorter: "string",
                cssClass: "action-cell-dropdown",
                minWidth: 150,
                responsive: 0,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData();
                    return n((() => {
                        var t, n;
                        null == (t = e.getElement().querySelector(".delete-btn")) || t.addEventListener("click", (e => {
                            const t = a.name, n = a.starId;
                            t ? n ? utils.q(e, `是否移除对 ${t} 的屏蔽?`, (async () => {
                                await storageManager.removeBlacklistCarList(n), await storageManager.deleteBlacklistItem(n),
                                show.info("操作成功"), this.reloadTable().then();
                            })) : show.error("获取starId失败") : show.error("获取名称失败");
                        })), null == (n = e.getElement().querySelector(".keyword-btn")) || n.addEventListener("click", (e => {
                            const t = a.carList.reduce(((e, t) => {
                                const n = t.carNum.split("-")[0] + "-";
                                return e[n] = (e[n] || 0) + 1, e;
                            }), {}), n = Object.entries(t).map((([e, t]) => ({
                                prefix: e,
                                count: t
                            }))).sort(((e, t) => t.count - e.count));
                            clog.debug(n);
                        }));
                    })), '\n                           \x3c!-- <a class="a-normal keyword-btn"> <span>提取屏蔽词</span> </a>--\x3e\n                            <a class="a-danger delete-btn"> <span>✂️ 删除</span> </a>\n                        ';
                }
            } ],
            initialSort: [ {
                column: "createTime",
                dir: "desc"
            } ],
            locale: "zh-cn",
            langs: {
                "zh-cn": {
                    pagination: {
                        first: "首页",
                        first_title: "首页",
                        last: "尾页",
                        last_title: "尾页",
                        prev: "上一页",
                        prev_title: "上一页",
                        next: "下一页",
                        next_title: "下一页",
                        all: "所有",
                        page_size: "每页行数"
                    }
                }
            }
        });
    }
    getCurrentStarUrl() {
        let e = window.location.href.replace(/([&?])sort_type=[^&]+(&|$)/, "$1");
        e = e.replace(/[&?]$/, ""), e = e.replace(/\?&/, "?");
        let t = e;
        return t = t.replace(/([&?])page=\d+(&|$)/, "$1"), t = t.replace(/[&?]$/, ""), t = t.replace(/\?&/, "?"),
        t = t.replace(/\/(\d+)(?:\/(\d+))?(\?|$)/, ((e, t, n, a) => void 0 !== n ? `/${t}${a}` : e)),
        t;
    }
    parseUrlId(e) {
        if (!e) throw new Error("url未传入");
        return new URL(e).pathname.split("/").filter((e => "" !== e.trim())).pop();
    }
    async filterAllVideo(e, t) {
        let n, a;
        if (t ? (l && t.find(".avatar-box").length > 0 && t.find(".avatar-box").parent().remove(),
        n = t.find(this.getSelector().requestDomItemSelector), a = t.find(this.getSelector().nextPageSelector).attr("href")) : (n = $(this.getSelector().itemSelector),
        a = $(this.getSelector().nextPageSelector).attr("href")), a && 0 === n.length) throw show.error("解析列表失败"),
        new Error("解析列表失败");
        for (const s of n) {
            const t = $(s), {carNum: n, url: a, publishTime: o} = this.getBean("ListPagePlugin").findCarNumAndHref(t);
            if (a && n) try {
                if (await storageManager.getCar(n)) continue;
                await storageManager.saveCar({
                    carNum: n,
                    url: a,
                    names: e,
                    actionType: d,
                    publishTime: o
                }), clog.log("屏蔽演员番号", e, n);
            } catch (i) {
                console.error(`保存失败 [${n}]:`, i);
            }
        }
        if (a) {
            show.info("请不要关闭窗口, 正在解析下一页:" + a), await new Promise((e => setTimeout(e, 500)));
            const t = await gmHttp.get(a), n = new DOMParser, i = $(n.parseFromString(t, "text/html"));
            await this.filterAllVideo(e, i);
        } else show.ok("执行结束!"), window.refresh();
    }
    async batchSaveAllVideos(e, t) {
        let n, a;
        n = $(this.getSelector().itemSelector), a = $(this.getSelector().nextPageSelector).attr("href");
        if (a && 0 === n.length) throw show.error("解析列表失败"), new Error("解析列表失败");
        for (const i of n) {
            const n = $(i), {carNum: a, url: o, publishTime: r} = this.getBean("ListPagePlugin").findCarNumAndHref(n);
            if (o && a) try {
                if (await storageManager.getCar(a)) continue;
                await storageManager.saveCar({carNum: a, url: o, names: e, actionType: t, publishTime: r}), clog.log("批量操作", e, a, t);
            } catch (s) { console.error(`保存失败 [${a}]:`, s); }
        }
        if (a) { show.info("请不要关闭窗口, 正在解析下一页:" + a), await new Promise((e => setTimeout(e, 500)));
            const i = await gmHttp.get(a), s = new DOMParser, o = $(s.parseFromString(i, "text/html"));
            await this.batchSaveAllVideos(e, t); }
        else show.ok("执行结束!"), window.refresh();
    }
    async filterActorVideo(e, t, n) {
        let {nextPageLink: a} = await this.parseAndSaveFilterInfo(n, e, t);
        if (this.nextPageLink = a, a) {
            let n;
            this.lastPageLink = a, show.info("请不要关闭窗口, 正在解析下一页:" + a);
            clog.log("正在请求下一页内容:", a);
            const i = await gmHttp.get(a);
            n = utils.htmlTo$dom(i);
            await this.filterActorVideo(e, t, n);
        } else show.ok("执行结束!"), window.refresh();
    }
    async parseAndSaveFilterInfo(e, t, n) {
        let a, i;
        if (e) {
            let t = !1, n = T;
            e.text().includes(I) && (t = !0, n = I), t && e.find(".avatar-box").length > 0 && e.find(".avatar-box").parent().remove(),
            a = e.find(this.getSelector(n).requestDomItemSelector), i = e.find(this.getSelector(n).nextPageSelector).attr("href");
        } else a = $(this.getSelector().itemSelector), i = $(this.getSelector().nextPageSelector).attr("href");
        if (i && 0 === a.length) return {
            nextPageLink: null,
            lastPublishTime: null
        };
        let s = [], o = null;
        for (const l of a) {
            const e = $(l), {carNum: a, url: i, publishTime: r} = this.getBean("ListPagePlugin").findCarNumAndHref(e);
            o || (o = r), i && a && s.push({
                carNum: a,
                url: i,
                names: t,
                actionType: d,
                starId: n,
                publishTime: r
            });
        }
        try {
            await storageManager.batchSaveBlacklistCarList(s);
        } catch (r) {
            clog.error("保存失败:", r), console.error("保存失败:", r);
        }
        return {
            nextPageLink: i,
            lastPublishTime: o
        };
    }
}

class Ce extends X {
    getName() {
        return "ListPageButtonPlugin";
    }
    async handle() {
        if (!window.isListPage) return;
        await this.createMenuBtn(), this.bindEvent();
        await storageManager.getSetting("autoPage") === _ ? $("#sort-toggle-btn").hide() : this.sortItems().then();
    }
    async createMenuBtn() {
        if (r) {
            const e = o.includes("/actors/");
            let t = $(".main-tabs, .tabs"), n = "加入黑名单", a = "#d22020", i = "", s = null;
            if (e) {
                t = $(".toolbar, .section-addition").filter(":last");
                const e = await storageManager.getBlacklist(), i = this.getActressPageInfo();
                e.find((e => e.starId === i.starId)) && (n = "已加入黑名单", a = "#885d5d");
            } else o.includes("/tags") && utils.loopDetector((() => $("#jhs-check-tag").text().trim()), (async () => {
                const e = $("#addBlacklistBtn");
                e.attr("data-tip", "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中");
                const t = $("#jhs-check-tag").text().trim();
                if (!t) return;
                const n = "no-" + t, a = await storageManager.getBlacklist();
                s = a.find((e => e.starId === n)), s && (e.css("backgroundColor", "#885d5d"), $("#addBlacklistBtn span").text("已加入黑名单"));
            }));
            const r = o.includes("advanced_search");
            r ? t = $("h2.section-title") : i = "flex-grow:1;";
            const l = localStorage.getItem("jhs_sortMethod"), d = "当前排序方式: " + ("rateCount" === l ? "评价人数" : "date" === l ? "时间" : "默认");
            t.append(`\n                <div style="display: flex;align-items: center; ${i} ">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    ${e ? `\n                     <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${a} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></a>\n                     <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></a>\n                     <a id="favoriteAllVideo" class="menu-btn main-tab-btn" style="background-color:#25b1dc !important;" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></a>\n                     <a id="hasDownAllVideo" class="menu-btn main-tab-btn" style="background-color:#7bc73b !important;margin-right: 30px!important;" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></a>\n                    ` : ""}\n                    ${o.includes("/tags") ? `\n                      <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${a} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></a>\n                    ` : ""}\n                </div>\n                <div style="display: flex;align-items: center;">\n                    <a id="newVideoBtn" class="menu-btn main-tab-btn" style="background-color:#2c6cc0 !important;"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></a>\n                    <a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>\n                    ${c || r ? "" : `<a id="sort-toggle-btn" class="menu-btn main-tab-btn" style="background-color:#8783ab !important;"> ${d} </a>`}\n                </div>\n            `);
        }
        if (l) {
            const e = o.includes("/star/");
            let t = "加入黑名单", n = "#d22020";
            if (e) {
                const e = await storageManager.getBlacklist(), a = this.getActressPageInfo();
                e.find((e => e.starId === a.starId)) && (t = "已加入黑名单", n = "#885d5d");
            }
            $(".masonry").parent().prepend(`\n                <div style="margin: 10px; display: flex;">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    ${e ? `    \n                        <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${n} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t}</span></a>\n                        <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></a>\n                        <a id="favoriteAllVideo" class="menu-btn main-tab-btn" style="background-color:#25b1dc !important;" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></a>\n                        <a id="hasDownAllVideo" class="menu-btn main-tab-btn" style="background-color:#7bc73b !important;" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></a>\n                    ` : '<a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>'}\n                </div>\n            `);
        }
    }
    bindEvent() {
        $("#waitCheckBtn").on("click", (e => {
            this.openWaitCheck(e).then();
        })), $("#newVideoBtn").on("click", (e => {
            this.getBean("NewVideoPlugin").openDialog();
        })), $("#blacklistBtn").on("click", (e => {
            this.getBean("BlacklistPlugin").openBlacklistDialog();
        })), $("#sort-toggle-btn").on("click", (e => {
            const t = localStorage.getItem("jhs_sortMethod");
            let n;
            n = t && "default" !== t ? "rateCount" === t ? "date" : "default" : "rateCount";
            const a = {
                default: "默认",
                rateCount: "评价人数",
                date: "时间"
            }[n];
            $(e.target).text(`当前排序方式: ${a}`), localStorage.setItem("jhs_sortMethod", n), this.sortItems().then();
        }));
        const e = this.getBean("BlacklistPlugin");
        $("#addBlacklistBtn").on("click", (async t => {
            await e.addBlacklist(t);
        })), $("#filterAllVideo").on("click", (async t => {
            let n = {
                clientX: t.clientX,
                clientY: t.clientY + 80
            }, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键屏蔽视频列表?", (async () => {
                this.loadObj = loading();
                try {
                    await e.filterAllVideo(i), window.refresh();
                } catch (t) {
                    console.error(t);
                } finally { this.loadObj.close(); }
            }));
        })), $("#favoriteAllVideo").on("click", (async t => {
            let n = {clientX: t.clientX, clientY: t.clientY + 80}, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键收藏所有可见作品?", (async () => {
                this.loadObj = loading();
                try { await e.batchSaveAllVideos(i, h), window.refresh(); } catch (t) { console.error(t); } finally { this.loadObj.close(); }
            }));
        })), $("#hasDownAllVideo").on("click", (async t => {
            let n = {clientX: t.clientX, clientY: t.clientY + 80}, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键已下载所有可见作品?", (async () => {
                this.loadObj = loading();
                try { await e.batchSaveAllVideos(i, g), window.refresh(); } catch (t) { console.error(t); } finally { this.loadObj.close(); }
            }));
        }));
    }
    async sortItems() {
        if (o.includes("handle") || o.includes("advanced_search")) return;
        const e = await storageManager.getSetting("autoPage");
        if (c || e === _) return;
        const t = localStorage.getItem("jhs_sortMethod");
        if (!t) return;
        $(".movie-list .item").each((function(e) {
            $(this).attr("data-original-index") || $(this).attr("data-original-index", e);
        }));
        const n = $(".movie-list"), a = $(".item", n);
        if ("default" === t) a.sort((function(e, t) {
            return $(e).data("original-index") - $(t).data("original-index");
        })).appendTo(n); else {
            const e = a.get();
            e.sort((function(e, n) {
                if ("rateCount" === t) {
                    const t = e => {
                        const t = $(e).find(".score .value").text().match(/由(\d+)人/);
                        return t ? parseFloat(t[1]) : 0;
                    };
                    return t(n) - t(e);
                }
                {
                    const t = e => {
                        const t = $(e).find(".meta").text().trim();
                        return new Date(t);
                    };
                    return t(n) - t(e);
                }
            })), n.empty().append(e);
        }
    }
    async openWaitCheck() {
        let e = this.getSelector();
        const t = await storageManager.getSetting("waitCheckCount", 5), n = [ u, b, y, k ];
        let a = 0;
        $(`${e.itemSelector}:visible`).each(((e, i) => {
            if (a >= t) return !1;
            const s = $(i);
            if (n.some((e => s.find(`span.tag:contains('${e}')`).length > 0))) return;
            const {carNum: o, aHref: r} = this.getBean("ListPagePlugin").findCarNumAndHref(s);
            if (o.includes("FC2-")) {
                const e = this.parseMovieId(r);
                this.getBean("Fc2Plugin").openFc2Page(e, o, r);
            } else {
                let e = r + (r.includes("?") ? "&autoPlay=1" : "?autoPlay=1");
                window.open(e);
            }
            a++;
        })), 0 === a && show.info("没有需鉴定的视频");
    }
}

const _e = async (e, t = "ja", n = "zh-CN") => {
    if (!e) throw new Error("翻译文本不能为空");
    const a = "https://translate-pa.googleapis.com/v1/translate?" + new URLSearchParams({
        "params.client": "gtx",
        dataTypes: "TRANSLATION",
        key: "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA",
        "query.sourceLanguage": t,
        "query.targetLanguage": n,
        "query.text": e
    }), i = await fetch(a);
    if (!i.ok) throw new Error(`${i.status} ${i.statusText}`);
    return (await i.json()).translation;
}, Te = {
    IS_FILTERED: {
        text: u,
        color: f,
        reasonType: "单番号屏蔽",
        isCounted: !0,
        countKey: "currentPageFilterCount"
    },
    IS_FAVORITE: {
        text: b,
        color: w,
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageFavoriteCount"
    },
    IS_HAS_DOWN: {
        text: y,
        color: x,
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageHasDownCount"
    },
    IS_HAS_WATCH: {
        text: k,
        color: S,
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageHasWatchCount"
    },
    IS_KEYWORD_FILTER: {
        text: "❌ 关键词屏蔽",
        color: "#de3333",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageKeywordFilterCount"
    },
    IS_ACTOR_FILTER: {
        text: "♂️ 男演员屏蔽",
        color: "#b22222",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageActorFilterCount"
    },
    IS_ACTRESS_FILTER: {
        text: "♀️ 女演员屏蔽",
        color: "#cd5c5c",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageActorFilterCount"
    },
    IS_WAIT_CHECK: {
        text: "",
        color: "",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageWaitCheckCount"
    }
};

class Ie extends X {
    constructor() {
        super(...arguments), i(this, "currentPageFilterCount", 0), i(this, "currentPageFavoriteCount", 0),
        i(this, "currentPageHasDownCount", 0), i(this, "currentPageHasWatchCount", 0), i(this, "currentPageKeywordFilterCount", 0),
        i(this, "currentPageActorFilterCount", 0), i(this, "currentPageWaitCheckCount", 0),
        i(this, "currentPageTotalCount", 0), i(this, "cache", localStorage.getItem("jhs_translate") ? JSON.parse(localStorage.getItem("jhs_translate")) : {}),
        i(this, "writeQueue", Promise.resolve());
    }
    getName() {
        return "ListPagePlugin";
    }
    async handle() {
        new BroadcastChannel("channel-refresh").addEventListener("message", (async e => {
            let t = e.data.type;
            if ("refresh" === t) {
                await this.doFilter(), this.applyVisibility();
                const e = this.getBean("HistoryPlugin");
                e.tableObj && e.tableObj.setData();
                const t = this.getBean("NewVideoPlugin");
                t && (t.showNewVideoCount().then(), t.loadData());
            } else "cleanCache_filter_actor_actress_car_list" === t ? storageManager._invalidateCache(storageManager.blacklist_car_list_key) : "clean_cacheSettingObj" === t && storageManager._invalidateCache(storageManager.setting_key);
        })), this.cleanRepeatId(), this.replaceHdImg(), this.addJumpPageControl(), this.fixBusTitleBox(),
        await this.doFilter(), this.createQuickFilter(), this.applyVisibility(), this.bindClick().then(), this.bindListPageHotKey().then(),
        this.rememberTagExpand(), $(this.getSelector().itemSelector + " a").attr("target", "_blank"),
        this.checkDom();
    }
    createQuickFilter() {
        if ($("#jhs-quick-filter").length) return;
        const e = this.getSelector(), t = '\n            <div id="jhs-quick-filter" style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center">\n                <span style="font-size:12px;color:#888;margin-right:4px">筛选:</span>\n                <a class="jhs-filter-btn" data-jhs-filter="all" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:#f5f5f5;color:#666;border:1px solid #ddd">全部</a>\n                <a class="jhs-filter-btn active" data-jhs-filter="waitCheck" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:#485fc7;color:#fff;border:none">待鉴定</a>\n                <a class="jhs-filter-btn" data-jhs-filter="favorite" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:#f5f5f5;color:#666;border:1px solid #ddd">已收藏</a>\n                <a class="jhs-filter-btn" data-jhs-filter="hasDown" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:#f5f5f5;color:#666;border:1px solid #ddd">已下载</a>\n                <a class="jhs-filter-btn" data-jhs-filter="hasWatch" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:#f5f5f5;color:#666;border:1px solid #ddd">已观看</a>\n                <a class="jhs-filter-btn" data-jhs-filter="filter" style="padding:3px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:#f5f5f5;color:#666;border:1px solid #ddd">已屏蔽</a>\n            </div>';
        r ? $(e.boxSelector).before(t) : l && $(".masonry").before(t);
        const n = this;
        this.activeQuickFilter = "waitCheck", this.applyQuickFilter("waitCheck"), $("#jhs-quick-filter").on("click", ".jhs-filter-btn", (function() {
            const t = $(this).data("jhs-filter");
            $("#jhs-quick-filter .jhs-filter-btn").css({
                background: "#f5f5f5",
                color: "#666",
                border: "1px solid #ddd"
            }).removeClass("active"), $(this).css({
                background: "#485fc7",
                color: "#fff",
                border: "none"
            }).addClass("active"), n.activeQuickFilter = t, n.applyQuickFilter(t);
        }));
    }
    applyVisibility() {
        const e = this.activeQuickFilter || "waitCheck", t = this.getSelector().itemSelector, n = ["filter", "keywordFilter", "actorFilter"];
        $(t).each((function() {
            const t = $(this), a = t.attr("data-hide") === "yes", i = t.attr("data-jhs-status") || "waitCheck";
            if (e === "all") { (n.includes(i) || a) ? t.hide() : t.show(); return; }
            if (i === e) { a ? t.hide() : t.show(); return; }
            a || (i !== e) ? t.hide() : t.show();
        }));
    }
    applyQuickFilter(e) {
        this.activeQuickFilter = e, this.applyVisibility();
    }
    rememberTagExpand() {
        if (!window.location.href.includes("actors")) return;
        const e = $(".tag-expand");
        if (0 === e.length) return;
        const t = "jhs_tag_expand", n = "true" === localStorage.getItem(t), a = $(".actor-tags .content");
        n && a.hasClass("collapse") && e[0].click(), e.on("click", (function() {
            const e = !$(".actor-tags .content").hasClass("collapse");
            clog.debug("触发"), localStorage.setItem(t, e.toString());
        }));
    }
    checkDom() {
        if (!window.isListPage) return;
        const e = this.getSelector(), t = document.querySelector(e.boxSelector);
        if (!t) return void console.error("没有找到容器节点!");
        const n = new MutationObserver((async e => {
            n.disconnect();
            try {
                this.replaceHdImg(), this.addJumpPageControl(), this.fixBusTitleBox(), await this.doFilter(), this.applyVisibility(),
                await this.getBean("ListPageButtonPlugin").sortItems(), this.getBean("CoverButtonPlugin").addSvgBtn(),
                $(this.getSelector().itemSelector + " a").attr("target", "_blank"), this.getBean("AutoPagePlugin").checkLoad();
            } finally {
                n.observe(t, a);
            }
        })), a = {
            childList: !0,
            subtree: !1
        };
        n.observe(t, a);
    }
    fixBusTitleBox() {
        if (!l) return;
        $(this.getSelector().itemSelector).toArray().forEach((e => {
            var t;
            let n = $(e);
            if (n.find(".avatar-box").length > 0) return;
            const a = (null == (t = n.find("img").attr("title")) ? void 0 : t.trim()) || "";
            n.find(".photo-info span:first").contents().first().wrap(`<span class="video-title" title="${a}">${a}</span>`),
            n.find("br").remove();
        }));
    }
    cleanRepeatId() {
        if (!l) return;
        $("#waterfall_h").removeAttr("id").attr("id", "no-page");
        const e = $('[id="waterfall"]');
        0 !== e.length && e.each((function() {
            const e = $(this);
            if (!e.hasClass("masonry")) {
                e.children().insertAfter(e), e.remove();
            }
        }));
    }
    async doFilter() {
        if (!window.isListPage) return;
        let e = $(this.getSelector().itemSelector).toArray();
        e.length && (await this.filterMovieList(e), l && setTimeout((() => {
            this.getBean("BusImgPlugin").logImageHeightsByRow().catch((e => clog.error("JavBus图片高度修正失败", e)));
        })));
    }
    async yieldListFrame() {
        await new Promise((e => {
            window.requestAnimationFrame ? window.requestAnimationFrame((() => setTimeout(e))) : setTimeout(e);
        }));
    }
    findMatchedTitleKeyword(e, t, n) {
        for (const a of e) if (t.includes(a) || n.startsWith(a)) return a;
        return null;
    }
    getStatusKey(e) {
        return e === Te.IS_FILTERED ? "filter" : e === Te.IS_FAVORITE ? "favorite" : e === Te.IS_HAS_DOWN ? "hasDown" : e === Te.IS_HAS_WATCH ? "hasWatch" : e === Te.IS_KEYWORD_FILTER ? "keywordFilter" : e === Te.IS_ACTOR_FILTER ? "actorFilter" : e === Te.IS_ACTRESS_FILTER ? "actorFilter" : "waitCheck";
    }
    async translateListItems(e) {
        for (let t = 0; t < e.length; t++) t > 0 && t % 8 == 0 && await this.yieldListFrame(),
        await this.translate(e[t]);
    }
    async filterMovieList(e) {
        utils.time("累计耗费时间"), utils.time("读取数据耗时");
        const [n, a, i, s, m] = await Promise.all([ storageManager.getTitleFilterKeyword(), storageManager.getBlacklistMap(), storageManager.getBlacklistCarList(), storageManager.getSetting(), storageManager.getStatusMap() ]), o = utils.time("读取数据耗时");
        utils.time("组装数据耗时");
        const u = a, {actorCarNumToNameMap: f, actressCarNumToNameMap: v} = i.reduce(((e, t) => {
            const n = u.get(t.starId)?.role;
            if (!n) return clog.error("黑名单数据源丢失演员信息", t), e;
            const a = n === B ? e.actorCarNumToNameMap : e.actressCarNumToNameMap;
            return a.has(t.carNum) || a.set(t.carNum, t.names), e;
        }), {
            actorCarNumToNameMap: new Map,
            actressCarNumToNameMap: new Map
        }), b = utils.time("组装数据耗时"), w = (null == s ? void 0 : s.showFilterItem) ?? C, y = (null == s ? void 0 : s.showFilterActorItem) ?? C, x = (null == s ? void 0 : s.showFilterKeywordItem) ?? C, k = (null == s ? void 0 : s.showFavoriteItem) ?? _, S = (null == s ? void 0 : s.showHasDownItem) ?? _, T = (null == s ? void 0 : s.showHasWatchItem) ?? _, I = (null == s ? void 0 : s.showAllItem) ?? C, P = (null == s ? void 0 : s.tagPosition) || "rightTop";
        const O = n.filter((e => e));
        this.currentPageFilterCount = 0, this.currentPageFavoriteCount = 0, this.currentPageHasDownCount = 0,
        this.currentPageHasWatchCount = 0, this.currentPageKeywordFilterCount = 0, this.currentPageActorFilterCount = 0,
        this.currentPageWaitCheckCount = 0, this.currentPageTotalCount = 0, utils.time("处理页面耗时");
        const R = [];
        for (let n = 0; n < e.length; n++) {
            n > 0 && n % 12 == 0 && await this.yieldListFrame();
            let t = $(e[n]);
            if (l && t.find(".avatar-box").length > 0) continue;
            const {carNum: a, title: i} = this.findCarNumAndHref(t), {filter: s, favorite: o, hasDown: d, hasWatch: h} = m, g = o.has(a), p = d.has(a), u = h.has(a), b = s.has(a), B = f.has(a), D = v.has(a), A = B || D, L = this.findMatchedTitleKeyword(O, i, a), M = !!L;
            if (!c) {
                let e = k === C && g || S === C && p || T === C && u || w === C && b && !(g || p || u) || y === C && A || x === C && M;
                const n = t.attr("data-hide") === _;
                I === _ && (e = !1), e && !n ? t.hide().attr("data-hide", _) : !e && n && t.show().removeAttr("data-hide");
            }
            let N = Te.IS_WAIT_CHECK, j = null;
            b ? N = Te.IS_FILTERED : g ? N = Te.IS_FAVORITE : p ? N = Te.IS_HAS_DOWN : u ? N = Te.IS_HAS_WATCH : M ? (N = Te.IS_KEYWORD_FILTER,
            j = L || "未知") : B ? (N = Te.IS_ACTOR_FILTER, j = f.get(a) || "") : D && (N = Te.IS_ACTRESS_FILTER,
            j = v.get(a) || ""), j || (j = N.reasonType), N.isCounted && this[N.countKey]++,
            this.currentPageTotalCount++;
            const q = this.getStatusKey(N), F = t.attr("data-jhs-status") !== q || t.attr("data-jhs-tip") !== j || t.attr("data-jhs-tag-position") !== P;
            t.attr("data-jhs-status", q).attr("data-jhs-tip", j).attr("data-jhs-tag-position", P);
            const E = "rightTop" === P ? "right: 0; top:5px;" : "left: 0; top:5px;";
            if (F && (t.find(".status-tag").remove(), N.text)) {
                const e = r ? `<span class="tag is-success status-tag" data-tip="${j}" title=""\n                        style="margin-right: 5px; border-radius:10px; position:absolute; \n                        z-index:10; background-color: ${N.color} !important; ${E}">\n                        ${N.text}\n                    </span>` : `<a class="a-primary status-tag" data-tip="${j}"  title=""\n                        style="margin-right: 5px; padding: 0 5px; color: #fff !important; border-radius:10px; position:absolute; \n                        z-index:10; background-color: ${N.color} !important; ${E}">\n                        <span class="tag" style="color:#fff !important;">${N.text}</span>\n                    </a>`;
                if (r && t.find(".tags").append(e), l) {
                    const n = t.find(".item-tag");
                    n.length ? n.append(e) : t.find(".photo-info > span > div").append(e);
                }
            }
            R.push(t);
        }
        this.translateListItems(R).catch((e => clog.error("列表页翻译任务失败", e)));
        const D = utils.time("处理页面耗时"), A = utils.time("累计耗费时间");
        clog.log(`\n            <table class="countTable" style='border-collapse: collapse; width: 100%'>\n                <tr>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${o}</td>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${b}</td>\n                </tr>\n                \n                <tr>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${D}</td>\n                    <td colspan="2" style='padding: 3px; border: 1px solid #ccc;'>${A}</td>\n                </tr>\n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>项目</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>数量</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>项目</td>\n                    <td style='padding: 3px; border: 1px solid #ccc; font-weight: bold;'>数量</td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽单番号</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageFilterCount}</strong></td>\n                     <td style='padding: 3px; border: 1px solid #ccc;'>收藏</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageFavoriteCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽演员</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageActorFilterCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>已下载</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageHasDownCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>屏蔽关键词</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageKeywordFilterCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>已观看</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageHasWatchCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'>待鉴定</td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageWaitCheckCount}</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'></td>\n                </tr>\n        \n                <tr>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>总数</strong></td>\n                    <td style='padding: 3px; border: 1px solid #ccc;'><strong>${this.currentPageTotalCount}</strong></td>\n                </tr>\n            </table>\n        `);
    }
    async bindClick() {
        let e = this.getSelector();
        $(e.boxSelector).on("click", ".item img", (async e => {
            try {
                if (e.preventDefault(), e.stopPropagation(), $(e.target).closest("div.meta-buttons").length) return;
                const t = $(e.target).closest(".item"), {carNum: n, aHref: a} = this.findCarNumAndHref(t);
                if (n.includes("FC2-")) {
                    let e = this.parseMovieId(a);
                    this.getBean("Fc2Plugin").openFc2Dialog(e, n, a), this.$currentImage = null;
                } else utils.openPage(a, n, !0, e), this.$currentImage = null;
            } catch (t) { console.error("点击图片处理失败:", t); }
        })), $(e.boxSelector).on("click", ".item video", (async e => {
            const t = e.currentTarget;
            t.paused ? t.play().catch((e => console.error("播放失败:", e))) : t.pause(), e.preventDefault(),
            e.stopPropagation();
        })), $(e.boxSelector).on("click", ".item .video-title", (async e => {
            if ($(e.target).closest('[class^="jhs-match-"]').length) return;
            const t = $(e.currentTarget).closest(".item"), {carNum: n, aHref: a} = this.findCarNumAndHref(t);
            if (n.includes("FC2-")) {
                e.preventDefault();
                let t = this.parseMovieId(a);
                this.getBean("Fc2Plugin").openFc2Dialog(t, n, a);
            }
        })), $(e.boxSelector).on("contextmenu", ".item img, .item video", (async e => {
            try {
                e.preventDefault();
                const t = $(e.target).closest(".item"), {carNum: n, url: a, publishTime: i} = this.findCarNumAndHref(t);
                let s = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10"), o = "";
                s.length && (o = s.text().trim().split(",")[0].replace("(無碼)", "")), utils.q(e, `是否屏蔽番号 ${n}?`, (async () => {
                    try {
                        o || (o = await this.parseActressName(a)), await storageManager.saveCar({
                            carNum: n,
                            url: a,
                            names: o,
                            actionType: d,
                            publishTime: i
                        }), window.refresh(), show.ok("操作成功");
                    } catch (s) { console.error("屏蔽操作失败:", s), show.error("操作失败"); }
                }));
            } catch (t) { console.error("右键菜单处理失败:", t); }
        }));
    }
    async parseActressName(e) {
        let t = null;
        if (await storageManager.getSetting("enableSaveActressCarInfo", C) === _) {
            clog.debug("鉴定补录演员信息-已启用, 开始解析详情页"), clog.debug("开始解析演员详情页", e);
            const n = await gmHttp.get(e), a = utils.htmlTo$dom(n);
            r ? t = a.find(".female").prev().map(((e, t) => $(t).text())).get().join(" ") : l && (t = a.find('span[onmouseover*="star_"] a').map(((e, t) => $(t).text())).get().join(" ")),
            clog.debug("解析到名称:", t);
        }
        return t;
    }
    async bindListPageHotKey() {
        this.$currentImage = null, $(document).on("mouseenter", this.getSelector().coverImgSelector, (e => {
            this.$currentImage = $(e.currentTarget);
        })).on("mouseleave", this.getSelector().coverImgSelector, (() => {
            this.$currentImage = null;
        }));
        let e = await storageManager.getSetting();
        if (this.filterHotKey = e.filterHotKey, this.favoriteHotKey = e.favoriteHotKey,
        this.hasDownHotKey = e.hasDownHotKey, this.hasWatchHotKey = e.hasWatchHotKey, this.enableImageHotKey = e.enableImageHotKey || C,
        this.clogHotKey = e.clogHotKey, this.foldCategoryHotKey = e.foldCategoryHotKey,
        this.clogHotKey && se.registerHotkey(this.clogHotKey, (e => {
            clog.toggleExpandCollapsed();
        })), this.foldCategoryHotKey && se.registerHotkey(this.foldCategoryHotKey, (e => {
            const t = $("#foldCategoryBtn");
            t.length && t[0].click();
        })), this.enableImageHotKey === C) return;
        const t = async (e, t) => {
            setTimeout((async () => {
                try {
                    let n = await this.parseActressName(e.url);
                    await storageManager.saveCar({
                        carNum: e.carNum,
                        url: e.url,
                        names: n,
                        actionType: t,
                        publishTime: e.publishTime
                    }), window.refresh(), show.ok("操作成功");
                } catch (t) { console.error("快捷键操作失败:", t), show.error("操作失败"); }
            }));
        }, n = {};
        this.filterHotKey && (n[this.filterHotKey] = e => {
            t(e, d);
        }), this.favoriteHotKey && (n[this.favoriteHotKey] = e => {
            t(e, h);
        }), this.hasDownHotKey && (n[this.hasDownHotKey] = e => {
            t(e, g);
        }), this.hasWatchHotKey && (n[this.hasWatchHotKey] = e => {
            t(e, p);
        });
        const a = (e, t) => {
            se.registerHotkey(e, (e => {
                const n = document.activeElement;
                if (!("INPUT" === n.tagName || "TEXTAREA" === n.tagName || n.isContentEditable) && this.$currentImage) {
                    const e = this.$currentImage.closest(".item"), n = this.findCarNumAndHref(e);
                    t(n);
                }
            }));
        };
        Object.entries(n).forEach((([e, t]) => {
            a(e, t);
        }));
    }
    findCarNumAndHref(e) {
        var t, n;
        let a, i, s, o = e.find("a"), r = o.attr("href"), l = e.find(".video-title");
        if (l.length > 0) {
            let t = l.find("strong");
            t.length > 0 && (a = t.text().trim()), i = o.attr("title") ? o.attr("title").trim() : a ? l.text().replace(a, "").trim() : l.text().trim(),
            s = e.find(".meta").text().trim();
        }
        if (!a) {
            let o = e.find("img");
            r && o.length > 0 && (i = (null == (t = o.attr("title")) ? void 0 : t.trim()) || (null == (n = o.attr("data-title")) ? void 0 : n.trim()));
            const l = e => /^\d{4}-\d{1,2}-\d{1,2}$/.test(e);
            s = e.find("date").map(((e, t) => $(t).text().trim())).get().find(l), a = e.find("date").map(((e, t) => $(t).text().trim())).get().find((e => !l(e)));
        }
        if (!a) {
            const e = "提取番号信息失败";
            throw show.error(e), new Error(e);
        }
        return {
            carNum: a,
            aHref: r,
            url: r,
            title: i,
            publishTime: s
        };
    }
    showCarNumBox(e) {
        const t = $(".movie-list .item").toArray().find((t => $(t).find(".video-title strong").text() === e));
        if (t) {
            const n = $(t);
            n.attr("data-hide") === `${e}-hide` && (n.show(), n.removeAttr("data-hide"));
        }
    }
    replaceHdImg(e) {
        if (e && "string" == typeof e.jquery && (e = e.toArray()), e || (e = document.querySelectorAll(this.getSelector().coverImgSelector)),
        r && e.forEach((e => {
            e.src = e.src.replace("thumbs", "covers"), e.title = "";
        })), l) {
            const t = /\/(imgs|pics)\/(thumb|thumbs)\//, n = /(\.jpg|\.jpeg|\.png)$/i, a = e => {
                e.src && t.test(e.src) && "true" !== e.dataset.hdReplaced && (e.src = e.src.replace(t, "/$1/cover/").replace(n, "_b$1"),
                e.dataset.hdReplaced = "true", e.dataset.title = e.title, e.title = "");
            }, i = /ps(\.jpg|\.jpeg|\.png)$/i, s = e => {
                e.src && i.test(e.src) && "true" !== e.dataset.hdReplaced && (e.src = e.src.replace(i, "pl$1"),
                e.dataset.hdReplaced = "true", e.dataset.title = e.title, e.title = "");
            };
            e.forEach((e => {
                a(e), s(e);
            }));
        }
        storageManager.getSetting("hoverBigImg", C).then((e => {
            e === _ && (window.imageHoverPreviewObj ? window.imageHoverPreviewObj.bindEvents() : window.imageHoverPreviewObj = new ImageHoverPreview({
                selector: this.getSelector().coverImgSelector
            }));
        }));
    }
    async translate(e) {
        if (await storageManager.getSetting("translateTitle", _) !== _) return;
        let t, n, a = e.find(".video-title");
        if (r ? (t = a.contents().filter(((e, t) => 3 === t.nodeType && "" !== t.textContent.trim())).text().trim(),
        n = e.find(".video-title strong").text().trim()) : (t = e.find("img").attr("data-title").trim(),
        n = e.find("a").attr("href").split("/").filter(Boolean).pop().trim()), this.cache[n]) {
            let e = this;
            return a.contents().each((function() {
                3 === this.nodeType && "" !== this.textContent.trim() && (this.textContent = " " + e.cache[n] + " ");
            })), void a.attr("title", e.cache[n]);
        }
        _e(t).then((e => {
            r ? (a.contents().each((function() {
                3 !== this.nodeType || "" === this.textContent.trim() || this.textContent.includes(n) || (this.textContent = " " + e + " ");
            })), a.attr("title", e)) : a.text(e), this.writeQueue = this.writeQueue.then((() => {
                this.cache[n] = e, localStorage.setItem("jhs_translate", JSON.stringify(this.cache));
            }));
        })).catch((e => {
            console.error("翻译失败:", e);
        }));
    }
    async revertTranslation() {
        $(this.getSelector().itemSelector).toArray().forEach((e => {
            let t = $(e);
            const n = t.find(".box").attr("title") || t.find(".video-title").attr("title") || t.find("img").attr("data-title");
            let a;
            r && (a = t.find(".video-title strong").text().trim());
            const i = t.find(".video-title");
            i.contents().each((function() {
                3 !== this.nodeType || "" === this.textContent.trim() || this.textContent.includes(a) || (this.textContent = " " + n + " ");
            })), i.removeAttr("title");
        }));
    }
    addJumpPageControl() {
        const e = "gemini-jump-page-control";
        if ($("#" + e).length > 0) return;
        if (0 === $(".pagination-link.is-current").length) return;
        const t = utils.getUrlParam(o, "page") || 1, n = $("<input>", {
            type: "number",
            id: "jumpPageInput",
            placeholder: "页码",
            min: "1",
            style: "width: 60px; margin-left: 10px; padding: 10px; border: 1px solid #ccc; font-size: 14px;",
            value: t + 1
        }), a = $("<button>", {
            text: "跳转",
            style: "margin-left: 5px; padding: 9px 8px; cursor: pointer; border: 1px solid #ccc; background-color: #f0f0f0; font-size: 14px;"
        }), i = $("<li>", {
            id: e
        }).append(n).append(a);
        $(".pagination-list").append(i);
        const s = () => {
            const e = parseInt(n.val(), 10);
            if (isNaN(e) || e < 1) return void n.focus();
            const t = new URL(window.location.href);
            t.searchParams.set("page", e.toString()), window.location.href = t.toString();
        };
        a.on("click", s), n.on("keypress", (function(e) {
            13 === e.which && (s(), e.preventDefault());
        }));
    }
}

class Be extends X {
    constructor() {
        super(...arguments), i(this, "preloadDistance", 500), i(this, "currentPage", this.getInitialPageNumber()),
        i(this, "pageItems", []);
    }
    getName() {
        return "AutoPagePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .jhs-scroll {\n                    text-align: center;\n                    padding-top: 20px;\n                    font-size: 14px;\n                }\n                .jhs-scroll.waterfall-loading { color: #000; }\n                .jhs-scroll.waterfall-error { color: #f44336; cursor: pointer; }\n                .jhs-scroll.waterfall-no-more { color: #4CAF50; }\n            </style>\n        ";
    }
    async handle() {
        this.waterfall().then();
    }
    getInitialPageNumber() {
        if (l) {
            const e = o.match(/\/(page|star\/[^/]+)\/(\d+)/);
            return e ? parseInt(e[2], 10) : 1;
        }
        if (r) {
            const e = o.match(/[?&]page=(\d+)/);
            return e ? parseInt(e[1], 10) : 1;
        }
        return 1;
    }
    async waterfall() {
        if (await this.shouldDisablePaging()) return;
        const e = this.getSelector();
        if (this.container = document.querySelector(e.boxSelector), !this.container) return void console.error("没有找到容器节点,停止瀑布流!");
        this.loader = document.createElement("div"), this.loader.className = "jhs-scroll",
        this.container.parentNode.insertBefore(this.loader, this.container.nextSibling),
        this.pageItems.push({
            page: this.currentPage,
            top: 0,
            url: window.location.href
        }), this.loader.addEventListener("click", (() => {
            this.loader.classList.contains("waterfall-error") && this.loadNextPage().then();
        })), window.addEventListener("scroll", (() => {
            this.checkLoad(), this.checkScrollPosition();
        }));
        const t = document.querySelector(e.nextPageSelector);
        this.nextUrl = null == t ? void 0 : t.href, this.hasMore = !!this.nextUrl, setTimeout((() => {
            this.checkLoad();
        }), 1e3), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
    }
    async loadNextPage() {
        var e;
        if (await storageManager.getSetting("autoPage", _) === C) return void this.setState("waterfall-loading", "");
        if (this.isLoading || !this.nextUrl) return;
        this.isLoading = !0, this.setState("waterfall-loading", "加载中...");
        const t = this.getSelector();
        try {
            const i = await gmHttp.get(this.nextUrl);
            clog.log("请求下一页内容:", this.nextUrl);
            const s = utils.htmlTo$dom(i);
            l && s.find(".avatar-box").length > 0 && s.find(".avatar-box").parent().remove();
            let c = s.find(this.getSelector().requestDomItemSelector);
            const d = this.getBoxCarInfoList(), h = this.getBoxCarInfoList(c);
            if (this.checkDuplicateCarNumbers(d, h)) return this.nextUrl = null, this.hasMore = !1,
            void this.setState("waterfall-error", "翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流");
            const g = this.container.scrollHeight;
            this.pageItems.push({
                page: this.currentPage + 1,
                top: g,
                url: this.nextUrl
            });
            const p = this.getBean("ListPagePlugin");
            let m = s.find(this.getSelector().coverImgSelector);
            p.replaceHdImg(m), $(this.getSelector().boxSelector).append(c), this.nextUrl = null == (e = s.find(t.nextPageSelector)) ? void 0 : e.attr("href"),
            this.hasMore = !!this.nextUrl;
            let u = s.find(".pagination");
            $(".pagination").replaceWith(u), this.setState("waterfall-loading", ""), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
        } catch (n) {
            clog.error("加载失败:", n), this.setState("waterfall-error", "加载失败，点击重试");
        } finally {
            this.isLoading = !1;
        }
    }
    checkScrollPosition() {
        const e = window.scrollY;
        for (let t = this.pageItems.length - 1; t >= 0; t--) {
            const n = this.pageItems[t];
            if (e >= n.top) {
                this.currentPage !== n.page && (this.currentPage = n.page, this.updatePageUrl(n.url));
                break;
            }
        }
    }
    checkLoad() {
        if (!this.loader) return;
        this.loader.getBoundingClientRect().top < window.innerHeight + this.preloadDistance && this.loadNextPage().then();
    }
    async shouldDisablePaging() {
        if (!window.isListPage) return !0;
        return await storageManager.getSetting("autoPage", _), [ "search?q", "handlePlayback=1", "handleTop=1", "/want_watch_videos", "/watched_videos", "/advanced_search?type=100" ].some((e => o.includes(e)));
    }
    updatePageUrl_old(e) {
        if (window.history.pushState({}, "", e), l) {
            const t = e.match(/\/(page|star\/.*?)\/(\d+)/), n = t ? parseInt(t[2], 10) : null;
            document.title = document.title.replace(/第\d+頁/, "第" + n + "頁");
        }
    }
    updatePageUrl(e) {
        window.history.replaceState({}, "", e), l && (document.title = document.title.replace(/第\d+頁/, `第${this.currentPage}頁`));
    }
    setState(e, t) {
        this.loader.className = `jhs-scroll ${e}`, this.loader.textContent = t;
    }
}

class De {
    constructor(e, t, n) {
        this.davUrl = e.endsWith("/") ? e : e + "/", this.username = t, this.password = n,
        this.folderName = null;
    }
    _getAuthHeaders() {
        return {
            Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
            Depth: "1"
        };
    }
    _sendRequest(e, t, n = {}, a) {
        return new Promise(((i, s) => {
            const o = this.davUrl + t, r = {
                ...this._getAuthHeaders(),
                ...n
            };
            GM_xmlhttpRequest({
                method: e,
                url: o,
                headers: r,
                data: a,
                onload: e => {
                    e.status >= 200 && e.status < 300 ? i(e) : (console.error(e), s(new Error(`请求失败 ${e.status}: ${e.statusText}`)));
                },
                onerror: e => {
                    console.error("请求WebDav发生错误:", e), s(new Error("请求WebDav失败, 请检查服务是否启动, 凭证是否正确"));
                }
            });
        }));
    }
    async _ensureFolder(e) {
        try {
            await this._sendRequest("MKCOL", e);
        } catch (t) {
            if (!/请求失败 (405|409):/.test(t.message)) throw t;
        }
    }
    async backup(e, t, n) {
        await this._ensureFolder(e);
        const a = e + "/" + t;
        await this._sendRequest("PUT", a, {
            "Content-Type": "text/plain"
        }, n);
    }
    async getFileList(e) {
        var t, n, a;
        const i = (await this._sendRequest("PROPFIND", e, {
            "Content-Type": "application/xml"
        }, '<?xml version="1.0"?>\n                <d:propfind xmlns:d="DAV:">\n                    <d:prop>\n                        <d:displayname />\n                        <d:getcontentlength />\n                        <d:creationdate />\n                        <d:getlastmodified />\n                        <d:iscollection />\n                    </d:prop>\n                </d:propfind>\n            ')).responseText, s = (new DOMParser).parseFromString(i, "text/xml").getElementsByTagNameNS("DAV:", "response"), o = [];
        for (let r = 0; r < s.length; r++) {
            if (0 === r) continue;
            let e = s[r];
            const i = e.getElementsByTagNameNS("DAV:", "displayname")[0].textContent, l = (null == (t = e.getElementsByTagNameNS("DAV:", "getcontentlength")[0]) ? void 0 : t.textContent) || "0", c = (null == (n = e.getElementsByTagNameNS("DAV:", "creationdate")[0]) ? void 0 : n.textContent) || (null == (a = e.getElementsByTagNameNS("DAV:", "getlastmodified")[0]) ? void 0 : a.textContent) || "";
            "0" !== l && o.push({
                fileId: i,
                name: i,
                size: Number(l),
                createTime: c
            });
        }
        return o.reverse(), o;
    }
    async deleteFile(e) {
        let t = this.folderName + "/" + encodeURI(e);
        await this._sendRequest("DELETE", t, {
            "Cache-Control": "no-cache"
        });
    }
    async getBackupList(e) {
        return this.folderName = e, await this._ensureFolder(e), this.getFileList(e);
    }
    async getFileContent(e) {
        let t = this.folderName + "/" + e;
        return (await this._sendRequest("GET", t, {
            Accept: "application/octet-stream"
        })).responseText;
    }
}

class Ae extends X {
    constructor() {
        super(...arguments), i(this, "folderName", "JHS-数据备份"), i(this, "cacheItems", [ {
            key: "jhs_dmm_video",
            text: "🎥 预览视频缓存",
            title: "预览视频缓存"
        }, {
            key: "jhs_other_site",
            text: "🌍 第三方站点缓存",
            title: "第三方站点资源检测结果, 如missav,123Av等"
        }, {
            key: "jhs_screenShot",
            text: "🖼️ 缩略图缓存",
            title: "缩略图缓存"
        }, {
            key: "jhs_translate",
            text: "🆎 标题翻译",
            title: "标题翻译"
        }, {
            key: "jhs_actress_info",
            text: "👩 演员信息",
            title: "演员的年龄三围等数据信息"
        }, {
            key: "jhs_score_info",
            text: "⭐ Top250|热播 评分数据",
            title: "Top250及热播的评分数据"
        }, {
            key: "third_party_ttl_cache",
            text: "⏱️ 第三方TTL缓存",
            title: "评论、相关清单、磁力搜索、缩略图等请求缓存"
        } ]);
    }
    getName() {
        return "SettingPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        let t = (null == e ? void 0 : e.containerWidth) ?? "100", n = utils.isMobile() && window.innerWidth < 1e3 ? 1 : (null == e ? void 0 : e.containerColumns) ?? 5;
        this.applyImageMode().then();
        let a = `\n            section .container{\n                max-width: 1000px !important;\n                min-width: ${t}%;\n            }\n            .movie-list, .movie-list.v{\n                grid-template-columns: repeat(${n}, minmax(0, 1fr));\n            }\n        `;
        return l && (a = `\n                .container-fluid .row{\n                    max-width: 1000px !important;\n                    min-width: ${t}%;\n                    margin: auto auto;\n                }\n                \n                .container {\n                    max-width: 1000px !important;\n                    min-width: 80%;\n                    margin: auto auto;\n                }\n                \n                .masonry {\n                    grid-template-columns: repeat(${n}, minmax(0, 1fr));\n                }\n            `),
        `\n            <style>\n                ${a}\n                .nav-btn::after {\n                    content:none !important;\n                }\n                \n                #cache-data-display pre {\n                    font-family: Consolas, Monaco, 'Andale Mono', monospace;\n                    white-space: pre-wrap;\n                    word-wrap: break-word;\n                    line-height: 1.5;\n                    color: #333;\n                    border: 1px solid #ddd;\n                }\n                \n                .cache-item {\n                    transition: all 0.2s ease;\n                }\n                .cache-item:hover {\n                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n                    transform: translateY(-2px);\n                }\n\n                .tooltip-icon {\n                    display: inline-block;\n                    width: 16px;\n                    height: 16px;\n                    line-height: 16px;\n                    text-align: center;\n                    border-radius: 50%;\n                    background-color: #ccc;\n                    color: white;\n                    font-size: 12px;\n                    margin-right: 5px;\n                    cursor: help;\n                }\n                .setting-item {\n                    display: flex;\n                    align-items: baseline;\n                    justify-content: space-between;\n                    margin-bottom: 3px;\n                    padding: 3px;\n                    /*border: 1px solid #ddd;\n                    border-radius: 5px;*/\n                }\n                .simple-setting .setting-item{\n                    align-items:center;\n                }\n                .setting-label {\n                    font-size: 14px;\n                    min-width: 160px;\n                    font-weight: bold;\n                    margin-right: 10px;\n                }\n                .form-content{\n                    max-width: 160px;\n                    min-width: 160px;\n                }\n                .form-content * {\n                    width: 100%;\n                    padding: 5px;\n                    margin-right: 10px;\n                    text-align: center;\n                }\n                \n                .keyword-label {\n                    display: inline-flex;\n                    align-items: center;\n                    padding: 4px 8px;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    position: relative;\n                    margin-left: 8px;\n                    margin-bottom: 5px;\n                }\n                .keyword-remove {\n                    margin-left: 6px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1;\n                }\n                .keyword-input {\n                    padding: 6px 12px;\n                    border: 1px solid #ccc;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    float:right;\n                }\n                .add-tag-btn {\n                    padding: 6px 12px;\n                    background-color: #e2e8f0;\n                    color: #334155;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 14px;\n                    margin-left: 8px;\n                    float:right;\n                }\n                .add-tag-btn:hover {\n                    background-color: #cbd5e1;\n                }\n                .tag-box {\n                    margin-top:15px;\n                }\n                \n                \n                #saveBtn,#moreBtn,#helpBtn,#clean-all {\n                    padding: 8px 20px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 16px;\n                    margin-top: 10px;\n                }\n                #saveBtn:hover {\n                    background-color: #45a049;\n                }\n                #moreBtn {\n                    background-color: #5cb85c;\n                    color: white;\n                }\n                #moreBtn:hover {\n                    background-color: #4cae4c;\n                }\n                #helpBtn {\n                    background-color: #e67e22;\n                    color: white;\n                }\n                #helpBtn:hover {\n                    background-color: #d35400;\n                }\n                .simple-setting, .mini-simple-setting {\n                    display: none;\n                    background: rgba(255,255,255,1); \n                    position: absolute;\n                    top: ${r ? "35px" : "25px"};\n                    right: ${r ? "-300%" : "0"};\n                    z-index: 1000;\n                    border: 1px solid #ddd;\n                    border-radius: 4px;\n                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n                    padding: 0;\n                    margin-top: 5px; /* 稍微拉开一点距离 */\n                    color: #333;\n                }\n                \n                .mini-switch {\n                  appearance: none;\n                  -webkit-appearance: none;\n                  width: 40px;\n                  height: 20px;\n                  background: #e0e0e0;\n                  border-radius: 20px;\n                  position: relative;\n                  cursor: pointer;\n                  outline: none;\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked {\n                  background: #4CAF50;\n                }\n                \n                .mini-switch::before {\n                  content: "";\n                  position: absolute;\n                  width: 16px;\n                  height: 16px;\n                  border-radius: 50%;\n                  background: white;\n                  top: 2px;\n                  left: 2px;\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked::before {\n                  left: calc(100% - 18px);\n                }\n                \n                .side-menu-item {\n                    padding: 12px 12px;\n                    cursor: pointer;\n                    color: #333;\n                    border-left: 3px solid transparent;\n                    transition: all 0.2s;\n                    display: flex;\n                    gap: 5px;\n                }\n                \n                .side-menu-item .icon {\n                     height: 24px; \n                     width: 24px;\n                }\n                \n                .side-menu-item:hover {\n                    background-color: #e9e9e9;\n                }\n                \n                .side-menu-item.active {\n                    background-color: #e0e0e0;\n                    border-left: 3px solid #5d87c2;\n                    font-weight: bold;\n                }\n                \n                .content-panel {\n                    display: none;\n                    margin-top:20px;\n                    padding: 0 10px 10px 0;\n                    height: 100%;\n                    overflow-x: hidden;\n                    overflow-y: auto;\n                }\n                \n                .content-panel.active {\n                    display: block;\n                }\n                \n                input[type="checkbox"]:disabled {\n                    opacity: 0.6; \n                    cursor: default !important;\n                }\n            </style>\n        `;
    }
    async handle() {
        if (await storageManager.getSetting("enableClog", _) === _ && clog.show(), r) {
            let e = function() {
                $(".navbar-search").is(":hidden") ? ($(".mini-setting-box").hide(), $(".setting-box").show()) : ($(".mini-setting-box").show(),
                $(".setting-box").hide());
            };
            $("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box" style="position:relative;">\n                    <a id="setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-right:15px !important;">\n                        设置\n                    </a>\n                    <div class="simple-setting"></div>\n                </div>'),
            utils.loopDetector((() => $("#miniHistoryBtn").length > 0), (() => {
                $(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box" style="position:relative;margin-left: auto;">\n                        <a id="mini-setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-left:0 !important;padding-right:0 !important;">\n                            设置\n                        </a>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '),
                e();
            })), $(window).resize(e);
        }
        l && (utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            $("#waitCheckBtn").parent().append('\n                    <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                        <div class="setting-box">\n                            <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                <span>设置</span>\n                            </a>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ');
        }), 1, 1e4, !1), isDetailPage && $("h3").before('\n                    <div class="container-fluid" style="margin-top:20px">\n                        <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                            <div class="setting-box">\n                                <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                    <span>设置</span>\n                                </a>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ')),
        $(".main-nav, .container-fluid").on("click", "#setting-btn, #mini-setting-btn", (() => {
            clog.lowZIndex(), this.openSettingDialog();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".setting-box", (() => {
            $(".simple-setting").html(this.simpleSetting()).show(), this.initSimpleSettingForm().then(),
            clog.lowZIndex();
        })).on("mouseleave", ".setting-box", (() => {
            $(".simple-setting").html("").hide();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html(this.simpleSetting()).show(), this.initSimpleSettingForm().then(),
            clog.lowZIndex();
        })).on("mouseleave", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html("").hide();
        }));
    }
    async openSettingDialog(e = "backup-panel", t) {
        const n = this.cacheItems.map((e => `\n            <div class="cache-item" style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">\n                <div style="font-weight: bold; margin-bottom: 8px;">${e.text}</div>\n                <div style="display: flex; gap: 8px;">\n                    <a class="menu-btn clean-btn" data-key="${e.key}" style="background-color:#448cc2; flex:1; text-align:center;" title="${e.title}">\n                        <span>清理</span>\n                    </a>\n                    <a class="menu-btn view-btn" data-key="${e.key}" style="background-color:#b2bec0; flex:1; text-align:center;" >\n                        <span>查看</span>\n                    </a>\n                </div>\n            </div>\n        `)).join("");
        let a = "";
        L.forEach((e => {
            e.canSelect && (a += `<option value="${e.quality}">${e.text}</option>`);
        }));
        const i = this.getBean("CoverButtonPlugin");
        let s = `\n            <div style="display: flex; height: 100%;">\n                <div style="width: 140px; flex-shrink: 0; padding: 15px 0; background: #f5f5f5; border-right: 1px solid #ddd;">\n                    <div class="side-menu-item ${"backup-panel" === e ? "active" : ""}" data-panel="backup-panel">💾 数据备份</div>\n                    <div class="side-menu-item ${"base-panel" === e ? "active" : ""}" data-panel="base-panel">⚙️ 基础配置</div>\n                    <div class="side-menu-item ${"filter-panel" === e ? "active" : ""}" data-panel="filter-panel">🚫 屏蔽配置</div>\n                    <div class="side-menu-item ${"task-panel" === e ? "active" : ""}" data-panel="task-panel">📋 定时任务</div>\n                    <div class="side-menu-item ${"domain-panel" === e ? "active" : ""}" data-panel="domain-panel" title="第三方视频资源域名配置">🌐 外部网站</div>\n                    <div class="side-menu-item ${"hotkey-panel" === e ? "active" : ""}" data-panel="hotkey-panel">⌨️ 快捷键配置</div>\n                    <div class="side-menu-item ${"cache-panel" === e ? "active" : ""}" data-panel="cache-panel">🧹 清理缓存</div>\n                </div>\n        \n                <div style="flex: 1; display: flex; flex-direction: column; height: 100%; ">\n                    <div style="flex: 1; margin: 0 10px; padding-bottom: 20px;overflow: hidden">\n                    \n                        \x3c!-- 数据备份面板 --\x3e\n                        <div id="backup-panel" class="content-panel" style="display: ${"backup-panel" === e ? "block" : "none"};">\n                            <div style="margin-bottom: 20px">\n                                <a id="importBtn" class="menu-btn" style="background-color:#d25a88"><span>导入数据</span></a>\n                                <a id="exportBtn" class="menu-btn" style="background-color:#85d0a3"><span>导出数据</span></a>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">WebDav备份</span>\n                                <div>\n                                    <a id="webdavBackupListBtn" class="menu-btn" style="background-color:#5d87c2"><span>查看备份</span></a>\n                                    <a id="webdavBackupBtn" class="menu-btn" style="background-color:#64bb69"><span>备份数据</span></a>\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">服务地址:</span>\n                                <div class="form-content">\n                                    <input id="webDavUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">用户名:</span>\n                                <div class="form-content">\n                                    <input id="webDavUsername">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">密码:</span>\n                                <div class="form-content">\n                                    <input id="webDavPassword">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        \n                        \x3c!-- 基础设置面板 --\x3e\n                        <div id="base-panel" class="content-panel" style="display: ${"base-panel" === e ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">打开待鉴定窗口数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="waitCheckCount" min="1" max="20" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">已鉴定标签展示位置:</span>\n                                <div class="form-content">\n                                    <select id="tagPosition">\n                                        <option value="rightTop">右上</option>\n                                        <option value="leftTop">左上</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    鉴定补录演员信息 <span data-tip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item" style="margin-top:10px">\n                                <span class="setting-label">\n                                    封面快捷按钮\n                                </span>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.screenSvg}长缩略图:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableScreenSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.videoSvg}预览视频:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableVideoSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.handleSvg}鉴定按钮:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableHandleSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.siteSvg}第三方跳转:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableSiteSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.copySvg}复制按钮:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableCopySvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                            <div class="setting-item">\n                                <span class="setting-label">预览视频默认画质:</span>\n                                <div class="form-content">\n                                    <select id="videoQuality">\n                                        ${a}\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">评论区条数:</span>\n                                <div class="form-content">\n                                    <select id="reviewCount">\n                                        <option value="10">10条</option>\n                                        <option value="20">20条</option>\n                                        <option value="30">30条</option>\n                                        <option value="40">40条</option>\n                                        <option value="50">50条</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${r ? "" : "do-hide"}">\n                                <span class="setting-label">\n                                    高亮已收藏演员 <span data-tip="详情页, 对已收藏的演员进行边框高亮提醒">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${r ? "" : "do-hide"}">\n                                <span id="highlightedTagLabel" class="setting-label">\n                                    分类标签|高亮演员-边框样式:\n                                </span>\n                                <div class="form-content" style="display: flex; align-items: center;">\n                                    <input type="number" id="highlightedTagNumber" min="0" max="20">\n                                    <input type="color" id="highlightedTagColor">\n                                </div>\n                            </div>\n\n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求超时时间(毫秒):</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpTimeout" min="1000" max="10000" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求失败重试次数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpRetryCount" min="0" max="10" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    启用控制台日志:\n                                </span>\n                                <div class="form-content">\n                                    <select id="enableClog">\n                                        <option value="no">禁用</option>\n                                        <option value="yes">开启</option>\n                                    </select>\n                                </div>\n                            </div>\n\n                            <div class="setting-item">\n                                <span class="setting-label">日志最大行数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="clogMsgCount" min="100" max="3000" style="width: 100%;">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        \x3c!-- 定时任务 --\x3e\n                        <div id="task-panel" class="content-panel" style="display: ${"task-panel" === e ? "block" : "none"};">\n                        \n                            <div class="setting-item">\n                                <span class="setting-label">请求并发数量:</span>\n                                <div class="form-content">\n                                    <input type="number" id="checkConcurrencyCount" min="2" max="5" style="width: 100%;">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">请求间隔时间(毫秒):</span>\n                                <div class="form-content">\n                                    <input type="number" id="checkRequestSleep" min="0" max="3000" style="width: 100%;">\n                                </div>\n                            </div>\n                        \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                        \n                            <div id="setting-blacklist" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;">\n                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动检测屏蔽黑名单演员</span>\n                                <div class="setting-item">\n                                    <span class="setting-label">\n                                        任务开关: <span data-tip="变更后, 刷新页面生效">❓</span> \n                                    </span>\n                                    <div class="form-content">\n                                        <select id="enableCheckBlacklist">\n                                            <option value="no">禁用</option>\n                                            <option value="yes">开启</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">任务间隔时间:</span>\n                                    <div class="form-content">\n                                         <select id="checkBlacklist_intervalTime">\n                                            <option value="2">每2小时</option>\n                                            <option value="3">每3小时</option>\n                                            <option value="6">每6小时</option>\n                                            <option value="12">每12小时</option>\n                                            <option value="24">每24小时</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">检测规则:</span>\n                                    <div class="form-content">\n                                         <select id="checkBlacklist_ruleTime">\n                                            <option value="0">全部检测</option>\n                                            <option value="8760">不检测停更1年以上</option>\n                                            <option value="17520">不检测停更2年以上</option>\n                                            <option value="26280">不检测停更3年以上</option>\n                                        </select>\n                                    </div>\n                                </div>\n                            </div>\n                        \n                            <div id="setting-checkFavoriteActress" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;" class="${r ? "" : "do-hide"}">\n                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动同步已收藏的演员</span>\n                                <div class="setting-item">\n                                    <span class="setting-label">\n                                        任务开关: <span data-tip="变更后, 刷新页面生效">❓</span> \n                                    </span>\n                                    <div class="form-content">\n                                        <select id="enableCheckFavoriteActress">\n                                            <option value="no">禁用</option>\n                                            <option value="yes">开启</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">任务间隔时间:</span>\n                                    <div class="form-content">\n                                         <select id="checkFavoriteActress_IntervalTime">\n                                            <option value="12">每12小时</option>\n                                            <option value="24">每24小时</option>\n                                        </select>\n                                    </div>\n                                </div>\n                            </div>\n                        \n                            <div id="setting-checkNewVideo" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;" class="${r ? "" : "do-hide"}">\n                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动检测已收藏演员的最新作品</span>\n                                <div class="setting-item">\n                                    <span class="setting-label">\n                                        任务开关: <span data-tip="变更后, 刷新页面生效">❓</span> \n                                    </span>\n                                    <div class="form-content">\n                                        <select id="enableCheckNewVideo">\n                                            <option value="no">禁用</option>\n                                            <option value="yes">开启</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">任务间隔时间:</span>\n                                    <div class="form-content">\n                                         <select id="checkNewVideo_intervalTime">\n                                            <option value="2">每2小时</option>\n                                            <option value="3">每3小时</option>\n                                            <option value="6">每6小时</option>\n                                            <option value="12">每12小时</option>\n                                            <option value="24">每24小时</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">检测规则:</span>\n                                    <div class="form-content">\n                                         <select id="checkNewVideo_ruleTime">\n                                            <option value="0">全部检测</option>\n                                            <option value="8760">不检测停更1年以上</option>\n                                            <option value="17520">不检测停更2年以上</option>\n                                            <option value="26280">不检测停更3年以上</option>\n                                        </select>\n                                    </div>\n                                </div>\n                            </div>\n                        </div>               \n         \n                        \x3c!-- 域名设置面板 --\x3e\n                        <div id="domain-panel" class="content-panel" style="display: ${"domain-panel" === e ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - MissAv:</span>\n                                <div class="form-content">\n                                    <input id="missAvUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - Jable:</span>\n                                <div class="form-content">\n                                    <input id="jableUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - Avgle:</span>\n                                <div class="form-content">\n                                    <input id="avgleUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - JavTrailer:</span>\n                                <div class="form-content">\n                                    <input id="javTrailersUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - 123Av:</span>\n                                <div class="form-content">\n                                    <input id="av123Url">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - JavDb:</span>\n                                <div class="form-content">\n                                    <input id="javDbUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - JavBus:</span>\n                                <div class="form-content">\n                                    <input id="javBusUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - SupJav:</span>\n                                <div class="form-content">\n                                    <input id="supJavUrl">\n                                </div>\n                            </div>           \n                        </div>\n                         \n                         \x3c!-- 快捷键 --\x3e\n                        <div id="hotkey-panel" class="content-panel" style="display: ${"hotkey-panel" === e ? "block" : "none"};">\n                            <p style="color: #666; font-size: 0.9em;">修改后, 刷新页面生效</p>\n                            <div class="setting-item">\n                                <span class="setting-label">${m}:</span>\n                                <div class="form-content">\n                                    <input id="filterHotKey" placeholder="录入快捷键" data-default-hotkey="a">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${v}:</span>\n                                <div class="form-content">\n                                    <input id="favoriteHotKey" placeholder="录入快捷键" data-default-hotkey="s">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${y}:</span>\n                                <div class="form-content">\n                                    <input id="hasDownHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${k}:</span>\n                                <div class="form-content">\n                                    <input id="hasWatchHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">⏩ 快进:</span>\n                                <div class="form-content">\n                                    <input id="speedVideoHotKey" placeholder="录入快捷键" data-default-hotkey="z">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">▲ 折叠:</span>\n                                <div class="form-content">\n                                    <input id="foldCategoryHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">💻 控制台:</span>\n                                <div class="form-content">\n                                    <input id="clogHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    <span data-tip="列表页,鼠标放置图片上时可使用快捷键">❓ </span> 对视频列表页启用快捷键:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableImageHotKey" class="mini-switch">\n                                </div>\n                            </div>\n\n                        </div>\n                        \n                        \x3c!-- 屏蔽设置面板 --\x3e\n                        <div id="filter-panel" class="content-panel" style="display: ${"filter-panel" === e ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">\n                                     启用划词屏蔽 <span data-tip="视频详情页中, 标题或评论区选中文字, 按右键可快捷加入屏蔽词">❓ </span>\n                                </span>\n                                <div style="display: flex">\n                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="reviewKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">评论区屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="filterKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">视频标题屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                        </div>\n                        <div id="cache-panel" class="content-panel" style="display: ${"cache-panel" === e ? "block" : "none"};">\n                            <h1 style="text-align:center;font-size: 20px;font-weight: bold">以下操作, 不会对核心数据造成影响</h1>\n                            <br/>               \n                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;">\n                                ${n}\n                            </div>    \n                            <div id="cache-data-display" style="margin-top: 20px; display: none;">\n                                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 400px; overflow: auto;"></pre>\n                            </div>\n                        </div>                        \n                    </div>\n                    \n                    <div style="flex-shrink: 0; padding: 15px 20px; text-align: right; border-top: 1px solid #eee; background: white;">   \n                        <button id="saveBtn">保存设置</button>\n                        <button id="clean-all" style="display: none">♾️ 清理全部缓存</button>\n                    </div>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "设置",
            content: s,
            area: utils.getResponsiveArea([ "55%", "90%" ]),
            scrollbar: !1,
            success: (e, n) => {
                $(e).find(".layui-layer-content").css("position", "relative"), this.injectHealthPanel(), this.loadForm(),
                this.bindClick(), utils.setupEscClose(n), t && t();
            },
            end: () => {
                this.getBean("CoverButtonPlugin").enableSvgBtn();
            }
        });
    }
    injectHealthPanel() {
        const e = $(".side-menu-item").parent();
        e.length && !e.find('[data-panel="health-panel"]').length && e.append('<div class="side-menu-item" data-panel="health-panel">🩺 数据体检</div>');
        const t = $(".content-panel").parent();
        t.length && !$("#health-panel").length && t.append('\n            <div id="health-panel" class="content-panel" style="display:none;">\n                <div style="display:flex; gap:8px; margin-bottom:12px;">\n                    <a id="runHealthCheckBtn" class="menu-btn" style="background-color:#448cc2"><span>重新体检</span></a>\n                    <a id="repairHealthBtn" class="menu-btn" style="background-color:#64bb69"><span>备份并修复</span></a>\n                </div>\n                <div id="health-data-display" style="background:#f8f9fa; border:1px solid #ddd; border-radius:5px; padding:12px; min-height:180px;">点击重新体检查看结果</div>\n            </div>\n        ');
    }
    async renderDataHealthPanel() {
        const e = $("#health-data-display");
        if (!e.length) return;
        e.text("体检中...");
        try {
            const t = await storageManager.inspectDataHealth(), n = t.fixable.reduce(((e, t) => e + t.count), 0), a = t.readonly.reduce(((e, t) => e + t.count), 0), i = t => t.length ? t.map((e => `<li><strong>${escapeHtml(e.message)}</strong>：${e.count}</li>`)).join("") : "<li>无</li>";
            e.html(`\n                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:12px;">\n                    <div>番号记录：<strong>${t.totals.carList}</strong></div>\n                    <div>收藏演员：<strong>${t.totals.favoriteActresses}</strong></div>\n                    <div>黑名单演员：<strong>${t.totals.blacklist}</strong></div>\n                    <div>黑名单作品：<strong>${t.totals.blacklistCarList}</strong></div>\n                </div>\n                <div style="margin-bottom:8px;">体检时间：${escapeHtml(t.checkedAt)}；可修复问题 <strong>${n}</strong> 项，只读问题 <strong>${a}</strong> 项。</div>\n                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">\n                    <div><div style="font-weight:bold;margin-bottom:4px;">可安全修复</div><ul>${i(t.fixable)}</ul></div>\n                    <div><div style="font-weight:bold;margin-bottom:4px;">仅报告</div><ul>${i(t.readonly)}</ul></div>\n                </div>\n            `);
        } catch (t) {
            console.error(t), e.text("体检失败: " + t);
        }
    }
    async repairDataHealthWithBackup() {
        const e = JSON.stringify(await storageManager.exportData()), t = `health-backup-${utils.getNowStr("_", "_")}.json`;
        utils.download(e, t);
        const n = await storageManager.repairDataHealth();
        show.ok(`已修复 ${n.fixedGroups} 组数据问题，修复前备份已下载`), await this.renderDataHealthPanel();
    }
    simpleSetting() {
        return `\n             <div class="jhs-scrollbar" style="margin-top:20px;max-height:90vh; overflow-y:auto;">\n                <div style="margin: 0 10px;">\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            显示已鉴定内容:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽单番号: </span><input type="checkbox" id="showFilterItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽演员: </span><input type="checkbox" id="showFilterActorItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽关键词: </span><input type="checkbox" id="showFilterKeywordItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">收藏: </span><input type="checkbox" id="showFavoriteItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已下载: </span><input type="checkbox" id="showHasDownItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已观看: </span><input type="checkbox" id="showHasWatchItem" class="mini-switch"><br/>\n                        </div>\n                    </div>\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="快速显示所有已鉴定内容,减少对以上开关的频繁操作">❓ </span> 显示所有:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <input type="checkbox" id="showAllItem" class="mini-switch">\n                        </div>\n                    </div>\n                    \n\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">鉴定后立即关闭页面:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="needClosePage" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                             <span data-tip="使用瀑布流模式, 排序方式将调整为默认">❓ </span>瀑布流模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="autoPage" class="mini-switch">\n                        </div>\n                    </div>\n       \n                    <div class="setting-item">\n                        <span class="setting-label">启用标题翻译:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="translateTitle" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">启用悬浮大图:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="hoverBigImg" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                                        \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    ${r ? '\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页是否展示女优年龄、三围等信息">❓ </span>加载女优信息:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadActressInfo" class="mini-switch">\n                        </div>\n                    </div>' : ""}\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页显示外部网站入口；点击检测外部站点后才请求第三方站点">❓ </span>显示外部网站:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadOtherSite" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页图片区首列位置加载长缩略图">❓ </span>加载长缩略图:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadScreenShot" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                     <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页解析更多更高画质的预览视频">❓ </span>更高画质预览视频:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadPreviewVideo" class="mini-switch">\n                        </div>\n                    </div>\n\n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="列数6以上,建议开启竖图">❓ </span>竖图模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableVerticalModel" class="mini-switch">\n                        </div>\n                    </div>\n                                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面列数: <span id="showContainerColumns"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerColumns" min="2" max="10" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面宽度: <span id="showContainerWidth"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerWidth" min="0" max="30" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                </div>\n                <div style="padding: 0 20px 15px; text-align: right; border-top: 1px solid #eee;">   \n                    <button id="helpBtn" style="float:left;">常见问题</button>\n                    <button id="moreBtn">更多设置</button>\n                </div>\n            </div>\n        `;
    }
    async loadForm() {
        let e = await storageManager.getSetting();
        $("#videoQuality").val(e.videoQuality), $("#reviewCount").val(e.reviewCount || 20),
        $("#tagPosition").val(e.tagPosition || "rightTop"), $("#waitCheckCount").val(e.waitCheckCount || 5),
        $("#checkConcurrencyCount").val(e.checkConcurrencyCount || 2), $("#checkRequestSleep").val(e.checkRequestSleep || 100),
        $("#enableCheckBlacklist").val(e.enableCheckBlacklist || _), $("#checkBlacklist_intervalTime").val(e.checkBlacklist_intervalTime || 12),
        $("#checkBlacklist_ruleTime").val(e.checkBlacklist_ruleTime || 8760), $("#enableCheckFavoriteActress").val(e.enableCheckFavoriteActress || _),
        $("#checkFavoriteActress_IntervalTime").val(e.checkFavoriteActress_IntervalTime || 24),
        $("#enableCheckNewVideo").val(e.enableCheckNewVideo || _), $("#checkNewVideo_intervalTime").val(e.checkNewVideo_intervalTime || 12),
        $("#checkNewVideo_ruleTime").val(e.checkNewVideo_ruleTime || 8760);
        const t = e.highlightedTagNumber || 1, n = e.highlightedTagColor || "#ce2222";
        $("#highlightedTagNumber").val(e.highlightedTagNumber || 1), $("#highlightedTagColor").val(e.highlightedTagColor || "#ce2222"),
        $("#highlightedTagLabel").css("border", `${t}px solid ${n}`), $("#enableClog").val(e.enableClog || _),
        $("#clogMsgCount").val(e.clogMsgCount || 2e3),
        $("#httpTimeout").val(e.httpTimeout || 5e3), $("#httpRetryCount").val(e.httpRetryCount || 3),
        $("#webDavUrl").val(e.webDavUrl || ""), $("#webDavUsername").val(e.webDavUsername || ""),
        $("#webDavPassword").val(await decryptCredential(e.webDavPassword) || ""), $("#enableTitleSelectFilter").prop("checked", !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _),
        $("#enableFavoriteActresses").prop("checked", !e.enableFavoriteActresses || e.enableFavoriteActresses === _),
        $("#enableSaveActressCarInfo").prop("checked", !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _),
        $("#enableScreenSvg").prop("checked", !e.enableScreenSvg || e.enableScreenSvg === _),
        $("#enableVideoSvg").prop("checked", !e.enableVideoSvg || e.enableVideoSvg === _),
        $("#enableHandleSvg").prop("checked", !e.enableHandleSvg || e.enableHandleSvg === _),
        $("#enableSiteSvg").prop("checked", !e.enableSiteSvg || e.enableSiteSvg === _),
        $("#enableCopySvg").prop("checked", !e.enableCopySvg || e.enableCopySvg === _);
        const a = this.getBean("OtherSitePlugin"), i = await a.getMissAvUrl(), s = await a.getjableUrl(), o = await a.getAvgleUrl(), r = await a.getJavTrailersUrl(), l = await a.getAv123Url(), c = await a.getJavDbUrl(), d = await a.getJavBusUrl(), h = await a.getSupJavUrl();
        $("#missAvUrl").val(i), $("#jableUrl").val(s), $("#avgleUrl").val(o), $("#javTrailersUrl").val(r),
        $("#av123Url").val(l), $("#javDbUrl").val(c), $("#javBusUrl").val(d), $("#supJavUrl").val(h);
        let g = await storageManager.getReviewFilterKeywordList(), p = await storageManager.getTitleFilterKeyword();
        g && g.forEach((e => {
            this.addLabelTag("#reviewKeywordContainer", e);
        })), p && p.forEach((e => {
            this.addLabelTag("#filterKeywordContainer", e);
        })), [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((e => {
            $(`${e} .add-tag-btn`).on("click", (t => this.addKeyword(t, e))), $(`${e} .keyword-input`).on("keypress", (t => {
                "Enter" === t.key && this.addKeyword(t, e);
            }));
        })), $("#hotkey-panel [id]").map(((e, t) => t.id)).get().forEach((t => {
            const n = $(`#${t}`), a = void 0 !== e[t] ? e[t] : n.attr("data-default-hotkey") || "";
            n.val(a).on("input", (e => {
                let t = $(e.target).val();
                (/[\u4e00-\u9fa5]/.test(t) || /^Shift[a-zA-Z0-9]+$/.test(t)) && ($(e.target).val(""),
                show.error("非法输入：不能输入中文或输入法转换错误"));
            })).on("keydown", (e => this.handleHotkeyInput(e, n)));
        })), $("#enableImageHotKey").prop("checked", !!e.enableImageHotKey && e.enableImageHotKey === _);
    }
    handleHotkeyInput(e, t) {
        e.preventDefault();
        const n = this.parseHotkey(e);
        "" !== n ? this.isDuplicateHotkey(n, t.attr("id")) ? show.error("该快捷键已被其他功能使用！") : t.val(n) : t.val("");
    }
    parseHotkey(e) {
        if ("Backspace" === e.key || "Process" === e.key) return "";
        const t = [];
        e.ctrlKey && t.push("Ctrl"), e.shiftKey && t.push("Shift"), e.altKey && t.push("Alt"),
        e.metaKey && t.push("Cmd");
        const n = {
            " ": "Space",
            Control: "Ctrl",
            Meta: "Cmd",
            ArrowUp: "Up",
            ArrowDown: "Down",
            ArrowLeft: "Left",
            ArrowRight: "Right"
        }[e.key] || (e.key.length > 1 ? e.key.replace("Arrow", "") : e.key);
        return [ "Control", "Shift", "Alt", "Meta" ].includes(e.key) || t.push(n), t.length > 0 ? t.join("+") : "";
    }
    isDuplicateHotkey(e, t) {
        let n = !1;
        return $("#hotkey-panel [id]").each(((a, i) => {
            if (i.id !== t && e && e === $(i).val()) return n = !0, !1;
        })), n;
    }
    async initSimpleSettingForm() {
        let e = await storageManager.getSetting();
        $("#containerColumns").val(e.containerColumns || 5), $("#showContainerColumns").text(e.containerColumns || 5),
        $("#containerWidth").val((e.containerWidth || 100) - 70), $("#showContainerWidth").text((e.containerWidth || 100) + "%"),
        $("#needClosePage").prop("checked", !e.needClosePage || e.needClosePage === _),
        $("#autoPage").prop("checked", !e.autoPage || e.autoPage === _), $("#translateTitle").prop("checked", !e.translateTitle || e.translateTitle === _),
        $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
        $("#enableLoadOtherSite").prop("checked", !e.enableLoadOtherSite || e.enableLoadOtherSite === _),
        $("#containerColumns").on("input", (async e => {
            let t = $("#containerColumns").val();
            if ($("#showContainerColumns").text(t), r) {
                document.querySelector(".movie-list").style.gridTemplateColumns = `repeat(${t}, minmax(0, 1fr))`;
            }
            if (l) {
                document.querySelector(".masonry").style.gridTemplateColumns = `repeat(${t}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem("containerColumns", t), this.applyImageMode();
        })), $("#containerWidth").on("input", (async e => {
            let t = parseInt($(e.target).val());
            const n = t + 70 + "%";
            if ($("#showContainerWidth").text(n), r) {
                document.querySelector("section .container").style.minWidth = n;
            }
            if (l) {
                document.querySelector(".container-fluid .row").style.minWidth = n;
            }
            storageManager.saveSettingItem("containerWidth", t + 70);
        })), $("#showFilterItem").prop("checked", !!e.showFilterItem && e.showFilterItem === _),
        $("#showFilterActorItem").prop("checked", !!e.showFilterActorItem && e.showFilterActorItem === _),
        $("#showFilterKeywordItem").prop("checked", !!e.showFilterKeywordItem && e.showFilterKeywordItem === _),
        $("#showFavoriteItem").prop("checked", !e.showFavoriteItem || e.showFavoriteItem === _),
        $("#showHasDownItem").prop("checked", !e.showHasDownItem || e.showHasDownItem === _),
        $("#showHasWatchItem").prop("checked", !e.showHasWatchItem || e.showHasWatchItem === _),
        $("#showFilterItem").on("change", (async e => {
            let t = $("#showFilterItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterItem", t), window.refresh();
        })), $("#showFilterActorItem").on("change", (async e => {
            let t = $("#showFilterActorItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterActorItem", t), window.refresh();
        })), $("#showFilterKeywordItem").on("change", (async e => {
            let t = $("#showFilterKeywordItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterKeywordItem", t), window.refresh();
        })), $("#showFavoriteItem").on("change", (async e => {
            let t = $("#showFavoriteItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFavoriteItem", t), window.refresh();
        })), $("#showHasDownItem").on("change", (async e => {
            let t = $("#showHasDownItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showHasDownItem", t), window.refresh();
        })), $("#showHasWatchItem").on("change", (async e => {
            let t = $("#showHasWatchItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showHasWatchItem", t), window.refresh();
        }));
        const t = $("#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasDownItem, #showHasWatchItem"), n = () => {
            const e = $("#showAllItem").is(":checked");
            t.prop("disabled", e), e ? t.attr("data-tip", "请先关闭显示所有才可点击") : t.removeAttr("data-tip");
        };
        $("#showAllItem").prop("checked", !!e.showAllItem && e.showAllItem === _), $("#showAllItem").on("change", (async e => {
            let t = $("#showAllItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showAllItem", t), n(), window.refresh();
        })), n(), $("#needClosePage").on("change", (async e => {
            await storageManager.saveSettingItem("needClosePage", $("#needClosePage").is(":checked") ? _ : C),
            window.refresh();
        })), $("#autoPage").on("change", (async e => {
            const t = $("#autoPage").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("autoPage", t), t === _ ? $("#sort-toggle-btn").hide() : $("#sort-toggle-btn").show();
        })), $("#translateTitle").on("change", (async e => {
            const t = $("#translateTitle").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("translateTitle", t), t === _ ? (await this.getBean("ListPagePlugin").doFilter(),
            isDetailPage && await this.getBean("TranslatePlugin").translate()) : (await this.getBean("ListPagePlugin").revertTranslation(),
            $(".translated-title").remove());
        })), $("#hoverBigImg").prop("checked", !!e.hoverBigImg && e.hoverBigImg === _),
        $("#hoverBigImg").on("change", (async e => {
            const t = $("#hoverBigImg").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("hoverBigImg", t), t === _ ? window.imageHoverPreviewObj = new ImageHoverPreview({
                selector: this.getSelector().coverImgSelector
            }) : window.imageHoverPreviewObj && window.imageHoverPreviewObj.destroy();
        })), $("#enableLoadActressInfo").on("change", (async e => {
            const t = $("#enableLoadActressInfo").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadActressInfo", t), t === _ ? this.getBean("ActressInfoPlugin").loadActressInfo() : $(".actress-info").remove();
        })), $("#enableLoadOtherSite").on("change", (async e => {
            const t = $("#enableLoadOtherSite").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadOtherSite", t), t === _ ? this.getBean("OtherSitePlugin").loadOtherSite().then() : $("#otherSiteBox").remove();
        })), $("#enableLoadScreenShot").prop("checked", !e.enableLoadScreenShot || e.enableLoadScreenShot === _),
        $("#enableLoadScreenShot").on("change", (async e => {
            const t = $("#enableLoadScreenShot").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadScreenShot", t), t === _ ? this.getBean("ScreenShotPlugin").loadScreenShot().then() : $(".screen-container").remove();
        })), $("#enableLoadPreviewVideo").prop("checked", !e.enableLoadPreviewVideo || e.enableLoadPreviewVideo === _),
        $("#enableLoadPreviewVideo").on("change", (async e => {
            const t = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadPreviewVideo", t);
        })), $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
        $("#enableVerticalModel").on("change", (async e => {
            const t = $("#enableVerticalModel").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableVerticalModel", t), this.applyImageMode();
        })), $("#moreBtn").on("click", (() => {
            $(".simple-setting").html("").hide(), this.openSettingDialog("base-panel");
        })), $("#helpBtn").on("click", (() => {
            layer.open({
                type: 1,
                title: "",
                shadeClose: !0,
                scrollbar: !1,
                content: '\n<style>\n    .help-container {\n        font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;\n        color: #333;\n        padding: 15px;\n        max-height: 100%;\n        overflow-y: auto;\n    }\n    \n    .help-section {\n        margin-bottom: 25px;\n    }\n    \n    .help-section summary {\n        font-size: 18px;\n        color: #3498db;\n        margin-bottom: 12px;\n        cursor: pointer;\n    }\n    \n    .help-content {\n        background-color: #f9f9f9;\n        border-radius: 5px;\n        padding: 15px;\n        border-left: 4px solid #3498db;\n    }\n    \n    .help-content p {\n        line-height: 1.6;\n        margin-bottom: 10px;\n    }\n    .help-section img {\n        max-width: 100%;\n        height: auto;\n        border: 1px solid #ddd;\n        border-radius: 4px;\n        box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n    }\n\n</style>\n\n<div class="help-container">\n    <h1 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">使用说明</h1>\n    \n    <details class="help-section">\n        <summary>1. 无法查看预览视频，提示分流?</summary>\n        <div class="help-content">\n            <p>JavDB限制日本IP的访问，而预览视频来自DMM，需要日本IP才能访问。</p>\n            <p>这样会导致二者无法同时使用，需要对其一进行代理转发。</p>\n            <p>将 cc3001.dmm.co.jp 及 dmm.co 分流到日本ip。</p>\n            <p><a href="https://youtu.be/wQUK8z_YeU4?t=121" target="_blank">Clash Verge分流规则设置 </a> (如果你是别的代理软件，自行搜索如何分流)</p>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>2. 如何屏蔽某一系列的番号?</summary>\n        <div class="help-content">\n            <p>方法一：设置中-添加视频标题关键词，如: VENX-</p>\n            <p>方法二：进入详情页，选中标题文字，右键可加入</p>\n            <img src="https://i.imgur.com/lVnhK5A.png" alt="进入详情页，选中标题，进行右键"/>\n        </div>\n    </details>\n\n    <details class="help-section">\n        <summary>3. 屏蔽某演员，如何只屏蔽单体影片?</summary>\n        <div class="help-content">\n            <p>屏蔽演员前，先筛选分类，再点屏蔽</p>\n            <img src="https://imgur.com/Ue7eCAi.png" alt="屏蔽演员前，先筛选分类，再点屏蔽"/>\n        </div>\n    </details>\n    \n    \n</div>\n',
                area: utils.getResponsiveArea([ "50%", "90%" ])
            });
        }));
    }
    async applyImageMode() {
        $("#verticalImgStyle").remove();
        if (await storageManager.getSetting("enableVerticalModel", C) === _) {
            let e = "100% 50% !important";
            window.location.href.includes("/advanced_search?type=100") && (e = "50% 50% !important");
            const t = `\n                .cover {\n                    min-height: 350px !important;\n                    overflow: hidden !important;\n                    padding-top: 142% !important;\n                }\n                \n                .cover img {\n                    object-fit: cover !important;\n                    object-position: ${e};\n                }\n                \n                /* bus的 */\n                .masonry .movie-box img {\n                    min-height: 500px !important;\n                    object-fit: cover !important;\n                    object-position: top right;\n                }\n            `;
            $("<style>").attr("id", "verticalImgStyle").text(t).appendTo("head");
        } else {
            const e = "\n                .cover {\n                    min-height:auto !important;\n                    padding-top: 67% !important;\n                }\n                .cover img {\n                    object-fit: contain !important;\n                    object-position: 50% 50% !important\n                }\n                \n                /* bus的 */\n                 .masonry .movie-box img {\n                    min-height:auto !important;\n                    object-fit: contain !important;\n                    object-position: top;\n                }\n            ";
            $("<style>").attr("id", "verticalImgStyle").text(e).appendTo("head");
        }
        l && this.getBean("BusImgPlugin").logImageHeightsByRow();
    }
    bindClick() {
        const settingPlugin = this;
        $(".side-menu-item").on("click", (function() {
            $(".side-menu-item").removeClass("active"), $(this).addClass("active"), $(".content-panel").hide();
            const e = $(this).data("panel");
            $("#" + e).show(), "cache-panel" === e ? ($("#saveBtn").hide(), $("#clean-all").show()) : ($("#saveBtn").show(),
            $("#clean-all").hide()), "health-panel" === e && ($("#saveBtn").hide(), $("#clean-all").hide(), settingPlugin.renderDataHealthPanel());
        })), $("#importBtn").on("click", (e => this.importData(e))), $("#exportBtn").on("click", (e => this.exportData(e))),
        $("#webdavBackupBtn").on("click", (e => this.backupDataByWebDav(e))), $("#webdavBackupListBtn").on("click", (e => this.backupListBtnByWebDav(e))),
        $("#saveBtn").on("click", (() => this.saveForm())), $("#runHealthCheckBtn").on("click", (() => this.renderDataHealthPanel())),
        $("#repairHealthBtn").on("click", (e => {
            utils.q(e, "修复前会自动下载备份，是否继续?", (() => this.repairDataHealthWithBackup()));
        })), $(".clean-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key"), n = this.cacheItems.find((e => e.key === t));
            t === storageManager.third_party_cache_key ? await storageManager.clearThirdPartyCache() : localStorage.removeItem(t),
            show.ok(`${n.text} 清理成功`), $("#cache-data-display").hide(),
            "jhs_dmm_video" === t && localStorage.removeItem("jhs_other_site_dmm");
        })), $("#clean-all").on("click", (async () => {
            this.cacheItems.forEach((e => localStorage.removeItem(e.key))), show.ok("全部缓存已清理"),
            $("#cache-data-display").hide(), localStorage.removeItem("jhs_other_site_dmm"), await storageManager.clearThirdPartyCache();
        })), $(".view-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key"), n = t === storageManager.third_party_cache_key ? JSON.stringify(await storageManager.getThirdPartyCache()) : localStorage.getItem(t), a = $("#cache-data-display"), i = a.find("pre");
            if (a.show(), n) try {
                const e = JSON.parse(n);
                i.text(JSON.stringify(e, null, 2));
            } catch {
                i.text(n);
            } else i.text("无数据");
        }));
        const e = $("#highlightedTagNumber"), t = $("#highlightedTagColor"), n = $("#highlightedTagLabel");
        function a() {
            const a = e.val(), i = t.val();
            n.css("border", `${a}px solid ${i}`);
        }
        e.on("input", a), t.on("input", a);
    }
    async saveForm() {
        let e = await storageManager.getSetting();
        e.videoQuality = $("#videoQuality").val(), e.reviewCount = $("#reviewCount").val(),
        e.tagPosition = $("#tagPosition").val(), e.waitCheckCount = $("#waitCheckCount").val(), e.highlightedTagNumber = $("#highlightedTagNumber").val(),
        e.highlightedTagColor = $("#highlightedTagColor").val(), e.checkConcurrencyCount = $("#checkConcurrencyCount").val(),
        e.checkRequestSleep = $("#checkRequestSleep").val(), e.enableCheckBlacklist = $("#enableCheckBlacklist").val(),
        e.checkBlacklist_intervalTime = $("#checkBlacklist_intervalTime").val(), e.checkBlacklist_ruleTime = $("#checkBlacklist_ruleTime").val(),
        e.enableCheckFavoriteActress = $("#enableCheckFavoriteActress").val(), e.checkFavoriteActress_IntervalTime = $("#checkFavoriteActress_IntervalTime").val(),
        e.enableCheckNewVideo = $("#enableCheckNewVideo").val(), e.checkNewVideo_intervalTime = $("#checkNewVideo_intervalTime").val(),
        e.checkNewVideo_ruleTime = $("#checkNewVideo_ruleTime").val(), e.httpTimeout = $("#httpTimeout").val(),
        e.httpRetryCount = $("#httpRetryCount").val(), e.enableClog = $("#enableClog").val(),
        e.enableClog === _ ? clog.show() : clog.hide(), e.clogMsgCount = $("#clogMsgCount").val(),
        e.webDavUrl = $("#webDavUrl").val(), e.webDavUsername = $("#webDavUsername").val(),
        e.webDavPassword = await encryptCredential($("#webDavPassword").val()), e.missAvUrl = $("#missAvUrl").val().replace(/\/$/, ""),
        e.jableUrl = $("#jableUrl").val().replace(/\/$/, ""), e.avgleUrl = $("#avgleUrl").val().replace(/\/$/, ""),
        e.javTrailersUrl = $("#javTrailersUrl").val().replace(/\/$/, ""), e.av123Url = $("#av123Url").val().replace(/\/$/, ""),
        e.javDbUrl = $("#javDbUrl").val().replace(/\/$/, ""), e.javBusUrl = $("#javBusUrl").val().replace(/\/$/, ""),
        e.supJavUrl = $("#supJavUrl").val().replace(/\/$/, ""), e.enableTitleSelectFilter = $("#enableTitleSelectFilter").is(":checked") ? _ : C,
        e.enableFavoriteActresses = $("#enableFavoriteActresses").is(":checked") ? _ : C,
        e.enableSaveActressCarInfo = $("#enableSaveActressCarInfo").is(":checked") ? _ : C,
        e.enableScreenSvg = $("#enableScreenSvg").is(":checked") ? _ : C, e.enableVideoSvg = $("#enableVideoSvg").is(":checked") ? _ : C,
        e.enableHandleSvg = $("#enableHandleSvg").is(":checked") ? _ : C, e.enableSiteSvg = $("#enableSiteSvg").is(":checked") ? _ : C,
        e.enableCopySvg = $("#enableCopySvg").is(":checked") ? _ : C, $("#hotkey-panel [id]").map(((e, t) => t.id)).get().forEach((t => {
            e[t] = $(`#${t}`).val();
        })), e.enableImageHotKey = $("#enableImageHotKey").is(":checked") ? _ : C, await storageManager.saveSetting(e);
        let t = [];
        $("#reviewKeywordContainer .keyword-label").toArray().forEach((e => {
            let n = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
            t.push(n);
        })), await storageManager.saveReviewFilterKeyword(t);
        let n = [];
        $("#filterKeywordContainer .keyword-label").toArray().forEach((e => {
            let t = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
            n.push(t);
        })), await storageManager.saveTitleFilterKeyword(n), show.ok("保存成功"), window.refresh();
        const a = this.getBean("NewVideoPlugin");
        a && a.resetBtnTip(), this.getBean("BlacklistPlugin").resetBtnTip(), this.getBean("BlacklistPlugin").reloadTable();
    }
    addLabelTag(e, t) {
        const n = $(`${e} .tag-box`);
        let a, i = "#cbd5e1", s = "#333";
        /^[a-z]{2,}-/i.test(t) && r ? (s = "#3477ad", a = $(`\n                <a class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}" href="/video_codes/${t.replace("-", "")}" target="_blank">\n                    ${t}\n                    <span class="keyword-remove">×</span>\n                </a>\n            `)) : a = $(`\n                <div class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}">\n                    ${t}\n                    <span class="keyword-remove">×</span>\n                </div>\n            `),
        a.find(".keyword-remove").click((e => {
            e.stopPropagation(), e.preventDefault();
            const t = $(e.currentTarget);
            const n = t.closest(".keyword-label").attr("data-keyword").split(" ")[0];
            utils.q(e, `是否移除屏蔽词  ${n}?`, (async () => {
                t.parent().remove();
            }));
        })), n.append(a);
    }
    addKeyword(e, t) {
        let n = $(`${t} .keyword-input`);
        const a = n.val().trim();
        a && (this.addLabelTag(t, a), n.val(""));
    }
    importData() {
        try {
            const e = document.createElement("input");
            e.type = "file", e.accept = ".json", e.onchange = e => {
                const t = e.target.files[0];
                if (!t) return;
                const n = new FileReader;
                n.onload = e => {
                    try {
                        const t = e.target.result.toString(), n = JSON.parse(t);
                        layer.confirm("确定是否要覆盖导入？", {
                            icon: 3,
                            title: "确认覆盖",
                            btn: [ "确定", "取消" ]
                        }, (async function(e) {
                            await storageManager.importData(n), show.ok("数据导入成功"), layer.close(e), location.reload();
                        }));
                    } catch (t) {
                        console.error(t), show.error("导入失败：文件内容不是有效的JSON格式 " + t);
                    }
                }, n.onerror = () => {
                    show.error("读取文件时出错");
                }, n.readAsText(t);
            }, document.body.appendChild(e), e.click(), setTimeout((() => document.body.removeChild(e)), 1e3);
        } catch (e) {
            console.error(e), show.error("导入数据时出错: " + e.message);
        }
    }
    async backupDataByWebDav(e) {
        const t = await storageManager.getSetting(), n = t.webDavUrl;
        if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
        const a = t.webDavUsername;
        if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
        const i = await decryptCredential(t.webDavPassword);
        if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
        let s = utils.getNowStr("_", "_") + ".json", o = JSON.stringify(await storageManager.exportData());
        o = await encryptData(o);
        let r = loading();
        try {
            const e = new De(n, a, i);
            await e.backup(this.folderName, s, o), show.ok("备份完成");
        } catch (l) {
            console.error(l), show.error(l.toString());
        } finally {
            r.close();
        }
    }
    async backupListBtnByWebDav(e) {
        const t = await storageManager.getSetting(), n = t.webDavUrl;
        if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
        const a = t.webDavUsername;
        if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
        const i = await decryptCredential(t.webDavPassword);
        if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
        let s = loading();
        try {
            const e = new De(n, a, i), t = await e.getBackupList(this.folderName);
            this.openFileListDialog(t, e, "WebDav");
        } catch (o) {
            console.error(o), show.error(`发生错误: ${o ? o.message : o}`);
        } finally {
            s.close();
        }
    }
    openFileListDialog(e, t, n) {
        layer.open({
            type: 1,
            title: n + "备份文件",
            content: '\n                <div style="height: 100%;overflow:hidden;"> \n                    <div id="table-container" style="margin:auto auto !important;"></div>\n                </div>\n            ',
            area: [ "800px", "70%" ],
            anim: -1,
            success: a => {
                const i = new Tabulator("#table-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: !0,
                    data: e,
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapse: !0,
                    columnDefaults: {
                        headerHozAlign: "center",
                        hozAlign: "center"
                    },
                    columns: [ {
                        title: "文件名",
                        field: "name",
                        width: 200,
                        headerSort: !1,
                        responsive: 0
                    }, {
                        title: "文件大小",
                        field: "size",
                        responsive: 1,
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = [ "B", "KB", "MB", "GB", "TB", "PB" ];
                            let i = 0, s = e.getData().size;
                            for (;s >= 1024 && i < a.length - 1; ) s /= 1024, i++;
                            return `${s % 1 == 0 ? s.toFixed(0) : s.toFixed(2)} ${a[i]}`;
                        }
                    }, {
                        title: "备份日期",
                        field: "createTime",
                        responsive: 2,
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return `${utils.getNowStr("-", ":", a.createTime)}`;
                        }
                    }, {
                        title: "操作",
                        minWidth: 250,
                        responsive: 0,
                        headerSort: !1,
                        formatter: (e, a, s) => {
                            const o = e.getData();
                            return s((() => {
                                const a = e.getElement().querySelector(".a-danger"), s = e.getElement().querySelector(".a-primary"), r = e.getElement().querySelector(".a-success");
                                a && a.addEventListener("click", (e => {
                                    layer.confirm(`是否删除 ${o.name} ?`, {
                                        icon: 3,
                                        title: "提示",
                                        btn: [ "确定", "取消" ]
                                    }, (async e => {
                                        layer.close(e);
                                        let a = loading();
                                        try {
                                            await t.deleteFile(o.fileId);
                                            let e = await t.getBackupList(this.folderName);
                                            i.replaceData(e), layer.alert("删除成功");
                                        } catch (s) {
                                            console.error(s), show.error(`发生错误: ${s ? s.message : s}`);
                                        } finally {
                                            a.close();
                                        }
                                    }));
                                })), s && s.addEventListener("click", (async e => {
                                    let a = loading();
                                    try {
                                        const e = await decryptData(await t.getFileContent(o.fileId));
                                            utils.download(e, o.name);
                                    } catch (i) {
                                        clog.error(i), show.error("下载失败: " + i);
                                    } finally {
                                        a.close();
                                    }
                                })), r && r.addEventListener("click", (async e => {
                                    layer.confirm(`是否将该云备份数据 ${o.name} 导入?`, {
                                        icon: 3,
                                        title: "提示",
                                        btn: [ "确定", "取消" ]
                                    }, (async e => {
                                        layer.close(e);
                                        let a = loading();
                                        try {
                                            let e = await t.getFileContent(o.fileId);
                                            show.info("解密文件内容..."), e = await decryptData(e), show.info("解密完成, 开始导入...");
                                            const a = JSON.parse(e);
                                            await storageManager.importData(a), show.ok("导入成功!"), window.location.reload();
                                        } catch (i) {
                                            console.error(i), show.error(i);
                                        } finally {
                                            a.close();
                                        }
                                    }));
                                }));
                            })), '\n                                    <a class="a-danger">删除</a>\n                                    <a class="a-primary">下载</a>\n                                    <a class="a-success">导入</a>\n                                ';
                        }
                    } ],
                    locale: "zh-cn",
                    langs: {
                        "zh-cn": {
                            pagination: {
                                first: "首页",
                                first_title: "首页",
                                last: "尾页",
                                last_title: "尾页",
                                prev: "上一页",
                                prev_title: "上一页",
                                next: "下一页",
                                next_title: "下一页",
                                all: "所有",
                                page_size: "每页行数"
                            }
                        }
                    }
                });
            }
        });
    }
    async exportData(e) {
        try {
            const e = JSON.stringify(await storageManager.exportData()), t = `${utils.getNowStr("_", "_")}.json`;
            utils.download(e, t), show.ok("数据导出成功");
        } catch (t) {
            console.error(t), show.error("导出数据时出错: " + t.message);
        }
    }
}

const ENCRYPTION_SALT = "x7k9p3";

async function getEncryptionKey() {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(ENCRYPTION_SALT + ".jhs.v1"), {
        name: "PBKDF2"
    }, false, [ "deriveKey" ]);
    return crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: enc.encode("jhs-backup"),
        iterations: 1e5,
        hash: "SHA-256"
    }, keyMaterial, {
        name: "AES-GCM",
        length: 256
    }, false, [ "encrypt", "decrypt" ]);
}

function arrayBufferToBase64(e) {
    const t = new Uint8Array(e), n = 0x8000;
    let a = "";
    for (let i = 0; i < t.length; i += n) a += String.fromCharCode.apply(null, t.subarray(i, i + n));
    return btoa(a);
}

function base64ToArrayBuffer(e) {
    const t = atob(e), n = new Uint8Array(t.length);
    for (let a = 0; a < t.length; a++) n[a] = t.charCodeAt(a);
    return n;
}

async function encryptData(e) {
    const t = await getEncryptionKey(), n = crypto.getRandomValues(new Uint8Array(12)), a = new TextEncoder(), i = await crypto.subtle.encrypt({
        name: "AES-GCM",
        iv: n
    }, t, a.encode(e)), s = new Uint8Array(n.length + i.byteLength);
    return s.set(n), s.set(new Uint8Array(i), n.length), arrayBufferToBase64(s);
}

async function decryptData(e) {
    const t = await getEncryptionKey(), n = base64ToArrayBuffer(e), a = n.slice(0, 12), i = n.slice(12), s = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: a
    }, t, i);
    return new TextDecoder().decode(s);
}

const CREDENTIAL_PREFIX = "AES:";

async function encryptCredential(e) {
    return e && !e.startsWith(CREDENTIAL_PREFIX) ? CREDENTIAL_PREFIX + await encryptData(e) : e;
}

async function decryptCredential(e) {
    return e && e.startsWith(CREDENTIAL_PREFIX) ? await decryptData(e.slice(CREDENTIAL_PREFIX.length)) : e;
}

class je extends X {
    getName() {
        return "BusPreviewVideoPlugin";
    }
    async initCss() {
        return "\n            /* 弹窗/Modal 样式 */\n            .bus-preview-modal {\n                position: fixed;\n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                background-color: rgba(0, 0, 0, 0.95); \n                /* 关键修改：更新 z-index */\n                z-index: 12345699; \n                display: flex;\n                justify-content: center;\n                align-items: center;\n                opacity: 0; \n                visibility: hidden; \n                transition: opacity 0.2s ease;\n            }\n            .bus-preview-modal.is-open {\n                opacity: 1;\n                visibility: visible;\n            }\n            /* 垂直排列视频和按钮，并居中 */\n            .bus-preview-modal-content {\n                position: relative;\n                max-width: 95%; \n                max-height: 95%;\n                display: flex; \n                flex-direction: column; \n                align-items: center; \n                gap: 15px; \n            }\n            \n            /* 移除 .bus-preview-close-btn 的样式 */\n\n            /* 视频播放器容器 */\n            .video-player-wrapper {\n                /* 关键修改：更新 width 和 max-height */\n                width: 80vw; \n                max-height: 85vh; \n                aspect-ratio: 16 / 9; \n                position: relative; \n                background-color: black; \n                max-width: 100%; \n            }\n            /* 视频元素 */\n            .video-player-wrapper #preview-video {\n                position: absolute; \n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                display: block;\n            }\n\n            /* 画质控制盒 (底部按钮) */\n            .video-control-box {\n                display: flex;\n                flex-direction: row; \n                justify-content: center; \n                flex-wrap: wrap; \n                gap: 10px;\n                padding: 10px 0; \n            }\n\n            /* 按钮样式 (保留) */\n            .video-control-btn {\n                min-width:80px;\n                padding: 6px 12px;\n                background: rgba(255,255,255,0.2);\n                color: white;\n                border: 1px solid rgba(255,255,255,0.5);\n                border-radius: 4px;\n                cursor: pointer;\n                text-align: center;\n                font-size: 14px;\n                transition: background-color 0.2s, border-color 0.2s;\n            }\n            .video-control-btn:hover {\n                background: rgba(255,255,255,0.4);\n            }\n            .video-control-btn.active {\n                background-color: #1890ff; \n                color: white;\n                font-weight: bold;\n                border: 1px solid #096dd9;\n            }\n        ";
    }
    initModal() {
        if (0 === $("#bus-preview-modal").length) {
            $("body").append('\n                <div id="bus-preview-modal" class="bus-preview-modal">\n                    <div class="bus-preview-modal-content">\n                        </div>\n                </div>\n            ');
            const e = $("#bus-preview-modal");
            e.on("click", (e => {
                "bus-preview-modal" === e.target.id && this.closeVideoModal();
            })), $(document).on("keydown", (t => {
                "Escape" === t.key && e.hasClass("is-open") && this.closeVideoModal();
            }));
        }
    }
    closeVideoModal() {
        const e = $("#preview-video");
        e.length > 0 && e[0].pause(), $("#bus-preview-modal").removeClass("is-open");
    }
    async handle() {
        if (!isDetailPage) return;
        this.initModal();
        const e = $("#sample-waterfall .sample-box .photo-frame img:first").attr("src"), t = $(`\n            <a class="preview-video-container sample-box" style="cursor: pointer">\n                <div class="photo-frame" style="position:relative;">\n                    <img src="${e}" class="video-cover" alt="">\n                    <div class="play-icon" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); \n                                color:white; font-size:40px; text-shadow:0 0 10px rgba(0,0,0,0.5);">\n                        ▶\n                    </div>\n                </div>\n            </a>`);
        $("#sample-waterfall").prepend(t);
        "yes" === await storageManager.getSetting("enableLoadPreviewVideo", "yes") && ne(this.getPageInfo().carNum, !1).then();
        let n = !1, a = $(".preview-video-container");
        a.on("click", (async e => {
            if (e.preventDefault(), e.stopPropagation(), n) show.info("正在加载中, 勿重复点击"); else {
                n = !0;
                try {
                    await this.handleVideo();
                } finally {
                    n = !1;
                }
            }
        })), window.location.href.includes("autoPlay=1") && a.trigger("click");
    }
    async handleVideo() {
        const e = $("#bus-preview-modal"), t = e.find(".bus-preview-modal-content");
        let n = $("#preview-video");
        if (n.length > 0) return e.addClass("is-open"), void n[0].play().catch((e => console.warn("尝试播放失败 (可能被浏览器阻止):", e)));
        let a = this.getPageInfo().carNum;
        const i = await ne(a);
        i && 0 !== Object.keys(i).length ? (await this.createVideoPlayerAndControls(i, t),
        n = $("#preview-video"), n.length > 0 ? (e.addClass("is-open"), n[0].play().catch((e => console.warn("尝试播放失败 (可能被浏览器阻止):", e)))) : show.error("视频播放器创建失败。")) : show.error("未找到可用的视频源。");
    }
    async createVideoPlayerAndControls(e, t) {
        let n = await storageManager.getSetting("videoQuality");
        n = Z(Object.keys(e), n);
        let a = e[n];
        t.html(`\n            <div class="video-player-wrapper">\n                <video id="preview-video" controls playsinline>\n                    <source src="${a}" />\n                </video>\n            </div>\n            <div class="video-control-box">\n                </div>\n        `);
        const i = $("#preview-video"), s = i.find("source"), o = t.find(".video-control-box");
        if (!i.length || !s.length) return;
        const r = i[0], l = localStorage.getItem("jhs_videoMuted");
        r.muted = !l || "yes" === l, r.addEventListener("volumechange", (function() {
            localStorage.setItem("jhs_videoMuted", r.muted ? "yes" : "no");
        }));
        let c = "";
        L.forEach((t => {
            let a = e[t.quality];
            if (a) {
                const e = n === t.quality;
                c += `\n                    <button class="video-control-btn${e ? " active" : ""}" \n                            data-quality="${t.quality}"\n                            data-video-src="${a}">\n                        ${t.text}\n                    </button>\n                `;
            }
        })), o.html(c);
        const d = o.find(".video-control-btn");
        o.off("click").on("click", ".video-control-btn", (async e => {
            try {
                const t = $(e.currentTarget);
                if (t.hasClass("active")) return;
                let n = t.attr("data-video-src");
                s.attr("src", n);
                const a = r.currentTime;
                r.load(), r.currentTime = a, await r.play(), d.removeClass("active"), t.addClass("active");
            } catch (t) {
                console.error("切换画质失败:", t);
            }
        }));
    }
}

class Ee extends X {
    constructor() {
        super(...arguments), i(this, "siteList", [ {
            name: "Google旧版",
            url: "https://www.google.com/searchbyimage?image_url={占位符}&client=firefox-b-d",
            ico: "https://www.google.com/favicon.ico"
        }, {
            name: "Google",
            url: "https://lens.google.com/uploadbyurl?url={占位符}",
            ico: "https://www.google.com/favicon.ico"
        }, {
            name: "Yandex",
            url: "https://yandex.ru/images/search?rpt=imageview&url={占位符}",
            ico: "https://yandex.ru/favicon.ico"
        } ]), i(this, "isUploading", !1);
    }
    getName() {
        return "SearchByImagePlugin";
    }
    async initCss() {
        return "\n            <style>\n                #upload-area {\n                    border: 2px dashed #85af68;\n                    border-radius: 8px;\n                    padding: 40px;\n                    text-align: center;\n                    margin-bottom: 20px;\n                    transition: all 0.3s;\n                    background-color: #f9f9f9;\n                }\n                #upload-area:hover {\n                    border-color: #76b947;\n                    background-color: #f0f0f0;\n                }\n                /* 拖拽进入 */\n                #upload-area.highlight {\n                    border-color: #2196F3;\n                    background-color: #e3f2fd;\n                }\n                \n                \n                #select-image-btn {\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    padding: 10px 20px;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 16px;\n                    transition: background-color 0.3s;\n                }\n                #select-image-btn:hover {\n                    background-color: #45a049;\n                }\n                \n                \n                #handle-btn, #cancel-btn {\n                    padding: 8px 16px;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 14px;\n                    border: none;\n                    transition: opacity 0.3s;\n                }\n                #handle-btn {\n                    background-color: #2196F3;\n                    color: white;\n                }\n                #handle-btn:hover {\n                    opacity: 0.9;\n                }\n                #cancel-btn {\n                    background-color: #f44336;\n                    color: white;\n                }\n                #cancel-btn:hover {\n                    opacity: 0.9;\n                }\n                \n                .search-img-site-btns-container {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 15px;\n                }\n                .search-img-site-btn {\n                    display: flex;\n                    align-items: center;\n                    padding: 8px 12px;\n                    background-color: #f5f5f5;\n                    border-radius: 4px;\n                    text-decoration: none;\n                    color: #333;\n                    transition: all 0.2s;\n                    font-size: 14px;\n                    border: 1px solid #ddd;\n                }\n                .search-img-site-btn:hover {\n                    background-color: #e0e0e0;\n                    transform: translateY(-2px);\n                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);\n                }\n                .search-img-site-btn img {\n                    width: 16px;\n                    height: 16px;\n                    margin-right: 6px;\n                }\n                .search-img-site-btn span {\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    open(e) {
        layer.open({
            type: 1,
            title: "以图识图",
            content: '\n            <div style="padding: 20px">\n                <div id="upload-area">\n                    <div style="color: #555;margin-bottom: 15px;">\n                        <p>拖拽图片到此处 或 点击按钮选择图片</p>\n                        <p>也可以直接 Ctrl+V 粘贴图片或 图片URL</p>\n                    </div>\n                    <button id="select-image-btn">选择图片</button>\n                    <input type="file" style="display: none" id="image-file" accept="image/*">\n                </div>\n                \n                <div id="url-input-container" style="margin-top: 15px;display: none;">\n                    <input type="text" id="image-url" placeholder="粘贴图片URL地址..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">\n                </div>\n                \n                <div id="preview-area" style="margin-bottom: 20px; text-align: center; display: none;">\n                    <img id="preview-image" alt="" src="" style="max-width: 100%; max-height: 300px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">\n                    <div style="margin-top: 15px; display: flex; justify-content: center; gap: 10px;" id="action-btns">\n                        <button id="handle-btn">搜索图片</button>\n                        <button id="cancel-btn">取消</button>\n                    </div>\n                    \n                    <div id="search-results" style="display: none;">\n                        <p style="margin: 20px auto">请选择识图网站：<a id="openAll" style="cursor: pointer">全部打开</a></p>\n                        <div class="search-img-site-btns-container" id="search-img-site-btns-container"></div>\n                    </div>\n                </div>\n                \n            </div>\n        ',
            area: utils.isMobile() ? utils.getResponsiveArea() : [ "40%", "80%" ],
            success: async t => {
                this.initEventListeners(), e && e();
            },
            end: () => {
                $(document).off("paste.searchImg");
            }
        });
    }
    initEventListeners() {
        const e = $("#upload-area"), t = $("#image-file"), n = $("#select-image-btn"), a = $("#preview-area"), i = $("#preview-image"), s = $("#action-btns"), o = $("#handle-btn"), r = $("#cancel-btn"), l = $("#url-input-container"), c = $("#image-url"), d = $("#search-results"), h = $("#search-img-site-btns-container");
        e.on("dragover", (t => {
            t.preventDefault(), e.addClass("highlight");
        })).on("dragleave", (() => {
            e.removeClass("highlight");
        })).on("drop", (t => {
            t.preventDefault(), e.removeClass("highlight"), t.originalEvent.dataTransfer.files && t.originalEvent.dataTransfer.files[0] && (this.handleImageFile(t.originalEvent.dataTransfer.files[0]),
            this.resetSearchUI());
        })), n.on("click", (() => {
            t.trigger("click");
        })), t.on("change", (e => {
            e.target.files && e.target.files[0] && (this.handleImageFile(e.target.files[0]),
            this.resetSearchUI());
        })), $(document).on("paste.searchImg", (async e => {
            const t = e.originalEvent.clipboardData.items;
            for (let a = 0; a < t.length; a++) if (-1 !== t[a].type.indexOf("image")) {
                const e = t[a].getAsFile();
                return this.handleImageFile(e), void this.resetSearchUI();
            }
            const n = e.originalEvent.clipboardData.getData("text");
            n && utils.isUrl(n) && (l.show(), c.val(n), i.attr("src", n), a.show(), this.resetSearchUI());
        })), o.on("click", (async () => {
            const e = i.attr("src");
            if (e) {
                if (!this.isUploading) {
                    this.isUploading = !0;
                    try {
                        const t = await this.searchByImage(e);
                        s.hide(), d.show(), h.empty();
                        const n = "jhs_selectedSites", a = JSON.parse(localStorage.getItem(n) || "{}");
                        this.siteList.forEach((e => {
                            const n = e.url.replace("{占位符}", encodeURIComponent(t)), i = !1 !== a[e.name];
                            h.append(`\n                        <a href="${n}" class="search-img-site-btn" target="_blank" title="${e.name}">\n                        <input type="checkbox" \n                               class="site-checkbox" \n                               data-site-name="${e.name}" \n                               style="margin-right: 5px"\n                               ${i ? "checked" : ""}>\n                            <img src="${e.ico}" alt="${e.name}">\n                            <span>${e.name}</span>\n                        </a>\n                    `);
                        })), h.on("change", ".site-checkbox", (function() {
                            const e = $(this).data("site-name");
                            a[e] = $(this).is(":checked"), localStorage.setItem(n, JSON.stringify(a));
                        })), h.show();
                    } finally {
                        this.isUploading = !1;
                    }
                }
            } else show.info("请粘贴或上传图片");
        })), r.on("click", (() => {
            a.hide(), l.hide(), t.val(""), c.val("");
        })), c.on("change", (() => {
            utils.isUrl(c.val()) && (i.attr("src", c.val()), a.show());
        })), $("#openAll").on("click", (() => {
            $(".search-img-site-btn").each((function() {
                $(this).find(".site-checkbox").is(":checked") && window.open($(this).attr("href"));
            }));
        }));
    }
    resetSearchUI() {
        $("#action-btns").show(), $("#search-results").hide(), $("#search-img-site-btns-container").hide().empty();
    }
    handleImageFile(e) {
        const t = document.getElementById("preview-image"), n = document.getElementById("preview-area"), a = document.getElementById("url-input-container");
        if (!e.type.match("image.*")) return void show.info("请选择图片文件");
        const i = new FileReader;
        i.onload = e => {
            t.src = e.target.result, n.style.display = "block", a.style.display = "none", $("#handle-btn")[0].click();
        }, i.readAsDataURL(e);
    }
    async searchByImage(e) {
        let t = loading();
        try {
            let t = e;
            if (e.startsWith("data:")) {
                show.info("开始上传图片...");
                const n = await async function(e) {
                    var t;
                    const n = e.match(/^data:(.+);base64,(.+)$/);
                    if (!n || n.length < 3) throw new Error("无效的Base64图片数据");
                    const a = n[1], i = n[2], s = atob(i), o = new Array(s.length);
                    for (let g = 0; g < s.length; g++) o[g] = s.charCodeAt(g);
                    const r = new Uint8Array(o), l = new Blob([ r ], {
                        type: a
                    }), c = new FormData;
                    c.append("image", l);
                    const d = await fetch("https://api.imgur.com/3/image", {
                        method: "POST",
                        headers: {
                            Authorization: "Client-ID d70305e7c3ac5c6"
                        },
                        body: c
                    }), h = await d.json();
                    if (h.success && h.data && h.data.link) return h.data.link;
                    throw new Error((null == (t = h.data) ? void 0 : t.error) || "上传到Imgur失败");
                }(e);
                if (!n) return void show.error("上传到失败");
                t = n;
            }
            return t;
        } catch (n) {
            show.error(`搜索失败: ${n.message}`), console.error("搜索失败:", n);
        } finally {
            t.close();
        }
    }
}

class Fe extends X {
    getName() {
        return "BusNavBarPlugin";
    }
    handle() {
        $("#navbar > div > div > span").append('\n            <button class="btn btn-default" style="color: #0d9488" id="search-img-btn">识图</button>\n       '),
        $("#search-img-btn").on("click", (() => {
            this.getBean("SearchByImagePlugin").open();
        }));
    }
}

class He extends X {
    constructor() {
        super(...arguments), i(this, "floorIndex", 1), i(this, "isInit", !1);
    }
    getName() {
        return "RelatedPlugin";
    }
    async showRelated(e, t) {
        const n = await storageManager.getSetting("enableLoadRelated", C), a = e;
        t ? (a.append(`\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;">相关清单</span>\n                <a id="relatedFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${n === _ ? "折叠" : "展开"}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${n === _ ? "▲" : "▼"}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `),
        $("#relatedFold").on("click", (e => {
            e.preventDefault(), e.stopPropagation();
            const n = $("#relatedFold .toggle-text"), a = $("#relatedFold .toggle-icon"), i = "展开" === n.text();
            n.text(i ? "折叠" : "展开"), a.text(i ? "▲" : "▼"), i ? ($("#relatedContainer").show(),
            $("#relatedFooter").show(), this.isInit || (this.fetchAndDisplayRelateds(t), this.isInit = !0),
            storageManager.saveSettingItem("enableLoadRelated", _)) : ($("#relatedContainer").hide(),
            $("#relatedFooter").hide(), storageManager.saveSettingItem("enableLoadRelated", C));
        })), a.append('<div id="relatedContainer"></div>'), a.append('<div id="relatedFooter"></div>'),
        n === _ && await this.fetchAndDisplayRelateds(t)) : show.error("未传入movieId");
    }
    async fetchAndDisplayRelateds(e) {
        const t = $("#relatedContainer"), n = $("#relatedFooter");
        t.append('<div id="relatedLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取清单中...</div>');
        let a = null;
        try {
            a = await K(e, 1, 20);
        } catch (i) {
            console.error("获取清单失败:", i);
        } finally {
            $("#relatedLoading").remove();
        }
        if (!a) return t.append('\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取清单失败\n                    <a id="retryFetchRelateds" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            '),
        void $("#retryFetchRelateds").on("click", (async () => {
            $("#retryFetchRelateds").parent().remove(), await this.fetchAndDisplayRelateds(e);
        }));
        if (0 !== a.length) if (this.displayRelateds(a, t), 20 === a.length) {
            n.html('\n                <button id="loadMoreRelateds" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多清单\n                </button>\n                <div id="relatedEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>\n            ');
            let a = 1, s = $("#loadMoreRelateds");
            s.on("click", (async () => {
                let n;
                s.text("加载中...").prop("disabled", !0), a++;
                try {
                    n = await K(e, a, 20);
                } catch (i) {
                    console.error("加载更多清单失败:", i);
                } finally {
                    s.text("加载失败, 请点击重试").prop("disabled", !1);
                }
                n && (this.displayRelateds(n, t), n.length < 20 ? (s.remove(), $("#relatedEnd").show()) : s.text("加载更多清单").prop("disabled", !1));
            }));
        } else n.html('<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>'); else t.append('<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无清单</div>');
    }
    displayRelateds(e, t) {
        e.length && e.forEach((e => {
            let n = `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                   <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${this.floorIndex++}</span>\n                   <span style="position:absolute;bottom:5px;right:10px;color:#999;font-size:12px;">创建时间: ${e.createTime}</span>\n                   <p><a href="/lists/${e.relatedId}" target="_blank" style="color:#2e8abb">${e.name}</a></p>\n                   <p style="margin-top: 5px;">视频个数: ${e.movieCount}</p>\n                   <p style="margin-top: 5px;">收藏次数: ${e.collectionCount} 被查看次数: ${e.viewCount}</p>\n                </div>\n            `;
            t.append(n);
        }));
    }
}

class ze extends X {
    constructor() {
        super(...arguments), i(this, "type", null);
    }
    getName() {
        return "WantAndWatchedVideosPlugin";
    }
    async handle() {
        window.location.href.includes("/want_watch_videos") && ($("h3").append('<a class="a-primary" id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>'),
        $("#wantWatchBtn").on("click", (e => {
            this.type = h, this.importWantWatchVideos(e, "是否将 想看的影片 导入到 JHS-收藏?");
        }))), window.location.href.includes("/watched_videos") && ($("h3").append('<a class="a-success" id="wantWatchBtn" style="padding:10px;">导入至 JHS</a>'),
        $("#wantWatchBtn").on("click", (e => {
            this.type = g, this.importWantWatchVideos(e, "是否将 看过的影片 导入到 JHS-已下载?");
        })));
    }
    importWantWatchVideos(e, t) {
        utils.q(null, `${t} <br/> <span style='color: #f40'>执行此功能前请记得备份数据</span>`, (async () => {
            let e = loading();
            try {
                await this.parseMovieList();
            } catch (t) {
                console.error(t);
            } finally {
                e.close();
            }
        }));
    }
    async parseMovieList(e) {
        let t, n;
        e ? (t = e.find(this.getSelector().itemSelector), n = e.find(".pagination-next").attr("href")) : (t = $(this.getSelector().itemSelector),
        n = $(".pagination-next").attr("href"));
        for (const i of t) {
            const e = $(i), t = e.find("a").attr("href"), n = e.find(".video-title strong").text().trim(), s = e.find(".meta").text().trim();
            if (t && n) try {
                if (await storageManager.getCar(n)) {
                    show.info(`${n} 已存在, 跳过`);
                    continue;
                }
                await storageManager.saveCar({
                    carNum: n,
                    url: t,
                    names: null,
                    actionType: this.type,
                    publishTime: s
                });
            } catch (a) {
                console.error(`保存失败 [${n}]:`, a);
            }
        }
        n ? (show.info("发现下一页，正在解析:", n), await new Promise((e => setTimeout(e, 1e3))),
        $.ajax({
            url: n,
            method: "GET",
            success: e => {
                const t = new DOMParser, n = $(t.parseFromString(e, "text/html"));
                this.parseMovieList(n);
            },
            error: function(e) {
                console.error(e), show.error("加载下一页失败:" + e.message);
            }
        })) : (show.ok("导入结束!"), window.refresh());
    }
}

class Ue extends X {
    getName() {
        return "CoverButtonPlugin";
    }
    async initCss() {
        return `\n            <style>\n                .box .tags {\n                    justify-content: space-between;\n                }\n                .tool-box span{\n                    opacity:.3\n                }\n                .tool-box span:hover{\n                    opacity:1\n                }\n                ${l ? ".tool-box .icon, .setting-label .icon{ height: 24px; width: 24px; }" : ""}\n                .tool-box svg path {\n                  fill: blue;\n                }\n                [data-theme="dark"] .tool-box svg path {\n                  fill: white;\n                }\n                \n                \n                /* 鼠标移入时的弹性动画 */\n                .elastic-in {\n                    animation: elasticIn 0.2s ease-out forwards;  /* 动画名称 | 时长 | 缓动函数 | 保持最终状态 */\n                }\n                \n                /* 鼠标移出时的弹性动画 */\n                .elastic-out {\n                    animation: elasticOut 0.2s ease-in forwards;\n                }\n                /* 弹性进入动画（像果冻弹入） */\n                @keyframes elasticIn {\n                    0% {\n                        opacity: 0;\n                        transform: scale(0.8);  /* 起始状态：80% 大小 */\n                    }\n                    50% {\n                        opacity: 1;\n                        transform: scale(1.1);  /* 弹到 110%（超调一点） */\n                    }\n                    70% {\n                        transform: scale(0.95); /* 回弹到 95%（模拟弹性阻尼） */\n                    }\n                    100% {\n                        opacity: 1;\n                        transform: scale(1);    /* 最终恢复正常大小 */\n                    }\n                }\n                /* 弹性离开动画（像果冻弹出） */\n                @keyframes elasticOut {\n                    0% {\n                        opacity: 1;\n                        transform: scale(1);    /* 起始状态：正常大小 */\n                    }\n                    30% {\n                        transform: scale(1.05); /* 先弹大一点（105%） */\n                    }\n                    100% {\n                        opacity: 0;\n                        transform: scale(0.8);  /* 最终缩小并消失 */\n                    }\n                }\n                \n                \n                .loading {\n                    opacity: 0.7;\n                    filter: blur(1px);\n                }\n                .loading-spinner {\n                    position: absolute;\n                    top: 50%;\n                    left: 50%;\n                    transform: translate(-50%, -50%);\n                    width: 40px;\n                    height: 40px;\n                    border: 3px solid rgba(255,255,255,.3);\n                    border-radius: 50%;\n                    border-top-color: #fff;\n                    animation: spin 1s ease-in-out infinite;\n                    z-index: 20;\n                }\n                @keyframes spin {\n                    to { transform: translate(-50%, -50%) rotate(360deg); }\n                }\n            </style>\n        `;
    }
    handle() {
        window.isListPage && (this.addSvgBtn(), this.bindClick().then());
    }
    async addSvgBtn() {
        $(this.getSelector().itemSelector).toArray().forEach((e => {
            let t = $(e);
            if (!(t.find(".tool-box").length > 0) && (r && t.find(".tags").append(`\n                    <div class="tool-box" style="margin-left: auto; display: flex; align-items: center">\n                        <span class="screenSvg" title="长缩略图" style="margin-right: 15px;">${this.screenSvg}</span>\n                        \n                        <span class="videoSvg" title="播放视频" style="margin-right: 15px;">${this.videoSvg}</span>\n                        \n                        <div class="more-tools-container handleSvg" style="position: relative; margin-right: 15px;">\n                            <div title="鉴定处理" style="padding: 5px; margin: -5px;opacity:.3">${this.handleSvg}</div>\n                            \n                            <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="menu-btn hasWatchBtn" style="background-color:${S};color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${k}</span></a>\n                                <a class="menu-btn hasDownBtn" style="background-color:${x}; color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${y}</span></a>\n                                <a class="menu-btn favoriteBtn" style="background-color:${w}; color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${v}</span></a>\n                                <a class="menu-btn filterBtn" style="background-color:${f};   color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${m}</span></a>\n                            </div>\n                        </div>\n                        \n                        <div class="more-tools-container siteSvg"  style="position: relative; margin-right: 15px;">\n                            <div title="第三方网站" style="padding: 5px; margin: -5px;opacity:.3">${this.siteSvg}</div>\n                            \n                             <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="site-btn site-jable" style="color:white !important;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">Jable</span>\n                                </a>\n                                <a class="site-btn site-avgle" style="margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">Avgle</span>\n                                </a>\n                                <a class="site-btn site-miss-av" style="color:white !important;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">MissAv</span>\n                                </a>\n                                <a class="site-btn site-123-av" style="color:white !important;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">123Av</span>\n                                </a>\n                            </div>\n                        </div>\n                        \n                        <div class="more-tools-container copySvg" style="position: relative; margin-right: 15px;">\n                            <div title="复制按钮" style="padding: 5px; margin: -5px;opacity:.3">${this.copySvg}</div>\n                            \n                            <div class="more-tools" style="\n                                position: absolute;\n                                bottom: 20px;\n                                right: -10px;\n                                display: none;\n                                background: white;\n                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);\n                                border-radius: 20px;\n                                padding: 10px 0;\n                                margin-bottom: 15px;\n                                z-index: 10;\n                            ">\n                                <span class="carNumSvg" title="复制番号" style="padding: 5px 10px; white-space: nowrap;">${this.carNumSvg}</span>\n                                <span class="titleSvg" title="复制标题" style="padding: 5px 10px; white-space: nowrap;">${this.titleSvg}</span>\n                                <span class="downSvg" title="下载封面" style="padding: 5px 10px; white-space: nowrap;">${this.downSvg}</span>\n                            </div>\n                        </div>\n                    </div>\n                `),
            l)) {
                if (t.find(".avatar-box").length > 0) return;
                t.find(".photo-info").append(`\n                    <div class="tool-box" style="display: flex; align-items: center;justify-content: flex-end">\n                        <span class="screenSvg" title="长缩略图" style="margin-right: 15px;">${this.screenSvg}</span>\n\n                        <span class="videoSvg" title="播放视频" style="margin-right: 15px;">${this.videoSvg}</span>\n                        \n                        <div class="more-tools-container handleSvg" style="position: relative; margin-right: 15px;">\n                            <div title="鉴定处理" style="padding: 5px; margin: -5px;opacity:.3">${this.handleSvg}</div>\n                            \n                            <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="menu-btn hasWatchBtn" style="background-color:${S};color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${k}</span></a>\n                                <a class="menu-btn hasDownBtn" style="background-color:${x}; color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${y}</span></a>\n                                <a class="menu-btn favoriteBtn" style="background-color:${w}; color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${v}</span></a>\n                                <a class="menu-btn filterBtn" style="background-color:${f};   color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${m}</span></a>\n                            </div>\n                        </div>\n                        \n                        <div class="more-tools-container siteSvg" style="position: relative; margin-right: 15px;">\n                            <div title="第三方网站" style="padding: 5px; margin: -5px;opacity:.3">${this.siteSvg}</div>\n                            \n                             <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="site-btn site-jable" style="color:white;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">Jable</span>\n                                </a>\n                                <a class="site-btn site-avgle" style="margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">Avgle</span>\n                                </a>\n                                <a class="site-btn site-miss-av" style="color:white;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">MissAv</span>\n                                </a>\n                                <a class="site-btn site-123-av" style="color:white;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">123Av</span>\n                                </a>\n                            </div>\n                        </div>\n                      \n                        <div class="more-tools-container copySvg" style="position: relative;">\n                            <div title="复制按钮" style="padding: 5px; margin: -5px;opacity:.3">${this.copySvg}</div>\n                            \n                            <div class="more-tools" style="\n                                max-width: 44px;\n                                position: absolute;\n                                bottom: 20px;\n                                right: -10px;\n                                display: none;\n                                background: white;\n                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);\n                                border-radius: 20px;\n                                padding: 10px 0;\n                                margin-bottom: 15px;\n                                z-index: 10;\n                                text-align: center;\n                            ">\n                                <span class="carNumSvg" title="复制番号" style="padding: 5px 10px; white-space: nowrap;display: inline">${this.carNumSvg}</span>\n                                <span class="titleSvg" title="复制标题"  style="padding: 5px 10px; white-space: nowrap;display: inline">${this.titleSvg}</span>\n                                <span class="downSvg" title="下载封面"   style="padding: 5px 10px; white-space: nowrap;display: inline">${this.downSvg}</span>\n                            </div>\n                        </div>\n                    </div>\n                `);
            }
        })), this.enableSvgBtn();
    }
    async enableSvgBtn() {
        const e = await storageManager.getSetting(), {enableScreenSvg: t = _, enableVideoSvg: n = _, enableHandleSvg: a = _, enableSiteSvg: i = _, enableCopySvg: s = _} = e;
        [ {
            selector: ".screenSvg",
            enabled: t
        }, {
            selector: ".videoSvg",
            enabled: n
        }, {
            selector: ".handleSvg",
            enabled: a
        }, {
            selector: ".siteSvg",
            enabled: i
        }, {
            selector: ".copySvg",
            enabled: s
        } ].forEach((({selector: e, enabled: t}) => {
            $(e).toggle(t === _);
        }));
    }
    async bindClick() {
        this.getSelector();
        const e = this.getBean("ListPagePlugin");
        $(document).on("click", ".more-tools-container", (e => {
            e.preventDefault();
            var t = $(e.target).closest(".more-tools-container").find(".more-tools");
            $(".more-tools").not(t).stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide(),
            t.is(":visible") ? t.stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide() : t.stop(!0, !0).removeClass("elastic-out").addClass("elastic-in").show();
        })), $(document).on("click", (function(e) {
            $(e.target).closest(".more-tools-container").length || $(".more-tools").stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide();
        })), $(document).on("click", ".videoSvg", (t => {
            t.preventDefault(), $('.videoSvg[title!="播放视频"]').each(((t, n) => {
                const a = $(n);
                let i = a.closest(".item"), s = i.find("img"), {carNum: o} = e.findCarNumAndHref(i);
                this.showImg(a, s, o), a.html(this.videoSvg).attr("title", "播放视频");
            }));
            const n = $(t.target).closest(".item"), a = n.find(".videoSvg");
            if ("播放视频" === a.attr("title")) {
                a.html(this.recoveryVideoSvg).attr("title", "切回封面");
                const {carNum: t} = e.findCarNumAndHref(n);
                let i = n.find("img");
                if (!i.length) return void show.error("没有找到图片");
                this.showVideo(a, i, t).then();
            }
        })), $(document).on("click", ".screenSvg", (async t => {
            t.preventDefault();
            let n = loading();
            try {
                const a = $(t.currentTarget).closest(".item");
                let {carNum: i} = e.findCarNumAndHref(a);
                i = i.replace("FC2-", "");
                const s = await this.getBean("ScreenShotPlugin").getScreenshot(i);
                n.close(), showImageViewer(s);
            } catch (a) {
                console.error("图片预览出错:", a), show.error("图片预览出错:" + a);
            } finally {
                n.close();
            }
        })), $(document).on("click", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", (t => {
            t.preventDefault(), t.stopPropagation();
            try {
                const n = $(t.target).closest(".menu-btn"), a = n.closest(".item"), {carNum: i, url: s, publishTime: o} = e.findCarNumAndHref(a), r = async t => {
                    try {
                        let n = await e.parseActressName(s);
                        await storageManager.saveCar({
                            carNum: i,
                            url: s,
                            names: n,
                            actionType: t,
                            publishTime: o
                        }), window.refresh(), show.ok("操作成功");
                    } catch (r) { console.error("保存操作失败:", r), show.error("操作失败"); }
                };
                n.hasClass("filterBtn") ? utils.q(t, `是否屏蔽${i}?`, (() => r(d))) : n.hasClass("favoriteBtn") ? r(h).then() : n.hasClass("hasDownBtn") ? r(g).then() : n.hasClass("hasWatchBtn") && r(p).then(),
                $(".more-tools").stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide();
            } catch (t) { console.error("按钮点击处理失败:", t); }
        }));
        const t = this.getBean("OtherSitePlugin"), n = await t.getMissAvUrl(), a = await t.getjableUrl(), i = await t.getAvgleUrl(), s = await t.getAv123Url();
        $(document).on("click", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", (t => {
            try {
                t.preventDefault(), t.stopPropagation();
                const o = $(t.currentTarget), r = o.closest(".item"), {carNum: l} = e.findCarNumAndHref(r);
                let c = null;
                o.hasClass("site-jable") ? c = `${a}/search/${l}/` : o.hasClass("site-avgle") ? c = `${i}/vod/search.html?wd=${l}` : o.hasClass("site-miss-av") ? c = `${n}/search/${l}` : o.hasClass("site-123-av") && (c = `${s}/ja/search?keyword=${l}`),
                t && (t.ctrlKey || t.metaKey) ? GM_openInTab(c, {
                    insert: 0
                }) : window.open(c);
            } catch (t) { console.error("站点按钮处理失败:", t); }
        })), $(document).on("click", ".titleSvg, .carNumSvg, .downSvg", (t => {
            t.preventDefault(), t.stopPropagation();
            const n = $(t.currentTarget).closest(".item"), {carNum: a, title: i} = e.findCarNumAndHref(n), s = n.find(l ? ".photo-frame img" : ".cover img");
            $(t.currentTarget).hasClass("titleSvg") ? utils.copyToClipboard("标题", i) : $(t.currentTarget).hasClass("carNumSvg") ? utils.copyToClipboard("番号", a) : $(t.currentTarget).hasClass("downSvg") && fetch(s.attr("src")).then((e => e.blob())).then((e => {
                utils.download(e, a + " " + i + ".jpg");
            }));
        }));
    }
    showImg(e, t, n) {
        e.html(this.videoSvg).attr("title", "播放视频");
        let a = $(`#${`${n}_preview_video`}`);
        a.length > 0 && (a[0].pause(), a.parent().hide()), t.show(), t.removeClass("loading"),
        t.next(".loading-spinner").remove();
    }
    async showVideo(e, t, n) {
        const a = `${n}_preview_video`;
        let i = $(`#${a}`);
        if (i.length > 0) return i.parent().show(), i[0].play(), void t.hide();
        t.addClass("loading"), t.after('<div class="loading-spinner"></div>');
        const s = t.attr("src"), o = await ne(n);
        if (!o) return show.error("未解析到视频"), void this.showImg(e, t, n);
        let r = await storageManager.getSetting("videoQuality");
        r = Z(Object.keys(o), r);
        let c = o[r], d = `\n            <div style="display: flex; justify-content: center; align-items: center; position: absolute; top:0; left:0; height: 100%; width: 100%; z-index: 10; overflow: hidden">\n                <video \n                    src="${c}" \n                    poster="${s}" \n                    id="${a}" \n                    controls \n                    loop \n                    muted \n                    playsinline\n                    style="max-height: 100%; max-width: 100%; object-fit: contain"\n                ></video>\n            </div>\n        `;
        l && (d = `\n                <div>\n                    <video \n                        src="${c}" \n                        poster="${s}" \n                        id="${a}" \n                        controls \n                        loop \n                        muted \n                        playsinline\n                        style="max-height: 100%; max-width: 100%; object-fit: contain"\n                    ></video>\n                </div>\n            `),
        t.parent().append(d), t.hide(), t.removeClass("loading"), t.next(".loading-spinner").remove(),
        i = $(`#${a}`);
        let h = i[0];
        h.load(), h.muted = !1, h.play(), i.trigger("focus");
    }
}

class Oe extends X {
    constructor() {
        super(...arguments), i(this, "$contentBox", $(".section .container")), i(this, "urlParams", new URLSearchParams(window.location.search)),
        i(this, "sortVal", this.urlParams.get("sort") || "release_date"), i(this, "currentPage", this.urlParams.get("page") ? parseInt(this.urlParams.get("page")) : 1),
        i(this, "maxPage", null), i(this, "keyword", this.urlParams.get("keyword") || null);
    }
    getName() {
        return "Fc2By123AvPlugin";
    }
    async getBaseUrl() {
        const e = this.getBean("OtherSitePlugin");
        return await e.getAv123Url() + "/ja";
    }
    handle() {
        $("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)").after('<a class="navbar-item" href="/advanced_search?type=100&released_start=2099-09">123Av-Fc2</a>'),
        $('.tabs li:contains("FC2")').after('<li><a href="/advanced_search?type=100&released_start=2099-09"><span>123Av-Fc2</span></a></li>'),
        o.includes("/advanced_search?type=100") && (this.hookPage(), this.handleQuery().then());
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("123Av"), e.css("marginBottom", "0"), e.append('\n            <div style="margin-left: 100px; width: 400px;">\n                <input id="search-123av-keyword" type="text" placeholder="搜索123Av Fc2ppv内容" style="padding: 4px 5px;margin-right: 0">\n                <a id="search-123av-btn" class="a-primary" style="margin-left: 0">搜索</a>\n                <a id="clear-123av-btn" class="a-info" style="margin-left: 0">重置</a>\n            </div>\n        '),
        $("#search-123av-keyword").val(this.keyword), $("#search-123av-btn").on("click", (async () => {
            let e = $("#search-123av-keyword").val().trim();
            e && (this.keyword = e, utils.setHrefParam("keyword", e), await this.handleQuery());
        })), $("#clear-123av-btn").on("click", (async () => {
            $("#search-123av-keyword").val(""), this.keyword = "", utils.setHrefParam("keyword", ""),
            $(".page-box").show(), $(".tool-box").show(), await this.handleQuery();
        })), $(".empty-message").remove(), $("#foldCategoryBtn").remove(), $(".section .container .box").remove(),
        $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="page-box"></div>');
        $(".tool-box").append('\n            <div class="button-group">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="release_date">发布日期</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="recent_update">最近更新</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="trending">热门</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed_today">今天最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed_week">本周最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed_month">本月最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed">最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_favourited">最受欢迎</a>\n                </div>\n            </div>\n        '),
        $(`#conditionBox a[data-sort="${this.sortVal}"]`).addClass("is-info"), utils.setHrefParam("sort", this.sortVal),
        utils.setHrefParam("page", this.currentPage), $("#conditionBox").on("click", "a.button", (e => {
            let t = $(e.target);
            this.sortVal = t.data("sort"), utils.setHrefParam("sort", this.sortVal), t.siblings().removeClass("is-info"),
            t.addClass("is-info"), this.handleQuery();
        }));
        $(".page-box").append('\n            <nav class="pagination">\n                <a class="pagination-previous">上一页</a>\n                <ul class="pagination-list"></ul>\n                <a class="pagination-next">下一页</a>\n            </nav>\n        '),
        $(document).on("click", ".pagination-link", (e => {
            e.preventDefault(), this.currentPage = parseInt($(e.target).data("page")), utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery();
        })), $(".pagination-previous").on("click", (e => {
            e.preventDefault(), this.currentPage > 1 && (this.currentPage--, utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery());
        })), $(".pagination-next").on("click", (e => {
            e.preventDefault(), this.currentPage < this.maxPage && (this.currentPage++, utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery());
        }));
    }
    renderPagination() {
        const e = $(".pagination-list");
        e.empty();
        let t = Math.max(1, this.currentPage - 2), n = Math.min(this.maxPage, this.currentPage + 2);
        this.currentPage <= 3 ? n = Math.min(6, this.maxPage) : this.currentPage >= this.maxPage - 2 && (t = Math.max(this.maxPage - 5, 1)),
        t > 1 && (e.append('<li><a class="pagination-link" data-page="1">1</a></li>'), t > 2 && e.append('<li><span class="pagination-ellipsis">…</span></li>'));
        for (let a = t; a <= n; a++) {
            const t = a === this.currentPage ? " is-current" : "";
            e.append(`<li><a class="pagination-link${t}" data-page="${a}">${a}</a></li>`);
        }
        n < this.maxPage && (n < this.maxPage - 1 && e.append('<li><span class="pagination-ellipsis">…</span></li>'),
        e.append(`<li><a class="pagination-link" data-page="${this.maxPage}">${this.maxPage}</a></li>`));
    }
    async handleQuery() {
        let e = loading();
        try {
            let e = [];
            e = 1 === this.currentPage ? [ 1, 2 ] : [ 2 * this.currentPage - 1, 2 * this.currentPage ],
            this.keyword && (e = [ 1 ], $(".page-box").hide(), $(".tool-box").hide());
            const t = await this.getBaseUrl(), n = e.map((e => {
                let n = `${t}/tags/fc2?sort=${this.sortVal}&page=${e}`;
                return this.keyword && (n = `${t}/search?keyword=${this.keyword}`), gmHttp.get(n);
            })), a = await Promise.all(n);
            let i = [];
            for (const o of a) {
                let e = $(o);
                if (e.find(".box-item").each(((e, n) => {
                    const a = $(n), s = a.find("img").attr("data-src");
                    let o = a.find("img").attr("title");
                    const r = a.find(".detail a"), l = r.attr("href"), c = t + (l.startsWith("/") ? l : "/" + l), d = r.text().trim().replace(o + " - ", "");
                    o = o.replace("FC2-PPV", "FC2"), i.push({
                        imgSrc: s,
                        carNum: o,
                        href: c,
                        title: d
                    });
                })), !this.maxPage) {
                    let t, n = e.find(".page-item:not(.disabled)").last();
                    if (n.find("a.page-link").length) {
                        let e = n.find("a.page-link").attr("href");
                        t = parseInt(e.split("page=")[1]);
                    } else t = parseInt(n.find("span.page-link").text());
                    this.maxPage = Math.ceil(t / 2), this.renderPagination();
                }
            }
            if (0 === i.length) {
                clog.log(i), show.error("无结果");
                let e = `${t}/dm4/tags/fc2?sort=${this.sortVal}`;
                this.keyword && (e = `${t}/search?keyword=${this.keyword}`), console.error("获取数据失败!", e);
            }
            let s = this.markDataListHtml(i);
            $(".movie-list").html(s), await utils.smoothScrollToTop();
        } catch (t) {
            console.error(t);
        } finally {
            e.close();
        }
    }
    async open123AvFc2Dialog(e, t) {
        let n = "";
        await storageManager.getSetting("enableLoadOtherSite", _) === _ && (n = '<div class="movie-panel-info fc2-movie-panel-info" style="margin-top:20px"><strong>第三方站点: </strong></div>');
        let a = `\n            <div class="movie-detail-container">\n               \x3c!-- <div class="movie-poster-container">\n                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>\n                </div>\n                <div class="right-box">--\x3e\n                    <div class="movie-info-container">\n                        <div class="search-loading">加载中...</div>\n                    </div>\n                    \n                    ${n}\n                    \n                    <div style="margin: 10px 0">\n                        <a id="filterBtn" class="menu-btn" style="background-color:${f}"><span>${m}</span></a>\n                        <a id="favoriteBtn" class="menu-btn" style="background-color:${w}"><span>${v}</span></a>\n                        <a id="hasDownBtn" class="menu-btn" style="background-color:${x}"><span>${y}</span></a>\n                        <a id="hasWatchBtn" class="menu-btn" style="background-color:${S};"><span>${k}</span></a>\n                        \n                        <a id="search-subtitle-btn" class="menu-btn fr-btn" style="background:linear-gradient(to bottom, #8d5656, rgb(196,159,91))">\n                            <span>字幕 (SubTitleCat)</span>\n                        </a>\n                        <a id="xunLeiSubtitleBtn" class="menu-btn fr-btn" style="background:linear-gradient(to left, #375f7c, #2196F3)">\n                            <span>字幕 (迅雷)</span>\n                        </a>\n                    </div>\n                    <div class="message video-panel" style="margin-top:20px">\n                        <div id="magnets-content" class="magnet-links">\n                        </div>\n                    </div>\n                    <div id="reviews-content">\n                    </div>\n                    <div id="related-content">\n                    </div>\n                    <span id="data-actress" style="display: none"></span>\n               \x3c!-- </div>--\x3e\n            </div>\n        `;
        layer.open({
            type: 1,
            title: e,
            content: a,
            area: utils.getDefaultArea(),
            skin: "movie-detail-layer",
            scrollbar: !1,
            success: (n, a) => {
                utils.setupEscClose(a), this.loadData(e, t);
                let i = e.replace("FC2-", "");
                $("#magnets-content").append(this.getBean("MagnetHubPlugin").createMagnetHub(i)),
                $("#favoriteBtn").on("click", (async n => {
                    const a = $("#data-actress").text(), i = $("#data-publishTime").text();
                    await storageManager.saveCar({
                        carNum: e,
                        url: t,
                        names: a,
                        actionType: h,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#filterBtn").on("click", (n => {
                    utils.q(n, `是否屏蔽${e}?`, (async () => {
                        const n = $("#data-actress").text(), a = $("#data-publishTime").text();
                        await storageManager.saveCar({
                            carNum: e,
                            url: t,
                            names: n,
                            actionType: d,
                            publishTime: a
                        }), window.refresh(), layer.closeAll(), window.location.href.includes("collection_codes?movieId") && utils.closePage();
                    }));
                })), $("#hasDownBtn").on("click", (async n => {
                    const a = $("#data-actress").text(), i = $("#data-publishTime").text();
                    await storageManager.saveCar({
                        carNum: e,
                        url: t,
                        names: a,
                        actionType: g,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#hasWatchBtn").on("click", (async n => {
                    const a = $("#data-actress").text(), i = $("#data-publishTime").text();
                    await storageManager.saveCar({
                        carNum: e,
                        url: t,
                        names: a,
                        actionType: p,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#search-subtitle-btn").on("click", (t => utils.openPage(`https://subtitlecat.com/index.php?search=${e}`, e, !1, t))),
                $("#xunLeiSubtitleBtn").on("click", (() => this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(e)));
                let s = e.replace("FC2-", "");
                this.getBean("OtherSitePlugin").loadOtherSite(s, e).then();
            }
        });
    }
    async loadData(e, t) {
        let n = loading();
        try {
            const {id: n, publishDate: a, title: i, moviePoster: s} = await this.get123AvVideoInfo(t);
            $(".movie-info-container").html(`\n                    <h3 class="movie-title" style="margin-bottom: 10px"><strong class="current-title">${escapeHtml(i || "无标题")}</strong></h3>\n                    <div class="movie-meta" style="margin-bottom: 10px">\n                        <span><strong>番号: </strong>${e || "未知"}</span>\n                        <span><strong>年份: </strong>${a || "未知"}</span>\n                        <span>\n                            <strong>站点: </strong>\n                            <a href="https://fc2ppvdb.com/articles/${e.replace("FC2-", "")}" target="_blank">fc2ppvdb</a>\n                            <a style="margin-left: 5px;" href="https://adult.contents.fc2.com/article/${e.replace("FC2-", "")}/" target="_blank">fc2电子市场</a>\n                        </span>\n                    </div>\n                    <div class="movie-actors" style="margin-bottom: 10px">\n                        <div class="actor-list"><strong>主演: </strong></div>\n                    </div>\n                    <div class="movie-seller" style="margin-bottom: 10px">\n                        <span><strong>販売者: </strong></span>\n                    </div>\n                    <div class="movie-gallery" style="margin-bottom: 10px">\n                        <strong>剧照: </strong>\n                        <div class="image-list"></div>\n                    </div>\n                    \n                    <div id="data-publishTime" style="display: none">${a || ""}</div>\n\n                `),
            this.getImgList(e).then(), this.getActressInfo(e).then(), this.getBean("TranslatePlugin").translate(e, !1).then();
        } catch (a) {
            console.error(a);
        } finally {
            n.close();
        }
    }
    handleLongImg(e) {
        utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
            $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container" style="overflow:hidden;max-height: 150px;max-width:150px; text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> ');
            const t = await this.getBean("ScreenShotPlugin").getScreenshot(e);
            t && ($(".screen-container").html(`<img src="${t}" alt="" loading="lazy" style="width: 100%;">`),
            $(".screen-container").on("click", (e => {
                e.stopPropagation(), e.preventDefault(), showImageViewer(e.currentTarget);
            })));
        }));
    }
    async get123AvVideoInfo(e) {
        const t = await gmHttp.get(e), n = t.match(/v-scope="Movie\({id:\s*(\d+),/), a = n ? n[1] : null, i = utils.htmlTo$dom(t);
        return {
            id: a,
            publishDate: i.find('span:contains("リリース日:")').next("span").text(),
            title: i.find("h1").text().trim(),
            moviePoster: i.find("#player").attr("data-poster")
        };
    }
    async getActressInfo(e) {
        let t = `https://fc2ppvdb.com/articles/${e.replace("FC2-", "")}`;
        const n = await gmHttp.get(t), a = $(n), i = a.find("div").filter((function() {
            return 0 === $(this).text().trim().indexOf("女優：");
        }));
        if (0 === i.length || i.length > 1) return void show.error("解析女优信息失败");
        const s = $(i[0]).find("a");
        let o = "<strong>主演: </strong>";
        if (s.length > 0) {
            let e = "";
            s.each(((t, n) => {
                let a = $(n), i = a.text(), s = a.attr("href");
                o += `<span class="actor-tag"><a href="https://fc2ppvdb.com${s}" target="_blank">${i}</a></span>`,
                e += i + " ";
            })), $("#data-actress").text(e);
        } else o += "<span>暂无演员信息</span>";
        $(".actor-list").html(o);
        const r = a.find("div").filter((function() {
            return 0 === $(this).text().trim().indexOf("販売者：");
        }));
        if (r.length > 0) {
            const e = $(r[0]).find("a");
            if (e.length > 0) {
                const t = $(e[0]);
                let n = t.text(), a = t.attr("href");
                $(".movie-seller").html(`<span><strong>販売者: </strong><a href="https://fc2ppvdb.com${a}" target="_blank">${n}</a></span>`);
            }
        }
    }
    async getImgList(e) {
        let t = e.replace("FC2-", ""), n = `https://adult.contents.fc2.com/article/${e.replace("FC2-", "")}/`;
        const a = await gmHttp.get(n, null, {
            referer: n
        });
        let i = $(a).find(".items_article_SampleImagesArea img").map((function() {
            return $(this).attr("src");
        })).get(), s = "";
        Array.isArray(i) && i.length > 0 ? s = i.map(((e, t) => `\n                <a href="${e}" data-fancybox="movie-gallery" data-caption="剧照 ${t + 1}">\n                    <img src="${e}" class="movie-image-thumb"  alt=""/>\n                </a>\n            `)).join("") : $(".movie-gallery").html("<h4>剧照: 暂无剧照</h4>"),
        $(".image-list").html(s), this.handleLongImg(t);
    }
    async getMovie(e, t) {
        let n = `${await this.getBaseUrl()}/ajax/v/${e}/videos`, a = loading();
        try {
            let e = (await gmHttp.get(n)).result.watch;
            return e.length > 0 ? (e.forEach((e => {
                e.url = e.url + "?poster=" + t;
            })), e) : null;
        } catch (i) {
            console.error(i);
        } finally {
            a.close();
        }
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach((e => {
            t += `\n                <div class="item">\n                    <a href="${e.href}" class="box" title="${e.title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${e.imgSrc.replace("/s360", "")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${e.carNum}</strong> ${e.title}</div>\n                        <div class="score">\n                        </div>\n                        <div class="meta">\n                        </div>\n                        <div class="tags has-addons">\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}

class Re extends X {
    constructor() {
        super(...arguments), i(this, "currentEngine", null), i(this, "searchEngines", [ {
            name: "U9A9",
            id: "u9a9",
            url: "https://u9a9.com/?type=2&search={keyword}",
            targetPage: "https://u9a9.com/?type=2&search={keyword}",
            parseHtml: this.parseTorrentList
        }, {
            name: "U3C3",
            id: "u3c3",
            url: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
            targetPage: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
            parseHtml: this.parseTorrentList
        }, {
            name: "Sukebei",
            id: "Sukebei",
            url: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
            targetPage: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
            parseHtml: this.parseTorrentList
        } ]);
    }
    getName() {
        return "MagnetHubPlugin";
    }
    async initCss() {
        return "\n            <style>\n                .magnet-container {\n                    margin: 20px auto;\n                    width: 100%;\n                    font-family: Arial, sans-serif;\n                }\n                .magnet-tabs {\n                    display: flex;\n                    border-bottom: 1px solid #ddd;\n                    margin-bottom: 15px;\n                    justify-content: space-between;\n                }\n                .magnet-tab {\n                    padding: 5px 12px;\n                    cursor: pointer;\n                    border: 1px solid transparent;\n                    border-bottom: none;\n                    margin-right: 5px;\n                    background: #f5f5f5;\n                    border-radius: 5px 5px 0 0;\n                }\n                .magnet-tab.active {\n                    background: #fff;\n                    border-color: #ddd;\n                    border-bottom: 1px solid #fff;\n                    margin-bottom: -1px;\n                    font-weight: bold;\n                }\n                .magnet-tab:hover:not(.active) {\n                    background: #e9e9e9;\n                }\n                \n                .magnet-results {\n                    min-height: 200px;\n                }\n                .magnet-result {\n                    padding: 15px;\n                    border-bottom: 1px solid #eee;\n                    position: relative; \n                }\n                .magnet-result:hover {\n                    background-color: #f9f9f9;\n                }\n                .magnet-title {\n                    font-weight: bold;\n                    margin-bottom: 5px;\n                    white-space: nowrap;\n                    overflow: hidden; \n                    text-overflow: ellipsis;\n                    padding-right: 80px; \n                }\n                .magnet-info {\n                    display: flex;\n                    justify-content: space-between;\n                    font-size: 12px;\n                    color: #666;\n                    margin-bottom: 5px;\n                }\n                .magnet-loading {\n                    text-align: center;\n                    padding: 20px;\n                }\n                .magnet-error {\n                    color: #f44336;\n                    padding: 10px;\n                }\n                \n                .magnet-copy {\n                    position: absolute;\n                    right: 15px;\n                    top: 12px;\n                }\n                .magnet-hub-btn {\n                    background-color: #f0f0f0;\n                    color: #555;\n                    border: 1px solid #ddd;\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    transition: all 0.2s;\n                    margin-left: 10px;\n                }\n                .magnet-hub-btn:hover {\n                    background-color: #e0e0e0;\n                    border-color: #ccc;\n                }\n                .magnet-hub-btn.copied {\n                    background-color: #4CAF50;\n                    color: white;\n                    border-color: #4CAF50;\n                }\n            </style>\n        ";
    }
    createMagnetHub(e) {
        e = e.replace("FC2-", "");
        const t = $('<div class="magnet-container"></div>'), n = $('<div class="magnet-tabs"></div>'), a = "jhs_magnetHub_selectedEngine", i = localStorage.getItem(a);
        let s = 0;
        const o = $('<div style="display: flex;"></div>');
        this.searchEngines.forEach(((e, t) => {
            const n = $(`<div class="magnet-tab" data-engine="${e.id}">${e.name}</div>`);
            i && e.id === i ? (n.addClass("active"), this.currentEngine = e, s = t) : 0 !== t || i || (n.addClass("active"),
            this.currentEngine = e), o.append(n);
        })), n.append(o), n.append(`<a style="margin-right: 20px;margin-top:3px" id="targetBox" href="${this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))}" target="_blank">原网页</a>`),
        t.append(n);
        const r = $('<div class="magnet-results"></div>');
        return t.append(r), t.on("click", ".magnet-tab", (n => {
            const i = $(n.target).data("engine");
            this.currentEngine = this.searchEngines.find((e => e.id === i)), $("#targetBox").attr("href", this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))),
            localStorage.setItem(a, i), t.find(".magnet-tab").removeClass("active"), $(n.target).addClass("active"),
            this.searchEngine(r, this.currentEngine, e);
        })), this.searchEngine(r, this.currentEngine || this.searchEngines[s], e), t;
    }
    async searchEngine(e, t, n) {
        e.html(`<div class="magnet-loading">正在从 ${t.name} 搜索 "${n}"...</div>`);
        const a = `${t.name}_${n}`;
        const i = sessionStorage.getItem(a);
        if (i) try {
            const s = JSON.parse(i);
            return void this.displayResults(e, s, t.name);
        } catch (s) {}
        if (t.parseHtml) try {
            const i = t.url.replace("{keyword}", encodeURIComponent(n)), s = await storageManager.cachedRequest(`magnet:${t.id}:${n}`, 216e5, (() => new Promise(((e, a) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: i,
                    onload: i => {
                        try {
                            e(t.parseHtml.call(this, i.responseText, n));
                        } catch (s) {
                            a(s);
                        }
                    },
                    onerror: e => a(new Error(e.statusText || "请求失败"))
                });
            }))));
            return s.length > 0 && sessionStorage.setItem(a, JSON.stringify(s)), void this.displayResults(e, s, t.name);
        } catch (s) {
            return void e.html(`<div class="magnet-error">解析 ${t.name} 结果失败: ${s.message}</div>`);
        }
        t.parseJson && t.parseJson.call(this, e, t, n, a);
    }
    displayResults(e, t, n) {
        function a(e) {
            const t = e.text();
            e.addClass("copied").text("已复制"), setTimeout((() => {
                e.removeClass("copied").text(t);
            }), 2e3);
        }
        function i(e, t) {
            const n = document.createElement("textarea");
            n.value = e, n.style.position = "fixed", document.body.appendChild(n), n.select();
            try {
                document.execCommand("copy"), a(t);
            } catch (i) {
                console.error("复制失败:", i), alert("复制失败，请手动复制链接");
            }
            document.body.removeChild(n);
        }
        e.empty(), 0 !== t.length ? (t.forEach((t => {
            const n = $(`\n                <div class="magnet-result">\n                    <div class="magnet-title"><a href="${t.magnet}">${t.title}</a></div>\n                    <div class="magnet-info">\n                        <span>大小: ${t.size || "未知"}</span>\n                        <span>日期: ${t.date || "未知"}</span>\n                    </div>\n                    <div class="magnet-copy">\n                        <button class="magnet-hub-btn copy-btn" data-magnet="${t.magnet}">复制链接</button>\n\n                    </div>\n                </div>\n            `);
            n.find(".magnet-copy").append(`<button class="magnet-hub-btn one23-offline-btn" data-magnet="${t.magnet}">123离线</button>`),
            e.append(n);
        })), e.on("click", ".copy-btn", (function() {
            const e = $(this), t = e.data("magnet");
            navigator.clipboard ? navigator.clipboard.writeText(t).then((() => {
                a(e);
            })).catch((n => {
                i(t, e);
            })) : i(t, e);
        }))) : e.append('<div class="magnet-error">没有找到相关结果</div>');
    }
    parseBTSOW(e, t, n, a) {
        const i = this;
        GM_xmlhttpRequest({
            method: "POST",
            url: t.url,
            headers: {
                "Content-Type": "application/json"
            },
            data: `[{"search":"${n}"},50,1]`,
            onload: n => {
                try {
                    const s = JSON.parse(n.responseText).data, o = [];
                    for (let e = 0; e < s.length; e++) {
                        let t = s[e];
                        o.push({
                            title: t.name,
                            magnet: "magnet:?xt=urn:btih:" + t.hash,
                            size: (t.size / 1073741824).toFixed(2) + " GB",
                            date: utils.formatDate(new Date(1e3 * t.lastUpdateTime))
                        });
                    }
                    o.length > 0 && sessionStorage.setItem(a, JSON.stringify(o)), i.displayResults(e, o, t.name);
                } catch (s) {
                    e.html(`<div class="magnet-error">解析 ${t.name} 结果失败: ${s.message}</div>`);
                }
            },
            onerror: n => {
                e.html(`<div class="magnet-error">从 ${t.name} 获取数据失败: ${n.statusText}</div>`);
            }
        });
    }
    parseTorrentList(e, t) {
        const n = utils.htmlTo$dom(e), a = [];
        return n.find(".torrent-list tbody tr").each(((e, n) => {
            const i = $(n);
            if (i.text().includes("置顶")) return;
            const s = i.find("td:nth-child(2) a").attr("title") || i.find("td:nth-child(2) a").text().trim();
            if (!s.toLowerCase().includes(t.toLowerCase())) return;
            const o = i.find("td:nth-child(3) a[href^='magnet:']").attr("href"), r = i.find("td:nth-child(4)").text().trim(), l = i.find("td:nth-child(5)").text().trim();
            o && a.push({
                title: s,
                magnet: o,
                size: r,
                date: l
            });
        })), a;
    }
}

class Ve extends X {
    getName() {
        return "ScreenShotPlugin";
    }
    async handle() {
        this.loadScreenShot().then();
    }
    async loadScreenShot() {
        if (!isDetailPage) return;
        if ("yes" !== await storageManager.getSetting("enableLoadScreenShot", "yes")) return;
        let e = this.getPageInfo().carNum;
        r && $(".preview-images .tile-item").first().before(' <a class="tile-item screen-container" style="overflow:hidden;max-height: 215px;text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> '),
        l && $("#sample-waterfall .sample-box:first").after(' <a class="sample-box screen-container" style="overflow:hidden; height: 110px; text-align:center;"><div style="margin-top: 30px;color: #000;cursor: auto">正在加载缩略图</div></a> ');
        try {
            const t = await this.getScreenshot(e);
            this.addImg("缩略图", t), clog.log("加载缩略图:", t);
        } catch (t) {
            this.showErrorFallback(e, t);
        }
    }
    async getScreenshot(e) {
        const t = localStorage.getItem("jhs_screenShot") ? JSON.parse(localStorage.getItem("jhs_screenShot")) : {};
        if (t[e]) return clog.debug("缓存中存在缩略图:", e, t[e]), t[e];
        let n;
        try {
            n = await storageManager.cachedRequest(`screenshot:${e}`, 6048e5, (() => Promise.any([ this.getJavStoreScreenShot(e) ])));
        } catch (i) {
            throw clog.error("获取缩略图资源失败:", n, i), i;
        }
        if (!n) return this.showErrorFallback(e, null), null;
        const a = n.indexOf("https://");
        return -1 !== a && (n = n.substring(a)), t[e] = n, clog.log("缩略图获取成功:", n), localStorage.setItem("jhs_screenShot", JSON.stringify(t)),
        n;
    }
    async getJavStoreScreenShot(e) {
        let t = `https://javstore.net/search/${e}.html`;
        clog.log("正在解析缩略图:", t);
        let n = await gmHttp.get(t);
        const a = utils.htmlTo$dom(n);
        let i = null;
        if (a.find("#content_news h3 span a").each((function() {
            if ($(this).attr("title").toLowerCase().includes(e.toLowerCase())) return i = $(this).attr("href"),
            !1;
        })), !i) return clog.error("JavStore, 查询番号失败:", t), null;
        let s = await gmHttp.get(i);
        const o = utils.htmlTo$dom(s);
        let r = o.find("a:contains('CLICK HERE')").attr("href") || o.find("img[src*='_s.jpg']").attr("src");
        return r ? r.replace(".th", "") : (clog.error("JavStore, 解析预览图失败:", t), null);
    }
    async getJavBestScreenShot(e) {
        let t = `https://javbest.net/?s=${e}`;
        clog.log("正在解析缩略图:", t);
        let n = await gmHttp.get(t);
        const a = utils.htmlTo$dom(n), i = a.find(".app_loop_thumb a").first().attr("href");
        if (!i) throw clog.error("解析JavBest搜索页失败:", t), new Error("解析JavBest搜索页失败");
        const s = a.find(".app_loop_thumb a").first().attr("title");
        if (!s.toLowerCase().includes(e.toLowerCase())) throw clog.error("解析JavBest搜索页失败:", s),
        new Error("解析JavBest搜索页失败");
        const o = await gmHttp.get(i);
        let r = $(o).find('#content a img[src*="_t.jpg"]').attr("src");
        if (!r) throw clog.error("解析JavBest缩略图失败:", t), new Error("解析JavBest缩略图失败");
        return r = r.replace("_t", "").replace("http:", "https:"), r;
    }
    async getJavFreeScreenShot(e) {
        let t = `https://javfree.me/search/${e}/`, n = await gmHttp.get(t);
        const a = utils.htmlTo$dom(n).find("article h2.entry-title a");
        if (!a || 0 === a.length) throw clog.error("解析JavFree搜索页失败:", t), new Error("解析JavFree搜索页失败");
        let i = $(a[0]).attr("href"), s = await gmHttp.get(i);
        const o = utils.htmlTo$dom(s).find("#main > article > .entry-content > p img");
        if (!o || 0 === o.length) throw clog.error("解析JavFree详情页失败:", i), new Error("解析JavFree详情页失败");
        const r = o.filter((function() {
            const e = $(this).attr("src");
            return e && e.toLowerCase().endsWith(".jpeg");
        })).map((function() {
            return $(this).attr("src");
        })).get();
        return r.at(-1);
    }
    addImg(e, t) {
        t && (r && $(".screen-container").html(`<img src="${t}" alt="${e}" loading="lazy" style="width: 100%;">`),
        l && $(".screen-container").html(`<div class="photo-frame"><img src="${t}" style="height: inherit;width: 100%;" title="${e}" alt="${e}"></div>`),
        $(".screen-container").on("click", (e => {
            e.stopPropagation(), e.preventDefault(), showImageViewer(e.currentTarget);
        })));
    }
    showErrorFallback(e, t) {
        var n;
        console.error("获取缩略图失败:", null == (n = null == t ? void 0 : t.message) ? void 0 : n.substring(0, 100));
        let a = l ? "margin-top: 30px" : "margin-top: 50px";
        $(".screen-container").html(`<div style="${a}; cursor:auto;color:#000;">获取缩略图失败</div><br/><a href='#' class='retry-link'>点击重试</a> 或 <a class="check-link" href='https://javstore.net/search/${e}.html' target='_blank'>前往确认</a>`).off("click", ".retry-link").off("click", ".check-link").on("click", ".retry-link", (async t => {
            t.stopPropagation(), t.preventDefault(), $(".screen-container").html(`<div style="${a};cursor:auto;color:#000;">正在重新加载...</div>`);
            try {
                const t = await this.getScreenshot(e);
                this.addImg("缩略图", t);
            } catch (n) {
                this.showErrorFallback(e, n);
            }
        })).on("click", ".check-link", (async t => {
            t.stopPropagation(), t.preventDefault(), window.open(`https://javstore.net/search/${e}.html`, "_blank");
        }));
    }
}

class Xe extends X {
    getName() {
        return "FavoriteActressesPlugin";
    }
    async handle() {
        this.bindEvent(), await this.highlightActress(), this.replaceActressAvatar();
    }
    async highlightActress() {
        if (!isDetailPage) return;
        if (await storageManager.getSetting("enableFavoriteActresses", _) !== _) return;
        const e = await storageManager.getFavoriteActressList();
        if (!e || 0 === e.length) return;
        const t = new Set;
        e.forEach((e => {
            e.starId && t.add(String(e.starId).trim());
        })), 0 !== t.size && $(".female").prev().each(((e, n) => {
            const a = $(n), i = a.attr("href");
            let s = null;
            if (i) {
                const e = (i.endsWith("/") ? i.slice(0, -1) : i).split("/"), t = e[e.length - 1];
                t && (s = t.trim());
            }
            let o = !1;
            s && (o = t.has(s)), o && (a.addClass("highlighted"), a.attr("title", "高亮已收藏演员, 可在设置-基础配置中关闭"));
        }));
    }
    async removeActorFromStorage(e) {
        await storageManager.removeFavoriteActress(e) && clog.log("移除演员成功");
    }
    bindEvent() {
        const e = /\/actors\/(\w+)\/(collect|uncollect)/;
        $(document).on("confirm:complete", 'a[href*="/actors/"][href*="/uncollect"]', (async t => {
            const [n] = t.detail;
            if (!n) return;
            const a = $(t.currentTarget).attr("href").match(e), i = a ? a[1] : null;
            i && await this.removeActorFromStorage(i);
        })), $("#button-collect-actor").click((async t => {
            const n = $("#button-collect-actor").attr("href").match(e), a = n ? n[1] : null;
            let i = [], s = $(".actor-section-name");
            s.length && s.text().trim().split(",").forEach((e => {
                i.push(e.trim());
            }));
            let o = $(".section-meta:not(:contains('影片'))");
            if (o.length && o.text().trim().split(",").forEach((e => {
                i.push(e.trim());
            })), !i.length) return void clog.error("获取演员名称失败");
            const r = i[0];
            if (!a) return void clog.error("无法获取演员ID进行收藏操作。");
            const l = ($(".avatar").first().css("background-image") || "").replace(/^url\(["']?|["']?\)$/g, ""), c = {
                starId: a,
                name: r,
                allName: i,
                avatar: l
            };
            1 === await storageManager.addFavoriteActressList([ c ]) ? clog.log(`收藏演员成功: ${r} (ID: ${a})`) : clog.log(`收藏演员失败: ${r} (ID: ${a})`);
        })), $("#button-uncollect-actor").click((async t => {
            const n = $("#button-uncollect-actor").attr("href").match(e), a = n ? n[1] : null;
            a ? await this.removeActorFromStorage(a) : clog.error("无法获取演员ID进行取消收藏操作。");
        }));
    }
    async replaceActressAvatar() {
        const e = this.getActressId();
        if (!e) return;
        const t = (await storageManager.getFavoriteActressList()).find((t => t.starId === e));
        if (t && t.avatar) {
            const e = `url('${t.avatar}')`;
            let n = $(".avatar").first();
            if (0 === n.length) {
                const e = '<div class="column actor-avatar"> <div class="image"> <span class="avatar"></span> </div> </div>';
                $(".section-columns").prepend(e), n = $(".avatar").first();
            }
            if (0 === n.length) return;
            n.css("background-image").trim().toLowerCase() !== e.trim().toLowerCase() && (n.css("background-image", e),
            n.css("background-size", "cover"), n.css("background-position", "top center"), n.css("background-repeat", "no-repeat"));
        }
    }
}

class Qe extends X {
    getName() {
        return "BusImgPlugin";
    }
    handle() {}
    async getVisibleImageItems(e, t) {
        let n = [];
        const a = document.querySelectorAll(e);
        for (const i of a) {
            if (!utils.isHidden(i)) {
                const e = i.querySelector(t);
                if (!(e instanceof HTMLImageElement)) continue;
                e.style.removeProperty("height");
                let a = e.offsetHeight;
                a > 0 && n.push({
                    element: i,
                    imgElement: e,
                    height: a
                });
            }
        }
        return n;
    }
    async logImageHeightsByRow() {
        if (await storageManager.getSetting("enableVerticalModel", C) === _) return;
        const e = this.getSelector().itemSelector, t = await storageManager.getSetting("containerColumns", 5), n = await this.getVisibleImageItems(e, "img");
        if (0 === n.length) return;
        const a = [];
        for (let i = 0; i < n.length; i++) {
            const e = Math.floor(i / t);
            a[e] || (a[e] = []), a[e].push(n[i]);
        }
        a.forEach(((e, t) => {
            const n = e.map((e => e.height));
            if (n.length < 2) return;
            const a = Math.min(...n), i = Math.max(...n);
            let s = 0;
            i - a > 50 && (s = a, e.forEach((e => {
                if (e.height !== s) {
                    const t = `${s}px`;
                    e.imgElement.style.setProperty("height", t, "important");
                }
            })));
        }));
    }
}

class Ze extends X {
    getName() {
        return "TranslatePlugin";
    }
    async initCss() {
        return "\n            <style> \n                .translated-title {\n                    margin-top: 8px; \n                    padding: 12px; \n                    border-radius: 5px; \n                    border-left: 4px solid rgb(76, 175, 80);\n                    background: linear-gradient(135deg, rgb(255, 255, 255) 0%, rgb(245, 245, 245) 100%); \n                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);\n                    font-size: 20px;\n                }\n            </style>\n        ";
    }
    handle() {
        isDetailPage && this.translate();
    }
    async translate(e, t = !0) {
        if (await storageManager.getSetting("translateTitle", _) !== _) return;
        l && (t = !1);
        let n = $(".origin-title");
        if (n.length || (n = $(".current-title")), n.length || (n = $("h3")), !n.length) return;
        const a = n.text().trim();
        if (!a) return void show.error("获取标题失败, 无法进行翻译");
        n.after('<div class="translated-title">翻译中...</div>');
        const i = n.next(".translated-title");
        e || (e = this.getPageInfo().carNum);
        const s = localStorage.getItem("jhs_translate") ? JSON.parse(localStorage.getItem("jhs_translate")) : {};
        s[e] ? i.html(t ? e + "&nbsp;&nbsp;&nbsp;" + s[e] : s[e]) : _e(a, "ja", "zh-CN").then((n => {
            i.html(t ? e + "&nbsp;&nbsp;&nbsp;" + n : n);
        })).catch((e => {
            console.error("翻译失败:", e), i.replaceWith(`<div class="translated-title" style="color: red;">翻译失败: ${escapeHtml(e.message)}</div>`);
        }));
    }
}

class et extends X {
    constructor() {
        super(...arguments), i(this, "singleTaskKey", "checkNewActressActorFilterCar"),
        i(this, "taskConfig", null), i(this, "storageQueue", new ve), i(this, "lastCheckFavoriteActressTimeKey", "jhs_time_checkFavoriteActress"),
        i(this, "lastCheckBlacklistTimeKey", "jhs_time_checkBlacklist"), i(this, "lastCheckNewVideoTimeKey", "jhs_time_checkNewVideo");
    }
    getName() {
        return "TaskPlugin";
    }
    async limitConcurrency(e, t, n, a) {
        this.showIsRun();
        const i = [], s = e.length;
        let o = 0;
        for (const r of e) {
            const e = a(r).finally((() => {
                i.splice(i.indexOf(e), 1);
            }));
            if (i.push(e), o++, i.length >= t) {
                const e = s - o;
                clog.debug(`剩余任务数: <span style="color: #f40">${e}</span>`), await Promise.race(i),
                await utils.sleep(n);
            }
        }
        await Promise.all(i);
    }
    isUnnecessaryCheck(e, t) {
        if (!t) throw new Error("未传入checkIntervalTime");
        t = parseInt(t);
        return utils.getHourDifference(new Date(e), new Date) < t;
    }
    handle() {
        this.doTask().then();
    }
    showIsRun() {
        show.info("正在执行检测任务中, 请勿关闭当前窗口", {
            duration: 3e3
        });
    }
    async doTask() {
        if (isListPage) return await this.loadConfig(), this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl(),
        navigator.locks.request(this.singleTaskKey, {
            ifAvailable: !0
        }, (async e => {
            if (e) {
                if (isListPage && (this.taskConfig.enableCheckBlacklist === _ ? await this.checkBlacklist() : clog.warn("自动检测屏蔽黑名单-禁用"),
                !l)) {
                    if (this.taskConfig.enableCheckFavoriteActress === _) {
                        const e = localStorage.getItem(this.lastCheckFavoriteActressTimeKey), t = this.taskConfig.checkFavoriteActress_IntervalTime, n = e && this.isUnnecessaryCheck(e, t), a = $('a[href*="/users/profile"]').length > 0;
                        n && clog.debug(`检测同步演员, 上次检测时间: ${e} 检测间隔时间: ${t}小时 未到时间`), !n && a && await this.checkFavoriteActress();
                    } else clog.warn("自动同步已收藏的演员-禁用");
                    this.taskConfig.enableCheckNewVideo === _ ? await this.checkNewVideo() : clog.warn("自动检测已收藏演员的最新作品-禁用");
                }
            } else clog.debug("争夺任务锁失败, 跳过执行");
        })).catch((e => {
            console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
        })).finally((() => {
            setTimeout((() => {
                this.doTask();
            }), 3e5);
        }));
    }
    async loadConfig() {
        const e = await storageManager.getSetting();
        this.taskConfig = {
            checkConcurrencyCount: e.checkConcurrencyCount ? Number(e.checkConcurrencyCount) : 2,
            checkRequestSleep: e.checkRequestSleep ? Number(e.checkRequestSleep) : 100,
            enableCheckBlacklist: e.enableCheckBlacklist || _,
            checkBlacklist_intervalTime: e.checkBlacklist_intervalTime ? Number(e.checkBlacklist_intervalTime) : 12,
            checkBlacklist_ruleTime: e.checkBlacklist_ruleTime ? Number(e.checkBlacklist_ruleTime) : 8760,
            enableCheckFavoriteActress: e.enableCheckFavoriteActress || _,
            checkFavoriteActress_IntervalTime: e.checkFavoriteActress_IntervalTime ? Number(e.checkFavoriteActress_IntervalTime) : 24,
            enableCheckNewVideo: e.enableCheckNewVideo || _,
            checkNewVideo_intervalTime: e.checkNewVideo_intervalTime ? Number(e.checkNewVideo_intervalTime) : 12,
            checkNewVideo_ruleTime: e.checkNewVideo_ruleTime ? Number(e.checkNewVideo_ruleTime) : 8760
        };
    }
    async checkBlacklist(e) {
        let t = await storageManager.getBlacklist();
        if (0 === t.length) return;
        t = t.sort(((e, t) => e.createTime < t.createTime ? 1 : e.createTime > t.createTime ? -1 : 0));
        const n = this.taskConfig.checkConcurrencyCount, a = this.taskConfig.checkRequestSleep, i = this.taskConfig.checkBlacklist_intervalTime, s = this.taskConfig.checkBlacklist_ruleTime, o = localStorage.getItem(this.lastCheckBlacklistTimeKey);
        if (!e && o && this.isUnnecessaryCheck(o, i)) return void clog.debug(`检测黑名单, 上次检测时间: ${o} 检测间隔时间: ${i}小时 未到时间`);
        const r = [], l = [];
        for (const h of t) {
            let t = h.name, n = h.checkTime, a = h.lastPublishTime, o = h.url;
            if (new URL(window.location.href).hostname === new URL(o).hostname) {
                if (e || !n || !this.isUnnecessaryCheck(n, i)) if (!a || 0 === s || this.isUnnecessaryCheck(a, s)) r.push(h); else {
                    let e = `检测黑名单: ${t} ${a} 停更超过${s / 24 / 365}年,跳过检测`;
                    l.push(e), $("#checkBlacklistMsg").text(e);
                }
            } else clog.log("黑名单地址非同域名,跳过", o);
        }
        if (0 === r.length) return;
        l.forEach((e => {
            clog.log(e);
        })), clog.log(`<span style='color: #f40'>检测屏蔽黑名单, 总任务数: ${r.length}, 并发限制:${n}, 请求间隔时间:${a}ms</span>`);
        const c = this.getBean("BlacklistPlugin");
        await this.limitConcurrency(r, n, a, (async e => {
            let {starId: t, name: n, url: a} = e;
            try {
                clog.log("正在检屏黑名单演员:", n, a), $("#checkBlacklistMsg").text(`正在检屏黑名单演员: ${n} ${a}`);
                const e = await gmHttp.get(a), i = utils.htmlTo$dom(e);
                this.storageQueue.addTask((async () => {
                    let {lastPublishTime: e} = await c.parseAndSaveFilterInfo(i, n, t);
                    await storageManager.updateBlacklistItem({
                        starId: t,
                        name: n,
                        checkTime: utils.getNowStr(),
                        lastPublishTime: e
                    });
                }));
            } catch (i) {
                $("#checkBlacklistMsg").text(`检测屏蔽演员信息, 发生错误: ${a}`), clog.error("检测屏蔽演员信息, 发生错误:", a, i),
                show.error("检测屏蔽演员信息, 发生错误:" + i, "bottom", "right");
            }
        })), await this.storageQueue.waitAllFinished();
        const d = utils.getNowStr();
        localStorage.setItem(this.lastCheckBlacklistTimeKey, d), clog.log('<span style="color: #f40">-------- END 检测屏蔽黑名单 END --------</span>'),
        $("#checkBlacklistMsg").text("检测屏蔽黑名单, 结束"), this.getBean("BlacklistPlugin").resetBtnTip().then();
    }
    async checkFavoriteActress() {
        const e = `${this.javDbUrl}/users/collection_actors`, t = [];
        await this.scrapeActorInfo(e, t), clog.log("所有演员信息已收集, 总计数量:", t.length), $("#checkNewVideoMsg").text("同步完成"),
        t.length > 0 && (await storageManager.addFavoriteActressList(t), localStorage.setItem(this.lastCheckFavoriteActressTimeKey, utils.getNowStr()),
        this.getBean("NewVideoPlugin").resetBtnTip().then());
    }
    async scrapeActorInfo(e, t) {
        clog.log(`正在抓取页面: ${e}`), $("#checkNewVideoMsg").text(`正在解析已收藏的演员: ${e}`);
        try {
            const n = await gmHttp.get(e), a = utils.htmlTo$dom(n);
            a.find("#actors .actor-box a").each(((e, n) => {
                const a = $(n), i = a.attr("title"), s = a.attr("href");
                if (i && s) {
                    const e = i.split(",").map((e => e.trim())).filter((e => e.length > 0)), n = e[0] || "", o = new URL(s, this.javDbUrl).pathname.split("/").filter((e => e.length > 0));
                    let r = "";
                    o.length > 0 && (r = o[o.length - 1]);
                    let l = D;
                    const c = a.find("img").attr("src"), d = a.find(".info");
                    d.length && d.text().trim().includes("無碼") && (l = A), t.push({
                        starId: r,
                        name: n,
                        allName: e,
                        avatar: c,
                        actressType: l,
                        lastCheckTime: null,
                        lastUpdateTime: null
                    });
                }
            }));
            const i = a.find(".pagination-next").attr("href");
            if (i) {
                const e = new URL(i, this.javDbUrl).href;
                await this.scrapeActorInfo(e, t);
            }
        } catch (n) {
            clog.error(`抓取 ${e} 时发生错误:`, n);
        }
    }
    async checkNewVideo(e) {
        const t = await storageManager.getFavoriteActressList(), n = utils.genericSort(t, [ {
            key: e => {
                var t;
                return (null == (t = e.newVideoList) ? void 0 : t.length) ?? 0;
            },
            order: "desc"
        }, {
            key: "lastPublishTime",
            order: "desc"
        } ]), a = this.taskConfig.checkConcurrencyCount, i = this.taskConfig.checkRequestSleep, s = this.taskConfig.checkNewVideo_intervalTime, o = this.taskConfig.checkNewVideo_ruleTime, r = localStorage.getItem(this.lastCheckNewVideoTimeKey);
        if (!e && r && this.isUnnecessaryCheck(r, s)) return void clog.debug(`检测新作品, 上次检测时间: ${r} 检测间隔时间: ${s}小时 未到时间`);
        const l = [], c = [];
        for (const m of n) {
            const {lastCheckTime: t, lastPublishTime: n, name: a} = m;
            !e && t && this.isUnnecessaryCheck(t, s) || (!n || 0 === o || this.isUnnecessaryCheck(n, o) ? l.push(m) : c.push(`检测新作品: ${a} ${n} 停更超过${o / 24 / 365}年,跳过检测`));
        }
        if (0 === l.length) return;
        c.forEach((e => {
            clog.log(e);
        })), clog.log(`<span style='color: #f40'>检测最新作品, 总任务数: ${l.length}, 并发限制:${a}, 请求间隔时间:${i}ms</span>`);
        const d = await storageManager.getTitleFilterKeyword(), h = await storageManager.getBlacklistCarList(), g = new Set(h.map((e => e.carNum)));
        await this.limitConcurrency(l, a, i, (async e => {
            const {lastCheckTime: t, name: n, starId: a} = e;
            let i = `${this.javDbUrl}/actors/${a}?t=d`;
            try {
                clog.log("正在检测最新作品, 演员:", n, i), $("#checkNewVideoMsg").text(`正在检测最新作品, 演员: ${n}`);
                const e = await gmHttp.get(i), t = utils.htmlTo$dom(e);
                this.storageQueue.addTask((async () => {
                    await this.parsePage(t, a, n, d, g);
                }));
            } catch (s) {
                clog.error("检测屏蔽演员信息, 发生错误:", i, s), console.error("检测屏蔽演员信息, 发生错误:", i, s), show.error("检测屏蔽演员信息, 发生错误:" + s, "bottom", "right");
            }
        })), await this.storageQueue.waitAllFinished(), localStorage.setItem(this.lastCheckNewVideoTimeKey, utils.getNowStr()),
        clog.log('<span style="color: #f40">检测最新作品---结束</span>'), $("#checkNewVideoMsg").text("检测完毕");
        const p = this.getBean("NewVideoPlugin");
        p.loadData(), p.resetBtnTip().then();
    }
    async parsePage(e, t, n, a, i) {
        let s, o, r = !1, l = T;
        if (e.text().includes(I) && (r = !0, l = I), r && e.find(".avatar-box").length > 0 && e.find(".avatar-box").parent().remove(),
        s = e.find(this.getSelector(l).requestDomItemSelector), o = e.find(this.getSelector(l).nextPageSelector).attr("href"),
        o && 0 === s.length) throw clog.error("新作品检测-解析列表失败"), show.error("新作品检测-解析列表失败"),
        new Error("新作品检测-解析列表失败");
        let c = [], d = null;
        for (const m of s) {
            const e = $(m), {carNum: t, url: n, title: s, publishTime: o} = this.getBean("ListPagePlugin").findCarNumAndHref(e);
            if (!t) continue;
            a.find((e => s.includes(e) || t.includes(e))) || (i.has(t) || (d || (d = o), c.push(t)));
        }
        const h = await storageManager.getCarMap(), p = c.filter((e => !h.has(e)));
        p.length > 0 && clog.log(`<span style='color: #f40'>检测出新作品, ${n}, 共${p.length}部</span>`),
        await storageManager.updateFavoriteActress({
            starId: t,
            lastCheckTime: utils.getNowStr(),
            newVideoList: p,
            lastPublishTime: d
        });
    }
    async checkOneNewVideo(e) {
        const t = await storageManager.getTitleFilterKeyword(), n = await storageManager.getBlacklistCarList(), a = new Set(n.map((e => e.carNum))), {lastCheckTime: i, name: s, starId: o} = e;
        let r = `${this.javDbUrl}/actors/${o}?t=d`;
        const l = $("#checkNewVideoMsg");
        try {
            clog.log("正在检测最新作品, 演员:", s, r), l.text(`正在检测最新作品, 演员: ${s}`);
            const e = await gmHttp.get(r), n = utils.htmlTo$dom(e);
            await this.parsePage(n, o, s, t, a), clog.log('<span style="color: #f40">检测最新作品---结束</span>'),
            l.text("检测完毕");
            this.getBean("NewVideoPlugin").loadData();
        } catch (c) {
            clog.error("检测屏蔽演员信息, 发生错误:", r, c), show.error("检测屏蔽演员信息, 发生错误:" + c, "bottom", "right"),
            l.text(`检测屏蔽演员信息, 发生错误: ${r}`);
        }
    }
}

const tt = [ {
    name: "jsDelivr (全球CDN)",
    json: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Filetree.json",
    base: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/"
}, {
    name: "GitHub Raw (备用)",
    json: "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json",
    base: "https://raw.githubusercontent.com/gfriends/gfriends/master/Content/"
} ], nt = "jhs_img_cdn_index";

let at = parseInt(localStorage.getItem(nt) || "0", 10);

(at >= tt.length || at < 0) && (at = 0);

let it = tt[at].json, st = tt[at].base;

const ot = "filetreeStore", rt = "filetree_data", lt = {
    db: null,
    async open() {
        return this.db ? this.db : new Promise(((e, t) => {
            const n = indexedDB.open("GfriendsAvatarDB", 1);
            n.onupgradeneeded = e => {
                this.db = e.target.result, this.db.objectStoreNames.contains(ot) || this.db.createObjectStore(ot);
            }, n.onsuccess = t => {
                this.db = t.target.result, e(this.db);
            }, n.onerror = e => {
                console.error("IndexedDB open error:", e.target.errorCode), t(new Error("Failed to open IndexedDB"));
            };
        }));
    },
    async get(e) {
        return await this.open(), new Promise((t => {
            const n = this.db.transaction([ ot ], "readonly").objectStore(ot).get(e);
            n.onsuccess = () => t(n.result), n.onerror = () => t(null);
        }));
    },
    async set(e, t) {
        return await this.open(), new Promise(((n, a) => {
            const i = this.db.transaction([ ot ], "readwrite").objectStore(ot).put(t, e);
            i.onsuccess = () => n(), i.onerror = e => {
                console.error("IndexedDB set error:", e.target.errorCode), a(new Error("Failed to write to IndexedDB"));
            };
        }));
    }
};

let ct = null, dt = null;

function ht(e) {
    if (!e || !e.Content) return null;
    const t = {}, n = e.Content;
    for (const a in n) {
        const e = encodeURIComponent(a);
        for (const i in n[a]) {
            let s = i.replace(/\.jpg$/i, "").split("-")[0];
            s.startsWith("AI-Fix-") && (s = s.substring(7));
            const o = s.toLowerCase().trim();
            if (o.length > 0) {
                const s = n[a][i], r = s.indexOf("?");
                let l, c = "";
                r > -1 ? (l = encodeURIComponent(s.substring(0, r)), c = s.substring(r)) : l = encodeURIComponent(s);
                const d = `${st}${e}/${l}${c}`;
                t[o] || (t[o] = []), t[o].includes(d) || t[o].push(d);
            }
        }
    }
    return t;
}

async function gt(e) {
    let t = loading();
    try {
        await async function() {
            if (ct && dt) return ct;
            let e = null;
            try {
                e = await lt.get(rt);
            } catch (a) {
                console.error("读取 IndexedDB 失败:", a);
            }
            if (e && e.Content && (ct = e, dt = ht(e), dt)) return ct;
            show.info("正在载入头像数据源...");
            const t = await fetch(it);
            if (!t.ok) throw new Error(`请求头像源失败: ${t.status}`);
            const n = await t.json();
            if (n && n.Content) {
                ct = n, dt = ht(n);
                try {
                    await lt.set(rt, n), clog.debug("载入头像数据源并写入缓存成功!");
                } catch (a) {
                    clog.error(a), show.error("头像数据源写入缓存失败，可能磁盘已满或其他权限问题。");
                }
                return ct;
            }
            clog.error(n);
            throw new Error("解析头像数据源失败");
        }();
    } catch (i) {
        return show.error(i), [];
    } finally {
        t.close();
    }
    if (!dt) return [];
    const n = new Set, a = e.map((e => e.toLowerCase().trim())).filter((e => e.length > 0));
    if (0 === a.length) return [];
    for (const s of a) {
        const e = dt[s];
        e && e.forEach((e => n.add(e)));
    }
    return Array.from(n);
}

class pt extends X {
    constructor() {
        super(...arguments), i(this, "currentPage", 1), i(this, "pageSize", 30);
    }
    getName() {
        return "NewVideoPlugin";
    }
    async initCss() {
        return "\n            <style>\n                #actress-card-container {\n                    display: grid;\n                    grid-template-columns: repeat(auto-fill, minmax(243px, 1fr)); /* 响应式3-5列 */\n                    gap: 20px;\n                    padding-bottom: 20px;\n                    padding-right: 10px;\n                    background: #f9f9f9;\n                    border-radius: 5px;\n                    overflow-y: auto;\n                }\n                .actress-card {\n                    background: #fff;\n                    border: 1px solid #e0e0e0;\n                    border-radius: 8px;\n                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);\n                    padding: 15px;\n                    text-align: center;\n                    display: flex;\n                    flex-direction: column;\n                    justify-content: space-between;\n                    position: relative;\n                    overflow: hidden;\n                }\n                .actress-card:hover {\n                    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);\n                }\n                .actress-card-name {\n                    font-size: 1.2em;\n                    font-weight: bold;\n                    color: #007bff;\n                    margin-top: 10px;\n                }\n                .actress-card-allname {\n                    font-size: 0.9em;\n                    color: #999;\n                    margin-top: 5px;\n                    height: 30px; /* 保证高度一致性 */\n                    overflow: hidden;\n                    white-space: nowrap;      /* 防止文字换行 */\n                    text-overflow: ellipsis;  /* 当文本溢出时，显示省略号 */\n                }\n                .actress-card-avatar {\n                    width: 100px;\n                    height: 100px;\n                    border-radius: 50%;\n                    object-fit: contain;\n                    margin: 0 auto;\n                    border: 4px solid #f0f0f0;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\n                }\n                \n                .card-tag {\n                    position: absolute;\n                    top: 15px; /* 调整标签距离顶部的距离 */\n                    right: -50px; /* 调整标签距离右侧的距离，负值让它移到外面一点 */\n                    \n                    width: 150px; /* 标签的宽度，影响斜角长度 */\n                    padding: 5px 0; /* 上下内边距 */\n                    text-align: center;\n                    \n                    background-color: #ff4757; /* 标签颜色 */\n                    color: white; /* 文字颜色 */\n                    font-size: 14px;\n                    font-weight: bold;\n                    z-index: 10; /* 确保标签在其他内容之上 */\n                \n                    /* 3. 核心：旋转标签，使其倾斜 */\n                    transform: rotate(45deg); /* 45度斜角 */\n                    \n                    /* 可选：添加一些阴影或边框效果 */\n                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);\n                }\n                \n                .card-new-count-tag {\n                    position: absolute;\n                    top: 5px;\n                    left: 5px;\n                    text-align: center;\n                    font-size: 14px;\n                    font-weight: bold;\n                    z-index: 10;\n                }\n                \n                #actress-pagination {\n                    padding-top: 10px;\n                    text-align: center;\n                    border-top: 1px solid #ddd;\n                }\n                @media (max-width: 600px) {\n                    .page-number-btn {\n                        display: none !important;\n                    }\n                }\n                \n                \n                .card-btn {\n                    width: 44px;\n                    height: 44px;\n                    border-radius: 50%;\n                    display: flex;\n                    justify-content: center;\n                    align-items: center;\n                    text-decoration: none;\n                    border: none;\n                    cursor: pointer;\n                    background: linear-gradient(145deg, #e0e0e0 0%, #f7f7f7 100%);\n                    box-shadow: 8px 8px 16px rgba(0, 0, 0, 0.08),\n                                -8px -8px 16px rgba(255, 255, 255, 1.0);\n                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);\n                }\n                \n                .card-btn svg,\n                .card-btn svg path {\n                    transition: fill 0.3s ease;\n                }\n                \n                .card-btn:hover {\n                    box-shadow: inset 5px 5px 10px rgba(0, 0, 0, 0.1),\n                                inset -5px -5px 10px rgba(255, 255, 255, 0.9);\n                    transform: scale(0.97);\n                    background: #e0e0e0;\n                }\n                \n                .btn-check-actress svg path {\n                    fill: #4CAF50;\n                }\n                .btn-check-actress:hover svg path {\n                    fill: #388E3C;\n                }\n                \n                .btn-edit-actress svg path {\n                    fill: #FFC107;\n                }\n                .btn-edit-actress:hover svg path {\n                    fill: #FFB300;\n                }\n                \n                .btn-delete-actress svg path {\n                    fill: #F44336;\n                }\n                .btn-delete-actress:hover svg path {\n                    fill: #D32F2F;\n                }\n            </style>\n        ";
    }
    async handle() {
        await this.showNewVideoCount();
    }
    getPendingNewVideoCount(e, t) {
        return Array.isArray(e?.newVideoList) ? e.newVideoList.filter((e => !t.has(e))).length : 0;
    }
    async getPendingNewVideoTotal() {
        const e = await storageManager.getCarMap();
        return (await storageManager.getFavoriteActressList()).reduce(((t, n) => t + this.getPendingNewVideoCount(n, e)), 0);
    }
    async showNewVideoCount() {
        const e = await this.getPendingNewVideoTotal();
        $("#newVideoCount").text(`${e}`);
    }
    async resetBtnTip() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        $("#checkFavoriteActress").attr("data-tip", `上次自动同步时间: ${n}; 检测间隔时间: ${a}小时`), $("#checkNewVideo").attr("data-tip", `上次检测时间: ${i}; 检测间隔时间: ${s}小时`);
    }
    async openDialog() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        let o = `\n            <div class="newVideoToolBox" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; padding:10px">\n                <div style="margin-bottom: 15px;display: flex; justify-content: space-between;">\n                    <div>\n                        <a class="a-danger" id="checkFavoriteActress" data-tip="上次自动同步时间: ${n}; 检测间隔时间: ${a}小时">${this.actressSvg} &nbsp;&nbsp; 手动同步演员</a>\n                        <a class="a-warning" id="checkNewVideo" data-tip="上次检测时间: ${i}; 检测间隔时间: ${s}小时">${this.newSvg} &nbsp;&nbsp; 手动检测最新作品</a>\n                        <a class="a-info" id="toSetting">${this.settingSvg} &nbsp;&nbsp; 配置</a>\n                        <span id="checkNewVideoMsg"></span>\n                    </div>\n                    <div style="display: flex; align-items: flex-start;">\n                        <select id="paramActressType" style="text-align: center; height: 100%; min-width: 150px; border: 1px solid #ddd; margin-right: 10px">\n                            <option value="all" selected>所有</option>\n                            <option value="uncensored">无码</option>\n                            <option value="censored">有码</option>\n                            <option value="">未知</option>\n                        </select>\n                        <select id="paramSortBy" style="text-align: center; height: 100%; min-width: 150px; border: 1px solid #ddd; margin-right: 10px">\n                            <option value="default" selected>默认排序</option>\n                            <optgroup label="发行时间">\n                                <option value="lastPublishTime_desc">发行时间 新→旧</option>\n                                <option value="lastPublishTime_asc">发行时间 旧→新</option>\n                            </optgroup>\n                            <optgroup label="检测时间">\n                                <option value="lastCheckTime_desc">检测时间 新→旧</option>\n                                <option value="lastCheckTime_asc">检测时间 旧→新</option>\n                            </optgroup>\n                            <optgroup label="新作品数">\n                                <option value="newVideoCount_desc">新作品数 多→少</option>\n                                <option value="newVideoCount_asc">新作品数 少→多</option>\n                            </optgroup>\n                        </select>\n                        \n                        <a class="a-normal" id="reLoad">${this.refreshSvg} &nbsp;&nbsp; 刷新</a>\n                    </div>\n\n                </div>\n                <div id="actress-card-container" class="jhs-scrollbar"></div>\n                <div id="actress-pagination"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: '<span style="padding: 0 10px;" data-tip="数据来源: 女优页面首页,含磁链分类">新作品检测 ❓</span>',
            content: o,
            scrollbar: !1,
            area: utils.getResponsiveArea([ "80%", "90%" ]),
            anim: -1,
            success: async (e, t) => {
                this.loadData(), this.bindClick(), utils.setupEscClose(t);
            }
        });
    }
    bindClick() {
        const e = this.getBean("TaskPlugin");
        $("#reLoad").on("click", (e => {
            this.loadData(), $("#checkNewVideoMsg").text("");
        })), $("#toSetting").on("click", (e => {
            this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
                $("#setting-checkFavoriteActress").css({
                    border: "1px solid #f40"
                }), $("#setting-checkNewVideo").css({
                    border: "1px solid #f40"
                });
            }));
        }));
        $("#checkFavoriteActress").on("click", (t => {
            utils.q({
                clientX: t.clientX,
                clientY: t.clientY + 20
            }, "是否手动同步演员?", (() => {
                navigator.locks.request(e.singleTaskKey, {
                    ifAvailable: !0
                }, (async t => {
                    if (!t) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                    $('a[href*="/users/profile"]').length > 0 ? (await e.checkFavoriteActress(), this.loadData()) : show.error("未登录JavDb, 同步失败");
                })).catch((e => {
                    console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                }));
            }));
        })), $("#checkNewVideo").on("click", (t => {
            utils.q({
                clientX: t.clientX,
                clientY: t.clientY + 20
            }, "是否手动检测最新作品?", (() => {
                navigator.locks.request(e.singleTaskKey, {
                    ifAvailable: !0
                }, (async t => {
                    t ? await e.checkNewVideo(!0) : show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                })).catch((e => {
                    console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                }));
            }));
        })), $("#paramActressType").on("change", (e => {
            this.loadData();
        })), $("#paramSortBy").on("change", (e => {
            this.loadData();
        }));
    }
    loadData() {
        this.currentPage = 1;
        this.renderActressCards().catch(e => {
            clog.error("加载演员卡片失败:", e);
            show.error("加载数据失败");
        });
    }
    async renderActressCards() {
        const e = $("#actress-card-container");
        if (!e.length) return;
        e.html('<div style="text-align:center; padding: 40px; color: #999;">加载中...</div>');
        let t = await storageManager.getFavoriteActressList();
        const n = $("#paramActressType").val();
        "all" !== n && (t = t.filter((e => e.actressType === n)));
        const _carSet = await storageManager.getCarMap();
        const _newVideoCount = e => this.getPendingNewVideoCount(e, _carSet);
        const sortBy = $("#paramSortBy").val();
        const sortMap = {
            "lastPublishTime_desc": [{ key: "lastPublishTime", order: "desc" }],
            "lastPublishTime_asc":  [{ key: "lastPublishTime", order: "asc" }],
            "lastCheckTime_desc":   [{ key: "lastCheckTime", order: "desc" }],
            "lastCheckTime_asc":    [{ key: "lastCheckTime", order: "asc" }],
            "newVideoCount_desc":   [{ key: _newVideoCount, order: "desc" }],
            "newVideoCount_asc":    [{ key: _newVideoCount, order: "asc" }]
        };
        const defaultSort = [{
            key: _newVideoCount,
            order: "desc"
        }, {
            key: "lastPublishTime",
            order: "desc"
        }];
        const a = utils.genericSort(t, sortMap[sortBy] || defaultSort);
        const i = a.length, s = Math.ceil(i / this.pageSize), o = (this.currentPage - 1) * this.pageSize, r = o + this.pageSize, l = a.slice(o, r), c = await this.getBean("OtherSitePlugin").getJavDbUrl(), d = this.getBean("TaskPlugin"), h = await storageManager.getSetting("checkNewVideo_ruleTime") || 8760;
        if (0 === l.length) {
            e.html('<div style="text-align:center; padding: 40px; color: #999;">暂无数据</div>');
            return void this.renderPagination(i, s);
        }
        const _escHtml = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
        const g = l.map((e => {
            const a = Array.isArray(e.allName) ? e.allName.join("，") : "";
            const _a = _escHtml(a), _name = _escHtml(e.name || ""), _remark = _escHtml(e.remark || "");
            const _newCount = this.getPendingNewVideoCount(e, _carSet);
            const _effectivePublishTime = _newCount > 0 ? (e.lastPublishTime || "") : "";
            const i = `${c}/actors/${e.starId}?t=d`;
            let s = !1;
            _effectivePublishTime && (s = !d.isUnnecessaryCheck(_effectivePublishTime, h));
            let o = "未知", r = "#9E9E9E";
            e.actressType === A ? (o = "无码", r = "#4CAF50") : e.actressType === D && (o = "有码",
            r = "#FF9800");
            let l = "";
            return s && (l = "background: linear-gradient(145deg, #e0e0e0 0%, #cabdbd 100%);box-shadow: none"),
            `\n                <div class="actress-card" data-starId="${e.starId}" style="${s ? "background: #d4cece; " : ""}min-height: 370px;">\n                    <a href="${i}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                        <img src="${e.avatar || "https://c0.jdbstatic.com/images/actor_unknow.jpg"}" alt="${_a}" class="actress-card-avatar">\n                    </a>\n\n                    <div>\n                        <a href="${i}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                            <div class="actress-card-name">${_name}</div>\n                        </a>\n                        <div class="actress-card-allname" title="${_a}">${_a}</div>\n                    </div>\n\n                    <div style="font-size: 0.8em; margin-top: 5px;">\n                         <span>上次检测: ${e.lastCheckTime || ""}</span>\n                    </div>\n                    <div style="font-size: 0.8em; margin-top: 5px; min-height: 1.2em;">\n                         <span>${_effectivePublishTime ? "最后发行作品: " + _effectivePublishTime : (_newCount === 0 && e.lastPublishTime ? "已全部标记" : "")}</span>\n                    </div>\n\n                    <div style="font-size: 0.7em; color: #cc4444; margin-top: 5px; min-height: 18px">\n                         <span>${s ? "停更" + h / 24 / 365 + "年以上, 下轮任务不再进行检测" : ""}</span>\n                    </div>\n\n                    <div style="font-size: 0.8em; margin-top: 5px; color: #3765c5; min-height: 10px">\n                         <span>${_remark}</span>\n                    </div>\n\n                    <div style="margin-top: 10px;display: flex; justify-content:center; gap: 10px;">\n                        <a title="编辑" class="card-btn btn-edit-actress" style="${l}" data-starId="${e.starId}">${this.editSvg}</a>\n                        <a title="取消收藏" class="card-btn btn-delete-actress" style="${l}" data-starId="${e.starId}">${this.deleteSvg}</a>\n                        <a title="重新检测该演员" class="card-btn btn-check-actress" style="${l}" data-starId="${e.starId}">${this.checkSvg}</a>\n                    </div>\n\n                    <div class="card-tag" style="background-color:${r}">${o}</div>\n                    <div class="card-new-count-tag" data-tip="最新作品数量: ${_newCount}">🔔 ${_newCount}</div>\n                </div>\n            `;
        })).join("");
        e.html(g), $(".btn-delete-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = a.find((e => e.starId === t));
            utils.q(e, `是否取消收藏 ${n.name}?`, (async () => {
                let e = `${await this.getBean("OtherSitePlugin").getJavDbUrl()}/actors/${t}/uncollect`;
                const n = document.querySelector("meta[name=csrf-token]").content, a = await gmHttp.post(e, null, {
                    "x-csrf-token": n
                });
                a.includes("removeClass") ? (await storageManager.removeFavoriteActress(t), this.loadData(), this.showNewVideoCount()) : (show.error("移除失败"),
                clog.error("移除失败,返回值:", a));
            }));
        })), $(".btn-edit-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = a.find((e => e.starId === t));
            n ? this.editActress(n) : show.error(`未找到 starId 为 ${t} 的女优记录。`);
        })), $(".btn-check-actress").off("click").on("click", (e => {
            e.preventDefault(), navigator.locks.request(d.singleTaskKey, {
                ifAvailable: !0
            }, (async t => {
                if (!t) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                const n = $(e.currentTarget).attr("data-starId"), i = a.find((e => e.starId === n));
                await d.checkOneNewVideo(i);
            })).catch((e => {
                console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
            }));
        })), this.renderPagination(i, s), show.ok("加载完成");
    }
    async editActress(e) {
        const t = e.name, n = e.avatar, a = e.remark || "", i = Array.isArray(e.allName) ? e.allName.join("，") : "", s = Array.isArray(e.newVideoList) ? e.newVideoList.join("，") : "", o = e.starId, r = "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;", l = e.actressType || "", c = `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px; text-align: center;">\n                    <img id="edit-avatar-preview" src="${n}" alt="Avatar Preview" \n                         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid #ddd;">\n                    <div style="text-align: left">\n                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">头像链接:</label>\n                        <input type="text" id="edit-actress-avatar" value="${n}" \n                               style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                       <div style="display: flex; gap: 5px; margin-top: 5px;">\n                            <button type="button" id="search-avatar-btn" \n                                style="flex-grow: 1; padding: 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">\n                                搜索头像\n                            </button>\n                            <button type="button" id="select-cdn-btn" \n                                style="width: 100px; padding: 8px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\n                                选择 CDN 源\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">主名称:</label>\n                    <input type="text" id="edit-actress-name" value="${t}" \n                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">所有别名(用逗号隔开):</label>\n                    <textarea id="edit-actress-allname" style="${r}">${i}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员类别:</label>\n                    <select id="actressType" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${"" === l ? "selected" : ""}>未知</option>\n                        <option value="censored" ${"censored" === l ? "selected" : ""}>有码</option>\n                        <option value="uncensored" ${"uncensored" === l ? "selected" : ""}>无码</option>\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">最新作品(用逗号隔开):</label>\n                    <textarea id="edit-actress-newvideolist" style="${r}">${s}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                   <textarea id="edit-remark" style="${r}">${a}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑女优: ${t} (${o})`,
            area: utils.getResponsiveArea(["500px", "750px"]),
            content: c,
            btn: [ "保存", "取消" ],
            success: (e, t) => {
                const n = e => {
                    e.css("height", "auto"), e.css("height", e[0].scrollHeight + 15 + "px");
                };
                $("#edit-actress-avatar").on("input", (function() {
                    const e = $(this).val();
                    $("#edit-avatar-preview").attr("src", e);
                }));
                const a = $("#edit-actress-allname");
                a.on("input", (function() {
                    n($(this));
                })), n(a);
                const i = $("#edit-actress-newvideolist");
                i.on("input", (function() {
                    n($(this));
                })), n(i), $("#search-avatar-btn").on("click", (async () => {
                    await this.searchAvatar();
                })), $("#select-cdn-btn").on("click", (async () => {
                    await async function() {
                        const e = at, t = tt.map(((t, n) => `\n        <div style="margin-bottom: 10px;">\n            <input type="radio" id="cdn-${n}" name="cdn-source" value="${n}" ${n === e ? "checked" : ""} style="margin-right: 10px;">\n            <label for="cdn-${n}">${t.name} ${t.json.includes("jsdelivr") ? "(推荐)" : ""}</label>\n        </div>\n    `)).join(""), n = `\n        <div style="padding: 20px;">\n            <p style="margin-bottom: 15px; font-weight: bold; color: #333;">请选择头像数据源 (当前: ${tt[e].name}):</p>\n            ${t}\n            <p style="margin-top: 20px; color: #555; font-size: 12px;">切换源会清除本地缓存的数据，并在下次搜索时重新加载。</p>\n        </div>\n    `;
                        layer.open({
                            type: 1,
                            title: "选择 CDN 源",
                            area: [ "400px", "auto" ],
                            content: n,
                            btn: [ "确定", "取消" ],
                            success: (e, t) => {
                                utils.setupEscClose(t);
                            },
                            yes: async e => {
                                const t = $('input[name="cdn-source"]:checked').val(), n = parseInt(t, 10);
                                if (n !== at) {
                                    at = n, localStorage.setItem(nt, n.toString()), it = tt[n].json, st = tt[n].base,
                                    ct = null, dt = null;
                                    try {
                                        await lt.set(rt, null);
                                    } catch (a) {
                                        clog.error("清除 IndexedDB 缓存失败:", a);
                                    }
                                    show.ok(`CDN 源已切换为: ${tt[n].name}`), layer.close(e);
                                } else layer.close(e);
                            }
                        });
                    }();
                })), utils.setupEscClose(t);
            },
            yes: async t => {
                const n = $("#edit-actress-avatar").val().trim(), a = $("#edit-actress-name").val().trim(), i = $("#edit-actress-allname").val().trim(), s = $("#edit-actress-newvideolist").val().trim(), o = $("#edit-remark").val().trim(), r = $("#actressType").val();
                if (!a) return show.error("主名称不能为空"), !1;
                const l = i.split(/[\uff0c,]/).map((e => e.trim())).filter((e => e.length > 0)), c = s.split(/[\uff0c,]/).map((e => e.trim())).filter((e => e.length > 0));
                e.avatar = n, e.name = a, e.allName = l, e.newVideoList = c, e.actressType = r,
                e.remark = o;
                try {
                    await storageManager.updateFavoriteActress(e);
                    this.renderActressCards().then();
                    this.showNewVideoCount();
                    show.ok(`女优 ${a} 信息已更新`);
                    layer.close(t);
                } catch(err) {
                    show.error("修改失败: " + (err.message || err));
                }
            }
        });
    }
    renderPagination(e, t) {
        const n = this.currentPage;
        let a = "";
        const i = $("#actress-pagination");
        if (0 === t) return a = '<span style="color: #666;">共 0 条记录</span>', void i.html(a);
        n > 1 && t > 5 && (a += '<button class="pagination-btn" data-page="1" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">首页</button>'),
        n > 1 && (a += `<button class="pagination-btn" data-page="${n - 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">上一页</button>`);
        let s = Math.max(1, n - Math.floor(2.5)), o = Math.min(t, s + 5 - 1);
        o - s < 4 && (s = Math.max(1, o - 5 + 1));
        for (let r = s; r <= o; r++) {
            a += `<button class="pagination-btn page-number-btn ${r === n ? "active" : ""}" data-page="${r}" style="padding: 8px 12px; margin: 0 3px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; ${r === n ? "background: #007bff; color: white; border-color: #007bff;" : ""}">${r}</button>`;
        }
        n < t && (a += `<button class="pagination-btn" data-page="${n + 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">下一页</button>`),
        n < t && t > 5 && (a += `<button class="pagination-btn" data-page="${t}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">尾页</button>`),
        a += `<span style="margin-left: 20px; color: #666;">共 ${e} 条记录 (第 ${n}/${t} 页)</span>`,
        i.html(a), $(".pagination-btn").off("click").on("click", (e => {
            if ($(e.currentTarget).is("[disabled]")) return;
            const n = parseInt($(e.currentTarget).data("page"));
            n >= 1 && n <= t && n !== this.currentPage && (this.currentPage = n, this.renderActressCards());
        }));
    }
    async searchAvatar() {
        const e = $("#edit-actress-name"), t = $("#edit-actress-allname"), n = e.val().trim(), a = t.val().trim().split(/[\uff0c,]/).map((e => e.trim())).filter((e => e.length > 0));
        if (n && a.unshift(n), 0 === a.length) return void show.error("请先填写女优主名称或别名进行搜索。");
        const i = loading("正在搜索头像...");
        let s = [];
        try {
            s = await gt(a);
        } catch (c) {
            return void show.error(`头像数据加载或搜索失败: ${c.message || c}`);
        } finally {
            i.close();
        }
        if (0 === s.length) return void show.error(`未找到与 '${a.join("、")}' 相关的头像。请检查名称。`);
        const o = s.map(((e, t) => `\n        <div id="wrapper-${t}" class="gfriends-image-item-wrapper">\n            <img alt="" src="${e}" data-url="${e}" class="gfriends-selectable-img" data-wrapper-id="wrapper-${t}" >\n            <div class="gfriends-size-tag" data-size-for="wrapper-${t}">...</div> \n        </div>\n    `)).join(""), r = `\n        <style>\n            /* 保持上一个回答的美化样式 */\n            #gfriends-image-list-container { padding: 15px; height: 100%; box-sizing: border-box; background-color: #f8f9fa; }\n            #gfriends-prompt { color: #555; font-weight: 500; border-bottom: 1px solid #eee; padding-bottom: 10px; }\n            #gfriends-image-list { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }\n            .gfriends-image-item-wrapper {\n                width: 160px; height: 225px; /* 增加高度以容纳尺寸标签 */\n                overflow: hidden; border-radius: 6px;\n                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); transition: transform 0.2s ease, box-shadow 0.2s ease;\n                cursor: pointer; position: relative; \n                padding-bottom: 25px; /* 为尺寸标签留出空间 */\n            }\n            .gfriends-selectable-img {\n                width: 100%; height: 200px; /* 固定图片高度 */\n                object-fit: cover; border: 3px solid transparent; \n                border-radius: 6px; transition: border 0.2s ease;\n            }\n            .gfriends-image-item-wrapper:hover {\n                transform: translateY(-4px) scale(1.02);\n                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);\n            }\n            .gfriends-selectable-img.is-selected {\n                border-color: #ff6347;\n                box-shadow: 0 0 0 3px #ff6347;\n            }\n            /* 新增：尺寸标签样式 */\n            .gfriends-size-tag {\n                position: absolute;\n                bottom: 0; /* 定位到图片容器底部 */\n                left: 0;\n                right: 0;\n                height: 25px;\n                line-height: 25px;\n                text-align: center;\n                background-color: rgba(0, 0, 0, 0.7); /* 半透明背景 */\n                color: #fff;\n                font-size: 11px;\n                font-weight: bold;\n                border-bottom-left-radius: 6px;\n                border-bottom-right-radius: 6px;\n                user-select: none;\n            }\n        </style>\n        \n        <div id="gfriends-image-list-container">\n            <p id="gfriends-prompt" style="text-align: center; font-size: 15px; margin-bottom: 15px;">\n                点击图片即可选择（初始共 ${s.length} 张）\n            </p>\n            <div style="overflow-y: auto; height: calc(100% - 40px);">\n                <div id="gfriends-image-list">\n                    ${o}\n                </div>\n            </div>\n        </div>\n    `;
        let l = 0;
        layer.open({
            type: 1,
            title: `选择女优头像 (${s.length} 张)`,
            area: utils.getResponsiveArea([ "900px", "85%" ]),
            content: r,
            btn: [ "关闭" ],
            success: (e, t) => {
                const n = $(e), a = n.find(".gfriends-selectable-img"), i = n.find("#gfriends-prompt");
                a.each((function() {
                    const e = $(this), a = e.data("wrapper-id"), o = n.find(`#${a}`), r = n.find(`.gfriends-size-tag[data-size-for="${a}"]`);
                    e.on("load", (function() {
                        const e = this.naturalWidth, t = this.naturalHeight;
                        r.text(`${e} x ${t}`);
                    })), e.on("error", (function() {
                        o.remove(), l++;
                        const e = s.length - l;
                        i.text(`点击图片即可选择（已移除 ${l} 张错误图片，剩余 ${e} 张）`), 0 === e && (show.error("所有搜索到的头像链接均已失效，无法选择。"),
                        layer.close(t));
                    })), this.complete && (this.naturalWidth > 0 ? e.trigger("load") : e.trigger("error"));
                })), a.on("click", (function() {
                    const e = $(this), n = e.data("url");
                    $("#edit-actress-avatar").val(n), $("#edit-avatar-preview").attr("src", n), a.removeClass("is-selected"),
                    e.addClass("is-selected"), setTimeout((() => {
                        layer.close(t);
                    }), 150);
                })), utils.setupEscClose(t);
            }
        });
    }
}

class mt extends X {
    getName() {
        return "LocalPlugin";
    }
    async handle() {
        if (r && !window.location.href.includes("/actors/")) {
            this.baseUrl = "http://127.0.0.1:7890", this.canRun = !1;
            try {
                const e = await gmHttp.get(this.baseUrl + "/ping");
                e && 200 === e.code && (this.canRun = !0);
            } catch (e) { console.error("本地服务连通性检查失败:", e); }
            this.canRun && isListPage && utils.loopDetector((() => $("#addBlacklistBtn").length), (() => {
                this.createBtn();
            }), 1, 1e4, !1);
        }
    }
    createBtn() {
        $("#addBlacklistBtn").last().after('\n            <a id="archiveBtn" class="menu-btn main-tab-btn" style="background-color:#39babe !important;margin-left: 20px!important;"><span>视频归档</span></a>\n            <a id="checkSubtitleBtn" class="menu-btn main-tab-btn" style="background-color:#d08736 !important;"><span>检查字幕</span></a>\n        '),
        $("#archiveBtn").on("click", (e => {
            this.archiveFile().then();
        })), $("#checkSubtitleBtn").on("click", (e => {
            this.checkSubTitle().then();
        }));
    }
    async archiveFile() {
        let e = await storageManager.getCarList();
        const t = await gmHttp.post(this.baseUrl + "/archiveFile", {
            carList: e
        });
        let n = t.dataList, a = t.updateHasDownCarNumList;
        if (a && a.length) {
            const t = new Set(a), n = Array.from(t);
            for (const a of n) {
                const t = e.find((e => e.carNum === a));
                t && (await storageManager.saveCar({
                    carNum: a,
                    url: t.url,
                    actionType: g
                }), show.ok(`归档成功, ${a}标记为已下载`));
            }
        }
        n.length > 0 ? layer.open({
            type: 1,
            title: "归档信息",
            shadeClose: !0,
            scrollbar: !1,
            content: '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="archive-container" style="height: 100%;"></div>\n                    </div>\n                ',
            anim: -1,
            area: [ "50%", "70%" ],
            success: e => {
                new Tabulator("#archive-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: !0,
                    data: n,
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapse: !0,
                    columnDefaults: {
                        headerHozAlign: "center",
                        hozAlign: "center"
                    },
                    columns: [ {
                        title: "信息",
                        field: "msg",
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return "ok" === a.type ? `<span style="color:#58ad67">${a.msg}</span>` : `<span style="color:#c52323">${a.msg}</span>`;
                        }
                    }, {
                        title: "操作",
                        headerSort: !1,
                        width: 200,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return n((() => {
                                var t;
                                null == (t = e.getElement().querySelector(".a-primary")) || t.addEventListener("click", (e => {
                                    gmHttp.get(this.baseUrl + "/openFilePath", {
                                        filePath: a.file
                                    });
                                }));
                            })), '<a class="a-primary">打开路径</a>';
                        }
                    } ],
                    locale: "zh-cn",
                    langs: {
                        "zh-cn": {
                            pagination: {
                                first: "首页",
                                first_title: "首页",
                                last: "尾页",
                                last_title: "尾页",
                                prev: "上一页",
                                prev_title: "上一页",
                                next: "下一页",
                                next_title: "下一页",
                                all: "所有",
                                page_size: "每页行数"
                            }
                        }
                    }
                });
            },
            end() {
                window.refresh();
            }
        }) : show.info("没有可归档文件");
    }
    async checkSubTitle() {
        let e = await storageManager.getCarList();
        let t = (await gmHttp.post(this.baseUrl + "/checkSubTitle", {
            dataList: e
        })).data;
        0 !== t.length ? layer.open({
            type: 1,
            title: "检测缺失字幕",
            shadeClose: !0,
            scrollbar: !1,
            content: '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="checkSubTitle-table-container" style="height: 100%;padding-bottom: 10px"></div>\n                    </div>\n                ',
            anim: -1,
            area: [ "70%", "70%" ],
            success: e => {
                new Tabulator("#checkSubTitle-table-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: !0,
                    data: t,
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapse: !0,
                    columnDefaults: {
                        headerHozAlign: "center",
                        hozAlign: "center"
                    },
                    columns: [ {
                        title: "番号",
                        width: 150,
                        field: "carNum",
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = e.getData(), i = a.type;
                            return a.msg, "error" === i ? `<span style="color: #f40">${a.msg}</span>` : a.carNum;
                        }
                    }, {
                        title: "文件路径",
                        field: "filePath",
                        headerSort: !1,
                        formatter: (e, t, n) => e.getData().filePath
                    }, {
                        title: "操作",
                        headerSort: !1,
                        responsive: 0,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return n((() => {
                                var t, n, i, s, o;
                                null == (t = e.getElement().querySelector(".a-success")) || t.addEventListener("click", (e => {
                                    gmHttp.get(this.baseUrl + "/openFilePath", {
                                        filePath: a.filePath
                                    });
                                })), null == (n = e.getElement().querySelector(".a-info")) || n.addEventListener("click", (e => {
                                    let t = a.carNum, n = a.url;
                                    if (n) if (t.includes("FC2-")) {
                                        let e = this.parseMovieId(n);
                                        this.getBean("Fc2Plugin").openFc2Dialog(e, t, n);
                                    } else utils.openPage(n, t, !0, e); else show.error("没有找到url");
                                })), null == (i = e.getElement().querySelector(".a-warning")) || i.addEventListener("click", (e => {
                                    this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(a.carNum);
                                })), null == (s = e.getElement().querySelector(".a-primary")) || s.addEventListener("click", (e => {
                                    utils.openPage("" + ("https://subtitlecat.com/index.php?search=" + a.carNum.replace("FC2-", "")), a.carNum.replace("FC2-", ""), !0, e);
                                })), null == (o = e.getElement().querySelector(".a-danger")) || o.addEventListener("click", (e => {
                                    const t = a.filePath.split("<br/>").filter((e => "" !== e.trim()));
                                    utils.q(e, `是否调用AI程序生成字幕,共${t.length}个视频文件`, (() => {
                                        this.aiSubtitle(t);
                                    }));
                                }));
                            })), '\n                                    <a class="a-success">打开路径</a>\n                                    <a class="a-info">详情页</a>\n                                    <a class="a-warning">迅雷字幕</a>\n                                    <a class="a-primary">SubTitleCat字幕</a>\n                                    <a class="a-danger">AI字幕</a>\n                                ';
                        }
                    } ],
                    locale: "zh-cn",
                    langs: {
                        "zh-cn": {
                            pagination: {
                                first: "首页",
                                first_title: "首页",
                                last: "尾页",
                                last_title: "尾页",
                                prev: "上一页",
                                prev_title: "上一页",
                                next: "下一页",
                                next_title: "下一页",
                                all: "所有",
                                page_size: "每页行数"
                            }
                        }
                    }
                });
            },
            end() {
                window.refresh();
            }
        }) : show.info("视频字幕完整");
    }
    async aiSubtitle(e) {
        const t = await gmHttp.post(this.baseUrl + "/aiSubtitle", {
            fileList: e
        });
        200 === t.code ? show.info("已调用后台程序, 请自行确认") : show.error(t.msg);
    }
    checkHasDown() {
        this.allowRepeatDown = !1;
        $("#enable-magnets-filter").after('<a id="allowRepeatDown" class="menu-btn" style="background-color:#b8d747;margin-left: 5px"><span>关闭重复下载检验</span></a>'),
        $("#allowRepeatDown").on("click", (e => {
            this.allowRepeatDown = !this.allowRepeatDown, $("#allowRepeatDown span").text(this.allowRepeatDown ? "开启重复下载检验" : "关闭重复下载检验");
        }));
        let e = $('a[title="複製番號"]').attr("data-clipboard-text"), t = !1;
        $("#magnets-content .item a").on("click", (n => {
            let a = $(n.target).closest("a, button")[0] || n.target;
            if (t) t = !1; else {
                if (n.preventDefault(), this.allowRepeatDown) return t = !0, void a.click();
                gmHttp.get(baseUrl + "/checkHasDown?carNum=" + e).then((e => {
                    "no" === e.data ? (t = !0, a.click()) : show.info(e.msg, {
                        icon: 2
                    });
                }));
            }
        }));
    }
}

class OneTwoThreeOfflinePlugin extends X {
    constructor() {
        super(...arguments), this.tokenKey = "jhs_123pan_author_token", this.tokenMetaKey = "jhs_123pan_author_token_meta",
        this.syncTimer = null, this.syncFallbackMs = 3e5;
    }
    getName() {
        return "OneTwoThreeOfflinePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .one23-offline-btn {\n                    background-color: #1677ff !important;\n                    color: #fff !important;\n                    border-color: #1677ff !important;\n                }\n                .one23-offline-btn.loading {\n                    opacity: 0.65;\n                    cursor: wait;\n                }\n                .one23-native-btn {\n                    margin-left: 6px;\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    border: 1px solid #1677ff;\n                    background: #1677ff;\n                    color: #fff !important;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1.2;\n                }\n            </style>\n        ";
    }
    async handle() {
        "yun.123pan.com" === window.location.hostname ? this.startTokenSync() : (r || l) && (this.bindSubmit(), this.injectNativeButtons());
    }
    startTokenSync() {
        this.syncTokenOnce(), this.syncTimer && clearInterval(this.syncTimer), this.syncTimer = setInterval((() => this.syncTokenOnce()), this.syncFallbackMs);
        const e = () => this.syncTokenOnce();
        window.addEventListener("storage", e), window.addEventListener("focus", e), document.addEventListener("visibilitychange", (() => {
            document.hidden || this.syncTokenOnce();
        }));
    }
    getTokenFrom123Pan() {
        let e = (localStorage.getItem("authorToken") || "").trim();
        if (e) return {
            token: e,
            source: "authorToken"
        };
        try {
            const t = JSON.parse(localStorage.getItem("userInfo") || "{}");
            if (t.authorToken || t.token) return {
                token: (t.authorToken || t.token || "").trim(),
                source: t.authorToken ? "userInfo.authorToken" : "userInfo.token"
            };
        } catch (t) {}
        const t = document.cookie.split(";");
        for (const n of t) {
            const [t, a] = n.trim().split("=");
            if (t && /token/i.test(t) && a) return {
                token: decodeURIComponent(a).trim(),
                source: `cookie.${t}`
            };
        }
        return {
            token: "",
            source: ""
        };
    }
    syncTokenOnce() {
        const e = this.getTokenFrom123Pan();
        if (!e.token) return;
        const t = GM_getValue(this.tokenKey, ""), n = GM_getValue(this.tokenMetaKey, null);
        if (t === e.token && n && n.source === e.source) return;
        GM_setValue(this.tokenKey, e.token), GM_setValue(this.tokenMetaKey, {
            source: e.source,
            updatedAt: (new Date).toISOString()
        }), t !== e.token && show.info(`123 云盘授权已更新：${e.source}`);
    }
    getStoredToken() {
        return GM_getValue(this.tokenKey, "");
    }
    clearStoredToken(e) {
        GM_setValue(this.tokenKey, ""), GM_setValue(this.tokenMetaKey, {
            source: "cleared",
            reason: e,
            updatedAt: (new Date).toISOString()
        });
    }
    isTokenExpiredError(e) {
        return "TOKEN_EXPIRED" === e || String(e || "").toLowerCase().includes("token is expired");
    }
    getTokenMetaText() {
        const e = GM_getValue(this.tokenMetaKey, null);
        return e && e.source && e.updatedAt ? `（来源：${e.source}，更新：${new Date(e.updatedAt).toLocaleString()}）` : "";
    }
    assertApiResult(e, t) {
        if (0 === e.code) return;
        const n = e.message || e.msg || t || "请求失败";
        throw /token is expired/i.test(n) ? "TOKEN_EXPIRED" : n;
    }
    handleTokenExpired() {
        this.clearStoredToken("expired"), show.error("123 云盘授权已过期，请登录或刷新 yun.123pan.com 后再提交");
    }
    bindSubmit() {
        $(document).off("click.one23", ".one23-offline-btn").on("click.one23", ".one23-offline-btn", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget), n = t.attr("data-magnet");
            n && this.submitMagnet(n, t);
        }));
    }
    injectNativeButtons() {
        r && utils.loopDetector((() => $("#magnets-content .item").length > 0), (() => this.injectJavDbButtons()));
        l && utils.loopDetector((() => $("#magnet-table td a[href^='magnet:']").length > 0), (() => this.injectJavBusButtons()));
    }
    injectJavDbButtons() {
        $("#magnets-content .item").each(((e, t) => {
            const n = $(t), a = n.find("a[href^='magnet:']").first().attr("href") || n.find(".copy-to-clipboard").attr("data-clipboard-text");
            a && 0 === n.find(".one23-offline-btn").length && n.find(".buttons").first().append(`<button class="button is-info is-small one23-offline-btn" data-magnet="${escapeHtml(a)}" type="button">&nbsp;123离线&nbsp;</button>`);
        }));
    }
    injectJavBusButtons() {
        $("#magnet-table td a[href^='magnet:']").each(((e, t) => {
            const n = $(t), a = n.attr("href");
            a && 0 === n.siblings(".one23-offline-btn").length && n.after(`<button class="one23-native-btn one23-offline-btn" data-magnet="${escapeHtml(a)}" type="button">123离线</button>`);
        }));
    }
    async submitMagnet(e, t) {
        const n = this.getStoredToken();
        if (!n) return void show.error("请先登录或刷新 yun.123pan.com，等待授权自动同步后再提交离线任务");
        if (t.hasClass("loading")) return;
        const a = t.text();
        try {
            t.addClass("loading").prop("disabled", !0).text("提交中");
            const i = await this.resolveMagnet(e, n), s = await this.submitTask(i, n);
            const o = await this.markCurrentVideoAsHasDown(t);
            show.info(`已提交 123 离线：${s.fileCount} 个文件 / ${this.formatSize(s.totalSize)}${o ? "，已标记为已下载" : ""}`),
            t.text("已提交");
        } catch (i) {
            this.isTokenExpiredError(i) ? this.handleTokenExpired() : show.error("123 离线提交失败：" + i + this.getTokenMetaText()),
            t.text(a);
        } finally {
            setTimeout((() => t.removeClass("loading").prop("disabled", !1).text(a)), 1800);
        }
    }
    /** 离线任务提交成功后，复用 JHS 影片状态存储标记为已下载。 */
    async markCurrentVideoAsHasDown(e) {
        try {
            const t = this.getOfflineVideoInfo(e);
            if (!t || !t.carNum || !t.url) return !1;
            const n = await storageManager.getCar(t.carNum);
            if (n && n.status === g) return !1;
            await storageManager.saveCar({
                carNum: t.carNum,
                url: t.url,
                names: t.actress || t.names,
                actionType: g,
                publishTime: t.publishTime
            });
            const a = this.getBean("DetailPageButtonPlugin");
            a && a.showStatus && a.showStatus(t.carNum).then(), window.refresh();
            return !0;
        } catch (t) {
            console.error("123 离线成功后标记已下载失败:", t);
            show.error("123 离线已提交，但自动标记已下载失败：" + t);
            return !1;
        }
    }
    /** 从详情页或按钮所在列表项提取当前影片信息。 */
    getOfflineVideoInfo(e) {
        if (window.isDetailPage) return this.getPageInfo();
        const t = e && e.closest ? e.closest(".item") : $();
        return t && t.length ? this.getBean("ListPagePlugin").findCarNumAndHref(t) : this.getPageInfo();
    }
    resolveMagnet(e, t) {
        return new Promise(((n, a) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://www.123pan.com/b/api/v2/offline_download/task/resolve",
                headers: {
                    Authorization: "Bearer " + t,
                    "App-Version": "3",
                    platform: "web",
                    "Content-Type": "application/json;charset=UTF-8",
                    Origin: "https://www.123pan.com",
                    Referer: "https://www.123pan.com/"
                },
                data: JSON.stringify({
                    urls: e
                }),
                onload: e => {
                    if (401 === e.status) return void a("TOKEN_EXPIRED");
                    try {
                        const t = JSON.parse(e.responseText);
                        this.assertApiResult(t, "解析失败"), t.data && t.data.list && t.data.list.length > 0 ? n(t.data.list[0]) : a(t.message || `解析失败 (${t.code})`);
                    } catch (t) {
                        a(this.isTokenExpiredError(t) ? "TOKEN_EXPIRED" : t.message ? "响应解析失败: " + t.message : String(t));
                    }
                },
                onerror: () => a("网络请求失败")
            });
        }));
    }
    submitTask(e, t) {
        return new Promise(((n, a) => {
            if (!e.files || 0 === e.files.length) return void a("没有可建立离线的文件");
            const i = e.files.map((e => e.id)), s = e.files.reduce(((e, t) => e + (t.size || 0)), 0);
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://www.123pan.com/b/api/v2/offline_download/task/submit",
                headers: {
                    Authorization: "Bearer " + t,
                    "App-Version": "3",
                    platform: "web",
                    "Content-Type": "application/json;charset=UTF-8"
                },
                data: JSON.stringify({
                    resource_list: [ {
                        resource_id: e.id,
                        select_file_id: i
                    } ]
                }),
                onload: e => {
                    if (401 === e.status) return void a("TOKEN_EXPIRED");
                    try {
                        const t = JSON.parse(e.responseText);
                        this.assertApiResult(t, "提交失败"), n({
                            fileCount: i.length,
                            totalSize: s
                        });
                    } catch (t) {
                        a(this.isTokenExpiredError(t) ? "TOKEN_EXPIRED" : t.message ? "响应解析失败: " + t.message : String(t));
                    }
                },
                onerror: () => a("网络请求失败")
            });
        }));
    }
    formatSize(e) {
        if (!e) return "0B";
        const t = [ "B", "KB", "MB", "GB", "TB" ];
        let n = 0, a = e;
        for (;a >= 1024 && n < t.length - 1; ) a /= 1024, n++;
        return `${a.toFixed(n ? 2 : 0)}${t[n]}`;
    }
}

class StatsPlugin extends X {
    getName() { return "StatsPlugin"; }
    async handle() { window.isListPage && this.createBtn(); }
    createBtn() {
        const e = '<a id="statsBtn" class="menu-btn main-tab-btn" style="background-color:#6c5ce7 !important;"><span>统计</span></a>';
        r ? $("#newVideoBtn").after(e) : l && $("#newVideoBtn").after(e);
        $("#statsBtn").on("click", (() => { this.openDialog(); }));
    }
    async openDialog() {
        const e = await storageManager.getCarList(), t = await storageManager.getFavoriteActressList(), n = await storageManager.getBlacklist(), a = e.length, m = await storageManager.getStatusMap(), i = { filter: m[d].size, favorite: m[h].size, hasDown: m[g].size, hasWatch: m[p].size }, s = {};
        e.forEach((e => { e.names && e.names.split(" ").forEach((e => { e && (s[e] = (s[e] || 0) + 1); })); }));
        const o = Object.entries(s).sort(((e, t) => t[1] - e[1])).slice(0, 10), r = o.length > 0 ? o[0][1] : 1, l = a - i.filter - i.favorite - i.hasDown - i.hasWatch;
        let c = 0;
        const pendingCarSet = await storageManager.getCarMap(), pendingCounter = this.getBean("NewVideoPlugin");
        t.forEach((e => { c += pendingCounter.getPendingNewVideoCount(e, pendingCarSet); }));
        const d = e => '<span style="display:inline-block;height:18px;width:' + Math.round(e / r * 100) + '%;background:#6c5ce7;border-radius:3px;min-width:2px"></span>',
            h = (e, t, r) => { const c = a > 0 ? Math.round(e / a * 100) : 0; return '<div style="display:flex;align-items:center;margin-bottom:6px;gap:8px"><span style="width:60px;font-size:13px;text-align:right">' + t + '</span><span style="flex:1;background:#eee;border-radius:3px;height:18px"><span style="display:inline-block;height:18px;width:' + c + '%;background:' + r + ';border-radius:3px;min-width:2px"></span></span><span style="width:50px;font-size:12px;color:#888">' + e + ' (' + c + '%)</span></div>'; },
            g = '<div style="padding:10px 20px;height:100%;overflow:auto" class="jhs-scrollbar"><div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap"><div style="flex:1;min-width:100px;background:#f8f9fa;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#333">' + a + '</div><div style="font-size:12px;color:#888">总数</div></div><div style="flex:1;min-width:100px;background:#f0f7ff;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#25b1dc">' + (i.favorite || 0) + '</div><div style="font-size:12px;color:#888">已收藏</div></div><div style="flex:1;min-width:100px;background:#f0fff4;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#7bc73b">' + (i.hasDown || 0) + '</div><div style="font-size:12px;color:#888">已下载</div></div><div style="flex:1;min-width:100px;background:#fff9f0;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#d7a80c">' + (i.hasWatch || 0) + '</div><div style="font-size:12px;color:#888">已观看</div></div><div style="flex:1;min-width:100px;background:#fff5f5;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#de3333">' + (i.filter || 0) + '</div><div style="font-size:12px;color:#888">已屏蔽</div></div><div style="flex:1;min-width:100px;background:#f5f5f5;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#666">' + l + '</div><div style="font-size:12px;color:#888">待鉴定</div></div></div><div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap"><div style="flex:1;min-width:100px;background:#f8f0ff;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#6c5ce7">' + t.length + '</div><div style="font-size:12px;color:#888">收藏演员</div></div><div style="flex:1;min-width:100px;background:#fff0f0;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#b22222">' + n.length + '</div><div style="font-size:12px;color:#888">黑名单演员</div></div><div style="flex:1;min-width:100px;background:#fffef0;border-radius:8px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#e8ab39">' + c + '</div><div style="font-size:12px;color:#888">新作品待看</div></div></div><div style="font-size:14px;font-weight:bold;margin-bottom:8px;color:#333">状态分布</div>' + h(i.favorite || 0, "已收藏", "#25b1dc") + h(i.hasDown || 0, "已下载", "#7bc73b") + h(i.hasWatch || 0, "已观看", "#d7a80c") + h(i.filter || 0, "已屏蔽", "#de3333") + h(l, "待鉴定", "#888") + (o.length > 0 ? '<div style="font-size:14px;font-weight:bold;margin:12px 0 8px;color:#333">Top10 演员</div>' + o.map(((e, t) => '<div style="display:flex;align-items:center;margin-bottom:4px;gap:8px"><span style="width:24px;font-size:12px;color:#888;text-align:right">' + (t + 1) + '</span><span style="width:100px;font-size:13px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(e[0]) + '">' + escapeHtml(e[0]) + '</span>' + d(e[1]) + '<span style="width:36px;font-size:12px;color:#888">' + e[1] + '</span></div>')).join("") : "") + '</div>';
        layer.open({ type: 1, title: "收藏统计", content: g, scrollbar: !1, area: utils.getResponsiveArea(["60%", "80%"]), anim: -1, success: (e, t) => { utils.setupEscClose(t); } });
    }
}

const DEFAULT_JAVDB_PLUGINS = [
    Ie, Be, le, de, Ce,
    xe, Ae, fe, pe, ue,
    Ee, Ue, Oe, Q, $e,
    He, ye, ce, ae, ke,
    he, be, Ze, ze,
    Re, Ve, Se, Xe, pt,
    et, mt, StatsPlugin
];

const DEFAULT_JAVBUS_PLUGINS = [
    Ie, Ce, Ae,
    xe, Be, Ee, Fe, Ue,
    Qe, we, ye, $e,
    ke, ce, je, Re, Ve,
    be, Ze, Se, et, StatsPlugin
];

const DEFAULT_SHARED_PLUGIN_RULES = [
    {
        shouldRegister: hostname => r || l || hostname.includes("123pan.com"),
        plugins: [ OneTwoThreeOfflinePlugin ]
    },
    {
        shouldRegister: hostname => hostname.includes("javtrailers"),
        plugins: [ oe ]
    },
    {
        shouldRegister: hostname => hostname.includes("subtitlecat"),
        plugins: [ re ]
    }
];

function registerPluginGroup(pluginManager, plugins) {
    plugins.forEach((pluginClass => pluginManager.register(pluginClass)));
}

function registerSitePlugins(pluginManager, hostname = window.location.hostname) {
    DEFAULT_SHARED_PLUGIN_RULES.forEach((rule => {
        rule.shouldRegister(hostname) && registerPluginGroup(pluginManager, rule.plugins);
    }));
    r && registerPluginGroup(pluginManager, DEFAULT_JAVDB_PLUGINS);
    l && registerPluginGroup(pluginManager, DEFAULT_JAVBUS_PLUGINS);
}

const ut = layer.close;

layer.close = function(e) {
    const t = ut.call(this, e);
    return function(e = 10) {
        setTimeout((() => {
            const e = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = e > 0 ? "hidden" : "";
        }), e);
    }(), t;
};

const ft = layer.open;

layer.open = function(e) {
    const t = (e = e || {}).success;
    return e.success = function(e, n) {
        "function" == typeof t && t.call(this, e, n), utils.setupEscClose(n);
    }, ft.call(this, e);
}, utils.importResource("https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css"),
utils.importResource("https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css"),
utils.importResource("https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css"),
utils.importResource("https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css");

/** 插件注册中心: 按站点注册所有插件, 暴露到 unsafeWindow.pluginManager */
const vt = function() {
    const e = new Y;
    unsafeWindow.pluginManager = e;
    registerSitePlugins(e);
    return e;
}();

vt.processCss().then(), async function() {
    window.isDetailPage = function() {
        let e = window.location.href;
        return r ? e.split("?")[0].includes("/v/") : !!l && $("#magnet-table").length > 0;
    }(), window.isListPage = function() {
        let e = window.location.href;
        return r ? $(".movie-list").length > 0 || e.includes("advanced_search") : !!l && $(".masonry > div .item").length > 0;
    }(), window.isFc2Page = function() {
        let e = window.location.href;
        return e.includes("advanced_search?type=3") || e.includes("advanced_search?type=100");
    }(), await (async () => {
        const e = await storageManager.getDataVersion();
        e < CURRENT_DATA_VERSION && (await storageManager.merge_table_name(),
        await storageManager.clean_no_url_blacklist(),
        await storageManager.async_merge_other(),
        await storageManager.merge_blacklist(),
        await storageManager.merge_favoriteActress(),
        await storageManager.merge_tow_car_list_table(),
        await storageManager.setDataVersion(CURRENT_DATA_VERSION));
    })(),
    r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie) && show.error("请切换到中文语言下才可正常使用本脚本", {
        duration: -1
    }), vt.processPlugins().then();
}();
