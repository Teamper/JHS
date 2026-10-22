import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

async function start(page, context) {
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { hostStyles: true, beforeUserscriptInjection: injectRealLayer, disabledPlugins: ["TaskPlugin"], settingOverrides: { enableLoadReview: "no" } });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
}

test("history explicit selection clears on page, size and sort changes while all-filtered exclusions survive", async ({ page, context }) => {
    await start(page, context);
    await page.evaluate(() => {
        const history = window.unsafeWindow.pluginManager.getBean("HistoryPlugin");
        history.historyRepository.list = async () => Array.from({ length: 120 }, (_, i) => ({
            carNum: `ABC-${String(i + 1).padStart(3, "0")}`, url: "/v/fixture", names: "Fixture", stateFlags: {}, updateDate: String(i).padStart(3, "0"),
        }));
        history.openHistory();
    });
    await expect(page.locator(".tabulator-row").first()).toBeVisible();
    const results = await page.evaluate(async () => {
        const history = window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller, table = history.tableObj;
        const change = action => new Promise(resolve => { const done = () => { table.off("dataProcessed", done); resolve(); }; table.on("dataProcessed", done); action(); });
        const snapshot = async () => ({ count: history.getHistorySelectionSummary().count, visual: table.getSelectedData().map(row => row.carNum), batch: (await history.getHistoryBatchSelection()).map(row => row.carNum) });
        table.selectRow(table.getData()[0].carNum); await change(() => table.setPage(2)); const page2 = await snapshot();
        await change(() => table.setPage(1)); const returned = await snapshot();
        table.selectRow(table.getData()[0].carNum); await change(() => table.setPageSize(100)); const resized = await snapshot();
        table.selectRow(table.getData()[0].carNum); await change(() => table.setSort("carNum", "asc")); const sorted = await snapshot();
        history.historySelectionModel.selectAllFiltered(); history.historySelectionModel.excluded.add("ABC-002");
        await change(() => table.setPage(2)); await change(() => table.setSort("carNum", "desc")); const all = await snapshot();
        return { page2, returned, resized, sorted, all, excluded: [...history.historySelectionModel.excluded] };
    });
    for (const key of ["page2", "returned", "resized", "sorted"]) expect(results[key]).toEqual({ count: 0, visual: [], batch: [] });
    expect(results.all.count).toBe(119);
    expect(results.all.batch).toHaveLength(119);
    expect(results.all.batch).not.toContain("ABC-002");
    expect(results.excluded).toEqual(["ABC-002"]);
});

test("history mutations refetch the current page and preserve its holder, clamping a removed last page", async ({ page, context }) => {
    await start(page, context);
    await page.evaluate(() => {
        const history = window.unsafeWindow.pluginManager.getBean("HistoryPlugin");
        window.historyFixture = { reads: 0, rows: Array.from({ length: 151 }, (_, i) => ({ carNum: `ABC-${String(i + 1).padStart(3, "0")}`, names: "Fixture", url: "/v/fixture", stateFlags: {}, updateDate: String(i).padStart(3, "0") })) };
        history.historyRepository.list = async () => { window.historyFixture.reads++; return window.historyFixture.rows; };
        history.historyRepository.toggle = async () => ({ changed: ["ABC-101"] });
        history.openHistory();
    });
    await expect(page.locator(".tabulator-row").first()).toBeVisible();
    await page.evaluate(async () => {
        const history = window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller;
        await history.tableObj.setPage(3);
        const holder = document.querySelector(".tabulator-tableholder"); holder.scrollTop = 300;
        window.historyFixture.before = { scroll: holder.scrollTop, reads: window.historyFixture.reads };
        const button = document.createElement("button"); button.className = "history-favoriteBtn";
        history.handleRowAction({ currentTarget: button, preventDefault() {}, stopPropagation() {} }, { carNum: "ABC-101" });
    });
    expect(await page.evaluate(() => window.historyFixture.before.scroll)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.historyFixture.reads)).toBeGreaterThan(await page.evaluate(() => window.historyFixture.before.reads));
    await expect.poll(() => page.evaluate(() => document.querySelector(".tabulator-tableholder").scrollTop)).toBe(await page.evaluate(() => window.historyFixture.before.scroll));
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller.tableObj.getPage())).toBe(3);
    await page.evaluate(async () => {
        const history = window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller;
        await history.tableObj.setPage(4); window.historyFixture.rows.pop();
        await history.reloadTable(true, { preservePage: true });
    });
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller.tableObj.getPage())).toBe(3);
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller.tableObj.getData().length)).toBe(50);
    await page.evaluate(async () => { window.historyFixture.rows = []; await window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller.refresh(); });
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").controller.tableObj.getPage())).toBe(1);
    await expect(page.locator(".tabulator-placeholder")).toContainText("暂无数据");
});

test("new-video loading accepts current filters and keeps additive page selection reachable", async ({ page, context }) => {
    await start(page, context);
    await page.waitForFunction(() => window.unsafeWindow.pluginManager.getBean("NewVideoPlugin")?.featureNewVideoWorkspaceController);
    await page.evaluate(async () => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        const items = Array.from({ length: 5 }, (_, i) => ({ carNum: `ABC-00${i + 1}`, title: "Fixture", actressName: "Fixture", actresses: ["Fixture"], starId: "fixture", categories: ["censored"], isVr: i < 4, flags: {}, decisionState: "pending", publishTime: "2026-10-20", coverUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" }));
        const snapshot = { items, actresses: [], carMap: new Map(), decisions: {}, ruleTime: 8760, javDbUrl: "https://javdb.com" };
        plugin.featureNewVideoWorkspaceController.loadWorkspace = () => new Promise(resolve => window.finishContinuityLoad = () => resolve(snapshot));
        plugin.nvPageSize = 2; window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").getRuntimeService("storage").setLocal("jhs_newVideoViewMode", "list"); await plugin.openDialog();
    });
    await page.waitForFunction(() => typeof window.finishContinuityLoad === "function");
    await page.evaluate(() => window.jQuery("#nvCategoryFilter").val("vr").trigger("change"));
    await expect(page.locator("#new-video-list-container")).toContainText("加载中");
    await page.evaluate(() => window.finishContinuityLoad());
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(2);
    expect(await page.locator("#nvCategoryFilter").inputValue()).toBe("vr");
    await page.locator("#nvSelectPage").focus(); await page.locator("#nvSelectPage").press("Enter");
    await expect(page.locator("#nvSelectPage")).toBeFocused();
    await expect(page.locator("#nvSelectPage")).toBeInViewport();
    await page.locator("#nv-pagination-bar").getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page.locator("#nvSelectPage")).toBeVisible();
    await page.locator("#nvSelectPage").click();
    expect(await page.evaluate(() => [...window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").nvSelected].sort())).toEqual(["ABC-001", "ABC-002", "ABC-003", "ABC-004"]);
    await page.locator("#nvClearSelection").focus(); await page.locator("#nvClearSelection").press("Enter");
    await expect(page.locator("#nvSelectPage")).toBeFocused();
});
