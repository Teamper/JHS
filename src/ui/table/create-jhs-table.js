// @ts-check

/** @param {any} TabulatorRuntime @param {string | Element} target @param {Record<string, any>} options */
export function createJhsTable(TabulatorRuntime, target, options) {
    if (typeof TabulatorRuntime !== "function") throw new TypeError("Tabulator runtime is required");
    const pageSizes = (options.paginationSizeSelector ?? [20, 50, 100, 1000]).filter((/** @type {any} */ value) => Number.isInteger(value) && value > 0);
    return new TabulatorRuntime(target, {
        layout: "fitColumns", responsiveLayout: "collapse", pagination: true, paginationMode: "local",
        paginationSize: pageSizes[0] ?? 20, ...options, paginationSizeSelector: pageSizes,
    });
}
