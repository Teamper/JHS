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
