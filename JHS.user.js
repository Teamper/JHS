// ==UserScript==
// @name         JHS
// @namespace    https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya
// @version      6.4.0
// @author       JHS Contributors
// @description  JAV Helper Suite：为 JavDB / JavBus 提供浏览、收藏、筛选、资源检索、数据备份与统计增强。
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=javdb.com
// @homepageURL  https://github.com/Teamper/JHS
// @supportURL   https://github.com/Teamper/JHS/issues
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
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/dist/layer.min.js
// @require      https://cdn.jsdelivr.net/npm/blueimp-md5@2.19.0/js/md5.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.js
// @connect      xunlei.com
// @connect      ja.wikipedia.org
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
// @connect      115.com
// @connect      webapi.115.com
// @connect      u3c3.com
// @connect      u9a9.com
// @connect      sukebei.nyaa.si
// @connect      javstore.net
// @connect      missav.live
// @connect      jable.tv
// @connect      jav.rs
// @connect      javtrailers.com
// @connect      javdb.com
// @connect      javbus.com
// @connect      www.123pan.com
// @connect      yun.123pan.com
// @connect      supjav.com
// @connect      translate-pa.googleapis.com
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @run-at       document-idle
// @downloadURL https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js
// @updateURL https://raw.githubusercontent.com/Teamper/JHS/main/JHS.user.js
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/main.js
  var JAVDB_HOST_PATTERN = /^(?:[a-z0-9-]+\.)?javdb(?:[a-z0-9-]*)\.com$/i;
  var JAVBUS_HOST_MARKERS = ["javbus", "javsee", "seejav"];
  function normalizeLocation(locationLike = window.location) {
    if (locationLike instanceof URL) return locationLike;
    if ("string" === typeof locationLike) return new URL(locationLike);
    return new URL(locationLike.href || `${locationLike.protocol}//${locationLike.hostname}${locationLike.pathname || "/"}${locationLike.search || ""}`);
  }
  __name(normalizeLocation, "normalizeLocation");
  function detectSite(locationLike = window.location) {
    const locationUrl = normalizeLocation(locationLike);
    const hostname = locationUrl.hostname.toLowerCase().replace(/\.$/, "");
    const isJavDB = JAVDB_HOST_PATTERN.test(hostname);
    const isJavBus = JAVBUS_HOST_MARKERS.some(((marker) => hostname.includes(marker)));
    const is123Pan = "123pan.com" === hostname || hostname.endsWith(".123pan.com");
    const isJavTrailers = "javtrailers.com" === hostname || hostname.endsWith(".javtrailers.com");
    const isSubtitleCat = "subtitlecat.com" === hostname || hostname.endsWith(".subtitlecat.com");
    const site = isJavDB ? "javdb" : isJavBus ? "javbus" : is123Pan ? "123pan" : isJavTrailers ? "javtrailers" : isSubtitleCat ? "subtitlecat" : "unknown";
    return { site, hostname, isJavDB, isJavBus, is123Pan, isJavTrailers, isSubtitleCat };
  }
  __name(detectSite, "detectSite");
  function isHitShowPage(locationLike = window.location) {
    const locationUrl = normalizeLocation(locationLike);
    return "/advanced_search" === locationUrl.pathname && "1" === locationUrl.searchParams.get("handlePlayback");
  }
  __name(isHitShowPage, "isHitShowPage");
  function isNormalListPage(locationLike = window.location, hasMovieList = null) {
    const locationUrl = normalizeLocation(locationLike);
    const hasList = null === hasMovieList ? "undefined" != typeof $ && $(".movie-list").length > 0 : Boolean(hasMovieList);
    return !isHitShowPage(locationUrl) && (hasList || locationUrl.pathname.includes("advanced_search"));
  }
  __name(isNormalListPage, "isNormalListPage");
  function isListPage(locationLike = window.location, hasMovieList = null) {
    return isHitShowPage(locationLike) || isNormalListPage(locationLike, hasMovieList);
  }
  __name(isListPage, "isListPage");
  var HOUR = 60 * 60 * 1e3;
  var DAY = 24 * HOUR;
  var CACHE_TTL = Object.freeze({ magnet: 6 * HOUR, screenshot: 7 * DAY, screenshotNegative: 12 * HOUR, match115: HOUR, externalDetail: DAY });
  var _ProviderError = class _ProviderError extends Error {
    constructor(provider, code, message, options = {}) {
      super(message, { cause: options.cause });
      this.name = "ProviderError";
      this.provider = provider;
      this.code = code;
      this.status = options.status || 0;
      this.url = options.url || "";
      this.retryable = Boolean(options.retryable);
    }
  };
  __name(_ProviderError, "ProviderError");
  var ProviderError = _ProviderError;
  async function mapLimit(items, concurrency = 4, mapper) {
    const results = new Array(items.length);
    let cursor = 0;
    const worker = /* @__PURE__ */ __name(async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await mapper(items[index], index);
      }
    }, "worker");
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
    return results;
  }
  __name(mapLimit, "mapLimit");
  function normalizeHttpUrl(value, baseUrl = window.location.href) {
    if (!value) return null;
    try {
      const url = new URL(String(value), baseUrl);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch (error) {
      clog.debug("外部 URL 无效，已忽略", error);
      return null;
    }
  }
  __name(normalizeHttpUrl, "normalizeHttpUrl");
  function normalizeBtihHash(value) {
    const hash = String(value || "").trim();
    return /^(?:[a-f\d]{40}|[a-z2-7]{32})$/i.test(hash) ? hash.toUpperCase() : null;
  }
  __name(normalizeBtihHash, "normalizeBtihHash");
  function parseCarNumberText(text) {
    const tokens = String(text || "").split(/[\s,，;；]+/).map(((item) => normalizeCarNum(item))).filter(Boolean);
    const valid = tokens.filter(((item) => /^(?:FC2-)?[A-Z\d]+(?:-[A-Z\d]+)+$/i.test(item)));
    return { recognized: tokens.length, values: [...new Set(valid.map(((item) => item.toUpperCase())))], invalid: tokens.filter(((item) => !valid.includes(item))) };
  }
  __name(parseCarNumberText, "parseCarNumberText");
  function buildFallbackCarUrl(carNum, baseUrl = "https://javdb.com") {
    return `${baseUrl}/search?q=${encodeURIComponent(carNum)}`;
  }
  __name(buildFallbackCarUrl, "buildFallbackCarUrl");
  async function safePlay(mediaElement, { context = "视频", notify = false, message = "当前视频源无法播放" } = {}) {
    if (!mediaElement || "function" != typeof mediaElement.play) {
      clog.warn(`${context}播放失败：媒体元素不可用`);
      notify && show.error(message);
      return false;
    }
    try {
      await mediaElement.play();
      return true;
    } catch (error) {
      clog.warn(`${context}播放失败`, error);
      const name = error?.name || "";
      notify && !["NotAllowedError", "AbortError"].includes(name) && show.error(message);
      return false;
    }
  }
  __name(safePlay, "safePlay");
  var e;
  var t;
  var n = Object.defineProperty;
  var a = /* @__PURE__ */ __name((e2) => {
    throw TypeError(e2);
  }, "a");
  var i = /* @__PURE__ */ __name((e2, t2, a2) => ((e3, t3, a3) => t3 in e3 ? n(e3, t3, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: a3
  }) : e3[t3] = a3)(e2, "symbol" != typeof t2 ? t2 + "" : t2, a2), "i");
  var s = /* @__PURE__ */ __name((e2, t2, n2) => (((e3, t3, n3) => {
    t3.has(e3) || a("Cannot " + n3);
  })(e2, t2, "access private method"), n2), "s");
  var o = window.location.href;
  var siteContext = detectSite(window.location);
  var r = siteContext.isJavDB;
  var l = siteContext.isJavBus;
  var c = o.includes("/search?q") || o.includes("/search/") || o.includes("/users/");
  var d = "filter";
  var h = "favorite";
  var g = "hasDown";
  var p = "hasWatch";
  var m = "屏蔽";
  var u = "已屏蔽";
  var v = "收藏";
  var b = "已收藏";
  var y = "已下载";
  var k = "已观看";
  var C = "no";
  var _ = "yes";
  var T = "javdb";
  var I = "javbus";
  var B = "actor";
  var P = "actress";
  var D = "censored";
  var A = "uncensored";
  var L = [{
    id: "video-mhb",
    quality: "dmb_w",
    text: "旧视频源-中画质宽版 (404p)",
    canSelect: false
  }, {
    id: "video-mhb",
    quality: "sm_s",
    text: "旧视频源-低画质 (240p)",
    canSelect: false
  }, {
    id: "video-mhb",
    quality: "dm_s",
    text: "旧视频源-中画质 (360p)",
    canSelect: false
  }, {
    id: "video-mhb",
    quality: "dmb_s",
    text: "旧视频源-中画质 (480p)",
    canSelect: false
  }, {
    id: "video-mhb",
    quality: "mhb_w",
    text: "旧视频源-高画质宽版 (404p)",
    canSelect: false
  }, {
    id: "video-mmb",
    quality: "mmb",
    text: "中画质 (432p)",
    canSelect: true
  }, {
    id: "video-mhb",
    quality: "mhb",
    text: "高画质 (576p)",
    canSelect: true
  }, {
    id: "video-hmb",
    quality: "hmb",
    text: "HD (720p)",
    canSelect: true
  }, {
    id: "video-hhb",
    quality: "hhb",
    text: "FullHD (1080p)",
    canSelect: true
  }, {
    id: "video-hhbs",
    quality: "hhbs",
    text: "FullHD (1080p60fps)",
    canSelect: true
  }, {
    id: "video-4k",
    quality: "4k",
    text: "4K (2160p)",
    canSelect: true
  }, {
    id: "video-4ks",
    quality: "4ks",
    text: "4K (2160p60fps)",
    canSelect: true
  }];
  function escapeHtml(e2) {
    const t2 = document.createElement("span");
    return t2.textContent = e2, t2.innerHTML;
  }
  __name(escapeHtml, "escapeHtml");
  var CURRENT_DATA_VERSION = 2;
  function normalizeCarNum(value) {
    if ("string" != typeof value) return null;
    let carNum = value.trim();
    if (!carNum || ["undefined", "null"].includes(carNum.toLowerCase())) return null;
    carNum = carNum.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();
    return carNum ? tryCanonicalizeSimpleCarNum(carNum) : null;
  }
  __name(normalizeCarNum, "normalizeCarNum");
  var SIMPLE_CAR_PREFIXES = /* @__PURE__ */ new Set(["ABC", "ABP", "ADN", "ATID", "BF", "CAWD", "DLDSS", "DVAJ", "FSDSS", "HEYZO", "HMN", "IPX", "IPZZ", "JUQ", "JUL", "JUX", "MEYD", "MIAA", "MIDE", "MIDV", "MIMK", "MIRD", "NIMA", "PRED", "RBD", "SDDE", "SONE", "SSIS", "SSNI", "STARS", "URE", "VEC", "WAAA", "WANZ", "XVSR"]);
  function tryCanonicalizeSimpleCarNum(value) {
    const match = String(value || "").match(/^([A-Z]{2,8})(\d{2,7})$/);
    return match && SIMPLE_CAR_PREFIXES.has(match[1]) ? `${match[1]}-${match[2]}` : value;
  }
  __name(tryCanonicalizeSimpleCarNum, "tryCanonicalizeSimpleCarNum");
  function firstValidCarNum(...candidates) {
    for (const candidate of candidates) {
      const carNum = normalizeCarNum(candidate);
      if (carNum) return carNum;
    }
    return null;
  }
  __name(firstValidCarNum, "firstValidCarNum");
  function assertPageInfoContract(pageInfo) {
    if (!pageInfo || "object" != typeof pageInfo || Array.isArray(pageInfo))
      throw new TypeError("getPageInfo() contract broken: expected object");
    return pageInfo;
  }
  __name(assertPageInfoContract, "assertPageInfoContract");
  var M = "";
  window.location.href.includes("hideNav=1") && (M = "\n         .navbar-default {\n            display: none !important;\n        }\n        body {\n            padding-top:0px!important;\n        }\n    ");
  var j = "";
  window.location.href.includes("hideNav=1") && (j = "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ");
  function H(e2) {
    if (e2) if (e2.includes("<style>")) document.head.insertAdjacentHTML("beforeend", e2);
    else {
      const t2 = document.createElement("style");
      t2.textContent = e2, document.head.appendChild(t2);
    }
  }
  __name(H, "H");
  var JHS_Z_INDEX = Object.freeze({
    content: 10,
    elevated: 20,
    localPopover: 30,
    popover: 100,
    dropdown: 1e3,
    fabBackdrop: 1e4,
    fabMenu: 10001,
    fab: 10002,
    debugLow: 12345678,
    hostNav: 12345679,
    hostTopbar: 12345689,
    modal: 12345699,
    sheetBackdrop: 12345789,
    sheet: 12345790,
    loading: 99999999,
    viewer: 999999990,
    layer: 999999991,
    debug: 999999999,
    tooltip: 9999999999
  });
  function buildThemeCss() {
    return `
<style>
    :root {
        /* 字体 */
        --jhs-font: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;

        /* 中性色 */
        --jhs-bg: #f4f6f9;
        --jhs-surface: #ffffff;
        --jhs-surface-2: #f2f4f8;
        --jhs-border: #e3e7ee;
        --jhs-border-strong: #8a94a6;
        --jhs-text: #1f2733;
        --jhs-text-muted: #5b6b7c;
        --jhs-text-faint: #637183;
        --jhs-input-bg: #f2f4f8;
        --jhs-placeholder: #637183;
        --jhs-disabled-bg: #f2f4f8;
        --jhs-disabled-text: #637183;

        /* 间距 / 排版 / 控件尺寸 */
        --jhs-space-1: 4px;
        --jhs-space-2: 8px;
        --jhs-space-3: 12px;
        --jhs-space-4: 16px;
        --jhs-space-5: 24px;
        --jhs-space-6: 32px;
        --jhs-font-size-xs: 12px;
        --jhs-font-size-sm: 13px;
        --jhs-font-size-md: 14px;
        --jhs-font-size-lg: 16px;
        --jhs-font-size-xl: 18px;
        --jhs-control-height-sm: 32px;
        --jhs-control-height: 36px;
        --jhs-touch-target: 44px;
        --jhs-motion-fast: 120ms;
        --jhs-motion-base: 180ms;
        --jhs-ease: cubic-bezier(.2, 0, 0, 1);

        /* 层级：业务模块只消费语义令牌，不自行发明数值 */
        --jhs-z-content: ${JHS_Z_INDEX.content};
        --jhs-z-elevated: ${JHS_Z_INDEX.elevated};
        --jhs-z-local-popover: ${JHS_Z_INDEX.localPopover};
        --jhs-z-popover: ${JHS_Z_INDEX.popover};
        --jhs-z-dropdown: ${JHS_Z_INDEX.dropdown};
        --jhs-z-fab-backdrop: ${JHS_Z_INDEX.fabBackdrop};
        --jhs-z-fab-menu: ${JHS_Z_INDEX.fabMenu};
        --jhs-z-fab: ${JHS_Z_INDEX.fab};
        --jhs-z-debug-low: ${JHS_Z_INDEX.debugLow};
        --jhs-z-host-nav: ${JHS_Z_INDEX.hostNav};
        --jhs-z-host-topbar: ${JHS_Z_INDEX.hostTopbar};
        --jhs-z-modal: ${JHS_Z_INDEX.modal};
        --jhs-z-sheet-backdrop: ${JHS_Z_INDEX.sheetBackdrop};
        --jhs-z-sheet: ${JHS_Z_INDEX.sheet};
        --jhs-z-loading: ${JHS_Z_INDEX.loading};
        --jhs-z-viewer: ${JHS_Z_INDEX.viewer};
        --jhs-z-layer: ${JHS_Z_INDEX.layer};
        --jhs-z-debug: ${JHS_Z_INDEX.debug};
        --jhs-z-tooltip: ${JHS_Z_INDEX.tooltip};

        /* 主操作色 (中性蓝灰; 状态色仅表达数据语义) */
        --jhs-accent: #3b6ea5;
        --jhs-accent-hover: #2f5b8a;
        --jhs-accent-tint: #e7eef6;
        --jhs-accent-text-on: #ffffff;

        /* 通用反馈语义（不得代替影片状态色） */
        --jhs-danger: #c02b2b;
        --jhs-danger-tint: #fde8e8;
        --jhs-danger-text-on: #ffffff;
        --jhs-warning: #826207;
        --jhs-warning-tint: #faf3df;
        --jhs-warning-text-on: #ffffff;

        /* 状态语义色 (品牌, 保持可辨识): red=屏蔽 cyan=收藏 green=下载 amber=观看
         * -on   实色背景上的文字 (filter 用白字, 其余深字)
         * -text tint 背景上的文字 / 彩色文字落 surface 的正文色 */
        --jhs-status-filter: #de3333;
        --jhs-status-filter-tint: #fde8e8;
        --jhs-status-filter-hover: #c02b2b;
        --jhs-status-filter-text: #c02b2b;
        --jhs-status-filter-on: #ffffff;
        --jhs-status-fav: #25b1dc;
        --jhs-status-fav-tint: #e5f6fc;
        --jhs-status-fav-hover: #1e93b8;
        --jhs-status-fav-text: #15728b;
        --jhs-status-fav-on: #14181d;
        --jhs-status-down: #7bc73b;
        --jhs-status-down-tint: #eff8e6;
        --jhs-status-down-hover: #66ac2d;
        --jhs-status-down-text: #387213;
        --jhs-status-down-on: #14181d;
        --jhs-status-watch: #d7a80c;
        --jhs-status-watch-tint: #faf3df;
        --jhs-status-watch-hover: #b58b09;
        --jhs-status-watch-text: #826207;
        --jhs-status-watch-on: #14181d;

        /* 品牌色 (第三方站点来源标识, 保持可辨识) */
        --jhs-brand-javdb: #c23a85;
        --jhs-brand-javbus: #967004;

        /* 代码查看器 (终端语义, 亮暗一致, 不随主题) */
        --jhs-code-bg: #1e1e1e;
        --jhs-code-text: #ffffff;
        --jhs-code-line: #aaaaaa;

        /* 圆角: 唯一一套 */
        --jhs-radius-xs: 6px;
        --jhs-radius-sm: 8px;
        --jhs-radius-md: 12px;
        --jhs-radius-lg: 14px;
        --jhs-radius-pill: 999px;

        /* 阴影: 与背景同色相 */
        --jhs-shadow-xs: 0 1px 2px rgba(31, 39, 51, .06);
        --jhs-shadow-sm: 0 1px 3px rgba(31, 39, 51, .08), 0 1px 2px rgba(31, 39, 51, .04);
        --jhs-shadow-md: 0 4px 14px rgba(31, 39, 51, .10);
        --jhs-shadow-lg: 0 12px 32px rgba(31, 39, 51, .16);

        /* 图标 */
        --jhs-icon-color: #5b6b7c;
    }

    :root[data-jhs-theme="dark"] {
        --jhs-bg: #14181d;
        --jhs-surface: #1d232b;
        --jhs-surface-2: #262d37;
        --jhs-border: #333c47;
        --jhs-border-strong: #64728a;
        --jhs-text: #e6ebf1;
        --jhs-text-muted: #9aa7b6;
        --jhs-text-faint: #9cacbd;
        --jhs-input-bg: #262d37;
        --jhs-placeholder: #9cacbd;
        --jhs-disabled-bg: #262d37;
        --jhs-disabled-text: #9cacbd;

        --jhs-accent: #7ca6d4;
        --jhs-accent-hover: #8db3de;
        --jhs-accent-tint: #25354a;
        --jhs-accent-text-on: #14181d;

        --jhs-danger: #e87171;
        --jhs-danger-tint: #3a2323;
        --jhs-danger-text-on: #14181d;
        --jhs-warning: #e0b32e;
        --jhs-warning-tint: #362f18;
        --jhs-warning-text-on: #14181d;

        --jhs-status-filter: #e05a5a;
        --jhs-status-filter-tint: #3a2323;
        --jhs-status-filter-hover: #f07171;
        --jhs-status-filter-text: #e87171;
        --jhs-status-filter-on: #14181d;
        --jhs-status-fav: #4dbbe0;
        --jhs-status-fav-tint: #1f3340;
        --jhs-status-fav-hover: #6fcbe8;
        --jhs-status-fav-text: #4dbbe0;
        --jhs-status-fav-on: #14181d;
        --jhs-status-down: #93d357;
        --jhs-status-down-tint: #25341a;
        --jhs-status-down-hover: #a8de73;
        --jhs-status-down-text: #93d357;
        --jhs-status-down-on: #14181d;
        --jhs-status-watch: #e0b32e;
        --jhs-status-watch-tint: #362f18;
        --jhs-status-watch-hover: #ecc347;
        --jhs-status-watch-text: #e0b32e;
        --jhs-status-watch-on: #14181d;

        /* 品牌色 */
        --jhs-brand-javdb: #e37ab6;
        --jhs-brand-javbus: #f0c040;

        /* 代码查看器 (终端语义, 亮暗一致, 不随主题) */
        --jhs-code-bg: #1e1e1e;
        --jhs-code-text: #ffffff;
        --jhs-code-line: #aaaaaa;

        --jhs-shadow-xs: 0 1px 2px rgba(0, 0, 0, .40);
        --jhs-shadow-sm: 0 1px 3px rgba(0, 0, 0, .50);
        --jhs-shadow-md: 0 4px 14px rgba(0, 0, 0, .55);
        --jhs-shadow-lg: 0 12px 36px rgba(0, 0, 0, .60);

        --jhs-icon-color: #9aa7b6;
    }

    /* JHS 表面输入框基座 + placeholder + 禁用态 (亮暗一致, 作用域限定 JHS 表面) */
    .jhs-ui input[type="text"],
    .jhs-ui input[type="number"],
    .jhs-ui textarea,
    .jhs-ui select,
    .layui-layer-content input[type="text"],
    .layui-layer-content input[type="number"],
    .layui-layer-content textarea,
    .layui-layer-content select {
        background-color: var(--jhs-input-bg);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }
    .jhs-ui ::placeholder,
    .layui-layer-content ::placeholder {
        color: var(--jhs-placeholder);
        opacity: 1;
    }
    .jhs-ui button:disabled,
    .jhs-ui input:disabled,
    .jhs-ui select:disabled,
    .layui-layer-content button:disabled,
    .layui-layer-content input:disabled,
    .layui-layer-content select:disabled {
        background-color: var(--jhs-disabled-bg);
        color: var(--jhs-disabled-text);
        border-color: var(--jhs-border);
        cursor: not-allowed;
        opacity: 1;
    }

    /* JHS 表面基础字体 */
    .jhs-ui, .layui-layer-content, .tabulator, .toastify, .jhs-fab, .menu-box {
        font-family: var(--jhs-font);
    }

    /* 焦点环 */
    :where(.jhs-ui) :focus-visible,
    :where(.layui-layer-content) :focus-visible,
    :where(.tabulator) :focus-visible {
        outline: 2px solid var(--jhs-accent);
        outline-offset: 2px;
    }

    /* 滚动条 (JHS 表面) */
    .jhs-scrollbar::-webkit-scrollbar,
    .content-panel::-webkit-scrollbar,
    .tabulator-tableholder::-webkit-scrollbar,
    .has-navbar-fixed-top::-webkit-scrollbar,
    .layui-layer-content::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    .jhs-scrollbar::-webkit-scrollbar-track,
    .content-panel::-webkit-scrollbar-track,
    .tabulator-tableholder::-webkit-scrollbar-track,
    .has-navbar-fixed-top::-webkit-scrollbar-track,
    .layui-layer-content::-webkit-scrollbar-track {
        background: var(--jhs-surface-2);
        border-radius: 10px;
    }
    .jhs-scrollbar::-webkit-scrollbar-thumb,
    .content-panel::-webkit-scrollbar-thumb,
    .tabulator-tableholder::-webkit-scrollbar-thumb,
    .has-navbar-fixed-top::-webkit-scrollbar-thumb,
    .layui-layer-content::-webkit-scrollbar-thumb {
        background: var(--jhs-border-strong);
        border-radius: 10px;
    }
    .jhs-scrollbar::-webkit-scrollbar-thumb:hover,
    .content-panel::-webkit-scrollbar-thumb:hover,
    .tabulator-tableholder::-webkit-scrollbar-thumb:hover,
    .has-navbar-fixed-top::-webkit-scrollbar-thumb:hover,
    .layui-layer-content::-webkit-scrollbar-thumb:hover {
        background: var(--jhs-text-faint);
    }

    @media (prefers-reduced-motion: reduce) {
        .jhs-ui, .layui-layer-content, .tabulator, .toastify, .jhs-fab, .menu-box,
        .jhs-ui *, .layui-layer-content *, .tabulator *, .toastify *, .jhs-fab *, .menu-box * {
            transition: none !important;
            animation: none !important;
        }
    }

    /* 暗色下覆盖 layui-layer 弹层 chrome (外部 layui.css 为亮色主题) */
    :root[data-jhs-theme="dark"] .layui-layer {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-lg);
    }
    :root[data-jhs-theme="dark"] .layui-layer-title {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .layui-layer-content {
        color: var(--jhs-text);
    }
    :root[data-jhs-theme="dark"] .layui-layer-btn a {
        background-color: var(--jhs-surface-2);
        border: 1px solid var(--jhs-border);
        color: var(--jhs-text);
    }
    :root[data-jhs-theme="dark"] .layui-layer-btn .layui-layer-btn0 {
        background-color: var(--jhs-accent);
        border-color: transparent;
        color: var(--jhs-accent-text-on);
    }
    .layui-layer-setwin .layui-layer-close {
        width: 36px!important;
        height: 36px!important;
        background: none!important;
        color: var(--jhs-text-muted)!important;
        font-size: 0!important;
        opacity: 1!important;
    }
    .layui-layer-setwin .layui-layer-close::before,
    .layui-layer-setwin .layui-layer-close::after {
        content: "";
        position: absolute;
        top: 17px;
        left: 9px;
        width: 18px;
        height: 2px;
        border-radius: 1px;
        background: currentColor;
    }
    .layui-layer-setwin .layui-layer-close::before { transform: rotate(45deg); }
    .layui-layer-setwin .layui-layer-close::after { transform: rotate(-45deg); }
    .layui-layer-setwin .layui-layer-close:hover,
    .layui-layer-setwin .layui-layer-close:focus-visible { color: var(--jhs-text)!important; }
    :root[data-jhs-theme="dark"] .layui-input,
    :root[data-jhs-theme="dark"] .layui-layer-content input[type="text"],
    :root[data-jhs-theme="dark"] .layui-layer-content input[type="number"],
    :root[data-jhs-theme="dark"] .layui-layer-content textarea,
    :root[data-jhs-theme="dark"] .layui-layer-content select {
        background-color: var(--jhs-input-bg);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }

    /* 暗色下覆盖 Tabulator 表格 chrome (semanticui 主题为亮色) */
    :root[data-jhs-theme="dark"] .tabulator {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-header {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-header .tabulator-col {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-right: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-row {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-row.tabulator-row-even {
        background-color: var(--jhs-surface-2);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-cell {
        color: var(--jhs-text);
        border-right: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-footer {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-top: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-responsive-collapse {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-top: 1px solid var(--jhs-border);
    }

    /* 暗色下图标翻转为单色, 避免深色 path 在暗表面上不可见 */
    :root[data-jhs-theme="dark"] .jhs-icon path {
        fill: var(--jhs-icon-color);
    }
</style>
`;
  }
  __name(buildThemeCss, "buildThemeCss");
  async function applyTheme() {
    const mode = await storageManager.getSetting("themeMode", "light");
    let resolved = "light";
    if ("dark" === mode) resolved = "dark";
    else if ("auto" === mode) resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-jhs-theme", resolved);
  }
  __name(applyTheme, "applyTheme");
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (() => {
    storageManager.getSetting("themeMode", "light").then(((e2) => {
      "auto" === e2 && applyTheme();
    }));
  }));
  function buildUiPrimitivesCss() {
    return `
<style id="jhs-ui-primitives">
    :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) {
        color: var(--jhs-text);
        font-family: var(--jhs-font);
        font-size: var(--jhs-font-size-md);
        line-height: 1.5;
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn) {
        box-sizing: border-box;
        display: inline-flex;
        min-height: var(--jhs-control-height);
        align-items: center;
        justify-content: center;
        gap: var(--jhs-space-2);
        padding: 0 var(--jhs-space-3);
        margin: 0;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-sm);
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: none;
        font: inherit;
        font-size: var(--jhs-font-size-sm);
        font-weight: 600;
        line-height: 1;
        text-align: center;
        text-decoration: none;
        text-shadow: none;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease),
                    border-color var(--jhs-motion-fast) var(--jhs-ease),
                    color var(--jhs-motion-fast) var(--jhs-ease),
                    transform var(--jhs-motion-fast) var(--jhs-ease);
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn):hover {
        border-color: var(--jhs-accent);
        background: var(--jhs-surface-2);
        color: var(--jhs-accent);
        box-shadow: none;
        filter: none;
        transform: none;
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn):active {
        transform: translateY(1px);
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn):disabled,
    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn)[aria-disabled="true"] {
        border-color: var(--jhs-border);
        background: var(--jhs-disabled-bg);
        color: var(--jhs-disabled-text);
        cursor: not-allowed;
        opacity: 1;
        transform: none;
    }

    :is(.jhs-btn--primary, .jhs-btn--accent) {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
        color: var(--jhs-accent-text-on);
    }
    :is(.jhs-btn--primary, .jhs-btn--accent):hover {
        border-color: var(--jhs-accent-hover);
        background: var(--jhs-accent-hover);
        color: var(--jhs-accent-text-on);
    }

    :is(.jhs-btn--secondary, .jhs-btn--muted, .site-btn) {
        border-color: var(--jhs-border);
        background: var(--jhs-surface);
        color: var(--jhs-text);
    }
    .jhs-btn--danger {
        border-color: var(--jhs-danger);
        background: var(--jhs-danger);
        color: var(--jhs-danger-text-on);
    }
    .jhs-btn--danger:hover {
        border-color: var(--jhs-danger);
        background: var(--jhs-danger);
        color: var(--jhs-danger-text-on);
        filter: brightness(.92);
    }
    .jhs-btn--ghost {
        border-color: transparent;
        background: transparent;
        color: var(--jhs-text-muted);
    }
    .jhs-btn--ghost:hover {
        border-color: transparent;
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
    }

    .jhs-video-player {
        display: block;
        width: 100%;
        height: 100%;
        background: #000;
    }
    .jhs-video-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--jhs-space-2);
        padding-block: var(--jhs-space-2);
    }
    .jhs-video-toolbar > .jhs-toolbar {
        margin-left: auto;
    }
    .jhs-video-quality-list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--jhs-space-2);
    }
    .jhs-video-quality-btn {
        min-width: 80px;
    }
    .jhs-video-quality-btn.active,
    .jhs-video-quality-btn[aria-pressed="true"] {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
        color: var(--jhs-accent-text-on);
    }
    .jhs-btn--soft {
        border-color: transparent;
        background: var(--jhs-accent-tint);
        color: var(--jhs-accent);
    }
    .jhs-btn--filter {
        border-color: transparent;
        background: var(--jhs-status-filter-tint);
        color: var(--jhs-status-filter-text);
    }
    .jhs-btn--fav {
        border-color: transparent;
        background: var(--jhs-status-fav-tint);
        color: var(--jhs-status-fav-text);
    }
    .jhs-btn--down {
        border-color: transparent;
        background: var(--jhs-status-down-tint);
        color: var(--jhs-status-down-text);
    }
    .jhs-btn--watch {
        border-color: transparent;
        background: var(--jhs-status-watch-tint);
        color: var(--jhs-status-watch-text);
    }
    :is(.jhs-btn--filter, .jhs-btn--fav, .jhs-btn--down, .jhs-btn--watch):hover {
        border-color: var(--jhs-border-strong);
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
    }
    .jhs-btn--sm {
        min-height: var(--jhs-control-height-sm);
        padding-inline: var(--jhs-space-2);
        font-size: var(--jhs-font-size-xs);
    }
    .jhs-icon-btn, .card-btn {
        width: var(--jhs-control-height);
        min-width: var(--jhs-control-height);
        height: var(--jhs-control-height);
        min-height: var(--jhs-control-height);
        padding: 0;
        border: 1px solid transparent;
        border-radius: var(--jhs-radius-sm);
        background: transparent;
        color: var(--jhs-icon-color);
        box-shadow: none;
    }
    :where(.jhs-icon-btn, .card-btn):hover {
        border-color: var(--jhs-border);
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
        box-shadow: none;
        transform: none;
    }
    :where(.jhs-icon-btn, .card-btn) svg {
        width: 18px;
        height: 18px;
    }

    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input:not([type]), .jhs-ui input[type="text"], .jhs-ui input[type="number"], .jhs-ui input[type="url"], .jhs-ui input[type="password"],
        .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input:not([type]), .layui-layer-content input[type="text"], .layui-layer-content input[type="number"],
        .layui-layer-content input[type="url"], .layui-layer-content input[type="password"], .layui-layer-content select, .layui-layer-content textarea) {
        box-sizing: border-box;
        min-height: var(--jhs-control-height);
        padding: var(--jhs-space-2) var(--jhs-space-3);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-sm);
        background: var(--jhs-input-bg);
        color: var(--jhs-text);
        font: inherit;
        font-size: var(--jhs-font-size-sm);
        line-height: 1.35;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease),
                    border-color var(--jhs-motion-fast) var(--jhs-ease),
                    box-shadow var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input, .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input, .layui-layer-content select, .layui-layer-content textarea):hover:not(:disabled) {
        border-color: var(--jhs-accent);
    }
    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input, .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input, .layui-layer-content select, .layui-layer-content textarea):focus-visible {
        border-color: var(--jhs-accent);
        outline: 2px solid var(--jhs-accent-tint);
        outline-offset: 1px;
        box-shadow: 0 0 0 1px var(--jhs-accent);
    }
    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input[type="text"], .jhs-ui input[type="number"], .jhs-ui input[type="url"],
        .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input[type="text"], .layui-layer-content input[type="number"],
        .layui-layer-content input[type="url"], .layui-layer-content select, .layui-layer-content textarea):hover:not(:focus) {
        border-color: var(--jhs-border-strong);
    }
    :where(.jhs-textarea, .jhs-ui textarea, .layui-layer-content textarea) {
        min-height: 76px;
        resize: vertical;
    }

    .jhs-switch, .mini-switch {
        appearance: none;
        box-sizing: border-box;
        width: 40px;
        min-width: 40px;
        height: 22px;
        min-height: 22px;
        padding: 2px;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-surface-2);
        cursor: pointer;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease), border-color var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-switch, .mini-switch)::before {
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--jhs-surface);
        box-shadow: var(--jhs-shadow-xs);
        content: "";
        transition: transform var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-switch, .mini-switch):checked {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
    }
    :where(.jhs-switch, .mini-switch):checked::before {
        transform: translateX(18px);
    }

    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"]) {
        appearance: none;
        width: 100%;
        height: 22px;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"])::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-border);
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"])::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        margin-top: -7px;
        border: 2px solid var(--jhs-surface);
        border-radius: 50%;
        background: var(--jhs-accent);
        box-shadow: 0 0 0 1px var(--jhs-accent), var(--jhs-shadow-xs);
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"]):disabled {
        cursor: not-allowed;
        opacity: .55;
    }

    .jhs-toolbar {
        display: flex;
        align-items: center;
        gap: var(--jhs-space-2);
        flex-wrap: wrap;
        min-width: 0;
    }
    .jhs-toolbar--between {
        justify-content: space-between;
    }
    .jhs-toolbar__group {
        display: flex;
        align-items: center;
        gap: var(--jhs-space-2);
        flex-wrap: wrap;
        min-width: 0;
    }
    .jhs-section {
        display: grid;
        gap: var(--jhs-space-3);
        margin-block: 0 var(--jhs-space-4);
    }
    .jhs-section__heading {
        margin: 0;
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-lg);
        font-weight: 700;
        line-height: 1.3;
    }
    .jhs-section__description, .jhs-helper-text {
        margin: 0;
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-xs);
        line-height: 1.5;
    }
    .jhs-card, .jhs-setting-group {
        box-sizing: border-box;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface);
        box-shadow: none;
    }
    .jhs-card {
        padding: var(--jhs-space-4);
    }
    .jhs-setting-group {
        overflow: hidden;
    }
    .jhs-setting-row {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(180px, 1fr) minmax(180px, 280px);
        gap: var(--jhs-space-4);
        align-items: center;
        min-height: 52px;
        margin: 0;
        padding: var(--jhs-space-3) var(--jhs-space-4);
        border-bottom: 1px solid var(--jhs-border);
    }
    :where(.jhs-setting-group, .content-panel) > .jhs-setting-row:last-child {
        border-bottom: 0;
    }
    .jhs-setting-row__label, .setting-label {
        min-width: 0;
        margin: 0;
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-sm);
        font-weight: 600;
        line-height: 1.4;
    }
    .jhs-setting-row__description {
        display: block;
        margin-top: var(--jhs-space-1);
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-xs);
        font-weight: 400;
    }
    .jhs-setting-row__control, .form-content {
        display: flex;
        min-width: 0;
        max-width: none;
        align-items: center;
        justify-content: flex-end;
        gap: var(--jhs-space-2);
    }
    :where(.jhs-setting-row__control, .form-content) > :where(input, select, textarea) {
        width: min(100%, 280px);
        margin: 0;
    }

    .jhs-segmented, .magnet-tabs__options {
        display: inline-flex;
        align-items: center;
        gap: var(--jhs-space-1);
        padding: var(--jhs-space-1);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface-2);
    }
    .jhs-segmented__item, .magnet-tab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: var(--jhs-control-height-sm);
        padding: 0 var(--jhs-space-3);
        border: 0;
        border-radius: var(--jhs-radius-xs);
        background: transparent;
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-sm);
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
    }
    :where(.jhs-segmented__item, .magnet-tab):hover {
        background: var(--jhs-surface);
        color: var(--jhs-text);
    }
    :where(.jhs-segmented__item, .magnet-tab).active,
    :where(.jhs-segmented__item, .magnet-tab)[aria-selected="true"] {
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-xs);
    }

    .jhs-popover {
        position: absolute;
        top: calc(100% + var(--jhs-space-2));
        right: 0;
        z-index: var(--jhs-z-local-popover);
        display: none;
        min-width: 152px;
        padding: var(--jhs-space-2);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface);
        box-shadow: var(--jhs-shadow-md);
    }
    .jhs-popover.is-open { display: grid; gap: var(--jhs-space-1); }
    .jhs-popover [role="menuitem"], .jhs-popover [role="menuitemradio"] { width: 100%; justify-content: flex-start; }

    .jhs-select-control { position:relative; display:inline-flex; min-width:140px; max-width:100%; }
    .jhs-select-source-native { display:none!important; }
    .jhs-select-trigger { width:100%; justify-content:space-between; }
    .jhs-select-trigger::after { content:"▾"; margin-left:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:11px; }
    .jhs-select-control.is-open .jhs-select-trigger::after { content:"▴"; }
    .jhs-select-menu { left:0; right:auto; min-width:100%; max-height:320px; overflow-y:auto; }
    .jhs-select-group { display:grid; gap:var(--jhs-space-1); }
    .jhs-select-group__label { padding:var(--jhs-space-1) var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); font-weight:600; }
    .jhs-select-option[aria-checked="true"] { background:var(--jhs-accent-tint); color:var(--jhs-accent); }

    .jhs-task-emphasis { color:var(--jhs-status-filter-text); }
    .jhs-code-viewer { height:100%; overflow:auto; padding:15px 5px; background:var(--jhs-code-bg); color:var(--jhs-code-text); font-family:Consolas,Monaco,monospace; white-space:pre-wrap; }
    .jhs-code-line-number { color:var(--jhs-code-line); }
    .jhs-count-table__cell { padding:3px; border:1px solid var(--jhs-border); }
    .jhs-count-table__head { padding:3px; border:1px solid var(--jhs-border); font-weight:700; }
    .jhs-play-overlay { position:absolute; inset:50% auto auto 50%; transform:translate(-50%,-50%); color:#fff; font-size:40px; text-shadow:0 0 10px rgba(0,0,0,.5); }
    .jhs-image-preview { max-width:100%; max-height:300px; border-radius:var(--jhs-radius-xs); box-shadow:var(--jhs-shadow-xs); }

    .jhs-badge, .jhs-chip, .card-tag, .card-new-count-tag, .magnet-score {
        box-sizing: border-box;
        display: inline-flex;
        min-height: 24px;
        align-items: center;
        justify-content: center;
        gap: var(--jhs-space-1);
        padding: 2px var(--jhs-space-2);
        border: 1px solid transparent;
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-surface-2);
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-xs);
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
    }
    .jhs-badge--accent, .card-new-count-tag {
        background: var(--jhs-accent-tint);
        color: var(--jhs-accent);
    }
    .jhs-badge--danger, .card-tag {
        background: var(--jhs-status-filter-tint);
        color: var(--jhs-status-filter-text);
    }
    .jhs-badge--success {
        background: var(--jhs-status-down-tint);
        color: var(--jhs-status-down-text);
    }
    .jhs-badge--neutral { border-color: var(--jhs-border); background: var(--jhs-surface-2); color: var(--jhs-text-muted); }
    .jhs-badge--filter { background: var(--jhs-status-filter-tint); color: var(--jhs-status-filter-text); }
    .jhs-badge--fav { background: var(--jhs-status-fav-tint); color: var(--jhs-status-fav-text); }
    .jhs-badge--down { background: var(--jhs-status-down-tint); color: var(--jhs-status-down-text); }
    .jhs-badge--watch { background: var(--jhs-status-watch-tint); color: var(--jhs-status-watch-text); }

    .jhs-pagination, #actress-pagination, #nv-pagination-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--jhs-space-1);
        flex-wrap: wrap;
        padding-top: var(--jhs-space-3);
        border-top: 1px solid var(--jhs-border);
    }
    :where(.jhs-pagination, #actress-pagination, #nv-pagination-bar) .pagination-btn {
        min-width: var(--jhs-control-height-sm);
        min-height: var(--jhs-control-height-sm);
        padding-inline: var(--jhs-space-2);
    }
    :where(.jhs-pagination, #actress-pagination, #nv-pagination-bar) .pagination-btn.active,
    :where(.jhs-pagination, #actress-pagination, #nv-pagination-bar) .pagination-btn[aria-current="page"] {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
        color: var(--jhs-accent-text-on);
    }

    .jhs-state, .magnet-loading, .magnet-error {
        box-sizing: border-box;
        display: grid;
        min-height: 120px;
        place-items: center;
        gap: var(--jhs-space-2);
        padding: var(--jhs-space-5);
        border: 1px dashed var(--jhs-border-strong);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface-2);
        color: var(--jhs-text-muted);
        text-align: center;
    }
    .jhs-state--error, .magnet-error {
        border-color: var(--jhs-status-filter-text);
        background: var(--jhs-status-filter-tint);
        color: var(--jhs-status-filter-text);
    }
    .jhs-is-hidden { display: none !important; }
    .jhs-dialog-title { padding: 0 var(--jhs-space-2); }
    .jhs-pagination__summary { margin-left: var(--jhs-space-3); color: var(--jhs-text-muted); font-size: var(--jhs-font-size-sm); }
    .jhs-skeleton {
        overflow: hidden;
        border-radius: var(--jhs-radius-xs);
        background: var(--jhs-surface-2);
    }
    @media (prefers-reduced-motion: no-preference) {
        .jhs-skeleton {
            background: linear-gradient(90deg, var(--jhs-surface-2) 25%, var(--jhs-border) 50%, var(--jhs-surface-2) 75%);
            background-size: 200% 100%;
            animation: jhs-skeleton-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes jhs-skeleton-shimmer {
            to { background-position-x: -200%; }
        }
    }

    .layui-layer {
        overflow: hidden;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-lg) !important;
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-lg) !important;
    }
    .layui-layer-title {
        min-height: 48px;
        padding: 0 52px 0 var(--jhs-space-4);
        border-bottom: 1px solid var(--jhs-border);
        background: var(--jhs-surface);
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-lg);
        font-weight: 700;
        line-height: 48px;
    }
    .layui-layer-btn {
        display: flex;
        justify-content: flex-end;
        gap: var(--jhs-space-2);
        padding: var(--jhs-space-3) var(--jhs-space-4) !important;
        border-top: 1px solid var(--jhs-border);
        background: var(--jhs-surface);
    }
    .layui-layer-btn a {
        min-height: var(--jhs-control-height);
        margin: 0 !important;
        padding: 0 var(--jhs-space-3) !important;
        border: 1px solid var(--jhs-border-strong) !important;
        border-radius: var(--jhs-radius-sm) !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
        line-height: var(--jhs-control-height) !important;
    }
    .layui-layer-btn .layui-layer-btn0 {
        border-color: var(--jhs-accent) !important;
        background: var(--jhs-accent) !important;
        color: var(--jhs-accent-text-on) !important;
    }

    .tabulator {
        overflow: hidden;
        border: 1px solid var(--jhs-border) !important;
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
        font-family: var(--jhs-font);
        font-size: var(--jhs-font-size-sm);
    }
    .tabulator .tabulator-header,
    .tabulator .tabulator-header .tabulator-col {
        min-height: 40px;
        border-color: var(--jhs-border) !important;
        background: var(--jhs-surface-2) !important;
        color: var(--jhs-text) !important;
    }
    .tabulator .tabulator-row {
        min-height: 44px;
        border-color: var(--jhs-border) !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
    }
    .tabulator .tabulator-row:hover {
        background: var(--jhs-surface-2) !important;
    }
    .tabulator .tabulator-cell {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        border-right: 0 !important;
        color: var(--jhs-text) !important;
    }
    .tabulator .tabulator-row { border-bottom: 1px solid var(--jhs-border) !important; }
    .tabulator .tabulator-header .tabulator-col { border-right-color: color-mix(in srgb, var(--jhs-border) 55%, transparent) !important; }
    .tabulator .tabulator-footer {
        border-color: var(--jhs-border) !important;
        background: var(--jhs-surface-2) !important;
        color: var(--jhs-text) !important;
    }

    /* 新作品列表卡保留轻边框，结构布局由插件自身样式负责。 */
    .nv-card {
        border: 1px solid var(--jhs-border) !important;
        border-radius: var(--jhs-radius-md) !important;
        background: var(--jhs-surface) !important;
        box-shadow: none !important;
        transform: none !important;
        transition: border-color var(--jhs-motion-fast) var(--jhs-ease) !important;
    }
    .nv-card:hover {
        border-color: var(--jhs-accent) !important;
        box-shadow: none !important;
        transform: none !important;
    }
    /* 磁力搜索：分段控件、紧凑结果行和明确反馈状态。 */
    .magnet-container {
        width: 100%;
        margin: var(--jhs-space-3) auto !important;
        color: var(--jhs-text);
        font-family: var(--jhs-font) !important;
    }
    .magnet-tabs {
        display: flex;
        align-items: center;
        justify-content: space-between !important;
        gap: var(--jhs-space-3);
        margin-bottom: var(--jhs-space-3) !important;
        padding: 0 !important;
        border-bottom: 0 !important;
    }
    .magnet-tabs > div {
        display: inline-flex !important;
        gap: var(--jhs-space-1);
        padding: var(--jhs-space-1);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface-2);
    }
    .magnet-tab {
        min-height: var(--jhs-control-height-sm);
        margin: 0 !important;
        padding: 0 var(--jhs-space-3) !important;
        border: 0 !important;
        border-radius: var(--jhs-radius-xs) !important;
        background: transparent !important;
        color: var(--jhs-text-muted);
        line-height: var(--jhs-control-height-sm);
    }
    .magnet-tab.active {
        margin: 0 !important;
        border: 0 !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-xs);
    }
    .magnet-results {
        min-height: 200px;
        overflow: hidden;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface);
    }
    .magnet-result {
        min-height: 68px;
        padding: var(--jhs-space-3) 190px var(--jhs-space-3) var(--jhs-space-4) !important;
        border-bottom: 1px solid var(--jhs-border) !important;
        background: var(--jhs-surface);
    }
    .magnet-result:last-child {
        border-bottom: 0 !important;
    }
    .magnet-result:hover {
        background: var(--jhs-surface-2) !important;
    }
    .magnet-title {
        margin-bottom: var(--jhs-space-1) !important;
        padding-right: 0 !important;
        font-weight: 600 !important;
    }
    .magnet-title a {
        display: inline-block;
        max-width: calc(100% - 52px);
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: bottom;
        white-space: nowrap;
    }
    .magnet-score { margin-right: var(--jhs-space-1); font-size: var(--jhs-font-size-sm); cursor: help; }
    .magnet-info {
        justify-content: flex-start !important;
        gap: var(--jhs-space-4);
        margin: 0 !important;
        color: var(--jhs-text-muted) !important;
    }
    .magnet-copy {
        top: 50% !important;
        right: var(--jhs-space-3) !important;
        display: flex;
        flex: 0 0 auto;
        flex-wrap: nowrap;
        gap: var(--jhs-space-2);
        transform: translateY(-50%);
    }
    .magnet-hub-btn {
        flex: 0 0 auto;
        min-height: var(--jhs-control-height-sm) !important;
        margin: 0 !important;
        padding: 0 var(--jhs-space-2) !important;
        border-radius: var(--jhs-radius-sm) !important;
        font-size: var(--jhs-font-size-xs) !important;
        white-space: nowrap;
    }
    .magnet-hub-btn.copied {
        border-color: transparent !important;
        background: var(--jhs-status-down-tint) !important;
        color: var(--jhs-status-down-text) !important;
    }

    @media (max-width: 768px) {
        :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn, .jhs-icon-btn, .card-btn) {
            min-height: var(--jhs-touch-target);
        }
        :where(.jhs-icon-btn, .card-btn) {
            width: var(--jhs-touch-target);
            min-width: var(--jhs-touch-target);
            height: var(--jhs-touch-target);
        }
        .jhs-setting-row {
            grid-template-columns: 1fr;
            gap: var(--jhs-space-2);
            padding: var(--jhs-space-3);
        }
        .jhs-setting-row__control, .form-content {
            justify-content: stretch;
        }
        :where(.jhs-setting-row__control, .form-content) > :where(input, select, textarea, button, a) {
            width: 100%;
            max-width: none;
        }
        .jhs-toolbar--between {
            align-items: stretch;
            flex-direction: column;
        }
        .magnet-tabs {
            align-items: stretch;
            flex-direction: column;
        }
        .magnet-tabs > div {
            max-width: 100%;
            overflow-x: auto;
        }
        .magnet-result {
            padding-right: var(--jhs-space-4) !important;
        }
        .magnet-copy {
            position: static !important;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: var(--jhs-space-2);
            transform: none;
        }
        .magnet-copy .magnet-hub-btn { width: 100%; min-height: var(--jhs-touch-target) !important; }
        .jhs-segmented {
            max-width: 100%;
            overflow-x: auto;
        }
    }

        /* migrated template layout utilities */

        .jhs-layout-06cf30c0 { margin-top:15px;display:flex;justify-content:center;gap:10px; }



        .jhs-layout-186f17ef { padding:18px 18px !important; }


        .jhs-layout-1b3790ef { display:flex;margin-bottom:10px; }

        .jhs-layout-1e90930a { display:flex;gap:10px;flex-wrap:wrap; }



        .jhs-layout-2100e73d { margin-left:20px; }

        .jhs-layout-21a4fe43 { margin-left:0 }

        .jhs-layout-2335597e { padding:18px 18px !important;margin-left:50px }

        .jhs-layout-27f87d75 { display:block;margin-bottom:5px; }


        .jhs-layout-294497f1 { top:-15px }

        .jhs-layout-2afc43dc { min-width:120px; }

        .jhs-layout-2e003268 { margin-bottom:5px }

        .jhs-layout-31a824a2 { display:flex;gap:5px }



        .jhs-layout-3536a853 { margin-top:30px;cursor:auto }




        .jhs-layout-3b6a3a65 { cursor:pointer }

        .jhs-layout-3f0d74e1 { min-width:120px; }

        .jhs-layout-3fed2a7e { margin-left:5px; }

        .jhs-layout-3fefafab { overflow-y:auto;height:calc(100% - 40px); }

        .jhs-layout-44293084 { width:120px;text-align:center;padding:8px 0; }



        .jhs-layout-481ed7e7 { padding:10px; }

        .jhs-layout-53809f1e { display:flex;gap:5px; }

        .jhs-layout-583c2485 { height:100%;padding-bottom:20px }

        .jhs-layout-598afa5a { margin-bottom:25px; }


        .jhs-layout-5c319329 { min-width:120px; }


        .jhs-layout-5f3e3549 { width:140px;text-align:center;padding:8px 0; }





        .jhs-layout-66253c00 { margin-top:8px;display:none }


        .jhs-layout-6b99de8b { display:none }


        .jhs-layout-6d489fc7 { margin:0 0.75rem }

        .jhs-layout-701bf0f9 { margin-bottom:0!important; }


        .jhs-layout-761d3add { margin-bottom:10px }

        .jhs-layout-769fed37 { padding:20px }

        .jhs-layout-78fa54ea { margin-left:10px }

        .jhs-layout-7cb3f981 { padding:10px 20px;height:100%;overflow:hidden; }

        .jhs-layout-7daea5fa { margin-bottom:5px; }

        .jhs-layout-81eaab28 { height:calc(100% - 50px);overflow-x:hidden; }

        .jhs-layout-8453d189 { display:flex;align-items:center;flex-grow:1;justify-content:flex-end; }



        .jhs-layout-8896c95d { margin-right:5px }

        .jhs-layout-8cddc29a { padding:20px; }

        .jhs-layout-8cf76fd7 { width:150px;height:auto; }




        .jhs-layout-9813a0dd { margin-left:5px }

        .jhs-layout-9db87399 { margin-top:50px;cursor:auto }

        .jhs-layout-9e3c853e { margin-bottom:15px; }

        .jhs-layout-9ea2322d { margin:20px auto }

        .jhs-layout-9fe45cd8 { width:120px; }

        .jhs-layout-a38a0e50 { max-height:100%;max-width:100%;object-fit:contain }




        .jhs-layout-b12542a5 { width:100% }

        .jhs-layout-b5c4e4f7 { overflow:hidden;height:110px;text-align:center; }

        .jhs-layout-ba4750c8 { margin:30px 0 }

        .jhs-layout-bd59a2e1 { text-align:center;margin-bottom:15px; }

        .jhs-layout-c0d4a511 { margin-top:5px; }

        .jhs-layout-c4eb15bf { width:100%;padding:12px;
 cursor:pointer;
  }


        .jhs-layout-cad980f4 { width:100%; }

        .jhs-layout-cd9d5db1 { overflow:hidden;max-height:215px;text-align:center; }

        .jhs-layout-d10a577d { margin-bottom:20px;text-align:center;display:none; }

        .jhs-layout-d2c171b1 { margin-top:10px }

        .jhs-layout-d44e70c7 { height:calc(100% - 50px); }

        .jhs-layout-d4a09a0d { width:200px; }

        .jhs-layout-d4a575e8 { height:inherit;width:100%; }

        .jhs-layout-d50e4f09 { margin-top:15px;display:none; }

        .jhs-layout-d543acf8 { display:flex;justify-content:center;align-items:center;position:absolute;top:0;left:0;height:100%;width:100%;z-index:var(--jhs-z-content);overflow:hidden }




        .jhs-layout-d9caa2c0 { display:flex;align-items:center;gap:5px; }

        .jhs-layout-da303dcf { margin-bottom:15px; }

        .jhs-layout-da5a4919 { display:flex;justify-content:space-between; }

        .jhs-layout-dd5a75f6 { width:300px; }

        .jhs-layout-e2965a97 { margin:10px auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px; }

        .jhs-layout-e32cff7f { padding:30px; }

        .jhs-layout-e5d57abb { overflow:hidden;max-height:150px;max-width:150px;text-align:center; }






        .jhs-layout-f43f0d6d { width:160px;text-align:center;padding:8px 0; }

        .jhs-layout-f4e719ae { margin:10px 0 }

        .jhs-layout-f5f47b30 { margin-left:100px;width:400px; }

    @media (prefers-reduced-motion: reduce) {
        :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) *,
        :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) *::before,
        :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
        }
    }
</style>`;
  }
  __name(buildUiPrimitivesCss, "buildUiPrimitivesCss");
  function initializeUiAccessibility() {
    const selector = "button.jhs-btn, a.jhs-btn[role='button'], .card-btn, .jhs-icon-btn, [class*='jhs-'] button, [class*='jhs-'] a[role='button']";
    const enhance = /* @__PURE__ */ __name((e2) => {
      const t2 = e2.nodeType === Node.ELEMENT_NODE && e2.matches?.(selector) ? [e2] : [];
      const n2 = e2.querySelectorAll ? [...e2.querySelectorAll(selector)] : [];
      [...t2, ...n2].forEach(((e3) => {
        if (e3.hasAttribute("aria-label") || e3.hasAttribute("aria-labelledby") || e3.textContent.trim()) return;
        const t3 = e3.getAttribute("title") || e3.getAttribute("data-tip");
        t3 && e3.setAttribute("aria-label", t3);
      }));
    }, "enhance");
    enhance(document);
    const pending = /* @__PURE__ */ new Set();
    let scheduled = false;
    const flush = /* @__PURE__ */ __name(() => {
      scheduled = false;
      const all = [...pending], roots = all.filter(((e2) => !all.some(((t2) => t2 !== e2 && t2.contains?.(e2)))));
      pending.clear(), roots.forEach(enhance);
    }, "flush");
    new MutationObserver(((records) => {
      records.forEach(((record) => record.addedNodes.forEach(((node) => {
        node.nodeType === Node.ELEMENT_NODE && pending.add(node);
      }))));
      pending.size && !scheduled && (scheduled = true, queueMicrotask(flush));
    })).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  __name(initializeUiAccessibility, "initializeUiAccessibility");
  var _JhsSelect = class _JhsSelect {
    constructor(select) {
      this.source = $(select);
      if (!this.source.length || _JhsSelect.instances.has(this.source[0])) return _JhsSelect.instances.get(this.source[0]);
      const initiallyHidden = this.source.hasClass("jhs-is-hidden") || "none" === this.source[0].style.display;
      this.control = $('<div class="jhs-select-control"></div>');
      this.trigger = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-select-trigger" aria-haspopup="menu" aria-expanded="false"><span class="jhs-select-value"></span></button>');
      this.menu = $('<div class="jhs-popover jhs-select-menu" role="menu"></div>');
      this.source.wrap(this.control), this.control = this.source.parent(), this.control.append(this.trigger, this.menu), this.source.addClass("jhs-select-source-native").attr({ "aria-hidden": "true", tabindex: "-1" }), initiallyHidden && this.control.addClass("jhs-is-hidden"), _JhsSelect.instances.set(this.source[0], this), this.render(), this.bind(), this.refresh();
    }
    static enhance(root = document) {
      const scope = $(root), selects = scope.is("select.jhs-select-source") ? scope : scope.find("select.jhs-select-source");
      selects.each(((_2, select) => new _JhsSelect(select)));
      return selects;
    }
    static get(select) {
      const element = $(select)[0];
      return element ? _JhsSelect.instances.get(element) || new _JhsSelect(element) : null;
    }
    static setValue(select, value, emit = false) {
      const instance = _JhsSelect.get(select);
      if (!instance) return;
      instance.source.val(value), emit ? instance.emitChange() : instance.refresh();
    }
    static refresh(select) {
      _JhsSelect.get(select)?.refresh();
    }
    static refreshAll(root = document) {
      _JhsSelect.enhance(root), $(root).find("select.jhs-select-source").each(((_2, select) => _JhsSelect.refresh(select)));
    }
    static setVisible(select, visible) {
      const instance = _JhsSelect.get(select);
      instance?.control.toggleClass("jhs-is-hidden", !visible);
    }
    static closeAll(except = null) {
      $(".jhs-select-control.is-open").each(((_2, control) => {
        const source = $(control).children("select.jhs-select-source")[0], instance = source && _JhsSelect.instances.get(source);
        instance && instance !== except && instance.close();
      }));
    }
    render() {
      this.menu.empty();
      const appendOption = /* @__PURE__ */ __name((option, target) => {
        const button = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-select-option" role="menuitemradio" tabindex="-1"></button>');
        button.attr({ "data-value": option.value, "aria-checked": option.selected ? "true" : "false" }).prop("disabled", option.disabled).text(option.text), target.append(button);
      }, "appendOption");
      this.source.children().each(((_2, child) => {
        if ("OPTGROUP" === child.tagName) {
          const group = $('<div class="jhs-select-group" role="group"></div>').attr("aria-label", child.label), label = $('<div class="jhs-select-group__label"></div>').text(child.label);
          group.append(label), $(child).children("option").each(((_3, option) => appendOption(option, group))), this.menu.append(group);
        } else "OPTION" === child.tagName && appendOption(child, this.menu);
      }));
    }
    bind() {
      this.trigger.on("click", ((event) => {
        event.preventDefault(), event.stopPropagation(), this.source.prop("disabled") || (this.control.hasClass("is-open") ? this.close() : this.open());
      })).on("keydown", ((event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault(), this.open("ArrowUp" === event.key || "End" === event.key ? "last" : "selected");
      }));
      this.menu.on("click", ".jhs-select-option", ((event) => {
        event.preventDefault(), this.choose($(event.currentTarget));
      })).on("keydown", ".jhs-select-option", ((event) => {
        const items = this.options(), index = items.index(event.currentTarget);
        if ("Escape" === event.key) return event.preventDefault(), this.close(true);
        if ("Tab" === event.key) return void this.close();
        if (["Enter", " "].includes(event.key)) return event.preventDefault(), this.choose($(event.currentTarget));
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      }));
      this.source.on("change.jhsSelect", (() => this.refresh())), $(document).on("click.jhsSelect", ((event) => {
        $(event.target).closest(this.control).length || this.close();
      }));
    }
    options() {
      return this.menu.find(".jhs-select-option:not(:disabled)");
    }
    open(focus = "selected") {
      _JhsSelect.closeAll(this), this.control.addClass("is-open"), this.menu.addClass("is-open"), this.trigger.attr("aria-expanded", "true");
      const items = this.options(), selected = items.filter('[aria-checked="true"]');
      ("last" === focus ? items.last() : selected.length ? selected.first() : items.first()).trigger("focus");
    }
    close(focus = false) {
      this.control.removeClass("is-open"), this.menu.removeClass("is-open"), this.trigger.attr("aria-expanded", "false"), focus && this.trigger.trigger("focus");
    }
    choose(item) {
      if (item.prop("disabled")) return;
      this.source.val(item.attr("data-value")), this.emitChange(), this.close(true);
    }
    /** 派发一次真实原生 change，同时兼容宿主与 jQuery 监听器。 */
    emitChange() {
      this.source[0]?.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    refresh() {
      const selected = this.source.find("option:selected").first(), value = this.source.val();
      this.trigger.find(".jhs-select-value").text(selected.text()), this.trigger.prop("disabled", this.source.prop("disabled")), this.menu.find(".jhs-select-option").attr("aria-checked", "false").filter(((_2, item) => $(item).attr("data-value") === String(value ?? ""))).attr("aria-checked", "true");
    }
  };
  __name(_JhsSelect, "JhsSelect");
  __publicField(_JhsSelect, "instances", /* @__PURE__ */ new WeakMap());
  var JhsSelect = _JhsSelect;
  var N = `
<style>
    .top-bar { z-index:var(--jhs-z-host-topbar)!important; }
    ${M}
    .masonry { display:grid; width:100%!important; height:100%!important; padding:0 15px!important; column-gap:10px; row-gap:10px; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:start; }
    .masonry .item { top:initial!important; left:initial!important; float:none!important; position:relative!important; background-color:var(--jhs-surface-2); }
    .masonry .movie-box { width:100%!important; height:100%!important; margin:0!important; overflow:inherit!important; }
    .masonry .movie-box .photo-frame { height:auto!important; margin:0!important; position:relative; }
    .masonry .movie-box img { max-height:500px; height:100%!important; object-fit:contain; object-position:top; transform:none!important; transition:none!important; }
    .masonry .photo-info span { display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .photo-frame .mheyzo, .photo-frame .mcaribbeancom2 { margin-left:0!important; }
    .avatar-box { display:flex!important; width:100%!important; margin:0!important; }
    .avatar-box .photo-info { display:flex; align-items:center; justify-content:center; gap:30px; flex-direction:row; background-color:var(--jhs-surface)!important; }
    footer { display:none!important; }
    .video-title { display:-webkit-box!important; height:75px; white-space:normal!important; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
</style>`;
  var E = `
<style>
    ${j}
    .navbar { z-index:var(--jhs-z-host-nav)!important; padding:0; }
    .navbar-link:not(.is-arrowless) { padding-right:33px; }
    .sub-header, #footer, .app-desktop-banner,
    div[data-controller="movie-tab"] .tabs, h3.main-title,
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(3),
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(2),
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(1),
    .top-meta, .float-buttons { display:none!important; }
    div.tabs.no-bottom, .tabs ul { border-bottom:none!important; }
    .movie-list .item { position:relative!important; }
    .movie-list .item .cover img { transform:none!important; transition:none!important; }
    .video-title { display:-webkit-box; height:80px; white-space:normal!important; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
    .main-tabs, .tabs { overflow-x:hidden; flex-wrap:wrap; justify-content:flex-start; }
    .main-tabs ul, .tabs ul { flex-wrap:wrap; flex-grow:0; }
    .toolbar { display:flex; }
</style>`;
  var F = `
<style>
    .fr-btn { float:right; margin-left:4px!important; }
    .menu-box { position:fixed; right:10px; top:50%; display:flex; flex-direction:column; gap:6px; z-index:var(--jhs-z-dropdown); transform:translateY(-50%); }
    .do-hide { display:none!important; }
    .jhs-icon { width:16px; height:16px; }
    .tool-box .jhs-icon { width:1.5rem; height:1.5rem; }
    .jhs-nav-btn { color:var(--jhs-accent)!important; font-weight:600; }
    .jhs-nav-btn:hover { color:var(--jhs-accent-hover)!important; }
    .tabulator .tabulator-row .action-cell-dropdown { overflow:visible!important; }
    .tabulator .tabulator-row.tabulator-selectable:hover { cursor:default!important; }
    .tabulator .tabulator-col.tabulator-sortable[aria-sort="ascending"] .tabulator-arrow { border-bottom-color:var(--jhs-accent)!important; }
    .tabulator .tabulator-col.tabulator-sortable[aria-sort="descending"] .tabulator-arrow { border-top-color:var(--jhs-accent)!important; }
    .tabulator-responsive-collapse { border-top:none!important; }
    .tabulator-responsive-collapse table { margin-left:50px!important; }
    .tabulator-cell { height:auto!important; }
    .tabulator .tabulator-cell { white-space:normal!important; text-overflow:clip!important; }
    .tabulator-tableholder { overflow-x:hidden!important; }
</style>`;
  H(buildThemeCss());
  l && H(N), r && H(E);
  H(F);
  H(buildUiPrimitivesCss());
  initializeUiAccessibility();
  function createIndexedMap(items, key) {
    return new Map(items.filter(((item) => item && item[key])).map(((item) => [item[key], item])));
  }
  __name(createIndexedMap, "createIndexedMap");
  function createStatusMap(items) {
    const statusMap = {
      [d]: /* @__PURE__ */ new Set(),
      [h]: /* @__PURE__ */ new Set(),
      [g]: /* @__PURE__ */ new Set(),
      [p]: /* @__PURE__ */ new Set()
    };
    items.forEach(((item) => {
      if (!item?.carNum) return;
      const flags = normalizeStateFlags(item.stateFlags);
      flags.blocked && statusMap[d].add(item.carNum), flags.favorite && statusMap[h].add(item.carNum), flags.downloaded && statusMap[g].add(item.carNum), flags.watched && statusMap[p].add(item.carNum);
    }));
    return statusMap;
  }
  __name(createStatusMap, "createStatusMap");
  function groupDuplicateItems(items, key) {
    const counts = /* @__PURE__ */ new Map();
    items.forEach(((item) => {
      const value = item && item[key];
      value && counts.set(value, (counts.get(value) || 0) + 1);
    }));
    return Array.from(counts.entries()).filter(((item) => item[1] > 1));
  }
  __name(groupDuplicateItems, "groupDuplicateItems");
  function dedupeByKey(items, key) {
    const seen = /* @__PURE__ */ new Map(), list = [];
    let changed = false;
    for (const item of items) {
      const value = item && item[key];
      if (!value) {
        list.push(item);
        continue;
      }
      if (seen.has(value)) {
        Object.assign(seen.get(value), item), changed = true;
      } else seen.set(value, item), list.push(item);
    }
    return {
      list,
      changed
    };
  }
  __name(dedupeByKey, "dedupeByKey");
  var STATE_FLAG_NAMES = Object.freeze(["favorite", "downloaded", "watched", "blocked"]);
  var LEGACY_STATUS_TO_FLAG = Object.freeze({ [h]: "favorite", [g]: "downloaded", [p]: "watched", [d]: "blocked" });
  function createEmptyStateFlags() {
    return { favorite: false, downloaded: false, watched: false, blocked: false };
  }
  __name(createEmptyStateFlags, "createEmptyStateFlags");
  function stateFlagsFromLegacyStatus(status) {
    const flags = createEmptyStateFlags(), flag = LEGACY_STATUS_TO_FLAG[status];
    return flag && (flags[flag] = true), flags;
  }
  __name(stateFlagsFromLegacyStatus, "stateFlagsFromLegacyStatus");
  function normalizeStateFlags(flags) {
    const normalized = createEmptyStateFlags();
    return STATE_FLAG_NAMES.forEach(((name) => normalized[name] = true === flags?.[name])), normalized;
  }
  __name(normalizeStateFlags, "normalizeStateFlags");
  function projectLegacyStatus(flags) {
    const normalized = normalizeStateFlags(flags);
    return normalized.blocked ? d : normalized.watched ? p : normalized.downloaded ? g : normalized.favorite ? h : "";
  }
  __name(projectLegacyStatus, "projectLegacyStatus");
  function syncLegacyStatus(record) {
    return record.stateFlags = normalizeStateFlags(record.stateFlags), record.status = projectLegacyStatus(record.stateFlags), record;
  }
  __name(syncLegacyStatus, "syncLegacyStatus");
  function hasAnyState(flags) {
    const normalized = normalizeStateFlags(flags);
    return STATE_FLAG_NAMES.some(((name) => normalized[name]));
  }
  __name(hasAnyState, "hasAnyState");
  function legacyActionToFlag(actionType) {
    return LEGACY_STATUS_TO_FLAG[actionType] || null;
  }
  __name(legacyActionToFlag, "legacyActionToFlag");
  function mergeCanonicalCarRecords(records) {
    const groups = /* @__PURE__ */ new Map(), collisions = [], unknownStatuses = [];
    records.filter(Boolean).forEach(((record) => {
      const original = record.carNum, carNum = normalizeCarNum(original);
      if (!carNum) return;
      const item = { ...record, carNum, stateFlags: record.stateFlags ? normalizeStateFlags(record.stateFlags) : stateFlagsFromLegacyStatus(record.status) };
      record.stateFlags || !record.status || LEGACY_STATUS_TO_FLAG[record.status] || unknownStatuses.push({ carNum, status: record.status });
      const group = groups.get(carNum) || [];
      group.push({ original, item }), groups.set(carNum, group);
    }));
    const list = [];
    for (const [carNum, group] of groups) {
      const sorted = group.map(((entry) => entry.item)).sort(((left, right) => String(left.updateDate || "").localeCompare(String(right.updateDate || ""))));
      const merged = {}, flags = createEmptyStateFlags();
      sorted.forEach(((record) => {
        Object.entries(record).forEach((([key, value]) => null != value && "" !== value && "stateFlags" !== key && "status" !== key && (merged[key] = value)));
        STATE_FLAG_NAMES.forEach(((name) => flags[name] = flags[name] || record.stateFlags[name]));
      }));
      const createDates = sorted.map(((item) => item.createDate)).filter(Boolean).sort(), updateDates = sorted.map(((item) => item.updateDate)).filter(Boolean).sort();
      createDates.length && (merged.createDate = createDates[0]), updateDates.length && (merged.updateDate = updateDates.at(-1));
      merged.carNum = carNum, merged.stateFlags = flags, syncLegacyStatus(merged), list.push(merged);
      const originals = [...new Set(group.map(((entry) => entry.original)).filter(Boolean))];
      originals.length > 1 && collisions.push({ carNum, originals, count: group.length });
    }
    return { list, collisions, unknownStatuses };
  }
  __name(mergeCanonicalCarRecords, "mergeCanonicalCarRecords");
  e = /* @__PURE__ */ new WeakSet(), t = /* @__PURE__ */ __name(async function(e2, t2, n2) {
    let a2;
    if (Array.isArray(e2)) a2 = [...e2];
    else {
      if (a2 = await this.forage.getItem(t2) || [], a2.includes(e2)) {
        const t3 = `${e2} ${n2}已存在`;
        throw show.error(t3), new Error(t3);
      }
      a2.push(e2);
    }
    return await this._setItemAndInvalidate(t2, a2), a2;
  }, "t");
  var _StorageManager = class _StorageManager {
    constructor() {
      var t2, s2, o2;
      if (t2 = this, (s2 = e).has(t2) ? a("Cannot add the same private member more than once") : s2 instanceof WeakSet ? s2.add(t2) : s2.set(t2, o2), i(this, "car_list_key", "car_list"), i(this, "filter_keyword_title_key", "filter_keyword_title"), i(this, "filter_keyword_review_key", "filter_keyword_review"), i(this, "setting_key", "setting"), i(this, "blacklist_key", "blacklist"), i(this, "blacklist_car_list_key", "blacklist_car_list"), i(this, "third_party_cache_key", "third_party_ttl_cache"), i(this, "favorite_actresses_key", "favorite_actresses"), i(this, "highlighted_tags_key", "highlighted_tags"), i(this, "_actressLock", Promise.resolve()), i(this, "forage", localforage.createInstance({
        driver: localforage.INDEXEDDB,
        name: "JAV-JHS",
        version: 1,
        storeName: "appData"
      })), i(this, "cacheCarList", null), i(this, "cacheBlacklist", null), i(this, "cacheTitleFilterKeyword", null), i(this, "cacheFavoriteActresses", null), i(this, "cache_filter_actor_actress_car_list", null), i(this, "cacheSettingObj", null), i(this, "cacheCarMap", null), i(this, "cacheStatusMap", null), i(this, "cacheBlacklistMap", null), i(this, "_pendingReads", /* @__PURE__ */ new Map()), i(this, "_cacheGenerations", /* @__PURE__ */ new Map()), i(this, "_cacheStats", { hits: 0, misses: 0 }), _StorageManager.instance) throw new Error("StorageManager已被实例化过了!");
      _StorageManager.instance = this;
    }
    async getDataVersion() {
      return await this.forage.getItem("data_version") || 0;
    }
    async setDataVersion(e2) {
      await this.forage.setItem("data_version", e2);
    }
    _getCacheGeneration(e2) {
      return this._cacheGenerations.get(e2) || 0;
    }
    _invalidateRead(e2) {
      this._cacheGenerations.set(e2, this._getCacheGeneration(e2) + 1);
      this._pendingReads.delete(e2);
    }
    /** 合并同一存储键的并发读取，并阻止失效前的旧读取回填缓存。 */
    async _readCached(e2, t2, n2) {
      if (null !== this[e2]) return this[e2];
      const a2 = this._pendingReads.get(t2);
      if (a2) return a2;
      const i2 = this._getCacheGeneration(t2), s2 = this.forage.getItem(t2).then((a3) => {
        const s3 = a3 || n2;
        return i2 === this._getCacheGeneration(t2) && null === this[e2] && (this[e2] = s3), s3;
      }).finally(() => {
        this._pendingReads.get(t2) === s2 && this._pendingReads.delete(t2);
      });
      return this._pendingReads.set(t2, s2), s2;
    }
    _invalidateCache(e2 = null) {
      const t2 = [this.car_list_key, this.blacklist_key, this.filter_keyword_title_key, this.favorite_actresses_key, this.blacklist_car_list_key, this.setting_key];
      (null === e2 ? t2 : t2.includes(e2) ? [e2] : []).forEach(((e3) => this._invalidateRead(e3)));
      (!e2 || e2 === this.car_list_key) && (this.cacheCarList = null, this.cacheCarMap = null, this.cacheStatusMap = null);
      (!e2 || e2 === this.blacklist_key) && (this.cacheBlacklist = null, this.cacheBlacklistMap = null);
      (!e2 || e2 === this.filter_keyword_title_key) && (this.cacheTitleFilterKeyword = null);
      (!e2 || e2 === this.favorite_actresses_key) && (this.cacheFavoriteActresses = null);
      (!e2 || e2 === this.blacklist_car_list_key) && (this.cache_filter_actor_actress_car_list = null);
      (!e2 || e2 === this.setting_key) && (this.cacheSettingObj = null);
    }
    async _setItemAndInvalidate(e2, t2) {
      await this.forage.setItem(e2, t2);
      this._invalidateCache(e2);
    }
    async withActressLock(fn) {
      let release;
      const lock = new Promise((r2) => release = r2);
      const prev = this._actressLock;
      this._actressLock = this._actressLock.then(() => lock);
      await prev;
      try {
        return await fn();
      } finally {
        release();
      }
    }
    async _rawUpdateFavoriteActress(e2) {
      const t2 = await this.getFavoriteActressList();
      const { starId: n2, name: a2, allName: i2, avatar: s2, lastCheckTime: o2, newVideoList: r2, lastPublishTime: l2, actressType: c2, remark: d2 } = e2;
      if (!n2) throw new Error("缺失starId");
      let h2 = t2.find(((e3) => e3.starId === n2));
      if (!h2) return clog.error("未找到演员信息", n2, a2), false;
      a2 && (h2.name = a2), i2 && (h2.allName = i2), s2 && (h2.avatar = s2), null != c2 && (h2.actressType = c2), o2 && (h2.lastCheckTime = o2), r2 && (h2.newVideoList = r2), l2 && (h2.lastPublishTime = l2), d2 && (h2.remark = d2), h2.updateDate = utils.getNowStr(), await this._setItemAndInvalidate(this.favorite_actresses_key, t2);
      return true;
    }
    async getCarList() {
      return this._readCached("cacheCarList", this.car_list_key, []);
    }
    async getCarMap() {
      if (null === this.cacheCarMap) {
        const e2 = await this.getCarList();
        this.cacheCarMap = createIndexedMap(e2, "carNum");
      }
      return this.cacheCarMap;
    }
    async getStatusMap() {
      if (null === this.cacheStatusMap) {
        const e2 = await this.getCarList();
        this.cacheStatusMap = createStatusMap(e2);
      }
      return this.cacheStatusMap;
    }
    async getCar(e2) {
      return (await this.getCarMap()).get(normalizeCarNum(e2));
    }
    _saveSingleCar(e2, t2) {
      let { carNum: n2, url: a2, names: i2, actionType: s2, publishTime: o2, starId: r2 } = e2;
      if (!n2) throw show.error("番号为空!"), new Error("番号为空!");
      if (!a2) throw show.error("url为空!"), new Error("url为空!");
      a2.includes("http") || (a2 = window.location.origin + a2), i2 && (i2 = i2.trim());
      let l2 = t2.find(((e3) => e3.carNum === n2));
      if (l2) i2 && (l2.names = i2), a2 && (l2.url = a2), o2 && (l2.publishTime = o2), l2.updateDate = utils.getNowStr();
      else {
        let e3 = utils.getNowStr();
        l2 = {
          carNum: n2,
          url: a2,
          names: i2,
          status: "",
          createDate: e3,
          updateDate: e3,
          publishTime: o2
        }, r2 && (l2.starId = r2), t2.push(l2);
      }
      switch (s2) {
        case d:
          if (l2.status === d) {
            const e4 = `${n2} 已在屏蔽列表中`;
            throw show.error(e4), new Error(e4);
          }
          l2.status = d;
          break;
        case h:
          if (l2.status === h) {
            const e4 = `${n2} 已在收藏列表中`;
            throw show.error(e4), new Error(e4);
          }
          l2.status = h;
          break;
        case g:
          if (l2.status === g) {
            const e4 = `${n2} 已标记为已下载`;
            throw show.error(e4), new Error(e4);
          }
          l2.status = g;
          break;
        case p:
          if (l2.status === p) {
            const e4 = `${n2} 已标记为已观看`;
            throw show.error(e4), new Error(e4);
          }
          l2.status = p;
          break;
        default:
          const e3 = "actionType错误, 请联系作者更正: " + s2;
          throw show.error(e3), new Error(e3);
      }
    }
    async saveCar(e2) {
      const carNum = normalizeCarNum(e2.carNum), flag = legacyActionToFlag(e2.actionType);
      if (!carNum) throw show.error("番号为空!"), new Error("番号为空!");
      if (!e2.url) throw show.error("url为空!"), new Error("url为空!");
      if (!flag) throw show.error("actionType错误, 请联系作者更正: " + e2.actionType), new Error("actionType错误, 请联系作者更正: " + e2.actionType);
      const existing = await this.getCar(carNum);
      if (normalizeStateFlags(existing?.stateFlags)[flag]) {
        const messages = { blocked: "已在屏蔽列表中", favorite: "已在收藏列表中", downloaded: "已标记为已下载", watched: "已标记为已观看" }, message = `${carNum} ${messages[flag]}`;
        throw show.error(message), new Error(message);
      }
      return stateService.patch(carNum, { [flag]: true }, { type: "legacy-save", record: { ...e2, carNum } });
    }
    async updateCarInfo(e2) {
      let { carNum: t2, url: n2, names: a2, actionType: i2, publishTime: s2, remark: o2 } = e2;
      if (!t2) throw show.error("番号为空!"), new Error("番号为空!");
      if (!n2) throw show.error("url为空!"), new Error("url为空!");
      a2 && (a2 = a2.trim());
      t2 = normalizeCarNum(t2);
      const l2 = await this.getCar(t2);
      if (!l2) {
        const e3 = "数据不存在: " + t2;
        throw show.error(e3), new Error(e3);
      }
      const flag = legacyActionToFlag(i2);
      if (!flag) {
        const e3 = "actionType错误, 请联系作者更正: " + i2;
        throw show.error(e3), new Error(e3);
      }
      return stateService.patch(t2, { [flag]: true }, { type: "legacy-update", record: { carNum: t2, names: a2, url: n2, remark: o2, publishTime: s2 } });
    }
    async saveCarList(e2) {
      if (!e2 || !Array.isArray(e2) || 0 === e2.length) throw show.error("记录列表为空!"), new Error("记录列表为空!");
      const existing = await this.getCarMap(), seen = /* @__PURE__ */ new Set(), groups = /* @__PURE__ */ new Map();
      for (const item of e2) {
        const carNum = normalizeCarNum(item.carNum), flag = legacyActionToFlag(item.actionType);
        if (!carNum) throw show.error("番号为空!"), new Error("番号为空!");
        if (!item.url) throw show.error("url为空!"), new Error("url为空!");
        if (!flag) throw new Error("actionType错误, 请联系作者更正: " + item.actionType);
        const duplicateKey = `${carNum}:${flag}`;
        if (seen.has(duplicateKey) || normalizeStateFlags(existing.get(carNum)?.stateFlags)[flag]) throw new Error(`${carNum} 状态已存在`);
        seen.add(duplicateKey);
        const group = groups.get(flag) || [];
        group.push({ ...item, carNum }), groups.set(flag, group);
      }
      for (const [flag, records] of groups) await stateService.patch(records.map(((item) => item.carNum)), { [flag]: true }, { type: "legacy-batch-save", records });
    }
    async removeNewVideoList(e2) {
      return this.withActressLock(async () => {
        const t2 = await this.getFavoriteActressList();
        let n2 = false;
        const a2 = t2.map(((t3) => {
          if (!t3.newVideoList || !Array.isArray(t3.newVideoList)) return t3;
          const a3 = t3.newVideoList.filter(((t4) => {
            const a4 = "string" == typeof t4 ? t4 : t4.carNum, i2 = e2.includes(a4);
            return i2 && (clog.log("移除关联女优新作品", t4.name, a4), n2 = true), !i2;
          }));
          const result = { ...t3, newVideoList: a3 };
          if (a3.length === 0 && t3.lastPublishTime) result.lastPublishTime = null;
          return result;
        }));
        n2 && await this._setItemAndInvalidate(this.favorite_actresses_key, a2);
      });
    }
    async removeCar(e2) {
      const result = await stateService.remove(e2);
      return result.changed.length ? true : (show.error(`${e2} 不存在`), false);
    }
    async batchRemoveCars(e2) {
      const result = await stateService.remove(e2);
      return result.changed.length || false;
    }
    async getBlacklist() {
      return this._readCached("cacheBlacklist", this.blacklist_key, []);
    }
    async getBlacklistMap() {
      if (null === this.cacheBlacklistMap) {
        const e2 = await this.getBlacklist();
        this.cacheBlacklistMap = createIndexedMap(e2, "starId");
      }
      return this.cacheBlacklistMap;
    }
    async addBlacklistItem(e2) {
      let { starId: t2, name: n2, allName: a2, role: i2, movieType: s2, url: o2 } = e2;
      if (!t2) throw new Error("缺失starId");
      if (!n2) throw new Error("缺失name");
      if (!i2) throw new Error("缺失role");
      const r2 = await this.getBlacklist(), l2 = r2.find(((e3) => e3.starId === t2));
      if (l2) l2.url = o2, l2.role = i2, l2.movieType = s2, clog.log("更新黑名单演员信息", l2);
      else {
        const e3 = {
          starId: t2,
          name: n2,
          allName: a2 || [n2],
          createTime: utils.getNowStr(),
          role: i2,
          movieType: s2,
          url: o2
        };
        r2.push(e3), clog.log("增加黑名单演员信息", e3);
      }
      await this._setItemAndInvalidate(this.blacklist_key, r2);
    }
    async updateBlacklistItem(e2) {
      if (!e2 || !e2.starId) throw new Error("参数不全");
      const t2 = await this.getBlacklist(), n2 = t2.find(((t3) => t3.starId === e2.starId));
      if (!n2) throw new Error(`未找到黑名单演员信息:${e2.name} ${e2.starId}`);
      e2.checkTime && (n2.checkTime = e2.checkTime), e2.lastPublishTime && (n2.lastPublishTime = e2.lastPublishTime), await this._setItemAndInvalidate(this.blacklist_key, t2);
    }
    async deleteBlacklistItem(e2) {
      const t2 = await this.getBlacklist(), n2 = t2.filter(((t3) => t3.starId !== e2));
      t2.length !== n2.length && await this._setItemAndInvalidate(this.blacklist_key, n2);
    }
    async getBlacklistCarList() {
      return this._readCached("cache_filter_actor_actress_car_list", this.blacklist_car_list_key, []);
    }
    async batchSaveBlacklistCarList(e2) {
      const t2 = await this.getBlacklistCarList(), n2 = JSON.parse(JSON.stringify(t2));
      let a2 = false, i2 = [];
      for (const s2 of e2) {
        n2.find(((e3) => e3.carNum === s2.carNum)) || (this._saveSingleCar(s2, n2), clog.log(`屏蔽演员番号: <span class="jhs-layout-eeefd8c8">${escapeHtml(s2.names)} ${escapeHtml(s2.carNum)}</span>`), a2 = true, i2.push(s2.carNum));
      }
      a2 && (await this._setItemAndInvalidate(this.blacklist_car_list_key, n2), await this.removeNewVideoList(i2), window.cleanCache_filter_actor_actress_car_list());
    }
    async removeBlacklistCarList(e2) {
      const t2 = await this.getBlacklistCarList(), n2 = t2.filter(((t3) => t3.starId !== e2));
      n2.length !== t2.length && (await this._setItemAndInvalidate(this.blacklist_car_list_key, n2), window.cleanCache_filter_actor_actress_car_list());
    }
    async getFavoriteActressList() {
      return this._readCached("cacheFavoriteActresses", this.favorite_actresses_key, []);
    }
    async addFavoriteActressList(e2) {
      return this.withActressLock(async () => {
        const t2 = await this.getFavoriteActressList();
        let n2 = 0;
        for (const a2 of e2) {
          let { starId: e3, name: i2, allName: s2, avatar: o2, lastCheckTime: r2, lastPublishTime: l2, actressType: c2 } = a2;
          if (!e3) throw new Error("缺失starId");
          if (!i2) throw new Error("缺失name");
          s2 || (s2 = [i2]);
          const d2 = "(無碼)";
          if (!c2) {
            c2 = i2.includes(d2) || s2.some(((e4) => e4.includes(d2))) ? A : D;
          }
          i2 = i2.replace(d2, ""), s2 = s2.map(((e4) => e4.replace(d2, "")));
          let h2 = t2.find(((t3) => t3.starId === e3));
          if (h2) {
            h2.avatar && h2.avatar.includes("https") || o2 && (clog.log(o2), h2.avatar = o2, clog.log(`<span class="jhs-layout-eeefd8c8">补全女优头像: ${escapeHtml(i2)}</span>`), n2++), !h2.actressType && c2 && (h2.actressType = c2, clog.log(`<span class="jhs-layout-eeefd8c8">补全女优类别: ${escapeHtml(i2)} ${escapeHtml(c2)}</span>`), n2++), h2.name.includes(d2) && (h2.name = i2, h2.allName = s2, clog.log(`<span class="jhs-layout-eeefd8c8">更正女优名字: ${escapeHtml(i2)} ${escapeHtml(s2)}</span>`), n2++);
            continue;
          }
          const g2 = utils.getNowStr();
          t2.push({
            starId: e3,
            name: i2,
            allName: s2,
            avatar: o2,
            lastCheckTime: r2,
            lastPublishTime: l2,
            createDate: g2,
            updateDate: g2,
            actressType: c2
          }), clog.log(`<span class="jhs-layout-eeefd8c8">同步JavDB已收藏的演员: ${escapeHtml(i2)}</span>`), n2++;
        }
        return n2 > 0 ? await this._setItemAndInvalidate(this.favorite_actresses_key, t2) : clog.log("信息已记录, 无需要进行同步收藏的演员"), n2;
      });
    }
    async removeFavoriteActress(e2) {
      return this.withActressLock(async () => {
        const t2 = await this.getFavoriteActressList(), n2 = t2.length, a2 = t2.filter(((t3) => t3.starId !== e2));
        return a2.length === n2 ? (clog.error(`移除演员失败, ${e2} 不存在`), false) : (await this._setItemAndInvalidate(this.favorite_actresses_key, a2), true);
      });
    }
    async updateFavoriteActress(e2) {
      return this.withActressLock(() => this._rawUpdateFavoriteActress(e2));
    }
    async getHighlightedTags() {
      return await this.forage.getItem(this.highlighted_tags_key) || [];
    }
    async setHighlightedTags(e2) {
      return await this.forage.setItem(this.highlighted_tags_key, e2);
    }
    async saveTitleFilterKeyword(n2) {
      if (await s(this, e, t).call(this, n2, this.filter_keyword_title_key, "标题关键词"), Array.isArray(n2)) return null;
      return this.withActressLock(async () => {
        const a2 = await this.getFavoriteActressList();
        let i2 = false;
        const o2 = a2.map(((e2) => {
          if (!e2.newVideoList || !Array.isArray(e2.newVideoList)) return e2;
          const t2 = e2.newVideoList.filter(((t3) => {
            const s2 = "string" == typeof t3 ? t3 : t3.carNum, a3 = s2.startsWith(n2);
            return a3 && (clog.log("移除关联女优新作品", e2.name, s2), i2 = true), !a3;
          }));
          return {
            ...e2,
            newVideoList: t2
          };
        }));
        i2 && await this._setItemAndInvalidate(this.favorite_actresses_key, o2);
      });
    }
    async getTitleFilterKeyword() {
      return this._readCached("cacheTitleFilterKeyword", this.filter_keyword_title_key, []);
    }
    async getReviewFilterKeywordList() {
      return await this.forage.getItem(this.filter_keyword_review_key) || [];
    }
    async saveReviewFilterKeyword(n2) {
      return s(this, e, t).call(this, n2, this.filter_keyword_review_key, "评论关键词");
    }
    async getSetting(e2 = null, t2) {
      let n2 = await this._readCached("cacheSettingObj", this.setting_key, {});
      if (null === e2) return n2;
      if (!Object.prototype.hasOwnProperty.call(n2, e2)) return t2;
      const a2 = n2[e2];
      return "true" === a2 || "false" === a2 ? "true" === a2.toLowerCase() : "string" != typeof a2 || "" === a2.trim() || isNaN(Number(a2)) ? a2 : Number(a2);
    }
    getSettingSync(e2, t2) {
      if (!this.cacheSettingObj) return t2;
      if (!Object.prototype.hasOwnProperty.call(this.cacheSettingObj, e2)) return t2;
      const n2 = this.cacheSettingObj[e2];
      return "true" === n2 || "false" === n2 ? "true" === n2.toLowerCase() : "string" != typeof n2 || "" === n2.trim() || isNaN(Number(n2)) ? n2 : Number(n2);
    }
    async saveSetting(e2) {
      e2 ? (await this._setItemAndInvalidate(this.setting_key, e2), window.clean_cacheSettingObj()) : show.error("设置对象为空");
    }
    async saveSettingItem(e2, t2) {
      if (!e2) return void show.error("key 不能为空");
      await navigator.locks.request("jhs_setting_lock", async () => {
        let n2 = await this.getSetting();
        n2[e2] = t2, await this.saveSetting(n2);
      }), window.clean_cacheSettingObj();
    }
    async importData(e2) {
      validatePortableData(e2);
      await hasPortableUserData(this) && await this.createSnapshot("导入前自动备份", "auto-import");
      const validKeys = /* @__PURE__ */ new Set([...PORTABLE_DATA_KEYS, "data_version"]), writes = [];
      for (const key in e2) {
        if (!validKeys.has(key)) {
          clog.warn(`[导入] 跳过未知数据键: ${key}`);
          continue;
        }
        writes.push("data_version" === key ? this.setDataVersion(e2[key]) : this._setItemAndInvalidate(key, e2[key]));
      }
      await Promise.all(writes), this._invalidateCache(), await runDataMigrations(this), await window.stateService?.recoverPendingTransaction();
    }
    async exportPortableData() {
      const data = { data_version: await this.getDataVersion() };
      for (const key of PORTABLE_DATA_KEYS) {
        const value = await this.forage.getItem(key);
        null != value && (data[key] = value);
      }
      return data;
    }
    async exportData() {
      const data = await this.exportPortableData();
      if (Object.keys(data).length <= 1) throw new Error("没有可导出的数据");
      return data;
    }
    async getThirdPartyCache() {
      return await this.forage.getItem(this.third_party_cache_key) || {};
    }
    async setThirdPartyCache(e2) {
      await this.forage.setItem(this.third_party_cache_key, e2 || {});
    }
    async clearThirdPartyCache() {
      await this.forage.removeItem(this.third_party_cache_key);
    }
    async deleteCachedRequest(key) {
      const cache = await this.getThirdPartyCache();
      Object.prototype.hasOwnProperty.call(cache, key) && (delete cache[key], await this.setThirdPartyCache(cache));
    }
    async cachedRequest(e2, t2, n2) {
      const a2 = Date.now(), i2 = await this.getThirdPartyCache(), s2 = i2[e2];
      if (s2 && s2.time && a2 - s2.time < (s2.ttl || t2)) return this._cacheStats.hits++, s2.data;
      this._cacheStats.misses++;
      const loaded = await n2(), customTtl = loaded && "object" === typeof loaded && "__jhsCacheTtl" in loaded ? loaded.__jhsCacheTtl : t2;
      const o2 = loaded && "object" === typeof loaded && "__jhsCacheTtl" in loaded ? loaded.data : loaded;
      if (void 0 === o2 || null === o2) return o2;
      return i2[e2] = {
        time: a2,
        ttl: customTtl,
        data: o2
      }, await this.setThirdPartyCache(i2), o2;
    }
    getCacheHitStats() {
      const e2 = this._cacheStats.hits + this._cacheStats.misses;
      return {
        hits: this._cacheStats.hits,
        misses: this._cacheStats.misses,
        total: e2,
        rate: e2 > 0 ? (this._cacheStats.hits / e2 * 100).toFixed(1) + "%" : "N/A"
      };
    }
    _groupDuplicateItems(e2, t2) {
      return groupDuplicateItems(e2, t2);
    }
    _dedupeByKey(e2, t2) {
      return dedupeByKey(e2, t2);
    }
    async inspectDataHealth() {
      const [e2, t2, n2, a2] = await Promise.all([this.getCarList(), this.getFavoriteActressList(), this.getBlacklist(), this.getBlacklistCarList()]), i2 = await this.getCarMap(), s2 = {
        checkedAt: utils.getNowStr(),
        totals: {
          carList: e2.length,
          favoriteActresses: t2.length,
          blacklist: n2.length,
          blacklistCarList: a2.length
        },
        fixable: [],
        readonly: []
      }, o2 = /* @__PURE__ */ __name((e3, t3, n3) => s2.fixable.push({
        type: e3,
        message: t3,
        count: n3
      }), "o"), r2 = /* @__PURE__ */ __name((e3, t3, n3) => s2.readonly.push({
        type: e3,
        message: t3,
        count: n3
      }), "r");
      const l2 = this._groupDuplicateItems(e2, "carNum"), c2 = this._groupDuplicateItems(t2, "starId"), d2 = this._groupDuplicateItems(n2, "starId");
      l2.length && o2("duplicate-car", "重复番号记录", l2.length), c2.length && o2("duplicate-actress", "重复收藏演员", c2.length), d2.length && o2("duplicate-blacklist", "重复黑名单演员", d2.length);
      const h2 = e2.filter(((e3) => e3 && e3.actress)).length, g2 = a2.filter(((e3) => e3 && e3.actress)).length, p2 = t2.filter(((e3) => e3 && Object.prototype.hasOwnProperty.call(e3, "dbId"))).length, m2 = n2.filter(((e3) => e3 && ("key" in e3 || "recordTime" in e3 || "isActor" in e3))).length;
      h2 + g2 + p2 + m2 > 0 && o2("legacy-fields", "旧字段残留", h2 + g2 + p2 + m2);
      const u2 = t2.filter(((e3) => e3 && e3.name && !Array.isArray(e3.allName))).length + n2.filter(((e3) => e3 && e3.name && !Array.isArray(e3.allName))).length;
      u2 && o2("invalid-all-name", "演员别名不是数组", u2);
      let f = 0;
      t2.forEach(((e3) => {
        Array.isArray(e3?.newVideoList) && (f += e3.newVideoList.filter(((e4) => {
          const t3 = "string" == typeof e4 ? e4 : e4.carNum;
          return i2.has(t3);
        })).length);
      })), f && o2("stored-new-video", "新作品列表中已有鉴定记录", f);
      const v2 = e2.filter(((e3) => e3 && e3.carNum && !e3.url)).length;
      v2 && r2("missing-url", "番号记录缺失 url，需要人工确认来源", v2);
      const b2 = t2.filter(((e3) => e3 && !e3.starId)).length + n2.filter(((e3) => e3 && !e3.starId)).length;
      b2 && r2("missing-star-id", "演员缺失 starId，需要人工确认身份", b2);
      const w = new Set(n2.map(((e3) => e3 && e3.starId)).filter(Boolean)), y2 = a2.filter(((e3) => e3 && e3.starId && !w.has(e3.starId))).length;
      return y2 && r2("orphan-blacklist-car", "黑名单作品找不到关联演员", y2), s2;
    }
    async repairDataHealth() {
      let e2 = 0, t2 = await this.getCarList(), n2 = await this.getFavoriteActressList(), a2 = await this.getBlacklist(), i2 = await this.getBlacklistCarList();
      const s2 = this._dedupeByKey(t2, "carNum");
      s2.changed && (t2 = s2.list, e2++);
      const o2 = this._dedupeByKey(n2, "starId");
      o2.changed && (n2 = o2.list, e2++);
      const r2 = this._dedupeByKey(a2, "starId");
      r2.changed && (a2 = r2.list, e2++);
      t2 = t2.map(((t3) => {
        if (!t3) return t3;
        let n3 = false;
        return void 0 !== t3.actress && (t3.names = t3.actress, delete t3.actress, n3 = true), n3 && e2++, t3;
      })), i2 = i2.map(((t3) => {
        if (!t3) return t3;
        let n3 = false;
        return void 0 !== t3.actress && (t3.names = t3.actress, delete t3.actress, n3 = true), Object.prototype.hasOwnProperty.call(t3, "type") && (delete t3.type, n3 = true), n3 && e2++, t3;
      })), n2 = n2.map(((t3) => {
        if (!t3) return t3;
        let n3 = false;
        return Object.prototype.hasOwnProperty.call(t3, "dbId") && (t3.starId || (t3.starId = t3.dbId), delete t3.dbId, n3 = true), t3.name && !Array.isArray(t3.allName) && (t3.allName = t3.allName ? [t3.allName] : [t3.name], n3 = true), n3 && e2++, t3;
      })), a2 = a2.map(((t3) => {
        if (!t3) return t3;
        let n3 = false;
        return Object.prototype.hasOwnProperty.call(t3, "isActor") && (t3.role || (t3.role = t3.isActor ? B : P), delete t3.isActor, n3 = true), Object.prototype.hasOwnProperty.call(t3, "recordTime") && (t3.createTime || (t3.createTime = t3.recordTime), delete t3.recordTime, n3 = true), Object.prototype.hasOwnProperty.call(t3, "key") && (delete t3.key, n3 = true), t3.name && !Array.isArray(t3.allName) && (t3.allName = t3.allName ? [t3.allName] : [t3.name], n3 = true), n3 && e2++, t3;
      }));
      const l2 = new Set(t2.filter(((e3) => e3 && e3.carNum)).map(((e3) => e3.carNum)));
      n2 = n2.map(((t3) => {
        if (!Array.isArray(t3?.newVideoList)) return t3;
        const n3 = t3.newVideoList.filter(((e3) => {
          const n4 = "string" == typeof e3 ? e3 : e3.carNum;
          return !l2.has(n4);
        }));
        return n3.length !== t3.newVideoList.length && (t3 = {
          ...t3,
          newVideoList: n3
        }, 0 === n3.length && t3.lastPublishTime && (t3.lastPublishTime = null), e2++), t3;
      })), await this._setItemAndInvalidate(this.car_list_key, t2), await this._setItemAndInvalidate(this.favorite_actresses_key, n2), await this._setItemAndInvalidate(this.blacklist_key, a2), await this._setItemAndInvalidate(this.blacklist_car_list_key, i2);
      return {
        fixedGroups: e2,
        report: await this.inspectDataHealth()
      };
    }
    /** 数据迁移: 将旧版扁平键名重命名为新格式 */
    async merge_table_name() {
      let e2 = "filter_actor_actress_info_list", t2 = await this.forage.getItem(e2) || [];
      t2 && t2.length > 0 && (clog.debug("更正", e2), await this._setItemAndInvalidate(this.blacklist_key, t2)), await this.forage.removeItem(e2), e2 = "favorite_actresses_info_list", t2 = await this.forage.getItem(e2) || [], t2 && t2.length > 0 && (clog.debug("更正", e2), await this._setItemAndInvalidate(this.favorite_actresses_key, t2)), await this.forage.removeItem(e2), e2 = "car_list_filter_actor_actress", t2 = await this.forage.getItem(e2) || [], t2 && t2.length > 0 && (clog.debug("更正", e2), await this._setItemAndInvalidate(this.blacklist_car_list_key, t2)), await this.forage.removeItem(e2), e2 = "title_filter_keyword", t2 = await this.forage.getItem(e2) || [], t2 && t2.length > 0 && (clog.debug("更正", e2), await this._setItemAndInvalidate(this.filter_keyword_title_key, t2)), await this.forage.removeItem(e2), e2 = "review_filter_keyword", t2 = await this.forage.getItem(e2) || [], t2 && t2.length > 0 && (clog.debug("更正", e2), await this._setItemAndInvalidate(this.filter_keyword_review_key, t2)), await this.forage.removeItem(e2), e2 = "highlightedTags", t2 = await this.forage.getItem(e2) || [], t2 && t2.length > 0 && (clog.debug("更正", e2), await this._setItemAndInvalidate(this.highlighted_tags_key, t2)), await this.forage.removeItem(e2);
    }
    async clean_no_url_blacklist() {
      const [e2, t2] = await Promise.all([this.getBlacklistCarList(), this.getBlacklist()]);
      if (e2.length && !e2[0].actress) return;
      const n2 = new Set(t2.map(((e3) => e3.name))), a2 = e2.filter(((e3) => !e3.actress || n2.has(e3.actress)));
      e2.length !== a2.length && (clog.debug("清理 blacklistCarList 前", e2.length), clog.debug("清理 blacklistCarList 后", a2.length), await this._setItemAndInvalidate(this.blacklist_car_list_key, a2));
      const i2 = new Set(a2.map(((e3) => e3.actress)));
      let s2 = t2.filter(((e3) => i2.has(e3.name)));
      s2 = s2.map(((e3) => {
        const { key: t3, recordTime: n3, ...a3 } = e3, i3 = a3;
        return void 0 !== n3 && (i3.createTime = n3), i3;
      })), (t2.length !== s2.length || t2.some(((e3) => "key" in e3 || "recordTime" in e3))) && (clog.debug("清理 Blacklist 前", t2.length), clog.debug("清理 Blacklist 后", s2.length), await this._setItemAndInvalidate(this.blacklist_key, s2));
    }
    async async_merge_other() {
      const e2 = await this.getSetting();
      let t2 = false;
      const n2 = {
        enableCheckFilterActorActress: "enableCheckBlacklist",
        checkIntervalTime_filterActorActress: "checkBlacklist_intervalTime",
        checkIntervalTime_ruleTime: "checkNewVideo_ruleTime",
        checkIntervalTime_newVideo: "checkNewVideo_intervalTime",
        checkIntervalTime_favoriteActress: "checkFavoriteActress_IntervalTime"
      };
      for (const a2 in n2) {
        const i2 = n2[a2];
        Object.prototype.hasOwnProperty.call(e2, a2) && (e2[i2] = e2[a2], delete e2[a2], t2 = true);
      }
      e2.checkFilterTime && (delete e2.checkFilterTime, t2 = true), e2.checkFilterConcurrencyCount && (delete e2.checkFilterConcurrencyCount, t2 = true), e2.checkFilterSleep && (delete e2.checkFilterSleep, t2 = true), t2 && (await this.saveSetting(e2), clog.debug("配置数据已更正"));
    }
    /** 数据迁移: 补全黑名单条目缺失的 role/starId/allName/movieType 字段 */
    async merge_blacklist() {
      const e2 = await this.getBlacklist();
      if (!e2 || 0 === e2.length) return;
      let t2 = false;
      const n2 = e2.map(((e3) => {
        let n3 = false;
        if (Object.prototype.hasOwnProperty.call(e3, "isActor") && !e3.role && (e3.role = e3.isActor ? B : P, delete e3.isActor, n3 = true), !e3.starId && e3.url) try {
          const t3 = new URL(e3.url).pathname, a3 = t3.split("/").filter(((e4) => "" !== e4.trim())).pop();
          e3.starId !== a3 && (e3.starId = a3, n3 = true);
        } catch (a3) {
          clog.error("提取url-starId发生错误", e3.url, a3);
        }
        if (e3.allName || (e3.allName = e3.name ? [e3.name] : [], n3 = true), e3.movieType || (e3.movieType = D, n3 = true), e3.url && e3.url.includes("sort_type")) {
          const t3 = new URL(e3.url);
          t3.searchParams.delete("sort_type"), e3.url = t3.toString(), clog.debug("去除黑名单地址sort_type参数");
        }
        return n3 && (t2 = true), e3;
      }));
      t2 && (clog.debug("更正 Blacklist 数据结构"), await this._setItemAndInvalidate(this.blacklist_key, n2));
      const a2 = await this.getBlacklistCarList();
      t2 = false;
      const i2 = a2.map(((n3) => {
        if (!n3.starId) {
          let a3 = e2.find(((e3) => e3.name === n3.actress));
          a3 && (n3.starId = a3.starId), t2 = true;
        }
        return n3.type && (delete n3.type, t2 = true), n3;
      }));
      t2 && (clog.debug("更正 blacklistCarList 数据结构"), await this._setItemAndInvalidate(this.blacklist_car_list_key, i2));
    }
    async merge_favoriteActress() {
      const e2 = await this.getFavoriteActressList();
      if (!e2 || 0 === e2.length) return;
      let t2 = false;
      const n2 = e2.map(((e3) => {
        let n3 = false;
        return e3.dbId && (e3.starId = e3.dbId, delete e3.dbId, n3 = true), n3 && (t2 = true), e3;
      }));
      t2 && (clog.debug("更正 favoriteActressesInfoList 数据结构"), await this._setItemAndInvalidate(this.favorite_actresses_key, n2));
    }
    async merge_tow_car_list_table() {
      const e2 = await this.getBlacklistCarList(), t2 = await this.getCarList();
      let n2 = false;
      const a2 = e2.map(((e3) => {
        let t3 = false;
        return void 0 !== e3.actress && (e3.names = e3.actress, delete e3.actress, t3 = true), t3 && (n2 = true), e3;
      }));
      n2 && (clog.debug("更正 blacklistCarList 数据结构 actress->names"), await this._setItemAndInvalidate(this.blacklist_car_list_key, a2)), n2 = false;
      const i2 = t2.map(((e3) => {
        let t3 = false;
        return void 0 !== e3.actress && (e3.names = e3.actress, delete e3.actress, t3 = true), t3 && (n2 = true), e3;
      }));
      n2 && (clog.debug("更正 carList 数据结构 actress->names"), await this._setItemAndInvalidate(this.car_list_key, i2));
    }
    /* ───── 快照管理 ───── */
    _snapshotKey() {
      return "snapshots";
    }
    _snapshotMetaKeys() {
      return ["snapshots", "data_version"];
    }
    async _getSnapshots() {
      return await this.forage.getItem(this._snapshotKey()) || [];
    }
    async _saveSnapshots(e2) {
      await this._setItemAndInvalidate(this._snapshotKey(), e2);
    }
    async _withSnapshotLock(e2) {
      return await navigator.locks.request("jhs_snapshot_lock", async () => await e2());
    }
    async createSnapshot(e2 = "", t2 = "manual") {
      return this._withSnapshotLock(async () => {
        const n2 = await this._getSnapshots(), a2 = await this.exportData();
        for (const i3 of this._snapshotMetaKeys()) delete a2[i3];
        let i2 = 0;
        for (const s3 of Object.values(a2)) Array.isArray(s3) ? i2 += s3.length : "object" == typeof s3 && s3 && i2++;
        const s2 = {
          id: "snap_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          name: e2 || utils.getNowStr(),
          source: t2,
          time: utils.getNowStr(),
          itemCount: i2,
          data: a2,
          kind: "snapshot"
        };
        n2.push(s2), n2.length > 10 && n2.splice(0, n2.length - 10);
        return await this._saveSnapshots(n2), clog.log(`创建快照: ${s2.name} (${t2})`), s2;
      });
    }
    async getSnapshotList() {
      return (await this._getSnapshots()).map(((e2) => ({ id: e2.id, name: e2.name, source: e2.source, time: e2.time, itemCount: e2.itemCount, kind: e2.kind || "snapshot", targetDataVersion: e2.targetDataVersion, appVersion: e2.appVersion })));
    }
    async getSnapshot(e2) {
      return (await this._getSnapshots()).find(((t2) => t2.id === e2)) || null;
    }
    async deleteSnapshot(e2) {
      return this._withSnapshotLock(async () => {
        const t2 = await this._getSnapshots(), n2 = t2.filter(((t3) => t3.id !== e2));
        if (n2.length === t2.length) return void clog.warn("删除快照失败, ID不存在: " + e2);
        await this._saveSnapshots(n2), clog.log("删除快照: " + e2);
      });
    }
    async restoreSnapshot(e2) {
      const t2 = await this.getSnapshot(e2);
      if (!t2) throw new Error("快照不存在: " + e2);
      if (!t2.data || "object" != typeof t2.data) throw new Error("快照数据损坏");
      const n2 = { ...t2.data };
      for (const a2 of this._snapshotMetaKeys()) delete n2[a2];
      await this.importData(n2);
      clog.log("已恢复快照: " + t2.name);
      return t2;
    }
    /* ───── 差异对比引擎 ───── */
    _stableStringify(e2) {
      if (null === e2 || "object" != typeof e2) return JSON.stringify(e2);
      if (Array.isArray(e2)) return "[" + e2.map(((e3) => this._stableStringify(e3))).join(",") + "]";
      return "{" + Object.keys(e2).sort().map(((t2) => JSON.stringify(t2) + ":" + this._stableStringify(e2[t2]))).join(",") + "}";
    }
    diffData(e2, t2) {
      const n2 = /* @__PURE__ */ new Set([...Object.keys(e2), ...Object.keys(t2)]), a2 = {}, i2 = { added: 0, removed: 0, modified: 0, unchanged: 0 };
      for (const o2 of n2) {
        const r2 = e2[o2], l2 = t2[o2];
        if (void 0 === r2 && void 0 === l2) continue;
        if (void 0 === r2) {
          const e3 = Array.isArray(l2) ? l2.length : 1;
          a2[o2] = { status: "added", oldCount: 0, newCount: e3, added: Array.isArray(l2) ? l2 : [], removed: [], modified: [] }, i2.added++;
        } else if (void 0 === l2) {
          const t3 = Array.isArray(r2) ? r2.length : 1;
          a2[o2] = { status: "removed", oldCount: t3, newCount: 0, added: [], removed: Array.isArray(r2) ? r2 : [], modified: [] }, i2.removed++;
        } else if (Array.isArray(r2) && Array.isArray(l2)) {
          const e3 = this._diffArrays(r2, l2, o2);
          a2[o2] = { status: e3.status, oldCount: r2.length, newCount: l2.length, ...e3 }, i2[e3.status]++;
        } else if ("object" == typeof r2 && "object" == typeof l2 && !Array.isArray(r2) && !Array.isArray(l2)) {
          const e3 = this._diffObjects(r2, l2);
          a2[o2] = { status: e3.status, oldCount: Object.keys(r2).length, newCount: Object.keys(l2).length, added: [], removed: [], modified: e3.changes }, i2[e3.status]++;
        } else r2 === l2 ? (a2[o2] = { status: "unchanged", oldCount: 1, newCount: 1, added: [], removed: [], modified: [] }, i2.unchanged++) : (a2[o2] = { status: "modified", oldCount: 1, newCount: 1, added: [], removed: [], modified: [{ key: o2, changes: { _value: [r2, l2] } }] }, i2.modified++);
      }
      return { summary: i2, stores: a2 };
    }
    _getArrayKey(e2) {
      return "car_list" === e2 || "blacklist_car_list" === e2 ? "carNum" : "blacklist" === e2 || "favorite_actresses" === e2 ? "starId" : null;
    }
    _diffArrays(e2, t2, n2) {
      const a2 = this._getArrayKey(n2);
      if (!a2) {
        const n3 = this._stableStringify(e2), i3 = this._stableStringify(t2);
        if (n3 === i3) return { status: "unchanged", added: [], removed: [], modified: [] };
        const s3 = new Set(e2.map(((e3) => this._stableStringify(e3)))), o3 = new Set(t2.map(((e3) => this._stableStringify(e3))));
        return { status: "modified", added: t2.filter(((e3) => !s3.has(this._stableStringify(e3)))), removed: e2.filter(((e3) => !o3.has(this._stableStringify(e3)))), modified: [] };
      }
      const i2 = new Map(e2.map(((e3) => [e3[a2], e3]))), s2 = new Map(t2.map(((e3) => [e3[a2], e3]))), o2 = [], r2 = [], l2 = [];
      for (const [c3, d2] of s2) {
        const t3 = i2.get(c3);
        if (!t3) o2.push(d2);
        else {
          const e3 = this._diffObjects(t3, d2);
          "unchanged" !== e3.status && l2.push({ key: c3, changes: e3.changes });
        }
      }
      for (const [c3] of i2) s2.has(c3) || r2.push(i2.get(c3));
      const c2 = o2.length + r2.length + l2.length;
      return { status: 0 === c2 ? "unchanged" : "modified", added: o2, removed: r2, modified: l2 };
    }
    _diffObjects(e2, t2) {
      const n2 = /* @__PURE__ */ new Set([...Object.keys(e2), ...Object.keys(t2)]), a2 = {};
      let i2 = 0;
      for (const s2 of n2) {
        const o2 = e2[s2], r2 = t2[s2];
        this._stableStringify(o2) !== this._stableStringify(r2) && (a2[s2] = [o2, r2], i2++);
      }
      return { status: 0 === i2 ? "unchanged" : "modified", changes: a2 };
    }
  };
  __name(_StorageManager, "StorageManager");
  var StorageManager = _StorageManager;
  var PORTABLE_DATA_KEYS = Object.freeze(["car_list", "filter_keyword_title", "filter_keyword_review", "setting", "blacklist", "blacklist_car_list", "third_party_ttl_cache", "favorite_actresses", "highlighted_tags", "activity_log", "offline_history", "new_video_decisions"]);
  var PORTABLE_ARRAY_KEYS = /* @__PURE__ */ new Set(["car_list", "filter_keyword_title", "filter_keyword_review", "blacklist", "blacklist_car_list", "favorite_actresses", "highlighted_tags", "offline_history"]);
  var PORTABLE_OBJECT_KEYS = /* @__PURE__ */ new Set(["setting", "third_party_ttl_cache", "activity_log", "new_video_decisions"]);
  function validatePortableData(data) {
    if (!data || "object" != typeof data || Array.isArray(data)) throw new TypeError("备份数据格式无效");
    const version = Number(data.data_version || 0);
    if (!Number.isInteger(version) || version < 0) throw new TypeError("备份数据版本无效");
    if (version > CURRENT_DATA_VERSION) throw new Error("数据来自更新版本的 JHS，当前版本无法安全读取");
    for (const key of PORTABLE_ARRAY_KEYS) if (null != data[key] && !Array.isArray(data[key])) throw new TypeError(`备份字段 ${key} 必须为数组`);
    for (const key of PORTABLE_OBJECT_KEYS) if (null != data[key] && ("object" != typeof data[key] || Array.isArray(data[key]))) throw new TypeError(`备份字段 ${key} 必须为对象`);
    return version;
  }
  __name(validatePortableData, "validatePortableData");
  async function hasPortableUserData(storage) {
    for (const key of PORTABLE_DATA_KEYS) {
      const value = await storage.forage.getItem(key);
      if (Array.isArray(value) ? value.length : value && "object" == typeof value ? Object.keys(value).length : null != value) return true;
    }
    return false;
  }
  __name(hasPortableUserData, "hasPortableUserData");
  async function ensureV2MigrationSnapshot(storage) {
    if (!await hasPortableUserData(storage)) return null;
    const snapshots = await storage._getSnapshots(), existing = snapshots.find(((item) => "migration-snapshot" === item.kind && 2 === item.targetDataVersion));
    if (existing) return existing;
    const data = await storage.exportPortableData(), snapshot = {
      id: "migration_v2_" + Date.now(),
      name: "6.4.0-migration-backup",
      source: "migration",
      kind: "migration-snapshot",
      targetDataVersion: 2,
      appVersion: "6.4.0",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      time: utils.getNowStr(),
      itemCount: Object.values(data).reduce(((sum, value) => sum + (Array.isArray(value) ? value.length : value && "object" == typeof value ? 1 : 0)), 0),
      data
    };
    return snapshots.push(snapshot), snapshots.length > 10 && snapshots.splice(0, snapshots.length - 10), await storage._saveSnapshots(snapshots), snapshot;
  }
  __name(ensureV2MigrationSnapshot, "ensureV2MigrationSnapshot");
  async function migrateLegacyStorage(storage) {
    await storage.merge_table_name(), await storage.clean_no_url_blacklist(), await storage.async_merge_other(), await storage.merge_blacklist(), await storage.merge_favoriteActress(), await storage.merge_tow_car_list_table();
  }
  __name(migrateLegacyStorage, "migrateLegacyStorage");
  async function migrateStateFlags(storage) {
    await ensureV2MigrationSnapshot(storage);
    const cars = await storage.forage.getItem(storage.car_list_key) || [], result = mergeCanonicalCarRecords(cars);
    await storage._setItemAndInvalidate(storage.car_list_key, result.list);
    const actresses = await storage.forage.getItem(storage.favorite_actresses_key) || [];
    const migratedActresses = actresses.map(((actress) => {
      if (!Array.isArray(actress.newVideoList)) return actress;
      const newVideoList = actress.newVideoList.map(((item) => "string" == typeof item ? normalizeCarNum(item) : {
        ...item,
        carNum: normalizeCarNum(item.carNum)
      })).filter(((item) => "string" == typeof item ? item : item.carNum));
      return { ...actress, newVideoList };
    }));
    await storage._setItemAndInvalidate(storage.favorite_actresses_key, migratedActresses);
    const warnings = await storage.forage.getItem("data_health_warnings") || [];
    result.collisions.length && warnings.push({ type: "canonical-collision", createdAt: (/* @__PURE__ */ new Date()).toISOString(), items: result.collisions });
    result.unknownStatuses.length && warnings.push({ type: "unknown-legacy-status", createdAt: (/* @__PURE__ */ new Date()).toISOString(), items: result.unknownStatuses });
    warnings.length && await storage.forage.setItem("data_health_warnings", warnings);
  }
  __name(migrateStateFlags, "migrateStateFlags");
  var DATA_MIGRATIONS = Object.freeze({ 1: migrateLegacyStorage, 2: migrateStateFlags });
  async function runDataMigrations(storage) {
    let version = await storage.getDataVersion();
    if (version > CURRENT_DATA_VERSION) throw new Error("数据来自更新版本的 JHS，当前版本无法安全读取");
    for (let target = version + 1; target <= CURRENT_DATA_VERSION; target++) {
      const migration = DATA_MIGRATIONS[target];
      if (!migration) throw new Error(`缺少数据迁移: ${target - 1} → ${target}`);
      await migration(storage), await storage.setDataVersion(target), version = target;
    }
    return version;
  }
  __name(runDataMigrations, "runDataMigrations");
  var U = "https://jdforrepam.com/api";
  function O() {
    const e2 = "jhs_review_ts", t2 = "jhs_review_sign", n2 = Math.floor(Date.now() / 1e3);
    if (n2 - (localStorage.getItem(e2) || 0) <= 20) return localStorage.getItem(t2);
    const a2 = `${n2}.lpw6vgqzsp.${md5(`${n2}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return localStorage.setItem(e2, n2), localStorage.setItem(t2, a2), a2;
  }
  __name(O, "O");
  var R = /* @__PURE__ */ __name(async (e2, t2 = 1, n2 = 20) => {
    let a2 = `${U}/v1/movies/${e2}/reviews`, i2 = {
      jdSignature: await O()
    };
    return await storageManager.cachedRequest(`reviews:${e2}:${t2}:${n2}`, 864e5, (async () => {
      const e3 = await gmHttp.get(a2, {
        page: t2,
        sort_by: "hotly",
        limit: n2
      }, i2);
      if (!e3?.data?.reviews) throw new Error(e3?.message || "获取评论失败");
      return e3.data.reviews;
    }));
  }, "R");
  var V = /* @__PURE__ */ __name(async (e2) => {
    let t2 = `${U}/v4/movies/${e2}`, n2 = {
      jdSignature: await O()
    };
    const a2 = await storageManager.cachedRequest(`movie-detail:${e2}`, 6048e5, (async () => {
      const e3 = await gmHttp.get(t2, null, n2);
      if (!e3.data) throw new Error(e3.message || "获取视频详情失败");
      return e3;
    }));
    if (!a2.data) throw show.error("获取视频详情失败: " + a2.message), new Error(a2.message);
    const i2 = a2.data.movie, s2 = i2.preview_images, o2 = [];
    return s2.forEach(((e3) => {
      o2.push(e3.large_url.replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com"));
    })), {
      movieId: i2.id,
      actors: i2.actors,
      duration: i2.duration,
      title: i2.origin_title,
      carNum: i2.number,
      score: i2.score,
      releaseDate: i2.release_date,
      watchedCount: i2.watched_count,
      imgList: o2
    };
  }, "V");
  var K = /* @__PURE__ */ __name(async (e2, t2 = 1, n2 = 20) => {
    let a2 = `${U}/v1/lists/related?movie_id=${e2}&page=${t2}&limit=${n2}`, i2 = {
      jdSignature: await O()
    };
    const s2 = await storageManager.cachedRequest(`related:${e2}:${t2}:${n2}`, 864e5, (async () => {
      const e3 = await gmHttp.get(a2, null, i2);
      if (!e3?.data?.lists) throw new Error(e3?.message || "获取相关清单失败");
      return e3;
    })), o2 = [];
    return s2.data.lists.forEach(((e3) => {
      o2.push({
        relatedId: e3.id,
        name: e3.name,
        movieCount: e3.movies_count,
        collectionCount: e3.collections_count,
        viewCount: e3.views_count,
        createTime: utils.formatDate(e3.created_at)
      });
    })), o2;
  }, "K");
  var W = /* @__PURE__ */ __name(async (e2 = "daily", t2 = "high_score") => {
    let n2 = `${U}/v1/rankings/playback?period=${e2}&filter_by=${t2}`, a2 = {
      jdSignature: await O()
    };
    return (await gmHttp.get(n2, null, a2)).data.movies;
  }, "W");
  var q = /* @__PURE__ */ __name(async (e2 = "all", t2 = "", n2 = 1, a2 = 40) => {
    let i2 = `${U}/v1/movies/top?start_rank=1&type=${e2}&type_value=${t2}&ignore_watched=false&page=${n2}&limit=${a2}`;
    const l2 = localStorage.getItem("jhs_appAuthorization"), c2 = l2 ? await decryptData(l2) : "";
    let s2 = {
      "user-agent": "Dart/3.5 (dart:io)",
      "accept-language": "zh-TW",
      host: "jdforrepam.com",
      authorization: "Bearer " + c2,
      jdsignature: await O()
    };
    return await gmHttp.get(i2, null, s2);
  }, "q");
  var _Utils = class _Utils {
    constructor() {
      return i(this, "intervalContainer", {}), i(this, "waitSequence", 0), i(this, "mimeTypes", {
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
      }), i(this, "timers", /* @__PURE__ */ new Map()), i(this, "insertStyle", ((e2) => {
        const t2 = (Array.isArray(e2) ? e2 : [e2]).filter(Boolean);
        if (0 === t2.length) return;
        const n2 = t2.map(((e3) => e3.replace(/^\s*<style[^>]*>/i, "").replace(/<\/style>?\s*$/i, ""))).filter(Boolean).join("\n"), a2 = document.createElement("style");
        n2 && (a2.textContent = n2, document.head.append(a2));
      })), i(this, "layerIndexStack", []), _Utils.instance || (_Utils.instance = this), _Utils.instance;
    }
    importResource(e2) {
      let t2;
      e2.indexOf("css") >= 0 ? (t2 = document.createElement("link"), t2.setAttribute("rel", "stylesheet"), t2.href = e2) : (t2 = document.createElement("script"), t2.setAttribute("type", "text/javascript"), t2.src = e2), document.documentElement.appendChild(t2);
    }
    openPage(e2, t2, n2, a2) {
      n2 = n2 ?? true;
      const navigation = a2 && (Object.prototype.hasOwnProperty.call(a2, "event") || Object.prototype.hasOwnProperty.call(a2, "newTab")) ? a2 : { event: a2 }, event = navigation.event;
      const destination = new URL(e2, window.location.origin), carNum = normalizeCarNum(t2), isMovieDetail = /^\/v\/[^/]+/.test(destination.pathname);
      isMovieDetail && carNum && destination.searchParams.set("jhsCarNum", carNum);
      if (navigation.newTab || event && (event.ctrlKey || event.metaKey || 1 === event.button)) return void GM_openInTab(destination.href, {
        insert: 0
      });
      destination.pathname.includes("/actors/") || destination.pathname.includes("/star/") || destination.searchParams.set("hideNav", "1");
      layer.open({
        type: 2,
        title: t2,
        content: destination.href,
        scrollbar: false,
        shadeClose: n2,
        area: this.getDialogArea("workspace"),
        isOutAnim: false,
        anim: -1,
        success: /* @__PURE__ */ __name((e3, t3) => {
          this.setupEscClose(t3);
        }, "success")
      });
    }
    _handleGlobalEscKey(e2) {
      if ("Escape" !== e2.key && 27 !== e2.keyCode) return;
      if (0 === this.layerIndexStack.length) return;
      const t2 = this.layerIndexStack[this.layerIndexStack.length - 1], n2 = $(`#layui-layer${t2}`);
      let a2 = false;
      if (n2.find(".viewer-container").length > 0) a2 = true;
      else {
        const e3 = n2.find(`#layui-layer-iframe${t2}`)[0];
        if (e3 && e3.contentDocument) try {
          $(e3.contentDocument).find(".viewer-container").length > 0 && (a2 = true);
        } catch (i2) {
          clog.warn("无法检查跨域 iframe 内的 .viewer-container");
        }
      }
      a2 || (this.layerIndexStack.pop(), layer.close(t2));
    }
    setupEscClose(e2) {
      var t2;
      this._boundHandler || (this._boundHandler = this._handleGlobalEscKey.bind(this), $(document).off("keydown.globalLayerEsc"), $(document).on("keydown.globalLayerEsc", this._boundHandler)), -1 === this.layerIndexStack.indexOf(e2) && this.layerIndexStack.push(e2);
      const n2 = $(`#layui-layer-iframe${e2}`), a2 = `keydown.layerEsc${e2}`;
      try {
        const e3 = null == (t2 = n2[0]) ? void 0 : t2.contentDocument;
        if (e3) {
          if ("yes" === n2.attr("data-esc-bound")) return;
          $(e3).off(a2), $(e3).on(a2, this._boundHandler), n2.attr("data-esc-bound", "yes");
        }
      } catch (i2) {
        clog.error("iframe监听失败 (跨域或未加载完毕):", i2);
      }
    }
    async closePage(options = {}) {
      if ("yes" !== await storageManager.getSetting("needClosePage", "yes")) return false;
      const root = options?.root, parseIndex = /* @__PURE__ */ __name((element) => {
        const id = element?.id || "", match = /^layui-layer(\d+)$/.exec(id);
        return match ? Number(match[1]) : null;
      }, "parseIndex");
      let layerIndex = Number.isInteger(options?.layerIndex) ? options.layerIndex : null;
      if (null === layerIndex && root) {
        const element = root.jquery ? root[0] : root.nodeType ? root : null, layerElement = element?.matches?.(".layui-layer") ? element : element?.closest?.(".layui-layer");
        layerIndex = parseIndex(layerElement);
      }
      if (null === layerIndex && window.frameElement) layerIndex = parseIndex(window.frameElement.closest?.(".layui-layer"));
      const ownerWindow = window.parent && window.parent !== window ? window.parent : window, ownerLayer = ownerWindow.layer || globalThis.layer;
      if (null !== layerIndex && "function" == typeof ownerLayer?.close) return ownerLayer.close(layerIndex), true;
      if (window.opener && !window.opener.closed) return window.close(), true;
      return false;
    }
    loopDetector(e2, t2, n2 = 20, a2 = 1e4, i2 = true) {
      const s2 = ++this.waitSequence;
      let o2 = null, r2 = null, l2 = null, c2 = false;
      const d2 = /* @__PURE__ */ __name(() => {
        o2?.disconnect(), clearTimeout(r2), clearTimeout(l2), clearInterval(this.intervalContainer[s2]?.fallback), delete this.intervalContainer[s2];
      }, "d"), h2 = /* @__PURE__ */ __name((e3) => {
        if (c2) return;
        c2 = true, d2(), e3 && t2 && t2();
      }, "h"), g2 = /* @__PURE__ */ __name(() => {
        if (c2) return;
        e2() && h2(true);
      }, "g"), p2 = /* @__PURE__ */ __name(() => {
        c2 || (clearTimeout(r2), r2 = setTimeout(g2, Math.max(0, n2)));
      }, "p");
      this.intervalContainer[s2] = {};
      if (e2()) return void h2(true);
      if ("function" == typeof MutationObserver && document.documentElement) o2 = new MutationObserver(p2), o2.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      else this.intervalContainer[s2].fallback = setInterval(g2, Math.max(100, n2));
      l2 = setTimeout((() => {
        if (c2) return;
        let t3 = false;
        try {
          t3 = e2();
        } catch (e3) {
          clog.error("DOM 等待条件执行失败", e3);
        }
        h2(t3 || i2);
      }), Math.max(0, a2));
    }
    rightClick(e2, t2, n2) {
      let a2;
      "string" == typeof e2 ? a2 = document.querySelector(e2) : e2 instanceof HTMLElement && (a2 = e2), a2 || (clog.warn("rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。"), a2 = document.body), "string" == typeof t2 && "" !== t2.trim() ? a2.addEventListener("contextmenu", ((e3) => {
        const a3 = e3.target.closest(t2);
        a3 && n2(e3, a3);
      })) : clog.error("rightClick(), 必须提供有效的 targetSelector。");
    }
    q(e2, t2, n2, a2) {
      let o2;
      if (this.isMobileMode()) {
        o2 = layer.confirm(t2, {
          title: "提示",
          btn: ["确定", "取消"],
          shade: 0,
          zIndex: JHS_Z_INDEX.layer
        }, (function() {
          n2 && n2(), layer.close(o2);
        }), (function() {
          a2 && a2();
        }));
      } else {
        let i2, s2;
        e2 ? (i2 = e2.clientX - 130, s2 = e2.clientY - 120) : (i2 = window.innerWidth / 2 - 120, s2 = window.innerHeight / 2 - 120);
        o2 = layer.confirm(t2, {
          offset: [s2, i2],
          title: "提示",
          btn: ["确定", "取消"],
          shade: 0,
          zIndex: JHS_Z_INDEX.layer
        }, (function() {
          n2 && n2(), layer.close(o2);
        }), (function() {
          a2 && a2();
        }));
      }
    }
    getNowStr(e2 = "-", t2 = ":", n2 = null) {
      let a2;
      a2 = n2 ? new Date(n2) : /* @__PURE__ */ new Date();
      const i2 = a2.getFullYear(), s2 = String(a2.getMonth() + 1).padStart(2, "0"), o2 = String(a2.getDate()).padStart(2, "0"), r2 = String(a2.getHours()).padStart(2, "0"), l2 = String(a2.getMinutes()).padStart(2, "0"), c2 = String(a2.getSeconds()).padStart(2, "0");
      return `${[i2, s2, o2].join(e2)} ${[r2, l2, c2].join(t2)}`;
    }
    formatDate(e2, t2 = "-", n2 = ":") {
      let a2;
      if (e2 instanceof Date) a2 = e2;
      else {
        if ("string" != typeof e2) throw new Error("Invalid date input: must be Date object or date string");
        if (a2 = new Date(e2), isNaN(a2.getTime())) throw new Error("Invalid date string");
      }
      const i2 = a2.getFullYear(), s2 = String(a2.getMonth() + 1).padStart(2, "0"), o2 = String(a2.getDate()).padStart(2, "0"), r2 = String(a2.getHours()).padStart(2, "0"), l2 = String(a2.getMinutes()).padStart(2, "0"), c2 = String(a2.getSeconds()).padStart(2, "0");
      return `${[i2, s2, o2].join(t2)} ${[r2, l2, c2].join(n2)}`;
    }
    getHourDifference(e2, t2) {
      const n2 = e2.getTime(), a2 = t2.getTime(), i2 = Math.abs(a2 - n2) / 36e5;
      return Math.floor(i2);
    }
    download(e2, t2) {
      show.info("开始请求下载...");
      const n2 = t2.split(".").pop().toLowerCase();
      let a2, i2 = this.mimeTypes[n2] || "application/octet-stream";
      if (e2 instanceof Blob) a2 = e2;
      else if (e2 instanceof ArrayBuffer || ArrayBuffer.isView(e2)) a2 = new Blob([e2], {
        type: i2
      });
      else if ("string" == typeof e2 && e2.startsWith("data:")) {
        const t3 = atob(e2.split(",")[1]), n3 = new ArrayBuffer(t3.length), s3 = new Uint8Array(n3);
        for (let e3 = 0; e3 < t3.length; e3++) s3[e3] = t3.charCodeAt(e3);
        a2 = new Blob([s3], {
          type: i2
        });
      } else a2 = new Blob([e2], {
        type: i2
      });
      const s2 = URL.createObjectURL(a2), o2 = document.createElement("a");
      o2.href = s2, o2.download = t2, document.body.appendChild(o2), o2.click(), setTimeout((() => {
        document.body.removeChild(o2), URL.revokeObjectURL(s2);
      }), 100);
    }
    smoothScrollToTop(e2 = 500) {
      return new Promise(((t2) => {
        const n2 = performance.now(), a2 = window.pageYOffset;
        window.requestAnimationFrame(/* @__PURE__ */ __name((function i2(s2) {
          const o2 = s2 - n2, r2 = Math.min(o2 / e2, 1), l2 = r2 < 0.5 ? 4 * r2 * r2 * r2 : 1 - Math.pow(-2 * r2 + 2, 3) / 2;
          window.scrollTo(0, a2 * (1 - l2)), r2 < 1 ? window.requestAnimationFrame(i2) : t2();
        }), "i"));
      }));
    }
    isUrl(e2) {
      try {
        return new URL(e2), true;
      } catch (t2) {
        return false;
      }
    }
    setHrefParam(e2, t2) {
      const n2 = new URL(window.location.href);
      n2.searchParams.set(e2, t2), window.history.pushState({}, "", n2.toString());
    }
    getUrlParam(e2, t2) {
      const n2 = e2.split("?")[1];
      if (!n2) return null;
      const a2 = new RegExp(`(?:^|&)${t2}=([^&]*)`), i2 = n2.match(a2);
      let s2 = "";
      return i2 && i2[1] && (s2 = decodeURIComponent(i2[1].replace(/\+/g, " "))), s2 ? "true" === s2 || "false" === s2 ? "true" === s2.toLowerCase() : "string" != typeof s2 || "" === s2.trim() || isNaN(Number(s2)) ? s2 : Number(s2) : s2;
    }
    getResponsiveArea(e2) {
      const t2 = window.innerWidth;
      return this.isMobileMode() ? ["100%", "90%"] : t2 >= 1200 ? e2 || this.getDefaultArea() : ["70%", "90%"];
    }
    /** 按用途返回具有固定上限和安全边距的弹窗尺寸。 */
    getDialogArea(e2 = "md") {
      const t2 = {
        sm: [480, 640],
        md: [720, 700],
        lg: [1040, 760],
        xl: [1320, 860],
        workspace: [1440, 960]
      }, n2 = t2[e2] || t2.md, a2 = window.innerWidth <= 768 ? 16 : "workspace" === e2 ? 32 : 64, i2 = Math.max(320, Math.min(n2[0], window.innerWidth - a2)), s2 = Math.max(320, Math.min(n2[1], window.innerHeight - a2));
      return [`${i2}px`, `${s2}px`];
    }
    getDefaultArea() {
      return ["85%", "90%"];
    }
    isMobile() {
      const e2 = navigator.userAgent.toLowerCase();
      return ["iphone", "ipod", "ipad", "android", "blackberry", "windows phone", "nokia", "webos", "opera mini", "mobile", "mobi", "tablet"].some(((t2) => e2.includes(t2)));
    }
    isMobileMode() {
      const e2 = storageManager.getSettingSync("mobileMode", "auto");
      return "on" === e2 || "off" !== e2 && (this.isMobile() || window.innerWidth < 768);
    }
    async copyToClipboard(e2, t2) {
      const text = String(t2 ?? "");
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text), copied = true;
        else throw new Error("Clipboard API unavailable");
      } catch (clipboardError) {
        const textarea = document.createElement("textarea"), activeElement = document.activeElement;
        textarea.value = text, textarea.setAttribute("readonly", ""), textarea.style.position = "fixed", textarea.style.opacity = "0", document.body.appendChild(textarea), textarea.select();
        try {
          copied = true === document.execCommand("copy");
          if (!copied) throw clipboardError;
        } catch (fallbackError) {
          clog.error("复制失败:", fallbackError), show.error("复制失败，请手动复制");
        } finally {
          textarea.remove(), activeElement?.focus?.();
        }
      }
      return copied && show.info(`${e2}已复制到剪贴板, ${text}`), copied;
    }
    htmlTo$dom(e2) {
      const t2 = new DOMParser();
      return $(t2.parseFromString(e2, "text/html"));
    }
    isHidden(e2) {
      const t2 = e2.jquery ? e2[0] : e2;
      return !t2 || (t2.offsetWidth <= 0 && t2.offsetHeight <= 0 || "none" === window.getComputedStyle(t2).display);
    }
    time(e2 = "default", t2 = "s", n2 = 2) {
      if (this.timers.has(e2)) {
        const t3 = this.timers.get(e2), n3 = performance.now() - t3.startTime;
        let a2, i2;
        return "s" === t3.unit ? (a2 = (n3 / 1e3).toFixed(t3.precision), i2 = "秒") : (a2 = n3.toFixed(t3.precision), i2 = "毫秒"), this.timers.delete(e2), `${e2}: ${a2}${i2}`;
      }
      this.timers.set(e2, {
        startTime: performance.now(),
        unit: t2,
        precision: n2
      });
    }
    sleep(e2 = 1e3) {
      return new Promise(((t2) => setTimeout(t2, e2)));
    }
    genericSort(e2, t2, n2 = true) {
      if (!Array.isArray(e2) || 0 === e2.length) return [];
      if (!Array.isArray(t2) || 0 === t2.length) return [...e2];
      const i2 = /* @__PURE__ */ __name((e3) => {
        if (e3 instanceof Date) return e3;
        if ("string" == typeof e3) {
          const t3 = new Date(e3);
          if (!isNaN(t3.getTime())) return t3;
        }
        return e3;
      }, "i");
      const getVal = /* @__PURE__ */ __name((e3, t3) => null != t3 ? "function" == typeof t3 ? t3(e3) : e3 && "object" == typeof e3 ? e3[t3] : void 0 : e3, "getVal");
      const nulls = [], nonNulls = [];
      for (const item of e2) {
        let hasNull = false;
        for (const s2 of t2) {
          const val = getVal(item, s2.key);
          if (null == val || void 0 === val) {
            hasNull = true;
            break;
          }
        }
        hasNull ? nulls.push(item) : nonNulls.push(item);
      }
      return nonNulls.sort(((e3, a2) => {
        for (const s2 of t2) {
          const { key: t3, order: o2 = "asc" } = s2;
          let r2 = getVal(e3, t3), l2 = getVal(a2, t3);
          const c2 = i2(r2), d2 = i2(l2);
          let h2 = c2 instanceof Date && d2 instanceof Date ? c2.getTime() - d2.getTime() : "number" == typeof r2 && "number" == typeof l2 ? r2 - l2 : "string" == typeof r2 && "string" == typeof l2 ? r2.localeCompare(l2) : String(r2).localeCompare(String(l2));
          "desc" === o2 && (h2 *= -1);
          if (0 !== h2) return h2;
        }
        return 0;
      })), n2 ? [...nonNulls, ...nulls] : [...nulls, ...nonNulls];
    }
    async retry(e2, t2 = 3) {
      let n2 = 0;
      for (; n2 < t2; ) try {
        const t3 = await e2();
        return n2 > 0 && clog.debug(`[重试] 请求成功，共发起 ${n2 + 1} 次。`), t3;
      } catch (a2) {
        const e3 = a2 instanceof Error ? a2.message : "object" == typeof a2 ? JSON.stringify(a2) : String(a2);
        if (a2?._cfBlocked || a2?._circuitBroken || e3.includes("Just a moment") || e3.includes("重定向") || e3.toLowerCase().includes("404 not found")) throw a2;
        if (n2++, n2 === t2) throw clog.debug(`[重试] 达到最大重试次数 (${t2})，最终失败：`, a2), a2;
        await this.sleep(500 * n2), clog.debug(`[重试] 请求失败，准备第 ${n2 + 1} 次重试, 错误信息: ${e3}`);
      }
    }
  };
  __name(_Utils, "Utils");
  var Utils = _Utils;
  unsafeWindow.utils = window.utils = new Utils(), unsafeWindow.gmHttp = window.gmHttp = new class {
    constructor() {
      this._circuitBreakers = /* @__PURE__ */ new Map();
      this._domainStats = /* @__PURE__ */ new Map();
    }
    _getDomain(e2) {
      try {
        return new URL(e2).hostname;
      } catch {
        return "unknown";
      }
    }
    _isCloudflareChallenge(e2, status = 0) {
      if ("string" != typeof e2 || !e2) return false;
      const text = e2.toLowerCase();
      const hasChallengeTitle = /<title[^>]*>\s*just a moment(?:\.\.\.)?\s*<\/title>/i.test(e2);
      const hasChallengeForm = /id=["']challenge-form["']/i.test(e2);
      const hasCfChl = text.includes("cf-chl-") || text.includes("cf_chl_opt");
      const hasChallengePlatform = text.includes("/cdn-cgi/challenge-platform/") || text.includes("challenge-platform");
      const blockedStatus = 403 === status || 429 === status || 503 === status;
      return hasChallengeTitle || hasChallengeForm && (hasCfChl || hasChallengePlatform) || blockedStatus && hasCfChl && hasChallengePlatform;
    }
    _checkCircuitBreaker(e2) {
      const t2 = this._circuitBreakers.get(e2);
      if (!t2) return null;
      if ("open" === t2.state) {
        const n2 = Date.now() - t2.openTime;
        return n2 < t2.cooldownMs ? { state: "open", remaining: Math.ceil((t2.cooldownMs - n2) / 1e3) } : (t2.state = "half-open", t2.failCount = 0, t2.probing = false, null);
      }
      if ("half-open" === t2.state && t2.probing) return { state: "half-open", remaining: 0 };
      return null;
    }
    isDomainCircuitBroken(e2) {
      return this._checkCircuitBreaker(this._getDomain(e2));
    }
    /* domainStats.count 统计请求数（含重试），非独立请求数 */
    _recordSuccess(e2) {
      let t2 = this._circuitBreakers.get(e2);
      t2 && (t2.state = "closed", t2.failCount = 0, t2.probing = false);
      let n2 = this._domainStats.get(e2);
      n2 || (n2 = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e2, n2)), n2.count++, n2.lastUsed = Date.now();
    }
    _recordFailure(e2) {
      let t2 = this._circuitBreakers.get(e2);
      t2 || (t2 = { state: "closed", failCount: 0, openTime: 0, cooldownMs: 6e4, threshold: 3 }, this._circuitBreakers.set(e2, t2)), t2.failCount++, ("half-open" === t2.state || t2.failCount >= (t2.threshold || 3)) && (t2.state = "open", t2.openTime = Date.now(), t2.probing = false, clog.warn(`[熔断] ${e2} 连续失败 ${t2.failCount} 次，已熔断 ${t2.cooldownMs / 1e3} 秒`));
      let n2 = this._domainStats.get(e2);
      n2 || (n2 = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e2, n2)), n2.count++, n2.errors++, n2.lastUsed = Date.now();
    }
    getCircuitBreakerStatus() {
      const e2 = {};
      return this._circuitBreakers.forEach(((t2, n2) => {
        e2[n2] = { ...t2 };
      })), e2;
    }
    resetCircuitBreaker(e2) {
      this._circuitBreakers.delete(e2);
    }
    resetAllCircuitBreakers() {
      this._circuitBreakers.clear();
    }
    getDomainStats() {
      const e2 = {};
      return this._domainStats.forEach(((t2, n2) => {
        e2[n2] = { ...t2 };
      })), e2;
    }
    clearDomainStats() {
      this._domainStats.clear();
    }
    async get(e2, t2 = {}, n2 = {}, a2, i2 = {}) {
      return this.gmRequest("GET", e2, null, t2, n2, a2, i2);
    }
    post(e2, t2 = {}, n2 = {}) {
      n2 = {
        "Content-Type": "application/json",
        ...n2
      };
      let a2 = JSON.stringify(t2);
      return this.gmRequest("POST", e2, a2, null, n2);
    }
    async gmRequest(e2, t2, n2 = {}, a2 = {}, i2 = {}, s2 = false, requestOptions = {}) {
      if (a2 && Object.keys(a2).length) {
        const e3 = new URLSearchParams(a2).toString();
        t2 += (t2.includes("?") ? "&" : "?") + e3;
      }
      const o2 = this._getDomain(t2), [m2, r2, b2, k2] = await Promise.all([storageManager.getSetting("httpTimeout", 5e3), storageManager.getSetting("httpRetryCount", 3), storageManager.getSetting("circuitBreakerThreshold", 3), storageManager.getSetting("circuitBreakerCooldown", 6e4)]);
      let u2 = this._circuitBreakers.get(o2);
      u2 || (u2 = { state: "closed", failCount: 0, openTime: 0, cooldownMs: k2, threshold: b2, probing: false }, this._circuitBreakers.set(o2, u2));
      const w = this._checkCircuitBreaker(o2);
      if (w) {
        const e3 = new Error(`站点 ${o2} 已熔断，${w.remaining}秒后重试`);
        throw e3._circuitBroken = true, e3;
      }
      return n2 || (n2 = void 0), await utils.retry(() => {
        const c2 = this._checkCircuitBreaker(o2);
        if (c2) {
          const t3 = new Error(`站点 ${o2} 已熔断，${c2.remaining}秒后重试`);
          return t3._circuitBroken = true, Promise.reject(t3);
        }
        "half-open" === u2.state && (u2.probing = true);
        return new Promise(((a3, r3) => {
          GM_xmlhttpRequest({
            method: e2,
            url: t2,
            headers: i2,
            timeout: m2,
            data: n2,
            ...requestOptions.cookiePartitionTopLevelSite ? {
              cookiePartition: { topLevelSite: requestOptions.cookiePartitionTopLevelSite }
            } : {},
            onload: /* @__PURE__ */ __name((e3) => {
              try {
                if (404 === e3.status && requestOptions.ignoreNotFound) return void a3(null);
                if (this._isCloudflareChallenge(e3.responseText, e3.status)) {
                  this._recordFailure(o2);
                  const n3 = new Error(`Cloudflare challenge blocked: ${t2}`);
                  return n3._cfBlocked = true, n3.status = e3.status, n3.requestUrl = t2, n3.finalUrl = e3.finalUrl, n3.cfDiagnostics = { status: e3.status, requestUrl: t2, finalUrl: e3.finalUrl, contentLength: e3.responseText?.length || 0 }, void r3(n3);
                }
                if (s2 && e3.finalUrl !== t2 && r3("请求被重定向了,URL是:" + e3.finalUrl), e3.status >= 200 && e3.status < 300) {
                  this._recordSuccess(o2);
                  if (e3.responseText) try {
                    a3(JSON.parse(e3.responseText));
                  } catch (n3) {
                    a3(e3.responseText);
                  }
                  else a3(e3.responseText || e3);
                } else {
                  clog.error("请求失败,状态码:", e3.status, t2), this._recordFailure(o2);
                  if (e3.responseText) {
                    try {
                      const t3 = JSON.parse(e3.responseText);
                      t3.status = e3.status, r3(t3);
                    } catch {
                      const t3 = new Error(e3.responseText || `请求发生错误 ${e3.status}`);
                      t3.status = e3.status, r3(t3);
                    }
                  } else {
                    const t3 = new Error(`请求发生错误 ${e3.status}`);
                    t3.status = e3.status, r3(t3);
                  }
                }
              } catch (n3) {
                this._recordFailure(o2), r3(n3);
              }
            }, "onload"),
            onerror: /* @__PURE__ */ __name((e3) => {
              clog.error("网络错误:", t2), this._recordFailure(o2), r3(new Error(e3.error || "网络错误"));
            }, "onerror"),
            ontimeout: /* @__PURE__ */ __name(() => {
              this._recordFailure(o2), r3(new Error("请求超时: " + t2));
            }, "ontimeout")
          });
        }));
      }, r2);
    }
  }(), unsafeWindow.storageManager = window.storageManager = new StorageManager();
  var _JhsEventBus = class _JhsEventBus {
    constructor(channelName = "channel-refresh") {
      this.originId = globalThis.crypto?.randomUUID?.() || `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      this.listeners = /* @__PURE__ */ new Map(), this.seen = /* @__PURE__ */ new Set(), this.channel = new BroadcastChannel(channelName);
      this.channel.addEventListener("message", ((event) => this._receive(event.data)));
    }
    on(type, handler) {
      const handlers = this.listeners.get(type) || /* @__PURE__ */ new Set();
      return handlers.add(handler), this.listeners.set(type, handlers), () => handlers.delete(handler);
    }
    async _dispatch(event) {
      for (const handler of [...this.listeners.get(event.type) || []]) await handler(event.payload, event);
    }
    _remember(eventId) {
      this.seen.add(eventId), this.seen.size > 256 && this.seen.delete(this.seen.values().next().value);
    }
    async emit(type, payload = {}, options = {}) {
      const event = { eventId: globalThis.crypto?.randomUUID?.() || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`, originId: this.originId, type, payload, timestamp: Date.now() };
      this._remember(event.eventId), await this._dispatch(event), false !== options.broadcast && this.channel.postMessage(event);
      return event;
    }
    async _receive(event) {
      if (!event || event.originId === this.originId || event.eventId && this.seen.has(event.eventId)) return;
      if (!event.eventId) {
        const legacyType = "refresh" === event.type ? "legacy-refresh" : event.type;
        return this._dispatch({ ...event, type: legacyType, payload: event.payload || {}, eventId: `legacy_${Date.now()}_${Math.random()}`, originId: "legacy", timestamp: Date.now() });
      }
      this._remember(event.eventId), await this._dispatch(event);
    }
  };
  __name(_JhsEventBus, "JhsEventBus");
  var JhsEventBus = _JhsEventBus;
  var jhsEventBus = unsafeWindow.jhsEventBus = window.jhsEventBus = new JhsEventBus();
  var G = jhsEventBus.channel;
  window.refresh = () => jhsEventBus.emit("legacy-refresh");
  window.cleanCache_filter_actor_actress_car_list = () => jhsEventBus.emit("blacklist-rules-changed");
  window.clean_cacheSettingObj = () => jhsEventBus.emit("settings-changed");
  var ACTIVITY_SOFT_LIMIT = 1e3;
  var ACTIVITY_HARD_LIMIT = 1e4;
  var ACTIVITY_RETENTION_MS = 30 * 864e5;
  function cloneStateValue(value) {
    return null == value ? value : JSON.parse(JSON.stringify(value));
  }
  __name(cloneStateValue, "cloneStateValue");
  function stableStateValue(value) {
    if (null === value || "object" != typeof value) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStateValue).join(",")}]`;
    return `{${Object.keys(value).sort().map(((key) => `${JSON.stringify(key)}:${stableStateValue(value[key])}`)).join(",")}}`;
  }
  __name(stableStateValue, "stableStateValue");
  function getStatePath(value, path) {
    return path.split(".").reduce(((current, key) => current?.[key]), value);
  }
  __name(getStatePath, "getStatePath");
  function setStatePath(value, path, next) {
    const keys = path.split("."), last = keys.pop(), target = keys.reduce(((current, key) => current[key] || (current[key] = {})), value);
    void 0 === next ? delete target[last] : target[last] = cloneStateValue(next);
  }
  __name(setStatePath, "setStatePath");
  function captureNewVideoEffect(actresses, decisions, carNum) {
    const key = normalizeCarNum(carNum), actressItems = [];
    actresses.forEach(((actress, actressIndex) => (actress.newVideoList || []).forEach(((item, itemIndex) => {
      normalizeCarNum("string" == typeof item ? item : item.carNum) === key && actressItems.push({ actressIndex, itemIndex, item: cloneStateValue(item) });
    }))));
    return { actressItems, decision: cloneStateValue(decisions[key] || null) };
  }
  __name(captureNewVideoEffect, "captureNewVideoEffect");
  function canRestoreNewVideoEffect(actresses, decisions, carNum, effect) {
    const key = normalizeCarNum(carNum);
    if (stableStateValue(decisions[key] || null) !== stableStateValue(null)) return false;
    return effect.actressItems.every(((entry) => !(actresses[entry.actressIndex]?.newVideoList || []).some(((item) => normalizeCarNum("string" == typeof item ? item : item.carNum) === key))));
  }
  __name(canRestoreNewVideoEffect, "canRestoreNewVideoEffect");
  function restoreNewVideoEffect(actresses, decisions, carNum, effect) {
    effect.actressItems.forEach(((entry) => {
      const actress = actresses[entry.actressIndex];
      if (!actress) return;
      const list = [...actress.newVideoList || []], index = Math.min(entry.itemIndex, list.length);
      list.splice(index, 0, cloneStateValue(entry.item)), actress.newVideoList = list;
    }));
    effect.decision ? decisions[normalizeCarNum(carNum)] = cloneStateValue(effect.decision) : delete decisions[normalizeCarNum(carNum)];
  }
  __name(restoreNewVideoEffect, "restoreNewVideoEffect");
  function pruneActivityLog(log, now = Date.now()) {
    const result = { entries: Array.isArray(log?.entries) ? log.entries : [], trackingStartedAt: log?.trackingStartedAt || new Date(now).toISOString(), coverageStart: log?.coverageStart || null, truncatedAt: log?.truncatedAt || null };
    const cutoff = now - ACTIVITY_RETENTION_MS, recent = [], older = [];
    result.entries.forEach(((entry) => (Date.parse(entry.createdAt) >= cutoff || "pending" === entry.commitState ? recent : older).push(entry)));
    older.sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))), recent.sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))));
    const olderAllowance = Math.max(0, ACTIVITY_SOFT_LIMIT - recent.length);
    result.entries = [...older.slice(-olderAllowance), ...recent].sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))));
    if (result.entries.length > ACTIVITY_HARD_LIMIT) {
      const pending = result.entries.filter(((entry) => "pending" === entry.commitState)), committed = result.entries.filter(((entry) => "pending" !== entry.commitState));
      const committedAllowance = Math.max(0, ACTIVITY_HARD_LIMIT - pending.length);
      result.entries = [...committedAllowance ? committed.slice(-committedAllowance) : [], ...pending].sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))));
      result.truncatedAt = new Date(now).toISOString(), result.coverageStart = result.entries[0]?.createdAt || result.truncatedAt;
    }
    return result;
  }
  __name(pruneActivityLog, "pruneActivityLog");
  var _StateService = class _StateService {
    constructor(storage, eventBus) {
      this.storage = storage, this.eventBus = eventBus, this._queue = Promise.resolve(), this._recovering = false;
    }
    _withLock(callback) {
      if (globalThis.navigator?.locks?.request) return navigator.locks.request("jhs_state_mutation", callback);
      const run = this._queue.then(callback, callback);
      return this._queue = run.catch((() => {
      })), run;
    }
    async getActivityLog() {
      return pruneActivityLog(await this.storage.forage.getItem("activity_log"));
    }
    async getOfflineHistory() {
      return await this.storage.forage.getItem("offline_history") || [];
    }
    async appendOfflineHistory(record) {
      const history = await this.getOfflineHistory(), item = { id: record.id || globalThis.crypto?.randomUUID?.() || `offline_${Date.now()}`, createdAt: record.createdAt || (/* @__PURE__ */ new Date()).toISOString(), ...record, carNum: normalizeCarNum(record.carNum) };
      history.push(item), history.length > 1e3 && history.splice(0, history.length - 1e3), await this.storage.forage.setItem("offline_history", history), await this.eventBus.emit("offline-history-changed", { ids: [item.id] });
      return item;
    }
    async removeOfflineHistory(ids) {
      const keys = new Set(Array.isArray(ids) ? ids : [ids]), history = await this.getOfflineHistory(), next = history.filter(((item) => !keys.has(item.id)));
      if (next.length === history.length) return false;
      return await this.storage.forage.setItem("offline_history", next), await this.eventBus.emit("offline-history-changed", { ids: [...keys], removed: true }), true;
    }
    async getNewVideoDecisions() {
      return await this.storage.forage.getItem("new_video_decisions") || {};
    }
    async _readDomains() {
      const [carList, actresses, decisions, activity] = await Promise.all([this.storage.forage.getItem(this.storage.car_list_key), this.storage.forage.getItem(this.storage.favorite_actresses_key), this.storage.forage.getItem("new_video_decisions"), this.storage.forage.getItem("activity_log")]);
      return { carList: carList || [], actresses: actresses || [], decisions: decisions || {}, activity: pruneActivityLog(activity) };
    }
    _removeHandledNewVideos(actresses, decisions, carNums) {
      const keys = new Set(carNums.map(normalizeCarNum).filter(Boolean)), nextDecisions = { ...decisions };
      keys.forEach(((key) => delete nextDecisions[key]));
      const nextActresses = actresses.map(((actress) => {
        if (!Array.isArray(actress.newVideoList)) return actress;
        const newVideoList = actress.newVideoList.filter(((item) => !keys.has(normalizeCarNum("string" == typeof item ? item : item.carNum))));
        if (newVideoList.length === actress.newVideoList.length) return actress;
        const next = { ...actress, newVideoList };
        return 0 === newVideoList.length && next.lastPublishTime && (next.lastPublishTime = null), next;
      }));
      return { actresses: nextActresses, decisions: nextDecisions };
    }
    async _writeActivity(log) {
      await this.storage.forage.setItem("activity_log", pruneActivityLog(log));
    }
    async _commit(domains, next, activity) {
      const pendingActivity = cloneStateValue(activity), pendingLog = { ...domains.activity, entries: [...domains.activity.entries, pendingActivity] };
      const journal = { id: activity.id, state: "prepared", createdAt: activity.createdAt, before: cloneStateValue(domains), after: cloneStateValue({ ...next, activity: pendingLog }) };
      await this.storage.forage.setItem("mutation_journal", journal);
      try {
        await this.storage._setItemAndInvalidate(this.storage.car_list_key, next.carList), await this._writeActivity(pendingLog), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, next.actresses), await this.storage.forage.setItem("new_video_decisions", next.decisions);
        activity.commitState = "committed", pendingLog.entries = pendingLog.entries.map(((entry) => entry.id === activity.id ? activity : entry)), await this._writeActivity(pendingLog);
        await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
      } catch (error) {
        await this._recoverJournal(journal);
        throw error;
      }
    }
    async _recoverJournal(journal) {
      const log = await this.getActivityLog(), activity = log.entries.find(((entry) => entry.id === journal.id));
      if ("committed" === activity?.commitState) {
        await this.storage._setItemAndInvalidate(this.storage.car_list_key, journal.after.carList), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, journal.after.actresses), await this.storage.forage.setItem("new_video_decisions", journal.after.decisions);
      } else {
        const current = await this._readDomains(), keys = ["carList", "actresses", "decisions"];
        const conflict = keys.some(((key) => {
          const value = stableStateValue(current[key]);
          return value !== stableStateValue(journal.before[key]) && value !== stableStateValue(journal.after[key]);
        }));
        if (conflict) throw new Error("检测到未完成状态事务且数据已发生冲突，请先运行数据健康检查");
        await this.storage._setItemAndInvalidate(this.storage.car_list_key, journal.before.carList), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, journal.before.actresses), await this.storage.forage.setItem("new_video_decisions", journal.before.decisions);
        journal.before.activity ? await this._writeActivity(journal.before.activity) : (log.entries = log.entries.filter(((entry) => entry.id !== journal.id)), await this._writeActivity(log));
      }
      await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
    }
    async _recoverWithoutLock() {
      const journal = await this.storage.forage.getItem("mutation_journal");
      return journal ? (await this._recoverJournal(journal), true) : false;
    }
    async recoverPendingTransaction() {
      return this._withLock((() => this._recoverWithoutLock()));
    }
    async patch(carNums, patch, options = {}) {
      const keys = [...new Set((Array.isArray(carNums) ? carNums : [carNums]).map(normalizeCarNum).filter(Boolean))];
      if (!keys.length) throw new Error("番号为空");
      const invalidFlag = Object.keys(patch).find(((key) => !STATE_FLAG_NAMES.includes(key) || "boolean" != typeof patch[key]));
      if (invalidFlag) throw new TypeError(`无效状态字段: ${invalidFlag}`);
      return this._withLock((() => this._patchWithoutLock(keys, patch, options)));
    }
    async _patchWithoutLock(keys, patch, options) {
      await this._recoverWithoutLock();
      const domains = await this._readDomains(), map = new Map(domains.carList.map(((record) => [normalizeCarNum(record.carNum), record]))), changes = [], handled = [];
      const records = Array.isArray(options.records) ? new Map(options.records.map(((record) => [normalizeCarNum(record.carNum), record]))) : /* @__PURE__ */ new Map();
      keys.forEach(((carNum) => {
        const existing = map.get(carNum), metadata = records.get(carNum) || options.record || {}, now = utils.getNowStr(), before = existing ? cloneStateValue(existing) : null;
        const record = existing ? { ...existing, stateFlags: normalizeStateFlags(existing.stateFlags) } : { carNum, url: metadata.url || window.location.href, names: metadata.names || "", createDate: now, stateFlags: createEmptyStateFlags() };
        const fields = [];
        ["url", "names", "publishTime", "starId", "remark"].forEach(((field) => {
          if (!Object.prototype.hasOwnProperty.call(metadata, field) || null == metadata[field] || !options.replaceMetadata && "" === metadata[field] || record[field] === metadata[field]) return;
          record[field] = metadata[field], fields.push(field);
        }));
        STATE_FLAG_NAMES.forEach(((flag) => Object.prototype.hasOwnProperty.call(patch, flag) && record.stateFlags[flag] !== patch[flag] && (patch[flag] && handled.push(carNum), record.stateFlags[flag] = patch[flag], fields.push(`stateFlags.${flag}`))));
        if (!fields.length && existing) return;
        record.updateDate = now, syncLegacyStatus(record), map.set(carNum, record), changes.push({ carNum, operation: existing ? "patch" : "create", fields, before, after: cloneStateValue(record), undoState: "pending" });
      }));
      if (!changes.length) return { changed: [], transactionId: null };
      changes.forEach(((change) => handled.includes(change.carNum) && (change.newVideoEffect = captureNewVideoEffect(domains.actresses, domains.decisions, change.carNum))));
      const effects = this._removeHandledNewVideos(domains.actresses, domains.decisions, handled), activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: options.type || "state-patch", commitState: "pending", changes, createdAt: (/* @__PURE__ */ new Date()).toISOString(), undoAttemptedAt: null };
      await this._commit(domains, { carList: [...map.values()], ...effects }, activity), await this.eventBus.emit("car-state-changed", { carNums: changes.map(((change) => change.carNum)), transactionId: activity.id }), handled.length && await this.eventBus.emit("new-video-changed", { carNums: [...new Set(handled)], reason: "state-handled" }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
      return { changed: changes.map(((change) => change.carNum)), transactionId: activity.id };
    }
    async toggle(carNum, flag, options = {}) {
      if (!STATE_FLAG_NAMES.includes(flag)) throw new TypeError(`无效状态字段: ${flag}`);
      const key = normalizeCarNum(carNum);
      if (!key) throw new Error("番号为空");
      return this._withLock(async () => {
        await this._recoverWithoutLock();
        const record = await this.storage.getCar(key), flags = normalizeStateFlags(record?.stateFlags);
        return this._patchWithoutLock([key], { [flag]: !flags[flag] }, options);
      });
    }
    async remove(carNums) {
      const keys = new Set((Array.isArray(carNums) ? carNums : [carNums]).map(normalizeCarNum).filter(Boolean));
      return this._withLock(async () => {
        await this._recoverWithoutLock();
        const domains = await this._readDomains(), changes = domains.carList.filter(((record) => keys.has(normalizeCarNum(record.carNum)))).map(((record) => ({ carNum: normalizeCarNum(record.carNum), operation: "delete", fields: ["record"], before: cloneStateValue(record), after: null, undoState: "pending" })));
        if (!changes.length) return { changed: [], transactionId: null };
        const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "record-delete", commitState: "pending", changes, createdAt: (/* @__PURE__ */ new Date()).toISOString(), undoAttemptedAt: null };
        await this._commit(domains, { carList: domains.carList.filter(((record) => !keys.has(normalizeCarNum(record.carNum)))), actresses: domains.actresses, decisions: domains.decisions }, activity), await this.eventBus.emit("car-records-removed", { carNums: changes.map(((change) => change.carNum)), transactionId: activity.id }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
        return { changed: changes.map(((change) => change.carNum)), transactionId: activity.id };
      });
    }
    async setNewVideoDecision(carNums, action, until = null) {
      if (!["ignored", "snoozed", null].includes(action)) throw new TypeError("无效新作决策");
      const keys = [...new Set((Array.isArray(carNums) ? carNums : [carNums]).map(normalizeCarNum).filter(Boolean))];
      return this._withLock(async () => {
        await this._recoverWithoutLock();
        const domains = await this._readDomains(), decisions = { ...domains.decisions }, now = (/* @__PURE__ */ new Date()).toISOString(), changes = [];
        keys.forEach(((carNum) => {
          const before = cloneStateValue(decisions[carNum] || null), after = action ? { action, until: "snoozed" === action ? until : null, createdAt: before?.createdAt || now, updatedAt: now } : null;
          stableStateValue(before) === stableStateValue(after) || (after ? decisions[carNum] = after : delete decisions[carNum], changes.push({ carNum, operation: "new-video-decision", fields: ["decision"], before, after, undoState: "pending" }));
        }));
        if (!changes.length) return { changed: [], transactionId: null };
        const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-decision", commitState: "pending", changes, createdAt: now, undoAttemptedAt: null };
        await this._commit(domains, { carList: domains.carList, actresses: domains.actresses, decisions }, activity), await this.eventBus.emit("new-video-changed", { carNums: keys, reason: action || "decision-restored" }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
        return { changed: keys, transactionId: activity.id };
      });
    }
    async removeFromNewVideoList(carNums, reason = "manual") {
      const keys = [...new Set((Array.isArray(carNums) ? carNums : [carNums]).map(normalizeCarNum).filter(Boolean))];
      return this._withLock(async () => {
        await this._recoverWithoutLock();
        const domains = await this._readDomains(), effects = this._removeHandledNewVideos(domains.actresses, domains.decisions, keys), changed = stableStateValue(effects.actresses) !== stableStateValue(domains.actresses) || stableStateValue(effects.decisions) !== stableStateValue(domains.decisions);
        if (!changed) return { changed: [], transactionId: null };
        const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-remove", commitState: "pending", changes: keys.map(((carNum) => ({ carNum, operation: "new-video-remove", fields: ["newVideoList", "decision"], before: null, after: { removed: true, reason }, newVideoEffect: captureNewVideoEffect(domains.actresses, domains.decisions, carNum), undoState: "pending" }))), createdAt: (/* @__PURE__ */ new Date()).toISOString(), undoAttemptedAt: null };
        await this._commit(domains, { carList: domains.carList, ...effects }, activity), await this.eventBus.emit("new-video-changed", { carNums: keys, reason }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
        return { changed: keys, transactionId: activity.id };
      });
    }
    async undoTransaction(transactionId) {
      return this._withLock(async () => {
        await this._recoverWithoutLock();
        const domains = await this._readDomains(), transaction = domains.activity.entries.find(((entry) => entry.id === transactionId && "committed" === entry.commitState));
        if (!transaction) throw new Error("操作记录不存在或尚未提交");
        const carMap = new Map(domains.carList.map(((record) => [normalizeCarNum(record.carNum), cloneStateValue(record)]))), decisions = { ...domains.decisions }, actresses = cloneStateValue(domains.actresses), reverted = [], conflicts = [];
        for (const change of transaction.changes) {
          if ("reverted" === change.undoState) continue;
          const current = carMap.get(change.carNum);
          if (change.newVideoEffect && !canRestoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect)) {
            change.undoState = "conflict", conflicts.push(change.carNum);
            continue;
          }
          if ("delete" === change.operation) {
            current ? (change.undoState = "conflict", conflicts.push(change.carNum)) : (carMap.set(change.carNum, cloneStateValue(change.before)), change.undoState = "reverted", reverted.push(change.carNum));
            continue;
          }
          if ("new-video-decision" === change.operation) {
            const currentDecision = decisions[change.carNum] || null;
            stableStateValue(currentDecision) !== stableStateValue(change.after) ? (change.undoState = "conflict", conflicts.push(change.carNum)) : (change.before ? decisions[change.carNum] = cloneStateValue(change.before) : delete decisions[change.carNum], change.undoState = "reverted", reverted.push(change.carNum));
            continue;
          }
          if ("new-video-remove" === change.operation) {
            restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect), change.undoState = "reverted", reverted.push(change.carNum);
            continue;
          }
          if (!["patch", "create"].includes(change.operation) || !current || change.fields.some(((field) => stableStateValue(getStatePath(current, field)) !== stableStateValue(getStatePath(change.after, field))))) {
            change.undoState = "conflict", conflicts.push(change.carNum);
            continue;
          }
          if ("create" === change.operation && !change.before) carMap.delete(change.carNum);
          else change.fields.forEach(((field) => setStatePath(current, field, getStatePath(change.before, field)))), syncLegacyStatus(current), carMap.set(change.carNum, current);
          change.newVideoEffect && restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect), change.undoState = "reverted", reverted.push(change.carNum);
        }
        transaction.undoAttemptedAt = (/* @__PURE__ */ new Date()).toISOString();
        const log = pruneActivityLog(domains.activity), nextCars = [...carMap.values()], journal = { id: `undo_${transactionId}`, state: "prepared", createdAt: transaction.undoAttemptedAt, before: cloneStateValue(domains), after: cloneStateValue({ carList: nextCars, actresses, decisions, activity: log }) };
        await this.storage.forage.setItem("mutation_journal", journal), await this.storage._setItemAndInvalidate(this.storage.car_list_key, nextCars), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, actresses), await this.storage.forage.setItem("new_video_decisions", decisions), await this._writeActivity(log), await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
        reverted.length && await this.eventBus.emit("car-state-changed", { carNums: reverted, undoOf: transactionId }), await this.eventBus.emit("activity-log-changed", { transactionId, undo: true });
        return { reverted, conflicts };
      });
    }
  };
  __name(_StateService, "StateService");
  var StateService = _StateService;
  var stateService = unsafeWindow.stateService = window.stateService = new StateService(storageManager, jhsEventBus);
  var DETAIL_STATE_BUTTONS = {
    blocked: { selector: "#filterBtn", inactive: /* @__PURE__ */ __name(() => m, "inactive"), active: /* @__PURE__ */ __name(() => u, "active") },
    favorite: { selector: "#favoriteBtn", inactive: /* @__PURE__ */ __name(() => v, "inactive"), active: /* @__PURE__ */ __name(() => b, "active") },
    downloaded: { selector: "#hasDownBtn", inactive: /* @__PURE__ */ __name(() => y, "inactive"), active: /* @__PURE__ */ __name(() => "已标记下载", "active") },
    watched: { selector: "#hasWatchBtn", inactive: /* @__PURE__ */ __name(() => k, "inactive"), active: /* @__PURE__ */ __name(() => "已标记观看", "active") }
  };
  var _DetailStateController = class _DetailStateController {
    bind({ root = document, layerIndex = null, carNum, getRecord, activityType = "detail-state", selectors = {} }) {
      const config = { root, layerIndex, carNum: normalizeCarNum(carNum), getRecord, activityType, selectors };
      for (const [flag, definition] of Object.entries(DETAIL_STATE_BUTTONS)) {
        const selector = selectors[flag] || definition.selector;
        $(root).find(selector).off("click.jhsDetailState").on("click.jhsDetailState", ((event) => {
          event.preventDefault(), event.stopPropagation(), void this.requestToggle(config, flag, event);
        }));
      }
      void this.render(config);
      return config;
    }
    async requestToggle(config, flag, event = null) {
      if (!config.carNum) return void show.error("番号不可用，无法更新状态");
      const current = await storageManager.getCar(config.carNum), flags = normalizeStateFlags(current?.stateFlags);
      if ("blocked" === flag && !flags.blocked) return void utils.q(event, `是否屏蔽${config.carNum}?`, (() => this.toggle(config, flag, event)));
      return this.toggle(config, flag, event);
    }
    async toggle(config, flag, event = null) {
      const selector = config.selectors[flag] || DETAIL_STATE_BUTTONS[flag].selector, button = event?.currentTarget ? $(event.currentTarget) : $(config.root).find(selector);
      if (button.prop("disabled")) return;
      button.prop("disabled", true).attr("aria-busy", "true");
      try {
        const record = "function" == typeof config.getRecord ? await config.getRecord() : config.getRecord || { carNum: config.carNum };
        await stateService.toggle(config.carNum, flag, { type: config.activityType, record }), await this.render(config), await utils.closePage({ layerIndex: config.layerIndex, root: config.root });
      } catch (error) {
        clog.error("详情状态更新失败", error), show.error("操作失败");
      } finally {
        button[0]?.isConnected && button.prop("disabled", false).removeAttr("aria-busy");
      }
    }
    async render({ root = document, carNum, selectors = {} }) {
      const record = await storageManager.getCar(normalizeCarNum(carNum)), flags = normalizeStateFlags(record?.stateFlags);
      for (const [flag, definition] of Object.entries(DETAIL_STATE_BUTTONS)) {
        const button = $(root).find(selectors[flag] || definition.selector), active = !!flags[flag];
        button.attr("aria-pressed", String(active)).find("span").first().text(active ? definition.active() : definition.inactive());
      }
      return flags;
    }
  };
  __name(_DetailStateController, "DetailStateController");
  var DetailStateController = _DetailStateController;
  var detailStateController = new DetailStateController();
  document.head.insertAdjacentHTML("beforeend", '\n        <style>\n            .loading-container {\n                position: fixed;\n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                display: flex;\n                justify-content: center;\n                align-items: center;\n                background-color: rgba(0, 0, 0, 0.1);\n                z-index: var(--jhs-z-loading);\n            }\n    \n            .loading-animation {\n                position: relative;\n                width: 60px;\n                height: 12px;\n                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);\n                border-radius: 6px;\n                animation: loading-animate 1.8s ease-in-out infinite;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before,\n            .loading-animation:after {\n                position: absolute;\n                display: block;\n                content: "";\n                animation: loading-animate 1.8s ease-in-out infinite;\n                height: 12px;\n                border-radius: 6px;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before {\n                top: -20px;\n                left: 10px;\n                width: 40px;\n                background: linear-gradient(90deg, #ff758c 0%, #ff7eb3 100%);\n            }\n    \n            .loading-animation:after {\n                bottom: -20px;\n                width: 35px;\n                background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 100%);\n            }\n    \n            @keyframes loading-animate {\n                0% {\n                    transform: translateX(40px);\n                }\n                50% {\n                    transform: translateX(-30px);\n                }\n                100% {\n                    transform: translateX(40px);\n                }\n            }\n        </style>\n    ');
  unsafeWindow.loading = window.loading = function() {
    const e2 = document.createElement("div");
    e2.className = "loading-container";
    const t2 = document.createElement("div");
    return t2.className = "loading-animation", e2.appendChild(t2), document.body.appendChild(e2), {
      close: /* @__PURE__ */ __name(() => {
        e2 && e2.parentNode && e2.parentNode.removeChild(e2);
      }, "close")
    };
  }, (function() {
    const e2 = /* @__PURE__ */ __name((e3, t2, n2, a2, i2) => {
      let s2;
      "object" == typeof n2 ? s2 = n2 : (s2 = "object" == typeof a2 ? a2 : i2 || {}, s2.gravity = n2 || "top", s2.position = "string" == typeof a2 ? a2 : "center"), s2.gravity && "center" !== s2.gravity || (s2.offset = {
        y: "calc(50vh - 150px)"
      });
      const o2 = "var(--jhs-status-fav)", r2 = "var(--jhs-status-fav-tint)", l2 = "var(--jhs-status-down)", c2 = "var(--jhs-status-down-tint)", d2 = "var(--jhs-status-filter)", h2 = "var(--jhs-status-filter-tint)", g2 = {
        borderRadius: "12px",
        padding: "12px 16px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        minWidth: "150px",
        textAlign: "center",
        zIndex: JHS_Z_INDEX.debug
      }, p2 = {
        text: e3,
        duration: 2500,
        close: false,
        gravity: "top",
        position: "center",
        style: {
          info: {
            ...g2,
            background: `${o2}`,
            color: "var(--jhs-status-fav-on)"
          },
          success: {
            ...g2,
            background: `${l2}`,
            color: "var(--jhs-status-down-on)"
          },
          error: {
            ...g2,
            background: `${d2}`,
            color: "var(--jhs-status-filter-on)"
          }
        }[t2],
        stopOnFocus: true,
        oldestFirst: false,
        ...s2
      };
      -1 === p2.duration && (p2.close = true);
      const m2 = Toastify(p2);
      return m2.showToast(), m2.closeShow = () => {
        m2.toastElement.remove();
      }, m2;
    }, "e");
    unsafeWindow.show = window.show = {
      ok: /* @__PURE__ */ __name((t2, n2 = "center", a2, i2) => e2(t2, "success", n2, a2, i2), "ok"),
      error: /* @__PURE__ */ __name((t2, n2 = "center", a2, i2) => e2(t2, "error", n2, a2, i2), "error"),
      info: /* @__PURE__ */ __name((t2, n2 = "center", a2, i2) => e2(t2, "info", n2, a2, i2), "info")
    };
  })(), (function() {
    function e2(e3 = 10) {
      setTimeout((() => {
        const e4 = document.querySelectorAll(".layui-layer-shade").length;
        document.documentElement.style.overflow = e4 > 0 ? "hidden" : "";
      }), e3);
    }
    __name(e2, "e");
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .viewer-canvas {\n                overflow: auto !important;\n            }\n            \n            .viewer-close {\n                background: rgba(222, 51, 51, 0.6) !important; /* 状态红 --jhs-status-filter 半透明弱化 */\n            }\n            .viewer-close:hover {\n                background: rgba(222, 51, 51, 0.8) !important;\n            }\n        </style>\n    "), window.showImageViewer = function(t2, n2 = "") {
      let a2 = null, i2 = false;
      "string" == typeof t2 || t2 instanceof String ? (a2 = $('<div class="temporary-container jhs-layout-c8be1ccb">').append(`<img src="${t2}" alt="${n2}">`).appendTo("body"), i2 = true) : a2 = $(t2);
      const s2 = {
        zIndex: JHS_Z_INDEX.viewer,
        navbar: false,
        zoomOnWheel: false,
        zoomRatio: 0.1,
        toggleOnDblclick: false,
        toolbar: {
          zoomIn: 1,
          zoomOut: 1,
          reset: 1,
          rotateLeft: 0,
          rotateRight: 0,
          flipHorizontal: 0,
          flipVertical: 0
        },
        title: false,
        keyboard: false,
        viewed() {
          o2.zoomTo(1.4);
          let e3 = (o2.viewerData.width - o2.imageData.width) / 2;
          o2.moveTo(e3, 0);
        },
        shown() {
          i2 && a2.remove(), document.documentElement.style.overflow = "hidden", document.body.style.overflow = "hidden", o2.handleKeydown = function(t3) {
            "Escape" !== t3.key && " " !== t3.key || (t3.preventDefault(), t3.stopPropagation(), o2.destroy(), document.removeEventListener("keydown", o2.handleKeydown), document.documentElement.style.overflow = "", document.body.style.overflow = "", e2());
          }, document.addEventListener("keydown", o2.handleKeydown);
        },
        hidden() {
          o2 && o2.handleKeydown && document.removeEventListener("keydown", o2.handleKeydown), o2.destroy(), document.documentElement.style.overflow = "", document.body.style.overflow = "", e2();
        }
      }, o2 = new Viewer(a2[0], s2);
      o2.show();
    };
  })(), window.ImageHoverPreview = class {
    constructor(config = {}) {
      this.config = {
        selector: ".hover-preview",
        dataAttribute: "data-full",
        maxWidth: 1e3,
        maxHeight: 1e3,
        offsetX: 20,
        offsetY: 20,
        zIndex: JHS_Z_INDEX.tooltip,
        transition: 0.2,
        hideDelay: 100,
        loadedUrlLimit: 128,
        autoAdjustPosition: true,
        ...config
      };
      this.config.loadedUrlLimit = Math.max(1, Number(this.config.loadedUrlLimit) || 128);
      this.preview = null;
      this.currentTarget = null;
      this.timer = null;
      this.imgElement = null;
      this.pendingImage = null;
      this.placement = null;
      this.pointer = null;
      this.animationFrame = null;
      this.loadGeneration = 0;
      this.destroyed = false;
      this.currentUrl = null;
      this.pendingUrl = null;
      this.loadedUrls = /* @__PURE__ */ new Map();
      this.eventsBound = false;
      this.onMouseEnter = (event) => this.handleMouseEnter(event);
      this.onMouseLeave = (event) => this.handleMouseLeave(event);
      this.onMouseMove = (event) => this.handleMouseMove(event);
      this.onDocumentOver = (event) => this.handleDocumentOver(event);
      this.onDocumentOut = (event) => this.handleDocumentOut(event);
      this.onDocumentMove = (event) => this.handleDocumentMove(event);
      this.init();
    }
    init() {
      if (utils.isMobileMode()) return;
      this.injectStyles(), this.createPreviewElement(), this.bindEvents();
    }
    injectStyles() {
      if (document.getElementById("jhs-image-hover-preview-style")) return;
      const style = document.createElement("style");
      style.id = "jhs-image-hover-preview-style";
      style.textContent = `
            .image-hover-preview {
                position: fixed;
                display: block;
                visibility: hidden;
                overflow: hidden;
                pointer-events: none;
                opacity: 0;
                border-radius: var(--jhs-radius-xs);
                background-color: var(--jhs-surface);
                box-shadow: var(--jhs-shadow-lg);
                transition: opacity var(--jhs-hover-transition, .2s) ease;
            }
            .image-hover-preview.active { visibility: visible; opacity: 1; }
            .image-hover-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }
            .image-hover-preview::after {
                position: absolute;
                inset: 0;
                pointer-events: none;
                background: rgba(0, 0, 0, .03);
                content: "";
            }
            .image-hover-preview.loading { min-width: 120px; min-height: 72px; }
            .image-hover-preview.loading::before {
                position: absolute;
                top: 50%;
                left: 50%;
                color: var(--jhs-text-muted);
                font-size: var(--jhs-font-size-md);
                content: "加载中...";
                transform: translate(-50%, -50%);
            }
            .image-hover-preview__error { padding: var(--jhs-space-3); color: var(--jhs-danger); }
        `;
      document.head.appendChild(style);
    }
    createPreviewElement() {
      this.preview = document.createElement("div");
      this.preview.className = "image-hover-preview";
      this.preview.style.zIndex = String(this.config.zIndex);
      this.preview.style.setProperty("--jhs-hover-transition", `${this.config.transition}s`);
      document.body.appendChild(this.preview);
    }
    bindEvents() {
      if (this.eventsBound || this.destroyed) return;
      document.addEventListener("mouseover", this.onDocumentOver), document.addEventListener("mouseout", this.onDocumentOut), document.addEventListener("mousemove", this.onDocumentMove), this.eventsBound = true;
    }
    findTarget(event) {
      const target = event.target;
      return target?.closest ? target.closest(this.config.selector) : null;
    }
    handleDocumentOver(event) {
      const target = this.findTarget(event);
      target && (!event.relatedTarget || !target.contains(event.relatedTarget)) && this.handleMouseEnter(event, target);
    }
    handleDocumentOut(event) {
      const target = this.findTarget(event);
      target && (!event.relatedTarget || !target.contains(event.relatedTarget)) && this.handleMouseLeave();
    }
    handleDocumentMove(event) {
      if (!this.currentTarget) return;
      (event.target === this.currentTarget || this.currentTarget.contains(event.target)) && this.handleMouseMove(event);
    }
    handleMouseEnter(event, delegatedTarget = event.currentTarget) {
      if (this.destroyed || !this.preview) return;
      clearTimeout(this.timer);
      this.timer = null;
      this.currentTarget = delegatedTarget;
      this.pointer = {
        x: event.clientX,
        y: event.clientY
      };
      this.placement = null;
      const source = this.currentTarget.getAttribute(this.config.dataAttribute) || this.currentTarget.src;
      if (!source) return;
      if (source === this.currentUrl && this.imgElement) return this.showCurrentPreview();
      if (source === this.pendingUrl) return void this.preview.classList.add("active");
      const cached = this.loadedUrls.get(source);
      if (cached) return this.loadedUrls.delete(source), this.loadedUrls.set(source, cached), void this.commitPreview(source, cached);
      const generation = ++this.loadGeneration;
      this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null);
      this.pendingUrl = source;
      this.currentUrl ? this.showCurrentPreview() : (this.preview.replaceChildren(), this.preview.classList.add("loading", "active"));
      const image = new Image();
      this.pendingImage = image;
      image.onload = () => {
        if (this.destroyed || generation !== this.loadGeneration || !this.preview) return;
        const { width, height } = this.calculateImageSize(image);
        const cachedImage = { width, height };
        this.loadedUrls.set(source, cachedImage);
        for (; this.loadedUrls.size > this.config.loadedUrlLimit; ) this.loadedUrls.delete(this.loadedUrls.keys().next().value);
        this.pendingImage = null, this.pendingUrl = null, this.commitPreview(source, cachedImage);
      };
      image.onerror = () => {
        if (this.destroyed || generation !== this.loadGeneration || !this.preview) return;
        this.pendingImage = null, this.pendingUrl = null;
        if (this.currentUrl) return void this.preview.classList.add("active");
        const error = document.createElement("div");
        error.className = "image-hover-preview__error";
        error.textContent = "图片加载失败";
        this.preview.replaceChildren(error);
        this.preview.classList.remove("loading");
        this.preview.classList.add("active");
      };
      image.src = source;
    }
    commitPreview(source, cached) {
      if (!this.preview) return;
      const previewImage = document.createElement("img");
      previewImage.src = source, previewImage.alt = "预览图", this.preview.replaceChildren(previewImage), this.imgElement = previewImage, this.currentUrl = source, this.preview.style.width = `${cached.width}px`, this.preview.style.height = `${cached.height}px`, this.preview.classList.remove("loading"), this.showCurrentPreview();
    }
    showCurrentPreview() {
      if (!this.preview || !this.pointer || !this.imgElement) return;
      const width = this.preview.offsetWidth, height = this.preview.offsetHeight;
      this.placement = this.choosePlacement(this.pointer.x, this.pointer.y, width, height), this.preview.classList.add("active"), this.schedulePosition();
    }
    calculateImageSize(image) {
      const viewportPadding = 8;
      const availableWidth = Math.max(1, window.innerWidth - 2 * (viewportPadding + this.config.offsetX));
      const availableHeight = Math.max(1, window.innerHeight - 2 * (viewportPadding + this.config.offsetY));
      const maxWidth = Math.min(this.config.maxWidth, availableWidth);
      const maxHeight = Math.min(this.config.maxHeight, availableHeight);
      const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      return {
        width: Math.max(1, Math.round(image.naturalWidth * scale)),
        height: Math.max(1, Math.round(image.naturalHeight * scale))
      };
    }
    choosePlacement(x, y2, width, height) {
      if (!this.config.autoAdjustPosition) return {
        horizontal: "right",
        vertical: "bottom"
      };
      const rightSpace = window.innerWidth - x - this.config.offsetX;
      const leftSpace = x - this.config.offsetX;
      const bottomSpace = window.innerHeight - y2 - this.config.offsetY;
      const topSpace = y2 - this.config.offsetY;
      return {
        horizontal: rightSpace >= width || rightSpace >= leftSpace ? "right" : "left",
        vertical: bottomSpace >= height || bottomSpace >= topSpace ? "bottom" : "top"
      };
    }
    handleMouseMove(event) {
      if (!this.currentTarget || !this.preview?.classList.contains("active")) return;
      this.pointer = {
        x: event.clientX,
        y: event.clientY
      };
      this.schedulePosition();
    }
    schedulePosition() {
      if (this.animationFrame || !this.pointer || !this.placement) return;
      this.animationFrame = requestAnimationFrame((() => {
        this.animationFrame = null;
        this.applyPosition();
      }));
    }
    applyPosition() {
      if (!this.preview || !this.pointer || !this.placement) return;
      const padding = 8;
      const width = this.preview.offsetWidth;
      const height = this.preview.offsetHeight;
      let left = "right" === this.placement.horizontal ? this.pointer.x + this.config.offsetX : this.pointer.x - width - this.config.offsetX;
      let top = "bottom" === this.placement.vertical ? this.pointer.y + this.config.offsetY : this.pointer.y - height - this.config.offsetY;
      left = Math.min(Math.max(padding, left), Math.max(padding, window.innerWidth - width - padding));
      top = Math.min(Math.max(padding, top), Math.max(padding, window.innerHeight - height - padding));
      this.preview.style.left = `${left}px`;
      this.preview.style.top = `${top}px`;
    }
    handleMouseLeave() {
      if (!this.preview) return;
      clearTimeout(this.timer), this.timer = setTimeout((() => this.hidePreview()), this.config.hideDelay);
    }
    hidePreview() {
      if (!this.preview) return;
      ++this.loadGeneration, this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null), this.pendingImage = null, this.pendingUrl = null, this.preview.classList.remove("active", "loading"), this.currentTarget = null, this.pointer = null, this.placement = null, this.timer = null;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      ++this.loadGeneration;
      clearTimeout(this.timer);
      this.animationFrame && cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
      this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null);
      this.pendingImage = null;
      this.eventsBound && (document.removeEventListener("mouseover", this.onDocumentOver), document.removeEventListener("mouseout", this.onDocumentOut), document.removeEventListener("mousemove", this.onDocumentMove), this.eventsBound = false);
      this.loadedUrls.clear();
      this.preview?.remove();
      this.preview = null;
      this.currentTarget = null;
    }
  }, (async function() {
    document.head.insertAdjacentHTML("beforeend", `
        <style>
            .console-logger-container {
                position: fixed;
                bottom: 0;
                right: 0;
                z-index: var(--jhs-z-loading);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                width: fit-content;
            }

            .console-logger-toggle {
                width: 40px;
                height: 30px;
                background: var(--jhs-accent);
                border-radius: 120px 10px 0 0;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
                transition: all 0.3s ease;
                color: var(--jhs-accent-text-on);
                font-size: 16px;
            }

            .console-logger-toggle:hover {
                background: var(--jhs-accent-hover);
            }

            .console-logger-toggle::after {
                content: '▼';
                transition: transform 0.3s ease;
            }

            .console-logger-toggle.collapsed::after {
                content: '▲';
            }

            .console-logger-window {
                width: 400px;
                height: 400px;
                background: var(--jhs-surface);
                border-radius: 10px 0 10px 10px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: translateY(0);
                opacity: 1;
                /* 简化过渡属性 */
                transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.3s ease;
            }

            .console-logger-window.maximized {
                width: 600px !important;
                height: 85vh !important;
                border-radius: 10px 0 0 10px; /* 调整圆角以匹配右下角 */
            }

            .console-logger-window.collapsed {
                height: 0 !important;
                min-height: 0 !important;
                opacity: 0;
            }

            .console-logger-header {
                background: var(--jhs-accent);
                color: var(--jhs-accent-text-on);
                padding: 12px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }

            .console-logger-title {
                font-weight: 600;
                font-size: 16px;
            }

            .console-logger-controls {
                display: flex;
                gap: 10px;
            }

            .console-logger-controls button {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.3);
                padding: 5px 10px;
                font-size: 12px;
                color: var(--jhs-accent-text-on);
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.3s;
            }

            .console-logger-controls button:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            /* 新增的按钮样式 */
            .console-logger-maximize-toggle {
                line-height: 1;
                font-size: 14px !important; /* 使箭头看起来更大 */
                padding: 5px 8px !important;
            }
            .console-logger-maximize-toggle::before {
                content: '⇱'; /* Unicode symbol for maximized */
            }
            .console-logger-maximize-toggle.active::before {
                content: '⇲'; /* Unicode symbol for minimized */
            }


            .console-logger-filters {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 10px;
                background: var(--jhs-surface-2);
                border-bottom: 1px solid var(--jhs-border);
                flex-shrink: 0;
                overflow-x: hidden;
            }

            /* 新增: 过滤器按钮组的容器，负责滚动 */
            .console-logger-filter-group {
                display: flex;
                gap: 5px;
                overflow-x: auto; /* 允许过滤器按钮滚动 */
                flex-grow: 1; /* 占据剩余空间 */
                padding-right: 10px; /* 避免滚动条影响按钮 */
            }

            .console-logger-filter {
                padding: 5px 10px;
                font-size: 12px;
                border-radius: 15px;
                background: var(--jhs-input-bg);
                color: var(--jhs-text-muted);
                border: 1px solid var(--jhs-border);
                cursor: pointer;
                transition: all 0.3s;
                white-space: nowrap;
                flex-shrink: 0; /* 确保不被压缩 */
            }

            .console-logger-filter.active {
                background: var(--jhs-accent);
                color: var(--jhs-accent-text-on);
                border-color: var(--jhs-accent);
            }

            /* 新增: 滚动到底部按钮的样式 (位于 filtersContainer 内部右侧) */
            .console-logger-scroll-to-bottom {
                background: var(--jhs-accent);
                border: none;
                padding: 5px 10px;
                font-size: 12px;
                color: var(--jhs-accent-text-on);
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.3s;
                line-height: 1;
                height: fit-content;
                white-space: nowrap;
                margin-left: auto; /* 将按钮推到最右侧 */
                flex-shrink: 0; /* 确保不被压缩 */
            }

            .console-logger-scroll-to-bottom:hover {
                background: var(--jhs-accent-hover);
            }


            .console-logger-content {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                background: var(--jhs-surface);
                word-wrap: break-word;
                text-align: left;
            }

            .console-logger-entry {
                padding: 8px 10px;
                margin-bottom: 3px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 1.4;
                /*animation: consoleFadeIn 0.3s ease;*/
                border-left: 3px solid transparent;
            }

            @keyframes consoleFadeIn {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .console-logger-timestamp {
                color: var(--jhs-text-muted);
                font-size: 11px;
                margin-right: 2px;
            }

            @media (max-width: 768px) {
                .console-logger-container {
                    right: 10px;
                    bottom: 10px;
                }

                .console-logger-window {
                    width: calc(100vw - 20px);
                    height: 300px;
                }
            }

            .console-logger-message[data-type="json"] {
                white-space: pre-wrap;
            }
        </style>
    `);
    const e2 = {
      base: {
        label: "信息",
        background: "var(--jhs-status-fav-tint)",
        borderLeftColor: "var(--jhs-accent)"
      },
      warn: {
        label: "警告",
        background: "var(--jhs-status-watch-tint)",
        borderLeftColor: "var(--jhs-status-watch)"
      },
      error: {
        label: "错误",
        background: "var(--jhs-status-filter-tint)",
        borderLeftColor: "var(--jhs-status-filter)"
      },
      debug: {
        label: "调试",
        background: "var(--jhs-surface-2)",
        borderLeftColor: "var(--jhs-border-strong)"
      }
    }, t2 = {
      base: ["base", "warn", "error"],
      warn: ["warn"],
      error: ["error"],
      debug: ["base", "warn", "error", "debug"]
    }, n2 = await storageManager.getSetting("clogMsgCount", 2e3), a2 = "jhs_clog_maximize", i2 = "jhs_clog_expand", s2 = "jhs_clog_filter";
    const _o = class _o {
      constructor() {
        const t3 = localStorage.getItem(s2);
        this.currentFilter = t3 && e2[t3] ? t3 : "base", this.logs = [], this.isInitialized = false, this.userScrolledUp = false;
      }
      tryInitialize() {
        return "loading" !== document.readyState && (this.isInitialized || (this.init(), this.isInitialized = true), true);
      }
      init() {
        this.createContainer(), this.bindEvents(), this.checkInitialMaximizeState(), this.checkInitialCollapseState();
      }
      createContainer() {
        this.container = document.createElement("div"), this.container.className = "console-logger-container", this.container.style.display = "none", this.toggleBtn = document.createElement("div"), this.toggleBtn.className = "console-logger-toggle collapsed", this.container.appendChild(this.toggleBtn), this.window = document.createElement("div"), this.window.className = "console-logger-window collapsed";
        const t3 = document.createElement("div");
        t3.className = "console-logger-header";
        const n3 = document.createElement("div");
        n3.className = "console-logger-title", n3.textContent = "JHS Console";
        const a3 = document.createElement("div");
        a3.className = "console-logger-controls", this.maximizeBtn = document.createElement("button"), this.maximizeBtn.textContent = "", this.maximizeBtn.classList.add("console-logger-maximize-toggle"), a3.appendChild(this.maximizeBtn);
        const i3 = document.createElement("button");
        i3.textContent = "清空", i3.addEventListener("click", (() => this.clear())), a3.appendChild(i3), t3.appendChild(n3), t3.appendChild(a3), this.filtersContainer = document.createElement("div"), this.filtersContainer.className = "console-logger-filters", this.filterButtonGroup = document.createElement("div"), this.filterButtonGroup.className = "console-logger-filter-group", this.filtersContainer.appendChild(this.filterButtonGroup), this.scrollToBottomBtn = document.createElement("button"), this.scrollToBottomBtn.className = "console-logger-scroll-to-bottom", this.scrollToBottomBtn.textContent = "到底部", this.filtersContainer.appendChild(this.scrollToBottomBtn), this.content = document.createElement("div"), this.content.className = "console-logger-content jhs-scrollbar", this.window.appendChild(t3), this.window.appendChild(this.filtersContainer), this.window.appendChild(this.content), this.container.appendChild(this.window), document.body.appendChild(this.container), Object.keys(e2).forEach(((t4) => {
          const n4 = document.createElement("div");
          n4.className = "console-logger-filter", t4 === this.currentFilter && n4.classList.add("active"), n4.textContent = e2[t4].label, n4.dataset.type = t4, n4.addEventListener("click", (() => this.setFilter(t4))), this.filterButtonGroup.appendChild(n4);
        }));
      }
      bindEvents() {
        this.toggleBtn.addEventListener("click", (() => {
          this.toggleExpandCollapsed();
        })), this.maximizeBtn.addEventListener("click", (() => this.toggleMaximize())), this.scrollToBottomBtn.addEventListener("click", (() => {
          this.content.scrollTop = this.content.scrollHeight, this.userScrolledUp = false;
        })), this.content.addEventListener("scroll", (() => {
          const e3 = this.content.scrollHeight - this.content.clientHeight <= this.content.scrollTop + 5;
          this.userScrolledUp = !e3;
        })), this.content.addEventListener("wheel", ((e3) => {
          const t3 = 0 === this.content.scrollTop, n3 = this.content.scrollHeight - this.content.clientHeight <= this.content.scrollTop + 1;
          (t3 && e3.deltaY < 0 || n3 && e3.deltaY > 0) && (e3.preventDefault(), e3.stopPropagation());
        }), {
          passive: false
        });
      }
      toggleExpandCollapsed() {
        const e3 = this.window.classList.toggle("collapsed");
        this.toggleBtn.classList.toggle("collapsed"), e3 ? localStorage.setItem(i2, "no") : (localStorage.setItem(i2, "yes"), this.reRenderAllLogs());
      }
      checkInitialCollapseState() {
        const e3 = localStorage.getItem(i2);
        e3 && "no" !== e3 ? (this.window.classList.toggle("collapsed"), this.toggleBtn.classList.toggle("collapsed"), setTimeout((() => {
          this.content.scrollTop = this.content.scrollHeight;
        }), 0)) : (this.window.classList.add("collapsed"), this.toggleBtn.classList.add("collapsed"));
      }
      checkInitialMaximizeState() {
        "maximized" === localStorage.getItem(a2) && (this.window.classList.add("maximized"), this.maximizeBtn.classList.add("active"));
      }
      toggleMaximize() {
        const e3 = this.window.classList.toggle("maximized");
        this.maximizeBtn.classList.toggle("active", e3), e3 ? localStorage.setItem(a2, "maximized") : localStorage.setItem(a2, "minimized"), this.window.classList.contains("collapsed") || (this.content.scrollTop = this.content.scrollHeight);
      }
      addLog(t3, a3 = "base", ...i3) {
        const s3 = this.tryInitialize();
        let o3, r2 = [];
        e2[a3] ? (o3 = a3, r2 = i3) : (o3 = "base", r2 = [a3, ...i3]), o3 = e2[o3] ? o3 : "base";
        const l2 = [t3, ...r2];
        let c2 = "msg";
        const d2 = [];
        l2.forEach(((e3) => {
          if ("[object Error]" === Object.prototype.toString.call(e3)) d2.push(String(e3));
          else if ("object" == typeof e3 && null !== e3) try {
            d2.push("<br/>" + JSON.stringify(e3, null, 2)), c2 = "json";
          } catch (t4) {
            d2.push(String(e3)), c2 = "msg";
          }
          else d2.push(String(e3));
        }));
        let h2 = d2.join("  ");
        h2 = h2.replace(/(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi, ((e3) => {
          const t4 = e3.startsWith("http") || e3.startsWith("ftp"), n3 = e3.startsWith("//"), a4 = e3.startsWith("www.");
          let i4 = e3;
          return n3 ? i4 = `http:${e3}` : !t4 && a4 && (i4 = `http://${e3}`), `<a href="${escapeHtml(i4)}" target="_blank">${escapeHtml(e3)}</a>`;
        }));
        const g2 = {
          message: h2,
          messageType: c2,
          type: o3,
          timestamp: /* @__PURE__ */ new Date(),
          id: Date.now() + Math.random()
        };
        if (this.logs.push(g2), this.logs.length > n2) {
          const e3 = this.logs[0];
          if (s3) {
            const t4 = this.content.querySelector(`.console-logger-entry[data-id="${e3.id}"]`);
            t4 && (this.logs.shift(), this.content.removeChild(t4));
          }
        }
        s3 && this.renderLog(g2);
      }
      log(...e3) {
        const [t3, ...n3] = e3;
        setTimeout((() => {
          this.addLog(t3, "base", ...n3);
        }), 0);
      }
      error(...e3) {
        const [t3, ...n3] = e3;
        console.error(...e3), setTimeout((() => {
          this.addLog(t3, "error", ...n3);
        }), 0);
      }
      warn(...e3) {
        const [t3, ...n3] = e3;
        setTimeout((() => {
          this.addLog(t3, "warn", ...n3);
        }), 0);
      }
      debug(...e3) {
        const [t3, ...n3] = e3;
        setTimeout((() => {
          this.addLog(t3, "debug", ...n3);
        }), 0);
      }
      renderLog(e3) {
        if ("none" === this.container.style.display) return;
        if (this.window.classList.contains("collapsed")) return;
        if (!(t2[this.currentFilter] || []).includes(e3.type)) return;
        const n3 = this._createLogElement(e3);
        this.content.appendChild(n3), this.window.classList.contains("collapsed") || this.userScrolledUp || (this.content.scrollTop = this.content.scrollHeight);
      }
      reRenderAllLogs() {
        "none" !== this.container.style.display && (this.window.classList.contains("collapsed") || setTimeout((() => {
          if (this.content.innerHTML = "", 0 === this.logs.length) return;
          const e3 = t2[this.currentFilter] || [], n3 = document.createDocumentFragment();
          this.logs.forEach(((t3) => {
            if (e3.includes(t3.type)) {
              const e4 = this._createLogElement(t3);
              n3.appendChild(e4);
            }
          })), this.content.appendChild(n3), this.content.scrollTop = this.content.scrollHeight;
        }), 0));
      }
      _createLogElement(t3) {
        const n3 = document.createElement("div");
        n3.className = "console-logger-entry", n3.dataset.type = t3.type, n3.dataset.id = t3.id;
        const a3 = e2[t3.type] || e2.base;
        n3.style.borderLeft = "3px solid " + a3.borderLeftColor, n3.style.background = a3.background;
        const i3 = (t3.timestamp instanceof Date ? t3.timestamp : new Date(t3.timestamp)).toTimeString().split(" ")[0];
        return n3.innerHTML = `
                <span class="console-logger-timestamp">[${i3}]</span>
                <span class="console-logger-message" data-type="${t3.messageType}">${t3.message}</span>
            `, n3;
      }
      setFilter(e3) {
        if (this.currentFilter === e3) return;
        this.currentFilter = e3, localStorage.setItem(s2, e3);
        this.filterButtonGroup.querySelectorAll(".console-logger-filter").forEach(((t3) => {
          t3.dataset.type === e3 ? t3.classList.add("active") : t3.classList.remove("active");
        })), this.reRenderAllLogs();
      }
      clear() {
        this.logs = [], this.content.innerHTML = "";
      }
      show() {
        (this.isInitialized && this.container || this.tryInitialize() && this.container) && (this.container.style.display = "", this.reRenderAllLogs());
      }
      hide() {
        this.isInitialized && this.container && (this.container.style.display = "none");
      }
      lowZIndex() {
        this.isInitialized && this.container && (this.container.style.zIndex = String(JHS_Z_INDEX.debugLow));
      }
      highZIndex() {
        this.isInitialized && this.container && (this.container.style.zIndex = String(JHS_Z_INDEX.debug));
      }
    };
    __name(_o, "o");
    let o2 = _o;
    try {
      unsafeWindow.parent.clog && "function" == typeof unsafeWindow.parent.clog.log ? window.clog = unsafeWindow.clog = unsafeWindow.parent.clog : window.clog = unsafeWindow.clog = new o2();
    } catch (r2) {
      console.error("创建日志控制台出现异常", r2), window.clog = unsafeWindow.clog = new o2();
    }
    !(function() {
      const e3 = window.clog || console;
      window.addEventListener("error", (function(t3) {
        const n3 = t3.filename, a3 = t3.message;
        n3.includes("javdb") || n3.includes("javbus") || e3.error(`[全局 Error 异常捕获] ${a3} 来源: ${n3}`);
      })), window.addEventListener("unhandledrejection", (function(t3) {
        const n3 = t3.reason, a3 = (null == n3 ? void 0 : n3.message) ?? "";
        if (["NotAllowedError", "AbortError", "NotSupportedError"].includes(n3?.name) || a3.includes("play()") || a3.includes("The element has no supported sources")) return e3.warn("[全局媒体播放异常] 当前媒体源无法播放", n3), void t3.preventDefault();
        if (a3.includes("<span>1005</span>") && a3.includes("fc2ppvdb")) return;
        const i3 = `[全局 Promise 异常捕获] ${n3.message || n3}`;
        e3.error(i3, n3), t3.preventDefault();
      }));
    })(), document.addEventListener("mousedown", ((e3) => {
      const t3 = window.clog;
      if (!t3.isInitialized || !t3.container) return;
      const n3 = e3.target, a3 = [".console-logger-container", ".layui-layer-shade", ".loading-container"].join(",");
      n3.closest(a3) ? t3.highZIndex() : t3.lowZIndex();
    }));
  })(), (function() {
    function e2(e3, t3, n2) {
      const a2 = (function(e4) {
        const t4 = document.createElement("div");
        t4.classList.add("js-tooltip");
        const n3 = document.createElement("div");
        return n3.innerHTML = escapeHtml(e4), t4.appendChild(n3), document.body.appendChild(t4), t4;
      })(t3);
      a2.style.display = "block";
      const i2 = e3.getBoundingClientRect(), s2 = a2.getBoundingClientRect();
      a2.style.display = "none";
      const o2 = window.innerWidth, r2 = window.innerHeight;
      let l2, c2, d2 = n2;
      const h2 = /* @__PURE__ */ __name((e4) => e4 >= 8 && e4 + s2.height <= r2 - 8, "h"), g2 = /* @__PURE__ */ __name((e4) => e4 >= 8 && e4 + s2.width <= o2 - 8, "g"), p2 = i2.left + i2.width / 2 - s2.width / 2, m2 = i2.top + i2.height / 2 - s2.height / 2;
      switch (n2) {
        case "top":
          c2 = i2.top - s2.height - 0, c2 < 8 && h2(i2.bottom + 0) && (c2 = i2.bottom + 0, d2 = "bottom");
          break;
        case "bottom":
          c2 = i2.bottom + 0, c2 + s2.height > r2 - 8 && h2(i2.top - s2.height - 0) && (c2 = i2.top - s2.height - 0, d2 = "top");
          break;
        case "left":
          l2 = i2.left - s2.width - 0, l2 < 8 && g2(i2.right + 0) && (l2 = i2.right + 0, d2 = "right");
          break;
        case "right":
          l2 = i2.right + 0, l2 + s2.width > o2 - 8 && g2(i2.left - s2.width - 0) && (l2 = i2.left - s2.width - 0, d2 = "left");
      }
      const u2 = "left" === d2 || "right" === d2;
      "top" === d2 || "bottom" === d2 ? (l2 = p2, l2 < 8 ? l2 = 8 : l2 + s2.width > o2 - 8 && (l2 = o2 - s2.width - 8)) : u2 && (c2 = m2, c2 < 8 ? c2 = 8 : c2 + s2.height > r2 - 8 && (c2 = r2 - s2.height - 8)), a2.style.left = `${l2}px`, a2.style.top = `${c2}px`, a2.classList.add("is-active"), e3.tooltipElement = a2;
    }
    __name(e2, "e");
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .js-tooltip {\n                position: fixed;\n                padding: 8px 12px;\n                border: 1px solid var(--jhs-border);\n                border-radius: var(--jhs-radius-sm);\n                white-space: normal;\n                max-width: 600px;\n                pointer-events: none;\n                font-size: 14px;\n                line-height: 1.5;\n                z-index: var(--jhs-z-tooltip);\n                background: var(--jhs-surface-2);\n                color: var(--jhs-text);\n                box-shadow: var(--jhs-shadow-md);\n                display: none;\n            }\n            .js-tooltip.is-active {\n                display: block !important;\n            }\n        </style>\n    ");
    const t2 = "[data-tip-top], [data-tip-bottom], [data-tip-left], [data-tip-right], [data-tip]";
    document.addEventListener("mouseover", ((n2) => {
      const a2 = n2.target.closest(t2);
      if (a2 && !a2.tooltipElement) {
        let t3, n3 = "top";
        if (a2.hasAttribute("data-tip-bottom") ? (t3 = a2.getAttribute("data-tip-bottom"), n3 = "bottom") : a2.hasAttribute("data-tip-left") ? (t3 = a2.getAttribute("data-tip-left"), n3 = "left") : a2.hasAttribute("data-tip-right") ? (t3 = a2.getAttribute("data-tip-right"), n3 = "right") : a2.hasAttribute("data-tip-top") ? (t3 = a2.getAttribute("data-tip-top"), n3 = "top") : a2.hasAttribute("data-tip") && (t3 = a2.getAttribute("data-tip"), n3 = "top"), !t3) return;
        a2.hoverTimeout = setTimeout((() => {
          a2.matches(":hover") && !a2.tooltipElement && e2(a2, t3, n3);
        }), 50);
      }
    })), document.addEventListener("mouseout", ((e3) => {
      const n2 = e3.target.closest(t2);
      var a2;
      n2 && (n2.hoverTimeout && (clearTimeout(n2.hoverTimeout), n2.hoverTimeout = null), n2.contains(e3.relatedTarget) || n2.tooltipElement && ((a2 = n2.tooltipElement) && a2.parentNode && a2.remove(), n2.tooltipElement = null));
    }));
  })();
  var _PluginManager = class _PluginManager {
    constructor() {
      this.plugins = /* @__PURE__ */ new Map();
      this._errorLog = [];
      this._lastTimings = [];
      this._startedAt = performance.now();
      this._registrationMs = 0;
      this._cssMs = 0;
      this._immediateMs = 0;
      this._readyMs = 0;
      this._idlePending = 0;
      this._idleCompleted = 0;
      this._disabledPluginsPromise = null;
    }
    register(e2) {
      if ("function" != typeof e2) throw new Error("插件必须是一个类");
      const a2 = performance.now();
      const t2 = new e2();
      t2.pluginManager = this;
      const n2 = t2.getName();
      if (this.plugins.has(n2)) throw new Error(`插件"${n2}"已注册`);
      this.plugins.set(n2, t2);
      this._registrationMs += performance.now() - a2;
    }
    getBean(e2) {
      return this.plugins.get(e2);
    }
    _addError(e2, t2, n2) {
      this._errorLog.push({
        time: (/* @__PURE__ */ new Date()).toISOString(),
        plugin: e2,
        phase: t2,
        message: n2?.message || String(n2),
        stack: n2?.stack || ""
      });
      this._errorLog.length > 200 && this._errorLog.shift();
    }
    getErrorLog() {
      return [...this._errorLog];
    }
    clearErrorLog() {
      this._errorLog = [];
    }
    getTimings() {
      return [...this._lastTimings];
    }
    getPluginNames() {
      return Array.from(this.plugins.keys());
    }
    getStartupReport() {
      return {
        registeredPlugins: this.plugins.size,
        registrationMs: this._registrationMs,
        cssMs: this._cssMs,
        immediateMs: this._immediateMs,
        readyMs: this._readyMs,
        idlePending: this._idlePending,
        idleCompleted: this._idleCompleted
      };
    }
    async _getDisabledPlugins() {
      return this._disabledPluginsPromise || (this._disabledPluginsPromise = (async () => {
        try {
          const e2 = await storageManager.getSetting("disabledPlugins", "[]");
          return new Set(JSON.parse(e2).filter(((name) => !["SettingPlugin", "StatsPlugin", "MobileBottomBarPlugin"].includes(name))));
        } catch (e2) {
          return /* @__PURE__ */ new Set();
        }
      })());
    }
    async processCss() {
      const a2 = performance.now();
      const t2 = await this._getDisabledPlugins();
      const m2 = utils.isMobileMode();
      const s2 = await Promise.all(Array.from(this.plugins).map((async ([e2, n2]) => {
        try {
          if (t2.has(e2)) return { name: e2, status: "disabled" };
          if (m2 && "function" == typeof n2.shouldSkipOnMobile && n2.shouldSkipOnMobile()) return { name: e2, status: "skipped" };
          if ("function" == typeof n2.initCss) {
            const t3 = await n2.initCss();
            return {
              name: e2,
              status: "fulfilled",
              css: t3
            };
          }
          return { name: e2, status: "skipped" };
        } catch (a3) {
          return clog.error(`插件 ${e2} 加载 CSS 失败`, a3), this._addError(e2, "initCss", a3), {
            name: e2,
            status: "rejected",
            error: a3
          };
        }
      })));
      const o2 = s2.map(((e2) => e2.css)).filter(Boolean);
      o2.length > 0 && utils.insertStyle(o2);
      this._cssMs = performance.now() - a2;
    }
    async _runPlugin(e2) {
      const t2 = performance.now();
      try {
        if ("function" == typeof e2.plugin.handle) await e2.plugin.handle();
        e2.timing.elapsed = performance.now() - t2;
        e2.timing.status = "ok";
      } catch (n2) {
        e2.timing.elapsed = performance.now() - t2;
        e2.timing.status = "error";
        e2.timing.error = n2?.message || String(n2);
        clog.error(`插件 ${e2.name} 执行失败`, n2);
        this._addError(e2.name, "idle" === e2.mode ? "handle-idle" : "handle", n2);
      }
    }
    _scheduleIdle(e2) {
      const t2 = /* @__PURE__ */ __name(() => e2().catch(((e3) => {
        clog.error("[JHS] 空闲插件执行失败:", e3);
      })), "t");
      "function" == typeof requestIdleCallback ? requestIdleCallback(t2, { timeout: 1500 }) : setTimeout(t2, 100);
    }
    async _runIdlePlugins(e2) {
      for (const t2 of e2) {
        t2.startedAt = performance.now();
        await this._runPlugin(t2);
        this._idlePending--;
        this._idleCompleted++;
      }
    }
    async processPlugins() {
      const e2 = await this._getDisabledPlugins(), t2 = utils.isMobileMode(), n2 = [], a2 = [], i2 = [];
      for (const [s3, o2] of this.plugins) {
        const r2 = "function" == typeof o2.getStartupMode && "idle" === o2.getStartupMode() ? "idle" : "immediate";
        const l2 = { name: s3, elapsed: 0, status: "pending", startupMode: r2 };
        if (e2.has(s3)) l2.status = "disabled", i2.push(l2);
        else if (t2 && "function" == typeof o2.shouldSkipOnMobile && o2.shouldSkipOnMobile()) l2.status = "skipped-mobile", i2.push(l2);
        else {
          const e3 = { name: s3, plugin: o2, mode: r2, timing: l2, startedAt: 0 };
          "idle" === r2 ? (l2.status = "pending-idle", a2.push(e3)) : n2.push(e3), i2.push(l2);
        }
      }
      this._lastTimings = i2;
      const s2 = performance.now();
      await Promise.all(n2.map(((e3) => {
        e3.startedAt = performance.now();
        return this._runPlugin(e3);
      })));
      this._immediateMs = performance.now() - s2;
      for (const e3 of n2) {
        if ("function" != typeof e3.plugin.afterPluginsReady) continue;
        try {
          await e3.plugin.afterPluginsReady();
        } catch (t3) {
          clog.error(`插件 ${e3.name} 完成初始化后执行失败`, t3), this._addError(e3.name, "after-ready", t3);
        }
      }
      this._readyMs = performance.now() - this._startedAt;
      this._idlePending = a2.length;
      a2.length && this._scheduleIdle((() => this._runIdlePlugins(a2)));
    }
  };
  __name(_PluginManager, "PluginManager");
  var PluginManager = _PluginManager;
  var _BasePlugin = class _BasePlugin {
    constructor() {
      if (!_BasePlugin._sharedIcons) {
        i(this, "pluginManager", null), i(this, "settingSvg", '<svg t="1760926954860" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4947" width="200" height="200"><path d="M511.099222 365.825763c-80.7786 0-146.26579 65.482515-146.26579 146.259556 0 80.7786 65.48719 146.259556 146.26579 146.259556 80.777041 0 146.259556-65.480957 146.259556-146.259556C657.358779 431.308278 591.876263 365.825763 511.099222 365.825763L511.099222 365.825763zM511.099222 585.215097c-40.391637 0-73.136012-32.742816-73.136012-73.129778 0-40.391637 32.742816-73.129778 73.136012-73.129778 40.386962 0 73.129778 32.738141 73.129778 73.129778C584.229 552.472281 551.486184 585.215097 511.099222 585.215097L511.099222 585.215097zM511.099222 585.215097M900.893017 568.24369l-26.451395-15.268032c3.065451-27.021784 3.138697-54.472139 0.077922-81.822754l26.373473-15.225955c69.953678-40.391637 93.920921-129.844512 53.533959-199.799749-40.390079-69.95212-129.839837-93.925596-199.799749-53.533959l-26.373473 15.225955c-22.153219-16.330888-45.963059-29.99217-70.896534-40.843585l0-30.545416c0-80.777041-65.48719-146.259556-146.26579-146.259556-80.7786 0-146.259556 65.482515-146.259556 146.259556l0 30.515806c-12.377127 5.421811-24.587501 11.55583-36.562551 18.473743-11.97505 6.917913-23.396854 14.420242-34.277879 22.432179l-26.431136-15.258682c-69.958353-40.391637-159.406553-16.424395-199.79819 53.533959C27.378272 326.082437 51.343956 415.535311 121.299193 455.922273l26.449837 15.275825c-3.063892 27.020226-3.137139 54.465905-0.077922 81.822754l-26.373473 15.224397c-69.953678 40.391637-93.920921 129.841395-53.533959 199.799749 40.391637 69.95212 129.839837 93.920921 199.79819 53.533959l26.375032-15.224397c22.153219 16.32933 45.963059 29.984378 70.896534 40.843585l0 30.537624c0 80.7786 65.48719 146.26579 146.26579 146.26579 80.777041 0 146.259556-65.48719 146.259556-146.26579l0-30.515806c12.377127-5.415577 24.587501-11.55583 36.567226-18.467509 11.97505-6.917913 23.398412-14.420242 34.277879-22.432179l26.423343 15.258682c69.959912 40.391637 159.408111 16.418162 199.799749-53.533959C994.813938 698.085085 970.848254 608.635327 900.893017 568.24369L900.893017 568.24369zM891.096666 731.474653c-20.198936 34.982294-64.923035 46.962019-99.900654 26.770875l-63.331869-36.567226 0 0 0 0-7.988562-4.611422c-18.134004 18.450366-39.024886 34.787489-62.516805 48.353705-23.49971 13.559983-48.091888 23.482568-73.129778 29.964118l0 9.222846 0 0 0 65.828489 0 7.301289c0 40.391637-32.742816 73.136012-73.136012 73.136012-40.386962 0-73.129778-32.742816-73.129778-73.136012l0-7.402588 0-65.72719 0 0 0-9.300768c-50.682014-13.090892-97.855981-39.682547-135.652816-78.232109l-7.983886 4.606747 0 0-63.331869 36.567226c-34.977618 20.191144-79.706394 8.206743-99.900654-26.770875-20.192702-34.977618-8.206743-79.701718 26.770875-99.899095l6.341291-3.657657 0 0 64.972905-37.516316c-14.487254-52.005129-13.929333-106.151555 0.073247-156.593569l-8.057133-4.650384 0 0-63.331869-36.567226c-34.982294-20.192702-46.963578-64.923035-26.770875-99.900654 20.192702-34.97606 64.923035-46.962019 99.900654-26.763083l6.324148 3.649866 0 0 64.996282 37.528784c18.132445-18.450366 39.024886-34.790606 62.516805-48.353705 23.493477-13.559983 48.085654-23.485685 73.129778-29.964118l0-9.229079L437.960093 153.739276l0-7.309082c0-40.385404 32.742816-73.129778 73.129778-73.129778 40.391637 0 73.129778 32.744375 73.129778 73.129778l0 7.404147 0 65.72719 0 9.307001c50.686689 13.086217 97.862215 39.684106 135.657491 78.232109l48.487732-27.997368 22.828023-13.176607c34.977618-20.192702 79.701718-8.212977 99.89442 26.763083 20.198936 34.982294 8.212977 79.706394-26.764641 99.900654l-30.822819 17.79738-32.50905 18.769847 0 0 0 0-7.983886 4.605189c14.488813 52.009805 13.929333 106.159347-0.077922 156.599803l64.979139 37.511641 0 0 6.414537 3.701294C899.303409 651.772936 911.289368 696.498594 891.096666 731.474653L891.096666 731.474653zM891.096666 731.474653M197.330785 324.240361c-1.932465 3.232203-3.824411 6.497135-5.649343 9.785442L197.330785 324.240361 197.330785 324.240361zM197.330785 324.240361M830.515443 690.133926l-5.655577 9.804144C826.793889 696.699632 828.685835 693.433143 830.515443 690.133926L830.515443 690.133926zM830.515443 690.133926M505.297151 146.430195l11.304921 0C512.835324 146.369416 509.067017 146.374091 505.297151 146.430195L505.297151 146.430195zM505.297151 146.430195M516.898176 877.740444l-11.31583 0C509.350653 877.796547 513.125193 877.796547 516.898176 877.740444L516.898176 877.740444zM516.898176 877.740444" fill="#272636" p-id="4948"></path></svg>'), i(this, "editSvg", '<svg t="1760920692801" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3545" width="200" height="200"><path d="M1013.929675 128.26571a143.759824 143.759824 0 0 1 10.44409 53.858738 84.576649 84.576649 0 0 1-5.836403 30.308339 92.870485 92.870485 0 0 1-18.635533 29.284408 1314.726599 1314.726599 0 0 1-24.983901 24.574329c-7.372299 7.06512-13.82306 13.311095-19.249891 18.737926-6.143582 6.143582-12.082378 11.672806-17.406817 16.382886L720.266444 82.598415c9.317766-8.601015 20.478607-18.942712 33.277737-31.02509s23.448006-21.604931 31.946628-28.67005a102.085858 102.085858 0 0 1 68.193763-22.731255c11.263234 0.307179 22.116896 2.047861 32.560985 5.222045 10.546483 3.071791 19.659463 6.655547 27.441334 10.546483 16.280493 8.601015 34.301667 23.550399 54.063524 45.052936 19.864249 21.502538 35.120812 43.82422 46.076867 67.272226z m-907.20231 570.943576l32.560986-33.38013c17.099637-17.509209 38.397389-39.216533 64.098041-64.917186l84.986221-85.395793 94.303987-94.815953 250.350976-251.477299L850.817567 389.163169 600.46659 640.640468l-93.177663 94.815953c-31.02509 30.410732-58.978389 58.364031-83.859898 83.655111-24.779115 25.29108-45.360116 46.17926-61.743001 62.562146a504.797674 504.797674 0 0 1-55.804206 50.274981c-10.239304 7.884264-20.581 14.130239-31.537055 18.737926a507.152714 507.152714 0 0 1-47.715156 19.86425 1609.311367 1609.311367 0 0 1-131.063087 42.185931c-20.478607 5.426831-35.837563 8.908194-45.974474 10.546483-20.88818 2.35504-34.813633-0.819144-41.981145-9.42016-6.860333-8.601015-8.805801-22.93604-5.73401-43.312254a396.261054 396.261054 0 0 1 11.058448-47.305584c5.836403-20.683394 12.082378-42.185931 18.635532-64.40522 6.553154-22.219289 13.003916-42.697897 19.249891-61.435822 6.143582-18.635533 11.263234-31.537055 15.15417-38.602176 4.607687-10.853662 9.829732-20.785787 15.666135-29.796373a192.49891 192.49891 0 0 1 25.086294-29.796374z" fill="#FF9500" p-id="3546"></path></svg>'), i(this, "deleteSvg", '<svg t="1760921450746" class="jhs-icon icon" viewBox="0 0 1194 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4530" width="200" height="200"><path d="M761.086847 36.028779s309.754321-147.538628 424.952209 231.50509c2.047962 6.570546 71.337359 253.862013-220.838618 415.139055-12.970429 7.167869-267.515096 145.746661-370.339877 341.327076 0 0-90.963666-205.649563-393.379455-351.566888-6.399883-3.071944-304.549083-156.583796-163.751664-487.2444 3.669266-8.533177 163.666333-336.20717 466.423449-99.411511l24.575549 27.391498L387.931021 324.279495l237.648977 159.570408-109.139333 145.746661L625.579998 849.069874l-30.719437-205.820227 166.226286-169.81022-216.486698-168.103585L761.086847 36.028779z" fill="#F4382E" p-id="4531"></path></svg>'), i(this, "checkSvg", '<svg t="1760921633527" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5603" width="200" height="200"><path d="M924.928 544A413.76 413.76 0 0 1 544 924.736v3.264h-64v-3.2A413.696 413.696 0 0 1 99.072 544H96v-64h3.072A413.696 413.696 0 0 1 480 99.2V96h64v3.2a413.76 413.76 0 0 1 380.928 380.8h3.072v64h-3.072z m-64-64A350.016 350.016 0 0 0 544 163.2V288h-64V163.2A350.016 350.016 0 0 0 163.072 480H288v64H163.072A350.016 350.016 0 0 0 480 860.8V736h64v124.8a350.016 350.016 0 0 0 316.928-316.8H736v-64h124.928zM512 544a32 32 0 1 1 32-32 32 32 0 0 1-32 32z" fill="#333333" p-id="5604"></path></svg>'), i(this, "actressSvg", '<svg t="1760926744637" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1948" width="200" height="200"><path d="M265.950168 668.467036V209.809493A209.809493 209.809493 0 0 1 475.759661 0h40.949536A209.809493 209.809493 0 0 1 726.564189 209.809493v440.435" p-id="1949"></path><path d="M916.558657 825.861124a193.463804 193.463804 0 0 0-137.442564-155.83573l-186.001889-45.795231-10.487631-124.293214H424.106373L412.231008 624.025416l-170.623063 44.44162a193.452429 193.452429 0 0 0-133.666108 154.698244L76.410695 1023.192384h871.189985z" fill="#FFE7D9" p-id="1950"></path><path d="M668.472724 265.682859c68.431223-29.187919 96.140409 100.349111 5.20969 151.774902z" fill="#FFCFB5" p-id="1951"></path><path d="M676.378259 334.421203c1.137487-99.814492-38.674561-172.158671-38.674561-172.15867l-59.740822 11.920865a493.805894 493.805894 0 0 1-80.761583 9.099896 493.669396 493.669396 0 0 1-80.761583-9.099896l-59.683948-11.88674s-39.812048 72.344179-38.776934 172.15867l-1.080613 92.05683c5.209691 56.271486 92.4777 121.381247 195.022161 119.163147 61.196805 0.034125 165.59537-51.573665 165.59537-119.197272z" fill="#FFE7D9" p-id="1952"></path><path d="M322.198905 274.703131c-68.419848-29.187919-96.140409 100.349111-5.209691 151.774902z" fill="#FFCFB5" p-id="1953"></path><path d="M297.390311 812.461526H742.034014a38.458438 38.458438 0 0 1 38.458438 38.458439V1020.325917H258.931873V850.90859a38.458438 38.458438 0 0 1 38.458438-38.447064z" fill="#FFD527" p-id="1954"></path><path d="M690.539973 92.284327c-20.645391 84.287793-275.613121 235.323328-424.589805 117.525166l104.955934-95.548915 139.399042-64.529643z" p-id="1955"></path><path d="M285.321573 383.708519h33.624119v177.118114h-33.624119zM675.855015 383.708519h33.624118v177.118114h-33.624118z" fill="#FFD527" p-id="1956"></path></svg>'), i(this, "newSvg", '<svg t="1760926857487" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3954" width="200" height="200"><path d="M508.330667 733.994667c-11.008-7.338667-13.44-17.109333-7.338667-29.333334 28.117333-37.888 41.557333-98.986667 40.341333-183.317333v-165.013333c0-14.656 7.338667-23.210667 21.994667-25.664 37.888-1.216 82.496-5.504 133.845333-12.842667 13.44-2.432 21.376 3.072 23.829334 16.512 1.216 12.224-4.266667 19.562667-16.512 21.994667a1787.093333 1787.093333 0 0 1-113.664 11.008c-6.101333 0-9.173333 3.669333-9.173334 10.986666v84.330667h135.68c12.224 1.237333 18.944 7.957333 20.16 20.181333-1.216 10.986667-7.936 17.109333-20.16 18.346667h-36.672v223.658667c-1.216 12.202667-7.936 18.944-20.16 20.16-11.008-1.216-17.109333-7.957333-18.346666-20.16V501.162667h-60.48v18.346666c1.216 92.885333-13.44 161.92-44.010667 207.146667-6.101333 12.224-15.893333 14.677333-29.333333 7.338667z m-131.989334-282.325334c-1.237333 0-2.453333 0.618667-3.669333 1.834667h45.824a522.666667 522.666667 0 0 0 16.512-31.168c7.317333-12.224 12.224-20.778667 14.656-25.664 6.122667-11.008 15.274667-14.677333 27.52-11.008 9.770667 6.122667 12.202667 14.058667 7.317333 23.829333-4.906667 9.792-13.44 24.448-25.664 44.010667h49.493334c9.770667 1.216 15.274667 6.72 16.512 16.490667-1.237333 11.008-6.741333 17.109333-16.512 18.346666h-82.496a12.437333 12.437333 0 0 1 3.669333 9.173334v38.485333h69.653333c9.792 1.216 15.296 6.72 16.512 16.490667-1.216 11.008-6.72 17.130667-16.512 18.346666h-69.653333v108.16c0 34.218667-15.274667 51.946667-45.845333 53.162667h-16.490667a195.157333 195.157333 0 0 1-20.16 1.834667c-12.224 0-19.562667-6.72-22.016-20.16 1.237333-12.224 7.338667-18.944 18.346667-20.16 2.432 0 6.101333 0.597333 10.986666 1.834666h11.008c15.893333 0 23.829333-8.554667 23.829334-25.685333v-98.986667H314.026667c-11.008-1.216-17.109333-7.338667-18.346667-18.346666 1.237333-9.770667 7.338667-15.274667 18.346667-16.490667h75.157333V497.493333c0-3.669333 1.216-6.72 3.669333-9.173333h-89.813333c-11.029333-1.216-17.130667-7.317333-18.346667-18.325333 1.216-9.770667 7.317333-15.274667 18.346667-16.490667h56.810667c-3.669333-1.216-6.72-4.266667-9.173334-9.173333-1.216-1.216-3.050667-4.266667-5.482666-9.173334a758.336 758.336 0 0 0-14.677334-23.829333c-4.885333-9.770667-3.050667-17.706667 5.504-23.829333 11.008-3.669333 19.562667-1.216 25.664 7.338666 2.453333 2.432 6.122667 7.338667 11.008 14.656 6.101333 8.554667 9.770667 14.08 10.986667 16.512 4.906667 9.770667 2.453333 18.346667-7.317333 25.664z m-60.501333-71.509333c-9.792-1.216-15.274667-7.317333-16.512-18.346667 1.237333-9.749333 6.72-15.253333 16.512-16.490666h75.157333c-3.669333-12.202667-7.338667-21.973333-10.986666-29.333334-1.237333-12.202667 3.648-19.541333 14.656-21.973333 12.224-2.453333 21.397333 1.216 27.52 10.986667 0 1.216 0.597333 3.669333 1.813333 7.338666 4.906667 15.872 9.173333 26.88 12.842667 32.981334h60.48c11.008 1.237333 17.130667 6.741333 18.346666 16.512-1.216 11.008-7.338667 17.109333-18.346666 18.346666h-181.482667z m-14.677333 311.68c-8.533333-6.122667-10.986667-14.08-7.338667-23.829333a1659.648 1659.648 0 0 0 33.002667-66.005334c4.906667-9.792 12.224-12.842667 22.016-9.173333 9.770667 4.906667 13.44 12.224 10.986666 21.994667-3.669333 6.122667-9.173333 17.728-16.490666 34.837333-8.554667 15.893333-14.677333 27.52-18.346667 34.837333-4.885333 8.554667-12.821333 11.008-23.829333 7.338667z m201.664-25.664c-9.770667 4.885333-18.346667 2.432-25.664-7.338667a1138.56 1138.56 0 0 1-27.498667-44.010666c-4.885333-8.533333-3.050667-16.490667 5.504-23.829334 9.770667-3.669333 18.346667-1.216 25.664 7.338667l14.677333 21.994667c6.101333 9.770667 10.389333 17.109333 12.821334 21.994666 4.906667 8.554667 3.050667 16.512-5.504 23.850667z" fill="#333333" p-id="3955"></path><path d="M675.328 117.717333A425.429333 425.429333 0 0 0 512 85.333333C276.352 85.333333 85.333333 276.352 85.333333 512s191.018667 426.666667 426.666667 426.666667 426.666667-191.018667 426.666667-426.666667c0-56.746667-11.093333-112-32.384-163.328a21.333333 21.333333 0 0 0-39.402667 16.341333A382.762667 382.762667 0 0 1 896 512c0 212.074667-171.925333 384-384 384S128 724.074667 128 512 299.925333 128 512 128c51.114667 0 100.8 9.984 146.986667 29.12a21.333333 21.333333 0 0 0 16.341333-39.402667z" fill="#333333" p-id="3956"></path></svg>'), i(this, "refreshSvg", '<svg t="1760926993643" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5942" width="200" height="200"><path d="M511.966722 0a511.966722 511.966722 0 1 0 179.828311 32.445891l-22.46254 59.964102A447.970882 447.970882 0 1 1 511.966722 63.99584a31.99792 31.99792 0 0 0 0-63.99584z" fill="#333333" p-id="5943"></path><path d="M649.2378 9.151405A30.909991 30.909991 0 0 1 671.316364 0h193.267438a31.99792 31.99792 0 0 1 31.357962 31.99792c0 17.662852-13.759106 31.99792-31.357962 31.99792H703.954243v160.629559a31.99792 31.99792 0 0 1-31.99792 31.357962 31.485953 31.485953 0 0 1-31.99792-31.357962V31.357962c0-8.511447 3.647763-16.318939 9.343392-21.950573z" fill="#333333" p-id="5944"></path></svg>'), i(this, "blacklistSvg", '<svg t="1761386375897" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1936" width="200" height="200"><path d="M513.199827 65.667605c-246.537999 0-446.399933 199.861934-446.399933 446.399933 0 246.553349 199.861934 446.399933 446.399933 446.399933 246.553349 0 446.399933-199.846584 446.399933-446.399933C959.599759 265.529539 759.753175 65.667605 513.199827 65.667605zM513.199827 894.697075c-211.320916 0-382.629537-171.322947-382.629537-382.628514 0-94.183056 34.029024-180.417069 90.461291-247.080352l165.389818 165.389818c4.320399 39.651069 26.816762 73.840752 58.981323 94.068446-72.189136 27.369348-123.517151 97.156784-123.517151 178.936345l337.541643 0 100.846826 100.846826C693.608709 860.664981 607.375719 894.697075 513.199827 894.697075zM805.362956 759.14175 697.264982 651.0448c-16.556071-58.332547-60.10082-105.306394-116.275213-126.601396 35.888372-22.570042 59.752896-62.511729 59.752896-108.032482 0-70.436212-57.108672-127.542838-127.542838-127.542838-48.218188 0-90.184999 26.765597-111.865787 66.245773L266.120498 219.900316c66.663282-56.432267 152.897296-90.461291 247.079328-90.461291 211.304544 0 382.628514 171.308621 382.628514 382.629537C895.82834 606.244454 861.796246 692.476421 805.362956 759.14175z" fill="#272636" p-id="1937"></path></svg>'), i(this, "copySvg", '<svg t="1749017229420" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9184" width="200" height="200"><path d="M512 74.666667C270.933333 74.666667 74.666667 270.933333 74.666667 512S270.933333 949.333333 512 949.333333 949.333333 753.066667 949.333333 512 753.066667 74.666667 512 74.666667z m0 810.666666c-204.8 0-373.333333-168.533333-373.333333-373.333333S307.2 138.666667 512 138.666667 885.333333 307.2 885.333333 512 716.8 885.333333 512 885.333333z" fill="#666666" p-id="9185"></path><path d="M512 512m-42.666667 0a42.666667 42.666667 0 1 0 85.333334 0 42.666667 42.666667 0 1 0-85.333334 0Z" fill="#666666" p-id="9186"></path><path d="M341.333333 512m-42.666666 0a42.666667 42.666667 0 1 0 85.333333 0 42.666667 42.666667 0 1 0-85.333333 0Z" fill="#666666" p-id="9187"></path><path d="M682.666667 512m-42.666667 0a42.666667 42.666667 0 1 0 85.333333 0 42.666667 42.666667 0 1 0-85.333333 0Z" fill="#666666" p-id="9188"></path></svg>'), i(this, "titleSvg", '<svg t="1747553289744" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7507" width="200" height="200"><path d="M959.8 150.8c0-2.3-1.9-4.2-4.2-4.2H253.3c-2.3 0-4.2 1.9-4.2 4.2v115.9c0 2.3 1.9 4.2 4.2 4.2h702.3c2.3 0 4.2-1.9 4.2-4.2V150.8z" fill="" p-id="7508"></path><path d="M126.4 208.8m-62.2 0a62.2 62.2 0 1 0 124.4 0 62.2 62.2 0 1 0-124.4 0Z" fill="" p-id="7509"></path><path d="M851.5 453.7c0-2.1-1.8-3.9-3.9-3.9H252.9c-2.1 0-3.9 1.7-3.9 3.9v116.6c0 2.1 1.7 3.9 3.9 3.9h594.7c2.1 0 3.9-1.7 3.9-3.9V453.7z" fill="" p-id="7510"></path><path d="M126.4 512m-62.2 0a62.2 62.2 0 1 0 124.4 0 62.2 62.2 0 1 0-124.4 0Z" fill="" p-id="7511"></path><path d="M851.5 756.9c0-2.1-1.8-3.9-3.9-3.9H252.9c-2.1 0-3.9 1.8-3.9 3.9v116.6c0 2.1 1.7 3.9 3.9 3.9h594.7c2.1 0 3.9-1.7 3.9-3.9V756.9z" fill="" p-id="7512"></path><path d="M126.4 815.2m-62.2 0a62.2 62.2 0 1 0 124.4 0 62.2 62.2 0 1 0-124.4 0Z" fill="" p-id="7513"></path></svg>'), i(this, "carNumSvg", '<svg t="1747552574854" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3539" width="200" height="200"><path d="M920.337035 447.804932c-6.067182-6.067182-10.918677-11.643178-16.985859-17.71036l48.536436-30.334889-42.469254-109.207238-121.340579 12.134365c-6.067182-6.067182-6.067182-12.134365-12.134365-18.201547-12.134365-12.134365-18.201547-24.267706-24.267706-30.334889-24.26873-36.402071-30.334889-42.469254-54.603619-42.469254H339.116511c-18.201547 0-24.267706 6.067182-54.603619 42.469254-6.067182 6.067182-12.134365 18.201547-24.267706 30.334889 0 0-6.067182 6.067182-12.134365 18.201547l-115.27442-12.134365-48.536436 109.207238 51.090608 24.378223c-6.067182 6.067182-30.334889 34.660404-30.334889 34.660405l-15.542998 22.280446-12.282744 17.018605c-6.067182 12.134365-5.064342 10.868535-5.064342 29.070082v224.480635c0 36.402071 18.201547 60.670801 54.603618 60.670801h115.273397c36.402071 0 54.603619-24.267706 54.603619-54.603619v-18.201547h424.693562v18.201547c0 30.334889 18.201547 54.603619 54.603618 54.603619h115.273397c36.402071 0 60.670801-24.267706 60.670801-60.670801V539.300786c0-42.469254 0.685615-46.662763-11.44875-64.863287-4.731768-6.744611-11.94403-16.196891-20.101827-26.632567z m-35.186383-78.381161l-30.334889 18.201547-12.134365-12.134365c-6.067182-8.899694-12.134365-12.134365-12.134365-18.201547l42.469254-6.067183 12.134365 18.201548z m-533.899776-97.072873h339.755054l78.871325 103.140055H272.378527l78.872349-103.140055zM175.305655 357.290429h36.402071c-6.067182 6.067182-6.067182 12.134365-12.134365 18.201547l-18.201547 6.067183-18.201547-12.134365 12.135388-12.134365z m667.375743 394.35765h-54.603619V678.843936H242.043638v72.804143H132.837424V527.167444c0-12.134365-0.041956-20.662599 1.216711-23.556508 1.258667-2.89391 9.955746-16.924461 21.193695-29.173437l35.722596-38.276768h639.576607l21.917172 20.938891c6.067182 6.067182 21.847587 21.366633 25.712615 28.732392 7.621585 9.996678 6.973832 10.999518 13.041014 23.133883v242.682182h-48.536436zM242.043638 533.234627h133.474944v60.670801H242.043638v-60.670801z m412.559197 0h133.474944v60.670801H654.602835v-60.670801z" p-id="3540"></path></svg>'), i(this, "downSvg", '<svg t="1747552626242" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4551" width="200" height="200"><path d="M641.6 660l-8.64-64 32-4.32a211.2 211.2 0 0 0-26.72-420.32 215.36 215.36 0 0 0-213.12 192 94.56 94.56 0 0 0 0 11.52v41.28h-64V384v-7.04a153.12 153.12 0 0 1 0-19.52A279.84 279.84 0 0 1 636.16 108H640A275.2 275.2 0 0 1 673.28 656z" fill="#333333" p-id="4552"></path><path d="M490.4 446.24l-7.52-39.84a182.4 182.4 0 0 1 107.52-162.88l29.12-13.28L646.08 288l-29.12 13.28a117.92 117.92 0 0 0-70.08 101.28l6.24 30.4zM392.96 652.32h-78.72A202.24 202.24 0 0 1 256 256l30.72-9.12 18.24 61.28-30.72 9.12a138.24 138.24 0 0 0 39.68 270.72h78.72zM479.2 512h64v320h-64z" fill="#333333" p-id="4553"></path><path d="M510.4 908l-156.32-147.68 43.84-46.4 112.48 106.08 112.8-106.08 43.84 46.56-156.64 147.52z" fill="#333333" p-id="4554"></path></svg>'), i(this, "handleSvg", '<svg t="1749106236917" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2628" width="200" height="200"><path d="M838 989.48a32 32 0 0 1-22.5-9.22L519.3 687.6 207.48 980.8a32 32 0 0 1-54-23.32V136.52A98.54 98.54 0 0 1 252 38.1h519.6A98.52 98.52 0 0 1 870 136.52v820.96a32 32 0 0 1-32 32zM252 102.1a34.46 34.46 0 0 0-34.42 34.42v746.96L498 619.84a32 32 0 0 1 44.42 0.56L806 880.88V136.52a34.46 34.46 0 0 0-34.4-34.42z" p-id="2629"></path><path d="M648 604.92a28 28 0 0 1-16.46-5.34l-112.84-82-112.84 82a28 28 0 0 1-43.08-31.32l43.1-132.64-112.84-82a28 28 0 0 1 16.46-50.66h139.48L492 170.34a28 28 0 0 1 53.26 0l43.1 132.64h139.48a28 28 0 0 1 16.46 50.66l-112.84 82 43.1 132.64A28 28 0 0 1 648 604.92z m-129.3-150a27.86 27.86 0 0 1 16.46 5.36l59.58 43.28-22.76-70a28 28 0 0 1 10.02-31.28l59.58-43.3H568a28 28 0 0 1-26.64-19.34l-22.76-70-22.76 70a28 28 0 0 1-26.62 19.34h-73.64l59.58 43.3a28 28 0 0 1 10.16 31.3l-22.76 70 59.58-43.28a28 28 0 0 1 16.46-5.32z" p-id="2630"></path></svg>'), i(this, "siteSvg", '<svg t="1749107903569" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="12439" width="200" height="200"><path d="M882.758621 133.674884C882.758621 59.84828 822.91034 0 749.083736 0 675.25715 0 615.40887 59.84828 615.40887 133.674884 615.40887 163.358402 625.152318 191.656395 642.813352 214.773283L670.872117 193.336726 648.314739 166.170836 253.911693 493.666092 276.469054 520.831982 302.371681 496.834595C277.256669 469.725608 241.995388 453.990153 204.295574 453.990153 130.46897 453.990153 70.62069 513.838433 70.62069 587.66502 70.62069 661.491624 130.46897 721.339904 204.295574 721.339904 255.555319 721.339904 301.619094 692.208675 324.036714 647.136344L276.646223 663.002394 706.082022 877.440106 721.856794 845.849335 690.37312 829.861888C680.932829 848.452414 675.940882 869.068818 675.940882 890.325116 675.940882 964.15172 735.789162 1024 809.615766 1024 883.442353 1024 943.290633 964.15172 943.290633 890.325116 943.290633 874.050807 940.36533 858.125365 934.723584 843.16446L868.645076 868.0826C871.294817 875.109252 872.669943 882.595452 872.669943 890.325116 872.669943 925.14899 844.439623 953.37931 809.615766 953.37931 774.791892 953.37931 746.561571 925.14899 746.561571 890.325116 746.561571 880.245089 748.902894 870.575616 753.340487 861.836782L769.436089 830.140063 737.631567 814.258564 308.195769 599.820853 276.554929 584.02108 260.805279 615.686903C250.212352 636.984797 228.494795 650.719214 204.295574 650.719214 169.4717 650.719214 141.241379 622.488894 141.241379 587.66502 141.241379 552.841163 169.4717 524.610842 204.295574 524.610842 222.12269 524.610842 238.680594 531.99985 250.566444 544.829369L273.29589 569.363385 299.026432 547.997855 693.429478 220.502616 719.514606 198.84265 698.930882 171.900169C690.596687 160.991373 686.029559 147.727007 686.029559 133.674884 686.029559 98.85101 714.25988 70.62069 749.083736 70.62069 783.90761 70.62069 812.137931 98.85101 812.137931 133.674884 812.137931 148.208022 807.249885 161.899255 798.379608 172.996785L853.543883 217.089695C872.331935 193.584128 882.758621 164.379366 882.758621 133.674884ZM749.083736 196.729062C729.149334 196.729062 710.818745 187.460449 698.930882 171.900169L642.813352 214.773283C667.922573 247.639305 706.904064 267.349751 749.083736 267.349751 790.225902 267.349751 828.357809 248.599782 853.543883 217.089695L798.379608 172.996785C786.455411 187.915034 768.530291 196.729062 749.083736 196.729062ZM337.970441 587.66502C337.970441 553.551854 325.093782 521.360666 302.371681 496.834595L250.566444 544.829369C261.309069 556.424898 267.349751 571.526356 267.349751 587.66502 267.349751 597.565263 265.091478 607.069184 260.805279 615.686903L324.036714 647.136344C333.156105 628.801148 337.970441 608.540036 337.970441 587.66502ZM809.615766 756.650249C758.753986 756.650249 712.986006 785.330865 690.37312 829.861888L753.340487 861.836782C764.027215 840.791658 785.603302 827.270938 809.615766 827.270938 836.08553 827.270938 859.461862 843.730308 868.645076 868.0826L934.723584 843.16446C915.252259 791.529949 865.714547 756.650249 809.615766 756.650249Z" fill="#389BFF" p-id="12440"></path></svg>'), i(this, "videoSvg", '<svg t="1749003664455" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1952" width="200" height="200"><path d="M825.6 153.6H198.4C124.5 153.6 64 214.1 64 288v448c0 73.9 60.5 134.4 134.4 134.4h627.2c73.9 0 134.4-60.5 134.4-134.4V288c0-73.9-60.5-134.4-134.4-134.4z m-138.2 44.8l112 112H706l-112-112h93.4z m-156.8 0l112 112H526.7l-112-112h115.9z m-179.2 0l112 112H347.5l-112-112h115.9zM108.8 288c0-41.4 28.4-76.1 66.7-86.3l108.7 108.7H108.8V288z m806.4 448c0 49.4-40.2 89.6-89.6 89.6H198.4c-49.4 0-89.6-40.2-89.6-89.6V355.2h806.4V736z m0-425.6h-52.5l-112-112h74.9c49.4 0 89.6 40.2 89.6 89.6v22.4z" p-id="1953"></path><path d="M454 687.2l149.3-77.6c27.5-13.8 27.5-53 0-66.8L468 472.2c-31.2-15.6-68 7.1-68 42v139.6c0 27.8 29.2 45.8 54 33.4zM444.8 512l134.4 67.2-134.4 67.2V512z" p-id="1954"></path></svg>'), i(this, "screenSvg", '<svg t="1750691468062" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2693" width="200" height="200"><path d="M288 160a64 64 0 0 0-64 64v576a64 64 0 0 0 64 64h448a64 64 0 0 0 64-64v-576a64 64 0 0 0-64-64h-448m0-64h448a128 128 0 0 1 128 128v576a128 128 0 0 1-128 128h-448a128 128 0 0 1-128-128v-576a128 128 0 0 1 128-128z" fill="#4078FD" p-id="2694"></path><path d="M416 352m-64 0a64 64 0 1 0 128 0 64 64 0 1 0-128 0Z" fill="#FE9C23" p-id="2695"></path><path d="M352 732.448a32 32 0 0 1-32-32v-160a32 32 0 0 1 44.224-29.568l130.112 53.632 153.952-169.984a32 32 0 0 1 55.712 21.472v284.448a32 32 0 0 1-32 32z m0-32h320z" fill="#4078FD" opacity=".2" p-id="2696"></path><path d="M672 416l-169.088 186.656-150.912-62.208v160h320V416m0-32a32 32 0 0 1 32 32v284.448a32 32 0 0 1-32 32h-320a32 32 0 0 1-32-32v-160a32 32 0 0 1 44.192-29.6l130.112 53.632 153.984-169.984a32 32 0 0 1 23.712-10.496z" fill="#4078FD" p-id="2697"></path></svg>'), i(this, "recoveryVideoSvg", '<svg t="1749003779161" class="jhs-icon icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8204" width="200" height="200"><path d="M938.666667 553.92V768c0 64.8-52.533333 117.333333-117.333334 117.333333H202.666667c-64.8 0-117.333333-52.533333-117.333334-117.333333V256c0-64.8 52.533333-117.333333 117.333334-117.333333h618.666666c64.8 0 117.333333 52.533333 117.333334 117.333333v297.92z m-64-74.624V256a53.333333 53.333333 0 0 0-53.333334-53.333333H202.666667a53.333333 53.333333 0 0 0-53.333334 53.333333v344.48A290.090667 290.090667 0 0 1 192 597.333333a286.88 286.88 0 0 1 183.296 65.845334C427.029333 528.384 556.906667 437.333333 704 437.333333c65.706667 0 126.997333 16.778667 170.666667 41.962667z m0 82.24c-5.333333-8.32-21.130667-21.653333-43.648-32.917333C796.768 511.488 753.045333 501.333333 704 501.333333c-121.770667 0-229.130667 76.266667-270.432 188.693334-2.730667 7.445333-7.402667 20.32-13.994667 38.581333-7.68 21.301333-34.453333 28.106667-51.370666 13.056-16.437333-14.634667-28.554667-25.066667-36.138667-31.146667A222.890667 222.890667 0 0 0 192 661.333333c-14.464 0-28.725333 1.365333-42.666667 4.053334V768a53.333333 53.333333 0 0 0 53.333334 53.333333h618.666666a53.333333 53.333333 0 0 0 53.333334-53.333333V561.525333zM320 480a96 96 0 1 1 0-192 96 96 0 0 1 0 192z m0-64a32 32 0 1 0 0-64 32 32 0 0 0 0 64z" fill="#000000" p-id="8205"></path></svg>');
        const e2 = ["settingSvg", "editSvg", "deleteSvg", "checkSvg", "actressSvg", "newSvg", "refreshSvg", "blacklistSvg", "copySvg", "titleSvg", "carNumSvg", "downSvg", "handleSvg", "siteSvg", "videoSvg", "screenSvg", "recoveryVideoSvg"];
        _BasePlugin._sharedIcons = Object.fromEntries(e2.map(((e3) => [e3, this[e3]])));
        Object.assign(_BasePlugin.prototype, _BasePlugin._sharedIcons);
        e2.forEach(((e3) => delete this[e3]));
      }
      i(this, "pluginManager", null);
    }
    getName() {
      throw new Error(`${this.constructor.name} 未显示getName()`);
    }
    getBean(e2) {
      return this.pluginManager.getBean(e2);
    }
    async initCss() {
      return "";
    }
    async handle() {
    }
    getStartupMode() {
      return "immediate";
    }
    shouldSkipOnMobile() {
      return false;
    }
    getPageInfo() {
      let carNum = null, t2, n2, a2, i2, s2 = window.location.href;
      if (r) {
        const params = new URL(s2).searchParams, injectedCarNum = normalizeCarNum(params.get("jhsCarNum"));
        const copyCarNum = normalizeCarNum($('.column-video-info a[data-clipboard-text][title*="番"], .video-detail a[data-clipboard-text][title*="番"]').first().attr("data-clipboard-text")) || normalizeCarNum($('a[title="複製番號"]').attr("data-clipboard-text"));
        let panelCarNum = null;
        $(".column-video-info .panel-block, .video-detail .panel-block").each((function() {
          const label = $(this).find("strong, .label").first().text().trim();
          if (panelCarNum || !/(?:番号|番號|^ID)\s*[:：]?/i.test(label)) return;
          panelCarNum = normalizeCarNum($(this).find("[data-clipboard-text]").first().attr("data-clipboard-text")) || normalizeCarNum($(this).find(".value").first().text());
        }));
        const fallbackCarNum = normalizeCarNum($("#video_id, .video-id, .video-title strong").first().text());
        carNum = firstValidCarNum(injectedCarNum, copyCarNum, panelCarNum, fallbackCarNum);
        t2 = s2.split("?")[0].split("#")[0], n2 = $(".female").prev().map(((e2, t3) => $(t3).text())).get().join(" "), a2 = $(".male").prev().map(((e2, t3) => $(t3).text())).get().join(" "), i2 = $('strong:contains("日期:")').parent(".panel-block").find(".value").text().trim();
      }
      l && (t2 = s2.split("?")[0], carNum = normalizeCarNum(t2.split("/").filter(Boolean).pop().replace(/_\d{4}-\d{2}-\d{2}$/, "")), n2 = $('span[onmouseover*="star_"] a').map(((e2, t3) => $(t3).text())).get().join(" "), a2 = "", i2 = $('span.header:contains("發行日期:")').parent("p").text().trim().replace("發行日期:", "").trim());
      return assertPageInfoContract({
        carNum,
        url: t2,
        actress: n2,
        actors: a2,
        publishTime: i2
      });
    }
    getActressId() {
      const e2 = o.match(/\/actors\/([^/?]+)/);
      return e2 && e2.length > 1 ? e2[1] : null;
    }
    getActressPageInfo() {
      let e2 = window.location.href;
      if (!e2.includes("/actors/") && !e2.includes("/star/")) throw new Error("接口调用错误, 非演员详情页");
      let t2 = [], n2 = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
      n2.length && n2.text().trim().split(",").forEach(((e3) => {
        t2.push(e3.trim());
      }));
      let a2 = $(".section-meta:not(:contains('影片'))");
      a2.length && a2.text().trim().split(",").forEach(((e3) => {
        t2.push(e3.trim());
      }));
      let i2 = $(".section-meta:contains('男優')").length > 0 ? B : P, s2 = D;
      t2.some(((e3) => e3.includes("無碼"))) && (s2 = A), e2.includes("uncensored") && (s2 = A);
      let o2 = null, c2 = null;
      const d2 = new URL(e2);
      if (r) {
        c2 = d2.pathname.split("/").filter(((e4) => "" !== e4.trim())).pop();
        const e3 = d2.searchParams;
        e3.delete("sort_type"), e3.delete("page"), o2 = d2.toString();
      } else if (l) {
        const t3 = "/star/", n3 = e2.split(t3);
        if (n3.length < 2) throw new Error("提取演员url失败");
        const a3 = n3[0];
        c2 = n3[1].split("/")[0], o2 = a3 + t3 + c2;
      }
      return {
        starId: c2,
        name: t2[0],
        allName: t2,
        role: i2,
        movieType: s2,
        blacklistUrl: o2
      };
    }
    getSelector(e2) {
      const t2 = e2 || (r ? T : l ? I : null), n2 = {
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
      if (!t2 || !n2[t2]) throw new Error("类型错误: 无法确定选择器类型 (JavDb 或 JavBus)");
      return n2[t2];
    }
    parseMovieId(e2) {
      return e2.split("/").pop().split(/[?#]/)[0];
    }
    getBoxCarInfo(e2) {
      var t2, n2, a2;
      const i2 = e2.find("a"), s2 = i2.attr("href");
      let o2 = null, r2 = null, l2 = null;
      const c2 = e2.find(".video-title");
      if (c2.length > 0) {
        const n3 = c2.find("strong");
        if (n3.length > 0 && (o2 = n3.text().trim()), r2 = null == (t2 = i2.attr("title")) ? void 0 : t2.trim(), !r2) {
          const e3 = c2.text().trim();
          r2 = o2 && e3.includes(o2) ? e3.replace(o2, "").trim() : e3;
        }
        l2 = e2.find(".meta").text().trim();
      }
      if (!o2) {
        const t3 = e2.find("img");
        t3.length > 0 && (r2 = (null == (n2 = t3.attr("title")) ? void 0 : n2.trim()) || (null == (a2 = t3.attr("data-title")) ? void 0 : a2.trim()));
        const i3 = e2.find("date").map(((e3, t4) => $(t4).text().trim())).get(), s3 = /* @__PURE__ */ __name((e3) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(e3), "s");
        l2 = i3.find(s3) || null, o2 = i3.find(((e3) => !s3(e3))) || null;
      }
      if (!o2) {
        const t3 = "提取番号信息失败: carNum 为空";
        throw clog.error("Error in getBoxCarInfo:", t3, "Box Element:", e2.get(0)), show.error(t3), new Error(t3);
      }
      return {
        carNum: o2,
        url: s2 || "",
        title: r2 || "",
        publishTime: l2 || ""
      };
    }
    getBoxCarInfoList(e2 = null) {
      if (e2 || (e2 = $(this.getSelector().itemSelector)), 0 === e2.length) return clog.error("获取当前列表页所有item的番号信息失败!"), [];
      const t2 = [];
      return e2.each(((e3, n2) => {
        const a2 = $(n2);
        try {
          const e4 = this.getBoxCarInfo(a2);
          t2.push(e4);
        } catch (i2) {
          clog.error("[getBoxCarInfoList] 提取单个 boxCar 信息失败:", i2.message, "元素索引:", e3);
        }
      })), t2;
    }
    checkDuplicateCarNumbers(e2, t2) {
      if (!e2 || 0 === e2.length || !t2 || 0 === t2.length) return false;
      const n2 = new Set(e2.map(((e3) => e3.carNum)).filter(((e3) => e3)));
      if (0 === n2.size) return false;
      let a2 = 0;
      for (let i2 = 0; i2 < t2.length; i2++) {
        const e3 = t2[i2] ? t2[i2].carNum : null;
        if (e3 && n2.has(e3)) {
          if (a2++, a2 >= 2) return clog.warn("警告: 检测到连续番号信息重复, 该类别可能已被限制页码。"), true;
        } else a2 = 0;
      }
      return false;
    }
  };
  __name(_BasePlugin, "BasePlugin");
  var BasePlugin = _BasePlugin;
  function normalizeJavStoreAssetUrl(value, baseUrl = "https://javstore.net") {
    if (!value) return null;
    try {
      const url = new URL(String(value), baseUrl), hostname = url.hostname.toLowerCase();
      if (!["http:", "https:"].includes(url.protocol)) return null;
      "http:" === url.protocol && ("javstore.net" === hostname || hostname.endsWith(".javstore.net")) && (url.protocol = "https:");
      return url.href;
    } catch {
      return null;
    }
  }
  __name(normalizeJavStoreAssetUrl, "normalizeJavStoreAssetUrl");
  function parseJavStoreSearch($searchPage, carNum, baseUrl = "https://javstore.net") {
    const normalizedCarNum = normalizeCarNum(carNum);
    if (!normalizedCarNum) return [];
    return $searchPage.find('a[href$="-pn.html"]').filter(((index, element) => $(element).text().trim().toUpperCase().includes(normalizedCarNum.toUpperCase()))).map(((index, element) => new URL($(element).attr("href"), baseUrl).href)).get();
  }
  __name(parseJavStoreSearch, "parseJavStoreSearch");
  function parseJavStorePreview($detailPage, detailUrl) {
    const previewHref = $detailPage.find("a").filter(((index, element) => "CLICK HERE!" === $(element).text().trim())).first().attr("href");
    if (!previewHref) return null;
    const previewUrl = normalizeJavStoreAssetUrl(previewHref, detailUrl);
    return previewUrl ? previewUrl.replace(".th", "") : null;
  }
  __name(parseJavStorePreview, "parseJavStorePreview");
  function parseJavDbActorList($page, baseUrl) {
    const actors = [];
    $page.find("#actors .actor-box a").each(((index, element) => {
      const $actor = $(element), title = $actor.attr("title"), href = $actor.attr("href");
      if (!title || !href) return;
      const allName = title.split(",").map(((name) => name.trim())).filter(Boolean);
      const actorUrl = new URL(href, baseUrl);
      const starId = actorUrl.pathname.split("/").filter(Boolean).pop() || "";
      actors.push({
        starId,
        name: allName[0] || "",
        allName,
        avatar: $actor.find("img").attr("src"),
        actressType: $actor.find(".info").text().trim().includes("無碼") ? A : D,
        lastCheckTime: null,
        lastUpdateTime: null
      });
    }));
    const nextHref = $page.find(".pagination-next").attr("href");
    return { actors, nextUrl: nextHref ? new URL(nextHref, baseUrl).href : null };
  }
  __name(parseJavDbActorList, "parseJavDbActorList");
  function parseDetailPage($page, selectors) {
    const challengeText = $page.find("title, body").text();
    const isChallenge = /Just a moment|cf-chl-|Cloudflare/i.test(challengeText);
    const hasContainer = $page.find(selectors.boxSelector).length > 0;
    return {
      state: isChallenge ? "challenge" : hasContainer ? "valid" : "invalid",
      items: hasContainer ? $page.find(selectors.requestDomItemSelector) : null,
      isEmpty: hasContainer && 0 === $page.find(selectors.requestDomItemSelector).length
    };
  }
  __name(parseDetailPage, "parseDetailPage");
  function parse123AvCards($page, baseUrl = "https://123av.com") {
    const items = /* @__PURE__ */ new Map();
    $page.find(".card").each(((index, element) => {
      const $card = $(element);
      const $link = $card.find('a.card__link[href*="/cn/v/fc2-ppv-"]').first();
      const href = $link.attr("href"), text = $link.text().trim();
      const numberMatch = text.match(/FC2-PPV-(\d+)/i);
      if (!href || !numberMatch) return;
      const carNum = `FC2-${numberMatch[1]}`;
      const detailUrl = new URL(href, baseUrl);
      detailUrl.hash = "";
      items.set(carNum, {
        imgSrc: $card.find("img.card__img[src]").first().attr("src") || "",
        carNum,
        href: detailUrl.href,
        title: text.replace(/^FC2-PPV-\d+\s*[—–-]\s*/i, "").trim(),
        preview: $card.find(".card__poster[data-preview]").first().attr("data-preview") || null
      });
    }));
    return [...items.values()];
  }
  __name(parse123AvCards, "parse123AvCards");
  function merge123AvCards(cardLists) {
    const items = /* @__PURE__ */ new Map();
    cardLists.flat().forEach(((item) => items.set(item.carNum, item)));
    return [...items.values()];
  }
  __name(merge123AvCards, "merge123AvCards");
  function parse123AvSourceMaxPage($page, baseUrl = "https://123av.com") {
    const lastHref = $page.find('a[rel="last"]').first().attr("href");
    if (lastHref) {
      const page = Number.parseInt(new URL(lastHref, baseUrl).searchParams.get("page"), 10);
      if (Number.isFinite(page)) return page;
    }
    const inputMax = Number.parseInt($page.find("input.pager__input[max]").first().attr("max"), 10);
    if (Number.isFinite(inputMax)) return inputMax;
    const totalMatch = $page.find(".pager__total").first().text().match(/(\d[\d,]*)/);
    return totalMatch ? Number.parseInt(totalMatch[1].replaceAll(",", ""), 10) : null;
  }
  __name(parse123AvSourceMaxPage, "parse123AvSourceMaxPage");
  function parse123AvVideoInfo($page, url) {
    const idMatch = new URL(url).pathname.match(/fc2-ppv-(\d+)/i);
    const id = idMatch ? idMatch[1] : null;
    const rawTitle = $page.find("h1.watch__title").first().text().trim();
    const title = id ? rawTitle.replace(new RegExp(`^FC2-PPV-${id}\\s*[—–-]\\s*`, "i"), "").trim() : rawTitle;
    const pageText = $page.find("body").text();
    const publishDate = pageText.match(/发布日期\s*(\d{4}-\d{2}-\d{2})/)?.[1] || "";
    return { id, publishDate, title, moviePoster: null };
  }
  __name(parse123AvVideoInfo, "parse123AvVideoInfo");
  var _DetailPagePlugin = class _DetailPagePlugin extends BasePlugin {
    getName() {
      return "DetailPagePlugin";
    }
    constructor() {
      super();
    }
    handle() {
      window.isDetailPage && $(".video-meta-panel a").each((function() {
        const e2 = $(this).attr("href");
        e2 && (e2.startsWith("http://") || e2.startsWith("https://") || e2.startsWith("/")) && $(this).attr("target", "_blank");
      }));
    }
  };
  __name(_DetailPagePlugin, "DetailPagePlugin");
  var DetailPagePlugin = _DetailPagePlugin;
  var Z = /* @__PURE__ */ __name((e2, t2) => {
    if (!e2 || 0 === e2.length) return null;
    const n2 = new Set(e2);
    if (n2.has(t2)) return t2;
    const a2 = L.map(((e3) => e3.quality)).reverse();
    for (const i2 of a2) if (n2.has(i2)) return i2;
    return e2[0];
  }, "Z");
  var ee = "jhs_dmm_video";
  var _DmmPreviewParser = class _DmmPreviewParser {
    constructor(e2) {
      this.carNum = e2, this.lastError = null;
    }
    _checkCache() {
      const e2 = localStorage.getItem(ee) ? JSON.parse(localStorage.getItem(ee)) : {};
      return e2[this.carNum] ? (clog.debug("缓存中存在预览视频信息", e2[this.carNum]), e2[this.carNum]) : null;
    }
    _updateCache(e2) {
      const t2 = localStorage.getItem(ee) ? JSON.parse(localStorage.getItem(ee)) : {};
      t2[this.carNum] = e2, clog.debug("成功解析出预览视频并已缓存:", e2), localStorage.setItem(ee, JSON.stringify(t2));
    }
    async _searchContentIds() {
      const e2 = this.carNum, t2 = e2.replace(/-/g, ""), n2 = [{
        keyword: e2.replace("-", "00"),
        name: "00-替换关键词"
      }, {
        keyword: e2,
        name: "原始番号关键词"
      }, {
        keyword: t2,
        name: "无连字符关键词"
      }], a2 = e2.toLowerCase();
      let hadSuccessfulRequest = false;
      for (const o2 of n2) {
        const { keyword: e3, name: n3 } = o2, i3 = e3.toLowerCase();
        clog.debug(`--- 尝试使用 ${n3} (${e3}) 进行 API 搜索 ---`);
        const r2 = `https://api.dmm.com/affiliate/v3/ItemList?${new URLSearchParams({
          api_id: "UrwskPfkqQ0DuVry2gYL",
          affiliate_id: "10278-996",
          output: "json",
          site: "FANZA",
          sort: "match",
          keyword: e3
        }).toString()}`;
        let l2;
        try {
          l2 = await gmHttp.get(r2);
          hadSuccessfulRequest = true;
        } catch (s2) {
          this.lastError = new ProviderError("dmm", "HTTP_ERROR", `DMM API 请求失败: ${s2.message || s2}`, {
            cause: s2,
            url: r2,
            status: s2?.status,
            retryable: true
          }), clog.error(`API 请求失败，跳过 ${n3}:`, this.lastError);
          continue;
        }
        if (!l2 || !l2.result || !l2.result.result_count) {
          clog.debug("API 返回无结果，尝试下一个关键词。");
          continue;
        }
        const c2 = [];
        for (const s2 of l2.result.items) {
          if (c2.length >= 2) break;
          const e4 = s2.content_id || "", o3 = s2.maker_product || "";
          (e4.includes(i3.replace("-", "")) || a2 === o3.toLowerCase() || e4.includes(t2.toLowerCase())) && (c2.push({
            serviceCode: s2.service_code,
            floorCode: s2.floor_code,
            contentId: e4,
            pageUrl: s2.URL
          }), clog.debug(`[${n3}] cid|makerProduct 匹配成功:`, e4, o3));
        }
        if (c2.length > 0) {
          clog.debug(`--- 成功通过 ${n3} 找到 Content IDs ---`);
          const t3 = $("#fanzaBtn");
          let a3 = `https://www.dmm.co.jp/search/=/searchstr=${e3}`, i4 = "single";
          c2.length > 1 ? (t3.attr("href", a3), t3.append('<span class="site-tag jhs-layout-294497f1">多结果</span>'), t3.css("backgroundColor", "var(--jhs-status-down)"), i4 = "multiple") : (a3 = c2[0].pageUrl, t3.attr("href", a3), t3.css("backgroundColor", "var(--jhs-status-down)"));
          const s2 = "jhs_other_site_dmm", o3 = localStorage.getItem(s2) ? JSON.parse(localStorage.getItem(s2)) : {};
          return o3[this.carNum] = {
            type: i4,
            url: a3
          }, localStorage.setItem(s2, JSON.stringify(o3)), c2;
        }
        clog.debug(`[${n3}] API 返回结果数 ${l2.result.result_count}，但无精确匹配的 Content ID。`);
      }
      hadSuccessfulRequest && (this.lastError = null);
      clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
      const i2 = $("#fanzaBtn");
      return i2.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`), i2.attr("title", "未查询到, 点击前往搜索页"), i2.css("backgroundColor", "var(--jhs-status-filter)"), null;
    }
    async _extractTrailerLinks({ contentId: e2, serviceCode: t2, floorCode: n2 }) {
      const a2 = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${e2}/mtype=AhRVShI_/service=${t2}/floor=${n2}/mode=/`, i2 = await gmHttp.get(a2, null, {
        "accept-language": "ja-JP,ja;q=0.9",
        Cookie: "age_check_done=1"
      });
      if ("string" != typeof i2) throw clog.error(i2), new ProviderError("dmm", "PARSE_ERROR", "解析播放页内容失败, 非文本内容", {
        url: a2
      });
      if (i2.includes("このサービスはお住まいの地域からは")) throw new ProviderError("dmm", "REGION_BLOCKED", "DMM 预览源不可用，请将 DMM 域名分流到日本 IP", {
        url: a2
      });
      const s2 = i2.match(/const\s+args\s+=\s+(.*);/);
      if (!s2) throw new ProviderError("dmm", "PARSE_ERROR", "未在脚本中找到 const args = ... 变量", {
        url: a2
      });
      let o2;
      try {
        ({ bitrates: o2 } = JSON.parse(s2[1]));
      } catch (d2) {
        throw new ProviderError("dmm", "PARSE_ERROR", `解析播放器脚本 JSON 失败: ${d2.message}`, {
          cause: d2,
          url: a2
        });
      }
      const r2 = {}, l2 = L.map(((e3) => e3.quality)).join("|"), c2 = new RegExp(`(${l2})\\.mp4$`);
      if (!Array.isArray(o2)) throw clog.error("解析画质链接失败: bitrates 字段不是一个数组或不存在"), new ProviderError("dmm", "PARSE_ERROR", "解析画质链接失败: bitrates 字段不是一个数组或不存在", {
        url: a2
      });
      clog.debug("原始数据返回:", o2);
      for (const h2 of o2) {
        const e3 = null == h2 ? void 0 : h2.src;
        if (!e3 || "string" != typeof e3 || !e3.endsWith(".mp4")) continue;
        const t3 = e3.match(c2);
        let n3 = "";
        t3 && t3[1] && (n3 = t3[1]), n3 && !r2[n3] && (r2[n3] = e3);
      }
      if (0 === Object.keys(r2).length) throw new ProviderError("dmm", "PARSE_ERROR", "未找到匹配要求的预览画质视频", {
        url: a2
      });
      return r2;
    }
    async fetchVideo() {
      const carNum = normalizeCarNum(this.carNum);
      if (!carNum) return clog.warn("跳过 DMM 解析：番号不可用"), null;
      this.carNum = carNum;
      const e2 = this._checkCache();
      if (e2) return e2;
      let t2;
      try {
        const e3 = this.carNum.toLowerCase();
        if (e3.startsWith("heyzo") || /^(n\d+|\d+(-\d+)*)$/.test(e3) || /^n\d+$/.test(e3)) return clog.debug("无码番号类型，取消 DMM 解析"), null;
        if (this.carNum.includes("VR-")) return clog.debug("VR 类型，取消 DMM 解析"), null;
        t2 = await this._searchContentIds();
      } catch (n2) {
        this.lastError = n2 instanceof ProviderError ? n2 : new ProviderError("dmm", "PARSE_ERROR", n2.message || String(n2), {
          cause: n2
        }), clog.error("DMM API 搜索失败:", this.lastError);
        const e3 = $("#fanzaBtn");
        return e3.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`), e3.attr("title", "未查询到, 点击前往搜索页"), e3.css("backgroundColor", "var(--jhs-status-filter)"), null;
      }
      if (!t2 || 0 === t2.length) return null;
      try {
        const e3 = await Promise.any(t2.map(((e4) => this._extractTrailerLinks(e4))));
        return this._updateCache(e3), e3;
      } catch (a2) {
        const e3 = a2.errors || [a2];
        this.lastError = e3.find(((e4) => "REGION_BLOCKED" === e4?.code)) || e3.find(((e4) => e4 instanceof ProviderError)) || new ProviderError("dmm", "PARSE_ERROR", e3[0]?.message || String(e3[0]), {
          cause: e3[0]
        }), clog.error(`解析失败: ${this.lastError.message}`, e3);
        const t3 = $("#fanzaBtn");
        return t3.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`), t3.attr("title", "未查询到, 点击前往搜索页"), t3.css("backgroundColor", "var(--jhs-status-filter)"), null;
      }
    }
  };
  __name(_DmmPreviewParser, "DmmPreviewParser");
  var DmmPreviewParser = _DmmPreviewParser;
  async function fetchDmmPreview(carNum) {
    const parser = new DmmPreviewParser(carNum), sources = await parser.fetchVideo();
    return {
      sources,
      error: parser.lastError
    };
  }
  __name(fetchDmmPreview, "fetchDmmPreview");
  var _PreviewVideoPlugin = class _PreviewVideoPlugin extends BasePlugin {
    getName() {
      return "PreviewVideoPlugin";
    }
    async initCss() {
      return ".jhs-dmm-preview-player{display:none;width:100%;height:auto}.jhs-dmm-preview-player.is-active{display:block}.jhs-native-preview-hidden{display:none!important}";
    }
    async handle() {
      if (!isDetailPage) return;
      const trigger = $(".preview-video-container"), openVideo = /* @__PURE__ */ __name(() => {
        utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
          this.handleVideo().catch(((error) => clog.error("预览视频处理失败", error)));
        }));
      }, "openVideo");
      trigger.off("click.jhsVideo").on("click.jhsVideo", openVideo);
      await storageManager.getSetting("enableLoadPreviewVideo", _) !== _ || o.includes("autoPlay=1") || this.initDmm();
      const url = window.location.href;
      (url.includes("gallery-1") || url.includes("gallery-2")) && openVideo(), url.includes("autoPlay=1") && trigger.length > 0 && trigger[0].click();
    }
    async initDmm() {
      try {
        const { sources } = await this.getDmmPreview();
        if (!sources) return;
        const $video = $("#preview-video"), video = $video[0];
        if (video) return;
        clog.debug("JavDB没有视频播放元素, 开始创建...");
        const cover = $(".column-video-cover img").attr("src");
        $(".preview-images").prepend(`
                <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">
                    <span>预告片</span>
                    <img src="${cover}" class="video-cover jhs-layout-8cf76fd7" alt="">
                </a>
            `), $(".preview-video-container").off("click.jhsVideo").on("click.jhsVideo", (() => {
          utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => this.handleVideo().catch(((error) => clog.error("预览视频处理失败", error)))));
        }));
      } catch (error) {
        clog.error("预加载 DMM 失败:", error);
      }
    }
    /** 复用单次 DMM 请求，避免预加载和点击处理重复抓取。 */
    getDmmPreview() {
      if (this.dmmPreviewPromise) return this.dmmPreviewPromise;
      this.dmmPreviewPromise = fetchDmmPreview(this.getPageInfo().carNum).then(((result) => {
        (result.error?.retryable || "HTTP_ERROR" === result.error?.code) && (this.dmmPreviewPromise = null);
        return result;
      }), ((error) => {
        this.dmmPreviewPromise = null;
        throw error;
      }));
      return this.dmmPreviewPromise;
    }
    /** 创建与 JavDB HLS 生命周期完全隔离的 DMM 播放器。 */
    createDmmPlayer($nativeVideo) {
      const $host = $nativeVideo.parent(), existing = $host.find("#jhs-preview-video");
      if (existing.length) return existing;
      const $player = $('<video id="jhs-preview-video" class="jhs-video-player jhs-dmm-preview-player" controls playsinline></video>');
      return $nativeVideo.after($player), $player;
    }
    /** 销毁 JHS 播放器并把播放权完整交回 JavDB。 */
    async restoreNativePlayer($nativeVideo, nativeVideo, notify = false) {
      const $dmmVideo = $nativeVideo.parent().find("#jhs-preview-video"), dmmVideo = $dmmVideo[0];
      dmmVideo && (dmmVideo.pause(), $dmmVideo.removeAttr("src"), dmmVideo.load(), $dmmVideo.remove());
      $nativeVideo.removeClass("jhs-native-preview-hidden");
      return safePlay(nativeVideo, {
        context: "JavDB 原生预览回退",
        notify
      });
    }
    async handleVideo() {
      const $nativeVideo = $("#preview-video");
      if (!$nativeVideo.length) return;
      const $host = $nativeVideo.parent().css("position", "relative"), nativeVideo = $nativeVideo[0], muted = localStorage.getItem("jhs_videoMuted");
      void safePlay(nativeVideo, {
        context: "JavDB 原生预览",
        notify: false
      });
      const dmmEnabled = await storageManager.getSetting("enableLoadPreviewVideo", _) !== C, dmmResult = dmmEnabled ? await this.getDmmPreview() : {
        sources: null,
        error: null
      }, { sources, error } = dmmResult, $toolbar = $("<div></div>").attr("id", "video-bottom-toolbar").addClass("jhs-video-toolbar"), $qualityList = $("<div></div>").addClass("jhs-video-quality-list").attr({
        role: "group",
        "aria-label": "视频画质"
      });
      $host.find("#video-bottom-toolbar").remove();
      let dmmPlayed = false, $dmmVideo = null, dmmVideo = null;
      if (sources) {
        const preferredQuality = await storageManager.getSetting("videoQuality"), selectedQuality = Z(Object.keys(sources), preferredQuality), source = sources[selectedQuality];
        const currentTime = nativeVideo.currentTime;
        $dmmVideo = this.createDmmPlayer($nativeVideo), dmmVideo = $dmmVideo[0], dmmVideo.muted = !muted || "yes" === muted, $dmmVideo.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (() => {
          localStorage.setItem("jhs_videoMuted", dmmVideo.muted ? "yes" : "no");
        })), $dmmVideo.attr("src", source), dmmVideo.load(), dmmVideo.currentTime = currentTime, $dmmVideo.addClass("is-active");
        dmmPlayed = await safePlay(dmmVideo, {
          context: "JavDB 高画质预览",
          notify: false
        });
        if (!dmmPlayed && !dmmVideo.muted) dmmVideo.muted = true, dmmPlayed = await safePlay(dmmVideo, {
          context: "JavDB 高画质预览静音重试",
          notify: false
        });
        dmmPlayed ? (nativeVideo.pause(), $nativeVideo.addClass("jhs-native-preview-hidden")) : ($dmmVideo.removeClass("is-active"), await this.restoreNativePlayer($nativeVideo, nativeVideo, true));
        dmmPlayed && L.forEach(((quality) => {
          const qualitySource = sources[quality.quality];
          if (!qualitySource) return;
          const active = dmmPlayed && selectedQuality === quality.quality;
          $qualityList.append($(`<button type="button" class="jhs-btn jhs-video-quality-btn${active ? " active" : ""}" data-quality="${quality.quality}" data-video-src="${qualitySource}" aria-pressed="${active ? "true" : "false"}">${quality.text}</button>`));
        }));
      }
      $toolbar.append($qualityList);
      const $actions = $("<div></div>").addClass("jhs-toolbar");
      $actions.append('<button type="button" class="jhs-btn jhs-btn--filter jhs-layout-3f0d74e1" id="video-filterBtn">屏蔽</button>', '<button type="button" class="jhs-btn jhs-btn--fav jhs-layout-2afc43dc" id="video-favoriteBtn">收藏</button>', '<button type="button" class="jhs-btn jhs-btn--down jhs-layout-5c319329" id="speed-btn">快进</button>'), $toolbar.append($actions), $host.append($toolbar), sources || await safePlay(nativeVideo, {
        context: "JavDB 预览视频",
        notify: true,
        message: "REGION_BLOCKED" === error?.code ? error.message : "当前视频源无法播放"
      });
      $toolbar.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async (event) => {
        const $button = $(event.currentTarget);
        if ($button.hasClass("active")) return;
        try {
          if (!dmmVideo) return;
          const currentTime = dmmVideo.currentTime, previousSource = $dmmVideo.attr("src");
          $dmmVideo.attr("src", $button.data("video-src")), dmmVideo.load(), dmmVideo.currentTime = currentTime;
          const played = await safePlay(dmmVideo, {
            context: "JavDB 画质切换",
            notify: false
          });
          if (played) $toolbar.find(".jhs-video-quality-btn").removeClass("active").attr("aria-pressed", "false"), $button.addClass("active").attr("aria-pressed", "true");
          else {
            previousSource && ($dmmVideo.attr("src", previousSource), dmmVideo.load(), dmmVideo.currentTime = currentTime);
            const restored = previousSource && await safePlay(dmmVideo, {
              context: "JavDB 画质切换回退",
              notify: false
            });
            restored || await this.restoreNativePlayer($nativeVideo, nativeVideo, true);
          }
        } catch (playbackError) {
          clog.error("切换画质失败:", playbackError);
        }
      })), $("#speed-btn").off("click.jhsVideo").on("click.jhsVideo", (() => {
        dmmVideo && (dmmVideo.currentTime += 10);
      })), $toolbar.off("contextmenu.jhsVideo").on("contextmenu.jhsVideo", "#speed-btn", ((event) => (event.preventDefault(), this.getBean("DetailPageButtonPlugin").filterOne(event)))), $("#video-filterBtn").off("click.jhsVideo").on("click.jhsVideo", ((event) => this.getBean("DetailPageButtonPlugin").filterOne(event))), $("#video-favoriteBtn").off("click.jhsVideo").on("click.jhsVideo", ((event) => this.getBean("DetailPageButtonPlugin").favoriteOne(event)));
    }
  };
  __name(_PreviewVideoPlugin, "PreviewVideoPlugin");
  var PreviewVideoPlugin = _PreviewVideoPlugin;
  var _JavTrailersPlugin = class _JavTrailersPlugin extends BasePlugin {
    getName() {
      return "JavTrailersPlugin";
    }
    constructor() {
      super(), this.hasBand = false;
    }
    handle() {
      let e2 = window.location.href;
      if (!e2.includes("handle=1")) return;
      if ($("h1:contains('Page not found')").length) {
        clog.log("番号无法匹配, 跳搜索");
        let t3 = e2.split("?")[0].split("video/")[1].toLowerCase().replace("00", "-");
        return void (window.location.href = "/search/" + encodeURIComponent(t3) + window.location.search);
      }
      let t2 = $(".videos-list .video-link").toArray();
      if (t2.length) {
        const n2 = e2.split("?")[0].split("search/")[1].toLowerCase(), a2 = t2.find(((e3) => $(e3).find(".vid-title").text().toLowerCase().includes(n2)));
        if (a2) return void (window.location.href = $(a2).attr("href") + window.location.search);
      }
      this.handlePlayJavTrailers(), $("#videoPlayerContainer").on("click", (() => {
        this.handlePlayJavTrailers();
      })), window.addEventListener("message", ((e3) => {
        let t3 = document.getElementById("vjs_video_3_html5_api");
        t3 && (t3.currentTime += 5);
      }));
    }
    handlePlayJavTrailers() {
      this.hasBand || (utils.loopDetector((() => 0 !== $("#vjs_video_3_html5_api").length), (() => {
        setTimeout((() => {
          this.hasBand = true;
          let e2 = document.getElementById("vjs_video_3_html5_api");
          clog.debug(e2), safePlay(e2, {
            context: "JavTrailers 预览"
          }), e2.currentTime = 5, e2.addEventListener("timeupdate", (function() {
            e2.currentTime >= 14 && e2.currentTime < 16 && (e2.currentTime += 2);
          })), $("#vjs_video_3_html5_api").css({
            position: "fixed",
            width: "100vw",
            height: "100vh",
            objectFit: "cover",
            zIndex: String(JHS_Z_INDEX.debug)
          }), $(".vjs-control-bar").css({
            position: "fixed",
            bottom: "20px",
            zIndex: String(JHS_Z_INDEX.debug)
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
          zIndex: String(JHS_Z_INDEX.debug - 1)
        });
      })));
    }
  };
  __name(_JavTrailersPlugin, "JavTrailersPlugin");
  var JavTrailersPlugin = _JavTrailersPlugin;
  var _SubTitleCatPlugin = class _SubTitleCatPlugin extends BasePlugin {
    getName() {
      return "SubTitleCatPlugin";
    }
    handle() {
      $(".t-banner-inner").hide(), $("#navbar").hide();
      let e2 = new URLSearchParams(window.location.search).get("search").toLowerCase(), t2 = $(".sub-table tr td a").toArray(), n2 = 0;
      t2.forEach(((t3) => {
        let a3 = $(t3);
        a3.text().toLowerCase().includes(e2) ? n2++ : a3.parent().parent().hide();
      })), 0 === n2 && show.error("该番号无字幕!");
      const a2 = $(".sec-title"), i2 = a2.html().replace(/^\d+/, n2);
      a2.html(i2);
    }
  };
  __name(_SubTitleCatPlugin, "SubTitleCatPlugin");
  var SubTitleCatPlugin = _SubTitleCatPlugin;
  var _Fc2Plugin = class _Fc2Plugin extends BasePlugin {
    getName() {
      return "Fc2Plugin";
    }
    async initCss() {
      return "\n            <style>\n                /* 弹层样式 */\n                .movie-detail-layer .layui-layer-title {\n                    font-size: 18px;\n                    color: var(--jhs-text);\n                    background: var(--jhs-surface-2);\n                }\n                \n                \n                /* 容器样式 */\n                .movie-detail-container {\n                    margin: 40px;\n                    height: 100%;\n                    background: var(--jhs-surface);\n                }\n                \n                .movie-poster-container {\n                    flex: 0 0 60%;\n                    padding: 15px;\n                }\n                \n                .right-box {\n                    flex: 1;\n                    padding: 20px;\n                    overflow-y: auto;\n                }\n                \n                /* 预告片iframe */\n                .movie-trailer {\n                    width: 100%;\n                    height: 100%;\n                    min-height: 400px;\n                    background: #000;\n                    border-radius: 4px;\n                }\n                \n                /* 电影信息样式 */\n                .movie-title {\n                    font-size: 24px;\n                    margin-bottom: 15px;\n                    color: var(--jhs-text);\n                }\n                \n                .movie-meta {\n                    margin-bottom: 20px;\n                    color: var(--jhs-text-muted);\n                }\n                \n                .movie-meta span {\n                    margin-right: 15px;\n                }\n                \n                /* 演员列表 */\n                .actor-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 8px;\n                    margin-top: 10px;\n                }\n                \n                .actor-tag {\n                    padding: 4px 12px;\n                    background: var(--jhs-surface-2);\n                    border-radius: 15px;\n                    font-size: 12px;\n                    color: var(--jhs-text-muted);\n                }\n                \n                /* 图片列表 */\n                .image-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 10px;\n                }\n                \n                .movie-image-thumb {\n                    width: 120px;\n                    height: 80px;\n                    object-fit: cover;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    transition: transform 0.3s;\n                }\n                \n                .movie-image-thumb:hover {\n                    transform: scale(1.05);\n                }\n                \n                /* 加载中和错误状态 */\n                .search-loading, .movie-error {\n                    padding: 40px;\n                    text-align: center;\n                    color: var(--jhs-text-faint);\n                }\n                \n                .movie-error {\n                    color: var(--jhs-status-filter);\n                }\n                \n                .fancybox-container{\n                    z-index:var(--jhs-z-loading)\n                 }\n                 \n                 \n                 /* 错误提示样式 */\n                .movie-not-found, .movie-error {\n                    text-align: center;\n                    padding: 30px;\n                    color: var(--jhs-text-muted);\n                }\n                \n                .movie-not-found h3, .movie-error h3 {\n                    color: var(--jhs-status-filter);\n                    margin: 15px 0;\n                }\n                \n                .icon-warning, .icon-error {\n                    font-size: 50px;\n                    color: var(--jhs-status-watch);\n                }\n                \n                .icon-error {\n                    color: var(--jhs-status-filter);\n                }\n                \n                .fc2-movie-panel-info .panel-block {\n                    padding: 0 !important;\n                }\n            </style>\n        ";
    }
    handle() {
      let e2 = "/advanced_search?type=3&score_min=0&d=1";
      if ($('.navbar-item:contains("FC2")').attr("href", e2), $('.tabs a:contains("FC2")').attr("href", e2), o.includes("advanced_search?type=3")) {
        $("h2.section-title").contents().first().replaceWith("Fc2PPV"), $(".section .container > .box").remove();
      }
      if (o.includes("collection_codes?movieId")) {
        $("section").html("");
        const e3 = new URLSearchParams(window.location.search);
        let t2 = e3.get("movieId"), n2 = e3.get("carNum"), a2 = e3.get("url");
        t2 && n2 && a2 && this.openFc2Dialog(t2, n2, a2);
      }
    }
    openFc2Dialog(e2, t2, n2) {
      let a2 = t2.replace("FC2-", "");
      if (n2.includes("123av")) return void this.getBean("Fc2By123AvPlugin").open123AvFc2Dialog(t2, n2);
      let i2 = `
            <div class="movie-detail-container">
                <!--<div class="movie-poster-container">
                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>
                </div>-->
               <!-- <div class="right-box">-->
                    <div class="movie-info-container">
                        <div class="search-loading">加载中...</div>
                    </div>

                    <div class="movie-panel-info fc2-movie-panel-info jhs-layout-a26bda7d"><strong>第三方资源: </strong></div>

                    <div class="jhs-layout-ba4750c8">
                        <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter"><span>${m}</span></button>
                        <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav"><span>${v}</span></button>
                        <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down"><span>${y}</span></button>
                        <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch"><span>${k}</span></button>

                        <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent">
                            <span>字幕 (SubTitleCat)</span>
                        </button>
                        <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent">
                            <span>字幕 (迅雷)</span>
                        </button>
                        <button type="button" id="magnetSearchBtn" class="jhs-btn jhs-btn--accent jhs-layout-9fe45cd8">
                            <span>磁力搜索</span>
                        </button>
                    </div>
                    <div class="message video-panel jhs-layout-a26bda7d">
                        <div id="magnets-content" class="magnet-links jhs-layout-6d489fc7">
                            <div class="search-loading">加载中...</div>
                        </div>
                    </div>
                    <div id="reviews-content">
                    </div>
                    <div id="related-content">
                    </div>
                    <span id="data-actress" class="jhs-layout-6b99de8b"></span>
                <!--</div>-->
            </div>
        `;
      layer.open({
        type: 1,
        title: t2,
        content: i2,
        area: utils.getDialogArea("workspace"),
        skin: "movie-detail-layer",
        scrollbar: false,
        success: /* @__PURE__ */ __name((i3, s2) => {
          const root = $(i3), detailRoot = root.find(".movie-detail-container");
          organizeJhsOwnedDetailWorkspace(detailRoot), detailStateController.bind({ root: i3, layerIndex: s2, carNum: t2, activityType: "fc2-state", getRecord: /* @__PURE__ */ __name(() => ({ carNum: t2, url: n2, names: root.find("#data-actress").text(), publishTime: root.find("#data-releaseDate").text() }), "getRecord") }), void this.loadData(e2, t2).catch(((error) => clog.error("FC2 详情加载失败", error))), root.find("#search-subtitle-btn").on("click", ((e3) => utils.openPage(`https://subtitlecat.com/index.php?search=${t2}`, t2, false, e3))), $("#xunLeiSubtitleBtn").on("click", (() => this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(t2))), $("#magnetSearchBtn").on("click", (async () => {
            let e3 = await this.getBean("MagnetHubPlugin").createMagnetHub(t2);
            layer.open({
              type: 1,
              title: "磁力搜索",
              content: '<div id="magnetHubBox"></div>',
              area: utils.getResponsiveArea(["60%", "80%"]),
              scrollbar: false,
              success: /* @__PURE__ */ __name(() => {
                $("#magnetHubBox").append(e3);
              }, "success")
            });
          })), void this.getBean("OtherSitePlugin").loadOtherSite(a2, t2).catch(((error) => clog.error("FC2 外部站点加载失败", error))), utils.setupEscClose(s2);
        }, "success"),
        end() {
          window.location.href.includes("collection_codes?movieId") && utils.closePage();
        }
      });
    }
    async loadData(e2, t2) {
      const n2 = t2.replace("FC2-", "");
      this.handleLongImg(n2), await Promise.all([this.handleMovieDetail(e2), this.handleMagnets(e2), this.getBean("ReviewPlugin").showReview(e2, $("#reviews-content")), this.getBean("RelatedPlugin").showRelated($("#related-content"), e2)]);
    }
    async handleMovieDetail(e2) {
      try {
        const movie = await V(e2), t2 = movie.actors || [], n2 = movie.imgList || [];
        let a2 = "";
        if (t2.length > 0) {
          let actressNames = "";
          for (let n3 = 0; n3 < t2.length; n3++) {
            let i3 = t2[n3];
            a2 += `<span class="actor-tag"><a href="/actors/${escapeHtml(i3.id)}" target="_blank">${escapeHtml(i3.name)}</a></span>`, 0 === i3.gender && (actressNames += String(i3.name || "") + " ");
          }
          $("#data-actress").text(actressNames);
        } else a2 = '<span class="no-data">暂无演员信息</span>';
        const images = Array.isArray(n2) ? n2.map(((value) => normalizeHttpUrl(value))).filter(Boolean) : [], i2 = images.length > 0 ? images.map(((value, index) => `
                <a href="${escapeHtml(value)}" data-fancybox="movie-gallery" data-caption="剧照 ${index + 1}">
                    <img src="${escapeHtml(value)}" class="movie-image-thumb" loading="lazy" alt=""/>
                </a>
            `)).join("") : '<div class="no-data">暂无剧照</div>', carNum = String(movie.carNum || ""), safeCarNum = escapeHtml(carNum || "未知"), releaseDate = escapeHtml(movie.releaseDate || "未知"), score = Number.isFinite(Number(movie.score)) ? escapeHtml(String(movie.score)) : "无", duration = Number.isFinite(Number(movie.duration)) ? `${escapeHtml(String(movie.duration))} m` : "无", articleId = encodeURIComponent(carNum.replace("FC2-", ""));
        $(".movie-info-container").html(`
                <h3 class="movie-title"><strong class="current-title">${escapeHtml(movie.title || "无标题")}</strong></h3>
                <div class="movie-meta"><span><strong>番号: </strong>${safeCarNum}</span><span><strong>年份: </strong>${releaseDate}</span><span><strong>评分: </strong>${score}</span><span><strong>时长: </strong>${duration}</span></div>
                <div class="movie-meta"><span><strong>站点: </strong><a href="https://fc2ppvdb.com/articles/${articleId}" target="_blank">fc2ppvdb</a><a href="https://adult.contents.fc2.com/article/${articleId}/" target="_blank" class="jhs-layout-3fed2a7e">fc2电子市场</a></span></div>
                <div class="movie-actors"><div class="actor-list"><strong>主演: </strong>${a2}</div></div>
                <div class="movie-gallery jhs-layout-d2c171b1"><strong>剧照: </strong><div class="image-list">${i2}</div></div>
                <div id="data-releaseDate" class="jhs-layout-6b99de8b">${escapeHtml(movie.releaseDate || "")}</div>
            `), await this.getBean("TranslatePlugin").translate(carNum, false);
      } catch (error) {
        throw clog.error(error), $(".movie-info-container").html(`<div class="movie-error">加载失败: ${escapeHtml(error.message)}</div>`), error;
      }
    }
    handleLongImg(e2) {
      utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
        $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container jhs-layout-e5d57abb"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> ');
        const t2 = this.getBean("ScreenShotPlugin"), n2 = await t2.getScreenshot(e2);
        n2 && await t2.addImg("缩略图", n2);
      }));
    }
    async handleMagnets(e2) {
      try {
        const requestUrl = `${U}/v1/movies/${e2}/magnets`, n2 = {
          jdSignature: await O()
        };
        const magnets = (await gmHttp.get(requestUrl, null, n2)).data.magnets || [];
        let html = "";
        for (const [index, item] of magnets.entries()) {
          const hash = normalizeBtihHash(item.hash);
          if (!hash) {
            clog.warn("忽略无效 FC2 磁力哈希", item.hash);
            continue;
          }
          const magnet = `magnet:?xt=urn:btih:${hash}`, size = Number(item.size), filesCount = Number(item.files_count);
          html += `
                    <div class="item columns is-desktop ${index % 2 === 0 ? "odd" : ""}"><div class="magnet-name column is-four-fifths"><a href="${magnet}" title="右键点击并选择“复制链接地址”"><span class="name">${escapeHtml(item.name || "")}</span><br><span class="meta">${Number.isFinite(size) ? (size / 1024).toFixed(2) : "0.00"}GB, ${Number.isFinite(filesCount) ? filesCount : 0}个文件</span><br><div class="jhs-toolbar">${item.hd ? '<span class="jhs-badge jhs-badge--accent">高清</span>' : ""}${item.cnsub ? '<span class="jhs-badge jhs-badge--watch">字幕</span>' : ""}</div></a></div><div class="jhs-toolbar column"><button class="jhs-btn jhs-btn--secondary copy-to-clipboard" data-clipboard-text="${magnet}" type="button">复制</button><button class="jhs-btn jhs-btn--secondary jhs-offline-btn" data-resource="${magnet}" data-jhs-offline-owner="fc2" type="button">离线</button></div><div class="date column"><span class="time">${escapeHtml(item.created_at || "")}</span></div></div>`;
        }
        $("#magnets-content").html(html || '<span class="no-data">暂无磁力信息</span>');
      } catch (error) {
        throw clog.error(error), $("#magnets-content").html(`<div class="movie-error">加载失败: ${escapeHtml(error.message)}</div>`), error;
      }
    }
    async openFc2Page(e2, t2, n2, navigation = { newTab: true }) {
      const a2 = this.getBean("OtherSitePlugin");
      let i2 = await a2.getJavDbUrl();
      utils.openPage(`${i2}/users/collection_codes?movieId=${e2}&carNum=${encodeURIComponent(t2)}&url=${encodeURIComponent(n2)}`, t2, true, navigation);
    }
  };
  __name(_Fc2Plugin, "Fc2Plugin");
  var Fc2Plugin = _Fc2Plugin;
  var _HighlightMagnetPlugin = class _HighlightMagnetPlugin extends BasePlugin {
    async handle() {
      window.isDetailPage && jhsEventBus.on("magnet-items-updated", (() => {
        void storageManager.getSetting("enableMagnetsFilter", _).then(((enabled) => enabled === _ ? this.doFilterMagnet() : this.showAll()));
      }));
    }
    async initCss() {
      return `<style>.jhs-magnet-score{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;vertical-align:middle;cursor:help}</style>`;
    }
    getName() {
      return "HighlightMagnetPlugin";
    }
    doFilterMagnet() {
      this.handleDb(), this.handleBus();
    }
    /** 给磁力行注入评分徽章（幂等：已有则跳过） */
    injectScoreBadge(el, title) {
      try {
        if (el.find(".jhs-magnet-score").length > 0) return;
        const score = calcMagnetScore({ title: title || "", seeders: 0 });
        const total = score.total;
        const label = total >= 70 ? "高" : total >= 40 ? "中" : "低";
        const color = total >= 70 ? "var(--jhs-status-down)" : total >= 40 ? "var(--jhs-status-watch)" : "var(--jhs-surface-2)";
        const onColor = total >= 70 ? "var(--jhs-status-down-on)" : total >= 40 ? "var(--jhs-status-watch-on)" : "var(--jhs-text-muted)";
        const tip = `分辨率:${score.resolution}/25 字幕:${score.subtitle}/20 做种:${score.seeders}/35 新鲜度:${score.freshness}/15`;
        const badge = $(`<span class="jhs-magnet-score" title="${tip}">${label} ${total}</span>`).css({ color: onColor, backgroundColor: color });
        el.append(badge);
      } catch (e2) {
        clog.debug("磁力评分徽章注入失败，已忽略", e2);
      }
    }
    getQualitySignals(title, hasSubtitleTag = false) {
      const value = String(title || "").toLowerCase(), resolution = /(?:4k|2160p|1080p|720p)/.exec(value)?.[0] || "", subtitle = hasSubtitleTag || /(?:-c\b|-u(?:c)?\b|chinese|中字|字幕)/.test(value);
      return { resolution, subtitle, recognized: !!resolution || subtitle, highQuality: "4k" === resolution || "2160p" === resolution || subtitle };
    }
    updateFilterHint(hasMatch) {
      $("#enable-magnets-filter").removeClass("do-hide").attr("data-tip", hasMatch ? "仅显示识别到的高质量或字幕磁力" : "未识别到可过滤项，当前未隐藏磁力");
    }
    handleDb() {
      if (!r) return;
      let e2 = $("#magnets-content .name");
      if (0 === e2.length) return void this.updateFilterHint(false);
      let n2 = false;
      e2.each(((e3, a2) => {
        const i2 = $(a2), s2 = i2.text().toLowerCase(), o2 = this.getQualitySignals(s2);
        const row = i2.parent().parent().parent();
        row.removeClass("high-quality").show();
        row.addClass("magnet-row"), s2.includes("4k") && i2.css("color", "var(--jhs-status-filter-text)"), o2.highQuality && (n2 = true, row.addClass("high-quality"));
        this.injectScoreBadge(i2, i2.text());
      })), n2 && $("#magnets-content .magnet-row").not(".high-quality").hide(), this.updateFilterHint(n2);
    }
    handleBus() {
      if (l && isDetailPage) {
        const e2 = $("#magnet-table tr");
        let n2 = false;
        e2.each(((e3, a2) => {
          const i2 = $(a2), s2 = i2.find("td:first-child"), o2 = s2.find("a:first-child"), r2 = s2.find("a:nth-child(2)"), l2 = o2.text().toLowerCase();
          i2.removeClass("high-quality").show();
          l2.includes("4k") && o2.css("color", "var(--jhs-status-filter-text)");
          this.getQualitySignals(l2, r2.length > 0 && r2.text().includes("字幕")).highQuality && (n2 = true, i2.addClass("high-quality"));
          this.injectScoreBadge(o2, o2.text());
        }));
        n2 && e2.each(((e3, t2) => {
          const n3 = $(t2);
          n3.hasClass("high-quality") || n3.hide();
        })), this.updateFilterHint(n2);
      }
    }
    showAll() {
      $("#enable-magnets-filter").removeClass("do-hide").removeAttr("data-tip");
      if (r) {
        $("#magnets-content .item").toArray().forEach(((e2) => $(e2).show()));
      }
      l && $("#magnet-table tr").toArray().forEach(((e2) => $(e2).show()));
    }
  };
  __name(_HighlightMagnetPlugin, "HighlightMagnetPlugin");
  var HighlightMagnetPlugin = _HighlightMagnetPlugin;
  var _FoldCategoryPlugin = class _FoldCategoryPlugin extends BasePlugin {
    getName() {
      return "FoldCategoryPlugin";
    }
    async initCss() {
      const e2 = await storageManager.getSetting();
      return `
            <style>
                #tags a.tag, .tags a.tag {
                    position:relative;
                }
                .highlight-btn {
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    background-color: var(--jhs-status-down);
                    color: var(--jhs-status-down-on);
                    border: none;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    font-size: 14px;
                    line-height: 24px;
                    text-align: center;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    display: none;
                    z-index: var(--jhs-z-dropdown);
                }
                /* 当父元素被高亮时，按钮变为其他颜色 */
                .highlighted .highlight-btn {
                    background-color: var(--jhs-status-watch);
                }
                /* 高亮状态下的标签样式 */
                .highlighted {
                    /* 浅黄色 */
                    border: ${e2.highlightedTagNumber || 1}px solid ${e2.highlightedTagColor || "var(--jhs-status-filter)"};
                }
            </style>
        `;
    }
    async handle() {
      window.isListPage && (o.includes("advanced_search") || (this.highlightTag(), utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
        this.createFoldBtn();
      }), 1, 1e4, true), $("#tags .tag-category .tag-expand").each(((e2, t2) => {
        $(t2).parent().hasClass("collapse") && t2.click();
      }))));
    }
    highlightTag() {
      (async () => {
        const e2 = await storageManager.getHighlightedTags();
        e2 && e2.forEach(((e3) => {
          $(`#tags a.tag:contains(${e3})`).addClass("highlighted"), $(`.tags a.tag:contains(${e3})`).addClass("highlighted");
        }));
      })().catch(((error) => clog.error("分类高亮恢复失败", error))), $("#tags a.tag, .tags a.tag").hover((function() {
        const e2 = $(this), t2 = $('<button class="jhs-btn highlight-btn" title="高亮显示">★</button>');
        e2.append(t2), t2.fadeIn(0);
      }), (function() {
        $(this).find(".highlight-btn").fadeOut(0, (function() {
          $(this).remove();
        }));
      })), $(document).on("click", ".highlight-btn", (async function(e2) {
        e2.stopPropagation(), e2.preventDefault();
        const t2 = $(this).closest("a.tag"), n2 = t2.clone();
        n2.find(".highlight-btn").remove();
        const a2 = n2.text().trim().replace(/\s*\(\d+\)$/, "");
        let i2 = await storageManager.getHighlightedTags();
        i2.includes(a2) ? (i2 = i2.filter(((e3) => e3 !== a2)), t2.removeClass("highlighted")) : (i2.push(a2), t2.addClass("highlighted")), await storageManager.setHighlightedTags(i2);
      }));
    }
    async createFoldBtn() {
      let t2 = $("#tags"), n2 = $("#tags dl div.tag.is-info").map((function() {
        return $(this).text().replaceAll("\n", "").replaceAll(" ", "");
      })).get().join(" ");
      if (!n2) return;
      $(".tabs").append(`
            <div class="jhs-layout-8453d189">
                <div>已选分类: <span id="jhs-check-tag">${n2}</span></div>
                <button type="button" class="jhs-btn jhs-btn--ghost jhs-layout-3a1fc324" id="foldCategoryBtn">
                    <span></span>
                    <i class="jhs-layout-78fa54ea"></i>
                </button>

            </div>
        `);
      let a2 = $("h2.section-title");
      if (a2.length > 0 && (a2.append('\n                <div id="foldCategoryBtn">\n                    <button type="button" class="jhs-btn jhs-btn--ghost jhs-layout-2100e73d">\n                        <span></span>\n                        <i class="jhs-layout-78fa54ea"></i>\n                    </button>\n                </div>\n            '), t2 = $("section > div > div.box")), !t2) return;
      let i2 = $("#foldCategoryBtn"), s2 = localStorage.getItem("jhs_foldCategory") === _, [o2, r2] = s2 ? ["展开", "icon-angle-double-down"] : ["折叠", "icon-angle-double-up"];
      i2.find("span").text(o2).end().find("i").attr("class", r2), window.location.href.includes("noFold=1") || t2[s2 ? "hide" : "show"](), i2.on("click", (async (e2) => {
        e2.preventDefault(), s2 = !s2, localStorage.setItem("jhs_foldCategory", s2 ? _ : C);
        const [n3, a3] = s2 ? ["展开", "icon-angle-double-down"] : ["折叠", "icon-angle-double-up"];
        i2.find("span").text(n3).end().find("i").attr("class", a3), t2[s2 ? "hide" : "show"]();
      }));
    }
  };
  __name(_FoldCategoryPlugin, "FoldCategoryPlugin");
  var FoldCategoryPlugin = _FoldCategoryPlugin;
  var _ActressInfoPlugin = class _ActressInfoPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "apiUrl", "https://ja.wikipedia.org/wiki/");
    }
    getName() {
      return "ActressInfoPlugin";
    }
    async handle() {
      "yes" === await storageManager.getSetting("enableLoadActressInfo", "yes") && await this.loadActressInfo();
    }
    async loadActressInfo() {
      await Promise.all([this.handleDetailPage(), this.handleStarPage()]);
    }
    async initCss() {
      return "\n            <style>\n                .info-tag {\n                    background-color: var(--jhs-status-fav-tint);\n                    display: inline-block;\n                    height: 32px;\n                    padding: 0 10px;\n                    line-height: 30px;\n                    font-size: 12px;\n                    color: var(--jhs-status-fav);\n                    border: 1px solid var(--jhs-status-fav-tint);\n                    border-radius: 4px;\n                    box-sizing: border-box;\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    async handleDetailPage() {
      if ($(".actress-info").length > 0) return;
      let e2 = $(".female").prev().map(((e3, t3) => $(t3).text().trim())).get();
      if (!e2.length) return;
      const t2 = "jhs_actress_info", n2 = localStorage.getItem(t2) ? JSON.parse(localStorage.getItem(t2)) : {};
      let a2 = null, i2 = "";
      for (let o2 = 0; o2 < e2.length; o2++) {
        let t3 = e2[o2];
        if (a2 = n2[t3], !a2) try {
          a2 = await this.searchInfo(t3), a2 && (n2[t3] = a2);
        } catch (s2) {
          clog.error("该名称查询失败,尝试其它名称");
        }
        let r2 = "";
        r2 = a2 ? `
                    <div class="panel-block actress-info">
                        <strong>${t3}:</strong>
                        <a href="${a2.url}" target="_blank" class="jhs-layout-9813a0dd">
                            <span class="info-tag">${a2.birthday} ${a2.age}</span>
                            <span class="info-tag">${a2.height} ${a2.weight}</span>
                            <span class="info-tag">${a2.threeSizeText} ${a2.braSize}</span>
                        </a>
                    </div>
                ` : `<div class="panel-block actress-info"><a href="${this.apiUrl + t3}" target="_blank"><strong>${t3}:</strong></a></div> `, i2 += r2;
      }
      $('strong:contains("演員")').parent().after(i2), localStorage.setItem(t2, JSON.stringify(n2));
    }
    async handleStarPage() {
      if ($(".actress-info").length > 0) return;
      let e2 = [], t2 = $(".actor-section-name");
      t2.length && t2.text().trim().split(",").forEach(((t3) => {
        e2.push(t3.trim());
      }));
      let n2 = $(".section-meta:not(:contains('影片'))");
      if (n2.length && n2.text().trim().split(",").forEach(((t3) => {
        e2.push(t3.trim());
      })), !e2.length) return;
      const a2 = "jhs_actress_info", i2 = localStorage.getItem(a2) ? JSON.parse(localStorage.getItem(a2)) : {};
      let s2 = null;
      for (let l2 = 0; l2 < e2.length; l2++) {
        let t3 = e2[l2];
        if (s2 = i2[t3], s2) break;
        try {
          s2 = await this.searchInfo(t3);
        } catch (r2) {
          clog.error("该名称查询失败,尝试其它名称");
        }
        if (s2) break;
      }
      s2 && e2.forEach(((e3) => {
        i2[e3] = s2;
      }));
      let o2 = '<div class="actress-info jhs-layout-c0d4a511">无此相关演员信息</div>';
      s2 && (o2 = `
                <a class="actress-info" href="${s2.url}" target="_blank">
                    <div class="jhs-layout-c0d4a511">
                        <div class="jhs-layout-1b3790ef">
                            <span class="jhs-layout-dd5a75f6">出生日期: ${s2.birthday}</span>
                            <span class="jhs-layout-d4a09a0d">年龄: ${s2.age}</span>
                            <span class="jhs-layout-d4a09a0d">身高: ${s2.height}</span>
                        </div>
                        <div class="jhs-layout-1b3790ef">
                            <span class="jhs-layout-dd5a75f6">体重: ${s2.weight}</span>
                            <span class="jhs-layout-d4a09a0d">三围: ${s2.threeSizeText}</span>
                            <span class="jhs-layout-d4a09a0d">罩杯: ${s2.braSize}</span>
                        </div>
                    </div>
                </a>
            `), t2.parent().append(o2), localStorage.setItem(a2, JSON.stringify(i2));
    }
    async searchInfo(e2) {
      "三上悠亞" === e2 && (e2 = "三上悠亜");
      let t2 = this.apiUrl + e2;
      const n2 = await gmHttp.get(t2), a2 = new DOMParser(), i2 = $(a2.parseFromString(n2, "text/html"));
      let s2 = i2.find('a[title="誕生日"]').parent().parent().find("td").text().trim(), o2 = i2.find("th:contains('現年齢')").parent().find("td").text().trim() ? parseInt(i2.find("th:contains('現年齢')").parent().find("td").text().trim()) + "岁" : "", r2 = i2.find('tr:has(a[title="身長"]) td').text().trim().split(" ")[0] + "cm", l2 = i2.find('tr:has(a[title="体重"]) td').text().trim().split("/")[1].trim();
      return "― kg" === l2 && (l2 = ""), {
        birthday: s2,
        age: o2,
        height: r2,
        weight: l2,
        threeSizeText: i2.find('a[title="スリーサイズ"]').closest("tr").find("td").text().replace("cm", "").trim(),
        braSize: i2.find('th:contains("ブラサイズ")').next("td").contents().first().text().trim(),
        url: t2
      };
    }
  };
  __name(_ActressInfoPlugin, "ActressInfoPlugin");
  var ActressInfoPlugin = _ActressInfoPlugin;
  var _HitShowPlugin = class _HitShowPlugin extends BasePlugin {
    constructor() {
      super(), i(this, "$contentBox", $(".section .container")), i(this, "loadGeneration", 0);
    }
    getName() {
      return "HitShowPlugin";
    }
    async initCss() {
      return `<style>.jhs-hitshow-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--jhs-space-3);flex-wrap:wrap}.jhs-hitshow-title{margin:0!important}.jhs-hitshow-list{margin-top:var(--jhs-space-3)}</style>`;
    }
    async handle() {
      $('a[href*="rankings/playback"]').on("click", ((e2) => {
        e2.preventDefault(), e2.stopPropagation(), window.location.href = "/advanced_search?handlePlayback=1&period=daily";
      })), await this.handlePlayback();
    }
    hookPage() {
      let e2 = $("h2.section-title");
      e2.contents().first().replaceWith("热播"), e2.addClass("jhs-hitshow-title"), e2.parent(".jhs-hitshow-heading").length || e2.wrap('<header class="jhs-hitshow-heading"></header>'), $(".empty-message").remove(), $(".section .container .box").remove(), $(".movie-list.jhs-hitshow-list").remove(), this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-hitshow-list"></div>');
    }
    async handlePlayback() {
      if (!isHitShowPage()) return;
      const period = new URLSearchParams(window.location.search).get("period"), generation = ++this.loadGeneration;
      this.hookPage(), this.toolBar(period);
      const loadingObj = loading();
      let loadingClosed = false;
      try {
        const movies = await this.fetchPlaybackWithRetry(period);
        if (generation !== this.loadGeneration) return;
        $(".movie-list").html(this.markDataListHtml(movies));
        await this.initializeRenderedList();
        await this.getBean("ListPageButtonPlugin").sortItems();
        loadingObj.close(), loadingClosed = true;
        void this.loadScore(movies, generation).then((async () => {
          if (generation === this.loadGeneration && "rateCount" === localStorage.getItem("jhs_sortMethod")) await this.getBean("ListPageButtonPlugin").sortItems();
        })).catch(((error) => clog.error("热播评分补全失败", error)));
      } catch (error) {
        clog.error("所有重试尝试均失败，无法获取数据。", error);
      } finally {
        loadingClosed || loadingObj.close();
      }
    }
    async fetchPlaybackWithRetry(period) {
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) try {
        return await W(period);
      } catch (error) {
        lastError = error;
        if (attempt < 3) clog.error(`获取热播数据失败 (第 ${attempt} 次重试)`, error), await new Promise(((resolve) => setTimeout(resolve, 1e3)));
      }
      throw lastError;
    }
    async initializeRenderedList() {
      const listPage = this.getBean("ListPagePlugin");
      listPage.replaceHdImg(), await listPage.doFilter(), listPage.applyVisibility(), listPage.bindMovieDetailNavigation(listPage.getSelector().boxSelector);
      this.getBean("CoverButtonPlugin").addSvgBtn();
    }
    toolBar(e2) {
      $("#jhs-hitshow-period").remove();
      let t2 = `
            <nav id="jhs-hitshow-period" class="jhs-segmented" role="tablist" aria-label="热播周期">
                <a role="tab" class="jhs-segmented__item ${"daily" === e2 ? "active" : ""}" aria-selected="${"daily" === e2 ? "true" : "false"}" tabindex="${"daily" === e2 ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>
                <a role="tab" class="jhs-segmented__item ${"weekly" === e2 ? "active" : ""}" aria-selected="${"weekly" === e2 ? "true" : "false"}" tabindex="${"weekly" === e2 ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>
                <a role="tab" class="jhs-segmented__item ${"monthly" === e2 ? "active" : ""}" aria-selected="${"monthly" === e2 ? "true" : "false"}" tabindex="${"monthly" === e2 ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>
            </nav>
        `;
      $(".jhs-hitshow-heading").append(t2);
    }
    getStarRating(e2) {
      let t2 = "";
      const n2 = Math.floor(e2);
      for (let a2 = 0; a2 < n2; a2++) t2 += '<i class="icon-star"></i>';
      for (let a2 = 0; a2 < 5 - n2; a2++) t2 += '<i class="icon-star gray"></i>';
      return t2;
    }
    async loadScore(movies, generation = this.loadGeneration) {
      if (0 === movies.length) return;
      const cacheKey = "jhs_score_info";
      let cache = {};
      try {
        cache = JSON.parse(localStorage.getItem(cacheKey) || "{}");
      } catch (error) {
        clog.warn("评分缓存解析失败，将重新建立缓存", error);
      }
      const queue = [...movies], workers = Array.from({ length: Math.min(4, queue.length) }, (() => this.scoreWorker(queue, cache, generation)));
      await Promise.all(workers), localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
    async scoreWorker(queue, cache, generation) {
      for (; ; ) {
        const movie = queue.shift();
        if (!movie) return;
        try {
          if (generation !== this.loadGeneration) return;
          const id = movie.id;
          if (!$(`#score_${id}`).length || $(`#${id}`).is(":hidden")) continue;
          if (cache[id]) {
            const cached = this.normalizeScoreData(cache[id]);
            this.appendScore(id, cached.score, cached.watchedCount);
            continue;
          }
          const result = await V(id);
          if (generation !== this.loadGeneration) return;
          const score = Number(result.score), watchedCount = Number(result.watchedCount);
          this.appendScore(id, score, watchedCount), cache[id] = { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
        } catch (error) {
          $(`#${movie.id}`).attr("data-jhs-rate-count", "0"), clog.error(`解析评分数据失败 | 编号: ${movie.number}
`, `错误详情: ${error.message}
`, error.stack ? `调用栈:
${error.stack}` : "");
        }
      }
    }
    normalizeScoreData(value) {
      const html = "string" == typeof value ? value : String(value?.html || ""), score = Number(value?.score ?? (html.match(/([\d.]+)分/) || [0, 0])[1]), watchedCount = Number(value?.watchedCount ?? (html.match(/由(\d+)人/) || [0, 0])[1]);
      return { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
    }
    appendScore(e2, score, watchedCount = 0) {
      const safeScore = Math.min(5, Math.max(0, Number(score) || 0)), safeCount = Math.max(0, Number(watchedCount) || 0), card = $(`#${e2}`), target = $(`#score_${e2}`);
      card.attr("data-jhs-rate-count", String(safeCount));
      if (!target.length || "" !== target.text().trim()) return;
      const value = $('<span class="value"></span>'), stars = $('<span class="score-stars"></span>').html(this.getStarRating(safeScore));
      value.append(stars, document.createTextNode(`  ${safeScore}分，由${safeCount}人评价`)), target.hide().empty().append(value).slideDown(500);
    }
    markDataListHtml(e2) {
      let t2 = "";
      return e2.forEach(((e3, index) => {
        const coverUrl = normalizeHttpUrl(String(e3.cover_url || "").replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com"));
        t2 += `
                <div class="item" id="${escapeHtml(e3.id)}" data-jhs-publish-time="${escapeHtml(e3.release_date)}" data-jhs-rate-count="0" data-original-index="${index}">
                    <a href="/v/${escapeHtml(e3.id)}" class="box" title="${escapeHtml(e3.origin_title)}">
                        <div class="cover ">${coverUrl ? `<img loading="lazy" src="${escapeHtml(coverUrl)}" alt="">` : ""}</div>
                        <div class="video-title"><strong>${escapeHtml(e3.number)}</strong> ${escapeHtml(e3.origin_title)}</div>
                        <div class="score" id="score_${escapeHtml(e3.id)}"></div>
                        <div class="meta">${escapeHtml(e3.release_date)}</div>
                        <div class="jhs-toolbar">
                           ${e3.has_cnsub ? '<span class="jhs-badge jhs-badge--watch">含中字磁力</span>' : e3.magnets_count > 0 ? '<span class="jhs-badge jhs-badge--success">含磁力</span>' : '<span class="jhs-badge jhs-badge--neutral">无磁力</span>'}
                           ${e3.new_magnets ? '<span class="jhs-badge jhs-badge--accent">今日新增</span>' : ""}
                        </div>
                    </a>
                </div>
            `;
      })), t2;
    }
  };
  __name(_HitShowPlugin, "HitShowPlugin");
  var HitShowPlugin = _HitShowPlugin;
  var me = "jhs_appAuthorization";
  var _Top250Plugin = class _Top250Plugin extends BasePlugin {
    constructor() {
      super(), i(this, "has_cnsub", ""), i(this, "$contentBox", $(".section .container")), i(this, "movies", []);
    }
    getName() {
      return "TOP250Plugin";
    }
    async handle() {
      $('.main-tabs ul li:contains("猜你喜歡")').html('<a href="/rankings/top"><span>Top250</span></a>'), $('a[href*="rankings/top"]').on("click", ((e2) => {
        e2.preventDefault(), e2.stopPropagation();
        const t2 = $(e2.target), n2 = (t2.is("a") ? t2 : t2.closest("a")).attr("href");
        let a2 = n2.includes("?") ? n2.split("?")[1] : n2;
        const i2 = new URLSearchParams(a2);
        this.checkLogin(e2, i2);
      })), await this.handleTop();
    }
    hookPage() {
      $("h2.section-title").contents().first().replaceWith("Top250"), $(".empty-message").remove(), $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box jhs-layout-d2c171b1"></div>'), this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-layout-d2c171b1"></div>'), this.renderPagination();
    }
    renderPagination() {
      const e2 = new URLSearchParams(window.location.search);
      let t2 = parseInt(e2.get("page")) || 1;
      this.$contentBox.append(((e3) => {
        const t3 = e3 >= 5;
        let n2 = "";
        for (let a2 = 1; a2 <= 5; a2++) {
          n2 += `<li><button type="button" class="jhs-btn pagination-link ${e3 === a2 ? "is-current" : ""}" data-page="${a2}">${a2}</button></li>`;
        }
        return `
                <nav class="pagination">
                    <button type="button" class="jhs-btn pagination-previous ${e3 <= 1 ? "do-hide" : ""}" data-page="${e3 - 1}">上一页</button>
                    <button type="button" class="jhs-btn pagination-next ${t3 ? "do-hide" : ""}" data-page="${e3 + 1}">下一页</button>

                    <ul class="pagination-list">
                        ${n2}
                    </ul>
                </nav>
            `;
      })(t2)), this.$contentBox.on("click", ".pagination-link, .pagination-previous, .pagination-next", ((t3) => {
        t3.preventDefault();
        const n2 = parseInt($(t3.currentTarget).data("page"));
        !isNaN(n2) && n2 > 0 && ((t4) => {
          e2.set("page", t4), window.history.pushState({}, "", "?" + e2.toString()), window.location.reload();
        })(n2);
      }));
    }
    async handleTop() {
      if (!window.location.href.includes("handleTop=1")) return;
      const e2 = new URLSearchParams(window.location.search);
      let t2 = e2.get("handleType") || "all", n2 = e2.get("type_value") || "";
      this.has_cnsub = e2.get("has_cnsub") || "";
      let a2 = e2.get("page") || 1;
      this.toolBar(t2, n2, a2), this.hookPage();
      let i2 = $(".movie-list");
      i2.html("");
      let s2 = loading();
      let o2 = false;
      for (let l2 = 1; l2 <= 3 && !o2; l2++) try {
        const e3 = await q(t2, n2, a2, 50);
        let r2 = e3.success, l3 = e3.message, c2 = e3.action;
        if (1 === r2) {
          let t3 = e3.data.movies;
          if (0 === t3.length) return show.error("无数据"), void s2.close();
          this.movies = t3;
          const n3 = t3.filter(((e4) => "1" === this.has_cnsub ? e4.has_cnsub : "0" !== this.has_cnsub || !e4.has_cnsub)), a3 = this.getBean("HitShowPlugin");
          let r3 = a3.markDataListHtml(n3);
          i2.html(r3), await a3.initializeRenderedList(), await a3.loadScore(n3), o2 = true;
        } else clog.error(e3), i2.html(`<h3>${escapeHtml(l3)}</h3>`), show.error(l3), "JWTVerificationError" === c2 && (await localStorage.removeItem(me), await this.checkLogin(null, new URLSearchParams(window.location.search))), o2 = true;
      } catch (r2) {
        l2 < 3 ? (clog.error(`获取Top数据失败 (第 ${l2} 次重试):`, r2), await new Promise(((e3) => setTimeout(e3, 1e3)))) : (clog.error("所有重试尝试均失败，无法获取Top数据。", r2), i2.html("<h3>无法加载数据，请稍后再试。</h3>"));
      } finally {
        (o2 || 3 === l2) && s2.close();
      }
    }
    toolBar(e2, t2, n2) {
      "5" === n2.toString() && $(".pagination-next").remove(), $(".pagination-ellipsis").closest("li").remove(), $(".pagination-list li .pagination-link").each((function() {
        parseInt($(this).text()) > 5 && $(this).closest("li").remove();
      }));
      let years = "";
      for (let year = (/* @__PURE__ */ new Date()).getFullYear(); year >= 2008; year--) years += `<a class="jhs-segmented__item jhs-layout-186f17ef ${t2 === String(year) ? "active" : ""}" aria-current="${t2 === String(year) ? "page" : "false"}" href="/advanced_search?handleTop=1&handleType=year&type_value=${year}&has_cnsub=${this.has_cnsub}">${year}</a>`;
      const typeLink = /* @__PURE__ */ __name((value, label, type = "video_type") => `<a class="jhs-segmented__item jhs-layout-186f17ef ${value === ("all" === value ? e2 : t2) ? "active" : ""}" aria-current="${value === ("all" === value ? e2 : t2) ? "page" : "false"}" href="/advanced_search?handleTop=1&handleType=${type}&type_value=${"all" === value ? "" : value}&has_cnsub=${this.has_cnsub}">${label}</a>`, "typeLink");
      const html = `<div class="jhs-top250-filters"><nav class="jhs-segmented jhs-layout-701bf0f9" aria-label="类型条件">${typeLink("all", "全部", "all")}${typeLink("0", "有码")}${typeLink("1", "无码")}${typeLink("2", "欧美")}${typeLink("3", "Fc2")}<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm jhs-layout-2335597e ${"1" === this.has_cnsub ? "active" : ""}" aria-pressed="${"1" === this.has_cnsub}" data-cnsub-value="1">含中字磁力</button><button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm jhs-layout-186f17ef ${"0" === this.has_cnsub ? "active" : ""}" aria-pressed="${"0" === this.has_cnsub}" data-cnsub-value="0">无字幕</button><button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm jhs-layout-186f17ef" aria-pressed="false" data-cnsub-value="">重置</button></nav><nav class="jhs-segmented" aria-label="年份条件">${years}</nav></div>`;
      this.$contentBox.append(html), $("button[data-cnsub-value]").on("click", (async (event) => {
        const value = $(event.currentTarget).data("cnsub-value");
        this.has_cnsub = value.toString(), $("button[data-cnsub-value]").removeClass("active").attr("aria-pressed", "false"), $(event.currentTarget).addClass("active").attr("aria-pressed", "true"), $(".jhs-top250-filters a").each(((index, element) => {
          const link = $(element), url = new URL(link.attr("href"), window.location.origin);
          url.searchParams.set("has_cnsub", value), link.attr("href", url.toString());
        }));
        const movies = this.movies.filter(((movie) => "1" === this.has_cnsub ? movie.has_cnsub : "0" !== this.has_cnsub || !movie.has_cnsub)), hitShow = this.getBean("HitShowPlugin");
        $(".movie-list").html(hitShow.markDataListHtml(movies)), await hitShow.initializeRenderedList(), void hitShow.loadScore(movies).catch(((error) => clog.error("Top250 评分加载失败", error)));
      }));
    }
    async checkLogin(e2, t2) {
      if (!localStorage.getItem(me)) return show.error("该类别依赖移动端接口，请先完成登录"), void this.openLoginDialog();
      let n2 = "all", a2 = "", i2 = t2.get("t") || "";
      /^y\d+$/.test(i2) ? (n2 = "year", a2 = i2.substring(1)) : "" !== i2 && (n2 = "video_type", a2 = i2);
      let s2 = `/advanced_search?handleTop=1&handleType=${n2}&type_value=${a2}`;
      e2 && (e2.ctrlKey || e2.metaKey) ? GM_openInTab(window.location.origin + s2, {
        insert: 0
      }) : window.location.href = s2;
    }
    openLoginDialog() {
      layer.open({
        type: 1,
        title: "JavDB",
        closeBtn: 1,
        area: utils.getResponsiveArea(["360px", "auto"]),
        shadeClose: false,
        content: `
                <style>#loginBtn:hover{background:var(--jhs-accent-hover)}</style>
                <div class="jhs-layout-e32cff7f">
                    <div class="jhs-layout-598afa5a">
                        <input type="text" id="username" name="username"

                            placeholder="用户名 | 邮箱"
                            onfocus="this.style.borderColor='var(--jhs-accent)'; this.style.background='var(--jhs-surface)'"
                            onblur="this.style.borderColor='var(--jhs-border-strong)'; this.style.background='var(--jhs-surface-2)'" class="jhs-field">
                    </div>

                    <div class="jhs-layout-da303dcf">
                        <input type="password" id="password" name="password"

                            placeholder="密码"
                            onfocus="this.style.borderColor='var(--jhs-accent)'; this.style.background='var(--jhs-surface)'"
                            onblur="this.style.borderColor='var(--jhs-border-strong)'; this.style.background='var(--jhs-surface-2)'" class="jhs-field">
                    </div>

                    <button id="loginBtn"

                             class="jhs-btn jhs-layout-c4eb15bf">
                        登录
                    </button>
                </div>
            `,
        success: /* @__PURE__ */ __name((e2, t2) => {
          $("#loginBtn").click((function() {
            const e3 = $("#username").val(), n2 = $("#password").val();
            if (!e3 || !n2) return void show.error("请输入用户名和密码");
            let a2 = loading();
            (async (e4, t3) => {
              let n3 = `${U}/v1/sessions?username=${encodeURIComponent(e4)}&password=${encodeURIComponent(t3)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`, a3 = {
                "user-agent": "Dart/3.5 (dart:io)",
                "accept-language": "zh-TW",
                "content-type": "multipart/form-data; boundary=--dio-boundary-2210433284",
                jdsignature: await O()
              };
              return await gmHttp.post(n3, null, a3);
            })(e3, n2).then((async (e4) => {
              let n3 = e4.success;
              if (0 === n3) show.error(e4.message);
              else {
                if (1 !== n3) throw clog.error("登录失败", e4), new Error(e4.message);
                {
                  let n4 = e4.data.token;
                  await localStorage.setItem(me, await encryptData(n4)), show.ok("登录成功"), layer.close(t2), window.location.href = "/advanced_search?handleTop=1&period=daily";
                }
              }
            })).catch(((e4) => {
              clog.error("登录异常:", e4), show.error(e4.message);
            })).finally((() => {
              a2.close();
            }));
          }));
        }, "success")
      });
    }
  };
  __name(_Top250Plugin, "Top250Plugin");
  var Top250Plugin = _Top250Plugin;
  var _NavBarPlugin = class _NavBarPlugin extends BasePlugin {
    getName() {
      return "NavBarPlugin";
    }
    async initCss() {
      return "\n            .highlight-red {\n    /* 核心要求：高亮红色文本 */\n    color: var(--jhs-status-filter) !important;\n    \n    /* 建议：增加字体加粗，效果更明显 */\n    font-weight: bold;\n    \n    /* 建议：增加背景色，效果更突出 */\n    /* background-color: yellow; */ \n}\n        ";
    }
    handle() {
      if (this.margeNav(), this.hookSearch(), this.hookOldSearch(), this.toggleOtherNavItem(), $(window).resize(this.toggleOtherNavItem), JhsSelect.enhance("#search-box"), window.location.href.includes("/search")) {
        const e2 = new URLSearchParams(window.location.search);
        let t2 = e2.get("q"), n2 = e2.get("f");
        $("#search-keyword").val(t2), n2 && JhsSelect.setValue("#search-type", n2), t2 && this.highlightKeyword(t2);
      }
    }
    highlightKeyword(e2) {
      const t2 = e2.trim();
      if (!t2) return;
      const n2 = t2.toLowerCase();
      $(".video-title strong, .actor-box strong").each((function() {
        const e3 = $(this);
        e3.text().toLowerCase().includes(n2) && e3.addClass("highlight-red");
      }));
    }
    hookSearch() {
      $("#navbar-menu-hero").after('\n            <div class="navbar-menu jhs-ui" id="search-box">\n                <div class="navbar-start jhs-layout-d9caa2c0">\n                    <select id="search-type" class="jhs-select-source">\n                        <option value="all">影片</option>\n                        <option value="actor">演员</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">导演</option>\n                        <option value="code">番号</option>\n                        <option value="list">清单</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="输入影片番号、演员名等关键词进行检索" class="jhs-field">\n                    <a href="/advanced_search?noFold=1" title="高级检索" class="jhs-btn jhs-btn--secondary"><span>...</span></a>\n                    <button type="button" id="search-img-btn" class="jhs-btn jhs-btn--secondary">识图</button>\n                    <button type="button" id="search-btn" class="jhs-btn jhs-btn--primary">检索</button>\n                </div>\n            </div>\n        '), $("#search-keyword").on("paste", ((e2) => {
        const t2 = e2.originalEvent.clipboardData.items;
        for (let n2 = 0; n2 < t2.length; n2++) if (-1 !== t2[n2].type.indexOf("image")) {
          const e3 = t2[n2].getAsFile();
          $("#search-keyword").blur();
          const a2 = this.getBean("SearchByImagePlugin");
          return void a2.open((() => {
            a2.handleImageFile(e3), a2.resetSearchUI();
          }));
        }
      })).on("keypress", ((e2) => {
        "Enter" === e2.key && setTimeout((() => {
          $("#search-btn").click();
        }), 0);
      })), $("#search-btn").on("click", ((e2) => {
        let t2 = $("#search-keyword").val(), n2 = $("#search-type").val();
        "" !== t2 && (window.location.href.includes("/search") ? window.location.href = "/search?q=" + t2 + "&f=" + n2 : window.open("/search?q=" + t2 + "&f=" + n2));
      })), $("#search-img-btn").on("click", (() => {
        this.getBean("SearchByImagePlugin").open();
      }));
    }
    hookOldSearch() {
      const e2 = document.querySelector(".search-image");
      if (!e2) return;
      const t2 = e2.cloneNode(true);
      e2.parentNode.replaceChild(t2, e2), $("#button-search-image").attr("data-tooltip", "以图识图"), $(".search-image").on("click", ((e3) => {
        this.getBean("SearchByImagePlugin").open();
      }));
    }
    margeNav() {
      $('a[href*="/feedbacks/new"]').remove(), $('a[href*="theporndude.com"]').remove(), $('a.navbar-link[href="/makers"]').parent().after('\n            <div class="navbar-item has-dropdown is-hoverable">\n                <a class="navbar-link">其它</a>\n                <div class="navbar-dropdown is-boxed">\n                  <a class="navbar-item" href="/feedbacks/new" target="_blank" >反饋</a>\n                  <a class="navbar-item" rel="nofollow noopener" target="_blank" href="https://theporndude.com/zh">ThePornDude</a>\n                </div>\n              </div>\n        ');
    }
    toggleOtherNavItem() {
      let e2 = $("#search-box"), t2 = $("#search-bar-container");
      $(window).width() < 1600 && $(window).width() > 1023 && (e2.hide(), t2.show()), $(window).width() > 1600 && (e2.show(), t2.hide());
    }
  };
  __name(_NavBarPlugin, "NavBarPlugin");
  var NavBarPlugin = _NavBarPlugin;
  var _StorageQueue = class _StorageQueue {
    constructor() {
      this.queue = Promise.resolve();
    }
    addTask(e2) {
      const task = this.queue.then((() => e2()));
      return this.queue = task.catch(((e3) => {
        clog.error("执行异步队列任务失败:", e3);
      })), task;
    }
    async waitAllFinished() {
      return this.queue;
    }
  };
  __name(_StorageQueue, "StorageQueue");
  var StorageQueue = _StorageQueue;
  var _OtherSitePlugin = class _OtherSitePlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "siteConfigs", [{
        id: "javTrailersBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getJavTrailersUrl(), "getBaseUrl"),
        itemSelector: ".videos-list .video-link",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/search/${t2}`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2) => e2.attr("href"), "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.find("p.card-text").text(), "findCarNumOrTitle")
      }, {
        id: "123AvBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => `${await this.getAv123Url()}/cn`, "getBaseUrl"),
        itemSelector: ".card",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/search?keyword=${encodeURIComponent(t2)}`, "searchPath"),
        requestOptions: { cookiePartitionTopLevelSite: "https://123av.com" },
        getDetailPageHref: /* @__PURE__ */ __name((e2, t2) => {
          const href = e2.find('a.card__link[href*="/cn/v/"]').first().attr("href");
          return href ? new URL(href, t2).href : null;
        }, "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.find(".card__link").first().text(), "findCarNumOrTitle"),
        matches: /* @__PURE__ */ __name((text, carNum) => text.replace(/FC2-PPV-/gi, "FC2-").toLowerCase().includes(carNum.toLowerCase()), "matches")
      }, {
        id: "jableBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getjableUrl(), "getBaseUrl"),
        itemSelector: "#list_videos_videos_list_search_result .detail .title a",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/search/${t2}/`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2) => e2.attr("href"), "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.text(), "findCarNumOrTitle")
      }, {
        id: "avgleBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getAvgleUrl(), "getBaseUrl"),
        itemSelector: ".text-secondary",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/vod/search.html?wd=${t2}`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2) => e2.attr("href"), "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.text(), "findCarNumOrTitle")
      }, {
        id: "missAvBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getMissAvUrl(), "getBaseUrl"),
        itemSelector: ".text-secondary",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/search/${t2}`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2) => e2.attr("href"), "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.text(), "findCarNumOrTitle")
      }, {
        id: "supJavBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getSupJavUrl(), "getBaseUrl"),
        itemSelector: ".posts post",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/?s=${t2}`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2, t2, n2) => e2.attr("href"), "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.attr("title"), "findCarNumOrTitle")
      }, {
        id: "javDbBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getJavDbUrl(), "getBaseUrl"),
        itemSelector: ".movie-list .item",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/search?q=${t2}`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2) => e2.find("a").attr("href"), "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.find(".video-title").text(), "findCarNumOrTitle"),
        condition: /* @__PURE__ */ __name((e2) => l, "condition")
      }, {
        id: "javBusBtn",
        getBaseUrl: /* @__PURE__ */ __name(async () => await this.getJavBusUrl(), "getBaseUrl"),
        itemSelector: ".container h3",
        searchPath: /* @__PURE__ */ __name((e2, t2) => `${e2}/${t2}`, "searchPath"),
        getDetailPageHref: /* @__PURE__ */ __name((e2, t2, n2) => `${t2}/${n2}`, "getDetailPageHref"),
        findCarNumOrTitle: /* @__PURE__ */ __name((e2) => e2.text(), "findCarNumOrTitle"),
        condition: /* @__PURE__ */ __name((e2) => r && e2 && !e2.includes("FC2"), "condition")
      }, {
        id: "fanzaBtn",
        noHandle: true,
        initUrl: /* @__PURE__ */ __name((e2) => `https://www.dmm.co.jp/search/=/searchstr=${e2}`, "initUrl"),
        condition: /* @__PURE__ */ __name((e2) => e2 && !e2.includes("FC2"), "condition")
      }]), i(this, "settingCache", null), i(this, "lastFetchTime", 0), i(this, "CACHE_DURATION", 1e4);
    }
    getName() {
      return "OtherSitePlugin";
    }
    async initCss() {
      return `
            <style>
                #otherSiteBox, #settingsArea { margin-top:var(--jhs-space-2); user-select:none; }
                .jhs-site-list, #siteCheckboxes { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .site-btn { position:relative; }
                .site-btn::before { width:7px; height:7px; border-radius:50%; background:var(--jhs-brand-color,var(--jhs-text-faint)); content:""; }
                #javTrailersBtn { --jhs-brand-color:#d4a72c; } #123AvBtn { --jhs-brand-color:#e05d44; }
                #jableBtn { --jhs-brand-color:#c94556; } #avgleBtn { --jhs-brand-color:#4677c8; }
                #missAvBtn { --jhs-brand-color:#8b5cf6; } #supJavBtn { --jhs-brand-color:#ef6c35; }
                #javDbBtn { --jhs-brand-color:#2684ff; } #javBusBtn { --jhs-brand-color:#cc3d3d; } #fanzaBtn { --jhs-brand-color:#ea4c89; }
                .site-btn.is-checking { opacity:.65; pointer-events:none; }
                .site-btn.is-available { border-color:var(--jhs-status-down-text); background:var(--jhs-status-down-tint); }
                .site-btn.is-unavailable { border-color:var(--jhs-status-filter-text); background:var(--jhs-status-filter-tint); }
                .site-btn.is-domain-error { border-color:var(--jhs-status-watch-text); background:var(--jhs-status-watch-tint); }
                .site-tag { margin-left:var(--jhs-space-1); padding:1px var(--jhs-space-1); border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-site-option { display:flex; align-items:center; gap:var(--jhs-space-2); }
            </style>`;
    }
    async handle() {
      isDetailPage && await this.loadOtherSite(null, null, {
        autoDetect: false
      });
    }
    async loadOtherSite(e2, t2, n2 = {}) {
      if ("yes" !== await storageManager.getSetting("enableLoadOtherSite", "yes")) return;
      $("#otherSiteBox,#settingsArea").remove();
      e2 = normalizeCarNum(e2) || this.getPageInfo().carNum;
      const a2 = this.getEnabledSites(), i2 = `
            <div id="otherSiteBox" class="panel-block">
                <div class="jhs-site-list">
                    ${this.siteConfigs.map(((e3) => {
        if (e3.sourceCarNum = t2, e3.condition && false === e3.condition(e3.sourceCarNum)) return "";
        return `<a target="_blank" class="site-btn jhs-btn jhs-btn--secondary ${a2.includes(e3.id) ? "" : "jhs-is-hidden"}" id="${e3.id}"><span>${e3.id.replace("Btn", "")}</span></a>`;
      })).join("")}
                    <button type="button" id="detectOtherSiteBtn" class="site-btn jhs-btn jhs-btn--primary"><span>检测外部站点</span></button>
                    <button type="button" id="settingSiteBtn" class="site-btn jhs-btn jhs-btn--secondary"><span>设置</span></button>
                </div>
            </div>
            <div id="settingsArea" class="panel-block jhs-is-hidden"><div id="siteCheckboxes"></div></div>
        `;
      $(".movie-panel-info").append(i2), $(".container .info").append(i2);
      if (!e2) return $("#otherSiteBox .site-btn").removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), $("#detectOtherSiteBtn").prop("disabled", true), this.renderSettingsArea(), this.setupEventListeners(), void clog.warn("跳过第三方站点解析：番号不可用");
      $("#javTrailersBtn").on("click", (async (t3) => {
        t3.preventDefault();
        let o2 = $("#javTrailersBtn").attr("href"), r2 = o2 + "?handle=1";
        t3 && (t3.ctrlKey || t3.metaKey) && (r2 = o2), utils.openPage(r2, e2, false, t3);
      })), await Promise.all(this.siteConfigs.map((async (t3) => {
        t3.condition && false === t3.condition(t3.sourceCarNum) || await this.prepareSiteLink(e2, t3);
      }))), this.renderSettingsArea(), this.setupEventListeners(), $("#detectOtherSiteBtn").off("click").on("click", ((t3) => {
        t3.preventDefault(), this.detectOtherSites(e2);
      })), n2.autoDetect && await this.detectOtherSites(e2);
    }
    async prepareSiteLink(e2, t2) {
      const n2 = $(`#${t2.id}`);
      if (!(e2 = normalizeCarNum(e2))) return n2.removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), void this.setSiteState(n2, "idle");
      if (t2.initUrl) return void (n2.attr("href", t2.initUrl(e2)), this.setSiteState(n2, "idle"), n2.attr("title", "点击前往外部搜索页"));
      try {
        const a2 = await t2.getBaseUrl(), i2 = t2.searchPath(a2, e2);
        n2.attr("href", i2), n2.attr("title", "点击前往外部搜索页；点击检测按钮后才自动检测"), this.setSiteState(n2, "idle");
      } catch (a2) {
        n2.attr("title", "外部站点地址未配置或不可用"), this.setSiteState(n2, "domain-error");
      }
    }
    async detectOtherSites(e2) {
      const t2 = $("#detectOtherSiteBtn"), n2 = t2.text();
      if (!(e2 = normalizeCarNum(e2))) return t2.prop("disabled", true), void clog.warn("跳过第三方站点检测：番号不可用");
      return t2.text("检测中").prop("disabled", true).addClass("is-checking"), await Promise.all(this.siteConfigs.map((async (t3) => {
        t3.condition && false === t3.condition(t3.sourceCarNum) || await this.handleSite(e2, t3);
      }))), t2.text(n2).prop("disabled", false).removeClass("is-checking");
    }
    setSiteState(e2, t2) {
      e2.removeClass("is-checking is-available is-unavailable is-domain-error"), "idle" !== t2 && e2.addClass(`is-${t2}`);
    }
    async handleSite(e2, t2) {
      const n2 = $(`#${t2.id}`);
      n2.removeAttr("href").find(".site-tag").remove(), this.setSiteState(n2, "checking");
      if (t2.initUrl && n2.attr("href", t2.initUrl(e2)), t2.noHandle && true === t2.noHandle) {
        const t3 = "jhs_other_site_dmm", a2 = (localStorage.getItem(t3) ? JSON.parse(localStorage.getItem(t3)) : {})[e2];
        a2 ? (n2.attr("href", a2.url), "multiple" === a2.type && n2.append('<span class="site-tag">多结果</span>'), this.setSiteState(n2, "available")) : this.setSiteState(n2, "idle");
      } else try {
        if (n2.attr("href")) return void this.setSiteState(n2, "idle");
        if (utils.isHidden(n2)) return;
        const a2 = "jhs_other_site", i2 = localStorage.getItem(a2) ? JSON.parse(localStorage.getItem(a2)) : {}, s2 = e2 + "_" + t2.id.replace("Btn", ""), o2 = i2[s2], m2 = Date.now();
        if (o2 && o2.time && m2 - o2.time < 864e5) return void (n2.attr("href", o2.url), "multiple" === o2.type && n2.append('<span class="site-tag">多结果</span>'), this.setSiteState(n2, "available"));
        const r2 = await t2.getBaseUrl(), l2 = t2.searchPath(r2, e2);
        n2.attr("href", l2);
        const _breaker = gmHttp.isDomainCircuitBroken(l2);
        if (_breaker) {
          n2.attr("title", `站点已熔断，${_breaker.remaining}秒后重试`), this.setSiteState(n2, "domain-error");
          return;
        }
        const c2 = await storageManager.cachedRequest(`other-site:${t2.id}:${e2}`, 864e5, (() => gmHttp.get(l2, null, t2.headers, true, t2.requestOptions || {}))), d2 = utils.htmlTo$dom(c2), h2 = [];
        d2.find(t2.itemSelector).each(((n3, a3) => {
          const i3 = $(a3);
          const itemText = t2.findCarNumOrTitle(i3);
          if (t2.matches ? !t2.matches(itemText, e2) : !itemText.toLowerCase().includes(e2.toLowerCase())) return;
          let s3 = t2.getDetailPageHref(i3, r2, e2);
          if (!s3) throw new Error("解析href失败");
          s3.includes("http") || (s3 = r2 + (s3.startsWith("/") ? s3 : "/" + s3)), h2.push(s3);
        }));
        let g2 = "", p2 = null;
        if (1 === h2.length) {
          let e3 = h2[0];
          n2.attr("href", e3), this.setSiteState(n2, "available"), p2 = {
            type: "single",
            url: e3,
            time: m2
          };
        } else h2.length > 1 ? (n2.attr("href", l2), g2 += '<span class="site-tag">多结果</span>', this.setSiteState(n2, "available"), p2 = {
          type: "multiple",
          url: l2,
          time: m2
        }) : (n2.attr("href", l2), n2.attr("title", "未查询到, 点击前往搜索页"), this.setSiteState(n2, "unavailable"));
        if (p2) {
          const e3 = localStorage.getItem(a2) ? JSON.parse(localStorage.getItem(a2)) : {};
          e3[s2] = p2, localStorage.setItem(a2, JSON.stringify(e3));
        }
        g2 && n2.append(g2);
      } catch (a2) {
        const e3 = String(a2), i2 = t2.id.replace("Btn", "");
        a2._circuitBroken ? (n2.attr("title", e3), this.setSiteState(n2, "domain-error"), clog.warn(`检测第三方资源跳过, ${i2} 已熔断`)) : a2?._cfBlocked ? (n2.attr("title", "请求失败：Cloudflare 安全检查。"), this.setSiteState(n2, "domain-error"), clog.warn(`检测第三方资源失败, ${i2} 需Cloudflare安全检查`)) : e3.includes("重定向") ? (n2.attr("title", "域名失效"), this.setSiteState(n2, "domain-error"), clog.warn(`检测第三方资源失败, ${i2} 域名被重定向`)) : e3.includes("404 Page Not Found") ? (n2.attr("title", "未查询到, 点击前往搜索页"), this.setSiteState(n2, "unavailable")) : (clog.error(a2), n2.attr("title", "请求失败。"), this.setSiteState(n2, "unavailable"), clog.warn(`检测第三方资源失败, ${i2}`));
      }
    }
    async getSettingCache() {
      const e2 = Date.now();
      return (!this.settingCache || e2 - this.lastFetchTime > this.CACHE_DURATION) && (this.settingCache = await storageManager.getSetting(), this.lastFetchTime = e2), this.settingCache;
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
      const fallback = this.siteConfigs.map(((site) => site.id));
      try {
        const raw = localStorage.getItem("jhs_enabled_sites");
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(((id) => fallback.includes(id))) : fallback;
      } catch (error) {
        return clog.warn("外部站点配置损坏，已回退默认值", error), fallback;
      }
    }
    saveEnabledSites(e2) {
      localStorage.setItem("jhs_enabled_sites", JSON.stringify(e2));
    }
    renderSettingsArea() {
      const e2 = this.getEnabledSites(), t2 = document.getElementById("siteCheckboxes");
      t2 && (t2.innerHTML = this.siteConfigs.map(((t3) => {
        const n2 = e2.includes(t3.id);
        return `
                <label class="jhs-site-option" for="checkbox-${t3.id}">
                    <input type="checkbox" id="checkbox-${t3.id}" data-site-id="${t3.id}" ${n2 ? "checked" : ""}>
                    <span>${t3.id.replace("Btn", "")}</span>
                </label>
            `;
      })).join(""));
    }
    setupEventListeners() {
      const $settingsArea = $("#settingsArea");
      $("#settingSiteBtn").off("click.jhsOtherSite").on("click.jhsOtherSite", (() => {
        $settingsArea.toggleClass("jhs-is-hidden");
      })), $settingsArea.off("change.jhsOtherSite").on("change.jhsOtherSite", 'input[type="checkbox"]', (async (event) => {
        const siteId = $(event.currentTarget).attr("data-site-id");
        try {
          if (event.currentTarget.checked) {
            $(`#${siteId}`).removeClass("jhs-is-hidden");
            const carNum = this.getPageInfo().carNum, site = this.siteConfigs.find(((item) => item.id === siteId));
            site && await this.prepareSiteLink(carNum, site);
          } else $(`#${siteId}`).addClass("jhs-is-hidden");
          this.saveEnabledSites($settingsArea.find('input[type="checkbox"]:checked').map(((index, input) => $(input).attr("data-site-id"))).get());
        } catch (error) {
          clog.warn(`外部站点 ${siteId || "unknown"} 状态更新失败`, error);
        }
      }));
    }
  };
  __name(_OtherSitePlugin, "OtherSitePlugin");
  var OtherSitePlugin = _OtherSitePlugin;
  var _BusDetailPagePlugin = class _BusDetailPagePlugin extends BasePlugin {
    getName() {
      return "BusDetailPagePlugin";
    }
    async initCss() {
      if (!window.isDetailPage) return "";
      $("h4:contains('推薦')").hide();
    }
    async handle() {
      if (window.location.href.includes("/star/")) {
        const e2 = $(".avatar-box");
        if (e2.length > 0) {
          let t2 = e2.parent();
          t2.css("position", "initial"), t2.insertBefore(t2.parent());
        }
      }
      $(".genre a").each((function() {
        const e2 = $(this).attr("href");
        e2 && (e2.startsWith("http://") || e2.startsWith("https://") || e2.startsWith("/")) && $(this).attr("target", "_blank");
      })), this.addCopyCarNumBtn();
    }
    addCopyCarNumBtn() {
      let e2 = null;
      const t2 = document.querySelectorAll("span.header");
      for (const n2 of t2) if ("識別碼:" === n2.textContent.trim()) {
        e2 = n2;
        break;
      }
      if (e2) {
        const t3 = e2.nextElementSibling;
        if (t3 && "SPAN" === t3.tagName) {
          const e3 = t3.textContent.trim(), n2 = document.createElement("button");
          n2.type = "button", n2.className = "jhs-btn jhs-btn--secondary jhs-copy-car-number", n2.textContent = "复制", n2.addEventListener("click", (async function(t4) {
            t4.preventDefault();
            await utils.copyToClipboard("番号", e3) && (() => {
              this.textContent = "已复制", setTimeout((() => {
                this.textContent = "复制";
              }), 1500);
            })();
          })), t3.parentNode.insertBefore(n2, t3.nextSibling);
        }
      }
    }
  };
  __name(_BusDetailPagePlugin, "BusDetailPagePlugin");
  var BusDetailPagePlugin = _BusDetailPagePlugin;
  var _DetailPageButtonPlugin = class _DetailPageButtonPlugin extends BasePlugin {
    getName() {
      return "DetailPageButtonPlugin";
    }
    constructor() {
      super(), this.answerCount = 1, this.stateBinding = null;
    }
    async handle() {
      this.hideVideoControls(), window.isDetailPage && (await this.createMenuBtn(), await this.autoRemoveNewVideoMark());
    }
    async autoRemoveNewVideoMark() {
      try {
        const e2 = await storageManager.getSetting("autoRemoveNewVideoMarkAfterBrowse", C);
        if (e2 !== _) return;
        const t2 = this.getPageInfo();
        if (!t2.carNum) return;
        await stateService.removeFromNewVideoList([t2.carNum], "browse");
      } catch (e2) {
        clog.error("自动移除新作品标记失败:", e2);
      }
    }
    async createMenuBtn() {
      const e2 = this.getPageInfo(), t2 = e2.carNum, n2 = `
            <div class="jhs-detail-btn-row jhs-layout-e2965a97">
                <div class="jhs-layout-1e90930a">
                    <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter jhs-layout-44293084">
                        <span>${m}</span>
                    </button>
                    <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav jhs-layout-44293084">
                        <span>${v}</span>
                    </button>
                    <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down jhs-layout-44293084">
                        <span>${y}</span>
                    </button>
                    <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch jhs-layout-44293084">
                        <span>${k}</span>
                    </button>
                </div>

                <div class="jhs-layout-1e90930a">
                    <button type="button" id="enable-magnets-filter" class="jhs-btn jhs-btn--watch jhs-layout-5f3e3549">
                        <span id="magnets-span">关闭磁力过滤</span>
                    </button>
                    <button type="button" id="magnetSearchBtn" class="jhs-btn jhs-btn--accent jhs-layout-44293084">
                        <span>磁力搜索</span>
                    </button>
                    <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent jhs-layout-44293084">
                        <span>字幕 (迅雷)</span>
                    </button>
                    <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent jhs-layout-f43f0d6d">
                        <span>字幕 (SubTitleCat)</span>
                    </button>
                </div>
            </div>
        `;
      const workspaceSlot = this.getBean("DetailWorkspacePlugin")?.getSlot("summary-actions");
      workspaceSlot?.length ? workspaceSlot.append(n2) : r ? $(".tabs").after(n2) : l && $("#mag-submit-show").before(n2), $("#magnetSearchBtn").on("click", (async () => {
        let t3 = await this.getBean("MagnetHubPlugin").createMagnetHub(e2.carNum);
        layer.open({
          type: 1,
          title: "磁力搜索 " + e2.carNum,
          content: '<div id="magnetHubBox"></div>',
          area: utils.getResponsiveArea(["60%", "80%"]),
          scrollbar: false,
          success: /* @__PURE__ */ __name(() => {
            $("#magnetHubBox").append(t3);
          }, "success")
        });
      }));
      const a2 = this.getBean("HighlightMagnetPlugin"), i2 = await storageManager.getSetting("enableMagnetsFilter", _);
      $("#magnets-span").text(i2 === _ ? "关闭磁力过滤" : "开启磁力过滤"), i2 === _ && a2.doFilterMagnet(), $("#enable-magnets-filter").on("click", ((e3) => {
        let t3 = $("#magnets-span");
        "关闭磁力过滤" === t3.text() ? (a2.showAll(), t3.text("开启磁力过滤"), storageManager.saveSettingItem("enableMagnetsFilter", C)) : (a2.doFilterMagnet(), t3.text("关闭磁力过滤"), storageManager.saveSettingItem("enableMagnetsFilter", _));
      })), $("#search-subtitle-btn").on("click", ((e3) => utils.openPage(`https://subtitlecat.com/index.php?search=${t2}`, t2, false, e3))), $("#xunLeiSubtitleBtn").on("click", (() => this.searchXunLeiSubtitle(t2)));
      if (!t2) {
        $("#filterBtn, #favoriteBtn, #hasDownBtn, #hasWatchBtn, #magnetSearchBtn, #xunLeiSubtitleBtn, #search-subtitle-btn").prop("disabled", true).attr("title", "番号不可用");
        return void clog.warn("详情操作不可用：番号不可用");
      }
      this.stateBinding = detailStateController.bind({ root: document, carNum: t2, activityType: "detail-state", getRecord: /* @__PURE__ */ __name(() => this.getStateRecord(), "getRecord") });
    }
    async showStatus(e2) {
      return detailStateController.render({ root: document, carNum: e2 });
    }
    getStateRecord() {
      const info = this.getPageInfo();
      return { carNum: info.carNum, url: info.url, names: info.actress, publishTime: info.publishTime };
    }
    getStateBinding() {
      if (this.stateBinding) return this.stateBinding;
      const info = this.getPageInfo();
      return this.stateBinding = { root: document, layerIndex: null, carNum: normalizeCarNum(info.carNum), getRecord: /* @__PURE__ */ __name(() => this.getStateRecord(), "getRecord"), activityType: "detail-state", selectors: {} };
    }
    async favoriteOne(event) {
      return detailStateController.requestToggle(this.getStateBinding(), "favorite", event);
    }
    async hasDownOne(event) {
      return detailStateController.requestToggle(this.getStateBinding(), "downloaded", event);
    }
    async hasWatchOne(event) {
      return detailStateController.requestToggle(this.getStateBinding(), "watched", event);
    }
    searchXunLeiSubtitle(e2) {
      let t2 = loading();
      gmHttp.get(`https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${e2}`).then(((t3) => {
        let n2 = t3.data;
        n2 && 0 !== n2.length ? layer.open({
          type: 1,
          title: "迅雷字幕",
          content: '\n                    <div class="jhs-layout-8ddc7c91"> \n                        <div id="xunlei-table-container" class="jhs-layout-583c2485"></div>\n                    </div>\n                ',
          scrollbar: false,
          area: utils.getResponsiveArea(["60%", "70%"]),
          anim: -1,
          success: /* @__PURE__ */ __name((t4, a2) => {
            new Tabulator("#xunlei-table-container", {
              layout: "fitColumns",
              placeholder: "暂无数据",
              virtualDom: true,
              data: n2,
              responsiveLayout: "collapse",
              responsiveLayoutCollapse: true,
              columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
              },
              columns: [{
                title: "文件名",
                field: "name",
                headerSort: false,
                responsive: 0
              }, {
                title: "类型",
                field: "ext",
                headerSort: false,
                responsive: 0
              }, {
                title: "操作",
                responsive: 0,
                headerSort: false,
                formatter: /* @__PURE__ */ __name((t5, n3, a3) => {
                  const i2 = t5.getData();
                  return a3((() => {
                    const n4 = t5.getElement().querySelector(".subtitle-preview-btn"), a4 = t5.getElement().querySelector(".subtitle-download-btn");
                    n4 && n4.addEventListener("click", (async (t6) => {
                      let n5 = i2.url, a5 = e2 + "." + i2.ext;
                      this.previewSubtitle(n5, a5);
                    })), a4 && a4.addEventListener("click", (async (t6) => {
                      let n5 = i2.url, a5 = e2 + "." + i2.ext, s2 = await gmHttp.get(n5);
                      utils.download(s2, a5);
                    }));
                  })), '\n                                        <button type="button" class="jhs-btn jhs-btn--secondary subtitle-preview-btn">预览</button>\n                                        <button type="button" class="jhs-btn jhs-btn--primary subtitle-download-btn">下载</button>\n                                    ';
                }, "formatter")
              }],
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
            }), utils.setupEscClose(a2);
          }, "success")
        }) : show.error("迅雷中找不到相关字幕!");
      })).catch(((e3) => {
        clog.error(e3), show.error(e3);
      })).finally((() => {
        t2.close();
      }));
    }
    async filterOne(e2, t2) {
      e2 && e2.preventDefault();
      return detailStateController.requestToggle(this.getStateBinding(), "blocked", e2);
    }
    hideVideoControls() {
      $(document).on("mouseenter", "#preview-video", (function() {
        $(this).prop("controls", true);
      }));
    }
    async previewSubtitle(e2, t2) {
      if (!e2) return void clog.error("未提供文件URL");
      const n2 = e2.split(".").pop().toLowerCase();
      if ("ass" === n2 || "srt" === n2) try {
        let a2 = await gmHttp.get(e2), i2 = "字幕预览";
        "ass" === n2 ? i2 = "ASS字幕预览 - " + t2 : "srt" === n2 && (i2 = "SRT字幕预览 - " + t2);
        const s2 = a2.split("\n");
        let o2 = "";
        const r2 = String(s2.length).length;
        s2.forEach(((e3, t3) => {
          const n3 = String(t3 + 1).padStart(r2, " ");
          o2 += `<span class="jhs-code-line-number">${n3}. </span>${e3}
`;
        }));
        const l2 = o2;
        layer.open({
          type: 1,
          title: i2,
          area: utils.getResponsiveArea(["80%", "80%"]),
          scrollbar: false,
          content: `<div class="jhs-code-viewer">${l2}</div>`,
          btn: ["下载", "关闭"],
          btn1: /* @__PURE__ */ __name(function(e3, n3, i3) {
            return utils.download(a2, t2), false;
          }, "btn1")
        });
      } catch (a2) {
        show.error(`预览失败: ${a2.message}`), clog.error("预览字幕文件出错:", a2);
      }
      else show.error("仅支持预览ASS和SRT字幕文件");
    }
  };
  __name(_DetailPageButtonPlugin, "DetailPageButtonPlugin");
  var DetailPageButtonPlugin = _DetailPageButtonPlugin;
  var _HistoryPlugin = class _HistoryPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "tableObj", null), i(this, "historyRoot", null);
    }
    getName() {
      return "HistoryPlugin";
    }
    async initCss() {
      return `
            <style>
                .jhs-history-layout { display:flex; flex-direction:column; height:100%; min-height:0; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
                #filterBox, #allSelectBox { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
                #table-container { flex:1; min-height:0; overflow-x:hidden; }
                .sub-btns { position:relative; display:inline-block; }
                .sub-btns-menu { position:absolute; top:calc(100% + var(--jhs-space-1)); right:0; z-index:var(--jhs-z-popover); display:none; min-width:156px; padding:var(--jhs-space-1); overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .sub-btns-menu.show { display:grid !important; gap:var(--jhs-space-1); }
                .sub-btns-menu .jhs-btn { width:100%; justify-content:flex-start; }
                .table-link-param { cursor:pointer; }
                .action-btns { display:flex; justify-content:center; gap:var(--jhs-space-2); }
                .jhs-history-edit-field { width:100%; padding:8px; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); }
                .jhs-history-edit-field[readonly] { background:var(--jhs-input-bg); }
                textarea.jhs-history-edit-field { min-height:60px; overflow-y:hidden; }
            </style>`;
    }
    handleResize() {
      $(".navbar-search").is(":hidden") ? ($(".historyBtnBox").show(), $(".miniHistoryBtnBox").hide()) : ($(".historyBtnBox").hide(), $(".miniHistoryBtnBox").show());
    }
    async handle() {
      r && ($(".navbar-end").prepend('<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <button type="button" id="historyBtn" class="jhs-btn navbar-link nav-btn jhs-nav-btn">鉴定记录</button>\n                </div>'), $(".navbar-search").css("margin-left", "0").before('\n                <div class="navbar-item miniHistoryBtnBox">\n                    <button type="button" id="miniHistoryBtn" class="jhs-btn navbar-link nav-btn jhs-nav-btn">鉴定记录</button>\n                </div>\n            '), this.handleResize(), $(window).resize((() => {
        this.handleResize();
      })), $("#historyBtn,#miniHistoryBtn").on("click", ((e2) => this.openHistory()))), l && await this.createBusButton();
    }
    async createBusButton() {
      const ready = await new Promise(((resolve) => {
        const startedAt = Date.now(), timer = setInterval((() => {
          if ($("#setting-btn").length && $("#top-right-box").length) return clearInterval(timer), resolve(true);
          Date.now() - startedAt >= 2500 && (clearInterval(timer), resolve(false));
        }), 25);
      }));
      if (!ready) return void clog.warn("鉴定记录入口未创建：JavBus 顶部工具区未就绪");
      $("#top-right-box").append('<button type="button" id="historyBtn" class="jhs-btn jhs-btn--secondary">鉴定记录</button>'), $("#historyBtn,#miniHistoryBtn").on("click", ((e2) => this.openHistory()));
    }
    openHistory() {
      let e2 = `
            <div class="jhs-layout-7cb3f981">
                 <div id="filterBox" class="jhs-layout-53809f1e">
                    <select id="dataType" class="jhs-select-source">
                        <option value="all" selected>所有</option>
                        <option value="filter">${u}</option>
                        <option value="favorite">${b}</option>
                        <option value="hasDown">${y}</option>
                        <option value="hasWatch">${k}</option>
                    </select>
                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" class="jhs-field">
                    <button type="button" id="clearSearchbtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>
                </div>
                <div id="allSelectBox" class="jhs-layout-66253c00">
                    <button type="button" class="jhs-btn jhs-btn--dark multiple-history-deleteBtn jhs-layout-7daea5fa"> <span>移除</span> </button>
                    <button type="button" class="jhs-btn jhs-btn--watch multiple-history-hasWatchBtn jhs-layout-2e003268">标记观看</button>
                    <button type="button" class="jhs-btn jhs-btn--down multiple-history-hasDownBtn jhs-layout-2e003268">标记下载</button>
                    <button type="button" class="jhs-btn jhs-btn--fav multiple-history-favoriteBtn jhs-layout-2e003268">标记收藏</button>
                    <button type="button" class="jhs-btn jhs-btn--filter multiple-history-filterBtn jhs-layout-2e003268">标记屏蔽</button>
                </div>
                <div id="table-container" class="jhs-layout-81eaab28"></div>
            </div>
        `;
      e2 = e2.replace('<div id="filterBox"', '<div id="historyViewTabs" class="jhs-segmented" role="tablist"><button type="button" class="jhs-btn jhs-segmented__item active" data-history-view="state">作品状态</button><button type="button" class="jhs-btn jhs-segmented__item" data-history-view="activity">操作记录</button><button type="button" class="jhs-btn jhs-segmented__item" data-history-view="offline">离线任务</button></div><div id="filterBox"');
      layer.open({
        type: 1,
        title: "鉴定记录",
        content: e2,
        scrollbar: false,
        shadeClose: true,
        area: utils.getDialogArea("xl"),
        anim: -1,
        success: /* @__PURE__ */ __name(async (e3) => {
          const root = $(e3);
          this.historyRoot = root, JhsSelect.enhance(root);
          await this.loadTableData(), root.on("click.jhsHistory", "#clearSearchbtn", (async (e4) => {
            root.find("#searchCarNum").val(""), JhsSelect.setValue(root.find("#dataType"), "all"), await this.reloadTable(), root.find("#allSelectBox").hide();
          })).on("focusout keydown", "#searchCarNum", (async (e4) => {
            if ("focusout" === e4.type || "Enter" === e4.key) {
              if ("Enter" === e4.key && e4.preventDefault(), "keydown" === e4.type && "Enter" !== e4.key) return;
              await this.reloadTable();
            }
          })).on("click", ".table-link-param", (async (e4) => {
            let t2 = $(e4.currentTarget);
            root.find("#searchCarNum").val(t2.text()), await this.reloadTable();
          })).on("change", "#dataType", (async () => {
            await this.reloadTable();
          })).on("click", "[data-history-view]", (async (event) => {
            const view = $(event.currentTarget).data("history-view");
            root.find("[data-history-view]").removeClass("active"), $(event.currentTarget).addClass("active"), await this.showHistoryView(view);
          })).on("click", ".jhs-undo-activity", (async (event) => {
            const result = await stateService.undoTransaction($(event.currentTarget).data("transaction"));
            show.info(`撤销完成：${result.reverted.length} 项成功，${result.conflicts.length} 项冲突`), await this.renderActivityHistory();
          })).on("click", ".jhs-copy-offline", (async (event) => {
            await utils.copyToClipboard("离线资源", $(event.currentTarget).data("resource"));
          })).on("click", ".jhs-retry-offline", (async (event) => {
            const id = $(event.currentTarget).data("id"), item = (await stateService.getOfflineHistory()).find(((entry) => entry.id === id));
            item && await this.getBean("UnifiedOfflinePlugin").submitResource(event, item.resource, $(event.currentTarget), { carNum: item.carNum }, item.id, { forceAvailabilityRefresh: true, preferredProviderId: item.providerId }), await this.renderOfflineHistory();
          })).on("click", ".jhs-open-offline", (async (event) => {
            const id = $(event.currentTarget).data("id"), item = (await stateService.getOfflineHistory()).find(((entry) => entry.id === id)), provider = this.getBean("UnifiedOfflinePlugin").registry.providers.get(item?.providerId), url = provider?.openUrl?.();
            url && window.open(url, "_blank", "noopener,noreferrer");
          })).on("click", ".jhs-delete-offline", (async (event) => {
            await stateService.removeOfflineHistory($(event.currentTarget).data("id")), await this.renderOfflineHistory();
          })), this.bindHistoryActions(root);
        }, "success"),
        end: /* @__PURE__ */ __name(() => {
          this.historyRoot?.off(".jhsHistory"), this.historyRoot = null, this.tableObj && (this.tableObj.destroy(), this.tableObj = null);
        }, "end")
      });
    }
    async showHistoryView(view) {
      const stateView = "state" === view;
      this.historyRoot?.find("#filterBox,#allSelectBox").toggle(stateView), this.tableObj?.destroy(), this.tableObj = null;
      return stateView ? this.loadTableData() : "activity" === view ? this.renderActivityHistory() : this.renderOfflineHistory();
    }
    async renderActivityHistory() {
      const log = await stateService.getActivityLog(), host = this.historyRoot.find("#table-container").empty();
      if (!log.entries.length) return void host.html('<div class="jhs-state jhs-state--empty">暂无操作记录</div>');
      log.entries.slice().reverse().forEach(((entry) => {
        const reverted = entry.changes.filter(((change) => "reverted" === change.undoState)).length, conflicts = entry.changes.filter(((change) => "conflict" === change.undoState)).length;
        host.append($('<article class="jhs-card"></article>').append($("<strong></strong>").text(`${entry.type} · ${entry.changes.length} 项`), $("<p></p>").text(`${new Date(entry.createdAt).toLocaleString()} · 已撤销 ${reverted} · 冲突 ${conflicts}`), $("<p></p>").text(entry.changes.map(((change) => change.carNum)).join("、")), $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-undo-activity">撤销可恢复项</button>').attr("data-transaction", entry.id).prop("disabled", "committed" !== entry.commitState || reverted === entry.changes.length)));
      }));
    }
    async renderOfflineHistory() {
      const history = await stateService.getOfflineHistory(), host = this.historyRoot.find("#table-container").empty();
      if (!history.length) return void host.html('<div class="jhs-state jhs-state--empty">暂无离线任务</div>');
      history.slice().reverse().forEach(((item) => {
        const actions = $('<div class="jhs-toolbar"></div>').append($('<button type="button" class="jhs-btn jhs-copy-offline">复制资源</button>').attr("data-resource", item.resource), $('<button type="button" class="jhs-btn jhs-retry-offline">重试</button>').attr("data-id", item.id), $('<button type="button" class="jhs-btn jhs-open-offline">打开服务</button>').attr("data-id", item.id), $('<button type="button" class="jhs-btn jhs-btn--danger jhs-delete-offline">移除记录</button>').attr("data-id", item.id));
        host.append($('<article class="jhs-card"></article>').append($("<strong></strong>").text(`${item.providerName || item.providerId} · ${item.status}`), $("<p></p>").text(`${item.carNum || "未关联番号"} · ${new Date(item.createdAt).toLocaleString()}${item.retryOf ? ` · 重试自 ${item.retryOf}` : ""}`), $("<p></p>").text(item.errorMessage || item.resource), actions));
      }));
    }
    async reloadTable() {
      this.tableObj.deselectRow(), this.tableObj.setPage(1);
    }
    bindHistoryActions(root) {
      root.on("click.jhsHistory", (function(e2) {
        if (e2.target.closest(".sub-btns-toggle")) {
          const button = e2.target.closest(".sub-btns-toggle"), t2 = button.closest(".sub-btns").querySelector(".sub-btns-menu");
          root.find(".sub-btns-menu.show").each(((index, e3) => {
            e3 !== t2 && (e3.classList.remove("show"), e3.previousElementSibling?.setAttribute("aria-expanded", "false"));
          })), t2.classList.toggle("show"), button.setAttribute("aria-expanded", String(t2.classList.contains("show")));
        } else root.find(".sub-btns-menu.show").each(((index, e3) => {
          e3.classList.remove("show"), e3.previousElementSibling?.setAttribute("aria-expanded", "false");
        }));
      })), root.on("keydown.jhsHistory", ".sub-btns", ((e2) => {
        const menu = $(e2.currentTarget).find(".sub-btns-menu"), items = menu.find('[role="menuitem"]'), current = items.index(document.activeElement);
        if ("Escape" === e2.key) return e2.preventDefault(), menu.removeClass("show"), $(e2.currentTarget).find(".sub-btns-toggle").attr("aria-expanded", "false").trigger("focus");
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e2.key) || !menu.hasClass("show")) return;
        e2.preventDefault();
        const next = "Home" === e2.key ? 0 : "End" === e2.key ? items.length - 1 : "ArrowDown" === e2.key ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      })), root.on("click.jhsHistory", ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasDownBtn, .history-hasWatchBtn, .history-detailBtn", ((e2) => {
        e2.preventDefault(), e2.stopPropagation();
        const t2 = $(e2.currentTarget), n2 = t2.closest(".action-btns"), a2 = n2.attr("data-car-num"), i2 = n2.attr("data-href"), s2 = /* @__PURE__ */ __name(async (actionType) => {
          try {
            const flag = legacyActionToFlag(actionType);
            await stateService.toggle(a2, flag, { type: "history-state", record: { carNum: a2, url: i2 } }), await this.reloadTable();
          } catch (s3) {
            clog.error("历史记录操作失败:", s3), show.error("操作失败");
          }
        }, "s");
        if (t2.hasClass("history-filterBtn")) {
          const record = this.tableObj?.getRow(a2)?.getData(), isBlocked = normalizeStateFlags(record?.stateFlags).blocked;
          isBlocked ? void s2(d) : utils.q(e2, `是否屏蔽${a2}?`, (() => s2(d)));
        } else t2.hasClass("history-favoriteBtn") ? void s2(h) : t2.hasClass("history-hasDownBtn") ? void s2(g) : t2.hasClass("history-hasWatchBtn") ? void s2(p) : t2.hasClass("history-deleteBtn") ? this.handleDelete(e2, a2) : t2.hasClass("history-detailBtn") && void this.handleClickDetail(e2, {
          carNum: a2,
          url: i2
        }).catch(((error) => clog.error("历史详情打开失败", error)));
      })), root.on("click.jhsHistory", ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasDownBtn, .multiple-history-hasWatchBtn", ((e2) => {
        e2.preventDefault(), e2.stopPropagation();
        const t2 = $(e2.currentTarget);
        let n2 = this.tableObj.getSelectedData(), a2 = "", i2 = "";
        t2.hasClass("multiple-history-filterBtn") ? (a2 = "屏蔽", i2 = d) : t2.hasClass("multiple-history-favoriteBtn") ? (a2 = "收藏", i2 = h) : t2.hasClass("multiple-history-hasDownBtn") ? (a2 = "已下载", i2 = g) : t2.hasClass("multiple-history-hasWatchBtn") ? (a2 = "已观看", i2 = p) : t2.hasClass("multiple-history-deleteBtn") && (a2 = "移除", i2 = "delete"), utils.q(e2, `当前已勾选${n2.length}条数据, 是否全标记为 ${a2}?`, (async () => {
          let e3 = loading();
          try {
            if ("delete" === i2) {
              const e4 = n2.map(((e5) => e5.carNum)), t3 = await stateService.remove(e4);
              t3.changed.length > 0 ? show.ok(`已成功删除 ${t3.changed.length} 个番号`) : show.error("提供的番号中没有一个存在于列表中。");
            } else {
              const flag = legacyActionToFlag(i2);
              await stateService.patch(n2.map(((item) => item.carNum)), { [flag]: true }, { type: "history-batch-state", records: n2 }), show.ok("操作成功");
            }
            this.tableObj.deselectRow(), await this.reloadTable();
          } catch (t3) {
            clog.error(t3);
          } finally {
            e3.close();
          }
        }));
      }));
    }
    async getDataList(e2, t2, n2) {
      let a2 = await storageManager.getCarList();
      this.allCount = a2.length, this.filterCount = 0, this.favoriteCount = 0, this.hasDownCount = 0, this.hasWatchCount = 0, this.waitCheckCount = 0, a2.forEach(((e3) => {
        const flags = normalizeStateFlags(e3.stateFlags);
        flags.blocked && this.filterCount++, flags.favorite && this.favoriteCount++, flags.downloaded && this.hasDownCount++, flags.watched && this.hasWatchCount++, hasAnyState(flags) || this.waitCheckCount++;
      })), this.historyRoot.find('#dataType option[value="all"]').text(`所有 (${this.allCount})`), this.historyRoot.find('#dataType option[value="waitCheck"]').text(`待鉴定 (${this.waitCheckCount})`), this.historyRoot.find('#dataType option[value="filter"]').text(`${u} (${this.filterCount})`), this.historyRoot.find('#dataType option[value="favorite"]').text(`${b} (${this.favoriteCount})`), this.historyRoot.find('#dataType option[value="hasDown"]').text(`${y} (${this.hasDownCount})`), this.historyRoot.find('#dataType option[value="hasWatch"]').text(`${k} (${this.hasWatchCount})`);
      const i2 = this.historyRoot.find("#dataType").val();
      const flagByFilter = { filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" };
      let s2 = "all" === i2 ? a2 : "waitCheck" === i2 ? a2.filter(((e3) => !hasAnyState(e3.stateFlags))) : a2.filter(((e3) => normalizeStateFlags(e3.stateFlags)[flagByFilter[i2]]));
      const o2 = this.historyRoot.find("#searchCarNum").val().trim();
      if (o2) {
        let e3 = o2.toLowerCase().replace("-c", "").replace("-uc", "").replace("-4k", "");
        s2 = s2.filter(((t3) => {
          const n3 = t3.carNum.toLowerCase().includes(e3);
          const a3 = (t3.names ? t3.names : "").toLowerCase().includes(e3);
          return n3 || a3;
        }));
      }
      if (n2 && n2.length > 0) {
        const e3 = n2[0], t3 = e3.field, a3 = e3.dir;
        s2.sort(((e4, n3) => {
          const i3 = e4[t3], s3 = n3[t3], o3 = null == i3 || "" === i3, r3 = null == s3 || "" === s3;
          return o3 && !r3 ? 1 : !o3 && r3 ? -1 : o3 && r3 ? 0 : i3 < s3 ? "asc" === a3 ? -1 : 1 : i3 > s3 ? "asc" === a3 ? 1 : -1 : 0;
        }));
      }
      const r2 = s2.length, l2 = Math.ceil(r2 / t2), c2 = (e2 - 1) * t2, m2 = c2 + t2;
      return s2 = s2.slice(c2, m2), {
        maxPage: l2,
        dataList: s2,
        totalCount: r2
      };
    }
    async loadTableData() {
      this.tableObj = new Tabulator(this.historyRoot.find("#table-container").get(0), {
        layout: "fitColumns",
        placeholder: "暂无数据",
        virtualDom: true,
        pagination: true,
        paginationMode: "remote",
        sortMode: "remote",
        ajaxURL: "queryRealm",
        dataLoader: false,
        ajaxRequestFunc: /* @__PURE__ */ __name(async (e2, t2, n2) => {
          const a2 = n2.page, i2 = n2.size, s2 = n2.sort;
          return await this.getDataList(a2, i2, s2);
        }, "ajaxRequestFunc"),
        dataReceiveParams: {
          last_page: "maxPage",
          last_row: "totalCount",
          data: "dataList"
        },
        paginationSize: 50,
        paginationSizeSelector: [50, 100, 1e3, 99999],
        paginationCounter: /* @__PURE__ */ __name((e2, t2, n2, a2, i2) => `共 ${a2} 条记录`, "paginationCounter"),
        responsiveLayout: "collapse",
        responsiveLayoutCollapse: true,
        columnDefaults: {
          headerHozAlign: "center",
          hozAlign: "center"
        },
        selectableRowsPersistence: false,
        index: "carNum",
        columns: [{
          formatter: "rowSelection",
          titleFormatter: "rowSelection",
          hozAlign: "center",
          headerSort: false,
          responsive: 0,
          width: 40,
          titleFormatterParams: {
            rowRange: "active"
          },
          cellClick: /* @__PURE__ */ __name((e2, t2) => {
            t2.getRow().toggleSelect();
          }, "cellClick")
        }, {
          title: "番号",
          field: "carNum",
          width: 120,
          sorter: "string",
          responsive: 0,
          formatter: /* @__PURE__ */ __name((e2, t2, n2) => {
            const a2 = e2.getData().carNum, i2 = a2.indexOf("-");
            if (-1 === i2) return a2;
            return `<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param">${a2.substring(0, i2 + 1)}</button>${a2.substring(i2 + 1)}`;
          }, "formatter")
        }, {
          title: "演员",
          field: "names",
          minWidth: 200,
          sorter: "string",
          responsive: 5,
          headerSort: true,
          formatter: /* @__PURE__ */ __name((e2, t2, n2) => (e2.getData().names || "").split(" ").filter(((e3) => "" !== e3.trim())).map(((e3) => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param">${e3}</button>`)).join(" "), "formatter")
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
          formatter: /* @__PURE__ */ __name((e2, t2, n2) => {
            let a2 = e2.getData().url;
            return a2 ? `<span class="jhs-badge jhs-badge--neutral">${a2.includes("javdb") ? "JavDB" : a2.includes("javbus") ? "JavBus" : a2.includes("123av") ? "123AV" : "其他"}</span>` : "";
          }, "formatter")
        }, {
          title: "状态",
          field: "stateFlags",
          width: 220,
          sorter: false,
          responsive: 1,
          headerSort: false,
          formatter: /* @__PURE__ */ __name((e2, t2, n2) => {
            const flags = normalizeStateFlags(e2.getData().stateFlags), badges = [[flags.blocked, "filter", u], [flags.favorite, "fav", b], [flags.downloaded, "down", y], [flags.watched, "watch", k]].filter(((item) => item[0])).map(((item) => `<span class="jhs-badge jhs-badge--soft jhs-badge--${item[1]}">${item[2]}</span>`));
            return badges.join(" ") || '<span class="jhs-badge jhs-badge--neutral">待鉴定</span>';
          }, "formatter")
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
          headerSort: false,
          formatter: /* @__PURE__ */ __name((e2, t2, n2) => {
            const a2 = e2.getData();
            return n2((() => {
              var t3;
              null == (t3 = e2.getElement().querySelector(".history-editBtn")) || t3.addEventListener("click", ((e3) => {
                this.editRecord(a2);
              }));
            })), `
                        <div class="action-btns" data-car-num="${a2.carNum}" data-href="${a2.url ? a2.url : ""}">
                            <button type="button" class="jhs-btn jhs-btn--secondary history-detailBtn"><span>查看</span></button>
                            <div class="sub-btns">
                                <button type="button" class="jhs-btn jhs-btn--ghost sub-btns-toggle" aria-haspopup="menu" aria-expanded="false"><span>更多操作</span></button>
                                <div class="sub-btns-menu" role="menu">
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-editBtn" role="menuitem"><span>编辑</span></button>
                                    <button type="button" class="jhs-btn jhs-btn--danger history-deleteBtn" role="menuitem"><span>移除</span></button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-hasWatchBtn" role="menuitem">${k}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-hasDownBtn" role="menuitem">${y}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-favoriteBtn" role="menuitem">${v}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-filterBtn" role="menuitem">${m}</button>
                                </div>
                            </div>
                        </div>`;
          }, "formatter")
        }],
        initialSort: [{
          column: "updateDate",
          dir: "desc"
        }],
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
      }), this.tableObj.on("rowSelectionChanged", ((e2, t2, n2, a2) => {
        const i2 = this.historyRoot.find("#allSelectBox"), s2 = this.historyRoot.find("#filterBox");
        e2 && e2.length > 0 ? (s2.hide(), i2.show()) : (s2.show(), i2.hide());
      })), this.tableObj.on("rowDblClick", (function(e2, t2) {
        t2.toggleSelect();
      }));
    }
    handleDelete(e2, t2) {
      utils.q(e2, `是否移除${t2}?`, (async () => {
        await stateService.remove(t2), this.getBean("ListPagePlugin").showCarNumBox(t2), await this.reloadTable(null);
      }));
    }
    async handleClickDetail(e2, t2) {
      if (r) if (t2.carNum.includes("FC2-")) {
        const e3 = this.parseMovieId(t2.url);
        this.getBean("Fc2Plugin").openFc2Dialog(e3, t2.carNum, t2.url);
      } else {
        if (!t2.url) return void window.open("/search?q=" + t2.carNum, "_blank");
        utils.openPage(t2.url, t2.carNum, false, e2);
      }
      if (l) {
        let n2 = t2.url;
        if (n2.includes("javdb")) if (t2.carNum.includes("FC2-")) {
          const e3 = this.parseMovieId(n2);
          await this.getBean("Fc2Plugin").openFc2Page(e3, t2.carNum, n2);
        } else window.open(n2, "_blank");
        else utils.openPage(t2.url, t2.carNum, false, e2);
      }
    }
    async editRecord(e2) {
      const t2 = e2.carNum, n2 = e2.names || "", a2 = e2.url || "", flags = normalizeStateFlags(e2.stateFlags), s2 = e2.remark || "";
      let editRoot = $();
      const c2 = `
            <div class="jhs-layout-8cddc29a">
                <div class="jhs-layout-da303dcf">
                    <label class="jhs-layout-27f87d75">番号:</label>
                    <input type="text" id="edit-carNum" value="${t2}" class="jhs-field jhs-history-edit-field" readonly>
                </div>
                <div class="jhs-layout-da303dcf">
                    <label class="jhs-layout-27f87d75">演员 (用空格隔开):</label>
                    <textarea id="edit-names" class="jhs-textarea jhs-history-edit-field">${n2}</textarea>
                </div>
                <fieldset class="jhs-layout-da303dcf"><legend class="jhs-layout-27f87d75">状态:</legend>
                    <label class="jhs-option-row">收藏 <input type="checkbox" id="edit-favorite" class="mini-switch" ${flags.favorite ? "checked" : ""}></label>
                    <label class="jhs-option-row">已下载 <input type="checkbox" id="edit-downloaded" class="mini-switch" ${flags.downloaded ? "checked" : ""}></label>
                    <label class="jhs-option-row">已观看 <input type="checkbox" id="edit-watched" class="mini-switch" ${flags.watched ? "checked" : ""}></label>
                    <label class="jhs-option-row">屏蔽 <input type="checkbox" id="edit-blocked" class="mini-switch" ${flags.blocked ? "checked" : ""}></label>
                </fieldset>
                <div class="jhs-layout-da303dcf">
                    <label class="jhs-layout-27f87d75">链接:</label>
                    <input type="text" id="edit-url" value="${a2}" class="jhs-field jhs-history-edit-field">
                </div>
                <div class="jhs-layout-da303dcf">
                    <label class="jhs-layout-27f87d75">备注:</label>
                    <textarea id="edit-remark" class="jhs-textarea jhs-history-edit-field">${s2}</textarea>
                </div>
            </div>
        `;
      layer.open({
        type: 1,
        title: `编辑记录: ${t2}`,
        area: utils.getDialogArea("sm"),
        content: c2,
        btn: ["保存", "取消"],
        success: /* @__PURE__ */ __name((e3, t3) => {
          editRoot = $(e3);
          const n3 = /* @__PURE__ */ __name((e4) => {
            e4.css("height", "auto"), e4.css("height", e4[0].scrollHeight + 15 + "px");
          }, "n"), a3 = editRoot.find("#edit-names");
          a3.on("input", (function() {
            n3($(this));
          })), n3(a3);
          const i2 = editRoot.find("#edit-remark");
          i2.on("input", (function() {
            n3($(this));
          })), n3(i2);
        }, "success"),
        yes: /* @__PURE__ */ __name(async (t3) => {
          const n3 = editRoot.find("#edit-names").val().trim(), i2 = editRoot.find("#edit-url").val().trim(), s3 = editRoot.find("#edit-remark").val().trim(), nextFlags = {
            favorite: editRoot.find("#edit-favorite").prop("checked"),
            downloaded: editRoot.find("#edit-downloaded").prop("checked"),
            watched: editRoot.find("#edit-watched").prop("checked"),
            blocked: editRoot.find("#edit-blocked").prop("checked")
          };
          const save = /* @__PURE__ */ __name(async () => {
            await stateService.patch(e2.carNum, nextFlags, { type: "history-edit", replaceMetadata: true, record: { ...e2, names: n3, url: i2, remark: s3 } }), this.tableObj.setData(), layer.close(t3);
          }, "save");
          if (!flags.blocked && nextFlags.blocked) return utils.q(null, `是否屏蔽${e2.carNum}?`, (() => void save())), false;
          await save();
        }, "yes")
      });
    }
  };
  __name(_HistoryPlugin, "HistoryPlugin");
  var HistoryPlugin = _HistoryPlugin;
  var _ReviewPlugin = class _ReviewPlugin extends BasePlugin {
    getName() {
      return "ReviewPlugin";
    }
    async initCss() {
      return `
            <style>
                .jhs-review-panel { min-width:0; }
                .jhs-panel-header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-panel-header h3 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-xl); }
                .jhs-panel-toggle { flex:none; }
                .jhs-review-list { display:grid; }
                .jhs-review-item { min-width:0; padding:var(--jhs-space-4) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
                .jhs-review-item:last-child { border-bottom:0; }
                .jhs-review-meta { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-1) var(--jhs-space-3); color:var(--jhs-text-muted); font-size:14px; }
                .jhs-review-author { color:var(--jhs-text); font-size:15px; font-weight:600; }
                .jhs-review-floor { margin-left:auto; color:var(--jhs-text-faint); }
                .jhs-review-content { margin:var(--jhs-space-3) 0 0; color:var(--jhs-text); font-size:16px; line-height:1.7; overflow-wrap:anywhere; white-space:pre-wrap; }
                .jhs-review-link { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); padding:2px var(--jhs-space-2); border:0; border-radius:var(--jhs-radius-pill); background:var(--jhs-accent-tint); color:var(--jhs-accent); font:inherit; font-size:var(--jhs-font-size-sm); line-height:1.5; text-decoration:none; vertical-align:baseline; cursor:pointer; }
                .jhs-review-link-copy { color:var(--jhs-text-muted); }
                .jhs-review-link-wrap { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-2); width:100%; margin:var(--jhs-space-1) 0; }
                .jhs-review-inline-controls { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); }
                .jhs-review-link-main { display:inline-flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
                .jhs-review-link-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin-left:auto; flex-shrink:0; }
                .jhs-review-offline-btn { background:var(--jhs-accent) !important; color:var(--jhs-accent-text-on) !important; }
                .jhs-panel-state { padding:var(--jhs-space-4) 0; color:var(--jhs-text-muted); text-align:center; }
                .jhs-panel-footer { display:flex; justify-content:center; padding-top:var(--jhs-space-3); }
                .jhs-panel-end { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); }
                @media (max-width:767px) { .jhs-review-floor { width:100%; margin-left:0; } }
            </style>`;
    }
    async handle() {
      if (!window.isDetailPage) return;
      if (r) {
        const movieId = this.parseMovieId(window.location.href);
        const workspace = this.getBean("DetailWorkspacePlugin");
        await Promise.all([this.showReview(movieId, workspace?.getSlot("reviews")), this.getBean("RelatedPlugin").showRelated(workspace?.getSlot("related"), movieId)]);
      }
      if (l) {
        const carNumber = this.getPageInfo().carNum;
        if (!carNumber) return void clog.warn("跳过 JavBus 评论解析：番号不可用");
        const movies = await (async (value) => {
          const url = `${U}/v2/search`, headers = {
            "user-agent": "Dart/3.5 (dart:io)",
            "accept-language": "zh-TW",
            host: "jdforrepam.com",
            jdsignature: await O()
          }, params = {
            q: value,
            page: 1,
            type: "movie",
            limit: 1,
            movie_type: "all",
            from_recent: "false",
            movie_filter_by: "all",
            movie_sort_by: "relevance"
          };
          return (await gmHttp.get(url, params, headers)).data.movies;
        })(carNumber);
        const match = movies.find(((movie) => movie.number.toLowerCase() === carNumber.toLowerCase()));
        match && await this.showReview(match.id, this.getBean("DetailWorkspacePlugin")?.getSlot("reviews"));
      }
    }
    async showReview(movieId, target) {
      const enabled = await storageManager.getSetting("enableLoadReview", _), host = target?.length ? target : this.getBean("DetailWorkspacePlugin")?.getSlot("reviews") || $("#magnets-content");
      const existing = host.children('[data-jhs-panel="reviews"]').filter(((_2, element) => $(element).attr("data-jhs-movie-id") === String(movieId))).first();
      if (existing.length) return existing;
      const panel = $('<section class="jhs-review-panel" data-jhs-panel="reviews"></section>').attr("data-jhs-movie-id", String(movieId));
      const header = $('<header class="jhs-panel-header"><h3>评论</h3></header>');
      const toggle = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-review-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
      const state = { movieId, panel, floorIndex: 1, loaded: false, loading: false, page: 1 };
      header.append(toggle), panel.append(header, '<div class="jhs-review-list jhs-review-container"></div>', '<div class="jhs-panel-footer jhs-review-footer"></div>'), host.append(panel), this.bindRightClickFilter();
      this.updateToggle(toggle, enabled === _);
      toggle.on("click", ((event) => {
        event.preventDefault(), event.stopPropagation();
        const expanded = "展开" === toggle.find(".toggle-text").text();
        this.updateToggle(toggle, expanded), panel.find(".jhs-review-container, .jhs-review-footer").toggle(expanded), expanded && !state.loaded && !state.loading && void this.fetchAndDisplayReviews(state), storageManager.saveSettingItem("enableLoadReview", expanded ? _ : C);
      }));
      enabled === _ ? await this.fetchAndDisplayReviews(state) : panel.find(".jhs-review-container, .jhs-review-footer").hide();
      return panel;
    }
    updateToggle(toggle, expanded) {
      toggle.attr("aria-expanded", String(expanded)), toggle.find(".toggle-text").text(expanded ? "折叠" : "展开"), toggle.find(".toggle-icon").text(expanded ? "▲" : "▼");
    }
    async fetchAndDisplayReviews(state) {
      if (state.loading) return;
      state.loading = true;
      const { movieId, panel } = state, container = panel.find(".jhs-review-container"), footer = panel.find(".jhs-review-footer");
      container.empty().append($('<div class="jhs-panel-state"></div>').text("获取评论中...")), footer.empty();
      const pageSize = await storageManager.getSetting("reviewCount", 20);
      let reviews;
      try {
        reviews = await R(movieId, 1, pageSize);
      } catch (error) {
        error.toString().includes("簽名已過期") && show.error("生成签名失败, 请检查系统时间及时区是否正确!"), clog.error("获取评论失败:", error), clog.error("获取评论失败:", error);
        state.loading = false;
        return void this.renderRetry(container, "获取评论失败", (() => this.fetchAndDisplayReviews(state)));
      }
      state.loading = false, state.loaded = true;
      container.empty();
      if (!reviews.length) return void container.append($('<div class="jhs-panel-state"></div>').text("无评论"));
      const keywords = await storageManager.getReviewFilterKeywordList();
      await this.displayReviews(state, reviews, container, keywords), reviews.length === pageSize && R(movieId, 2, pageSize).catch((() => {
      }));
      reviews.length === pageSize ? this.bindLoadMore(state, pageSize, keywords, container, footer) : footer.append($('<div class="jhs-panel-end"></div>').text("已加载全部评论"));
    }
    renderRetry(container, message, retry) {
      container.empty();
      const state = $('<div class="jhs-panel-state"></div>').append(document.createTextNode(`${message} `));
      const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry);
      state.append(button), container.append(state);
    }
    bindLoadMore(state, pageSize, keywords, container, footer) {
      const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-review-load-more">加载更多评论</button>'), end = $('<div class="jhs-panel-end jhs-review-end">已加载全部评论</div>').hide();
      footer.empty().append(button, end);
      button.on("click", (async () => {
        button.text("加载中...").prop("disabled", true), state.page++;
        try {
          const reviews = await R(state.movieId, state.page, pageSize);
          await this.displayReviews(state, reviews, container, keywords), reviews.length < pageSize ? (button.remove(), end.show()) : button.text("加载更多评论").prop("disabled", false);
        } catch (error) {
          clog.error("加载更多评论失败:", error), button.text("加载失败，请重试").prop("disabled", false);
        }
      }));
    }
    async displayReviews(state, reviews, container, keywords) {
      if (!reviews.length) return;
      const filter = keywords.length > 0 ? new RegExp(keywords.map(((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("|")) : null;
      for (const review of reviews) {
        const content = String(review.content || "");
        if (filter?.test(content)) continue;
        const item = $('<article class="jhs-review-item"></article>'), meta = $('<div class="jhs-review-meta"></div>'), body = $('<div class="review-content jhs-review-content"></div>');
        meta.append($("<span></span>").addClass("jhs-review-author").text(review.username || "匿名用户"));
        const stars = $('<span class="score-stars" aria-label="评分"></span>'), score = Math.max(0, Math.min(5, Number(review.score) || 0));
        for (let index = 0; index < score; index++) stars.append('<i class="icon-star"></i>');
        meta.append(
          stars,
          $("<time></time>").text(utils.formatDate(review.created_at)),
          $("<span></span>").text(`点赞：${Number(review.likes_count) || 0}`),
          $("<span></span>").addClass("jhs-review-floor").text(`#${state.floorIndex++}楼`)
        );
        await this.appendReviewContent(body, content), item.append(meta, body), container.append(item);
      }
    }
    appendReviewContent(container, content) {
      const linkPattern = /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+/g;
      let cursor = 0, match;
      while (match = linkPattern.exec(content)) {
        match.index > cursor && container.append(document.createTextNode(content.slice(cursor, match.index)));
        this.appendLinkControls(container, match[0]), cursor = match.index + match[0].length;
      }
      cursor < content.length && container.append(document.createTextNode(content.slice(cursor)));
    }
    appendLinkControls(container, value) {
      const isEd2k = value.startsWith("ed2k://"), isMagnet = value.startsWith("magnet:"), label = isEd2k ? "ED2K 链接" : isMagnet ? "Magnet 链接" : "打开链接";
      const isResource = isMagnet || isEd2k, wrapper = $(isResource ? '<span class="jhs-review-link-wrap"></span>' : '<span class="jhs-review-inline-controls"></span>');
      const main = $('<span class="jhs-review-link-main"></span>');
      const open = isEd2k ? $('<button type="button" class="jhs-btn jhs-review-link"></button>').text(label).on("click", (() => utils.copyToClipboard(label, value))) : $("<a></a>").addClass("jhs-review-link").attr({
        href: value,
        target: "_blank",
        rel: "noopener noreferrer"
      }).text(label);
      const copy = $('<button type="button" class="jhs-btn jhs-review-link jhs-review-link-copy">复制</button>').on("click", (() => utils.copyToClipboard(label, value)));
      main.append(open, copy), wrapper.append(main);
      if (isResource) {
        const actions = $('<span class="jhs-review-link-actions"></span>');
        actions.append(`<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn jhs-offline-btn" data-resource="${escapeHtml(value)}">离线</button>`);
        wrapper.append(actions);
      }
      container.append(wrapper);
    }
    bindRightClickFilter() {
      $(document).off("contextmenu.jhsReviewFilter", ".review-content").on("contextmenu.jhsReviewFilter", ".review-content", (async (event) => {
        if (await storageManager.getSetting("enableTitleSelectFilter", _) !== _) return;
        const text = window.getSelection().toString();
        text && (event.preventDefault(), await utils.q(event, `是否将 '${text}' 加入评论区关键词?`, (async () => {
          await storageManager.saveReviewFilterKeyword(text), show.ok("操作成功, 刷新页面后生效");
        })));
      }));
    }
  };
  __name(_ReviewPlugin, "ReviewPlugin");
  var ReviewPlugin = _ReviewPlugin;
  var _FilterTitleKeywordPlugin = class _FilterTitleKeywordPlugin extends BasePlugin {
    getName() {
      return "FilterTitleKeywordPlugin";
    }
    async handle() {
      if (!isDetailPage && !isFc2Page) return;
      if (await storageManager.getSetting("enableTitleSelectFilter", _) !== _) return;
      let e2;
      r ? e2 = ".title strong, .current-title" : l && (e2 = "h3"), utils.rightClick(document.body, e2, ((e3) => {
        const t2 = window.getSelection().toString();
        if (t2) {
          e3.preventDefault();
          let n2 = {
            clientX: e3.clientX,
            clientY: e3.clientY + 80
          };
          utils.q(n2, `是否屏蔽标题关键词 ${t2}?`, (async () => {
            await storageManager.saveTitleFilterKeyword(t2), await jhsEventBus.emit("filter-rules-changed", { scope: "title-keyword" }), utils.closePage();
          }));
        }
      }));
    }
  };
  __name(_FilterTitleKeywordPlugin, "FilterTitleKeywordPlugin");
  var FilterTitleKeywordPlugin = _FilterTitleKeywordPlugin;
  var _BlacklistPlugin = class _BlacklistPlugin extends BasePlugin {
    getName() {
      return "BlacklistPlugin";
    }
    async initCss() {
      return `<style>
            .jhs-blacklist-layout { display:flex; flex-direction:column; height:100%; min-height:0; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
            .jhs-blacklist-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
            .jhs-blacklist-toolbar__group { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
            .jhs-blacklist-layout #table-container { flex:1; min-height:0; }
            .jhs-table-counter-note { margin-left:var(--jhs-space-2); }
        </style>`;
    }
    async addBlacklist(e2) {
      let t2 = {
        clientX: e2.clientX,
        clientY: e2.clientY + 80
      };
      const n2 = $("#addBlacklistBtn span").text().includes("已加入");
      let a2, i2;
      if (o.includes("/tags")) {
        const e3 = new URL(o);
        e3.searchParams.delete("page");
        const t3 = $("#jhs-check-tag").text().trim();
        a2 = {
          starId: "no-" + t3,
          name: "虚拟演员-" + t3,
          allName: ["虚拟演员"],
          role: "虚拟演员",
          movieType: t3,
          blacklistUrl: e3.toString()
        }, i2 = `是否将分类 <span class="jhs-task-emphasis">${t3}</span> 加入到黑名单中?`, n2 && (i2 = `分类 <span class="jhs-task-emphasis">${t3}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
      } else a2 = this.getActressPageInfo(), i2 = `是否将该演员 <span class="jhs-task-emphasis">${a2.name}</span> 加入到黑名单中?`, n2 && (i2 = `演员 <span class="jhs-task-emphasis">${a2.name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
      const { starId: s2, name: r2, allName: c2, role: d2, movieType: h2, blacklistUrl: g2 } = a2;
      if (o.includes("page") && !o.includes("page=1") && (i2 += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始"), l) {
        const e3 = o.split("/star/")[1].split("/");
        if (e3.length > 1) {
          parseInt(e3[1]) > 1 && (i2 += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始");
        }
      }
      utils.q(t2, i2, (async () => {
        const e3 = this.getBean("TaskPlugin");
        navigator.locks.request(e3.singleTaskKey, {
          ifAvailable: true
        }, (async (e4) => {
          if (clog.debug("获取锁", e4), e4) {
            this.loadObj = loading();
            try {
              await storageManager.addBlacklistItem({
                starId: s2,
                name: r2,
                allName: c2,
                role: d2,
                movieType: h2,
                url: g2
              }), await this.filterActorVideo(r2, s2);
              const e5 = show.ok(`屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`, {
                duration: -1,
                close: true,
                onClick: /* @__PURE__ */ __name(() => {
                  e5.closeShow(), window.location.href = this.lastPageLink;
                }, "onClick")
              });
            } catch (t3) {
              clog.error(t3);
              const e5 = show.error("发生错误, 是否填转到解析失败的那一页? (点击并跳转)", {
                duration: -1,
                close: true,
                onClick: /* @__PURE__ */ __name(() => {
                  e5.closeShow(), window.location.href = this.nextPageLink;
                }, "onClick")
              });
            } finally {
              this.loadObj.close();
            }
          } else show.error("当前有定时任务在后台执行中, 无法发起此操作");
        })).catch(((e4) => {
          clog.error("锁任务出现错误:", e4);
        }));
      }));
    }
    async resetBtnTip() {
      const e2 = this.getBean("TaskPlugin"), t2 = localStorage.getItem(e2.lastCheckBlacklistTimeKey) || "无", n2 = await storageManager.getSetting("checkBlacklist_intervalTime", 12);
      this.checkBlacklist_ruleTime = await storageManager.getSetting("checkBlacklist_ruleTime", 8760), $("#checkBlacklistBtn").attr("data-tip", `上次检测时间: ${t2}; 检测间隔时间: ${n2}小时`);
    }
    async openBlacklistDialog() {
      const e2 = this.getBean("TaskPlugin"), t2 = await storageManager.getSetting();
      let n2 = `
            <div class="jhs-layout-7cb3f981">
                 <div class="jhs-layout-da5a4919">
                    <div class="jhs-layout-31a824a2">
                        <button type="button" id="checkBlacklistBtn" class="jhs-btn jhs-btn--danger" data-tip="上次检测时间: ${localStorage.getItem(e2.lastCheckBlacklistTimeKey) || "无"}; 检测间隔时间: ${t2.checkBlacklist_intervalTime}小时">${this.blacklistSvg} &nbsp;手动检测黑名单</button>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="toSetting">${this.settingSvg} &nbsp;&nbsp; 配置</button>
                    </div>
                    <div class="jhs-layout-31a824a2">
                        <select id="dataType" class="jhs-select-source">
                            <option value="" selected>所有</option>
                            <option value="actor">男演员</option>
                            <option value="actress">女演员</option>
                        </select>
                        <select id="statusType" class="jhs-select-source">
                            <option value="" selected>--检测状态--</option>
                            <option value="normal">正常检测</option>
                            <option value="stop">停止检测</option>
                        </select>
                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" class="jhs-select-source${r ? "" : " jhs-is-hidden"}">
                            <option value="" selected>--屏蔽类型--</option>
                            <option value="hasT">按所选分类屏蔽</option>
                            <option value="noT">未筛选分类</option>
                        </select>
                        <input id="searchValue" type="text" placeholder="搜索演员" class="jhs-field">
                        <button type="button" id="cleanQueryBtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>
                    </div>

                </div>
                <div id="table-container" class="jhs-layout-d44e70c7"></div>
            </div>
        `;
      layer.open({
        type: 1,
        title: "演员黑名单",
        content: n2,
        scrollbar: false,
        area: utils.getDialogArea("xl"),
        anim: -1,
        success: /* @__PURE__ */ __name(async (t3) => {
          const dialog = $(t3).find(".layui-layer-content > div").first().addClass("jhs-blacklist-layout").removeAttr("style"), toolbar = dialog.children("div").first().addClass("jhs-blacklist-toolbar").removeAttr("style");
          toolbar.children("div").addClass("jhs-blacklist-toolbar__group").removeAttr("style"), toolbar.find("select,input,a").removeAttr("style"), dialog.find("#table-container").removeAttr("style");
          JhsSelect.enhance(t3);
          await this.loadTableData(), $(".layui-layer-content").on("click", "#cleanQueryBtn", (async (e3) => {
            $("#searchValue").val(""), JhsSelect.setValue("#dataType", ""), JhsSelect.setValue("#statusType", ""), await this.reloadTable();
          })).on("focusout keydown", "#searchValue", (async (e3) => {
            if ("focusout" === e3.type || "Enter" === e3.key) {
              if ("Enter" === e3.key && e3.preventDefault(), "keydown" === e3.type && "Enter" !== e3.key) return;
              JhsSelect.setValue("#dataType", ""), await this.reloadTable();
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
                border: "1px solid var(--jhs-status-filter)"
              });
            }));
          })).on("click", ".open-url", ((e3) => {
            e3.preventDefault();
            const t4 = $(e3.currentTarget), n3 = t4.attr("data-url"), a2 = t4.attr("data-name");
            utils.openPage(n3, a2, true, e3);
          })).on("click", "#checkBlacklistBtn", ((t4) => {
            utils.q({
              clientX: t4.clientX,
              clientY: t4.clientY + 20
            }, "是否手动检测黑名单?", (() => {
              navigator.locks.request(e2.singleTaskKey, {
                ifAvailable: true
              }, (async (t5) => {
                t5 ? (await e2.loadConfig(), await e2.checkBlacklist(true)) : show.error("当前有定时任务在后台执行中, 无法发起手动任务");
              })).catch(((e3) => {
                clog.error("锁任务出现错误:", e3);
              }));
            }));
          }));
        }, "success"),
        end: /* @__PURE__ */ __name(async () => {
          this.tableObj && (this.tableObj.destroy(), this.tableObj = null), await jhsEventBus.emit("blacklist-rules-changed");
        }, "end")
      });
    }
    async reloadTable() {
      if (!this.tableObj) return;
      const e2 = await this.getTableData();
      this.tableObj.setData(e2);
    }
    async getTableData() {
      const e2 = this.getBean("TaskPlugin"), t2 = await storageManager.getBlacklist(), n2 = await storageManager.getBlacklistCarList(), a2 = $("#searchValue").val(), i2 = $("#statusType").val(), s2 = $("#dataType"), o2 = s2.val(), r2 = $("#urlType").val(), l2 = t2.length;
      let c2 = 0, d2 = 0;
      const h2 = t2.map(((t3) => {
        t3.role === B ? c2++ : t3.role === P && d2++;
        let n3 = false;
        return t3.lastPublishTime && (n3 = !e2.isUnnecessaryCheck(t3.lastPublishTime, this.checkBlacklist_ruleTime)), {
          ...t3,
          isUnCheck: n3
        };
      })).filter(((e3) => !(a2 && !e3.name.includes(a2)) && (("normal" !== i2 || !e3.isUnCheck) && (!("stop" === i2 && !e3.isUnCheck) && (o2 ? e3.role === o2 : !("hasT" === r2 && !e3.url.includes("t=")) && ("noT" !== r2 || !e3.url.includes("t=")))))));
      s2.html(`
            <option value="">所有 (${l2})</option>
            <option value="actor">男演员 (${c2})</option>
            <option value="actress">女演员 (${d2})</option>
        `), JhsSelect.setValue(s2, o2);
      const g2 = /* @__PURE__ */ new Map();
      for (const m2 of n2) {
        const e3 = m2.starId;
        g2.has(e3) || g2.set(e3, []), g2.get(e3).push(m2);
      }
      const p2 = h2.map(((e3) => {
        const t3 = e3.starId, n3 = g2.get(t3) || [];
        return {
          ...e3,
          carList: n3,
          count: n3.length
        };
      }));
      return this.currentCarCount = p2.reduce(((e3, t3) => e3 + (t3.count || 0)), 0), p2;
    }
    async loadTableData() {
      this.checkBlacklist_ruleTime = await storageManager.getSetting("checkBlacklist_ruleTime") || 8760;
      const e2 = await this.getTableData();
      this.tableObj = new Tabulator("#table-container", {
        layout: "fitColumns",
        placeholder: "暂无数据",
        virtualDom: true,
        data: e2,
        pagination: true,
        paginationMode: "local",
        paginationSize: 20,
        paginationSizeSelector: [20, 50, 100, 1e3, 99999],
        paginationCounter: /* @__PURE__ */ __name((e3, t2, n2, a2, i2) => `演员: ${a2} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" class="jhs-table-counter-note"></span>`, "paginationCounter"),
        responsiveLayout: "collapse",
        responsiveLayoutCollapse: true,
        columnDefaults: {
          headerHozAlign: "center",
          hozAlign: "center"
        },
        index: "starId",
        columns: [{
          title: "演员",
          field: "name",
          sorter: "string",
          minWidth: 100,
          responsive: 0,
          headerSort: false,
          formatter: /* @__PURE__ */ __name((e3, t2, n2) => {
            const a2 = e3.getData();
            return `<a class="open-url" data-url="${a2.url}" href="${a2.url}" data-name="${a2.name}" target="_blank">${a2.name}</a>`;
          }, "formatter")
        }, {
          title: "性别角色",
          field: "role",
          sorter: "string",
          width: 120,
          responsive: 5,
          formatter: /* @__PURE__ */ __name((e3, t2, n2) => {
            const a2 = e3.getData().role;
            let i2 = a2;
            return a2 === B ? i2 = "男演员" : a2 === P && (i2 = "女演员"), i2;
          }, "formatter")
        }, {
          title: "影视类别",
          field: "movieType",
          sorter: "string",
          width: 120,
          responsive: 5,
          formatter: /* @__PURE__ */ __name((e3, t2, n2) => {
            const a2 = e3.getData().movieType;
            let i2 = a2;
            return a2 === D ? i2 = "有码" : a2 === A && (i2 = "无码"), i2;
          }, "formatter")
        }, {
          title: "屏蔽类型",
          field: "url",
          sorter: "string",
          minWidth: 120,
          responsive: 4,
          visible: r,
          formatter: /* @__PURE__ */ __name((e3, t2, n2) => {
            let a2 = e3.getData().url.includes("t=");
            return `<span class="jhs-badge ${a2 ? "jhs-badge--filter" : "jhs-badge--neutral"}">${a2 ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
          }, "formatter")
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
          formatter: /* @__PURE__ */ __name((e3, t2, n2) => {
            let a2 = "", i2 = "正常检测";
            return e3.getData().isUnCheck && (a2 = `停更${this.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`, i2 = "停止检测"), `<span class="jhs-badge ${a2 ? "jhs-badge--filter" : "jhs-badge--neutral"}" data-tip="${a2}">${i2}</span>`;
          }, "formatter")
        }, {
          title: "操作",
          sorter: "string",
          cssClass: "action-cell-dropdown",
          minWidth: 150,
          responsive: 0,
          headerSort: false,
          formatter: /* @__PURE__ */ __name((e3, t2, n2) => {
            const a2 = e3.getData();
            return n2((() => {
              var t3, n3;
              null == (t3 = e3.getElement().querySelector(".delete-btn")) || t3.addEventListener("click", ((e4) => {
                const t4 = a2.name, n4 = a2.starId;
                t4 ? n4 ? utils.q(e4, `是否移除对 ${t4} 的屏蔽?`, (async () => {
                  await storageManager.removeBlacklistCarList(n4), await storageManager.deleteBlacklistItem(n4), show.info("操作成功"), await this.reloadTable();
                })) : show.error("获取starId失败") : show.error("获取名称失败");
              })), null == (n3 = e3.getElement().querySelector(".keyword-btn")) || n3.addEventListener("click", ((e4) => {
                const t4 = a2.carList.reduce(((e5, t5) => {
                  const n5 = t5.carNum.split("-")[0] + "-";
                  return e5[n5] = (e5[n5] || 0) + 1, e5;
                }), {}), n4 = Object.entries(t4).map((([e5, t5]) => ({
                  prefix: e5,
                  count: t5
                }))).sort(((e5, t5) => t5.count - e5.count));
                clog.debug(n4);
              }));
            })), '<button type="button" class="jhs-btn jhs-btn--danger delete-btn"><span>删除</span></button>';
          }, "formatter")
        }],
        initialSort: [{
          column: "createTime",
          dir: "desc"
        }],
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
    async filterAllVideo(e2, t2) {
      let n2, a2;
      if (t2 ? (l && t2.find(".avatar-box").length > 0 && t2.find(".avatar-box").parent().remove(), n2 = t2.find(this.getSelector().requestDomItemSelector), a2 = t2.find(this.getSelector().nextPageSelector).attr("href")) : (n2 = $(this.getSelector().itemSelector), a2 = $(this.getSelector().nextPageSelector).attr("href")), a2 && 0 === n2.length) throw show.error("解析列表失败"), new Error("解析列表失败");
      for (const s2 of n2) {
        const t3 = $(s2), { carNum: n3, url: a3, publishTime: o2 } = this.getBean("ListPagePlugin").findCarNumAndHref(t3);
        if (a3 && n3) try {
          await stateService.patch(n3, { blocked: true }, { type: "actor-page-block", record: { carNum: n3, url: a3, names: e2, publishTime: o2 } }), clog.log("屏蔽演员番号", e2, n3);
        } catch (i2) {
          clog.error(`保存失败 [${n3}]:`, i2);
        }
      }
      if (a2) {
        show.info("请不要关闭窗口, 正在解析下一页:" + a2), await new Promise(((e3) => setTimeout(e3, 500)));
        const t3 = await gmHttp.get(a2), n3 = new DOMParser(), i2 = $(n3.parseFromString(t3, "text/html"));
        await this.filterAllVideo(e2, i2);
      } else show.ok("执行结束!");
    }
    async batchSaveAllVideos(e2, t2) {
      let n2, a2;
      n2 = $(this.getSelector().itemSelector), a2 = $(this.getSelector().nextPageSelector).attr("href");
      if (a2 && 0 === n2.length) throw show.error("解析列表失败"), new Error("解析列表失败");
      for (const i2 of n2) {
        const n3 = $(i2), { carNum: a3, url: o2, publishTime: r2 } = this.getBean("ListPagePlugin").findCarNumAndHref(n3);
        if (o2 && a3) try {
          const flag = legacyActionToFlag(t2);
          flag && await stateService.patch(a3, { [flag]: true }, { type: "actor-page-batch-state", record: { carNum: a3, url: o2, names: e2, publishTime: r2 } }), clog.log("批量操作", e2, a3, t2);
        } catch (s2) {
          clog.error(`保存失败 [${a3}]:`, s2);
        }
      }
      if (a2) {
        show.info("请不要关闭窗口, 正在解析下一页:" + a2), await new Promise(((e3) => setTimeout(e3, 500)));
        const i2 = await gmHttp.get(a2), s2 = new DOMParser(), o2 = $(s2.parseFromString(i2, "text/html"));
        await this.batchSaveAllVideos(e2, t2);
      } else show.ok("执行结束!");
    }
    async filterActorVideo(e2, t2, n2) {
      let { nextPageLink: a2 } = await this.parseAndSaveFilterInfo(n2, e2, t2);
      if (this.nextPageLink = a2, a2) {
        let n3;
        this.lastPageLink = a2, show.info("请不要关闭窗口, 正在解析下一页:" + a2);
        clog.log("正在请求下一页内容:", a2);
        const i2 = await gmHttp.get(a2);
        n3 = utils.htmlTo$dom(i2);
        await this.filterActorVideo(e2, t2, n3);
      } else show.ok("执行结束!");
    }
    async parseAndSaveFilterInfo(e2, t2, n2) {
      let a2, i2;
      if (e2) {
        let t3 = false, n3 = T;
        e2.text().includes(I) && (t3 = true, n3 = I), t3 && e2.find(".avatar-box").length > 0 && e2.find(".avatar-box").parent().remove(), a2 = e2.find(this.getSelector(n3).requestDomItemSelector), i2 = e2.find(this.getSelector(n3).nextPageSelector).attr("href");
      } else a2 = $(this.getSelector().itemSelector), i2 = $(this.getSelector().nextPageSelector).attr("href");
      if (i2 && 0 === a2.length) return {
        nextPageLink: null,
        lastPublishTime: null
      };
      let s2 = [], o2 = null;
      for (const l2 of a2) {
        const e3 = $(l2), { carNum: a3, url: i3, publishTime: r2 } = this.getBean("ListPagePlugin").findCarNumAndHref(e3);
        o2 || (o2 = r2), i3 && a3 && s2.push({
          carNum: a3,
          url: i3,
          names: t2,
          actionType: d,
          starId: n2,
          publishTime: r2
        });
      }
      try {
        await storageManager.batchSaveBlacklistCarList(s2);
      } catch (r2) {
        clog.error("保存失败:", r2);
      }
      return {
        nextPageLink: i2,
        lastPublishTime: o2
      };
    }
  };
  __name(_BlacklistPlugin, "BlacklistPlugin");
  var BlacklistPlugin = _BlacklistPlugin;
  var _ListPageButtonPlugin = class _ListPageButtonPlugin extends BasePlugin {
    getName() {
      return "ListPageButtonPlugin";
    }
    async handle() {
      if (!window.isListPage) return;
      await this.createMenuBtn(), this.bindEvent();
      const e2 = await storageManager.getSetting("autoPage"), t2 = this.isHitShowPage();
      $("#sort-toggle-btn").prop("disabled", e2 === _ && !t2).attr("title", e2 === _ && !t2 ? "瀑布流模式仅支持默认排序" : "选择列表排序方式"), (e2 !== _ || t2) && await this.sortItems();
    }
    async createMenuBtn() {
      if (r) {
        const e2 = o.includes("/actors/");
        let t2 = $(".main-tabs, .tabs"), n2 = "加入黑名单", a2 = "jhs-btn--filter", s2 = null;
        if (e2) {
          t2 = $(".toolbar, .section-addition").filter(":last");
          const e3 = await storageManager.getBlacklist(), i2 = this.getActressPageInfo();
          e3.find(((e4) => e4.starId === i2.starId)) && (n2 = "已加入黑名单", a2 = "jhs-btn--muted");
        } else o.includes("/tags") && utils.loopDetector((() => $("#jhs-check-tag").text().trim()), (async () => {
          const e3 = $("#addBlacklistBtn");
          e3.attr("data-tip", "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中");
          const t3 = $("#jhs-check-tag").text().trim();
          if (!t3) return;
          const n3 = "no-" + t3, a3 = await storageManager.getBlacklist();
          s2 = a3.find(((e4) => e4.starId === n3)), s2 && (e3.addClass("jhs-btn--muted").removeClass("jhs-btn--filter"), $("#addBlacklistBtn span").text("已加入黑名单"));
        }));
        const r2 = o.includes("advanced_search");
        r2 && (t2 = $("h2.section-title"));
        const l2 = localStorage.getItem("jhs_sortMethod"), d2 = "当前排序方式: " + ("rateCount" === l2 ? "评价人数" : "date" === l2 ? "时间" : "默认");
        t2.append(`
                <div class="jhs-list-btn-row">
                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>
                    ${e2 ? `
                     <button type="button" id="addBlacklistBtn" class="jhs-btn ${a2}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n2}</span></button>
                     <button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></button>
                     <button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></button>
                     <button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></button>
                    ` : ""}
                    ${o.includes("/tags") ? `
                      <button type="button" id="addBlacklistBtn" class="jhs-btn ${a2}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n2}</span></button>
                    ` : ""}
                </div>
                <div class="jhs-list-btn-row">
                    <button type="button" id="newVideoBtn" class="jhs-btn jhs-btn--secondary"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></button>
                    <button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>
                    ${c ? "" : this.sortMenuHtml(l2 || "default", d2)}
                </div>
            `);
      }
      if (l) {
        const e2 = o.includes("/star/");
        let t2 = "加入黑名单", n2 = "jhs-btn--filter";
        if (e2) {
          const e3 = await storageManager.getBlacklist(), a3 = this.getActressPageInfo();
          e3.find(((e4) => e4.starId === a3.starId)) && (t2 = "已加入黑名单", n2 = "jhs-btn--muted");
        }
        const a2 = localStorage.getItem("jhs_sortMethod") || "default";
        $(".masonry").parent().prepend(`
                <div class="jhs-list-btn-row">
                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>
                    ${e2 ? `
                        <button type="button" id="addBlacklistBtn" class="jhs-btn ${n2}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t2}</span></button>
                        <button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></button>
                        <button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></button>
                        <button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></button>
                    ` : '<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>'}
                    ${this.sortMenuHtml(a2)}
                </div>
            `);
      }
      $("#waitCheckBtn > span").text("开始鉴定");
      const newVideoCount = $("#newVideoCount").detach(), newVideoLabel = $("#newVideoBtn > span");
      newVideoLabel.length && newVideoLabel.empty().append(document.createTextNode("新作品 ("), newVideoCount, document.createTextNode(")"));
    }
    /** 构建与原排序值兼容的 JHS 菜单。 */
    sortMenuHtml(method, title = "选择列表排序方式") {
      const labels = { default: "默认", rateCount: "评价人数", date: "时间" }, current = labels[method] || labels.default;
      return `<div class="jhs-sort-control"><button type="button" id="sort-toggle-btn" class="jhs-btn jhs-btn--secondary" aria-haspopup="menu" aria-expanded="false" title="${title}"><span id="jhs-sort-current">${current}</span></button><div class="jhs-popover jhs-sort-menu" role="menu" aria-label="排序方式">${Object.entries(labels).map((([value, label]) => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-sort-option" role="menuitemradio" aria-checked="${value === method ? "true" : "false"}" data-sort-method="${value}" tabindex="-1">${label}</button>`)).join("")}</div></div>`;
    }
    bindEvent() {
      $("#waitCheckBtn").on("click", ((e3) => {
        void this.openWaitCheck(e3).catch(((error) => clog.error("待鉴定列表打开失败", error)));
      })), $("#newVideoBtn").on("click", ((e3) => {
        this.getBean("NewVideoPlugin").openDialog();
      })), $("#blacklistBtn").on("click", ((e3) => {
        this.getBean("BlacklistPlugin").openBlacklistDialog();
      })), this.bindSortMenu();
      const e2 = this.getBean("BlacklistPlugin");
      $("#addBlacklistBtn").on("click", (async (t2) => {
        await e2.addBlacklist(t2);
      })), $("#filterAllVideo").on("click", (async (t2) => {
        let n2 = {
          clientX: t2.clientX,
          clientY: t2.clientY + 80
        }, a2 = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
        if (0 === a2.length) return void show.error("获取演员名称失败");
        let i2 = a2.text().trim().split(",")[0];
        utils.q(n2, "一键屏蔽视频列表?", (async () => {
          this.loadObj = loading();
          try {
            await e2.filterAllVideo(i2);
          } catch (t3) {
            clog.error(t3);
          } finally {
            this.loadObj.close();
          }
        }));
      })), $("#favoriteAllVideo").on("click", (async (t2) => {
        let n2 = { clientX: t2.clientX, clientY: t2.clientY + 80 }, a2 = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
        if (0 === a2.length) return void show.error("获取演员名称失败");
        let i2 = a2.text().trim().split(",")[0];
        utils.q(n2, "一键收藏所有可见作品?", (async () => {
          this.loadObj = loading();
          try {
            await e2.batchSaveAllVideos(i2, h);
          } catch (t3) {
            clog.error(t3);
          } finally {
            this.loadObj.close();
          }
        }));
      })), $("#hasDownAllVideo").on("click", (async (t2) => {
        let n2 = { clientX: t2.clientX, clientY: t2.clientY + 80 }, a2 = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
        if (0 === a2.length) return void show.error("获取演员名称失败");
        let i2 = a2.text().trim().split(",")[0];
        utils.q(n2, "一键已下载所有可见作品?", (async () => {
          this.loadObj = loading();
          try {
            await e2.batchSaveAllVideos(i2, g);
          } catch (t3) {
            clog.error(t3);
          } finally {
            this.loadObj.close();
          }
        }));
      }));
    }
    /** 绑定排序 popover 的选择与键盘交互。 */
    bindSortMenu() {
      const control = $(".jhs-sort-control"), toggle = control.find("#sort-toggle-btn"), menu = control.find(".jhs-sort-menu"), close = /* @__PURE__ */ __name((focus = false) => {
        menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), focus && toggle.trigger("focus");
      }, "close");
      toggle.on("click", ((event) => {
        event.preventDefault(), event.stopPropagation();
        const open = !menu.hasClass("is-open");
        menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && menu.find('[aria-checked="true"]').trigger("focus");
      }));
      menu.on("click", ".jhs-sort-option", ((event) => {
        const item = $(event.currentTarget), method = item.data("sort-method");
        localStorage.setItem("jhs_sortMethod", method), menu.find(".jhs-sort-option").attr("aria-checked", "false"), item.attr("aria-checked", "true"), $("#jhs-sort-current").text(item.text()), close(true), void this.sortItems().catch(((error) => clog.error("列表排序失败", error)));
      })).on("keydown", ".jhs-sort-option", ((event) => {
        const items = menu.find(".jhs-sort-option"), index = items.index(event.currentTarget);
        if ("Escape" === event.key) return event.preventDefault(), close(true);
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      }));
      $(document).off("click.jhsSortMenu").on("click.jhsSortMenu", ((event) => {
        $(event.target).closest(control).length || close();
      }));
    }
    async sortItems() {
      const e2 = this.isHitShowPage();
      if (!e2 && (o.includes("handle") || o.includes("advanced_search"))) return;
      const s2 = await storageManager.getSetting("autoPage");
      if (c || s2 === _ && !e2) return;
      const t2 = localStorage.getItem("jhs_sortMethod");
      if (!t2) return;
      const i2 = this.getSelector(), d2 = $(i2.boxSelector), h2 = $(i2.itemSelector);
      h2.each((function(e3) {
        $(this).attr("data-original-index") || $(this).attr("data-original-index", e3);
      }));
      const items = h2.get().map(((element, index) => {
        const card = $(element), originalIndex = Number(card.attr("data-original-index")) || 0;
        if ("default" === t2) return { element, key: originalIndex, originalIndex, index };
        if ("rateCount" === t2) {
          const explicit = Number(card.attr("data-jhs-rate-count")), match = card.find(".score .value").text().match(/由(\d+)人/);
          return { element, key: Number.isFinite(explicit) ? explicit : match ? Number(match[1]) : 0, originalIndex, index };
        }
        const value = card.attr("data-jhs-publish-time") || card.find(".meta").text().trim() || card.find("date").filter((function() {
          return /^\d{4}-\d{1,2}-\d{1,2}$/.test($(this).text().trim());
        })).first().text().trim(), timestamp = Date.parse(value);
        return { element, key: Number.isFinite(timestamp) ? timestamp : 0, originalIndex, index };
      }));
      items.sort(((e3, n2) => "default" === t2 ? e3.key - n2.key : n2.key - e3.key || e3.originalIndex - n2.originalIndex || e3.index - n2.index));
      const sortedElements = items.map(((item) => item.element));
      "default" === t2 ? $(sortedElements).appendTo(d2) : d2.empty().append(sortedElements);
    }
    isHitShowPage() {
      return isHitShowPage(window.location);
    }
    async openWaitCheck() {
      let e2 = this.getSelector();
      const t2 = await storageManager.getSetting("waitCheckCount", 5);
      let a2 = 0;
      const listPage = this.getBean("ListPagePlugin");
      for (const element of $(e2.itemSelector).toArray()) {
        if (a2 >= t2) break;
        const item = $(element), flags = normalizeStateFlags(JSON.parse(item.attr("data-jhs-flags") || "{}")), visibilityReasons = JSON.parse(item.attr("data-jhs-visibility") || "{}");
        if (hasAnyState(flags) || isHardHidden(flags, visibilityReasons)) continue;
        await listPage.openMovieDetail(item, { autoplay: true, newTab: false }), a2++;
      }
      0 === a2 && show.info("没有需鉴定的视频");
    }
  };
  __name(_ListPageButtonPlugin, "ListPageButtonPlugin");
  var ListPageButtonPlugin = _ListPageButtonPlugin;
  var _e = /* @__PURE__ */ __name(async (e2, t2 = "ja", n2 = "zh-CN") => {
    if (!e2) throw new Error("翻译文本不能为空");
    const a2 = "https://translate-pa.googleapis.com/v1/translate?" + new URLSearchParams({
      "params.client": "gtx",
      dataTypes: "TRANSLATION",
      key: "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA",
      "query.sourceLanguage": t2,
      "query.targetLanguage": n2,
      "query.text": e2
    }), i2 = await fetch(a2);
    if (!i2.ok) throw new Error(`${i2.status} ${i2.statusText}`);
    return (await i2.json()).translation;
  }, "_e");
  var Te = {
    IS_FILTERED: {
      text: u,
      color: "var(--jhs-status-filter)",
      on: "var(--jhs-status-filter-on)",
      reasonType: "单番号屏蔽",
      isCounted: true,
      countKey: "currentPageFilterCount"
    },
    IS_FAVORITE: {
      text: b,
      color: "var(--jhs-status-fav)",
      on: "var(--jhs-status-fav-on)",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageFavoriteCount"
    },
    IS_HAS_DOWN: {
      text: y,
      color: "var(--jhs-status-down)",
      on: "var(--jhs-status-down-on)",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageHasDownCount"
    },
    IS_HAS_WATCH: {
      text: k,
      color: "var(--jhs-status-watch)",
      on: "var(--jhs-status-watch-on)",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageHasWatchCount"
    },
    IS_KEYWORD_FILTER: {
      text: "关键词屏蔽",
      color: "var(--jhs-status-filter)",
      on: "var(--jhs-status-filter-on)",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageKeywordFilterCount"
    },
    IS_ACTOR_FILTER: {
      text: "男演员屏蔽",
      color: "var(--jhs-status-filter)",
      on: "var(--jhs-status-filter-on)",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageActorFilterCount"
    },
    IS_ACTRESS_FILTER: {
      text: "女演员屏蔽",
      color: "var(--jhs-status-filter)",
      on: "var(--jhs-status-filter-on)",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageActorFilterCount"
    },
    IS_WAIT_CHECK: {
      text: "",
      color: "",
      on: "",
      reasonType: "",
      isCounted: true,
      countKey: "currentPageWaitCheckCount"
    }
  };
  var QUICK_FILTER_LABELS = Object.freeze({
    all: "全部",
    waitCheck: "待鉴定",
    favorite: "收藏",
    hasDown: "下载",
    hasWatch: "已看",
    blockedItems: "屏蔽项",
    favoriteUndownloaded: "收藏未下载",
    favoriteUnwatched: "收藏未观看",
    downloadedUnwatched: "下载未观看",
    recent7d: "最近 7 天"
  });
  var PRIMARY_QUICK_FILTERS = Object.freeze(["all", "waitCheck", "favorite", "hasDown", "hasWatch"]);
  var SECONDARY_QUICK_FILTERS = Object.freeze(["blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d"]);
  var VALID_QUICK_FILTERS = /* @__PURE__ */ new Set([...PRIMARY_QUICK_FILTERS, ...SECONDARY_QUICK_FILTERS]);
  function normalizeQuickFilterKey(value) {
    if ("filter" === value) return "blockedItems";
    return VALID_QUICK_FILTERS.has(value) ? value : "waitCheck";
  }
  __name(normalizeQuickFilterKey, "normalizeQuickFilterKey");
  function isHardHidden(flags, visibilityReasons = {}) {
    return Boolean(flags.blocked || visibilityReasons.keyword || visibilityReasons.actorBlacklist || visibilityReasons.actressBlacklist);
  }
  __name(isHardHidden, "isHardHidden");
  function matchesQuickFilter(filter, flags, { visibilityReasons = {}, recent = false } = {}) {
    const normalizedFilter = normalizeQuickFilterKey(filter), hardHidden = isHardHidden(flags, visibilityReasons);
    if ("blockedItems" === normalizedFilter) return hardHidden;
    if (hardHidden) return false;
    if ("all" === normalizedFilter) return true;
    if ("waitCheck" === normalizedFilter) return !hasAnyState(flags);
    if ("favorite" === normalizedFilter) return !!flags.favorite;
    if ("hasDown" === normalizedFilter) return !!flags.downloaded;
    if ("hasWatch" === normalizedFilter) return !!flags.watched;
    if ("favoriteUndownloaded" === normalizedFilter) return !!flags.favorite && !flags.downloaded;
    if ("favoriteUnwatched" === normalizedFilter) return !!flags.favorite && !flags.watched;
    if ("downloadedUnwatched" === normalizedFilter) return !!flags.downloaded && !flags.watched;
    return "recent7d" === normalizedFilter && recent;
  }
  __name(matchesQuickFilter, "matchesQuickFilter");
  function shouldHideInDefaultView(flags, settings) {
    if (settings.showAllItem === _) return false;
    const activeVisibility = [[flags.favorite, settings.showFavoriteItem ?? _], [flags.downloaded, settings.showHasDownItem ?? _], [flags.watched, settings.showHasWatchItem ?? _]].filter(((entry) => entry[0]));
    return activeVisibility.length > 0 && activeVisibility.every(((entry) => entry[1] !== _));
  }
  __name(shouldHideInDefaultView, "shouldHideInDefaultView");
  function shouldShowItem({ filter, flags, visibilityReasons, settingHidden, recent }) {
    const normalizedFilter = normalizeQuickFilterKey(filter);
    if (!matchesQuickFilter(normalizedFilter, flags, { visibilityReasons, recent })) return false;
    return "all" !== normalizedFilter || !settingHidden;
  }
  __name(shouldShowItem, "shouldShowItem");
  var _ListPagePlugin = class _ListPagePlugin extends BasePlugin {
    async initCss() {
      return `<style>.jhs-status-tags{position:absolute;z-index:var(--jhs-z-content);top:5px;display:flex;flex-wrap:wrap;gap:4px;max-width:90%}.jhs-status-tags--right{right:0;justify-content:flex-end}.jhs-status-tags--left{left:0}.status-tag{padding:0 5px;border-radius:10px}.status-tag .tag{color:inherit!important}.jhs-jump-page-input{width:60px;margin-left:10px}.jhs-jump-page-btn{margin-left:5px}.jhs-quick-filter{display:flex;align-items:center;gap:var(--jhs-space-1);min-width:0}.jhs-quick-filter__more{position:relative}.jhs-quick-filter__menu{min-width:190px}.jhs-filter-menu__separator{height:1px;margin:var(--jhs-space-1) 0;background:var(--jhs-border)}</style>`;
    }
    constructor() {
      super(...arguments), i(this, "currentPageFilterCount", 0), i(this, "currentPageFavoriteCount", 0), i(this, "currentPageHasDownCount", 0), i(this, "currentPageHasWatchCount", 0), i(this, "currentPageKeywordFilterCount", 0), i(this, "currentPageActorFilterCount", 0), i(this, "currentPageWaitCheckCount", 0), i(this, "currentPageTotalCount", 0), i(this, "cache", null), i(this, "translationPending", /* @__PURE__ */ new Map()), i(this, "filterContext", null), i(this, "pendingItems", /* @__PURE__ */ new Set()), i(this, "processTimer", null), i(this, "hdImageObserver", null), i(this, "hdEagerRemaining", 12), i(this, "writeQueue", Promise.resolve()), i(this, "_debouncedTranslateWrite", null), i(this, "itemIndex", /* @__PURE__ */ new Map()), i(this, "recountFrame", null);
    }
    getName() {
      return "ListPagePlugin";
    }
    async handle() {
      if (!window.isListPage || isHitShowPage()) return;
      const refreshAll = /* @__PURE__ */ __name(async () => {
        this.filterContext = null, storageManager._invalidateCache(storageManager.car_list_key), await this.doFilter(), this.applyVisibility();
        const e2 = this.getBean("HistoryPlugin");
        e2.tableObj && e2.tableObj.setData();
        const t2 = this.getBean("NewVideoPlugin");
        t2 && void Promise.all([t2.showNewVideoCount(), t2.loadData()]).catch(((error) => clog.error("新作品数据刷新失败", error)));
      }, "refreshAll");
      jhsEventBus.on("legacy-refresh", refreshAll), jhsEventBus.on("blacklist-rules-changed", refreshAll), jhsEventBus.on("filter-rules-changed", refreshAll), jhsEventBus.on("settings-changed", refreshAll), jhsEventBus.on("car-state-changed", (async (payload) => {
        this.filterContext = null, storageManager._invalidateCache(storageManager.car_list_key);
        const items = this.getIndexedItems(payload.carNums || []);
        items.length && (await this.doFilterItems(items), this.applyVisibility(items));
        const history = this.getBean("HistoryPlugin");
        history.tableObj && history.tableObj.setData();
      })), jhsEventBus.on("new-video-changed", (() => {
        const plugin = this.getBean("NewVideoPlugin");
        plugin && void Promise.all([plugin.showNewVideoCount(), plugin.loadData()]).catch(((error) => clog.error("新作品数据刷新失败", error)));
      })), this.cleanRepeatId(), this.replaceHdImg(), this.addJumpPageControl(), this.fixBusTitleBox(), await this.doFilter(), await this.createQuickFilter(), this.applyVisibility(), await this.bindClick(), this.rememberTagExpand(), $(this.getSelector().itemSelector).attr("data-jhs-processed", "true"), this.rebuildItemIndex(), await jhsEventBus.emit("list-items-added", { items: $(this.getSelector().itemSelector).toArray() }, { broadcast: false }), this.checkDom();
    }
    async createQuickFilter() {
      if ($("#jhs-quick-filter").length) return;
      const e2 = this.getSelector(), primaryHtml = PRIMARY_QUICK_FILTERS.map(((filter) => `<button type="button" role="tab" class="jhs-btn jhs-segmented__item" aria-selected="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""), secondaryHtml = SECONDARY_QUICK_FILTERS.map(((filter, index) => `${1 === index ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-filter-option" aria-checked="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""), t2 = `<div id="jhs-quick-filter" class="jhs-quick-filter">
                <div class="jhs-quick-filter__primary jhs-segmented" role="tablist" aria-label="状态筛选">${primaryHtml}</div>
                <div class="jhs-quick-filter__more">
                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-quick-filter__toggle" aria-haspopup="menu" aria-expanded="false"><span class="jhs-quick-filter__label">更多筛选</span> ▾</button>
                    <div class="jhs-popover jhs-commandbar__menu jhs-quick-filter__menu" role="menu" aria-label="更多筛选">${secondaryHtml}</div>
                </div>
            </div>`;
      r ? $(e2.boxSelector).before(t2) : l && $(".masonry").before(t2);
      const root = $("#jhs-quick-filter"), toggle = root.find(".jhs-quick-filter__toggle"), menu = root.find(".jhs-quick-filter__menu"), closeMenu = /* @__PURE__ */ __name((restoreFocus = false) => {
        menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), restoreFocus && toggle.trigger("focus");
      }, "closeMenu");
      root.on("click", ".jhs-segmented__item", ((event) => this.setQuickFilter($(event.currentTarget).data("jhs-filter")))).on("keydown", ".jhs-segmented__item", ((event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = root.find(".jhs-segmented__item"), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
        tabs.eq(next).trigger("click").trigger("focus");
      })).on("click", ".jhs-filter-option", ((event) => {
        this.setQuickFilter($(event.currentTarget).data("jhs-filter")), closeMenu(true);
      })).on("keydown", ".jhs-filter-option", ((event) => {
        const items = menu.find(".jhs-filter-option"), index = items.index(event.currentTarget);
        if ("Escape" === event.key) return event.preventDefault(), closeMenu(true);
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      }));
      toggle.on("click", ((event) => {
        event.preventDefault(), event.stopPropagation();
        const open = !menu.hasClass("is-open");
        menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && (menu.find('[aria-checked="true"]').first().length ? menu.find('[aria-checked="true"]').first() : menu.find(".jhs-filter-option").first()).trigger("focus");
      })), $(document).off("click.jhsQuickFilter").on("click.jhsQuickFilter", ((event) => {
        $(event.target).closest(root).length || closeMenu();
      }));
      this.setQuickFilter(await storageManager.getSetting("defaultQuickFilterTab", "waitCheck"));
    }
    applyVisibility(items = null) {
      const e2 = this.activeQuickFilter || "waitCheck", t2 = this.getSelector().itemSelector;
      (items ? $(items) : $(t2)).each((function() {
        const t3 = $(this), flags = normalizeStateFlags(JSON.parse(t3.attr("data-jhs-flags") || "{}")), visibilityReasons = JSON.parse(t3.attr("data-jhs-visibility") || "{}"), settingHidden = "yes" === t3.attr("data-jhs-setting-hide"), recent = "yes" === t3.attr("data-jhs-recent");
        shouldShowItem({ filter: e2, flags, visibilityReasons, settingHidden, recent }) ? t3.show() : t3.hide();
      }));
    }
    setQuickFilter(filter, { syncUi = true } = {}) {
      this.activeQuickFilter = normalizeQuickFilterKey(filter), this.applyVisibility(), syncUi && this.syncQuickFilterUi();
    }
    syncQuickFilterUi() {
      const filter = normalizeQuickFilterKey(this.activeQuickFilter), isPrimary = PRIMARY_QUICK_FILTERS.includes(filter), root = $("#jhs-quick-filter"), tabs = root.find(".jhs-segmented__item"), options = root.find(".jhs-filter-option");
      tabs.removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
      isPrimary ? tabs.filter(`[data-jhs-filter="${filter}"]`).addClass("active").attr({ "aria-selected": "true", tabindex: "0" }) : tabs.first().attr("tabindex", "0");
      options.attr("aria-checked", "false").filter(`[data-jhs-filter="${filter}"]`).attr("aria-checked", "true");
      root.find(".jhs-quick-filter__label").text(isPrimary ? "更多筛选" : `筛选：${QUICK_FILTER_LABELS[filter]}`);
      $(".jhs-mobile-filter-label").text(`筛选：${QUICK_FILTER_LABELS[filter]}`), $(".jhs-mobile-filter-option").attr("aria-checked", "false").filter(`[data-jhs-filter="${filter}"]`).attr("aria-checked", "true");
    }
    rememberTagExpand() {
      if (!window.location.href.includes("actors")) return;
      const e2 = $(".tag-expand");
      if (0 === e2.length) return;
      const t2 = "jhs_tag_expand", n2 = "true" === localStorage.getItem(t2), a2 = $(".actor-tags .content");
      n2 && a2.hasClass("collapse") && e2[0].click(), e2.on("click", (function() {
        const e3 = !$(".actor-tags .content").hasClass("collapse");
        clog.debug("触发"), localStorage.setItem(t2, e3.toString());
      }));
    }
    checkDom() {
      if (!window.isListPage || isHitShowPage()) return;
      const e2 = this.getSelector(), t2 = document.querySelector(e2.boxSelector);
      if (!t2) return void clog.error("没有找到容器节点!");
      const a2 = new MutationObserver(((records) => {
        for (const record of records) {
          this.removeIndexedItems(record.removedNodes);
          for (const node of record.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            node.matches?.(e2.itemSelector) && "true" !== node.dataset.jhsProcessed && this.pendingItems.add(node), node.querySelectorAll?.(e2.itemSelector).forEach(((item) => {
              "true" !== item.dataset.jhsProcessed && this.pendingItems.add(item);
            }));
          }
        }
        this.pendingItems.size && (this.processTimer && clearTimeout(this.processTimer), this.processTimer = setTimeout((() => {
          const items = [...this.pendingItems].filter(((item) => item.isConnected && "true" !== item.dataset.jhsProcessed));
          this.pendingItems.clear(), this.processTimer = null, items.length && void this.processAddedItems(items).catch(((error) => clog.error("列表增量处理失败", error)));
        }), 100));
      }));
      a2.observe(t2, {
        childList: true,
        subtree: false
      });
    }
    async processAddedItems(items) {
      const selector = this.getSelector(), covers = items.flatMap(((item) => [...item.querySelectorAll(selector.coverImgSelector)]));
      this.replaceHdImg(covers), this.addJumpPageControl(), this.fixBusTitleBox(items), await this.doFilterItems(items), this.applyVisibility(items), await this.getBean("ListPageButtonPlugin").sortItems(), await this.getBean("CoverButtonPlugin").addSvgBtn(items), items.forEach(((item) => item.dataset.jhsProcessed = "true")), this.indexItems(items), await jhsEventBus.emit("list-items-added", { items }, { broadcast: false }), this.getBean("AutoPagePlugin").checkLoad();
    }
    rebuildItemIndex() {
      this.itemIndex.clear(), this.indexItems($(this.getSelector().itemSelector).toArray());
    }
    indexItems(items) {
      items.forEach(((item) => {
        try {
          const key = normalizeCarNum(this.findCarNumAndHref($(item)).carNum);
          if (!key) return;
          const indexed = this.itemIndex.get(key) || /* @__PURE__ */ new Set();
          indexed.add(item), this.itemIndex.set(key, indexed);
        } catch (error) {
          clog.debug("列表项索引跳过无效卡片", error);
        }
      }));
    }
    removeIndexedItems(nodes) {
      const removed = /* @__PURE__ */ new Set();
      Array.from(nodes || []).forEach(((node) => {
        node.nodeType === Node.ELEMENT_NODE && (removed.add(node), node.querySelectorAll?.(this.getSelector().itemSelector).forEach(((item) => removed.add(item))));
      }));
      if (!removed.size) return;
      this.itemIndex.forEach(((items, key) => {
        items.forEach(((item) => {
          removed.has(item) && items.delete(item);
        })), items.size || this.itemIndex.delete(key);
      }));
    }
    getIndexedItems(carNums) {
      const result = /* @__PURE__ */ new Set();
      carNums.map(normalizeCarNum).forEach(((key) => {
        const items = this.itemIndex.get(key);
        items?.forEach(((item) => item.isConnected ? result.add(item) : items.delete(item))), items && !items.size && this.itemIndex.delete(key);
      }));
      return [...result];
    }
    fixBusTitleBox(items = null) {
      if (!l) return;
      (items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray()).forEach(((e2) => {
        var t2;
        let n2 = $(e2);
        if (n2.find(".avatar-box").length > 0) return;
        const a2 = (null == (t2 = n2.find("img").attr("title")) ? void 0 : t2.trim()) || "";
        n2.find(".photo-info span:first").contents().first().wrap(`<span class="video-title" title="${a2}">${a2}</span>`), n2.find("br").remove();
      }));
    }
    cleanRepeatId() {
      if (!l) return;
      $("#waterfall_h").removeAttr("id").attr("id", "no-page");
      const e2 = $('[id="waterfall"]');
      0 !== e2.length && e2.each((function() {
        const e3 = $(this);
        if (!e3.hasClass("masonry")) {
          e3.children().insertAfter(e3), e3.remove();
        }
      }));
    }
    async doFilter() {
      return this.doFilterItems();
    }
    async doFilterItems(items = null) {
      if (!window.isListPage) return;
      let e2 = items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray();
      e2.length && (await this.filterMovieList(e2), l && setTimeout((() => {
        this.getBean("BusImgPlugin").logImageHeightsByRow().catch(((e3) => clog.error("JavBus图片高度修正失败", e3)));
      })));
    }
    async yieldListFrame() {
      await new Promise(((e2) => {
        window.requestAnimationFrame ? window.requestAnimationFrame((() => setTimeout(e2))) : setTimeout(e2);
      }));
    }
    findMatchedTitleKeyword(e2, t2, n2) {
      for (const a2 of e2) if (t2.includes(a2) || n2.startsWith(a2)) return a2;
      return null;
    }
    async getFilterContext() {
      if (this.filterContext) return this.filterContext;
      const [titleKeywords, blacklistMap, blacklistCars, settings, carMap, activity] = await Promise.all([storageManager.getTitleFilterKeyword(), storageManager.getBlacklistMap(), storageManager.getBlacklistCarList(), storageManager.getSetting(), storageManager.getCarMap(), stateService.getActivityLog()]), actorCarNumToNameMap = /* @__PURE__ */ new Map(), actressCarNumToNameMap = /* @__PURE__ */ new Map(), recentCarNums = /* @__PURE__ */ new Set();
      const cutoff = Date.now() - 7 * 864e5;
      activity.entries.filter(((entry) => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)).forEach(((entry) => entry.changes.filter(((change) => "reverted" !== change.undoState && change.fields?.some(((field) => field.startsWith("stateFlags."))))).forEach(((change) => recentCarNums.add(change.carNum)))));
      for (const item of blacklistCars) {
        const role = blacklistMap.get(item.starId)?.role;
        if (!role) {
          clog.error("黑名单数据源丢失演员信息", item);
          continue;
        }
        const target = role === B ? actorCarNumToNameMap : actressCarNumToNameMap, carNum = normalizeCarNum(item.carNum);
        target.has(carNum) || target.set(carNum, item.names);
      }
      return this.filterContext = { titleKeywords, settings, carMap, recentCarNums, actorCarNumToNameMap, actressCarNumToNameMap };
    }
    collectCurrentPageSummary() {
      const summary = { total: 0, pending: 0, blockedItems: 0, favorite: 0, downloaded: 0, watched: 0, debug: { manualBlocked: 0, keywordBlocked: 0, actorBlocked: 0, actressBlocked: 0 } };
      $(this.getSelector().itemSelector).each(((e2, item) => {
        const card = $(item);
        if (l && card.find(".avatar-box").length > 0) return;
        const flags = normalizeStateFlags(JSON.parse(card.attr("data-jhs-flags") || "{}")), reasons = JSON.parse(card.attr("data-jhs-visibility") || "{}"), hardHidden = isHardHidden(flags, reasons);
        summary.total++, flags.favorite && summary.favorite++, flags.downloaded && summary.downloaded++, flags.watched && summary.watched++, hardHidden && summary.blockedItems++, !hasAnyState(flags) && !hardHidden && summary.pending++, flags.blocked && summary.debug.manualBlocked++, reasons.keyword && summary.debug.keywordBlocked++, reasons.actorBlacklist && summary.debug.actorBlocked++, reasons.actressBlacklist && summary.debug.actressBlocked++;
      }));
      return summary;
    }
    getCurrentPageSummary() {
      return this.collectCurrentPageSummary();
    }
    recountStatuses() {
      const summary = this.collectCurrentPageSummary();
      this.currentPageFilterCount = summary.debug.manualBlocked, this.currentPageFavoriteCount = summary.favorite, this.currentPageHasDownCount = summary.downloaded, this.currentPageHasWatchCount = summary.watched, this.currentPageKeywordFilterCount = summary.debug.keywordBlocked, this.currentPageActorFilterCount = summary.debug.actorBlocked + summary.debug.actressBlocked, this.currentPageWaitCheckCount = summary.pending, this.currentPageTotalCount = summary.total;
      return summary;
    }
    scheduleRecount() {
      if (this.recountFrame) return;
      const schedule = window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
      this.recountFrame = schedule((() => {
        this.recountFrame = null, this.recountStatuses();
      }));
    }
    async translateListItems(e2) {
      if (await storageManager.getSetting("translateTitle", _) !== _) return;
      await mapLimit(e2, 3, (async (item, index) => {
        try {
          index > 0 && index % 8 == 0 && await this.yieldListFrame(), await this.translate(item);
        } catch (error) {
          clog.error("列表标题翻译失败", error);
        }
      }));
    }
    async filterMovieList(e2) {
      utils.time("累计耗费时间"), utils.time("读取数据耗时");
      const { titleKeywords: n2, settings: s2, carMap: m2, recentCarNums: recent, actorCarNumToNameMap: f, actressCarNumToNameMap: v2 } = await this.getFilterContext(), o2 = utils.time("读取数据耗时");
      utils.time("组装数据耗时");
      const b2 = utils.time("组装数据耗时"), k2 = (null == s2 ? void 0 : s2.showFavoriteItem) ?? _, S = (null == s2 ? void 0 : s2.showHasDownItem) ?? _, T2 = (null == s2 ? void 0 : s2.showHasWatchItem) ?? _, I2 = (null == s2 ? void 0 : s2.showAllItem) ?? C, P2 = (null == s2 ? void 0 : s2.tagPosition) || "rightTop";
      const O2 = n2.filter(((e3) => e3));
      this.currentPageFilterCount = 0, this.currentPageFavoriteCount = 0, this.currentPageHasDownCount = 0, this.currentPageHasWatchCount = 0, this.currentPageKeywordFilterCount = 0, this.currentPageActorFilterCount = 0, this.currentPageWaitCheckCount = 0, this.currentPageTotalCount = 0, utils.time("处理页面耗时");
      const R2 = [];
      for (let n3 = 0; n3 < e2.length; n3++) {
        n3 > 0 && n3 % 12 == 0 && await this.yieldListFrame();
        let t2 = $(e2[n3]);
        if (l && t2.find(".avatar-box").length > 0) continue;
        const { carNum: a2, title: i2 } = this.findCarNumAndHref(t2), record = m2.get(a2), flags = normalizeStateFlags(record?.stateFlags), actorFiltered = f.has(a2), actressFiltered = v2.has(a2), keyword = this.findMatchedTitleKeyword(O2, i2, a2), visibilityReasons = { keyword: !!keyword, actorBlacklist: actorFiltered, actressBlacklist: actressFiltered };
        const hardHidden = isHardHidden(flags, visibilityReasons), settingHidden = shouldHideInDefaultView(flags, { showAllItem: I2, showFavoriteItem: k2, showHasDownItem: S, showHasWatchItem: T2 });
        t2.attr("data-jhs-flags", JSON.stringify(flags)).attr("data-jhs-visibility", JSON.stringify(visibilityReasons)).attr("data-jhs-setting-hide", settingHidden ? _ : C).attr("data-jhs-recent", recent.has(a2) ? _ : C).attr("data-jhs-tag-position", P2);
        const signature = JSON.stringify({ flags, visibilityReasons, P: P2 });
        if (t2.attr("data-jhs-state-signature") !== signature) {
          t2.attr("data-jhs-state-signature", signature), t2.find(".jhs-status-tags").remove();
          const badgeDefs = [
            [flags.blocked, Te.IS_FILTERED, "单番号屏蔽"],
            [flags.favorite, Te.IS_FAVORITE, ""],
            [flags.downloaded, Te.IS_HAS_DOWN, ""],
            [flags.watched, Te.IS_HAS_WATCH, ""],
            [visibilityReasons.keyword, Te.IS_KEYWORD_FILTER, keyword || "未知"],
            [visibilityReasons.actorBlacklist, Te.IS_ACTOR_FILTER, f.get(a2) || ""],
            [visibilityReasons.actressBlacklist, Te.IS_ACTRESS_FILTER, v2.get(a2) || ""]
          ].filter(((item) => item[0]));
          if (badgeDefs.length) {
            const box = $(`<span class="jhs-status-tags ${"rightTop" === P2 ? "jhs-status-tags--right" : "jhs-status-tags--left"}"></span>`);
            badgeDefs.forEach((([, definition, tip]) => {
              const badge = $(`<span class="jhs-badge ${r ? "jhs-badge--success" : "jhs-badge--neutral"} status-tag" data-tip="${escapeHtml(tip)}" title="">${escapeHtml(definition.text)}</span>`);
              badge.css({ color: definition.on, backgroundColor: definition.color }), box.append(badge);
            }));
            if (r) t2.find(".tags").append(box);
            else if (l) {
              const host = t2.find(".item-tag");
              host.length ? host.append(box) : t2.find(".photo-info > span > div").append(box);
            }
          }
        }
        hardHidden || R2.push(t2);
      }
      this.scheduleRecount(), void this.translateListItems(R2).catch(((e3) => clog.error("列表页翻译任务失败", e3)));
      const D2 = utils.time("处理页面耗时"), A2 = utils.time("累计耗费时间");
      clog.log(`
            <table class="countTable jhs-layout-b12542a5">
                <tr>
                    <td colspan="2" class="jhs-count-table__cell">${o2}</td>
                    <td colspan="2" class="jhs-count-table__cell">${b2}</td>
                </tr>

                <tr>
                    <td colspan="2" class="jhs-count-table__cell">${D2}</td>
                    <td colspan="2" class="jhs-count-table__cell">${A2}</td>
                </tr>
                <tr>
                    <td class="jhs-count-table__head">项目</td>
                    <td class="jhs-count-table__head">数量</td>
                    <td class="jhs-count-table__head">项目</td>
                    <td class="jhs-count-table__head">数量</td>
                </tr>

                <tr>
                    <td class="jhs-count-table__cell">屏蔽单番号</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageFilterCount}</strong></td>
                     <td class="jhs-count-table__cell">收藏</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageFavoriteCount}</strong></td>
                </tr>

                <tr>
                    <td class="jhs-count-table__cell">屏蔽演员</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageActorFilterCount}</strong></td>
                    <td class="jhs-count-table__cell">已下载</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageHasDownCount}</strong></td>
                </tr>

                <tr>
                    <td class="jhs-count-table__cell">屏蔽关键词</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageKeywordFilterCount}</strong></td>
                    <td class="jhs-count-table__cell">已观看</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageHasWatchCount}</strong></td>
                </tr>

                <tr>
                    <td class="jhs-count-table__cell">待鉴定</td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageWaitCheckCount}</strong></td>
                    <td class="jhs-count-table__cell"></td>
                    <td class="jhs-count-table__cell"></td>
                </tr>

                <tr>
                    <td class="jhs-count-table__cell"><strong>总数</strong></td>
                    <td class="jhs-count-table__cell"><strong>${this.currentPageTotalCount}</strong></td>
                </tr>
            </table>
        `);
    }
    async bindClick() {
      let e2 = this.getSelector();
      this.bindMovieDetailNavigation(e2.boxSelector), $(e2.boxSelector).on("click", ".item video", (async (e3) => {
        const t2 = e3.currentTarget;
        t2.paused ? await safePlay(t2, {
          context: "列表视频",
          notify: true
        }) : t2.pause(), e3.preventDefault(), e3.stopPropagation();
      })), $(e2.boxSelector).on("contextmenu", ".item img, .item video", (async (e3) => {
        try {
          e3.preventDefault();
          const t2 = $(e3.target).closest(".item"), { carNum: n2, url: a2, publishTime: i2 } = this.findCarNumAndHref(t2);
          let s2 = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10"), o2 = "";
          s2.length && (o2 = s2.text().trim().split(",")[0].replace("(無碼)", "")), utils.q(e3, `是否屏蔽番号 ${n2}?`, (async () => {
            try {
              o2 || (o2 = await this.parseActressName(a2)), await stateService.patch(n2, { blocked: true }, { record: { carNum: n2, url: a2, names: o2, publishTime: i2 } }), show.ok("操作成功");
            } catch (s3) {
              clog.error("屏蔽操作失败:", s3), show.error("操作失败");
            }
          }));
        } catch (t2) {
          clog.error("右键菜单处理失败:", t2);
        }
      }));
    }
    /** 从任意列表卡片进入统一详情导航。 */
    async openMovieDetail(item, { event = null, autoplay = false, newTab = false } = {}) {
      const card = item?.jquery ? item : $(item), { carNum, aHref } = this.findCarNumAndHref(card);
      if (!carNum || !aHref) return;
      const shouldOpenTab = newTab || !!event && (event.ctrlKey || event.metaKey || 1 === event.button);
      if (carNum.includes("FC2-")) {
        const movieId = this.parseMovieId(aHref);
        return shouldOpenTab ? this.getBean("Fc2Plugin").openFc2Page(movieId, carNum, aHref, { event, newTab: true }) : this.getBean("Fc2Plugin").openFc2Dialog(movieId, carNum, aHref);
      }
      const destination = new URL(aHref, window.location.origin);
      autoplay && destination.searchParams.set("autoPlay", "1"), utils.openPage(destination.href, carNum, true, { event, newTab: shouldOpenTab }), this.$currentImage = null;
    }
    /** 为宿主与合成列表统一绑定左键、修饰键和中键导航。 */
    bindMovieDetailNavigation(container) {
      const root = $(container), selector = ".item img, .item .video-title";
      root.off("click.jhsMovieDetail auxclick.jhsMovieDetail", selector).on("click.jhsMovieDetail auxclick.jhsMovieDetail", selector, ((event) => {
        if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
        if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
        event.preventDefault(), event.stopPropagation();
        void this.openMovieDetail($(event.currentTarget).closest(".item"), { event }).catch(((error) => clog.error("打开影片详情失败", error)));
      }));
    }
    async parseActressName(e2) {
      let t2 = null;
      if (await storageManager.getSetting("enableSaveActressCarInfo", C) === _) {
        clog.debug("鉴定补录演员信息-已启用, 开始解析详情页"), clog.debug("开始解析演员详情页", e2);
        const n2 = await gmHttp.get(e2), a2 = utils.htmlTo$dom(n2);
        r ? t2 = a2.find(".female").prev().map(((e3, t3) => $(t3).text())).get().join(" ") : l && (t2 = a2.find('span[onmouseover*="star_"] a').map(((e3, t3) => $(t3).text())).get().join(" ")), clog.debug("解析到名称:", t2);
      }
      return t2;
    }
    findCarNumAndHref(e2) {
      var t2, n2;
      let a2, i2, s2, o2 = e2.find("a"), r2 = o2.attr("href"), l2 = e2.find(".video-title");
      if (l2.length > 0) {
        let t3 = l2.find("strong");
        t3.length > 0 && (a2 = t3.text().trim()), i2 = o2.attr("title") ? o2.attr("title").trim() : a2 ? l2.text().replace(a2, "").trim() : l2.text().trim(), s2 = e2.find(".meta").text().trim();
      }
      if (!a2) {
        let o3 = e2.find("img");
        r2 && o3.length > 0 && (i2 = (null == (t2 = o3.attr("title")) ? void 0 : t2.trim()) || (null == (n2 = o3.attr("data-title")) ? void 0 : n2.trim()));
        const l3 = /* @__PURE__ */ __name((e3) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(e3), "l");
        s2 = e2.find("date").map(((e3, t3) => $(t3).text().trim())).get().find(l3), a2 = e2.find("date").map(((e3, t3) => $(t3).text().trim())).get().find(((e3) => !l3(e3)));
      }
      if (!a2) {
        const e3 = "提取番号信息失败";
        throw show.error(e3), new Error(e3);
      }
      return {
        carNum: normalizeCarNum(a2),
        aHref: r2,
        url: r2,
        title: i2,
        publishTime: s2
      };
    }
    showCarNumBox(e2) {
      const t2 = $(".movie-list .item").toArray().find(((t3) => $(t3).find(".video-title strong").text() === e2));
      if (t2) {
        const n2 = $(t2);
        n2.attr("data-hide") === "yes" && (n2.show(), n2.removeAttr("data-hide"));
      }
    }
    _replaceSingleHdImg(e2) {
      if ("true" === e2.dataset.hdReplaced) return;
      if (r) {
        const isJavdbCdn = /jdbstatic\.com|javdb\.com/i.test(e2.src);
        if (isJavdbCdn) {
          const originalSrc = e2.src;
          e2.src = e2.src.replace("thumbs", "covers");
          e2.dataset.hdReplaced = "true";
          e2.title = "";
          e2.onerror = function() {
            if (this.src !== originalSrc) {
              this.src = originalSrc;
              this.onerror = null;
            }
          };
        }
      } else if (l) {
        const t2 = /\/(imgs|pics)\/(thumb|thumbs)\//, n2 = /(\.jpg|\.jpeg|\.png)$/i;
        t2.test(e2.src) ? (e2.src = e2.src.replace(t2, "/$1/cover/").replace(n2, "_b$1"), e2.dataset.hdReplaced = "true", e2.dataset.title = e2.title, e2.title = "") : /ps(\.jpg|\.jpeg|\.png)$/i.test(e2.src) && (e2.src = e2.src.replace(/ps(\.jpg|\.jpeg|\.png)$/i, "pl$1"), e2.dataset.hdReplaced = "true", e2.dataset.title = e2.title, e2.title = "");
      }
    }
    replaceHdImg(e2) {
      if (e2 && "string" == typeof e2.jquery && (e2 = e2.toArray()), e2 || (e2 = document.querySelectorAll(this.getSelector().coverImgSelector)), !e2.length) return;
      const t2 = Array.from(e2).filter(((e3) => "true" !== e3.dataset.hdReplaced && "true" !== e3.dataset.jhsHdObserved));
      if ("IntersectionObserver" in window && !this.hdImageObserver) this.hdImageObserver = new IntersectionObserver(((entries) => {
        entries.forEach(((entry) => {
          entry.isIntersecting && (this.hdImageObserver.unobserve(entry.target), delete entry.target.dataset.jhsHdObserved, this._replaceSingleHdImg(entry.target));
        }));
      }), { rootMargin: "200px" });
      for (const image of t2) this.hdEagerRemaining > 0 ? (this.hdEagerRemaining--, this._replaceSingleHdImg(image)) : this.hdImageObserver ? (image.dataset.jhsHdObserved = "true", this.hdImageObserver.observe(image)) : this._replaceSingleHdImg(image);
      storageManager.getSetting("hoverBigImg", C).then(((e3) => {
        e3 === _ && (window.imageHoverPreviewObj ? window.imageHoverPreviewObj.bindEvents() : window.imageHoverPreviewObj = new ImageHoverPreview({
          selector: this.getSelector().coverImgSelector
        }));
      }));
    }
    getTranslationCache() {
      if (this.cache && "object" == typeof this.cache && !Array.isArray(this.cache)) return this.cache;
      try {
        this.cache = JSON.parse(localStorage.getItem("jhs_translate") || "{}");
      } catch (error) {
        clog.warn("列表翻译缓存无法解析，已忽略旧缓存", error), this.cache = {};
      }
      return this.cache && "object" == typeof this.cache && !Array.isArray(this.cache) ? this.cache : this.cache = {};
    }
    scheduleTranslationWrite() {
      this._debouncedTranslateWrite && clearTimeout(this._debouncedTranslateWrite), this._debouncedTranslateWrite = setTimeout((() => {
        localStorage.setItem("jhs_translate", JSON.stringify(this.getTranslationCache()));
      }), 500);
    }
    applyTranslatedTitle(e2, t2, n2) {
      const a2 = e2.find(".video-title");
      r ? (a2.contents().each((function() {
        3 !== this.nodeType || "" === this.textContent.trim() || this.textContent.includes(n2) || (this.textContent = " " + t2 + " ");
      })), a2.attr("title", t2)) : a2.text(t2), e2.attr("data-jhs-translation-key", n2);
    }
    async translate(e2) {
      let t2, n2, a2 = e2.find(".video-title");
      if (r ? (t2 = a2.contents().filter(((e3, t3) => 3 === t3.nodeType && "" !== t3.textContent.trim())).text().trim(), n2 = e2.find(".video-title strong").text().trim()) : (t2 = (e2.find("img").attr("data-title") || "").trim(), n2 = (e2.find("a").attr("href") || "").split("/").filter(Boolean).pop()?.trim()), !t2 || !n2) return;
      const cache = this.getTranslationCache();
      if (cache[n2]) return void this.applyTranslatedTitle(e2, cache[n2], n2);
      let pending = this.translationPending.get(n2);
      if (!pending) {
        pending = _e(t2).then(((translated) => (cache[n2] = translated, this.scheduleTranslationWrite(), translated))).finally((() => this.translationPending.delete(n2))), this.translationPending.set(n2, pending);
      }
      this.applyTranslatedTitle(e2, await pending, n2);
    }
    async revertTranslation() {
      $(this.getSelector().itemSelector).toArray().forEach(((e2) => {
        let t2 = $(e2);
        const n2 = t2.find(".box").attr("title") || t2.find(".video-title").attr("title") || t2.find("img").attr("data-title");
        let a2;
        r && (a2 = t2.find(".video-title strong").text().trim());
        const i2 = t2.find(".video-title");
        i2.contents().each((function() {
          3 !== this.nodeType || "" === this.textContent.trim() || this.textContent.includes(a2) || (this.textContent = " " + n2 + " ");
        })), i2.removeAttr("title");
      }));
    }
    addJumpPageControl() {
      const e2 = "gemini-jump-page-control";
      if ($("#" + e2).length > 0) return;
      if (0 === $(".pagination-link.is-current").length) return;
      const t2 = utils.getUrlParam(o, "page") || 1, n2 = $('<input type="number" class="jhs-field jhs-jump-page-input">', {
        id: "jumpPageInput",
        placeholder: "页码",
        min: "1",
        value: t2 + 1
      }), a2 = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-jump-page-btn">', {
        text: "跳转"
      }), i2 = $("<li>", {
        id: e2
      }).append(n2).append(a2);
      $(".pagination-list").append(i2);
      const s2 = /* @__PURE__ */ __name(() => {
        const e3 = parseInt(n2.val(), 10);
        if (isNaN(e3) || e3 < 1) return void n2.focus();
        const t3 = new URL(window.location.href);
        t3.searchParams.set("page", e3.toString()), window.location.href = t3.toString();
      }, "s");
      a2.on("click", s2), n2.on("keypress", (function(e3) {
        13 === e3.which && (s2(), e3.preventDefault());
      }));
    }
  };
  __name(_ListPagePlugin, "ListPagePlugin");
  var ListPagePlugin = _ListPagePlugin;
  var _AutoPagePlugin = class _AutoPagePlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "preloadDistance", 500), i(this, "currentPage", this.getInitialPageNumber()), i(this, "pageItems", []);
    }
    getName() {
      return "AutoPagePlugin";
    }
    async initCss() {
      return "\n            <style>\n                .jhs-scroll {\n                    text-align: center;\n                    padding-top: 20px;\n                    font-size: 14px;\n                }\n                .jhs-scroll.waterfall-loading { color: var(--jhs-text); }\n                .jhs-scroll.waterfall-error { color: var(--jhs-status-filter); cursor: pointer; }\n                .jhs-scroll.waterfall-no-more { color: var(--jhs-status-down); }\n            </style>\n        ";
    }
    async handle() {
      await this.waterfall();
    }
    getInitialPageNumber() {
      if (l) {
        const e2 = o.match(/\/(page|star\/[^/]+)\/(\d+)/);
        return e2 ? parseInt(e2[2], 10) : 1;
      }
      if (r) {
        const e2 = o.match(/[?&]page=(\d+)/);
        return e2 ? parseInt(e2[1], 10) : 1;
      }
      return 1;
    }
    async waterfall() {
      if (await this.shouldDisablePaging()) return;
      const e2 = this.getSelector();
      if (this.container = document.querySelector(e2.boxSelector), !this.container) return void clog.error("没有找到容器节点,停止瀑布流!");
      this.loader = document.createElement("div"), this.loader.className = "jhs-scroll", this.container.parentNode.insertBefore(this.loader, this.container.nextSibling), this.pageItems.push({
        page: this.currentPage,
        top: 0,
        url: window.location.href
      }), this.loader.addEventListener("click", (() => {
        this.loader.classList.contains("waterfall-error") && void this.loadNextPage().catch(((error) => clog.error("瀑布流重试失败", error)));
      })), (() => {
        let t3 = false;
        window.addEventListener("scroll", (() => {
          t3 || (t3 = true, requestAnimationFrame((() => {
            this.checkLoad(), this.checkScrollPosition(), t3 = false;
          })));
        }));
      })();
      const t2 = document.querySelector(e2.nextPageSelector);
      this.nextUrl = null == t2 ? void 0 : t2.href, this.hasMore = !!this.nextUrl, setTimeout((() => {
        this.checkLoad();
      }), 1e3), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
    }
    async loadNextPage() {
      var e2;
      if (await storageManager.getSetting("autoPage", _) === C) return void this.setState("waterfall-loading", "");
      if (this.isLoading || !this.nextUrl) return;
      this.isLoading = true, this.setState("waterfall-loading", "加载中...");
      const t2 = this.getSelector();
      try {
        const i2 = await gmHttp.get(this.nextUrl);
        clog.log("请求下一页内容:", this.nextUrl);
        const s2 = utils.htmlTo$dom(i2);
        l && s2.find(".avatar-box").length > 0 && s2.find(".avatar-box").parent().remove();
        let c2 = s2.find(this.getSelector().requestDomItemSelector);
        const d2 = this.getBoxCarInfoList(), h2 = this.getBoxCarInfoList(c2);
        if (this.checkDuplicateCarNumbers(d2, h2)) return this.nextUrl = null, this.hasMore = false, void this.setState("waterfall-error", "翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流");
        const g2 = this.container.scrollHeight;
        this.pageItems.push({
          page: this.currentPage + 1,
          top: g2,
          url: this.nextUrl
        });
        const p2 = this.getBean("ListPagePlugin");
        let m2 = s2.find(this.getSelector().coverImgSelector);
        p2.replaceHdImg(m2), $(this.getSelector().boxSelector).append(c2), this.nextUrl = null == (e2 = s2.find(t2.nextPageSelector)) ? void 0 : e2.attr("href"), this.hasMore = !!this.nextUrl;
        let u2 = s2.find(".pagination");
        $(".pagination").replaceWith(u2), this.setState("waterfall-loading", ""), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
      } catch (n2) {
        clog.error("加载失败:", n2), this.setState("waterfall-error", "加载失败，点击重试");
      } finally {
        this.isLoading = false;
      }
    }
    checkScrollPosition() {
      const e2 = window.scrollY;
      for (let t2 = this.pageItems.length - 1; t2 >= 0; t2--) {
        const n2 = this.pageItems[t2];
        if (e2 >= n2.top) {
          this.currentPage !== n2.page && (this.currentPage = n2.page, this.updatePageUrl(n2.url));
          break;
        }
      }
    }
    checkLoad() {
      if (!this.loader) return;
      this.loader.getBoundingClientRect().top < window.innerHeight + this.preloadDistance && void this.loadNextPage().catch(((error) => clog.error("瀑布流自动加载失败", error)));
    }
    async shouldDisablePaging() {
      if (!window.isListPage) return true;
      const enabled = await storageManager.getSetting("autoPage", _);
      return enabled !== _ || ["search?q", "handlePlayback=1", "handleTop=1", "/want_watch_videos", "/watched_videos", "/advanced_search?type=100"].some(((e2) => o.includes(e2)));
    }
    updatePageUrl(e2) {
      window.history.replaceState({}, "", e2), l && (document.title = document.title.replace(/第\d+頁/, `第${this.currentPage}頁`));
    }
    setState(e2, t2) {
      this.loader.className = `jhs-scroll ${e2}`, this.loader.textContent = t2;
    }
  };
  __name(_AutoPagePlugin, "AutoPagePlugin");
  var AutoPagePlugin = _AutoPagePlugin;
  var _WebDavClient = class _WebDavClient {
    constructor(e2, t2, n2) {
      this.davUrl = e2.endsWith("/") ? e2 : e2 + "/", this.username = t2, this.password = n2, this.folderName = null;
    }
    _getAuthHeaders() {
      return {
        Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        Depth: "1"
      };
    }
    _sendRequest(e2, t2, n2 = {}, a2) {
      return new Promise(((i2, s2) => {
        const o2 = this.davUrl + t2, r2 = {
          ...this._getAuthHeaders(),
          ...n2
        };
        GM_xmlhttpRequest({
          method: e2,
          url: o2,
          headers: r2,
          data: a2,
          onload: /* @__PURE__ */ __name((e3) => {
            e3.status >= 200 && e3.status < 300 ? i2(e3) : (clog.error(e3), s2(new Error(`请求失败 ${e3.status}: ${e3.statusText}`)));
          }, "onload"),
          onerror: /* @__PURE__ */ __name((e3) => {
            clog.error("请求WebDav发生错误:", e3), s2(new Error("请求WebDav失败, 请检查服务是否启动, 凭证是否正确"));
          }, "onerror")
        });
      }));
    }
    async _ensureFolder(e2) {
      try {
        await this._sendRequest("MKCOL", e2);
      } catch (t2) {
        if (!/请求失败 (405|409):/.test(t2.message)) throw t2;
      }
    }
    async backup(e2, t2, n2) {
      await this._ensureFolder(e2);
      const a2 = e2 + "/" + t2;
      await this._sendRequest("PUT", a2, {
        "Content-Type": "text/plain"
      }, n2);
    }
    async getFileList(e2) {
      var t2, n2, a2;
      const i2 = (await this._sendRequest("PROPFIND", e2, {
        "Content-Type": "application/xml"
      }, '<?xml version="1.0"?>\n                <d:propfind xmlns:d="DAV:">\n                    <d:prop>\n                        <d:displayname />\n                        <d:getcontentlength />\n                        <d:creationdate />\n                        <d:getlastmodified />\n                        <d:iscollection />\n                    </d:prop>\n                </d:propfind>\n            ')).responseText, s2 = new DOMParser().parseFromString(i2, "text/xml").getElementsByTagNameNS("DAV:", "response"), o2 = [];
      for (let r2 = 0; r2 < s2.length; r2++) {
        if (0 === r2) continue;
        let e3 = s2[r2];
        const displayNameNode = e3.getElementsByTagNameNS("DAV:", "displayname")[0];
        const href = e3.getElementsByTagNameNS("DAV:", "href")[0]?.textContent || "";
        const fallbackName = decodeURIComponent(href.replace(/\/$/, "").split("/").pop() || "");
        const i3 = displayNameNode?.textContent || fallbackName, l2 = (null == (t2 = e3.getElementsByTagNameNS("DAV:", "getcontentlength")[0]) ? void 0 : t2.textContent) || "0", c2 = (null == (n2 = e3.getElementsByTagNameNS("DAV:", "creationdate")[0]) ? void 0 : n2.textContent) || (null == (a2 = e3.getElementsByTagNameNS("DAV:", "getlastmodified")[0]) ? void 0 : a2.textContent) || "";
        "0" !== l2 && o2.push({
          fileId: i3,
          name: i3,
          size: Number(l2),
          createTime: c2
        });
      }
      return o2.reverse(), o2;
    }
    async deleteFile(e2) {
      let t2 = this.folderName + "/" + encodeURI(e2);
      await this._sendRequest("DELETE", t2, {
        "Cache-Control": "no-cache"
      });
    }
    async getBackupList(e2) {
      return this.folderName = e2, await this._ensureFolder(e2), this.getFileList(e2);
    }
    async getFileContent(e2) {
      let t2 = this.folderName + "/" + e2;
      return (await this._sendRequest("GET", t2, {
        Accept: "application/octet-stream"
      })).responseText;
    }
  };
  __name(_WebDavClient, "WebDavClient");
  var WebDavClient = _WebDavClient;
  function buildSettingCss(containerWidth, containerColumns, isJavBus, isJavDB) {
    let base;
    if (isJavBus) {
      base = `
                .container-fluid .row{
                    max-width: 1000px !important;
                    min-width: ${containerWidth}%;
                    margin: auto auto;
                }

                .container {
                    max-width: 1000px !important;
                    min-width: 80%;
                    margin: auto auto;
                }

                .masonry {
                    grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
                }
            `;
    } else {
      base = `
            section .container{
                max-width: 1000px !important;
                min-width: ${containerWidth}%;
            }
            .movie-list, .movie-list.v{
                grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
            }
        `;
    }
    return `
            <style>
                ${base}
                .nav-btn::after {
                    content:none !important;
                }

                #cache-data-display pre {
                    font-family: Consolas, Monaco, 'Andale Mono', monospace;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    line-height: 1.5;
                    color: var(--jhs-text);
                    border: 1px solid var(--jhs-border);
                }

                .cache-item {
                    transition: all 0.2s ease;
                }
                .cache-item:hover {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transform: translateY(-2px);
                }
                .cache-item { padding:var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); }
                .cache-item__title { margin-bottom:var(--jhs-space-2); color:var(--jhs-text); font-weight:700; }
                .cache-item__actions, .jhs-inline-fields { display:flex; gap:var(--jhs-space-2); }
                .cache-item__actions > * { flex:1; text-align:center; }
                .jhs-setting-label-inline { display:flex; align-items:center; gap:var(--jhs-space-1); }
                .jhs-setting-toggle-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-2); }
                .jhs-setting-toggle-grid label { display:flex; align-items:center; gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-cache-preview { max-height:400px; padding:var(--jhs-space-3); overflow:auto; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }

                .keyword-label {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 8px;
                    border-radius: var(--jhs-radius-sm);
                    font-size: 14px;
                    position: relative;
                    margin-left: 8px;
                    margin-bottom: 5px;
                }
                .keyword-remove {
                    margin-left: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    line-height: 1;
                }
                .keyword-input {
                    padding: 6px 12px;
                    border: 1px solid var(--jhs-border);
                    border-radius: var(--jhs-radius-sm);
                    font-size: 14px;
                    float:right;
                }
                .add-tag-btn {
                    padding: 6px 12px;
                    background-color: var(--jhs-surface-2);
                    color: var(--jhs-text);
                    border: none;
                    border-radius: var(--jhs-radius-sm);
                    cursor: pointer;
                    font-size: 14px;
                    margin-left: 8px;
                    float:right;
                }
                .add-tag-btn:hover {
                    background-color: var(--jhs-border-strong);
                }
                .tag-box {
                    margin-top:15px;
                }


                .simple-setting, .mini-simple-setting {
                    display: none;
                    background: var(--jhs-surface);
                    position: absolute;
                    top: ${isJavDB ? "35px" : "25px"};
                    right: 0;
                    z-index: var(--jhs-z-dropdown);
                    border: 1px solid var(--jhs-border);
                    border-radius: var(--jhs-radius-sm);
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    padding: 0;
                    margin-top: 5px;
                    color: var(--jhs-text);
                    width: min(360px, calc(100vw - 16px));
                    max-height: min(720px, calc(100vh - 16px));
                }
                .simple-setting__panel { display:flex; max-height:inherit; flex-direction:column; }
                .jhs-quick-setting { color:var(--jhs-text); background:var(--jhs-surface); }
                .jhs-quick-setting .simple-setting__panel { max-height:min(720px, calc(100vh - 96px)); }
                .jhs-quick-setting-backdrop { position:fixed; inset:0; z-index:var(--jhs-z-sheet-backdrop); background:rgba(0,0,0,.45); backdrop-filter:blur(2px); }
                .jhs-quick-setting-sheet { position:fixed; right:0; bottom:0; left:0; z-index:var(--jhs-z-sheet); max-height:calc(100dvh - 16px); border:1px solid var(--jhs-border); border-bottom:0; border-radius:var(--jhs-radius-lg) var(--jhs-radius-lg) 0 0; background:var(--jhs-surface); box-shadow:var(--jhs-shadow-lg); overflow:hidden; }
                .jhs-quick-setting__header { display:flex; min-height:52px; align-items:center; justify-content:space-between; padding:0 var(--jhs-space-3) 0 var(--jhs-space-4); border-bottom:1px solid var(--jhs-border); }
                .jhs-quick-setting__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); }
                .jhs-quick-setting__close { min-width:40px; padding:0; font-size:24px; }
                .simple-setting__scroll { min-height:0; padding:var(--jhs-space-2) var(--jhs-space-3); overflow-y:auto; }
                .simple-setting__footer { display:flex; justify-content:flex-end; gap:var(--jhs-space-2); padding:var(--jhs-space-3); border-top:1px solid var(--jhs-border); }
                .simple-setting__list { display:grid; }
                .simple-setting .jhs-setting-row, .mini-simple-setting .jhs-setting-row, .jhs-quick-setting .jhs-setting-row { grid-template-columns:minmax(0,1fr) auto; gap:var(--jhs-space-3); min-height:48px; padding:var(--jhs-space-2) 0; border-bottom:1px solid var(--jhs-border); }
                .simple-setting .jhs-setting-row:last-child, .mini-simple-setting .jhs-setting-row:last-child, .jhs-quick-setting .jhs-setting-row:last-child { border-bottom:0; }
                .simple-setting .jhs-setting-row__control, .mini-simple-setting .jhs-setting-row__control, .jhs-quick-setting .jhs-setting-row__control { width:auto; justify-self:end; }
                .simple-setting .jhs-setting-row__description, .mini-simple-setting .jhs-setting-row__description, .jhs-quick-setting .jhs-setting-row__description { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .jhs-setting-nav-item { position:relative; }
                .jhs-nav-button { padding-right:15px !important; }
                .jhs-mini-setting-box { position:relative; margin-left:auto; }
                .jhs-mini-setting-trigger { padding-left:0 !important; padding-right:0 !important; }
                .jhs-setting-anchor { position:relative; display:flex; flex-grow:1; justify-content:flex-end; z-index:var(--jhs-z-host-nav) !important; }
                .jhs-setting-detail-anchor { margin-top:var(--jhs-space-5); }
                .jhs-more-tools-panel { display:none; }
                .jhs-backup-cards { padding:0 var(--jhs-space-1); }
                .jhs-table-dialog { height:100%; overflow:hidden; }
                .jhs-table-dialog__content { margin:auto !important; }
                .jhs-help-title { margin:0 0 var(--jhs-space-5); padding-bottom:var(--jhs-space-3); border-bottom:1px solid var(--jhs-border); color:var(--jhs-accent); font-size:22px; }
                .jhs-list-btn-row { display:flex; align-items:center; gap:var(--jhs-space-2); margin:var(--jhs-space-2) 0; }

                .jhs-setting-layout {
                    display: grid;
                    grid-template-columns: 180px minmax(0, 1fr);
                    height: 100%;
                    min-height: 0;
                    background: var(--jhs-surface);
                }

                .jhs-mobile-sidebar {
                    display: flex;
                    min-width: 0;
                    flex-direction: column;
                    gap: 2px;
                    padding: var(--jhs-space-3) var(--jhs-space-2);
                    border-right: 1px solid var(--jhs-border);
                    background: var(--jhs-surface-2);
                    overflow-y: auto;
                }

                .side-menu-item {
                    width: 100%;
                    min-height: 36px;
                    padding: 0 var(--jhs-space-3);
                    border: 0;
                    border-radius: var(--jhs-radius-sm);
                    background: transparent;
                    cursor: pointer;
                    color: var(--jhs-text);
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font: inherit;
                    font-size: var(--jhs-font-size-sm);
                    text-align: left;
                    transition: background-color var(--jhs-motion-fast) var(--jhs-ease), color var(--jhs-motion-fast) var(--jhs-ease);
                }

                .side-menu-item .icon {
                     height: 24px;
                     width: 24px;
                }

                .side-menu-item:hover {
                    background-color: var(--jhs-surface);
                }

                .side-menu-item.active {
                    background-color: var(--jhs-accent-tint);
                    color: var(--jhs-accent);
                    font-weight: 700;
                }

                .jhs-setting-main {
                    display: flex;
                    min-width: 0;
                    min-height: 0;
                    flex-direction: column;
                    height: 100%;
                }

                .jhs-setting-body {
                    flex: 1;
                    min-height: 0;
                    padding: 0 var(--jhs-space-4);
                    overflow: hidden;
                }

                .jhs-setting-body-inner {
                    width: min(100%, 880px);
                    height: 100%;
                    margin-inline: auto;
                }

                .content-panel {
                    display: none;
                    box-sizing: border-box;
                    margin: 0;
                    padding: var(--jhs-space-4) 0;
                    height: 100%;
                    overflow-x: hidden;
                    overflow-y: auto;
                }

                .content-panel.active {
                    display: block;
                }

                .jhs-setting-section + .jhs-setting-section {
                    margin-top: var(--jhs-space-5);
                }
                .jhs-setting-section > .jhs-setting-group { overflow:visible; border:0; border-radius:0; }

                .jhs-setting-section__header {
                    margin-bottom: var(--jhs-space-2);
                }

                .jhs-setting-section__header h3 {
                    margin: 0;
                    color: var(--jhs-text);
                    font-size: var(--jhs-font-size-lg);
                }

                .jhs-setting-section__header p {
                    margin: var(--jhs-space-1) 0 0;
                    color: var(--jhs-text-muted);
                    font-size: var(--jhs-font-size-sm);
                }

                .jhs-setting-row__copy {
                    min-width: 0;
                }

                .jhs-setting-row__description {
                    display: block;
                    margin-top: var(--jhs-space-1);
                    color: var(--jhs-text-muted);
                    font-size: var(--jhs-font-size-sm);
                    font-weight: 400;
                    line-height: 1.45;
                }

                .jhs-setting-row__control {
                    width: min(100%, 360px);
                    justify-self: end;
                }
                .keyword-label { background:var(--jhs-surface-2); color:var(--jhs-text); }
                .keyword-label--link { color:var(--jhs-accent); }

                .jhs-setting-output {
                    max-height: 360px;
                    padding: var(--jhs-space-3);
                    overflow: auto;
                    border: 0;
                    border-radius: var(--jhs-radius-sm);
                    background: var(--jhs-surface-2);
                }
                .jhs-setting-output:empty { display:none; }
                .jhs-setting-output--compact { max-height:250px; }
                .jhs-setting-help { margin: 0 0 var(--jhs-space-3); color: var(--jhs-text-muted); font-size: var(--jhs-font-size-sm); }
                .jhs-setting-subheading { margin:var(--jhs-space-5) 0 var(--jhs-space-2); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
                .jhs-setting-rows { border:0; padding:0; }
                .jhs-setting-subtitle { margin:0; padding:var(--jhs-space-2) var(--jhs-space-4); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-setting-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin-bottom:var(--jhs-space-3); }
                .jhs-setting-metric { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-2) var(--jhs-space-3); border-right:1px solid var(--jhs-border); text-align:center; }
                .jhs-setting-metric:last-child { border-right:0; }
                .jhs-setting-metric strong { color: var(--jhs-text); font-size: var(--jhs-font-size-xl); }
                .jhs-setting-metric span { color: var(--jhs-text-muted); font-size: var(--jhs-font-size-xs); }
                .jhs-plugin-group { margin-bottom:var(--jhs-space-4); }
                .jhs-plugin-group__title { margin:0; padding:var(--jhs-space-2) 0; border-bottom:1px solid var(--jhs-border); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-plugin-row { display:flex; min-height:48px; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); padding:var(--jhs-space-2) 0; border-bottom:1px solid var(--jhs-border); }
                .jhs-plugin-row:last-child { border-bottom:0; }
                .jhs-plugin-copy { display:grid; min-width:0; gap:2px; }
                .jhs-plugin-copy strong { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-data-table { width:100%; border-collapse:collapse; color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-data-table th { padding:var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); text-align:left; }
                .jhs-data-table td { padding:var(--jhs-space-1) var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); }
                .jhs-data-table .is-center { text-align:center; }
                .jhs-data-table .is-right { text-align:right; }
                .jhs-data-table .is-danger { color:var(--jhs-danger); }
                .jhs-data-table .is-warning { color:var(--jhs-warning); }
                .jhs-data-table .is-success { color:var(--jhs-status-down); }
                .jhs-data-table .is-muted { color:var(--jhs-text-faint); }
                .jhs-data-table .is-slow { color:var(--jhs-danger); font-weight:700; }
                .jhs-diagnostics { margin-top:var(--jhs-space-5); border-top:1px solid var(--jhs-border); }
                .jhs-diagnostics > summary { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; padding:var(--jhs-space-3) 0; color:var(--jhs-text); font-size:var(--jhs-font-size-md); font-weight:600; cursor:pointer; }
                .jhs-diagnostics > summary::after { color:var(--jhs-text-muted); content:"展开"; font-size:var(--jhs-font-size-sm); font-weight:400; }
                .jhs-diagnostics[open] > summary::after { content:"收起"; }
                .jhs-diagnostics__content { padding-bottom:var(--jhs-space-3); }
                .jhs-empty-note { padding:var(--jhs-space-5); color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); text-align:center; }
                .jhs-caption { margin:var(--jhs-space-2) 0 0; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                .jhs-inline-metrics { display:flex; flex-wrap:wrap; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-2); font-size:var(--jhs-font-size-sm); }
                .jhs-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-3); }
                .jhs-summary-card { padding:var(--jhs-space-3); border-radius:var(--jhs-radius-md); background:var(--jhs-surface-2); text-align:center; }
                .jhs-summary-card strong { display:block; font-size:var(--jhs-font-size-xl); }
                .jhs-summary-card--success { background:var(--jhs-status-down-tint); color:var(--jhs-status-down); }
                .jhs-summary-card--danger { background:var(--jhs-status-filter-tint); color:var(--jhs-status-filter); }
                .jhs-summary-card--warning { background:var(--jhs-status-watch-tint); color:var(--jhs-status-watch); }
                .jhs-scroll-frame { max-height:350px; overflow:auto; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); }
                .jhs-dialog-content { padding:var(--jhs-space-4); }
                .jhs-warning-note { margin-top:var(--jhs-space-3); color:var(--jhs-status-filter); font-size:var(--jhs-font-size-xs); }
                .jhs-health-summary { margin-bottom:var(--jhs-space-2); }
                .jhs-health-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-3); }
                .jhs-health-columns h4 { margin:0 0 var(--jhs-space-1); }

                .jhs-setting-footer {
                    display: flex;
                    flex-shrink: 0;
                    justify-content: flex-end;
                    gap: var(--jhs-space-2);
                    padding: var(--jhs-space-3) var(--jhs-space-4);
                    border-top: 1px solid var(--jhs-border);
                    background: var(--jhs-surface);
                }

                .jhs-cache-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: var(--jhs-space-3);
                    margin-top: var(--jhs-space-4);
                }

                .jhs-resource-card-list { display:grid; gap:var(--jhs-space-3); min-width:0; }
                .jhs-resource-card { min-width:0; overflow:hidden; }
                .jhs-resource-card .jhs-setting-row { align-items:flex-start; }
                .jhs-resource-card small { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); overflow-wrap:anywhere; }
                .jhs-resource-card .jhs-badge { margin-left:var(--jhs-space-2); }
                .jhs-resource-form, .jhs-resource-form label, .jhs-parser-fields { display:grid; gap:var(--jhs-space-2); min-width:0; }
                .jhs-resource-form { padding:var(--jhs-space-4); max-height:70vh; overflow-y:auto; overflow-x:hidden; }
                .jhs-resource-advanced > summary { cursor:pointer; font-weight:600; }
                #advanced-resource-json { width:100%; box-sizing:border-box; margin-top:var(--jhs-space-3); }

                @media (max-width: 768px) {
                    .jhs-setting-layout {
                        grid-template-columns: minmax(0, 1fr);
                        grid-template-rows: auto minmax(0, 1fr);
                    }
                    .jhs-mobile-sidebar {
                        flex-direction: row;
                        padding: var(--jhs-space-2);
                        border-right: 0;
                        border-bottom: 1px solid var(--jhs-border);
                        overflow-x: auto;
                        overflow-y: hidden;
                    }
                    .side-menu-item {
                        width: auto;
                        min-width: max-content;
                        min-height: var(--jhs-touch-target);
                    }
                    .jhs-setting-body {
                        padding-inline: var(--jhs-space-3);
                    }
                    .jhs-cache-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .jhs-summary-grid, .jhs-health-columns { grid-template-columns:minmax(0,1fr); }
                    .jhs-resource-card .jhs-setting-row { align-items:stretch; }
                    .jhs-resource-card .jhs-toolbar { flex-wrap:wrap; }
                }

                input[type="checkbox"]:disabled {
                    opacity: 0.6;
                    cursor: default !important;
                }
            </style>
        `;
  }
  __name(buildSettingCss, "buildSettingCss");
  async function applyImageMode() {
    $("#verticalImgStyle").remove();
    if (await storageManager.getSetting("enableVerticalModel", C) === _) {
      let e2 = "100% 50% !important";
      window.location.href.includes("/advanced_search?type=100") && (e2 = "50% 50% !important");
      const t2 = `
                .cover {
                    min-height: 350px !important;
                    overflow: hidden !important;
                    padding-top: 142% !important;
                }

                .cover img {
                    object-fit: cover !important;
                    object-position: ${e2};
                }

                /* bus的 */
                .masonry .movie-box img {
                    min-height: 500px !important;
                    object-fit: cover !important;
                    object-position: top right;
                }
            `;
      $("<style>").attr("id", "verticalImgStyle").text(t2).appendTo("head");
    } else {
      const e2 = `
                .cover {
                    min-height:auto !important;
                    padding-top: 67% !important;
                }
                .cover img {
                    object-fit: contain !important;
                    object-position: 50% 50% !important
                }

                /* bus的 */
                 .masonry .movie-box img {
                    min-height:auto !important;
                    object-fit: contain !important;
                    object-position: top;
                }
            `;
      $("<style>").attr("id", "verticalImgStyle").text(e2).appendTo("head");
    }
    l && window.getBeanForSetting("BusImgPlugin").logImageHeightsByRow();
  }
  __name(applyImageMode, "applyImageMode");
  var BUILT_IN_MAGNET_SOURCES = Object.freeze([
    { id: "native-javdb", name: "JavDB 本站", type: "本站资源", domain: "javdb.com", priority: 10, enabled: true },
    { id: "native-javbus", name: "JavBus 本站", type: "本站资源", domain: "javbus.com", priority: 11, enabled: true },
    { id: "u9a9", name: "U9A9", type: "网页来源", domain: "u9a9.com", baseUrl: "https://u9a9.com", priority: 20, enabled: true },
    { id: "u3c3", name: "U3C3", type: "网页来源", domain: "u3c3.com", baseUrl: "https://u3c3.com", priority: 30, enabled: true },
    { id: "sukebei", name: "Sukebei", type: "网页来源", domain: "sukebei.nyaa.si", baseUrl: "https://sukebei.nyaa.si", priority: 40, enabled: true },
    { id: "btsow", name: "BTSOW", type: "API 来源", domain: "btsow.lol", baseUrl: "https://btsow.lol", priority: 50, enabled: true }
  ]);
  var BUILT_IN_SCREENSHOT_SOURCES = Object.freeze([
    { id: "javstore", name: "JavStore", domain: "javstore.net", priority: 10, enabled: true },
    { id: "projectjav", name: "ProjectJav", domain: "projectjav.com", priority: 20, enabled: false, implemented: false },
    { id: "18av", name: "18AV", domain: "18av.mm-cg.com", priority: 30, enabled: false, implemented: false }
  ]);
  function validateRule(rule) {
    if (!rule.name?.trim() || !rule.pattern?.trim()) throw new TypeError("规则名称和匹配内容不能为空");
    if ("regex" === rule.type) try {
      new RegExp(rule.pattern);
    } catch {
      throw new TypeError("正则表达式无效");
    }
    return { ...rule, name: rule.name.trim(), pattern: rule.pattern.trim() };
  }
  __name(validateRule, "validateRule");
  function buildCustomMagnetSource(form, existing = null) {
    const parserType = form.parserType || "magnet-links";
    const config = { id: existing?.id || `source-${Date.now()}`, name: String(form.name || "").trim(), enabled: Boolean(form.enabled), priority: Number(form.priority) || 100, searchUrlTemplate: String(form.searchUrlTemplate || "").trim(), targetUrlTemplate: String(form.targetUrlTemplate || form.searchUrlTemplate || "").trim(), parserType };
    if (!config.name) throw new TypeError("来源名称不能为空");
    if ("torrent-table" === parserType) Object.assign(config, { rowSelector: form.rowSelector, titleSelector: form.titleSelector, magnetSelector: form.magnetSelector, sizeSelector: form.sizeSelector, dateSelector: form.dateSelector, seedersSelector: form.seedersSelector, leechersSelector: form.leechersSelector });
    if ("json" === parserType) Object.assign(config, { resultsPath: form.resultsPath, titlePath: form.titlePath, magnetPath: form.magnetPath, hashPath: form.hashPath, sizePath: form.sizePath, datePath: form.datePath, seedersPath: form.seedersPath });
    return validateCustomMagnetSource(config);
  }
  __name(buildCustomMagnetSource, "buildCustomMagnetSource");
  var _ResourceSettingsService = class _ResourceSettingsService {
    constructor(storage = storageManager) {
      this.storage = storage;
    }
    async getArray(key) {
      const value = await this.storage.getSetting(key, "[]");
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    async saveArray(key, value) {
      if (!Array.isArray(value)) throw new TypeError("配置必须是数组");
      await this.storage.saveSettingItem(key, JSON.stringify(value));
      return value;
    }
    getMagnetSources() {
      return this.getArray("customMagnetSources");
    }
    saveMagnetSources(value) {
      value.forEach(validateCustomMagnetSource);
      return this.saveArray("customMagnetSources", value);
    }
    getMagnetTagRules() {
      return this.getArray("magnetTagRules");
    }
    saveMagnetTagRules(value) {
      value.forEach(validateRule);
      return this.saveArray("magnetTagRules", value);
    }
    getMagnetFilterRules() {
      return this.getArray("magnetFilterRules");
    }
    saveMagnetFilterRules(value) {
      value.forEach(validateRule);
      return this.saveArray("magnetFilterRules", value);
    }
    async getBuiltInSources() {
      return await this.getArray("magnetBuiltInSources");
    }
    saveBuiltInSources(value) {
      value.forEach(((source) => {
        if (!MAGNET_SOURCE_IDS.includes(source.id)) throw new TypeError("未知的内置磁力源");
        if (source.baseUrl) validateHttpsBaseUrl(source.baseUrl);
        if (source.priority != null && (!Number.isFinite(Number(source.priority)) || Number(source.priority) < 1)) throw new TypeError("来源优先级无效");
      }));
      return this.saveArray("magnetBuiltInSources", value);
    }
    async getScreenshotSettings() {
      return { mode: await this.storage.getSetting("screenshotMode", "auto"), providers: await this.getArray("screenshotProviders") };
    }
    async saveScreenshotSettings(value) {
      await this.storage.saveSettingItem("screenshotMode", value.mode);
      await this.saveArray("screenshotProviders", value.providers);
    }
    async getCloudSettings() {
      return { enable123Offline: Boolean(await this.storage.getSetting("enable123Offline", true)), enable115Offline: Boolean(await this.storage.getSetting("enable115Offline", false)), enable115Match: Boolean(await this.storage.getSetting("enable115Match", false)), enable115LoginRedirect: Boolean(await this.storage.getSetting("enable115LoginRedirect", false)), providerMode: await this.storage.getSetting("offlineProviderMode", "ask"), concurrency: Number(await this.storage.getSetting("oneOneFiveConcurrency", 4)), cacheMinutes: Number(await this.storage.getSetting("oneOneFiveCacheMinutes", 60)) };
    }
    async saveCloudSettings(value) {
      for (const [key, item] of Object.entries({ enable123Offline: value.enable123Offline, enable115Offline: value.enable115Offline, enable115Match: value.enable115Match, enable115LoginRedirect: value.enable115LoginRedirect, offlineProviderMode: value.providerMode || "ask", oneOneFiveConcurrency: value.concurrency, oneOneFiveCacheMinutes: value.cacheMinutes })) await this.storage.saveSettingItem(key, item);
    }
    async exportConfig() {
      return { customMagnetSources: await this.getMagnetSources(), magnetTagRules: await this.getMagnetTagRules(), magnetFilterRules: await this.getMagnetFilterRules(), magnetBuiltInSources: await this.getBuiltInSources(), screenshot: await this.getScreenshotSettings() };
    }
    async importConfig(text) {
      let value;
      try {
        value = JSON.parse(text);
      } catch (error) {
        throw new TypeError(`配置格式错误：${error.message}`);
      }
      if (!value || "object" !== typeof value || Array.isArray(value)) throw new TypeError("配置格式错误：根节点必须是对象");
      const operations = [];
      if (Object.hasOwn(value, "customMagnetSources")) {
        if (!Array.isArray(value.customMagnetSources)) throw new TypeError("自定义磁力源必须是数组");
        value.customMagnetSources.forEach(validateCustomMagnetSource);
        operations.push(() => this.saveMagnetSources(value.customMagnetSources));
      }
      if (Object.hasOwn(value, "magnetTagRules")) {
        if (!Array.isArray(value.magnetTagRules)) throw new TypeError("标签规则必须是数组");
        value.magnetTagRules.forEach(validateRule);
        operations.push(() => this.saveMagnetTagRules(value.magnetTagRules));
      }
      if (Object.hasOwn(value, "magnetFilterRules")) {
        if (!Array.isArray(value.magnetFilterRules)) throw new TypeError("过滤规则必须是数组");
        value.magnetFilterRules.forEach(validateRule);
        operations.push(() => this.saveMagnetFilterRules(value.magnetFilterRules));
      }
      if (Object.hasOwn(value, "magnetBuiltInSources")) {
        if (!Array.isArray(value.magnetBuiltInSources)) throw new TypeError("内置磁力源配置必须是数组");
        operations.push(() => this.saveBuiltInSources(value.magnetBuiltInSources));
      }
      if (Object.hasOwn(value, "screenshot")) {
        if (!value.screenshot || !["auto", "manual"].includes(value.screenshot.mode) || !Array.isArray(value.screenshot.providers)) throw new TypeError("截图配置无效");
        operations.push(() => this.saveScreenshotSettings(value.screenshot));
      }
      for (const operation of operations) await operation();
      return value;
    }
  };
  __name(_ResourceSettingsService, "ResourceSettingsService");
  var ResourceSettingsService = _ResourceSettingsService;
  function getPluginCategories() {
    const pluginMeta = {
      SettingPlugin: ["设置中心", "core"],
      StatsPlugin: ["统计中心", "core"],
      MobileBottomBarPlugin: ["工具栏与移动操作", "core"],
      ListPagePlugin: ["列表状态处理", "list"],
      NavBarPlugin: ["JavDB 导航", "list"],
      BusNavBarPlugin: ["JavBus 导航", "list"],
      ListPageButtonPlugin: ["列表操作", "list"],
      HighlightMagnetPlugin: ["磁力标记", "list"],
      FoldCategoryPlugin: ["分类折叠", "list"],
      AutoPagePlugin: ["自动翻页", "list"],
      HitShowPlugin: ["热播榜单", "list"],
      TOP250Plugin: ["TOP 250", "list"],
      DetailPagePlugin: ["JavDB 详情页", "detail"],
      BusDetailPagePlugin: ["JavBus 详情页", "detail"],
      DetailPageButtonPlugin: ["详情操作", "detail"],
      ReviewPlugin: ["评论", "detail"],
      RelatedPlugin: ["相关影片", "detail"],
      TranslatePlugin: ["标题翻译", "detail"],
      WantAndWatchedVideosPlugin: ["想看与看过", "detail"],
      CoverButtonPlugin: ["封面快捷操作", "media"],
      PreviewVideoPlugin: ["JavDB 预览视频", "media"],
      BusPreviewVideoPlugin: ["JavBus 预览视频", "media"],
      ScreenShotPlugin: ["剧照", "media"],
      BusImgPlugin: ["JavBus 图片适配", "media"],
      ActressInfoPlugin: ["演员资料", "media"],
      SearchByImagePlugin: ["以图搜图", "media"],
      HistoryPlugin: ["鉴定记录", "data"],
      BlacklistPlugin: ["黑名单", "data"],
      FilterTitleKeywordPlugin: ["关键词筛选", "data"],
      FavoriteActressesPlugin: ["演员收藏", "data"],
      NewVideoPlugin: ["新作品检测", "data"],
      TaskPlugin: ["定时任务", "data"],
      OtherSitePlugin: ["外部站点", "network"],
      Fc2Plugin: ["FC2 详情", "network"],
      Fc2By123AvPlugin: ["FC2 123AV", "network"],
      MagnetHubPlugin: ["磁力聚合", "network"],
      JavTrailersPlugin: ["预告片", "network"],
      SubTitleCatPlugin: ["字幕搜索", "network"],
      OneTwoThreeOfflinePlugin: ["123 云盘离线", "network"]
    };
    const group = /* @__PURE__ */ __name((key, label) => ({ label, plugins: Object.entries(pluginMeta).filter(((e2) => e2[1][1] === key)).map(((e2) => e2[0])) }), "group");
    return {
      categories: {
        core: group("core", "基础核心"),
        list: group("list", "列表页"),
        detail: group("detail", "详情页"),
        media: group("media", "媒体"),
        data: group("data", "数据"),
        network: group("network", "网络")
      },
      corePlugins: ["SettingPlugin", "StatsPlugin", "MobileBottomBarPlugin"],
      pluginMeta
    };
  }
  __name(getPluginCategories, "getPluginCategories");
  function buildCacheItemsHtml(cacheItems) {
    return cacheItems.map((e2) => `
            <div class="cache-item">
                <div class="cache-item__title">${e2.text}</div>
                <div class="cache-item__actions">
                    <button type="button" class="jhs-btn jhs-btn--secondary clean-btn" data-key="${e2.key}" title="${e2.title}">
                        <span>清理</span>
                    </button>
                    <button type="button" class="jhs-btn jhs-btn--secondary view-btn" data-key="${e2.key}" >
                        <span>查看</span>
                    </button>
                </div>
            </div>
        `).join("");
  }
  __name(buildCacheItemsHtml, "buildCacheItemsHtml");
  function buildVideoQualityOptions() {
    let a2 = "";
    L.forEach((e2) => {
      e2.canSelect && (a2 += `<option value="${e2.quality}">${e2.text}</option>`);
    });
    return a2;
  }
  __name(buildVideoQualityOptions, "buildVideoQualityOptions");
  function buildSettingDialogHtml(activePanel, cacheItems, coverButtonPlugin) {
    const n2 = buildCacheItemsHtml(cacheItems);
    const a2 = buildVideoQualityOptions();
    return `
            <div class="jhs-setting-layout jhs-ui">
                <nav class="jhs-mobile-sidebar" aria-label="设置分类">
                    <button type="button" class="jhs-btn side-menu-item ${"backup-panel" === activePanel ? "active" : ""}" data-panel="backup-panel" aria-controls="backup-panel">数据备份</button>
                    <button type="button" class="jhs-btn side-menu-item ${"base-panel" === activePanel ? "active" : ""}" data-panel="base-panel" aria-controls="base-panel">基础配置</button>
                    <button type="button" class="jhs-btn side-menu-item ${"filter-panel" === activePanel ? "active" : ""}" data-panel="filter-panel" aria-controls="filter-panel">屏蔽配置</button>
                    <button type="button" class="jhs-btn side-menu-item ${"task-panel" === activePanel ? "active" : ""}" data-panel="task-panel" aria-controls="task-panel">定时任务</button>
                    <button type="button" class="jhs-btn side-menu-item ${"domain-panel" === activePanel ? "active" : ""}" data-panel="domain-panel" aria-controls="domain-panel" title="第三方视频资源域名配置">外部网站</button>

                    <button type="button" class="jhs-btn side-menu-item ${"cache-panel" === activePanel ? "active" : ""}" data-panel="cache-panel" aria-controls="cache-panel">清理缓存</button>
                </nav>

                <div class="jhs-setting-main">
                    <div class="jhs-setting-body">


                        <div id="backup-panel" class="content-panel ${"backup-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>数据备份</h3><p>导入、导出和远程备份 JHS 数据。</p></header><div class="jhs-setting-group">
                            <div class="jhs-toolbar">
                                <button type="button" id="importBtn" class="jhs-btn jhs-btn--secondary"><span>导入数据</span></button>
                                <button type="button" id="exportBtn" class="jhs-btn jhs-btn--primary"><span>导出数据</span></button>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">WebDav备份</span>
                                <div>
                                    <button type="button" id="webdavBackupListBtn" class="jhs-btn jhs-btn--secondary"><span>查看备份</span></button>
                                    <button type="button" id="webdavBackupBtn" class="jhs-btn jhs-btn--primary"><span>备份数据</span></button>
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">服务地址:</span>
                                <div class="form-content">
                                    <input type="url" id="webDavUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">用户名:</span>
                                <div class="form-content">
                                    <input type="text" id="webDavUsername" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">密码:</span>
                                <div class="form-content">
                                    <input type="password" id="webDavPassword" class="jhs-field">
                                </div>
                            </div>
                        </div></section>
                        </div>


                        <div id="base-panel" class="content-panel ${"base-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>基础配置</h3><p>配置列表显示、媒体加载、网络和主题。</p></header><div class="jhs-setting-group">
                            <div class="jhs-setting-row">
                                <span class="setting-label">每次开始鉴定数量:</span>
                                <div class="form-content">
                                    <input type="number" id="waitCheckCount" class="jhs-field" min="1" max="20">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">已鉴定标签展示位置:</span>
                                <div class="form-content">
                                    <select id="tagPosition" class="jhs-select-source">
                                        <option value="rightTop">右上</option>
                                        <option value="leftTop">左上</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">默认显示选项卡:</span>
                                <div class="form-content">
                                    <select id="defaultQuickFilterTab" class="jhs-select-source">
                                        <option value="all">全部</option>
                                        <option value="waitCheck">待鉴定</option>
                                        <option value="favorite">收藏</option>
                                        <option value="hasDown">下载</option>
                                        <option value="hasWatch">已看</option>
                                        <option value="blockedItems">屏蔽项</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">鉴定后自动关闭详情页</span>
                                <div class="form-content">
                                    <input type="checkbox" id="needClosePageBasic" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">浏览后自动移除新作品标记</span>
                                <div class="form-content">
                                    <input type="checkbox" id="autoRemoveNewVideoMarkAfterBrowse" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    鉴定补录演员信息
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    封面快捷按钮
                                </span>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.screenSvg}长缩略图:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableScreenSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.videoSvg}预览视频:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableVideoSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.handleSvg}鉴定按钮:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableHandleSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.siteSvg}第三方跳转:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableSiteSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.copySvg}复制按钮:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableCopySvg" class="mini-switch">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">预览视频默认画质:</span>
                                <div class="form-content">
                                    <select id="videoQuality" class="jhs-select-source">
                                        ${a2}
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">评论区条数:</span>
                                <div class="form-content">
                                    <select id="reviewCount" class="jhs-select-source">
                                        <option value="10">10条</option>
                                        <option value="20">20条</option>
                                        <option value="30">30条</option>
                                        <option value="40">40条</option>
                                        <option value="50">50条</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row ${r ? "" : "do-hide"}">
                                <span class="setting-label">
                                    高亮已收藏演员
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row ${r ? "" : "do-hide"}">
                                <span id="highlightedTagLabel" class="setting-label">
                                    分类标签|高亮演员-边框样式:
                                </span>
                                <div class="form-content">
                                    <input type="number" id="highlightedTagNumber" class="jhs-field" min="0" max="20">
                                    <input type="color" id="highlightedTagColor">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">请求超时时间(毫秒):</span>
                                <div class="form-content">
                                    <input type="number" id="httpTimeout" class="jhs-field" min="1000" max="10000">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">请求失败重试次数:</span>
                                <div class="form-content">
                                    <input type="number" id="httpRetryCount" class="jhs-field" min="0" max="10">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    启用控制台日志:
                                </span>
                                <div class="form-content">
                                    <select id="enableClog" class="jhs-select-source">
                                        <option value="no">禁用</option>
                                        <option value="yes">开启</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">日志最大行数:</span>
                                <div class="form-content">
                                    <input type="number" id="clogMsgCount" class="jhs-field" min="100" max="3000">
                                </div>
                            </div>




                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    移动端模式
                                </span>
                                <div class="form-content">
                                    <select id="mobileMode" class="jhs-select-source">
                                        <option value="auto">自动检测</option>
                                        <option value="on">强制开启</option>
                                        <option value="off">强制关闭</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    外观主题
                                </span>
                                <div class="form-content">
                                    <select id="themeMode" class="jhs-select-source">
                                        <option value="light">浅色</option>
                                        <option value="dark">深色</option>
                                        <option value="auto">跟随系统</option>
                                    </select>
                                </div>
                            </div>
                            <div class="jhs-setting-row" data-description="控制普通状态内容是否继续显示在全部视图中。">
                                <span class="setting-label">列表状态显示</span>
                                <div class="form-content jhs-setting-toggle-grid">
                                    <label><input type="checkbox" id="showFavoriteItem" class="mini-switch"><span>收藏</span></label>
                                    <label><input type="checkbox" id="showHasDownItem" class="mini-switch"><span>已下载</span></label>
                                    <label><input type="checkbox" id="showHasWatchItem" class="mini-switch"><span>已观看</span></label>
                                </div>
                            </div>
                            <div class="jhs-setting-row ${r ? "" : "do-hide"}"><span class="setting-label">加载女优信息</span><div class="form-content"><input type="checkbox" id="enableLoadActressInfo" class="mini-switch"></div></div>
                            <div class="jhs-setting-row"><span class="setting-label">竖图模式</span><div class="form-content"><input type="checkbox" id="enableVerticalModel" class="mini-switch"></div></div>
                            <div class="jhs-setting-row"><span class="setting-label">页面列数：<span id="showContainerColumns"></span></span><div class="form-content"><input type="range" class="jhs-range" id="containerColumns" min="2" max="10" step="1"></div></div>
                            <div class="jhs-setting-row"><span class="setting-label">页面宽度：<span id="showContainerWidth"></span></span><div class="form-content"><input type="range" class="jhs-range" id="containerWidth" min="0" max="30" step="1"></div></div>
                        </div></section>
                        </div>

                        <div id="task-panel" class="content-panel ${"task-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>定时任务</h3><p>配置黑名单、演员同步和新作品检测。</p></header><div class="jhs-setting-group">

                            <div class="jhs-setting-row">
                                <span class="setting-label">请求并发数量:</span>
                                <div class="form-content">
                                    <input type="number" id="checkConcurrencyCount" class="jhs-field" min="2" max="5">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">请求间隔时间(毫秒):</span>
                                <div class="form-content">
                                    <input type="number" id="checkRequestSleep" class="jhs-field" min="0" max="3000">
                                </div>
                            </div>



                            <div id="setting-blacklist" class="jhs-setting-rows">
                                <h4 class="jhs-setting-subtitle">自动检测屏蔽黑名单演员</h4>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">
                                        任务开关:
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckBlacklist" class="jhs-select-source">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkBlacklist_intervalTime" class="jhs-select-source">
                                            <option value="2">每2小时</option>
                                            <option value="3">每3小时</option>
                                            <option value="6">每6小时</option>
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">检测规则:</span>
                                    <div class="form-content">
                                         <select id="checkBlacklist_ruleTime" class="jhs-select-source">
                                            <option value="0">全部检测</option>
                                            <option value="8760">不检测停更1年以上</option>
                                            <option value="17520">不检测停更2年以上</option>
                                            <option value="26280">不检测停更3年以上</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="setting-checkFavoriteActress" class="jhs-setting-rows ${r ? "" : "do-hide"}">
                                <h4 class="jhs-setting-subtitle">自动同步已收藏的演员</h4>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">
                                        任务开关:
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckFavoriteActress" class="jhs-select-source">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkFavoriteActress_IntervalTime" class="jhs-select-source">
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="setting-checkNewVideo" class="jhs-setting-rows ${r ? "" : "do-hide"}">
                                <h4 class="jhs-setting-subtitle">自动检测已收藏演员的最新作品</h4>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">
                                        任务开关:
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckNewVideo" class="jhs-select-source">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkNewVideo_intervalTime" class="jhs-select-source">
                                            <option value="2">每2小时</option>
                                            <option value="3">每3小时</option>
                                            <option value="6">每6小时</option>
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">检测规则:</span>
                                    <div class="form-content">
                                         <select id="checkNewVideo_ruleTime" class="jhs-select-source">
                                            <option value="0">全部检测</option>
                                            <option value="8760">不检测停更1年以上</option>
                                            <option value="17520">不检测停更2年以上</option>
                                            <option value="26280">不检测停更3年以上</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div></section>
                        </div>

                        <div id="domain-panel" class="content-panel ${"domain-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>外部网站</h3><p>配置外部资源来源、域名与网络。</p></header><div class="jhs-setting-group">
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - MissAv:</span>
                                <div class="form-content">
                                    <input type="url" id="missAvUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - Jable:</span>
                                <div class="form-content">
                                    <input type="url" id="jableUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - Avgle:</span>
                                <div class="form-content">
                                    <input type="url" id="avgleUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - JavTrailer:</span>
                                <div class="form-content">
                                    <input type="url" id="javTrailersUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - 123Av:</span>
                                <div class="form-content">
                                    <input type="url" id="av123Url" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - JavDb:</span>
                                <div class="form-content">
                                    <input type="url" id="javDbUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - JavBus:</span>
                                <div class="form-content">
                                    <input type="url" id="javBusUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - SupJav:</span>
                                <div class="form-content">
                                    <input type="url" id="supJavUrl" class="jhs-field">
                                </div>
                            </div>
                        </div></section>
                        </div>


                        <div id="filter-panel" class="content-panel ${"filter-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>屏蔽配置</h3><p>配置文本、演员和类别筛选规则。</p></header><div class="jhs-setting-group">
                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                     启用划词屏蔽
                                </span>
                                <div class="jhs-inline-fields">
                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">
                                </div>
                            </div>



                            <div id="reviewKeywordContainer">
                                <div class="jhs-setting-row">
                                    <span class="setting-label">评论区屏蔽词:</span>
                                    <div class="jhs-inline-fields">
                                        <input type="text" class="keyword-input jhs-field" placeholder="添加屏蔽词">
                                        <button class="jhs-btn add-tag-btn">添加</button>
                                    </div>
                                </div>
                                <div class="tag-box"> </div>
                            </div>



                            <div id="filterKeywordContainer">
                                <div class="jhs-setting-row">
                                    <span class="setting-label">视频标题屏蔽词:</span>
                                    <div class="jhs-inline-fields">
                                        <input type="text" class="keyword-input jhs-field" placeholder="添加屏蔽词">
                                        <button class="jhs-btn add-tag-btn">添加</button>
                                    </div>
                                </div>
                                <div class="tag-box"> </div>
                            </div>
                        </div></section>
                        </div>
                        <div id="cache-panel" class="content-panel ${"cache-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>缓存管理</h3><p>查看并清理非核心缓存数据。</p></header><div class="jhs-setting-group">
                            <h2 class="jhs-section__heading">以下操作不会影响核心数据</h2>
                            <br/>
                            <div class="jhs-cache-grid">
                                ${n2}
                            </div>
                            <div id="cache-data-display" class="jhs-is-hidden">
                                <pre class="jhs-cache-preview"></pre>
                            </div>
                    </div></section>
                        </div>
                        </div>

                    <div class="jhs-setting-footer">
                        <button type="button" id="saveBtn" class="jhs-btn jhs-btn--primary">保存设置</button>
                        <button id="clean-all" class="jhs-btn jhs-btn--danger jhs-is-hidden">清理全部缓存</button>
                    </div>
                </div>
            </div>
        `;
  }
  __name(buildSettingDialogHtml, "buildSettingDialogHtml");
  function injectHealthPanel() {
    const e2 = $(".side-menu-item").parent();
    e2.length && !e2.find('[data-panel="health-panel"]').length && e2.append('<button type="button" class="jhs-btn side-menu-item" data-panel="health-panel" aria-controls="health-panel">数据体检</button>');
    const t2 = $(".content-panel").parent();
    t2.length && !$("#health-panel").length && t2.append(`
            <div id="health-panel" class="content-panel">
                <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>数据体检</h3><p>检查本地数据并在备份后修复异常。</p></header>
                <div class="jhs-toolbar jhs-health-actions">
                    <button type="button" id="runHealthCheckBtn" class="jhs-btn jhs-btn--primary"><span>重新体检</span></button>
                    <button type="button" id="repairHealthBtn" class="jhs-btn jhs-btn--secondary"><span>备份并修复</span></button>
                </div>
                <div id="health-data-display" class="jhs-setting-output">点击重新体检查看结果</div>
                </section>
            </div>
        `);
  }
  __name(injectHealthPanel, "injectHealthPanel");
  function injectPluginMgmtPanel() {
    const e2 = $(".side-menu-item").parent();
    e2.length && !e2.find('[data-panel="plugin-mgmt-panel"]').length && e2.append('<button type="button" class="jhs-btn side-menu-item" data-panel="plugin-mgmt-panel" aria-controls="plugin-mgmt-panel">插件管理</button>');
    const t2 = $(".content-panel").parent();
    if (!t2.length || $("#plugin-mgmt-panel").length) return;
    const i2 = `<div id="plugin-mgmt-panel" class="content-panel">
        <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>插件管理</h3><p>按功能查看插件状态、耗时和错误记录。</p></header>
        <div class="jhs-setting-metrics">
            <div class="jhs-setting-metric"><strong id="pm-total">0</strong><span>总插件数</span></div>
            <div class="jhs-setting-metric"><strong id="pm-enabled">0</strong><span>已启用</span></div>
            <div class="jhs-setting-metric"><strong id="pm-disabled">0</strong><span>已禁用</span></div>
        </div>
        <p class="jhs-setting-help">禁用插件后需刷新页面生效。核心插件不可禁用。</p>
        <div id="plugin-mgmt-list"></div>
        <details class="jhs-diagnostics"><summary>诊断信息</summary><div class="jhs-diagnostics__content">
        <h3 class="jhs-setting-subheading">插件执行耗时</h3><p class="jhs-setting-help">页面加载时各插件 handle() 的执行时间。</p><div id="plugin-timing-table"></div>
        <h3 class="jhs-setting-subheading">错误日志</h3><div class="jhs-toolbar"><button type="button" id="pm-clear-log" class="jhs-btn jhs-btn--danger"><span>清空日志</span></button></div><div id="plugin-error-log" class="jhs-setting-output jhs-setting-output--compact">无错误记录</div>
        <h3 class="jhs-setting-subheading">缓存命中率</h3><div id="cache-hit-stats" class="jhs-setting-output"></div>
        </div></details></section>
    </div>`;
    t2.append(i2);
  }
  __name(injectPluginMgmtPanel, "injectPluginMgmtPanel");
  function injectSnapshotPanel() {
    const e2 = $(".side-menu-item").parent();
    e2.length && !e2.find('[data-panel="snapshot-panel"]').length && e2.append('<button type="button" class="jhs-btn side-menu-item" data-panel="snapshot-panel" aria-controls="snapshot-panel">恢复点</button>');
    const t2 = $(".content-panel").parent();
    if (!t2.length || $("#snapshot-panel").length) return;
    const n2 = '<div id="snapshot-panel" class="content-panel"><section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>恢复点</h3><p>创建、下载或恢复本地数据快照。</p></header><div class="jhs-toolbar"><button type="button" id="createSnapshotBtn" class="jhs-btn jhs-btn--primary"><span>创建快照</span></button></div><p class="jhs-setting-help">快照保存当前全部数据状态，可用于恢复。最多保留 10 个，超出自动清理最旧的。</p><div id="snapshot-list"></div></section></div>';
    t2.append(n2);
  }
  __name(injectSnapshotPanel, "injectSnapshotPanel");
  function injectNetworkPanel() {
    const e2 = $(".side-menu-item").parent();
    e2.length && !e2.find('[data-panel="network-panel"]').length && e2.append('<button type="button" class="jhs-btn side-menu-item" data-panel="network-panel" aria-controls="network-panel">外部请求</button>');
    const t2 = $(".content-panel").parent();
    if (!t2.length || $("#network-panel").length) return;
    const n2 = `<div id="network-panel" class="content-panel">
        <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>外部请求</h3><p>配置熔断规则并查看站点健康状态。</p></header>
        <h3 class="jhs-setting-subheading">熔断器配置</h3><p class="jhs-setting-help">连续请求失败达到阈值后，自动停止对该站点的请求，避免拖慢整体体验。</p>
        <div class="jhs-setting-row"><span class="setting-label">熔断阈值(次):</span><div class="form-content"><input type="number" id="circuitBreakerThreshold" class="jhs-field" min="2" max="10"></div></div>
        <div class="jhs-setting-row"><span class="setting-label">冷却时间(秒):</span><div class="form-content"><input type="number" id="circuitBreakerCooldownSec" class="jhs-field" min="10" max="300"></div></div>
        <div class="jhs-toolbar"><button type="button" id="resetAllBreakersBtn" class="jhs-btn jhs-btn--danger"><span>重置全部熔断</span></button></div>
        <h3 class="jhs-setting-subheading">站点健康状态</h3><p class="jhs-setting-help">各外部站点的熔断状态和请求统计。</p><div id="site-health-table"></div>
        <h3 class="jhs-setting-subheading">域名使用统计</h3><p class="jhs-setting-help">脚本实际请求过的域名及次数。</p><div class="jhs-toolbar"><button type="button" id="clearDomainStatsBtn" class="jhs-btn jhs-btn--danger"><span>清空统计</span></button></div><div id="domain-stats-table"></div></section>
    </div>`;
    t2.append(n2);
  }
  __name(injectNetworkPanel, "injectNetworkPanel");
  function injectResourceSourcesPanel() {
    if ($("#resource-sources-panel").length) return;
    $(".content-panel").last().after(`<div id="resource-sources-panel" class="content-panel">
      <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>磁力来源</h3><p>聚合多个来源搜索磁力结果，优先级数字越小越靠前。</p></header><div id="builtin-magnet-source-list" class="jhs-resource-card-list"></div><div class="jhs-toolbar"><h4>自定义来源</h4><button type="button" id="add-custom-magnet-source" class="jhs-btn jhs-btn--primary">+ 添加来源</button></div><div id="custom-magnet-source-list" class="jhs-resource-card-list"></div></section>
      <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>磁力规则</h3><p>使用可视化规则为结果添加标签或过滤低质量内容。</p></header><div class="jhs-toolbar"><h4>标签规则</h4><button type="button" id="add-magnet-tag-rule" class="jhs-btn">+ 新建</button></div><div id="magnet-tag-rule-list" class="jhs-resource-card-list"></div><div class="jhs-toolbar"><h4>过滤规则</h4><button type="button" id="add-magnet-filter-rule" class="jhs-btn">+ 新建</button></div><div id="magnet-filter-rule-list" class="jhs-resource-card-list"></div></section>
      <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>截图来源</h3><p>自动选择会按优先级依次尝试可用来源。</p></header><div class="jhs-setting-group"><label class="jhs-setting-row"><span>自动选择</span><input type="radio" name="screenshotMode" value="auto"></label><label class="jhs-setting-row"><span>手动选择</span><input type="radio" name="screenshotMode" value="manual"></label></div><div id="screenshot-source-list" class="jhs-resource-card-list"></div></section>
      <details class="jhs-setting-section jhs-resource-advanced"><summary>高级 · 导入 / 导出配置</summary><p class="jhs-setting-help">高级功能：错误修改可能导致自定义来源不可用，保存前会校验配置。</p><div class="jhs-toolbar"><button type="button" id="export-resource-config" class="jhs-btn">导出资源配置</button><button type="button" id="edit-resource-config" class="jhs-btn">编辑原始 JSON</button><button type="button" id="import-resource-config" class="jhs-btn jhs-btn--primary">校验并导入</button></div><textarea id="advanced-resource-json" class="jhs-textarea" rows="10" aria-label="高级资源配置 JSON"></textarea></details>
    </div>
    <div id="cloud-services-panel" class="content-panel"><section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>统一离线服务</h3><p>115 状态：<span id="one-one-five-state" class="jhs-badge">未知</span> <button type="button" id="check-one-one-five-login" class="jhs-btn jhs-btn--ghost">检测登录状态</button></p><small>服务不可用时会在提交前显示原因。</small></header><label class="jhs-setting-row"><span><strong>123 云盘离线</strong><small>支持 Magnet，需要先在 123 云盘页面同步授权。</small></span><input type="checkbox" id="enable123Offline" class="mini-switch"></label><label class="jhs-setting-row"><span><strong>115 离线下载</strong><small>支持 Magnet 与 ED2K。</small></span><input type="checkbox" id="enable115Offline" class="mini-switch"></label><label class="jhs-setting-row"><span>默认服务</span><select id="offlineProviderMode" class="jhs-select-source"><option value="ask">每次询问</option><option value="123">优先 123</option><option value="115">优先 115</option></select></label><label class="jhs-setting-row"><span><strong>115 文件匹配</strong><small>根据当前番号查找网盘中已存在的视频。</small></span><input type="checkbox" id="enable115Match" class="mini-switch"></label><label class="jhs-setting-row"><span><strong>未登录时提供登录入口</strong><small>提交失败时显示 115 登录地址。</small></span><input type="checkbox" id="enable115LoginRedirect" class="mini-switch"></label><label class="jhs-setting-row"><span>匹配并发数</span><input type="number" id="oneOneFiveConcurrency" class="jhs-field" min="1" max="10"></label><label class="jhs-setting-row"><span>匹配缓存（分钟）</span><input type="number" id="oneOneFiveCacheMinutes" class="jhs-field" min="1" max="1440"></label></section></div>
    <div id="data-tools-panel" class="content-panel"><section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>番号列表导入</h3><p>支持换行、空格、逗号分隔番号。必须先解析预览，再确认导入。</p></header><label class="jhs-setting-group"><span>番号</span><textarea id="car-number-import" class="jhs-textarea" rows="8" placeholder="ABC-001&#10;ABC-002&#10;FC2-1234567"></textarea></label><label class="jhs-setting-row"><span>导入为</span><select id="car-number-import-status" class="jhs-select-source"><option value="">请选择</option><option value="favorite">收藏</option><option value="hasDown">已下载</option><option value="hasWatch">已观看</option><option value="filter">屏蔽</option></select></label><div class="jhs-toolbar"><button type="button" id="preview-car-number-import" class="jhs-btn">解析预览</button><button type="button" id="confirm-car-number-import" class="jhs-btn jhs-btn--primary" disabled>确认导入</button></div><div id="car-number-import-preview" class="jhs-card" aria-live="polite"></div></section></div>`);
    const sidebar = $(".jhs-mobile-sidebar,.setting-sidebar").first();
    sidebar.append('<button type="button" class="jhs-btn side-menu-item" data-panel="resource-sources-panel" aria-controls="resource-sources-panel">资源来源</button><button type="button" class="jhs-btn side-menu-item" data-panel="cloud-services-panel" aria-controls="cloud-services-panel">云盘服务</button><button type="button" class="jhs-btn side-menu-item" data-panel="data-tools-panel" aria-controls="data-tools-panel">数据工具</button>');
  }
  __name(injectResourceSourcesPanel, "injectResourceSourcesPanel");
  function buildQuickSettingHtml() {
    const rows = [
      ["显示全部已鉴定内容", "showAllItem", "快速显示全部已鉴定状态。"],
      ["鉴定后立即关闭", "needClosePage", "完成鉴定后关闭当前详情窗口。"],
      ["瀑布流", "autoPage", "连续加载列表；启用后普通列表只支持默认排序。"],
      ["标题翻译", "translateTitle", "翻译列表和详情页标题。"],
      ["悬浮大图", "hoverBigImg", "鼠标悬停封面时显示大图。"],
      ["外部站点", "enableLoadOtherSite", "在详情页提供第三方站点入口。"],
      ["长缩略图", "enableLoadScreenShot", "在详情页图片区加载长缩略图。"],
      ["高画质预览", "enableLoadPreviewVideo", "解析更高画质的预览视频。"]
    ];
    return `
        <div class="simple-setting__panel jhs-ui">
            <div class="simple-setting__scroll jhs-scrollbar">
                <div class="simple-setting__list">
                    ${rows.map(((e2) => `<label class="jhs-setting-row" for="${e2[1]}"><span class="jhs-setting-row__copy"><span class="jhs-setting-row__label">${e2[0]}</span><span class="jhs-setting-row__description">${e2[2]}</span></span><span class="jhs-setting-row__control"><input type="checkbox" id="${e2[1]}" class="mini-switch"></span></label>`)).join("")}
                </div>
            </div>
            <footer class="simple-setting__footer">
                <button type="button" id="moreBtn" class="jhs-btn jhs-btn--ghost">完整设置 <span aria-hidden="true">›</span></button>
            </footer>
        </div>`;
  }
  __name(buildQuickSettingHtml, "buildQuickSettingHtml");
  async function renderNetworkPanel() {
    const e2 = gmHttp.getCircuitBreakerStatus(), t2 = gmHttp.getDomainStats(), n2 = await storageManager.getSetting("circuitBreakerThreshold", 3), a2 = await storageManager.getSetting("circuitBreakerCooldown", 6e4);
    $("#circuitBreakerThreshold").val(n2), $("#circuitBreakerCooldownSec").val(Math.round(a2 / 1e3));
    const i2 = Object.entries(e2);
    if (i2.length) {
      let t3 = '<table class="jhs-data-table"><tr><th>域名</th><th class="is-center">状态</th><th class="is-center">失败次数</th><th class="is-center">操作</th></tr>';
      for (const [n3, a3] of i2) {
        const i3 = "open" === a3.state ? "熔断" : "half-open" === a3.state ? "半开" : "正常", s3 = "open" === a3.state ? `剩余${Math.ceil((a3.cooldownMs - (Date.now() - a3.openTime)) / 1e3)}秒` : "";
        t3 += `<tr><td>${escapeHtml(n3)}</td><td class="is-center">${i3} ${s3}</td><td class="is-center">${Number(a3.failCount) || 0}</td><td class="is-center"><button type="button" class="jhs-btn jhs-btn--danger reset-breaker" data-domain="${escapeHtml(n3)}">重置</button></td></tr>`;
      }
      t3 += "</table>", $("#site-health-table").html(t3);
    } else $("#site-health-table").html('<p class="jhs-empty-note">暂无熔断记录</p>');
    const s2 = Object.entries(t2).sort(((e3, t3) => t3[1].count - e3[1].count));
    if (s2.length) {
      let e3 = '<table class="jhs-data-table"><tr><th>域名</th><th class="is-right">请求数</th><th class="is-right">错误数</th><th class="is-center">最后使用</th></tr>';
      for (const [t3, n3] of s2) {
        const a3 = n3.lastUsed ? new Date(n3.lastUsed).toLocaleTimeString() : "-";
        e3 += `<tr><td>${escapeHtml(t3)}</td><td class="is-right">${n3.count}</td><td class="is-right ${n3.errors > 0 ? "is-danger" : ""}">${n3.errors}</td><td class="is-center">${a3}</td></tr>`;
      }
      e3 += "</table>", e3 += `<p class="jhs-caption">共 ${s2.length} 个域名</p>`, $("#domain-stats-table").html(e3);
    } else $("#domain-stats-table").html('<p class="jhs-empty-note">暂无统计数据</p>');
    $(".reset-breaker").off("click").on("click", ((e3) => {
      const t3 = $(e3.target).data("domain");
      gmHttp.resetCircuitBreaker(t3), show.ok(`已重置 ${t3} 的熔断状态`), renderNetworkPanel();
    })), $("#resetAllBreakersBtn").off("click").on("click", (() => {
      gmHttp.resetAllCircuitBreakers(), show.ok("已重置全部熔断状态"), renderNetworkPanel();
    })), $("#clearDomainStatsBtn").off("click").on("click", (() => {
      gmHttp.clearDomainStats(), show.ok("已清空域名统计"), renderNetworkPanel();
    }));
  }
  __name(renderNetworkPanel, "renderNetworkPanel");
  async function renderSnapshotPanel() {
    const e2 = await storageManager.getSnapshotList(), t2 = {
      "manual": "手动创建",
      "auto-import": "导入前自动",
      "auto-repair": "修复前自动",
      "auto-restore": "恢复前自动"
    };
    if (0 === e2.length) return void $("#snapshot-list").html('<div class="jhs-empty-note">暂无快照，点击上方按钮创建</div>');
    $("#snapshot-list").find(".tabulator").length && $("#snapshot-list").empty();
    const n2 = new Tabulator("#snapshot-list", {
      layout: "fitColumns",
      placeholder: "暂无数据",
      data: e2,
      columnDefaults: { headerHozAlign: "center", hozAlign: "center" },
      columns: [
        { title: "名称", field: "name", width: 200, headerSort: false },
        { title: "来源", field: "source", width: 100, headerSort: false, formatter: /* @__PURE__ */ __name((e3) => t2[e3.getValue()] || e3.getValue(), "formatter") },
        { title: "时间", field: "time", width: 170, headerSort: false },
        { title: "数据量", field: "itemCount", width: 80, headerSort: false },
        {
          title: "操作",
          minWidth: 220,
          headerSort: false,
          formatter: /* @__PURE__ */ __name((e3, t3, a2) => {
            const i2 = e3.getData();
            return a2((() => {
              const t4 = e3.getElement().querySelector(".snap-restore"), a3 = e3.getElement().querySelector(".snap-download"), s2 = e3.getElement().querySelector(".snap-delete");
              t4 && t4.addEventListener("click", (async (e4) => {
                utils.q(e4, `恢复到快照「${escapeHtml(i2.name)}」? 当前数据会自动备份。`, (async () => {
                  let e5 = loading();
                  try {
                    await storageManager.restoreSnapshot(i2.id), show.ok("恢复成功, 页面将刷新"), setTimeout(() => location.reload(), 1e3);
                  } catch (t5) {
                    clog.error(t5), show.error("恢复失败: " + t5.message);
                  } finally {
                    e5.close();
                  }
                }));
              })), a3 && a3.addEventListener("click", (async (e4) => {
                let t5 = loading();
                try {
                  const e5 = await storageManager.getSnapshot(i2.id);
                  if (!e5) throw new Error("快照不存在");
                  utils.download(JSON.stringify(e5.data), `snapshot_${escapeHtml(i2.name)}.json`), show.ok("下载成功");
                } catch (n3) {
                  show.error("下载失败: " + n3.message);
                } finally {
                  t5.close();
                }
              })), s2 && s2.addEventListener("click", (async (e4) => {
                utils.q(e4, `删除快照「${escapeHtml(i2.name)}」?`, (async () => {
                  try {
                    await storageManager.deleteSnapshot(i2.id), show.ok("已删除"), renderSnapshotPanel();
                  } catch (t5) {
                    clog.error(t5), show.error("删除失败: " + t5.message);
                  }
                }));
              }));
            })), '<button type="button" class="jhs-btn jhs-btn--primary snap-restore">恢复</button> <button type="button" class="jhs-btn jhs-btn--secondary snap-download">下载</button> <button type="button" class="jhs-btn jhs-btn--danger snap-delete">删除</button>';
          }, "formatter")
        }
      ],
      locale: "zh-cn"
    });
  }
  __name(renderSnapshotPanel, "renderSnapshotPanel");
  function showDiffPreview(e2, t2, n2 = null) {
    const a2 = e2.summary, i2 = [];
    for (const [s3, o2] of Object.entries(e2.stores)) {
      if ("unchanged" === o2.status) continue;
      const e3 = { store: s3, status: o2.status, oldCount: o2.oldCount, newCount: o2.newCount, added: o2.added.length, removed: o2.removed.length, modified: o2.modified.length };
      i2.push(e3);
    }
    let s2 = '<div class="jhs-dialog-content">';
    s2 += '<div class="jhs-summary-grid">';
    s2 += `<div class="jhs-summary-card jhs-summary-card--success"><strong>${a2.added}</strong><span>新增数据源</span></div>`;
    s2 += `<div class="jhs-summary-card jhs-summary-card--danger"><strong>${a2.removed}</strong><span>缺失数据源</span></div>`;
    s2 += `<div class="jhs-summary-card jhs-summary-card--warning"><strong>${a2.modified}</strong><span>有变更</span></div>`;
    s2 += `<div class="jhs-summary-card"><strong>${a2.unchanged}</strong><span>无变化</span></div>`;
    s2 += "</div>";
    if (i2.length > 0) {
      s2 += '<div class="jhs-scroll-frame"><table class="jhs-data-table"><thead><tr><th>数据源</th><th>状态</th><th class="is-center">当前</th><th class="is-center">导入</th><th class="is-center">新增</th><th class="is-center">删除</th><th class="is-center">修改</th></tr></thead><tbody>';
      const o2 = { added: "新增", removed: "缺失", modified: "变更", unchanged: "无变化" };
      for (const r3 of i2) s2 += `<tr><td>${escapeHtml(r3.store)}</td><td>${o2[r3.status] || r3.status}</td><td class="is-center">${r3.oldCount}</td><td class="is-center">${r3.newCount}</td><td class="is-center is-success">${r3.added || "-"}</td><td class="is-center is-danger">${r3.removed || "-"}</td><td class="is-center is-warning">${r3.modified || "-"}</td></tr>`;
      s2 += "</tbody></table></div>";
    } else {
      s2 += '<div class="jhs-empty-note">数据完全一致，无需导入</div>';
    }
    s2 += '<div class="jhs-warning-note">导入将覆盖当前数据，建议先创建快照备份</div>';
    s2 += "</div>";
    const r2 = layer.open({
      type: 1,
      title: "数据差异预览",
      content: s2,
      area: utils.getResponsiveArea(["700px", "auto"]),
      btn: ["确认导入", "取消"],
      anim: -1,
      yes: /* @__PURE__ */ __name(async (s3) => {
        layer.close(s3);
        let o2 = loading();
        try {
          await storageManager.createSnapshot("导入前自动备份", "auto-import"), n2 ? (await storageManager.importData(n2), show.ok("导入成功!"), void setTimeout(() => location.reload(), 1e3)) : t2 && (await storageManager.importData(t2), show.ok("导入成功!"), void setTimeout(() => location.reload(), 1e3));
        } catch (r3) {
          clog.error(r3), show.error("导入失败: " + r3.message);
        } finally {
          o2.close();
        }
      }, "yes")
    });
  }
  __name(showDiffPreview, "showDiffPreview");
  async function renderPluginMgmtPanel() {
    const disabled = JSON.parse(await storageManager.getSetting("disabledPlugins", "[]"));
    const allNames = unsafeWindow.pluginManager.getPluginNames();
    const { categories, corePlugins, pluginMeta } = getPluginCategories();
    const registeredSet = new Set(allNames);
    let html = "";
    for (const [catKey, cat] of Object.entries(categories)) {
      const visiblePlugins = cat.plugins.filter((p2) => registeredSet.has(p2));
      if (!visiblePlugins.length) continue;
      html += '<section class="jhs-plugin-group">';
      html += `<h4 class="jhs-plugin-group__title">${escapeHtml(cat.label)}</h4>`;
      for (const pName of visiblePlugins) {
        const isCore = corePlugins.includes(pName);
        const isDisabled = disabled.includes(pName);
        const productName = pluginMeta[pName]?.[0] || pName;
        html += '<div class="jhs-plugin-row">';
        html += `<span class="jhs-plugin-copy" title="内部插件名：${escapeHtml(pName)}"><strong>${escapeHtml(productName)}</strong></span>`;
        if (isCore) {
          html += '<span class="jhs-badge jhs-badge--neutral">核心</span>';
        } else {
          html += `<input type="checkbox" class="mini-switch pm-toggle" data-plugin="${escapeHtml(pName)}" ${isDisabled ? "" : "checked"}>`;
        }
        html += `</div>`;
      }
      html += `</section>`;
    }
    $("#plugin-mgmt-list").html(html);
    const enabledCount = allNames.length - disabled.length;
    $("#pm-total").text(allNames.length);
    $("#pm-enabled").text(enabledCount);
    $("#pm-disabled").text(disabled.length);
    $(".pm-toggle").off("change").on("change", async (e2) => {
      const name = $(e2.target).data("plugin");
      let list = JSON.parse(await storageManager.getSetting("disabledPlugins", "[]"));
      if ($(e2.target).is(":checked")) {
        list = list.filter((x) => x !== name);
      } else {
        if (!list.includes(name)) list.push(name);
      }
      await storageManager.saveSettingItem("disabledPlugins", JSON.stringify(list));
      const all = unsafeWindow.pluginManager.getPluginNames();
      $("#pm-total").text(all.length);
      $("#pm-enabled").text(all.length - list.length);
      $("#pm-disabled").text(list.length);
      show.ok(`插件 "${name}" 已${$(e2.target).is(":checked") ? "启用" : "禁用"}，刷新后生效`);
    });
    const startup = unsafeWindow.pluginManager.getStartupReport?.(), timings = unsafeWindow.pluginManager.getTimings();
    const formatMs = /* @__PURE__ */ __name((value) => Number.isFinite(value) ? value.toFixed(1) : "0.0", "formatMs");
    let startupHtml = startup ? `<div class="jhs-inline-metrics"><span>就绪: <strong>${formatMs(startup.readyMs)} ms</strong></span><span>注册: ${formatMs(startup.registrationMs)} ms</span><span>样式: ${formatMs(startup.cssMs)} ms</span><span>即时插件: ${formatMs(startup.immediateMs)} ms</span><span>空闲任务: ${startup.idleCompleted}/${startup.idleCompleted + startup.idlePending}</span></div><p class="jhs-caption">就绪耗时不包含 @require 下载及浏览器脚本解析时间。</p>` : "";
    if (timings.length) {
      const sorted = [...timings].sort((a2, b2) => b2.elapsed - a2.elapsed);
      let tHtml = '<table class="jhs-data-table"><tr><th>插件</th><th class="is-center">阶段</th><th class="is-right">耗时(ms)</th><th class="is-center">状态</th></tr>';
      for (const t2 of sorted) {
        const stateClass = t2.status === "disabled" ? "is-muted" : t2.elapsed > 500 ? "is-slow" : t2.elapsed > 200 ? "is-warning" : "";
        const statusText = t2.status === "disabled" ? "已禁用" : t2.status === "error" ? "错误" : t2.status === "pending-idle" ? "等待空闲" : t2.status === "skipped-mobile" ? "移动端跳过" : "正常";
        tHtml += `<tr><td class="${stateClass}">${escapeHtml(t2.name)}</td><td class="is-center">${t2.startupMode === "idle" ? "空闲" : "即时"}</td><td class="is-right ${stateClass}">${t2.elapsed.toFixed(1)}</td><td class="is-center">${statusText}</td></tr>`;
      }
      tHtml += "</table>";
      $("#plugin-timing-table").html(startupHtml + tHtml);
    } else {
      $("#plugin-timing-table").html(startupHtml + '<p class="jhs-empty-note">暂无数据，刷新页面后自动采集。</p>');
    }
    const errorLog = unsafeWindow.pluginManager.getErrorLog();
    if (errorLog.length) {
      let eHtml = '<table class="jhs-data-table"><tr><th>时间</th><th>插件</th><th>阶段</th><th>错误信息</th></tr>';
      for (const err of [...errorLog].reverse()) {
        eHtml += `<tr><td class="is-muted">${escapeHtml(err.time.substring(11, 19))}</td><td>${escapeHtml(err.plugin)}</td><td>${escapeHtml(err.phase)}</td><td class="is-danger">${escapeHtml(err.message)}</td></tr>`;
      }
      eHtml += "</table>";
      $("#plugin-error-log").html(eHtml);
    } else {
      $("#plugin-error-log").text("无错误记录");
    }
    const cacheStats = storageManager.getCacheHitStats();
    $("#cache-hit-stats").html(`<div class="jhs-inline-metrics"><span>命中: <strong>${cacheStats.hits}</strong></span><span>未命中: <strong>${cacheStats.misses}</strong></span><span>总计: <strong>${cacheStats.total}</strong></span><span>命中率: <strong>${cacheStats.rate}</strong></span></div>`);
  }
  __name(renderPluginMgmtPanel, "renderPluginMgmtPanel");
  async function renderDataHealthPanel() {
    const e2 = $("#health-data-display");
    if (!e2.length) return;
    e2.text("体检中...");
    try {
      const t2 = await storageManager.inspectDataHealth(), n2 = t2.fixable.reduce(((e3, t3) => e3 + t3.count), 0), a2 = t2.readonly.reduce(((e3, t3) => e3 + t3.count), 0), i2 = /* @__PURE__ */ __name((t3) => t3.length ? t3.map(((e3) => `<li><strong>${escapeHtml(e3.message)}</strong>：${e3.count}</li>`)).join("") : "<li>无</li>", "i");
      e2.html(`
                <div class="jhs-summary-grid">
                    <div>番号记录：<strong>${t2.totals.carList}</strong></div>
                    <div>收藏演员：<strong>${t2.totals.favoriteActresses}</strong></div>
                    <div>黑名单演员：<strong>${t2.totals.blacklist}</strong></div>
                    <div>黑名单作品：<strong>${t2.totals.blacklistCarList}</strong></div>
                </div>
                <div class="jhs-health-summary">体检时间：${escapeHtml(t2.checkedAt)}；可修复问题 <strong>${n2}</strong> 项，只读问题 <strong>${a2}</strong> 项。</div>
                <div class="jhs-health-columns">
                    <div><h4>可安全修复</h4><ul>${i2(t2.fixable)}</ul></div>
                    <div><h4>仅报告</h4><ul>${i2(t2.readonly)}</ul></div>
                </div>
            `);
    } catch (t2) {
      clog.error(t2), e2.text("体检失败: " + t2);
    }
  }
  __name(renderDataHealthPanel, "renderDataHealthPanel");
  async function repairDataHealthWithBackup() {
    const e2 = JSON.stringify(await storageManager.exportData()), t2 = `health-backup-${utils.getNowStr("_", "_")}.json`;
    utils.download(e2, t2);
    const n2 = await storageManager.repairDataHealth();
    show.ok(`已修复 ${n2.fixedGroups} 组数据问题，修复前备份已下载`), await renderDataHealthPanel();
  }
  __name(repairDataHealthWithBackup, "repairDataHealthWithBackup");
  async function loadSettingForm(getBean) {
    let e2 = await storageManager.getSetting();
    $("#videoQuality").val(e2.videoQuality), $("#reviewCount").val(e2.reviewCount || 20), $("#tagPosition").val(e2.tagPosition || "rightTop"), $("#defaultQuickFilterTab").val(normalizeQuickFilterKey(e2.defaultQuickFilterTab)), $("#needClosePageBasic").prop("checked", !e2.needClosePage || e2.needClosePage === _), $("#autoRemoveNewVideoMarkAfterBrowse").prop("checked", !!e2.autoRemoveNewVideoMarkAfterBrowse && e2.autoRemoveNewVideoMarkAfterBrowse === _), $("#waitCheckCount").val(e2.waitCheckCount || 5), $("#checkConcurrencyCount").val(e2.checkConcurrencyCount || 2), $("#checkRequestSleep").val(e2.checkRequestSleep || 100), $("#enableCheckBlacklist").val(e2.enableCheckBlacklist || _), $("#checkBlacklist_intervalTime").val(e2.checkBlacklist_intervalTime || 12), $("#checkBlacklist_ruleTime").val(e2.checkBlacklist_ruleTime || 8760), $("#enableCheckFavoriteActress").val(e2.enableCheckFavoriteActress || _), $("#checkFavoriteActress_IntervalTime").val(e2.checkFavoriteActress_IntervalTime || 24), $("#enableCheckNewVideo").val(e2.enableCheckNewVideo || _), $("#checkNewVideo_intervalTime").val(e2.checkNewVideo_intervalTime || 12), $("#checkNewVideo_ruleTime").val(e2.checkNewVideo_ruleTime || 8760);
    const t2 = e2.highlightedTagNumber || 1, n2 = e2.highlightedTagColor || "#ce2222";
    $("#highlightedTagNumber").val(e2.highlightedTagNumber || 1), $("#highlightedTagColor").val(e2.highlightedTagColor || "#ce2222"), $("#highlightedTagLabel").css("border", `${t2}px solid ${n2}`), $("#enableClog").val(e2.enableClog || _), $("#clogMsgCount").val(e2.clogMsgCount || 2e3), $("#mobileMode").val(e2.mobileMode || "auto"), $("#themeMode").val(e2.themeMode || "light"), $("#httpTimeout").val(e2.httpTimeout || 5e3), $("#httpRetryCount").val(e2.httpRetryCount || 3), $("#webDavUrl").val(e2.webDavUrl || ""), $("#webDavUsername").val(e2.webDavUsername || ""), $("#webDavPassword").val(await decryptCredential(e2.webDavPassword) || ""), $("#enableTitleSelectFilter").prop("checked", !e2.enableTitleSelectFilter || e2.enableTitleSelectFilter === _), $("#enableFavoriteActresses").prop("checked", !e2.enableFavoriteActresses || e2.enableFavoriteActresses === _), $("#enableSaveActressCarInfo").prop("checked", !!e2.enableSaveActressCarInfo && e2.enableSaveActressCarInfo === _), $("#enableScreenSvg").prop("checked", !e2.enableScreenSvg || e2.enableScreenSvg === _), $("#enableVideoSvg").prop("checked", !e2.enableVideoSvg || e2.enableVideoSvg === _), $("#enableHandleSvg").prop("checked", !e2.enableHandleSvg || e2.enableHandleSvg === _), $("#enableSiteSvg").prop("checked", !e2.enableSiteSvg || e2.enableSiteSvg === _), $("#enableCopySvg").prop("checked", !e2.enableCopySvg || e2.enableCopySvg === _), $("#showFavoriteItem").prop("checked", !e2.showFavoriteItem || e2.showFavoriteItem === _), $("#showHasDownItem").prop("checked", !e2.showHasDownItem || e2.showHasDownItem === _), $("#showHasWatchItem").prop("checked", !e2.showHasWatchItem || e2.showHasWatchItem === _), $("#enableLoadActressInfo").prop("checked", !e2.enableLoadActressInfo || e2.enableLoadActressInfo === _), $("#enableVerticalModel").prop("checked", !!e2.enableVerticalModel && e2.enableVerticalModel === _), $("#containerColumns").val(e2.containerColumns || 5), $("#showContainerColumns").text(e2.containerColumns || 5), $("#containerWidth").val((e2.containerWidth || 100) - 70), $("#showContainerWidth").text((e2.containerWidth || 100) + "%");
    const a2 = getBean("OtherSitePlugin"), i2 = await a2.getMissAvUrl(), s2 = await a2.getjableUrl(), o2 = await a2.getAvgleUrl(), r2 = await a2.getJavTrailersUrl(), l2 = await a2.getAv123Url(), c2 = await a2.getJavDbUrl(), d2 = await a2.getJavBusUrl(), h2 = await a2.getSupJavUrl();
    $("#missAvUrl").val(i2), $("#jableUrl").val(s2), $("#avgleUrl").val(o2), $("#javTrailersUrl").val(r2), $("#av123Url").val(l2), $("#javDbUrl").val(c2), $("#javBusUrl").val(d2), $("#supJavUrl").val(h2);
    let g2 = await storageManager.getReviewFilterKeywordList(), p2 = await storageManager.getTitleFilterKeyword();
    g2 && g2.forEach(((e3) => {
      addLabelTag("#reviewKeywordContainer", e3);
    })), p2 && p2.forEach(((e3) => {
      addLabelTag("#filterKeywordContainer", e3);
    })), ["#reviewKeywordContainer", "#filterKeywordContainer"].forEach(((e3) => {
      $(`${e3} .add-tag-btn`).on("click", ((t3) => addKeyword(t3, e3))), $(`${e3} .keyword-input`).on("keypress", ((t3) => {
        "Enter" === t3.key && addKeyword(t3, e3);
      }));
    }));
    bindLayoutRangeEvents();
  }
  __name(loadSettingForm, "loadSettingForm");
  function bindLayoutRangeEvents() {
    $("#containerColumns").off(".jhsSetting").on("input.jhsSetting", (() => {
      const columns = $("#containerColumns").val();
      $("#showContainerColumns").text(columns);
      const movieList = document.querySelector(".movie-list"), masonry = document.querySelector(".masonry");
      movieList && (movieList.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`);
      masonry && (masonry.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`);
    })).on("change.jhsSetting", (async (event) => {
      await storageManager.saveSettingItem("containerColumns", $(event.currentTarget).val()), await applyImageMode();
    }));
    $("#containerWidth").off(".jhsSetting").on("input.jhsSetting", ((event) => {
      const width = parseInt($(event.target).val()) + 70, widthText = `${width}%`;
      $("#showContainerWidth").text(widthText);
      const javdbContainer = document.querySelector("section .container"), javbusContainer = document.querySelector(".container-fluid .row");
      javdbContainer && (javdbContainer.style.minWidth = widthText);
      javbusContainer && (javbusContainer.style.minWidth = widthText);
    })).on("change.jhsSetting", ((event) => storageManager.saveSettingItem("containerWidth", parseInt($(event.currentTarget).val()) + 70)));
  }
  __name(bindLayoutRangeEvents, "bindLayoutRangeEvents");
  async function initQuickSettingForm(getBean, getSelector, openSettingDialogFn) {
    let e2 = await storageManager.getSetting();
    $("#needClosePage").prop("checked", !e2.needClosePage || e2.needClosePage === _), $("#autoPage").prop("checked", !e2.autoPage || e2.autoPage === _), $("#translateTitle").prop("checked", !e2.translateTitle || e2.translateTitle === _), $("#enableLoadActressInfo").prop("checked", !e2.enableLoadActressInfo || e2.enableLoadActressInfo === _), $("#enableLoadOtherSite").prop("checked", !e2.enableLoadOtherSite || e2.enableLoadOtherSite === _), $("#showFavoriteItem").prop("checked", !e2.showFavoriteItem || e2.showFavoriteItem === _), $("#showHasDownItem").prop("checked", !e2.showHasDownItem || e2.showHasDownItem === _), $("#showHasWatchItem").prop("checked", !e2.showHasWatchItem || e2.showHasWatchItem === _), $("#showFavoriteItem").on("change", (async (t3) => {
      let n3 = $("#showFavoriteItem").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("showFavoriteItem", n3), await jhsEventBus.emit("filter-rules-changed", { setting: "showFavoriteItem" });
    })), $("#showHasDownItem").on("change", (async (t3) => {
      let n3 = $("#showHasDownItem").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("showHasDownItem", n3), await jhsEventBus.emit("filter-rules-changed", { setting: "showHasDownItem" });
    })), $("#showHasWatchItem").on("change", (async (t3) => {
      let n3 = $("#showHasWatchItem").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("showHasWatchItem", n3), await jhsEventBus.emit("filter-rules-changed", { setting: "showHasWatchItem" });
    }));
    const t2 = $("#showFavoriteItem, #showHasDownItem, #showHasWatchItem"), n2 = /* @__PURE__ */ __name(() => {
      const e3 = $("#showAllItem").is(":checked");
      t2.prop("disabled", e3), e3 ? t2.attr("data-tip", "请先关闭显示所有才可点击") : t2.removeAttr("data-tip");
    }, "n");
    $("#showAllItem").prop("checked", !!e2.showAllItem && e2.showAllItem === _), $("#showAllItem").on("change", (async (t3) => {
      let a2 = $("#showAllItem").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("showAllItem", a2), n2(), await jhsEventBus.emit("filter-rules-changed", { setting: "showAllItem" });
    })), n2(), $("#needClosePage").on("change", (async (t3) => {
      await storageManager.saveSettingItem("needClosePage", $("#needClosePage").is(":checked") ? _ : C), await jhsEventBus.emit("filter-rules-changed");
    })), $("#autoPage").on("change", (async (t3) => {
      const n3 = $("#autoPage").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("autoPage", n3), $("#sort-toggle-btn").prop("disabled", n3 === _).attr("title", n3 === _ ? "瀑布流模式仅支持默认排序" : "选择列表排序方式");
    })), $("#translateTitle").on("change", (async (t3) => {
      const n3 = $("#translateTitle").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("translateTitle", n3), n3 === _ ? (await getBean("ListPagePlugin").doFilter(), isDetailPage && await getBean("TranslatePlugin").translate()) : (await getBean("ListPagePlugin").revertTranslation(), $(".translated-title").remove());
    })), $("#hoverBigImg").prop("checked", !!e2.hoverBigImg && e2.hoverBigImg === _), $("#hoverBigImg").on("change", (async (t3) => {
      const n3 = $("#hoverBigImg").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("hoverBigImg", n3), window.imageHoverPreviewObj && (window.imageHoverPreviewObj.destroy(), window.imageHoverPreviewObj = null), n3 === _ && (window.imageHoverPreviewObj = new ImageHoverPreview({
        selector: getSelector().coverImgSelector
      }));
    })), $("#enableLoadActressInfo").on("change", (async (t3) => {
      const n3 = $("#enableLoadActressInfo").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("enableLoadActressInfo", n3), n3 === _ ? getBean("ActressInfoPlugin").loadActressInfo() : $(".actress-info").remove();
    })), $("#enableLoadOtherSite").on("change", (async (t3) => {
      const n3 = $("#enableLoadOtherSite").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("enableLoadOtherSite", n3), n3 === _ ? await getBean("OtherSitePlugin").loadOtherSite() : $("#otherSiteBox").remove();
    })), $("#enableLoadScreenShot").prop("checked", !e2.enableLoadScreenShot || e2.enableLoadScreenShot === _), $("#enableLoadScreenShot").on("change", (async (t3) => {
      const n3 = $("#enableLoadScreenShot").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("enableLoadScreenShot", n3), n3 === _ ? await getBean("ScreenShotPlugin").loadScreenShot() : $(".screen-container").remove();
    })), $("#enableLoadPreviewVideo").prop("checked", !e2.enableLoadPreviewVideo || e2.enableLoadPreviewVideo === _), $("#enableLoadPreviewVideo").on("change", (async (t3) => {
      const n3 = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("enableLoadPreviewVideo", n3);
    })), $("#enableVerticalModel").prop("checked", !!e2.enableVerticalModel && e2.enableVerticalModel === _), $("#enableVerticalModel").on("change", (async (t3) => {
      const n3 = $("#enableVerticalModel").is(":checked") ? _ : C;
      await storageManager.saveSettingItem("enableVerticalModel", n3), applyImageMode();
    })), $("#moreBtn").on("click", (() => {
      $(".simple-setting, .mini-simple-setting").html("").hide(), openSettingDialogFn("base-panel");
    }));
  }
  __name(initQuickSettingForm, "initQuickSettingForm");
  async function saveSettingForm(getBean) {
    let e2 = await storageManager.getSetting();
    e2.videoQuality = $("#videoQuality").val(), e2.reviewCount = $("#reviewCount").val(), e2.tagPosition = $("#tagPosition").val(), e2.defaultQuickFilterTab = normalizeQuickFilterKey($("#defaultQuickFilterTab").val()), e2.needClosePage = $("#needClosePageBasic").is(":checked") ? _ : C, e2.autoRemoveNewVideoMarkAfterBrowse = $("#autoRemoveNewVideoMarkAfterBrowse").is(":checked") ? _ : C, e2.waitCheckCount = $("#waitCheckCount").val(), e2.highlightedTagNumber = $("#highlightedTagNumber").val(), e2.highlightedTagColor = $("#highlightedTagColor").val(), e2.checkConcurrencyCount = $("#checkConcurrencyCount").val(), e2.checkRequestSleep = $("#checkRequestSleep").val(), e2.enableCheckBlacklist = $("#enableCheckBlacklist").val(), e2.checkBlacklist_intervalTime = $("#checkBlacklist_intervalTime").val(), e2.checkBlacklist_ruleTime = $("#checkBlacklist_ruleTime").val(), e2.enableCheckFavoriteActress = $("#enableCheckFavoriteActress").val(), e2.checkFavoriteActress_IntervalTime = $("#checkFavoriteActress_IntervalTime").val(), e2.enableCheckNewVideo = $("#enableCheckNewVideo").val(), e2.checkNewVideo_intervalTime = $("#checkNewVideo_intervalTime").val(), e2.checkNewVideo_ruleTime = $("#checkNewVideo_ruleTime").val(), e2.httpTimeout = Number($("#httpTimeout").val()) || 5e3, e2.httpRetryCount = Number($("#httpRetryCount").val()) || 3, e2.circuitBreakerThreshold = Number($("#circuitBreakerThreshold").val()) || 3, e2.circuitBreakerCooldown = Number($("#circuitBreakerCooldownSec").val()) * 1e3, e2.enableClog = $("#enableClog").val(), e2.enableClog === _ ? clog.show() : clog.hide(), e2.clogMsgCount = $("#clogMsgCount").val(), e2.mobileMode = $("#mobileMode").val(), e2.themeMode = $("#themeMode").val(), e2.webDavUrl = $("#webDavUrl").val(), e2.webDavUsername = $("#webDavUsername").val(), e2.webDavPassword = await encryptCredential($("#webDavPassword").val()), e2.missAvUrl = $("#missAvUrl").val().replace(/\/$/, ""), e2.jableUrl = $("#jableUrl").val().replace(/\/$/, ""), e2.avgleUrl = $("#avgleUrl").val().replace(/\/$/, ""), e2.javTrailersUrl = $("#javTrailersUrl").val().replace(/\/$/, ""), e2.av123Url = $("#av123Url").val().replace(/\/$/, ""), e2.javDbUrl = $("#javDbUrl").val().replace(/\/$/, ""), e2.javBusUrl = $("#javBusUrl").val().replace(/\/$/, ""), e2.supJavUrl = $("#supJavUrl").val().replace(/\/$/, ""), e2.enableTitleSelectFilter = $("#enableTitleSelectFilter").is(":checked") ? _ : C, e2.enableFavoriteActresses = $("#enableFavoriteActresses").is(":checked") ? _ : C, e2.enableSaveActressCarInfo = $("#enableSaveActressCarInfo").is(":checked") ? _ : C, e2.enableScreenSvg = $("#enableScreenSvg").is(":checked") ? _ : C, e2.enableVideoSvg = $("#enableVideoSvg").is(":checked") ? _ : C, e2.enableHandleSvg = $("#enableHandleSvg").is(":checked") ? _ : C, e2.enableSiteSvg = $("#enableSiteSvg").is(":checked") ? _ : C, e2.enableCopySvg = $("#enableCopySvg").is(":checked") ? _ : C, e2.showFavoriteItem = $("#showFavoriteItem").is(":checked") ? _ : C, e2.showHasDownItem = $("#showHasDownItem").is(":checked") ? _ : C, e2.showHasWatchItem = $("#showHasWatchItem").is(":checked") ? _ : C, e2.enableLoadActressInfo = $("#enableLoadActressInfo").is(":checked") ? _ : C, e2.enableVerticalModel = $("#enableVerticalModel").is(":checked") ? _ : C, e2.containerColumns = Number($("#containerColumns").val()) || 5, e2.containerWidth = Number($("#containerWidth").val()) + 70 || 100, await storageManager.saveSetting(e2);
    let t2 = [];
    $("#reviewKeywordContainer .keyword-label").toArray().forEach(((e3) => {
      let n3 = $(e3).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
      t2.push(n3);
    })), await storageManager.saveReviewFilterKeyword(t2);
    let n2 = [];
    $("#filterKeywordContainer .keyword-label").toArray().forEach(((e3) => {
      let t3 = $(e3).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
      n2.push(t3);
    })), await storageManager.saveTitleFilterKeyword(n2), show.ok("保存成功"), await jhsEventBus.emit("filter-rules-changed", { scope: "title-keyword" });
    const a2 = getBean("NewVideoPlugin");
    a2 && a2.resetBtnTip(), getBean("BlacklistPlugin").resetBtnTip(), getBean("BlacklistPlugin").reloadTable();
  }
  __name(saveSettingForm, "saveSettingForm");
  function addLabelTag(e2, t2) {
    const n2 = $(`${e2} .tag-box`);
    let a2;
    /^[a-z]{2,}-/i.test(t2) && r ? a2 = $(`
                <a class="keyword-label keyword-label--link" data-keyword="${t2}" href="/video_codes/${t2.replace("-", "")}" target="_blank">
                    ${t2}
                    <span class="keyword-remove">×</span>
                </a>
            `) : a2 = $(`
                <div class="keyword-label" data-keyword="${t2}">
                    ${t2}
                    <span class="keyword-remove">×</span>
                </div>
            `), a2.find(".keyword-remove").click(((e3) => {
      e3.stopPropagation(), e3.preventDefault();
      const t3 = $(e3.currentTarget);
      const n3 = t3.closest(".keyword-label").attr("data-keyword").split(" ")[0];
      utils.q(e3, `是否移除屏蔽词  ${n3}?`, (async () => {
        t3.parent().remove();
      }));
    })), n2.append(a2);
  }
  __name(addLabelTag, "addLabelTag");
  function addKeyword(e2, t2) {
    let n2 = $(`${t2} .keyword-input`);
    const a2 = n2.val().trim();
    a2 && (addLabelTag(t2, a2), n2.val(""));
  }
  __name(addKeyword, "addKeyword");
  async function importSettingData(showDiffPreviewFn) {
    try {
      const input = document.createElement("input");
      input.type = "file", input.accept = ".json";
      const cleanup = /* @__PURE__ */ __name(() => input.remove(), "cleanup");
      input.onchange = async (e2) => {
        const t2 = e2.target.files[0];
        if (!t2) return void cleanup();
        const n2 = new FileReader();
        n2.onload = async (e3) => {
          cleanup();
          try {
            const t3 = e3.target.result.toString(), n3 = JSON.parse(t3);
            if (!n3 || "object" != typeof n3 || Array.isArray(n3)) throw new Error("文件内容不是有效的数据对象");
            const a2 = loading();
            try {
              const e4 = await storageManager.exportData(), t4 = await storageManager.diffData(e4, n3);
              a2.close(), showDiffPreviewFn(t4, n3, null);
            } catch (i2) {
              a2.close(), clog.error(i2), show.error("差异分析失败: " + i2.message);
            }
          } catch (t3) {
            clog.error(t3), show.error("导入失败：文件内容不是有效的JSON格式 " + t3.message);
          }
        }, n2.onerror = () => {
          cleanup(), show.error("读取文件时出错");
        }, n2.readAsText(t2);
      }, document.body.appendChild(input), input.click();
      setTimeout(cleanup, 3e5);
    } catch (e2) {
      clog.error(e2), show.error("导入数据时出错: " + e2.message);
    }
  }
  __name(importSettingData, "importSettingData");
  async function backupDataByWebDav(folderName) {
    const t2 = await storageManager.getSetting(), n2 = t2.webDavUrl;
    if (!n2) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
    const a2 = t2.webDavUsername;
    if (!a2) return void show.error("请填写webDav用户名并保存后, 再试此功能");
    const i2 = await decryptCredential(t2.webDavPassword);
    if (!i2) return void show.error("请填写webDav密码并保存后, 再试此功能");
    let s2 = utils.getNowStr("_", "_") + ".json", o2 = JSON.stringify(await storageManager.exportData());
    o2 = await encryptData(o2);
    let r2 = loading();
    try {
      const e2 = new WebDavClient(n2, a2, i2);
      await e2.backup(folderName, s2, o2), show.ok("备份完成");
    } catch (l2) {
      clog.error(l2), show.error(l2.toString());
    } finally {
      r2.close();
    }
  }
  __name(backupDataByWebDav, "backupDataByWebDav");
  async function backupListBtnByWebDav(folderName, openFileListDialogFn) {
    const t2 = await storageManager.getSetting(), n2 = t2.webDavUrl;
    if (!n2) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
    const a2 = t2.webDavUsername;
    if (!a2) return void show.error("请填写webDav用户名并保存后, 再试此功能");
    const i2 = await decryptCredential(t2.webDavPassword);
    if (!i2) return void show.error("请填写webDav密码并保存后, 再试此功能");
    let s2 = loading();
    try {
      const e2 = new WebDavClient(n2, a2, i2), t3 = await e2.getBackupList(folderName);
      openFileListDialogFn(t3, e2, "WebDav");
    } catch (o2) {
      clog.error(o2), show.error(`发生错误: ${o2 ? o2.message : o2}`);
    } finally {
      s2.close();
    }
  }
  __name(backupListBtnByWebDav, "backupListBtnByWebDav");
  function openFileListDialogMobile(e2, t2, n2, folderName, showDiffPreviewFn) {
    const formatSize = /* @__PURE__ */ __name((size) => {
      const units = ["B", "KB", "MB", "GB", "TB", "PB"];
      let i2 = 0, s2 = size;
      for (; s2 >= 1024 && i2 < units.length - 1; ) s2 /= 1024, i2++;
      return `${s2 % 1 == 0 ? s2.toFixed(0) : s2.toFixed(2)} ${units[i2]}`;
    }, "formatSize");
    const renderCards = /* @__PURE__ */ __name((files) => {
      if (!files || files.length === 0) {
        return '<div class="jhs-backup-empty">暂无数据</div>';
      }
      return files.map((file, idx) => `
                <div class="jhs-backup-card" data-idx="${idx}">
                    <div class="jhs-backup-card-name">${escapeHtml(file.name)}</div>
                    <div class="jhs-backup-card-meta">${formatSize(file.size)} · ${utils.getNowStr("-", ":", file.createTime)}</div>
                    <div class="jhs-backup-card-actions">
                        <button class="jhs-btn jhs-backup-btn jhs-backup-btn-danger" data-action="delete" data-idx="${idx}">删除</button>
                        <button class="jhs-btn jhs-backup-btn jhs-backup-btn-primary" data-action="download" data-idx="${idx}">下载</button>
                        <button class="jhs-btn jhs-backup-btn jhs-backup-btn-success" data-action="import" data-idx="${idx}">导入</button>
                    </div>
                </div>
            `).join("");
    }, "renderCards");
    const containerId = "jhs-backup-card-list";
    layer.open({
      type: 1,
      title: n2 + "备份文件",
      content: `<div id="${containerId}" class="jhs-backup-cards">${renderCards(e2)}</div>`,
      area: utils.getResponsiveArea(["800px", "70%"]),
      anim: -1,
      success: /* @__PURE__ */ __name((layerEl) => {
        const container = $(layerEl).find(`#${containerId}`);
        container.on("click", ".jhs-backup-btn", async (ev) => {
          const btn = $(ev.currentTarget);
          const action = btn.data("action");
          const idx = btn.data("idx");
          const file = e2[idx];
          if (!file) return;
          if (action === "delete") {
            layer.confirm(`是否删除 ${file.name} ?`, {
              icon: 3,
              title: "提示",
              btn: ["确定", "取消"]
            }, async (confirmIdx) => {
              layer.close(confirmIdx);
              let load = loading();
              try {
                await t2.deleteFile(file.fileId);
                e2 = await t2.getBackupList(folderName);
                container.html(renderCards(e2));
                layer.alert("删除成功");
              } catch (err) {
                clog.error(err), show.error(`发生错误: ${err ? err.message : err}`);
              } finally {
                load.close();
              }
            });
          } else if (action === "download") {
            let load = loading();
            try {
              const data = await decryptData(await t2.getFileContent(file.fileId));
              utils.download(data, file.name);
            } catch (err) {
              clog.error(err), show.error("下载失败: " + err);
            } finally {
              load.close();
            }
          } else if (action === "import") {
            let load = loading();
            try {
              let data = await t2.getFileContent(file.fileId);
              data = await decryptData(data);
              const parsed = JSON.parse(data);
              const currentData = await storageManager.exportData();
              const diff = await storageManager.diffData(currentData, parsed);
              load.close();
              showDiffPreviewFn(diff, null, parsed);
            } catch (err) {
              load.close(), clog.error(err), show.error("预览失败: " + (err ? err.message : err));
            }
          }
        });
      }, "success")
    });
  }
  __name(openFileListDialogMobile, "openFileListDialogMobile");
  function openFileListDialog(e2, t2, n2, folderName, showDiffPreviewFn) {
    if (utils.isMobileMode()) {
      openFileListDialogMobile(e2, t2, n2, folderName, showDiffPreviewFn);
      return;
    }
    layer.open({
      type: 1,
      title: n2 + "备份文件",
      content: '\n                <div class="jhs-table-dialog"> \n                    <div id="table-container" class="jhs-table-dialog__content"></div>\n                </div>\n            ',
      area: utils.getResponsiveArea(["800px", "70%"]),
      anim: -1,
      success: /* @__PURE__ */ __name((a2) => {
        const i2 = new Tabulator("#table-container", {
          layout: "fitColumns",
          placeholder: "暂无数据",
          virtualDom: true,
          data: e2,
          responsiveLayout: "collapse",
          responsiveLayoutCollapse: true,
          columnDefaults: {
            headerHozAlign: "center",
            hozAlign: "center"
          },
          columns: [{
            title: "文件名",
            field: "name",
            width: 200,
            headerSort: false,
            responsive: 0
          }, {
            title: "文件大小",
            field: "size",
            responsive: 1,
            headerSort: false,
            formatter: /* @__PURE__ */ __name((e3, t3, n3) => {
              const a3 = ["B", "KB", "MB", "GB", "TB", "PB"];
              let i3 = 0, s2 = e3.getData().size;
              for (; s2 >= 1024 && i3 < a3.length - 1; ) s2 /= 1024, i3++;
              return `${s2 % 1 == 0 ? s2.toFixed(0) : s2.toFixed(2)} ${a3[i3]}`;
            }, "formatter")
          }, {
            title: "备份日期",
            field: "createTime",
            responsive: 2,
            headerSort: false,
            formatter: /* @__PURE__ */ __name((e3, t3, n3) => {
              const a3 = e3.getData();
              return `${utils.getNowStr("-", ":", a3.createTime)}`;
            }, "formatter")
          }, {
            title: "操作",
            minWidth: 250,
            responsive: 0,
            headerSort: false,
            formatter: /* @__PURE__ */ __name((e3, a3, s2) => {
              const o2 = e3.getData();
              return s2((() => {
                const a4 = e3.getElement().querySelector(".backup-delete"), s3 = e3.getElement().querySelector(".backup-download"), r2 = e3.getElement().querySelector(".backup-import");
                a4 && a4.addEventListener("click", ((e4) => {
                  layer.confirm(`是否删除 ${o2.name} ?`, {
                    icon: 3,
                    title: "提示",
                    btn: ["确定", "取消"]
                  }, (async (e5) => {
                    layer.close(e5);
                    let a5 = loading();
                    try {
                      await t2.deleteFile(o2.fileId);
                      let e6 = await t2.getBackupList(folderName);
                      i2.replaceData(e6), layer.alert("删除成功");
                    } catch (s4) {
                      clog.error(s4), show.error(`发生错误: ${s4 ? s4.message : s4}`);
                    } finally {
                      a5.close();
                    }
                  }));
                })), s3 && s3.addEventListener("click", (async (e4) => {
                  let a5 = loading();
                  try {
                    const e5 = await decryptData(await t2.getFileContent(o2.fileId));
                    utils.download(e5, o2.name);
                  } catch (i3) {
                    clog.error(i3), show.error("下载失败: " + i3);
                  } finally {
                    a5.close();
                  }
                })), r2 && r2.addEventListener("click", (async (e4) => {
                  let a5 = loading();
                  try {
                    let e5 = await t2.getFileContent(o2.fileId);
                    e5 = await decryptData(e5);
                    const n3 = JSON.parse(e5), i3 = await storageManager.exportData(), s4 = await storageManager.diffData(i3, n3);
                    a5.close(), showDiffPreviewFn(s4, null, n3);
                  } catch (i3) {
                    a5.close(), clog.error(i3), show.error("预览失败: " + (i3 ? i3.message : i3));
                  }
                }));
              })), '\n                                    <button type="button" class="jhs-btn jhs-btn--danger backup-delete">删除</button>\n                                    <button type="button" class="jhs-btn jhs-btn--secondary backup-download">下载</button>\n                                    <button type="button" class="jhs-btn jhs-btn--primary backup-import">导入</button>\n                                ';
            }, "formatter")
          }],
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
      }, "success")
    });
  }
  __name(openFileListDialog, "openFileListDialog");
  async function exportSettingData() {
    try {
      const e2 = JSON.stringify(await storageManager.exportData()), t2 = `${utils.getNowStr("_", "_")}.json`;
      utils.download(e2, t2), show.ok("数据导出成功");
    } catch (t2) {
      clog.error(t2), show.error("导出数据时出错: " + t2.message);
    }
  }
  __name(exportSettingData, "exportSettingData");
  var _SettingPlugin = class _SettingPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "folderName", "JHS-数据备份"), i(this, "resourceSettings", new ResourceSettingsService()), i(this, "pendingCarImport", null), i(this, "cacheItems", [{
        key: "jhs_dmm_video",
        text: "预览视频缓存",
        title: "预览视频缓存"
      }, {
        key: "jhs_other_site",
        text: "第三方站点缓存",
        title: "第三方站点资源检测结果, 如missav,123Av等"
      }, {
        key: "jhs_screenShot",
        text: "缩略图缓存",
        title: "缩略图缓存"
      }, {
        key: "jhs_translate",
        text: "标题翻译",
        title: "标题翻译"
      }, {
        key: "jhs_actress_info",
        text: "演员信息",
        title: "演员的年龄三围等数据信息"
      }, {
        key: "jhs_score_info",
        text: "Top250|热播 评分数据",
        title: "Top250及热播的评分数据"
      }, {
        key: "third_party_ttl_cache",
        text: "第三方TTL缓存",
        title: "评论、相关清单、磁力搜索、缩略图等请求缓存"
      }, {
        key: "_circuitBreaker",
        text: "熔断状态",
        title: "各站点的熔断计数和状态"
      }, {
        key: "_domainStats",
        text: "域名请求统计",
        title: "各域名的请求次数和错误统计"
      }]);
    }
    getName() {
      return "SettingPlugin";
    }
    async initCss() {
      const e2 = await storageManager.getSetting();
      let t2 = (null == e2 ? void 0 : e2.containerWidth) ?? "100";
      utils.isMobileMode() && (t2 = "100");
      let n2 = utils.isMobileMode() ? 1 : (null == e2 ? void 0 : e2.containerColumns) ?? 5;
      window.getBeanForSetting = this.getBean.bind(this);
      applyImageMode().catch(((e3) => clog.error("[JHS] applyImageMode failed:", e3)));
      return buildSettingCss(t2, n2, l, r);
    }
    async handle() {
      await storageManager.getSetting("enableClog", _) === _ && clog.show();
      if (utils.isMobileMode()) return;
      if (r) {
        let e2 = /* @__PURE__ */ __name(function() {
          $(".navbar-search").is(":hidden") ? ($(".mini-setting-box").hide(), $(".setting-box").show()) : ($(".mini-setting-box").show(), $(".setting-box").hide());
        }, "e");
        $("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box jhs-setting-nav-item">\n                    <button type="button" id="setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-nav-button">\n                        设置\n                    </button>\n                    <div class="simple-setting"></div>\n                </div>'), utils.loopDetector((() => $("#miniHistoryBtn").length > 0), (() => {
          $(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box jhs-mini-setting-box">\n                        <button type="button" id="mini-setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-mini-setting-trigger">\n                            设置\n                        </button>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '), e2();
        })), $(window).resize(e2);
      }
      l && (isDetailPage ? $("h3").before('\n                    <div class="container-fluid jhs-setting-detail-anchor">\n                        <div id="top-right-box" class="jhs-setting-anchor">\n                            <div class="setting-box">\n                                <button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark">\n                                    <span>设置</span>\n                                </button>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ') : window.isListPage && utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
        $("#waitCheckBtn").parent().append('\n                    <div id="top-right-box" class="jhs-setting-anchor">\n                        <div class="setting-box">\n                            <button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark">\n                                <span>设置</span>\n                            </button>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ');
      }), 1, 1e4, false)), $(".main-nav, .container-fluid").on("click", "#setting-btn, #mini-setting-btn", (() => {
        $(".simple-setting, .mini-simple-setting").html("").hide(), clog.lowZIndex(), void this.openSettingDialog().catch(((error) => clog.error("设置中心打开失败", error)));
      })), $(".main-nav, .container-fluid").on("mouseenter", ".setting-box", (async () => {
        $(".simple-setting").html(buildQuickSettingHtml()).show();
        try {
          await initQuickSettingForm(this.getBean.bind(this), this.getSelector.bind(this), this.openSettingDialog.bind(this));
        } catch (error) {
          clog.warn("桌面快捷设置初始化失败", error);
        }
        clog.lowZIndex();
      })).on("mouseleave", ".setting-box", (() => {
        $(".simple-setting").html("").hide();
      })), $(".main-nav, .container-fluid").on("mouseenter", ".mini-setting-box", (async () => {
        $(".mini-simple-setting").html(buildQuickSettingHtml()).show();
        try {
          await initQuickSettingForm(this.getBean.bind(this), this.getSelector.bind(this), this.openSettingDialog.bind(this));
        } catch (error) {
          clog.warn("迷你快捷设置初始化失败", error);
        }
        clog.lowZIndex();
      })).on("mouseleave", ".mini-setting-box", (() => {
        $(".mini-simple-setting").html("").hide();
      }));
    }
    /** Open shared quick settings in the mobile bottom sheet. */
    async openQuickSetting() {
      $("#jhs-quick-setting-backdrop, #jhs-quick-setting-sheet").remove();
      const previousFocus = document.activeElement;
      let closed = false;
      const closeQuickSetting = /* @__PURE__ */ __name((restoreFocus = true) => {
        if (closed) return;
        closed = true, $(document).off("keydown.jhsQuickSetting"), $("#jhs-quick-setting-backdrop, #jhs-quick-setting-sheet").remove();
        restoreFocus && previousFocus?.isConnected && "function" == typeof previousFocus.focus && previousFocus.focus();
      }, "closeQuickSetting");
      const backdrop = $('<div id="jhs-quick-setting-backdrop" class="jhs-quick-setting-backdrop"></div>');
      const sheet = $(`<section id="jhs-quick-setting-sheet" class="jhs-quick-setting-sheet jhs-ui" role="dialog" aria-modal="true" aria-labelledby="jhs-quick-setting-title">
            <header class="jhs-quick-setting__header"><h2 id="jhs-quick-setting-title">快捷设置</h2><button type="button" class="jhs-btn jhs-btn--ghost jhs-quick-setting__close" aria-label="关闭快捷设置">×</button></header>
            <div class="jhs-quick-setting"></div>
        </section>`);
      sheet.find(".jhs-quick-setting").html(buildQuickSettingHtml()), $("body").append(backdrop, sheet), clog.lowZIndex();
      backdrop.on("click.jhsQuickSetting", (() => closeQuickSetting())), sheet.on("click.jhsQuickSetting", ".jhs-quick-setting__close", (() => closeQuickSetting())), $(document).off("keydown.jhsQuickSetting").on("keydown.jhsQuickSetting", ((event) => {
        if ("Escape" === event.key) return event.preventDefault(), closeQuickSetting();
        if ("Tab" !== event.key) return;
        const focusable = sheet.find('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])').filter(((index, element) => !element.hidden && "true" !== element.getAttribute("aria-hidden")));
        if (!focusable.length) return void event.preventDefault();
        const first = focusable[0], last = focusable[focusable.length - 1];
        event.shiftKey && document.activeElement === first ? (event.preventDefault(), last.focus()) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), first.focus());
      }));
      try {
        await initQuickSettingForm(this.getBean.bind(this), this.getSelector.bind(this), ((panel) => {
          closeQuickSetting(false), void this.openSettingDialog(panel).catch(((error) => clog.error("完整设置打开失败", error)));
        })), sheet.find(".jhs-quick-setting__close").trigger("focus");
      } catch (error) {
        closeQuickSetting(), clog.error("快捷设置初始化失败", error), show.error("快捷设置加载失败");
      }
    }
    async openSettingDialog(e2 = "backup-panel", t2) {
      const a2 = this.getBean("CoverButtonPlugin");
      const s2 = buildSettingDialogHtml(e2, this.cacheItems, a2);
      layer.open({
        type: 1,
        title: "设置",
        content: s2,
        area: utils.getDialogArea("lg"),
        scrollbar: false,
        success: /* @__PURE__ */ __name(async (e3, n2) => {
          $(e3).find(".layui-layer-content").css("position", "relative"), injectHealthPanel(), injectPluginMgmtPanel(), injectSnapshotPanel(), injectNetworkPanel(), injectResourceSourcesPanel(), await loadSettingForm(this.getBean.bind(this)), await this.loadResourceSettings(), JhsSelect.enhance(e3), this.bindClick(), $(".side-menu-item.active").attr("aria-current", "page"), utils.setupEscClose(n2), t2 && t2();
          if (utils.isMobileMode()) {
            this.collapseAdvancedTabs();
          }
        }, "success"),
        end: /* @__PURE__ */ __name(() => {
          this.getBean("CoverButtonPlugin").enableSvgBtn();
        }, "end")
      });
    }
    collapseAdvancedTabs() {
      const advancedPanels = [
        { id: "health-panel", label: "数据体检", render: renderDataHealthPanel },
        { id: "plugin-mgmt-panel", label: "插件管理", render: renderPluginMgmtPanel },
        { id: "snapshot-panel", label: "恢复点", render: renderSnapshotPanel },
        { id: "network-panel", label: "外部请求", render: renderNetworkPanel }
      ];
      const sidebar = $(".jhs-mobile-sidebar");
      const contentParent = $(".content-panel").parent();
      if (!sidebar.length || !contentParent.length) return;
      advancedPanels.forEach((p2) => {
        sidebar.find(`[data-panel="${p2.id}"]`).remove();
      });
      if (!sidebar.find('[data-panel="more-tools-panel"]').length) {
        sidebar.append('<button type="button" class="jhs-btn side-menu-item" data-panel="more-tools-panel" aria-controls="more-tools-panel">更多工具</button>');
      }
      if ($("#more-tools-panel").length) return;
      let subTabsHtml = advancedPanels.map(
        (p2, i2) => `<button type="button" role="tab" aria-selected="${i2 === 0}" tabindex="${i2 === 0 ? "0" : "-1"}" class="jhs-btn jhs-sub-tab${i2 === 0 ? " active" : ""}" data-sub-panel="${p2.id}">${p2.label}</button>`
      ).join("");
      let subPanelsHtml = advancedPanels.map(
        (p2, i2) => `<div id="sub-${p2.id}" class="jhs-sub-panel${i2 === 0 ? " active" : ""}" data-rendered="false"></div>`
      ).join("");
      const wrapperHtml = `
            <div id="more-tools-panel" class="content-panel jhs-more-tools-panel">
                <div class="jhs-sub-tabs" role="tablist" aria-label="更多工具">${subTabsHtml}</div>
                <div class="jhs-sub-panels">${subPanelsHtml}</div>
            </div>
        `;
      contentParent.append(wrapperHtml);
      advancedPanels.forEach((p2) => {
        const src = $(`#${p2.id}`);
        if (src.length) {
          src.children().appendTo(`#sub-${p2.id}`);
          src.remove();
          $(`#sub-${p2.id}`).attr("data-rendered", "true");
        }
      });
      sidebar.on("click", '[data-panel="more-tools-panel"]', function() {
        $(".side-menu-item").removeClass("active").attr("aria-current", "false"), $(this).addClass("active").attr("aria-current", "page"), $(".content-panel").hide();
        $("#more-tools-panel").show(), $("#saveBtn").show(), $("#clean-all").addClass("jhs-is-hidden");
      });
      $("#more-tools-panel").on("click", ".jhs-sub-tab", function() {
        const target = $(this).data("sub-panel");
        $("#more-tools-panel .jhs-sub-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
        $(this).addClass("active").attr({ "aria-selected": "true", tabindex: "0" });
        $("#more-tools-panel .jhs-sub-panel").removeClass("active");
        $(`#sub-${target}`).addClass("active");
        if ($(`#sub-${target}`).attr("data-rendered") !== "true") {
          $(`#sub-${target}`).attr("data-rendered", "true");
        }
        const panel = advancedPanels.find((p2) => p2.id === target);
        if (panel && panel.render) {
          panel.render();
        }
      }).on("keydown", ".jhs-sub-tab", function(e2) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e2.key)) return;
        e2.preventDefault();
        const tabs = $("#more-tools-panel .jhs-sub-tab"), current = tabs.index(this);
        const next = e2.key === "Home" ? 0 : e2.key === "End" ? tabs.length - 1 : e2.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
        tabs.eq(next).trigger("click").trigger("focus");
      });
    }
    bindClick() {
      const settingPlugin = this;
      $(".side-menu-item").on("click", (function() {
        $(".side-menu-item").removeClass("active").attr("aria-current", "false"), $(this).addClass("active").attr("aria-current", "page"), $(".content-panel").hide();
        const e3 = $(this).data("panel");
        $("#" + e3).show(), "cache-panel" === e3 ? ($("#saveBtn").hide(), $("#clean-all").removeClass("jhs-is-hidden")) : ($("#saveBtn").show(), $("#clean-all").addClass("jhs-is-hidden")), "health-panel" === e3 && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderDataHealthPanel()), "plugin-mgmt-panel" === e3 && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderPluginMgmtPanel()), "snapshot-panel" === e3 && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderSnapshotPanel()), "network-panel" === e3 && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderNetworkPanel());
      })), $("#importBtn").on("click", ((e3) => importSettingData(showDiffPreview))), $("#exportBtn").on("click", ((e3) => exportSettingData())), $("#preview-car-number-import").on("click", (() => this.previewCarNumbers())), $("#confirm-car-number-import").on("click", (async (e3) => this.confirmCarNumbers(e3))), $("#webdavBackupBtn").on("click", ((e3) => backupDataByWebDav(this.folderName))), $("#webdavBackupListBtn").on("click", ((e3) => backupListBtnByWebDav(this.folderName, (files, client, label) => openFileListDialog(files, client, label, this.folderName, showDiffPreview)))), $("#saveBtn").on("click", (() => saveSettingForm(this.getBean.bind(this)))), $("#runHealthCheckBtn").on("click", (() => renderDataHealthPanel())), $("#repairHealthBtn").on("click", ((e3) => {
        utils.q(e3, "修复前会自动下载备份，是否继续?", (() => repairDataHealthWithBackup()));
      })), $("#pm-clear-log").on("click", (() => {
        unsafeWindow.pluginManager.clearErrorLog(), $("#plugin-error-log").text("无错误记录"), show.ok("错误日志已清空");
      })), $("#createSnapshotBtn").on("click", (async () => {
        let e3 = loading();
        try {
          await storageManager.createSnapshot("手动快照", "manual"), show.ok("快照创建成功"), renderSnapshotPanel();
        } catch (t3) {
          clog.error(t3), show.error("创建快照失败: " + t3.message);
        } finally {
          e3.close();
        }
      })), $(".clean-btn").on("click", (async (e3) => {
        const t3 = $(e3.currentTarget).data("key"), n3 = this.cacheItems.find(((e4) => e4.key === t3));
        t3 === storageManager.third_party_cache_key ? await storageManager.clearThirdPartyCache() : "_circuitBreaker" === t3 ? gmHttp.resetAllCircuitBreakers() : "_domainStats" === t3 ? gmHttp.clearDomainStats() : localStorage.removeItem(t3), show.ok(`${n3.text} 清理成功`), $("#cache-data-display").addClass("jhs-is-hidden"), "jhs_dmm_video" === t3 && localStorage.removeItem("jhs_other_site_dmm");
      })), $("#clean-all").on("click", (async () => {
        this.cacheItems.forEach(((e3) => localStorage.removeItem(e3.key))), show.ok("全部缓存已清理"), $("#cache-data-display").addClass("jhs-is-hidden"), localStorage.removeItem("jhs_other_site_dmm"), await storageManager.clearThirdPartyCache();
      })), $(".view-btn").on("click", (async (e3) => {
        const t3 = $(e3.currentTarget).data("key");
        let n3;
        if (t3 === storageManager.third_party_cache_key) n3 = JSON.stringify(await storageManager.getThirdPartyCache());
        else if ("_circuitBreaker" === t3) n3 = JSON.stringify(gmHttp.getCircuitBreakerStatus());
        else if ("_domainStats" === t3) n3 = JSON.stringify(gmHttp.getDomainStats());
        else n3 = localStorage.getItem(t3);
        const a3 = $("#cache-data-display"), i2 = a3.find("pre");
        if (a3.removeClass("jhs-is-hidden"), n3) try {
          const e4 = JSON.parse(n3);
          i2.text(JSON.stringify(e4, null, 2));
        } catch {
          i2.text(n3);
        }
        else i2.text("无数据");
      }));
      const e2 = $("#highlightedTagNumber"), t2 = $("#highlightedTagColor"), n2 = $("#highlightedTagLabel");
      function a2() {
        const a3 = e2.val(), i2 = t2.val();
        n2.css("border", `${a3}px solid ${i2}`);
      }
      __name(a2, "a");
      e2.on("input", a2), t2.on("input", a2);
      $("#themeMode").on("change", (async function() {
        await storageManager.saveSettingItem("themeMode", $(this).val()), applyTheme();
      }));
    }
    async loadResourceSettings() {
      const [custom, tags, filters, builtInOverrides, screenshot, cloud] = await Promise.all([this.resourceSettings.getMagnetSources(), this.resourceSettings.getMagnetTagRules(), this.resourceSettings.getMagnetFilterRules(), this.resourceSettings.getBuiltInSources(), this.resourceSettings.getScreenshotSettings(), this.resourceSettings.getCloudSettings()]);
      this.resourceState = { custom, tags, filters, builtIn: BUILT_IN_MAGNET_SOURCES.map(((source) => ({ ...source, ...builtInOverrides.find(((item) => item.id === source.id)) || {} }))), screenshot: { mode: screenshot.mode, providers: BUILT_IN_SCREENSHOT_SOURCES.map(((source) => {
        const merged = { ...source, ...screenshot.providers.find(((item) => item.id === source.id)) || {} };
        return false === source.implemented ? { ...merged, enabled: false } : merged;
      })) } };
      this.renderResourceSettings();
      $("#enable123Offline").prop("checked", cloud.enable123Offline);
      $("#enable115Offline").prop("checked", cloud.enable115Offline);
      $("#offlineProviderMode").val(cloud.providerMode);
      $("#enable115Match").prop("checked", cloud.enable115Match);
      $("#enable115LoginRedirect").prop("checked", cloud.enable115LoginRedirect);
      $("#oneOneFiveConcurrency").val(cloud.concurrency);
      $("#oneOneFiveCacheMinutes").val(cloud.cacheMinutes);
      $("#cloud-services-panel").off("change.jhsResource", "input, select").on("change.jhsResource", "input, select", (() => void this.saveCloudSettings()));
      $("#resource-sources-panel").off("change.jhsResource", 'input[name="screenshotMode"]').on("change.jhsResource", 'input[name="screenshotMode"]', ((event) => {
        this.resourceState.screenshot.mode = event.currentTarget.value;
        this.resourceSettings.saveScreenshotSettings(this.resourceState.screenshot);
      }));
      $("#add-custom-magnet-source").off("click.jhsResource").on("click.jhsResource", (() => this.openSourceDialog()));
      $("#add-magnet-tag-rule").off("click.jhsResource").on("click.jhsResource", (() => this.openRuleDialog("tag")));
      $("#add-magnet-filter-rule").off("click.jhsResource").on("click.jhsResource", (() => this.openRuleDialog("filter")));
      $("#export-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => $("#advanced-resource-json").val(JSON.stringify(await this.resourceSettings.exportConfig(), null, 2)).prop("readonly", true)));
      $("#edit-resource-config").off("click.jhsResource").on("click.jhsResource", (() => $("#advanced-resource-json").prop("readonly", false).trigger("focus")));
      $("#import-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => {
        try {
          await this.resourceSettings.importConfig($("#advanced-resource-json").val());
          show.ok("资源配置导入成功");
          await this.loadResourceSettings();
        } catch (error) {
          show.error(error.message);
        }
      }));
      $("#car-number-import,#car-number-import-status").off("input.jhsResource change.jhsResource").on("input.jhsResource change.jhsResource", (() => {
        this.pendingCarImport = null;
        $("#confirm-car-number-import").prop("disabled", true).text("确认导入");
      }));
      $("#check-one-one-five-login").off("click.jhsResource").on("click.jhsResource", (() => this.checkOneOneFiveLogin()));
    }
    renderResourceSettings() {
      const card = /* @__PURE__ */ __name((source, custom, kind) => {
        const node = $('<article class="jhs-card jhs-resource-card"></article>');
        node.append($('<div class="jhs-setting-row"></div>').append($("<div></div>").append($("<strong></strong>").text(source.name), source.experimental ? '<span class="jhs-badge">实验性</span>' : "", $("<small></small>").text(`${source.type || "截图来源"} · ${source.domain || (() => {
          try {
            return new URL(source.searchUrlTemplate).hostname;
          } catch {
            return "未配置域名";
          }
        })()} · 优先级 ${source.priority}`)), $('<input type="checkbox" class="mini-switch jhs-source-toggle">').prop("checked", source.enabled)));
        const actions = $('<div class="jhs-toolbar"></div>').append('<button type="button" class="jhs-btn jhs-source-test">测试</button>');
        if (custom) actions.append('<button type="button" class="jhs-btn jhs-source-edit">编辑</button><button type="button" class="jhs-btn jhs-btn--danger jhs-source-delete">删除</button>');
        node.append(actions);
        node.on("change", ".jhs-source-toggle", async (event) => {
          source.enabled = event.currentTarget.checked;
          "screenshot" === kind ? await this.resourceSettings.saveScreenshotSettings(this.resourceState.screenshot) : custom ? await this.resourceSettings.saveMagnetSources(this.resourceState.custom) : await this.resourceSettings.saveBuiltInSources(this.resourceState.builtIn);
        });
        node.on("click", ".jhs-source-test", (event) => this.testSource(event.currentTarget, source.baseUrl || source.searchUrlTemplate?.replace("{keyword}", "test")));
        custom && node.on("click", ".jhs-source-edit", (() => this.openSourceDialog(source))).on("click", ".jhs-source-delete", ((event) => utils.q(event, `确认删除来源「${source.name}」？`, (async () => {
          this.resourceState.custom = this.resourceState.custom.filter(((item) => item.id !== source.id));
          await this.resourceSettings.saveMagnetSources(this.resourceState.custom);
          this.renderResourceSettings();
        }))));
        return node;
      }, "card");
      $("#builtin-magnet-source-list").empty().append(this.resourceState.builtIn.map(((source) => card(source, false, "magnet"))));
      $("#custom-magnet-source-list").empty().append(this.resourceState.custom.length ? this.resourceState.custom.map(((source) => card(source, true, "magnet"))) : '<p class="jhs-setting-help">暂无自定义来源</p>');
      $("#screenshot-source-list").empty().append(this.resourceState.screenshot.providers.map(((source) => card(source, false, "screenshot"))));
      this.resourceState.screenshot.providers.forEach(((source, index) => {
        if (false === source.implemented) $("#screenshot-source-list .jhs-resource-card").eq(index).find(".jhs-source-toggle").prop("disabled", true).end().find("strong").after('<span class="jhs-badge">未实现</span>').end().find(".jhs-source-test").remove();
      }));
      $(`input[name="screenshotMode"][value="${this.resourceState.screenshot.mode}"]`).prop("checked", true);
      this.renderRules("tag");
      this.renderRules("filter");
    }
    renderRules(kind) {
      const list = "tag" === kind ? this.resourceState.tags : this.resourceState.filters, host = $("#magnet-" + kind + "-rule-list").empty();
      if (!list.length) host.append('<p class="jhs-setting-help">暂无规则</p>');
      list.forEach(((rule) => {
        const node = $('<article class="jhs-card"></article>').append($("<strong></strong>").text(rule.name), $("<p></p>").text(`${"regex" === rule.type ? "正则" : "包含"}：${rule.pattern}${"tag" === kind ? ` · 权重 ${Number(rule.weight) >= 0 ? "+" : ""}${rule.weight || 0}` : ` · ${"hide" === rule.action ? "隐藏" : `降权 ${rule.penalty || -20}`}`}`), '<div class="jhs-toolbar"><button class="jhs-btn jhs-rule-edit">编辑</button><button class="jhs-btn jhs-btn--danger jhs-rule-delete">删除</button></div>');
        node.on("click", ".jhs-rule-edit", (() => this.openRuleDialog(kind, rule))).on("click", ".jhs-rule-delete", ((event) => utils.q(event, `确认删除规则「${rule.name}」？`, (async () => {
          const key = "tag" === kind ? "tags" : "filters";
          this.resourceState[key] = this.resourceState[key].filter(((item) => item.id !== rule.id));
          await ("tag" === kind ? this.resourceSettings.saveMagnetTagRules(this.resourceState[key]) : this.resourceSettings.saveMagnetFilterRules(this.resourceState[key]));
          this.renderRules(kind);
        }))));
        host.append(node);
      }));
    }
    openSourceDialog(existing = null) {
      const fields = ["rowSelector", "titleSelector", "magnetSelector", "sizeSelector", "dateSelector", "seedersSelector", "leechersSelector", "resultsPath", "titlePath", "magnetPath", "hashPath", "sizePath", "datePath", "seedersPath"];
      const content = $(`<div class="jhs-setting-section jhs-resource-form"><label>名称<input name="name" class="jhs-field"></label><label>启用<input name="enabled" type="checkbox" class="mini-switch"></label><label>优先级<input name="priority" type="number" class="jhs-field" min="1"></label><label>搜索地址模板<input name="searchUrlTemplate" class="jhs-field"></label><label>原网页地址模板<input name="targetUrlTemplate" class="jhs-field"></label><label>解析类型<select name="parserType" class="jhs-select-source"><option value="magnet-links">自动寻找磁力链接</option><option value="torrent-table">表格/列表页面</option><option value="json">JSON API</option></select></label><div class="jhs-parser-fields"></div></div>`);
      const renderFields = /* @__PURE__ */ __name(() => {
        const type = content.find('[name="parserType"]').val(), names = "torrent-table" === type ? fields.slice(0, 7) : "json" === type ? fields.slice(7) : [];
        content.find(".jhs-parser-fields").html(names.map(((name) => `<label>${name}<input name="${name}" class="jhs-field"></label>`)).join(""));
        names.forEach(((name) => content.find(`[name="${name}"]`).val(existing?.[name] || "")));
      }, "renderFields");
      Object.entries(existing || { enabled: true, priority: 100, parserType: "magnet-links" }).forEach(([key, value]) => {
        const input = content.find(`[name="${key}"]`);
        "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value);
      });
      content.on("change", '[name="parserType"]', renderFields);
      renderFields();
      content.appendTo("body").hide();
      layer.open({ type: 1, title: existing ? "编辑自定义磁力源" : "添加自定义磁力源", content, area: utils.getDialogArea("md"), btn: ["保存", "取消"], success: /* @__PURE__ */ __name(() => content.show(), "success"), end: /* @__PURE__ */ __name(() => content.remove(), "end"), yes: /* @__PURE__ */ __name(async (index) => {
        const form = Object.fromEntries(content.find("input,select").map(((i2, element) => [element.name, "checkbox" === element.type ? element.checked : element.value])).get());
        try {
          const source = buildCustomMagnetSource(form, existing);
          const target = existing ? this.resourceState.custom.findIndex(((item) => item.id === existing.id)) : -1;
          target >= 0 ? this.resourceState.custom.splice(target, 1, source) : this.resourceState.custom.push(source);
          await this.resourceSettings.saveMagnetSources(this.resourceState.custom);
          layer.close(index);
          this.renderResourceSettings();
        } catch (error) {
          show.error(error.message);
        }
      }, "yes") });
    }
    openRuleDialog(kind, existing = null) {
      const isTag = "tag" === kind, content = $(`<div class="jhs-setting-section"><label>名称<input name="name" class="jhs-field"></label>${isTag ? "" : '<label>匹配范围<select name="target" class="jhs-select-source"><option value="title">标题</option><option value="file">文件名</option></select></label>'}<label>匹配方式<select name="type" class="jhs-select-source"><option value="contains">包含</option><option value="regex">正则</option></select></label><label>匹配内容<input name="pattern" class="jhs-field"></label>${isTag ? '<label>权重<input name="weight" type="number" class="jhs-field"></label>' : '<label>动作<select name="action" class="jhs-select-source"><option value="hide">隐藏</option><option value="penalty">降权</option></select></label><label>降权分数<input name="penalty" type="number" class="jhs-field"></label>'}<label>启用<input name="enabled" type="checkbox" class="mini-switch"></label></div>`);
      Object.entries(existing || { enabled: true, type: "contains", weight: 0, action: "hide", penalty: -20 }).forEach(([key, value]) => {
        const input = content.find(`[name="${key}"]`);
        "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value);
      });
      content.appendTo("body").hide();
      layer.open({ type: 1, title: `${existing ? "编辑" : "新建"}${isTag ? "标签" : "过滤"}规则`, content, area: utils.getDialogArea("sm"), btn: ["保存", "取消"], success: /* @__PURE__ */ __name(() => content.show(), "success"), end: /* @__PURE__ */ __name(() => content.remove(), "end"), yes: /* @__PURE__ */ __name(async (index) => {
        const rule = Object.fromEntries(content.find("input,select").map(((i2, element) => [element.name, "checkbox" === element.type ? element.checked : element.value])).get());
        rule.id = existing?.id || `rule-${Date.now()}`;
        rule.weight = Number(rule.weight);
        rule.penalty = Number(rule.penalty);
        try {
          validateRule(rule);
          const key = isTag ? "tags" : "filters", target = existing ? this.resourceState[key].findIndex(((item) => item.id === existing.id)) : -1;
          target >= 0 ? this.resourceState[key].splice(target, 1, rule) : this.resourceState[key].push(rule);
          await (isTag ? this.resourceSettings.saveMagnetTagRules(this.resourceState[key]) : this.resourceSettings.saveMagnetFilterRules(this.resourceState[key]));
          layer.close(index);
          this.renderRules(kind);
        } catch (error) {
          show.error(error.message);
        }
      }, "yes") });
    }
    async saveCloudSettings() {
      await this.resourceSettings.saveCloudSettings({ enable123Offline: $("#enable123Offline").is(":checked"), enable115Offline: $("#enable115Offline").is(":checked"), providerMode: $("#offlineProviderMode").val(), enable115Match: $("#enable115Match").is(":checked"), enable115LoginRedirect: $("#enable115LoginRedirect").is(":checked"), concurrency: Number($("#oneOneFiveConcurrency").val()), cacheMinutes: Number($("#oneOneFiveCacheMinutes").val()) });
    }
    async checkOneOneFiveLogin() {
      const badge = $("#one-one-five-state").text("检测中");
      try {
        badge.text(await new OneOneFiveClient().checkLogin() ? "已登录" : "未登录");
      } catch {
        badge.text("检测失败");
      }
    }
    async testSource(button, url) {
      if (!url) return show.info("本站来源无需跨站测试");
      const node = $(button).prop("disabled", true), badge = node.siblings(".jhs-source-test-state").length ? node.siblings(".jhs-source-test-state") : $('<span class="jhs-badge jhs-source-test-state"></span>').insertAfter(node);
      badge.text("检测中");
      try {
        const response = await gmHttp.get(url);
        badge.text(response ? "200 · 可解析" : "空响应");
      } catch (error) {
        badge.text(error?._cfBlocked ? "Cloudflare 拦截" : error?.status === 404 ? "404" : error?._circuitBreaker ? "熔断" : "请求失败");
      } finally {
        node.prop("disabled", false).text("测试");
      }
    }
    previewCarNumbers() {
      const parsed = parseCarNumberText($("#car-number-import").val()), actionType = $("#car-number-import-status").val();
      this.pendingCarImport = actionType && parsed.values.length ? { ...parsed, actionType } : null;
      $("#car-number-import-preview").text(`识别 ${parsed.recognized} 条 · 有效 ${parsed.values.length} · 重复 ${Math.max(0, parsed.recognized - parsed.values.length - parsed.invalid.length)} · 无效 ${parsed.invalid.length}${parsed.invalid.length ? ` · 异常示例：${parsed.invalid.slice(0, 5).join("、")}` : ""}`);
      $("#confirm-car-number-import").prop("disabled", !this.pendingCarImport).text(this.pendingCarImport ? `确认导入 ${parsed.values.length} 条` : "确认导入");
      if (!actionType) show.info("请选择导入状态");
    }
    async confirmCarNumbers(event) {
      if (!this.pendingCarImport) return show.info("请先解析预览");
      const pending = this.pendingCarImport;
      utils.q(event, `确认导入 ${pending.values.length} 条记录？`, (async () => {
        const existing = new Map((await storageManager.getCarList()).map(((item) => [normalizeCarNum(item.carNum), item]))), summary = { added: 0, updated: 0, failed: 0 }, flag = legacyActionToFlag(pending.actionType);
        for (const rawCarNum of pending.values) {
          const carNum = normalizeCarNum(rawCarNum);
          try {
            const current = existing.get(carNum);
            await stateService.patch(carNum, { [flag]: true }, { type: "manual-car-number-import", record: { carNum, url: current?.url || buildFallbackCarUrl(carNum), names: current?.names || "", publishTime: current?.publishTime || "" } });
            current ? summary.updated++ : summary.added++;
          } catch (error) {
            summary.failed++;
            clog.warn(`番号 ${carNum} 导入失败`, error);
          }
        }
        this.pendingCarImport = null;
        $("#confirm-car-number-import").prop("disabled", true);
        show.ok(`导入完成：新增 ${summary.added}，更新 ${summary.updated}，失败 ${summary.failed}`);
      }));
    }
  };
  __name(_SettingPlugin, "SettingPlugin");
  var SettingPlugin = _SettingPlugin;
  var ENCRYPTION_SALT = "x7k9p3";
  async function getEncryptionKey() {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(ENCRYPTION_SALT + ".jhs.v1"), {
      name: "PBKDF2"
    }, false, ["deriveKey"]);
    return crypto.subtle.deriveKey({
      name: "PBKDF2",
      salt: enc.encode("jhs-backup"),
      iterations: 1e5,
      hash: "SHA-256"
    }, keyMaterial, {
      name: "AES-GCM",
      length: 256
    }, false, ["encrypt", "decrypt"]);
  }
  __name(getEncryptionKey, "getEncryptionKey");
  function arrayBufferToBase64(e2) {
    const t2 = new Uint8Array(e2), n2 = 32768;
    let a2 = "";
    for (let i2 = 0; i2 < t2.length; i2 += n2) a2 += String.fromCharCode.apply(null, t2.subarray(i2, i2 + n2));
    return btoa(a2);
  }
  __name(arrayBufferToBase64, "arrayBufferToBase64");
  function base64ToArrayBuffer(e2) {
    const t2 = atob(e2), n2 = new Uint8Array(t2.length);
    for (let a2 = 0; a2 < t2.length; a2++) n2[a2] = t2.charCodeAt(a2);
    return n2;
  }
  __name(base64ToArrayBuffer, "base64ToArrayBuffer");
  async function encryptData(e2) {
    const t2 = await getEncryptionKey(), n2 = crypto.getRandomValues(new Uint8Array(12)), a2 = new TextEncoder(), i2 = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv: n2
    }, t2, a2.encode(e2)), s2 = new Uint8Array(n2.length + i2.byteLength);
    return s2.set(n2), s2.set(new Uint8Array(i2), n2.length), arrayBufferToBase64(s2);
  }
  __name(encryptData, "encryptData");
  async function decryptData(e2) {
    const t2 = await getEncryptionKey(), n2 = base64ToArrayBuffer(e2), a2 = n2.slice(0, 12), i2 = n2.slice(12), s2 = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: a2
    }, t2, i2);
    return new TextDecoder().decode(s2);
  }
  __name(decryptData, "decryptData");
  var CREDENTIAL_PREFIX = "AES:";
  async function encryptCredential(e2) {
    return e2 && !e2.startsWith(CREDENTIAL_PREFIX) ? CREDENTIAL_PREFIX + await encryptData(e2) : e2;
  }
  __name(encryptCredential, "encryptCredential");
  async function decryptCredential(e2) {
    return e2 && e2.startsWith(CREDENTIAL_PREFIX) ? await decryptData(e2.slice(CREDENTIAL_PREFIX.length)) : e2;
  }
  __name(decryptCredential, "decryptCredential");
  var _BusPreviewVideoPlugin = class _BusPreviewVideoPlugin extends BasePlugin {
    getName() {
      return "BusPreviewVideoPlugin";
    }
    async initCss() {
      return "\n            .bus-preview-modal { position:fixed; inset:0; z-index:var(--jhs-z-modal); display:flex; align-items:center; justify-content:center; visibility:hidden; opacity:0; background:rgba(0,0,0,.95); transition:opacity var(--jhs-motion-base) var(--jhs-ease); }\n            .bus-preview-modal.is-open { visibility:visible; opacity:1; }\n            .bus-preview-modal-content { position:relative; display:flex; max-width:95%; max-height:95%; flex-direction:column; align-items:center; gap:var(--jhs-space-3); }\n            .video-player-wrapper { position:relative; width:80vw; max-width:100%; max-height:85vh; aspect-ratio:16/9; background:#000; }\n            .video-player-wrapper #preview-video { position:absolute; inset:0; }\n        ";
    }
    initModal() {
      if (0 === $("#bus-preview-modal").length) {
        $("body").append('\n                <div id="bus-preview-modal" class="bus-preview-modal">\n                    <div class="bus-preview-modal-content">\n                        </div>\n                </div>\n            ');
        const e2 = $("#bus-preview-modal");
        e2.on("click", ((e3) => {
          "bus-preview-modal" === e3.target.id && this.closeVideoModal();
        })), $(document).on("keydown", ((t2) => {
          "Escape" === t2.key && e2.hasClass("is-open") && this.closeVideoModal();
        }));
      }
    }
    closeVideoModal() {
      const e2 = $("#preview-video");
      e2.length > 0 && e2[0].pause(), $("#bus-preview-modal").removeClass("is-open");
    }
    async handle() {
      if (!isDetailPage) return;
      this.initModal();
      const e2 = $("#sample-waterfall .sample-box .photo-frame img:first").attr("src"), t2 = $(`
            <button type="button" class="jhs-btn preview-video-container sample-box jhs-layout-3b6a3a65">
                <div class="photo-frame jhs-layout-87db2275">
                    <img src="${e2}" class="video-cover" alt="">
                    <div class="play-icon jhs-play-overlay">
                        ▶
                    </div>
                </div>
            </button>`);
      $("#sample-waterfall").prepend(t2);
      "yes" === await storageManager.getSetting("enableLoadPreviewVideo", "yes") && fetchDmmPreview(this.getPageInfo().carNum).catch(((e3) => clog.warn("预加载 DMM 失败", e3)));
      let n2 = false, a2 = $(".preview-video-container");
      a2.on("click", (async (e3) => {
        if (e3.preventDefault(), e3.stopPropagation(), n2) show.info("正在加载中, 勿重复点击");
        else {
          n2 = true;
          try {
            await this.handleVideo();
          } finally {
            n2 = false;
          }
        }
      })), window.location.href.includes("autoPlay=1") && a2.trigger("click");
    }
    async handleVideo() {
      const e2 = $("#bus-preview-modal"), t2 = e2.find(".bus-preview-modal-content");
      let n2 = $("#preview-video");
      if (n2.length > 0) return e2.addClass("is-open"), void await safePlay(n2[0], {
        context: "JavBus 预览视频",
        notify: true
      });
      let a2 = this.getPageInfo().carNum;
      const { sources: i2, error: previewError } = await fetchDmmPreview(a2);
      i2 && 0 !== Object.keys(i2).length ? (await this.createVideoPlayerAndControls(i2, t2), n2 = $("#preview-video"), n2.length > 0 ? (e2.addClass("is-open"), await safePlay(n2[0], {
        context: "JavBus 预览视频",
        notify: true,
        message: "REGION_BLOCKED" === previewError?.code ? previewError.message : "当前视频源无法播放"
      })) : show.error("视频播放器创建失败。")) : show.error("REGION_BLOCKED" === previewError?.code ? previewError.message : "未找到可用的视频源。");
    }
    async createVideoPlayerAndControls(e2, t2) {
      let n2 = await storageManager.getSetting("videoQuality");
      n2 = Z(Object.keys(e2), n2);
      let a2 = e2[n2];
      t2.html(`
            <div class="video-player-wrapper">
                <video id="preview-video" class="jhs-video-player" controls playsinline>
                    <source src="${a2}" />
                </video>
            </div>
            <div class="jhs-video-toolbar jhs-video-quality-list" role="group" aria-label="视频画质">
                </div>
        `);
      const i2 = $("#preview-video"), s2 = i2.find("source"), o2 = t2.find(".jhs-video-quality-list");
      if (!i2.length || !s2.length) return;
      const r2 = i2[0], l2 = localStorage.getItem("jhs_videoMuted");
      r2.muted = !l2 || "yes" === l2, i2.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (function() {
        localStorage.setItem("jhs_videoMuted", r2.muted ? "yes" : "no");
      }));
      let c2 = "";
      L.forEach(((t3) => {
        let a3 = e2[t3.quality];
        if (a3) {
          const e3 = n2 === t3.quality;
          c2 += `
                    <button type="button" class="jhs-btn jhs-video-quality-btn${e3 ? " active" : ""}"
                            data-quality="${t3.quality}"
                            data-video-src="${a3}"
                            aria-pressed="${e3 ? "true" : "false"}">
                        ${t3.text}
                    </button>
                `;
        }
      })), o2.html(c2);
      const d2 = o2.find(".jhs-video-quality-btn");
      o2.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async (e3) => {
        try {
          const t3 = $(e3.currentTarget);
          if (t3.hasClass("active")) return;
          let n3 = t3.attr("data-video-src");
          s2.attr("src", n3);
          const a3 = r2.currentTime;
          r2.load(), r2.currentTime = a3, await safePlay(r2, {
            context: "JavBus 画质切换",
            notify: true
          }) && (d2.removeClass("active").attr("aria-pressed", "false"), t3.addClass("active").attr("aria-pressed", "true"));
        } catch (t3) {
          clog.error("切换画质失败:", t3);
        }
      }));
    }
  };
  __name(_BusPreviewVideoPlugin, "BusPreviewVideoPlugin");
  var BusPreviewVideoPlugin = _BusPreviewVideoPlugin;
  var _SearchByImagePlugin = class _SearchByImagePlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "siteList", [{
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
      }]), i(this, "isUploading", false);
    }
    getName() {
      return "SearchByImagePlugin";
    }
    async initCss() {
      return "\n            <style>\n                #upload-area {\n                    border: 2px dashed var(--jhs-status-down);\n                    border-radius: 8px;\n                    padding: 40px;\n                    text-align: center;\n                    margin-bottom: 20px;\n                    transition: all 0.3s;\n                    background-color: var(--jhs-surface-2);\n                }\n                #upload-area:hover {\n                    border-color: var(--jhs-status-down-hover);\n                    background-color: var(--jhs-surface-2);\n                }\n                /* 拖拽进入 */\n                #upload-area.highlight {\n                    border-color: var(--jhs-status-fav);\n                    background-color: var(--jhs-status-fav-tint);\n                }\n                \n                \n                #select-image-btn {\n                    background-color: var(--jhs-status-down);\n                    color: var(--jhs-status-down-on);\n                    border: none;\n                    padding: 10px 20px;\n                    border-radius: var(--jhs-radius-sm);\n                    cursor: pointer;\n                    font-size: 16px;\n                    transition: background-color 0.3s;\n                }\n                #select-image-btn:hover {\n                    background-color: var(--jhs-status-down-hover);\n                }\n                \n                \n                #handle-btn, #cancel-btn {\n                    padding: 8px 16px;\n                    border-radius: var(--jhs-radius-sm);\n                    cursor: pointer;\n                    font-size: 14px;\n                    border: none;\n                    transition: opacity 0.3s;\n                }\n                #handle-btn {\n                    background-color: var(--jhs-status-fav);\n                    color: var(--jhs-status-fav-on);\n                }\n                #handle-btn:hover {\n                    filter: brightness(0.94);\n                }\n                #cancel-btn {\n                    background-color: var(--jhs-status-filter);\n                    color: var(--jhs-status-filter-on);\n                }\n                #cancel-btn:hover {\n                    filter: brightness(0.94);\n                }\n                \n                .search-img-site-btns-container {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 15px;\n                }\n                .search-img-site-btn {\n                    display: flex;\n                    align-items: center;\n                    padding: 8px 12px;\n                    background-color: var(--jhs-surface-2);\n                    border-radius: var(--jhs-radius-sm);\n                    text-decoration: none;\n                    color: var(--jhs-text);\n                    transition: all 0.2s;\n                    font-size: 14px;\n                    border: 1px solid var(--jhs-border);\n                }\n                .search-img-site-btn:hover {\n                    background-color: var(--jhs-border);\n                    transform: translateY(-2px);\n                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);\n                }\n                .search-img-site-btn img {\n                    width: 16px;\n                    height: 16px;\n                    margin-right: 6px;\n                }\n                .search-img-site-btn span {\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    open(e2) {
      layer.open({
        type: 1,
        title: "以图识图",
        content: '\n            <div class="jhs-layout-769fed37">\n                <div id="upload-area">\n                    <div class="jhs-layout-9e3c853e">\n                        <p>拖拽图片到此处 或 点击按钮选择图片</p>\n                        <p>也可以直接 Ctrl+V 粘贴图片或 图片URL</p>\n                    </div>\n                    <button class="jhs-btn" id="select-image-btn">选择图片</button>\n                    <input type="file" id="image-file" accept="image/*" class="jhs-layout-6b99de8b">\n                </div>\n                \n                <div id="url-input-container" class="jhs-layout-d50e4f09">\n                    <input type="text" id="image-url" placeholder="粘贴图片URL地址..." class="jhs-field">\n                </div>\n                \n                <div id="preview-area" class="jhs-layout-d10a577d">\n                    <img id="preview-image" alt="" src="" class="jhs-image-preview">\n                    <div id="action-btns" class="jhs-layout-06cf30c0">\n                        <button class="jhs-btn" id="handle-btn">搜索图片</button>\n                        <button class="jhs-btn" id="cancel-btn">取消</button>\n                    </div>\n                    \n                    <div id="search-results" class="jhs-layout-c8be1ccb">\n                        <p class="jhs-layout-9ea2322d">请选择识图网站：<button type="button" id="openAll" class="jhs-btn jhs-btn--ghost">全部打开</button></p>\n                        <div class="search-img-site-btns-container" id="search-img-site-btns-container"></div>\n                    </div>\n                </div>\n                \n            </div>\n        ',
        area: utils.isMobileMode() ? utils.getResponsiveArea() : ["40%", "80%"],
        success: /* @__PURE__ */ __name(async (t2) => {
          this.initEventListeners(), e2 && e2();
        }, "success"),
        end: /* @__PURE__ */ __name(() => {
          $(document).off("paste.searchImg");
        }, "end")
      });
    }
    initEventListeners() {
      const e2 = $("#upload-area"), t2 = $("#image-file"), n2 = $("#select-image-btn"), a2 = $("#preview-area"), i2 = $("#preview-image"), s2 = $("#action-btns"), o2 = $("#handle-btn"), r2 = $("#cancel-btn"), l2 = $("#url-input-container"), c2 = $("#image-url"), d2 = $("#search-results"), h2 = $("#search-img-site-btns-container");
      e2.on("dragover", ((t3) => {
        t3.preventDefault(), e2.addClass("highlight");
      })).on("dragleave", (() => {
        e2.removeClass("highlight");
      })).on("drop", ((t3) => {
        t3.preventDefault(), e2.removeClass("highlight"), t3.originalEvent.dataTransfer.files && t3.originalEvent.dataTransfer.files[0] && (this.handleImageFile(t3.originalEvent.dataTransfer.files[0]), this.resetSearchUI());
      })), n2.on("click", (() => {
        t2.trigger("click");
      })), t2.on("change", ((e3) => {
        e3.target.files && e3.target.files[0] && (this.handleImageFile(e3.target.files[0]), this.resetSearchUI());
      })), $(document).on("paste.searchImg", (async (e3) => {
        const t3 = e3.originalEvent.clipboardData.items;
        for (let a3 = 0; a3 < t3.length; a3++) if (-1 !== t3[a3].type.indexOf("image")) {
          const e4 = t3[a3].getAsFile();
          return this.handleImageFile(e4), void this.resetSearchUI();
        }
        const n3 = e3.originalEvent.clipboardData.getData("text");
        n3 && utils.isUrl(n3) && (l2.show(), c2.val(n3), i2.attr("src", n3), a2.show(), this.resetSearchUI());
      })), o2.on("click", (async () => {
        const e3 = i2.attr("src");
        if (e3) {
          if (!this.isUploading) {
            this.isUploading = true;
            try {
              const t3 = await this.searchByImage(e3);
              s2.hide(), d2.show(), h2.empty();
              const n3 = "jhs_selectedSites", a3 = JSON.parse(localStorage.getItem(n3) || "{}");
              this.siteList.forEach(((e4) => {
                const n4 = e4.url.replace("{占位符}", encodeURIComponent(t3)), i3 = false !== a3[e4.name];
                h2.append(`
                        <a href="${n4}" class="search-img-site-btn" target="_blank" title="${e4.name}">
                        <input type="checkbox"
                               class="site-checkbox jhs-layout-8896c95d"
                               data-site-name="${e4.name}"

                               ${i3 ? "checked" : ""}>
                            <img src="${e4.ico}" alt="${e4.name}">
                            <span>${e4.name}</span>
                        </a>
                    `);
              })), h2.on("change", ".site-checkbox", (function() {
                const e4 = $(this).data("site-name");
                a3[e4] = $(this).is(":checked"), localStorage.setItem(n3, JSON.stringify(a3));
              })), h2.show();
            } finally {
              this.isUploading = false;
            }
          }
        } else show.info("请粘贴或上传图片");
      })), r2.on("click", (() => {
        a2.hide(), l2.hide(), t2.val(""), c2.val("");
      })), c2.on("change", (() => {
        utils.isUrl(c2.val()) && (i2.attr("src", c2.val()), a2.show());
      })), $("#openAll").on("click", (() => {
        $(".search-img-site-btn").each((function() {
          $(this).find(".site-checkbox").is(":checked") && window.open($(this).attr("href"));
        }));
      }));
    }
    resetSearchUI() {
      $("#action-btns").show(), $("#search-results").hide(), $("#search-img-site-btns-container").hide().empty();
    }
    handleImageFile(e2) {
      const t2 = document.getElementById("preview-image"), n2 = document.getElementById("preview-area"), a2 = document.getElementById("url-input-container");
      if (!e2.type.match("image.*")) return void show.info("请选择图片文件");
      const i2 = new FileReader();
      i2.onload = (e3) => {
        t2.src = e3.target.result, n2.style.display = "block", a2.style.display = "none", $("#handle-btn")[0].click();
      }, i2.readAsDataURL(e2);
    }
    async searchByImage(e2) {
      let t2 = loading();
      try {
        let t3 = e2;
        if (e2.startsWith("data:")) {
          show.info("开始上传图片...");
          const n2 = await (async function(e3) {
            var t4;
            const n3 = e3.match(/^data:(.+);base64,(.+)$/);
            if (!n3 || n3.length < 3) throw new Error("无效的Base64图片数据");
            const a2 = n3[1], i2 = n3[2], s2 = atob(i2), o2 = new Array(s2.length);
            for (let g2 = 0; g2 < s2.length; g2++) o2[g2] = s2.charCodeAt(g2);
            const r2 = new Uint8Array(o2), l2 = new Blob([r2], {
              type: a2
            }), c2 = new FormData();
            c2.append("image", l2);
            const d2 = await fetch("https://api.imgur.com/3/image", {
              method: "POST",
              headers: {
                Authorization: "Client-ID d70305e7c3ac5c6"
              },
              body: c2
            }), h2 = await d2.json();
            if (h2.success && h2.data && h2.data.link) return h2.data.link;
            throw new Error((null == (t4 = h2.data) ? void 0 : t4.error) || "上传到Imgur失败");
          })(e2);
          if (!n2) return void show.error("上传失败");
          t3 = n2;
        }
        return t3;
      } catch (n2) {
        show.error(`搜索失败: ${n2.message}`), clog.error("搜索失败:", n2);
      } finally {
        t2.close();
      }
    }
  };
  __name(_SearchByImagePlugin, "SearchByImagePlugin");
  var SearchByImagePlugin = _SearchByImagePlugin;
  var _BusNavBarPlugin = class _BusNavBarPlugin extends BasePlugin {
    getName() {
      return "BusNavBarPlugin";
    }
    handle() {
      $("#navbar > div > div > span").append('\n            <button class="jhs-btn btn btn-default jhs-layout-638cb2c9" id="search-img-btn">识图</button>\n       '), $("#search-img-btn").on("click", (() => {
        this.getBean("SearchByImagePlugin").open();
      }));
    }
  };
  __name(_BusNavBarPlugin, "BusNavBarPlugin");
  var BusNavBarPlugin = _BusNavBarPlugin;
  var _RelatedPlugin = class _RelatedPlugin extends BasePlugin {
    getName() {
      return "RelatedPlugin";
    }
    async initCss() {
      return `
            <style>
                .jhs-related-panel { min-width:0; }
                .jhs-related-list { display:grid; }
                .jhs-related-item { display:grid; gap:var(--jhs-space-2); padding:var(--jhs-space-3) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
                .jhs-related-item:last-child { border-bottom:0; }
                .jhs-related-heading { display:flex; min-width:0; align-items:baseline; gap:var(--jhs-space-2); }
                .jhs-related-index { flex:none; color:var(--jhs-text-faint); font-size:14px; }
                .jhs-related-title { min-width:0; overflow:hidden; color:var(--jhs-accent); font-size:16px; font-weight:600; text-overflow:ellipsis; text-decoration:none; white-space:nowrap; }
                .jhs-related-meta { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2) var(--jhs-space-4); color:var(--jhs-text-muted); font-size:14px; }
                .jhs-related-time { color:var(--jhs-text-faint); font-size:14px; white-space:nowrap; }
            </style>`;
    }
    async showRelated(target, movieId) {
      const enabled = await storageManager.getSetting("enableLoadRelated", C), host = target?.length ? target : this.getBean("DetailWorkspacePlugin")?.getSlot("related");
      if (!movieId) return void show.error("未传入movieId");
      const existing = host.children('[data-jhs-panel="related"]').filter(((_2, element) => $(element).attr("data-jhs-movie-id") === String(movieId))).first();
      if (existing.length) return existing;
      const panel = $('<section class="jhs-related-panel" data-jhs-panel="related"></section>').attr("data-jhs-movie-id", String(movieId)), header = $('<header class="jhs-panel-header"><h3>相关清单</h3></header>'), toggle = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-related-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>'), state = { movieId, panel, floorIndex: 1, loaded: false, loading: false, page: 1 };
      header.append(toggle), panel.append(header, '<div class="jhs-related-list jhs-related-container"></div>', '<div class="jhs-panel-footer jhs-related-footer"></div>'), host.append(panel);
      this.updateToggle(toggle, enabled === _);
      toggle.on("click", ((event) => {
        event.preventDefault(), event.stopPropagation();
        const expanded = "展开" === toggle.find(".toggle-text").text();
        this.updateToggle(toggle, expanded), panel.find(".jhs-related-container, .jhs-related-footer").toggle(expanded), expanded && !state.loaded && !state.loading && void this.fetchAndDisplayRelateds(state), storageManager.saveSettingItem("enableLoadRelated", expanded ? _ : C);
      }));
      enabled === _ ? await this.fetchAndDisplayRelateds(state) : panel.find(".jhs-related-container, .jhs-related-footer").hide();
      return panel;
    }
    updateToggle(toggle, expanded) {
      toggle.attr("aria-expanded", String(expanded)), toggle.find(".toggle-text").text(expanded ? "折叠" : "展开"), toggle.find(".toggle-icon").text(expanded ? "▲" : "▼");
    }
    async fetchAndDisplayRelateds(state) {
      if (state.loading) return;
      state.loading = true;
      const { movieId, panel } = state, container = panel.find(".jhs-related-container"), footer = panel.find(".jhs-related-footer");
      container.empty().append($('<div class="jhs-panel-state"></div>').text("获取清单中...")), footer.empty();
      let related;
      try {
        related = await K(movieId, 1, 20);
      } catch (error) {
        clog.error("获取清单失败:", error);
        state.loading = false;
        return void this.renderRetry(container, (() => this.fetchAndDisplayRelateds(state)));
      }
      state.loading = false, state.loaded = true;
      container.empty();
      if (!related.length) return void container.append($('<div class="jhs-panel-state"></div>').text("无清单"));
      this.displayRelateds(state, related, container), 20 === related.length ? this.bindLoadMore(state, container, footer) : footer.append($('<div class="jhs-panel-end"></div>').text("已加载全部清单"));
    }
    renderRetry(container, retry) {
      container.empty();
      const state = $('<div class="jhs-panel-state"></div>').append(document.createTextNode("获取清单失败 "));
      state.append($('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry)), container.append(state);
    }
    bindLoadMore(state, container, footer) {
      const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-related-load-more">加载更多清单</button>'), end = $('<div class="jhs-panel-end jhs-related-end">已加载全部清单</div>').hide();
      footer.empty().append(button, end);
      button.on("click", (async () => {
        button.text("加载中...").prop("disabled", true), state.page++;
        try {
          const related = await K(state.movieId, state.page, 20);
          this.displayRelateds(state, related, container), related.length < 20 ? (button.remove(), end.show()) : button.text("加载更多清单").prop("disabled", false);
        } catch (error) {
          clog.error("加载更多清单失败:", error), button.text("加载失败，请重试").prop("disabled", false);
        }
      }));
    }
    displayRelateds(state, related, container) {
      related.forEach(((item) => {
        const row = $('<article class="jhs-related-item"></article>'), title = $("<a></a>").addClass("jhs-related-title").attr({
          href: `/lists/${encodeURIComponent(item.relatedId)}`,
          target: "_blank",
          rel: "noopener noreferrer"
        }).text(item.name || "未命名清单"), heading = $('<div class="jhs-related-heading"></div>').append($("<span></span>").addClass("jhs-related-index").text(`#${state.floorIndex++}`), title), meta = $('<div class="jhs-related-meta"></div>'), time = $('<time class="jhs-related-time"></time>').text(`创建时间：${item.createTime || "未知"}`);
        meta.append(
          $("<span></span>").text(`视频：${Number(item.movieCount) || 0}`),
          $("<span></span>").text(`收藏：${Number(item.collectionCount) || 0}`),
          $("<span></span>").text(`查看：${Number(item.viewCount) || 0}`),
          time
        ), row.append(heading, meta), container.append(row);
      }));
    }
  };
  __name(_RelatedPlugin, "RelatedPlugin");
  var RelatedPlugin = _RelatedPlugin;
  var _WantAndWatchedVideosPlugin = class _WantAndWatchedVideosPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "flag", null);
    }
    getName() {
      return "WantAndWatchedVideosPlugin";
    }
    async handle() {
      window.location.href.includes("/want_watch_videos") && ($("h3").append('<button type="button" class="jhs-btn jhs-btn--primary jhs-layout-481ed7e7" id="wantWatchBtn">导入至 JHS</button>'), $("#wantWatchBtn").on("click", ((e2) => {
        this.flag = "favorite", this.importWantWatchVideos(e2, "是否将想看的影片导入到 JHS 收藏？");
      }))), window.location.href.includes("/watched_videos") && ($("h3").append('<button type="button" class="jhs-btn jhs-btn--primary jhs-layout-481ed7e7" id="wantWatchBtn">导入至 JHS</button>'), $("#wantWatchBtn").on("click", ((e2) => {
        this.flag = "watched", this.importWantWatchVideos(e2, "是否将看过的影片导入到 JHS 已观看？");
      })));
    }
    importWantWatchVideos(e2, t2) {
      utils.q(null, `${t2} <br/> <span class="jhs-task-emphasis">执行此功能前请记得备份数据</span>`, (async () => {
        let e3 = loading();
        try {
          const result = await this.parseMovieList();
          show.ok(`导入完成：成功 ${result.imported}，失败 ${result.failed}，共 ${result.pages} 页`);
        } catch (t3) {
          clog.error(t3), show.error(`导入失败：${t3.message || t3}`);
        } finally {
          e3.close();
        }
      }));
    }
    async parseMovieList(e2 = null, result = { imported: 0, failed: 0, pages: 0 }) {
      let t2, n2;
      e2 ? (t2 = e2.find(this.getSelector().itemSelector), n2 = e2.find(".pagination-next").attr("href")) : (t2 = $(this.getSelector().itemSelector), n2 = $(".pagination-next").attr("href"));
      result.pages++, show.info(`正在导入第 ${result.pages} 页`);
      for (const i2 of t2) {
        const e3 = $(i2), t3 = e3.find("a").attr("href"), n3 = e3.find(".video-title strong").text().trim(), s2 = e3.find(".meta").text().trim();
        if (t3 && n3) try {
          this.flag && await stateService.patch(n3, { [this.flag]: true }, { type: "javdb-list-import", record: { carNum: n3, url: t3, names: "", publishTime: s2 } }), result.imported++;
        } catch (a2) {
          result.failed++, clog.error(`保存失败 [${n3}]:`, a2);
        }
      }
      if (!n2) return result;
      await utils.sleep(1e3);
      const html = await gmHttp.get(new URL(n2, window.location.href).href), nextPage = utils.htmlTo$dom(html);
      return this.parseMovieList(nextPage, result);
    }
  };
  __name(_WantAndWatchedVideosPlugin, "WantAndWatchedVideosPlugin");
  var WantAndWatchedVideosPlugin = _WantAndWatchedVideosPlugin;
  var _CoverButtonPlugin = class _CoverButtonPlugin extends BasePlugin {
    getName() {
      return "CoverButtonPlugin";
    }
    async initCss() {
      return `
            <style>
                .box .tags { justify-content:space-between; }
                .jhs-cover-tools { display:flex; align-items:center; justify-content:flex-end; gap:var(--jhs-space-2); margin-left:auto; }
                .jhs-cover-tools svg path { fill:var(--jhs-icon-color); }
                .jhs-cover-tools .screenSvg, .jhs-cover-tools .videoSvg { opacity:.65; }
                .jhs-cover-tools .screenSvg:hover, .jhs-cover-tools .videoSvg:hover { opacity:1; }
                ${l ? ".jhs-cover-tools .icon, .setting-label .icon{height:24px;width:24px}" : ""}
                .more-tools-container { position:relative; }
                .jhs-card-menu { top:auto; right:0; bottom:calc(100% + var(--jhs-space-2)); width:152px; }
                .jhs-card-menu .jhs-btn, .jhs-card-menu .site-btn { width:100%; min-height:var(--jhs-control-height); justify-content:flex-start; margin:0; }
                .jhs-card-menu__dot { width:8px; height:8px; flex:none; border-radius:50%; background:var(--jhs-border-strong); }
                .jhs-card-menu__dot--watch { background:var(--jhs-status-watch); }
                .jhs-card-menu__dot--down { background:var(--jhs-status-down); }
                .jhs-card-menu__dot--fav { background:var(--jhs-status-fav); }
                .jhs-card-menu__dot--filter { background:var(--jhs-status-filter); }
                .loading { opacity:.7; filter:blur(1px); }
                .loading-spinner { position:absolute; top:50%; left:50%; width:40px; height:40px; border:3px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; transform:translate(-50%,-50%); animation:spin 1s ease-in-out infinite; z-index:var(--jhs-z-elevated); }
                @keyframes spin { to { transform:translate(-50%,-50%) rotate(360deg); } }
            </style>`;
    }
    async handle() {
      window.isListPage && (this.addSvgBtn(), await this.bindClick());
    }
    /** 构建卡片工具和三个卡片内 popover。 */
    buildToolBox() {
      return `
            <div class="tool-box jhs-cover-tools">
                <button type="button" class="jhs-btn jhs-icon-btn screenSvg" title="长缩略图" aria-label="长缩略图">${this.screenSvg}</button>
                <button type="button" class="jhs-btn jhs-icon-btn videoSvg" title="播放视频" aria-label="播放视频">${this.videoSvg}</button>
                <div class="more-tools-container handleSvg">
                    <button type="button" title="鉴定处理" aria-label="鉴定处理" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.handleSvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item hasWatchBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--watch"></span><span>${k}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item hasDownBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--down"></span><span>${y}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item favoriteBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--fav"></span><span>${v}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item filterBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--filter"></span><span>${m}</span></button>
                    </div>
                </div>
                <div class="more-tools-container siteSvg">
                    <button type="button" title="第三方网站" aria-label="第三方网站" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.siteSvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <a role="menuitem" class="site-btn site-jable"><span>Jable</span></a>
                        <a role="menuitem" class="site-btn site-avgle"><span>Avgle</span></a>
                        <a role="menuitem" class="site-btn site-miss-av"><span>MissAv</span></a>
                        <a role="menuitem" class="site-btn site-123-av"><span>123Av</span></a>
                    </div>
                </div>
                <div class="more-tools-container copySvg">
                    <button type="button" title="复制" aria-label="复制" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.copySvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost carNumSvg">${this.carNumSvg}<span>复制番号</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost titleSvg">${this.titleSvg}<span>复制标题</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost downSvg">${this.downSvg}<span>下载封面</span></button>
                    </div>
                </div>
            </div>`;
    }
    async addSvgBtn(items = null) {
      (items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray()).forEach(((element) => {
        const item = $(element);
        if (item.find(".tool-box").length || l && item.find(".avatar-box").length) return;
        const host = r ? item.find(".tags").first() : item.find(".photo-info").first();
        host.length && host.append(this.buildToolBox());
      })), this.enableSvgBtn(items);
    }
    async enableSvgBtn(items = null) {
      const e2 = await storageManager.getSetting(), { enableScreenSvg: t2 = _, enableVideoSvg: n2 = _, enableHandleSvg: a2 = _, enableSiteSvg: i2 = _, enableCopySvg: s2 = _ } = e2;
      const scope = items ? $(items) : $(document);
      [{ selector: ".screenSvg", enabled: t2 }, { selector: ".videoSvg", enabled: n2 }, { selector: ".handleSvg", enabled: a2 }, { selector: ".siteSvg", enabled: i2 }, { selector: ".copySvg", enabled: s2 }].forEach((({ selector: e3, enabled: t3 }) => {
        scope.find(e3).toggle(t3 === _);
      }));
    }
    closeCardMenus(focus = false) {
      const openMenus = $(".jhs-card-menu.is-open"), triggers = openMenus.siblings(".jhs-card-menu-trigger");
      openMenus.removeClass("is-open"), triggers.attr("aria-expanded", "false"), focus && triggers.first().trigger("focus");
    }
    async bindClick() {
      this.getSelector();
      const e2 = this.getBean("ListPagePlugin");
      $(document).on("click", ".jhs-card-menu-trigger", ((event) => {
        event.preventDefault(), event.stopPropagation();
        const trigger = $(event.currentTarget), menu = trigger.siblings(".jhs-card-menu"), open = !menu.hasClass("is-open");
        this.closeCardMenus(), menu.toggleClass("is-open", open), trigger.attr("aria-expanded", String(open)), open && menu.children().first().trigger("focus");
      })).on("keydown", ".jhs-card-menu [role='menuitem']", ((event) => {
        const menu = $(event.currentTarget).closest(".jhs-card-menu"), items = menu.find("[role='menuitem']"), index = items.index(event.currentTarget);
        if ("Escape" === event.key) return event.preventDefault(), this.closeCardMenus(true);
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      })).on("click", ((event) => {
        $(event.target).closest(".more-tools-container").length || this.closeCardMenus();
      })), $(document).on("click", ".videoSvg", ((t3) => {
        t3.preventDefault(), $('.videoSvg[title!="播放视频"]').each(((t4, n4) => {
          const a4 = $(n4);
          let i3 = a4.closest(".item"), s3 = i3.find("img"), { carNum: o2 } = e2.findCarNumAndHref(i3);
          this.showImg(a4, s3, o2), a4.html(this.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
        }));
        const n3 = $(t3.target).closest(".item"), a3 = n3.find(".videoSvg");
        if ("播放视频" === a3.attr("title")) {
          a3.html(this.recoveryVideoSvg).attr({ title: "切回封面", "aria-label": "切回封面" });
          const { carNum: t4 } = e2.findCarNumAndHref(n3);
          let i3 = n3.find("img");
          if (!i3.length) return void show.error("没有找到图片");
          void this.showVideo(a3, i3, t4).catch(((error) => clog.error("卡片预览视频打开失败", error)));
        }
      })), $(document).on("click", ".screenSvg", (async (t3) => {
        t3.preventDefault();
        let n3 = loading();
        try {
          const a3 = $(t3.currentTarget).closest(".item");
          let { carNum: i3 } = e2.findCarNumAndHref(a3);
          i3 = i3.replace("FC2-", "");
          const s3 = await this.getBean("ScreenShotPlugin").getScreenshot(i3);
          n3.close(), showImageViewer(s3);
        } catch (a3) {
          clog.error("图片预览出错:", a3), show.error("图片预览出错:" + a3);
        } finally {
          n3.close();
        }
      })), $(document).on("click", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", ((t3) => {
        t3.preventDefault(), t3.stopPropagation();
        try {
          const n3 = $(t3.currentTarget), a3 = n3.closest(".item"), { carNum: i3, url: s3, publishTime: o2 } = e2.findCarNumAndHref(a3), r2 = /* @__PURE__ */ __name(async (t4) => {
            try {
              let n4 = await e2.parseActressName(s3);
              const flag = legacyActionToFlag(t4);
              if (!flag) throw new Error("不支持的状态操作");
              await stateService.patch(i3, { [flag]: true }, { type: "list-card-state", record: { carNum: i3, url: s3, names: n4, publishTime: o2 } }), show.ok("操作成功");
            } catch (r3) {
              clog.error("保存操作失败:", r3), show.error("操作失败");
            }
          }, "r");
          n3.hasClass("filterBtn") ? utils.q(t3, `是否屏蔽${i3}?`, (() => r2(d))) : n3.hasClass("favoriteBtn") ? void r2(h) : n3.hasClass("hasDownBtn") ? void r2(g) : n3.hasClass("hasWatchBtn") && void r2(p), this.closeCardMenus();
        } catch (t4) {
          clog.error("按钮点击处理失败:", t4);
        }
      }));
      const t2 = this.getBean("OtherSitePlugin"), n2 = await t2.getMissAvUrl(), a2 = await t2.getjableUrl(), i2 = await t2.getAvgleUrl(), s2 = await t2.getAv123Url();
      $(this.getSelector().itemSelector).each(((t3, o2) => {
        const r2 = $(o2), { carNum: l2 } = e2.findCarNumAndHref(r2);
        r2.find(".site-jable").attr({ href: `${a2}/search/${l2}/`, target: "_blank", rel: "noopener noreferrer" }), r2.find(".site-avgle").attr({ href: `${i2}/vod/search.html?wd=${l2}`, target: "_blank", rel: "noopener noreferrer" }), r2.find(".site-miss-av").attr({ href: `${n2}/search/${l2}`, target: "_blank", rel: "noopener noreferrer" }), r2.find(".site-123-av").attr({ href: `${s2}/cn/search?keyword=${encodeURIComponent(l2)}`, target: "_blank", rel: "noopener noreferrer" });
      }));
      $(document).on("click", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", ((t3) => {
        try {
          t3.preventDefault(), t3.stopPropagation();
          const o2 = $(t3.currentTarget), r2 = o2.closest(".item"), { carNum: l2 } = e2.findCarNumAndHref(r2);
          let c2 = null;
          o2.hasClass("site-jable") ? c2 = `${a2}/search/${l2}/` : o2.hasClass("site-avgle") ? c2 = `${i2}/vod/search.html?wd=${l2}` : o2.hasClass("site-miss-av") ? c2 = `${n2}/search/${l2}` : o2.hasClass("site-123-av") && (c2 = `${s2}/cn/search?keyword=${encodeURIComponent(l2)}`), t3 && (t3.ctrlKey || t3.metaKey) ? GM_openInTab(c2, { insert: 0 }) : window.open(c2), this.closeCardMenus();
        } catch (t4) {
          clog.error("站点按钮处理失败:", t4);
        }
      })), $(document).on("click", ".titleSvg, .carNumSvg, .downSvg", ((t3) => {
        t3.preventDefault(), t3.stopPropagation();
        const n3 = $(t3.currentTarget).closest(".item"), { carNum: a3, title: i3 } = e2.findCarNumAndHref(n3), s3 = n3.find(l ? ".photo-frame img" : ".cover img");
        $(t3.currentTarget).hasClass("titleSvg") ? utils.copyToClipboard("标题", i3) : $(t3.currentTarget).hasClass("carNumSvg") ? utils.copyToClipboard("番号", a3) : $(t3.currentTarget).hasClass("downSvg") && fetch(s3.attr("src")).then(((e3) => e3.blob())).then(((e3) => utils.download(e3, a3 + " " + i3 + ".jpg"))), this.closeCardMenus();
      }));
    }
    showImg(e2, t2, n2) {
      e2.html(this.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
      let a2 = $(`#${`${n2}_preview_video`}`);
      a2.length > 0 && (a2[0].pause(), a2.parent().hide()), t2.show(), t2.removeClass("loading"), t2.next(".loading-spinner").remove();
    }
    async showVideo(e2, t2, n2) {
      const a2 = `${n2}_preview_video`;
      let i2 = $(`#${a2}`);
      if (i2.length > 0) return i2.parent().show(), await safePlay(i2[0], {
        context: "列表卡片预览",
        notify: true
      }), void t2.hide();
      t2.addClass("loading"), t2.after('<div class="loading-spinner"></div>');
      const s2 = t2.attr("src"), { sources: o2, error: previewError } = await fetchDmmPreview(n2);
      if (!o2) return show.error("REGION_BLOCKED" === previewError?.code ? previewError.message : "未解析到视频"), void this.showImg(e2, t2, n2);
      let r2 = await storageManager.getSetting("videoQuality");
      r2 = Z(Object.keys(o2), r2);
      let c2 = o2[r2], d2 = `
            <div class="jhs-layout-d543acf8">
                <video src="${c2}" poster="${s2}" id="${a2}" controls loop muted playsinline class="jhs-layout-a38a0e50"></video>
            </div>`;
      l && (d2 = `<div><video src="${c2}" poster="${s2}" id="${a2}" controls loop muted playsinline class="jhs-layout-a38a0e50"></video></div>`), t2.parent().append(d2), t2.hide(), t2.removeClass("loading"), t2.next(".loading-spinner").remove(), i2 = $(`#${a2}`);
      let h2 = i2[0];
      h2.load(), h2.muted = false, await safePlay(h2, {
        context: "列表卡片预览",
        notify: true,
        message: "REGION_BLOCKED" === previewError?.code ? previewError.message : "当前视频源无法播放"
      }), i2.trigger("focus");
    }
  };
  __name(_CoverButtonPlugin, "CoverButtonPlugin");
  var CoverButtonPlugin = _CoverButtonPlugin;
  var AV123_REQUEST_OPTIONS = Object.freeze({ cookiePartitionTopLevelSite: "https://123av.com" });
  var _Fc2By123AvPlugin = class _Fc2By123AvPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "$contentBox", $(".section .container")), i(this, "urlParams", new URLSearchParams(window.location.search)), i(this, "currentPage", this.urlParams.get("page") ? parseInt(this.urlParams.get("page")) : 1), i(this, "maxPage", null), i(this, "keyword", this.urlParams.get("keyword") || null);
    }
    getName() {
      return "Fc2By123AvPlugin";
    }
    async getBaseUrl() {
      return await this.getBean("OtherSitePlugin").getAv123Url();
    }
    request123Av(e2, requestOptions = {}) {
      return gmHttp.get(e2, {}, {}, false, { ...AV123_REQUEST_OPTIONS, ...requestOptions });
    }
    async handle() {
      $("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)").after('<a class="navbar-item" href="/advanced_search?type=100&released_start=2099-09">123Av-Fc2</a>'), $('.tabs li:contains("FC2")').after('<li><a href="/advanced_search?type=100&released_start=2099-09"><span>123Av-Fc2</span></a></li>'), o.includes("/advanced_search?type=100") && (this.hookPage(), await this.handleQuery());
    }
    hookPage() {
      let e2 = $("h2.section-title");
      e2.contents().first().replaceWith("123Av"), e2.css("marginBottom", "0"), e2.append('\n            <div class="jhs-layout-f5f47b30">\n                <input id="search-123av-keyword" type="text" placeholder="搜索123Av Fc2ppv内容" class="jhs-field">\n                <button type="button" id="search-123av-btn" class="jhs-btn jhs-btn--primary jhs-layout-21a4fe43">搜索</button>\n                <button type="button" id="clear-123av-btn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n            </div>\n        '), $("#search-123av-keyword").val(this.keyword), $("#search-123av-btn").on("click", (async () => {
        let e3 = $("#search-123av-keyword").val().trim();
        e3 && (this.keyword = e3, utils.setHrefParam("keyword", e3), await this.handleQuery());
      })), $("#clear-123av-btn").on("click", (async () => {
        $("#search-123av-keyword").val(""), this.keyword = "", utils.setHrefParam("keyword", ""), $(".page-box").show(), await this.handleQuery();
      })), $(".empty-message").remove(), $("#foldCategoryBtn").remove(), $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-layout-d2c171b1"></div>'), this.$contentBox.append('<div class="page-box"></div>');
      utils.setHrefParam("page", this.currentPage);
      $(".page-box").append('\n            <nav class="pagination">\n                <button type="button" class="jhs-btn pagination-previous">上一页</button>\n                <ul class="pagination-list"></ul>\n                <button type="button" class="jhs-btn pagination-next">下一页</button>\n            </nav>\n        '), $(document).on("click", ".pagination-link", ((e3) => {
        e3.preventDefault(), this.currentPage = parseInt($(e3.target).data("page")), utils.setHrefParam("page", this.currentPage), this.renderPagination(), this.handleQuery();
      })), $(".pagination-previous").on("click", ((e3) => {
        e3.preventDefault(), this.currentPage > 1 && (this.currentPage--, utils.setHrefParam("page", this.currentPage), this.renderPagination(), this.handleQuery());
      })), $(".pagination-next").on("click", ((e3) => {
        e3.preventDefault(), this.currentPage < this.maxPage && (this.currentPage++, utils.setHrefParam("page", this.currentPage), this.renderPagination(), this.handleQuery());
      }));
    }
    renderPagination() {
      const e2 = $(".pagination-list");
      e2.empty();
      let t2 = Math.max(1, this.currentPage - 2), n2 = Math.min(this.maxPage, this.currentPage + 2);
      this.currentPage <= 3 ? n2 = Math.min(6, this.maxPage) : this.currentPage >= this.maxPage - 2 && (t2 = Math.max(this.maxPage - 5, 1)), t2 > 1 && (e2.append('<li><button type="button" class="jhs-btn pagination-link" data-page="1">1</button></li>'), t2 > 2 && e2.append('<li><span class="pagination-ellipsis">…</span></li>'));
      for (let a2 = t2; a2 <= n2; a2++) {
        const t3 = a2 === this.currentPage ? " is-current" : "";
        e2.append(`<li><button type="button" class="jhs-btn pagination-link${t3}" data-page="${a2}">${a2}</button></li>`);
      }
      n2 < this.maxPage && (n2 < this.maxPage - 1 && e2.append('<li><span class="pagination-ellipsis">…</span></li>'), e2.append(`<li><button type="button" class="jhs-btn pagination-link" data-page="${this.maxPage}">${this.maxPage}</button></li>`));
    }
    async handleQuery() {
      let e2 = loading();
      try {
        let e3 = [2 * this.currentPage - 1, 2 * this.currentPage];
        this.keyword && (e3 = [1], $(".page-box").hide());
        const t2 = await this.getBaseUrl();
        const requests = e3.map(((sourcePage) => this.request123Av(this.keyword ? `${t2}/cn/search?keyword=${encodeURIComponent(this.keyword)}` : `${t2}/cn/makers/fc2?page=${sourcePage}`)));
        const pages = (await Promise.all(requests)).map(((html) => utils.htmlTo$dom(html)));
        const i2 = merge123AvCards(pages.map((($page) => parse123AvCards($page, t2))));
        if (!this.keyword && !this.maxPage && pages.length) {
          const sourceMaxPage = parse123AvSourceMaxPage(pages[0], t2);
          sourceMaxPage && (this.maxPage = Math.ceil(sourceMaxPage / 2), this.renderPagination());
        }
        if (0 === i2.length) {
          clog.log(i2), show.error("无结果");
          const e4 = this.keyword ? `${t2}/cn/search?keyword=${encodeURIComponent(this.keyword)}` : `${t2}/cn/makers/fc2`;
          clog.error("获取数据失败!", e4);
        }
        let s2 = this.markDataListHtml(i2);
        $(".movie-list").html(s2), await utils.smoothScrollToTop();
      } catch (t2) {
        clog.error(t2);
      } finally {
        e2.close();
      }
    }
    async open123AvFc2Dialog(e2, t2) {
      let n2 = "";
      await storageManager.getSetting("enableLoadOtherSite", _) === _ && (n2 = '<div class="movie-panel-info fc2-movie-panel-info jhs-layout-a26bda7d"><strong>第三方站点: </strong></div>');
      let a2 = `
            <div class="movie-detail-container">
               <!-- <div class="movie-poster-container">
                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>
                </div>
                <div class="right-box">-->
                    <div class="movie-info-container">
                        <div class="search-loading">加载中...</div>
                    </div>

                    ${n2}

                    <div class="jhs-layout-f4e719ae">
                        <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter"><span>${m}</span></button>
                        <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav"><span>${v}</span></button>
                        <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down"><span>${y}</span></button>
                        <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch"><span>${k}</span></button>

                        <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent">
                            <span>字幕 (SubTitleCat)</span>
                        </button>
                        <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent">
                            <span>字幕 (迅雷)</span>
                        </button>
                    </div>
                    <div class="message video-panel jhs-layout-a26bda7d">
                        <div id="magnets-content" class="magnet-links">
                        </div>
                    </div>
                    <div id="reviews-content">
                    </div>
                    <div id="related-content">
                    </div>
                    <span id="data-actress" class="jhs-layout-6b99de8b"></span>
               <!-- </div>-->
            </div>
        `;
      layer.open({
        type: 1,
        title: e2,
        content: a2,
        area: utils.getDialogArea("workspace"),
        skin: "movie-detail-layer",
        scrollbar: false,
        success: /* @__PURE__ */ __name(async (n3, a3) => {
          const root = $(n3), detailRoot = root.find(".movie-detail-container");
          organizeJhsOwnedDetailWorkspace(detailRoot), detailStateController.bind({ root: n3, layerIndex: a3, carNum: e2, activityType: "fc2-state", getRecord: /* @__PURE__ */ __name(() => ({ carNum: e2, url: t2, names: root.find("#data-actress").text(), publishTime: root.find("#data-publishTime").text() }), "getRecord") }), utils.setupEscClose(a3), this.loadData(e2, t2);
          let i2 = e2.replace("FC2-", "");
          $("#magnets-content").append(await this.getBean("MagnetHubPlugin").createMagnetHub(i2)), root.find("#search-subtitle-btn").on("click", ((t3) => utils.openPage(`https://subtitlecat.com/index.php?search=${e2}`, e2, false, t3))), $("#xunLeiSubtitleBtn").on("click", (() => this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(e2)));
          let s2 = e2.replace("FC2-", "");
          void this.getBean("OtherSitePlugin").loadOtherSite(s2, e2).catch(((error) => clog.error("FC2 外部站点加载失败", error)));
        }, "success")
      });
    }
    async loadData(e2, t2) {
      let n2 = loading();
      try {
        const { publishDate: a2, title: i2 } = await this.get123AvVideoInfo(t2);
        const articleId = encodeURIComponent(String(e2 || "").replace("FC2-", ""));
        $(".movie-info-container").html(`
                    <h3 class="movie-title jhs-layout-761d3add"><strong class="current-title">${escapeHtml(i2 || "无标题")}</strong></h3>
                    <div class="movie-meta jhs-layout-761d3add">
                        <span><strong>番号: </strong>${escapeHtml(e2 || "未知")}</span>
                        <span><strong>年份: </strong>${escapeHtml(a2 || "未知")}</span>
                        <span><strong>站点: </strong><a href="https://fc2ppvdb.com/articles/${articleId}" target="_blank">fc2ppvdb</a><a href="https://adult.contents.fc2.com/article/${articleId}/" target="_blank" class="jhs-layout-3fed2a7e">fc2电子市场</a></span>
                    </div>
                    <div class="movie-actors jhs-layout-761d3add"><div class="actor-list"><strong>主演: </strong></div></div>
                    <div class="movie-seller jhs-layout-761d3add"><span><strong>卖家: </strong></span></div>
                    <div class="movie-gallery jhs-layout-761d3add"><strong>剧照: </strong><div class="image-list"></div></div>
                    <div id="data-publishTime" class="jhs-layout-6b99de8b">${escapeHtml(a2 || "")}</div>
                `), await Promise.all([this.getImgList(e2), this.getActressInfo(e2), this.getBean("TranslatePlugin").translate(e2, false)]);
      } catch (a2) {
        clog.error(a2);
      } finally {
        n2.close();
      }
    }
    handleLongImg(e2) {
      utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
        $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container jhs-layout-e5d57abb"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> ');
        const t2 = normalizeHttpUrl(await this.getBean("ScreenShotPlugin").getScreenshot(e2));
        t2 && ($(".screen-container").html(`<img src="${escapeHtml(t2)}" alt="" loading="lazy" class="jhs-layout-cad980f4">`), $(".screen-container").on("click", ((e3) => {
          e3.stopPropagation(), e3.preventDefault(), showImageViewer(e3.currentTarget);
        })));
      }));
    }
    async get123AvVideoInfo(e2) {
      const t2 = await this.request123Av(e2);
      return parse123AvVideoInfo(utils.htmlTo$dom(t2), e2);
    }
    async getActressInfo(e2) {
      let t2 = `https://fc2ppvdb.com/articles/${e2.replace("FC2-", "")}`;
      const n2 = await gmHttp.get(t2), a2 = $(n2), i2 = a2.find("div").filter((function() {
        return 0 === $(this).text().trim().indexOf("女優：");
      }));
      if (0 === i2.length || i2.length > 1) return void show.error("解析女优信息失败");
      const s2 = $(i2[0]).find("a");
      let o2 = "<strong>主演: </strong>";
      if (s2.length > 0) {
        let e3 = "";
        s2.each(((t3, n3) => {
          let a3 = $(n3), i3 = a3.text(), s3 = a3.attr("href");
          o2 += `<span class="actor-tag"><a href="https://fc2ppvdb.com${escapeHtml(s3)}" target="_blank">${escapeHtml(i3)}</a></span>`, e3 += i3 + " ";
        })), $("#data-actress").text(e3);
      } else o2 += "<span>暂无演员信息</span>";
      $(".actor-list").html(o2);
      const r2 = a2.find("div").filter((function() {
        return 0 === $(this).text().trim().indexOf("販売者：");
      }));
      if (r2.length > 0) {
        const e3 = $(r2[0]).find("a");
        if (e3.length > 0) {
          const t3 = $(e3[0]);
          let n3 = t3.text(), a3 = t3.attr("href");
          const sellerUrl = normalizeHttpUrl(a3, "https://fc2ppvdb.com");
          $(".movie-seller").empty().append($("<span></span>").append("卖家: ", sellerUrl ? $("<a></a>").attr({ href: sellerUrl, target: "_blank" }).text(n3) : document.createTextNode(n3)));
        }
      }
    }
    async getImgList(e2) {
      let t2 = e2.replace("FC2-", ""), n2 = `https://adult.contents.fc2.com/article/${e2.replace("FC2-", "")}/`;
      const a2 = await gmHttp.get(n2, null, {
        referer: n2
      });
      let i2 = $(a2).find(".items_article_SampleImagesArea img").map((function() {
        return normalizeHttpUrl($(this).attr("src"), n2);
      })).get().filter(Boolean), s2 = "";
      Array.isArray(i2) && i2.length > 0 ? s2 = i2.map(((e3, t3) => `
                <a href="${escapeHtml(e3)}" data-fancybox="movie-gallery" data-caption="剧照 ${t3 + 1}">
                    <img src="${escapeHtml(e3)}" class="movie-image-thumb" loading="lazy" alt=""/>
                </a>
            `)).join("") : $(".movie-gallery").html("<h4>剧照: 暂无剧照</h4>"), $(".image-list").html(s2), this.handleLongImg(t2);
    }
    markDataListHtml(e2) {
      let t2 = "";
      return e2.forEach(((e3) => {
        const href = normalizeHttpUrl(e3.href, "https://123av.com"), imageUrl = normalizeHttpUrl(e3.imgSrc, "https://123av.com");
        if (!href) return;
        t2 += `
                <div class="item">
                    <a href="${escapeHtml(href)}" class="box" title="${escapeHtml(e3.title)}">
                        <div class="cover ">${imageUrl ? `<img loading="lazy" src="${escapeHtml(imageUrl)}" alt="">` : ""}</div>
                        <div class="video-title"><strong>${escapeHtml(e3.carNum)}</strong> ${escapeHtml(e3.title)}</div>
                        <div class="score"></div><div class="meta"></div><div class="jhs-toolbar"></div>
                    </a>
                </div>
            `;
      })), t2;
    }
  };
  __name(_Fc2By123AvPlugin, "Fc2By123AvPlugin");
  var Fc2By123AvPlugin = _Fc2By123AvPlugin;
  var MAGNET_SOURCE_IDS = Object.freeze(["native-javdb", "native-javbus", "u9a9", "u3c3", "sukebei", "btsow"]);
  function normalizeMagnetResult(result, source) {
    if (!result || !String(result.magnet || "").startsWith("magnet:")) return null;
    return { title: String(result.title || ""), magnet: result.magnet, size: result.size || "", date: result.date || "", seeders: Number(result.seeders) || 0, leechers: Number(result.leechers) || 0, source, files: Array.isArray(result.files) ? result.files : [] };
  }
  __name(normalizeMagnetResult, "normalizeMagnetResult");
  function extractInfoHash(magnet) {
    const hash = new URL(magnet).searchParams.get("xt")?.match(/^urn:btih:([a-z2-7]{32}|[a-f\d]{40})$/i)?.[1];
    return hash ? hash.toUpperCase() : null;
  }
  __name(extractInfoHash, "extractInfoHash");
  function deduplicateMagnetResults(results) {
    const unique = /* @__PURE__ */ new Map();
    results.forEach(((result) => {
      const key = extractInfoHash(result.magnet) || `${result.source}:${result.magnet}`;
      const existing = unique.get(key);
      existing ? existing.sources = [.../* @__PURE__ */ new Set([...existing.sources || [existing.source], result.source])] : unique.set(key, { ...result, sources: [result.source] });
    }));
    return [...unique.values()];
  }
  __name(deduplicateMagnetResults, "deduplicateMagnetResults");
  var _MagnetSourceRegistry = class _MagnetSourceRegistry {
    constructor(sources = []) {
      this.sources = /* @__PURE__ */ new Map();
      sources.forEach(((source) => this.register(source)));
    }
    register(source) {
      if (!source?.id || !source.name || "function" !== typeof source.search || "function" !== typeof source.targetUrl) throw new TypeError("Invalid magnet provider");
      this.sources.set(source.id, { enabled: true, priority: 100, ...source });
      return this;
    }
    get(id) {
      return this.sources.get(id) || null;
    }
    getEnabledSources() {
      return [...this.sources.values()].filter(((source) => source.enabled)).sort(((a2, b2) => a2.priority - b2.priority));
    }
  };
  __name(_MagnetSourceRegistry, "MagnetSourceRegistry");
  var MagnetSourceRegistry = _MagnetSourceRegistry;
  function validateHttpsBaseUrl(value) {
    const url = new URL(value);
    if ("https:" !== url.protocol) throw new TypeError("Source URL must use https");
    return url.origin;
  }
  __name(validateHttpsBaseUrl, "validateHttpsBaseUrl");
  function validateCustomMagnetSource(config) {
    const allowed = ["id", "name", "enabled", "priority", "searchUrlTemplate", "targetUrlTemplate", "parserType", "rowSelector", "titleSelector", "magnetSelector", "sizeSelector", "dateSelector", "seedersSelector", "leechersSelector", "resultsPath", "titlePath", "hashPath", "magnetPath", "sizePath", "datePath", "seedersPath"];
    if (Object.keys(config).some(((key) => !allowed.includes(key)))) throw new TypeError("Unsupported custom source field");
    if (!["torrent-table", "magnet-links", "json"].includes(config.parserType)) throw new TypeError("Unsupported parser type");
    if (!String(config.name || "").trim()) throw new TypeError("Source name is required");
    validateHttpsBaseUrl(config.searchUrlTemplate.replace("{keyword}", "test"));
    validateHttpsBaseUrl((config.targetUrlTemplate || config.searchUrlTemplate).replace("{keyword}", "test"));
    if ("torrent-table" === config.parserType && (!config.rowSelector?.trim() || !config.magnetSelector?.trim())) throw new TypeError("表格来源必须填写结果行选择器和磁力选择器");
    if ("json" === config.parserType && (!config.resultsPath?.trim() || !config.magnetPath?.trim() && !config.hashPath?.trim())) throw new TypeError("JSON 来源必须填写结果数组路径，并填写磁力路径或哈希路径");
    return { ...config, name: config.name.trim(), targetUrlTemplate: config.targetUrlTemplate || config.searchUrlTemplate };
  }
  __name(validateCustomMagnetSource, "validateCustomMagnetSource");
  function applyMagnetRules(result, tagRules = [], titleFilters = [], fileFilters = []) {
    const text = `${result.title || ""} ${(result.files || []).join(" ")}`;
    const matches = /* @__PURE__ */ __name((rule, value) => "regex" === rule.type ? new RegExp(rule.pattern, "i").test(value) : value.toLowerCase().includes(rule.pattern.toLowerCase()), "matches");
    const tags = tagRules.filter(((rule) => rule.enabled && matches(rule, text)));
    let hidden = false, penalty = 0;
    const filteredReasons = [];
    [...titleFilters.map(((rule) => ({ ...rule, value: result.title || "" }))), ...fileFilters.map(((rule) => ({ ...rule, value: (result.files || []).join(" ") })))].filter(((rule) => rule.enabled)).forEach(((rule) => {
      if (!matches(rule, rule.value)) return;
      filteredReasons.push(rule.id || rule.pattern);
      "hide" === rule.action ? hidden = true : penalty += Number(rule.penalty) || 0;
    }));
    return { ...result, tags: tags.map(((rule) => rule.name)), customTagWeight: tags.reduce(((sum, rule) => sum + (Number(rule.weight) || 0)), 0), hidden, filterPenalty: penalty, filteredReasons };
  }
  __name(applyMagnetRules, "applyMagnetRules");
  function parseNativeMagnets(root, source) {
    const results = /* @__PURE__ */ new Map();
    $(root).find('a[href^="magnet:"],[data-clipboard-text^="magnet:"]').each(((index, element) => {
      const node = $(element), magnet = node.attr("href") || node.attr("data-clipboard-text");
      if (!magnet) return;
      const container = node.closest(".item, .magnet-name, tr, .panel-block"), title = container.find(".name, .magnet-name, .title").first().text().trim() || node.text().trim() || "本站磁力";
      const result = normalizeMagnetResult({ title, magnet, size: container.find(".meta, .size").first().text().trim() }, source);
      result && results.set(extractInfoHash(magnet) || magnet, result);
    }));
    return [...results.values()];
  }
  __name(parseNativeMagnets, "parseNativeMagnets");
  function readJsonPath(value, path) {
    return String(path || "").split(".").filter(Boolean).reduce(((current, key) => current?.[key]), value);
  }
  __name(readJsonPath, "readJsonPath");
  function parseCustomMagnetResponse(config, payload, sourceId) {
    config = validateCustomMagnetSource(config);
    if ("json" === config.parserType) return (readJsonPath(payload, config.resultsPath) || []).map(((item) => normalizeMagnetResult({ title: readJsonPath(item, config.titlePath), magnet: config.magnetPath ? readJsonPath(item, config.magnetPath) : `magnet:?xt=urn:btih:${readJsonPath(item, config.hashPath)}`, size: readJsonPath(item, config.sizePath), date: readJsonPath(item, config.datePath), seeders: readJsonPath(item, config.seedersPath) }, `custom:${sourceId}`))).filter(Boolean);
    const root = utils.htmlTo$dom(payload), rows = "magnet-links" === config.parserType ? root.find('a[href^="magnet:"]') : root.find(config.rowSelector);
    return rows.map(((index, element) => {
      const row = $(element), magnetNode = "magnet-links" === config.parserType ? row : row.find(config.magnetSelector).first();
      return normalizeMagnetResult({ title: "magnet-links" === config.parserType ? row.text().trim() : row.find(config.titleSelector).first().text().trim(), magnet: magnetNode.attr("href") || magnetNode.attr("data-magnet"), size: row.find(config.sizeSelector).text().trim(), date: row.find(config.dateSelector).text().trim(), seeders: row.find(config.seedersSelector).text().trim(), leechers: row.find(config.leechersSelector).text().trim() }, `custom:${sourceId}`);
    })).get().filter(Boolean);
  }
  __name(parseCustomMagnetResponse, "parseCustomMagnetResponse");
  function calcMagnetScore(e2) {
    let t2 = 0;
    const n2 = e2.seeders || 0;
    const seedersScore = n2 >= 50 ? 35 : n2 >= 10 ? 25 : n2 >= 1 ? 15 : 3;
    t2 += seedersScore;
    const a2 = (e2.title || "").toLowerCase();
    const resolutionScore = /4k|2160p/.test(a2) ? 25 : /1080p/.test(a2) ? 20 : /720p/.test(a2) ? 15 : 5;
    t2 += resolutionScore;
    const subtitleScore = /-c\b|-uc\b|chinese|中字|字幕/.test(a2) ? 20 : 0;
    t2 += subtitleScore;
    const i2 = e2.date ? _daysSince(e2.date) : 999;
    const freshnessScore = i2 <= 7 ? 15 : i2 <= 30 ? 12 : i2 <= 90 ? 8 : 3;
    t2 += freshnessScore;
    const completenessScore = /sample|预告|trailer/.test(a2) ? -15 : 0;
    t2 += completenessScore;
    return { total: Math.max(0, Math.min(100, t2)), seeders: seedersScore, resolution: resolutionScore, subtitle: subtitleScore, freshness: freshnessScore, completeness: completenessScore };
  }
  __name(calcMagnetScore, "calcMagnetScore");
  function _daysSince(e2) {
    try {
      const t2 = new Date(e2);
      if (isNaN(t2.getTime())) return 999;
      return Math.max(0, Math.floor((Date.now() - t2.getTime()) / 864e5));
    } catch (t2) {
      return 999;
    }
  }
  __name(_daysSince, "_daysSince");
  var _MagnetHubPlugin = class _MagnetHubPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "currentEngine", null), i(this, "sourceRegistry", new MagnetSourceRegistry()), i(this, "searchEngines", []);
    }
    async initializeSources() {
      const settings = new ResourceSettingsService(), overrides = await settings.getBuiltInSources(), custom = await settings.getMagnetSources();
      const configured = /* @__PURE__ */ __name((id) => ({ ...BUILT_IN_MAGNET_SOURCES.find(((source) => source.id === id)) || {}, ...overrides.find(((source) => source.id === id)) || {} }), "configured");
      const baseUrl = /* @__PURE__ */ __name((id, fallback) => String(configured(id).baseUrl || fallback).replace(/\/$/, ""), "baseUrl");
      this.sourceRegistry = new MagnetSourceRegistry([
        {
          name: "JavDB 本站",
          id: "native-javdb",
          applicable: r,
          enabled: r,
          priority: 1,
          search: /* @__PURE__ */ __name(async () => parseNativeMagnets(document, "javdb"), "search"),
          targetUrl: /* @__PURE__ */ __name(() => window.location.href, "targetUrl")
        },
        {
          name: "JavBus 本站",
          id: "native-javbus",
          applicable: l,
          enabled: l,
          priority: 2,
          search: /* @__PURE__ */ __name(async () => parseNativeMagnets(document, "javbus"), "search"),
          targetUrl: /* @__PURE__ */ __name(() => window.location.href, "targetUrl")
        },
        {
          name: "U9A9",
          id: "u9a9",
          url: "https://u9a9.com/?type=2&search={keyword}",
          targetPage: "https://u9a9.com/?type=2&search={keyword}",
          priority: 10,
          search: /* @__PURE__ */ __name((keyword) => this.searchTorrentSource("u9a9", `${baseUrl("u9a9", "https://u9a9.com")}/?type=2&search={keyword}`, keyword), "search"),
          targetUrl: /* @__PURE__ */ __name((keyword) => `${baseUrl("u9a9", "https://u9a9.com")}/?type=2&search=${encodeURIComponent(keyword)}`, "targetUrl")
        },
        {
          name: "U3C3",
          id: "u3c3",
          url: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
          targetPage: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
          priority: 20,
          search: /* @__PURE__ */ __name((keyword) => this.searchTorrentSource("u3c3", `${baseUrl("u3c3", "https://u3c3.com")}/?search2=a8lr16lo&search={keyword}`, keyword), "search"),
          targetUrl: /* @__PURE__ */ __name((keyword) => `${baseUrl("u3c3", "https://u3c3.com")}/?search2=a8lr16lo&search=${encodeURIComponent(keyword)}`, "targetUrl")
        },
        {
          name: "Sukebei",
          id: "sukebei",
          url: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
          targetPage: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
          priority: 30,
          search: /* @__PURE__ */ __name((keyword) => this.searchTorrentSource("sukebei", `${baseUrl("sukebei", "https://sukebei.nyaa.si")}/?f=0&c=0_0&q={keyword}`, keyword), "search"),
          targetUrl: /* @__PURE__ */ __name((keyword) => `${baseUrl("sukebei", "https://sukebei.nyaa.si")}/?f=0&c=0_0&q=${encodeURIComponent(keyword)}`, "targetUrl")
        },
        { name: "BTSOW", id: "btsow", priority: 40, search: /* @__PURE__ */ __name((keyword) => this.searchBtsow(keyword, baseUrl("btsow", "https://btsow.lol")), "search"), targetUrl: /* @__PURE__ */ __name((keyword) => `${baseUrl("btsow", "https://btsow.lol")}/search/${encodeURIComponent(keyword)}`, "targetUrl") }
      ].map(((source) => {
        const config = configured(source.id), applicable = source.applicable ?? true;
        return { ...source, ...config, enabled: applicable && (config.enabled ?? source.enabled ?? true), search: source.search, targetUrl: source.targetUrl };
      })));
      custom.filter(((source) => source.enabled)).forEach(((config) => this.sourceRegistry.register({ ...config, id: `custom:${config.id}`, search: /* @__PURE__ */ __name((keyword) => this.searchCustomSource(config, keyword), "search"), targetUrl: /* @__PURE__ */ __name((keyword) => config.targetUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword)), "targetUrl") })));
      const enabled = this.sourceRegistry.getEnabledSources().map(((source) => ({ ...source, targetPage: source.targetUrl("{keyword}").replace("%7Bkeyword%7D", "{keyword}") })));
      this.searchEngines = enabled.length ? [{ id: "all", name: "全部", priority: 0, targetPage: "#", search: /* @__PURE__ */ __name((keyword) => this.searchAllSources(enabled, keyword), "search") }, ...enabled] : [];
    }
    getName() {
      return "MagnetHubPlugin";
    }
    async initCss() {
      return "\n            <style>\n                .magnet-container {\n                    margin: 20px auto;\n                    width: 100%;\n                    font-family: Arial, sans-serif;\n                }\n                .magnet-tabs {\n                    display: flex;\n                    border-bottom: 1px solid var(--jhs-border);\n                    margin-bottom: 15px;\n                    justify-content: space-between;\n                }\n                .magnet-tab {\n                    padding: 5px 12px;\n                    cursor: pointer;\n                    border: 1px solid transparent;\n                    border-bottom: none;\n                    margin-right: 5px;\n                    background: var(--jhs-surface-2);\n                    border-radius: 5px 5px 0 0;\n                }\n                .magnet-tab.active {\n                    background: var(--jhs-surface);\n                    border-color: var(--jhs-border);\n                    border-bottom: 1px solid var(--jhs-surface);\n                    margin-bottom: -1px;\n                    font-weight: bold;\n                }\n                .magnet-tab:hover:not(.active) {\n                    background: var(--jhs-border);\n                }\n                \n                .magnet-results {\n                    min-height: 200px;\n                }\n                .magnet-result {\n                    padding: 15px;\n                    border-bottom: 1px solid var(--jhs-surface-2);\n                    position: relative; \n                }\n                .magnet-result:hover {\n                    background-color: var(--jhs-surface-2);\n                }\n                .magnet-title {\n                    font-weight: bold;\n                    margin-bottom: 5px;\n                    white-space: nowrap;\n                    overflow: hidden; \n                    text-overflow: ellipsis;\n                    padding-right: 80px; \n                }\n                .magnet-info {\n                    display: flex;\n                    justify-content: space-between;\n                    font-size: 12px;\n                    color: var(--jhs-text-muted);\n                    margin-bottom: 5px;\n                }\n                .magnet-loading {\n                    text-align: center;\n                    padding: 20px;\n                }\n                .magnet-error {\n                    color: var(--jhs-status-filter-text);\n                    padding: 10px;\n                }\n                \n                .magnet-copy {\n                    position: absolute;\n                    right: 15px;\n                    top: 12px;\n                }\n                .magnet-hub-btn {\n                    background-color: var(--jhs-surface-2);\n                    color: var(--jhs-text-muted);\n                    border: 1px solid var(--jhs-border-strong);\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    transition: all 0.2s;\n                    margin-left: 10px;\n                }\n                .magnet-hub-btn:hover {\n                    background-color: var(--jhs-border);\n                    border-color: var(--jhs-border);\n                }\n                .magnet-hub-btn.copied {\n                    background-color: var(--jhs-status-down);\n                    color: var(--jhs-status-down-on);\n                    border-color: var(--jhs-status-down);\n                }\n            </style>\n        ";
    }
    async createMagnetHub(e2) {
      await this.initializeSources();
      e2 = e2.replace("FC2-", "");
      const t2 = $('<div class="magnet-container jhs-ui"></div>'), n2 = $('<div class="magnet-tabs"></div>'), a2 = "jhs_magnetHub_selectedEngine", i2 = localStorage.getItem(a2);
      const o2 = $('<div class="magnet-tabs__options" role="tablist" aria-label="磁力来源"></div>');
      this.currentEngine = this.searchEngines.find(((engine) => engine.id === i2)) || this.searchEngines[0] || null;
      if (!this.currentEngine) return t2.append($('<div class="magnet-error"></div>').text("暂无可用磁力来源，请前往设置启用来源"));
      this.searchEngines.forEach(((engine) => o2.append($('<button type="button" class="jhs-btn magnet-tab" role="tab" aria-selected="false" tabindex="-1"></button>').attr("data-engine", engine.id).text(engine.name).toggleClass("active", engine.id === this.currentEngine.id))));
      const target = $('<a class="jhs-btn jhs-btn--ghost" id="targetBox" target="_blank" rel="noopener noreferrer">原网页</a>').attr("href", this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e2))).toggle("all" !== this.currentEngine.id);
      n2.append(o2), n2.append(target), o2.find(".magnet-tab.active").attr({ "aria-selected": "true", tabindex: "0" }), t2.append(n2);
      const r2 = $('<div class="magnet-results"></div>');
      return t2.append(r2), t2.on("click", ".magnet-tab", ((n3) => {
        const i3 = $(n3.target).data("engine");
        this.currentEngine = this.searchEngines.find(((e3) => e3.id === i3)), $("#targetBox").attr("href", this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e2))).toggle("all" !== this.currentEngine.id), localStorage.setItem(a2, i3), t2.find(".magnet-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" }), $(n3.target).addClass("active").attr({ "aria-selected": "true", tabindex: "0" }), this.searchEngine(r2, this.currentEngine, e2);
      })), t2.on("keydown", ".magnet-tab", ((e3) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e3.key)) return;
        e3.preventDefault();
        const n3 = t2.find(".magnet-tab"), a3 = n3.index(e3.currentTarget);
        let i3 = "Home" === e3.key ? 0 : "End" === e3.key ? n3.length - 1 : "ArrowRight" === e3.key ? (a3 + 1) % n3.length : (a3 - 1 + n3.length) % n3.length;
        n3.eq(i3).trigger("click").trigger("focus");
      })), this.searchEngine(r2, this.currentEngine, e2), t2;
    }
    async searchEngine(e2, t2, n2) {
      e2.html(`<div class="magnet-loading">正在从 ${escapeHtml(t2.name)} 搜索 "${escapeHtml(n2)}"...</div>`);
      const a2 = `${t2.name}_${n2}`;
      if (t2.search) try {
        return void this.displayResults(e2, await this.applyRuntimeRules(deduplicateMagnetResults(await t2.search(n2))), t2.name);
      } catch (error) {
        clog.error(`磁力源 ${t2.name} 请求失败`, error);
        return void e2.html(`<div class="magnet-error">${escapeHtml(t2.name)} 请求失败</div>`);
      }
      if (t2.parseHtml) try {
        const i2 = t2.url.replace("{keyword}", encodeURIComponent(n2)), s2 = await storageManager.cachedRequest(`magnet:${t2.id}:${n2}`, 216e5, (() => gmHttp.get(i2).then(((e3) => t2.parseHtml.call(this, e3, n2)))));
        return void this.displayResults(e2, s2, t2.name);
      } catch (s2) {
        return void e2.html(`<div class="magnet-error">解析 ${escapeHtml(t2.name)} 结果失败: ${escapeHtml(s2.message)}</div>`);
      }
      t2.parseJson && await t2.parseJson.call(this, e2, t2, n2, a2);
    }
    async searchTorrentSource(source, template, keyword) {
      const url = template.replace("{keyword}", encodeURIComponent(keyword));
      return storageManager.cachedRequest(`magnet:${source}:${keyword}`, CACHE_TTL.magnet, (async () => {
        const html = await gmHttp.get(url);
        return this.parseTorrentList(html, keyword).map(((item) => ({ ...item, source, files: [] })));
      }));
    }
    async searchCustomSources(keyword) {
      const configs = JSON.parse(await storageManager.getSetting("customMagnetSources", "[]"));
      const enabled = configs.filter(((config) => config.enabled)).map(validateCustomMagnetSource);
      const groups = await mapLimit(enabled, 4, (async (config) => {
        const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
        try {
          const payload = await storageManager.cachedRequest(`magnet:custom:${config.id}:${keyword}`, CACHE_TTL.magnet, (() => gmHttp.get(url)));
          const parsed = "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload;
          return parseCustomMagnetResponse(config, parsed, config.id);
        } catch (cause) {
          clog.error(`自定义磁力源 ${config.name} 失败`, new ProviderError(config.id, cause._cfBlocked ? "CF_BLOCKED" : "HTTP_ERROR", cause.message, { cause, url, status: cause.status }));
          return [];
        }
      }));
      return deduplicateMagnetResults(groups.flat());
    }
    async searchCustomSource(config, keyword) {
      const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
      const payload = await storageManager.cachedRequest(`magnet:custom:${config.id}:${keyword}`, CACHE_TTL.magnet, (() => gmHttp.get(url)));
      return parseCustomMagnetResponse(config, "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload, config.id);
    }
    async searchAllSources(sources, keyword) {
      const groups = await mapLimit(sources, 3, (async (source) => {
        try {
          return await source.search(keyword);
        } catch (error) {
          clog.warn(`磁力源 ${source.name} 聚合失败`, error);
          return [];
        }
      }));
      return deduplicateMagnetResults(groups.flat());
    }
    async searchBtsow(keyword, baseUrl = "https://btsow.lol") {
      const payload = await storageManager.cachedRequest(`magnet:btsow:${keyword}`, CACHE_TTL.magnet, (() => gmHttp.gmRequest("POST", `${baseUrl}/search`, JSON.stringify([{ search: keyword }, 50, 1]), {}, { "Content-Type": "application/json" })));
      const value = "string" === typeof payload ? JSON.parse(payload) : payload;
      return (value?.data || []).map(((item) => normalizeMagnetResult({ title: item.name, magnet: `magnet:?xt=urn:btih:${item.hash}`, size: `${(Number(item.size) / 1073741824).toFixed(2)} GB`, date: utils.formatDate(new Date(1e3 * item.lastUpdateTime)) }, "btsow"))).filter(Boolean);
    }
    async applyRuntimeRules(results) {
      const service = new ResourceSettingsService(), [tags, filters] = await Promise.all([service.getMagnetTagRules(), service.getMagnetFilterRules()]);
      return results.map(((result) => applyMagnetRules(result, tags, filters.filter(((rule) => (rule.target || "title") === "title")), filters.filter(((rule) => rule.target === "file"))))).filter(((result) => !result.hidden));
    }
    async displayResults(e2, t2, n2) {
      function a2(e3) {
        const t3 = e3.text();
        e3.addClass("copied").text("已复制"), setTimeout((() => {
          e3.removeClass("copied").text(t3);
        }), 2e3);
      }
      __name(a2, "a");
      e2.empty(), 0 !== t2.length ? (t2.forEach(((e3) => {
        const base = this.calcMagnetScore(e3);
        e3._score = { ...base, total: Math.max(0, Math.min(100, base.total + (e3.customTagWeight || 0) + (e3.filterPenalty || 0))) };
      })), t2.sort(((e3, t3) => t3._score.total - e3._score.total)), t2.forEach(((t3) => {
        const n3 = t3._score ? t3._score.total : 0, a3 = n3 >= 80 ? "高" : n3 >= 60 ? "中" : "低", i2 = t3._score ? `做种:${t3._score.seeders}/35 分辨率:${t3._score.resolution}/25 字幕:${t3._score.subtitle}/20 新鲜度:${t3._score.freshness}/15 完整性:${t3._score.completeness}/5` : "";
        const safeTitle = escapeHtml(t3.title), safeMagnet = escapeHtml(t3.magnet), safeSize = escapeHtml(String(t3.size || "未知")), safeDate = escapeHtml(String(t3.date || "未知"));
        const item = $(`
                <div class="magnet-result">
                    <div class="magnet-title">
                        <span class="magnet-score" title="${i2}">${a3} ${n3}</span>
                        <a href="${safeMagnet}">${safeTitle}</a>
                    </div>
                    <div class="magnet-info">
                        <span>大小: ${safeSize}</span>
                        <span>做种: ${t3.seeders || "—"}</span>
                        <span>日期: ${safeDate}</span>
                    </div>
                    <div class="magnet-copy">
                        <button type="button" class="jhs-btn magnet-hub-btn copy-btn" data-magnet="${safeMagnet}">复制链接</button>
                    </div>
                </div>
            `);
        t3.tags?.length && item.find(".magnet-info").after($("<div></div>").addClass("magnet-tags").append(t3.tags.map(((tag) => $("<span></span>").addClass("jhs-badge").text(tag)))));
        const copyBox = item.find(".magnet-copy");
        copyBox.append(`<button type="button" class="jhs-btn magnet-hub-btn jhs-offline-btn" data-resource="${safeMagnet}">离线</button>`);
        item.appendTo(e2);
      })), e2.on("click", ".copy-btn", (async function() {
        const e3 = $(this), t3 = e3.data("magnet");
        await utils.copyToClipboard("磁力链接", t3) && a2(e3);
      }))) : e2.append('<div class="magnet-error">没有找到相关结果</div>');
    }
    parseTorrentList(e2, t2) {
      const n2 = utils.htmlTo$dom(e2), a2 = [];
      return n2.find(".torrent-list tbody tr").each(((e3, n3) => {
        const i2 = $(n3);
        if (i2.text().includes("置顶")) return;
        const s2 = i2.find("td:nth-child(2) a").attr("title") || i2.find("td:nth-child(2) a").text().trim();
        if (!s2.toLowerCase().includes(t2.toLowerCase())) return;
        const o2 = i2.find("td:nth-child(3) a[href^='magnet:']").attr("href"), r2 = i2.find("td:nth-child(4)").text().trim(), l2 = i2.find("td:nth-child(5)").text().trim(), c2 = parseInt(i2.find("td:nth-child(6)").text().trim()) || 0, d2 = parseInt(i2.find("td:nth-child(7)").text().trim()) || 0;
        o2 && a2.push({
          title: s2,
          magnet: o2,
          size: r2,
          date: l2,
          seeders: c2,
          leechers: d2
        });
      })), a2;
    }
    calcMagnetScore(e2) {
      return calcMagnetScore(e2);
    }
  };
  __name(_MagnetHubPlugin, "MagnetHubPlugin");
  var MagnetHubPlugin = _MagnetHubPlugin;
  var _ScreenshotProviderRegistry = class _ScreenshotProviderRegistry {
    constructor(providers = []) {
      this.providers = /* @__PURE__ */ new Map();
      providers.forEach(((provider) => this.register(provider)));
    }
    register(provider) {
      if (!provider?.id || !provider.name || "function" !== typeof provider.getScreenshot) throw new TypeError("Invalid screenshot provider");
      this.providers.set(provider.id, { enabled: true, priority: 100, ...provider });
      return this;
    }
    get(id) {
      return this.providers.get(id) || null;
    }
    getEnabledProviders() {
      return [...this.providers.values()].filter(((provider) => provider.enabled)).sort(((a2, b2) => a2.priority - b2.priority));
    }
    async first(carNum) {
      for (const provider of this.getEnabledProviders()) {
        try {
          const result = await provider.getScreenshot(carNum);
          if (result?.url) return result;
        } catch (error) {
          clog.warn(`截图源 ${provider.name} 请求失败`, error);
        }
      }
      return null;
    }
  };
  __name(_ScreenshotProviderRegistry, "ScreenshotProviderRegistry");
  var ScreenshotProviderRegistry = _ScreenshotProviderRegistry;
  var _ScreenShotPlugin = class _ScreenShotPlugin extends BasePlugin {
    constructor() {
      super(...arguments), this.providerRegistry = new ScreenshotProviderRegistry();
    }
    async initializeProviders() {
      const settings = await new ResourceSettingsService().getScreenshotSettings(), configured = /* @__PURE__ */ __name((id) => settings.providers.find(((provider) => provider.id === id)) || {}, "configured");
      this.providerRegistry = new ScreenshotProviderRegistry([
        { id: "javstore", name: "JavStore", priority: 10, getScreenshot: /* @__PURE__ */ __name((carNum) => this.getCachedProviderScreenshot("javstore", carNum, (() => this.getJavStoreScreenShot(carNum))), "getScreenshot") },
        { id: "projectjav", name: "ProjectJav", enabled: false, priority: 20, getScreenshot: /* @__PURE__ */ __name(async () => null, "getScreenshot") },
        { id: "18av", name: "18AV", enabled: false, priority: 30, getScreenshot: /* @__PURE__ */ __name(async () => null, "getScreenshot") }
      ].map(((provider) => ({ ...provider, ...configured(provider.id), enabled: !["projectjav", "18av"].includes(provider.id) && (configured(provider.id).enabled ?? provider.enabled ?? true), getScreenshot: provider.getScreenshot }))));
      return settings.mode;
    }
    getName() {
      return "ScreenShotPlugin";
    }
    async initCss() {
      return `<style>.jhs-screenshot-message{margin-top:50px;color:var(--jhs-text-muted);cursor:auto}.jhs-screenshot-message--bus{margin-top:30px}</style>`;
    }
    async handle() {
      await this.loadScreenShot();
    }
    async loadScreenShot() {
      if (!isDetailPage) return;
      if ("yes" !== await storageManager.getSetting("enableLoadScreenShot", "yes")) return;
      let e2 = this.getPageInfo().carNum;
      r && $(".preview-images .tile-item").first().before(' <a class="tile-item screen-container jhs-layout-cd9d5db1"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> '), l && $("#sample-waterfall .sample-box:first").after(' <a class="sample-box screen-container jhs-layout-b5c4e4f7"><div class="jhs-layout-3536a853">正在加载缩略图</div></a> ');
      const mode = await this.initializeProviders();
      if ("manual" === mode) return $(".screen-container").text("请选择截图来源"), void this.renderProviderTabs(e2);
      try {
        const t2 = await this.getScreenshot(e2);
        this.addImg("缩略图", t2), clog.log("加载缩略图:", t2);
      } catch (t2) {
        this.showErrorFallback(e2, t2);
      }
    }
    renderProviderTabs(carNum) {
      const tabs = $('<div class="jhs-screenshot-providers" role="tablist"></div>');
      this.providerRegistry.providers.forEach(((provider) => tabs.append($('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').prop("disabled", !provider.enabled).attr("data-provider", provider.id).text(provider.name))));
      $(".screen-container").before(tabs);
      tabs.on("click", "button:not(:disabled)", (async (event) => {
        const provider = this.providerRegistry.get($(event.currentTarget).data("provider"));
        $(".screen-container").text(`${provider.name} 加载中…`);
        try {
          const result = await provider.getScreenshot(carNum);
          result?.url ? this.addImg(`${provider.name} 缩略图`, result.url) : $(".screen-container").text(`${provider.name} 无结果`);
        } catch (error) {
          $(".screen-container").text(`${provider.name} 请求失败`);
          clog.error("截图源请求失败", error);
        }
      }));
    }
    async getScreenshot(e2) {
      e2 = normalizeCarNum(e2);
      if (!e2) throw clog.warn("跳过缩略图解析：番号不可用"), new Error("缩略图番号不可用");
      await this.initializeProviders();
      localStorage.removeItem("jhs_screenShot");
      let n2;
      try {
        n2 = await this.providerRegistry.first(e2);
      } catch (i2) {
        throw clog.error("获取缩略图资源失败:", n2, i2), i2;
      }
      if (!n2) return this.showErrorFallback(e2, null), null;
      let url = n2.url, a2 = url.indexOf("https://");
      return -1 !== a2 && (url = url.substring(a2)), clog.log(`缩略图获取成功 (${n2.source}):`, url), url;
    }
    async getCachedProviderScreenshot(provider, carNum, loader) {
      const value = await storageManager.cachedRequest(`screenshot:${provider}:${carNum}`, CACHE_TTL.screenshot, (async () => {
        const loadedUrl = await loader(), url2 = "javstore" === provider ? normalizeJavStoreAssetUrl(loadedUrl) : loadedUrl;
        return url2 ? { __jhsCacheTtl: CACHE_TTL.screenshot, data: { url: url2 } } : { __jhsCacheTtl: CACHE_TTL.screenshotNegative, data: { miss: true } };
      }));
      if (!value || value.miss) return null;
      const cachedUrl = "string" === typeof value ? value : value.url, url = "javstore" === provider ? normalizeJavStoreAssetUrl(cachedUrl) : cachedUrl;
      return url ? { url, source: provider, detailUrl: null } : null;
    }
    async getJavStoreScreenShot(e2) {
      const t2 = `https://javstore.net/search?q=${encodeURIComponent(e2)}`;
      clog.debug("JavStore 搜索地址:", t2);
      let n2 = await gmHttp.get(t2, {}, {}, false, { ignoreNotFound: true });
      if (!n2) return clog.debug("JavStore 搜索页未获取:", t2), null;
      const a2 = utils.htmlTo$dom(n2);
      const i2 = parseJavStoreSearch(a2, e2);
      if (!i2.length) return clog.debug("JavStore, 查询番号无结果:", t2), null;
      for (const e3 of i2) {
        const t3 = e3;
        clog.debug("JavStore 候选详情:", t3);
        const n3 = await gmHttp.get(t3, {}, {}, false, { ignoreNotFound: true });
        if (!n3) {
          clog.debug("JavStore 详情页未获取:", t3);
          continue;
        }
        const a3 = parseJavStorePreview(utils.htmlTo$dom(n3), t3);
        if (!a3) {
          clog.debug("JavStore 详情页没有 CLICK HERE!:", t3);
          continue;
        }
        return clog.debug("JavStore 预览图:", a3), a3;
      }
      return clog.debug("JavStore, 所有候选均无有效预览图:", t2), null;
    }
    addImg(e2, t2) {
      const url = normalizeJavStoreAssetUrl(t2);
      url && (r && $(".screen-container").html(`<img src="${url}" alt="${e2}" loading="lazy" class="jhs-layout-cad980f4">`), l && $(".screen-container").html(`<div class="photo-frame"><img src="${url}" title="${e2}" alt="${e2}" class="jhs-layout-d4a575e8"></div>`), $(".screen-container").on("click", ((e3) => {
        e3.stopPropagation(), e3.preventDefault(), showImageViewer(e3.currentTarget);
      })));
    }
    showErrorFallback(e2, t2) {
      var n2;
      clog.error("获取缩略图失败:", null == (n2 = null == t2 ? void 0 : t2.message) ? void 0 : n2.substring(0, 100));
      const a2 = `jhs-screenshot-message${l ? " jhs-screenshot-message--bus" : ""}`;
      if (!(e2 = normalizeCarNum(e2))) return void $(".screen-container").empty().append($("<div></div>").addClass(a2).text("无法获取番号，缩略图未加载"));
      const searchUrl = `https://javstore.net/search?q=${encodeURIComponent(e2)}`;
      $(".screen-container").html(`<div class="${a2}">获取缩略图失败</div><br/><a href='#' class='retry-link'>点击重试</a> 或 <a class="check-link" href='${searchUrl}' target='_blank'>前往确认</a>`).off("click", ".retry-link").off("click", ".check-link").on("click", ".retry-link", (async (t3) => {
        t3.stopPropagation(), t3.preventDefault(), $(".screen-container").html(`<div class="${a2}">正在重新加载...</div>`);
        try {
          const t4 = await this.getScreenshot(e2);
          this.addImg("缩略图", t4);
        } catch (n3) {
          this.showErrorFallback(e2, n3);
        }
      })).on("click", ".check-link", (async (t3) => {
        t3.stopPropagation(), t3.preventDefault(), window.open(searchUrl, "_blank");
      }));
    }
  };
  __name(_ScreenShotPlugin, "ScreenShotPlugin");
  var ScreenShotPlugin = _ScreenShotPlugin;
  var _FavoriteActressesPlugin = class _FavoriteActressesPlugin extends BasePlugin {
    getName() {
      return "FavoriteActressesPlugin";
    }
    async handle() {
      this.bindEvent(), await this.highlightActress(), this.replaceActressAvatar();
    }
    async highlightActress() {
      if (!isDetailPage) return;
      if (await storageManager.getSetting("enableFavoriteActresses", _) !== _) return;
      const e2 = await storageManager.getFavoriteActressList();
      if (!e2 || 0 === e2.length) return;
      const t2 = /* @__PURE__ */ new Set();
      e2.forEach(((e3) => {
        e3.starId && t2.add(String(e3.starId).trim());
      })), 0 !== t2.size && $(".female").prev().each(((e3, n2) => {
        const a2 = $(n2), i2 = a2.attr("href");
        let s2 = null;
        if (i2) {
          const e4 = (i2.endsWith("/") ? i2.slice(0, -1) : i2).split("/"), t3 = e4[e4.length - 1];
          t3 && (s2 = t3.trim());
        }
        let o2 = false;
        s2 && (o2 = t2.has(s2)), o2 && (a2.addClass("highlighted"), a2.attr("title", "高亮已收藏演员, 可在设置-基础配置中关闭"));
      }));
    }
    async removeActorFromStorage(e2) {
      await storageManager.removeFavoriteActress(e2) && (clog.log("移除演员成功"), document.dispatchEvent(new CustomEvent("actress-state-changed", { detail: { starId: String(e2) } })));
    }
    bindEvent() {
      const e2 = /\/actors\/(\w+)\/(collect|uncollect)/;
      $(document).on("confirm:complete", 'a[href*="/actors/"][href*="/uncollect"]', (async (t2) => {
        const [n2] = t2.detail;
        if (!n2) return;
        const a2 = $(t2.currentTarget).attr("href").match(e2), i2 = a2 ? a2[1] : null;
        i2 && await this.removeActorFromStorage(i2);
      })), $("#button-collect-actor").click((async (t2) => {
        const n2 = $("#button-collect-actor").attr("href").match(e2), a2 = n2 ? n2[1] : null;
        let i2 = [], s2 = $(".actor-section-name");
        s2.length && s2.text().trim().split(",").forEach(((e3) => {
          i2.push(e3.trim());
        }));
        let o2 = $(".section-meta:not(:contains('影片'))");
        if (o2.length && o2.text().trim().split(",").forEach(((e3) => {
          i2.push(e3.trim());
        })), !i2.length) return void clog.error("获取演员名称失败");
        const r2 = i2[0];
        if (!a2) return void clog.error("无法获取演员ID进行收藏操作。");
        const l2 = ($(".avatar").first().css("background-image") || "").replace(/^url\(["']?|["']?\)$/g, ""), c2 = {
          starId: a2,
          name: r2,
          allName: i2,
          avatar: l2
        };
        1 === await storageManager.addFavoriteActressList([c2]) ? (clog.log(`收藏演员成功: ${r2} (ID: ${a2})`), document.dispatchEvent(new CustomEvent("actress-state-changed", { detail: { starId: String(a2) } }))) : clog.log(`收藏演员失败: ${r2} (ID: ${a2})`);
      })), $("#button-uncollect-actor").click((async (t2) => {
        const n2 = $("#button-uncollect-actor").attr("href").match(e2), a2 = n2 ? n2[1] : null;
        a2 ? await this.removeActorFromStorage(a2) : clog.error("无法获取演员ID进行取消收藏操作。");
      }));
    }
    async replaceActressAvatar() {
      const e2 = this.getActressId();
      if (!e2) return;
      const t2 = (await storageManager.getFavoriteActressList()).find(((t3) => t3.starId === e2));
      if (t2 && t2.avatar) {
        const e3 = `url('${t2.avatar}')`;
        let n2 = $(".avatar").first();
        if (0 === n2.length) {
          const e4 = '<div class="column actor-avatar"> <div class="image"> <span class="avatar"></span> </div> </div>';
          $(".section-columns").prepend(e4), n2 = $(".avatar").first();
        }
        if (0 === n2.length) return;
        n2.css("background-image").trim().toLowerCase() !== e3.trim().toLowerCase() && (n2.css("background-image", e3), n2.css("background-size", "cover"), n2.css("background-position", "top center"), n2.css("background-repeat", "no-repeat"));
      }
    }
  };
  __name(_FavoriteActressesPlugin, "FavoriteActressesPlugin");
  var FavoriteActressesPlugin = _FavoriteActressesPlugin;
  var _BusImgPlugin = class _BusImgPlugin extends BasePlugin {
    getName() {
      return "BusImgPlugin";
    }
    handle() {
    }
    async getVisibleImageItems(e2, t2) {
      let n2 = [];
      const a2 = document.querySelectorAll(e2);
      for (const i2 of a2) {
        if (!utils.isHidden(i2)) {
          const e3 = i2.querySelector(t2);
          if (!(e3 instanceof HTMLImageElement)) continue;
          e3.style.removeProperty("height");
          let a3 = e3.offsetHeight;
          a3 > 0 && n2.push({
            element: i2,
            imgElement: e3,
            height: a3
          });
        }
      }
      return n2;
    }
    async logImageHeightsByRow() {
      if (await storageManager.getSetting("enableVerticalModel", C) === _) return;
      const e2 = this.getSelector().itemSelector, t2 = await storageManager.getSetting("containerColumns", 5), n2 = await this.getVisibleImageItems(e2, "img");
      if (0 === n2.length) return;
      const a2 = [];
      for (let i2 = 0; i2 < n2.length; i2++) {
        const e3 = Math.floor(i2 / t2);
        a2[e3] || (a2[e3] = []), a2[e3].push(n2[i2]);
      }
      a2.forEach(((e3, t3) => {
        const n3 = e3.map(((e4) => e4.height));
        if (n3.length < 2) return;
        const a3 = Math.min(...n3), i2 = Math.max(...n3);
        let s2 = 0;
        i2 - a3 > 50 && (s2 = a3, e3.forEach(((e4) => {
          if (e4.height !== s2) {
            const t4 = `${s2}px`;
            e4.imgElement.style.setProperty("height", t4, "important");
          }
        })));
      }));
    }
  };
  __name(_BusImgPlugin, "BusImgPlugin");
  var BusImgPlugin = _BusImgPlugin;
  var _TranslatePlugin = class _TranslatePlugin extends BasePlugin {
    getName() {
      return "TranslatePlugin";
    }
    async initCss() {
      return "\n            <style>\n                .translated-title { margin-top:var(--jhs-space-2); color:var(--jhs-text); font-size:clamp(16px,1.5vw,18px); font-weight:500; line-height:1.5; }\n                .translated-title.is-error { color:var(--jhs-danger); }\n            </style>";
    }
    handle() {
      isDetailPage && this.translate();
    }
    async translate(e2, t2 = true) {
      if (await storageManager.getSetting("translateTitle", _) !== _) return;
      l && (t2 = false);
      let n2 = $(".origin-title");
      if (n2.length || (n2 = $(".current-title")), n2.length || (n2 = $("h3")), !n2.length) return;
      const a2 = n2.text().trim();
      if (!a2) return void show.error("获取标题失败, 无法进行翻译");
      let i2 = n2.nextAll(".translated-title").first();
      i2.length || (i2 = $('<div class="translated-title"></div>').insertAfter(n2)), i2.removeClass("is-error").text("翻译中...");
      e2 || (e2 = this.getPageInfo().carNum);
      const s2 = "string" == typeof e2 ? e2.trim() : "", o2 = s2 && "undefined" !== s2 ? s2 : a2;
      let r2 = {};
      try {
        const e3 = localStorage.getItem("jhs_translate");
        e3 && (r2 = JSON.parse(e3) || {});
      } catch (l2) {
        clog.warn("翻译缓存无法解析，已忽略旧缓存", l2);
      }
      if (r2[o2]) return void i2.text(r2[o2]);
      try {
        const e3 = await _e(a2, "ja", "zh-CN");
        i2.text(e3), r2[o2] = e3, localStorage.setItem("jhs_translate", JSON.stringify(r2));
      } catch (l2) {
        clog.error("翻译失败:", l2), i2.addClass("is-error").text(`翻译失败: ${l2.message || String(l2)}`);
      }
    }
  };
  __name(_TranslatePlugin, "TranslatePlugin");
  var TranslatePlugin = _TranslatePlugin;
  var _TaskPlugin = class _TaskPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "singleTaskKey", "checkNewActressActorFilterCar"), i(this, "taskConfig", null), i(this, "storageQueue", new StorageQueue()), i(this, "lastCheckFavoriteActressTimeKey", "jhs_time_checkFavoriteActress"), i(this, "lastCheckBlacklistTimeKey", "jhs_time_checkBlacklist"), i(this, "lastCheckNewVideoTimeKey", "jhs_time_checkNewVideo"), i(this, "taskTimer", null), i(this, "taskRunning", false), i(this, "visibilityHandler", null), i(this, "pageHideHandler", null);
    }
    getName() {
      return "TaskPlugin";
    }
    getStartupMode() {
      return "idle";
    }
    async limitConcurrency(e2, t2, n2, a2) {
      this.showIsRun();
      let i2 = 0, s2 = false;
      const o2 = Math.max(1, Math.min(t2, e2.length)), r2 = Array.from({ length: o2 }, (async () => {
        for (; !s2; ) {
          const t3 = i2++;
          if (t3 >= e2.length) return;
          try {
            await a2(e2[t3]);
          } catch (e3) {
            if (this.isNetworkBlocked(e3)) throw s2 = true, e3;
            throw e3;
          }
          const o3 = e2.length - i2;
          o3 > 0 && (clog.debug(`剩余任务数: <span class="jhs-task-emphasis">${o3}</span>`), await utils.sleep(n2));
        }
      }));
      const l2 = await Promise.allSettled(r2), c2 = l2.find(((e3) => "rejected" === e3.status));
      if (c2) throw c2.reason;
    }
    isNetworkBlocked(e2) {
      return true === e2?._cfBlocked || true === e2?._circuitBroken;
    }
    isUnnecessaryCheck(e2, t2) {
      if (!t2) throw new Error("未传入checkIntervalTime");
      t2 = parseInt(t2);
      return utils.getHourDifference(new Date(e2), /* @__PURE__ */ new Date()) < t2;
    }
    handle() {
      if (!window.isListPage) return;
      this.visibilityHandler || (this.visibilityHandler = () => {
        document.hidden ? this.clearSchedule() : this.scheduleTask(0);
      }, this.pageHideHandler = () => this.clearSchedule(), document.addEventListener("visibilitychange", this.visibilityHandler), window.addEventListener("pagehide", this.pageHideHandler));
      return document.hidden ? void 0 : this.runAndSchedule();
    }
    clearSchedule() {
      this.taskTimer && (clearTimeout(this.taskTimer), this.taskTimer = null);
    }
    scheduleTask(e2 = 3e5) {
      if (!window.isListPage || document.hidden) return void this.clearSchedule();
      this.clearSchedule(), this.taskTimer = setTimeout((() => {
        this.taskTimer = null, void this.runAndSchedule();
      }), e2);
    }
    async runAndSchedule() {
      if (this.taskRunning || !window.isListPage || document.hidden) return;
      this.taskRunning = true;
      try {
        await this.doTask();
      } finally {
        this.taskRunning = false, this.scheduleTask();
      }
    }
    showIsRun() {
      show.info("正在执行检测任务中, 请勿关闭当前窗口", {
        duration: 3e3
      });
    }
    async doTask() {
      if (!window.isListPage) return;
      await this.loadConfig(), this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl();
      return navigator.locks.request(this.singleTaskKey, {
        ifAvailable: true
      }, (async (e2) => {
        if (e2) {
          if (window.isListPage && (this.taskConfig.enableCheckBlacklist === _ ? await this.checkBlacklist() : clog.warn("自动检测屏蔽黑名单-禁用"), !l)) {
            if (this.taskConfig.enableCheckFavoriteActress === _) {
              const e3 = localStorage.getItem(this.lastCheckFavoriteActressTimeKey), t2 = this.taskConfig.checkFavoriteActress_IntervalTime, n2 = e3 && this.isUnnecessaryCheck(e3, t2), a2 = $('a[href*="/users/profile"]').length > 0;
              n2 && clog.debug(`检测同步演员, 上次检测时间: ${e3} 检测间隔时间: ${t2}小时 未到时间`), !n2 && a2 && await this.checkFavoriteActress();
            } else clog.warn("自动同步已收藏的演员-禁用");
            this.taskConfig.enableCheckNewVideo === _ ? await this.checkNewVideo() : clog.warn("自动检测已收藏演员的最新作品-禁用");
          }
        } else clog.debug("争夺任务锁失败, 跳过执行");
      })).catch(((e2) => {
        this.isNetworkBlocked(e2) ? clog.warn(`后台检测已停止: ${e2.message}`) : clog.error("锁任务出现错误:", e2);
      }));
    }
    async loadConfig() {
      const e2 = await storageManager.getSetting();
      this.taskConfig = {
        checkConcurrencyCount: e2.checkConcurrencyCount ? Number(e2.checkConcurrencyCount) : 2,
        checkRequestSleep: e2.checkRequestSleep ? Number(e2.checkRequestSleep) : 100,
        enableCheckBlacklist: e2.enableCheckBlacklist || _,
        checkBlacklist_intervalTime: e2.checkBlacklist_intervalTime ? Number(e2.checkBlacklist_intervalTime) : 12,
        checkBlacklist_ruleTime: e2.checkBlacklist_ruleTime ? Number(e2.checkBlacklist_ruleTime) : 8760,
        enableCheckFavoriteActress: e2.enableCheckFavoriteActress || _,
        checkFavoriteActress_IntervalTime: e2.checkFavoriteActress_IntervalTime ? Number(e2.checkFavoriteActress_IntervalTime) : 24,
        enableCheckNewVideo: e2.enableCheckNewVideo || _,
        checkNewVideo_intervalTime: e2.checkNewVideo_intervalTime ? Number(e2.checkNewVideo_intervalTime) : 12,
        checkNewVideo_ruleTime: e2.checkNewVideo_ruleTime ? Number(e2.checkNewVideo_ruleTime) : 8760
      };
    }
    /** 确保所有任务入口均已具备配置和站点地址。 */
    async ensureReady() {
      this.taskConfig || await this.loadConfig(), this.javDbUrl || (this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl());
      if (!this.javDbUrl) throw new Error("JavDB 地址未配置");
    }
    async checkBlacklist(e2) {
      await this.ensureReady();
      let t2 = await storageManager.getBlacklist();
      if (0 === t2.length) return;
      t2 = t2.sort(((e3, t3) => e3.createTime < t3.createTime ? 1 : e3.createTime > t3.createTime ? -1 : 0));
      const n2 = this.taskConfig.checkConcurrencyCount, a2 = this.taskConfig.checkRequestSleep, i2 = this.taskConfig.checkBlacklist_intervalTime, s2 = this.taskConfig.checkBlacklist_ruleTime, o2 = localStorage.getItem(this.lastCheckBlacklistTimeKey);
      if (!e2 && o2 && this.isUnnecessaryCheck(o2, i2)) return void clog.debug(`检测黑名单, 上次检测时间: ${o2} 检测间隔时间: ${i2}小时 未到时间`);
      const r2 = [], l2 = [];
      for (const h2 of t2) {
        let t3 = h2.name, n3 = h2.checkTime, a3 = h2.lastPublishTime, o3 = h2.url;
        if (new URL(window.location.href).hostname === new URL(o3).hostname) {
          if (e2 || !n3 || !this.isUnnecessaryCheck(n3, i2)) if (!a3 || 0 === s2 || this.isUnnecessaryCheck(a3, s2)) r2.push(h2);
          else {
            let e3 = `检测黑名单: ${t3} ${a3} 停更超过${s2 / 24 / 365}年,跳过检测`;
            l2.push(e3), $("#checkBlacklistMsg").text(e3);
          }
        } else clog.log("黑名单地址非同域名,跳过", o3);
      }
      if (0 === r2.length) return;
      l2.forEach(((e3) => {
        clog.log(e3);
      })), clog.log(`<span class="jhs-task-emphasis">检测屏蔽黑名单, 总任务数: ${r2.length}, 并发限制:${n2}, 请求间隔时间:${a2}ms</span>`);
      const c2 = this.getBean("BlacklistPlugin");
      await this.limitConcurrency(r2, n2, a2, (async (e3) => {
        let { starId: t3, name: n3, url: a3 } = e3;
        try {
          clog.log("正在检屏黑名单演员:", n3, a3), $("#checkBlacklistMsg").text(`正在检屏黑名单演员: ${n3} ${a3}`);
          const e4 = await gmHttp.get(a3), i3 = utils.htmlTo$dom(e4);
          await this.storageQueue.addTask((async () => {
            let { lastPublishTime: e5 } = await c2.parseAndSaveFilterInfo(i3, n3, t3);
            await storageManager.updateBlacklistItem({
              starId: t3,
              name: n3,
              checkTime: utils.getNowStr(),
              lastPublishTime: e5
            });
          }));
        } catch (i3) {
          if (this.isNetworkBlocked(i3)) throw i3;
          $("#checkBlacklistMsg").text(`检测屏蔽演员信息, 发生错误: ${a3}`), clog.error("检测屏蔽演员信息, 发生错误:", a3, i3), show.error("检测屏蔽演员信息, 发生错误:" + i3, "bottom", "right");
        }
      })), await this.storageQueue.waitAllFinished();
      const d2 = utils.getNowStr();
      localStorage.setItem(this.lastCheckBlacklistTimeKey, d2), clog.log('<span class="jhs-task-emphasis">-------- END 检测屏蔽黑名单 END --------</span>'), $("#checkBlacklistMsg").text("检测屏蔽黑名单, 结束"), await this.getBean("BlacklistPlugin").resetBtnTip();
    }
    async checkFavoriteActress() {
      await this.ensureReady();
      const e2 = `${this.javDbUrl}/users/collection_actors`, t2 = [];
      await this.scrapeActorInfo(e2, t2), clog.log("所有演员信息已收集, 总计数量:", t2.length), $("#checkNewVideoMsg").text("同步完成"), t2.length > 0 && (await storageManager.addFavoriteActressList(t2), localStorage.setItem(this.lastCheckFavoriteActressTimeKey, utils.getNowStr()), await this.getBean("NewVideoPlugin").resetBtnTip());
    }
    async scrapeActorInfo(e2, t2) {
      clog.log(`正在抓取页面: ${e2}`), $("#checkNewVideoMsg").text(`正在解析已收藏的演员: ${e2}`);
      let nextUrl = null;
      try {
        const responseText = await gmHttp.get(e2), $page = utils.htmlTo$dom(responseText);
        const parsedPage = parseJavDbActorList($page, this.javDbUrl);
        t2.push(...parsedPage.actors), nextUrl = parsedPage.nextUrl;
      } catch (n2) {
        throw clog.error(`抓取 ${e2} 时发生错误，停止本轮同步:`, n2), n2;
      }
      if (nextUrl) await this.scrapeActorInfo(nextUrl, t2);
    }
    async checkNewVideo(e2) {
      await this.ensureReady();
      const result = { success: 0, parseFailed: 0, networkFailed: 0, skippedStopped: 0, skippedInterval: 0, aborted: 0 }, t2 = await storageManager.getFavoriteActressList();
      if (!t2.length) return this.renderCheckResult(result, "没有需要检测的演员（当前收藏为空）"), result;
      const n2 = utils.genericSort(t2, [{
        key: /* @__PURE__ */ __name((e3) => {
          var t3;
          return (null == (t3 = e3.newVideoList) ? void 0 : t3.length) ?? 0;
        }, "key"),
        order: "desc"
      }, {
        key: "lastPublishTime",
        order: "desc"
      }]), a2 = this.taskConfig.checkConcurrencyCount, i2 = this.taskConfig.checkRequestSleep, s2 = this.taskConfig.checkNewVideo_intervalTime, o2 = this.taskConfig.checkNewVideo_ruleTime, r2 = localStorage.getItem(this.lastCheckNewVideoTimeKey);
      if (!e2 && r2 && this.isUnnecessaryCheck(r2, s2)) return result.skippedInterval = t2.length, clog.debug(`检测新作品, 上次检测时间: ${r2} 检测间隔时间: ${s2}小时 未到时间`), this.renderCheckResult(result, "检测间隔未到"), result;
      const l2 = [], c2 = [];
      for (const m2 of n2) {
        const { lastCheckTime: t3, lastPublishTime: n3, name: a3 } = m2;
        !e2 && t3 && this.isUnnecessaryCheck(t3, s2) ? result.skippedInterval++ : !n3 || 0 === o2 || this.isUnnecessaryCheck(n3, o2) ? l2.push(m2) : (result.skippedStopped++, c2.push(`检测新作品: ${a3} ${n3} 停更超过${o2 / 24 / 365}年,跳过检测`));
      }
      if (0 === l2.length) return this.renderCheckResult(result, "没有需要检测的演员"), result;
      c2.forEach(((e3) => {
        clog.log(e3);
      })), clog.log(`<span class="jhs-task-emphasis">检测最新作品, 总任务数: ${l2.length}, 并发限制:${a2}, 请求间隔时间:${i2}ms</span>`);
      const d2 = await storageManager.getTitleFilterKeyword(), h2 = await storageManager.getBlacklistCarList(), g2 = new Set(h2.map(((e3) => e3.carNum)));
      try {
        await this.limitConcurrency(l2, a2, i2, (async (e3) => {
          const { lastCheckTime: t3, name: n3, starId: a3 } = e3;
          let i3 = `${this.javDbUrl}/actors/${a3}?t=d`;
          try {
            clog.log("正在检测最新作品, 演员:", n3, i3), $("#checkNewVideoMsg").text(`正在检测最新作品, 演员: ${n3}`);
            const e4 = await gmHttp.get(i3), t4 = utils.htmlTo$dom(e4);
            try {
              await this.storageQueue.addTask((async () => this.parsePage(t4, T, a3, n3, d2, g2))), result.success++;
            } catch (e5) {
              result.parseFailed++, clog.error("解析或保存演员作品失败:", i3, e5);
            }
          } catch (s3) {
            if (this.isNetworkBlocked(s3)) throw result.networkFailed++, s3;
            result.networkFailed++, clog.error("检测演员信息发生网络错误:", i3, s3);
          }
        })), await this.storageQueue.waitAllFinished();
      } catch (error) {
        if (!this.isNetworkBlocked(error)) throw error;
        result.aborted = Math.max(0, l2.length - result.success - result.parseFailed - result.networkFailed), clog.warn(`网络阻断，本轮停止，未执行 ${result.aborted}`);
      }
      result.success > 0 && 0 === result.parseFailed + result.networkFailed + result.aborted && localStorage.setItem(this.lastCheckNewVideoTimeKey, utils.getNowStr()), clog.log('<span class="jhs-task-emphasis">检测最新作品---结束</span>'), this.renderCheckResult(result);
      const p2 = this.getBean("NewVideoPlugin");
      await p2.loadData(), await p2.resetBtnTip();
      return result;
    }
    renderCheckResult(result, prefix = "检测结束") {
      const message = `${prefix}：成功 ${result.success}，解析失败 ${result.parseFailed}，网络失败 ${result.networkFailed}，停更跳过 ${result.skippedStopped}，间隔跳过 ${result.skippedInterval}${result.aborted ? `，未执行 ${result.aborted}` : ""}`;
      $("#checkNewVideoMsg").text(message), clog.log(message);
    }
    async parsePage(e2, site, t2, n2, a2, i2) {
      const selector = this.getSelector(site);
      site === I && e2.find(".avatar-box").length > 0 && e2.find(".avatar-box").parent().remove();
      const pageState = parseDetailPage(e2, {
        boxSelector: site === I ? `${selector.boxSelector}, #waterfall` : selector.boxSelector,
        requestDomItemSelector: selector.requestDomItemSelector
      });
      if ("valid" !== pageState.state) throw clog.error("新作品检测-解析列表失败"), new Error("新作品检测-解析列表失败");
      const s2 = pageState.items, o2 = e2.find(selector.nextPageSelector).attr("href");
      if (0 === s2.length) return await storageManager.updateFavoriteActress({
        starId: t2,
        lastCheckTime: utils.getNowStr(),
        newVideoList: []
      }), 0;
      let c2 = [], d2 = null;
      for (const m2 of s2) {
        const e3 = $(m2), { carNum: s3, url: o3, title: r2, publishTime: l2 } = this.getBean("ListPagePlugin").findCarNumAndHref(e3);
        if (!s3) continue;
        a2.find(((e4) => r2.includes(e4) || s3.includes(e4))) || (i2.has(s3) || (d2 || (d2 = l2), (() => {
          let coverUrl = e3.find("img").attr("src") || "";
          if (coverUrl && !coverUrl.startsWith("http")) {
            coverUrl = coverUrl.startsWith("/") ? this.javDbUrl + coverUrl : this.javDbUrl + "/" + coverUrl;
          }
          let url = o3 || "";
          if (url && !url.startsWith("http")) {
            url = url.startsWith("/") ? this.javDbUrl + url : this.javDbUrl + "/" + url;
          }
          const scoreText = e3.find(".score .value, .score").text().trim();
          const score = parseFloat(scoreText) || 0;
          const voteMatch = scoreText.match(/由(\d+)人/);
          let voteCount = 0;
          if (voteMatch) {
            voteCount = parseInt(voteMatch[1]);
          } else {
            const voteText = e3.find(".score .count, .meta .count").text().trim();
            voteCount = parseInt(voteText.replace(/[^\d]/g, "")) || 0;
          }
          c2.push({ carNum: s3, coverUrl, title: r2 || "", publishTime: l2 || "", score, voteCount, url });
        })()));
      }
      const h2 = await storageManager.getCarMap(), p2 = c2.filter(((e3) => !h2.has(e3.carNum)));
      p2.length > 0 && clog.log(`<span class="jhs-task-emphasis">检测出新作品, ${n2}, 共${p2.length}部</span>`), await storageManager.updateFavoriteActress({
        starId: t2,
        lastCheckTime: utils.getNowStr(),
        newVideoList: p2,
        lastPublishTime: d2
      });
      return p2.length;
    }
    async checkOneNewVideo(e2) {
      await this.ensureReady();
      const t2 = await storageManager.getTitleFilterKeyword(), n2 = await storageManager.getBlacklistCarList(), a2 = new Set(n2.map(((e3) => e3.carNum))), { lastCheckTime: i2, name: s2, starId: o2 } = e2;
      let r2 = `${this.javDbUrl}/actors/${o2}?t=d`;
      const l2 = $("#checkNewVideoMsg");
      try {
        clog.log("正在检测最新作品, 演员:", s2, r2), l2.text(`正在检测最新作品, 演员: ${s2}`);
        const e3 = await gmHttp.get(r2), n3 = utils.htmlTo$dom(e3);
        await this.parsePage(n3, T, o2, s2, t2, a2), clog.log('<span class="jhs-task-emphasis">检测最新作品---结束</span>'), l2.text("检测完毕");
        this.getBean("NewVideoPlugin").loadData();
      } catch (c2) {
        clog.error("检测屏蔽演员信息, 发生错误:", r2, c2), show.error("检测屏蔽演员信息, 发生错误:" + c2, "bottom", "right"), l2.text(`检测屏蔽演员信息, 发生错误: ${r2}`);
      }
    }
  };
  __name(_TaskPlugin, "TaskPlugin");
  var TaskPlugin = _TaskPlugin;
  var tt = [{
    name: "jsDelivr (全球CDN)",
    json: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Filetree.json",
    base: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/"
  }, {
    name: "GitHub Raw (备用)",
    json: "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json",
    base: "https://raw.githubusercontent.com/gfriends/gfriends/master/Content/"
  }];
  var nt = "jhs_img_cdn_index";
  var at = parseInt(localStorage.getItem(nt) || "0", 10);
  (at >= tt.length || at < 0) && (at = 0);
  var it = tt[at].json;
  var st = tt[at].base;
  var ot = "filetreeStore";
  var rt = "filetree_data";
  var lt = {
    db: null,
    async open() {
      return this.db ? this.db : new Promise(((e2, t2) => {
        const n2 = indexedDB.open("GfriendsAvatarDB", 1);
        n2.onupgradeneeded = (e3) => {
          this.db = e3.target.result, this.db.objectStoreNames.contains(ot) || this.db.createObjectStore(ot);
        }, n2.onsuccess = (t3) => {
          this.db = t3.target.result, e2(this.db);
        }, n2.onerror = (e3) => {
          clog.error("IndexedDB open error:", e3.target.errorCode), t2(new Error("Failed to open IndexedDB"));
        };
      }));
    },
    async get(e2) {
      return await this.open(), new Promise(((t2) => {
        const n2 = this.db.transaction([ot], "readonly").objectStore(ot).get(e2);
        n2.onsuccess = () => t2(n2.result), n2.onerror = () => t2(null);
      }));
    },
    async set(e2, t2) {
      return await this.open(), new Promise(((n2, a2) => {
        const i2 = this.db.transaction([ot], "readwrite").objectStore(ot).put(t2, e2);
        i2.onsuccess = () => n2(), i2.onerror = (e3) => {
          clog.error("IndexedDB set error:", e3.target.errorCode), a2(new Error("Failed to write to IndexedDB"));
        };
      }));
    }
  };
  var ct = null;
  var dt = null;
  function ht(e2) {
    if (!e2 || !e2.Content) return null;
    const t2 = {}, n2 = e2.Content;
    for (const a2 in n2) {
      const e3 = encodeURIComponent(a2);
      for (const i2 in n2[a2]) {
        let s2 = i2.replace(/\.jpg$/i, "").split("-")[0];
        s2.startsWith("AI-Fix-") && (s2 = s2.substring(7));
        const o2 = s2.toLowerCase().trim();
        if (o2.length > 0) {
          const s3 = n2[a2][i2], r2 = s3.indexOf("?");
          let l2, c2 = "";
          r2 > -1 ? (l2 = encodeURIComponent(s3.substring(0, r2)), c2 = s3.substring(r2)) : l2 = encodeURIComponent(s3);
          const d2 = `${st}${e3}/${l2}${c2}`;
          t2[o2] || (t2[o2] = []), t2[o2].includes(d2) || t2[o2].push(d2);
        }
      }
    }
    return t2;
  }
  __name(ht, "ht");
  async function gt(e2) {
    let t2 = loading();
    try {
      await (async function() {
        if (ct && dt) return ct;
        let e3 = null;
        try {
          e3 = await lt.get(rt);
        } catch (a3) {
          clog.error("读取 IndexedDB 失败:", a3);
        }
        if (e3 && e3.Content && (ct = e3, dt = ht(e3), dt)) return ct;
        show.info("正在载入头像数据源...");
        const t3 = await fetch(it);
        if (!t3.ok) throw new Error(`请求头像源失败: ${t3.status}`);
        const n3 = await t3.json();
        if (n3 && n3.Content) {
          ct = n3, dt = ht(n3);
          try {
            await lt.set(rt, n3), clog.debug("载入头像数据源并写入缓存成功!");
          } catch (a3) {
            clog.error(a3), show.error("头像数据源写入缓存失败，可能磁盘已满或其他权限问题。");
          }
          return ct;
        }
        clog.error(n3);
        throw new Error("解析头像数据源失败");
      })();
    } catch (i2) {
      return show.error(i2), [];
    } finally {
      t2.close();
    }
    if (!dt) return [];
    const n2 = /* @__PURE__ */ new Set(), a2 = e2.map(((e3) => e3.toLowerCase().trim())).filter(((e3) => e3.length > 0));
    if (0 === a2.length) return [];
    for (const s2 of a2) {
      const e3 = dt[s2];
      e3 && e3.forEach(((e4) => n2.add(e4)));
    }
    return Array.from(n2);
  }
  __name(gt, "gt");
  function aggregateNewVideoRecords(actresses, carMap, decisions, now = Date.now()) {
    const grouped = /* @__PURE__ */ new Map();
    for (const actress of actresses) {
      if (!Array.isArray(actress.newVideoList)) continue;
      for (const raw of actress.newVideoList) {
        const item = "object" == typeof raw ? raw : {}, carNum = normalizeCarNum("string" == typeof raw ? raw : raw.carNum);
        if (!carNum) continue;
        const existing = grouped.get(carNum) || { carNum, coverUrl: "", title: "", publishTime: "", actresses: [], starIds: [], categories: /* @__PURE__ */ new Set(), score: 0, voteCount: 0, url: "", isVr: false };
        existing.coverUrl || (existing.coverUrl = item.coverUrl || ""), existing.title || (existing.title = item.title || ""), existing.publishTime = [existing.publishTime, item.publishTime || ""].sort().at(-1), existing.score = Math.max(existing.score, Number(item.score) || 0), existing.voteCount = Math.max(existing.voteCount, Number(item.voteCount) || 0), existing.url || (existing.url = item.url || "");
        existing.isVr || (existing.isVr = true === item.isVr || /(^|[^A-Z])VR([^A-Z]|$)/i.test(`${item.title || ""} ${(item.tags || []).join?.(" ") || ""} ${(item.categories || []).join?.(" ") || ""}`));
        actress.name && !existing.actresses.includes(actress.name) && existing.actresses.push(actress.name), actress.starId && !existing.starIds.includes(actress.starId) && existing.starIds.push(actress.starId), actress.actressType && existing.categories.add(actress.actressType), grouped.set(carNum, existing);
      }
    }
    return [...grouped.values()].map(((item) => {
      const record = carMap.get(item.carNum), flags = normalizeStateFlags(record?.stateFlags), decision = decisions[item.carNum] || null, decisionState = !decision ? "pending" : "snoozed" === decision.action && decision.until && Date.parse(decision.until) <= now ? "pending" : decision.action;
      return { ...item, actressName: item.actresses.join("、"), starId: item.starIds[0] || "", categories: [...item.categories], flags, decision, decisionState };
    }));
  }
  __name(aggregateNewVideoRecords, "aggregateNewVideoRecords");
  var _NewVideoPlugin = class _NewVideoPlugin extends BasePlugin {
    constructor() {
      super(...arguments), i(this, "currentPage", 1), i(this, "pageSize", 30), i(this, "nvCurrentPage", 1), i(this, "nvPageSize", 60), i(this, "nvFlatListCache", null), i(this, "nvSortBy", "publishTime_desc"), i(this, "nvSelected", /* @__PURE__ */ new Set()), i(this, "nvDecisionsCache", {});
    }
    getName() {
      return "NewVideoPlugin";
    }
    getStartupMode() {
      return "idle";
    }
    async initCss() {
      return `
            <style>
                .newVideoToolBox { display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; box-sizing:border-box; overflow:hidden; padding:var(--jhs-space-3); }
                .jhs-new-video-toolbar { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-new-video-toolbar__actions, .jhs-new-video-toolbar__filters { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .jhs-new-video-toolbar select { min-width:150px; }
                #actress-card-container { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; max-width:1680px; box-sizing:border-box; margin:0 auto; padding:var(--jhs-space-1); overflow-x:hidden; overflow-y:auto; }
                .actress-card { position:relative; display:flex; flex-direction:column; min-width:0; padding:var(--jhs-space-4); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
                .actress-card.is-paused { background:var(--jhs-surface-2); }
                .actress-card__badges { display:flex; align-items:center; gap:var(--jhs-space-1); margin-bottom:var(--jhs-space-3); }
                .actress-card__profile { display:grid; grid-template-columns:64px minmax(0,1fr); align-items:center; gap:var(--jhs-space-3); color:inherit; text-decoration:none; }
                .actress-card-avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; background:var(--jhs-surface-2); }
                .actress-card-name { overflow:hidden; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
                .actress-card-allname { overflow:hidden; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__meta { display:grid; gap:var(--jhs-space-2); margin:var(--jhs-space-3) 0; }
                .actress-card__meta-row { display:grid; grid-template-columns:76px minmax(0,1fr); gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__meta-row dt { color:var(--jhs-text-faint); }
                .actress-card__meta-row dd { overflow:hidden; margin:0; color:var(--jhs-text); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__note { min-height:20px; margin-bottom:var(--jhs-space-3); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__actions { display:flex; align-items:center; gap:var(--jhs-space-2); margin-top:auto; }
                .actress-card__actions .btn-check-actress { flex:1; }
                .actress-card__menu { position:relative; }
                .actress-card__menu summary { list-style:none; }
                .actress-card__menu summary::-webkit-details-marker { display:none; }
                .actress-card__menu-popover { position:absolute; right:0; bottom:calc(100% + var(--jhs-space-1)); z-index:var(--jhs-z-elevated); min-width:128px; padding:var(--jhs-space-1); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .actress-card__menu-popover button { width:100%; justify-content:flex-start; }
                .card-tag.is-uncensored { color:var(--jhs-status-down); background:var(--jhs-status-down-tint); }
                .card-tag.is-censored { color:var(--jhs-status-watch); background:var(--jhs-status-watch-tint); }
                .card-tag.is-unknown { color:var(--jhs-text-muted); background:var(--jhs-surface-2); }
                #new-video-list-container { display:none; flex:1; min-width:0; min-height:0; overflow-x:hidden; overflow-y:auto; }
                #new-video-list-footer { display:none; padding:var(--jhs-space-2) 0; border-top:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-new-video-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; box-sizing:border-box; padding:var(--jhs-space-1); }
                .nv-card__link { display:block; color:inherit; text-decoration:none; }
                .nv-card__cover { position:relative; width:100%; overflow:hidden; aspect-ratio:3/2; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
                .nv-cover-img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
                .nv-card__empty { display:flex; align-items:center; justify-content:center; height:100%; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                .nv-card__rating { position:absolute; top:var(--jhs-space-1); right:var(--jhs-space-1); }
                .nv-card__body { padding:var(--jhs-space-2) var(--jhs-space-1); }
                .nv-card__title, .nv-card__actress { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .nv-card__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:700; }
                .nv-card__actress, .nv-card__date { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-pagination { padding:var(--jhs-space-3) 0; border-top:1px solid var(--jhs-border); text-align:center; }
                .jhs-form-dialog { display:grid; gap:var(--jhs-space-3); padding:var(--jhs-space-4); }
                .jhs-avatar-editor { display:grid; grid-template-columns:100px minmax(0,1fr); gap:var(--jhs-space-3); align-items:start; }
                .jhs-avatar-editor__preview { width:100px; height:100px; border:2px solid var(--jhs-border); border-radius:50%; object-fit:cover; }
                .jhs-avatar-editor__actions { margin-top:var(--jhs-space-2); }
                .jhs-form-dialog__body, .jhs-form-field { display:grid; gap:var(--jhs-space-1); }
                .jhs-form-label, .jhs-form-dialog__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:600; }
                .jhs-form-dialog :where(.jhs-field,.jhs-select,.jhs-textarea) { width:100%; }
                .jhs-form-dialog .jhs-textarea { min-height:60px; overflow-y:hidden; }
                .jhs-option-row { display:flex; align-items:center; gap:var(--jhs-space-2); min-height:36px; }
                #actress-pagination { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
                @media (max-width:767px) { .jhs-new-video-toolbar { align-items:stretch; flex-direction:column; } .jhs-new-video-toolbar select, .jhs-new-video-toolbar .jhs-btn { min-height:44px; } .page-number-btn { display:none !important; } }
            </style>
        `;
    }
    async handle() {
      await this.showNewVideoCount();
    }
    getPendingNewVideoCount(e2, t2) {
      return Array.isArray(e2?.newVideoList) ? new Set(e2.newVideoList.map(((item) => normalizeCarNum("string" == typeof item ? item : item.carNum))).filter(((carNum) => carNum && !t2.has(carNum) && !this.isDecisionHidden(carNum)))).size : 0;
    }
    isDecisionHidden(carNum) {
      const decision = this.nvDecisionsCache[normalizeCarNum(carNum)];
      if (!decision) return false;
      return "ignored" === decision.action || "snoozed" === decision.action && (!decision.until || Date.parse(decision.until) > Date.now());
    }
    async getPendingNewVideoTotal() {
      const e2 = await storageManager.getCarMap(), keys = /* @__PURE__ */ new Set();
      this.nvDecisionsCache = await stateService.getNewVideoDecisions();
      (await storageManager.getFavoriteActressList()).forEach(((actress) => Array.isArray(actress.newVideoList) && actress.newVideoList.forEach(((item) => {
        const carNum = normalizeCarNum("string" == typeof item ? item : item.carNum);
        carNum && !e2.has(carNum) && !this.isDecisionHidden(carNum) && keys.add(carNum);
      }))));
      return keys.size;
    }
    async showNewVideoCount() {
      const e2 = await this.getPendingNewVideoTotal();
      $("#newVideoCount").text(`${e2}`);
    }
    async resetBtnTip() {
      const e2 = this.getBean("TaskPlugin"), t2 = await storageManager.getSetting(), n2 = localStorage.getItem(e2.lastCheckFavoriteActressTimeKey) || "无", a2 = t2.checkFavoriteActress_IntervalTime, i2 = localStorage.getItem(e2.lastCheckNewVideoTimeKey) || "无", s2 = t2.checkNewVideo_intervalTime;
      $("#checkFavoriteActress").attr("data-tip", `上次自动同步时间: ${n2}; 检测间隔时间: ${a2}小时`), $("#checkNewVideo").attr("data-tip", `上次检测时间: ${i2}; 检测间隔时间: ${s2}小时`);
    }
    async openDialog() {
      this._viewMode = "card", this.nvFlatListCache = null, this.nvCurrentPage = 1;
      const e2 = this.getBean("TaskPlugin"), t2 = await storageManager.getSetting(), n2 = localStorage.getItem(e2.lastCheckFavoriteActressTimeKey) || "无", a2 = t2.checkFavoriteActress_IntervalTime, i2 = localStorage.getItem(e2.lastCheckNewVideoTimeKey) || "无", s2 = t2.checkNewVideo_intervalTime;
      let o2 = `
            <div class="newVideoToolBox jhs-ui">
                <div class="jhs-new-video-toolbar" role="toolbar" aria-label="新作品工作区工具">
                    <div class="jhs-new-video-toolbar__actions">
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkFavoriteActress" data-tip="上次自动同步时间: ${n2}; 检测间隔时间: ${a2}小时">${this.actressSvg}<span>手动同步演员</span></button>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkNewVideo" data-tip="上次检测时间: ${i2}; 检测间隔时间: ${s2}小时">${this.newSvg}<span>手动检测最新作品</span></button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="toSetting">${this.settingSvg}<span>配置</span></button>
                        <span id="checkNewVideoMsg" role="status" aria-live="polite"></span>
                    </div>
                    <div class="jhs-new-video-toolbar__filters">
                        <select id="paramActressType" class="jhs-select-source" aria-label="演员类型"><option value="all" selected>所有</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="">未知</option></select>
                        <input id="nvSearch" class="jhs-field jhs-is-hidden" type="search" placeholder="搜索番号、标题或演员" aria-label="搜索新作品">
                        <select id="nvCategoryFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作品类别"><option value="all" selected>所有类别</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="unknown">未知</option><option value="vr">VR</option></select>
                        <select id="nvStateFilter" class="jhs-select-source jhs-is-hidden" aria-label="作品状态"><option value="all">所有状态</option><option value="pending" selected>待处理</option><option value="favorite">已收藏</option><option value="downloaded">已下载</option><option value="watched">已观看</option><option value="blocked">已屏蔽</option></select>
                        <select id="nvDecisionFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作决策"><option value="pending" selected>待处理</option><option value="ignored">已忽略</option><option value="snoozed">已暂缓</option><option value="all">所有决策</option></select>
                        <select id="paramSortBy" class="jhs-select-source" aria-label="演员排序">
                            <option value="default" selected>默认排序</option><optgroup label="发行时间"><option value="lastPublishTime_desc">发行时间 新→旧</option><option value="lastPublishTime_asc">发行时间 旧→新</option></optgroup><optgroup label="检测时间"><option value="lastCheckTime_desc">检测时间 新→旧</option><option value="lastCheckTime_asc">检测时间 旧→新</option></optgroup><optgroup label="新作品数"><option value="newVideoCount_desc">新作品数 多→少</option><option value="newVideoCount_asc">新作品数 少→多</option></optgroup>
                        </select>
                        <select id="nvSortBy" class="jhs-select-source jhs-is-hidden" aria-label="新作品排序"><option value="publishTime_desc" selected>发行时间 新→旧</option><option value="publishTime_asc">发行时间 旧→新</option><option value="voteCount_desc">评价人数 多→少</option><option value="voteCount_asc">评价人数 少→多</option><option value="actress_asc">演员名 A→Z</option><option value="actress_desc">演员名 Z→A</option><option value="carNum_asc">番号 A→Z</option><option value="carNum_desc">番号 Z→A</option></select>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="toggleViewMode">新作品列表</button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="reLoad">${this.refreshSvg}<span>刷新</span></button>
                    </div>
                </div>
                <div id="actress-card-container" class="jhs-scrollbar"></div>
                <div id="new-video-list-container"></div>
                <div id="new-video-list-footer"></div>
                <div id="actress-pagination"></div>
            </div>`;
      layer.open({
        type: 1,
        title: '<span class="jhs-dialog-title" data-tip="数据来源: 女优页面首页,含磁链分类">新作品检测</span>',
        content: o2,
        scrollbar: false,
        area: utils.getDialogArea("workspace"),
        anim: -1,
        success: /* @__PURE__ */ __name(async (e3, t3) => {
          JhsSelect.enhance(e3), this.loadData(), this.bindClick(), utils.setupEscClose(t3);
        }, "success")
      });
    }
    bindClick() {
      const e2 = this.getBean("TaskPlugin");
      $("#reLoad").on("click", ((e3) => {
        this.loadData(), $("#checkNewVideoMsg").text("");
      })), $("#new-video-list-container").on("click", ".nv-card__link", (async (e3) => {
        const t2 = $(e3.currentTarget).closest(".nv-card").attr("data-car");
        if (!t2) return;
        try {
          const enabled = await storageManager.getSetting("autoRemoveNewVideoMarkAfterBrowse", C);
          if (enabled !== _) return;
          await stateService.removeFromNewVideoList([t2], "browse"), "list" === this._viewMode && await this.renderNewVideoList();
        } catch (n2) {
          clog.error("移除新作品标记失败:", n2);
        }
      })), $("#toSetting").on("click", ((e3) => {
        this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
          $("#setting-checkFavoriteActress").css({
            border: "1px solid var(--jhs-status-filter)"
          }), $("#setting-checkNewVideo").css({
            border: "1px solid var(--jhs-status-filter)"
          });
        }));
      }));
      $("#checkFavoriteActress").on("click", ((t2) => {
        utils.q({
          clientX: t2.clientX,
          clientY: t2.clientY + 20
        }, "是否手动同步演员?", (() => {
          navigator.locks.request(e2.singleTaskKey, {
            ifAvailable: true
          }, (async (t3) => {
            if (!t3) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
            $('a[href*="/users/profile"]').length > 0 ? (await e2.checkFavoriteActress(), this.loadData()) : show.error("未登录JavDb, 同步失败");
          })).catch(((e3) => {
            clog.error("锁任务出现错误:", e3);
          }));
        }));
      })), $("#checkNewVideo").on("click", ((t2) => {
        utils.q({
          clientX: t2.clientX,
          clientY: t2.clientY + 20
        }, "是否手动检测最新作品?", (() => {
          navigator.locks.request(e2.singleTaskKey, {
            ifAvailable: true
          }, (async (t3) => {
            t3 ? await e2.checkNewVideo(true) : show.error("当前有定时任务在后台执行中, 无法发起手动任务");
          })).catch(((e3) => {
            clog.error("锁任务出现错误:", e3);
          }));
        }));
      })), $("#paramActressType").on("change", ((e3) => {
        "list" === this._viewMode ? this.renderNewVideoList() : this.loadData();
      })), $("#paramSortBy").on("change", ((e3) => {
        this.loadData();
      })), $("#nvSortBy").on("change", ((e3) => {
        this.nvSortBy = $("#nvSortBy").val(), this.nvCurrentPage = 1, this.nvRenderPage();
      })), $("#nvCategoryFilter,#nvStateFilter,#nvDecisionFilter").on("change", ((e3) => {
        "list" === this._viewMode && this.renderNewVideoList();
      })), $("#nvSearch").on("input", (() => {
        "list" === this._viewMode && this.renderNewVideoList();
      })), $("#toggleViewMode").on("click", ((e3) => {
        this._viewMode = "list" === this._viewMode ? "card" : "list";
        const t2 = "list" === this._viewMode;
        $("#actress-card-container").toggle(!t2), $("#actress-pagination").toggle(!t2), $("#new-video-list-container").toggle(t2), $("#new-video-list-footer").toggle(t2), JhsSelect.setVisible("#paramSortBy", !t2), JhsSelect.setVisible("#nvSortBy", t2), JhsSelect.setVisible("#paramActressType", !t2), JhsSelect.setVisible("#nvCategoryFilter", t2), JhsSelect.setVisible("#nvStateFilter", t2), JhsSelect.setVisible("#nvDecisionFilter", t2), $("#nvSearch").toggleClass("jhs-is-hidden", !t2), $("#toggleViewMode").text(t2 ? "演员视图" : "新作品列表"), t2 ? this.renderNewVideoList() : this.loadData();
      }));
    }
    loadData() {
      this.currentPage = 1;
      this.renderActressCards().catch((e2) => {
        clog.error("加载演员卡片失败:", e2);
        show.error("加载数据失败");
        const container = $("#actress-card-container");
        container.empty().append($('<div class="jhs-state jhs-state--error"></div>').append(
          document.createTextNode("加载数据失败 "),
          $('<button type="button" class="jhs-btn jhs-btn--secondary">重试</button>').on("click", (() => this.loadData()))
        ));
      });
    }
    async renderActressCards() {
      const e2 = $("#actress-card-container");
      if (!e2.length) return;
      e2.html('<div class="jhs-state jhs-state--loading" role="status">加载中...</div>');
      let t2 = await storageManager.getFavoriteActressList();
      const n2 = $("#paramActressType").val();
      "all" !== n2 && (t2 = t2.filter(((e3) => e3.actressType === n2)));
      const _carSet = await storageManager.getCarMap();
      this.nvDecisionsCache = await stateService.getNewVideoDecisions();
      const _newVideoCount = /* @__PURE__ */ __name((e3) => this.getPendingNewVideoCount(e3, _carSet), "_newVideoCount");
      const sortBy = $("#paramSortBy").val();
      const sortMap = {
        "lastPublishTime_desc": [{ key: "lastPublishTime", order: "desc" }],
        "lastPublishTime_asc": [{ key: "lastPublishTime", order: "asc" }],
        "lastCheckTime_desc": [{ key: "lastCheckTime", order: "desc" }],
        "lastCheckTime_asc": [{ key: "lastCheckTime", order: "asc" }],
        "newVideoCount_desc": [{ key: _newVideoCount, order: "desc" }],
        "newVideoCount_asc": [{ key: _newVideoCount, order: "asc" }]
      };
      const defaultSort = [{
        key: _newVideoCount,
        order: "desc"
      }, {
        key: "lastPublishTime",
        order: "desc"
      }];
      const sortedActresses = utils.genericSort(t2, sortMap[sortBy] || defaultSort);
      const totalCount = sortedActresses.length, totalPages = Math.ceil(totalCount / this.pageSize), pageStart = (this.currentPage - 1) * this.pageSize, pageEnd = pageStart + this.pageSize;
      const pageActresses = sortedActresses.slice(pageStart, pageEnd), javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl(), taskPlugin = this.getBean("TaskPlugin"), ruleTime = await storageManager.getSetting("checkNewVideo_ruleTime") || 8760;
      if (0 === pageActresses.length) {
        e2.html('<div class="jhs-state jhs-state--empty">暂无数据</div>');
        return void this.renderPagination(totalCount, totalPages);
      }
      const escapeCardHtml = /* @__PURE__ */ __name((value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), "escapeCardHtml");
      const cardsHtml = pageActresses.map(((actress) => {
        const allNames = Array.isArray(actress.allName) ? actress.allName.join("，") : "";
        const escapedAllNames = escapeCardHtml(allNames), escapedName = escapeCardHtml(actress.name || ""), escapedRemark = escapeCardHtml(actress.remark || "");
        const newVideoCount = this.getPendingNewVideoCount(actress, _carSet);
        const effectivePublishTime = newVideoCount > 0 ? actress.lastPublishTime || "" : "";
        const profileUrl = `${javDbUrl}/actors/${actress.starId}?t=d`;
        let isPaused = false;
        effectivePublishTime && (isPaused = !taskPlugin.isUnnecessaryCheck(effectivePublishTime, ruleTime));
        let typeLabel = "未知", typeClass = "is-unknown";
        actress.actressType === A ? (typeLabel = "无码", typeClass = "is-uncensored") : actress.actressType === D && (typeLabel = "有码", typeClass = "is-censored");
        const publishText = effectivePublishTime ? effectivePublishTime : 0 === newVideoCount && actress.lastPublishTime ? "已全部标记" : "暂无记录";
        const noteText = isPaused ? `停更 ${ruleTime / 24 / 365} 年以上，下轮任务不再检测` : escapedRemark || "暂无备注";
        return `
                <article class="actress-card ${isPaused ? "is-paused" : ""}" data-starId="${actress.starId}">
                    <div class="actress-card__badges">
                        <span class="jhs-badge jhs-badge--soft card-new-count-tag" data-tip="最新作品数量: ${newVideoCount}">${newVideoCount} 新</span>
                        <span class="jhs-badge card-tag ${typeClass}">${typeLabel}</span>
                        ${isPaused ? '<span class="jhs-badge jhs-badge--neutral">停更</span>' : ""}
                    </div>
                    <a class="actress-card__profile" href="${profileUrl}" target="_blank" rel="noopener noreferrer">
                        <img src="${actress.avatar || "https://c0.jdbstatic.com/images/actor_unknow.jpg"}" alt="${escapedAllNames}" class="actress-card-avatar" loading="lazy">
                        <span><span class="actress-card-name">${escapedName}</span><span class="actress-card-allname" title="${escapedAllNames}">${escapedAllNames || "暂无别名"}</span></span>
                    </a>
                    <dl class="actress-card__meta">
                        <div class="actress-card__meta-row"><dt>最近作品</dt><dd title="${publishText}">${publishText}</dd></div>
                        <div class="actress-card__meta-row"><dt>上次检测</dt><dd>${actress.lastCheckTime || "暂无记录"}</dd></div>
                    </dl>
                    <p class="actress-card__note" title="${noteText}">${noteText}</p>
                    <div class="actress-card__actions">
                        <button type="button" class="jhs-btn jhs-btn--primary btn-check-actress" data-starId="${actress.starId}">${this.checkSvg}<span>重新检测</span></button>
                        <button type="button" class="jhs-btn jhs-btn--icon jhs-btn--ghost btn-delete-actress" aria-label="取消收藏 ${escapedName}" title="取消收藏" data-starId="${actress.starId}">${this.deleteSvg}</button>
                        <details class="actress-card__menu">
                            <summary class="jhs-btn jhs-btn--icon jhs-btn--ghost" aria-label="更多操作" title="更多操作">•••</summary>
                            <div class="actress-card__menu-popover" role="menu">
                                <button type="button" class="jhs-btn jhs-btn--ghost btn-edit-actress" role="menuitem" data-starId="${actress.starId}">${this.editSvg}<span>编辑资料</span></button>
                            </div>
                        </details>
                    </div>
                </article>`;
      })).join("");
      e2.html(cardsHtml), $(".btn-delete-actress").off("click").on("click", ((e3) => {
        e3.preventDefault();
        const t3 = $(e3.currentTarget).attr("data-starId"), n3 = sortedActresses.find(((e4) => e4.starId === t3));
        utils.q(e3, `是否取消收藏 ${n3.name}?`, (async () => {
          let e4 = `${await this.getBean("OtherSitePlugin").getJavDbUrl()}/actors/${t3}/uncollect`;
          const n4 = document.querySelector("meta[name=csrf-token]").content, a2 = await gmHttp.post(e4, null, {
            "x-csrf-token": n4
          });
          a2.includes("removeClass") ? (await storageManager.removeFavoriteActress(t3), this.loadData(), this.showNewVideoCount()) : (show.error("移除失败"), clog.error("移除失败,返回值:", a2));
        }));
      })), $(".btn-edit-actress").off("click").on("click", ((e3) => {
        e3.preventDefault();
        const t3 = $(e3.currentTarget).attr("data-starId"), n3 = sortedActresses.find(((e4) => e4.starId === t3));
        n3 ? this.editActress(n3) : show.error(`未找到 starId 为 ${t3} 的女优记录。`);
      })), $(".btn-check-actress").off("click").on("click", ((e3) => {
        e3.preventDefault(), navigator.locks.request(taskPlugin.singleTaskKey, {
          ifAvailable: true
        }, (async (t3) => {
          if (!t3) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
          const n3 = $(e3.currentTarget).attr("data-starId"), i2 = sortedActresses.find(((e4) => e4.starId === n3));
          await taskPlugin.checkOneNewVideo(i2);
        })).catch(((e4) => {
          clog.error("锁任务出现错误:", e4);
        }));
      })), $(".actress-card__menu").on("keydown", ((event) => {
        if ("Escape" !== event.key) return;
        event.preventDefault();
        const details = $(event.currentTarget);
        details.prop("open", false).find("summary").trigger("focus");
      })).on("click", "[role='menuitem']", ((event) => {
        $(event.currentTarget).closest("details").prop("open", false);
      })), this.renderPagination(totalCount, totalPages), show.ok("加载完成");
    }
    async getNewVideoFlatList() {
      const actresses = await storageManager.getFavoriteActressList(), carMap = await storageManager.getCarMap(), category = $("#nvCategoryFilter").val() || "all", stateFilter = $("#nvStateFilter").val() || "pending", decisionFilter = $("#nvDecisionFilter").val() || "pending", query = String($("#nvSearch").val() || "").trim().toUpperCase();
      this.nvDecisionsCache = await stateService.getNewVideoDecisions();
      return aggregateNewVideoRecords(actresses, carMap, this.nvDecisionsCache).filter(((item) => {
        const categoryMatch = "all" === category || "vr" === category ? "all" === category || item.isVr : "unknown" === category ? 0 === item.categories.length : item.categories.includes(category);
        const stateMatch = "all" === stateFilter || "pending" === stateFilter ? "all" === stateFilter || !hasAnyState(item.flags) : !!item.flags[stateFilter];
        const decisionMatch = "all" === decisionFilter || item.decisionState === decisionFilter;
        const searchMatch = !query || `${item.carNum} ${item.title} ${item.actressName}`.toUpperCase().includes(query);
        return categoryMatch && stateMatch && decisionMatch && searchMatch;
      })).sort(((left, right) => (right.publishTime || "").localeCompare(left.publishTime || "")));
    }
    async loadCoverForItems(e2) {
      const t2 = await this.getBean("OtherSitePlugin").getJavDbUrl(), n2 = {};
      for (const a2 of e2) {
        if (n2[a2.starId]) continue;
        if (e2.every(((e3) => e3.starId !== a2.starId || e3.coverUrl))) continue;
        n2[a2.starId] = true;
        try {
          const i2 = await gmHttp.get(`${t2}/actors/${a2.starId}?t=d`), s2 = utils.htmlTo$dom(i2);
          s2.find(".movie-list .item").each(((e3, n3) => {
            const i3 = $(n3), o2 = i3.find(".video-title strong").text().trim(), r2 = i3.find("img").attr("src") || "";
            if (!o2 || !r2) return;
            let l2 = r2;
            if (!l2.startsWith("http")) {
              l2 = l2.startsWith("/") ? t2 + l2 : t2 + "/" + l2;
            }
            const c2 = l2.replace("thumbs", "covers"), d2 = i3.find(".video-title").text().replace(o2, "").trim();
            $(`.nv-card[data-car="${o2}"]`).each(((e4, t3) => {
              const n4 = $(t3), i4 = n4.find("img");
              if (i4.length) {
                i4.attr("src", c2).on("error", (function() {
                  $(this).hide().next().show();
                }));
              } else {
                const e5 = n4.find(".nv-placeholder");
                if (e5.length) {
                  e5.replaceWith(`<img class="nv-cover-img" src="${c2}" loading="lazy" onerror="this.classList.add('jhs-is-hidden');this.nextElementSibling.classList.remove('jhs-is-hidden');"><div class="nv-card__empty jhs-is-hidden">无封面</div>`);
                }
              }
              d2 && n4.attr("title", d2);
            }));
          }));
        } catch (i2) {
          clog.warn("获取演员封面失败:", a2.actressName, i2);
        }
      }
    }
    async renderNewVideoList() {
      const e2 = $("#new-video-list-container");
      if (!e2.length) return;
      e2.html('<div class="jhs-state jhs-state--loading" role="status">加载中...</div>');
      let t2;
      try {
        t2 = await this.getNewVideoFlatList();
      } catch (n2) {
        return clog.error(n2), void e2.html(`<div class="jhs-state jhs-state--error" role="alert">加载失败: ${escapeHtml(n2.message)}</div>`);
      }
      if (0 === t2.length) return e2.html('<div class="jhs-state jhs-state--empty">暂无待鉴定的新作品</div>'), void $("#new-video-list-footer").html("");
      this.nvFlatListCache = t2, this.nvCurrentPage = 1, this.nvSortBy = $("#nvSortBy").val() || "publishTime_desc";
      const a2 = /* @__PURE__ */ new Set();
      for (const i2 of t2) a2.add(i2.actressName);
      this.nvSelected.clear(), $("#new-video-list-footer").html(`<span>共 <b>${t2.length}</b> 个番号，涉及 <b>${a2.size}</b> 位演员；已选择 <b id="nvSelectedCount">0</b> 个</span>
            <button type="button" class="jhs-btn jhs-btn--soft" id="batchMarkFavorite">选择项收藏</button>
            <button type="button" class="jhs-btn jhs-btn--soft" id="batchMarkWatched">选择项标记已看</button>
            <button type="button" class="jhs-btn jhs-btn--soft" id="batchMarkDownloaded">选择项标记已下载</button>
            <button type="button" class="jhs-btn jhs-btn--ghost" id="batchIgnore">选择项忽略</button>
            <button type="button" class="jhs-btn jhs-btn--ghost" id="batchSnooze">选择项暂缓 7 天</button>
            <button type="button" class="jhs-btn jhs-btn--ghost" id="batchRestore">恢复选择项</button>
            <button type="button" class="jhs-btn jhs-btn--danger" id="batchRemoveFromNewVideo">从新作列表移除</button>`);
      this.nvRenderPage(), this.loadCoverForItems(t2).catch(((e3) => clog.warn("封面加载异常:", e3)));
      const selectedItems = /* @__PURE__ */ __name(() => this.nvFlatListCache.filter(((item) => this.nvSelected.has(item.carNum))), "selectedItems"), ensureSelected = /* @__PURE__ */ __name(() => selectedItems().length ? selectedItems() : (show.info("请先选择作品"), []), "ensureSelected"), patchSelected = /* @__PURE__ */ __name(async (flag) => {
        const items = ensureSelected();
        if (!items.length) return;
        await stateService.patch(items.map(((item) => item.carNum)), { [flag]: true }, { type: "new-video-batch-state", records: items.map(((item) => ({ carNum: item.carNum, url: item.url || `/search?q=${encodeURIComponent(item.carNum)}`, names: item.actressName, publishTime: item.publishTime }))) }), show.ok(`已处理 ${items.length} 个番号`), await this.renderNewVideoList(), await this.showNewVideoCount();
      }, "patchSelected");
      $("#batchMarkFavorite").on("click", (() => patchSelected("favorite"))), $("#batchMarkWatched").on("click", (() => patchSelected("watched"))), $("#batchMarkDownloaded").on("click", (() => patchSelected("downloaded"))), $("#batchIgnore").on("click", (async () => {
        const items = ensureSelected();
        items.length && (await stateService.setNewVideoDecision(items.map(((item) => item.carNum)), "ignored"), await this.renderNewVideoList(), await this.showNewVideoCount());
      })), $("#batchSnooze").on("click", (async () => {
        const items = ensureSelected();
        items.length && (await stateService.setNewVideoDecision(items.map(((item) => item.carNum)), "snoozed", new Date(Date.now() + 7 * 864e5).toISOString()), await this.renderNewVideoList(), await this.showNewVideoCount());
      })), $("#batchRestore").on("click", (async () => {
        const items = ensureSelected();
        items.length && (await stateService.setNewVideoDecision(items.map(((item) => item.carNum)), null), await this.renderNewVideoList(), await this.showNewVideoCount());
      })), $("#batchRemoveFromNewVideo").on("click", ((event) => {
        const items = ensureSelected();
        items.length && utils.q(event, `确认将 ${items.length} 个作品从新作列表移除？<br>不会删除作品状态记录。`, (async () => {
          await stateService.removeFromNewVideoList(items.map(((item) => item.carNum)), "manual"), await this.renderNewVideoList(), await this.showNewVideoCount();
        }));
      }));
    }
    nvSortList(e2) {
      const t2 = this.nvSortBy || "publishTime_desc", [n2, a2] = t2.split("_");
      return e2.slice().sort(((e3, t3) => {
        let i2 = 0;
        switch (n2) {
          case "publishTime":
            i2 = (e3.publishTime || "").localeCompare(t3.publishTime || "");
            break;
          case "actress":
            i2 = (e3.actressName || "").localeCompare(t3.actressName || "");
            break;
          case "carNum":
            i2 = (e3.carNum || "").localeCompare(t3.carNum || "");
            break;
          case "voteCount":
            i2 = (e3.voteCount || 0) - (t3.voteCount || 0);
            break;
        }
        return "desc" === a2 ? -i2 : i2;
      }));
    }
    nvRenderPage() {
      const e2 = this.nvFlatListCache;
      if (!e2 || 0 === e2.length) return;
      const t2 = this.nvSortList(e2), n2 = this.nvPageSize, a2 = (this.nvCurrentPage - 1) * n2, i2 = a2 + n2, s2 = t2.slice(a2, i2), o2 = Math.ceil(t2.length / n2), r2 = this.getBean("OtherSitePlugin").getJavDbUrl().then(((r3) => {
        const l2 = $("#new-video-list-container");
        let c2 = "";
        c2 += '<div id="nv-grid" class="jhs-new-video-grid">';
        for (const n3 of s2) {
          const e3 = escapeHtml(n3.carNum), t3 = escapeHtml(n3.title || n3.carNum), a3 = n3.coverUrl ? n3.coverUrl.replace("thumbs", "covers") : "", i3 = n3.url || `${r3}/search?q=${encodeURIComponent(n3.carNum)}`;
          let o3 = `番号: ${e3}\\n演员: ${escapeHtml(n3.actressName)}\\n发行: ${n3.publishTime || "未知"}`;
          n3.voteCount && (o3 += `\\n评价人数: ${n3.voteCount}`);
          const l3 = n3.voteCount ? `<span class="jhs-badge jhs-badge--neutral nv-card__rating">${n3.voteCount}人评价</span>` : "";
          c2 += `<div class="nv-card" data-car="${e3}" title="${o3}"><label class="jhs-option-row"><input type="checkbox" class="nv-select" value="${e3}" ${this.nvSelected.has(n3.carNum) ? "checked" : ""}><span>选择</span></label>`;
          c2 += `<a class="nv-card__link" href="${i3}" target="_blank" rel="noopener noreferrer">`;
          c2 += `<div class="nv-card__cover">`;
          a3 ? c2 += `<img class="nv-cover-img" src="${a3}" data-full="${a3}" loading="lazy" onerror="this.classList.add('jhs-is-hidden');this.nextElementSibling.classList.remove('jhs-is-hidden');">${l3}<div class="nv-card__empty jhs-is-hidden">无封面</div>` : c2 += `<div class="nv-placeholder nv-card__empty">加载中...</div>`;
          c2 += `</div>`;
          c2 += `<div class="nv-card__body">`;
          c2 += `<div class="nv-card__title" title="${e3}">${e3}</div>`;
          c2 += `<div class="nv-card__actress" title="${escapeHtml(n3.actressName)}">${escapeHtml(n3.actressName)}</div>`;
          n3.publishTime && (c2 += `<div class="nv-card__date">${n3.publishTime}</div>`);
          n3.decisionState && "pending" !== n3.decisionState && (c2 += `<span class="jhs-badge jhs-badge--neutral">${"ignored" === n3.decisionState ? "已忽略" : "已暂缓"}</span>`), c2 += `</div></a></div>`;
        }
        c2 += "</div>";
        if (o2 > 1) {
          c2 += '<div id="nv-pagination-bar" class="jhs-new-video-pagination">';
          this.nvCurrentPage > 1 && (c2 += `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn" data-nvpage="${this.nvCurrentPage - 1}">上一页</button>`);
          let e3 = Math.max(1, this.nvCurrentPage - 2), n3 = Math.min(o2, e3 + 4);
          n3 - e3 < 4 && (e3 = Math.max(1, n3 - 4));
          for (let t3 = e3; t3 <= n3; t3++) c2 += `<button type="button" class="jhs-btn ${t3 === this.nvCurrentPage ? "jhs-btn--primary is-current" : "jhs-btn--secondary"} pagination-btn" data-nvpage="${t3}" ${t3 === this.nvCurrentPage ? 'aria-current="page"' : ""}>${t3}</button>`;
          this.nvCurrentPage < o2 && (c2 += `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn" data-nvpage="${this.nvCurrentPage + 1}">下一页</button>`), c2 += `<span class="jhs-pagination__summary">第 ${this.nvCurrentPage}/${o2} 页，共 ${t2.length} 条</span>`, c2 += "</div>";
        }
        l2.html(c2), l2.find(".nv-select").on("change", ((event) => {
          const carNum = normalizeCarNum(event.currentTarget.value);
          event.currentTarget.checked ? this.nvSelected.add(carNum) : this.nvSelected.delete(carNum), $("#nvSelectedCount").text(this.nvSelected.size);
        })), l2.find(".pagination-btn").off("click").on("click", ((e3) => {
          const n3 = parseInt($(e3.currentTarget).data("nvpage"));
          n3 >= 1 && n3 <= o2 && n3 !== this.nvCurrentPage && (this.nvCurrentPage = n3, this.nvRenderPage(), l2.scrollTop(0));
        })), window.imageHoverPreviewObj ? window.imageHoverPreviewObj.bindEvents() : window.imageHoverPreviewObj = new ImageHoverPreview({
          selector: ".nv-cover-img",
          dataAttribute: "data-full"
        });
      }));
    }
    async editActress(e2) {
      const t2 = e2.name, n2 = e2.avatar, a2 = e2.remark || "", i2 = Array.isArray(e2.allName) ? e2.allName.join("，") : "", s2 = Array.isArray(e2.newVideoList) ? e2.newVideoList.map(((e3) => "string" == typeof e3 ? e3 : e3.carNum)).join("，") : "", o2 = e2.starId, l2 = e2.actressType || "", c2 = `
            <div class="jhs-form-dialog">
                <div class="jhs-avatar-editor">
                    <img id="edit-avatar-preview" src="${n2}" alt="Avatar Preview"
                         class="jhs-avatar-editor__preview">
                    <div class="jhs-form-dialog__body">
                        <label class="jhs-form-label">头像链接:</label>
                        <input type="text" id="edit-actress-avatar" value="${n2}"
                               class="jhs-field">
                       <div class="jhs-toolbar jhs-avatar-editor__actions">
                            <button type="button" id="search-avatar-btn"
                                class="jhs-btn jhs-btn--primary">
                                搜索头像
                            </button>
                            <button type="button" id="select-cdn-btn"
                                class="jhs-btn jhs-btn--secondary">
                                选择 CDN 源
                            </button>
                        </div>
                    </div>
                </div>
                <div class="jhs-form-field">
                    <label class="jhs-form-label">主名称:</label>
                    <input type="text" id="edit-actress-name" value="${t2}"
                           class="jhs-field">
                </div>
                <div class="jhs-form-field">
                    <label class="jhs-form-label">所有别名(用逗号隔开):</label>
                    <textarea id="edit-actress-allname" class="jhs-textarea">${i2}</textarea>
                </div>
                <div class="jhs-form-field">
                    <label class="jhs-form-label">演员类别:</label>
                    <select id="actressType" class="jhs-select-source">
                        <option value="" ${"" === l2 ? "selected" : ""}>未知</option>
                        <option value="censored" ${"censored" === l2 ? "selected" : ""}>有码</option>
                        <option value="uncensored" ${"uncensored" === l2 ? "selected" : ""}>无码</option>
                    </select>
                </div>
                <div class="jhs-form-field">
                    <label class="jhs-form-label">最新作品(用逗号隔开):</label>
                    <textarea id="edit-actress-newvideolist" class="jhs-textarea">${s2}</textarea>
                </div>
                <div class="jhs-form-field">
                    <label class="jhs-form-label">备注:</label>
                   <textarea id="edit-remark" class="jhs-textarea">${a2}</textarea>
                </div>
            </div>
        `;
      layer.open({
        type: 1,
        title: `编辑女优: ${t2} (${o2})`,
        area: utils.getDialogArea("sm"),
        content: c2,
        btn: ["保存", "取消"],
        success: /* @__PURE__ */ __name((e3, t3) => {
          JhsSelect.enhance(e3);
          const n3 = /* @__PURE__ */ __name((e4) => {
            e4.css("height", "auto"), e4.css("height", e4[0].scrollHeight + 15 + "px");
          }, "n");
          $("#edit-actress-avatar").on("input", (function() {
            const e4 = $(this).val();
            $("#edit-avatar-preview").attr("src", e4);
          }));
          const a3 = $("#edit-actress-allname");
          a3.on("input", (function() {
            n3($(this));
          })), n3(a3);
          const i3 = $("#edit-actress-newvideolist");
          i3.on("input", (function() {
            n3($(this));
          })), n3(i3), $("#search-avatar-btn").on("click", (async () => {
            await this.searchAvatar();
          })), $("#select-cdn-btn").on("click", (async () => {
            await (async function() {
              const e4 = at, t4 = tt.map(((t5, n5) => `
        <label class="jhs-option-row" for="cdn-${n5}">
            <input type="radio" id="cdn-${n5}" name="cdn-source" value="${n5}" ${n5 === e4 ? "checked" : ""}>
            <span>${t5.name} ${t5.json.includes("jsdelivr") ? "(推荐)" : ""}</span>
        </label>
    `)).join(""), n4 = `
        <div class="jhs-form-dialog">
            <p class="jhs-form-dialog__title">请选择头像数据源 (当前: ${tt[e4].name}):</p>
            ${t4}
            <p class="jhs-helper-text">切换源会清除本地缓存的数据，并在下次搜索时重新加载。</p>
        </div>
    `;
              layer.open({
                type: 1,
                title: "选择 CDN 源",
                area: utils.getResponsiveArea(["400px", "auto"]),
                content: n4,
                btn: ["确定", "取消"],
                success: /* @__PURE__ */ __name((e5, t5) => {
                  utils.setupEscClose(t5);
                }, "success"),
                yes: /* @__PURE__ */ __name(async (e5) => {
                  const t5 = $('input[name="cdn-source"]:checked').val(), n5 = parseInt(t5, 10);
                  if (n5 !== at) {
                    at = n5, localStorage.setItem(nt, n5.toString()), it = tt[n5].json, st = tt[n5].base, ct = null, dt = null;
                    try {
                      await lt.set(rt, null);
                    } catch (a4) {
                      clog.error("清除 IndexedDB 缓存失败:", a4);
                    }
                    show.ok(`CDN 源已切换为: ${tt[n5].name}`), layer.close(e5);
                  } else layer.close(e5);
                }, "yes")
              });
            })();
          })), utils.setupEscClose(t3);
        }, "success"),
        yes: /* @__PURE__ */ __name(async (t3) => {
          const n3 = $("#edit-actress-avatar").val().trim(), a3 = $("#edit-actress-name").val().trim(), i3 = $("#edit-actress-allname").val().trim(), s3 = $("#edit-actress-newvideolist").val().trim(), o3 = $("#edit-remark").val().trim(), r2 = $("#actressType").val();
          if (!a3) return show.error("主名称不能为空"), false;
          const l3 = i3.split(/[\uff0c,]/).map(((e3) => e3.trim())).filter(((e3) => e3.length > 0)), c3 = s3.split(/[\uff0c,]/).map(((e3) => e3.trim())).filter(((e3) => e3.length > 0));
          e2.avatar = n3, e2.name = a3, e2.allName = l3, e2.newVideoList = c3, e2.actressType = r2, e2.remark = o3;
          try {
            await storageManager.updateFavoriteActress(e2);
            await this.renderActressCards();
            this.showNewVideoCount();
            show.ok(`女优 ${a3} 信息已更新`);
            layer.close(t3);
          } catch (err) {
            show.error("修改失败: " + (err.message || err));
          }
        }, "yes")
      });
    }
    renderPagination(e2, t2) {
      const n2 = this.currentPage;
      let a2 = "";
      const i2 = $("#actress-pagination");
      if (0 === t2) return a2 = '<span class="jhs-pagination__summary">共 0 条记录</span>', void i2.html(a2);
      n2 > 1 && t2 > 5 && (a2 += '<button class="jhs-btn pagination-btn" data-page="1">首页</button>'), n2 > 1 && (a2 += `<button class="jhs-btn pagination-btn" data-page="${n2 - 1}">上一页</button>`);
      let s2 = Math.max(1, n2 - Math.floor(2.5)), o2 = Math.min(t2, s2 + 5 - 1);
      o2 - s2 < 4 && (s2 = Math.max(1, o2 - 5 + 1));
      for (let r2 = s2; r2 <= o2; r2++) {
        a2 += `<button class="jhs-btn pagination-btn page-number-btn ${r2 === n2 ? "active" : ""}" data-page="${r2}">${r2}</button>`;
      }
      n2 < t2 && (a2 += `<button class="jhs-btn pagination-btn" data-page="${n2 + 1}">下一页</button>`), n2 < t2 && t2 > 5 && (a2 += `<button class="jhs-btn pagination-btn" data-page="${t2}">尾页</button>`), a2 += `<span class="jhs-pagination__summary">共 ${e2} 条记录 (第 ${n2}/${t2} 页)</span>`, i2.html(a2), i2.find(".pagination-btn").off("click").on("click", ((e3) => {
        if ($(e3.currentTarget).is("[disabled]")) return;
        const n3 = parseInt($(e3.currentTarget).data("page"));
        n3 >= 1 && n3 <= t2 && n3 !== this.currentPage && (this.currentPage = n3, this.renderActressCards());
      }));
    }
    async searchAvatar() {
      const e2 = $("#edit-actress-name"), t2 = $("#edit-actress-allname"), n2 = e2.val().trim(), a2 = t2.val().trim().split(/[\uff0c,]/).map(((e3) => e3.trim())).filter(((e3) => e3.length > 0));
      if (n2 && a2.unshift(n2), 0 === a2.length) return void show.error("请先填写女优主名称或别名进行搜索。");
      const i2 = loading("正在搜索头像...");
      let s2 = [];
      try {
        s2 = await gt(a2);
      } catch (c2) {
        return void show.error(`头像数据加载或搜索失败: ${c2.message || c2}`);
      } finally {
        i2.close();
      }
      if (0 === s2.length) return void show.error(`未找到与 '${a2.join("、")}' 相关的头像。请检查名称。`);
      const o2 = s2.map(((e3, t3) => `
        <div id="wrapper-${t3}" class="gfriends-image-item-wrapper">
            <img alt="" src="${e3}" data-url="${e3}" class="gfriends-selectable-img" data-wrapper-id="wrapper-${t3}" >
            <div class="gfriends-size-tag" data-size-for="wrapper-${t3}">...</div>
        </div>
    `)).join(""), r2 = `
        <style>
            /* 保持上一个回答的美化样式 */
            #gfriends-image-list-container { padding: 15px; height: 100%; box-sizing: border-box; background-color: var(--jhs-surface-2); }
            #gfriends-prompt { color: var(--jhs-text-muted); font-weight: 500; border-bottom: 1px solid var(--jhs-surface-2); padding-bottom: 10px; }
            #gfriends-image-list { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
            .gfriends-image-item-wrapper {
                width: 160px; height: 225px; /* 增加高度以容纳尺寸标签 */
                overflow: hidden; border-radius: 6px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); transition: transform 0.2s ease, box-shadow 0.2s ease;
                cursor: pointer; position: relative;
                padding-bottom: 25px; /* 为尺寸标签留出空间 */
            }
            .gfriends-selectable-img {
                width: 100%; height: 200px; /* 固定图片高度 */
                object-fit: cover; border: 3px solid transparent;
                border-radius: 6px; transition: border 0.2s ease;
            }
            .gfriends-image-item-wrapper:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
            }
            .gfriends-selectable-img.is-selected {
                border-color: var(--jhs-accent);
                box-shadow: 0 0 0 3px var(--jhs-accent);
            }
            /* 新增：尺寸标签样式 */
            .gfriends-size-tag {
                position: absolute;
                bottom: 0; /* 定位到图片容器底部 */
                left: 0;
                right: 0;
                height: 25px;
                line-height: 25px;
                text-align: center;
                background-color: rgba(0, 0, 0, 0.7); /* 半透明背景 */
                color: #fff;
                font-size: 11px;
                font-weight: bold;
                border-bottom-left-radius: 6px;
                border-bottom-right-radius: 6px;
                user-select: none;
            }
        </style>

        <div id="gfriends-image-list-container">
            <p id="gfriends-prompt" class="jhs-layout-bd59a2e1">
                点击图片即可选择（初始共 ${s2.length} 张）
            </p>
            <div class="jhs-layout-3fefafab">
                <div id="gfriends-image-list">
                    ${o2}
                </div>
            </div>
        </div>
    `;
      let l2 = 0;
      layer.open({
        type: 1,
        title: `选择女优头像 (${s2.length} 张)`,
        area: utils.getResponsiveArea(["900px", "85%"]),
        content: r2,
        btn: ["关闭"],
        success: /* @__PURE__ */ __name((e3, t3) => {
          const n3 = $(e3), a3 = n3.find(".gfriends-selectable-img"), i3 = n3.find("#gfriends-prompt");
          a3.each((function() {
            const e4 = $(this), a4 = e4.data("wrapper-id"), o3 = n3.find(`#${a4}`), r3 = n3.find(`.gfriends-size-tag[data-size-for="${a4}"]`);
            e4.on("load", (function() {
              const e5 = this.naturalWidth, t4 = this.naturalHeight;
              r3.text(`${e5} x ${t4}`);
            })), e4.on("error", (function() {
              o3.remove(), l2++;
              const e5 = s2.length - l2;
              i3.text(`点击图片即可选择（已移除 ${l2} 张错误图片，剩余 ${e5} 张）`), 0 === e5 && (show.error("所有搜索到的头像链接均已失效，无法选择。"), layer.close(t3));
            })), this.complete && (this.naturalWidth > 0 ? e4.trigger("load") : e4.trigger("error"));
          })), a3.on("click", (function() {
            const e4 = $(this), n4 = e4.data("url");
            $("#edit-actress-avatar").val(n4), $("#edit-avatar-preview").attr("src", n4), a3.removeClass("is-selected"), e4.addClass("is-selected"), setTimeout((() => {
              layer.close(t3);
            }), 150);
          })), utils.setupEscClose(t3);
        }, "success")
      });
    }
  };
  __name(_NewVideoPlugin, "NewVideoPlugin");
  var NewVideoPlugin = _NewVideoPlugin;
  var _OneTwoThreeOfflinePlugin = class _OneTwoThreeOfflinePlugin extends BasePlugin {
    constructor() {
      super(...arguments), this.tokenKey = "jhs_123pan_author_token", this.tokenMetaKey = "jhs_123pan_author_token_meta", this.syncTimer = null, this.syncFallbackMs = 3e5;
    }
    getName() {
      return "OneTwoThreeOfflinePlugin";
    }
    async handle() {
      "yun.123pan.com" === window.location.hostname && this.startTokenSync();
    }
    startTokenSync() {
      this.syncTokenOnce(), this.syncTimer && clearInterval(this.syncTimer), this.syncTimer = setInterval((() => this.syncTokenOnce()), this.syncFallbackMs);
      const e2 = /* @__PURE__ */ __name(() => this.syncTokenOnce(), "e");
      window.addEventListener("storage", e2), window.addEventListener("focus", e2), document.addEventListener("visibilitychange", (() => {
        document.hidden || this.syncTokenOnce();
      }));
    }
    getTokenFrom123Pan() {
      let e2 = (localStorage.getItem("authorToken") || "").trim();
      if (e2) return {
        token: e2,
        source: "authorToken"
      };
      try {
        const t3 = JSON.parse(localStorage.getItem("userInfo") || "{}");
        if (t3.authorToken || t3.token) return {
          token: (t3.authorToken || t3.token || "").trim(),
          source: t3.authorToken ? "userInfo.authorToken" : "userInfo.token"
        };
      } catch (t3) {
        clog.debug("123 云盘历史用户信息解析失败，继续尝试其他凭证来源", t3);
      }
      const t2 = document.cookie.split(";");
      for (const n2 of t2) {
        const e3 = n2.indexOf("=");
        if (e3 < 0) continue;
        const t3 = n2.substring(0, e3).trim(), a2 = n2.substring(e3 + 1);
        if (t3 && /token/i.test(t3) && a2) return {
          token: decodeURIComponent(a2).trim(),
          source: `cookie.${t3}`
        };
      }
      return {
        token: "",
        source: ""
      };
    }
    syncTokenOnce() {
      const e2 = this.getTokenFrom123Pan();
      if (!e2.token) return;
      const t2 = GM_getValue(this.tokenKey, ""), n2 = GM_getValue(this.tokenMetaKey, null);
      if (t2 === e2.token && n2 && n2.source === e2.source) return;
      GM_setValue(this.tokenKey, e2.token), GM_setValue(this.tokenMetaKey, {
        source: e2.source,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }), t2 !== e2.token && show.info(`123 云盘授权已更新：${e2.source}`);
    }
    getStoredToken() {
      return GM_getValue(this.tokenKey, "");
    }
    clearStoredToken(e2) {
      GM_setValue(this.tokenKey, ""), GM_setValue(this.tokenMetaKey, {
        source: "cleared",
        reason: e2,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    isTokenExpiredError(e2) {
      const msg = e2 instanceof Error ? e2.message : "object" == typeof e2 && e2 ? e2.message || "" : String(e2 || "");
      return "TOKEN_EXPIRED" === e2 || "TOKEN_EXPIRED" === msg || msg.toLowerCase().includes("token is expired");
    }
    assertApiResult(e2, t2) {
      if (0 === e2.code) return;
      const n2 = e2.message || e2.msg || t2 || "请求失败";
      throw /token is expired/i.test(n2) ? "TOKEN_EXPIRED" : n2;
    }
    /* 依赖 gmRequest 在非 2xx 时 reject 对象上附加 status 属性 */
    async resolveMagnet(e2, t2) {
      try {
        const n2 = await gmHttp.post(this._signUrl("https://yun.123pan.com/b/api/v2/offline_download/task/resolve"), { urls: e2 }, {
          Authorization: "Bearer " + t2,
          "App-Version": "3",
          platform: "web",
          Origin: "https://yun.123pan.com",
          Referer: "https://yun.123pan.com/"
        });
        return this.assertApiResult(n2, "解析失败"), n2.data && n2.data.list && n2.data.list.length > 0 ? n2.data.list[0] : Promise.reject(n2.message || `解析失败 (${n2.code})`);
      } catch (a2) {
        if (a2 && 401 === a2.status) throw "TOKEN_EXPIRED";
        throw this.isTokenExpiredError(a2) ? "TOKEN_EXPIRED" : a2.message ? "响应解析失败: " + a2.message : String(a2);
      }
    }
    async submitTask(e2, t2) {
      if (!e2.files || 0 === e2.files.length) throw "没有可建立离线的文件";
      const n2 = e2.files.map(((e3) => e3.id)), a2 = e2.files.reduce(((e3, t3) => e3 + (t3.size || 0)), 0);
      try {
        const i2 = await gmHttp.post(this._signUrl("https://yun.123pan.com/b/api/v2/offline_download/task/submit"), {
          resource_list: [{ resource_id: e2.id, select_file_id: n2 }]
        }, {
          Authorization: "Bearer " + t2,
          "App-Version": "3",
          platform: "web"
        });
        return this.assertApiResult(i2, "提交失败"), { fileCount: n2.length, totalSize: a2 };
      } catch (i2) {
        if (i2 && 401 === i2.status) throw "TOKEN_EXPIRED";
        throw this.isTokenExpiredError(i2) ? "TOKEN_EXPIRED" : i2.message ? "响应解析失败: " + i2.message : String(i2);
      }
    }
    /** CRC32-IEEE (poly 0xEDB88320) — 与 Go crc32.ChecksumIEEE 一致 */
    _crc32(e2) {
      const t2 = new Array(256);
      for (let n3 = 0; n3 < 256; n3++) {
        let a2 = n3;
        for (let i2 = 0; i2 < 8; i2++) a2 = 1 & a2 ? 3988292384 ^ a2 >>> 1 : a2 >>> 1;
        t2[n3] = a2;
      }
      let n2 = 4294967295;
      for (let a2 = 0; a2 < e2.length; a2++) n2 = t2[(n2 ^ e2.charCodeAt(a2)) & 255] ^ n2 >>> 8;
      return (n2 ^ 4294967295) >>> 0;
    }
    /** 为 123 云盘 API URL 附加签名查询参数（与 Go signPath 算法一致） */
    _signUrl(e2) {
      const t2 = ["a", "d", "e", "f", "g", "h", "l", "m", "y", "i", "j", "n", "o", "p", "k", "q", "r", "s", "t", "u", "b", "c", "v", "w", "s", "z"];
      const n2 = Math.round(1e7 * Math.random());
      const a2 = /* @__PURE__ */ new Date();
      const i2 = new Date(a2.getTime() + 6e4 * a2.getTimezoneOffset() + 288e5);
      const s2 = `${i2.getFullYear()}${String(i2.getMonth() + 1).padStart(2, "0")}${String(i2.getDate()).padStart(2, "0")}${String(i2.getHours()).padStart(2, "0")}${String(i2.getMinutes()).padStart(2, "0")}`;
      let o2 = "";
      for (let r3 = 0; r3 < s2.length; r3++) o2 += t2[parseInt(s2[r3])];
      const r2 = this._crc32(o2), l2 = Math.floor(i2.getTime() / 1e3);
      const c2 = `${l2}|${n2}|${new URL(e2).pathname}|web|3|${r2}`;
      const u2 = this._crc32(c2), d2 = new URL(e2);
      return d2.searchParams.set(String(r2), `${l2}-${n2}-${u2}`), d2.toString();
    }
  };
  __name(_OneTwoThreeOfflinePlugin, "OneTwoThreeOfflinePlugin");
  var OneTwoThreeOfflinePlugin = _OneTwoThreeOfflinePlugin;
  var _OneOneFiveClient = class _OneOneFiveClient {
    constructor(http = gmHttp) {
      this.http = http;
    }
    async checkLogin() {
      try {
        const result = await this.http.get("https://webapi.115.com/offine/downpath");
        return Boolean(result?.state && result?.data?.length);
      } catch (cause) {
        throw new ProviderError("115", "LOGIN_REQUIRED", "115 未登录", { cause });
      }
    }
    async search(keyword, offset = 0, limit = 50) {
      const result = await this.http.get(`https://webapi.115.com/files/search?search_value=${encodeURIComponent(keyword)}&offset=${offset}&limit=${limit}`);
      return (result?.data || []).map(((item) => ({ folderId: item.pid || item.cid || "", fileId: item.fid || null, videoId: item.pc || item.pick_code || "", name: item.n || item.file_name || "", size: Number(item.s || item.size) || 0, createTime: item.t || item.create_time || "", isVideo: /\.(mp4|mkv|avi|mov|flv|wmv|ts|m2ts)$/i.test(item.n || item.file_name || "") }))).filter(((item) => item.isVideo));
    }
    async getOfflineInfo() {
      return this.http.get(`https://115.com/?ct=offline&ac=space&_=${Date.now()}`);
    }
    async addOffline(magnet, folderId = "") {
      if (!/^magnet:/i.test(magnet) && !/^ed2k:/i.test(magnet)) throw new TypeError("Unsupported offline URL");
      const info = await this.getOfflineInfo();
      if (!info || !info.sign) throw new ProviderError("115", "LOGIN_REQUIRED", "115 未登录或离线空间信息获取失败");
      const body = new URLSearchParams({ url: magnet, wp_path_id: folderId, uid: String(info.uid || ""), sign: info.sign || "", time: String(info.time || "") }).toString();
      const result = await this.http.gmRequest("POST", "https://115.com/web/lixian/?ct=lixian&ac=add_task_url", body, {}, { "Content-Type": "application/x-www-form-urlencoded" });
      const parsed = "string" == typeof result ? (() => {
        try {
          return JSON.parse(result);
        } catch {
          return { state: false, error_msg: /login|登录|sign in|未授权|授权|expire|expired|token|cookie/i.test(result) ? "115 未登录" : "115 返回异常响应" };
        }
      })() : result;
      if (!parsed || parsed.state === false) {
        const message = String(parsed?.error_msg || parsed?.error || parsed?.msg || "");
        const code = this.classifyAddOfflineError(message);
        throw new ProviderError("115", code, message || "115 离线任务创建失败", { response: parsed });
      }
      return parsed;
    }
    classifyAddOfflineError(message) {
      const text = String(message).toLowerCase();
      if (/未登录|请登录|登录|login|sign|授权|过期|token|cookie|uid|身份|auth|expire|needlogin|need login/i.test(text)) return "LOGIN_REQUIRED";
      if (/已存在|重复|exists|duplicate|already|same|conflict|exist/i.test(text)) return "TASK_EXISTS";
      return "ADD_TASK_FAILED";
    }
    async rename(fileId, newName) {
      const body = new URLSearchParams({ fid: fileId, file_name: newName }).toString();
      return this.http.gmRequest("POST", "https://webapi.115.com/files/edit", body, {}, { "Content-Type": "application/x-www-form-urlencoded" });
    }
  };
  __name(_OneOneFiveClient, "OneOneFiveClient");
  var OneOneFiveClient = _OneOneFiveClient;
  function normalize115Keyword(carNum) {
    const normalized = normalizeCarNum(carNum);
    return normalized?.replace(/^FC2-/i, "") || null;
  }
  __name(normalize115Keyword, "normalize115Keyword");
  function build115PlayUrl(match) {
    return match?.videoId ? `https://115.com/?ct=play&pickcode=${encodeURIComponent(match.videoId)}` : null;
  }
  __name(build115PlayUrl, "build115PlayUrl");
  function format115Size(bytes) {
    const value = Number(bytes) || 0;
    if (!value) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"], index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    return `${(value / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`;
  }
  __name(format115Size, "format115Size");
  function preview115Rename(fileName, carNum, options = {}) {
    const extension = fileName.match(/\.[^.]+$/)?.[0] || "", tags = fileName.match(/-(?:U|UC|C|4K|8K|H265|HEVC|CN|CHS|CHT)\b/gi) || [];
    let base = options.uppercase === false ? carNum : carNum.toUpperCase();
    if (options.keepTitle) base += ` ${fileName.replace(extension, "").replace(/^.*?\s+/, "")}`;
    if (options.keepSuffix !== false) base += [...new Set(tags.map(((tag) => tag.toUpperCase())))].join("");
    return `${base.slice(0, options.maxLength || 180)}${extension}`;
  }
  __name(preview115Rename, "preview115Rename");
  var _OneOneFiveMatchPlugin = class _OneOneFiveMatchPlugin extends BasePlugin {
    constructor() {
      super(), this.observer = null, this.unsubscribeItems = null, this.pendingCards = /* @__PURE__ */ new Set(), this.flushTimer = null, this.client = new OneOneFiveClient(), this.concurrency = 4, this.cacheMinutes = 60;
    }
    getName() {
      return "OneOneFiveMatchPlugin";
    }
    async handle() {
      if (!await storageManager.getSetting("enable115Match", false)) return;
      if (!isDetailPage) return this.setupListMatching();
      const carNum = this.getPageInfo().carNum, keyword = normalize115Keyword(carNum);
      if (!keyword) return;
      const host = $(".movie-panel-info,.container .info").first();
      host.append('<div class="panel-block jhs-115-match"><strong>115匹配：</strong><span>匹配中</span></div>');
      try {
        const cacheMinutes = Math.max(1, Number(await storageManager.getSetting("oneOneFiveCacheMinutes", 60)) || 60), matches = await storageManager.cachedRequest(`115match:${carNum}`, cacheMinutes * 6e4, (() => new OneOneFiveClient().search(keyword)));
        const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>");
        if (!matches.length) return void box.append(document.createTextNode("未匹配 "), $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload())));
        matches.forEach(((match) => {
          const row = $('<span class="jhs-115-match-row"></span>'), playUrl = build115PlayUrl(match);
          playUrl ? row.append($("<a></a>").addClass("jhs-btn jhs-btn--secondary").attr({ href: playUrl, target: "_blank" }).text(`${match.name} (${format115Size(match.size)})`)) : row.append($("<span></span>").text(`${match.name} (${format115Size(match.size)}) · 不可播放`));
          match.fileId && row.append($('<button type="button" class="jhs-btn jhs-btn--ghost jhs-115-rename">重命名</button>').data("match", match));
          box.append(row);
        }));
        box.on("click", ".jhs-115-rename", ((event) => this.renameWithPreview(event, $(event.currentTarget).data("match"), carNum)));
      } catch (error) {
        const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>", document.createTextNode("未登录或请求失败 "));
        box.append('<a class="jhs-btn jhs-btn--ghost" href="https://115.com" target="_blank">去登录</a>', $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload())));
        clog.error("115 匹配失败", error);
      }
    }
    async setupListMatching() {
      this.concurrency = Math.max(1, Math.min(10, Number(await storageManager.getSetting("oneOneFiveConcurrency", 4)) || 4)), this.cacheMinutes = Math.max(1, Number(await storageManager.getSetting("oneOneFiveCacheMinutes", 60)) || 60);
      this.observer = new IntersectionObserver(((entries) => {
        entries.forEach(((entry) => entry.isIntersecting && (this.observer.unobserve(entry.target), this.pendingCards.add(entry.target))));
        this.pendingCards.size && this.scheduleFlush();
      }), { rootMargin: "200px" });
      this.registerCards($(".movie-list .item,.masonry .item").get()), this.unsubscribeItems = jhsEventBus.on("list-items-added", ((payload) => this.registerCards(payload.items || [])));
    }
    registerCards(cards) {
      cards.forEach(((card) => {
        "true" !== card.dataset.jhs115Observed && "matched" !== card.dataset.jhs115State && (card.dataset.jhs115Observed = "true", this.observer.observe(card));
      }));
    }
    scheduleFlush() {
      this.flushTimer || (this.flushTimer = setTimeout((async () => {
        const cards = [...this.pendingCards];
        this.pendingCards.clear(), this.flushTimer = null, await mapLimit(cards, this.concurrency, ((card) => this.matchCard(card)));
      }), 50));
    }
    async matchCard(element, force = false) {
      const card = $(element), carNum = normalizeCarNum(card.find(".video-title strong").first().text());
      if (!carNum || "pending" === element.dataset.jhs115State && !force) return;
      const cacheKey = `115match:${carNum}`;
      try {
        element.dataset.jhs115State = "pending", force && await storageManager.deleteCachedRequest(cacheKey);
        const matches = await storageManager.cachedRequest(cacheKey, this.cacheMinutes * 6e4, (() => this.client.search(normalize115Keyword(carNum))));
        card.find(".jhs-115-list-match").remove();
        const badge = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-115-list-match"></button>').text(matches.length ? `匹配${matches.length}个` : "未匹配").data("matches", matches);
        card.find(".video-title").first().prepend(badge), element.dataset.jhs115State = "matched";
        badge.on("click", (() => {
          if (!matches.length) return this.matchCard(element, true);
          if (1 === matches.length) return window.open(build115PlayUrl(matches[0]), "_blank");
          const links = matches.map(((match) => `<a href="${escapeHtml(build115PlayUrl(match))}" target="_blank">${escapeHtml(match.name)}</a>`)).join("<br>");
          layer.open({ type: 1, title: `${carNum} 115匹配`, content: `<div class="jhs-dialog-content">${links}</div>`, area: utils.getResponsiveArea(["560px", "auto"]) });
        }));
      } catch (error) {
        element.dataset.jhs115State = "failed", card.find(".jhs-115-list-match").remove(), card.find(".video-title").first().prepend($('<button type="button" class="jhs-btn jhs-btn--ghost jhs-115-list-match">失败·重试</button>').one("click", (() => this.matchCard(element, true)))), clog.warn("115 单卡匹配失败", error);
      }
    }
    destroy() {
      this.unsubscribeItems?.(), this.observer?.disconnect(), this.flushTimer && clearTimeout(this.flushTimer), this.pendingCards.clear();
    }
    renameWithPreview(event, match, carNum) {
      const nextName = preview115Rename(match.name, carNum, { uppercase: true, keepSuffix: true });
      utils.q(event, `确认重命名？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, (async () => {
        await new OneOneFiveClient().rename(match.fileId, nextName);
        show.ok("重命名完成");
      }));
    }
  };
  __name(_OneOneFiveMatchPlugin, "OneOneFiveMatchPlugin");
  var OneOneFiveMatchPlugin = _OneOneFiveMatchPlugin;
  var _OfflineProviderRegistry = class _OfflineProviderRegistry {
    constructor() {
      this.providers = /* @__PURE__ */ new Map(), this.availabilityCache = /* @__PURE__ */ new Map(), this.positiveTtl = 3e5, this.negativeTtl = 2e4;
    }
    register(provider) {
      if (!provider?.id || !Array.isArray(provider.capabilities) || "function" != typeof provider.submit || "function" != typeof provider.getAvailability) throw new TypeError("Invalid offline provider");
      return this.providers.set(provider.id, provider), provider;
    }
    async getCandidates(resource, { force = false } = {}) {
      const type = /^ed2k:/i.test(resource) ? "ed2k" : /^magnet:/i.test(resource) ? "magnet" : "unknown", candidates = [];
      for (const provider of this.providers.values()) {
        if (!provider.capabilities.includes(type) || !await provider.isEnabled()) continue;
        const availability = await this.getAvailability(provider, force);
        ["ready", "unknown"].includes(availability.authState) && candidates.push({ provider, availability });
      }
      return candidates;
    }
    async getAvailability(provider, force = false) {
      const cached = this.availabilityCache.get(provider.id);
      const ttl = ["ready", "unknown"].includes(cached?.value?.authState) ? this.positiveTtl : this.negativeTtl;
      if (!force && cached && Date.now() - cached.time < ttl) return cached.value;
      const value = await provider.getAvailability({ force });
      return this.availabilityCache.set(provider.id, { time: Date.now(), value }), value;
    }
    updateAvailability(id, value) {
      this.availabilityCache.set(id, { time: Date.now(), value });
    }
  };
  __name(_OfflineProviderRegistry, "OfflineProviderRegistry");
  var OfflineProviderRegistry = _OfflineProviderRegistry;
  var _UnifiedOfflinePlugin = class _UnifiedOfflinePlugin extends BasePlugin {
    constructor() {
      super(), this.registry = new OfflineProviderRegistry(), this.BUTTON_COOLDOWN_MS = 1800;
    }
    getName() {
      return "UnifiedOfflinePlugin";
    }
    async initCss() {
      return "<style>.jhs-offline-btn.loading{cursor:wait;opacity:.65}.jhs-offline-native{margin-left:6px;padding:3px 8px}</style>";
    }
    async handle() {
      if (!(r || l)) return;
      this.registerProviders(), this.bindSubmit(), window.isDetailPage && (this.injectNativeButtons(), jhsEventBus.on("magnet-items-updated", (() => this.injectNativeButtons())));
    }
    registerProviders() {
      const one23 = this.getBean("OneTwoThreeOfflinePlugin");
      one23 && this.registry.register({ id: "123", name: "123 云盘", capabilities: ["magnet"], retryPolicy: { automaticAttempts: 0 }, isEnabled: /* @__PURE__ */ __name(() => storageManager.getSetting("enable123Offline", true), "isEnabled"), getAvailability: /* @__PURE__ */ __name(async () => one23.getStoredToken() ? { available: true, authState: "ready", reason: "授权已同步" } : { available: false, authState: "token-missing", reason: "尚未同步 123 授权" }, "getAvailability"), submit: /* @__PURE__ */ __name(async (resource) => {
        const token = one23.getStoredToken();
        if (!token) throw Object.assign(new Error("尚未同步 123 授权"), { code: "TOKEN_MISSING" });
        const resolved = await one23.resolveMagnet(resource, token);
        return one23.submitTask(resolved, token);
      }, "submit"), openUrl: /* @__PURE__ */ __name(() => "https://yun.123pan.com", "openUrl") });
      this.registry.register({ id: "115", name: "115", capabilities: ["magnet", "ed2k"], retryPolicy: { automaticAttempts: 0 }, isEnabled: /* @__PURE__ */ __name(() => storageManager.getSetting("enable115Offline", false), "isEnabled"), getAvailability: /* @__PURE__ */ __name(async () => ({ available: true, authState: "unknown", reason: "提交时确认登录状态" }), "getAvailability"), submit: /* @__PURE__ */ __name((resource) => new OneOneFiveClient().addOffline(resource), "submit"), openUrl: /* @__PURE__ */ __name(() => "https://115.com", "openUrl") });
      window.offlineProviderRegistry = this.registry;
    }
    bindSubmit() {
      $(document).off("click.jhsUnifiedOffline", ".jhs-offline-btn").on("click.jhsUnifiedOffline", ".jhs-offline-btn", (async (event) => {
        event.preventDefault(), event.stopPropagation();
        const button = $(event.currentTarget), resource = button.attr("data-resource") || button.attr("data-magnet") || button.closest(".magnet-result,.item,td").find('a[href^="magnet:"],a[href^="ed2k:"]').first().attr("href");
        resource ? await this.submitResource(event, resource, button) : show.error("未找到可提交资源");
      }));
    }
    injectNativeButtons() {
      const adapter = getDetailResourceAdapter();
      if (!adapter) return;
      adapter.rows().forEach(((row) => {
        const resource = adapter.getResource(row), target = adapter.getActionTarget(row);
        if (!resource || !target?.length || $(row).closest(".magnet-container,.jhs-review-panel,.movie-detail-container").length) return;
        const owner = `native-${adapter.site}`;
        let button = $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).first();
        $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).not(button).remove();
        button.length || (button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn jhs-offline-native">离线</button>').attr("data-jhs-offline-owner", owner)), button.attr("data-resource", resource), target.append(button);
      }));
    }
    async chooseCandidate(event, candidates) {
      if (1 === candidates.length) return candidates[0];
      const mode = await storageManager.getSetting("offlineProviderMode", "ask"), preferred = candidates.find(((candidate) => candidate.provider.id === mode));
      if (preferred) return preferred;
      return new Promise(((resolve) => {
        const content = $('<div class="jhs-form-dialog"><p>选择离线服务</p><div class="jhs-toolbar"></div></div>'), toolbar = content.find(".jhs-toolbar");
        candidates.forEach(((candidate) => toolbar.append($('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').text(`${candidate.provider.name} · ${"ready" === candidate.availability.authState ? "已就绪" : "状态未知"}`).on("click", (() => {
          layer.close(index), resolve(candidate);
        })))));
        const index = layer.open({ type: 1, title: "选择离线服务", content, area: utils.getDialogArea("sm"), cancel: /* @__PURE__ */ __name(() => resolve(null), "cancel") });
      }));
    }
    getVideoInfo(button) {
      if (window.isDetailPage) return this.getPageInfo();
      const item = button?.closest?.(".item");
      return item?.length ? this.getBean("ListPagePlugin").findCarNumAndHref(item) : this.getPageInfo();
    }
    async submitResource(event, resource, button = $(), context = null, retryOf = null, options = {}) {
      if (button.hasClass("loading")) return;
      const candidates = await this.registry.getCandidates(resource, { force: !!options.forceAvailabilityRefresh });
      if (!candidates.length) return void show.error("没有已启用且支持该资源的离线服务，请检查授权与设置");
      const selected = candidates.find(((candidate) => candidate.provider.id === options.preferredProviderId)) || await this.chooseCandidate(event, candidates);
      if (!selected) return;
      const info = context || this.getVideoInfo(button), original = button.text(), restoreButton = /* @__PURE__ */ __name(() => {
        if (!button[0]?.isConnected) return;
        button.removeClass("loading").prop("disabled", false).removeAttr("aria-busy").text(original);
      }, "restoreButton");
      let submitted = false;
      try {
        button.addClass("loading").prop("disabled", true).attr("aria-busy", "true").text("提交中"), await selected.provider.submit(resource, info), this.registry.updateAvailability(selected.provider.id, { available: true, authState: "ready", reason: "最近提交成功" });
        await stateService.appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "submitted", retryOf }), submitted = true, button.text("已提交"), show.ok(`${selected.provider.name} 离线任务已创建`), utils.q(event, "是否将该作品标记为已下载？", (async () => {
          info?.carNum && await stateService.patch(info.carNum, { downloaded: true }, { type: "offline-mark-downloaded", record: { ...info, names: info.actress || info.names || "" } });
        }));
      } catch (error) {
        const code = error?.code || ("TOKEN_EXPIRED" === error ? "TOKEN_EXPIRED" : "SUBMIT_FAILED");
        ["LOGIN_REQUIRED", "TOKEN_EXPIRED", "TOKEN_MISSING"].includes(code) && this.registry.updateAvailability(selected.provider.id, { available: false, authState: "115" === selected.provider.id ? "login-required" : "token-missing", reason: error.message || String(error) });
        restoreButton();
        submitted || await stateService.appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "failed", errorCode: code, errorMessage: error?.message || String(error), retryOf }), show.error(`${selected.provider.name} 离线失败：${error?.message || error}`);
      } finally {
        submitted ? setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS) : restoreButton();
      }
    }
  };
  __name(_UnifiedOfflinePlugin, "UnifiedOfflinePlugin");
  var UnifiedOfflinePlugin = _UnifiedOfflinePlugin;
  var _StatsPlugin = class _StatsPlugin extends BasePlugin {
    getName() {
      return "StatsPlugin";
    }
    async initCss() {
      return `
            <style>
                .jhs-stats { height:100%; padding:var(--jhs-space-4); overflow:auto; }
                .jhs-stats__metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:1px solid var(--jhs-border); border-left:1px solid var(--jhs-border); }
                .jhs-stats__metric { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-4); border:0; border-right:1px solid var(--jhs-border); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface); text-align:left; }
                button.jhs-stats__metric { cursor:pointer; }
                .jhs-stats__metric strong { color:var(--jhs-text); font-size:28px; line-height:1; }
                .jhs-stats__metric span { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-stats__group { margin-top:var(--jhs-space-5); }
                .jhs-stats__group h3 { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
                .jhs-stats__rows { display:grid; gap:var(--jhs-space-2); }
                .jhs-stats__row { display:grid; grid-template-columns:90px minmax(0,1fr) 76px; align-items:center; gap:var(--jhs-space-3); min-height:32px; }
                .jhs-stats__label { overflow:hidden; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-align:right; text-overflow:ellipsis; white-space:nowrap; }
                .jhs-stats__track { height:10px; overflow:hidden; border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); }
                .jhs-stats__bar { display:block; width:var(--jhs-value,0%); height:100%; border-radius:inherit; background:var(--jhs-bar,var(--jhs-accent)); }
                .jhs-stats__value { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                @media (max-width:767px) { .jhs-stats__metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .jhs-stats__row { grid-template-columns:72px minmax(0,1fr) 58px; gap:var(--jhs-space-2); } }
            </style>`;
    }
    async handle() {
      window.isListPage && this.createBtn();
    }
    createBtn() {
      const e2 = '<button type="button" id="statsBtn" class="jhs-btn jhs-btn--secondary"><span>统计</span></button>';
      $("#newVideoBtn").after(e2), $("#statsBtn").on("click", (() => this.openDialog()));
    }
    async openDialog() {
      const cars = await storageManager.getCarList(), actresses = await storageManager.getFavoriteActressList(), blacklist = await storageManager.getBlacklist(), activity = await stateService.getActivityLog(), total = cars.length;
      const counts = { manualBlocked: 0, favorite: 0, hasDown: 0, hasWatch: 0, pending: 0 };
      cars.forEach(((car) => {
        const flags = normalizeStateFlags(car.stateFlags);
        flags.blocked && counts.manualBlocked++, flags.favorite && counts.favorite++, flags.downloaded && counts.hasDown++, flags.watched && counts.hasWatch++, hasAnyState(flags) || counts.pending++;
      }));
      const actressCounts = /* @__PURE__ */ new Map();
      cars.forEach(((car) => {
        const names = String(car.names || "").split(/[\s,，、]+/).filter(Boolean);
        if (car.starId) {
          const key = `id:${car.starId}`, current = actressCounts.get(key) || { starId: car.starId, name: names[0] || car.starId, count: 0 };
          current.count++, actressCounts.set(key, current);
        } else names.forEach(((name) => {
          const key = `name:${name}`, current = actressCounts.get(key) || { starId: "", name, count: 0 };
          current.count++, actressCounts.set(key, current);
        }));
      }));
      const topActresses = [...actressCounts.values()].sort(((left, right) => right.count - left.count || left.name.localeCompare(right.name))).slice(0, 10), topValue = topActresses[0]?.count || 1, javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl();
      const pending = counts.pending, counter = this.getBean("NewVideoPlugin"), newVideos = counter ? await counter.getPendingNewVideoTotal() : 0, pageSummary = this.getBean("ListPagePlugin").getCurrentPageSummary();
      const metrics = [
        { label: "总记录", value: total, action: null },
        { label: "收藏", value: counts.favorite, action: null },
        { label: "下载", value: counts.hasDown, action: null },
        { label: "已看", value: counts.hasWatch, action: null },
        { label: "手动屏蔽", value: counts.manualBlocked, action: null },
        { label: "未鉴定", value: pending, action: null },
        { label: "收藏演员", value: actresses.length, action: null },
        { label: "黑名单演员", value: blacklist.length, action: null },
        { label: "新作品待处理", value: newVideos, action: "new-video" }
      ];
      const statusRows = [["收藏", counts.favorite, "var(--jhs-status-fav)"], ["下载", counts.hasDown, "var(--jhs-status-down)"], ["已看", counts.hasWatch, "var(--jhs-status-watch)"], ["手动屏蔽", counts.manualBlocked, "var(--jhs-status-filter)"], ["未鉴定", pending, "var(--jhs-border-strong)"]];
      const row = /* @__PURE__ */ __name((label, value, max, color, href = "") => `<div class="jhs-stats__row">${href ? `<a class="jhs-stats__label" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}">${escapeHtml(label)}</a>` : `<span class="jhs-stats__label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`}<span class="jhs-stats__track"><span class="jhs-stats__bar" data-width="${max ? Math.round(value / max * 100) : 0}" data-color="${color}"></span></span><span class="jhs-stats__value">${value}${max === total && total ? ` (${Math.round(value / total * 100)}%)` : ""}</span></div>`, "row");
      const trend = /* @__PURE__ */ __name((days) => {
        const cutoff = Date.now() - days * 864e5, result = { identified: 0, downloaded: 0, watched: 0 };
        activity.entries.filter(((entry) => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)).forEach(((entry) => entry.changes.filter(((change) => "reverted" !== change.undoState)).forEach(((change) => {
          const before = normalizeStateFlags(change.before?.stateFlags), after = normalizeStateFlags(change.after?.stateFlags);
          !hasAnyState(before) && hasAnyState(after) && result.identified++, !before.downloaded && after.downloaded && result.downloaded++, !before.watched && after.watched && result.watched++;
        }))));
        return result;
      }, "trend"), trend7 = trend(7), trend30 = trend(30);
      const coverageNote = activity.coverageStart ? `活动记录仅覆盖自 ${escapeHtml(activity.coverageStart)} 起` : "仅统计 6.4.0 及之后产生的操作记录";
      const renderMetric = /* @__PURE__ */ __name((metric) => metric.action ? `<button type="button" class="jhs-btn jhs-stats__metric" data-action="${metric.action}"${metric.filter ? ` data-filter="${metric.filter}"` : ""}><strong>${metric.value}</strong><span>${metric.label}</span></button>` : `<div class="jhs-stats__metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`, "renderMetric");
      const dialogHtml = `<div class="jhs-stats jhs-scrollbar jhs-ui">
            <section class="jhs-stats__group"><h3>全库概览</h3><div class="jhs-stats__metrics">${metrics.map(renderMetric).join("")}</div></section>
            <section class="jhs-stats__group"><h3>当前页面</h3><div class="jhs-stats__metrics">${renderMetric({ label: "屏蔽项", value: pageSummary.blockedItems, action: "filter", filter: "blockedItems" })}</div></section>
            <section class="jhs-stats__group"><h3>状态分布</h3><div class="jhs-stats__rows">${statusRows.map(((item) => row(item[0], item[1], total, item[2]))).join("")}</div></section>
            <section class="jhs-stats__group"><h3>活动趋势</h3><p class="jhs-helper-text">${coverageNote}</p><div class="jhs-stats__metrics"><div class="jhs-stats__metric"><strong>${trend7.identified}</strong><span>近 7 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend7.downloaded}</strong><span>近 7 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend7.watched}</strong><span>近 7 天标记观看</span></div><div class="jhs-stats__metric"><strong>${trend30.identified}</strong><span>近 30 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend30.downloaded}</strong><span>近 30 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend30.watched}</strong><span>近 30 天标记观看</span></div></div></section>
            ${topActresses.length ? `<section class="jhs-stats__group"><h3>Top 10 演员</h3><div class="jhs-stats__rows">${topActresses.map(((item) => row(item.name, item.count, topValue, "var(--jhs-accent)", new URL(item.starId ? `/actors/${encodeURIComponent(item.starId)}` : `/search?q=${encodeURIComponent(item.name)}`, javDbUrl).href))).join("")}</div></section>` : ""}
        </div>`;
      layer.open({ type: 1, title: "统计", content: dialogHtml, scrollbar: false, area: utils.getDialogArea("lg"), anim: -1, success: /* @__PURE__ */ __name((layerElement, layerIndex) => {
        $(layerElement).find(".jhs-stats__bar").each((function() {
          $(this).css({ "--jhs-value": `${$(this).data("width")}%`, "--jhs-bar": $(this).data("color") });
        }));
        $(layerElement).find("button.jhs-stats__metric[data-action]").on("click", ((event) => {
          const metric = $(event.currentTarget), action = metric.data("action");
          layer.close(layerIndex);
          if ("new-video" === action) return this.getBean("NewVideoPlugin").openDialog();
          if ("filter" === action) this.getBean("ListPagePlugin").setQuickFilter(metric.data("filter"));
        }));
        utils.setupEscClose(layerIndex);
      }, "success") });
    }
  };
  __name(_StatsPlugin, "StatsPlugin");
  var StatsPlugin = _StatsPlugin;
  var _MobileBottomBarPlugin = class _MobileBottomBarPlugin extends BasePlugin {
    constructor() {
      super(...arguments);
      this._fabGeneration = 0;
    }
    getName() {
      return "MobileBottomBarPlugin";
    }
    shouldSkipOnMobile() {
      return false;
    }
    async initCss() {
      return `
            /* FAB 浮动操作按钮 */
            #jhs-fab {
                position: fixed;
                bottom: calc(24px + env(safe-area-inset-bottom, 0px));
                right: 20px;
                width: 56px;
                height: 56px;
                border: 0;
                border-radius: 50%;
                background: var(--jhs-status-fav);
                color: var(--jhs-status-fav-on);
                font-size: 26px;
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: var(--jhs-z-fab);
                box-shadow: var(--jhs-shadow-md);
                transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                -webkit-user-select: none;
            }
            #jhs-fab:active {
                transform: scale(0.9);
            }
            #jhs-fab.jhs-fab-open {
                transform: rotate(135deg);
                background: var(--jhs-status-filter);
                color: var(--jhs-status-filter-on);
                box-shadow: var(--jhs-shadow-md);
            }

            /* FAB 遮罩 */
            .jhs-fab-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.25);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                z-index: var(--jhs-z-fab-backdrop);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }
            .jhs-fab-backdrop.jhs-fab-backdrop-visible {
                opacity: 1;
                pointer-events: auto;
            }

            /* FAB 菜单 */
            .jhs-fab-menu {
                position: fixed;
                bottom: calc(92px + env(safe-area-inset-bottom, 0px));
                right: 16px;
                z-index: var(--jhs-z-fab-menu);
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: flex-end;
                opacity: 0;
                transform: translateY(16px) scale(0.92);
                pointer-events: none;
                transition: opacity 0.25s, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
            }
            .jhs-fab-menu.jhs-fab-menu-open {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }

            /* FAB 菜单分组 */
            .jhs-fab-group {
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: flex-end;
            }
            .jhs-fab-divider {
                width: 32px;
                height: 2px;
                background: var(--jhs-border);
                border-radius: 1px;
                align-self: flex-end;
                margin: 2px 0;
            }

            /* FAB 菜单项 */
            .jhs-fab-menu-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                background: var(--jhs-surface);
                border: 1px solid var(--jhs-border);
                border-radius: 24px;
                box-shadow: var(--jhs-shadow-md);
                cursor: pointer;
                white-space: nowrap;
                min-height: 44px;
                font-size: 14px;
                font-family: inherit;
                font-weight: 500;
                color: var(--jhs-text);
                opacity: 0;
                transform: translateY(8px) scale(0.92);
                transition: opacity 0.2s, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), background 0.15s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                -webkit-user-select: none;
            }
            .jhs-fab-menu-item.jhs-fab-item-visible {
                opacity: 1;
                transform: translateY(0) scale(1);
                transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), background 0.15s;
            }
            .jhs-fab-menu-item:active {
                transform: scale(0.95);
                background: var(--jhs-surface-2);
            }

            /* FAB 状态色块 */
            .jhs-fab-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
                background: var(--jhs-border-strong);
            }

            .jhs-page-commandbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                overflow: visible;
                gap: var(--jhs-space-3);
                width: 100%;
                margin: var(--jhs-space-3) 0;
            }
            .jhs-commandbar__left, .jhs-commandbar__right,
            .jhs-commandbar__primary, .jhs-commandbar__filters,
            .jhs-commandbar__context, .jhs-commandbar__view {
                display: flex;
                align-items: center;
                gap: var(--jhs-space-1);
                min-width: 0;
                white-space: nowrap;
            }
            .jhs-commandbar__left { flex: 1 1 auto; overflow:visible; }
            .jhs-commandbar__right { flex: 0 0 auto; overflow:visible; }
            .jhs-commandbar__filters { overflow:visible; }
            .jhs-commandbar__batch, .jhs-commandbar__more, .jhs-sort-control { position:relative; }
            .jhs-commandbar__menu { min-width:220px; }
            .jhs-commandbar__menu .jhs-btn, .jhs-sort-menu .jhs-btn { width:100%; justify-content:flex-start; }
            .jhs-commandbar__sort-label { color:var(--jhs-text-muted); font-size:14px; }
            .jhs-mobile-filter-menu { display:none; min-width:220px; padding:var(--jhs-space-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
            .jhs-fab-menu.jhs-fab-filter-open > .jhs-fab-group, .jhs-fab-menu.jhs-fab-filter-open > .jhs-fab-divider { display:none; }
            .jhs-fab-menu.jhs-fab-filter-open > .jhs-mobile-filter-menu { display:grid; gap:var(--jhs-space-1); }
            .jhs-mobile-filter-menu .jhs-btn { width:100%; justify-content:flex-start; }
            @media (max-width: 1023px) {
                .jhs-page-commandbar { flex-wrap:wrap; overflow:visible; }
                .jhs-commandbar__left, .jhs-commandbar__right { flex-wrap:wrap; overflow:visible; }
                .jhs-commandbar__left { flex-basis:100%; }
                .jhs-commandbar__right { margin-left:auto; }
            }
            @media (max-width: 768px) {
                .jhs-page-commandbar { display: none; }
            }
        `;
    }
    async handle() {
      if (!utils.isMobileMode()) return;
      const backdrop = $('<div class="jhs-fab-backdrop"></div>').appendTo("body");
      const menu = this.createMenu();
      $("body").append(menu);
      const fab = $('<button type="button" id="jhs-fab" class="jhs-btn" aria-label="打开 JHS 工具" aria-controls="jhs-fab-menu" aria-haspopup="menu" aria-expanded="false">＋</button>').appendTo("body");
      this.bindEvents(fab, backdrop);
    }
    async afterPluginsReady() {
      this.buildCommandBar();
    }
    /** 将列表页分散的 JHS 控件收敛为单一命令栏。 */
    buildCommandBar() {
      if (!window.isListPage || $("#jhs-page-commandbar").length) return;
      const commandbar = $(`
            <div id="jhs-page-commandbar" class="jhs-page-commandbar jhs-ui" role="toolbar" aria-label="JHS 页面工具">
                <div class="jhs-commandbar__left"></div>
                <div class="jhs-commandbar__right"></div>
            </div>`);
      const listBox = r ? $(this.getSelector().boxSelector).first() : $(".masonry").first();
      if (!listBox.length) return void clog.warn("JHS 页面工具栏未创建：列表容器尚未就绪");
      listBox.before(commandbar);
      const left = commandbar.find(".jhs-commandbar__left"), right = commandbar.find(".jhs-commandbar__right");
      const primary = $('<div class="jhs-commandbar__primary"></div>');
      ["#waitCheckBtn", "#newVideoBtn", "#historyBtn"].forEach(((selector) => {
        const item = $(selector).first();
        item.length && item.attr("class", "jhs-btn jhs-btn--secondary").removeAttr("role tabindex").detach().appendTo(primary);
      }));
      primary.children().length && left.append(primary);
      const more = $('<div class="jhs-commandbar__more"><button type="button" class="jhs-btn jhs-btn--secondary jhs-commandbar__menu-toggle" aria-haspopup="menu" aria-expanded="false">更多</button><div class="jhs-popover jhs-commandbar__menu" role="menu"></div></div>');
      ["#statsBtn", "#blacklistBtn"].forEach(((selector) => {
        const item = $(selector).first();
        item.length && item.attr({ class: "jhs-btn jhs-btn--ghost", role: "menuitem", tabindex: "-1" }).detach().appendTo(more.find(".jhs-commandbar__menu"));
      }));
      more.find(".jhs-commandbar__menu").children().length && left.append(more);
      const quickFilter = $("#jhs-quick-filter").first();
      quickFilter.length && left.append($('<div class="jhs-commandbar__filters"></div>').append(quickFilter.detach()));
      const contextItem = $("#addBlacklistBtn").first();
      contextItem.length && contextItem.attr("class", "jhs-btn jhs-btn--secondary").removeAttr("role tabindex").detach().appendTo($('<div class="jhs-commandbar__context"></div>').appendTo(right));
      const sort = $(".jhs-sort-control").first();
      if (sort.length) {
        const view = $('<label class="jhs-commandbar__view"><span class="jhs-commandbar__sort-label">排序</span></label>');
        sort.detach().appendTo(view), right.append(view);
      }
      const batch = $('<div class="jhs-commandbar__batch"><button type="button" class="jhs-btn jhs-btn--secondary jhs-commandbar__menu-toggle" aria-haspopup="menu" aria-expanded="false">批量操作</button><div class="jhs-popover jhs-commandbar__menu" role="menu"></div></div>');
      ["#filterAllVideo", "#favoriteAllVideo", "#hasDownAllVideo"].forEach(((selector) => {
        const item = $(selector).first();
        item.length && item.attr({ class: "jhs-btn jhs-btn--ghost", role: "menuitem", tabindex: "-1" }).detach().appendTo(batch.find(".jhs-commandbar__menu"));
      }));
      batch.find(".jhs-commandbar__menu").children().length && right.append(batch);
      $(".jhs-list-btn-row").filter((function() {
        return !$(this).children().length;
      })).remove();
      commandbar.find(".jhs-commandbar__more, .jhs-commandbar__batch").each((function() {
        const container = $(this), toggle = container.find(".jhs-commandbar__menu-toggle"), menu = container.find(".jhs-commandbar__menu");
        toggle.on("click", ((event) => {
          event.stopPropagation();
          const open = !menu.hasClass("is-open");
          commandbar.find(".jhs-commandbar__menu").removeClass("is-open"), commandbar.find(".jhs-commandbar__menu-toggle").attr("aria-expanded", "false"), menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && menu.children().first().trigger("focus");
        })), menu.on("keydown", "[role='menuitem']", ((event) => {
          const items = menu.find("[role='menuitem']"), index = items.index(event.currentTarget);
          if ("Escape" === event.key) return event.preventDefault(), menu.removeClass("is-open"), toggle.attr("aria-expanded", "false").trigger("focus");
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
          items.eq(next).trigger("focus");
        })).on("click", "[role='menuitem']", (() => {
          menu.removeClass("is-open"), toggle.attr("aria-expanded", "false");
        }));
      }));
      $(document).off("click.jhsCommandbar").on("click.jhsCommandbar", ((event) => {
        $(event.target).closest(".jhs-commandbar__more, .jhs-commandbar__batch").length || (commandbar.find(".jhs-commandbar__menu").removeClass("is-open"), commandbar.find(".jhs-commandbar__menu-toggle").attr("aria-expanded", "false"));
      }));
      this.getBean("ListPagePlugin")?.syncQuickFilterUi();
    }
    /** 获取详情页番号 */
    getCarNum() {
      try {
        const basePlugin = this.getBean("DetailPageButtonPlugin");
        if (basePlugin?.parseMovieId) return basePlugin.parseMovieId(location.href);
        const el = document.querySelector(".header, #video_id, .video-id");
        if (el) return el.textContent.trim();
      } catch (e2) {
        clog.debug("移动端详情番号解析失败，已回退", e2);
      }
      return null;
    }
    createMenu() {
      const item = /* @__PURE__ */ __name((action, label, attributes = "") => `<button type="button" role="menuitem" class="jhs-btn jhs-fab-menu-item" data-action="${action}" ${attributes}>${label}</button>`, "item"), group = /* @__PURE__ */ __name((content) => `<div class="jhs-fab-group">${content}</div>`, "group"), divider = '<div class="jhs-fab-divider" role="separator"></div>';
      let items;
      if (window.isListPage) {
        const sortMethod = localStorage.getItem("jhs_sortMethod") || "default", sortLabel = { default: "默认", rateCount: "评价人数", date: "时间" }[sortMethod], activeFilter = normalizeQuickFilterKey(this.getBean("ListPagePlugin")?.activeQuickFilter), filterOptions = [...PRIMARY_QUICK_FILTERS, ...SECONDARY_QUICK_FILTERS].map(((filter, index) => `${index === PRIMARY_QUICK_FILTERS.length ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-mobile-filter-option" aria-checked="${filter === activeFilter}" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join("");
        items = group(item("check", "开始鉴定") + item("newVideo", "新作品") + item("blacklist", "黑名单") + item("sort", `排序: ${sortLabel}`) + item("quickFilter", `<span class="jhs-mobile-filter-label">筛选：${QUICK_FILTER_LABELS[activeFilter]}</span>`, 'aria-haspopup="menu" aria-expanded="false"')) + divider + group(item("setting", "设置")) + `<div class="jhs-mobile-filter-menu" role="menu" aria-label="列表筛选">${filterOptions}</div>`;
      } else if (window.isDetailPage) {
        const statusDefs = [{ action: "filter", icon: m, label: "屏蔽", key: "filter" }, { action: "fav", icon: v, label: "收藏", key: "fav" }, { action: "down", icon: y, label: "已下载", key: "down" }, { action: "watch", icon: k, label: "已观看", key: "watch" }];
        items = group(statusDefs.map(((definition) => item(definition.action, `<span class="jhs-fab-status-dot" data-status-key="${definition.key}"></span>${definition.icon}`, `aria-label="${definition.label}" aria-pressed="false" data-label="${definition.label}"`))).join("")) + divider + group(item("magnetFilter", "磁力过滤") + item("magnet", "磁力搜索") + item("subtitle", "字幕")) + divider + group(item("setting", "设置"));
      } else items = group(item("setting", "设置"));
      return $(`<div id="jhs-fab-menu" class="jhs-fab-menu" role="menu" aria-hidden="true">${items}</div>`);
    }
    /** 刷新详情页菜单的状态指示 */
    async refreshDetailStatus() {
      try {
        const carNum = this.getCarNum();
        if (!carNum) return;
        const car = await storageManager.getCar(carNum);
        const menu = $(".jhs-fab-menu");
        const colors = { filter: "var(--jhs-status-filter)", fav: "var(--jhs-status-fav)", down: "var(--jhs-status-down)", watch: "var(--jhs-status-watch)" };
        const flags = normalizeStateFlags(car?.stateFlags), activeKeys = new Set([
          flags.blocked && "filter",
          flags.favorite && "fav",
          flags.downloaded && "down",
          flags.watched && "watch"
        ].filter(Boolean));
        menu.find(".jhs-fab-status-dot").each(function() {
          const key = $(this).data("status-key");
          const item = $(this).closest(".jhs-fab-menu-item");
          if (activeKeys.has(key)) {
            $(this).css({ background: colors[key] || "var(--jhs-border-strong)" }), item.attr("aria-pressed", "true");
          } else {
            $(this).css({ background: "var(--jhs-border-strong)" }), item.attr("aria-pressed", "false");
          }
        });
      } catch (e2) {
        clog.warn("移动端详情状态刷新失败", e2);
      }
    }
    bindEvents(fab, backdrop) {
      const menu = $(".jhs-fab-menu"), filterMenu = menu.find(".jhs-mobile-filter-menu"), filterTrigger = menu.find('[data-action="quickFilter"]'), closeFilterMenu = /* @__PURE__ */ __name((returnFocus = false) => {
        menu.removeClass("jhs-fab-filter-open"), filterTrigger.attr("aria-expanded", "false"), returnFocus && filterTrigger.trigger("focus");
      }, "closeFilterMenu");
      const closeMenu = /* @__PURE__ */ __name((returnFocus = false) => {
        this._fabGeneration++;
        closeFilterMenu();
        fab.removeClass("jhs-fab-open").attr("aria-expanded", "false");
        menu.removeClass("jhs-fab-menu-open").attr("aria-hidden", "true");
        backdrop.removeClass("jhs-fab-backdrop-visible");
        menu.find(".jhs-fab-menu-item").removeClass("jhs-fab-item-visible");
        returnFocus && fab.trigger("focus");
      }, "closeMenu");
      const toggleMenu = /* @__PURE__ */ __name(() => {
        const isOpen = fab.hasClass("jhs-fab-open");
        if (isOpen) {
          closeMenu();
        } else {
          fab.addClass("jhs-fab-open").attr("aria-expanded", "true");
          menu.addClass("jhs-fab-menu-open").attr("aria-hidden", "false");
          backdrop.addClass("jhs-fab-backdrop-visible");
          if (window.isListPage) {
            const sortMethod = localStorage.getItem("jhs_sortMethod") || "default";
            const sortLabel = { default: "默认", rateCount: "评价人数", date: "时间" }[sortMethod];
            menu.find('[data-action="sort"]').text(`排序: ${sortLabel}`);
            this.getBean("ListPagePlugin")?.syncQuickFilterUi();
          }
          if (window.isDetailPage) void this.refreshDetailStatus().catch(((error) => clog.warn("移动端详情状态刷新失败", error)));
          const gen = ++this._fabGeneration;
          const self = this;
          const items = menu.find(".jhs-fab-menu-item");
          items.first().trigger("focus");
          items.each(function(i2) {
            const el = $(this);
            setTimeout(() => {
              if (gen === self._fabGeneration) el.addClass("jhs-fab-item-visible");
            }, 30 + i2 * 35);
          });
        }
      }, "toggleMenu");
      fab.on("click", toggleMenu);
      backdrop.on("click", (() => closeMenu(true)));
      menu.on("keydown", ".jhs-fab-menu-item", ((event) => {
        const items = menu.find(".jhs-fab-menu-item"), index = items.index(event.currentTarget);
        if ("Escape" === event.key) return event.preventDefault(), closeMenu(true);
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      }));
      filterMenu.on("keydown", ".jhs-mobile-filter-option", ((event) => {
        const items = filterMenu.find(".jhs-mobile-filter-option"), index = items.index(event.currentTarget);
        if ("Escape" === event.key) return event.preventDefault(), closeFilterMenu(true);
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus");
      })).on("click", ".jhs-mobile-filter-option", ((event) => {
        event.stopPropagation(), this.getBean("ListPagePlugin").setQuickFilter($(event.currentTarget).data("jhs-filter")), closeMenu(true);
      }));
      menu.on("click", ".jhs-fab-menu-item", (e2) => {
        const action = $(e2.currentTarget).data("action");
        if ("quickFilter" === action) {
          e2.stopPropagation(), menu.addClass("jhs-fab-filter-open"), filterTrigger.attr("aria-expanded", "true");
          const selected = filterMenu.find('[aria-checked="true"]');
          return void (selected.length ? selected.first() : filterMenu.find(".jhs-mobile-filter-option").first()).trigger("focus");
        }
        closeMenu(true);
        void this.handleAction(action).catch(((error) => clog.error(`移动端操作 ${action || "unknown"} 失败`, error)));
      });
    }
    async handleAction(action) {
      switch (action) {
        // 列表页操作
        case "check":
          await this.getBean("ListPageButtonPlugin")?.openWaitCheck?.();
          break;
        case "newVideo":
          this.getBean("NewVideoPlugin")?.openDialog();
          break;
        case "blacklist":
          this.getBean("BlacklistPlugin")?.openBlacklistDialog();
          break;
        case "sort": {
          const cur = localStorage.getItem("jhs_sortMethod") || "default";
          const next = cur === "default" ? "rateCount" : cur === "rateCount" ? "date" : "default";
          localStorage.setItem("jhs_sortMethod", next);
          const btnPlugin = this.getBean("ListPageButtonPlugin");
          await btnPlugin?.sortItems?.();
          const label = { default: "默认", rateCount: "评价人数", date: "时间" }[next];
          show.info(`排序: ${label}`);
          break;
        }
        // 详情页操作
        case "filter":
          $("#filterBtn").length && $("#filterBtn").click();
          break;
        case "fav":
          $("#favoriteBtn").length && $("#favoriteBtn").click();
          break;
        case "down":
          $("#hasDownBtn").length && $("#hasDownBtn").click();
          break;
        case "watch":
          $("#hasWatchBtn").length && $("#hasWatchBtn").click();
          break;
        case "magnetFilter":
          $("#enable-magnets-filter").length && $("#enable-magnets-filter").click();
          break;
        case "magnet":
          $("#magnetSearchBtn").length && $("#magnetSearchBtn").click();
          break;
        case "subtitle":
          $("#search-subtitle-btn").length && $("#search-subtitle-btn").click();
          break;
        // 通用
        case "setting":
          await this.getBean("SettingPlugin")?.openQuickSetting();
          break;
      }
    }
  };
  __name(_MobileBottomBarPlugin, "MobileBottomBarPlugin");
  var MobileBottomBarPlugin = _MobileBottomBarPlugin;
  function getDetailResourceAdapter() {
    if (!window.isDetailPage) return null;
    if (r) {
      const hostRoot = $(".video-detail").first(), controller = hostRoot.find('[data-controller="magnet-sort"]').first(), resourceRoot = controller.find("#magnets-content").first();
      if (!hostRoot.length || !controller.length || !resourceRoot.length) return null;
      const resourceRegion = controller.closest(hostRoot.children()).first();
      return {
        site: "javdb",
        hostRoot,
        controller,
        observeRoot: controller,
        resourceRoot,
        resourceRegion,
        rows: /* @__PURE__ */ __name(() => resourceRoot.children(".item").toArray(), "rows"),
        sortSelect: controller.find('select[data-action*="magnet-sort#sort"]').first(),
        getResource(row) {
          const item = $(row);
          return item.find('.copy-to-clipboard[data-clipboard-text^="magnet:"]').first().attr("data-clipboard-text") || item.find('.magnet-name a[href^="magnet:"]').first().attr("href") || "";
        },
        getActionTarget: /* @__PURE__ */ __name((row) => $(row).children(".buttons").first(), "getActionTarget")
      };
    }
    if (l) {
      const hostRoot = $(".container").filter(((_2, element) => $(element).find("#magnet-table").length > 0)).first(), resourceRoot = hostRoot.find("#magnet-table").first();
      if (!hostRoot.length || !resourceRoot.length) return null;
      const resourceRegion = resourceRoot.closest(hostRoot.children()).first(), observeRoot = resourceRoot.parent();
      return {
        site: "javbus",
        hostRoot,
        controller: resourceRoot,
        observeRoot,
        resourceRoot,
        resourceRegion,
        rows: /* @__PURE__ */ __name(() => resourceRoot.find("tr").filter(((_2, row) => $(row).find('td a[href^="magnet:"],td a[href^="ed2k:"]').length > 0)).toArray(), "rows"),
        sortSelect: $(),
        getResource: /* @__PURE__ */ __name((row) => $(row).find('td a[href^="magnet:"],td a[href^="ed2k:"]').first().attr("href") || "", "getResource"),
        getActionTarget(row) {
          const item = $(row), stableActions = item.find(".buttons,.actions,.btn-group").filter(((_2, element) => $(element).closest("td").length > 0)).last();
          if (stableActions.length) return stableActions;
          const resourceCell = item.find('td:has(a[href^="magnet:"]),td:has(a[href^="ed2k:"])').first();
          let actions = resourceCell.children(".jhs-offline-actions").first();
          return actions.length || (actions = $('<span class="jhs-offline-actions"></span>').appendTo(resourceCell)), actions;
        }
      };
    }
    return null;
  }
  __name(getDetailResourceAdapter, "getDetailResourceAdapter");
  var _DetailWorkspacePlugin = class _DetailWorkspacePlugin extends BasePlugin {
    constructor() {
      super(), this.hostRoot = null, this.resourceObserver = null, this.scheduledResourceFrame = null;
    }
    getName() {
      return "DetailWorkspacePlugin";
    }
    async initCss() {
      return `<style>
            .jhs-detail-workspace { display:grid; width:min(100%,1440px); min-width:0; margin:0 auto; padding:var(--jhs-space-6); gap:var(--jhs-space-5); box-sizing:border-box; background:var(--jhs-bg); color:var(--jhs-text); }
            .jhs-detail-workspace__section { display:none; min-width:0; overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
            .jhs-detail-workspace__section.has-content { display:block; }
            .jhs-detail-workspace__header { padding:var(--jhs-space-4) var(--jhs-space-5); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); }
            .jhs-detail-workspace__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); }
            .jhs-detail-workspace__content { min-width:0; padding:var(--jhs-space-5); }
            .jhs-detail-workspace__content:empty { display:none; }
            .jhs-detail-workspace .jhs-detail-btn-row { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); margin-top:var(--jhs-space-4); }
            .jhs-detail-workspace [data-jhs-section="gallery"] .jhs-detail-workspace__content { overflow-x:auto; }
            .jhs-detail-host-workspace { color:var(--jhs-text); }
            .jhs-detail-owned-slot { min-width:0; padding:var(--jhs-space-5) 0; border-top:1px solid var(--jhs-border); }
            .jhs-detail-owned-slot:empty { display:none; }
            .jhs-detail-owned-slot--summary-actions { padding:var(--jhs-space-3) 0 var(--jhs-space-5); border-top:0; }
            .jhs-detail-post-resource { min-width:0; }
            .jhs-detail-host-workspace .jhs-detail-btn-row { margin:0!important; }
            .jhs-detail-host-action { display:inline-flex!important; min-height:var(--jhs-control-height)!important; align-items:center!important; justify-content:center!important; padding:0 var(--jhs-space-3)!important; border:1px solid var(--jhs-border)!important; border-radius:var(--jhs-radius-sm)!important; background:var(--jhs-surface)!important; color:var(--jhs-text)!important; box-shadow:none!important; font:inherit!important; font-size:var(--jhs-font-size-sm)!important; font-weight:600!important; line-height:1!important; text-decoration:none!important; }
            .jhs-detail-host-action:hover { border-color:var(--jhs-accent)!important; background:var(--jhs-surface-2)!important; color:var(--jhs-accent)!important; }
            .jhs-offline-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-2); margin-left:var(--jhs-space-2); vertical-align:middle; }
            @media (max-width:767px) { .jhs-detail-owned-slot { padding:var(--jhs-space-4) 0; } }
        </style>`;
    }
    async handle() {
      if (!window.isDetailPage) return;
      utils.loopDetector((() => !!this.getHostAdapter()), (() => this.ensureWorkspace()), 40, 2500, true);
    }
    getHostAdapter() {
      if (r) {
        const root = $(".video-detail").first();
        return root.length ? { site: "javdb", root } : null;
      }
      if (l) {
        const root = $(".container").filter(((_2, element) => $(element).find("#magnet-table,.screencap,.info").length > 0)).first();
        return root.length ? { site: "javbus", root } : null;
      }
      return null;
    }
    ensureWorkspace() {
      const adapter = this.getHostAdapter();
      if (!adapter) return $();
      const root = adapter.root;
      if (!root.attr("data-jhs-workspace-ready")) {
        root.attr({ "data-jhs-workspace-ready": "true", "data-jhs-workspace-site": adapter.site }).addClass("jhs-detail-host-workspace jhs-ui");
        if ("javdb" === adapter.site) {
          root.children("h2,.video-meta-panel").attr("data-jhs-host-region", "summary");
          root.children(".columns").filter(((_2, element) => $(element).find(".tile-images,.preview-images").length > 0)).attr("data-jhs-host-region", "gallery");
          root.children(".columns").filter(((_2, element) => $(element).find("#magnets-content").length > 0)).attr("data-jhs-host-region", "resources");
          this.normalizeHostActions(root.find(".video-meta-panel").first());
        } else {
          root.children("h3,.row.movie").attr("data-jhs-host-region", "summary");
          root.children().filter(((_2, element) => $(element).is("#mag-submit-show,#mag-submit") || $(element).find("#magnet-table").length > 0)).attr("data-jhs-host-region", "resources");
          root.children().filter(((_2, element) => $(element).is("#sample-waterfall") || $(element).find("#sample-waterfall").length > 0)).attr("data-jhs-host-region", "gallery");
          this.normalizeHostActions(root.find(".info").first());
        }
        this.ensureOwnedSlots(root), this.adoptExistingOwnedPanels(root);
      }
      this.hostRoot = root, this.ensureOwnedSlots(root), this.placeOwnedSlots(), this.bindResourceLifecycle();
      return root;
    }
    getSlot(name) {
      return this.ensureWorkspace().find(`[data-jhs-slot="${name}"]`).first();
    }
    ensureOwnedSlots(root = this.hostRoot) {
      if (!root?.length) return;
      root.children('[data-jhs-slot="summary-actions"]').length || root.append('<div class="jhs-detail-owned-slot jhs-detail-owned-slot--summary-actions" data-jhs-slot="summary-actions"></div>');
      let group = root.children('[data-jhs-slot-group="post-resource"]').first();
      group.length || (group = $('<div class="jhs-detail-post-resource" data-jhs-slot-group="post-resource"></div>').appendTo(root));
      group.children('[data-jhs-slot="reviews"]').length || group.append('<section class="jhs-detail-owned-slot jhs-detail-owned-slot--reviews" data-jhs-slot="reviews"></section>');
      group.children('[data-jhs-slot="related"]').length || group.append('<section class="jhs-detail-owned-slot jhs-detail-owned-slot--related" data-jhs-slot="related"></section>');
    }
    /** 只移动 JHS 自有插槽，将其固定在稳定宿主锚点旁。 */
    placeOwnedSlots() {
      const root = this.hostRoot, resource = getDetailResourceAdapter();
      if (!root?.length) return;
      this.ensureOwnedSlots(root);
      const summaryActions = root.children('[data-jhs-slot="summary-actions"]').first(), postResource = root.children('[data-jhs-slot-group="post-resource"]').first();
      const summaryRegion = "javdb" === root.attr("data-jhs-workspace-site") ? root.children(".video-meta-panel").first() : root.children(".row.movie").first();
      summaryRegion.length && summaryActions.insertAfter(summaryRegion);
      resource?.resourceRegion?.length && postResource.insertAfter(resource.resourceRegion);
    }
    adoptExistingOwnedPanels(root) {
      [[".jhs-detail-btn-row", "summary-actions"], [".jhs-related-panel", "related"], [".jhs-review-panel", "reviews"]].forEach((([selector, slot]) => {
        const target = root.find(`[data-jhs-slot="${slot}"]`).first();
        root.find(selector).filter(((_2, element) => !$(element).closest("[data-jhs-slot]").length)).each(((_2, element) => target.append(element)));
      }));
    }
    normalizeHostActions(info) {
      const labels = /* @__PURE__ */ new Set(["想看", "看过", "看過", "存入清单", "存入清單", "下载", "下載", "订正", "訂正"]);
      info.find("a, button").filter((function() {
        return !$(this).is(".jhs-btn, [id^='jhs-']") && labels.has($(this).text().replace(/\s+/g, " ").trim());
      })).addClass("jhs-detail-host-action");
    }
    isJhsOnlyMutation(record) {
      if ($(record.target).closest(".jhs-offline-actions,.jhs-select-control,.jhs-magnet-score").length) return true;
      const nodes = [...record.addedNodes, ...record.removedNodes].filter(((node) => node.nodeType === Node.ELEMENT_NODE));
      return nodes.length > 0 && nodes.every(((node) => node.matches?.(".jhs-offline-btn,.jhs-offline-actions,.jhs-magnet-score,.jhs-select-control") || node.closest?.(".jhs-offline-actions,.jhs-select-control")));
    }
    bindResourceLifecycle() {
      const adapter = getDetailResourceAdapter();
      if (!adapter) return;
      if (this.resourceObserver && this.resourceObserver.root === adapter.observeRoot[0]) return void this.scheduleResourceUpdate();
      this.resourceObserver?.disconnect?.();
      const observer = new MutationObserver(((records) => {
        records.every(((record) => this.isJhsOnlyMutation(record))) || this.scheduleResourceUpdate();
      }));
      observer.root = adapter.observeRoot[0], observer.observe(adapter.observeRoot[0], { childList: true, subtree: true }), this.resourceObserver = observer, adapter.sortSelect.length && adapter.sortSelect.addClass("jhs-select-source") && JhsSelect.enhance(adapter.controller), this.scheduleResourceUpdate();
    }
    scheduleResourceUpdate() {
      if (this.scheduledResourceFrame) return;
      const schedule = window.requestAnimationFrame || ((callback) => setTimeout(callback));
      this.scheduledResourceFrame = schedule((() => {
        this.scheduledResourceFrame = null;
        const adapter = getDetailResourceAdapter();
        if (!adapter) return;
        this.placeOwnedSlots();
        adapter.sortSelect.length && (adapter.sortSelect.addClass("jhs-select-source"), JhsSelect.enhance(adapter.controller), JhsSelect.refresh(adapter.sortSelect));
        void jhsEventBus.emit("magnet-items-updated", { site: adapter.site, resourceRoot: adapter.resourceRoot[0], rows: adapter.rows() }, { broadcast: false });
      }));
    }
  };
  __name(_DetailWorkspacePlugin, "DetailWorkspacePlugin");
  var DetailWorkspacePlugin = _DetailWorkspacePlugin;
  function organizeJhsOwnedDetailWorkspace(container) {
    if (!container?.length || container.attr("data-jhs-organized")) return;
    const children = container.children().detach();
    container.attr("data-jhs-organized", "true").addClass("jhs-detail-workspace jhs-ui").attr("data-site", "fc2").empty();
    const section = /* @__PURE__ */ __name((name, title, hasContent = false) => $(`<section class="jhs-detail-workspace__section ${hasContent ? "has-content" : ""}" data-jhs-section="${name}"><header class="jhs-detail-workspace__header"><h2>${title}</h2></header><div class="jhs-detail-workspace__content" data-jhs-slot="${name}"></div></section>`), "section");
    const summary = section("summary", "影片概览", true), gallery = section("gallery", "预览与剧照"), resources = section("resources", "资源", true), reviews = section("reviews", "评论", true), related = section("related", "相关清单", true);
    container.append(summary, gallery, resources, reviews, related);
    const summaryContent = summary.find('[data-jhs-slot="summary"]'), resourceContent = resources.find('[data-jhs-slot="resources"]'), info = children.filter(".movie-info-container"), actionSelector = "#filterBtn, #favoriteBtn, #hasDownBtn, #hasWatchBtn, #enable-magnets-filter, #search-subtitle-btn, #xunLeiSubtitleBtn, #magnetSearchBtn", actionButtons = children.find(actionSelector).addBack(actionSelector);
    summaryContent.append(info), info.find(".origin-title, .current-title, .movie-title, h3").first().addClass("jhs-detail-title");
    if (actionButtons.length) {
      const toolbar = $('<div class="jhs-detail-btn-row" role="toolbar" aria-label="影片状态操作"></div>');
      actionButtons.each((function() {
        toolbar.append($(this).removeAttr("style").addClass("jhs-btn"));
      })), summaryContent.append(toolbar);
    }
    resourceContent.append(children.filter(".movie-panel-info, .video-panel")), resourceContent.find("#magnets-content").length || resourceContent.append(children.filter("#magnets-content"));
    related.find('[data-jhs-slot="related"]').append(children.filter("#related-content")), reviews.find('[data-jhs-slot="reviews"]').append(children.filter("#reviews-content")), container.append(children.filter("#data-actress").removeAttr("style").addClass("jhs-is-hidden"));
    const movieGallery = info.find(".movie-gallery").first();
    movieGallery.length && (gallery.find('[data-jhs-slot="gallery"]').append(movieGallery), gallery.addClass("has-content"));
  }
  __name(organizeJhsOwnedDetailWorkspace, "organizeJhsOwnedDetailWorkspace");
  var _CompatibilityEnhancementsPlugin = class _CompatibilityEnhancementsPlugin extends BasePlugin {
    getName() {
      return "CompatibilityEnhancementsPlugin";
    }
    async initCss() {
      if (!siteContext.isJavDB) return "";
      return `<style>
            .sda-content { display:none!important; }
        </style>`;
    }
    async handle() {
      await this.decorateActresses();
      $(document).off("actress-state-changed.jhsActress").on("actress-state-changed.jhsActress", (async () => {
        $(".jhs-actress-state-container").remove();
        await this.decorateActresses();
      }));
      if (isDetailPage) await this.addRemoveRecord();
      this.linkCommentImages();
    }
    async addRemoveRecord() {
      const carNum = this.getPageInfo().carNum;
      if (!carNum) return;
      if (!(await storageManager.getCarList()).some(((item) => item.carNum === carNum))) return;
      const button = $('<button type="button" class="jhs-btn jhs-btn--danger jhs-remove-car">移除记录</button>');
      $(".jhs-detail-btn-row,.movie-info-container,.container .info").first().append(button);
      button.on("click", ((event) => utils.q(event, `确定移除 ${carNum} 的鉴定记录？`, (async () => {
        await stateService.remove(carNum);
        button.remove();
        this.getBean("ListPagePlugin")?.showCarNumBox?.(carNum);
        show.ok("鉴定记录已移除");
      }))));
    }
    async decorateActresses() {
      const favorites = new Set((await storageManager.getFavoriteActressList()).map(((item) => String(item.starId))));
      const blacklist = new Set((await storageManager.getBlacklist()).map(((item) => String(item.starId || item.id))));
      this.decorateCurrentActressProfile(favorites, blacklist);
      this.decorateActressCards(favorites, blacklist);
    }
    decorateCurrentActressProfile(favorites, blacklist) {
      const match = window.location.pathname.match(/^\/(?:actors|star)\/([^/?#]+)\/?$/);
      if (!match) return;
      const host = $(".actor-section-name,.star-name,h1.title").first();
      if (!host.length) return;
      this.renderActressState(host, decodeURIComponent(match[1]), favorites, blacklist, "jhs-actress-profile-state");
    }
    decorateActressCards(favorites, blacklist) {
      $(".actor-box a[href], .actress-card a[href], [data-actress-card] a[href]").each(((index, element) => {
        const identity = getActressIdentityFromLink(element);
        if (!identity) return;
        const card = $(element).closest(".actor-box,.actress-card,[data-actress-card]");
        this.renderActressState(card, identity.starId, favorites, blacklist, "jhs-actress-card-state");
      }));
    }
    renderActressState(host, starId, favorites, blacklist, className) {
      if (host.children(".jhs-actress-state-container").length) return;
      const container = $(`<span class="jhs-actress-state-container ${className}"></span>`);
      favorites.has(starId) && container.append('<span class="jhs-badge jhs-badge--fav">已关注</span>');
      blacklist.has(starId) && container.append('<span class="jhs-badge jhs-badge--danger">已拉黑</span>');
      container.children().length && host.append(container);
    }
    linkCommentImages() {
      const images = $(".preview-images img,#sample-waterfall img,.movie-gallery img");
      if (!images.length) return;
      $(".review-content").each(((index, element) => this.linkCommentImageTextNodes(element, images.length)));
      $(document).off("click.jhsCommentImage", ".jhs-comment-image-link").on("click.jhsCommentImage", ".jhs-comment-image-link", ((event) => {
        event.preventDefault();
        const image = images.eq(Number($(event.currentTarget).data("image-index")));
        image.length && showImageViewer(image[0]);
      }));
    }
    linkCommentImageTextNodes(element, imageCount) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = [];
      while (walker.nextNode()) if (!$(walker.currentNode.parentElement).closest("a,button,code,pre,textarea,.jhs-comment-image-link").length && /(?:图|圖片|图片)\s*[一二三四五六七八九十\d]+/i.test(walker.currentNode.nodeValue || "")) nodes.push(walker.currentNode);
      nodes.forEach(((textNode) => {
        const text = textNode.nodeValue || "", pattern = /(?:图|圖片|图片)\s*([一二三四五六七八九十\d]+)/gi, fragment = document.createDocumentFragment();
        let cursor = 0, match;
        while (match = pattern.exec(text)) {
          match.index > cursor && fragment.append(document.createTextNode(text.slice(cursor, match.index)));
          const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }, index = (chinese[match[1]] || Number(match[1])) - 1;
          if (index >= 0 && index < imageCount) {
            const link = document.createElement("a");
            link.href = "#";
            link.className = "jhs-comment-image-link";
            link.dataset.imageIndex = String(index);
            link.textContent = match[0];
            fragment.append(link);
          } else fragment.append(document.createTextNode(match[0]));
          cursor = match.index + match[0].length;
        }
        cursor < text.length && fragment.append(document.createTextNode(text.slice(cursor)));
        textNode.replaceWith(fragment);
      }));
    }
  };
  __name(_CompatibilityEnhancementsPlugin, "CompatibilityEnhancementsPlugin");
  var CompatibilityEnhancementsPlugin = _CompatibilityEnhancementsPlugin;
  function getActressIdentityFromLink(element) {
    const link = $(element);
    if (link.closest('.toolbar,.tabs,.buttons,.pagination,.filter,.filters,nav,header,[role="tablist"]').length) return null;
    const url = new URL(link.attr("href"), window.location.href);
    if (url.search || url.hash) return null;
    const match = url.pathname.match(/^\/(?:actors|star)\/([^/]+)\/?$/);
    return match ? { starId: decodeURIComponent(match[1]), url: url.href } : null;
  }
  __name(getActressIdentityFromLink, "getActressIdentityFromLink");
  var DEFAULT_JAVDB_PLUGINS = [
    ListPagePlugin,
    AutoPagePlugin,
    Fc2Plugin,
    FoldCategoryPlugin,
    ListPageButtonPlugin,
    HistoryPlugin,
    SettingPlugin,
    NavBarPlugin,
    HitShowPlugin,
    Top250Plugin,
    SearchByImagePlugin,
    CoverButtonPlugin,
    Fc2By123AvPlugin,
    DetailPagePlugin,
    DetailWorkspacePlugin,
    ReviewPlugin,
    RelatedPlugin,
    DetailPageButtonPlugin,
    HighlightMagnetPlugin,
    PreviewVideoPlugin,
    FilterTitleKeywordPlugin,
    ActressInfoPlugin,
    OtherSitePlugin,
    TranslatePlugin,
    WantAndWatchedVideosPlugin,
    MagnetHubPlugin,
    ScreenShotPlugin,
    BlacklistPlugin,
    FavoriteActressesPlugin,
    NewVideoPlugin,
    TaskPlugin,
    StatsPlugin,
    MobileBottomBarPlugin,
    OneOneFiveMatchPlugin,
    UnifiedOfflinePlugin,
    CompatibilityEnhancementsPlugin
  ];
  var DEFAULT_JAVBUS_PLUGINS = [
    ListPagePlugin,
    ListPageButtonPlugin,
    SettingPlugin,
    HistoryPlugin,
    AutoPagePlugin,
    SearchByImagePlugin,
    BusNavBarPlugin,
    CoverButtonPlugin,
    BusImgPlugin,
    BusDetailPagePlugin,
    DetailWorkspacePlugin,
    DetailPageButtonPlugin,
    ReviewPlugin,
    FilterTitleKeywordPlugin,
    HighlightMagnetPlugin,
    BusPreviewVideoPlugin,
    MagnetHubPlugin,
    ScreenShotPlugin,
    OtherSitePlugin,
    TranslatePlugin,
    BlacklistPlugin,
    TaskPlugin,
    StatsPlugin,
    MobileBottomBarPlugin,
    OneOneFiveMatchPlugin,
    UnifiedOfflinePlugin,
    CompatibilityEnhancementsPlugin
  ];
  var DEFAULT_SHARED_PLUGIN_RULES = [
    {
      shouldRegister: /* @__PURE__ */ __name((context) => context.isJavDB || context.isJavBus || context.is123Pan, "shouldRegister"),
      plugins: [OneTwoThreeOfflinePlugin]
    },
    {
      shouldRegister: /* @__PURE__ */ __name((context) => context.isJavTrailers, "shouldRegister"),
      plugins: [JavTrailersPlugin]
    },
    {
      shouldRegister: /* @__PURE__ */ __name((context) => context.isSubtitleCat, "shouldRegister"),
      plugins: [SubTitleCatPlugin]
    }
  ];
  function registerPluginGroup(pluginManager2, plugins) {
    plugins.forEach(((pluginClass) => pluginManager2.register(pluginClass)));
  }
  __name(registerPluginGroup, "registerPluginGroup");
  function registerSitePlugins(pluginManager2, locationLike = window.location) {
    const context = detectSite(locationLike);
    DEFAULT_SHARED_PLUGIN_RULES.forEach(((rule) => {
      rule.shouldRegister(context) && registerPluginGroup(pluginManager2, rule.plugins);
    }));
    context.isJavDB && registerPluginGroup(pluginManager2, DEFAULT_JAVDB_PLUGINS);
    context.isJavBus && registerPluginGroup(pluginManager2, DEFAULT_JAVBUS_PLUGINS);
  }
  __name(registerSitePlugins, "registerSitePlugins");
  var originalLayerClose = layer.close;
  layer.close = function(e2) {
    const t2 = originalLayerClose.call(this, e2);
    return (function(e3 = 10) {
      setTimeout((() => {
        const e4 = document.querySelectorAll(".layui-layer-shade").length;
        document.documentElement.style.overflow = e4 > 0 ? "hidden" : "";
      }), e3);
    })(), t2;
  };
  var originalLayerOpen = layer.open;
  layer.open = function(e2) {
    const t2 = (e2 = e2 || {}).success;
    return e2.success = function(e3, n2) {
      "function" == typeof t2 && t2.call(this, e3, n2), utils.setupEscClose(n2);
    }, originalLayerOpen.call(this, e2);
  }, utils.importResource("https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css"), utils.importResource("https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css"), utils.importResource("https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css"), utils.importResource("https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css");
  var pluginManager = (function() {
    const manager = new PluginManager();
    unsafeWindow.pluginManager = manager;
    registerSitePlugins(manager);
    return manager;
  })();
  (async function() {
    window.isDetailPage = (function() {
      let e3 = window.location.href;
      return r ? e3.split("?")[0].includes("/v/") : !!l && $("#magnet-table").length > 0;
    })(), window.isListPage = r ? isListPage(window.location, $(".movie-list").length > 0) : !!l && $(".masonry > div .item").length > 0, window.isFc2Page = (function() {
      let e3 = window.location.href;
      return e3.includes("advanced_search?type=3") || e3.includes("advanced_search?type=100");
    })();
    const e2 = (async () => {
      await runDataMigrations(storageManager), await stateService.recoverPendingTransaction();
    })();
    await e2, await Promise.all([pluginManager.processCss(), applyTheme()]), r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie) && show.error("请切换到中文语言下才可正常使用本脚本", {
      duration: -1
    }), await pluginManager.processPlugins();
  })().catch(((e2) => {
    console.error("[JHS] bootstrap failed:", e2), show.error(e2?.message || "JHS 启动失败", { duration: -1 });
  }));
})();
