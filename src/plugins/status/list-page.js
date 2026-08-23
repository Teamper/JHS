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
        color: "var(--jhs-status-filter)",
        on: "var(--jhs-status-filter-on)",
        reasonType: "单番号屏蔽",
        isCounted: !0,
        countKey: "currentPageFilterCount"
    },
    IS_FAVORITE: {
        text: b,
        color: "var(--jhs-status-fav)",
        on: "var(--jhs-status-fav-on)",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageFavoriteCount"
    },
    IS_HAS_DOWN: {
        text: y,
        color: "var(--jhs-status-down)",
        on: "var(--jhs-status-down-on)",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageHasDownCount"
    },
    IS_HAS_WATCH: {
        text: k,
        color: "var(--jhs-status-watch)",
        on: "var(--jhs-status-watch-on)",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageHasWatchCount"
    },
    IS_KEYWORD_FILTER: {
        text: "关键词屏蔽",
        color: "var(--jhs-status-filter)",
        on: "var(--jhs-status-filter-on)",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageKeywordFilterCount"
    },
    IS_ACTOR_FILTER: {
        text: "男演员屏蔽",
        color: "var(--jhs-status-filter)",
        on: "var(--jhs-status-filter-on)",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageActorFilterCount"
    },
    IS_ACTRESS_FILTER: {
        text: "女演员屏蔽",
        color: "var(--jhs-status-filter)",
        on: "var(--jhs-status-filter-on)",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageActorFilterCount"
    },
    IS_WAIT_CHECK: {
        text: "",
        color: "",
        on: "",
        reasonType: "",
        isCounted: !0,
        countKey: "currentPageWaitCheckCount"
    }
};

const QUICK_FILTER_LABELS = Object.freeze({
    all: "全部", waitCheck: "待鉴定", favorite: "收藏", hasDown: "下载", hasWatch: "已看",
    blockedItems: "屏蔽项", favoriteUndownloaded: "收藏未下载", favoriteUnwatched: "收藏未观看",
    downloadedUnwatched: "下载未观看", recent7d: "最近 7 天"
}), PRIMARY_QUICK_FILTERS = Object.freeze([ "all", "waitCheck", "favorite", "hasDown", "hasWatch" ]),
SECONDARY_QUICK_FILTERS = Object.freeze([ "blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d" ]),
VALID_QUICK_FILTERS = new Set([ ...PRIMARY_QUICK_FILTERS, ...SECONDARY_QUICK_FILTERS ]);

/** 将旧筛选键收敛为当前唯一业务键。 */
function normalizeQuickFilterKey(value) {
    if ("filter" === value) return "blockedItems";
    return VALID_QUICK_FILTERS.has(value) ? value : "waitCheck";
}

/** 判断列表卡片是否因状态或规则被硬屏蔽。 */
function isHardHidden(flags, visibilityReasons = {}) {
    return Boolean(flags.blocked || visibilityReasons.keyword || visibilityReasons.actorBlacklist || visibilityReasons.actressBlacklist);
}

function matchesQuickFilter(filter, flags, { visibilityReasons = {}, recent = !1 } = {}) {
    const normalizedFilter = normalizeQuickFilterKey(filter), hardHidden = isHardHidden(flags, visibilityReasons);
    if ("blockedItems" === normalizedFilter) return hardHidden;
    if (hardHidden) return !1;
    if ("all" === normalizedFilter) return !0;
    if ("waitCheck" === normalizedFilter) return !hasAnyState(flags);
    if ("favorite" === normalizedFilter) return !!flags.favorite;
    if ("hasDown" === normalizedFilter) return !!flags.downloaded;
    if ("hasWatch" === normalizedFilter) return !!flags.watched;
    if ("favoriteUndownloaded" === normalizedFilter) return !!flags.favorite && !flags.downloaded;
    if ("favoriteUnwatched" === normalizedFilter) return !!flags.favorite && !flags.watched;
    if ("downloadedUnwatched" === normalizedFilter) return !!flags.downloaded && !flags.watched;
    return "recent7d" === normalizedFilter && recent;
}

function shouldHideInDefaultView(flags, settings) {
    if (settings.showAllItem === _) return !1;
    const activeVisibility = [ [ flags.favorite, settings.showFavoriteItem ?? _ ], [ flags.downloaded, settings.showHasDownItem ?? _ ], [ flags.watched, settings.showHasWatchItem ?? _ ] ].filter((entry => entry[0]));
    return activeVisibility.length > 0 && activeVisibility.every((entry => entry[1] !== _));
}

function shouldShowItem({ filter, flags, visibilityReasons, settingHidden, recent }) {
    const normalizedFilter = normalizeQuickFilterKey(filter);
    if (!matchesQuickFilter(normalizedFilter, flags, { visibilityReasons, recent })) return !1;
    return "all" !== normalizedFilter || !settingHidden;
}

class ListPagePlugin extends BasePlugin {
    async initCss() {
        return `<style>.jhs-status-tags{position:absolute;z-index:var(--jhs-z-content);top:5px;display:flex;flex-wrap:wrap;gap:4px;max-width:90%}.jhs-status-tags--right{right:0;justify-content:flex-end}.jhs-status-tags--left{left:0}.status-tag{padding:0 5px;border-radius:10px}.status-tag .tag{color:inherit!important}.jhs-jump-page-input{width:60px;margin-left:10px}.jhs-jump-page-btn{margin-left:5px}.jhs-quick-filter{display:flex;align-items:center;gap:var(--jhs-space-1);min-width:0}.jhs-quick-filter__more{position:relative}.jhs-quick-filter__menu{min-width:190px}.jhs-filter-menu__separator{height:1px;margin:var(--jhs-space-1) 0;background:var(--jhs-border)}</style>`;
    }
    constructor() {
        super(...arguments), i(this, "currentPageFilterCount", 0), i(this, "currentPageFavoriteCount", 0),
        i(this, "currentPageHasDownCount", 0), i(this, "currentPageHasWatchCount", 0), i(this, "currentPageKeywordFilterCount", 0),
        i(this, "currentPageActorFilterCount", 0), i(this, "currentPageWaitCheckCount", 0),
        i(this, "currentPageTotalCount", 0), i(this, "cache", null), i(this, "translationPending", new Map),
        i(this, "filterContext", null), i(this, "pendingItems", new Set), i(this, "processTimer", null),
        i(this, "hdImageObserver", null), i(this, "hdEagerRemaining", 12), i(this, "writeQueue", Promise.resolve()),
        i(this, "_debouncedTranslateWrite", null), i(this, "itemIndex", new Map), i(this, "recountFrame", null);
    }
    getName() {
        return "ListPagePlugin";
    }
    async handle() {
        if (!window.isListPage || isHitShowPage()) return;
        const refreshAll = async () => {
                this.filterContext = null, storageManager._invalidateCache(storageManager.car_list_key), await this.doFilter(), this.applyVisibility();
                const e = this.getBean("HistoryPlugin");
                e.tableObj && e.tableObj.setData();
        };
        jhsEventBus.on("legacy-refresh", refreshAll), jhsEventBus.on("blacklist-rules-changed", refreshAll), jhsEventBus.on("filter-rules-changed", refreshAll), jhsEventBus.on("settings-changed", refreshAll),
        jhsEventBus.on("car-state-changed", (async payload => {
            this.filterContext = null, storageManager._invalidateCache(storageManager.car_list_key);
            const items = this.getIndexedItems(payload.carNums || []);
            items.length && (await this.doFilterItems(items), this.applyVisibility(items));
            const history = this.getBean("HistoryPlugin");
            history.tableObj && history.tableObj.setData();
        })), this.cleanRepeatId(), this.replaceHdImg(), this.addJumpPageControl(), this.fixBusTitleBox(),
        await this.doFilter(), await this.createQuickFilter(), this.applyVisibility(), await this.bindClick(),
        this.rememberTagExpand(),
        $(this.getSelector().itemSelector).attr("data-jhs-processed", "true"), this.rebuildItemIndex(), await jhsEventBus.emit("list-items-added", { items: $(this.getSelector().itemSelector).toArray() }, { broadcast: !1 }),
        this.checkDom();
    }
    async createQuickFilter() {
        if ($("#jhs-quick-filter").length) return;
        const e = this.getSelector(), primaryHtml = PRIMARY_QUICK_FILTERS.map((filter => `<button type="button" role="tab" class="jhs-btn jhs-segmented__item" aria-selected="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
            secondaryHtml = SECONDARY_QUICK_FILTERS.map(((filter, index) => `${1 === index ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-filter-option" aria-checked="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
            t = `<div id="jhs-quick-filter" class="jhs-quick-filter">
                <div class="jhs-quick-filter__primary jhs-segmented" role="tablist" aria-label="状态筛选">${primaryHtml}</div>
                <div class="jhs-quick-filter__more">
                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-quick-filter__toggle" aria-haspopup="menu" aria-expanded="false"><span class="jhs-quick-filter__label">更多筛选</span> ▾</button>
                    <div class="jhs-popover jhs-commandbar__menu jhs-quick-filter__menu" role="menu" aria-label="更多筛选">${secondaryHtml}</div>
                </div>
            </div>`;
        r ? $(e.boxSelector).before(t) : l && $(".masonry").before(t);
        const root = $("#jhs-quick-filter"), toggle = root.find(".jhs-quick-filter__toggle"), menu = root.find(".jhs-quick-filter__menu"), closeMenu = (restoreFocus = !1) => {
            menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), restoreFocus && toggle.trigger("focus");
        };
        root.on("click", ".jhs-segmented__item", (event => this.setQuickFilter($(event.currentTarget).data("jhs-filter"))))
            .on("keydown", ".jhs-segmented__item", (event => {
                if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const tabs = root.find(".jhs-segmented__item"), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                tabs.eq(next).trigger("click").trigger("focus");
            })).on("click", ".jhs-filter-option", (event => {
                this.setQuickFilter($(event.currentTarget).data("jhs-filter")), closeMenu(!0);
            })).on("keydown", ".jhs-filter-option", (event => {
                const items = menu.find(".jhs-filter-option"), index = items.index(event.currentTarget);
                if ("Escape" === event.key) return event.preventDefault(), closeMenu(!0);
                if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                items.eq(next).trigger("focus");
            }));
        toggle.on("click", (event => {
            event.preventDefault(), event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && (menu.find('[aria-checked="true"]').first().length ? menu.find('[aria-checked="true"]').first() : menu.find(".jhs-filter-option").first()).trigger("focus");
        })), $(document).off("click.jhsQuickFilter").on("click.jhsQuickFilter", (event => {
            $(event.target).closest(root).length || closeMenu();
        }));
        this.setQuickFilter(await storageManager.getSetting("defaultQuickFilterTab", "waitCheck"));
    }
    applyVisibility(items = null) {
        const e = this.activeQuickFilter || "waitCheck", t = this.getSelector().itemSelector;
        (items ? $(items) : $(t)).each((function() {
            const t = $(this), flags = normalizeStateFlags(JSON.parse(t.attr("data-jhs-flags") || "{}")), visibilityReasons = JSON.parse(t.attr("data-jhs-visibility") || "{}"), settingHidden = "yes" === t.attr("data-jhs-setting-hide"), recent = "yes" === t.attr("data-jhs-recent");
            shouldShowItem({ filter: e, flags, visibilityReasons, settingHidden, recent }) ? t.show() : t.hide();
        }));
    }
    setQuickFilter(filter, { syncUi = !0 } = {}) {
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
        const e = $(".tag-expand");
        if (0 === e.length) return;
        const t = "jhs_tag_expand", n = "true" === localStorage.getItem(t), a = $(".actor-tags .content");
        n && a.hasClass("collapse") && e[0].click(), e.on("click", (function() {
            const e = !$(".actor-tags .content").hasClass("collapse");
            clog.debug("触发"), localStorage.setItem(t, e.toString());
        }));
    }
    checkDom() {
        if (!window.isListPage || isHitShowPage()) return;
        const e = this.getSelector(), t = document.querySelector(e.boxSelector);
        if (!t) return void clog.error("没有找到容器节点!");
        const a = new MutationObserver((records => {
            for (const record of records) {
                this.removeIndexedItems(record.removedNodes);
                for (const node of record.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                node.matches?.(e.itemSelector) && "true" !== node.dataset.jhsProcessed && this.pendingItems.add(node),
                node.querySelectorAll?.(e.itemSelector).forEach((item => {
                    "true" !== item.dataset.jhsProcessed && this.pendingItems.add(item);
                }));
                }
            }
            this.pendingItems.size && (this.processTimer && clearTimeout(this.processTimer), this.processTimer = setTimeout((() => {
                const items = [ ...this.pendingItems ].filter((item => item.isConnected && "true" !== item.dataset.jhsProcessed));
                this.pendingItems.clear(), this.processTimer = null, items.length && void this.processAddedItems(items).catch((error => clog.error("列表增量处理失败", error)));
            }), 100));
        }));
        a.observe(t, {
            childList: !0,
            subtree: !1
        });
    }
    async processAddedItems(items) {
        const selector = this.getSelector(), covers = items.flatMap((item => [ ...item.querySelectorAll(selector.coverImgSelector) ]));
        this.replaceHdImg(covers), this.addJumpPageControl(), this.fixBusTitleBox(items), await this.doFilterItems(items), this.applyVisibility(items),
        await this.getBean("ListPageButtonPlugin").sortItems(), await this.getBean("CoverButtonPlugin").addSvgBtn(items),
        items.forEach((item => item.dataset.jhsProcessed = "true")), this.indexItems(items), await jhsEventBus.emit("list-items-added", { items }, { broadcast: !1 }), this.getBean("AutoPagePlugin").checkLoad();
    }
    rebuildItemIndex() {
        this.itemIndex.clear(), this.indexItems($(this.getSelector().itemSelector).toArray());
    }
    indexItems(items) {
        items.forEach((item => {
            try {
                const key = normalizeCarNum(this.findCarNumAndHref($(item)).carNum);
                if (!key) return;
                const indexed = this.itemIndex.get(key) || new Set;
                indexed.add(item), this.itemIndex.set(key, indexed);
            } catch (error) {
                clog.debug("列表项索引跳过无效卡片", error);
            }
        }));
    }
    removeIndexedItems(nodes) {
        const removed = new Set;
        Array.from(nodes || []).forEach((node => {
            node.nodeType === Node.ELEMENT_NODE && (removed.add(node), node.querySelectorAll?.(this.getSelector().itemSelector).forEach((item => removed.add(item))));
        }));
        if (!removed.size) return;
        this.itemIndex.forEach(((items, key) => {
            items.forEach((item => { removed.has(item) && items.delete(item); })), items.size || this.itemIndex.delete(key);
        }));
    }
    getIndexedItems(carNums) {
        const result = new Set;
        carNums.map(normalizeCarNum).forEach((key => {
            const items = this.itemIndex.get(key);
            items?.forEach((item => item.isConnected ? result.add(item) : items.delete(item))), items && !items.size && this.itemIndex.delete(key);
        }));
        return [ ...result ];
    }
    fixBusTitleBox(items = null) {
        if (!l) return;
        (items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray()).forEach((e => {
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
        return this.doFilterItems();
    }
    async doFilterItems(items = null) {
        if (!window.isListPage) return;
        let e = items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray();
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
    async getFilterContext() {
        if (this.filterContext) return this.filterContext;
        const [titleKeywords, blacklistMap, blacklistCars, settings, carMap, activity] = await Promise.all([ storageManager.getTitleFilterKeyword(), storageManager.getBlacklistMap(), storageManager.getBlacklistCarList(), storageManager.getSetting(), storageManager.getCarMap(), stateService.getActivityLog() ]), actorCarNumToNameMap = new Map, actressCarNumToNameMap = new Map, recentCarNums = new Set;
        const cutoff = Date.now() - 7 * 864e5;
        activity.entries.filter((entry => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)).forEach((entry => entry.changes.filter((change => "reverted" !== change.undoState && change.fields?.some((field => field.startsWith("stateFlags."))))).forEach((change => recentCarNums.add(change.carNum)))));
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
        $(this.getSelector().itemSelector).each(((e, item) => {
            const card = $(item);
            if (l && card.find(".avatar-box").length > 0) return;
            const flags = normalizeStateFlags(JSON.parse(card.attr("data-jhs-flags") || "{}")), reasons = JSON.parse(card.attr("data-jhs-visibility") || "{}"), hardHidden = isHardHidden(flags, reasons);
            summary.total++, flags.favorite && summary.favorite++, flags.downloaded && summary.downloaded++, flags.watched && summary.watched++, hardHidden && summary.blockedItems++,
            !hasAnyState(flags) && !hardHidden && summary.pending++, flags.blocked && summary.debug.manualBlocked++, reasons.keyword && summary.debug.keywordBlocked++, reasons.actorBlacklist && summary.debug.actorBlocked++, reasons.actressBlacklist && summary.debug.actressBlocked++;
        }));
        return summary;
    }
    getCurrentPageSummary() {
        return this.collectCurrentPageSummary();
    }
    recountStatuses() {
        const summary = this.collectCurrentPageSummary();
        this.currentPageFilterCount = summary.debug.manualBlocked, this.currentPageFavoriteCount = summary.favorite, this.currentPageHasDownCount = summary.downloaded,
        this.currentPageHasWatchCount = summary.watched, this.currentPageKeywordFilterCount = summary.debug.keywordBlocked,
        this.currentPageActorFilterCount = summary.debug.actorBlocked + summary.debug.actressBlocked, this.currentPageWaitCheckCount = summary.pending,
        this.currentPageTotalCount = summary.total;
        return summary;
    }
    scheduleRecount() {
        if (this.recountFrame) return;
        const schedule = window.requestAnimationFrame || (callback => setTimeout(callback, 0));
        this.recountFrame = schedule((() => {
            this.recountFrame = null, this.recountStatuses();
        }));
    }
    async translateListItems(e) {
        if (await storageManager.getSetting("translateTitle", _) !== _) return;
        await mapLimit(e, 3, (async (item, index) => {
            try { index > 0 && index % 8 == 0 && await this.yieldListFrame(), await this.translate(item); } catch (error) { clog.error("列表标题翻译失败", error); }
        }));
    }
    async filterMovieList(e) {
        utils.time("累计耗费时间"), utils.time("读取数据耗时");
        const {titleKeywords: n, settings: s, carMap: m, recentCarNums: recent, actorCarNumToNameMap: f, actressCarNumToNameMap: v} = await this.getFilterContext(), o = utils.time("读取数据耗时");
        utils.time("组装数据耗时");
        const b = utils.time("组装数据耗时"), k = (null == s ? void 0 : s.showFavoriteItem) ?? _, S = (null == s ? void 0 : s.showHasDownItem) ?? _, T = (null == s ? void 0 : s.showHasWatchItem) ?? _, I = (null == s ? void 0 : s.showAllItem) ?? C, P = (null == s ? void 0 : s.tagPosition) || "rightTop";
        const O = n.filter((e => e));
        this.currentPageFilterCount = 0, this.currentPageFavoriteCount = 0, this.currentPageHasDownCount = 0,
        this.currentPageHasWatchCount = 0, this.currentPageKeywordFilterCount = 0, this.currentPageActorFilterCount = 0,
        this.currentPageWaitCheckCount = 0, this.currentPageTotalCount = 0, utils.time("处理页面耗时");
        const R = [];
        for (let n = 0; n < e.length; n++) {
            n > 0 && n % 12 == 0 && await this.yieldListFrame();
            let t = $(e[n]);
            if (l && t.find(".avatar-box").length > 0) continue;
            const {carNum: a, title: i} = this.findCarNumAndHref(t), record = m.get(a), flags = normalizeStateFlags(record?.stateFlags), actorFiltered = f.has(a), actressFiltered = v.has(a), keyword = this.findMatchedTitleKeyword(O, i, a), visibilityReasons = { keyword: !!keyword, actorBlacklist: actorFiltered, actressBlacklist: actressFiltered };
            const hardHidden = isHardHidden(flags, visibilityReasons), settingHidden = shouldHideInDefaultView(flags, { showAllItem: I, showFavoriteItem: k, showHasDownItem: S, showHasWatchItem: T });
            t.attr("data-jhs-flags", JSON.stringify(flags)).attr("data-jhs-visibility", JSON.stringify(visibilityReasons)).attr("data-jhs-setting-hide", settingHidden ? _ : C).attr("data-jhs-recent", recent.has(a) ? _ : C).attr("data-jhs-tag-position", P);
            const signature = JSON.stringify({ flags, visibilityReasons, P });
            if (t.attr("data-jhs-state-signature") !== signature) {
                t.attr("data-jhs-state-signature", signature), t.find(".jhs-status-tags").remove();
                const badgeDefs = [
                    [ flags.blocked, Te.IS_FILTERED, "单番号屏蔽" ], [ flags.favorite, Te.IS_FAVORITE, "" ], [ flags.downloaded, Te.IS_HAS_DOWN, "" ], [ flags.watched, Te.IS_HAS_WATCH, "" ],
                    [ visibilityReasons.keyword, Te.IS_KEYWORD_FILTER, keyword || "未知" ], [ visibilityReasons.actorBlacklist, Te.IS_ACTOR_FILTER, f.get(a) || "" ], [ visibilityReasons.actressBlacklist, Te.IS_ACTRESS_FILTER, v.get(a) || "" ]
                ].filter((item => item[0]));
                if (badgeDefs.length) {
                    const box = $(`<span class="jhs-status-tags ${"rightTop" === P ? "jhs-status-tags--right" : "jhs-status-tags--left"}"></span>`);
                    badgeDefs.forEach((([, definition, tip]) => {
                        const badge = $(`<span class="jhs-badge ${r ? "jhs-badge--success" : "jhs-badge--neutral"} status-tag" data-tip="${escapeHtml(tip)}" title="">${escapeHtml(definition.text)}</span>`);
                        badge.css({ color: definition.on, backgroundColor: definition.color }), box.append(badge);
                    }));
                    if (r) t.find(".tags").append(box); else if (l) { const host = t.find(".item-tag"); host.length ? host.append(box) : t.find(".photo-info > span > div").append(box); }
                }
            }
            hardHidden || R.push(t);
        }
        this.scheduleRecount(), void this.translateListItems(R).catch((e => clog.error("列表页翻译任务失败", e)));
        const D = utils.time("处理页面耗时"), A = utils.time("累计耗费时间");
        clog.log(`\n            <table class="countTable jhs-layout-b12542a5">\n                <tr>\n                    <td colspan="2" class="jhs-count-table__cell">${o}</td>\n                    <td colspan="2" class="jhs-count-table__cell">${b}</td>\n                </tr>\n                \n                <tr>\n                    <td colspan="2" class="jhs-count-table__cell">${D}</td>\n                    <td colspan="2" class="jhs-count-table__cell">${A}</td>\n                </tr>\n                <tr>\n                    <td class="jhs-count-table__head">项目</td>\n                    <td class="jhs-count-table__head">数量</td>\n                    <td class="jhs-count-table__head">项目</td>\n                    <td class="jhs-count-table__head">数量</td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽单番号</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageFilterCount}</strong></td>\n                     <td class="jhs-count-table__cell">收藏</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageFavoriteCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽演员</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageActorFilterCount}</strong></td>\n                    <td class="jhs-count-table__cell">已下载</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageHasDownCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽关键词</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageKeywordFilterCount}</strong></td>\n                    <td class="jhs-count-table__cell">已观看</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageHasWatchCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">待鉴定</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageWaitCheckCount}</strong></td>\n                    <td class="jhs-count-table__cell"></td>\n                    <td class="jhs-count-table__cell"></td>\n                </tr>\n        \n                <tr>\n                    <td class="jhs-count-table__cell"><strong>总数</strong></td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageTotalCount}</strong></td>\n                </tr>\n            </table>\n        `);
    }
    async bindClick() {
        let e = this.getSelector();
        this.bindMovieDetailNavigation(e.boxSelector), $(e.boxSelector).on("click", ".item video", (async e => {
            const t = e.currentTarget;
            t.paused ? await safePlay(t, {
                context: "列表视频",
                notify: !0
            }) : t.pause(), e.preventDefault(),
            e.stopPropagation();
        })), $(e.boxSelector).on("contextmenu", ".item img, .item video", (async e => {
            try {
                e.preventDefault();
                const t = $(e.target).closest(".item"), {carNum: n, url: a, publishTime: i} = this.findCarNumAndHref(t);
                let s = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10"), o = "";
                s.length && (o = s.text().trim().split(",")[0].replace("(無碼)", "")), utils.q(e, `是否屏蔽番号 ${n}?`, (async () => {
                    try {
                        o || (o = await this.parseActressName(a)), await stateService.patch(n, { blocked: !0 }, { record: { carNum: n, url: a, names: o, publishTime: i } }), show.ok("操作成功");
                    } catch (s) { clog.error("屏蔽操作失败:", s), show.error("操作失败"); }
                }));
            } catch (t) { clog.error("右键菜单处理失败:", t); }
        }));
    }
    /** 从任意列表卡片进入统一详情导航。 */
    async openMovieDetail(item, { event = null, autoplay = !1, newTab = !1 } = {}) {
        const card = item?.jquery ? item : $(item), {carNum, aHref} = this.findCarNumAndHref(card);
        if (!carNum || !aHref) return;
        const shouldOpenTab = newTab || !!event && (event.ctrlKey || event.metaKey || 1 === event.button);
        if (carNum.includes("FC2-")) {
            const movieId = this.parseMovieId(aHref);
            return shouldOpenTab ? this.getBean("Fc2Plugin").openFc2Page(movieId, carNum, aHref, { event, newTab: !0 }) : this.getBean("Fc2Plugin").openFc2Dialog(movieId, carNum, aHref);
        }
        const destination = new URL(aHref, window.location.origin);
        autoplay && destination.searchParams.set("autoPlay", "1"), utils.openPage(destination.href, carNum, !0, { event, newTab: shouldOpenTab }), this.$currentImage = null;
    }
    /** 为宿主与合成列表统一绑定左键、修饰键和中键导航。 */
    bindMovieDetailNavigation(container) {
        const root = $(container), selector = ".item img, .item .video-title";
        root.off("click.jhsMovieDetail auxclick.jhsMovieDetail", selector).on("click.jhsMovieDetail auxclick.jhsMovieDetail", selector, (event => {
            if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
            if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
            event.preventDefault(), event.stopPropagation();
            void this.openMovieDetail($(event.currentTarget).closest(".item"), { event }).catch((error => clog.error("打开影片详情失败", error)));
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
            carNum: normalizeCarNum(a),
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
    _replaceSingleHdImg(e) {
        if ("true" === e.dataset.hdReplaced) return;
        if (r) {
            const isJavdbCdn = /jdbstatic\.com|javdb\.com/i.test(e.src);
            if (isJavdbCdn) {
                const originalSrc = e.src;
                e.src = e.src.replace("thumbs", "covers");
                e.dataset.hdReplaced = "true";
                e.title = "";
                e.onerror = function() {
                    if (this.src !== originalSrc) {
                        this.src = originalSrc;
                        this.onerror = null;
                    }
                };
            }
        } else if (l) {
            const t = /\/(imgs|pics)\/(thumb|thumbs)\//, n = /(\.jpg|\.jpeg|\.png)$/i;
            t.test(e.src) ? (e.src = e.src.replace(t, "/$1/cover/").replace(n, "_b$1"), e.dataset.hdReplaced = "true",
            e.dataset.title = e.title, e.title = "") : /ps(\.jpg|\.jpeg|\.png)$/i.test(e.src) && (e.src = e.src.replace(/ps(\.jpg|\.jpeg|\.png)$/i, "pl$1"),
            e.dataset.hdReplaced = "true", e.dataset.title = e.title, e.title = "");
        }
    }
    replaceHdImg(e) {
        if (e && "string" == typeof e.jquery && (e = e.toArray()), e || (e = document.querySelectorAll(this.getSelector().coverImgSelector)),
        !e.length) return;
        const t = Array.from(e).filter((e => "true" !== e.dataset.hdReplaced && "true" !== e.dataset.jhsHdObserved));
        if ("IntersectionObserver" in window && !this.hdImageObserver) this.hdImageObserver = new IntersectionObserver((entries => {
            entries.forEach((entry => {
                entry.isIntersecting && (this.hdImageObserver.unobserve(entry.target), delete entry.target.dataset.jhsHdObserved,
                this._replaceSingleHdImg(entry.target));
            }));
        }), { rootMargin: "200px" });
        for (const image of t) this.hdEagerRemaining > 0 ? (this.hdEagerRemaining--, this._replaceSingleHdImg(image)) : this.hdImageObserver ? (image.dataset.jhsHdObserved = "true",
        this.hdImageObserver.observe(image)) : this._replaceSingleHdImg(image);
        storageManager.getSetting("hoverBigImg", C).then((e => {
            e === _ && (window.imageHoverPreviewObj ? window.imageHoverPreviewObj.bindEvents() : window.imageHoverPreviewObj = new ImageHoverPreview({
                selector: this.getSelector().coverImgSelector
            }));
        }));
    }
    getTranslationCache() {
        if (this.cache && "object" == typeof this.cache && !Array.isArray(this.cache)) return this.cache;
        try { this.cache = JSON.parse(localStorage.getItem("jhs_translate") || "{}"); } catch (error) {
            clog.warn("列表翻译缓存无法解析，已忽略旧缓存", error), this.cache = {};
        }
        return this.cache && "object" == typeof this.cache && !Array.isArray(this.cache) ? this.cache : this.cache = {};
    }
    scheduleTranslationWrite() {
        this._debouncedTranslateWrite && clearTimeout(this._debouncedTranslateWrite), this._debouncedTranslateWrite = setTimeout((() => {
            localStorage.setItem("jhs_translate", JSON.stringify(this.getTranslationCache()));
        }), 500);
    }
    applyTranslatedTitle(e, t, n) {
        const a = e.find(".video-title");
        r ? (a.contents().each((function() {
            3 !== this.nodeType || "" === this.textContent.trim() || this.textContent.includes(n) || (this.textContent = " " + t + " ");
        })), a.attr("title", t)) : a.text(t), e.attr("data-jhs-translation-key", n);
    }
    async translate(e) {
        let t, n, a = e.find(".video-title");
        if (r ? (t = a.contents().filter(((e, t) => 3 === t.nodeType && "" !== t.textContent.trim())).text().trim(),
        n = e.find(".video-title strong").text().trim()) : (t = (e.find("img").attr("data-title") || "").trim(),
        n = (e.find("a").attr("href") || "").split("/").filter(Boolean).pop()?.trim()), !t || !n) return;
        const cache = this.getTranslationCache();
        if (cache[n]) return void this.applyTranslatedTitle(e, cache[n], n);
        let pending = this.translationPending.get(n);
        if (!pending) {
            pending = _e(t).then((translated => (cache[n] = translated, this.scheduleTranslationWrite(), translated))).finally((() => this.translationPending.delete(n))),
            this.translationPending.set(n, pending);
        }
        this.applyTranslatedTitle(e, await pending, n);
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
        const t = utils.getUrlParam(o, "page") || 1, n = $('<input type="number" class="jhs-field jhs-jump-page-input">', {
            id: "jumpPageInput",
            placeholder: "页码",
            min: "1",
            value: t + 1
        }), a = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-jump-page-btn">', {
            text: "跳转",
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
