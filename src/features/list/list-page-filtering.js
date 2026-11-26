// @ts-check

import { B, C, _, b, escapeHtml, k, l, normalizeCarNum, o, r, u, y } from "../../core/constants.js";
import { getIcon } from "../../core/icons.js";
import { readCardNames, readCardStarIds } from "../../core/list-item-reader.js";
import { buildFavoriteActressWorkIndex, resolveFavoriteActressHighlightStyle } from "../../core/favorite-actress-highlight.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { PRIMARY_QUICK_FILTERS, QUICK_FILTER_LABELS, SECONDARY_QUICK_FILTERS, isHardHidden, normalizeQuickFilterKey, shouldShowItem } from "../../core/list-filters.js";
import { createListEvaluationContext, evaluateListItem, findMatchedTitleKeyword } from "../../features/list/list-evaluator.js";
import { syncQuickFilterPresentation } from "./list-view.js";

/** @typedef {import("./list-page-service.js").ListPageService} ListPageService */
/** @typedef {Record<string, any>} ListRecord */

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

/** @param {ListPageService} owner */
export async function createQuickFilter(owner) {
    if (owner.listView) {
        owner.activeQuickFilter = normalizeQuickFilterKey(owner.activeQuickFilter || (owner.getRuntimeService("settings").snapshot().defaultQuickFilterTab ?? "waitCheck"));
        return owner.listView.createQuickFilter(owner.activeQuickFilter);
    }
    if ($("#jhs-quick-filter").length) return;
    const e = owner.getSelector(), primaryHtml = PRIMARY_QUICK_FILTERS.map((filter => `<button type="button" role="tab" class="jhs-btn jhs-segmented__item" aria-selected="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
        secondaryHtml = SECONDARY_QUICK_FILTERS.map(((filter, index) => `${1 === index ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-filter-option" aria-checked="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
        t = `<div id="jhs-quick-filter" class="jhs-quick-filter">
            <div class="jhs-quick-filter__primary jhs-segmented" role="tablist" aria-label="状态筛选">${primaryHtml}</div>
            <div class="jhs-quick-filter__more">
                <button type="button" class="jhs-btn jhs-btn--secondary jhs-quick-filter__toggle" aria-haspopup="menu" aria-expanded="false"><span class="jhs-quick-filter__label">更多筛选</span>${getIcon("chevron-down")}</button>
                <div class="jhs-popover jhs-commandbar__menu jhs-quick-filter__menu" role="menu" aria-label="更多筛选">${secondaryHtml}</div>
            </div>
        </div>`;
    r ? $(e.boxSelector).before(t) : l && $(".masonry").before(t);
    const root = $("#jhs-quick-filter"), toggle = root.find(".jhs-quick-filter__toggle"), menu = root.find(".jhs-quick-filter__menu"), closeMenu = (restoreFocus = !1) => {
        menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), restoreFocus && toggle.trigger("focus");
    };
    root.on("click", ".jhs-segmented__item", ((/** @type {any} */ event) => owner.setQuickFilter($(event.currentTarget).data("jhs-filter"))))
        .on("keydown", ".jhs-segmented__item", ((/** @type {any} */ event) => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
            event.preventDefault(), event.stopPropagation();
            const tabs = root.find(".jhs-segmented__item"), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            tabs.eq(next).trigger("click").trigger("focus");
        })).on("click", ".jhs-filter-option", ((/** @type {any} */ event) => {
            owner.setQuickFilter($(event.currentTarget).data("jhs-filter")), closeMenu(!0);
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
    owner.activeQuickFilter || (owner.activeQuickFilter = normalizeQuickFilterKey((owner.getRuntimeService("settings").snapshot().defaultQuickFilterTab ?? "waitCheck"))), owner.applyVisibility(), owner.syncQuickFilterUi();
}

/** @param {Element[] | null} [items]
 * @param {ListPageService} owner
 */
export function applyVisibility(owner, items = null) {
    const e = owner.activeQuickFilter || "waitCheck", t = owner.getSelector().itemSelector;
    const elements = items ? $(items) : $(t);
    owner.recordListPhase("applyVisibility", elements.length);
    if (owner.listView) return owner.listView.applyVisibility(items, e);
    elements.each(((/** @type {number} */ index, /** @type {Element} */ element) => {
        const t = $(element), flags = normalizeStateFlags(JSON.parse(t.attr("data-jhs-flags") || "{}")), visibilityReasons = JSON.parse(t.attr("data-jhs-visibility") || "{}"), recent = "yes" === t.attr("data-jhs-recent");
        shouldShowItem({ filter: e, flags, visibilityReasons, recent }) ? t.show() : t.hide();
    }));
}

/** @param {unknown} filter
 * @param {ListPageService} owner
 */
export function setQuickFilter(owner, filter, /** @type {{syncUi?: boolean}} */ { syncUi = !0 } = {}) {
    owner.filterRevision += 1, owner.activeQuickFilter = normalizeQuickFilterKey(filter), owner.listView?.setActiveFilter(owner.activeQuickFilter), owner.recordListPhase("setQuickFilter"), void owner.requestListRefresh({ reason: "quick-filter", visibilityOnly: true })?.catch((/** @type {unknown} */ error) => owner.logger.error("列表筛选刷新失败", error)), owner.reconcileListItems(null, owner.captureListRevision()), syncUi && owner.syncQuickFilterUi();
}

/** @param {ListPageService} owner */
export function syncQuickFilterUi(owner) {
    if (owner.listView) return owner.listView.syncQuickFilterUi(owner.activeQuickFilter);
    const filter = normalizeQuickFilterKey(owner.activeQuickFilter), root = $("#jhs-quick-filter");
    syncQuickFilterPresentation(root, root.find(".jhs-filter-option"), filter);
}

/** @param {ListPageService} owner */
export function rememberTagExpand(owner) {
    if (owner.controllers.tagExpansion) return owner.controllers.tagExpansion.start();
    if (!window.location.href.includes("actors")) return;
    const e = $(".tag-expand");
    if (0 === e.length) return;
    const storage = owner.getRuntimeService("storage"), t = "jhs_tag_expand", n = "true" === storage.getLocal(t), a = $(".actor-tags .content");
    n && a.hasClass("collapse") && e[0].click(), e.on("click", (() => {
        const e = !$(".actor-tags .content").hasClass("collapse");
        owner.logger.debug("触发"), storage.setLocal(t, e.toString());
    }));
}

/** @param {ListPageService} owner */
export async function doFilter(owner, revision = owner.captureListRevision()) {
    return owner.doFilterItems(null, revision);
}

/** @param {Element[] | null} [items] @param {string} [revision]
 * @param {ListPageService} owner
 */
export async function doFilterItems(owner, items = null, revision = owner.captureListRevision()) {
    if (!window.isListPage) return !1;
    let e = items ? $(items).toArray() : $(owner.getSelector().itemSelector).toArray();
    if (!e.length) return !0;
    const filtered = await owner.filterMovieList(e, revision);
    return filtered && l && setTimeout((() => {
        owner.getRuntimeService("busImageLayout")?.logImageHeightsByRow?.(owner.getRuntimeService("settings").snapshot()).catch((/** @type {unknown} */ e) => owner.logger.error("JavBus图片高度修正失败", e));
    })), filtered;
}

/** @param {ListPageService} owner */
export async function yieldListFrame(owner) {
    await new Promise((/** @type {(value: void) => void} */ e) => {
        window.requestAnimationFrame ? window.requestAnimationFrame((() => setTimeout(e))) : setTimeout(e);
    });
}

/** 供页面展示与跨页批量操作共用的唯一判定上下文。 */
/** @param {ListPageService} owner */
export async function createEvaluationContext(owner) {
    return createListEvaluationContext(await owner.getFilterContext());
}

/** @param {ListPageService} owner */
export async function getFilterContext(owner) {
    if (owner.filterContextProvider) {
        const context = await owner.filterContextProvider.get();
        owner.filterContext = context;
        return context;
    }
    if (owner.filterContext) return owner.filterContext;
    const rules = owner.getRuntimeService("keywordRules"), state = owner.getRuntimeService("state");
    const [titleKeywords, blacklistMap, blacklistCars, carMap, activity, favoriteActresses] = await Promise.all([
        rules.getTitleKeywords(), state.getBlacklistMap(), state.getBlacklistCarList(), state.getCarMap(), state.getActivityLog(), state.getFavoriteActressList(),
    ]);
    const settings = owner.getRuntimeService("settings").snapshot();
    const actorCarNumToNameMap = new Map(), actressCarNumToNameMap = new Map(), recentCarNums = new Set();
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
            owner.logger.error("黑名单数据源丢失演员信息", item);
            continue;
        }
        const target = role === B ? actorCarNumToNameMap : actressCarNumToNameMap, carNum = normalizeCarNum(item.carNum);
        target.has(carNum) || target.set(carNum, item.names);
    }
    const favoriteActressIndex = buildFavoriteActressWorkIndex(favoriteActresses);
    const favoriteActressHighlightEnabled = resolveFavoriteActressHighlightStyle(settings).enabled;
    return owner.filterContext = { titleKeywords, settings, carMap, recentCarNums, actorCarNumToNameMap, actressCarNumToNameMap, favoriteActressIndex, favoriteActressHighlightEnabled };
}

/** @param {ListPageService} owner */
export function collectCurrentPageSummary(owner) {
    if (owner.cardStatePresenter) return owner.cardStatePresenter.collectSummary();
    const summary = { total: 0, pending: 0, blockedItems: 0, favorite: 0, downloaded: 0, watched: 0, debug: { manualBlocked: 0, keywordBlocked: 0, actorBlocked: 0, actressBlocked: 0 } };
    $(owner.getSelector().itemSelector).each(((/** @type {number} */ e, /** @type {Element} */ item) => {
        const card = $(item);
        if (l && card.find(".avatar-box").length > 0) return;
        const flags = normalizeStateFlags(JSON.parse(card.attr("data-jhs-flags") || "{}")), reasons = JSON.parse(card.attr("data-jhs-visibility") || "{}"), hardHidden = isHardHidden(flags, reasons);
        summary.total++, flags.favorite && summary.favorite++, flags.downloaded && summary.downloaded++, flags.watched && summary.watched++, hardHidden && summary.blockedItems++,
        !hasAnyState(flags) && !hardHidden && summary.pending++, flags.blocked && summary.debug.manualBlocked++, reasons.keyword && summary.debug.keywordBlocked++, reasons.actorBlacklist && summary.debug.actorBlocked++, reasons.actressBlacklist && summary.debug.actressBlocked++;
    }));
    return summary;
}

/** @param {ListPageService} owner */
export function getCurrentPageSummary(owner) {
    return owner.collectCurrentPageSummary();
}

/** @param {ListPageService} owner */
export function recountStatuses(owner) {
    return owner.publishListSummary(owner.collectCurrentPageSummary());
}

/** @param {{favorite: number, downloaded: number, watched: number, pending: number, total: number, debug: {manualBlocked: number, keywordBlocked: number, actorBlocked: number, actressBlocked: number}}} summary
 * @param {ListPageService} owner
 */
export function publishListSummary(owner, summary) {
    owner.currentPageFilterCount = summary.debug.manualBlocked, owner.currentPageFavoriteCount = summary.favorite, owner.currentPageHasDownCount = summary.downloaded,
    owner.currentPageHasWatchCount = summary.watched, owner.currentPageKeywordFilterCount = summary.debug.keywordBlocked,
    owner.currentPageActorFilterCount = summary.debug.actorBlocked + summary.debug.actressBlocked, owner.currentPageWaitCheckCount = summary.pending,
    owner.currentPageTotalCount = summary.total;
    return summary;
}

/** @param {ListPageService} owner */
export function scheduleRecount(owner) {
    if (owner.recountFrame) return;
    const schedule = window.requestAnimationFrame || ((/** @type {FrameRequestCallback} */ callback) => setTimeout(callback, 0));
    owner.recountFrame = schedule((() => {
        owner.recountFrame = null, owner.recountStatuses();
    }));
}

/** @param {Element[]} e @param {string} [revision]
 * @param {ListPageService} owner
 */
export async function filterMovieList(owner, e, revision = owner.captureListRevision()) {
    owner.recordListPhase("doFilter-start", e.length);
    if (!owner.isCurrentListGeneration(revision)) return !1;
    const activeFilter = owner.activeQuickFilter || "waitCheck";
    owner.time("累计耗费时间"), owner.time("读取数据耗时");
    const {titleKeywords: n, settings: s, carMap: m, recentCarNums: recent, actorCarNumToNameMap: f, actressCarNumToNameMap: v} = await owner.getFilterContext(), o = owner.time("读取数据耗时");
    if (!owner.isCurrentListGeneration(revision)) return !1;
    const evaluationContext = createListEvaluationContext({ titleKeywords: n, settings: s, carMap: m, recentCarNums: recent, actorCarNumToNameMap: f, actressCarNumToNameMap: v });
    owner.time("组装数据耗时");
    const b = owner.time("组装数据耗时"), P = (null == s ? void 0 : s.tagPosition) || "rightTop";
    owner.currentPageFilterCount = 0, owner.currentPageFavoriteCount = 0, owner.currentPageHasDownCount = 0,
    owner.currentPageHasWatchCount = 0, owner.currentPageKeywordFilterCount = 0, owner.currentPageActorFilterCount = 0,
    owner.currentPageWaitCheckCount = 0, owner.currentPageTotalCount = 0, owner.time("处理页面耗时");
    const R = [];
    if (owner.cardStatePresenter) {
        const visibleItems = await owner.cardStatePresenter.processItems(e, {
            context: evaluationContext, filter: activeFilter, tagPosition: P,
            isCurrent: () => owner.isCurrentListGeneration(revision),
        });
        if (!visibleItems || !owner.isCurrentListGeneration(revision)) return !1;
        R.push(...visibleItems);
    } else {
        for (let n = 0; n < e.length; n++) {
            if (!owner.isCurrentListGeneration(revision)) return !1;
            n > 0 && n % 12 == 0 && await owner.yieldListFrame();
            let t = $(e[n]);
            if (l && t.find(".avatar-box").length > 0) continue;
            const rawRecord = owner.findCarNumAndHref(t);
            const record = evaluationContext.favoriteActressHighlightEnabled && evaluationContext.favoriteActressIndex?.hasActresses
                ? { ...rawRecord, cardNames: readCardNames(t[0] ?? t), cardStarIds: readCardStarIds(t[0] ?? t) }
                : rawRecord;
            const {carNum: a, title: i} = record, evaluation = evaluateListItem(record, evaluationContext, { filter: activeFilter }), {flags, visibilityReasons, hardHidden, favoriteActresses = []} = evaluation, keyword = visibilityReasons.keyword ? findMatchedTitleKeyword(evaluationContext.titleKeywords, i, a) : null;
            t.attr("data-jhs-flags", JSON.stringify(flags)).attr("data-jhs-visibility", JSON.stringify(visibilityReasons)).attr("data-jhs-recent", evaluation.recent ? _ : C).attr("data-jhs-tag-position", P);
            if (favoriteActresses.length) t.attr("data-jhs-favorite-actress", _).attr("data-jhs-favorite-actress-names", favoriteActresses.join("，"));
            else t.removeAttr("data-jhs-favorite-actress").removeAttr("data-jhs-favorite-actress-names");
            const signature = JSON.stringify({ flags, visibilityReasons, P, favoriteActresses });
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
    }
    owner.scheduleRecount(), void owner.translateListItems(R).catch((/** @type {unknown} */ e) => owner.logger.error("列表页翻译任务失败", e));
    owner.recordListPhase("doFilter-end", e.length);
    const D = owner.time("处理页面耗时"), A = owner.time("累计耗费时间");
    owner.logger.html(`\n            <table class="countTable jhs-layout-b12542a5">\n                <tr>\n                    <td colspan="2" class="jhs-count-table__cell">${o}</td>\n                    <td colspan="2" class="jhs-count-table__cell">${b}</td>\n                </tr>\n                \n                <tr>\n                    <td colspan="2" class="jhs-count-table__cell">${D}</td>\n                    <td colspan="2" class="jhs-count-table__cell">${A}</td>\n                </tr>\n                <tr>\n                    <td class="jhs-count-table__head">项目</td>\n                    <td class="jhs-count-table__head">数量</td>\n                    <td class="jhs-count-table__head">项目</td>\n                    <td class="jhs-count-table__head">数量</td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽单番号</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageFilterCount}</strong></td>\n                     <td class="jhs-count-table__cell">收藏</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageFavoriteCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽演员</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageActorFilterCount}</strong></td>\n                    <td class="jhs-count-table__cell">已下载</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageHasDownCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">屏蔽关键词</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageKeywordFilterCount}</strong></td>\n                    <td class="jhs-count-table__cell">已观看</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageHasWatchCount}</strong></td>\n                </tr>\n                \n                <tr>\n                    <td class="jhs-count-table__cell">待鉴定</td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageWaitCheckCount}</strong></td>\n                    <td class="jhs-count-table__cell"></td>\n                    <td class="jhs-count-table__cell"></td>\n                </tr>\n        \n                <tr>\n                    <td class="jhs-count-table__cell"><strong>总数</strong></td>\n                    <td class="jhs-count-table__cell"><strong>${owner.currentPageTotalCount}</strong></td>\n                </tr>\n            </table>\n        `);
}
