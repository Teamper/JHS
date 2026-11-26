import { BUILT_IN_MAGNET_SOURCES, ResourceSettingsService, buildCustomMagnetSource, parseBooleanSetting, validateRule } from "../src/services/resource-settings-service.js";
import { SettingsService } from "../src/services/settings-service.js";
import { renderResourceSettings } from "../src/features/settings/resource-settings-controller.js";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { describe, expect, it, vi } from "vitest";

async function load(initial = {}) {
    const values = new Map(Object.entries(initial));
    const storage = {
        get: async () => Object.fromEntries(values),
        set: vi.fn(async (_key, snapshot) => {
            values.clear();
            for (const [key, value] of Object.entries(snapshot)) values.set(key, value);
        }),
    };
    const settings = new SettingsService(storage);
    await settings.load();
    return { settings, storage, values, instance: new ResourceSettingsService(settings) };
}
const form = { name: "我的来源", enabled: true, priority: 80, searchUrlTemplate: "https://example.com/search?q={keyword}", targetUrlTemplate: "https://example.com/search?q={keyword}", parserType: "json", resultsPath: "data.items", titlePath: "title", magnetPath: "magnet" };

describe("resource settings service", () => {
    it("builds custom source config and preserves id when edited", () => { const added = buildCustomMagnetSource(form); expect(added.parserType).toBe("json"); expect(added.resultsPath).toBe("data.items"); expect(buildCustomMagnetSource({ ...form, name: "编辑后" }, added).id).toBe(added.id); });
    it("rejects invalid source URL and invalid regex", () => { expect(() => buildCustomMagnetSource({ ...form, searchUrlTemplate: "http://bad.test/{keyword}" })).toThrow(); expect(() => validateRule({ name: "坏规则", type: "regex", pattern: "[" })).toThrow("正则表达式无效"); });
    it("adds edits and deletes tag and filter rules through compatible keys", async () => { const { instance, values } = await load(); const tag = { id: "t", name: "4K", type: "contains", pattern: "2160p", enabled: true, weight: 20 }, filter = { id: "f", name: "广告", type: "contains", pattern: "广告", enabled: true, action: "hide" }; await instance.saveMagnetTagRules([tag]); await instance.saveMagnetFilterRules([filter]); expect(JSON.parse(values.get("magnetTagRules"))[0].name).toBe("4K"); tag.weight = 10; await instance.saveMagnetTagRules([tag]); expect(JSON.parse(values.get("magnetTagRules"))[0].weight).toBe(10); await instance.saveMagnetFilterRules([]); expect(values.get("magnetFilterRules")).toBe("[]"); });
    it("built-in sources have no delete capability in their model", () => { expect(BUILT_IN_MAGNET_SOURCES.every(source => !("delete" in source))).toBe(true); });
    it.each([ "ask", "123", "115" ])("persists cloud switches and provider mode %s", async providerMode => {
        const { instance, values } = await load();
        await instance.saveCloudSettings({ enable123Offline: false, enable115Offline: false, enable115Match: false, enable115LoginRedirect: false, providerMode, concurrency: 4, cacheMinutes: 60 });
        expect(values.get("enable123Offline")).toBe(false);
        expect(values.get("enable115Offline")).toBe(false);
        expect(values.get("offlineProviderMode")).toBe(providerMode);
        expect((await instance.getCloudSettings()).providerMode).toBe(providerMode);
    });
    it("invalid advanced JSON cannot corrupt existing settings", async () => { const existing = JSON.stringify([{ id: "old" }]), { instance, values, storage } = await load({ customMagnetSources: existing }); await expect(instance.importConfig("{bad json")).rejects.toThrow("配置格式错误"); expect(values.get("customMagnetSources")).toBe(existing); expect(storage.set).not.toHaveBeenCalled(); });
});

describe("resource settings import", () => {
    it("keeps omitted advanced import fields", async () => { const { instance, values } = await load(); values.set("customMagnetSources", JSON.stringify([{ id: "keep" }])); await instance.importConfig(JSON.stringify({ magnetTagRules: [] })); expect(values.get("customMagnetSources")).toBe(JSON.stringify([{ id: "keep" }])); });
});

it("leaves built-in sources in place and deletes custom ones only after confirmation", async () => {
    const source = buildCustomMagnetSource(form);
    const { instance } = await load({ customMagnetSources: JSON.stringify([source]) });
    const dom = new JSDOM('<main><div id="builtin-magnet-source-list"></div><div id="custom-magnet-source-list"></div></main>');
    const $ = jquery(dom.window), root = $("main");
    vi.stubGlobal("document", dom.window.document);
    const confirm = vi.fn();
    const owner = {
        jquery: $, fullResources: instance, utils: { q: confirm },
        cancelResourceTests() {}, renderRules() {},
        _sourceRenderGeneration: 0, resourceState: { builtIn: BUILT_IN_MAGNET_SOURCES, custom: [source], screenshot: { providers: [] } },
        renderResourceSettings: node => renderResourceSettings(owner, node),
    };
    try {
        owner.renderResourceSettings(root);
        expect(root.find("#builtin-magnet-source-list .jhs-resource-card").length).toBeGreaterThan(0);
        expect(root.find("#builtin-magnet-source-list .jhs-source-delete")).toHaveLength(0);
        root.find("#custom-magnet-source-list .jhs-source-delete").trigger("click");
        expect(confirm).toHaveBeenCalledOnce();
        expect(instance.getMagnetSources()).toEqual([source]);
        const [, message, accept] = confirm.mock.calls[0];
        expect(message).toContain(source.name);
        await accept();
        expect(instance.getMagnetSources()).toEqual([]);
        expect(root.find("#custom-magnet-source-list .jhs-source-delete")).toHaveLength(0);
    } finally {
        vi.unstubAllGlobals();
        dom.window.close();
    }
});

describe("resource settings granular writes", () => {
    it("screenshot mode and providers can be saved independently", async () => {
        const { instance, values, storage } = await load({ screenshotMode: "auto" });
        await instance.saveScreenshotMode("manual");
        expect(values.get("screenshotMode")).toBe("manual");
        expect(storage.set).toHaveBeenLastCalledWith("setting", { screenshotMode: "manual" });
        await instance.saveScreenshotProviders([{ id: "x", enabled: true }]);
        expect(values.get("screenshotProviders")).toBe(JSON.stringify([{ id: "x", enabled: true }]));
        expect(values.get("screenshotMode")).toBe("manual");
    });

    it("cloud single-key write only touches the requested key", async () => {
        const { instance, storage } = await load({ enable115Match: "false", oneOneFiveConcurrency: 4 });
        await instance.saveCloudSetting("enable115Match", true);
        expect(storage.set).toHaveBeenCalledExactlyOnceWith("setting", { enable115Match: true, oneOneFiveConcurrency: 4 });
    });

    it("parses legacy boolean strings without Boolean('false')", async () => {
        expect(parseBooleanSetting("false", true)).toBe(false);
        expect(parseBooleanSetting("true", false)).toBe(true);
        expect(parseBooleanSetting("no", true)).toBe(false);
        expect(parseBooleanSetting(undefined, true)).toBe(true);
    });

    it("updates an array from the latest persisted settings under the settings lock", async () => {
        const { instance, values, storage } = await load({ customMagnetSources: JSON.stringify([{ id: "a", enabled: true }]) });
        const newer = { id: "b", enabled: true };
        values.set("customMagnetSources", JSON.stringify([{ id: "a", enabled: true }, newer]));
        await instance.updateArray("customMagnetSources", list => {
            list.find(item => item.id === "a").enabled = false;
            return list;
        });
        expect(JSON.parse(values.get("customMagnetSources"))).toEqual([{ id: "a", enabled: false }, newer]);
        expect(storage.set).toHaveBeenCalledOnce();
    });
});
