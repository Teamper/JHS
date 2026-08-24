// @ts-check

import { assertPort, PORT_METHODS } from "../../contracts/ports.js";

export class BrowserNavigationAdapter {
    /** @param {{location?: Location, open?: typeof window.open}} [runtime] */
    constructor(runtime = {}) {
        this.location = runtime.location ?? window.location;
        this.openWindow = runtime.open ?? window.open.bind(window);
        assertPort(this, "NavigationPort", PORT_METHODS.navigation);
    }
    /** @param {string} url @param {{newTab?: boolean}} [options] */
    open(url, options = {}) { return options.newTab ? this.openWindow(url, "_blank", "noopener") : this.assign(url); }
    /** @param {string} url */
    assign(url) { this.location.assign(url); }
    /** @param {string} url */
    replace(url) { this.location.replace(url); }
}
