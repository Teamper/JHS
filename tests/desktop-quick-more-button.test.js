import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingPlugin } from "../src/plugins/backup/setting.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

const DESKTOP_DEPENDENCIES = [
    "OtherSitePlugin",
    "ScreenShotPlugin",
    "NewVideoPlugin",
    "BlacklistPlugin",
    "BusImgPlugin",
];

function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createHarness({ useMini = true } = {}) {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="main-nav">
            <div id="navbar-menu-user"><div class="navbar-end"></div></div>
            <div class="miniHistoryBtnBox"><span id="miniHistoryBtn">history</span></div>
        </div>
        <div class="navbar-search"></div>
    </body></html>`, { url: "https://javdb.com/" });
    const jq = jqueryFactory(dom.window);
    const stored = { setting: {} };
    const settings = new SettingsService({
        get: async (key) => stored[key],
        set: async (key, value) => { stored[key] = value; },
    });
    const registry = new SettingsRegistry();
    registerDefaultSettings(registry);
    const openSettingDialog = vi.fn(async () => {});

    vi.stubGlobal("$", jq);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("Element", dom.window.Element);
    vi.stubGlobal("storageManager", {
        getSetting: async () => ({}),
        getReviewFilterKeywordList: async () => [],
        getTitleFilterKeyword: async () => [],
    });
    vi.stubGlobal("utils", {
        loopDetector(condition, callback) { if (condition()) callback(); },
        isMobileMode: () => false,
        getDialogArea: () => ["720px", "700px"],
        lowZIndex() {},
    });
    vi.stubGlobal("clog", { log() {}, warn() {}, error() {}, debug() {}, lowZIndex() {} });
    vi.stubGlobal("show", { error() {}, info() {} });
    vi.stubGlobal("isDetailPage", false);
    dom.window.isListPage = true;

    initializeRuntimeConstants(dom.window.location);

    const plugin = new SettingPlugin();
    plugin.runtimeServices = {
        settingsRegistry: registry,
        settings,
        profile: { current: () => "regular" },
        scope: async () => ({ listen() { return () => {}; }, addCleanup() {} }),
        host: {},
        movie: {},
        dialog: { open() {} },
    };
    plugin.declaredDependencies = new Set(DESKTOP_DEPENDENCIES);
    plugin.pluginManager = { resolveDeclaredPlugin: () => null };
    plugin.getFormDependencies = () => ({ settingsRegistry: registry, settings });
    plugin.openSettingDialog = openSettingDialog;
    plugin._settingScope = { listen() { return () => {}; }, addCleanup() {} };
    plugin._desktopSettingNavMounted = false;
    plugin._desktopNavGeneration = 0;

    return (async () => {
        await settings.load();
        plugin.mountDesktopSettingNav();
        // JSDOM cannot report real visibility; set the active surface explicitly.
        if (useMini) {
            jq(".mini-setting-box").show();
            jq(".setting-box").hide();
        } else {
            jq(".setting-box").show();
            jq(".mini-setting-box").hide();
        }
        return { dom, jq, settings, registry, plugin, openSettingDialog, stored };
    })();
}

describe("desktop quick setting full-settings button", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("opens full settings from the visible mini quick host and only clears that host", async () => {
        const { jq, plugin, openSettingDialog } = await createHarness({ useMini: true });
        jq(".mini-setting-box").trigger("mouseover");
        await flush();

        const mini = jq(".mini-setting-box .mini-simple-setting");
        const normal = jq(".setting-box .simple-setting");
        expect(mini.data("jhsQuickSettingBinding")).toBeTruthy();
        expect(normal.data("jhsQuickSettingBinding")).toBeFalsy();

        mini.find("#moreBtn").trigger("click");
        await flush();

        expect(openSettingDialog).toHaveBeenCalledTimes(1);
        expect(openSettingDialog).toHaveBeenCalledWith("base-panel");
        expect(mini.data("jhsQuickSettingBinding")).toBeFalsy();
        expect(mini.css("display")).toBe("none");
        expect(normal.data("jhsQuickSettingBinding")).toBeFalsy();
    });

    it("opens full settings from the visible normal quick host and only clears that host", async () => {
        const { jq, plugin, openSettingDialog } = await createHarness({ useMini: false });
        jq(".setting-box").trigger("mouseover");
        await flush();

        const normal = jq(".setting-box .simple-setting");
        const mini = jq(".mini-setting-box .mini-simple-setting");
        expect(normal.data("jhsQuickSettingBinding")).toBeTruthy();
        expect(mini.data("jhsQuickSettingBinding")).toBeFalsy();

        normal.find("#moreBtn").trigger("click");
        await flush();

        expect(openSettingDialog).toHaveBeenCalledTimes(1);
        expect(openSettingDialog).toHaveBeenCalledWith("base-panel");
        expect(normal.data("jhsQuickSettingBinding")).toBeFalsy();
        expect(normal.css("display")).toBe("none");
        expect(mini.data("jhsQuickSettingBinding")).toBeFalsy();
    });
});
