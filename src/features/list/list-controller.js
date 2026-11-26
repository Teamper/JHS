// @ts-check
import { SupplementaryCardsController } from "./supplementary-cards-controller.js";
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
import { normalizeQuickFilterKey } from "../../core/list-filters.js";
import { ListRefreshCoordinator } from "./list-refresh-coordinator.js";
import { resolveFavoriteActressHighlightStyle } from "../../core/favorite-actress-highlight.js";
import { start } from "./list-controller-lifecycle.js";
/** Own ListPagePlugin startup while its implementation migrates into FeatureRuntime. */
export class ListController {
    /** @param {{legacyPlugin: any, controllers?: Record<string, any>, hostAdapter: any, scope: any, styles?: {register: (id: string, css: string) => () => void}, state?: any, storage?: any, readFilterSources?: (options?: {stateOnly?: boolean}) => Promise<any>, isFavoriteActressesFeatureEnabled?: () => boolean, readCardIdentity?: (item: Element) => any, http?: any, settings?: any, navigation?: any, events?: any, coverButtons?: any, batchUi?: any, sortController?: ListSortController | null, busImageLayout?: any, ui?: any, notifications?: any, diagnostics?: any, logger?: Pick<Console, "error" | "debug"> & Partial<Pick<Console, "warn">>, window?: any}} options */
    constructor(options) {
        this.legacyPlugin = options.legacyPlugin;
        this.controllers = options.controllers ?? {};
        this.hostAdapter = options.hostAdapter;
        /** @type {Element | null} */ this.boundListRoot = null;
        /** @type {MutationObserver | null} */ this.rootBoundaryObserver = null;
        this.scope = options.scope;
        this.styles = options.styles ?? null;
        this.state = options.state ?? null;
        this.readFilterSources = options.readFilterSources ?? null;
        this.isFavoriteActressesFeatureEnabled = options.isFavoriteActressesFeatureEnabled ?? null;
        this.readCardIdentity = options.readCardIdentity ?? ((item) => this.legacyPlugin.findCarNumAndHref?.($(item)));
        this.http = options.http ?? null;
        this.settings = options.settings ?? null;
        this.window = options.window ?? globalThis.window ?? null;
        this.busImageLayout = options.busImageLayout ?? null;
        this.events = options.events ?? null;
        this.logger = options.logger ?? console;
        this.notifications = options.notifications;
        this.coverButtons = options.coverButtons ?? null;
        this.paginationController = new ListPaginationController({ hostAdapter: this.hostAdapter, navigation: options.navigation, scope: this.scope });
        this.hostMarkupController = new ListHostMarkupController({ hostAdapter: this.hostAdapter });
        this.coverImageController = new ListCoverImageController({ hostAdapter: this.hostAdapter, scope: this.scope, window: options.window });
        this.controllers.coverImages = this.coverImageController;
        this.detachCoverImageAdapter = this.scope.addCleanup(() => {
            delete this.controllers.coverImages;
            this.coverImageController.dispose();
        });
        this.hoverPreviewController = new ListHoverPreviewController({
            hostAdapter: this.hostAdapter, settings: this.settings, ui: options.ui, scope: this.scope, window: options.window,
        });
        this.detachHoverPreviewAdapter = this.scope.addCleanup(() => {
            delete this.controllers.hoverPreview;
            this.hoverPreviewController.dispose();
        });
        this.tagExpansionController = new ListTagExpansionController({
            hostAdapter: this.hostAdapter, storage: options.storage, scope: this.scope, diagnostics: options.diagnostics,
        });
        this.detachTagExpansionAdapter = this.scope.addCleanup(() => {
            delete this.controllers.tagExpansion;
            this.tagExpansionController.dispose();
        });
        this.listNavigationController = new ListNavigationController({
            hostAdapter: this.hostAdapter, list: this.legacyPlugin, ui: options.ui,
        });
        this.controllers.navigation = this.listNavigationController;
        this.detachListNavigationAdapter = this.scope.addCleanup(() => {
            delete this.controllers.navigation;
            this.listNavigationController.dispose();
        });
        this.contextMenuController = new ListContextMenuController({
            hostAdapter: this.hostAdapter, list: this.legacyPlugin, state: this.state,
            ui: options.ui, notifications: options.notifications, scope: this.scope, diagnostics: options.diagnostics,
        });
        this.controllers.contextMenu = this.contextMenuController;
        this.detachContextMenuAdapter = this.scope.addCleanup(() => {
            delete this.controllers.contextMenu;
            this.contextMenuController.dispose();
        });
        this.batchUi = options.batchUi ?? null;
        this.listRefreshController = new ListRefreshCoordinator({
            advanceGeneration: () => this.legacyPlugin.advanceListGeneration?.(),
            captureRevision: () => this.legacyPlugin.captureListRevision?.() ?? "0",
            isCurrent: (revision) => this.legacyPlugin.isCurrentListGeneration?.(revision) ?? revision === (this.legacyPlugin.captureListRevision?.() ?? "0"),
            recordPhase: (phase, itemCount) => this.legacyPlugin.recordListPhase?.(phase, itemCount),
            invalidateContext: () => {
                this.filterContextProvider?.invalidate();
                this.legacyPlugin.invalidateListRefreshContext?.();
            },
            filterAll: (revision) => this.filterListItems(null, revision),
            filterItems: (items, revision) => this.filterListItems(items, revision),
            reconcile: (items, revision) => this.reconcileListItems(items, revision),
            syncHistory: () => this.legacyPlugin.refreshHistory?.(),
        });
        this.controllers.refresh = this.listRefreshController;
        this.detachListRefreshAdapter = this.scope.addCleanup(() => {
            delete this.controllers.refresh;
            this.listRefreshController.dispose();
        });
        this.controllers.items = this;
        this.detachAddedItemsAdapter = this.scope.addCleanup(() => {
            delete this.controllers.items;
        });
        /** @type {ListCardStatePresenter | null} */ this.cardStatePresenter = new ListCardStatePresenter({
            hostAdapter: this.hostAdapter,
            document: this.hostAdapter?.document,
            readCardIdentity: (item) => this.readCardIdentity(item),
        });
        /** @type {(() => void) | null} */ this.detachCardStatePresenter = null;
        this.cardStateStyleRelease = null;
        /** @type {ListFilterContextProvider | null} */ this.filterContextProvider = null;
        this.activeFilter = "waitCheck";
        /** @type {WeakMap<Element, boolean>} */ this.visibilityByItem = new WeakMap();
        this.visibleItemCount = 0;
        this.totalItemCount = 0;
        this.hasVisibilitySnapshot = false;
        this.sortController = options.sortController ?? null;
        this.styleRelease = null;
        this.favoriteActressStyleRelease = null;
        /** @type {ListView | null} */ this.view = null;
        /** @type {ListItemIndex | null} */ this.itemIndex = null;
        /** @type {ListDomObserver | null} */ this.domObserver = null;
        /** @type {ListBatchController | null} */ this.batchController = null;
        /** @type {number | ReturnType<typeof setTimeout> | null} */ this.recountFrame = null;
        this.supplementaryCards = new SupplementaryCardsController({ owner: this, ui: options.ui, notifications: options.notifications, diagnostics: options.diagnostics });
        this.started = false;
        this.scope.addCleanup(() => this.cancelScheduledRecount());
        this.scope.addCleanup(() => { this.favoriteActressStyleRelease?.(); this.favoriteActressStyleRelease = null; });
    }
    start() { return start(this); }

    /** Evaluate cards through the Feature-owned presenter and keep stale generations from committing. */
    /** @param {Element[] | null} items @param {string} revision */
    async filterListItems(items, revision) {
        const document = this.hostAdapter?.document;
        const selectors = this.view?.selectors ?? (this.hostAdapter?.getLiveListSelectors?.() ?? this.hostAdapter?.getListSelectors?.());
        if (!document || !selectors) return false;
        const cards = items ? items.filter((item) => item.isConnected) : [ ...document.querySelectorAll(selectors.itemSelector) ];
        if (!items) this.cardStatePresenter?.resetSummary();
        if (!cards.length) return true;
        this.legacyPlugin.recordListPhase?.("doFilter-start", cards.length);
        const isCurrent = () => (!this.boundListRoot || this.boundListRoot.isConnected && this.boundListRoot.hasAttribute("data-jhs-primary-list")) && !this.listRefreshController.disposed && (this.legacyPlugin.isCurrentListGeneration?.(revision) ?? revision === (this.legacyPlugin.captureListRevision?.() ?? "0"));
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
        for (;;) {
            const revision = this.legacyPlugin.advanceListGeneration?.() ?? this.legacyPlugin.captureListRevision?.() ?? "0";
            const filtered = await this.filterListItems(null, revision);
            if (this.listRefreshController.disposed) return false;
            if (this.legacyPlugin.isCurrentListGeneration?.(revision) === false) continue;
            if (!filtered) return false;
            this.view?.createQuickFilter(this.activeFilter);
            if (this.legacyPlugin.isCurrentListGeneration?.(revision) === false) continue;
            this.reconcileListItems(null, revision);
            break;
        }
        const items = [ ...document.querySelectorAll(selectors.itemSelector) ];
        items.forEach((item) => { /** @type {HTMLElement} */ (item).dataset.jhsProcessed = "true"; });
        this.itemIndex?.rebuild(items);
        this.legacyPlugin.recordListPhase?.("rebuildItemIndex", items.length);
        await this.events?.emit?.("list-items-added", { items }, { broadcast: false });
        if (this.listRefreshController.disposed) return false;
        this.domObserver?.start();
        this.legacyPlugin.stateRefreshReady = true;
        void this.legacyPlugin.refreshCarNums?.([])?.catch?.((/** @type {unknown} */ error) => this.logger.error("列表初始化后状态刷新失败", error));
        return true;
    }

    /** Apply the active quick-filter visibility through the Feature view after card state is current. */
    /** @param {Element[] | null} items @param {string} revision */
    reconcileListItems(items, revision) {
        if (this.listRefreshController.disposed) return false;
        const isCurrent = this.legacyPlugin.isCurrentListGeneration?.(revision) ?? revision === (this.legacyPlugin.captureListRevision?.() ?? "0");
        if (!isCurrent || !this.view) return false;
        const document = this.hostAdapter?.document ?? globalThis.document;
        const elements = items ?? (document?.querySelectorAll ? Array.from(document.querySelectorAll(this.view.selectors.itemSelector)) : null);
        if (items === null) {
            this.visibilityByItem = new WeakMap();
            this.visibleItemCount = 0;
            this.totalItemCount = 0;
        }
        this.view.applyVisibility(elements, this.view.getActiveFilter?.() ?? this.activeFilter, (element, visible) => {
            const known = this.visibilityByItem.has(element), previous = this.visibilityByItem.get(element);
            if (!known) {
                this.totalItemCount++;
                if (visible) this.visibleItemCount++;
            } else if (previous !== visible) this.visibleItemCount += visible ? 1 : -1;
            this.visibilityByItem.set(element, visible);
        });
        this.hasVisibilitySnapshot = true;
        const pending = this.events?.emit?.("list-visibility-changed", this.getVisibilitySnapshot(revision), { broadcast: false });
        pending?.catch?.((/** @type {unknown} */ error) => this.logger.error("列表显隐状态通知失败", error));
        return true;
    }

    /** Return the cached filter counts without walking the card list. */
    /** @param {string} [revision] */
    getVisibilitySnapshot(revision = this.legacyPlugin.captureListRevision?.() ?? "0") {
        if (!this.hasVisibilitySnapshot) return null;
        return { filter: this.view?.getActiveFilter?.() ?? this.activeFilter, visible: this.visibleItemCount, total: this.totalItemCount, revision };
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
        const summary = this.cardStatePresenter?.getSummary?.() ?? this.cardStatePresenter?.collectSummary();
        if (summary) this.legacyPlugin.publishListSummary?.(summary);
    }

    cancelScheduledRecount() {
        if (this.recountFrame === null) return;
        if (this.window?.cancelAnimationFrame) this.window.cancelAnimationFrame(this.recountFrame);
        else clearTimeout(this.recountFrame);
        this.recountFrame = null;
    }

    getBoundItemCount() {
        return this.boundListRoot?.isConnected && this.view
            ? this.boundListRoot.querySelectorAll(this.view.selectors.itemSelector).length : null;
    }

    /** Keep the active quick filter in the Feature and notify the temporary legacy evaluator adapter. */
    /** @param {unknown} filter @param {{syncUi?: boolean}} [options] */
    setQuickFilter(filter, { syncUi = true } = {}) {
        this.activeFilter = normalizeQuickFilterKey(filter);
        this.hasVisibilitySnapshot = false;
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

    refreshFavoriteActressHighlightStyle() {
        this.favoriteActressStyleRelease?.();
        this.favoriteActressStyleRelease = null;
        if (!this.styles?.register) return;
        const featureEnabled = this.isFavoriteActressesFeatureEnabled?.() ?? true;
        if (!featureEnabled) return;
        const { enabled, width, color } = resolveFavoriteActressHighlightStyle(this.settings?.snapshot?.());
        if (!enabled) return;
        this.favoriteActressStyleRelease = this.styles.register(
            "jhs-list-favorite-actresses-feature",
            `[data-jhs-card-list] > .item[data-jhs-favorite-actress="yes"]:not(.do-hide),[data-jhs-primary-list] > .item[data-jhs-favorite-actress="yes"]:not(.do-hide),.masonry > .item[data-jhs-favorite-actress="yes"]:not(.do-hide){box-shadow:0 0 0 ${width}px ${color};border-radius:var(--jhs-radius-sm)}`
        );
    }

    async registerStyles() {
        if (!this.styles) return;
        if (!this.cardStateStyleRelease) this.cardStateStyleRelease = this.styles.register("jhs-list-card-state-feature", LIST_CARD_STATE_STYLES);
        if (!this.paginationStyleRelease) this.paginationStyleRelease = this.styles.register("jhs-list-pagination-feature", LIST_PAGINATION_STYLES);
        this.refreshFavoriteActressHighlightStyle();
        if (this.styleRelease || !this.legacyPlugin.initCss) return;
        const css = await this.legacyPlugin.initCss();
        if (!css) return;
        this.styleRelease = this.styles.register("jhs-list-feature-style", css.replace(/^\s*<style>|<\/style>\s*$/g, ""));
    }

    dispose() {
        if (this.rootBoundaryObserver) this.scope.releaseObserver(this.rootBoundaryObserver);
        this.rootBoundaryObserver = null;
        this.boundListRoot = null;
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
        this.cardStatePresenter?.dispose();
        this.cardStatePresenter = null;
        this.legacyPlugin.setSortController?.(null);
        this.styleRelease?.();
        this.styleRelease = null;
        this.favoriteActressStyleRelease?.();
        this.favoriteActressStyleRelease = null;
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
        this.supplementaryCards.dispose();
        this.started = false;
    }
}
