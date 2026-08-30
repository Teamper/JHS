// @ts-check

export const STATE_DOMAIN_NAMES = Object.freeze([ "carList", "favoriteActresses", "newVideoDecisions", "activity", "offlineHistory" ]);

/** @param {any} value @returns {any[]} */
function normalizeArray(value) { return Array.isArray(value) ? value : []; }

/** @param {any} value @returns {Record<string, any>} */
function normalizeObject(value) { return value && "object" === typeof value && !Array.isArray(value) ? value : {}; }

/**
 * Build the canonical state-domain registry around the legacy StorageManager keys.
 * @param {{forage: {getItem: (key: string) => Promise<any>, setItem: (key: string, value: any) => Promise<any>}, car_list_key: string, favorite_actresses_key: string, _setItemAndInvalidate?: (key: string, value: any) => Promise<any>}} storage
 * @param {(value: any) => any} [normalizeActivity]
 */
export function createStateDomainRegistry(storage, normalizeActivity = (value) => value) {
    const definitions = {
        carList: { storageKey: storage.car_list_key, fallback: () => [], normalize: normalizeArray },
        favoriteActresses: { storageKey: storage.favorite_actresses_key, fallback: () => [], normalize: normalizeArray },
        newVideoDecisions: { storageKey: "new_video_decisions", fallback: () => ({}), normalize: normalizeObject },
        activity: { storageKey: "activity_log", fallback: () => ({ entries: [] }), normalize: normalizeActivity },
        offlineHistory: { storageKey: "offline_history", fallback: () => [], normalize: normalizeArray },
    };
    const registry = Object.fromEntries(Object.entries(definitions).map(([name, definition]) => {
        const normalize = (/** @type {any} */ value) => definition.normalize(value ?? definition.fallback());
        return [name, Object.freeze({
            name,
            storageKey: definition.storageKey,
            normalize,
            read: async () => normalize(await storage.forage.getItem(definition.storageKey)),
            write: async (/** @type {any} */ value) => {
                const next = normalize(value);
                if (storage._setItemAndInvalidate) await storage._setItemAndInvalidate(definition.storageKey, next);
                else await storage.forage.setItem(definition.storageKey, next);
                return next;
            },
        })];
    }));
    return Object.freeze(registry);
}
