import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { BlacklistWorkspaceController } from "../src/features/library/blacklist-workspace-controller.js";

const source = readTestFile(join(process.cwd(), "src/features/library/blacklist-workspace-controller.js"), "utf8");
const tableSource = readTestFile(join(process.cwd(), "src/ui/table/create-jhs-table.js"), "utf8");

function createWorkspace() {
    const dom = new JSDOM('<body><input id="searchValue"><select id="dataType"><option value=""></option><option value="actor">actor</option><option value="actress">actress</option></select><select id="statusType"><option value=""></option><option value="normal">normal</option><option value="stop">stop</option></select><select id="urlType"><option value=""></option><option value="hasT">hasT</option><option value="noT">noT</option></select><div id="table-container"></div></body>', { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    const actors = [
        { starId: "a-1", name: "Alpha", allName: ["别名 One"], role: "actor", url: "https://javdb.com/actors/a?t=c", lastPublishTime: "2000-01-01" },
        { starId: "b-1", name: "Beta", allName: "Second Alias", role: "actress", url: "https://javdb.com/actors/b", lastPublishTime: "2026-09-27" },
    ];
    const controller = new BlacklistWorkspaceController({
        document: dom.window.document, window: dom.window, jquery: $, site: "javdb",
        state: { getBlacklist: vi.fn(async () => actors), getBlacklistCarList: vi.fn(async () => [{ starId: "a-1", carNum: "ABC-1" }]), removeBlacklistActor: vi.fn(async () => true) },
        settings: { snapshot: () => ({ checkBlacklist_ruleTime: 8760, checkBlacklist_intervalTime: 12 }) }, storage: { getLocal: () => "2026-09-26" },
        events: { emit: vi.fn(async () => {}), on: vi.fn(() => vi.fn()) }, dialog: { open: vi.fn(), close: vi.fn() },
        ui: { getDialogArea: () => ["900px", "700px"], openPage: vi.fn(), confirm: vi.fn(), enhanceSelect: vi.fn(), setSelectValue: (select, value) => select.val(value) },
        notifications: { error: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn() }, scope: { disposed: false }, task: null, openSettings: vi.fn(),
    });
    controller.blacklistRoot = $(dom.window.document.body);
    return { controller, $, dom };
}

afterEach(() => vi.unstubAllGlobals());

describe("Blacklist workspace combined filters", () => {
    it("combines search, role, stopped status and URL category without clearing sibling filters", async () => {
        const { controller, $, dom } = createWorkspace();
        controller.blacklistRoot.find("#searchValue").val("别名");
        controller.blacklistRoot.find("#dataType").val("actor");
        controller.blacklistRoot.find("#statusType").val("stop");
        controller.blacklistRoot.find("#urlType").val("hasT");
        const result = await controller.getTableData();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ starId: "a-1", count: 1, isUnCheck: true });
        expect(controller.blacklistRoot.find("#statusType").val()).toBe("stop");
        expect(controller.blacklistRoot.find("#urlType").val()).toBe("hasT");
        expect(controller.blacklistRoot.find("#dataType option").map((_index, option) => $(option).text()).get()).toEqual(["所有 (2)", "男演员 (1)", "女演员 (1)"]);
        dom.window.close();
    });

    it("keeps one table instance across empty and non-empty reloads", async () => {
        const { controller, dom } = createWorkspace(), table = { setData: vi.fn() };
        controller.tableObj = table;
        controller.getTableData = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ starId: "a" }]);
        await controller.reloadTable();
        await controller.reloadTable();
        expect(table.setData).toHaveBeenNthCalledWith(1, []);
        expect(table.setData).toHaveBeenNthCalledWith(2, [{ starId: "a" }]);
        expect(controller.tableObj).toBe(table);
        dom.window.close();
    });

    it("returns safe DOM links for imported names and rejects non-HTTP(S) URLs", () => {
        const { controller, dom } = createWorkspace();
        const formatter = controller.getColumns()[0].formatter, link = formatter({ getData: () => ({ name: '<img id="injected">', url: "javascript:alert(1)" }) });
        expect(link.tagName).toBe("A");
        expect(link.textContent).toBe('<img id="injected">');
        expect(link.querySelector("#injected")).toBeNull();
        expect(link.getAttribute("href")).toBe("#");
        expect(link.getAttribute("aria-disabled")).toBe("true");
        dom.window.close();
    });
});

describe("blacklist filter and pagination contracts", () => {
    it("silently resets each select and reloads once", () => {
        const start = source.indexOf('.on("click.jhsBlacklist", "#cleanQueryBtn"'), end = source.indexOf('.on("input.jhsBlacklist", "#searchValue"', start), reset = source.slice(start, end);
        expect(reset.match(/setSelectValue/g)).toHaveLength(1);
        expect(reset).toContain('for (const selector of ["#dataType", "#statusType", "#urlType"])');
        expect(reset).toContain('search.val("")');
        expect(reset.match(/reloadTable\(generation\)/g)).toHaveLength(1);
    });

    it("does not expose Tabulator's blank all-page option", () => {
        expect(source).toContain("paginationSizeSelector: [20, 50, 100, 1000]");
        expect(source).not.toContain("paginationSizeSelector: [20, 50, 100, 1000, true]");
        expect(tableSource).toContain('all: "全部"');
        expect(source).not.toContain("99999");
    });
});
