// @ts-check

/** @param {Record<string, any>} values @param {Record<string, any>} target */
export function attachCompatibilityFacade(values, target) {
    for (const name of ["utils", "gmHttp", "storageManager", "stateService", "jhsEventBus", "clog", "show", "loading"]) {
        if (values[name] == null) throw new Error(`Compatibility facade is missing ${name}`);
        target[name] = values[name];
    }
    return Object.freeze(Object.fromEntries(Object.keys(values).map((name) => [name, target[name]])));
}
