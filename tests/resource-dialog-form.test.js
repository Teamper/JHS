// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingPlugin } from "../src/plugins/backup/setting.js";
import { BUILT_IN_NATIVE_MAGNET_SOURCES } from "../src/services/resource-settings-service.js";
import { BUILT_IN_SCREENSHOT_SOURCES } from "../src/services/screenshot-sources.js";

const $ = jquery;
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
    vi.stubGlobal("storageManager", {});
    const dialog = { open: vi.fn(), close: vi.fn() };
    const notifications = { error: vi.fn(), info: vi.fn() };
    const plugin = new SettingPlugin({ runtimeServices: { dialog }, jquery: $, utilities: { getDialogArea: () => ["60%", "80%"] }, notifications, document, window });
    const records = { customMagnetSources: [], magnetTagRules: [], magnetFilterRules: [] };
    const resourceSettings = {
        updateArray: vi.fn(async (key, mutator) => { records[key] = mutator([...records[key]]); }),
        getMagnetSources: vi.fn(async () => records.customMagnetSources),
        getArray: vi.fn(async key => records[key]),
    };
    plugin.resourceSettings = resourceSettings;
    plugin.resourceState = { custom: [], tags: [], filters: [] };
    return { plugin, dialog, notifications, records, resourceSettings };
}

describe("resource settings dialogs", () => {
    it("labels custom magnet sources by their resource family", () => {
        const test = fixture();
        const root = $(document.body).append(`
            <div id="builtin-magnet-source-list"></div><div id="custom-magnet-source-list"></div>
            <div id="screenshot-source-list"></div><input type="radio" name="screenshotMode" value="auto">
            <div id="magnet-tag-rule-list"></div><div id="magnet-filter-rule-list"></div>
        `);
        test.plugin.resourceState = {
            builtIn: [], tags: [], filters: [], screenshot: { mode: "auto", providers: [BUILT_IN_SCREENSHOT_SOURCES[0]] },
            custom: [{ id: "test", name: '自定义 <img id="source-xss" src=x onerror="alert(1)">', searchUrlTemplate: "https://example.org/search?q={keyword}", enabled: false, priority: 100 }],
        };

        test.plugin.renderResourceSettings(root);

        expect(root.find("#custom-magnet-source-list .jhs-resource-card small").text()).toContain("磁力来源 · example.org");
        expect(root.find("#custom-magnet-source-list .jhs-resource-card strong").text()).toContain('<img id="source-xss"');
        expect(root.find("#custom-magnet-source-list #source-xss").length).toBe(0);
        expect(root.find("#screenshot-source-list .jhs-resource-card small").text()).toContain("截图来源 · javstore.net");
    });

    it("tests the configured JavStore endpoint and reports connectivity without claiming parsing", async () => {
        const test = fixture(), root = $(document.body).append(`
            <div id="builtin-magnet-source-list"></div><div id="custom-magnet-source-list"></div>
            <div id="screenshot-source-list"></div><input type="radio" name="screenshotMode" value="auto">
            <div id="magnet-tag-rule-list"></div><div id="magnet-filter-rule-list"></div>
        `);
        test.plugin.resourceState = {
            builtIn: [BUILT_IN_NATIVE_MAGNET_SOURCES[0]], tags: [], filters: [], custom: [],
            screenshot: { mode: "auto", providers: [BUILT_IN_SCREENSHOT_SOURCES[0]] },
        };
        const request = vi.fn(async () => ({ status: 200, data: "<html>challenge page</html>" }));
        test.plugin.runtimeServices.http = { request };
        test.plugin.renderResourceSettings(root);
        root.find("#screenshot-source-list .jhs-source-test").trigger("click");
        await vi.waitFor(() => expect(root.find("#screenshot-source-list .jhs-source-test-state").text()).toContain("HTTP 200"));

        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            url: "https://javstore.net/search?q=JHS_CONNECTIVITY_TEST", responseType: "text", cacheScope: "none",
            urlPolicy: { trustClass: "builtin-public", hosts: ["javstore.net"] },
        }), expect.anything());
        expect(root.find("#screenshot-source-list .jhs-source-test-state").text()).toBe("HTTP 200 · 已响应（未验证解析）");
        await test.plugin.testSource(root.find("#builtin-magnet-source-list .jhs-source-test")[0], null, { source: BUILT_IN_NATIVE_MAGNET_SOURCES[0] });
        expect(test.notifications.info).toHaveBeenCalledWith("本站资源依赖当前页面，无需单独检测");
    });

    it.each([
        [{ status: 204, data: "" }, "HTTP 204 · 空响应"],
        [new Error("not found"), "请求失败"],
        [Object.assign(new Error("not found"), { code: "NOT_FOUND" }), "404"],
        [Object.assign(new Error("rate limited"), { code: "RATE_LIMITED" }), "限流"],
        [Object.assign(new Error("auth required"), { code: "AUTH_REQUIRED" }), "需要授权"],
        [Object.assign(new Error("timeout"), { code: "TIMEOUT" }), "超时"],
    ])("reports source test outcome accurately", async (result, expected) => {
        const test = fixture(), host = $("<div><button type='button'>测试</button></div>").appendTo(document.body), button = host.find("button")[0];
        test.plugin.runtimeServices.http = { request: vi.fn(async () => { if (result instanceof Error) throw result; return result; }) };
        await test.plugin.testSource(button, "https://javstore.net/", { source: { id: "javstore", domain: "javstore.net" } });
        expect(host.find(".jhs-source-test-state").text()).toBe(expected);
        expect(host.find("button").prop("disabled")).toBe(false);
    });

    it("aborts a source test when its settings surface is rerendered", async () => {
        const test = fixture(), root = $(document.body).append(`
            <div id="builtin-magnet-source-list"></div><div id="custom-magnet-source-list"></div>
            <div id="screenshot-source-list"></div><input type="radio" name="screenshotMode" value="auto">
            <div id="magnet-tag-rule-list"></div><div id="magnet-filter-rule-list"></div>
        `);
        test.plugin.resourceState = {
            builtIn: [], tags: [], filters: [], custom: [],
            screenshot: { mode: "auto", providers: [BUILT_IN_SCREENSHOT_SOURCES[0]] },
        };
        let resolveRequest;
        let requestScope;
        test.plugin.runtimeServices.http = { request: vi.fn((_options, scope) => {
            requestScope = scope;
            return new Promise(resolve => { resolveRequest = resolve; });
        }) };
        test.plugin.renderResourceSettings(root);
        root.find("#screenshot-source-list .jhs-source-test").trigger("click");
        await vi.waitFor(() => expect(requestScope).toBeDefined());
        test.plugin.renderResourceSettings(root);
        expect(requestScope.disposed).toBe(true);
        resolveRequest({ status: 200, data: "ok" });
        await vi.waitFor(() => expect(test.plugin._resourceTestScopes.size).toBe(0));
        expect(root.find("#screenshot-source-list .jhs-source-test-state").length).toBe(0);
    });

    it("submits a custom source once and preserves its ID when edited", async () => {
        const test = fixture();
        test.plugin.openSourceDialog();
        const options = test.dialog.open.mock.calls[0][0], form = options.content;
        form.find('[name="name"]').val("测试来源");
        form.find('[name="enabled"]').prop("checked", false);
        form.find('[name="priority"]').val("73");
        form.find('[name="searchUrlTemplate"]').val("https://example.org/search?q={keyword}");
        const first = options.yes(1), repeated = options.yes(1);
        await Promise.all([first, repeated]);
        expect(test.resourceSettings.updateArray).toHaveBeenCalledOnce();
        expect(test.records.customMagnetSources[0]).toMatchObject({ name: "测试来源", enabled: false, priority: 73 });
        const originalId = test.records.customMagnetSources[0].id;
        test.plugin.openSourceDialog(test.records.customMagnetSources[0]);
        const edit = test.dialog.open.mock.calls[1][0];
        edit.content.find('[name="name"]').val("修改来源");
        await edit.yes(2);
        expect(test.records.customMagnetSources).toHaveLength(1);
        expect(test.records.customMagnetSources[0]).toMatchObject({ id: originalId, name: "修改来源" });
    });

    it("keeps invalid source input and stored records unchanged", async () => {
        const test = fixture();
        test.plugin.openSourceDialog();
        const options = test.dialog.open.mock.calls[0][0];
        options.content.find('[name="name"]').val("坏地址");
        options.content.find('[name="searchUrlTemplate"]').val("javascript:void(0)");
        await options.yes(1);
        expect(test.resourceSettings.updateArray).not.toHaveBeenCalled();
        expect(test.dialog.close).not.toHaveBeenCalled();
        expect(options.content.find('[name="name"]').val()).toBe("坏地址");
        expect(test.notifications.error).toHaveBeenCalled();
    });

    it("keeps a source editable after a failed save and retries once", async () => {
        const test = fixture();
        test.resourceSettings.updateArray.mockRejectedValueOnce(new Error("写入失败"));
        test.plugin.openSourceDialog();
        const options = test.dialog.open.mock.calls[0][0];
        options.content.find('[name="name"]').val("重试来源");
        options.content.find('[name="searchUrlTemplate"]').val("https://example.org/search?q={keyword}");
        await options.yes(1);
        expect(test.dialog.close).not.toHaveBeenCalled();
        expect(options.content.find('[name="name"]').val()).toBe("重试来源");
        expect(test.records.customMagnetSources).toHaveLength(0);
        await options.yes(1);
        expect(test.records.customMagnetSources).toHaveLength(1);
        expect(test.dialog.close).toHaveBeenCalledExactlyOnceWith(1);
    });

    it.each(["tag", "filter"])("creates and edits %s rules with numeric fields", async kind => {
        const test = fixture();
        test.plugin.openRuleDialog(kind);
        const options = test.dialog.open.mock.calls[0][0], form = options.content;
        form.find('[name="name"]').val("测试规则");
        form.find('[name="pattern"]').val("2160p");
        form.find('[name="enabled"]').prop("checked", false);
        form.find('[name="weight"]').val("15");
        form.find('[name="penalty"]').val("-12");
        await options.yes(1);
        const key = kind === "tag" ? "magnetTagRules" : "magnetFilterRules";
        expect(test.records[key][0]).toMatchObject({ name: "测试规则", enabled: false, ...(kind === "tag" ? { weight: 15 } : { penalty: -12 }) });
        const id = test.records[key][0].id;
        test.plugin.openRuleDialog(kind, test.records[key][0]);
        const edit = test.dialog.open.mock.calls[1][0];
        edit.content.find('[name="name"]').val("修改规则");
        await edit.yes(2);
        expect(test.records[key]).toHaveLength(1);
        expect(test.records[key][0]).toMatchObject({ id, name: "修改规则" });
    });

    it("rejects invalid regex and preserves the rule form", async () => {
        const test = fixture();
        test.plugin.openRuleDialog("tag");
        const options = test.dialog.open.mock.calls[0][0];
        options.content.find('[name="name"]').val("错误正则");
        options.content.find('[name="type"]').val("regex");
        options.content.find('[name="pattern"]').val("[");
        await options.yes(1);
        expect(test.resourceSettings.updateArray).not.toHaveBeenCalled();
        expect(test.dialog.close).not.toHaveBeenCalled();
        expect(options.content.find('[name="pattern"]').val()).toBe("[");
    });
});
