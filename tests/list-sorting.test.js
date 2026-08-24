import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadPlugin(url, html) {
    const dom = new JSDOM(html, { url }), $ = jqueryFactory(dom.window);
    let sortMethod = "default";
    const settings = { snapshot: () => ({ sortMethod }), set: vi.fn(async (name, value) => { sortMethod = value; }) };
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, URLSearchParams, $, o: dom.window.location.href, r: true, l: false, c: false, _: "yes",
        localStorage: dom.window.localStorage, storageManager: { getSetting: vi.fn(async () => "yes") }, isHitShowPage: () => false,
        BasePlugin: class { getSelector() { return { boxSelector: ".movie-list", itemSelector: ".movie-list > .item" }; } getRuntimeService() { return settings; } },
        clog: { error: vi.fn() }
    });
    const source = readTestFile(join(import.meta.dirname, "../src/plugins/status/list-page-button.js"), "utf8");
    vm.runInContext(`${source};globalThis.Plugin=ListPageButtonPlugin`, context);
    return { $, plugin: new context.Plugin(), setSortMethod: value => { sortMethod = value; } };
}

describe("FC2 list sorting", () => {
    it("sorts the whole loaded FC2 list by the actual review count", async () => {
        const loaded = loadPlugin("https://javdb.com/advanced_search?type=3&score_min=0&d=1", `<div class="movie-list">
            <div class="item" id="two"><div class="score">1.0分, 由2人评价</div></div>
            <div class="item" id="thirty-two"><div class="score"><span class="value">2.82分, 由32人评价</span></div></div>
            <div class="item" id="five"><div class="score">3.67分, 由5人评价</div></div>
            <div class="item" id="fifty-five"><div class="score">3.50分, 由55人评价</div></div>
        </div>`);
        loaded.setSortMethod("rateCount");

        await loaded.plugin.sortItems();

        expect(loaded.$(".movie-list > .item").map(((index, item) => item.id)).get()).toEqual([ "fifty-five", "thirty-two", "five", "two" ]);
    });

    it("recognizes FC2 advanced search as a live-sort page", () => {
        const loaded = loadPlugin("https://javdb.com/advanced_search?score_min=0&type=3", '<div class="movie-list"></div>');
        expect(loaded.plugin.isFc2ListPage()).toBe(true);
        expect(loaded.plugin.supportsLiveSorting()).toBe(true);
    });
});
