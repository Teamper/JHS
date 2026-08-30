// @ts-check

/**
 * Own the responsive shell lifecycle while its rendering implementation remains
 * a legacy contribution.
 */
export class ResponsiveShellController {
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

    dispose() {
        this.started = false;
    }
}
