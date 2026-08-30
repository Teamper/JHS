// @ts-check

import { B, C, _, b, escapeHtml, k, l, normalizeCarNum, o, r, u, y } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { mapLimit, safePlay } from "../../core/feature-helpers.js";
import { requestHostPage } from "../../core/host-page-request.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { readCardNames, readListItem } from "../../core/list-item-reader.js";
import { isHitShowPage } from "../../core/site-context.js";
import { hasAnyState, legacyActionToFlag, normalizeStateFlags } from "../../core/state-model.js";
import { PRIMARY_QUICK_FILTERS, QUICK_FILTER_LABELS, SECONDARY_QUICK_FILTERS, isHardHidden, normalizeQuickFilterKey, shouldShowItem } from "../../features/list/list-filters.js";
import { createListEvaluationContext, evaluateListItem, findMatchedTitleKeyword } from "../../features/list/list-evaluator.js";
import { scanAllPages } from "../../features/list/batch-scanner.js";
import { endBatchRun, isActiveBatchRun, isBatchRunCancelled, requestCancelBatchRun, tryBeginBatchRun } from "../../features/list/batch-coordinator.js";

/** @typedef {Record<string, any>} ListRecord */
/** @typedef {any} JQueryHandle */
/** @returns {NonNullable<typeof jhsEventBus>} */
function getListEventBus() {
    if (!jhsEventBus) throw new Error("List EventBus 未初始化");
    return jhsEventBus;
}

/** Normalize public list-card translation inputs (DOM Element or jQuery handle). */
/** @param {any} item @returns {any} */
function normalizeCard(item) {
    return item?.jquery ? item : $(item);
}

/** settings-changed 中需要触发列表全量重判定的 key；其余（主题/Preview/截图/布局等）由各自 Feature 精确处理。 */
const LIST_EFFECT_KEYS = new Set([ "tagPosition", "defaultQuickFilterTab" ]);

const Te = {
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

export class ListPagePlugin extends BasePlugin {
    async initCss() {
        return `<style>.jhs-status-tags{position:absolute;z-index:var(--jhs-z-content);top:5px;display:flex;flex-wrap:wrap;gap:4px;max-width:90%}.jhs-status-tags--right{right:0;justify-content:flex-end}.jhs-status-tags--left{left:0}.status-tag{padding:0 5px;border-radius:10px}.status-tag .tag{color:inherit!important}.jhs-jump-page-input{width:60px;margin-left:10px}.jhs-jump-page-btn{margin-left:5px}.jhs-quick-filter{display:flex;align-items:center;gap:var(--jhs-space-1);min-width:0}.jhs-quick-filter__more{position:relative}.jhs-quick-filter__menu{min-width:190px}.jhs-filter-menu__separator{height:1px;margin:var(--jhs-space-1) 0;background:var(--jhs-border)}.jhs-batch-progress{position:fixed;right:16px;bottom:16px;z-index:var(--jhs-z-modal);display:flex;align-items:center;gap:var(--jhs-space-2);padding:var(--jhs-space-2) var(--jhs-space-3);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md);background:var(--jhs-surface);color:var(--jhs-text);box-shadow:0 4px 16px rgba(0,0,0,.18)}.jhs-btn.jhs-batch-busy{opacity:.55;cursor:not-allowed}</style>`;
    }
    constructor() {
        super(...arguments);
        this.currentPageFilterCount = 0;
        this.currentPageFavoriteCount = 0;
        this.currentPageHasDownCount = 0;
        this.currentPageHasWatchCount = 0;
        this.currentPageKeywordFilterCount = 0;
        this.currentPageActorFilterCount = 0;
        this.currentPageWaitCheckCount = 0;
        this.currentPageTotalCount = 0;
        /** @type {any} */ this.filterContext = null;
        /** @type {Set<Element>} */ this.pendingItems = new Set();
        /** @type {ReturnType<typeof setTimeout> | null} */ this.processTimer = null;
        /** @type {IntersectionObserver | null} */ this.hdImageObserver = null;
        /** @type {Map<HTMLImageElement, () => void>} */ this.hdPendingCleanups = new Map();
        /** @type {string | null} */ this.hoverPreviewState = null;
        this.writeQueue = Promise.resolve();
        /** @type {Map<string, Set<Element>>} */ this.itemIndex = new Map();
        /** @type {number | null} */ this.recountFrame = null;
        /** @type {any} */ this.$currentImage = null;
        /** @type {number} */ this.translationGeneration = 0;
    }
    getName() {
        return "ListPagePlugin";
    }
    async handle() {
        if (!window.isListPage) return;
        const scope = await this.getRuntimeService("scope")();
        const settingsService = this.getRuntimeService("settings");
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
            if (names.includes("hoverBigImg")) this.configureHoverPreview(settingsService.snapshot().hoverBigImg === "yes" ? "yes" : "no");
        };
        settingsService.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => settingsService.removeEventListener("settings.changed", onSettingsChanged)));
        const refreshAll = async (/** @type {any} */ payload = {}) => {
                // 6.5 收敛：settings-changed 只对列表判定相关 key 全量刷新；主题/Preview/截图/布局
                // 等由各自 Feature 精确处理，不再触发 doFilter/applyVisibility/History setData。
                const changedNames = /** @type {string[] | undefined} */ (payload?.changedNames);
                if (changedNames && !changedNames.some((name) => LIST_EFFECT_KEYS.has(name))) return;
                this.filterContext = null, storageManager._invalidateCache(storageManager.car_list_key), await this.doFilter(), this.applyVisibility();
                const e = this.getOptionalDependency("HistoryPlugin");
                e?.tableObj && e.tableObj.setData();
        };
        [ "legacy-refresh", "blacklist-rules-changed", "filter-rules-changed", "settings-changed" ].forEach((type => scope.addCleanup(getListEventBus().on(type, refreshAll)))),
        scope.addCleanup(getListEventBus().on("car-state-changed", (async payload => {
            this.filterContext = null, storageManager._invalidateCache(storageManager.car_list_key);
            const items = this.getIndexedItems(payload.carNums || []);
            items.length && (await this.doFilterItems(items), this.applyVisibility(items));
            const history = this.getOptionalDependency("HistoryPlugin");
            history?.tableObj && history.tableObj.setData();
        })));
        // 自有榜单页没有宿主列表 DOM 可劫持，DOM 管线由 HitShowPlugin.initializeRenderedList 驱动；
        // Top250（handleTop）与 v6.4.1 一致走完整管线（其自有列表在同步前缀阶段已创建）；
        // 但状态标记/黑名单/设置变更的刷新监听在两类页面都必须保持活跃，否则卡片标记永不更新。
        if (isHitShowPage()) return;
        const hoverBigImg = settingsService.snapshot().hoverBigImg;
        this.configureHoverPreview(hoverBigImg === _ ? "yes" : "no");
        this.cleanRepeatId(), this.replaceHdImg(), this.addJumpPageControl(), this.fixBusTitleBox(),
        await this.doFilter(), await this.createQuickFilter(), this.applyVisibility(), await this.bindClick(),
        this.rememberTagExpand(),
        $(this.getSelector().itemSelector).attr("data-jhs-processed", "true"), this.rebuildItemIndex(), await getListEventBus().emit("list-items-added", { items: $(this.getSelector().itemSelector).toArray() }, { broadcast: !1 }),
        this.checkDom(scope), scope.addCleanup((() => {
            this.processTimer && clearTimeout(this.processTimer), this.processTimer = null, this.pendingItems.clear();
            this.hdImageObserver?.disconnect(), this.hdImageObserver = null;
            this.hdPendingCleanups.forEach((cleanup => cleanup())), this.hdPendingCleanups.clear();
            this.configureHoverPreview("no");
            this.recountFrame && (globalThis.cancelAnimationFrame?.(this.recountFrame) ?? clearTimeout(this.recountFrame)), this.recountFrame = null;
            $(this.getSelector().boxSelector).off(".jhsMovieDetail .jhsListVideo .jhsListMenu"), $("#jhs-quick-filter").off(), this.itemIndex.clear();
        }));
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
        root.on("click", ".jhs-segmented__item", ((/** @type {any} */ event) => this.setQuickFilter($(event.currentTarget).data("jhs-filter"))))
            .on("keydown", ".jhs-segmented__item", ((/** @type {any} */ event) => {
                if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const tabs = root.find(".jhs-segmented__item"), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                tabs.eq(next).trigger("click").trigger("focus");
            })).on("click", ".jhs-filter-option", ((/** @type {any} */ event) => {
                this.setQuickFilter($(event.currentTarget).data("jhs-filter")), closeMenu(!0);
            })).on("keydown", ".jhs-filter-option", ((/** @type {any} */ event) => {
                const items = menu.find(".jhs-filter-option"), index = items.index(event.currentTarget);
                if ("Escape" === event.key) return event.preventDefault(), closeMenu(!0);
                if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                items.eq(next).trigger("focus");
            }));
        toggle.on("click", ((/** @type {any} */ event) => {
            event.preventDefault(), event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && (menu.find('[aria-checked="true"]').first().length ? menu.find('[aria-checked="true"]').first() : menu.find(".jhs-filter-option").first()).trigger("focus");
        })), $(document).off("click.jhsQuickFilter").on("click.jhsQuickFilter", ((/** @type {any} */ event) => {
            $(event.target).closest(root).length || closeMenu();
        }));
        this.setQuickFilter(await storageManager.getSetting("defaultQuickFilterTab", "waitCheck"));
    }
    /** @param {Element[] | null} [items] */
    applyVisibility(items = null) {
        const e = this.activeQuickFilter || "waitCheck", t = this.getSelector().itemSelector;
        (items ? $(items) : $(t)).each(((/** @type {number} */ index, /** @type {Element} */ element) => {
            const t = $(element), flags = normalizeStateFlags(JSON.parse(t.attr("data-jhs-flags") || "{}")), visibilityReasons = JSON.parse(t.attr("data-jhs-visibility") || "{}"), recent = "yes" === t.attr("data-jhs-recent");
            shouldShowItem({ filter: e, flags, visibilityReasons, recent }) ? t.show() : t.hide();
        }));
    }
    /** @param {unknown} filter @param {{ syncUi?: boolean }} [options] */
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
        const storage = this.getRuntimeService("storage"), t = "jhs_tag_expand", n = "true" === storage.getLocal(t), a = $(".actor-tags .content");
        n && a.hasClass("collapse") && e[0].click(), e.on("click", (function() {
            const e = !$(".actor-tags .content").hasClass("collapse");
            clog.debug("触发"), storage.setLocal(t, e.toString());
        }));
    }
    /** @param {any} [scope] */
    checkDom(scope = null) {
        // 自有榜单页（热播/Top250）由渲染方自行管理容器与增量，不走宿主容器探测
        if (!window.isListPage || isHitShowPage() || window.location.search.includes("handleTop=1")) return;
        const e = this.getSelector(), t = document.querySelector(e.boxSelector);
        if (!t) return void clog.error("没有找到容器节点!");
        if (!scope) return;
        scope.observe(t, ((/** @type {MutationRecord[]} */ records) => {
            for (const record of records) {
                this.removeIndexedItems(record.removedNodes);
                for (const node of record.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const element = /** @type {Element} */ (node);
                element.matches?.(e.itemSelector) && "true" !== /** @type {HTMLElement} */ (element).dataset.jhsProcessed && this.pendingItems.add(element),
                element.querySelectorAll?.(e.itemSelector).forEach((/** @type {Element} */ item) => {
                    "true" !== /** @type {HTMLElement} */ (item).dataset.jhsProcessed && this.pendingItems.add(item);
                });
                }
            }
            this.pendingItems.size && (this.processTimer && clearTimeout(this.processTimer), this.processTimer = setTimeout((() => {
                const items = [ ...this.pendingItems ].filter((/** @type {Element} */ item) => item.isConnected && "true" !== /** @type {HTMLElement} */ (item).dataset.jhsProcessed);
                this.pendingItems.clear(), this.processTimer = null, items.length && void this.processAddedItems(items).catch((error => clog.error("列表增量处理失败", error)));
            }), 100));
        }), {
            childList: !0,
            subtree: !1
        });
    }
    /** @param {Element[]} items */
    async processAddedItems(items) {
        const selector = this.getSelector(), covers = items.flatMap((/** @type {Element} */ item) => [ ...item.querySelectorAll(selector.coverImgSelector) ]);
        this.replaceHdImg(covers), this.addJumpPageControl(), this.fixBusTitleBox(items), await this.doFilterItems(items), this.applyVisibility(items),
        await this.getOptionalDependency("ListPageButtonPlugin")?.sortItems?.(), await this.getOptionalDependency("CoverButtonPlugin")?.addSvgBtn?.(items),
        items.forEach((/** @type {Element} */ item) => /** @type {HTMLElement} */ (item).dataset.jhsProcessed = "true"), this.indexItems(items), await getListEventBus().emit("list-items-added", { items }, { broadcast: !1 }), this.getOptionalDependency("AutoPagePlugin")?.checkLoad?.();
    }
    rebuildItemIndex() {
        this.itemIndex.clear(), this.indexItems($(this.getSelector().itemSelector).toArray());
    }
    /** @param {Element[]} items */
    indexItems(items) {
        items.forEach((/** @type {Element} */ item) => {
            try {
                const key = normalizeCarNum(this.findCarNumAndHref($(item)).carNum);
                if (!key) return;
                const indexed = this.itemIndex.get(key) || new Set;
                indexed.add(item), this.itemIndex.set(key, indexed);
            } catch (error) {
                clog.debug("列表项索引跳过无效卡片", error);
            }
        });
    }
    /** @param {NodeList | Node[]} nodes */
    removeIndexedItems(nodes) {
        const removed = new Set;
        Array.from(nodes || []).forEach((/** @type {Node} */ node) => {
            const element = /** @type {Element} */ (node);
            node.nodeType === Node.ELEMENT_NODE && (removed.add(element), element.querySelectorAll?.(this.getSelector().itemSelector).forEach((/** @type {Element} */ item) => removed.add(item)));
        });
        if (!removed.size) return;
        this.itemIndex.forEach(((/** @type {Set<Element>} */ items, /** @type {string} */ key) => {
            items.forEach((/** @type {Element} */ item) => { removed.has(item) && items.delete(item); }), items.size || this.itemIndex.delete(key);
        }));
    }
    /** @param {unknown[]} carNums */
    getIndexedItems(carNums) {
        const result = new Set;
        carNums.map(normalizeCarNum).forEach((/** @type {string | null} */ key) => {
            if (!key) return;
            const items = this.itemIndex.get(key);
            items?.forEach((/** @type {Element} */ item) => item.isConnected ? result.add(item) : items.delete(item)), items && !items.size && this.itemIndex.delete(key);
        });
        return [ ...result ];
    }
    /** @param {Element[] | null} [items] */
    fixBusTitleBox(items = null) {
        if (!l) return;
        (items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray()).forEach((/** @type {Element} */ e) => {
            var t;
            let n = $(e);
            if (n.find(".avatar-box").length > 0) return;
            const a = (null == (t = n.find("img").attr("title")) ? void 0 : t.trim()) || "";
            n.find(".photo-info span:first").contents().first().wrap(`<span class="video-title" title="${a}">${a}</span>`),
            n.find("br").remove();
        });
    }
    cleanRepeatId() {
        if (!l) return;
        $("#waterfall_h").removeAttr("id").attr("id", "no-page");
        const e = $('[id="waterfall"]');
        0 !== e.length && e.each(((/** @type {number} */ index, /** @type {Element} */ element) => {
            const e = $(element);
            if (!e.hasClass("masonry")) {
                e.children().insertAfter(e), e.remove();
            }
        }));
    }
    async doFilter() {
        return this.doFilterItems();
    }
    /** @param {Element[] | null} [items] */
    async doFilterItems(items = null) {
        if (!window.isListPage) return;
        let e = items ? $(items).toArray() : $(this.getSelector().itemSelector).toArray();
        e.length && (await this.filterMovieList(e), l && setTimeout((() => {
            this.getOptionalDependency("BusImgPlugin")?.logImageHeightsByRow?.(this.getRuntimeService("settings").snapshot()).catch((/** @type {unknown} */ e) => clog.error("JavBus图片高度修正失败", e));
        })));
    }
    async yieldListFrame() {
        await new Promise((/** @type {(value: void) => void} */ e) => {
            window.requestAnimationFrame ? window.requestAnimationFrame((() => setTimeout(e))) : setTimeout(e);
        });
    }
    /** 供页面展示与跨页批量操作共用的唯一判定上下文。 */
    async createEvaluationContext() {
        return createListEvaluationContext(await this.getFilterContext());
    }
    async getFilterContext() {
        if (this.filterContext) return this.filterContext;
        const [titleKeywords, blacklistMap, blacklistCars, settings, carMap, activity] = await Promise.all([ storageManager.getTitleFilterKeyword(), storageManager.getBlacklistMap(), storageManager.getBlacklistCarList(), storageManager.getSetting(), storageManager.getCarMap(), this.getRuntimeService("state").getActivityLog() ]), actorCarNumToNameMap = new Map, actressCarNumToNameMap = new Map, recentCarNums = new Set;
        const cutoff = Date.now() - 7 * 864e5;
        activity.entries
            .filter((/** @type {ListRecord} */ entry) => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)
            .forEach((/** @type {ListRecord} */ entry) => {
                entry.changes
                    .filter((/** @type {ListRecord} */ change) => "reverted" !== change.undoState && change.fields?.some((/** @type {string} */ field) => field.startsWith("stateFlags.")))
                    .forEach((/** @type {ListRecord} */ change) => recentCarNums.add(change.carNum));
            });
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
        $(this.getSelector().itemSelector).each(((/** @type {number} */ e, /** @type {Element} */ item) => {
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
        const schedule = window.requestAnimationFrame || ((/** @type {FrameRequestCallback} */ callback) => setTimeout(callback, 0));
        this.recountFrame = schedule((() => {
            this.recountFrame = null, this.recountStatuses();
        }));
    }
    /** @param {(Element|JQueryHandle)[]} e */
    async translateListItems(e) {
        if ((this.getRuntimeService("settings").snapshot().translateTitle ?? _) !== _) return;
        let failed = 0;
        /** @type {unknown} */
        let firstError = null;
        await mapLimit(e, 3, (async (item, index) => {
            try {
                if (index > 0 && index % 8 === 0) await this.yieldListFrame();
                await this.translate(normalizeCard(item));
            } catch (error) {
                failed++;
                firstError ??= error;
            }
        }));
        if (failed) {
            clog.error(`列表标题翻译失败 ${failed} 项`, firstError);
        }
    }
    /** @param {Element[]} e */
    async filterMovieList(e) {
        utils.time("累计耗费时间"), utils.time("读取数据耗时");
        const {titleKeywords: n, settings: s, carMap: m, recentCarNums: recent, actorCarNumToNameMap: f, actressCarNumToNameMap: v} = await this.getFilterContext(), o = utils.time("读取数据耗时");
        const evaluationContext = createListEvaluationContext({ titleKeywords: n, settings: s, carMap: m, recentCarNums: recent, actorCarNumToNameMap: f, actressCarNumToNameMap: v });
        utils.time("组装数据耗时");
        const b = utils.time("组装数据耗时"), P = (null == s ? void 0 : s.tagPosition) || "rightTop";
        this.currentPageFilterCount = 0, this.currentPageFavoriteCount = 0, this.currentPageHasDownCount = 0,
        this.currentPageHasWatchCount = 0, this.currentPageKeywordFilterCount = 0, this.currentPageActorFilterCount = 0,
        this.currentPageWaitCheckCount = 0, this.currentPageTotalCount = 0, utils.time("处理页面耗时");
        const R = [];
        for (let n = 0; n < e.length; n++) {
            n > 0 && n % 12 == 0 && await this.yieldListFrame();
            let t = $(e[n]);
            if (l && t.find(".avatar-box").length > 0) continue;
            const {carNum: a, title: i} = this.findCarNumAndHref(t), {flags, visibilityReasons, hardHidden} = evaluateListItem({ carNum: a, title: i }, evaluationContext, { filter: this.activeQuickFilter || "waitCheck" }), keyword = visibilityReasons.keyword ? findMatchedTitleKeyword(evaluationContext.titleKeywords, i, a) : null;
            t.attr("data-jhs-flags", JSON.stringify(flags)).attr("data-jhs-visibility", JSON.stringify(visibilityReasons)).attr("data-jhs-recent", recent.has(a) ? _ : C).attr("data-jhs-tag-position", P);
            const signature = JSON.stringify({ flags, visibilityReasons, P });
            if (t.attr("data-jhs-state-signature") !== signature) {
                t.attr("data-jhs-state-signature", signature), t.find(".jhs-status-tags").remove();
                const badgeDefs = [
                    [ flags.blocked, Te.IS_FILTERED, "单番号屏蔽" ], [ flags.favorite, Te.IS_FAVORITE, "" ], [ flags.downloaded, Te.IS_HAS_DOWN, "" ], [ flags.watched, Te.IS_HAS_WATCH, "" ],
                    [ visibilityReasons.keyword, Te.IS_KEYWORD_FILTER, keyword || "未知" ], [ visibilityReasons.actorBlacklist, Te.IS_ACTOR_FILTER, f.get(a) || "" ], [ visibilityReasons.actressBlacklist, Te.IS_ACTRESS_FILTER, v.get(a) || "" ]
                ].filter((/** @type {any[]} */ item) => item[0]);
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
        this.scheduleRecount(), void this.translateListItems(R).catch((/** @type {unknown} */ e) => clog.error("列表页翻译任务失败", e));
        const D = utils.time("处理页面耗时"), A = utils.time("累计耗费时间");
        clog.html(`\n            <table class="countTable jhs-layout-b12542a5">\n                <tr>\n                    <td colspan="2" class="jhs-count-table__cell">${o}</td>\n                    <td colspan="2" class="jhs-count-table__cell">${b}</td>\n                </tr>\n                \n                <tr>\n                    <td colspan="2" class="jhs-count-table__cell">${D}</td>\n                    <td colspan="2" class="jhs-count-table__cell">${A}</td>\n                </tr>\n                <tr>\n                    <td class="jhs-count-table__head">项目</td>\n                    <td class="jhs-count-table__head">数量</td>\n                    <td class="jhs-count-table__head">项目</td>\n                    <td class="jhs-count-table__head">数量</td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽单番号</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageFilterCount}</strong></td>\n                     <td class="jhs-count-table__cell">收藏</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageFavoriteCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽演员</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageActorFilterCount}</strong></td>\n                    <td class="jhs-count-table__cell">已下载</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageHasDownCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽关键词</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageKeywordFilterCount}</strong></td>\n                    <td class="jhs-count-table__cell">已观看</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageHasWatchCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">待鉴定</td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageWaitCheckCount}</strong></td>\n                    <td class="jhs-count-table__cell"></td>\n                    <td class="jhs-count-table__cell"></td>\n                </tr>\n        \n                <tr>\n                    <td class="jhs-count-table__cell"><strong>总数</strong></td>\n                    <td class="jhs-count-table__cell"><strong>${this.currentPageTotalCount}</strong></td>\n                </tr>\n            </table>\n        `);
    }
    /**
     * Batch-mark every item matching the current quick filter across all pages.
     * 语义：全部 = 包含 hard-hidden 的真全集；其他筛选 = 全部分页中符合该筛选的项。
     * @param {{ kind?: "actor" | "search", displayName?: string, recordName?: string }} scope
     * @param {string} flag @param {{ filter?: unknown, confirm?: boolean, root?: any }} [options]
     */
    async batchSaveAllVideos(scope, flag, { filter = this.activeQuickFilter || "waitCheck", confirm = true, root = null } = {}) {
        const stateFlag = legacyActionToFlag(flag);
        if (!stateFlag) throw new TypeError(`不支持的状态操作: ${flag}`);
        const normalized = normalizeQuickFilterKey(filter), filterLabel = QUICK_FILTER_LABELS[normalized];
        const actorScope = scope?.kind === "actor", recordName = actorScope ? String(scope.recordName || "") : "";
        // 自有榜单页（热播/Top250）的分页是自绘按钮，跨页抓取不可用：批量语义收敛为“当前榜单页”
        const isOwnedRankingPage = isHitShowPage(window.location) || window.location.search.includes("handleTop=1");
        const confirmText = isOwnedRankingPage
            ? ("all" === normalized
                ? "将处理当前榜单页内的所有作品，包括屏蔽项。"
                : `将处理当前榜单页内符合「${filterLabel}」筛选的作品。`)
            : ("all" === normalized
                ? "将处理当前搜索全部分页的所有作品，包括屏蔽项。"
                : `将处理当前搜索全部分页中符合「${filterLabel}」筛选的作品。`);
        if (confirm) {
            const proceed = await new Promise((resolve) => utils.q(null, confirmText, () => resolve(true), () => resolve(false)));
            if (!proceed) return { cancelled: true };
        }
        // Single Flight：已有批量任务时不启动第二个任务，避免互相打断/污染进度。
        const run = tryBeginBatchRun();
        if (!run) {
            show.error("已有批量任务正在执行");
            return { cancelled: true, busy: true };
        }
        const runtimeScope = await this.getRuntimeService("scope")(), context = await this.createEvaluationContext();
        const isCancelled = () => isBatchRunCancelled(run) || Boolean(runtimeScope?.disposed);
        const progressElement = this.showBatchProgress(run);
        this.setBatchButtonsDisabled(true);
        const setProgress = (/** @type {string} */ text) => {
            const label = progressElement?.find(".jhs-batch-progress__label");
            label && label.length ? label.text(text) : clog.debug(text);
        };
        const onProgress = (/** @type {{ page: number, scanned: number, matched: number }} */ {page, scanned, matched}) => {
            setProgress(`已扫描 ${page} 页 · 匹配 ${matched} 项`);
            clog.debug(`批量扫描第 ${page} 页 · 已扫描 ${scanned} · 匹配 ${matched}`);
        };
        try {
            const records = await scanAllPages({
                startDom: root ? $(root) : $(document),
                currentUrl: isOwnedRankingPage ? null : (root ? null : window.location.href),
                firstPageUrl: isOwnedRankingPage ? null : (root ? null : (this.getRuntimeService("host")?.resolveFirstPageUrl?.(window.location.href) ?? window.location.href)),
                itemSelector: this.getSelector().requestDomItemSelector,
                nextPageSelector: this.getSelector().nextPageSelector,
                fetchHtml: async (/** @type {string} */ url) => requestHostPage(this.getRuntimeService("http"), url, runtimeScope),
                parseItem: (/** @type {any} */ item) => {
                    const parsed = readListItem(item);
                    return actorScope ? parsed : { ...parsed, names: readCardNames(item) };
                },
                evaluate: (/** @type {any} */ item) => evaluateListItem({ carNum: item.carNum, title: item.title || "" }, context, { filter: normalized }),
                isCancelled,
                onProgress,
            });
            if (isCancelled()) {
                progressElement?.remove();
                return { cancelled: true };
            }
            // 写入阶段不可取消：禁用按钮并给出明确文案，避免出现半批数据状态。
            progressElement?.find("#jhs-batch-cancel").prop("disabled", true).attr("title", "正在写入，无法取消");
            setProgress("正在写入，无法取消…");
            let updated = 0;
            for (let index = 0; index < records.length; index += 75) {
                if (isCancelled()) break;
                const chunk = records.slice(index, index + 75);
                await this.getRuntimeService("state").patch(chunk.map((item) => item.carNum), { [stateFlag]: !0 }, {
                    type: "actor-page-batch-state",
                    records: chunk.map((item) => ({ carNum: item.carNum, url: item.url || "", names: item.names ?? recordName, publishTime: item.publishTime || "", fc2Source: item.fc2Source })),
                });
                updated += chunk.length;
                setProgress(`已更新 ${updated}/${records.length} 项`);
            }
            setProgress(`批量完成：匹配 ${records.length} 项 · 已更新 ${updated} 项`);
            setTimeout(() => progressElement?.remove(), 1800);
            return { matched: records.length, updated };
        } catch (error) {
            clog.error("批量操作失败:", error);
            setProgress("批量操作失败");
            progressElement?.addClass("jhs-batch-progress--error");
            setTimeout(() => progressElement?.remove(), 2500);
            throw error;
        } finally {
            if (isActiveBatchRun(run)) endBatchRun(run);
            this.setBatchButtonsDisabled(false);
        }
    }
    /** 批量任务期间禁用/恢复所有批量入口（视觉禁用但保持可点击，点击时由 handler 提示并拒绝启动）。 */
    /** @param {boolean} disabled */
    setBatchButtonsDisabled(disabled) {
        $("#favoriteAllVideo, #hasDownAllVideo, #filterAllVideo").attr("aria-disabled", String(disabled)).toggleClass("jhs-batch-busy", disabled);
    }
    /** 批量进度浮层（带取消按钮）；返回可更新的状态元素。每次绑定当前 run 的取消 handler。 */
    /** @param {any} run */
    showBatchProgress(run) {
        let element = $("#jhs-batch-progress");
        if (!element.length) {
            element = $('<div id="jhs-batch-progress" class="jhs-ui jhs-batch-progress" role="status"></div>').appendTo("body");
            element.append('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm" id="jhs-batch-cancel">取消</button>');
        }
        element.find("#jhs-batch-cancel").off("click").on("click", () => requestCancelBatchRun(run));
        element.find(".jhs-batch-progress__label").remove().end().prepend($('<span class="jhs-batch-progress__label"></span>').text("正在扫描…"));
        return element;
    }
    async bindClick() {
        const e = this.getSelector();
        this.bindMovieDetailNavigation(e.boxSelector), $(e.boxSelector).off("click.jhsListVideo").on("click.jhsListVideo", ".item video", (async (/** @type {any} */ e) => {
            const t = e.currentTarget;
            t.paused ? await safePlay(t, {
                context: "列表视频",
                notify: !0
            }) : t.pause(), e.preventDefault(),
            e.stopPropagation();
        })), $(e.boxSelector).off("contextmenu.jhsListMenu").on("contextmenu.jhsListMenu", ".item img, .item video", (async (/** @type {any} */ e) => {
            try {
                e.preventDefault();
                const t = $(e.target).closest(".item"), {carNum: n, url: a, publishTime: i, fc2Source} = this.findCarNumAndHref(t);
                let s = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10"), o = "";
                s.length && (o = s.text().trim().split(",")[0].replace("(無碼)", "")), utils.q(e, `是否屏蔽番号 ${n}?`, (async () => {
                    try {
                        o || (o = await this.parseActressName(a)), await this.getRuntimeService("state").patch(n, { blocked: !0 }, { record: { carNum: n, url: a, names: o, publishTime: i, fc2Source } }), show.ok("操作成功");
                    } catch (s) { clog.error("屏蔽操作失败:", s), show.error("操作失败"); }
                }));
            } catch (t) { clog.error("右键菜单处理失败:", t); }
        }));
    }
    /** 从任意列表卡片进入统一详情导航。 */
    /** @param {any} item @param {{ event?: MouseEvent | null, autoplay?: boolean, newTab?: boolean }} [options] */
    async openMovieDetail(item, { event = null, autoplay = !1, newTab = !1 } = {}) {
        const card = item?.jquery ? item : $(item), {carNum, aHref} = this.findCarNumAndHref(card);
        if (!carNum || !aHref) return;
        const shouldOpenTab = newTab || !!event && (event.ctrlKey || event.metaKey || 1 === event.button);
        if (carNum.includes("FC2-")) return;
        const destination = new URL(aHref, window.location.origin);
        autoplay && destination.searchParams.set("autoPlay", "1"), utils.openPage(destination.href, carNum, !0, { event, newTab: shouldOpenTab }), this.$currentImage = null;
    }
    /** 为宿主与合成列表统一绑定左键、修饰键和中键导航。 */
    /** @param {any} container */
    bindMovieDetailNavigation(container) {
        const root = $(container), selector = ".item img, .item .video-title";
        root.off("click.jhsMovieDetail auxclick.jhsMovieDetail", selector).on("click.jhsMovieDetail auxclick.jhsMovieDetail", selector, ((/** @type {any} */ event) => {
            if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
            if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
            event.preventDefault(), event.stopPropagation();
            void this.openMovieDetail($(event.currentTarget).closest(".item"), { event }).catch((error => clog.error("打开影片详情失败", error)));
        }));
    }
    /** @param {string} e */
    async parseActressName(e) {
        let t = null;
        if (await storageManager.getSetting("enableSaveActressCarInfo", C) === _) {
            clog.debug("鉴定补录演员信息-已启用, 开始解析详情页"), clog.debug("开始解析演员详情页", e);
            const scope = await this.getRuntimeService("scope")();
            const n = await requestHostPage(this.getRuntimeService("http"), e, scope), a = utils.htmlTo$dom(n);
            r ? t = a.find(".female").prev().map(((/** @type {number} */ e, /** @type {Element} */ t) => $(t).text())).get().join(" ") : l && (t = a.find('span[onmouseover*="star_"] a').map(((/** @type {number} */ e, /** @type {Element} */ t) => $(t).text())).get().join(" ")),
            clog.debug("解析到名称:", t);
        }
        return t;
    }
    /** @param {JQueryHandle} e */
    findCarNumAndHref(e) {
        try { return readListItem(e); } catch (error) { show.error("提取番号信息失败"); throw error; }
    }
    /** @param {string} e */
    showCarNumBox(e) {
        const t = this.getRuntimeService("host").locateListItems().find((/** @type {Element} */ t) => $(t).find(".video-title strong").text() === e);
        if (t) {
            const n = $(t);
            n.attr("data-hide") === "yes" && (n.show(), n.removeAttr("data-hide"));
        }
    }
    /** @param {HTMLImageElement} e */
    _replaceSingleHdImg(e) {
        if ("true" === e.dataset.hdReplaced) return;
        const originalSrc = e.currentSrc || e.src;
        let upgradedSrc = e.dataset.full || originalSrc;
        if (r) {
            const isJavdbCdn = /jdbstatic\.com|javdb\.com/i.test(originalSrc);
            if (isJavdbCdn) {
                upgradedSrc = upgradedSrc.replace("thumbs", "covers");
                e.dataset.full = upgradedSrc;
                e.dataset.hdReplaced = "true";
                e.title = "";
            }
        } else if (l) {
            const t = /\/(imgs|pics)\/(thumb|thumbs)\//, n = /(\.jpg|\.jpeg|\.png)$/i;
            t.test(originalSrc) ? (upgradedSrc = upgradedSrc.replace(t, "/$1/cover/").replace(n, "_b$1"), e.dataset.full = upgradedSrc, e.dataset.hdReplaced = "true",
            e.dataset.title = e.title, e.title = "") : /ps(\.jpg|\.jpeg|\.png)$/i.test(originalSrc) && (upgradedSrc = upgradedSrc.replace(/ps(\.jpg|\.jpeg|\.png)$/i, "pl$1"), e.dataset.full = upgradedSrc,
            e.dataset.hdReplaced = "true", e.dataset.title = e.title, e.title = "");
        }
        if ("true" !== e.dataset.hdReplaced || upgradedSrc === originalSrc) return;
        e.src = upgradedSrc;
        e.onerror = function() {
            if (this.src !== originalSrc) this.src = originalSrc;
            this.onerror = null;
        };
    }
    /** 先完成当前缩略图请求，再升级为高清图，避免取消首屏可见内容。 @param {HTMLImageElement} image */
    _scheduleHdUpgrade(image) {
        if ("true" === image.dataset.hdReplaced || "true" === image.dataset.jhsHdPending) return;
        if (image.complete) return void this._replaceSingleHdImg(image);
        image.dataset.jhsHdPending = "true";
        const finish = () => {
            image.removeEventListener("load", finish), image.removeEventListener("error", finish), delete image.dataset.jhsHdPending, this.hdPendingCleanups.delete(image), this._replaceSingleHdImg(image);
        }, cleanup = () => {
            image.removeEventListener("load", finish), image.removeEventListener("error", finish), delete image.dataset.jhsHdPending;
        };
        this.hdPendingCleanups.set(image, cleanup), image.addEventListener("load", finish, { once: !0 }), image.addEventListener("error", finish, { once: !0 });
    }
    /** @param {any} [e] */
    replaceHdImg(e) {
        if (e && "string" == typeof e.jquery && (e = e.toArray()), e || (e = document.querySelectorAll(this.getSelector().coverImgSelector)),
        !e.length) return;
        const t = Array.from(/** @type {Iterable<HTMLImageElement>} */ (e)).filter((/** @type {HTMLImageElement} */ e) => "true" !== e.dataset.hdReplaced && "true" !== e.dataset.jhsHdObserved);
        if ("IntersectionObserver" in window && !this.hdImageObserver) this.hdImageObserver = new IntersectionObserver((entries => {
            entries.forEach((entry => {
                const image = /** @type {HTMLImageElement} */ (entry.target);
                entry.isIntersecting && (this.hdImageObserver?.unobserve(image), delete image.dataset.jhsHdObserved,
                this._scheduleHdUpgrade(image));
            }));
        }), { rootMargin: "200px" });
        for (const image of t) image.decoding = "async", this.hdImageObserver ? (image.dataset.jhsHdObserved = "true",
        this.hdImageObserver.observe(image)) : this._scheduleHdUpgrade(image);
    }
    /** hoverBigImg 唯一生命周期入口：ON→绑定，OFF→销毁。 */
    /** @param {string} enabled */
    configureHoverPreview(enabled) {
        const runtimeWindow = /** @type {any} */ (window);
        if (this.hoverPreviewState === enabled && ("no" === enabled || runtimeWindow.imageHoverPreviewObj)) return;
        if (runtimeWindow.imageHoverPreviewObj) {
            runtimeWindow.imageHoverPreviewObj.destroy?.(), runtimeWindow.imageHoverPreviewObj = null;
        }
        if ("yes" === enabled) runtimeWindow.imageHoverPreviewObj = new ImageHoverPreview({ selector: this.getSelector().coverImgSelector });
        this.hoverPreviewState = enabled;
    }
    /** @param {JQueryHandle} e @param {string} t @param {string} n */
    applyTranslatedTitle(e, t, n) {
        const a = e.find(".video-title");
        r ? (a.contents().each(((/** @type {number} */ index, /** @type {Node} */ node) => {
            3 !== node.nodeType || "" === (node.textContent || "").trim() || (node.textContent || "").includes(n) || (node.textContent = " " + t + " ");
        })), a.attr("title", t)) : a.text(t), e.attr("data-jhs-translation-key", n);
    }
    /** 使在途列表翻译作废（Translate OFF 时调用）。 */
    invalidateTranslations() {
        this.translationGeneration++;
    }
    /** @param {Element|JQueryHandle} input */
    async translate(input) {
        const e = input?.jquery ? input : $(input);
        if (!e.length) return;
        let t, n, a = e.find(".video-title");
        if (r ? (t = a.contents().filter(((/** @type {number} */ e, /** @type {Node} */ t) => 3 === t.nodeType && "" !== (t.textContent || "").trim())).text().trim(),
        n = e.find(".video-title strong").text().trim()) : (t = (e.find("img").attr("data-title") || "").trim(),
        n = (e.find("a").attr("href") || "").split("/").filter(Boolean).pop()?.trim()), !t || !n) return;
        const generation = this.translationGeneration, settings = this.getRuntimeService("settings");
        const scope = await this.getRuntimeService("scope")();
        const translated = await this.getRuntimeService("translation").translate(t, { cacheAlias: n, scope });
        if (generation !== this.translationGeneration || (settings?.snapshot?.().translateTitle ?? _) !== _) return;
        this.applyTranslatedTitle(e, translated, n);
    }
    async revertTranslation() {
        $(this.getSelector().itemSelector).toArray().forEach((/** @type {Element} */ e) => {
            let t = $(e);
            const n = t.find(".box").attr("title") || t.find(".video-title").attr("title") || t.find("img").attr("data-title");
            /** @type {string | undefined} */
            let a;
            r && (a = t.find(".video-title strong").text().trim());
            const i = t.find(".video-title");
            i.contents().each(((/** @type {number} */ index, /** @type {Node} */ node) => {
                3 !== node.nodeType || "" === (node.textContent || "").trim() || (node.textContent || "").includes(a || "") || (node.textContent = " " + n + " ");
            })), i.removeAttr("title");
        });
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
        a.on("click", s), n.on("keypress", (function(/** @type {any} */ e) {
            13 === e.which && (s(), e.preventDefault());
        }));
    }
}
