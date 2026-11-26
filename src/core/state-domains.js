// @ts-check

/** Legacy domain names retain their established journal meanings. */
export const STATE_DOMAIN_NAMES = Object.freeze([ "carList", "actresses", "decisions", "activity", "offlineHistory", "ratings" ]);

/** @param {any} value @returns {any[]} */
function normalizeArray(value) { return Array.isArray(value) ? value : []; }

/** @param {any} value @returns {Record<string, any>} */
function normalizeObject(value) { return value && "object" === typeof value && !Array.isArray(value) ? value : {}; }

/** @param {Pick<import("../services/storage-service.js").StorageService, "get"|"set">} storage */
export function createStateDomainRegistry(storage) {
    const definitions = {
        carList: { key: "car_list", fallback: () => [], normalize: normalizeArray },
        actresses: { key: "favorite_actresses", fallback: () => [], normalize: normalizeArray },
        decisions: { key: "new_video_decisions", fallback: () => ({}), normalize: normalizeObject },
        activity: { key: "activity_log", fallback: () => ({ entries: [] }), normalize: normalizeObject },
        offlineHistory: { key: "offline_history", fallback: () => [], normalize: normalizeArray },
        ratings: { key: "personal_ratings", fallback: () => ({}), normalize: normalizeObject },
    };
    return Object.freeze(Object.fromEntries(Object.entries(definitions).map(([name, definition]) => {
        const normalize = (/** @type {any} */ value) => definition.normalize(value ?? definition.fallback());
        return [name, Object.freeze({
            name,
            storageKey: definition.key,
            normalize,
            read: async () => normalize(await storage.get(definition.key)),
            write: async (/** @type {any} */ value) => {
                const next = normalize(value);
                await storage.set(definition.key, next);
                return next;
            },
        })];
    })));
}
