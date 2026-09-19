// @ts-check

import { HostedDetailSurface } from "../../ui/detail/hosted-detail-surface.js";

export class DetailController {
    /** @param {{hostAdapter: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, enabledContributions: readonly string[]}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.scope = options.scope;
        this.enabledContributions = new Set(options.enabledContributions);
        this.surface = new HostedDetailSurface(this.hostAdapter);
        this.movieRef = null;
    }
    start() {
        this.scope.assertActive();
        this.surface.mount();
        this.movieRef = this.hostAdapter.readMovieRef();
        return Object.freeze({ movieRef: this.movieRef, contributions: [...this.enabledContributions] });
    }
    dispose() { this.surface.dispose(); this.scope.dispose(); }
}
