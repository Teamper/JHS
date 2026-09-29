import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DetailSubtitleLinkController } from "../src/features/detail/detail-subtitle-link-controller.js";

function createController({ carNum = "ABC-123", sourceUrls = vi.fn(() => [{ url: "https://subtitlecat.com/index.php?search=ABC-123" }]), openPage = vi.fn() } = {}) {
    const dom = new JSDOM('<button type="button" id="search-subtitle-btn">字幕</button>', { url: "https://javdb.com/v/test" });
    const scope = new LifecycleScope("detail-subtitle-link:test");
    const controller = new DetailSubtitleLinkController({
        document: dom.window.document,
        hostAdapter: { readMovieRef: vi.fn(() => carNum ? { carNum } : null) },
        movie: { sourceUrls }, ui: { openPage }, scope,
    });
    return { dom, scope, controller, sourceUrls, openPage };
}

describe("DetailSubtitleLinkController", () => {
    it("uses the injected movie/navigation services and forwards modifier-click semantics", () => {
        const { dom, scope, controller, sourceUrls, openPage } = createController();
        controller.start();
        const event = new dom.window.MouseEvent("click", { bubbles: true, ctrlKey: true });
        dom.window.document.querySelector("#search-subtitle-btn").dispatchEvent(event);
        expect(sourceUrls).toHaveBeenCalledWith({ carNum: "ABC-123" }, ["subtitlecat"]);
        expect(openPage).toHaveBeenCalledOnce();
        expect(openPage.mock.calls[0].slice(0, 3)).toEqual(["https://subtitlecat.com/index.php?search=ABC-123", "ABC-123", false]);
        expect(openPage.mock.calls[0][3]).toBe(event);
        scope.dispose();
        dom.window.close();
    });

    it("skips a missing identity and releases its delegated listener with the Feature scope", () => {
        const { dom, scope, controller, sourceUrls, openPage } = createController({ carNum: null });
        controller.start();
        dom.window.document.querySelector("#search-subtitle-btn").click();
        expect(sourceUrls).not.toHaveBeenCalled();
        expect(openPage).not.toHaveBeenCalled();
        scope.dispose();
        controller.hostAdapter.readMovieRef = vi.fn(() => ({ carNum: "ABC-123" }));
        dom.window.document.querySelector("#search-subtitle-btn").click();
        expect(openPage).not.toHaveBeenCalled();
        dom.window.close();
    });

    it("reports host and provider failures without escaping the click handler", () => {
        const { dom, scope, controller } = createController();
        const error = new Error("provider unavailable"), onError = vi.fn();
        controller.onError = onError;
        controller.movie.sourceUrls = () => { throw error; };
        controller.start();
        expect(() => dom.window.document.querySelector("#search-subtitle-btn").click()).not.toThrow();
        expect(onError).toHaveBeenCalledWith(error);
        scope.dispose();
        dom.window.close();
    });
});
