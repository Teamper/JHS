// @ts-check

import { HostedDetailSurface } from "../../ui/detail/hosted-detail-surface.js";

export class DetailController {
    /** @param {{hostAdapter: any, fc2Plugin?: {handle?: (options?: {scope: any, externalMagnets?: any, externalSites?: any, detailActions?: any, fc2Lookup?: any}) => Promise<any> | any} | null, nativeController?: {start?: () => Promise<any> | any} | null, workspaceController?: {start?: () => Promise<any> | any, dispose?: () => void} | null, reviewController?: {start?: () => Promise<any> | any, dispose?: () => void} | null, relatedController?: {start?: () => Promise<any> | any, dispose?: () => void} | null, pageActionsPlugin?: {handle?: (options?: {scope: any, externalMagnets?: any, nativeMagnets?: any}) => Promise<any> | any, dispose?: () => void} | null, magnetPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any} | null, externalMagnetsController?: {start?: () => Promise<any> | any, createMagnetHub?: (carNum: string, options?: any) => Promise<any> | any, dispose?: () => void} | null, fc2Lookup?: any, previewPlugin?: {handle?: (options?: {scope: any, detailActions?: any}) => Promise<any> | any, dispose?: () => void} | null, externalSitesPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any} | null, screenshotController?: {start?: () => Promise<any> | any, dispose?: () => void} | null, isolateContribution?: (id: string, operation: () => any) => Promise<any> | any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, enabledContributions: readonly string[], ownedDetail?: boolean}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.fc2Plugin = options.fc2Plugin ?? null;
        this.nativeController = options.nativeController ?? null;
        this.workspaceController = options.workspaceController ?? null;
        this.reviewController = options.reviewController ?? null;
        this.relatedController = options.relatedController ?? null;
        this.pageActionsPlugin = options.pageActionsPlugin ?? null;
        this.magnetPlugin = options.magnetPlugin ?? null;
        this.externalMagnetsController = options.externalMagnetsController ?? null;
        this.fc2Lookup = options.fc2Lookup ?? null;
        this.previewPlugin = options.previewPlugin ?? null;
        this.externalSitesPlugin = options.externalSitesPlugin ?? null;
        this.screenshotController = options.screenshotController ?? null;
        this.isolateContribution = options.isolateContribution ?? ((_id, operation) => operation());
        this.scope = options.scope;
        this.enabledContributions = new Set(options.enabledContributions);
        this.ownedDetail = options.ownedDetail === true;
        this.surface = new HostedDetailSurface(this.hostAdapter);
        this.movieRef = null;
    }
    start() {
        this.scope.assertActive();
        if (!this.ownedDetail) {
            this.surface.mount();
            this.movieRef = this.hostAdapter.readMovieRef();
        }
        const run = (/** @type {string} */ id, /** @type {() => any} */ operation) => this.isolateContribution(id, operation);
        if (this.ownedDetail) return Promise.resolve()
            .then(() => run("detail.fc2-owned", () => this.fc2Plugin?.handle?.({ scope: this.scope, ...(this.externalMagnetsController ? { externalMagnets: this.externalMagnetsController } : {}), ...(this.externalSitesPlugin ? { externalSites: this.externalSitesPlugin } : {}), ...(this.pageActionsPlugin ? { detailActions: this.pageActionsPlugin } : {}), ...(this.fc2Lookup ? { fc2Lookup: this.fc2Lookup } : {}) })))
            .then(() => Object.freeze({ movieRef: this.movieRef, contributions: [...this.enabledContributions] }));
        return Promise.resolve()
            .then(() => run("detail.fc2-owned", () => this.fc2Plugin?.handle?.({ scope: this.scope, ...(this.externalMagnetsController ? { externalMagnets: this.externalMagnetsController } : {}), ...(this.externalSitesPlugin ? { externalSites: this.externalSitesPlugin } : {}), ...(this.pageActionsPlugin ? { detailActions: this.pageActionsPlugin } : {}), ...(this.fc2Lookup ? { fc2Lookup: this.fc2Lookup } : {}) })))
            .then(() => run("detail.javdb-native", () => this.nativeController?.start?.()))
            .then(() => run("detail.workspace", () => this.workspaceController?.start?.()))
            .then(() => run("detail.reviews", () => this.reviewController?.start?.()))
            .then(() => run("detail.related", () => this.relatedController?.start?.()))
            .then(() => run("detail.page-state-actions", () => this.pageActionsPlugin?.handle?.({ scope: this.scope, ...(this.externalMagnetsController ? { externalMagnets: this.externalMagnetsController } : {}), ...(this.magnetPlugin ? { nativeMagnets: this.magnetPlugin } : {}) })))
            .then(() => run("detail.native-magnets", () => this.magnetPlugin?.handle?.({ scope: this.scope })))
            .then(() => run("detail.javdb-preview", () => this.previewPlugin?.handle?.({ scope: this.scope, ...(this.pageActionsPlugin ? { detailActions: this.pageActionsPlugin } : {}) })))
            .then(() => run("detail.external-sites", () => this.externalSitesPlugin?.handle?.({ scope: this.scope })))
            .then(() => run("detail.screenshot", () => this.screenshotController?.start?.()))
            .then(() => Object.freeze({
            movieRef: this.movieRef,
            contributions: [...this.enabledContributions],
            }));
    }
    /** Expose detail state and subtitle actions to other feature-owned consumers. */
    getApi() {
        const route = (/** @type {any} */ feature, /** @type {string} */ name) => (/** @type {any[]} */ ...args) => feature?.[name]?.(...args);
        return Object.freeze({
            hasPageActions: Boolean(this.pageActionsPlugin),
            hasNativeMagnets: Boolean(this.magnetPlugin),
            hasExternalMagnets: Boolean(this.externalMagnetsController),
            hasFc2: Boolean(this.fc2Plugin),
            showStatus: route(this.pageActionsPlugin, "showStatus"),
            filterOne: route(this.pageActionsPlugin, "filterOne"),
            favoriteOne: route(this.pageActionsPlugin, "favoriteOne"),
            hasDownOne: route(this.pageActionsPlugin, "hasDownOne"),
            hasWatchOne: route(this.pageActionsPlugin, "hasWatchOne"),
            searchXunLeiSubtitle: route(this.pageActionsPlugin, "searchXunLeiSubtitle"),
            toggleMagnetFilter: route(this.pageActionsPlugin, "toggleMagnetFilter"),
            openMagnetSearch: route(this.pageActionsPlugin, "openMagnetSearch"),
            openSubtitleSearch: route(this.pageActionsPlugin, "openSubtitleSearch"),
            resolveFc2Source: route(this.fc2Plugin, "resolveFc2Source"),
            resolveMovieIdForRecord: route(this.fc2Plugin, "resolveMovieIdForRecord"),
            openFc2Dialog: route(this.fc2Plugin, "openFc2Dialog"),
            openFc2Page: route(this.fc2Plugin, "openFc2Page"),
        });
    }
    dispose() { this.screenshotController?.dispose?.(); this.externalMagnetsController?.dispose?.(); this.relatedController?.dispose?.(); this.reviewController?.dispose?.(); this.workspaceController?.dispose?.(); this.pageActionsPlugin?.dispose?.(); this.previewPlugin?.dispose?.(); this.surface.dispose(); this.scope.dispose(); }
}
