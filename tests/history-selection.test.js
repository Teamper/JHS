import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "../src/features/library/history-repository.js";
import { HistoryDialogController } from "../src/features/library/history-dialog-controller.js";

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
    const stateService = { patch, remove, toggle: vi.fn() }, storageService = { getCarList };
    const plugin = new HistoryDialogController({
        document: dom.window.document, window: dom.window, jquery: $,
        domUi: { confirm: confirmation, getDialogArea: () => [], enhanceSelect: vi.fn(), loading: () => ({ close }) },
        dialog: { open: layer.open, close: layer.close }, notifications: show, logger: { error: vi.fn() },
        clipboard: { copyText: vi.fn() }, movie: {}, settings: { snapshot: () => ({}) },
        storage: storageService, state: stateService, repository: new HistoryRepository({ storage: storageService, state: stateService }), site: "javdb",
    }), root = $("#history");
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
        getPage: vi.fn(() => 3),
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
        getCarList, layer, $, document: dom.window.document, records
    };
}

describe("History cross-page selection", () => {
    it("keeps saved checkbox edits local when the editor is canceled", async () => {
        const { plugin, layer, $, document, patch, records } = loadHistory();
        await plugin.editRecord(records[0]);
        const options = layer.open.mock.calls[0][0], editor = $(document.createElement("div")).append(options.content);
        document.body.append(editor[0]); options.success(editor, 7);
        expect(editor.find('input[type="checkbox"]')).toHaveLength(4);
        expect(editor.find('.mini-switch,[role="switch"]')).toHaveLength(0);
        editor.find("#edit-favorite").prop("checked", true).trigger("change");
        editor.find("#edit-watched").prop("checked", true).trigger("change");
        layer.close(7); editor.remove(); await Promise.resolve();
        expect(patch).not.toHaveBeenCalled();
        expect(records[0].stateFlags.favorite).toBeFalsy();
    });
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

    it("never batches an unchecked row retained in the explicit selection model", async () => {
        const { plugin, table } = loadHistory();
        plugin.historySelectionModel.set(table.currentData[0], true);
        expect(await plugin.getHistoryBatchSelection()).toEqual([]);
    });

    it("clears both explicit selection sources before a delayed page query settles", async () => {
        const { plugin, table, records } = loadHistory();
        table.selectedData = [records[0]]; plugin.historySelectionModel.set(records[0], true);
        let finish;
        plugin.historyRepository.list = () => new Promise(resolve => finish = resolve);
        const pending = plugin.getDataList(2, 50, []);
        expect(plugin.getHistorySelectionSummary().count).toBe(0);
        expect(table.getSelectedData()).toEqual([]);
        expect(await plugin.getHistoryBatchSelection()).toEqual([]);
        finish(records); await pending;
    });

    it("fetches the current page again after a row mutation", async () => {
        const { plugin, $, table } = loadHistory();
        const button = $('<button class="history-favoriteBtn"></button>')[0];
        plugin.handleRowAction({ currentTarget: button, preventDefault() {}, stopPropagation() {} }, { carNum: "ABC-101" });
        await vi.waitFor(() => expect(table.setPage).toHaveBeenCalledWith(3));
    });

    it.each([false, true])("refreshes only the originating view after a pending mutation (replaced=%s)", async replaced => {
        const { plugin, $, table } = loadHistory();
        let finish;
        plugin.historyRepository.toggle = vi.fn(() => new Promise(resolve => finish = resolve));
        plugin.handleRowAction({ currentTarget: $('<button class="history-favoriteBtn"></button>')[0], preventDefault() {}, stopPropagation() {} }, { carNum: "ABC-101" });
        table.getPage.mockReturnValue(2);
        const replacement = { setPage: vi.fn() };
        if (replaced) plugin.tableObj = replacement;
        finish(); await new Promise(resolve => setTimeout(resolve, 0));
        expect(replacement.setPage).not.toHaveBeenCalled();
        if (replaced) expect(table.setPage).not.toHaveBeenCalled();
        else expect(table.setPage).toHaveBeenCalledWith(2);
    });

    it("keeps the empty result on page one with an accurate zero count", async () => {
        const { plugin } = loadHistory([]);
        expect(await plugin.getDataList(1, 50, [])).toMatchObject({ maxPage: 1, dataList: [], totalCount: 0 });
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
        const failure = new Error("write failed");
        patch.mockRejectedValueOnce(failure);
        plugin.bindHistoryActions(root);
        root.find(".multiple-history-favoriteBtn").trigger("click");

        await vi.waitFor((() => expect(show.error).toHaveBeenCalledWith("记录更新失败，请重试")));
        expect(plugin.logger.error).toHaveBeenCalledWith(failure);
        expect(show.error.mock.calls.flat().join(" ")).not.toContain(failure.message);
        expect(plugin.isHistoryAllFiltered()).toBe(true);
        expect(plugin.historySelectionModel.excluded.has("ABC-002")).toBe(true);
    });

    it("retains selection when a delete resolves without changing records", async () => {
        const { plugin, root, remove, show } = loadHistory();
        await plugin.getDataList(1, 50, []);
        plugin.historySelectionModel.selectAllFiltered();
        plugin.bindHistoryActions(root);
        root.find(".multiple-history-deleteBtn").trigger("click");

        await vi.waitFor((() => expect(show.error).toHaveBeenCalledWith("所选记录已不存在")));
        expect(remove.mock.calls[0][0]).toHaveLength(120);
        expect(plugin.isHistoryAllFiltered()).toBe(true);
    });
});
