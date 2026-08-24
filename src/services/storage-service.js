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
    /** @param {string} key */
    getLocal(key) { return this.port.getLocal(key); }
    /** @param {string} key @param {string} value */
    setLocal(key, value) { return this.port.setLocal(key, value); }
    /** @param {string} key */
    removeLocal(key) { return this.port.removeLocal(key); }
    /** @param {string} key @param {unknown} [fallback] */
    getValue(key, fallback) { return this.port.getValue(key, fallback); }
    /** @param {string} key @param {unknown} value */
    setValue(key, value) { return this.port.setValue(key, value); }
}
