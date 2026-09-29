import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ReviewController } from "../src/features/detail/review-controller.js";

function createHarness({ site = "javdb", pathname = "/v/movie-123", reviewEnabled = "yes", movieResolve = async () => ({ movieId: "movie-123" }), reviewList = async () => [] } = {}) {
    const dom = new JSDOM('<div data-jhs-slot="reviews"></div>', { url: `https://${site}.com${pathname}` });
    const $ = jqueryFactory(dom.window);
    const target = dom.window.document.querySelector('[data-jhs-slot="reviews"]');
    const settings = new dom.window.EventTarget();
    let currentSettings = { enableLoadReview: reviewEnabled, reviewCount: 20, enableTitleSelectFilter: "yes" };
    settings.snapshot = () => currentSettings;
    settings.set = vi.fn(async (key, value) => { currentSettings = { ...currentSettings, [key]: value }; });
    settings.change = (key, value) => {
        currentSettings = { ...currentSettings, [key]: value };
        settings.dispatchEvent(new dom.window.CustomEvent("settings.changed", { detail: { names: [key] } }));
    };
    const storage = { get: vi.fn(async () => []), set: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    const list = vi.fn(reviewList), resolve = vi.fn(movieResolve);
    const copied = vi.fn(async () => true), errors = [], notices = [];
    const scope = new LifecycleScope("detail-review-test");
    const controller = new ReviewController({
        document: dom.window.document, window: dom.window,
        hostAdapter: {
            site, location: dom.window.location, locateDetailSlots: () => ({ reviews: target }),
            readMovieRef: () => ({ carNum: "ABC-123" }),
        },
        route: "detail", review: { list }, movie: { resolve }, settings, storage,
        ui: { jquery: value => $(value), formatDate: value => `date:${value}`, confirm: (_event, _message, callback) => callback() },
        clipboard: { copyText: copied }, notifications: { error: message => notices.push(message), ok: message => notices.push(message) },
        diagnostics: { recordError: error => errors.push(error) }, scope,
    });
    return { dom, $, target, settings, storage, list, resolve, copied, errors, notices, scope, controller };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("ReviewController", () => {
    it("mounts a JavDB panel with injected services and removes it when Detail stops", async () => {
        let finishReview, requestScope;
        const harness = createHarness({ reviewList: (_movie, context) => new Promise(resolve => { finishReview = resolve; requestScope = context.scope; }) });
        await expect(harness.controller.start()).resolves.toBe(true);
        await tick();
        expect(harness.list).toHaveBeenCalledWith({ movieId: "movie-123" }, expect.objectContaining({ page: 1, limit: 20 }));
        expect(harness.dom.window.document.querySelector('[data-jhs-panel="reviews"]')).not.toBeNull();
        expect(requestScope.signal.aborted).toBe(false);
        harness.scope.dispose();
        expect(requestScope.signal.aborted).toBe(true);
        expect(harness.dom.window.document.querySelector('[data-jhs-panel="reviews"]')).toBeNull();
        finishReview([{ author: "late", content: "late result", createdAt: "2026-09-26" }]);
        await tick();
        expect(harness.dom.window.document.querySelector(".jhs-review-item")).toBeNull();
    });

    it("waits for the JavBus review switch and cancels a late identity result", async () => {
        let finishIdentity, identityScope;
        const harness = createHarness({
            site: "javbus", pathname: "/ABC-123", reviewEnabled: "no",
            movieResolve: (_identity, context) => new Promise(resolve => { finishIdentity = resolve; identityScope = context.scope; }),
        });
        await expect(harness.controller.start()).resolves.toBe(true);
        expect(harness.resolve).not.toHaveBeenCalled();
        harness.settings.change("enableLoadReview", "yes");
        await tick();
        expect(harness.resolve).toHaveBeenCalledWith({ carNum: "ABC-123" }, expect.any(Object));
        expect(identityScope.signal.aborted).toBe(false);
        harness.scope.dispose();
        expect(identityScope.signal.aborted).toBe(true);
        finishIdentity({ movieId: "late-movie" });
        await tick();
        expect(harness.list).not.toHaveBeenCalled();
        expect(harness.dom.window.document.querySelector('[data-jhs-panel="reviews"]')).toBeNull();
    });

    it("restarts identity lookup after a fast OFF to ON toggle without accepting the stale result", async () => {
        const lookups = [];
        const harness = createHarness({
            site: "javbus", pathname: "/ABC-123",
            movieResolve: (_identity, context) => new Promise(resolve => lookups.push({ resolve, scope: context.scope })),
            reviewList: async () => [{ author: "Fixture", content: "fresh result", createdAt: "2026-09-26" }],
        });
        await harness.controller.start();
        await tick();
        expect(lookups).toHaveLength(1);
        harness.settings.change("enableLoadReview", "no");
        expect(lookups[0].scope.signal.aborted).toBe(true);
        harness.settings.change("enableLoadReview", "yes");
        await tick();
        expect(lookups).toHaveLength(2);
        lookups[0].resolve({ movieId: "stale-movie" });
        await tick();
        expect(harness.dom.window.document.querySelector('[data-jhs-panel="reviews"]')).toBeNull();
        expect(lookups[1].scope.signal.aborted).toBe(false);
        lookups[1].resolve({ movieId: "fresh-movie" });
        await vi.waitFor(() => expect(harness.dom.window.document.querySelector(".jhs-review-item")?.textContent).toContain("fresh result"));
        expect(harness.list).toHaveBeenCalledWith({ movieId: "fresh-movie" }, expect.any(Object));
        harness.scope.dispose();
    });

    it("mounts JavBus reviews after identity resolution and honors the shared live setting", async () => {
        const harness = createHarness({ site: "javbus", pathname: "/ABC-123", reviewList: async () => [{ author: "Fixture", content: "review body", createdAt: "2026-09-26" }] });
        await expect(harness.controller.start()).resolves.toBe(true);
        await tick();
        expect(harness.resolve).toHaveBeenCalledWith({ carNum: "ABC-123" }, expect.any(Object));
        await vi.waitFor(() => expect(harness.dom.window.document.querySelector(".jhs-review-item")?.textContent).toContain("review body"));
        harness.settings.change("enableLoadReview", "no");
        await tick();
        expect(harness.dom.window.document.querySelector(".jhs-review-container").hidden).toBe(false);
        expect(harness.$(".jhs-review-container").is(":hidden")).toBe(true);
        harness.scope.dispose();
    });
});
