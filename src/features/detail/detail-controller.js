// @ts-check

import { HostedDetailSurface } from "../../ui/detail/hosted-detail-surface.js";

export class DetailController {
    /** @param {{hostAdapter: any, workspacePlugin?: {handle?: (options?: {scope: any}) => Promise<any> | any}, scope: import("../../core/lifecycle-scope.js").LifecycleScope, enabledContributions: readonly string[]}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.workspacePlugin = options.workspacePlugin ?? null;
        this.scope = options.scope;
        this.enabledContributions = new Set(options.enabledContributions);
        this.surface = new HostedDetailSurface(this.hostAdapter);
        this.movieRef = null;
    }
    start() {
        this.scope.assertActive();
        this.surface.mount();
        this.movieRef = this.hostAdapter.readMovieRef();
        return Promise.resolve().then(() => this.workspacePlugin?.handle?.({ scope: this.scope })).then(() => Object.freeze({
            movieRef: this.movieRef,
            contributions: [...this.enabledContributions],
        }));
    }
    dispose() { this.surface.dispose(); this.scope.dispose(); }
}
