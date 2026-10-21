import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi, afterEach } from "vitest";
import { HistoryDialogController } from "../src/features/library/history-dialog-controller.js";

afterEach(() => vi.unstubAllGlobals());

function loadHistory() {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/users/collection_codes" }), $ = jqueryFactory(dom.window), patch = vi.fn().mockResolvedValue(), toggle = vi.fn().mockResolvedValue(), close = vi.fn(), confirm = vi.fn((event, message, callback) => callback());
    vi.stubGlobal("document", dom.window.document);
    const layer = { open: vi.fn(), close }, stateService = { patch, toggle }, runtimeServices = { dialog: { open: layer.open, close: layer.close }, state: stateService };
    const repository = { patch, toggle, remove: vi.fn(), list: vi.fn(async () => []), activity: vi.fn(), offline: vi.fn() };
    const plugin = new HistoryDialogController({
        document: dom.window.document, window: dom.window, jquery: $,
        domUi: { confirm, getDialogArea: () => [], enhanceSelect: vi.fn(), loading: () => ({ close: vi.fn() }) },
        dialog: { open: layer.open, close: layer.close }, notifications: { ok: vi.fn(), info: vi.fn(), error: vi.fn() },
        logger: { error: vi.fn() }, clipboard: { copyText: vi.fn() }, movie: {}, settings: { snapshot: () => ({}) },
        storage: {}, state: stateService, repository, site: "javdb",
    });
    plugin.tableObj = { setData: vi.fn() };
    return { plugin, $, patch, toggle, layer, confirm, runtimeServices, dom };
}

async function openAndSubmit(state, next) {
    const loaded = loadHistory();
    await loaded.plugin.editRecord({ carNum: "ABC-1", names: "A", url: "/v/a", remark: "R", stateFlags: state });
    const options = loaded.layer.open.mock.calls[0][0];
    const layerRoot = loaded.$('<div class="layui-layer"></div>').append(options.content).appendTo("body");
    options.success(layerRoot, 9);
    for (const [flag, value] of Object.entries(next)) loaded.$(`#edit-${flag}`).prop("checked", value);
    await options.yes(9);
    await vi.waitFor(() => expect(loaded.patch).toHaveBeenCalledOnce());
    return loaded;
}

describe("History multi-state editor", () => {
    it("clears explicit page selection before Tabulator replaces rows", async () => {
        const { plugin, $, dom } = loadHistory(), handlers = new Map();
        plugin.tableObj = null;
        plugin.historyRoot = $('<div><div id="table-container"></div></div>').appendTo("body");
        dom.window.Tabulator = class {
            on(name, handler) { handlers.set(name, handler); }
            deselectRow() {}
        };
        await plugin.loadTableData();
        plugin.historySelectionModel.set({ carNum: "ABC-001" }, true);
        handlers.get("dataProcessing")();
        handlers.get("dataProcessed")();
        expect(plugin.getHistorySelectionSummary().count).toBe(0);
        expect(plugin.historySelectionSyncing).toBe(false);
    });

    it.each(["same", "clamped", "newer", "failed", "closed", "clamp-new-sort", "clamp-new-size", "clamp-followed-by-request"])("restores only the refreshed history holder (%s)", async scenario => {
        const { plugin, $, dom } = loadHistory(), handlers = new Map();
        plugin.historyRoot = $('<div><select id="dataType"><option value="all">所有</option></select><div id="table-container"><div class="tabulator-tableholder"></div></div></div>').appendTo("body");
        const holder = plugin.historyRoot.find(".tabulator-tableholder")[0];
        Object.defineProperties(holder, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
        holder.scrollTop = 450; holder.scrollLeft = 10;
        let options, finish;
        dom.window.Tabulator = class {
            constructor(_target, config) { options = config; }
            on(name, handler) { handlers.set(name, handler); }
            getPage = () => 3;
            getRows = () => [];
            deselectRow() {}
            setPage = vi.fn(page => options.ajaxRequestFunc(null, null, { page, size: 50, sort: [] }));
        };
        await plugin.loadTableData();
        expect(options.paginationOutOfRange).toBe("last");
        plugin.historyRepository.list.mockImplementationOnce(() => new Promise(resolve => finish = resolve));
        const pending = plugin.reloadTable(true, { preservePage: true });
        expect(plugin.tableObj.setPage).toHaveBeenCalledWith(3);
        const rows = Array.from({ length: scenario.startsWith("clamp-") ? 49 : scenario === "clamped" ? 100 : 120 }, (_, i) => ({ carNum: `ABC-${i}`, stateFlags: {} }));
        if (scenario === "newer") { plugin.historyRepository.list.mockResolvedValue(rows); await plugin.getDataList(1, 50, []); }
        if (scenario === "closed") plugin.historyRoot = null;
        finish(rows); await pending;
        if (scenario === "clamped") { plugin.historyRepository.list.mockResolvedValue(rows); await plugin.getDataList(2, 50, []); }
        if (scenario.startsWith("clamp-")) {
            let finishClamp, clamping;
            if (scenario === "clamp-followed-by-request") {
                plugin.historyRepository.list.mockImplementationOnce(() => new Promise(resolve => finishClamp = resolve));
                clamping = plugin.getDataList(1, 50, []);
            }
            plugin.historyRepository.list.mockResolvedValue(rows);
            await plugin.getDataList(1, scenario === "clamp-new-size" ? 100 : 50, scenario === "clamp-new-sort" ? [{ field: "carNum", dir: "asc" }] : []);
            if (clamping) { finishClamp(rows); await clamping; }
        }
        if (scenario === "failed") handlers.get("dataLoadError")();
        holder.scrollTop = 0; holder.scrollLeft = 0;
        handlers.get("renderComplete")();
        expect(holder.scrollTop).toBe(["same", "clamped"].includes(scenario) ? 450 : 0);
        expect(holder.scrollLeft).toBe(["same", "clamped"].includes(scenario) ? 10 : 0);
    });

    it("ignores events and queries from a table destroyed by a view switch", async () => {
        const { plugin, $, dom } = loadHistory(), handlers = new Map();
        plugin.tableObj = null;
        plugin.historyRoot = $('<div><div id="table-container"></div></div>').appendTo("body");
        let tableOptions;
        dom.window.Tabulator = class {
            constructor(_target, options) { tableOptions = options; }
            on(name, handler) { handlers.set(name, handler); }
            destroy = vi.fn();
            deselectRow = vi.fn();
            getRows = vi.fn(() => []);
        };
        await plugin.showHistoryView("state");
        const oldTable = plugin.tableObj;
        plugin.historyRepository.offline.mockResolvedValue([]);
        await plugin.showHistoryView("offline");
        expect(oldTable.destroy).toHaveBeenCalledOnce();
        for (const name of ["renderComplete", "dataProcessing", "dataProcessed", "rowSelected", "rowDeselected", "rowSelectionChanged", "rowDblClick"]) {
            expect(() => handlers.get(name)()).not.toThrow();
        }
        await expect(tableOptions.ajaxRequestFunc(null, null, { page: 1, size: 50, sort: [] })).resolves.toMatchObject({ dataList: [], totalCount: 0 });
        expect(plugin.historyRepository.list).not.toHaveBeenCalled();
        expect(oldTable.getRows).not.toHaveBeenCalled();
        expect(plugin.historySelectionSyncing).toBe(false);
        expect(plugin.historyRoot.text()).toBe("暂无离线任务");
    });

    it("keeps the reopened history instance when an earlier end callback repeats", async () => {
        const { plugin, $, layer } = loadHistory();
        plugin.tableObj = null;
        plugin.loadTableData = vi.fn(async () => {});
        layer.open.mockImplementation(() => layer.open.mock.calls.length);
        plugin.openHistory();
        const first = layer.open.mock.calls[0][0], firstRoot = $('<div></div>').append(first.content).appendTo("body");
        await first.success(firstRoot);
        first.end(); firstRoot.remove();
        plugin.openHistory();
        const second = layer.open.mock.calls[1][0], secondRoot = $('<div></div>').append(second.content).appendTo("body");
        await second.success(secondRoot);
        first.end();
        expect(plugin.dialogId).toBe(2);
        expect(plugin.historyRoot[0]).toBe(secondRoot[0]);
        second.end(); secondRoot.remove();
        expect(plugin.historyRoot).toBeNull();
    });

    it.each(["switch", "reopen", "dispose"])("drops a pending state query after %s", async action => {
        const { plugin, $ } = loadHistory();
        let finish;
        plugin.tableObj = null;
        plugin.historyFilteredCount = 42;
        plugin.historyRoot = $('<div><select id="dataType"><option value="all">原筛选</option></select><div id="table-container"></div></div>').appendTo("body");
        plugin.historyRepository.list.mockImplementation(() => new Promise(resolve => finish = resolve));
        const loading = plugin.getDataList(1, 50, []);
        if (action === "switch") {
            plugin.historyRepository.offline.mockResolvedValue([]);
            await plugin.showHistoryView("offline");
        } else if (action === "reopen") {
            plugin.historyRoot.remove();
            plugin.historyRoot = $('<div><select id="dataType"><option value="all">新筛选</option></select><div id="table-container">新弹窗</div></div>').appendTo("body");
        } else plugin.dispose();
        finish([{ carNum: "ABC-1", stateFlags: { favorite: true } }]);
        await expect(loading).resolves.toMatchObject({ dataList: [], totalCount: 0 });
        expect(plugin.historyFilteredCount).toBe(42);
        if (action === "switch") expect(plugin.historyRoot.find("#table-container").text()).toBe("暂无离线任务");
        if (action === "reopen") expect(plugin.historyRoot.find("option").text()).toBe("新筛选");
    });

    it("keeps the latest view when an earlier activity request finishes last", async () => {
        const { plugin, $ } = loadHistory();
        let finishActivity;
        plugin.tableObj = null;
        plugin.historyRoot = $('<div><div id="table-container"></div></div>').appendTo("body");
        plugin.historyRepository.activity.mockImplementation(() => new Promise(resolve => finishActivity = resolve));
        plugin.historyRepository.offline.mockResolvedValue([]);
        const loading = plugin.showHistoryView("activity");
        await plugin.showHistoryView("offline");
        expect(plugin.historyRoot.text()).toBe("暂无离线任务");
        finishActivity({ entries: [] });
        await loading;
        expect(plugin.historyRoot.text()).toBe("暂无离线任务");
    });

    it.each(["activity", "offline"])("drops a pending %s result after close and reopen", async view => {
        const { plugin, $ } = loadHistory();
        let finish;
        plugin.tableObj = null;
        plugin.historyRoot = $('<div><div id="table-container"></div></div>').appendTo("body");
        plugin.historyRepository[view].mockImplementation(() => new Promise(resolve => finish = resolve));
        const loading = plugin.showHistoryView(view);
        const replacement = $('<div><div id="table-container">新弹窗</div></div>').appendTo("body");
        plugin.historyRoot.remove(); plugin.historyRoot = replacement;
        finish(view === "activity" ? { entries: [] } : []);
        await expect(loading).resolves.toBeUndefined();
        expect(replacement.text()).toBe("新弹窗");
    });

    it.each(["activity", "offline"])("settles a pending %s render after disposal", async view => {
        const { plugin, $ } = loadHistory();
        let finish;
        plugin.tableObj = null;
        plugin.historyRoot = $('<div><div id="table-container"></div></div>').appendTo("body");
        plugin.historyRepository[view].mockImplementation(() => new Promise(resolve => finish = resolve));
        const loading = plugin.showHistoryView(view);
        plugin.dispose();
        finish(view === "activity" ? { entries: [] } : []);
        await expect(loading).resolves.toBeUndefined();
        expect(plugin.historyRoot).toBeNull();
    });

    it("renders product labels without exposing internal activity types or offline exceptions", async () => {
        const { plugin, $ } = loadHistory();
        plugin.historyRoot = $('<div><div id="table-container"></div></div>');
        plugin.historyRepository.activity.mockResolvedValue({ entries: [{ id: "internal-transaction", type: "internal-debug-kind", createdAt: "2026-10-04", commitState: "committed", changes: [{ carNum: "ABC-1" }] }] });
        await plugin.renderActivityHistory();
        expect(plugin.historyRoot.text()).toContain("更新影片状态");
        expect(plugin.historyRoot.text()).not.toContain("internal-debug-kind");
        const offline = { id: "internal-offline-id", providerId: "115", status: "failed", carNum: "ABC-1", createdAt: "2026-10-04", errorMessage: "https://private.example/?token=secret", retryOf: "internal-transaction", resource: "magnet:?xt=urn:btih:123" };
        plugin.historyRepository.offline.mockResolvedValue([offline]);
        await plugin.renderOfflineHistory();
        expect(plugin.historyRoot.text()).toContain("115 · 提交失败");
        expect(plugin.historyRoot.text()).toContain("检查授权后重试");
        expect(plugin.historyRoot.text()).not.toContain("secret");
        expect(plugin.historyRoot.text()).not.toContain("internal-transaction");
        expect(offline.errorMessage).toContain("secret");
    });
    it("persists all four flags including explicit false values", async () => {
        const loaded = await openAndSubmit(
            { favorite: true, downloaded: true, watched: false, blocked: false },
            { favorite: false, downloaded: true, watched: true, blocked: false }
        );
        expect(loaded.patch.mock.calls[0][1]).toEqual({ favorite: false, downloaded: true, watched: true, blocked: false });
    });

    it("renders new and legacy uncertain offline attempts without calling them failed", async () => {
        const { plugin, $ } = loadHistory();
        plugin.historyRoot = $('<div><div id="table-container"></div></div>');
        plugin.historyRepository.offline.mockResolvedValue([
            { id: "new", providerId: "115", status: "pending", submissionOutcome: "unknown", createdAt: "2026-10-20", errorCode: "TIMEOUT" },
            { id: "old", providerId: "123", status: "failed", createdAt: "2026-10-19", errorCode: "NETWORK_ERROR" },
            { id: "exists", providerId: "115", status: "submitted", submissionOutcome: "exists", createdAt: "2026-10-20" },
        ]);
        await plugin.renderOfflineHistory();
        expect(plugin.historyRoot.text().match(/提交结果待确认/g)).toHaveLength(2);
        expect(plugin.historyRoot.text()).toContain("云端任务已存在");
        expect(plugin.historyRoot.text()).not.toContain("提交失败");
    });

    it("keeps a recorded pre-dispatch network failure distinct from an uncertain legacy failure", async () => {
        const { plugin, $ } = loadHistory();
        plugin.historyRoot = $('<div><div id="table-container"></div></div>');
        plugin.historyRepository.offline.mockResolvedValue([{ id: "pre", status: "failed", submissionOutcome: "failed", errorCode: "NETWORK_ERROR" }]);
        await plugin.renderOfflineHistory();
        expect(plugin.historyRoot.text()).toContain("提交失败");
        expect(plugin.historyRoot.text()).not.toContain("提交结果待确认");
    });

    it("confirms blocked false-to-true exactly once", async () => {
        const loaded = await openAndSubmit(
            { favorite: false, downloaded: false, watched: false, blocked: false },
            { favorite: false, downloaded: false, watched: false, blocked: true }
        );
        expect(loaded.confirm).toHaveBeenCalledOnce();
    });

    it.each([
        [ "history-favoriteBtn", "favorite" ],
        [ "history-hasDownBtn", "downloaded" ],
        [ "history-hasWatchBtn", "watched" ]
    ])("toggles a single-row %s action", async (buttonClass, flag) => {
        const loaded = loadHistory(), root = loaded.$(`<div><div class="action-btns" data-car-num="ABC-1" data-href="/v/a"><button class="${buttonClass}"></button></div></div>`);
        loaded.plugin.tableObj = { getRow: () => ({ getData: () => ({ stateFlags: {} }) }), deselectRow: vi.fn(), setPage: vi.fn() };
        loaded.plugin.bindHistoryActions(root), root.find("button").trigger("click");
        await vi.waitFor((() => expect(loaded.toggle).toHaveBeenCalledWith("ABC-1", flag, expect.any(Object))));
    });

    it("only confirms blocking and directly toggles unblocking", async () => {
        const loaded = loadHistory(), root = loaded.$('<div><div class="action-btns" data-car-num="ABC-1"><button class="history-filterBtn"></button></div></div>');
        loaded.plugin.tableObj = { getRow: () => ({ getData: () => ({ stateFlags: { blocked: true } }) }), deselectRow: vi.fn(), setPage: vi.fn() };
        loaded.plugin.bindHistoryActions(root), root.find("button").trigger("click");
        await vi.waitFor((() => expect(loaded.toggle).toHaveBeenCalledWith("ABC-1", "blocked", expect.any(Object))));
        expect(loaded.confirm).not.toHaveBeenCalled();
    });

    it("labels a configured 123AV mirror through the provider matcher", () => {
        const loaded = loadHistory();
        loaded.plugin.movie = {
            matchesProviderUrl: (providerId, value) => providerId === "av123" && new URL(value).hostname === "mirror.example",
            externalSiteOrigin: () => "https://unused.example",
        };
        loaded.plugin.settings = { snapshot: () => ({ av123Url: "https://mirror.example" }) };
        expect(loaded.plugin.getSourceLabel("https://mirror.example/cn/v/ABC-123")).toBe("123AV");
    });
});
