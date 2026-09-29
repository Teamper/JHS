// @ts-check

import { ListView } from "./list-view.js";
import { ListItemIndex } from "./list-item-index.js";
import { ListDomObserver } from "./list-dom-observer.js";
import { ListBatchController } from "./list-batch-controller.js";
import { ListSortController } from "./list-sort-controller.js";
import { ListFilterContextProvider } from "./list-filter-context.js";
import { LIST_CARD_STATE_STYLES, ListCardStatePresenter } from "./list-card-state-presenter.js";
import { LIST_PAGINATION_STYLES, ListPaginationController } from "./list-pagination-controller.js";
import { ListHostMarkupController } from "./list-host-markup-controller.js";
import { ListCoverImageController } from "./list-cover-image-controller.js";
import { ListContextMenuController } from "./list-context-menu-controller.js";
import { ListHoverPreviewController } from "./list-hover-preview-controller.js";
import { ListNavigationController } from "./list-navigation-controller.js";
import { ListTagExpansionController } from "./list-tag-expansion-controller.js";
import { normalizeQuickFilterKey } from "./list-filters.js";
import { ListRefreshCoordinator } from "./list-refresh-coordinator.js";

/** Own ListPagePlugin startup while its implementation migrates into FeatureRuntime. */
export class ListController {
    /** @param {{legacyPlugin: any, hostAdapter: any, scope: any, styles?: {register: (id: string, css: string) => () => void}, state?: any, storage?: any, legacyStorage?: any, readFilterSources?: () => Promise<any>, readCardIdentity?: (item: Element) => any, http?: any, settings?: any, navigation?: any, events?: any, coverButtons?: any, batchUi?: any, sortController?: ListSortController | null, busImageLayout?: any, ui?: any, notifications?: any, diagnostics?: any, logger?: Pick<Console, "error" | "debug">, window?: any}} options */
    constructor(options) {
        this.legacyPlugin = options.legacyPlugin;
        this.hostAdapter = options.hostAdapter;
        this.scope = options.scope;
        this.styles = options.styles ?? null;
        this.state = options.state ?? null;
        this.legacyStorage = options.legacyStorage ?? null;
        this.readFilterSources = options.readFilterSources ?? null;
        this.readCardIdentity = options.readCardIdentity ?? ((item) => this.legacyPlugin.findCarNumAndHref?.($(item)));
        this.http = options.http ?? null;
        this.settings = options.settings ?? null;
        this.window = options.window ?? globalThis.window ?? null;
        this.busImageLayout = options.busImageLayout ?? null;
        this.events = options.events ?? null;
        this.logger = options.logger ?? console;
        this.coverButtons = options.coverButtons ?? null;
        this.paginationController = new ListPaginationController({ hostAdapter: this.hostAdapter, navigation: options.navigation, scope: this.scope });
        this.hostMarkupController = new ListHostMarkupController({ hostAdapter: this.hostAdapter });
        this.coverImageController = new ListCoverImageController({ hostAdapter: this.hostAdapter, scope: this.scope, window: options.window });
        this.legacyPlugin.attachFeatureCoverImageAdapter?.(this.coverImageController);
        let coverImageAdapterAttached = true;
        this.detachCoverImageAdapter = () => {
            if (!coverImageAdapterAttached) return;
            coverImageAdapterAttached = false;
            this.coverImageController.dispose();
            this.legacyPlugin.detachFeatureCoverImageAdapter?.(this.coverImageController);
        };
        this.scope.addCleanup(this.detachCoverImageAdapter);
        this.hoverPreviewController = new ListHoverPreviewController({
            hostAdapter: this.hostAdapter, settings: this.settings, ui: options.ui, scope: this.scope, window: options.window,
        });
        this.hoverPreviewAdapterAttached = false;
        this.detachHoverPreviewAdapter = () => {
            if (this.hoverPreviewAdapterAttached) this.legacyPlugin.detachFeatureListHoverPreviewAdapter?.(this.hoverPreviewController);
            this.hoverPreviewAdapterAttached = false;
            this.hoverPreviewController.dispose();
        };
        this.scope.addCleanup(this.detachHoverPreviewAdapter);
        this.tagExpansionController = new ListTagExpansionController({
            hostAdapter: this.hostAdapter, storage: options.storage, scope: this.scope, diagnostics: options.diagnostics,
        });
        this.tagExpansionAdapterAttached = false;
        this.detachTagExpansionAdapter = () => {
            if (this.tagExpansionAdapterAttached) this.legacyPlugin.detachFeatureListTagExpansionAdapter?.(this.tagExpansionController);
            this.tagExpansionAdapterAttached = false;
            this.tagExpansionController.dispose();
        };
        this.scope.addCleanup(this.detachTagExpansionAdapter);
        this.listNavigationController = new ListNavigationController({
            hostAdapter: this.hostAdapter, list: this.legacyPlugin, ui: options.ui,
        });
        this.legacyPlugin.attachFeatureListNavigationAdapter?.(this.listNavigationController);
        let navigationAdapterAttached = true;
        this.detachListNavigationAdapter = () => {
            if (!navigationAdapterAttached) return;
            navigationAdapterAttached = false;
            this.listNavigationController.dispose();
            this.legacyPlugin.detachFeatureListNavigationAdapter?.(this.listNavigationController);
        };
        this.scope.addCleanup(this.detachListNavigationAdapter);
        this.contextMenuController = new ListContextMenuController({
            hostAdapter: this.hostAdapter, list: this.legacyPlugin, state: this.state,
            ui: options.ui, notifications: options.notifications, scope: this.scope, diagnostics: options.diagnostics,
        });
        this.legacyPlugin.attachFeatureListContextMenuAdapter?.(this.contextMenuController);
        let contextMenuAdapterAttached = true;
        this.detachContextMenuAdapter = () => {
            if (!contextMenuAdapterAttached) return;
            contextMenuAdapterAttached = false;
            this.contextMenuController.dispose();
            this.legacyPlugin.detachFeatureListContextMenuAdapter?.(this.contextMenuController);
        };
        this.scope.addCleanup(this.detachContextMenuAdapter);
        this.batchUi = options.batchUi ?? null;
        this.listRefreshController = new ListRefreshCoordinator({
            advanceGeneration: () => this.legacyPlugin.advanceListGeneration?.(),
            captureRevision: () => this.legacyPlugin.captureListRevision?.() ?? "0",
            isCurrent: (revision) => this.legacyPlugin.isCurrentListGeneration?.(revision) ?? revision === (this.legacyPlugin.captureListRevision?.() ?? "0"),
            recordPhase: (phase, itemCount) => this.legacyPlugin.recordListPhase?.(phase, itemCount),
            invalidateContext: () => {
                this.filterContextProvider?.invalidate();
                this.legacyStorage?._invalidateCache?.(this.legacyStorage.car_list_key);
                this.legacyPlugin.invalidateListRefreshContext?.();
            },
            filterAll: (revision) => this.filterListItems(null, revision),
            filterItems: (items, revision) => this.filterListItems(items, revision),
            reconcile: (items, revision) => this.reconcileListItems(items, revision),
            syncHistory: () => {
                const history = this.legacyPlugin.getOptionalDependency?.("HistoryPlugin");
                history?.tableObj?.setData?.();
            },
        });
        this.legacyPlugin.attachFeatureListRefreshAdapter?.(this.listRefreshController);
        let listRefreshAdapterAttached = true;
        this.detachListRefreshAdapter = () => {
            if (!listRefreshAdapterAttached) return;
            listRefreshAdapterAttached = false;
            this.listRefreshController.dispose();
            this.legacyPlugin.detachFeatureListRefreshAdapter?.(this.listRefreshController);
        };
        this.scope.addCleanup(this.detachListRefreshAdapter);
        this.legacyPlugin.attachFeatureListAddedItemsAdapter?.(this);
        let addedItemsAdapterAttached = true;
        this.detachAddedItemsAdapter = () => {
            if (!addedItemsAdapterAttached) return;
            addedItemsAdapterAttached = false;
            this.legacyPlugin.detachFeatureListAddedItemsAdapter?.(this);
        };
        this.scope.addCleanup(this.detachAddedItemsAdapter);
        /** @type {ListCardStatePresenter | null} */ this.cardStatePresenter = new ListCardStatePresenter({
            hostAdapter: this.hostAdapter,
            document: this.hostAdapter?.document,
            readCardIdentity: (item) => this.readCardIdentity(item),
        });
        this.detachCardStatePresenter = null;
        this.cardStateStyleRelease = null;
        /** @type {ListFilterContextProvider | null} */ this.filterContextProvider = null;
        this.activeFilter = "waitCheck";
        this.sortController = options.sortController ?? null;
        this.styleRelease = null;
        /** @type {ListView | null} */ this.view = null;
        /** @type {ListItemIndex | null} */ this.itemIndex = null;
        /** @type {ListDomObserver | null} */ this.domObserver = null;
        /** @type {ListBatchController | null} */ this.batchController = null;
        /** @type {number | ReturnType<typeof setTimeout> | null} */ this.recountFrame = null;
        this.started = false;
        this.scope.addCleanup(() => this.cancelScheduledRecount());
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        this.activeFilter = normalizeQuickFilterKey(this.settings?.snapshot?.()?.defaultQuickFilterTab ?? this.legacyPlugin.activeQuickFilter ?? "waitCheck");
        this.legacyPlugin.activeQuickFilter = this.activeFilter;
        const detachPresenter = this.legacyPlugin.attachCardStatePresenter?.(this.cardStatePresenter) ?? null;
        let presenterAttached = true;
        this.detachCardStatePresenter = () => {
            if (!presenterAttached) return;
            presenterAttached = false;
            detachPresenter?.();
        };
        const presenter = this.cardStatePresenter, detachCardStatePresenter = this.detachCardStatePresenter;
        this.scope.addCleanup(() => {
            detachCardStatePresenter?.();
            if (this.cardStatePresenter === presenter) this.cardStatePresenter = null;
            if (this.detachCardStatePresenter === detachCardStatePresenter) this.detachCardStatePresenter = null;
        });
        const readFilterSources = this.readFilterSources;
        if (typeof readFilterSources === "function") {
            this.filterContextProvider = new ListFilterContextProvider({
                readSources: () => readFilterSources(),
                onMissingBlacklistRole: (item) => this.logger.error("黑名单数据源丢失演员信息", item),
            });
            const contextProvider = this.filterContextProvider;
            this.scope.addCleanup(() => {
                contextProvider.dispose();
                if (this.filterContextProvider === contextProvider) this.filterContextProvider = null;
            });
        }
        this.legacyPlugin.setSortController?.(this.sortController);
        this.hostMarkupController.normalizeInitialMarkup();
        const selectors = this.hostAdapter?.getListSelectors?.() ?? this.legacyPlugin.getSelector?.();
        if (!selectors) return Promise.reject(new Error("List Feature requires host list selectors"));
        const initialItems = this.hostAdapter?.document?.querySelectorAll?.(selectors.itemSelector);
        if (initialItems) this.hostMarkupController.normalizeCards([ ...initialItems ]);
        this.coverImageController.replace();
        const view = new ListView({
            hostAdapter: this.hostAdapter, selectors, logger: this.logger,
            onFilterChange: (filter, options) => this.setQuickFilter(filter, options),
            onOpenMovieDetail: (item, options) => this.listNavigationController.openMovieDetail(item, options),
        });
        view.setActiveFilter(this.activeFilter);
        view.bindMovieDetailNavigation(selectors.boxSelector);
        view.bindCardVideoPlayback(selectors.boxSelector);
        const itemIndex = new ListItemIndex({
            readCarNum: (item) => {
                const identity = this.readCardIdentity(item);
                if (!identity) throw new Error("List Feature requires card identity parsing");
                return identity.carNum;
            },
            onReadError: (error) => this.logger.debug("列表项索引跳过无效卡片", error),
        });
        const domObserver = new ListDomObserver({
            root: this.hostAdapter?.locateListRoot?.() ?? (typeof document === "undefined" ? null : document.querySelector(selectors.boxSelector)),
            itemSelector: selectors.itemSelector,
            scope: this.scope,
            getRevision: () => this.legacyPlugin.captureListRevision?.() ?? "0",
            isProcessed: (item) => /** @type {HTMLElement} */ (item).dataset.jhsProcessed === "true",
            onRemoved: (nodes) => this.legacyPlugin.removeIndexedItems?.(nodes),
            onAddedNodes: (count) => {
                this.legacyPlugin.advanceListGeneration?.();
                this.legacyPlugin.recordListPhase?.("dom-added", count);
            },
            onAdded: (items, revision) => {
                this.hostMarkupController.normalizeCards(items);
                this.coverImageController.replace(items.flatMap((item) => [ ...item.querySelectorAll(selectors.coverImgSelector) ]));
                return this.processAddedItems(items, revision);
            },
            onError: (error) => this.logger.error("列表增量处理失败", error),
            onMissingRoot: () => this.logger.error("没有找到容器节点!"),
        });
        this.view = view;
        this.itemIndex = itemIndex;
        this.domObserver = domObserver;
        this.batchController = new ListBatchController({
            hostAdapter: this.hostAdapter, state: this.state, http: this.http, scope: this.scope, ui: this.batchUi,
            getEvaluationContext: () => this.filterContextProvider?.get()
                ?? Promise.reject(new Error("List Feature batch evaluation context is unavailable")),
            getActiveFilter: () => this.view?.getActiveFilter?.() ?? this.activeFilter,
        });
        const batchController = this.batchController;
        this.scope.addCleanup(() => { this.view?.dispose(); this.itemIndex?.clear(); this.domObserver?.dispose(); batchController.dispose(); });
        return Promise.resolve()
            .then(() => {
                if (!this.hoverPreviewController.start()) return;
                if (typeof this.legacyPlugin.attachFeatureListHoverPreviewAdapter === "function") {
                    this.legacyPlugin.attachFeatureListHoverPreviewAdapter(this.hoverPreviewController);
                    this.hoverPreviewAdapterAttached = true;
                }
            })
            .then(() => {
                if (!this.tagExpansionController.start()) return;
                if (typeof this.legacyPlugin.attachFeatureListTagExpansionAdapter === "function") {
                    this.legacyPlugin.attachFeatureListTagExpansionAdapter(this.tagExpansionController);
                    this.tagExpansionAdapterAttached = true;
                }
            })
            .then(() => this.contextMenuController.start())
            .then(() => this.paginationController.start())
            .then(() => this.registerStyles())
            .then(() => this.legacyPlugin.handle({ scope: this.scope, view, itemIndex, observer: domObserver, batchController, featureOwnsStartup: true }))
            .then(() => this.initializeListRuntime())
            .catch((error) => {
                this.dispose();
                throw error;
            });
    }

    /** Evaluate cards through the Feature-owned presenter and keep stale generations from committing. */
    /** @param {Element[] | null} items @param {string} revision */
    async filterListItems(items, revision) {
        const document = this.hostAdapter?.document;
        const selectors = this.view?.selectors ?? this.hostAdapter?.getListSelectors?.();
        if (!document || !selectors) return false;
        const cards = items ? items.filter((item) => item.isConnected) : [ ...document.querySelectorAll(selectors.itemSelector) ];
        if (!cards.length) return true;
        this.legacyPlugin.recordListPhase?.("doFilter-start", cards.length);
        const isCurrent = () => !this.listRefreshController.disposed && (this.legacyPlugin.isCurrentListGeneration?.(revision) ?? revision === (this.legacyPlugin.captureListRevision?.() ?? "0"));
        if (!isCurrent()) return false;
        const context = await (this.filterContextProvider?.get()
            ?? Promise.reject(new Error("List Feature filter context is unavailable")));
        if (!isCurrent()) return false;
        const settings = context.settings ?? this.settings?.snapshot?.() ?? {};
        const visibleItems = await this.cardStatePresenter?.processItems(cards, {
            context, filter: this.view?.getActiveFilter?.() ?? this.activeFilter,
            tagPosition: settings.tagPosition || "rightTop", isCurrent,
        });
        if (!visibleItems || !isCurrent()) return false;
        this.scheduleRecount();
        void Promise.resolve(this.legacyPlugin.translateListItems?.(visibleItems)).catch((error) => this.logger.error("列表页翻译任务失败", error));
        this.legacyPlugin.recordListPhase?.("doFilter-end", cards.length);
        if (!items && this.hostAdapter?.site === "javbus") {
            try {
                const adjustment = this.busImageLayout?.logImageHeightsByRow?.(this.settings?.snapshot?.() ?? settings);
                adjustment?.catch?.((/** @type {unknown} */ error) => this.logger.error("JavBus图片高度修正失败", error));
            } catch (/** @type {unknown} */ error) {
                this.logger.error("JavBus图片高度修正失败", error);
            }
        }
        return true;
    }

    /** Run the initial Feature-owned list pass and arm incremental observation afterward. */
    async initializeListRuntime() {
        const document = this.hostAdapter?.document;
        const selectors = this.view?.selectors;
        if (!document || !selectors || !document.querySelector(selectors.boxSelector)) return false;
        const revision = this.legacyPlugin.advanceListGeneration?.() ?? this.legacyPlugin.captureListRevision?.() ?? "0";
        const filtered = await this.filterListItems(null, revision);
        if (!filtered || this.listRefreshController.disposed) return false;
        this.view?.createQuickFilter(this.activeFilter);
        if (this.legacyPlugin.isCurrentListGeneration?.(revision) === false) return false;
        this.reconcileListItems(null, revision);
        const items = [ ...document.querySelectorAll(selectors.itemSelector) ];
        items.forEach((item) => { /** @type {HTMLElement} */ (item).dataset.jhsProcessed = "true"; });
        this.itemIndex?.rebuild(items);
        this.legacyPlugin.recordListPhase?.("rebuildItemIndex", items.length);
        await this.events?.emit?.("list-items-added", { items }, { broadcast: false });
        if (this.listRefreshController.disposed) return false;
        this.domObserver?.start();
        return true;
    }

    /** Apply the active quick-filter visibility through the Feature view after card state is current. */
    /** @param {Element[] | null} items @param {string} revision */
    reconcileListItems(items, revision) {
        if (this.listRefreshController.disposed) return false;
        const isCurrent = this.legacyPlugin.isCurrentListGeneration?.(revision) ?? revision === (this.legacyPlugin.captureListRevision?.() ?? "0");
        if (!isCurrent || !this.view) return false;
        this.view.applyVisibility(items, this.view.getActiveFilter?.() ?? this.activeFilter);
        return true;
    }

    /** Coalesce card-state summary updates in the List Feature scope. */
    scheduleRecount() {
        if (this.recountFrame !== null || this.scope.disposed) return;
        const requestFrame = this.window?.requestAnimationFrame?.bind(this.window);
        this.recountFrame = requestFrame
            ? requestFrame(() => this.publishCurrentPageSummary())
            : setTimeout(() => this.publishCurrentPageSummary(), 0);
    }

    publishCurrentPageSummary() {
        this.recountFrame = null;
        if (this.listRefreshController.disposed || this.scope.disposed) return;
        const summary = this.cardStatePresenter?.collectSummary();
        if (summary) this.legacyPlugin.publishListSummary?.(summary);
    }

    cancelScheduledRecount() {
        if (this.recountFrame === null) return;
        if (this.window?.cancelAnimationFrame) this.window.cancelAnimationFrame(this.recountFrame);
        else clearTimeout(this.recountFrame);
        this.recountFrame = null;
    }

    /** Keep the active quick filter in the Feature and notify the temporary legacy evaluator adapter. */
    /** @param {unknown} filter @param {{syncUi?: boolean}} [options] */
    setQuickFilter(filter, { syncUi = true } = {}) {
        this.activeFilter = normalizeQuickFilterKey(filter);
        this.view?.setActiveFilter(this.activeFilter);
        if (syncUi) this.view?.syncQuickFilterUi(this.activeFilter);
        if (typeof this.legacyPlugin.beginQuickFilterTransition === "function") {
            this.legacyPlugin.beginQuickFilterTransition(this.activeFilter);
            return this.listRefreshController.request({ reason: "quick-filter", visibilityOnly: true })
                .catch((error) => { this.logger.error("列表筛选刷新失败", error); return false; });
        }
        return this.legacyPlugin.setQuickFilter?.(this.activeFilter, { syncUi: false });
    }

    /** Filters, sorts, decorates and indexes newly discovered host cards before publishing them. */
    /** @param {Element[]} items @param {string} [revision] */
    async processAddedItems(items, revision = this.legacyPlugin.captureListRevision?.() ?? "0") {
        if (this.listRefreshController.disposed) return false;
        const refreshed = await this.listRefreshController.request({ items, reason: "dom-added" });
        if (!refreshed || this.listRefreshController.disposed) return false;
        await this.sortController?.sortItems?.();
        if (this.listRefreshController.disposed) return false;
        await this.coverButtons?.addSvgBtn?.(items);
        if (this.listRefreshController.disposed) return false;
        items.forEach((item) => { /** @type {HTMLElement} */ (item).dataset.jhsProcessed = "true"; });
        this.itemIndex?.add(items);
        await this.events?.emit?.("list-items-added", { items }, { broadcast: false });
        return true;
    }

    async registerStyles() {
        if (!this.styles) return;
        if (!this.cardStateStyleRelease) this.cardStateStyleRelease = this.styles.register("jhs-list-card-state-feature", LIST_CARD_STATE_STYLES);
        if (!this.paginationStyleRelease) this.paginationStyleRelease = this.styles.register("jhs-list-pagination-feature", LIST_PAGINATION_STYLES);
        if (this.styleRelease || !this.legacyPlugin.initCss) return;
        const css = await this.legacyPlugin.initCss();
        if (!css) return;
        this.styleRelease = this.styles.register("jhs-list-feature-style", css.replace(/^\s*<style>|<\/style>\s*$/g, ""));
    }

    dispose() {
        this.cancelScheduledRecount();
        this.view?.dispose();
        this.view = null;
        this.itemIndex?.clear();
        this.itemIndex = null;
        this.domObserver?.dispose();
        this.domObserver = null;
        this.batchController?.dispose();
        this.batchController = null;
        this.filterContextProvider?.dispose();
        this.filterContextProvider = null;
        this.detachCardStatePresenter?.();
        this.detachCardStatePresenter = null;
        this.cardStatePresenter = null;
        this.legacyPlugin.setSortController?.(null);
        this.styleRelease?.();
        this.styleRelease = null;
        this.cardStateStyleRelease?.();
        this.cardStateStyleRelease = null;
        this.paginationStyleRelease?.();
        this.paginationStyleRelease = null;
        this.paginationController?.dispose();
        this.detachListNavigationAdapter?.();
        this.detachListRefreshAdapter?.();
        this.detachAddedItemsAdapter?.();
        this.detachTagExpansionAdapter?.();
        this.detachHoverPreviewAdapter?.();
        this.detachContextMenuAdapter?.();
        this.detachCoverImageAdapter?.();
        this.started = false;
    }
}
