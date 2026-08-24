// @ts-check

import { assertPort, PORT_METHODS } from "../contracts/ports.js";

export class DialogService {
    /** @param {any} dialogPort */
    constructor(dialogPort) { this.port = assertPort(dialogPort, "DialogPort", PORT_METHODS.dialog); }
    /** @param {Record<string, unknown>} options */
    open(options) { return this.port.open(options); }
    /** @param {number} id */
    close(id) { return this.port.close(id); }
}
