// @ts-check

/**
 * Own the statistics surface while its rendering implementation remains a
 * legacy contribution.
 */
export class StatsController {
    /** @param {{statsPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any, openDialog?: (...args: any[]) => any}, scope: any}} options */
    constructor(options) {
        this.statsPlugin = options.statsPlugin ?? null;
        this.scope = options.scope;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve()
            .then(() => this.statsPlugin?.handle?.({ scope: this.scope }))
            .catch((error) => {
                this.dispose();
                throw error;
            });
    }

    getApi() {
        return Object.freeze({
            hasDashboard: Boolean(this.statsPlugin),
            openDialog: (/** @type {any[]} */ ...args) => this.statsPlugin?.openDialog?.(...args),
        });
    }

    dispose() {
        this.started = false;
    }
}
