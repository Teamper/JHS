import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DetailReviewsController } from "../src/features/detail/detail-reviews-controller.js";

function createHarness({ site, pathname = "/v/ABC-123", movieId = "movie-1" }) {
    const dom = new JSDOM('<main><div id="reviews"></div></main>', { url: `https://${site}.com${pathname}` });
    const $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("utils", { formatDate: value => value });
    vi.stubGlobal("clog", { error: vi.fn(), warn: vi.fn() });
    vi.stubGlobal("show", { error: vi.fn() });
    const slot = dom.window.document.querySelector("#reviews");
    const scope = new LifecycleScope(`test:detail-reviews:${site}`);
    const movie = { resolve: vi.fn(async () => ({ movieId })) };
    const hostAdapter = {
        site,
        document: dom.window.document,
        location: dom.window.location,
        locateDetailSlots: () => ({ reviews: slot }),
        readMovieRef: () => ({ carNum: "ABC-123" }),
    };
    const styles = { register: vi.fn(() => vi.fn()) };
    const settings = { snapshot: () => ({ enableLoadReview: "no" }) };
    const controller = new DetailReviewsController({
        hostAdapter,
        movie,
        review: { list: vi.fn() },
        settings,
        storage: { get: vi.fn(async () => []) },
        ui: { getJQuery: () => $ },
        styles,
        scope,
    });
    return { $, dom, movie, slot, styles, scope, controller };
}

describe("detail reviews controller", () => {
    it("mounts a JavDB review panel from the route movie id", async () => {
        const { controller, slot, movie, styles, scope } = createHarness({ site: "javdb", movieId: "ABC-123" });

        await controller.start();

        expect(movie.resolve).not.toHaveBeenCalled();
        expect(slot.querySelector('[data-jhs-panel="reviews"]')?.getAttribute("data-jhs-movie-id")).toBe("ABC-123");
        expect(styles.register).toHaveBeenCalledWith("jhs-detail-reviews", expect.stringContaining("jhs-review-panel"));
        controller.dispose();
        scope.dispose();
    });

    it("resolves the JavBus number through the movie service before mounting", async () => {
        const { controller, slot, movie, scope } = createHarness({ site: "javbus" });

        await controller.start();

        expect(movie.resolve).toHaveBeenCalledWith({ carNum: "ABC-123" }, { scope });
        expect(slot.querySelector('[data-jhs-panel="reviews"]')?.getAttribute("data-jhs-movie-id")).toBe("movie-1");
        controller.dispose();
        scope.dispose();
    });
});
