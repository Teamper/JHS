import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { BlacklistWorkspaceController } from "../src/features/library/blacklist-workspace-controller.js";

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

    it("resets only the dialog filters, reloads once and gives the table four page sizes", async () => {
        const { controller, $, dom } = createWorkspace();
        const host = $(dom.window.document.body);
        const layer = $('<section><div class="layui-layer-content"><div></div></div></section>');
        layer.find(".layui-layer-content > div").append(host.children().clone(), '<button id="cleanQueryBtn">重置</button>');
        host.append(layer);
        const table = { setData: vi.fn() };
        const attach = vi.fn(function () { return table; });
        dom.window.Tabulator = attach;
        vi.stubGlobal("$", $);
        controller.debounce = callback => callback;
        const selectValue = vi.spyOn(controller.ui, "setSelectValue");
        await controller.mountDialog(layer, controller.dialogGeneration);
        selectValue.mockClear();
        const root = controller.blacklistRoot;
        host.children("#searchValue").val("unrelated");
        root.find("#searchValue").val("Alpha");
        root.find("#dataType").val("actor");
        root.find("#statusType").val("stop");
        root.find("#urlType").val("hasT");
        root.find("#cleanQueryBtn").trigger("click");
        await vi.waitFor(() => expect(table.setData).toHaveBeenCalledOnce());
        expect(host.children("#searchValue").val()).toBe("unrelated");
        expect(root.find("#searchValue").val()).toBe("");
        expect(selectValue.mock.calls.slice(0, 3).map(([select, value, notify]) => [select.attr("id"), value, notify]))
            .toEqual([["dataType", "", false], ["statusType", "", false], ["urlType", "", false]]);
        expect(root.find("#dataType,#statusType,#urlType").map((_i, select) => select.value).get()).toEqual(["", "", ""]);
        expect(attach).toHaveBeenCalledOnce();
        expect(attach).toHaveBeenCalledWith(root.find("#table-container")[0], expect.objectContaining({
            paginationSizeSelector: [20, 50, 100, 1000],
            langs: expect.objectContaining({ "zh-cn": expect.objectContaining({ pagination: expect.objectContaining({ all: "全部" }) }) }),
        }));
        dom.window.close();
    });
});
