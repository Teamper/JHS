// @ts-check

/** Internal domain names deliberately match the 6.5.1 journal protocol. */
export const STATE_DOMAIN_NAMES = Object.freeze([ "carList", "actresses", "decisions", "activity", "offlineHistory" ]);

/** @param {any} value @returns {any[]} */
function normalizeArray(value) { return Array.isArray(value) ? value : []; }

/** @param {any} value @returns {Record<string, any>} */
function normalizeObject(value) { return value && "object" === typeof value && !Array.isArray(value) ? value : {}; }

/** @param {any} storage */
export function createStateDomainRegistry(storage) {
    const definitions = {
        carList: { key: storage.car_list_key, fallback: () => [], normalize: normalizeArray },
        actresses: { key: storage.favorite_actresses_key, fallback: () => [], normalize: normalizeArray },
        decisions: { key: "new_video_decisions", fallback: () => ({}), normalize: normalizeObject },
        activity: { key: "activity_log", fallback: () => ({ entries: [] }), normalize: normalizeObject },
        offlineHistory: { key: "offline_history", fallback: () => [], normalize: normalizeArray },
    };
    return Object.freeze(Object.fromEntries(Object.entries(definitions).map(([name, definition]) => {
        const normalize = (/** @type {any} */ value) => definition.normalize(value ?? definition.fallback());
        return [name, Object.freeze({
            name,
            storageKey: definition.key,
            normalize,
            read: async () => normalize(await storage.forage.getItem(definition.key)),
            write: async (/** @type {any} */ value) => {
                const next = normalize(value);
                if (storage._setItemAndInvalidate) await storage._setItemAndInvalidate(definition.key, next);
                else await storage.forage.setItem(definition.key, next);
                return next;
            },
        })];
    })));
}
