// @vitest-environment jsdom

import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryController } from "../src/features/library/library-controller.js";

function loadImporter(html = '<div class="movie-list"><div class="item"><a href="/v/a"><div class="video-title"><strong>ABC-1</strong></div><div class="meta">2026</div></a></div></div>', responses = [], path = "/users/watched_videos") {
    const dom = new JSDOM(html, { url: `https://javdb.com${path}` }), patch = vi.fn(async () => {}), get = vi.fn(async () => ({ data: responses.shift() }));
    const controller = new LibraryController({
        hostAdapter: { site: "javdb", document: dom.window.document, location: dom.window.location, getListSelectors: () => ({ itemSelector: ".movie-list .item" }) },
        state: { patch }, http: { request: get }, route: "other", scope: { assertActive: vi.fn(), addCleanup: vi.fn() },
    });
    vi.stubGlobal("utils", { sleep: vi.fn(async () => {}) });
    vi.stubGlobal("show", { info: vi.fn(), ok: vi.fn(), error: vi.fn() });
    vi.stubGlobal("clog", { error: vi.fn() });
    return { controller, patch, get };
}

describe("JavDB status imports", () => {
    it.each([["favorite", { favorite: true }], ["watched", { watched: true }]])("maps %s directly without legacy downloaded projection", async (flag, expected) => {
        const { controller, patch } = loadImporter(undefined, [], flag === "favorite" ? "/users/want_watch_videos" : "/users/watched_videos");
        await controller.parseMovieList();
        expect(patch).toHaveBeenCalledWith("ABC-1", expected, expect.objectContaining({ type: "javdb-list-import" }));
        expect(patch.mock.calls[0][1].downloaded).toBeUndefined();
    });

    it("resolves only after all three pages have been imported", async () => {
        const page = (carNum, next = "") => `<div class="movie-list"><div class="item"><a href="/v/${carNum}"><div class="video-title"><strong>${carNum}</strong></div><div class="meta">2026</div></a></div></div>${next ? `<a class="pagination-next" href="${next}"></a>` : ""}`;
        const { controller, patch, get } = loadImporter(page("ABC-1", "https://javdb.com/p2"), [ page("ABC-2", "https://javdb.com/p3"), page("ABC-3") ]);
        const result = await controller.parseMovieList();
        expect(result).toEqual({ imported: 3, failed: 0, pages: 3 });
        expect(patch).toHaveBeenCalledTimes(3);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("rejects the whole import when fetching a later page fails", async () => {
        const { controller, get } = loadImporter('<div class="movie-list"></div><a class="pagination-next" href="https://javdb.com/p2"></a>');
        get.mockRejectedValueOnce(new Error("page failed"));
        await expect(controller.parseMovieList()).rejects.toThrow("page failed");
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});
