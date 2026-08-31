import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { HistorySelectionModel } from "../src/features/library/history-selection-model.js";
import { HistoryRepository } from "../src/features/library/history-repository.js";

function createRecords(count = 120) {
    return Array.from({ length: count }, ((_, index) => ({
        carNum: `ABC-${String(index + 1).padStart(3, "0")}`,
        names: index % 2 ? "Alice" : "Bob",
        updateDate: String(index + 1).padStart(3, "0"),
        stateFlags: {}
    })));
}

function loadHistory(records = createRecords()) {
    const dom = new JSDOM(`<body>
        <div id="history">
            <div id="filterBox">
                <select id="dataType">
                    <option value="all" selected>所有</option>
                    <option value="waitCheck">待鉴定</option>
                    <option value="filter">屏蔽</option>
                    <option value="favorite">收藏</option>
                    <option value="hasDown">下载</option>
                    <option value="hasWatch">观看</option>
                </select>
                <input id="searchCarNum">
            </div>
            <div id="allSelectBox" style="display:none">
                <span id="historySelectionSummary"></span>
                <button class="multiple-history-favoriteBtn">收藏</button>
                <button class="multiple-history-deleteBtn">移除</button>
            </div>
        </div>
    </body>`, { url: "https://javdb.com/users/collection_codes" });
    const $ = jqueryFactory(dom.window), getCarList = vi.fn().mockImplementation((async () => records.map((item => ({ ...item }))))),
        patch = vi.fn().mockResolvedValue({ changed: records.map((item => item.carNum)) }), remove = vi.fn().mockResolvedValue({ changed: [] }),
        confirmation = vi.fn(((event, message, callback) => callback())), close = vi.fn(), layer = { open: vi.fn(), close }, show = {
            ok: vi.fn(),
            info: vi.fn(),
            error: vi.fn()
        };
    const stateService = { patch, remove, toggle: vi.fn() };
    const context = vm.createContext({
        document: dom.window.document,
        window: dom.window,
        $,
        BasePlugin: class {},
        HistorySelectionModel, HistoryRepository,
        Tabulator: class {},
        layer,
        storageManager: { getCarList },
        normalizeCarNum: value => String(value || "").trim().toUpperCase(),
        normalizeStateFlags: flags => ({ favorite: !1, downloaded: !1, watched: !1, blocked: !1, ...flags }),
        hasAnyState: flags => Object.values(flags || {}).some(Boolean),
        legacyActionToFlag: action => ({ filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" })[action],
        utils: { q: confirmation },
        show,
        clog: { error: vi.fn() },
        loading: () => ({ close }),
        i: (target, key, value) => (target[key] = value),
        r: !0,
        l: !1,
        d: "filter",
        h: "favorite",
        g: "hasDown",
        p: "hasWatch",
        u: "屏蔽",
        b: "收藏",
        y: "下载",
        k: "观看"
    });
    vm.runInContext(`${readTestFile(join(process.cwd(), "src/features/library/history-controller.js"), "utf8")};globalThis.History=HistoryController`, context);
    const plugin = new context.History({ dialog: { open: layer.open, close: layer.close }, state: stateService, storage: { getCarList }, movie: {}, settings: { snapshot: () => ({}) }, features: {}, hostAdapter: { site: "javdb" }, scope: {} }), root = $("#history");
    const table = {
        currentData: records.slice(0, 50),
        selectedData: [],
        deselectRow: vi.fn((() => {
            table.selectedData = [];
        })),
        selectRow: vi.fn((ids => {
            const selected = new Set(ids);
            table.selectedData = table.currentData.filter((item => selected.has(item.carNum)));
        })),
        getData: vi.fn((() => table.currentData)),
        getSelectedData: vi.fn((() => table.selectedData)),
        setPage: vi.fn().mockResolvedValue()
    };
    return plugin.historyRoot = root, plugin.tableObj = table, {
        plugin,
        root,
        table,
        patch,
        remove,
        confirmation,
        show,
        getCarList
    };
}

describe("History cross-page selection", () => {
    it("selects all 120 filtered records instead of only the first page", async () => {
        const { plugin } = loadHistory(), page = await plugin.getDataList(1, 50, []);
        expect(page.dataList).toHaveLength(50);
        expect(page.totalCount).toBe(120);

        plugin.historySelectionModel.selectAllFiltered();
        const selected = await plugin.getHistoryBatchSelection();
        expect(selected).toHaveLength(120);
        expect(selected.at(-1).carNum).toBe("ABC-120");
    });

    it("uses the native header checkbox to enter and leave full-result mode", async () => {
        const { plugin, table } = loadHistory();
        await plugin.getDataList(1, 50, []);
        const checkbox = plugin.createHistorySelectAllCheckbox();
        checkbox.checked = true;
        checkbox.dispatchEvent(new checkbox.ownerDocument.defaultView.Event("change"));
        expect(plugin.isHistoryAllFiltered()).toBe(true);
        expect(table.selectedData).toHaveLength(50);

        checkbox.checked = false;
        checkbox.dispatchEvent(new checkbox.ownerDocument.defaultView.Event("change"));
        expect(plugin.isHistoryAllFiltered()).toBe(false);
        expect(table.selectedData).toHaveLength(0);
    });

    it("restores visible selection after paging and honors exclusions", async () => {
        const { plugin, table } = loadHistory();
        await plugin.getDataList(1, 50, []);
        plugin.historySelectionModel.selectAllFiltered();
        plugin.historySelectionModel.excluded.add("ABC-052");
        plugin.historySelectionModel.excluded.add("ABC-053");
        table.currentData = createRecords().slice(50, 100);

        plugin.syncHistoryPageSelection();
        expect(table.selectedData).toHaveLength(48);
        expect(table.selectedData.map((item => item.carNum))).not.toContain("ABC-052");

        let selected = await plugin.getHistoryBatchSelection();
        expect(selected).toHaveLength(118);
        plugin.updateHistoryRowSelection({ getData: () => ({ carNum: "abc-052" }) }, true);
        selected = await plugin.getHistoryBatchSelection();
        expect(selected).toHaveLength(119);
    });

    it("keeps ordinary selection limited to selected rows on the current page", async () => {
        const { plugin, table } = loadHistory();
        table.selectedData = table.currentData.slice(0, 3);
        table.selectedData.forEach((item => plugin.historySelectionModel.set(item, true)));
        expect(await plugin.getHistoryBatchSelection()).toEqual(table.selectedData);
    });

    it("clears selection for filtering but preserves it while sorting", async () => {
        const { plugin, root, table } = loadHistory();
        plugin.historySelectionModel.selectAllFiltered();
        plugin.historySelectionModel.excluded.add("ABC-002");
        await plugin.getDataList(1, 50, [ { field: "carNum", dir: "desc" } ]);
        expect(plugin.isHistoryAllFiltered()).toBe(true);
        expect(plugin.historySelectionModel.excluded.has("ABC-002")).toBe(true);

        root.find("#searchCarNum").val("ABC-1");
        await plugin.reloadTable();
        expect(plugin.isHistoryAllFiltered()).toBe(false);
        expect(plugin.historySelectionModel.excluded.size).toBe(0);
        expect(table.setPage).toHaveBeenCalledWith(1);
    });

    it("uses the same full selection for confirmation and batch mutation", async () => {
        const { plugin, root, patch, confirmation } = loadHistory();
        await plugin.getDataList(1, 50, []);
        plugin.historySelectionModel.selectAllFiltered();
        plugin.historySelectionModel.excluded.add("ABC-002");
        plugin.historySelectionModel.excluded.add("ABC-003");
        plugin.bindHistoryActions(root);
        root.find(".multiple-history-favoriteBtn").trigger("click");

        await vi.waitFor((() => expect(patch).toHaveBeenCalledOnce()));
        expect(patch.mock.calls[0][0]).toHaveLength(118);
        expect(confirmation.mock.calls[0][1]).toContain("已选择 118 条，排除 2 条");
        expect(plugin.isHistoryAllFiltered()).toBe(false);
    });

    it("retains the full selection when a batch mutation fails", async () => {
        const { plugin, root, patch, show } = loadHistory();
        await plugin.getDataList(1, 50, []);
        plugin.historySelectionModel.selectAllFiltered();
        plugin.historySelectionModel.excluded.add("ABC-002");
        patch.mockRejectedValueOnce(new Error("write failed"));
        plugin.bindHistoryActions(root);
        root.find(".multiple-history-favoriteBtn").trigger("click");

        await vi.waitFor((() => expect(show.error).toHaveBeenCalledWith("操作失败，请稍后重试")));
        expect(plugin.isHistoryAllFiltered()).toBe(true);
        expect(plugin.historySelectionModel.excluded.has("ABC-002")).toBe(true);
    });

    it("retains selection when a delete resolves without changing records", async () => {
        const { plugin, root, remove, show } = loadHistory();
        await plugin.getDataList(1, 50, []);
        plugin.historySelectionModel.selectAllFiltered();
        plugin.bindHistoryActions(root);
        root.find(".multiple-history-deleteBtn").trigger("click");

        await vi.waitFor((() => expect(show.error).toHaveBeenCalledWith("提供的番号中没有一个存在于列表中。")));
        expect(remove.mock.calls[0][0]).toHaveLength(120);
        expect(plugin.isHistoryAllFiltered()).toBe(true);
    });
});
