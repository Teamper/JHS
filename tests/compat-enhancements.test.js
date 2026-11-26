import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { migrateDisabledPlugins } from "../src/core/legacy-plugin-contributions.js";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";

function createController(site) {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "https://javdb.com/" });
    dom.window.requestIdleCallback = vi.fn(() => 7);
    dom.window.cancelIdleCallback = vi.fn();
    const style = { register: vi.fn(() => vi.fn()) };
    const controller = new CompatibilityController({
        document: dom.window.document, window: dom.window, location: dom.window.location,
        site, route: "list", host: {}, style,
        state: { getFavoriteActressList: async () => [], getBlacklist: async () => [] },
        notifications: {}, ui: {}, scope: new LifecycleScope(`compat-${site}`), diagnostics: {},
    });
    return { dom, controller, style, scope: controller.scope };
}

describe("compatibility enhancement Feature", () => {
    it("registers the confirmed ad-container rule only on JavDB and cleans idle work up", () => {
        const javdb = createController("javdb");
        javdb.controller.start();
        expect(javdb.style.register).toHaveBeenCalledWith("feature-compatibility-ad-container", ".sda-content { display:none!important; } .select:has(> .jhs-select-control)::after { display:none!important; content:none!important; }");
        expect(javdb.dom.window.requestIdleCallback).toHaveBeenCalledOnce();
        javdb.scope.dispose();
        expect(javdb.dom.window.cancelIdleCallback).toHaveBeenCalledWith(7);
        expect(javdb.style.register.mock.results[0].value).toHaveBeenCalledOnce();

        const javbus = createController("javbus");
        javbus.controller.start();
        expect(javbus.style.register).not.toHaveBeenCalled();
        javbus.scope.dispose();
    });

    it("retains the 6.5.1 disable ID mapping after removing its legacy executor", () => {
        expect(migrateDisabledPlugins(["CompatibilityEnhancementsPlugin", "unknown-setting"])).toEqual(["compatibility.enhancements", "unknown-setting"]);
    });
});
