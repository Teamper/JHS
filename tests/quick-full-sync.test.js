import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { bindSettingRows, buildQuickSettingsHtml, renderSettingRow } from "../src/ui/settings/setting-control-renderer.js";

function createHarness(initial = {}) {
    const dom = new JSDOM('<div id="quick"></div><div id="full"></div>', { url: "https://javdb.com/" });
    const jq = jqueryFactory(dom.window);
    const stored = { setting: { ...initial } };
    const settings = new SettingsService({ get: async (key) => stored[key], set: async (key, value) => { stored[key] = value; } });
    const registry = new SettingsRegistry();
    registerDefaultSettings(registry);
    return { dom, jq, settings, registry, stored };
}

describe("Quick ↔ Full settings share one key", () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it("renders quick rows from the registry with the canonical key set", async () => {
        const { dom, jq, registry } = createHarness({});
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", dom.window.document);
        const list = buildQuickSettingsHtml(registry);
        expect(list.find('[data-jhs-setting="enableLoadScreenShot"]')).toHaveLength(1);
        expect(list.find('[data-jhs-setting="enablePreviewVideo"]')).toHaveLength(1);
        expect(list.find('[data-jhs-setting="enableLoadPreviewVideo"]')).toHaveLength(1);
        // 旧双 key 中的 enableScreenSvg 不再出现在任何 surface
        expect(list.find('[data-jhs-setting="enableScreenSvg"]')).toHaveLength(0);
        expect(list.find('[data-jhs-setting="enableLoadPreviewVideo"]').hasClass("jhs-setting-row--indent")).toBe(true);
    });

    it("writes the same key on quick toggle and full toggle", async () => {
        const { dom, jq, settings, registry } = createHarness({ enableLoadScreenShot: "no", enablePreviewVideo: "yes" });
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", dom.window.document);
        await settings.load();

        const quickRoot = jq("#quick");
        quickRoot.append(buildQuickSettingsHtml(registry));
        bindSettingRows(quickRoot, registry.list({ surfaces: ["quick"] }), { settings });
        const quickToggle = quickRoot.find('[data-jhs-setting="enableLoadScreenShot"] input');
        expect(quickToggle.is(":checked")).toBe(false);
        quickToggle.prop("checked", true).trigger("change");
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(settings.snapshot().enableLoadScreenShot).toBe("yes");

        // 完整设置使用同一 descriptor：同一 snapshot 值
        const fullDescriptors = registry.list({ surfaces: ["full"] }).filter((descriptor) => (descriptor.effect || "live") === "live");
        const fullRoot = jq("#full");
        fullDescriptors.forEach((descriptor) => { const { row } = renderSettingRow(descriptor, { value: settings.snapshot()[descriptor.key] ?? descriptor.defaultValue }); fullRoot.append(row); });
        bindSettingRows(fullRoot, fullDescriptors, { settings });
        expect(fullRoot.find('[data-jhs-setting="enableLoadScreenShot"] input').is(":checked")).toBe(true);
    });

    it("writes DMM enhancement under the preview master switch independently", async () => {
        const { dom, jq, settings, registry } = createHarness({ enablePreviewVideo: "no", enableLoadPreviewVideo: "yes" });
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", dom.window.document);
        await settings.load();
        const quickRoot = jq("#quick");
        quickRoot.append(buildQuickSettingsHtml(registry));
        bindSettingRows(quickRoot, registry.list({ surfaces: ["quick"] }), { settings });
        const preview = quickRoot.find('[data-jhs-setting="enablePreviewVideo"] input');
        const dmm = quickRoot.find('[data-jhs-setting="enableLoadPreviewVideo"] input');
        expect(preview.is(":checked")).toBe(false);
        expect(dmm.is(":checked")).toBe(true);
        dmm.prop("checked", false).trigger("change");
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(settings.snapshot().enableLoadPreviewVideo).toBe("no");
        expect(settings.snapshot().enablePreviewVideo).toBe("no");
    });

    it("registry catalog covers the quick surfaces with preview master + dmm child order", async () => {
        const { registry } = createHarness({});
        const keys = registry.list({ surfaces: ["quick"] }).map((item) => item.key);
        expect(keys.indexOf("enablePreviewVideo")).toBeGreaterThan(-1);
        expect(keys.indexOf("enableLoadPreviewVideo")).toBeGreaterThan(keys.indexOf("enablePreviewVideo"));
        expect(keys).not.toContain("enableScreenSvg");
    });
});
