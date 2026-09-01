import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadListButtonPlugin() {
    const dom = new JSDOM('<div class="movie-list"></div>'), $ = jqueryFactory(dom.window), storageManager = { getSetting: vi.fn(async () => 5) }, show = { info: vi.fn() };
    const listFeature = { getListSelectors: () => ({ itemSelector: ".movie-list .item" }) };
    class BasePlugin {
        getSelector() { return { itemSelector: ".movie-list .item" }; }
        getRuntimeService(name) { return "features" === name ? { getFeatureApi: async () => listFeature } : {}; }
    }
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, BasePlugin, storageManager, show, console,
        normalizeStateFlags: flags => Object.fromEntries([ "favorite", "downloaded", "watched", "blocked" ].map((key => [ key, !0 === flags?.[key] ]))),
        hasAnyState: flags => [ "favorite", "downloaded", "watched", "blocked" ].some((key => !0 === flags?.[key])),
        isHardHidden: (flags, reasons = {}) => Boolean(flags.blocked || reasons.keyword || reasons.actorBlacklist || reasons.actressBlacklist)
    });
    vm.runInContext(`${readTestFile(join(process.cwd(), "src/features/list/list-actions-controller.js"), "utf8")};globalThis.Plugin=ListPageButtonPlugin`, context);
    return { dom, $, plugin: new context.Plugin({ settings: { snapshot: () => ({}) }, hostAdapter: { site: "javdb", location: dom.window.location }, features: { getFeatureApi: async () => listFeature }, document: dom.window.document, window: dom.window, ui: { getJQuery: () => $, getShow: () => show, show, getClog: () => ({ error: vi.fn(), warn: vi.fn() }) }, storage: storageManager }), storageManager, show, listFeature };
}

describe("start identification workflow", () => {
    it("scans the full page and ignores hidden, stateful, and hard-hidden cards", async () => {
        const { dom, $, plugin, listFeature } = loadListButtonPlugin(), openMovieDetail = vi.fn(async () => {});
        dom.window.document.querySelector(".movie-list").innerHTML = `
            <div id="pending" class="item" style="display:none" data-jhs-flags='{}' data-jhs-visibility='{}'></div>
            <div class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{}'></div>
            <div class="item" data-jhs-flags='{}' data-jhs-visibility='{"keyword":true}'></div>
            <div class="item" data-jhs-flags='{}' data-jhs-visibility='{"actorBlacklist":true}'></div>`;
        listFeature.openMovieDetail = openMovieDetail;
        await plugin.openWaitCheck();
        expect(openMovieDetail).toHaveBeenCalledOnce();
        expect(openMovieDetail.mock.calls[0][0][0]).toBe($("#pending")[0]);
    });
});
