// @ts-check

import { ListView } from "./list-view.js";
import { ListStateController } from "./list-state-controller.js";
import { ListIndexController } from "./list-index-controller.js";
import { ListDomObserver } from "./list-dom-observer.js";
import { ListMediaController } from "./list-media-controller.js";
import { ListImageController } from "./list-image-controller.js";
import { ListEventController } from "./list-event-controller.js";
import { ListBatchService } from "./list-batch-service.js";
import { ListEvaluationService } from "./list-evaluation-service.js";
import { ListSummaryService } from "./list-summary-service.js";
import { ListTranslationService } from "./list-translation-service.js";
import { ListFilterService } from "./list-filter-service.js";
import { ListIncrementalService } from "./list-incremental-service.js";
import { ListContextMenuController } from "./list-context-menu-controller.js";
import { ListActressNameService } from "./list-actress-name-service.js";
import { ListPaginationController } from "./list-pagination-controller.js";
import { ListTagExpandController } from "./list-tag-expand-controller.js";
import { ListDiagnosticsService } from "./list-diagnostics-service.js";
import { scanAllPages } from "./batch-scanner.js";
import { evaluateListItem } from "./list-evaluator.js";
import { readListItem as parseListItem } from "../../core/list-item-reader.js";

/**
 * Own the list feature lifecycle while the legacy page implementation is being
 * strangled out of PluginManager.
 */
export class ListController {
    /** @param {{legacyPlugin?: {getSelector?: () => Record<string, string>, getListSelectors?: () => Record<string, string>, handle: (options?: {scope: any, view: ListView}) => Promise<any> | any, setQuickFilter?: (filter: unknown, options?: any) => any, openMovieDetail?: (item: any, options?: any) => any, findCarNumAndHref?: (item: any) => {carNum?: unknown} | null, recordListPhase?: (phase: string, itemCount?: number | null) => void, attachListHost?: (host: any) => void, attachListState?: (state: ListStateController) => void, attachListIndex?: (index: ListIndexController) => void, attachListDomObserver?: (observer: ListDomObserver) => void, attachListMedia?: (media: ListMediaController) => void, attachListImages?: (images: ListImageController) => void, attachListEvents?: (events: ListEventController) => void, attachListBatch?: (batch: ListBatchService) => void, attachListEvaluation?: (evaluation: ListEvaluationService) => void, attachListSummary?: (summary: ListSummaryService) => void, attachListTranslation?: (translation: any) => void, attachListFilter?: (filter: ListFilterService) => void, attachListIncremental?: (incremental: ListIncrementalService) => void, attachListContextMenu?: (contextMenu: ListContextMenuController) => void, processAddedItems?: (items: Element[], revision: string) => Promise<void> | void, getLibraryFeatureApi?: () => Promise<any>, createEvaluationContext?: () => Promise<any>, createQuickFilter?: (initialFilter?: unknown) => Promise<any> | any, initCss?: () => Promise<string> | string}, autoPagePlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, foldCategoryPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, actionsPlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, fc2NavigationPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, coverPlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, fc2LookupPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, scope: any, hostAdapter: any, settings?: {snapshot: () => Record<string, any>}, storage?: any, eventBus?: any, http?: any, stateService?: any, styles?: {register: (id: string, css: string) => () => void}}} options */
    constructor(options) {
        this.legacyPlugin = options.legacyPlugin ?? null;
        this.features = /** @type {any} */ (options).features ?? null;
        this.busImgPlugin = /** @type {any} */ (options).busImgPlugin ?? null;
        this.autoPagePlugin = options.autoPagePlugin ?? null;
        this.foldCategoryPlugin = options.foldCategoryPlugin ?? null;
        this.actionsPlugin = options.actionsPlugin ?? null;
        this.fc2NavigationPlugin = options.fc2NavigationPlugin ?? null;
        this.coverPlugin = options.coverPlugin ?? null;
        this.fc2LookupPlugin = options.fc2LookupPlugin ?? null;
        this.scope = options.scope;
        this.hostAdapter = options.hostAdapter;
        this.settings = options.settings ?? null;
        this.storage = options.storage ?? null;
        this.eventBus = options.eventBus ?? null;
        this.http = options.http ?? null;
        this.stateService = options.stateService ?? null;
        this.styles = options.styles ?? null;
        this.styleRelease = null;
        this.view = null;
        this.state = new ListStateController({
            scope: this.scope,
            defaultFilter: () => options.settings?.snapshot?.().defaultQuickFilterTab ?? "waitCheck",
            onPhase: (phase, itemCount) => this.diagnostics?.recordPhase(phase, itemCount),
        });
        this.index = null;
        this.domObserver = null;
        this.media = null;
        this.images = null;
        this.events = null;
        this.batch = null;
        this.evaluation = null;
        this.summary = null;
        this.titleTranslation = null;
        this.filter = null;
        this.incremental = null;
        this.contextMenu = null;
        this.actressNames = null;
        this.pagination = null;
        this.tagExpand = null;
        this.diagnostics = null;
        this.translation = /** @type {any} */ (options).translation ?? null;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        const selectors = this.hostAdapter.getListSelectors?.() ?? this.legacyPlugin?.getSelector?.();
        if (this.legacyPlugin && !selectors) throw new Error("List feature requires a list selector contract");
        if (this.legacyPlugin) {
            this.diagnostics = new ListDiagnosticsService({ scope: this.scope, document: this.hostAdapter.document, selectors, state: this.state });
            this.view = new ListView({
                hostAdapter: this.hostAdapter,
                selectors,
                onFilterChange: (filter, options) => this.setQuickFilter(filter, options),
                onOpenMovieDetail: (item, options) => this.openMovieDetail(item, options),
            });
            this.state.setView(this.view);
            this.index = new ListIndexController({
                scope: this.scope,
                selectors,
                document: this.hostAdapter.document,
                readItem: (item) => this.readListItem(item),
            });
            this.domObserver = new ListDomObserver({
                scope: this.scope,
                selectors,
                document: this.hostAdapter.document,
                window: this.hostAdapter.document?.defaultView ?? globalThis.window,
                location: this.hostAdapter.location,
                state: this.state,
                index: this.index,
                processAddedItems: (items, revision) => this.incremental ? this.incremental.processAddedItems(items, revision) : this.legacyPlugin?.processAddedItems?.(items, revision),
                onPhase: (phase, itemCount) => this.diagnostics?.recordPhase(phase, itemCount),
            });
            this.media = new ListMediaController({ scope: this.scope, document: this.hostAdapter.document, selectors });
            this.images = new ListImageController({ scope: this.scope, document: this.hostAdapter.document, window: this.hostAdapter.document?.defaultView ?? globalThis.window, site: this.hostAdapter.site, selector: selectors.coverImgSelector });
            this.evaluation = this.stateService && this.storage ? new ListEvaluationService({ scope: this.scope, storage: this.storage, stateService: this.stateService }) : null;
            this.summary = new ListSummaryService({
                scope: this.scope,
                document: this.hostAdapter.document,
                window: this.hostAdapter.document?.defaultView ?? globalThis.window,
                selectors,
                site: this.hostAdapter.site,
            });
            this.titleTranslation = this.settings && this.translation ? new ListTranslationService({
                scope: this.scope,
                document: this.hostAdapter.document,
                window: this.hostAdapter.document?.defaultView ?? globalThis.window,
                selectors,
                site: this.hostAdapter.site,
                settings: this.settings,
                translation: this.translation,
            }) : null;
            this.filter = new ListFilterService({
                scope: this.scope,
                document: this.hostAdapter.document,
                window: this.hostAdapter.document?.defaultView ?? globalThis.window,
                selectors,
                site: this.hostAdapter.site,
                getActiveFilter: () => this.state.activeQuickFilter,
                captureRevision: () => this.state.captureListRevision(),
                isCurrentRevision: (revision) => this.state.isCurrentListGeneration(revision),
                getEvaluationContext: () => this.createEvaluationContext(),
                readItem: (item) => this.readListItem(item),
                recordPhase: (phase, itemCount) => this.diagnostics?.recordPhase(phase, itemCount),
                scheduleRecount: () => this.summary?.scheduleRecount?.(),
                translateItems: (items) => this.titleTranslation?.translateListItems?.(items) ?? (/** @type {any} */ (this.legacyPlugin))?.translateListItems?.(items),
                onJavBusFiltered: () => this.busImgPlugin?.logImageHeightsByRow?.(this.settings?.snapshot?.()),
            });
            this.incremental = new ListIncrementalService({
                scope: this.scope,
                selectors,
                images: this.images,
                captureRevision: () => this.state.captureListRevision(),
                isCurrentRevision: (revision) => this.state.isCurrentListGeneration(revision),
                filterItems: (items, revision) => this.filter?.doFilterItems(items, revision) ?? (/** @type {any} */ (this.legacyPlugin))?.doFilterItems?.(items, revision) ?? false,
                reconcileItems: (items, revision) => this.state.reconcileListItems(items, revision),
                prepareLayout: (items) => {
                    this.hostAdapter.prepareListItems?.(items);
                    this.pagination ? this.pagination.start() : (/** @type {any} */ (this.legacyPlugin))?.addJumpPageControl?.();
                },
                sortItems: () => (/** @type {any} */ (this.actionsPlugin))?.sortItems?.(),
                addCardActions: (items) => (/** @type {any} */ (this.coverPlugin))?.addSvgBtn?.(items),
                indexItems: (items) => this.index?.indexItems(items),
                eventBus: this.eventBus,
                autoPage: () => (/** @type {any} */ (this.autoPagePlugin))?.checkLoad?.(),
            });
            this.contextMenu = new ListContextMenuController({
                scope: this.scope,
                document: this.hostAdapter.document,
                selectors,
                site: this.hostAdapter.site,
                readItem: (item) => this.readListItem(item),
                stateService: this.stateService,
                parseActressName: (/** @type {string} */ url) => this.parseActressName(url),
            });
            this.actressNames = this.settings && this.http ? new ListActressNameService({ scope: this.scope, settings: this.settings, http: this.http, site: this.hostAdapter.site }) : null;
            this.pagination = new ListPaginationController({ scope: this.scope, document: this.hostAdapter.document, location: this.hostAdapter.location });
            this.tagExpand = this.storage ? new ListTagExpandController({ scope: this.scope, document: this.hostAdapter.document, location: this.hostAdapter.location, storage: this.storage }) : null;
            this.events = new ListEventController({
                scope: this.scope,
                settings: this.settings,
                eventBus: this.eventBus,
                storage: this.storage,
                state: this.state,
                index: this.index,
                legacyPlugin: this.legacyPlugin,
                evaluation: this.evaluation,
                filter: this.filter,
                onHoverSettingChanged: (event) => {
                    const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
                    if (names.includes("hoverBigImg")) this.images?.configureHoverPreview(this.settings?.snapshot?.().hoverBigImg === "yes" ? "yes" : "no");
                },
                onReloadHistory: () => this.getLibraryFeatureApi().then((/** @type {any} */ api) => api?.reloadHistoryTable?.()).catch((/** @type {unknown} */ error) => clog.warn("鉴定记录刷新失败", error)),
            });
            if (this.stateService && this.http) this.batch = new ListBatchService({
                scope: this.scope,
                document: this.hostAdapter.document,
                window: this.hostAdapter.document?.defaultView ?? globalThis.window,
                location: this.hostAdapter.location,
                hostAdapter: this.hostAdapter,
                selectors,
                stateService: this.stateService,
                http: this.http,
                getEvaluationContext: () => this.createEvaluationContext(),
            });
        }
        this.legacyPlugin?.attachListHost?.(this.hostAdapter);
        this.legacyPlugin?.attachListState?.(this.state);
        this.index && this.legacyPlugin?.attachListIndex?.(this.index);
        this.domObserver && this.legacyPlugin?.attachListDomObserver?.(this.domObserver);
        this.media && this.legacyPlugin?.attachListMedia?.(this.media);
        this.images && this.legacyPlugin?.attachListImages?.(this.images);
        this.events && this.legacyPlugin?.attachListEvents?.(this.events);
        this.batch && this.legacyPlugin?.attachListBatch?.(this.batch);
        this.evaluation && this.legacyPlugin?.attachListEvaluation?.(this.evaluation);
        this.summary && this.legacyPlugin?.attachListSummary?.(this.summary);
        this.titleTranslation && (/** @type {any} */ (this.legacyPlugin))?.attachListTranslation?.(this.titleTranslation);
        this.filter && (/** @type {any} */ (this.legacyPlugin))?.attachListFilter?.(this.filter);
        this.incremental && (/** @type {any} */ (this.legacyPlugin))?.attachListIncremental?.(this.incremental);
        this.contextMenu && (/** @type {any} */ (this.legacyPlugin))?.attachListContextMenu?.(this.contextMenu);
        this.pagination && (/** @type {any} */ (this.legacyPlugin))?.attachListPagination?.(this.pagination);
        this.tagExpand && (/** @type {any} */ (this.legacyPlugin))?.attachListTagExpand?.(this.tagExpand);
        this.started = true;
        const listFeatureApi = this.getApi();
        const view = this.view;
        const hasCore = Boolean(this.legacyPlugin);
        return Promise.resolve()
            .then(() => this.registerStyles())
            .then(() => this.legacyPlugin && view ? this.legacyPlugin.handle({ scope: this.scope, view }) : undefined)
            .then(() => hasCore ? this.autoPagePlugin?.handle?.({ scope: this.scope, listFeatureApi }) : undefined)
            .then(() => hasCore ? this.foldCategoryPlugin?.handle?.({ scope: this.scope }) : undefined)
            .then(() => {
                if (!hasCore || !this.actionsPlugin) return;
                this.scope.ownTimeout(setTimeout(() => {
                    if (this.scope.disposed) return;
                    void Promise.resolve(this.actionsPlugin?.handle?.({ scope: this.scope, listFeatureApi })).catch((/** @type {unknown} */ error) => {
                        clog.error("列表操作初始化失败", error);
                    });
                }, 0));
            })
            .then(() => this.fc2NavigationPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.coverPlugin?.handle?.({ scope: this.scope, listFeatureApi }))
            .then(() => this.fc2LookupPlugin?.handle?.({ scope: this.scope }))
            .catch((error) => {
            this.dispose();
            throw error;
            });
    }

    async registerStyles() {
        if (this.styleRelease || !this.styles || !this.legacyPlugin?.initCss) return;
        const css = await this.legacyPlugin.initCss();
        if (!css) return;
        this.styleRelease = this.styles.register("jhs-list-feature-style", css.replace(/^\s*<style>|<\/style>\s*$/g, ""));
    }

    /** Expose the stable list capability surface to other Features. */
    getApi() {
        const legacyPlugin = /** @type {any} */ (this.legacyPlugin);
        const call = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => legacyPlugin?.[name]?.(...args);
        const route = (/** @type {any} */ feature, /** @type {string} */ name) => (/** @type {any[]} */ ...args) => feature && "function" === typeof feature[name] ? feature[name](...args) : legacyPlugin?.[name]?.(...args);
        return Object.freeze({
            getListSelectors: () => this.hostAdapter.getListSelectors?.() ?? legacyPlugin?.getListSelectors?.() ?? legacyPlugin?.getSelector?.(),
            advanceListGeneration: () => this.state.advanceListGeneration(),
            configureHoverPreview: route(this.images, "configureHoverPreview"),
            replaceHdImg: route(this.images, "replaceHdImg"),
            doFilter: (/** @type {any[]} */ ...args) => this.filter ? this.filter.doFilter(...args) : legacyPlugin?.doFilter?.(...args),
            createQuickFilter: (/** @type {unknown} */ initialFilter) => this.state.createQuickFilter(initialFilter),
            batchSaveAllVideos: (/** @type {any[]} */ ...args) => {
                const batch = /** @type {any} */ (this.batch);
                return batch ? batch.batchSaveAllVideos(...args) : legacyPlugin?.batchSaveAllVideos?.(...args);
            },
            reconcileListItems: (/** @type {Element[] | null} */ items, /** @type {string} */ revision) => this.state.reconcileListItems(items, revision),
            applyVisibility: (/** @type {Element[] | null} */ items) => this.state.applyVisibility(items),
            syncQuickFilterUi: () => this.state.syncQuickFilterUi(),
            rebuildItemIndex: route(this.index, "rebuildItemIndex"),
            bindMovieDetailNavigation: route(this.view, "bindMovieDetailNavigation"),
            bindClick: call("bindClick"),
            openMovieDetail: (/** @type {any} */ item, /** @type {{event?: MouseEvent | null, autoplay?: boolean, newTab?: boolean} | undefined} */ options) => this.openMovieDetail(item, options),
            showCarNumBox: (/** @type {string} */ carNum) => this.showCarNumBox(carNum),
            findCarNumAndHref: (/** @type {any} */ item) => this.readListItem(item),
            parseActressName: (/** @type {string} */ url) => this.parseActressName(url),
            setQuickFilter: (/** @type {unknown} */ filter, /** @type {{syncUi?: boolean}} [options] */ options) => this.setQuickFilter(filter, options),
            getActiveQuickFilter: () => this.state.activeQuickFilter,
            createEvaluationContext: (/** @type {any[]} */ ...args) => this.createEvaluationContext(...args),
            translateListItems: (/** @type {any[]} */ ...args) => {
                const translation = /** @type {any} */ (this.titleTranslation);
                return translation ? translation.translateListItems(...args) : legacyPlugin?.translateListItems?.(...args);
            },
            revertTranslation: (/** @type {any[]} */ ...args) => {
                const translation = /** @type {any} */ (this.titleTranslation);
                return translation ? translation.revertTranslation(...args) : legacyPlugin?.revertTranslation?.(...args);
            },
            invalidateTranslations: route(this.titleTranslation, "invalidateTranslations"),
            getCurrentPageSummary: route(this.summary, "collectCurrentPageSummary"),
            scanAllPages: (/** @type {any} */ options) => scanAllPages(options),
            evaluateListItem: (/** @type {any} */ record, /** @type {any} */ context, /** @type {any} */ options) => evaluateListItem(record, context, options),
        });
    }

    dispose() {
        this.batch?.dispose();
        this.batch = null;
        this.events?.dispose();
        this.events = null;
        this.evaluation?.dispose();
        this.evaluation = null;
        this.summary?.dispose();
        this.summary = null;
        this.titleTranslation?.dispose();
        this.titleTranslation = null;
        this.filter?.dispose();
        this.filter = null;
        this.incremental?.dispose();
        this.incremental = null;
        this.contextMenu?.dispose();
        this.contextMenu = null;
        this.actressNames?.dispose();
        this.actressNames = null;
        this.pagination?.dispose();
        this.pagination = null;
        this.tagExpand?.dispose();
        this.tagExpand = null;
        this.diagnostics?.dispose();
        this.diagnostics = null;
        this.images?.dispose();
        this.images = null;
        this.media?.dispose();
        this.media = null;
        this.domObserver?.dispose();
        this.domObserver = null;
        this.state.dispose();
        this.index?.dispose();
        this.index = null;
        this.view?.dispose();
        this.styleRelease?.();
        this.styleRelease = null;
        this.view = null;
        this.started = false;
    }

    /** Read one list card through the feature-owned parser while preserving the legacy error notice. */
    readListItem(/** @type {any} */ item) {
        try {
            return parseListItem(item);
        } catch (error) {
            /** @type {any} */ (globalThis).show?.error?.("提取番号信息失败");
            throw error;
        }
    }

    /** Open a list card through the shared navigation helper without delegating to the legacy plugin. */
    /** @param {any} item @param {{event?: MouseEvent | null, autoplay?: boolean, newTab?: boolean}} [options] */
    async openMovieDetail(item, { event = null, autoplay = false, newTab = false } = {}) {
        const { carNum, aHref } = this.readListItem(item);
        if (!carNum || !aHref || carNum.includes("FC2-")) return;
        const baseUrl = this.hostAdapter.location?.href ?? this.hostAdapter.document?.location?.href ?? globalThis.window?.location?.href;
        if (!baseUrl) return;
        const shouldOpenTab = newTab || Boolean(event && (event.ctrlKey || event.metaKey || event.button === 1));
        const destination = new URL(aHref, baseUrl);
        if (autoplay) destination.searchParams.set("autoPlay", "1");
        /** @type {any} */ (globalThis).utils?.openPage?.(destination.href, carNum, true, { event, newTab: shouldOpenTab });
    }

    /** Resolve optional detail-page actress names while preserving the legacy fallback. */
    /** @param {string} url */
    parseActressName(url) {
        if (this.actressNames) return this.actressNames.parse(url);
        return (/** @type {any} */ (this.legacyPlugin))?.parseActressName?.(url);
    }

    /** Resolve the Library capability directly, retaining the legacy fallback for isolated callers. */
    getLibraryFeatureApi() {
        if (this.features?.getFeatureApi) return Promise.resolve(this.features.getFeatureApi("library"));
        return Promise.resolve((/** @type {any} */ (this.legacyPlugin))?.getLibraryFeatureApi?.() ?? null);
    }

    /** Resolve the canonical evaluator context, retaining the legacy fallback for isolated callers. @param {...any} args */
    createEvaluationContext(...args) {
        if (this.evaluation) return (/** @type {any} */ (this.evaluation)).createEvaluationContext(...args);
        return (/** @type {any} */ (this.legacyPlugin))?.createEvaluationContext?.(...args);
    }

    /** Reveal a hidden list card through the HostAdapter-owned item boundary. */
    /** @param {string} carNum */
    showCarNumBox(carNum) {
        const target = String(carNum ?? "").trim();
        if (!target) return;
        const items = this.hostAdapter.locateListItems?.() ?? [];
        const item = items.find((/** @type {Element} */ candidate) => candidate.querySelector(".video-title strong")?.textContent?.trim() === target);
        if (!item || item.getAttribute("data-hide") !== "yes") return;
        item.removeAttribute("data-hide");
        item.style.removeProperty("display");
    }

    /** @param {unknown} filter @param {{syncUi?: boolean}} [options] */
    setQuickFilter(filter, options) {
        return this.state.setQuickFilter(filter, options);
    }
}
