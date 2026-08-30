// @ts-check

import { HostedDetailSurface } from "../../ui/detail/hosted-detail-surface.js";

export class DetailController {
    /** @param {{hostAdapter: any, nativePlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, workspacePlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, reviewPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, relatedPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, pageActionsPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, screenshotPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, magnetPlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, scope: import("../../core/lifecycle-scope.js").LifecycleScope, enabledContributions: readonly string[]}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.nativePlugin = options.nativePlugin ?? null;
        this.workspacePlugin = options.workspacePlugin ?? null;
        this.reviewPlugin = options.reviewPlugin ?? null;
        this.relatedPlugin = options.relatedPlugin ?? null;
        this.pageActionsPlugin = options.pageActionsPlugin ?? null;
        this.screenshotPlugin = options.screenshotPlugin ?? null;
        this.magnetPlugin = options.magnetPlugin ?? null;
        this.scope = options.scope;
        this.enabledContributions = new Set(options.enabledContributions);
        this.surface = new HostedDetailSurface(this.hostAdapter);
        this.movieRef = null;
    }
    start() {
        this.scope.assertActive();
        this.surface.mount();
        this.movieRef = this.hostAdapter.readMovieRef();
        return Promise.resolve()
            .then(() => this.nativePlugin?.handle?.({ scope: this.scope }))
            .then(() => this.workspacePlugin?.handle?.({ scope: this.scope }))
            .then(() => this.reviewPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.relatedPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.pageActionsPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.magnetPlugin?.handle?.({ scope: this.scope }))
            .then(() => this.screenshotPlugin?.handle?.({ scope: this.scope }))
            .then(() => Object.freeze({
            movieRef: this.movieRef,
            contributions: [...this.enabledContributions],
            }));
    }
    dispose() { this.surface.dispose(); this.scope.dispose(); }
}
