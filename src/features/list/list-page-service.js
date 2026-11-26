// @ts-check
import { createTimers } from "../../core/timing.js";
import { _, normalizeCarNum } from "../../core/constants.js";
import { PRIMARY_QUICK_FILTERS, QUICK_FILTER_LABELS, SECONDARY_QUICK_FILTERS, normalizeQuickFilterKey } from "../../core/list-filters.js";
import { ListItemIndex } from "../../features/list/list-item-index.js";
import { ListRefreshCoordinator } from "../../features/list/list-refresh-coordinator.js";
import { createQuickFilter, applyVisibility, setQuickFilter, syncQuickFilterUi, rememberTagExpand, doFilter, doFilterItems, yieldListFrame, createEvaluationContext, getFilterContext, collectCurrentPageSummary, getCurrentPageSummary, recountStatuses, publishListSummary, scheduleRecount, filterMovieList } from "./list-page-filtering.js";
import { translateListItems, bindClick, openMovieDetail, bindMovieDetailNavigation, parseActressName, findCarNumAndHref, showCarNumBox, _replaceSingleHdImg, _scheduleHdUpgrade, replaceHdImg, configureHoverPreview, applyTranslatedTitle, invalidateTranslations, translate, revertTranslation } from "./list-page-card-actions.js";
/** settings-changed 中需要触发列表全量重判定的 key；其余（主题/Preview/截图/布局等）由各自 Feature 精确处理。 */
const LIST_EFFECT_KEYS = new Set([ "tagPosition", "defaultQuickFilterTab", "enableFavoriteActresses" ]);

/** @template {(...args: any[]) => unknown} F @typedef {Parameters<F> extends [any, ...infer Args] ? Args : never} ActionArgs */
export class ListPageService {
    /** Exposes the List Feature's filter vocabulary to compatible UI surfaces. */
    getQuickFilterCatalog() {
        return Object.freeze({
            primary: PRIMARY_QUICK_FILTERS,
            secondary: SECONDARY_QUICK_FILTERS,
            labels: QUICK_FILTER_LABELS,
            normalize: normalizeQuickFilterKey,
        });
    }
    async initCss() {
        return `<style>.status-tag .tag{color:inherit!important}.jhs-quick-filter{display:flex;align-items:center;gap:var(--jhs-space-1);min-width:0}.jhs-quick-filter__more{position:relative}.jhs-quick-filter__menu{min-width:190px}.jhs-filter-menu__separator{height:1px;margin:var(--jhs-space-1) 0;background:var(--jhs-border)}</style>`;
    }
    /** @param {{runtimeServices?: Record<string, any>, refreshHistory?: () => Promise<unknown>, controllers?: Record<string, any>, readTranslation?: () => any}} [options] */
    constructor(options = {}) {
        this.time = createTimers();
        this.runtimeServices = Object.freeze({ ...(options.runtimeServices ?? {}) });
        this.logger = this.runtimeServices.logger ?? {
            debug: console.debug.bind(console),
            error: console.error.bind(console),
            html: console.log.bind(console),
        };
        this.refreshHistory = options.refreshHistory;
        this.controllers = options.controllers ?? {};
        this.readTranslation = options.readTranslation ?? (() => null);
        this.managedByFeature = true;
        this.runtimeStatus = "managed-feature";
        /** @type {import("../../features/list/list-view.js").ListView | null} */ this.listView = null;
        this.currentPageFilterCount = 0;
        this.currentPageFavoriteCount = 0;
        this.currentPageHasDownCount = 0;
        this.currentPageHasWatchCount = 0;
        this.currentPageKeywordFilterCount = 0;
        this.currentPageActorFilterCount = 0;
        this.currentPageWaitCheckCount = 0;
        this.currentPageTotalCount = 0;
        /** @type {any} */ this.filterContext = null;
        /** @type {import("../../features/list/list-filter-context.js").ListFilterContextProvider | null} */ this.filterContextProvider = null;
        /** @type {import("../../features/list/list-card-state-presenter.js").ListCardStatePresenter | null} */ this.cardStatePresenter = null;
        /** @type {Set<Element>} */ this.pendingItems = new Set();
        /** @type {ReturnType<typeof setTimeout> | null} */ this.processTimer = null;
        /** @type {IntersectionObserver | null} */ this.hdImageObserver = null;
        /** @type {Map<HTMLImageElement, () => void>} */ this.hdPendingCleanups = new Map();
        /** @type {any} */ this.fallbackHoverPreview = null;
        this.writeQueue = Promise.resolve();
        /** @type {Set<string>} */ this.pendingStateCarNums = new Set();
        /** @type {string | null} */ this.pendingStateTransactionId = null;
        /** @type {Promise<boolean> | null} */ this.stateRefreshPromise = null;
        this.stateRefreshDisposed = false;
        this.stateRefreshReady = true;
        /** @type {Map<string, Set<Element>>} */ this.itemIndex = new Map();
        /** @type {ListItemIndex | null} */ this.listItemIndex = null;
        /** @type {import("../../features/list/list-dom-observer.js").ListDomObserver | null} */ this.listDomObserver = null;
        /** @type {number | null} */ this.recountFrame = null;
        /** @type {any} */ this.$currentImage = null;
        /** @type {number} */ this.translationGeneration = 0;
        /** @type {number} */ this.listGeneration = 0;
        /** @type {number} */ this.filterRevision = 0;
        /** @type {ListRefreshCoordinator | null} */ this.legacyListRefreshCoordinator = null;
        /** @type {import("../../features/list/list-batch-controller.js").ListBatchController | null} */ this.listBatchController = null;
        /** @type {import("../../features/list/list-sort-controller.js").ListSortController | null} */ this.listSortController = null;
    }
    get featureListHoverPreviewAdapter() { return this.controllers.hoverPreview; }
    get featureListTagExpansionAdapter() { return this.controllers.tagExpansion; }
    get featureListNavigationAdapter() { return this.controllers.navigation; }
    get featureCoverButtonAdapter() { return this.controllers.coverButtons; }
    getName() {
        return "ListPagePlugin";
    }
    getSelector() {
        const host = this.getRuntimeService("host");
        return host.getLiveListSelectors?.() ?? host.getListSelectors();
    }
    /** @param {string} name */
    getRuntimeService(name) {
        const service = this.runtimeServices[name];
        if (service === undefined) throw new Error(`List compatibility service is unavailable: ${name}`);
        return service;
    }
    getCoverButtonCapability() {
        return Object.freeze({
            getSelector: () => this.getRuntimeService("host").getCardEnhancementSelectors?.() ?? this.getSelector(),
            findCarNumAndHref: (/** @type {any} */ item) => this.findCarNumAndHref(item),
            parseActressName: (/** @type {string} */ url, /** @type {import("../../core/lifecycle-scope.js").LifecycleScope | undefined} */ scope = undefined) => this.parseActressName(url, scope),
        });
    }
    /** Exposes the cover upgrade operation required by native list pagination. */
    getAutoPageCapability() {
        return Object.freeze({
            replaceCoverImages: (/** @type {any} */ images) => this.replaceHdImg(images),
            getVisibilitySnapshot: () => this.controllers.items?.getVisibilitySnapshot?.() ?? null,
        });
    }
    /** Update the compatibility filter value and invalidate pending list generations. */
    /** @param {unknown} filter */
    beginQuickFilterTransition(filter) {
        this.filterRevision += 1;
        this.activeQuickFilter = normalizeQuickFilterKey(filter);
        this.recordListPhase("setQuickFilter");
    }
    /** @param {import("../../features/list/list-card-state-presenter.js").ListCardStatePresenter} presenter */
    attachCardStatePresenter(presenter) {
        this.cardStatePresenter = presenter;
        return () => { if (this.cardStatePresenter === presenter) this.cardStatePresenter = null; };
    }
    /** @param {import("../../features/list/list-filter-context.js").ListFilterContextProvider} provider */
    attachFilterContextProvider(provider) {
        this.filterContextProvider = provider;
        return () => {
            if (this.filterContextProvider !== provider) return;
            this.filterContextProvider = null;
            this.filterContext = null;
        };
    }
    /** @param {import("../../features/list/list-sort-controller.js").ListSortController | null} controller */
    setSortController(controller) { this.listSortController = controller; }
    /** @param {{scope?: any, view?: import("../../features/list/list-view.js").ListView | null, itemIndex?: ListItemIndex | null, observer?: import("../../features/list/list-dom-observer.js").ListDomObserver | null, batchController?: import("../../features/list/list-batch-controller.js").ListBatchController | null, featureOwnsStartup?: boolean}} [options] */
    async handle(options = {}) {
        if (!window.isListPage) return;
        const scope = options.scope || await this.getRuntimeService("scope")();
        this.listView = options.view ?? null;
        this.listItemIndex = options.itemIndex ?? null;
        this.listDomObserver = options.observer ?? null;
        this.listBatchController = options.batchController ?? null;
        scope.addCleanup(() => { if (this.listBatchController === options.batchController) this.listBatchController = null; });
        const settingsService = this.getRuntimeService("settings");
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
            if (names.includes("hoverBigImg")) this.configureHoverPreview(settingsService.snapshot().hoverBigImg === "yes" ? "yes" : "no");
        };
        if (!this.controllers.hoverPreview) {
            settingsService.addEventListener("settings.changed", onSettingsChanged);
            scope.addCleanup((() => settingsService.removeEventListener("settings.changed", onSettingsChanged)));
        }
        let lastSyncRefresh = "";
        const refreshAll = async (/** @type {any} */ payload = {}, /** @type {string} */ type = "") => {
                // 6.5 收敛：settings-changed 只对列表判定相关 key 全量刷新；主题/Preview/截图/布局
                // 等由各自 Feature 精确处理，不再触发 doFilter/applyVisibility/History setData。
                if (type === "new-video-changed" && payload?.reason === "favorite-profile-backfill") return;
                if (payload.notificationId && payload.notificationId === lastSyncRefresh) return;
                const changedNames = /** @type {string[] | undefined} */ (payload?.changedNames);
                if (changedNames && (!payload.changedDomains || payload.changedDomains.every((/** @type {string} */ key) => key === "setting")) && !changedNames.some((name) => LIST_EFFECT_KEYS.has(name))) return;
                await this.requestListRefresh({ reason: "event-refresh", full: true });
                if (payload.notificationId) lastSyncRefresh = payload.notificationId;
        };
        const events = this.getRuntimeService("events");
        [ "legacy-refresh", "blacklist-rules-changed", "filter-rules-changed", "settings-changed", "new-video-changed", "actress-changed" ].forEach((type => scope.addCleanup(events.on(type, (/** @type {any} */ payload) => refreshAll(payload, type))))),
        scope.addCleanup(events.on("car-state-changed", (async (/** @type {any} */ payload, /** @type {any} */ event) => {
            if (payload.notificationId && payload.notificationId === lastSyncRefresh) return;
            const full = Boolean(payload.scope === "all" || !Array.isArray(payload.carNums)
                || payload.changedDomains?.some((/** @type {string} */ key) => ["setting", "blacklist", "blacklist_car_list", "filter_keyword_title", "favorite_actresses"].includes(key)));
            const refreshed = full ? await this.requestListRefresh({ reason: "car-state-changed", full: true }) : await this.refreshCarNums(payload.carNums, event?.originId === events.originId ? payload.transactionId : null);
            if (!full && refreshed !== false) {
                const update = this.refreshHistory?.();
                update?.catch?.((/** @type {unknown} */ error) => this.logger.error("鉴定记录刷新失败", error));
            }
            if (payload.notificationId) lastSyncRefresh = payload.notificationId;
        })));
        scope.addCleanup(() => {
            this.stateRefreshDisposed = true;
            this.pendingStateCarNums.clear();
            this.processTimer && clearTimeout(this.processTimer), this.processTimer = null, this.pendingItems.clear();
            this.hdImageObserver?.disconnect(), this.hdImageObserver = null;
            this.hdPendingCleanups.forEach((cleanup) => cleanup()), this.hdPendingCleanups.clear();
            if (!this.controllers.hoverPreview) this.configureHoverPreview("no");
            this.recountFrame && (globalThis.cancelAnimationFrame?.(this.recountFrame) ?? clearTimeout(this.recountFrame)), this.recountFrame = null;
            this.advanceListGeneration(), this.legacyListRefreshCoordinator?.dispose(), this.legacyListRefreshCoordinator = null;
            if (options.view) $(this.getSelector().boxSelector).off(".jhsListMenu");
            else $(this.getSelector().boxSelector).off(".jhsMovieDetail .jhsListVideo .jhsListMenu"), $("#jhs-quick-filter").off();
            this.itemIndex.clear();
            this.listItemIndex = null, this.listDomObserver = null;
        });
        if (options.featureOwnsStartup) return;
        // 原生榜单与普通列表共用卡片处理和状态刷新监听。
        const hoverBigImg = settingsService.snapshot().hoverBigImg;
        if (!this.controllers.hoverPreview) this.configureHoverPreview(hoverBigImg === _ ? "yes" : "no");
        if (!this.listView) this.replaceHdImg();
        const revision = this.advanceListGeneration();
        await this.doFilter(revision), await this.createQuickFilter(), this.reconcileListItems(null, revision), await this.bindClick(),
        this.rememberTagExpand(),
        $(this.getSelector().itemSelector).attr("data-jhs-processed", "true"), this.rebuildItemIndex(), await events.emit("list-items-added", { items: $(this.getSelector().itemSelector).toArray() }, { broadcast: !1 }),
        this.checkDom(scope);
    }
    /** @returns {string} */
    advanceListGeneration() {
        this.listGeneration += 1;
        return this.captureListRevision();
    }
    /** @returns {string} */
    captureListRevision() {
        return `${this.listGeneration}:${this.filterRevision}`;
    }
    /** @param {string} revision */
    isCurrentListGeneration(revision) {
        return revision === this.captureListRevision();
    }
    /** @param {string} phase @param {number | null} [itemCount] */
    recordListPhase(phase, itemCount = null) {
        this.runtimeServices.diagnostics?.recordWork?.(`list.${phase}`, itemCount ?? 0);
        const diagnostics = /** @type {any} */ (globalThis).__jhsBrowserDiagnostics;
        if (!diagnostics) return;
        const phases = diagnostics.listPhases ||= [];
        const count = itemCount ?? this.controllers.items?.getBoundItemCount?.() ?? $(this.getSelector().itemSelector).length;
        phases.push({ phase, generation: this.listGeneration, filterRevision: this.filterRevision, activeQuickFilter: this.activeQuickFilter || "waitCheck", itemCount: count });
        phases.length > 200 && phases.splice(0, phases.length - 200);
    }
    /** @param {Element[] | null} items @param {string} revision */
    reconcileListItems(items, revision) {
        if (!this.isCurrentListGeneration(revision)) return !1;
        this.applyVisibility(items);
        return !0;
    }
    /** @param {{stateOnly?: boolean, transactionId?: string | null, carNums?: string[]}} [options] */
    invalidateListRefreshContext({ stateOnly = false, transactionId = null, carNums = [] } = {}) {
        this.filterContext = null;
        if (stateOnly && this.filterContextProvider) {
            const state = this.getRuntimeService("state");
            const readCommitted = transactionId ? () => state.getCommittedListSnapshot?.(transactionId, carNums) : null;
            this.filterContextProvider.invalidateState(readCommitted);
        } else this.filterContextProvider?.invalidate();
    }
    createListRefreshCoordinator() {
        return new ListRefreshCoordinator({
            advanceGeneration: () => this.advanceListGeneration(),
            captureRevision: () => this.captureListRevision(),
            isCurrent: (revision) => this.isCurrentListGeneration(revision),
            recordPhase: (phase, itemCount) => this.recordListPhase(phase, itemCount),
            invalidateContext: () => this.invalidateListRefreshContext(),
            filterAll: (revision) => this.doFilter(revision),
            filterItems: (items, revision) => this.doFilterItems(items, revision),
            reconcile: (items, revision) => this.reconcileListItems(items, revision),
            syncHistory: () => this.refreshHistory?.(),
        });
    }
    /** Coalesces refresh work in List Feature with the same coordinator as the compatibility path. */
    /** @param {{items?: Element[] | null, reason?: string, full?: boolean, visibilityOnly?: boolean}} [options] */
    requestListRefresh(options = {}) {
        const coordinator = this.controllers.refresh || (this.legacyListRefreshCoordinator ||= this.createListRefreshCoordinator());
        return coordinator.request(options);
    }
    /** Broadcast and parent-close notices share one serial queue; only a new pass invalidates its snapshot. */
    /** @param {unknown[]} carNums @param {string | null} [transactionId] */
    refreshCarNums(carNums, transactionId = null) {
        if (this.stateRefreshDisposed) return Promise.resolve(false);
        for (const value of carNums) { const key = normalizeCarNum(value); if (key) this.pendingStateCarNums.add(key); }
        if (carNums.length) this.pendingStateTransactionId = transactionId;
        if (!this.stateRefreshReady) return Promise.resolve(false);
        if (this.stateRefreshPromise) return this.stateRefreshPromise;
        const run = async () => {
            while (this.pendingStateCarNums.size && !this.stateRefreshDisposed) {
                const keys = [...this.pendingStateCarNums], transactionId = this.pendingStateTransactionId; this.pendingStateCarNums.clear();
                this.pendingStateTransactionId = null;
                this.invalidateListRefreshContext({ stateOnly: true, transactionId, carNums: keys });
                let items = this.getIndexedItems(keys);
                if (!items.length || keys.some(key => !this.getIndexedItems([key]).length)) {
                    this.rebuildItemIndex();
                    items = this.getIndexedItems(keys);
                }
                if (items.length) await this.requestListRefresh({ items, reason: "car-state-changed", full: false });
            }
            return !this.stateRefreshDisposed;
        };
        this.stateRefreshPromise = Promise.resolve().then(run).finally(() => {
            this.stateRefreshPromise = null;
            if (this.pendingStateCarNums.size && !this.stateRefreshDisposed) void this.refreshCarNums([]).catch(error => this.logger.error("列表状态补刷失败", error));
        });
        return this.stateRefreshPromise;
    }
    createQuickFilter() { return createQuickFilter(this); }
    /** @param {ActionArgs<typeof applyVisibility>} args */
    applyVisibility(...args) { return applyVisibility(this, ...args); }
    /** @param {ActionArgs<typeof setQuickFilter>} args */
    setQuickFilter(...args) { return setQuickFilter(this, ...args); }
    syncQuickFilterUi() { return syncQuickFilterUi(this); }
    rememberTagExpand() { return rememberTagExpand(this); }
    /** @param {any} [scope] */
    checkDom(scope = null) {
        // 原生榜单与普通列表均观察宿主列表容器。
        if (!window.isListPage) return;
        if (this.listDomObserver) return this.listDomObserver.start();
        const e = this.getSelector(), t = document.querySelector(e.boxSelector);
        if (!t) return void this.logger.error("没有找到容器节点!");
        if (!scope) return;
        scope.observe(t, ((/** @type {MutationRecord[]} */ records) => {
            for (const record of records) {
                this.removeIndexedItems(record.removedNodes), record.addedNodes.length && (this.advanceListGeneration(), this.recordListPhase("dom-added", record.addedNodes.length));
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
                const items = [ ...this.pendingItems ].filter((/** @type {Element} */ item) => item.isConnected && "true" !== /** @type {HTMLElement} */ (item).dataset.jhsProcessed), revision = this.captureListRevision();
                this.pendingItems.clear(), this.processTimer = null, items.length && void this.processAddedItems(items, revision).catch((/** @type {unknown} */ error) => this.logger.error("列表增量处理失败", error));
            }), 100));
        }), {
            childList: !0,
            subtree: !1
        });
    }
    /** @param {Element[]} items @param {string} [revision] @returns {Promise<boolean | void>} */
    async processAddedItems(items, revision = this.captureListRevision()) {
        if (this.controllers.items) return this.controllers.items.processAddedItems(items, revision);
        const selector = this.getSelector(), covers = items.flatMap((/** @type {Element} */ item) => [ ...item.querySelectorAll(selector.coverImgSelector) ]);
        if (!this.listView) this.replaceHdImg(covers);
        const filtered = await this.requestListRefresh({ items, reason: "dom-added" });
        if (!filtered) return;
        await this.listSortController?.sortItems?.(), await this.controllers.coverButtons?.addSvgBtn?.(items),
        items.forEach((/** @type {Element} */ item) => /** @type {HTMLElement} */ (item).dataset.jhsProcessed = "true"), this.indexItems(items), await this.getRuntimeService("events").emit("list-items-added", { items }, { broadcast: !1 });
    }
    rebuildItemIndex() {
        this.itemIndex.clear();
        const items = $(this.getSelector().itemSelector).toArray();
        if (this.listItemIndex) {
            this.listItemIndex.rebuild(items);
            this.recordListPhase("rebuildItemIndex", items.length);
            return;
        }
        this.indexItems(items), this.recordListPhase("rebuildItemIndex", items.length);
    }
    /** @param {Element[]} items */
    indexItems(items) {
        if (this.listItemIndex) {
            this.listItemIndex.add(items);
            return;
        }
        items.forEach((/** @type {Element} */ item) => {
            try {
                const key = normalizeCarNum(this.findCarNumAndHref($(item)).carNum);
                if (!key) return;
                const indexed = this.itemIndex.get(key) || new Set;
                indexed.add(item), this.itemIndex.set(key, indexed);
            } catch (error) {
                this.logger.debug("列表项索引跳过无效卡片", error);
            }
        });
    }
    /** @param {NodeList | Node[]} nodes */
    removeIndexedItems(nodes) {
        if (this.listItemIndex) {
            this.listItemIndex.removeNodes(nodes, this.getSelector().itemSelector);
            return;
        }
        const removed = new Set;
        Array.from(nodes || []).forEach((/** @type {Node} */ node) => {
            const element = /** @type {Element} */ (node);
            node.nodeType === Node.ELEMENT_NODE && (removed.add(element), element.querySelectorAll?.(this.getSelector().itemSelector).forEach((/** @type {Element} */ item) => removed.add(item)));
        });
        if (!removed.size) return;
        const root = $(this.getSelector().boxSelector)[0];
        this.itemIndex.forEach(((/** @type {Set<Element>} */ items, /** @type {string} */ key) => {
            items.forEach((/** @type {Element} */ item) => { removed.has(item) && !root?.contains(item) && items.delete(item); }), items.size || this.itemIndex.delete(key);
        }));
    }
    /** @param {unknown[]} carNums */
    getIndexedItems(carNums) {
        if (this.listItemIndex) return this.listItemIndex.get(carNums);
        const result = new Set;
        carNums.map(normalizeCarNum).forEach((/** @type {string | null} */ key) => {
            if (!key) return;
            const items = this.itemIndex.get(key);
            items?.forEach((/** @type {Element} */ item) => item.isConnected ? result.add(item) : items.delete(item)), items && !items.size && this.itemIndex.delete(key);
        });
        return [ ...result ];
    }
    /** @param {ActionArgs<typeof doFilter>} args */
    doFilter(...args) { return doFilter(this, ...args); }
    /** @param {ActionArgs<typeof doFilterItems>} args */
    doFilterItems(...args) { return doFilterItems(this, ...args); }
    yieldListFrame() { return yieldListFrame(this); }
    createEvaluationContext() { return createEvaluationContext(this); }
    getFilterContext() { return getFilterContext(this); }
    collectCurrentPageSummary() { return collectCurrentPageSummary(this); }
    getCurrentPageSummary() { return getCurrentPageSummary(this); }
    recountStatuses() { return recountStatuses(this); }
    /** @param {ActionArgs<typeof publishListSummary>} args */
    publishListSummary(...args) { return publishListSummary(this, ...args); }
    scheduleRecount() { return scheduleRecount(this); }
    /** @param {ActionArgs<typeof translateListItems>} args */
    translateListItems(...args) { return translateListItems(this, ...args); }
    /** @param {ActionArgs<typeof filterMovieList>} args */
    filterMovieList(...args) { return filterMovieList(this, ...args); }
    /**
     * Batch-mark every item matching the current quick filter across all pages.
     * 语义：全部 = 包含 hard-hidden 的真全集；其他筛选 = 全部分页中符合该筛选的项。
     * @param {{ kind?: "actor" | "search", displayName?: string, recordName?: string }} scope
     * @param {string} flag @param {{ filter?: unknown, confirm?: boolean, root?: any }} [options]
     */
    async batchSaveAllVideos(scope, flag, options = {}) {
        if (!this.listBatchController) throw new Error("List Feature 批处理控制器尚未就绪");
        return this.listBatchController.run(scope, flag, options);
    }
    bindClick() { return bindClick(this); }
    /** @param {ActionArgs<typeof openMovieDetail>} args */
    openMovieDetail(...args) { return openMovieDetail(this, ...args); }
    /** @param {ActionArgs<typeof bindMovieDetailNavigation>} args */
    bindMovieDetailNavigation(...args) { return bindMovieDetailNavigation(this, ...args); }
    /** @param {ActionArgs<typeof parseActressName>} args */
    parseActressName(...args) { return parseActressName(this, ...args); }
    /** @param {ActionArgs<typeof findCarNumAndHref>} args */
    findCarNumAndHref(...args) { return findCarNumAndHref(this, ...args); }
    /** @param {ActionArgs<typeof showCarNumBox>} args */
    showCarNumBox(...args) { return showCarNumBox(this, ...args); }
    /** @param {ActionArgs<typeof _replaceSingleHdImg>} args */
    _replaceSingleHdImg(...args) { return _replaceSingleHdImg(this, ...args); }
    /** @param {ActionArgs<typeof _scheduleHdUpgrade>} args */
    _scheduleHdUpgrade(...args) { return _scheduleHdUpgrade(this, ...args); }
    /** @param {ActionArgs<typeof replaceHdImg>} args */
    replaceHdImg(...args) { return replaceHdImg(this, ...args); }
    /** @param {ActionArgs<typeof configureHoverPreview>} args */
    configureHoverPreview(...args) { return configureHoverPreview(this, ...args); }
    /** @param {ActionArgs<typeof applyTranslatedTitle>} args */
    applyTranslatedTitle(...args) { return applyTranslatedTitle(this, ...args); }
    invalidateTranslations() { return invalidateTranslations(this); }
    /** @param {ActionArgs<typeof translate>} args */
    translate(...args) { return translate(this, ...args); }
    revertTranslation() { return revertTranslation(this); }
}
