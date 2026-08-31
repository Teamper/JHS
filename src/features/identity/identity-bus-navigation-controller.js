// @ts-check

/** Own the JavBus image-search navigation action and its scoped cleanup. */
export class IdentityBusNavigationController {
    /** @param {{hostAdapter?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.window = this.document?.defaultView ?? globalThis.window;
        this.ui = options.ui ?? null;
        this.scope = options.scope;
        this.started = false;
    }

    getJQuery() {
        const jq = this.ui?.getJQuery?.();
        if (typeof jq !== "function") throw new TypeError("JavBus 身份导航需要 jQuery");
        return jq;
    }

    /** @param {{identityApi?: any}} [options] */
    start(options = {}) {
        this.scope.assertActive();
        if (this.started || this.hostAdapter?.site !== "javbus" || !options.identityApi?.hasSearchByImage) return;
        const $ = this.getJQuery(), identityApi = options.identityApi;
        const button = $('<button class="jhs-btn btn btn-default jhs-layout-638cb2c9 jhs-identity-search-image-btn" id="search-img-btn">识图</button>').appendTo("#navbar > div > div > span");
        button.on("click.jhsIdentityNav", (() => identityApi.openSearchByImage?.()));
        this.started = true;
        this.scope.addCleanup(() => button.off(".jhsIdentityNav").remove());
    }

    dispose() {
        this.started = false;
    }
}
