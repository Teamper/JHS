// ==UserScript==
// @name         JHS-YA
// @namespace    https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya
// @version      4.5.7
// @author       yaoser
// @description  Jav-鉴黄师个人维护版：收藏、屏蔽、标记已下载、演员黑名单、收藏演员同步、新作品检测、热播/Top250/Fc2ppv/评论增强、相关清单、WebDAV数据备份、以图识图、字幕搜索；支持 JavDB / JavBus。
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=javdb.com
// @homepageURL  https://github.com/Yaoser-Archive/JHS
// @supportURL   https://github.com/Yaoser-Archive/JHS/issues
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
// @downloadURL https://github.com/Yaoser-Archive/JHS/releases/latest/download/JHS.user.js
// @updateURL https://raw.githubusercontent.com/Yaoser-Archive/JHS/main/JHS.user.js
// ==/UserScript==

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
