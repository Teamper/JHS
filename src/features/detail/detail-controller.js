// @ts-check

import { HostedDetailSurface } from "../../ui/detail/hosted-detail-surface.js";

export class DetailController {
    /** @param {{hostAdapter: any, fc2Plugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, nativePlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, workspacePlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, reviewPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, relatedPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, pageActionsPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, magnetPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, previewPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, externalSitesPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, screenshotPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, scope: import("../../core/lifecycle-scope.js").LifecycleScope, enabledContributions: readonly string[], ownedDetail?: boolean}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.fc2Plugin = options.fc2Plugin ?? null;
        this.nativePlugin = options.nativePlugin ?? null;
        this.workspacePlugin = options.workspacePlugin ?? null;
        this.reviewPlugin = options.reviewPlugin ?? null;
        this.relatedPlugin = options.relatedPlugin ?? null;
        this.pageActionsPlugin = options.pageActionsPlugin ?? null;
        this.magnetPlugin = options.magnetPlugin ?? null;
        this.previewPlugin = options.previewPlugin ?? null;
        this.externalSitesPlugin = options.externalSitesPlugin ?? null;
        this.screenshotPlugin = options.screenshotPlugin ?? null;
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
        if (this.ownedDetail) return Promise.resolve()
            .then(() => this.fc2Plugin?.handle?.({ scope: this.scope }))
            .then(() => Object.freeze({ movieRef: this.movieRef, contributions: [...this.enabledContributions] }));
        return Promise.resolve()
            .then(() => this.fc2Plugin?.handle?.({ scope: this.scope }))
            .then(() => this.nativePlugin?.handle?.({ scope: this.scope }))
            .then(() => this.workspacePlugin?.handle?.({ scope: this.scope }))
            .then(() => this.reviewPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.relatedPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.pageActionsPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.magnetPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.previewPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.externalSitesPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.screenshotPlugin?.handle?.({ scope: this.scope }))
            .then(() => Object.freeze({
            movieRef: this.movieRef,
            contributions: [...this.enabledContributions],
            }));
    }
    dispose() { this.surface.dispose(); this.scope.dispose(); }
}
