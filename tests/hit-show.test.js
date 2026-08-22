import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadHitShow({ movies = [], fetchScore = vi.fn(), cache = {}, sortMethod = "default" } = {}) {
    const dom = new JSDOM('<section class="section"><div class="container"><h2 class="section-title">榜单</h2><div class="box"></div></div></section>', { url: "https://javdb.com/advanced_search?handlePlayback=1&period=daily" });
    const $ = jqueryFactory(dom.window), storage = new Map([["jhs_score_info", JSON.stringify(cache)], ["jhs_sortMethod", sortMethod]]);
    $.expr.pseudos.hidden = element => "none" === element.style.display;
    const loadingClose = vi.fn(), sortItems = vi.fn().mockResolvedValue(), listPage = {
        replaceHdImg: vi.fn(), doFilter: vi.fn().mockResolvedValue(), applyVisibility: vi.fn(), bindMovieDetailNavigation: vi.fn(), getSelector: () => ({ itemSelector: ".movie-list .item" })
    }, coverButton = { addSvgBtn: vi.fn() };
    const context = vm.createContext({
        BasePlugin: class { getBean(name) { return { ListPagePlugin: listPage, ListPageButtonPlugin: { sortItems }, CoverButtonPlugin: coverButton }[name]; } },
        i: (target, key, value) => (target[key] = value), $, document: dom.window.document, window: dom.window,
        URLSearchParams, isHitShowPage: () => true, W: vi.fn().mockResolvedValue(movies), V: fetchScore,
        loading: () => ({ close: loadingClose }), clog: { error: vi.fn(), warn: vi.fn() },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        escapeHtml: value => $("<span></span>").text(String(value ?? "")).html(),
        normalizeHttpUrl: value => value
    });
    const source = readFileSync(join(process.cwd(), "src/plugins/external-search/hit-show.js"), "utf8");
    vm.runInContext(`${source};globalThis.HitShowPlugin=HitShowPlugin`, context);
    return { plugin: new context.HitShowPlugin(), context, dom, $, storage, loadingClose, sortItems, listPage, coverButton };
}

const movie = id => ({ id, number: id.toUpperCase(), release_date: "2026-08-16", origin_title: id, cover_url: "https://example.com/a.jpg", magnets_count: 0 });

describe("HitShowPlugin lifecycle", () => {
    it("closes loading after rendering while score requests continue", async () => {
        let resolveScore;
        const pendingScore = new Promise(resolve => { resolveScore = resolve; });
        const { plugin, loadingClose, context, dom } = loadHitShow({ movies: [movie("a")], fetchScore: vi.fn(() => pendingScore) });
        await plugin.handlePlayback();
        expect(dom.window.document.querySelector("#a")).not.toBeNull();
        expect(loadingClose).toHaveBeenCalledOnce();
        expect(context.V).toHaveBeenCalledOnce();
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

    it("uses legacy cache and isolates one failed score request", async () => {
        const fetchScore = vi.fn(id => "bad" === id ? Promise.reject(new Error("500")) : Promise.resolve({ score: 3.5, watchedCount: 7 }));
        const movies = [movie("cached"), movie("bad"), movie("good")], { plugin, $, storage } = loadHitShow({ movies, fetchScore, cache: { cached: { html: "4.2分，由88人评价", watchedCount: 88 } } });
        $(".container").append(`<div class="movie-list">${plugin.markDataListHtml(movies)}</div>`);
        await expect(plugin.loadScore(movies)).resolves.toBeUndefined();
        expect(fetchScore).not.toHaveBeenCalledWith("cached");
        expect($("#cached").attr("data-jhs-rate-count")).toBe("88");
        expect($("#bad").attr("data-jhs-rate-count")).toBe("0");
        expect($("#good").attr("data-jhs-rate-count")).toBe("7");
        expect(JSON.parse(storage.get("jhs_score_info")).good.watchedCount).toBe(7);
    });

    it("sorts once after scores only for rate-count mode", async () => {
        for (const [sortMethod, expected] of [["rateCount", 2], ["date", 1]]) {
            const { plugin, sortItems } = loadHitShow({ movies: [movie("a")], sortMethod, fetchScore: vi.fn().mockResolvedValue({ score: 4, watchedCount: 9 }) });
            await plugin.handlePlayback();
            await vi.waitFor(() => expect(sortItems).toHaveBeenCalledTimes(expected));
        }
    });

    it("binds the shared detail navigation instead of forcing new tabs", async () => {
        const { plugin, listPage } = loadHitShow({ movies: [movie("a")] });
        await plugin.handlePlayback();
        expect(listPage.bindMovieDetailNavigation).toHaveBeenCalledOnce();
        expect(plugin.markDataListHtml([movie("a")])).not.toContain('target="_blank"');
    });
});
