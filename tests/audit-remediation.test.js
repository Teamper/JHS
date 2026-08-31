import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function loadClass(file, className, extras = {}) {
    const source = readTestFile(join(process.cwd(), file), "utf8"), start = source.indexOf(`class ${className}`);
    const context = vm.createContext({ URL, encodeURIComponent, BasePlugin: class {}, i: (target, key, value) => (target[key] = value), l: false, r: false, o: "https://javdb.com/", ...extras });
    vm.runInContext(`${source.slice(start)};globalThis.Exported=${className}`, context);
    return { Class: context.Exported, context };
}

describe("6.2.0 audit remediation", () => {
    it("disables AutoPage before creating DOM or listeners", async () => {
        const querySelector = vi.fn(), addEventListener = vi.fn(), { Class } = loadClass("src/plugins/status/auto-page.js", "AutoPagePlugin", {
            window: { isListPage: true, location: { href: "https://javdb.com/" }, addEventListener }, document: { querySelector },
            storageManager: { getSetting: vi.fn().mockResolvedValue("no") }, _: "yes", C: "no", clog: { error: vi.fn() }
        });
        const plugin = new Class();
        await plugin.waterfall();
        expect(querySelector).not.toHaveBeenCalled();
        expect(addEventListener).not.toHaveBeenCalled();
        expect(plugin.loader).toBeUndefined();
    });

    it("owns AutoPage global listeners and startup timer in its live scope", async () => {
        const dom = new JSDOM('<div id="list"></div><a class="next" href="/page/2"></a>', { url: "https://javdb.com/" });
        const add = vi.spyOn(dom.window, "addEventListener"), remove = vi.spyOn(dom.window, "removeEventListener");
        const { Class } = loadClass("src/plugins/status/auto-page.js", "AutoPagePlugin", {
            window: dom.window, document: dom.window.document, requestAnimationFrame: callback => callback(), setTimeout: vi.fn(() => 1),
            storageManager: { getSetting: vi.fn().mockResolvedValue("yes") }, _: "yes", C: "no", clog: { error: vi.fn() },
            LifecycleScope,
        });
        const plugin = new Class();
        plugin.shouldDisablePaging = vi.fn().mockResolvedValue(false);
        plugin.getSelector = () => ({ boxSelector: "#list", nextPageSelector: ".next" });
        plugin.getRuntimeService = name => "settings" === name ? { snapshot: () => ({ autoPage: "yes" }) } : "scope" === name ? async () => ({ addCleanup: () => {} }) : "features" === name ? { getFeatureApi: async () => ({ getListSelectors: () => ({ boxSelector: "#list", nextPageSelector: ".next" }) }) } : {};
        plugin.checkLoad = vi.fn();
        await plugin.start();
        const live = plugin.liveScope;
        expect(live.snapshot().listeners).toBe(1);
        expect(add).toHaveBeenCalledWith("scroll", expect.any(Function), undefined);
        plugin.stop();
        expect(live.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), undefined);
    });

    it("binds OtherSite settings idempotently and recovers malformed storage", () => {
        const dom = new JSDOM('<button id="settingSiteBtn"></button><div id="settingsArea" class="jhs-is-hidden"><input type="checkbox" data-site-id="javDbBtn"></div>'), $ = jqueryFactory(dom.window), warn = vi.fn();
        const storage = new Map([["jhs_enabled_sites", "broken-json"]]);
        const storageService = { getLocal: key => storage.get(key) ?? null, setLocal: (key, value) => storage.set(key, value) };
        const { Class } = loadClass("src/plugins/external-search/other-site.js", "OtherSitePlugin", {
            window: dom.window, document: dom.window.document, $, clog: { warn }, normalizeCarNum: value => value
        });
        const plugin = new Class();
        plugin.getRuntimeService = name => "storage" === name ? storageService : {};
        expect(Array.from(plugin.getEnabledSites())).toEqual(Array.from(plugin.siteConfigs, site => site.id));
        expect(warn).toHaveBeenCalledOnce();
        plugin.saveEnabledSites(["javDbBtn"]);
        expect(storage.get("jhs_enabled_sites")).toBe('["javDbBtn"]');
        plugin.setupEventListeners(); plugin.setupEventListeners();
        $("#settingSiteBtn").trigger("click");
        expect($("#settingsArea").hasClass("jhs-is-hidden")).toBe(false);
    });

    it("loads external-site definitions through MovieIdentityService", async () => {
        const { Class } = loadClass("src/plugins/external-search/other-site.js", "OtherSitePlugin", { normalizeCarNum: value => value });
        const plugin = new Class();
        plugin.getSettingCache = vi.fn(async () => ({ javBusUrl: "configured" }));
        const externalSites = vi.fn(() => [{ id: "javBusBtn", baseUrl: "normalized" }]);
        plugin.getRuntimeService = () => ({ externalSites });
        await expect(plugin.getSiteConfigs()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "javBusBtn", baseUrl: "normalized" })]));
        expect(externalSites).toHaveBeenCalledWith({ javBusUrl: "configured" });
    });

    it("builds the DMM external link without shadowing its site config", async () => {
        const dom = new JSDOM('<a data-jhs-site-id="fanzaBtn"></a>'), $ = jqueryFactory(dom.window);
        const { Class } = loadClass("src/plugins/external-search/other-site.js", "OtherSitePlugin", {
            window: dom.window, document: dom.window.document, $, normalizeCarNum: value => value
        });
        const plugin = new Class(), searchUrl = vi.fn(() => "https://www.dmm.co.jp/search/ABC-1");
        plugin.getRuntimeService = name => "movie" === name ? { searchUrl } : { getLocal: () => null };
        await expect(plugin.handleSite("ABC-1", { id: "fanzaBtn", providerId: "dmm", noHandle: true }, { root: $(dom.window.document), configs: [], isActive: () => true })).resolves.toBeUndefined();
        expect(searchUrl).toHaveBeenCalledWith("dmm", { carNum: "ABC-1" });
        expect($("[data-jhs-site-id='fanzaBtn']").attr("href")).toBe("https://www.dmm.co.jp/search/ABC-1");
    });

    it("keeps all JHS UI layout decisions on mobileMode", () => {
        const setting = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8"), search = readTestFile(join(process.cwd(), "src/features/identity/identity-image-search-controller.js"), "utf8"), mobile = readTestFile(join(process.cwd(), "src/plugins/status/mobile-bottom-bar.js"), "utf8");
        expect(setting).not.toContain("utils.isMobile()");
        expect(search).not.toContain("utils.isMobile()");
        expect(search).toContain("isMobileMode");
        expect(mobile).not.toContain("@media (min-width: 769px)");
    });
});
