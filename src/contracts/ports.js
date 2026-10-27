// @ts-check

/** @template T @param {T} implementation @param {string} name @param {string[]} methods @returns {T} */
export function assertPort(implementation, name, methods) {
    if (!implementation || typeof implementation !== "object") throw new TypeError(`${name} implementation is required`);
    for (const method of methods) {
        if (typeof /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (implementation))[method] !== "function") throw new TypeError(`${name}.${method} is required`);
    }
    return implementation;
}

export const PORT_METHODS = Object.freeze({
    navigation: ["open", "assign", "replace"],
    http: ["request"],
    storage: ["get", "set", "remove", "keys", "getLocal", "setLocal", "removeLocal", "getValue", "setValue", "removeValue"],
    dialog: ["open", "close", "confirm", "alert"],
    style: ["register", "remove"],
});

/** Optional capability: both methods must be present for safe portable import.
 * expected entries distinguish a missing key from an existing null value;
 * implementations compare and write within one native transaction and resolve
 * only after durable commit. Portable export does not require this capability.
 * @typedef {{readAtomicSnapshot: (keys: string[]) => Promise<Record<string, {exists: boolean, value?: any}>>, commitAtomicBatch: (batch: {expected: Record<string, {exists: boolean, value?: any}>, puts: Record<string, any>, deletes: string[], signal?: AbortSignal}) => Promise<void>}} AtomicStoragePort
 */
