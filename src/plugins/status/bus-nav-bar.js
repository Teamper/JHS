// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";

export class BusNavBarPlugin extends BasePlugin {
    getName() {
        return "BusNavBarPlugin";
    }
    /** @param {{scope?: any, identityApi?: any}} [options] */
    async handle(options = {}) {
        const scope = options.scope ?? await this.getRuntimeService("scope")();
        const identityApi = options.identityApi ?? null;
        if (!identityApi?.hasSearchByImage) return;
        const button = $('<button class="jhs-btn btn btn-default jhs-layout-638cb2c9 jhs-identity-search-image-btn" id="search-img-btn">识图</button>').appendTo("#navbar > div > div > span");
        button.on("click.jhsIdentityNav", (() => identityApi.openSearchByImage?.()));
        scope.addCleanup(() => button.off(".jhsIdentityNav").remove());
    }
}
