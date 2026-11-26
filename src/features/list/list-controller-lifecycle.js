// @ts-check

import { ListView } from "./list-view.js";
import { ListItemIndex } from "./list-item-index.js";
import { ListDomObserver } from "./list-dom-observer.js";
import { ListBatchController } from "./list-batch-controller.js";
import { ListFilterContextProvider } from "./list-filter-context.js";
import { normalizeQuickFilterKey } from "../../core/list-filters.js";

/** @typedef {import("./list-controller.js").ListController} ListController */

/** @param {ListController} owner */
export function start(owner) {
    owner.scope.assertActive();
    if (owner.started) return Promise.resolve();
    owner.started = true;
    owner.activeFilter = normalizeQuickFilterKey(owner.settings?.snapshot?.()?.defaultQuickFilterTab ?? owner.legacyPlugin.activeQuickFilter ?? "waitCheck");
    owner.legacyPlugin.activeQuickFilter = owner.activeFilter;
    const detachPresenter = owner.legacyPlugin.attachCardStatePresenter?.(owner.cardStatePresenter) ?? null;
    let presenterAttached = true;
    owner.detachCardStatePresenter = () => {
        if (!presenterAttached) return;
        presenterAttached = false;
        detachPresenter?.();
    };
    const presenter = owner.cardStatePresenter, detachCardStatePresenter = owner.detachCardStatePresenter;
    owner.scope.addCleanup(() => {
        detachCardStatePresenter?.();
        presenter?.dispose();
        if (owner.cardStatePresenter === presenter) owner.cardStatePresenter = null;
        if (owner.detachCardStatePresenter === detachCardStatePresenter) owner.detachCardStatePresenter = null;
    });
    const readFilterSources = owner.readFilterSources;
    if (typeof readFilterSources === "function") {
        owner.filterContextProvider = new ListFilterContextProvider({
            readSources: (options) => readFilterSources(options),
            onMissingBlacklistRole: (item) => owner.logger.error("黑名单数据源丢失演员信息", item),
        });
        const contextProvider = owner.filterContextProvider;
        const detachContext = owner.legacyPlugin.attachFilterContextProvider?.(contextProvider);
        if (detachContext) owner.scope.addCleanup(detachContext);
        owner.scope.addCleanup(() => {
            contextProvider.dispose();
            if (owner.filterContextProvider === contextProvider) owner.filterContextProvider = null;
        });
    }
    if (owner.settings?.addEventListener) {
        const onHighlightSettingsChanged = (/** @type {any} */ event) => {
            const names = Array.isArray(event?.detail?.names) ? event.detail.names : [];
            if (names.some((/** @type {string} */ name) => name === "enableFavoriteActresses" || name === "highlightedTagNumber" || name === "highlightedTagColor")) {
                owner.refreshFavoriteActressHighlightStyle();
            }
        };
        owner.settings.addEventListener("settings.changed", onHighlightSettingsChanged);
        owner.scope.addCleanup(() => owner.settings.removeEventListener?.("settings.changed", onHighlightSettingsChanged));
    }
    const doc = owner.hostAdapter?.document;
    if (doc?.addEventListener) {
        const onActressStateChanged = () => {
            if (owner.listRefreshController.disposed || owner.scope.disposed) return;
            if (typeof owner.legacyPlugin.requestListRefresh === "function") {
                void owner.legacyPlugin.requestListRefresh({ reason: "actress-state-changed", full: true });
            } else {
                void owner.listRefreshController.request({ full: true });
            }
        };
        doc.addEventListener("actress-state-changed", onActressStateChanged);
        owner.scope.addCleanup(() => doc.removeEventListener?.("actress-state-changed", onActressStateChanged));
    }
    owner.legacyPlugin.setSortController?.(owner.sortController);
    owner.hostMarkupController.normalizeInitialMarkup();
    const selectors = (owner.hostAdapter?.getLiveListSelectors?.() ?? owner.hostAdapter?.getListSelectors?.()) ?? owner.legacyPlugin.getSelector?.();
    if (!selectors) return Promise.reject(new Error("List Feature requires host list selectors"));
    if (owner.hostAdapter?.resolveListBoundary) {
        const root = owner.hostAdapter.locateListRoot();
        if (!root) return Promise.resolve(false);
        owner.boundListRoot = root;
        if (root.parentElement) owner.rootBoundaryObserver = owner.scope.observe(root.parentElement, () => {
            if (owner.hostAdapter.locateListRoot() !== root || !root.isConnected) owner.scope.dispose();
        }, { childList: true });
    }
    const initialItems = owner.hostAdapter?.document?.querySelectorAll?.(selectors.itemSelector);
    if (initialItems) owner.hostMarkupController.normalizeCards([ ...initialItems ]);
    owner.coverImageController.replace();
    const view = new ListView({
        hostAdapter: owner.hostAdapter, selectors, logger: owner.logger,
        notifyPlaybackError: (message) => owner.notifications?.error(message),
        onFilterChange: (filter, options) => owner.setQuickFilter(filter, options),
        onOpenMovieDetail: (item, options) => owner.listNavigationController.openMovieDetail(item, options),
    });
    view.setActiveFilter(owner.activeFilter);
    view.bindMovieDetailNavigation(selectors.boxSelector);
    view.bindCardVideoPlayback(selectors.boxSelector);
    const itemIndex = new ListItemIndex({
        root: owner.hostAdapter?.locateListRoot?.() ?? owner.hostAdapter?.document?.querySelector(selectors.boxSelector) ?? null,
        readCarNum: (item) => {
            const identity = owner.readCardIdentity(item);
            if (!identity) throw new Error("List Feature requires card identity parsing");
            return identity.carNum;
        },
        onReadError: (error) => owner.logger.debug("列表项索引跳过无效卡片", error),
    });
    const domObserver = new ListDomObserver({
        root: owner.hostAdapter?.locateListRoot?.() ?? (typeof document === "undefined" ? null : document.querySelector(selectors.boxSelector)),
        itemSelector: selectors.itemSelector,
        scope: owner.scope,
        getRevision: () => owner.legacyPlugin.captureListRevision?.() ?? "0",
        isProcessed: (item) => /** @type {HTMLElement} */ (item).dataset.jhsProcessed === "true",
        onRetained: (items) => itemIndex.add(items),
        onRemoved: (nodes) => {
            owner.legacyPlugin.removeIndexedItems?.(nodes);
            if ([...nodes].some(node => !node.isConnected)) {
                owner.cardStatePresenter?.removeDetachedSummaries();
                owner.scheduleRecount();
            }
        },
        onAddedNodes: (count) => {
            owner.legacyPlugin.advanceListGeneration?.();
            owner.legacyPlugin.recordListPhase?.("dom-added", count);
        },
        onAdded: (items, revision) => {
            owner.hostMarkupController.normalizeCards(items);
            owner.coverImageController.replace(items.flatMap((item) => [ ...item.querySelectorAll(selectors.coverImgSelector) ]));
            return owner.processAddedItems(items, revision);
        },
        onError: (error) => owner.logger.error("列表增量处理失败", error),
        onMissingRoot: () => owner.logger.error("没有找到容器节点!"),
    });
    owner.view = view;
    owner.itemIndex = itemIndex;
    owner.domObserver = domObserver;
    owner.batchController = new ListBatchController({
        hostAdapter: owner.hostAdapter, state: owner.state, http: owner.http, scope: owner.scope, ui: owner.batchUi,
        getEvaluationContext: () => owner.filterContextProvider?.get()
            ?? Promise.reject(new Error("List Feature batch evaluation context is unavailable")),
        getActiveFilter: () => owner.view?.getActiveFilter?.() ?? owner.activeFilter,
    });
    const batchController = owner.batchController;
    owner.scope.addCleanup(() => { owner.view?.dispose(); owner.cardStatePresenter?.resetSummary(); owner.itemIndex?.clear(); owner.domObserver?.dispose(); batchController.dispose(); });
    return Promise.resolve()
        .then(() => {
            if (!owner.hoverPreviewController.start()) return;
            owner.controllers.hoverPreview = owner.hoverPreviewController;
        })
        .then(() => {
            if (!owner.tagExpansionController.start()) return;
            owner.controllers.tagExpansion = owner.tagExpansionController;
        })
        .then(() => owner.contextMenuController.start())
        .then(() => owner.paginationController.start())
        .then(() => owner.registerStyles())
        .then(() => { owner.legacyPlugin.stateRefreshReady = false; return owner.legacyPlugin.handle({ scope: owner.scope, view, itemIndex, observer: domObserver, batchController, featureOwnsStartup: true }); })
        .then(() => owner.initializeListRuntime())
        .then(() => owner.supplementaryCards.start())
        .catch((error) => {
            owner.dispose();
            throw error;
        });
}
