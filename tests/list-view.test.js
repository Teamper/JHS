import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { ListView } from "../src/features/list/list-view.js";
import { ListController } from "../src/features/list/list-controller.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";

function createHarness() {
    const dom = new JSDOM(`<!doctype html><html><body>
        <div class="movie-list">
            <article id="pending" class="item" data-jhs-flags="{}" data-jhs-visibility="{}" data-jhs-recent="no"><img></article>
            <article id="favorite" class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility="{}" data-jhs-recent="no"><a class="video-title"></a></article>
            <article id="blocked" class="item" data-jhs-flags="{}" data-jhs-visibility='{"keyword":true}' data-jhs-recent="no"><img></article>
        </div>
    </body></html>`, { url: "https://javdb.com/" });
    const $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("Element", dom.window.Element);
    vi.stubGlobal("clog", { error: vi.fn() });
    const hostAdapter = new JavDbHostAdapter(dom.window.document, dom.window.location);
    const view = new ListView({ hostAdapter, selectors: hostAdapter.getListSelectors() });
    return { dom, $, hostAdapter, view };
}

describe("ListView", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("uses host selectors and applies the release quick-filter semantics", () => {
        const { $, view, hostAdapter } = createHarness();
        view.createQuickFilter("favorite");

        expect(hostAdapter.getListSelectors().boxSelector).toBe(".movie-list");
        expect($("#jhs-quick-filter").next().is(".movie-list")).toBe(true);
        expect($("#favorite").css("display")).not.toBe("none");
        expect($("#pending").css("display")).toBe("none");
        expect($("#blocked").css("display")).toBe("none");
        expect($("[data-jhs-filter=favorite]").attr("aria-selected")).toBe("true");
        expect(view.getActiveFilter()).toBe("favorite");

        view.syncQuickFilterUi("blockedItems");
        expect(view.getActiveFilter()).toBe("blockedItems");
        view.applyVisibility(null, "blockedItems");
        expect($("#blocked").css("display")).not.toBe("none");
        expect($("#favorite").css("display")).toBe("none");
        expect($(".jhs-filter-option[aria-checked=true]").data("jhs-filter")).toBe("blockedItems");
        view.dispose();
    });

    it("reports each filter visibility change without rescanning cards afterward", () => {
        const { $, view } = createHarness(), /** @type {Array<[string, boolean]>} */ changes = [];
        view.applyVisibility(null, "favorite", (element, visible) => changes.push([element.id, visible]));
        expect(changes).toEqual([["pending", false], ["favorite", true], ["blocked", false]]);
        expect($("#favorite").css("display")).not.toBe("none");
        view.dispose();
    });

    it("keeps a cached visible count accurate across full and incremental card refreshes", () => {
        const { dom, view, hostAdapter } = createHarness();
        view.setActiveFilter("favorite");
        const controller = Object.assign(Object.create(ListController.prototype), {
            listRefreshController: { disposed: false },
            legacyPlugin: { isCurrentListGeneration: () => true, captureListRevision: () => "r1" },
            view, hostAdapter, activeFilter: "favorite", visibilityByItem: new WeakMap(), visibleItemCount: 0,
            totalItemCount: 0, hasVisibilitySnapshot: false, events: { emit: vi.fn() }, logger: { error: vi.fn() },
        });

        expect(controller.reconcileListItems(null, "r1")).toBe(true);
        expect(controller.getVisibilitySnapshot("r1")).toEqual({ filter: "favorite", visible: 1, total: 3, revision: "r1" });
        const pending = dom.window.document.querySelector("#pending"), favorite = dom.window.document.querySelector("#favorite");
        pending.setAttribute("data-jhs-flags", '{"favorite":true}');
        favorite.setAttribute("data-jhs-flags", "{}");
        controller.reconcileListItems([pending, favorite], "r2");
        expect(controller.getVisibilitySnapshot("r2")).toEqual({ filter: "favorite", visible: 1, total: 3, revision: "r2" });
        expect(controller.events.emit).toHaveBeenLastCalledWith("list-visibility-changed", expect.objectContaining({ visible: 1, total: 3 }), { broadcast: false });
        view.dispose();
    });

    it("routes filter activation and keyboard selection through the feature callback", () => {
        const { $, view } = createHarness(), onFilterChange = vi.fn();
        view.onFilterChange = onFilterChange;
        view.createQuickFilter("waitCheck");

        $("[data-jhs-filter=favorite]").trigger($.Event("keydown", { key: "ArrowRight" }));
        expect(onFilterChange).toHaveBeenCalledWith("hasDown", { syncUi: false });
        expect(view.getActiveFilter()).toBe("hasDown");
        $(".jhs-quick-filter__toggle").trigger("click");
        expect($(".jhs-quick-filter__toggle").attr("aria-expanded")).toBe("true");
        $(".jhs-filter-option[data-jhs-filter=recent7d]").trigger("click");
        expect(onFilterChange).toHaveBeenLastCalledWith("recent7d", { syncUi: false });
        expect(view.getActiveFilter()).toBe("recent7d");
        expect($(".jhs-quick-filter__toggle").attr("aria-expanded")).toBe("false");
        view.dispose();
    });

    it("reports filter callback failures through the injected logger without a global logger", async () => {
        const { hostAdapter } = createHarness();
        vi.stubGlobal("clog", undefined);
        const failure = new Error("filter failed"), logger = { error: vi.fn() };
        const view = new ListView({
            hostAdapter, selectors: hostAdapter.getListSelectors(), logger,
            onFilterChange: () => Promise.reject(failure),
        });

        view.selectFilter("favorite");
        await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith("列表筛选刷新失败", failure));
        view.dispose();
    });

    it("preserves modified navigation and opens the detail view for ordinary clicks", async () => {
        const { $, view } = createHarness(), onOpenMovieDetail = vi.fn(async () => {});
        view.onOpenMovieDetail = onOpenMovieDetail;
        const root = $(".movie-list");
        view.bindMovieDetailNavigation(root);

        const modified = $.Event("click", { shiftKey: true, button: 0 });
        $("#pending img").trigger(modified);
        expect(onOpenMovieDetail).not.toHaveBeenCalled();
        expect(modified.isDefaultPrevented()).toBe(false);

        const ordinary = $.Event("click", { button: 0 });
        $("#pending img").trigger(ordinary);
        await Promise.resolve();
        expect(ordinary.isDefaultPrevented()).toBe(true);
        expect(onOpenMovieDetail).toHaveBeenCalledOnce();
        expect(onOpenMovieDetail.mock.calls[0][0][0].id).toBe("pending");
        view.dispose();
        $("#favorite .video-title").trigger("click");
        expect(onOpenMovieDetail).toHaveBeenCalledOnce();
    });

    it("owns card video play, pause, event suppression, and cleanup", async () => {
        const { $, view } = createHarness();
        const video = document.createElement("video");
        video.className = "jhs-card-video";
        $("#pending").append(video);
        const play = vi.fn().mockResolvedValue(undefined), pause = vi.fn();
        Object.defineProperty(video, "paused", { configurable: true, value: true });
        video.play = play;
        video.pause = pause;
        const root = $(".movie-list");
        view.bindCardVideoPlayback(root);

        const playEvent = $.Event("click");
        $(video).trigger(playEvent);
        await Promise.resolve();
        await Promise.resolve();
        expect(play).toHaveBeenCalledOnce();
        expect(playEvent.isDefaultPrevented()).toBe(true);
        expect(playEvent.isPropagationStopped()).toBe(true);

        Object.defineProperty(video, "paused", { configurable: true, value: false });
        const pauseEvent = $.Event("click");
        $(video).trigger(pauseEvent);
        expect(pause).toHaveBeenCalledOnce();
        expect(pauseEvent.isDefaultPrevented()).toBe(true);
        expect(pauseEvent.isPropagationStopped()).toBe(true);

        view.dispose();
        $(video).trigger("click");
        expect(play).toHaveBeenCalledOnce();
        expect(pause).toHaveBeenCalledOnce();
    });

    it("returns the release selectors from both supported host adapters", () => {
        const dom = new JSDOM('<div class="movie-list"></div><div class="masonry"></div>', { url: "https://javdb.com/" });
        const javdb = new JavDbHostAdapter(dom.window.document, dom.window.location);
        const javbus = new JavBusHostAdapter(dom.window.document, dom.window.location);
        expect(javdb.getListSelectors()).toMatchObject({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" });
        expect(javbus.getListSelectors()).toMatchObject({ boxSelector: ".masonry", itemSelector: ".masonry .item", nextPageSelector: "#next" });
    });
});
