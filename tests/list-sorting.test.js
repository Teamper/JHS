import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { classifyJavDbPage } from "../src/core/site-context.js";
import { ListActionsController } from "../src/features/list/list-actions-controller.js";
import { ListSortController } from "../src/features/list/list-sort-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function loadPlugin(url, html, { isHitShowPage = false } = {}) {
    const dom = new JSDOM(html, { url }), $ = jqueryFactory(dom.window);
    let sortMethod = "default";
    const settings = { snapshot: () => ({ sortMethod }), set: vi.fn(async (name, value) => { sortMethod = value; }) };
    const location = dom.window.location;
    const hostAdapter = {
        site: "javdb", location, detectRoute: () => "list",
        getPageContext: () => classifyJavDbPage(location),
        getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list > .item" }),
    };
    const sortController = new ListSortController({
        hostAdapter,
        settings, document: dom.window.document, location: dom.window.location,
    });
    const plugin = new ListActionsController({
        hostAdapter, list: {}, settings, storage: { get: vi.fn(async () => []) },
        ui: { jquery: $, loading: () => ({ close() {} }) }, notifications: { info: vi.fn(), error: vi.fn() },
        scope: new LifecycleScope("test:list-actions"), sortController, document: dom.window.document, window: dom.window,
    });
    return { $, plugin, settings, sortController, setSortMethod: value => { sortMethod = value; } };
}

describe("FC2 list sorting", () => {
    it("sorts the whole loaded FC2 list by the actual review count", async () => {
        const loaded = loadPlugin("https://javdb.com/search_advanced?type=3&score_min=0&d=1", `<div class="movie-list">
            <div class="item" id="two"><div class="score">1.0分, 由2人评价</div></div>
            <div class="item" id="thirty-two"><div class="score"><span class="value">2.82分, 由32人评价</span></div></div>
            <div class="item" id="five"><div class="score">3.67分, 由5人评价</div></div>
            <div class="item" id="fifty-five"><div class="score">3.50分, 由55人评价</div></div>
        </div>`);
        loaded.setSortMethod("rateCount");

        await loaded.plugin.sortItems();

        expect(loaded.$(".movie-list > .item").map(((index, item) => item.id)).get()).toEqual([ "fifty-five", "thirty-two", "five", "two" ]);
    });

    it("treats missing autoPage as enabled and blocks non-live sorting", async () => {
        const loaded = loadPlugin("https://javdb.com/actors/abc", `<div class="movie-list">
            <div class="item" id="two"><div class="score">1.0分, 由2人评价</div></div>
            <div class="item" id="fifty-five"><div class="score">3.50分, 由55人评价</div></div>
        </div>`);
        loaded.setSortMethod("rateCount");

        await loaded.plugin.sortItems("rateCount");

        expect(loaded.$(".movie-list > .item").map(((index, item) => item.id)).get()).toEqual([ "two", "fifty-five" ]);
    });

    it("recognizes FC2 advanced search as a live-sort page", () => {
        const loaded = loadPlugin("https://javdb.com/search_advanced?score_min=0&type=3", '<div class="movie-list"></div>');
        expect(loaded.plugin.isFc2ListPage()).toBe(true);
        expect(loaded.plugin.supportsLiveSorting()).toBe(true);
    });
});

describe("owned ranking sorting", () => {
    const rankingHtml = `<div class="movie-list">
        <div class="item" id="older" data-jhs-publish-time="2026-08-01"></div>
        <div class="item" id="newer" data-jhs-publish-time="2026-08-29"></div>
    </div>`;
    const cardOrder = loaded => loaded.$(".movie-list > .item").map(((index, item) => item.id)).get();

    it("keeps owned ranking pages on the default sort regardless of the global setting", async () => {
        const loaded = loadPlugin("https://javdb.com/rankings/playback?p=daily&t=high_score", rankingHtml);
        loaded.setSortMethod("rateCount");
        expect(loaded.plugin.isOwnedRankingPage()).toBe(true);
        expect(loaded.plugin.activeSortMethod()).toBe("default");

        await loaded.plugin.sortItems();
        expect(cardOrder(loaded)).toEqual([ "older", "newer" ]);
    });

    it("treats Top250 as an owned ranking page", () => {
        const loaded = loadPlugin("https://javdb.com/rankings/top", '<div class="movie-list"></div>');
        expect(loaded.plugin.isOwnedRankingPage()).toBe(true);
        expect(loaded.plugin.activeSortMethod()).toBe("default");
    });

    it("applies in-page overrides without writing the global setting", async () => {
        const loaded = loadPlugin("https://javdb.com/rankings/playback?p=daily&t=high_score", rankingHtml);
        loaded.setSortMethod("rateCount");

        await loaded.plugin.selectSortMethod("date");
        expect(cardOrder(loaded)).toEqual([ "newer", "older" ]);
        expect(loaded.plugin.activeSortMethod()).toBe("date");
        expect(loaded.settings.set).not.toHaveBeenCalled();

        await loaded.plugin.selectSortMethod("default");
        expect(cardOrder(loaded)).toEqual([ "older", "newer" ]);
        expect(loaded.plugin.activeSortMethod()).toBe("default");
        expect(loaded.settings.set).not.toHaveBeenCalled();
    });

    it("still persists the global sort method on ordinary list pages", async () => {
        const loaded = loadPlugin("https://javdb.com/", rankingHtml);
        await loaded.plugin.selectSortMethod("date");
        expect(loaded.settings.set).toHaveBeenCalledWith("sortMethod", "date");
        expect(loaded.plugin.activeSortMethod()).toBe("date");
    });
});
