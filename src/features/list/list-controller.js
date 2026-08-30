// @ts-check

/**
 * Own the list feature lifecycle while the legacy page implementation is being
 * strangled out of PluginManager.
 */
export class ListController {
    /** @param {{legacyPlugin: {handle: (options?: {scope: any}) => Promise<any> | any}, scope: any, hostAdapter: any}} options */
    constructor(options) {
        this.legacyPlugin = options.legacyPlugin;
        this.scope = options.scope;
        this.hostAdapter = options.hostAdapter;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve(this.legacyPlugin.handle({ scope: this.scope }));
    }

    dispose() {
        this.started = false;
    }
}
