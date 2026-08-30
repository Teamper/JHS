// @ts-check

import { ListView } from "./list-view.js";

/**
 * Own the list feature lifecycle while the legacy page implementation is being
 * strangled out of PluginManager.
 */
export class ListController {
    /** @param {{legacyPlugin?: {getSelector?: () => Record<string, string>, getListSelectors?: () => Record<string, string>, handle: (options?: {scope: any, view: ListView}) => Promise<any> | any, setQuickFilter?: (filter: unknown, options?: any) => any, openMovieDetail?: (item: any, options?: any) => any}, autoPagePlugin?: {handle?: (options?: {scope: any, listFeatureApi: any}) => Promise<any> | any}, foldCategoryPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, scope: any, hostAdapter: any}} options */
    constructor(options) {
        this.legacyPlugin = options.legacyPlugin ?? null;
        this.autoPagePlugin = options.autoPagePlugin ?? null;
        this.foldCategoryPlugin = options.foldCategoryPlugin ?? null;
        this.scope = options.scope;
        this.hostAdapter = options.hostAdapter;
        this.view = null;
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
                onFilterChange: (filter, options) => this.legacyPlugin?.setQuickFilter?.(filter, options),
                onOpenMovieDetail: (item, options) => this.legacyPlugin?.openMovieDetail?.(item, options),
            });
        }
        this.started = true;
        const listFeatureApi = this.getApi();
        const view = this.view;
        return Promise.resolve()
            .then(() => this.legacyPlugin && view ? this.legacyPlugin.handle({ scope: this.scope, view }) : undefined)
            .then(() => this.autoPagePlugin?.handle?.({ scope: this.scope, listFeatureApi }))
            .then(() => this.foldCategoryPlugin?.handle?.({ scope: this.scope }))
            .catch((error) => {
            this.dispose();
            throw error;
            });
    }

    /** Expose the stable list capability surface to other Features. */
    getApi() {
        const legacyPlugin = /** @type {any} */ (this.legacyPlugin);
        const call = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => legacyPlugin?.[name]?.(...args);
        return Object.freeze({
            getListSelectors: () => this.hostAdapter.getListSelectors?.() ?? legacyPlugin?.getListSelectors?.() ?? legacyPlugin?.getSelector?.(),
            advanceListGeneration: call("advanceListGeneration"),
            configureHoverPreview: call("configureHoverPreview"),
            replaceHdImg: call("replaceHdImg"),
            doFilter: call("doFilter"),
            createQuickFilter: call("createQuickFilter"),
            batchSaveAllVideos: call("batchSaveAllVideos"),
            reconcileListItems: call("reconcileListItems"),
            applyVisibility: call("applyVisibility"),
            rebuildItemIndex: call("rebuildItemIndex"),
            bindMovieDetailNavigation: call("bindMovieDetailNavigation"),
            bindClick: call("bindClick"),
            openMovieDetail: call("openMovieDetail"),
            findCarNumAndHref: call("findCarNumAndHref"),
            parseActressName: call("parseActressName"),
            setQuickFilter: call("setQuickFilter"),
            getActiveQuickFilter: () => legacyPlugin.activeQuickFilter,
            createEvaluationContext: call("createEvaluationContext"),
            translateListItems: call("translateListItems"),
            revertTranslation: call("revertTranslation"),
            invalidateTranslations: call("invalidateTranslations"),
            getCurrentPageSummary: call("getCurrentPageSummary"),
        });
    }

    dispose() {
        this.view?.dispose();
        this.view = null;
        this.started = false;
    }
}
