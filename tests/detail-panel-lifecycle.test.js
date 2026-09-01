import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { createLatestSettingWriter } from "../src/ui/settings/setting-binding-controller.js";

function loadPanels({ settings = { enableLoadReview: "yes", enableLoadRelated: "yes", enableTitleSelectFilter: "yes" } } = {}) {
    const dom = new JSDOM('<div id="review-a"></div><div id="review-b"></div><div id="related-a"></div><div id="related-b"></div>', { url: "https://javdb.com/v/a" }), $ = jqueryFactory(dom.window);
    const reviewFetch = vi.fn(async movieRef => [{ author: movieRef.movieId, score: 1, createdAt: "2026-08-22", likes: 0, content: "ok" }]);
    const relatedFetch = vi.fn(async movieRef => [{ id: movieRef.movieId, name: movieRef.movieId, movieCount: 1, collectionCount: 0, viewCount: 0, createdAt: "today" }]);
    const reviewKeywords = [];
    const runtimeServices = { review: { list: reviewFetch }, related: { list: relatedFetch }, settings: { snapshot: () => settings, set: vi.fn(async (name, value) => settings[name] = value) }, storage: { get: vi.fn(async () => reviewKeywords), set: vi.fn(async (_key, value) => { reviewKeywords.splice(0, reviewKeywords.length, ...value); }) }, scope: async () => null };
    const context = vm.createContext({
        document: dom.window.document, window: dom.window, $, BasePlugin: class { getBean() { return null; } getRuntimeService(name) { return runtimeServices[name]; } }, _: "yes", C: "no", r: false, l: false,
        storageManager: { getSetting: vi.fn(async (key, fallback) => null == key ? settings : "reviewCount" === key ? 20 : settings[key] ?? fallback), getReviewFilterKeywordList: vi.fn(async () => []), saveReviewFilterKeyword: vi.fn(), saveSettingItem: vi.fn() },
        utils: { formatDate: value => value, q: (event, message, callback) => callback() }, show: { error: vi.fn(), ok: vi.fn() }, clog: { error: vi.fn(), warn: vi.fn() }, escapeHtml: String,
        i: (target, key, value) => (target[key] = value), createLatestSettingWriter
    });
    vm.runInContext(`${readTestFile(join(process.cwd(), "src/ui/detail/related-panel.js"), "utf8")};globalThis.Related=RelatedPanel`, context);
    vm.runInContext(`${readTestFile(join(process.cwd(), "src/ui/detail/review-panel.js"), "utf8")};globalThis.Review=ReviewPanel`, context);
    return {
        $, Related: context.Related, reviewFetch, relatedFetch, storage: runtimeServices.storage, window: dom.window,
        createReview: () => new context.Review({ review: runtimeServices.review, settings: runtimeServices.settings, storage: runtimeServices.storage, scope: runtimeServices.scope }),
        createRelated: () => new context.Related({ related: runtimeServices.related, settings: runtimeServices.settings, scope: runtimeServices.scope }),
    };
}

describe("detail panel instance lifecycle", () => {
    it("does not fetch reviews until expanded when the preference was never saved", async () => {
        const { $, createReview, reviewFetch } = loadPanels({ settings: {} }), panelController = createReview();
        const panel = await panelController.show("A", $("#review-a"));
        expect(reviewFetch).not.toHaveBeenCalled();
        expect(panel.find(".jhs-review-toggle").attr("aria-expanded")).toBe("false");
        panel.find(".jhs-review-toggle").trigger("click");
        await vi.waitFor((() => expect(reviewFetch).toHaveBeenCalledOnce()));
    });

    it("keeps review floor, loading state, and panel ownership per target", async () => {
        const { $, createReview, reviewFetch } = loadPanels(), panelController = createReview();
        const panelA = await panelController.show("A", $("#review-a")), panelB = await panelController.show("B", $("#review-b"));
        expect(panelA[0]).not.toBe(panelB[0]);
        expect(panelA.find(".jhs-review-floor").text()).toBe("#1楼");
        expect(panelB.find(".jhs-review-floor").text()).toBe("#1楼");
        expect((await panelController.show("A", $("#review-a")))[0]).toBe(panelA[0]);
        expect(reviewFetch).toHaveBeenCalledTimes(2);
        expect($("[id]").map(((index, item) => item.id)).get()).toEqual([ "review-a", "review-b", "related-a", "related-b" ]);
    });

    it("keeps related numbering and duplicate suppression per target", async () => {
        const { $, createRelated, relatedFetch } = loadPanels(), panelController = createRelated();
        const panelA = await panelController.show($("#related-a"), "A"), panelB = await panelController.show($("#related-b"), "B");
        expect(panelA[0]).not.toBe(panelB[0]);
        expect(panelA.find(".jhs-related-index").text()).toBe("#1");
        expect(panelB.find(".jhs-related-index").text()).toBe("#1");
        expect((await panelController.show($("#related-a"), "A"))[0]).toBe(panelA[0]);
        expect(relatedFetch).toHaveBeenCalledTimes(2);
    });

    it("binds the review context-menu handler exactly once across multiple panels", async () => {
        const { $, createReview, storage, window } = loadPanels(), panelController = createReview();
        await panelController.show("A", $("#review-a")), await panelController.show("B", $("#review-b"));
        window.getSelection = () => ({ toString: () => "keyword" });
        $("#review-a .review-content").trigger("contextmenu");
        await vi.waitFor((() => expect(storage.set).toHaveBeenCalledOnce()));
    });

    it("adopts owned workspace headers and does not prefetch the second review page", async () => {
        const { $, createReview, reviewFetch } = loadPanels(), panelController = createReview();
        const section = $('<section><header><div data-jhs-section-actions="reviews"></div></header><div id="owned-reviews"></div></section>').appendTo("body");
        reviewFetch.mockResolvedValueOnce(Array.from({ length: 20 }, ((_, index) => ({ author: String(index), score: 1, createdAt: "2026", likes: 0, content: "ok" }))));
        const panel = await panelController.show("owned", section.find("#owned-reviews"), { ownedSection: section, isActive: () => true });
        expect(panel.children(".jhs-panel-header")).toHaveLength(0), expect(section.find('> header [data-jhs-section-actions="reviews"] .jhs-review-toggle')).toHaveLength(1);
        expect(reviewFetch).toHaveBeenCalledTimes(1), expect(panel.find(".jhs-review-load-more")).toHaveLength(1);
    });
});
