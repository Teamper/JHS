// @ts-check

/** @typedef {import("../../contracts/ports.js").NavigationPort} NavigationPort */
/** @implements {NavigationPort} */
export class BrowserNavigationAdapter {
    /** @param {{location?: Location, open?: typeof window.open}} [runtime] */
    constructor(runtime = {}) {
        this.location = runtime.location ?? window.location;
        this.openWindow = runtime.open ?? window.open.bind(window);
    }
    /** @param {string | URL} url @param {{newTab?: boolean, background?: boolean}} [options] */
    open(url, options = {}) {
        const openInTab = /** @type {any} */ (globalThis).GM_openInTab;
        const href = String(url);
        if (options.background && typeof openInTab === "function") return openInTab(href, { insert: 0 });
        return options.newTab ? this.openWindow(href, "_blank", "noopener") : this.assign(href);
    }
    /** @param {string | URL} url */
    assign(url) { this.location.assign(String(url)); }
    /** @param {string | URL} url */
    replace(url) { this.location.replace(String(url)); }
}
