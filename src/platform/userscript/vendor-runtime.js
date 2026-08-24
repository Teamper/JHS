// @ts-check

/** @param {Record<string, any>} [runtimeWindow] */
export function getVendorRuntime(runtimeWindow = /** @type {any} */ (window)) {
    const values = {
        $: runtimeWindow.jQuery,
        Tabulator: runtimeWindow.Tabulator,
        layer: runtimeWindow.layer,
        md5: runtimeWindow.md5,
        Toastify: runtimeWindow.Toastify,
        localforage: runtimeWindow.localforage,
        Viewer: runtimeWindow.Viewer,
    };
    const missing = Object.entries(values).filter(([, value]) => value == null).map(([name]) => name);
    if (missing.length) throw new Error(`Missing userscript vendor runtime: ${missing.join(", ")}`);
    return Object.freeze(values);
}
