// @ts-check

import { assertPort, PORT_METHODS } from "../contracts/ports.js";

export class StorageService {
    /** @param {any} storagePort */
    constructor(storagePort) { this.port = assertPort(storagePort, "StoragePort", PORT_METHODS.storage); }
    /** @param {string} key */
    get(key) { return this.port.get(key); }
    /** @param {string} key @param {unknown} value */
    set(key, value) { return this.port.set(key, value); }
    /** @param {string} key */
    remove(key) { return this.port.remove(key); }
}
