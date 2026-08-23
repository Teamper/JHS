// ==UserScript==
// @name         JHS
// @namespace    https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya
// @version      6.4.1
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

const originalLayerClose = layer.close;

layer.close = function(e) {
    const t = originalLayerClose.call(this, e);
    return function(e = 10) {
        setTimeout((() => {
            const e = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = e > 0 ? "hidden" : "";
        }), e);
    }(), t;
};

const originalLayerOpen = layer.open;

layer.open = function(e) {
    const t = (e = e || {}).success;
    return e.success = function(e, n) {
        "function" == typeof t && t.call(this, e, n), utils.setupEscClose(n);
    }, originalLayerOpen.call(this, e);
}, utils.importResource("https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css"),
utils.importResource("https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css"),
utils.importResource("https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css"),
utils.importResource("https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css");

/** 插件注册中心: 按站点注册所有插件, 暴露到 unsafeWindow.pluginManager */
const pluginManager = function() {
    const manager = new PluginManager;
    unsafeWindow.pluginManager = manager;
    registerSitePlugins(manager);
    return manager;
}();

(async function() {
    window.isDetailPage = function() {
        let e = window.location.href;
        return r ? e.split("?")[0].includes("/v/") : !!l && $("#magnet-table").length > 0;
    }(), window.isListPage = r ? isListPage(window.location, $(".movie-list").length > 0) : !!l && $(".masonry > div .item").length > 0,
    window.isFc2Page = function() {
        let e = window.location.href;
        return e.includes("advanced_search?type=3") || e.includes("advanced_search?type=100");
    }();
    const e = (async () => {
        await runDataMigrations(storageManager), await stateService.recoverPendingTransaction();
    })();
    await e, await Promise.all([ pluginManager.processCss(), applyTheme() ]),
    r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie) && show.error("请切换到中文语言下才可正常使用本脚本", {
        duration: -1
    }), await pluginManager.processPlugins();
})().catch((e => {
    console.error("[JHS] bootstrap failed:", e), show.error(e?.message || "JHS 启动失败", { duration: -1 });
}));
