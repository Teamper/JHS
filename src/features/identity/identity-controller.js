// @ts-check

/**
 * Own identity-related navigation and lookup contributions while their legacy
 * implementations are being migrated to service-backed boundaries.
 */
export class IdentityController {
    /** @param {{javdbNavigationController?: {start: (options?: {scope?: any, identityApi?: any}) => Promise<any> | any} | null, javbusNavigationController?: {start: (options?: {scope?: any, identityApi?: any}) => Promise<any> | any} | null, imageSearchPlugin?: Record<string, any>, actressInfoPlugin?: {handle: (options?: {scope?: any}) => Promise<any> | any}, scope: any}} options */
    constructor(options) {
        this.javdbNavigationController = options.javdbNavigationController ?? null;
        this.javbusNavigationController = options.javbusNavigationController ?? null;
        this.imageSearchPlugin = options.imageSearchPlugin ?? null;
        this.actressInfoPlugin = options.actressInfoPlugin ?? null;
        this.scope = options.scope;
        this.started = false;
        this.api = Object.freeze({
            hasSearchByImage: Boolean(this.imageSearchPlugin),
            openSearchByImage: (/** @type {any[]} */ ...args) => this.imageSearchPlugin?.open?.(...args),
            handleSearchImageFile: (/** @type {any[]} */ ...args) => this.imageSearchPlugin?.handleImageFile?.(...args),
            resetSearchImageUi: (/** @type {any[]} */ ...args) => this.imageSearchPlugin?.resetSearchUI?.(...args),
            hasActressInfo: Boolean(this.actressInfoPlugin),
        });
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve().then(async () => {
            const api = this.getApi();
            await this.javdbNavigationController?.start({ scope: this.scope, identityApi: api });
            await this.javbusNavigationController?.start({ scope: this.scope, identityApi: api });
            await this.actressInfoPlugin?.handle({ scope: this.scope });
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    /** Expose stable identity capabilities to navigation contributions and later features. */
    getApi() {
        return this.api;
    }

    dispose() {
        this.started = false;
    }
}
