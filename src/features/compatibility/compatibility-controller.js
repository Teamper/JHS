// @ts-check

/**
 * Own compatibility-only page decorations while their implementation remains
 * in the legacy plugin boundary.
 */
export class CompatibilityController {
    /** @param {{plugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, scope: any}} options */
    constructor(options) {
        this.plugin = options.plugin ?? null;
        this.scope = options.scope;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve()
            .then(() => this.plugin?.handle?.({ scope: this.scope }))
            .catch((error) => {
                this.dispose();
                throw error;
            });
    }

    getApi() {
        return Object.freeze({ hasEnhancements: Boolean(this.plugin) });
    }

    dispose() {
        this.started = false;
    }
}
