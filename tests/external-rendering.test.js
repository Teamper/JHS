import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { HitShowController } from "../src/features/discovery/hit-show-controller.js";

function loadHitShow() {
    const dom = new JSDOM('<div id="movie"><div id="score_movie"></div></div>', { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    vi.stubGlobal("document", dom.window.document);
    const plugin = new HitShowController({ document: dom.window.document, window: dom.window, hostAdapter: {}, movie: {}, settings: { snapshot: () => ({}) }, storage: {}, features: {}, scope: new LifecycleScope("test:rendering") });
    return { plugin, dom };
}

afterEach(() => vi.unstubAllGlobals());

describe("external rendering boundaries", () => {
    it("escapes list data and rejects executable cover URLs", () => {
        const { plugin, dom } = loadHitShow(), html = plugin.markDataListHtml([{ id: "movie", release_date: "2026", origin_title: '<img src=x onerror="boom">', number: "ABC-1", cover_url: "javascript:boom", magnets_count: 0 }]);
        dom.window.document.body.innerHTML = html;
        expect(dom.window.document.querySelector("script")).toBeNull();
        expect(dom.window.document.querySelector(".video-title").textContent).toContain('<img src=x onerror="boom">');
        expect(dom.window.document.querySelector(".cover img")).toBeNull();
    });

    it("reconstructs legacy score cache as text instead of injecting cached HTML", () => {
        const { plugin, dom } = loadHitShow(), cached = plugin.normalizeScoreData('<img src=x onerror="boom"> 4.2分，由88人评价');
        plugin.appendScore("movie", cached.score, cached.watchedCount);
        expect(dom.window.document.querySelector("#score_movie img")).toBeNull();
        expect(dom.window.document.querySelector("#score_movie").textContent).toContain("4.2分，由88人评价");
    });
});
