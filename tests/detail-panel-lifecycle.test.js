import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatedCompatibilityBean, ReviewCompatibilityBean } from "../src/compat/detail-panel-beans.js";
import { RelatedPanel } from "../src/ui/detail/related-panel.js";
import { ReviewPanel } from "../src/ui/detail/review-panel.js";

afterEach(() => vi.unstubAllGlobals());

function loadPanels({ settings = { enableLoadReview: "yes", enableLoadRelated: "yes", enableTitleSelectFilter: "yes" } } = {}) {
    const dom = new JSDOM('<div id="review-a"></div><div id="review-b"></div><div id="related-a"></div><div id="related-b"></div>', { url: "https://javdb.com/v/a" }), $ = jqueryFactory(dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    const reviewFetch = vi.fn(async movieRef => [{ author: movieRef.movieId, score: 1, createdAt: "2026-08-22", likes: 0, content: "ok" }]);
    const relatedFetch = vi.fn(async movieRef => [{ id: movieRef.movieId, name: movieRef.movieId, movieCount: 1, collectionCount: 0, viewCount: 0, createdAt: "today" }]);
    const reviewKeywords = [];
    const runtimeServices = { review: { list: reviewFetch }, related: { list: relatedFetch }, settings: { snapshot: () => settings, set: vi.fn(async (name, value) => settings[name] = value) }, storage: { get: vi.fn(async () => reviewKeywords), set: vi.fn(async (_key, value) => { reviewKeywords.splice(0, reviewKeywords.length, ...value); }) }, scope: async () => null };
    const dependencies = { ...runtimeServices, movie: {}, host: { locateDetailSlots: () => ({ related: dom.window.document.querySelector("#related-a") }) }, getScope: runtimeServices.scope, jquery: $, document: dom.window.document, window: dom.window, ui: { formatDate: value => value, confirm: (_event, _message, callback) => callback() }, formatDate: value => value };
    const Review = new ReviewCompatibilityBean({ ...dependencies, showPanel: (movieId, target, options) => new ReviewPanel({
        review: runtimeServices.review, settings: runtimeServices.settings, storage: runtimeServices.storage,
        scope: runtimeServices.scope, jquery: $, document: dom.window.document, window: dom.window,
        ui: dependencies.ui,
    }).show(movieId, target, options) });
    const Related = new RelatedCompatibilityBean({ ...dependencies, showPanel: (target, movieId, options) => new RelatedPanel({
        related: runtimeServices.related, settings: runtimeServices.settings, scope: runtimeServices.scope,
        jquery: $, formatDate: value => value, document: dom.window.document,
    }).show(target, movieId, options) });
    return { $, Review, Related, reviewFetch, relatedFetch, storage: runtimeServices.storage, window: dom.window };
}

describe("detail panel instance lifecycle", () => {
  it("loads reviews by default when the preference was never saved", async () => {
        const { $, Review: plugin, reviewFetch } = loadPanels({ settings: {} });
        const panel = await plugin.showReview("A", $("#review-a"));
        expect(reviewFetch).toHaveBeenCalledOnce();
        expect(panel.find(".jhs-review-toggle").attr("aria-expanded")).toBe("true");
    });

    it("keeps reviews closed when explicitly disabled", async () => {
        const { $, Review: plugin, reviewFetch } = loadPanels({ settings: { enableLoadReview: "no" } });
        const panel = await plugin.showReview("A", $("#review-a"));
        expect(reviewFetch).not.toHaveBeenCalled();
        expect(panel.find(".jhs-review-toggle").attr("aria-expanded")).toBe("false");
    });

    it("keeps review floor, loading state, and panel ownership per target", async () => {
        const { $, Review: plugin, reviewFetch } = loadPanels();
        const panelA = await plugin.showReview("A", $("#review-a")), panelB = await plugin.showReview("B", $("#review-b"));
        expect(panelA[0]).not.toBe(panelB[0]);
        expect(panelA.find(".jhs-review-floor").text()).toBe("#1楼");
        expect(panelB.find(".jhs-review-floor").text()).toBe("#1楼");
        expect((await plugin.showReview("A", $("#review-a")))[0]).toBe(panelA[0]);
        expect(reviewFetch).toHaveBeenCalledTimes(2);
        expect($("[id]").map(((index, item) => item.id)).get()).toEqual([ "review-a", "review-b", "related-a", "related-b" ]);
    });

    it("keeps related numbering and duplicate suppression per target", async () => {
        const { $, Related: plugin, relatedFetch } = loadPanels();
        const panelA = await plugin.showRelated($("#related-a"), "A"), panelB = await plugin.showRelated($("#related-b"), "B");
        expect(panelA[0]).not.toBe(panelB[0]);
        expect(panelA.find(".jhs-related-index").text()).toBe("#1");
        expect(panelB.find(".jhs-related-index").text()).toBe("#1");
        expect((await plugin.showRelated($("#related-a"), "A"))[0]).toBe(panelA[0]);
        expect(relatedFetch).toHaveBeenCalledTimes(2);
    });

    it("binds the review context-menu handler exactly once across multiple panels", async () => {
        const { $, Review: plugin, storage, window } = loadPanels();
        await plugin.showReview("A", $("#review-a")), await plugin.showReview("B", $("#review-b"));
        window.getSelection = () => ({ toString: () => "keyword" });
        $("#review-a .review-content").trigger("contextmenu");
        await vi.waitFor((() => expect(storage.set).toHaveBeenCalledOnce()));
    });

    it("adopts owned workspace headers and does not prefetch the second review page", async () => {
        const { $, Review: plugin, reviewFetch } = loadPanels();
        const section = $('<section><header><div data-jhs-section-actions="reviews"></div></header><div id="owned-reviews"></div></section>').appendTo("body");
        reviewFetch.mockResolvedValueOnce(Array.from({ length: 20 }, ((_, index) => ({ author: String(index), score: 1, createdAt: "2026", likes: 0, content: "ok" }))));
        const panel = await plugin.showReview("owned", section.find("#owned-reviews"), { ownedSection: section, isActive: () => true });
        expect(panel.children(".jhs-panel-header")).toHaveLength(0), expect(section.find('> header [data-jhs-section-actions="reviews"] .jhs-review-toggle')).toHaveLength(1);
        expect(reviewFetch).toHaveBeenCalledTimes(1), expect(panel.find(".jhs-review-load-more")).toHaveLength(1);
    });
});
