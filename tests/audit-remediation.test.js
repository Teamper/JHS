import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadClass(file, className, extras = {}) {
    const source = readFileSync(join(process.cwd(), file), "utf8"), start = source.indexOf(`class ${className}`);
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

    it("binds OtherSite settings idempotently and recovers malformed storage", () => {
        const dom = new JSDOM('<button id="settingSiteBtn"></button><div id="settingsArea" class="jhs-is-hidden"><input type="checkbox" data-site-id="javDbBtn"></div>'), $ = jqueryFactory(dom.window), warn = vi.fn();
        const storage = new Map([["jhs_enabled_sites", "broken-json"]]);
        const { Class } = loadClass("src/plugins/external-search/other-site.js", "OtherSitePlugin", {
            window: dom.window, document: dom.window.document, $, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, clog: { warn }, normalizeCarNum: value => value
        });
        const plugin = new Class();
        expect(Array.from(plugin.getEnabledSites())).toEqual(Array.from(plugin.siteConfigs, site => site.id));
        expect(warn).toHaveBeenCalledOnce();
        plugin.setupEventListeners(); plugin.setupEventListeners();
        $("#settingSiteBtn").trigger("click");
        expect($("#settingsArea").hasClass("jhs-is-hidden")).toBe(false);
    });

    it("keeps all JHS UI layout decisions on mobileMode", () => {
        const setting = readFileSync(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8"), search = readFileSync(join(process.cwd(), "src/plugins/avatar/search-by-image.js"), "utf8"), mobile = readFileSync(join(process.cwd(), "src/plugins/status/mobile-bottom-bar.js"), "utf8");
        expect(setting).not.toContain("utils.isMobile()");
        expect(search).not.toContain("utils.isMobile()");
        expect(search).toContain("utils.isMobileMode()");
        expect(mobile).not.toContain("@media (min-width: 769px)");
    });
});
