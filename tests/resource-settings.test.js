import { ResourceSettingsService } from "../src/services/resource-settings-service.js";
import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const registry = readTestFile(join(import.meta.dirname, "../src/services/magnet-source-registry.js"), "utf8");
const service = readTestFile(join(import.meta.dirname, "../src/services/resource-settings-service.js"), "utf8");
function load(initial = {}) {
    const values = new Map(Object.entries(initial)), storage = { getSetting: vi.fn(async (key, fallback) => values.has(key) ? values.get(key) : fallback), saveSettingItem: vi.fn(async (key, value) => values.set(key, value)) };
    const context = vm.createContext({ URL, storageManager: storage, Date });
    vm.runInContext(`${registry}\n${service}\nglobalThis.Service=ResourceSettingsService;globalThis.buildSource=buildCustomMagnetSource;globalThis.validateRule=validateRule;globalThis.BUILT_INS=BUILT_IN_MAGNET_SOURCES`, context);
    return { api: context, storage, values, instance: new context.Service(storage) };
}
const form = { name: "我的来源", enabled: true, priority: 80, searchUrlTemplate: "https://example.com/search?q={keyword}", targetUrlTemplate: "https://example.com/search?q={keyword}", parserType: "json", resultsPath: "data.items", titlePath: "title", magnetPath: "magnet" };

describe("resource settings service", () => {
    it("builds custom source config and preserves id when edited", () => { const { api } = load(); const added = api.buildSource(form); expect(added.parserType).toBe("json"); expect(added.resultsPath).toBe("data.items"); expect(api.buildSource({ ...form, name: "编辑后" }, added).id).toBe(added.id); });
    it("rejects invalid source URL and invalid regex", () => { const { api } = load(); expect(() => api.buildSource({ ...form, searchUrlTemplate: "http://bad.test/{keyword}" })).toThrow(); expect(() => api.validateRule({ name: "坏规则", type: "regex", pattern: "[" })).toThrow("正则表达式无效"); });
    it("adds edits and deletes tag and filter rules through compatible keys", async () => { const { instance, values } = load(); const tag = { id: "t", name: "4K", type: "contains", pattern: "2160p", enabled: true, weight: 20 }, filter = { id: "f", name: "广告", type: "contains", pattern: "广告", enabled: true, action: "hide" }; await instance.saveMagnetTagRules([tag]); await instance.saveMagnetFilterRules([filter]); expect(JSON.parse(values.get("magnetTagRules"))[0].name).toBe("4K"); tag.weight = 10; await instance.saveMagnetTagRules([tag]); expect(JSON.parse(values.get("magnetTagRules"))[0].weight).toBe(10); await instance.saveMagnetFilterRules([]); expect(values.get("magnetFilterRules")).toBe("[]"); });
    it("built-in sources have no delete capability in their model", () => { const { api } = load(); expect(api.BUILT_INS.every(source => !("delete" in source))).toBe(true); });
    it.each([ "ask", "123", "115" ])("persists cloud switches and provider mode %s", async providerMode => {
        const { instance, values } = load();
        await instance.saveCloudSettings({ enable123Offline: false, enable115Offline: false, enable115Match: false, enable115LoginRedirect: false, providerMode, concurrency: 4, cacheMinutes: 60 });
        expect(values.get("enable123Offline")).toBe(false);
        expect(values.get("enable115Offline")).toBe(false);
        expect(values.get("offlineProviderMode")).toBe(providerMode);
        expect((await instance.getCloudSettings()).providerMode).toBe(providerMode);
    });
    it("invalid advanced JSON cannot corrupt existing settings", async () => { const existing = JSON.stringify([{ id: "old" }]), { instance, values, storage } = load({ customMagnetSources: existing }); await expect(instance.importConfig("{bad json")).rejects.toThrow("配置格式错误"); expect(values.get("customMagnetSources")).toBe(existing); expect(storage.saveSettingItem).not.toHaveBeenCalled(); });
});

describe("resource settings UI contracts", () => {
    const template = readTestFile(join(import.meta.dirname, "../src/plugins/backup/setting-templates.js"), "utf8"), setting = readTestFile(join(import.meta.dirname, "../src/plugins/backup/setting.js"), "utf8");
    it("keeps JSON advanced and separates cloud and data tools", () => { expect(template).not.toContain("自定义磁力源 JSON"); expect(template).toContain('id="cloud-services-panel"'); expect(template).toContain('id="data-tools-panel"'); expect(template).toContain("高级 · 导入 / 导出配置"); });
    it("renders cloud controls from the shared catalog instead of a second binding", () => { expect(template).toContain('id="cloud-settings-catalog"'); expect(setting).toContain("renderCloudSettings(root, cloud)"); expect(setting).not.toContain("resourceCloudState"); expect(setting).not.toContain("saveCloudSetting(key, value)"); });
    it("custom delete requires confirmation and built-ins are not deletable", () => { expect(setting).toContain('utils.q(event, `确认删除来源'); expect(setting).toContain("card(source, false"); });
    it("car import requires preview before confirm", () => { expect(template).toContain('id="confirm-car-number-import" class="jhs-btn jhs-btn--primary" disabled'); expect(setting).toContain('if (!this.pendingCarImport) return show.info("请先解析预览")'); });
    it("attaches resource dialog forms before passing them to layui", () => { expect(setting.match(/content\.appendTo\("body"\)\.hide\(\)/g)).toHaveLength(2); expect(setting.match(/end: \(\) => content\.remove\(\)/g)).toHaveLength(2); });
    it("keeps omitted advanced import fields", async () => { const { instance, values } = load(); values.set("customMagnetSources", JSON.stringify([{ id: "keep" }])); await instance.importConfig(JSON.stringify({ magnetTagRules: [] })); expect(values.get("customMagnetSources")).toBe(JSON.stringify([{ id: "keep" }])); });
});

describe("resource settings granular writes", () => {
    it("screenshot mode and providers can be saved independently", async () => {
        const { instance, values, storage } = load({ screenshotMode: "auto" });
        await instance.saveScreenshotMode("manual");
        expect(values.get("screenshotMode")).toBe("manual");
        expect(storage.saveSettingItem).not.toHaveBeenCalledWith("screenshotProviders", expect.anything());
        await instance.saveScreenshotProviders([{ id: "x", enabled: true }]);
        expect(values.get("screenshotProviders")).toBe(JSON.stringify([{ id: "x", enabled: true }]));
        expect(values.get("screenshotMode")).toBe("manual");
    });

    it("cloud single-key write only touches the requested key", async () => {
        const { instance, storage } = load({ enable115Match: "false", oneOneFiveConcurrency: 4 });
        await instance.saveCloudSetting("enable115Match", true);
        expect(storage.saveSettingItem).toHaveBeenCalledTimes(1);
        expect(storage.saveSettingItem.mock.calls[0][0]).toBe("enable115Match");
        expect(storage.saveSettingItem.mock.calls[0][1]).toBe(true);
    });

    it("parses legacy boolean strings without Boolean('false')", async () => {
        const { api } = load();
        expect(api.parseBooleanSetting("false", true)).toBe(false);
        expect(api.parseBooleanSetting("true", false)).toBe(true);
        expect(api.parseBooleanSetting("no", true)).toBe(false);
        expect(api.parseBooleanSetting(undefined, true)).toBe(true);
    });

    it("updateArray mutates from the freshest array when updateSetting is available", async () => {
        const calls = [];
        const values = new Map([["customMagnetSources", JSON.stringify([{ id: "a", enabled: true }])]]);
        const storage = {
            getSetting: vi.fn(async (key, fallback) => values.has(key) ? values.get(key) : fallback),
            saveSettingItem: vi.fn(async (key, value) => values.set(key, value)),
            updateSetting: vi.fn(async (mutator) => {
                const draft = { customMagnetSources: values.get("customMagnetSources") };
                mutator(draft);
                values.set("customMagnetSources", draft.customMagnetSources);
                calls.push(draft.customMagnetSources);
            }),
        };
        const instance = new ResourceSettingsService(storage);
        await instance.updateArray("customMagnetSources", (list) => {
            list.find((item) => item.id === "a").enabled = false;
            return list;
        });
        expect(JSON.parse(values.get("customMagnetSources"))[0].enabled).toBe(false);
        expect(storage.saveSettingItem).not.toHaveBeenCalled();
    });
});
