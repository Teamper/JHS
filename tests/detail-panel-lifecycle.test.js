import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadPanels() {
    const dom = new JSDOM('<div id="review-a"></div><div id="review-b"></div><div id="related-a"></div><div id="related-b"></div>', { url: "https://javdb.com/v/a" }), $ = jqueryFactory(dom.window);
    const reviewFetch = vi.fn(async movieId => [{ username: movieId, score: 1, created_at: "2026-08-22", likes_count: 0, content: "ok" }]);
    const relatedFetch = vi.fn(async movieId => [{ relatedId: movieId, name: movieId, movieCount: 1, collectionCount: 0, viewCount: 0, createTime: "today" }]);
    const context = vm.createContext({
        document: dom.window.document, window: dom.window, $, BasePlugin: class { getBean() { return null; } }, _: "yes", C: "no", r: false, l: false,
        storageManager: { getSetting: vi.fn(async () => "yes"), getReviewFilterKeywordList: vi.fn(async () => []), saveReviewFilterKeyword: vi.fn(), saveSettingItem: vi.fn() },
        R: reviewFetch, K: relatedFetch, utils: { formatDate: value => value, q: (event, message, callback) => callback() }, show: { error: vi.fn(), ok: vi.fn() }, clog: { error: vi.fn(), warn: vi.fn() }, escapeHtml: String,
        i: (target, key, value) => (target[key] = value)
    });
    vm.runInContext(`${readFileSync(join(process.cwd(), "src/plugins/external-search/review.js"), "utf8")};globalThis.Review=ReviewPlugin`, context);
    vm.runInContext(`${readFileSync(join(process.cwd(), "src/plugins/external-search/related.js"), "utf8")};globalThis.Related=RelatedPlugin`, context);
    return { $, Review: context.Review, Related: context.Related, reviewFetch, relatedFetch, storageManager: context.storageManager, window: dom.window };
}

describe("detail panel instance lifecycle", () => {
    it("keeps review floor, loading state, and panel ownership per target", async () => {
        const { $, Review, reviewFetch } = loadPanels(), plugin = new Review;
        const panelA = await plugin.showReview("A", $("#review-a")), panelB = await plugin.showReview("B", $("#review-b"));
        expect(panelA[0]).not.toBe(panelB[0]);
        expect(panelA.find(".jhs-review-floor").text()).toBe("#1楼");
        expect(panelB.find(".jhs-review-floor").text()).toBe("#1楼");
        expect((await plugin.showReview("A", $("#review-a")))[0]).toBe(panelA[0]);
        expect(reviewFetch).toHaveBeenCalledTimes(2);
        expect($("[id]").map(((index, item) => item.id)).get()).toEqual([ "review-a", "review-b", "related-a", "related-b" ]);
    });

    it("keeps related numbering and duplicate suppression per target", async () => {
        const { $, Related, relatedFetch } = loadPanels(), plugin = new Related;
        const panelA = await plugin.showRelated($("#related-a"), "A"), panelB = await plugin.showRelated($("#related-b"), "B");
        expect(panelA[0]).not.toBe(panelB[0]);
        expect(panelA.find(".jhs-related-index").text()).toBe("#1");
        expect(panelB.find(".jhs-related-index").text()).toBe("#1");
        expect((await plugin.showRelated($("#related-a"), "A"))[0]).toBe(panelA[0]);
        expect(relatedFetch).toHaveBeenCalledTimes(2);
    });

    it("binds the review context-menu handler exactly once across multiple panels", async () => {
        const { $, Review, storageManager, window } = loadPanels(), plugin = new Review;
        await plugin.showReview("A", $("#review-a")), await plugin.showReview("B", $("#review-b"));
        window.getSelection = () => ({ toString: () => "keyword" });
        $("#review-a .review-content").trigger("contextmenu");
        await vi.waitFor((() => expect(storageManager.saveReviewFilterKeyword).toHaveBeenCalledOnce()));
    });
});
