// @ts-check

const JHS_TABLE_LOCALE = "zh-cn";
const JHS_TABLE_LANGS = Object.freeze({
    "zh-cn": Object.freeze({
        pagination: Object.freeze({
            first: "首页", first_title: "首页", last: "尾页", last_title: "尾页",
            prev: "上一页", prev_title: "上一页", next: "下一页", next_title: "下一页",
            all: "全部", page_size: "每页行数",
        }),
    }),
});

/** @param {any} TabulatorRuntime @param {string | Element} target @param {Record<string, any>} options */
export function createJhsTable(TabulatorRuntime, target, options) {
    if (typeof TabulatorRuntime !== "function") throw new TypeError("Tabulator runtime is required");
    const pageSizes = (options.paginationSizeSelector ?? [20, 50, 100, 1000]).filter((/** @type {any} */ value) => Number.isInteger(value) && value > 0);
    return new TabulatorRuntime(target, {
        layout: "fitColumns", responsiveLayout: "collapse", pagination: true, paginationMode: "local",
        paginationSize: pageSizes[0] ?? 20, ...options, paginationSizeSelector: pageSizes,
        locale: options.locale ?? JHS_TABLE_LOCALE,
        langs: options.langs ?? JHS_TABLE_LANGS,
    });
}
