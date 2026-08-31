import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { BlacklistController } from "../src/features/library/blacklist-controller.js";

const source = readTestFile(join(process.cwd(), "src/features/library/blacklist-controller.js"), "utf8");
const tableSource = readTestFile(join(process.cwd(), "src/ui/table/create-jhs-table.js"), "utf8");

function createController() {
    const dom = new JSDOM(`<body><input id="searchValue"><select id="dataType"><option value=""></option><option value="actor">actor</option><option value="actress">actress</option></select><select id="statusType"><option value=""></option><option value="normal">normal</option><option value="stop">stop</option></select><select id="urlType"><option value=""></option><option value="hasT">hasT</option><option value="noT">noT</option></select></body>`, { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    const blacklist = [
        { starId: "a-1", name: "Alpha", allName: ["别名 One"], role: "actor", url: "https://javdb.com/actors/a?t=c", lastPublishTime: "2000-01-01" },
        { starId: "b-1", name: "Beta", allName: "Second Alias", role: "actress", url: "https://javdb.com/actors/b", lastPublishTime: "2026-08-30" },
    ];
    const storage = { get: vi.fn(async key => key === "blacklist" ? blacklist : key === "blacklist_car_list" ? [{ starId: "a-1", carNum: "ABC-1" }] : []), set: vi.fn(async () => {}) };
    let tabulatorOptions;
    function Tabulator(selector, options) { tabulatorOptions = options; }
    const controller = new BlacklistController({
        hostAdapter: { site: "javdb", document: dom.window.document, location: dom.window.location, getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }) },
        storage,
        scope: { disposed: false, assertActive() {}, addCleanup() {} },
    });
    vi.stubGlobal("$", $);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("Tabulator", Tabulator);
    vi.stubGlobal("utils", {});
    vi.stubGlobal("show", {});
    vi.stubGlobal("clog", {});
    return { controller, $, storage, getTabulatorOptions: () => tabulatorOptions };
}

describe("blacklist combined filters", () => {
    it("combines search, role, status and URL category without clearing sibling filters", async () => {
        const { controller, $ } = createController();
        controller.blacklistRoot = $("body");
        controller.blacklistRoot.find("#searchValue").val("别名");
        controller.blacklistRoot.find("#dataType").val("actor");
        controller.blacklistRoot.find("#statusType").val("stop");
        controller.blacklistRoot.find("#urlType").val("hasT");
        const result = await controller.getTableData();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ starId: "a-1", count: 1, isUnCheck: true });
        expect(controller.blacklistRoot.find("#statusType").val()).toBe("stop");
        expect(controller.blacklistRoot.find("#urlType").val()).toBe("hasT");
    });

    it("keeps one table instance across empty and non-empty reloads", async () => {
        const { controller } = createController(), table = { setData: vi.fn() };
        controller.tableObj = table;
        controller.getTableData = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ starId: "a" }]);
        await controller.reloadTable();
        await controller.reloadTable();
        expect(table.setData).toHaveBeenNthCalledWith(1, []);
        expect(table.setData).toHaveBeenNthCalledWith(2, [{ starId: "a" }]);
        expect(controller.tableObj).toBe(table);
    });
});

describe("blacklist reset and pagination contracts", () => {
    it("uses silent select resets and a single reload after all four values reset", () => {
        const start = source.indexOf('content.on("click", "#cleanQueryBtn"'), end = source.indexOf(')).on("input", "#searchValue"', start), reset = source.slice(start, end);
        expect(reset.match(/JhsSelect\.setValue/g)).toHaveLength(3);
        expect(reset.match(/!1\)/g)).toHaveLength(3);
        expect(reset.match(/reloadTable\(\)/g)).toHaveLength(1);
        expect(reset).toContain('search.val("")');
    });

    it("does not expose Tabulator's blank all-page option", () => {
        expect(source).toContain("paginationSizeSelector: [ 20, 50, 100, 1e3 ]");
        expect(source).not.toContain("paginationSizeSelector: [ 20, 50, 100, 1e3, !0 ]");
        expect(tableSource).toContain('all: "全部"');
        expect(source).not.toContain("99999");
    });

    it("returns a safe DOM link for imported actress names and URLs", async () => {
        const harness = createController();
        harness.controller.getTableData = vi.fn(async () => []);
        await harness.controller.loadTableData();
        const formatter = harness.getTabulatorOptions().columns[0].formatter, node = formatter({ getData: () => ({ name: '<img id="injected">', url: "javascript:alert(1)" }) });
        expect(node.tagName).toBe("A");
        expect(node.textContent).toBe('<img id="injected">');
        expect(node.querySelector("#injected")).toBeNull();
        expect(node.getAttribute("href")).toBe("#");
        expect(node.getAttribute("aria-disabled")).toBe("true");
    });
});
