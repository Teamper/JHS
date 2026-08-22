import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadImporter(html = '<div class="movie-list"><div class="item"><a href="/v/a"><div class="video-title"><strong>ABC-1</strong></div><div class="meta">2026</div></a></div></div>', responses = []) {
    const dom = new JSDOM(html, { url: "https://javdb.com/users/watched_videos" }), $ = jqueryFactory(dom.window), patch = vi.fn().mockResolvedValue(), get = vi.fn();
    responses.forEach((response => get.mockResolvedValueOnce(response)));
    const context = vm.createContext({
        document: dom.window.document, window: dom.window, DOMParser: dom.window.DOMParser, $,
        BasePlugin: class { getSelector() { return { itemSelector: ".movie-list .item" }; } }, stateService: { patch }, gmHttp: { get }, utils: { q: vi.fn(), sleep: vi.fn(), htmlTo$dom: value => jqueryFactory(dom.window)(new dom.window.DOMParser().parseFromString(value, "text/html")) }, show: { info: vi.fn(), ok: vi.fn(), error: vi.fn() }, clog: { error: vi.fn() }, loading: () => ({ close() {} }), i: (target, key, value) => (target[key] = value), setTimeout, URL
    });
    vm.runInContext(`${readFileSync(join(process.cwd(), "src/plugins/status/want-and-watched-videos.js"), "utf8")};globalThis.Importer=WantAndWatchedVideosPlugin`, context);
    return { plugin: new context.Importer, patch, get };
}

describe("JavDB status imports", () => {
    it.each([["favorite", { favorite: true }], ["watched", { watched: true }]])("maps %s directly without legacy downloaded projection", async (flag, expected) => {
        const { plugin, patch } = loadImporter();
        plugin.flag = flag;
        await plugin.parseMovieList();
        expect(patch).toHaveBeenCalledWith("ABC-1", expected, expect.objectContaining({ type: "javdb-list-import" }));
        expect(patch.mock.calls[0][1].downloaded).toBeUndefined();
    });

    it("resolves only after all three pages have been imported", async () => {
        const page = (carNum, next = "") => `<div class="movie-list"><div class="item"><a href="/v/${carNum}"><div class="video-title"><strong>${carNum}</strong></div><div class="meta">2026</div></a></div></div>${next ? `<a class="pagination-next" href="${next}"></a>` : ""}`;
        const { plugin, patch, get } = loadImporter(page("ABC-1", "/p2"), [ page("ABC-2", "/p3"), page("ABC-3") ]);
        plugin.flag = "watched";
        const result = await plugin.parseMovieList();
        expect(result).toEqual({ imported: 3, failed: 0, pages: 3 });
        expect(patch).toHaveBeenCalledTimes(3);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("rejects the whole import when fetching a later page fails", async () => {
        const { plugin, get } = loadImporter('<div class="movie-list"></div><a class="pagination-next" href="/p2"></a>');
        get.mockRejectedValueOnce(new Error("page failed"));
        await expect(plugin.parseMovieList()).rejects.toThrow("page failed");
    });
});
