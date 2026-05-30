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
        await this.doFilter(), this.createQuickFilter(), this.applyVisibility(), this.bindClick().then(),
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
            if (e === "all") { n.includes(i) ? t.hide() : t.show(); return; }
            if (i === e) { t.show(); return; }
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
            n.attr("data-hide") === "yes" && (n.show(), n.removeAttr("data-hide"));
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
