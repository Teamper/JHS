// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { SettingPlugin } from "../src/plugins/backup/setting.js";
import { MANUAL_FORM_SELECTORS, loadSettingForm, saveSettingForm } from "../src/plugins/backup/setting-forms.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { Utils } from "../src/core/utils.js";
import * as templates from "../src/plugins/backup/setting-templates.js";

import { FullSettingsSession } from "../src/ui/settings/full-settings-session.js";
const $ = jquery;
let bindings = [];
beforeEach(() => { vi.stubGlobal("$", $); initializeRuntimeConstants(new URL("https://javdb.com/")); });
afterEach(() => { for (const binding of bindings) binding?.dispose(); bindings = []; document.body.innerHTML = ""; vi.unstubAllGlobals(); });

async function fixture(initial = {}) {
    const stored = { setting: { autoPage: "no", themeMode: "light", reviewCount: "20", ...initial } };
    const settings = new SettingsService({ get: async (key) => stored[key], set: async (key, value) => { stored[key] = value; } });
    await settings.load();
    const registry = new SettingsRegistry(); registerDefaultSettings(registry);
    const legacyStorage = { getReviewFilterKeywordList: async () => [], getTitleFilterKeyword: async () => [], saveReviewFilterKeyword: vi.fn(), saveTitleFilterKeyword: vi.fn() };
    vi.stubGlobal("storageManager", legacyStorage);
    const webdav = { getProfile: async () => ({ url: "", username: "", password: "" }), saveProfile: vi.fn(async () => {}) };
    const notifications = { ok: vi.fn(), info: vi.fn(), error: vi.fn() };
    const utilities = { isMobileMode: () => false, q: vi.fn() };
    const plugin = new SettingPlugin({
        runtimeServices: { settings, settingsRegistry: registry, host: {}, movie: { externalSiteOrigin: () => "https://example.test", providerOrigin: () => "https://example.test" }, webdav, diagnostics: {}, storage: {}, translation: {} },
        capabilities: {}, jquery: $, utilities, notifications, logger: { error: vi.fn() }, legacyStorage, events: { emit: vi.fn() }, domUi: {}, document, window,
    });
    plugin._settingTemplates = templates;
    plugin._settingPanels = { renderSnapshotPanel: vi.fn(), renderDataHealthPanel: vi.fn(), renderPluginMgmtPanel: vi.fn(), renderNetworkPanel: vi.fn() };
    document.body.innerHTML = templates.buildSettingDialogHtml(undefined, [], registry);
    const root = $(document.body);
    templates.injectHealthPanel($, root); templates.injectPluginMgmtPanel($, root); templates.injectSnapshotPanel($, root); templates.injectNetworkPanel($, root); templates.injectResourceSourcesPanel($, root);
    const session = new FullSettingsSession(settings);
    plugin._settingsDialog = { session, root, scope: { disposed: false } };
    root.data("jhsFullSettingsSession", session);
    bindings.push({ dispose: () => session.dispose() });
    const binding = plugin.hydrateLiveSettings(root); bindings.push(binding);
    await loadSettingForm(plugin.getFormDependencies(), root);
    plugin.bindClick(root);
    root.find("#saveBtn").attr("data-jhs-settings-ready", "true").prop("disabled", false);
    return { plugin, root, binding, settings, stored, notifications, webdav };
}

describe("settings business navigation", () => {
    it("provides eight categories, one save footer and every existing manual control once", async () => {
        const { root } = await fixture();
        expect(root.find(".side-menu-item").toArray().map((node) => node.textContent)).toEqual(["外观与布局", "列表与详情", "筛选与屏蔽", "任务与新作品", "资源与站点", "云盘与离线", "备份与数据", "高级与诊断"]);
        expect(root.find(".content-panel.active").attr("id")).toBe("appearance-panel");
        expect(root.find("#saveBtn")).toHaveLength(1);
        expect(root.find(".jhs-setting-footer")).toHaveLength(1);
        for (const selector of Object.values(MANUAL_FORM_SELECTORS)) expect(root.find(selector), selector).toHaveLength(1);
        const ids = root.find("[id]").toArray().map((node) => node.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(root.find(".setting-label")).toHaveLength(0);
    });

    it("routes all thirteen old panel names to their preserved section", () => {
        const mapping = { "base-panel": "appearance-panel", "filter-panel": "filtering-panel", "task-panel": "tasks-panel", "domain-panel": "resources-panel", "resource-sources-panel": "resources-panel", "cloud-services-panel": "cloud-panel", "backup-panel": "data-panel", "snapshot-panel": "data-panel", "data-tools-panel": "data-panel", "network-panel": "advanced-panel", "cache-panel": "advanced-panel", "health-panel": "advanced-panel", "plugin-mgmt-panel": "advanced-panel" };
        for (const [section, group] of Object.entries(mapping)) expect(templates.resolveSettingPanel(section)).toEqual({ group, section });
        expect(templates.resolveSettingPanel("unknown")).toEqual({ group: "appearance-panel", section: null });
    });

    it("retains control identity and manual drafts across categories while live controls persist", async () => {
        const { plugin, root, binding, stored, webdav } = await fixture();
        const count = root.find("#reviewCount")[0];
        root.find("#reviewCount").val("40").trigger("change");
        plugin.activateSettingPanel(root, "task-panel");
        root.find("#checkConcurrencyCount").val("3").trigger("change");
        root.find('[data-jhs-setting="autoPage"] input').prop("checked", true).trigger("change");
        await binding.flush({ throwOnFailure: true });
        plugin.activateSettingPanel(root, "base-panel");
        expect(root.find("#reviewCount")[0]).toBe(count);
        expect(root.find("#reviewCount").val()).toBe("40");
        expect(stored.setting.reviewCount).toBe("20");
        expect(stored.setting.autoPage).toBe("no");
        await saveSettingForm(plugin.getFormDependencies(), root);
        expect(stored.setting).toMatchObject({ reviewCount: "40", checkConcurrencyCount: "3", autoPage: "yes" });
        expect(webdav.saveProfile).not.toHaveBeenCalled();
    });

    it("uses the same category navigation on compact screens and keeps network edits savable", async () => {
        const { plugin, root } = await fixture();
        plugin.utils.isMobileMode = () => true;
        root.find('[data-panel="advanced-panel"]').trigger("click");
        expect(root.find("#saveBtn").css("display")).not.toBe("none");
        root.find("#circuitBreakerCooldownSec").val("120").trigger("change");
        root.find('[data-panel="appearance-panel"]').trigger("click");
        root.find('[data-panel="advanced-panel"]').trigger("click");
        expect(root.find("#circuitBreakerCooldownSec").val()).toBe("120");
        expect(root.find("#more-tools-panel")).toHaveLength(0);
    });

    it("groups the four card controls without changing their setting keys", async () => {
        const { root } = await fixture();
        const keys = root.find('[data-jhs-setting-section="card-buttons"] [data-jhs-setting]').toArray().map((node) => node.dataset.jhsSetting);
        expect(keys).toEqual(["enableVideoSvg", "enableHandleSvg", "enableSiteSvg", "enableCopySvg"]);
    });

    it("keeps a committed save successful when its completion toast throws", async () => {
        const { plugin, root, stored, notifications } = await fixture();
        const error = new Error("toast unavailable");
        plugin.logger.warn = vi.fn();
        notifications.ok.mockImplementation(() => { throw error; });
        root.find("#reviewCount").val("40").trigger("change");
        root.find("#saveBtn").trigger("click");
        await vi.waitFor(() => expect(root.find("#saveBtn").attr("aria-busy")).toBeUndefined());
        expect(stored.setting.reviewCount).toBe("40");
        expect(notifications.error).not.toHaveBeenCalled();
        expect(plugin.logger.warn).toHaveBeenCalledWith("设置已保存，完成提示显示失败", error);
    });

    it("reveals the active category without stealing ongoing keyboard focus", async () => {
        const { plugin, root } = await fixture();
        const nav = root.find('[data-panel="cloud-panel"]')[0];
        nav.scrollIntoView = vi.fn();
        const firstNav = root.find(".side-menu-item")[0];
        firstNav.focus();
        plugin.activateSettingPanel(root, "cloud-services-panel");
        expect(nav.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
        expect(document.activeElement).toBe(firstNav);
        expect(nav.getAttribute("aria-current")).toBe("page");
    });

    it("focuses the initial active category directly and preserves the original focus-trap fallback", async () => {
        const { root } = await fixture();
        const container = root.find(".jhs-setting-layout")[0], navs = root.find(".side-menu-item");
        for (const element of navs) Object.defineProperty(element, "offsetParent", { configurable: true, get: () => container });
        const firstFocus = vi.spyOn(navs[0], "focus");
        const activeNav = navs[5];
        let cleanup = Utils.prototype.trapFocus(container, activeNav);
        await Promise.resolve();
        expect(document.activeElement).toBe(activeNav);
        expect(firstFocus).not.toHaveBeenCalled();
        cleanup();
        cleanup = Utils.prototype.trapFocus(container);
        await Promise.resolve();
        expect(document.activeElement).toBe(navs[0]);
        cleanup();
    });
});
