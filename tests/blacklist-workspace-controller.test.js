import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { BlacklistWorkspaceController } from "../src/features/library/blacklist-workspace-controller.js";
import { TaskCompatibilityBean } from "../src/compat/task-compatibility-bean.js";

function createWorkspace(records = []) {
    const dom = new JSDOM('<body><input id="searchValue"><select id="dataType"><option value=""></option><option value="actor">男演员</option><option value="actress">女演员</option></select><select id="statusType"><option value=""></option><option value="normal">继续检测</option><option value="stop">停更跳过</option></select><select id="urlType"><option value=""></option><option value="hasT">按所选分类屏蔽</option><option value="noT">未筛选分类</option></select></body>', { url: "https://javdb.com/" });
    const $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    vi.stubGlobal("document", dom.window.document);
    const state = {
        getBlacklist: vi.fn(async () => records),
        getBlacklistCarList: vi.fn(async () => [{ starId: "actor-1", carNum: "ABC-001" }]),
        removeBlacklistActor: vi.fn(async () => true),
    };
    const scope = { disposed: false };
    const controller = new BlacklistWorkspaceController({
        document: dom.window.document, window: dom.window, jquery: $, site: "javdb", state,
        settings: { snapshot: () => ({ checkBlacklist_ruleTime: 8760, checkBlacklist_intervalTime: 12 }) },
        storage: { getLocal: () => "2026-09-26" }, events: { emit: vi.fn(async () => {}), on: vi.fn(() => vi.fn()) },
        dialog: { open: vi.fn(), close: vi.fn() }, ui: { getDialogArea: () => ["900px", "700px"], openPage: vi.fn(), confirm: vi.fn(), enhanceSelect: vi.fn(), setSelectValue: (select, value) => select.val(value) },
        notifications: { error: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn() }, scope,
        task: null, openSettings: vi.fn(),
    });
    controller.blacklistRoot = $(dom.window.document.body);
    return { controller, state, $, dom, scope };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("BlacklistWorkspaceController", () => {
    it("shows a bounded startup failure and restores the manual scan button", async () => {
        const { controller, dom, $ } = createWorkspace();
        const button = $('<button id="checkBlacklistBtn"><span>检测</span></button>').appendTo(controller.blacklistRoot);
        Object.defineProperty(dom.window.navigator, "locks", { configurable: true, value: { request: async (_key, _options, callback) => callback({}) } });
        controller.task = { singleTaskKey: "synthetic-blacklist", checkBlacklist: vi.fn(async () => { throw new Error("后台任务尚未就绪，请稍后重试"); }) };

        await controller.runManualScan({ currentTarget: button[0] }, controller.dialogGeneration);

        expect(controller.notifications.error).toHaveBeenCalledExactlyOnceWith("后台任务尚未就绪，请稍后重试");
        expect(button.prop("disabled")).toBe(false);
        expect(button.attr("aria-busy")).toBeUndefined();
        expect(button.find("span").text()).toBe("检测");
        dom.window.close();
    });

    it("does not start a queued manual scan after its dialog closes", async () => {
        vi.useFakeTimers();
        const { controller, dom, $ } = createWorkspace();
        const button = $('<button id="checkBlacklistBtn"><span>检测</span></button>').appendTo(controller.blacklistRoot);
        const request = vi.fn(async (_key, _options, callback) => callback({}));
        Object.defineProperty(dom.window.navigator, "locks", { configurable: true, value: { request } });
        const task = new TaskCompatibilityBean();
        controller.task = task;
        const pending = controller.runManualScan({ currentTarget: button[0] }, controller.dialogGeneration);
        expect(task.serviceWaiters.size).toBe(1);
        await controller.finishDialog(controller.dialogGeneration, false);
        await pending;

        expect(request).not.toHaveBeenCalled();
        expect(task.serviceWaiters.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        expect(controller.notifications.error).not.toHaveBeenCalled();
        dom.window.close();
    });
    it("combines search, role, stopped status, and category filters without changing other filters", async () => {
        const records = [
            { starId: "actor-1", name: "Alpha", allName: ["别名 One"], role: "actor", url: "https://javdb.com/actors/a?t=c", lastPublishTime: "2000-01-01", createTime: "2026-09-27" },
            { starId: "actress-1", name: "Beta", allName: "Second Alias", role: "actress", url: "https://javdb.com/actors/b", lastPublishTime: new Date().toISOString(), createTime: "2026-09-26" },
        ];
        const { controller, state, $, dom } = createWorkspace(records);
        controller.blacklistRoot.find("#searchValue").val("别名");
        controller.blacklistRoot.find("#dataType").val("actor");
        controller.blacklistRoot.find("#statusType").val("stop");
        controller.blacklistRoot.find("#urlType").val("hasT");

        const rows = await controller.getTableData();

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ starId: "actor-1", isUnCheck: true, count: 1 });
        expect(state.getBlacklist).toHaveBeenCalledOnce();
        expect(state.getBlacklistCarList).toHaveBeenCalledOnce();
        expect(controller.blacklistRoot.find("#statusType").val()).toBe("stop");
        expect(controller.blacklistRoot.find("#urlType").val()).toBe("hasT");
        expect(controller.blacklistRoot.find("#dataType option").map((_index, option) => $(option).text()).get()).toEqual(["所有 (2)", "男演员 (1)", "女演员 (1)"]);
        dom.window.close();
    });

    it("uses DOM text for imported names and disables non-HTTP(S) actor links", () => {
        const { controller, dom } = createWorkspace();
        const formatter = controller.getColumns()[0].formatter;
        const link = formatter({ getData: () => ({ name: '<img id="injected">', url: "javascript:alert(1)" }) });

        expect(link.tagName).toBe("A");
        expect(link.textContent).toBe('<img id="injected">');
        expect(link.querySelector("#injected")).toBeNull();
        expect(link.getAttribute("href")).toBe("#");
        expect(link.getAttribute("aria-disabled")).toBe("true");
        dom.window.close();
    });

    it("renders an imported actor name as text in the delete confirmation", () => {
        const { controller, state, dom } = createWorkspace();
        const name = '<img src=x onerror="alert(1)"> & <b>Actor</b>';
        const element = dom.window.document.createElement("div");
        const column = controller.getColumns().at(-1);
        const onRendered = [];
        const markup = column.formatter({ getData: () => ({ starId: "actor-1", name }), getElement: () => element }, null, (bind) => onRendered.push(bind));
        // Tabulator calls onRendered after it mounts the formatter result.
        element.innerHTML = markup;
        onRendered[0]();
        element.querySelector(".delete-btn").click();
        const message = controller.ui.confirm.mock.calls[0][1];
        const rendered = dom.window.document.createElement("div");
        rendered.innerHTML = message;
        expect(rendered.querySelector("img,b")).toBeNull();
        expect(rendered.textContent).toContain(name);
        expect(state.removeBlacklistActor).not.toHaveBeenCalled();
        dom.window.close();
    });

    it("ignores table data that resolves after the dialog closes", async () => {
        let resolveActors;
        const { controller, state, dom } = createWorkspace();
        state.getBlacklist = vi.fn(() => new Promise((resolve) => { resolveActors = resolve; }));
        const table = { setData: vi.fn() };
        controller.tableObj = table;
        controller.dialogGeneration = 1;
        const pending = controller.reloadTable(1);
        await vi.waitFor(() => expect(resolveActors).toBeTypeOf("function"));
        await controller.finishDialog(1, false);
        resolveActors([]);
        await pending;

        expect(table.setData).not.toHaveBeenCalled();
        dom.window.close();
    });

    it("closes its owned dialog and releases table resources on Feature disposal", () => {
        const { controller, dom } = createWorkspace();
        controller.dialogId = 7;
        controller.tableObj = { destroy: vi.fn() };
        const table = controller.tableObj;

        controller.dispose();

        expect(controller.dialog.close).toHaveBeenCalledWith(7);
        expect(table.destroy).toHaveBeenCalledOnce();
        expect(controller.blacklistRoot).toBeNull();
        expect(controller.disposed).toBe(true);
        dom.window.close();
    });
});
