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
    storage: ["get", "set", "remove"],
    dialog: ["open", "close"],
    style: ["register", "remove"],
});
