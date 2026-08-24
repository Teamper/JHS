// @ts-check

import { assertPort, PORT_METHODS } from "../contracts/ports.js";

export class StyleRegistry {
    /** @param {any} stylePort */
    constructor(stylePort) { this.port = assertPort(stylePort, "StylePort", PORT_METHODS.style); }
    /** @param {string} id @param {string} css */
    register(id, css) { return this.port.register(id, css); }
    /** @param {string} id */
    remove(id) { return this.port.remove(id); }
}
