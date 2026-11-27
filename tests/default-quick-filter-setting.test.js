import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { SettingPlugin } from "../src/features/settings/settings-controller.js";
import { buildSettingDialogHtml } from "../src/ui/settings/setting-templates.js";
import { normalizeQuickFilterKey } from "../src/core/list-filters.js";

const harnesses = [];

async function createHarness(initial = {}) {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" });
    const jq = jqueryFactory(dom.window);
    vi.stubGlobal("$", jq);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("storageManager", {});
    const stored = { setting: { ...initial } };
    const registry = new SettingsRegistry();
    registerDefaultSettings(registry);
    const storage = { get: async key => stored[key], set: async (key, value) => { stored[key] = value; } };
    const settings = new SettingsService(storage);
    await settings.load();
    const runtimeServices = {
        settingsRegistry: registry, settings,
        host: { locateListRoot: () => null, getListLayoutContainer: () => null },
    };
    const plugin = new SettingPlugin({ runtimeServices, capabilities: {}, jquery: jq, utilities: { isMobileMode: () => false }, document: dom.window.document, window: dom.window });
    const root = jq(buildSettingDialogHtml("browse-panel", [], registry)).appendTo(jq("body"));
    const binding = plugin.hydrateLiveSettings(root);
    const harness = { dom, root, binding, registry, settings, storage, stored };
    harnesses.push(harness);
    return harness;
}

describe("default quick-filter setting", () => {
    afterEach(() => {
        for (const { dom, binding } of harnesses.splice(0)) {
            binding.dispose();
            dom.window.close();
        }
        vi.unstubAllGlobals();
    });

    it("renders every quick filter in the dialog and registry without changing the default", async () => {
        const { root, registry } = await createHarness();
        const select = root.find("#defaultQuickFilterTab");
        const options = select.find("option").map((_, option) => ({ value: option.value, label: option.textContent })).get();
        expect(options.map(({ value }) => value)).toEqual([
            "all", "waitCheck", "favorite", "hasDown", "hasWatch", "blockedItems", "undownloaded",
            "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d", "favoriteActress", "rated",
        ]);
        expect(registry.get("defaultQuickFilterTab").options).toEqual(options);
        expect(select.find('option[value="undownloaded"]').text()).toBe("全部未下载");
        expect(select.find('option[value="blockedItems"]').text()).toBe("屏蔽项");
        expect(select.val()).toBe("waitCheck");
    });

    it.each(["blockedItems", "undownloaded", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d", "favoriteActress", "rated"])(
        "persists and reloads %s through the original settings binding", async value => {
            const { root, binding, stored, storage } = await createHarness({ defaultQuickFilterTab: "waitCheck" });
            root.find("#defaultQuickFilterTab").val(value).trigger("change");
            await binding.flush();
            expect(stored.setting.defaultQuickFilterTab).toBe(value);
            const reloaded = new SettingsService(storage);
            await reloaded.load();
            expect(normalizeQuickFilterKey(reloaded.snapshot().defaultQuickFilterTab)).toBe(value);
            binding.sync(reloaded.snapshot());
            expect(root.find("#defaultQuickFilterTab").val()).toBe(value);
        }
    );

    it.each(["blockedItems", "filter"])("preserves the effective blocked default %s without writing during hydration", async value => {
        const { root, stored } = await createHarness({ defaultQuickFilterTab: value });
        expect(root.find("#defaultQuickFilterTab").val()).toBe("blockedItems");
        expect(root.find("#defaultQuickFilterTab").val()).toBe(normalizeQuickFilterKey(stored.setting.defaultQuickFilterTab));
        expect(stored.setting.defaultQuickFilterTab).toBe(value);
    });
});
