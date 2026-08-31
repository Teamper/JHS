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
import { scanAllPages } from "./batch-scanner.js";
import { evaluateListItem } from "./list-evaluator.js";
import { readListItem as parseListItem } from "../../core/list-item-reader.js";

/**
 * Own the list feature lifecycle while the legacy page implementation is being
 * strangled out of PluginManager.
 */
export class ListController {
    /** @param {{legacyPlugin?: {getSelector?: () => Record<string, string>, getListSelectors?: () => Record<string, string>, handle: (options?: {scope: any, view: ListView}) => Promise<any> | any, setQuickFilter?: (filter: unknown, options?: any) => any, openMovieDetail?: (item: any, options?: any) => any, findCarNumAndHref?: (item: any) => {carNum?: unknown} | null, recordListPhase?: (phase: string, itemCount?: number | null) => void, attachListState?: (state: ListStateController) => void, attachListIndex?: (index: ListIndexController) => void, attachListDomObserver?: (observer: ListDomObserver) => void, attachListMedia?: (media: ListMediaController) => void, attachListImages?: (images: ListImageController) => void, attachListEvents?: (events: ListEventController) => void, attachListBatch?: (batch: ListBatchService) => void, attachListEvaluation?: (evaluation: ListEvaluationService) => void, processAddedItems?: (items: Element[], revision: string) => Promise<void> | void, getLibraryFeatureApi?: () => Promise<any>, createEvaluationContext?: () => Promise<any>, createQuickFilter?: (initialFilter?: unknown) => Promise<any> | any, initCss?: () => Promise<string> | string}, autoPagePlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, foldCategoryPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, actionsPlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, fc2NavigationPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, coverPlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, fc2LookupPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, scope: any, hostAdapter: any, settings?: {snapshot: () => Record<string, any>}, storage?: any, eventBus?: any, http?: any, stateService?: any, styles?: {register: (id: string, css: string) => () => void}}} options */
    constructor(options) {
        this.legacyPlugin = options.legacyPlugin ?? null;
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
            onPhase: (phase, itemCount) => this.legacyPlugin?.recordListPhase?.(phase, itemCount),
        });
        this.index = null;
        this.domObserver = null;
        this.media = null;
        this.images = null;
        this.events = null;
        this.batch = null;
        this.evaluation = null;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        const selectors = this.hostAdapter.getListSelectors?.() ?? this.legacyPlugin?.getSelector?.();
        if (this.legacyPlugin && !selectors) throw new Error("List feature requires a list selector contract");
        if (this.legacyPlugin) {
            this.view = new ListView({
                hostAdapter: this.hostAdapter,
                selectors,
                onFilterChange: (filter, options) => this.setQuickFilter(filter, options),
                onOpenMovieDetail: (item, options) => this.legacyPlugin?.openMovieDetail?.(item, options),
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
                processAddedItems: (items, revision) => this.legacyPlugin?.processAddedItems?.(items, revision),
                onPhase: (phase, itemCount) => this.legacyPlugin?.recordListPhase?.(phase, itemCount),
            });
            this.media = new ListMediaController({ scope: this.scope, document: this.hostAdapter.document, selectors });
            this.images = new ListImageController({ scope: this.scope, document: this.hostAdapter.document, window: this.hostAdapter.document?.defaultView ?? globalThis.window, site: this.hostAdapter.site, selector: selectors.coverImgSelector });
            this.evaluation = this.stateService && this.storage ? new ListEvaluationService({ scope: this.scope, storage: this.storage, stateService: this.stateService }) : null;
            this.events = new ListEventController({
                scope: this.scope,
                settings: this.settings,
                eventBus: this.eventBus,
                storage: this.storage,
                state: this.state,
                index: this.index,
                legacyPlugin: this.legacyPlugin,
                evaluation: this.evaluation,
                onHoverSettingChanged: (event) => {
                    const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
                    if (names.includes("hoverBigImg")) this.images?.configureHoverPreview(this.settings?.snapshot?.().hoverBigImg === "yes" ? "yes" : "no");
                },
                onReloadHistory: () => this.legacyPlugin?.getLibraryFeatureApi?.().then((/** @type {any} */ api) => api?.reloadHistoryTable?.()).catch((/** @type {unknown} */ error) => clog.warn("鉴定记录刷新失败", error)),
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
                getEvaluationContext: () => this.evaluation?.createEvaluationContext?.() ?? this.legacyPlugin?.createEvaluationContext?.(),
            });
        }
        this.legacyPlugin?.attachListState?.(this.state);
        this.index && this.legacyPlugin?.attachListIndex?.(this.index);
        this.domObserver && this.legacyPlugin?.attachListDomObserver?.(this.domObserver);
        this.media && this.legacyPlugin?.attachListMedia?.(this.media);
        this.images && this.legacyPlugin?.attachListImages?.(this.images);
        this.events && this.legacyPlugin?.attachListEvents?.(this.events);
        this.batch && this.legacyPlugin?.attachListBatch?.(this.batch);
        this.evaluation && this.legacyPlugin?.attachListEvaluation?.(this.evaluation);
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
        return Object.freeze({
            getListSelectors: () => this.hostAdapter.getListSelectors?.() ?? legacyPlugin?.getListSelectors?.() ?? legacyPlugin?.getSelector?.(),
            advanceListGeneration: () => this.state.advanceListGeneration(),
            configureHoverPreview: call("configureHoverPreview"),
            replaceHdImg: call("replaceHdImg"),
            doFilter: call("doFilter"),
            createQuickFilter: (/** @type {unknown} */ initialFilter) => this.state.createQuickFilter(initialFilter),
            batchSaveAllVideos: (/** @type {any[]} */ ...args) => {
                const batch = /** @type {any} */ (this.batch);
                return batch ? batch.batchSaveAllVideos(...args) : legacyPlugin?.batchSaveAllVideos?.(...args);
            },
            reconcileListItems: (/** @type {Element[] | null} */ items, /** @type {string} */ revision) => this.state.reconcileListItems(items, revision),
            applyVisibility: (/** @type {Element[] | null} */ items) => this.state.applyVisibility(items),
            syncQuickFilterUi: () => this.state.syncQuickFilterUi(),
            rebuildItemIndex: call("rebuildItemIndex"),
            bindMovieDetailNavigation: call("bindMovieDetailNavigation"),
            bindClick: call("bindClick"),
            openMovieDetail: call("openMovieDetail"),
            showCarNumBox: call("showCarNumBox"),
            findCarNumAndHref: (/** @type {any} */ item) => this.readListItem(item),
            parseActressName: call("parseActressName"),
            setQuickFilter: (/** @type {unknown} */ filter, /** @type {{syncUi?: boolean}} [options] */ options) => this.setQuickFilter(filter, options),
            getActiveQuickFilter: () => this.state.activeQuickFilter,
            createEvaluationContext: call("createEvaluationContext"),
            translateListItems: call("translateListItems"),
            revertTranslation: call("revertTranslation"),
            invalidateTranslations: call("invalidateTranslations"),
            getCurrentPageSummary: call("getCurrentPageSummary"),
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

    /** @param {unknown} filter @param {{syncUi?: boolean}} [options] */
    setQuickFilter(filter, options) {
        return this.state.setQuickFilter(filter, options);
    }
}
