import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { HitShowController } from "../src/features/discovery/hit-show-controller.js";

function loadHitShow({ movies = [], rankingError = null, fetchScore = vi.fn(), cache = {}, sortMethod = "default", activeSortMethod = null, withListPage = true } = {}) {
    const dom = new JSDOM('<section class="section"><div class="container"><h2 class="section-title">榜单</h2><div class="box"></div></div></section>', { url: "https://javdb.com/advanced_search?handlePlayback=1&period=daily" });
    const $ = jqueryFactory(dom.window);
    vi.stubGlobal("document", dom.window.document);
    $.expr.pseudos.hidden = element => "none" === element.style.display;
    // 持久化评分缓存（storageManager.cachedRequest）的内存替身，并用旧 cache 参数播种
    const ttlStore = new Map([["jhs_hitshow_scores_v1", { ...cache }]]);
    const storage = {
        cachedRequest: vi.fn(async (key, ttl, loader) => {
            if (ttlStore.has(key)) return ttlStore.get(key);
            const value = await loader();
            return ttlStore.set(key, value), value;
        }),
        cacheSet: vi.fn(async (key, value) => ttlStore.set(key, JSON.parse(JSON.stringify(value)))),
    }, settings = { snapshot: () => ({ sortMethod, hoverBigImg: "no" }) };
    const host = {
        locateListRoot: () => dom.window.document.querySelector(".movie-list"),
        getListContainer: () => dom.window.document.querySelector(".movie-list")?.parentElement ?? null,
        getListLayoutContainer: () => dom.window.document.querySelector("section .container"),
        getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }),
        createOwnedListRoot(classes = []) { const root = dom.window.document.createElement("div"); root.classList.add("movie-list", ...classes); return root; },
    };
    const loadingClose = vi.fn(), sortItems = vi.fn().mockResolvedValue(), mountOwnedRankingControls = vi.fn().mockResolvedValue(), listPage = {
        advanceListGeneration: vi.fn(() => "1:0"), configureHoverPreview: vi.fn(), replaceHdImg: vi.fn(), doFilter: vi.fn().mockResolvedValue(), createQuickFilter: vi.fn().mockResolvedValue(), applyVisibility: vi.fn(), reconcileListItems: vi.fn(), rebuildItemIndex: vi.fn(), bindMovieDetailNavigation: vi.fn(), bindClick: vi.fn().mockResolvedValue(), getListSelectors: host.getListSelectors, getSelector: host.getListSelectors
    }, coverButton = { addSvgBtn: vi.fn() }, features = { getFeatureApi: vi.fn(async () => withListPage ? listPage : null) };
    const movie = { rankings: vi.fn(async () => { if (rankingError) throw rankingError; return movies; }), detail: vi.fn(async ({ movieId }) => fetchScore(movieId)) }, eventBus = { emit: vi.fn(async () => {}) }, listActions = { sortItems, mountOwnedRankingControls, activeSortMethod: () => activeSortMethod ?? "default" };
    vi.stubGlobal("$", $);
    vi.stubGlobal("loading", () => ({ close: loadingClose }));
    vi.stubGlobal("clog", { error: vi.fn(), warn: vi.fn() });
    const show = { error: vi.fn() }, clog = { error: vi.fn(), warn: vi.fn() }, ui = { getJQuery: () => $, getLoading: () => () => ({ close: loadingClose }), show, getClog: () => clog };
    vi.stubGlobal("show", show);
    const scope = new LifecycleScope("test:hit-show"), plugin = new HitShowController({ document: dom.window.document, window: dom.window, hostAdapter: host, movie, settings, storage, features, listActions, coverActions: coverButton, eventBus, ui, scope });
    return { plugin, dom, $, storage, ttlStore, storageManager: storage, loadingClose, sortItems, mountOwnedRankingControls, listPage, coverButton, fetchScore, emitListItems: eventBus.emit };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const movie = id => ({ id, number: id.toUpperCase(), release_date: "2026-08-16", origin_title: id, cover_url: "https://c0.jdbstatic.com/covers/a.jpg", magnets_count: 0 });

describe("HitShowPlugin lifecycle", () => {
    it("creates its owned list when the host page has no native movie list", async () => {
        const { plugin, dom } = loadHitShow({ movies: [movie("a")] });
        expect(dom.window.document.querySelector(".movie-list")).toBeNull();
        await plugin.handlePlayback();
        expect(dom.window.document.querySelector(".jhs-hitshow-list #a")).not.toBeNull();
        expect(dom.window.document.querySelector(".section-title")?.textContent).toContain("热播");
    });

    it("renders explicit empty and retryable error states", async () => {
        const empty = loadHitShow();
        await empty.plugin.handlePlayback();
        expect(empty.dom.window.document.querySelector(".jhs-hitshow-state")?.textContent).toContain("暂无热播数据");

        vi.useFakeTimers();
        try {
            const failed = loadHitShow({ rankingError: new Error("offline") });
            const pending = failed.plugin.handlePlayback();
            await vi.runAllTimersAsync();
            await pending;
            expect(failed.dom.window.document.querySelector(".jhs-hitshow-state--error")?.textContent).toContain("重新加载");
            expect(failed.loadingClose).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it("renders lightweight thumbnails while preserving the full cover URL", () => {
        const { plugin, $ } = loadHitShow();
        const image = $(plugin.markDataListHtml([movie("a")])).find("img");
        expect(image.attr("src")).toContain("/thumbs/");
        expect(image.attr("data-full")).toContain("/covers/");
        expect(image.attr("decoding")).toBe("async");
    });
    it("can preserve the full cover as the initial source for Top250", () => {
        const { plugin, $ } = loadHitShow();
        const image = $(plugin.markDataListHtml([movie("a")], { thumbnailFirst: false })).find("img");
        expect(image.attr("src")).toContain("/covers/");
        expect(image.attr("src")).toBe(image.attr("data-full"));
    });
    it("uses the API thumb when cover_url is absent", () => {
        const { plugin, $ } = loadHitShow();
        const image = $(plugin.markDataListHtml([{ ...movie("a"), cover_url: null, thumb_url: "https://c0.jdbstatic.com/thumbs/a.jpg" }])).find("img");
        expect(image.attr("src")).toBe("https://c0.jdbstatic.com/thumbs/a.jpg");
        expect(image.attr("data-full")).toBe("https://c0.jdbstatic.com/thumbs/a.jpg");
    });
    it("prefers the API thumb over a synthesized CDN path", () => {
        const { plugin, $ } = loadHitShow();
        const image = $(plugin.markDataListHtml([{ ...movie("a"), thumb_url: "https://c0.jdbstatic.com/thumbs/real-a.jpg" }])).find("img");
        expect(image.attr("src")).toBe("https://c0.jdbstatic.com/thumbs/real-a.jpg");
        expect(image.attr("data-full")).toContain("/covers/");
    });
    it("restores JavDB API proxy media paths to the public CDN", () => {
        const { plugin, $ } = loadHitShow();
        const image = $(plugin.markDataListHtml([{
            ...movie("a"),
            cover_url: "https://jdforrepam.com/rhe951l4q/covers/a.jpg",
            thumb_url: "https://jdforrepam.com/rhe951l4q/thumbs/a.jpg",
        }])).find("img");
        expect(image.attr("src")).toBe("https://c0.jdbstatic.com/thumbs/a.jpg");
        expect(image.attr("data-full")).toBe("https://c0.jdbstatic.com/covers/a.jpg");
    });
    it("closes loading after rendering while score requests continue", async () => {
        let resolveScore;
        const pendingScore = new Promise(resolve => { resolveScore = resolve; });
        const { plugin, loadingClose, dom, fetchScore } = loadHitShow({ movies: [movie("a")], fetchScore: vi.fn(() => pendingScore) });
        await plugin.handlePlayback();
        expect(dom.window.document.querySelector("#a")).not.toBeNull();
        expect(loadingClose).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(fetchScore).toHaveBeenCalledOnce());
        resolveScore({ score: 4.5, watchedCount: 20 });
        await pendingScore;
    });

    it("limits score requests to four workers and continues when unfocused", async () => {
        let active = 0, maxActive = 0;
        const fetchScore = vi.fn(async () => {
            active++, maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
            return { score: 4, watchedCount: 10 };
        });
        const movies = Array.from({ length: 12 }, (_, index) => movie(`m${index}`)), { plugin, $, dom } = loadHitShow({ movies, fetchScore });
        $(".container").append(`<div class="movie-list">${plugin.markDataListHtml(movies)}</div>`);
        dom.window.document.hasFocus = () => false;
        await plugin.loadScore(movies);
        expect(maxActive).toBe(4);
        expect(fetchScore).toHaveBeenCalledTimes(12);
    });

    it("uses the persistent score cache and isolates one failed score request", async () => {
        const fetchScore = vi.fn(id => "bad" === id ? Promise.reject(new Error("500")) : Promise.resolve({ score: 3.5, watchedCount: 7 }));
        const movies = [movie("cached"), movie("bad"), movie("good")], { plugin, $, ttlStore } = loadHitShow({ movies, fetchScore, cache: { cached: { score: 4.2, watchedCount: 88 } } });
        $(".container").append(`<div class="movie-list">${plugin.markDataListHtml(movies)}</div>`);
        await expect(plugin.loadScore(movies)).resolves.toBeUndefined();
        expect(fetchScore).not.toHaveBeenCalledWith("cached");
        expect($("#cached").attr("data-jhs-rate-count")).toBe("88");
        expect($("#bad").attr("data-jhs-rate-count")).toBe("0");
        expect($("#good").attr("data-jhs-rate-count")).toBe("7");
        expect(ttlStore.get("jhs_hitshow_scores_v1").good.watchedCount).toBe(7);
    });

    it("re-sorts after scores only when the page-local sort is rate count", async () => {
        const rateScore = vi.fn().mockResolvedValue({ score: 4, watchedCount: 9 });
        // 页内覆盖为评价人数：评分补全后重排一次
        const rateCount = loadHitShow({ movies: [movie("a")], fetchScore: rateScore, activeSortMethod: "rateCount" });
        await rateCount.plugin.handlePlayback();
        await vi.waitFor(() => expect(rateCount.sortItems).toHaveBeenCalledTimes(1));
        // 全局 sortMethod 不再驱动热播排序：全局评价人数 + 无页内覆盖 → 完全不排序
        const legacyScore = vi.fn().mockResolvedValue({ score: 4, watchedCount: 9 });
        const legacy = loadHitShow({ movies: [movie("a")], fetchScore: legacyScore, sortMethod: "rateCount" });
        await legacy.plugin.handlePlayback();
        await vi.waitFor(() => expect(legacyScore).toHaveBeenCalledOnce());
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(legacy.sortItems).not.toHaveBeenCalled();
    });

    it("binds the shared detail navigation instead of forcing new tabs", async () => {
        const { plugin, listPage } = loadHitShow({ movies: [movie("a")] });
        await plugin.handlePlayback();
        expect(listPage.bindMovieDetailNavigation).toHaveBeenCalledOnce();
        expect(plugin.markDataListHtml([movie("a")])).not.toContain('target="_blank"');
    });

    it("restores the quick filter bar after filtering externally driven lists", async () => {
        const { plugin, listPage, mountOwnedRankingControls } = loadHitShow({ movies: [movie("a")] });
        await plugin.handlePlayback();
        expect(listPage.createQuickFilter).toHaveBeenCalledOnce();
        expect(listPage.createQuickFilter.mock.invocationCallOrder[0]).toBeGreaterThan(listPage.doFilter.mock.invocationCallOrder[0]);
        expect(listPage.rebuildItemIndex).toHaveBeenCalledOnce();
        expect(mountOwnedRankingControls).toHaveBeenCalledOnce();
    });

    it("announces rendered items so deferred FC2 navigation can attach", async () => {
        const { plugin, emitListItems } = loadHitShow({ movies: [movie("a")] });
        await plugin.handlePlayback();
        const [type, payload, options] = emitListItems.mock.calls.at(-1);
        expect(type).toBe("list-items-added");
        expect(payload.items).toHaveLength(1);
        expect(options).toEqual({ broadcast: false });
    });

    it("loads scores for cards hidden by the default quick filter", async () => {
        const fetchScore = vi.fn().mockResolvedValue({ score: 4, watchedCount: 12 });
        const { plugin, $ } = loadHitShow({ movies: [movie("hid")], fetchScore });
        $(".container").append(`<div class="movie-list">${plugin.markDataListHtml([movie("hid")])}</div>`);
        $("#hid").hide();
        await plugin.loadScore([movie("hid")]);
        expect(fetchScore).toHaveBeenCalledWith("hid");
        expect($("#hid").attr("data-jhs-rate-count")).toBe("12");
    });

    it("keeps rendering when ListPagePlugin is disabled", async () => {
        const { plugin, listPage, dom } = loadHitShow({ movies: [movie("a")], withListPage: false });
        await plugin.handlePlayback();
        expect(dom.window.document.querySelector(".jhs-hitshow-list #a")).not.toBeNull();
        expect(listPage.configureHoverPreview).not.toHaveBeenCalled();
        expect(listPage.createQuickFilter).not.toHaveBeenCalled();
    });
});
