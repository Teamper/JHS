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

describe("Quick ↔ Full reactive binding", () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    function mountBoth(initial = {}) {
        const harness = createHarness(initial);
        const { dom, jq, settings, registry, stored } = harness;
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", dom.window.document);
        const descriptors = registry.list({ surfaces: [ "quick" ] });
        const quickRoot = jq("#quick").append(buildQuickSettingsHtml(registry));
        const fullRoot = jq("#full").append(buildQuickSettingsHtml(registry));
        const quickBinding = bindSettingRows(quickRoot, descriptors, { settings });
        const fullBinding = bindSettingRows(fullRoot, descriptors, { settings });
        return { ...harness, quickRoot, fullRoot, descriptors, quickBinding, fullBinding };
    }

    it("syncs both mounted surfaces immediately in both directions without rebuilding controls", async () => {
        const { jq, quickRoot, fullRoot, quickBinding, fullBinding, settings } = mountBoth({ enableLoadScreenShot: "no" });
        await settings.load();
        const quickInput = quickRoot.find('[data-jhs-setting="enableLoadScreenShot"] input');
        const fullInput = fullRoot.find('[data-jhs-setting="enableLoadScreenShot"] input');
        const quickNode = quickInput[0], fullNode = fullInput[0];

        fullInput.prop("checked", true).trigger("change");
        expect(quickInput.is(":checked")).toBe(true);
        await quickBinding.flush();
        expect(settings.snapshot().enableLoadScreenShot).toBe("yes");
        expect(quickInput[0]).toBe(quickNode);
        expect(fullInput[0]).toBe(fullNode);

        quickInput.prop("checked", false).trigger("change");
        expect(fullInput.is(":checked")).toBe(false);
        await fullBinding.flush();
        expect(settings.snapshot().enableLoadScreenShot).toBe("no");
        expect(quickInput[0]).toBe(quickNode);
        expect(fullInput[0]).toBe(fullNode);
    });

    it("hydrates a newly mounted full surface with a pending quick intent", async () => {
        const { jq, settings, registry } = createHarness({ enableLoadScreenShot: "no" });
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", jq("body")[0].ownerDocument);
        await settings.load();
        const descriptors = registry.list({ surfaces: [ "quick" ] });
        const quickRoot = jq("#quick").append(buildQuickSettingsHtml(registry));
        const quick = bindSettingRows(quickRoot, descriptors, { settings });
        const quickInput = quickRoot.find('[data-jhs-setting="enableLoadScreenShot"] input');
        quickInput.prop("checked", true).trigger("change");
        // Do not await the write: a full surface opened immediately must see the intent.
        const fullRoot = jq("#full").append(buildQuickSettingsHtml(registry));
        const full = bindSettingRows(fullRoot, descriptors, { settings });
        expect(fullRoot.find('[data-jhs-setting="enableLoadScreenShot"] input').is(":checked")).toBe(true);
        await Promise.all([ quick.flush(), full.flush() ]);
        expect(settings.snapshot().enableLoadScreenShot).toBe("yes");
    });

    it("rolls both surfaces back when persistence rejects", async () => {
        const { jq, dom, registry } = createHarness({ enableLoadScreenShot: "no" });
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", dom.window.document);
        const stored = { setting: { enableLoadScreenShot: "no" } };
        const settings = new SettingsService({
            get: async () => stored.setting,
            set: async (key, next) => { if (key === "setting") throw new Error("storage down"); stored[key] = next; },
        });
        await settings.load();
        const descriptors = registry.list({ surfaces: [ "quick" ] });
        const quickRoot = jq("#quick").append(buildQuickSettingsHtml(registry));
        const fullRoot = jq("#full").append(buildQuickSettingsHtml(registry));
        const quick = bindSettingRows(quickRoot, descriptors, { settings });
        const full = bindSettingRows(fullRoot, descriptors, { settings });
        quickRoot.find('[data-jhs-setting="enableLoadScreenShot"] input').prop("checked", true).trigger("change");
        await quick.flush();
        expect(quickRoot.find('[data-jhs-setting="enableLoadScreenShot"] input').is(":checked")).toBe(false);
        expect(fullRoot.find('[data-jhs-setting="enableLoadScreenShot"] input').is(":checked")).toBe(false);
        expect(settings.snapshot().enableLoadScreenShot).toBe("no");
    });

    it("dispose removes the binding and no longer updates the destroyed surface", async () => {
        const { jq, settings, registry, dom } = createHarness({ enableLoadScreenShot: "no" });
        vi.stubGlobal("$", jq);
        vi.stubGlobal("document", dom.window.document);
        await settings.load();
        const descriptors = registry.list({ surfaces: [ "quick" ] });
        const quickRoot = jq("#quick").append(buildQuickSettingsHtml(registry));
        const binding = bindSettingRows(quickRoot, descriptors, { settings });
        const input = quickRoot.find('[data-jhs-setting="enableLoadScreenShot"] input');
        binding.dispose();
        await settings.set("enableLoadScreenShot", "yes");
        expect(input.is(":checked")).toBe(false);
    });
});
