// @ts-check

/**
 * Own the first library contribution while the remaining library plugins stay
 * on the transitional legacy path.
 */
export class LibraryController {
    /** @param {{historyPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any, historyRepository?: any}, statePlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, keywordFilterPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, scope: any}} options */
    constructor(options) {
        this.historyPlugin = options.historyPlugin ?? null;
        this.statePlugin = options.statePlugin ?? null;
        this.keywordFilterPlugin = options.keywordFilterPlugin ?? null;
        this.scope = options.scope;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve().then(async () => {
            await this.historyPlugin?.handle({ scope: this.scope });
            await this.statePlugin?.handle({ scope: this.scope });
            await this.keywordFilterPlugin?.handle({ scope: this.scope });
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    /** Expose the stable library capability surface for later migrations. */
    getApi() {
        return Object.freeze({
            getHistoryRepository: () => this.historyPlugin?.historyRepository ?? null,
        });
    }

    dispose() {
        this.started = false;
    }
}
