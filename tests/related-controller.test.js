import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { RelatedController } from "../src/features/detail/related-controller.js";

function createHarness({ route = "detail", resolve = async () => [] } = {}) {
    const dom = new JSDOM('<div data-jhs-slot="related"></div>', { url: "https://javdb.com/v/movie-123" });
    const $ = jqueryFactory(dom.window);
    const target = dom.window.document.querySelector('[data-jhs-slot="related"]');
    const settings = dom.window.document.createElement("div");
    let snapshot = { enableLoadRelated: "yes" };
    settings.snapshot = () => snapshot;
    settings.set = vi.fn(async (key, value) => { snapshot = { ...snapshot, [key]: value }; });
    const list = vi.fn(resolve), related = { list };
    const scope = new LifecycleScope("detail-related-test");
    const ui = { jquery: value => $(value), formatDate: value => `date:${value}` };
    const controller = new RelatedController({
        document: dom.window.document,
        hostAdapter: { site: "javdb", location: dom.window.location, locateDetailSlots: () => ({ related: target }) },
        route, related, settings, ui, scope,
    });
    return { dom, $, target, settings, list, scope, controller };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("RelatedController", () => {
    it("mounts the related panel with the injected service and UI capabilities", async () => {
        const { dom, list, scope, controller } = createHarness({ resolve: async () => [{ id: "fixture", name: "清单标题", movieCount: 4, collectionCount: 2, viewCount: 9, createdAt: "2026-09-26" }] });
        await expect(controller.start()).resolves.toBe(true);
        await tick();
        expect(list).toHaveBeenCalledWith({ movieId: "movie-123" }, expect.objectContaining({ page: 1, limit: 20 }));
        expect(dom.window.document.querySelector(".jhs-related-title")?.textContent).toBe("清单标题");
        expect(dom.window.document.querySelector(".jhs-related-time")?.textContent).toContain("date:2026-09-26");
        scope.dispose();
        expect(dom.window.document.querySelector("[data-jhs-panel=related]")).toBeNull();
    });

    it("aborts an active list request and removes the panel on Feature stop", async () => {
        let finishRequest, requestScope;
        const { dom, list, scope, controller } = createHarness({ resolve: (_movie, context) => new Promise(resolve => { finishRequest = resolve; requestScope = context.scope; }) });
        const startup = controller.start();
        await tick();
        expect(dom.window.document.querySelector("[data-jhs-panel=related]")).not.toBeNull();
        expect(requestScope.signal.aborted).toBe(false);
        scope.dispose();
        expect(requestScope.signal.aborted).toBe(true);
        expect(dom.window.document.querySelector("[data-jhs-panel=related]")).toBeNull();
        finishRequest([{ id: "late", name: "迟到结果" }]);
        await expect(startup).resolves.toBe(true);
        await tick();
        expect(dom.window.document.querySelector(".jhs-related-item")).toBeNull();
        expect(list).toHaveBeenCalledOnce();
    });

    it("does not mount on an ineligible route", async () => {
        const { dom, list, scope, controller } = createHarness({ route: "owned-detail" });
        await expect(controller.start()).resolves.toBe(false);
        expect(list).not.toHaveBeenCalled();
        expect(dom.window.document.querySelector("[data-jhs-panel=related]")).toBeNull();
        scope.dispose();
    });
});
