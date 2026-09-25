import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { classifyJavDbPage, isHitShowPage, isListPage, resolveLegacyJavDbUrl } from "../src/core/site-context.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";

const url = path => `https://javdb.com${path}`;

describe("JavDB page meanings", () => {
    it.each(["censored", "uncensored", "western", "fc2"].flatMap(category =>
        ["daily", "weekly", "monthly"].map(period => [category, period])
    ))("identifies Movies %s / %s independently of Playback", (category, period) => {
        expect(classifyJavDbPage(url(`/rankings/movies?p=${period}&t=${category}`))).toEqual({ kind: "movie-ranking", category, period });
        expect(isHitShowPage(url(`/rankings/movies?p=${period}&t=${category}`))).toBe(false);
    });

    it.each(["high_score", "all"].flatMap(filter =>
        ["daily", "weekly", "monthly"].map(period => [filter, period])
    ))("identifies Playback %s / %s", (filter, period) => {
        const href = url(`/rankings/playback?p=${period}&t=${filter}`);
        expect(classifyJavDbPage(href)).toEqual({ kind: "playback-ranking", filter, period });
        expect(isHitShowPage(href)).toBe(true);
        expect(isListPage(href)).toBe(true);
    });

    it.each([
        ["/rankings/top", "all", 1], ["/rankings/top?t=3&page=2", "3", 2],
        ["/rankings/top?t=y2026&page=7", "y2026", 7],
    ])("keeps TOP250 selection and pagination for %s", (path, selection, page) => {
        expect(classifyJavDbPage(url(path))).toEqual({ kind: "top250-ranking", selection, page });
    });

    it.each([
        ["/rankings/actors", "actor-ranking"], ["/rankings/fanza_award", "award-ranking"],
        ["/search_advanced?type=3", "advanced-search"], ["/tags/fc2?c10=1", "fc2-catalog"],
        ["/tags/fc2?c10=1&jhs_source=123av", "external-fc2-catalog"],
    ])("does not mistake %s for a film ranking", (path, kind) => {
        expect(classifyJavDbPage(url(path)).kind).toBe(kind);
    });

    it.each(["/rankings/actors", "/rankings/fanza_award"])("does not mount movie-list behavior on %s", path => {
        const dom = new JSDOM('<div class="movie-list"><div class="item"></div></div>', { url: url(path) });
        expect(new JavDbHostAdapter(dom.window.document, dom.window.location).detectRoute()).toBe("other");
    });

    it("keeps ordinary advanced search on the list route", () => {
        const dom = new JSDOM('<div class="movie-list"><div class="item"></div></div>', { url: url("/search_advanced?type=3") });
        expect(new JavDbHostAdapter(dom.window.document, dom.window.location).detectRoute()).toBe("list");
    });
});

describe("old links leave the 404 route before page mounting", () => {
    it("moves Playback with its period and original high-score default", () => {
        expect(resolveLegacyJavDbUrl(url("/advanced_search?handlePlayback=1&period=monthly")))
            .toBe(url("/rankings/playback?p=monthly&t=high_score"));
    });

    it.each([[1, 1], [2, 2], [3, 3], [4, 4], [5, 6]])("maps old TOP page %i to native page %i by the first rank", (oldPage, nativePage) => {
        const result = new URL(resolveLegacyJavDbUrl(url(`/advanced_search?handleTop=1&handleType=year&type_value=2026&page=${oldPage}&has_cnsub=1`)));
        expect(result.pathname).toBe("/rankings/top");
        expect(result.searchParams.get("t")).toBe("y2026");
        expect(Number(result.searchParams.get("page") || 1)).toBe(nativePage);
        expect(result.searchParams.get("jhs_subtitle")).toBe("with");
    });

    it("preserves a TOP category and the loaded-items exclusion filter", () => {
        const result = new URL(resolveLegacyJavDbUrl(url("/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=0")));
        expect(result.pathname).toBe("/rankings/top");
        expect(result.searchParams.get("t")).toBe("3");
        expect(result.searchParams.get("jhs_subtitle")).toBe("without");
    });

    it("moves normal advanced searches without reinterpreting FC2 type 3", () => {
        expect(resolveLegacyJavDbUrl(url("/advanced_search?type=3&keyword=FC2-123&page=2")))
            .toBe(url("/search_advanced?type=3&keyword=FC2-123&page=2"));
    });

    it("moves the historical 123AV marker to the explicit external catalog", () => {
        const result = new URL(resolveLegacyJavDbUrl(url("/advanced_search?type=100&released_start=2099-09&keyword=abc&page=2")));
        expect(result.pathname).toBe("/tags/fc2");
        expect(result.searchParams.get("jhs_source")).toBe("123av");
        expect(result.searchParams.get("c10")).toBe("1");
        expect(result.searchParams.get("keyword")).toBe("abc");
        expect(result.searchParams.get("page")).toBe("2");
    });

    it("leaves native URLs alone", () => {
        expect(resolveLegacyJavDbUrl(url("/rankings/movies?p=daily&t=fc2"))).toBeNull();
        expect(resolveLegacyJavDbUrl(url("/search_advanced?type=3"))).toBeNull();
    });
});
