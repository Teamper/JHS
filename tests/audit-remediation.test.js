import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { AutoPageController } from "../src/features/list/auto-page-controller.js";
import { OtherSitesController } from "../src/features/external-sites/other-sites-controller.js";

function loadClass(file, className, extras = {}) {
    const source = readTestFile(join(process.cwd(), file), "utf8"), start = source.indexOf(`class ${className}`);
    const context = vm.createContext({ URL, encodeURIComponent, BasePlugin: class {}, i: (target, key, value) => (target[key] = value), l: false, r: false, o: "https://javdb.com/", ...extras });
    vm.runInContext(`${source.slice(start)};globalThis.Exported=${className}`, context);
    return { Class: context.Exported, context };
}

describe("6.2.0 audit remediation", () => {
    it("disables AutoPage before creating DOM or listeners", async () => {
        const dom = new JSDOM('<div id="list"></div>', { url: "https://javdb.com/" });
        const jquery = jqueryFactory(dom.window);
        const settings = { snapshot: () => ({ autoPage: "no" }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const hostAdapter = { site: "javdb", document: dom.window.document, location: dom.window.location, getListSelectors: vi.fn(() => ({ boxSelector: "#list", itemSelector: "#list .item", nextPageSelector: ".next" })) };
        const scope = new LifecycleScope("audit-auto-page-off");
        const controller = new AutoPageController({ hostAdapter, settings, http: {}, list: null, ui: { jquery }, eventBus: { on: () => () => {} }, scope, document: dom.window.document, window: dom.window, logger: { error: vi.fn() } });
        const querySelector = vi.spyOn(dom.window.document, "querySelector"), addEventListener = vi.spyOn(dom.window, "addEventListener");
        await controller.mount();
        expect(querySelector).not.toHaveBeenCalled();
        expect(addEventListener).not.toHaveBeenCalled();
        expect(controller.loader).toBeUndefined();
        scope.dispose();
        dom.window.close();
    });

    it("owns AutoPage global listeners and startup timer in its live scope", async () => {
        const dom = new JSDOM('<div id="list"></div><a class="next" href="/page/2"></a>', { url: "https://javdb.com/", pretendToBeVisual: true });
        const add = vi.spyOn(dom.window, "addEventListener"), remove = vi.spyOn(dom.window, "removeEventListener");
        const timeout = vi.fn(() => 11), clearTimeoutSpy = vi.fn();
        vi.stubGlobal("setTimeout", timeout);
        vi.stubGlobal("clearTimeout", clearTimeoutSpy);
        const settings = { snapshot: () => ({ autoPage: "yes" }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const hostAdapter = {
            site: "javdb", document: dom.window.document, location: dom.window.location,
            getListSelectors: () => ({ boxSelector: "#list", itemSelector: "#list .item", coverImgSelector: ".cover img", requestDomItemSelector: "#list .item", nextPageSelector: ".next" }),
        };
        const scope = new LifecycleScope("audit-auto-page-live");
        const controller = new AutoPageController({
            hostAdapter, settings, http: {}, list: null, ui: { jquery: jqueryFactory(dom.window) },
            eventBus: { on: () => () => {} }, scope, document: dom.window.document, window: dom.window,
            logger: { error: vi.fn() },
        });
        controller.shouldDisablePaging = vi.fn().mockResolvedValue(false);
        await controller.mount();
        const live = controller.liveScope;
        expect(live.snapshot().listeners).toBe(1);
        expect(add).toHaveBeenCalledWith("scroll", expect.any(Function), undefined);
        expect(timeout).toHaveBeenCalledWith(expect.any(Function), 1000);
        controller.stop();
        expect(live.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), undefined);
        expect(clearTimeoutSpy).toHaveBeenCalledWith(11);
        scope.dispose();
        vi.unstubAllGlobals();
        dom.window.close();
    });

    it("binds OtherSite settings idempotently and recovers malformed storage", () => {
        const dom = new JSDOM('<button id="settingSiteBtn"></button><div id="settingsArea" class="jhs-is-hidden"><input type="checkbox" data-site-id="javDbBtn"></div>'), $ = jqueryFactory(dom.window), warn = vi.fn();
        const storage = new Map([["jhs_enabled_sites", "broken-json"]]);
        const storageService = { getLocal: key => storage.get(key) ?? null, setLocal: (key, value) => storage.set(key, value) };
        const scope = new LifecycleScope("other-sites-settings"), controller = new OtherSitesController({
            window: dom.window, document: dom.window.document, jquery: $, hostAdapter: {}, movie: {}, storage: storageService,
            settings: { snapshot: () => ({}) }, events: {}, scope, ui: { isHidden: () => false, openPage: vi.fn() },
            notifications: { debug: warn }, site: "javdb", route: "detail",
        });
        expect(Array.from(controller.getEnabledSites())).toEqual(Array.from(controller.siteConfigs, site => site.id));
        expect(warn).toHaveBeenCalledOnce();
        controller.saveEnabledSites(["javDbBtn"]);
        expect(storage.get("jhs_enabled_sites")).toBe('["javDbBtn"]');
        controller.setupEventListeners(); controller.setupEventListeners();
        $("#settingSiteBtn").trigger("click");
        expect($("#settingsArea").hasClass("jhs-is-hidden")).toBe(false);
        scope.dispose();
        dom.window.close();
    });

    it("loads external-site definitions through MovieIdentityService", async () => {
        const dom = new JSDOM("", { url: "https://javdb.com/v/ABC-1" }), scope = new LifecycleScope("other-sites-definitions");
        const settings = { javBusUrl: "configured" };
        const externalSites = vi.fn(() => [{ id: "javBusBtn", baseUrl: "normalized" }]);
        const controller = new OtherSitesController({
            window: dom.window, document: dom.window.document, jquery: jqueryFactory(dom.window), hostAdapter: {}, movie: { externalSites }, storage: {},
            settings: { snapshot: () => settings }, events: {}, scope, ui: { isHidden: () => false, openPage: vi.fn() },
            notifications: { debug: vi.fn() }, site: "javdb", route: "detail",
        });
        await expect(controller.getSiteConfigs()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "javBusBtn", baseUrl: "normalized" })]));
        expect(externalSites).toHaveBeenCalledWith({ javBusUrl: "configured" });
        scope.dispose();
        dom.window.close();
    });

    it("builds the DMM external link without shadowing its site config", async () => {
        const dom = new JSDOM('<a data-jhs-site-id="fanzaBtn"></a>'), $ = jqueryFactory(dom.window);
        const scope = new LifecycleScope("other-sites-dmm-link"), searchUrl = vi.fn(() => "https://www.dmm.co.jp/search/ABC-1");
        const controller = new OtherSitesController({
            window: dom.window, document: dom.window.document, jquery: $, hostAdapter: {}, movie: { searchUrl },
            storage: { getLocal: () => null, setLocal: vi.fn() }, settings: { snapshot: () => ({}) }, events: {}, scope,
            ui: { isHidden: () => false, openPage: vi.fn() }, notifications: { debug: vi.fn() }, site: "javdb", route: "detail",
        });
        await expect(controller.handleSite("ABC-1", { id: "fanzaBtn", providerId: "dmm", noHandle: true }, { root: $(dom.window.document), configs: [], isActive: () => true })).resolves.toBeUndefined();
        expect(searchUrl).toHaveBeenCalledWith("dmm", { carNum: "ABC-1" });
        expect($("[data-jhs-site-id='fanzaBtn']").attr("href")).toBe("https://www.dmm.co.jp/search/ABC-1");
        scope.dispose();
        dom.window.close();
    });

    it("keeps all JHS UI layout decisions on mobileMode", () => {
        const setting = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8"), search = readTestFile(join(process.cwd(), "src/features/identity/image-search-controller.js"), "utf8"), mobile = readTestFile(join(process.cwd(), "src/features/system/responsive-shell-controller.js"), "utf8");
        expect(setting).not.toContain("utils.isMobile()");
        expect(search).not.toContain("utils.isMobile()");
        expect(search).toContain("this.settings.snapshot().mobileMode");
        expect(mobile).not.toContain("@media (min-width: 769px)");
    });
});
