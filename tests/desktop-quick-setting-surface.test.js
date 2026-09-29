import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingPlugin } from "../src/plugins/backup/setting.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createHarness({ searchHidden = false } = {}) {
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

    const plugin = new SettingPlugin({
        runtimeServices: {
            settingsRegistry: registry,
            settings,
            profile: { current: () => "regular" },
            scope: async () => ({ listen() { return () => {}; }, addCleanup() {} }),
            host: { getListSelectors: () => ({ itemSelector: ".movie-list .item" }) },
            movie: {},
            dialog: { open() {} },
        },
        capabilities: {},
        jquery: jq,
        utilities: globalThis.utils,
        notifications: globalThis.show,
        logger: globalThis.clog,
        legacyStorage: globalThis.storageManager,
        events: {},
        document: dom.window.document,
        window: dom.window,
    });
    plugin.openSettingDialog = openSettingDialog;
    plugin._settingScope = { listen() { return () => {}; }, addCleanup() {} };
    plugin._desktopSettingNavMounted = false;
    plugin._desktopNavGeneration = 0;

    return (async () => {
        await settings.load();
        plugin.mountDesktopSettingNav();
        // JSDOM reports every element as :hidden because layout dimensions are 0.
        // Set the surface visibility explicitly so the test exercises the actual
        // root-selection path instead of being coupled to jQuery's visibility probe.
        if (searchHidden) {
            jq(".setting-box").show();
            jq(".mini-setting-box").hide();
        } else {
            jq(".mini-setting-box").show();
            jq(".setting-box").hide();
        }
        return { dom, jq, settings, registry, plugin, openSettingDialog, stored };
    })();
}

describe("desktop quick setting surface root selection", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("binds the visible mini surface when navbar search is visible", async () => {
        const { jq, settings, plugin } = await createHarness();
        expect(plugin.getSelector()).toEqual({ itemSelector: ".movie-list .item" });
        expect(jq(".mini-setting-box").css("display")).not.toBe("none");
        expect(jq(".setting-box").css("display")).toBe("none");

        jq(".mini-setting-box").trigger("mouseover");
        await flush();

        const mini = jq(".mini-setting-box .mini-simple-setting");
        const normal = jq(".setting-box .simple-setting");
        await vi.waitFor(() => expect(mini.data("jhsQuickSettingBinding")).toBeTruthy());
        expect(mini.data("jhsQuickSettingBinding")).toBeTruthy();
        expect(normal.data("jhsQuickSettingBinding")).toBeFalsy();

        await settings.set("enableLoadScreenShot", "yes");
        expect(mini.find('[data-jhs-setting="enableLoadScreenShot"] input').is(":checked")).toBe(true);
    });

    it("binds the normal surface when navbar search is hidden", async () => {
        const { jq, settings } = await createHarness({ searchHidden: true });
        expect(jq(".setting-box").css("display")).not.toBe("none");
        expect(jq(".mini-setting-box").css("display")).toBe("none");

        jq(".setting-box").trigger("mouseover");
        await flush();

        const normal = jq(".setting-box .simple-setting");
        const mini = jq(".mini-setting-box .mini-simple-setting");
        await vi.waitFor(() => expect(normal.data("jhsQuickSettingBinding")).toBeTruthy());
        expect(normal.data("jhsQuickSettingBinding")).toBeTruthy();
        expect(mini.data("jhsQuickSettingBinding")).toBeFalsy();

        await settings.set("enableLoadScreenShot", "yes");
        expect(normal.find('[data-jhs-setting="enableLoadScreenShot"] input').is(":checked")).toBe(true);
    });

    it("drops a pending settings template load when its hover surface closes", async () => {
        const { jq } = await createHarness();
        const host = jq(".mini-setting-box .mini-simple-setting");
        jq(".mini-setting-box").trigger("mouseover");
        jq(".mini-setting-box").trigger("mouseleave");
        await flush();

        expect(host.data("jhsQuickSettingBinding")).toBeFalsy();
        expect(host.children()).toHaveLength(0);
    });
});
