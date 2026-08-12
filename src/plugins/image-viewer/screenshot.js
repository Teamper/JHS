class ScreenShotPlugin extends BasePlugin {
    getName() {
        return "ScreenShotPlugin";
    }
    async initCss() {
        return `<style>.jhs-screenshot-message{margin-top:50px;color:var(--jhs-text-muted);cursor:auto}.jhs-screenshot-message--bus{margin-top:30px}</style>`;
    }
    async handle() {
        this.loadScreenShot().then();
    }
    async loadScreenShot() {
        if (!isDetailPage) return;
        if ("yes" !== await storageManager.getSetting("enableLoadScreenShot", "yes")) return;
        let e = this.getPageInfo().carNum;
        r && $(".preview-images .tile-item").first().before(' <a class="tile-item screen-container jhs-layout-cd9d5db1"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> '),
        l && $("#sample-waterfall .sample-box:first").after(' <a class="sample-box screen-container jhs-layout-b5c4e4f7"><div class="jhs-layout-3536a853">正在加载缩略图</div></a> ');
        try {
            const t = await this.getScreenshot(e);
            this.addImg("缩略图", t), clog.log("加载缩略图:", t);
        } catch (t) {
            this.showErrorFallback(e, t);
        }
    }
    async getScreenshot(e) {
        e = normalizeCarNum(e);
        if (!e) throw clog.warn("跳过缩略图解析：番号不可用"), new Error("缩略图番号不可用");
        localStorage.removeItem("jhs_screenShot");
        let n;
        try {
            n = await storageManager.cachedRequest(`screenshot:${e}`, 6048e5, (() => this.getJavStoreScreenShot(e)));
        } catch (i) {
            throw clog.error("获取缩略图资源失败:", n, i), i;
        }
        if (!n) return this.showErrorFallback(e, null), null;
        const a = n.indexOf("https://");
        return -1 !== a && (n = n.substring(a)), clog.log("缩略图获取成功:", n), n;
    }
    async getJavStoreScreenShot(e) {
        const t = `https://javstore.net/search?q=${encodeURIComponent(e)}`;
        clog.debug("JavStore 搜索地址:", t);
        let n = await gmHttp.get(t, {}, {}, !1, {ignoreNotFound: !0});
        if (!n) return clog.debug("JavStore 搜索页未获取:", t), null;
        const a = utils.htmlTo$dom(n);
        const i = parseJavStoreSearch(a, e);
        if (!i.length) return clog.error("JavStore, 查询番号失败:", t), null;
        for (const e of i) {
            const t = e;
            clog.debug("JavStore 候选详情:", t);
            const n = await gmHttp.get(t, {}, {}, !1, {ignoreNotFound: !0});
            if (!n) {
                clog.debug("JavStore 详情页未获取:", t);
                continue;
            }
            const a = parseJavStorePreview(utils.htmlTo$dom(n), t);
            if (!a) {
                clog.debug("JavStore 详情页没有 CLICK HERE!:", t);
                continue;
            }
            return clog.debug("JavStore 预览图:", a), a;
        }
        return clog.error("JavStore, 所有候选均无有效预览图:", t), null;
    }
    addImg(e, t) {
        t && (r && $(".screen-container").html(`<img src="${t}" alt="${e}" loading="lazy" class="jhs-layout-cad980f4">`),
        l && $(".screen-container").html(`<div class="photo-frame"><img src="${t}" title="${e}" alt="${e}" class="jhs-layout-d4a575e8"></div>`),
        $(".screen-container").on("click", (e => {
            e.stopPropagation(), e.preventDefault(), showImageViewer(e.currentTarget);
        })));
    }
    showErrorFallback(e, t) {
        var n;
        console.error("获取缩略图失败:", null == (n = null == t ? void 0 : t.message) ? void 0 : n.substring(0, 100));
        const a = `jhs-screenshot-message${l ? " jhs-screenshot-message--bus" : ""}`;
        if (!(e = normalizeCarNum(e))) return void $(".screen-container").empty().append($("<div></div>").addClass(a).text("无法获取番号，缩略图未加载"));
        const searchUrl = `https://javstore.net/search?q=${encodeURIComponent(e)}`;
        $(".screen-container").html(`<div class="${a}">获取缩略图失败</div><br/><a href='#' class='retry-link'>点击重试</a> 或 <a class="check-link" href='${searchUrl}' target='_blank'>前往确认</a>`).off("click", ".retry-link").off("click", ".check-link").on("click", ".retry-link", (async t => {
            t.stopPropagation(), t.preventDefault(), $(".screen-container").html(`<div class="${a}">正在重新加载...</div>`);
            try {
                const t = await this.getScreenshot(e);
                this.addImg("缩略图", t);
            } catch (n) {
                this.showErrorFallback(e, n);
            }
        })).on("click", ".check-link", (async t => {
            t.stopPropagation(), t.preventDefault(), window.open(searchUrl, "_blank");
        }));
    }
}
