// @ts-check

import { assertPort, PORT_METHODS } from "../contracts/ports.js";

export class NavigationService {
    /** @param {any} navigationPort */
    constructor(navigationPort) { this.port = assertPort(navigationPort, "NavigationPort", PORT_METHODS.navigation); }
    /** @param {string | URL} url @param {{newTab?: boolean}} [options] */
    open(url, options) { return this.port.open(String(url), options); }
    /** @param {string | URL} url */
    assign(url) { return this.port.assign(String(url)); }
    /** @param {string | URL} url */
    replace(url) { return this.port.replace(String(url)); }
}
