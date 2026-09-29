import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { ListActionsController } from "../src/features/list/list-actions-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function loadListActions() {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window), notifications = { info: vi.fn(), error: vi.fn() };
    const list = { openMovieDetail: vi.fn(async () => {}) };
    const plugin = new ListActionsController({
        hostAdapter: { site: "javdb", location: dom.window.location, detectRoute: () => "list", getListSelectors: () => ({ itemSelector: ".movie-list .item" }) },
        list, settings: { snapshot: () => ({ waitCheckCount: 5, autoPage: "no", sortMethod: "default" }) },
        storage: { get: vi.fn(async () => []) }, ui: { jquery: $, loading: () => ({ close() {} }) }, notifications,
        scope: new LifecycleScope("test:list-actions"), sortController: {}, document: dom.window.document, window: dom.window,
    });
    return { dom, $, plugin, list, notifications };
}

describe("start identification workflow", () => {
    it("scans the full page and ignores hidden, stateful, and hard-hidden cards", async () => {
        const { dom, $, plugin, list } = loadListActions();
        dom.window.document.querySelector(".movie-list").innerHTML = `
            <div id="pending" class="item" style="display:none" data-jhs-flags='{}' data-jhs-visibility='{}'></div>
            <div class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{}'></div>
            <div class="item" data-jhs-flags='{}' data-jhs-visibility='{"keyword":true}'></div>
            <div class="item" data-jhs-flags='{}' data-jhs-visibility='{"actorBlacklist":true}'></div>`;
        await plugin.openWaitCheck();
        expect(list.openMovieDetail).toHaveBeenCalledOnce();
        expect(list.openMovieDetail.mock.calls[0][0][0]).toBe($("#pending")[0]);
    });
});
