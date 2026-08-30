import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListView } from "../src/features/list/list-view.js";

afterEach(() => vi.unstubAllGlobals());

describe("ListView", () => {
    it("owns item visibility from the shared filter semantics", () => {
        const dom = new JSDOM('<div class="movie-list"><div class="item" id="favorite" data-jhs-flags=\'{"favorite":true}\' data-jhs-visibility=\'{}\' data-jhs-recent="no"></div><div class="item" id="pending" data-jhs-flags=\'{}\' data-jhs-visibility=\'{}\' data-jhs-recent="no"></div></div>');
        const $ = jqueryFactory(dom.window), view = new ListView({
            hostAdapter: { site: "javdb" },
            selectors: { boxSelector: ".movie-list", itemSelector: ".movie-list .item" },
        });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", $);

        view.applyVisibility(null, "favorite");

        expect($("#favorite").css("display")).not.toBe("none");
        expect($("#pending").css("display")).toBe("none");
        view.dispose();
    });

    it("owns quick-filter controls and delegates filter changes", async () => {
        const dom = new JSDOM('<div class="movie-list"><div class="item"><img></div></div>');
        const $ = jqueryFactory(dom.window), onFilterChange = vi.fn();
        const view = new ListView({
            hostAdapter: { site: "javdb" },
            selectors: { boxSelector: ".movie-list", itemSelector: ".movie-list .item" },
            onFilterChange,
        });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", $);

        await view.createQuickFilter("favorite");
        expect($("#jhs-quick-filter").length).toBe(1);
        expect(onFilterChange).toHaveBeenCalledWith("favorite");
        view.syncQuickFilterUi("favorite");
        expect($("[data-jhs-filter='favorite']").attr("aria-selected")).toBe("true");
        onFilterChange.mockClear();
        $("[data-jhs-filter='all']").trigger("click");
        expect(onFilterChange).toHaveBeenCalledWith("all");
        view.dispose();
    });

    it("owns detail navigation binding while delegating the action", () => {
        const dom = new JSDOM('<div class="movie-list"><div class="item"><img></div></div>');
        const $ = jqueryFactory(dom.window), onOpenMovieDetail = vi.fn();
        const view = new ListView({
            hostAdapter: { site: "javdb" },
            selectors: { boxSelector: ".movie-list", itemSelector: ".movie-list .item" },
            onOpenMovieDetail,
        });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", $);

        view.bindMovieDetailNavigation(".movie-list");
        $(".movie-list img").trigger($.Event("click", { button: 0 }));
        expect(onOpenMovieDetail).toHaveBeenCalledOnce();
        expect(onOpenMovieDetail.mock.calls[0][0].length).toBe(1);
        view.dispose();
    });
});
