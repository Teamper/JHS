// @vitest-environment jsdom
import jquery from "jquery";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { parseJavDbActorList } from "../../src/integrations/javdb/parser.js";
import { createJavDbAdapter } from "../../src/integrations/javdb/manifest.js";
import { AccountService } from "../../src/services/account-service.js";
import { JavDbHostAdapter } from "../../src/platform/hosts/javdb-host-adapter.js";

it("normalizes JavDB actor contracts", () => {
    const dom = new JSDOM('<div id="actors"><div class="actor-box"><a href="/actors/a1" title="Actor"><span class="info">有码</span></a></div></div>');
    expect(parseJavDbActorList(jquery(dom.window.document), "https://javdb.com")).toMatchObject({ state: "valid", actors: [{ starId: "a1", name: "Actor" }] });
});

it("owns JavDB list roots and creates host-compatible JHS list surfaces", () => {
    document.body.innerHTML = '<section><div class="container"><div class="movie-list"><article class="item"></article></div></div></section>';
    const host = new JavDbHostAdapter(document, window.location), owned = host.createOwnedListRoot(["jhs-owned-list"]);
    expect(host.locateListItems()).toHaveLength(1);
    expect(host.getListContainer()).toBe(document.querySelector(".container"));
    expect(host.getListLayoutContainer()).toBe(document.querySelector("section .container"));
    expect(owned.classList.contains("movie-list")).toBe(true);
    expect(owned.classList.contains("jhs-owned-list")).toBe(true);
});

it.each([
    "/advanced_search?type=3", "/advanced_search?type=100", "/want_watch_videos", "/watched_videos",
])("detects DOM-backed JavDB list route %s", (path) => {
    const dom = new JSDOM('<div class="movie-list"><article class="item"></article></div>', { url: `https://javdb.com${path}` });
    expect(new JavDbHostAdapter(dom.window.document, dom.window.location).detectRoute()).toBe("list");
});

it("keeps explicit detail routes ahead of incidental list markup", () => {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/v/test-id" });
    expect(new JavDbHostAdapter(dom.window.document, dom.window.location).detectRoute()).toBe("detail");
});

it("recognizes /users/collection_codes as owned-detail even when a movie-list exists", () => {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/users/collection_codes?movieId=1&carNum=FC2-123" });
    expect(new JavDbHostAdapter(dom.window.document, dom.window.location).detectRoute()).toBe("owned-detail");
});

it("normalizes JavDB host actor movies and uncollect mutations", async () => {
    const html = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javdb/actor-movies.html"), "utf8");
    const hostAdapter = new JavDbHostAdapter();
    expect(hostAdapter.parseActorMovies(html, "https://javdb.com")).toEqual([{
        carNum: "ABC-123", title: "Sample title", coverUrl: "https://javdb.com/covers/a.jpg", url: "https://javdb.com/v/a", publishTime: "2026-08-24",
        score: 0, voteCount: 0,
    }]);
    const request = vi.fn()
        .mockResolvedValueOnce({ data: html, finalUrl: "https://javdb.com/actors/a?t=d" })
        .mockResolvedValueOnce({ data: "removeClass", finalUrl: "https://javdb.com/actors/a/uncollect" });
    const adapter = createJavDbAdapter({ request }, () => "signature", hostAdapter);
    await expect(adapter.listActorMovies({ actorId: "a" }, { scope: "scope" })).resolves.toHaveLength(1);
    await expect(adapter.uncollectActor({ actorId: "a", csrfToken: "csrf" }, { scope: "scope" })).resolves.toEqual({ success: true });
    expect(request.mock.calls[0][0]).toMatchObject({ cacheScope: "public", urlPolicy: { trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: "https://javdb.com" } });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "POST", cacheScope: "none", headers: { "Content-Type": "application/json", "x-csrf-token": "csrf" } });
});

it("normalizes JavDB host actor collections with absolute URLs", () => {
    const hostAdapter = new JavDbHostAdapter(), parsed = hostAdapter.parseActorCollection(`
        <div id="actors"><div class="actor-box"><a title="Actor, Alias" href="/actors/a"><img src="/avatars/a.jpg"><span class="info">無碼</span></a></div></div>
        <a class="pagination-next" href="?page=2"></a>
    `, "https://javdb.com/users/collection_actors");
    expect(parsed).toMatchObject({ state: "valid", isEmpty: false, nextUrl: "https://javdb.com/users/collection_actors?page=2", actors: [{
        starId: "a", name: "Actor", allName: ["Actor", "Alias"], avatar: "https://javdb.com/avatars/a.jpg", actressType: "uncensored",
    }] });
});

it("normalizes JavDB login without caching credentials", async () => {
    const request = vi.fn(async options => ({ data: { success: 1, data: { token: "token" } }, finalUrl: options.url }));
    const adapter = createJavDbAdapter({ request }, () => "signature");
    await expect(adapter.login({ username: "user", password: "secret" }, { scope: "scope" })).resolves.toEqual({ success: true, token: "token", message: "" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", cacheScope: "none", urlPolicy: { trustClass: "builtin-public", hosts: ["jdforrepam.com"] } }), "scope");
    const login = vi.fn(async () => ({ success: true, token: "token" }));
    const service = new AccountService({ list: () => [{ id: "javdb" }], getAdapter: () => ({ login }) });
    await expect(service.login("javdb", { username: "user", password: "secret" })).resolves.toMatchObject({ success: true });
});

it("normalizes JavDB review and related API contracts through HttpService", async () => {
    const request = vi.fn()
        .mockResolvedValueOnce({ data: { data: { reviews: [{ username: "A", content: "text", score: 4, created_at: "2026-01-01", likes_count: 2 }] } } })
        .mockResolvedValueOnce({ data: { data: { lists: [{ id: 7, name: "List", movies_count: 3, collections_count: 2, views_count: 9, created_at: "2026-01-02" }] } } });
    const adapter = createJavDbAdapter({ request }, () => "signature");
    await expect(adapter.listReviews({ movieId: "m1" })).resolves.toEqual([{ author: "A", content: "text", score: 4, createdAt: "2026-01-01", likes: 2 }]);
    await expect(adapter.listRelated({ movieId: "m1" })).resolves.toEqual([{ id: "7", name: "List", movieCount: 3, collectionCount: 2, viewCount: 9, createdAt: "2026-01-02" }]);
    expect(request.mock.calls[0][0]).toMatchObject({ providerId: "javdb", cacheScope: "public", urlPolicy: { trustClass: "builtin-public", hosts: ["jdforrepam.com"] } });
});

it("resolves an exact normalized movie reference through the JavDB search contract", async () => {
    const request = vi.fn(async () => ({ data: { data: { movies: [{ id: 9, number: "ABC-123" }, { id: 10, number: "ABC-124" }] } } }));
    const adapter = createJavDbAdapter({ request }, () => "signature");
    await expect(adapter.resolveMovie({ carNum: "abc-123" })).resolves.toEqual({ carNum: "ABC-123", movieId: "9", providerId: "javdb" });
});

it("normalizes JavDB detail and magnet contracts", async () => {
    const request = vi.fn()
        .mockResolvedValueOnce({ data: { data: { movie: { id: 9, number: "ABC-123", title: "Display Title", origin_title: "Original Title", cover_url: "https://old/rhe951l4q/cover.jpg", actors: [{ id: 2, name: "Actor", gender: 0 }], preview_images: [{ large_url: "https://old/rhe951l4q/a.jpg" }], watched_count: 8 } } } })
        .mockResolvedValueOnce({ data: { data: { magnets: [{ hash: "abc", name: "Magnet", hd: true, cnsub: false, size: 2048, files_count: 2 }] } } });
    const adapter = createJavDbAdapter({ request }, () => "signature");
    await expect(adapter.getDetail({ movieId: "9" })).resolves.toMatchObject({ movieId: "9", carNum: "ABC-123", title: "Display Title", originalTitle: "Original Title", coverUrl: "https://c0.jdbstatic.com/cover.jpg", imageUrls: ["https://c0.jdbstatic.com/a.jpg"] });
    await expect(adapter.listMagnets({ movieId: "9" })).resolves.toEqual([{ hash: "abc", title: "Magnet", hasHdTag: true, hasSubtitleTag: false, createdAt: null, seeders: 0, sizeMb: 2048, fileCount: 2, providerId: "javdb" }]);
});

it("normalizes JavDB ranking contracts", async () => {
    const request = vi.fn(async () => ({ data: { data: { movies: [{ id: 9, number: "ABC-123", origin_title: "Title", cover_url: "https://old/rhe951l4q/a.jpg", has_cnsub: true, magnets_count: 2 }] } } }));
    await expect(createJavDbAdapter({ request }, () => "signature").listRankings({ period: "weekly" })).resolves.toEqual([
        { movieId: "9", carNum: "ABC-123", title: "Title", coverUrl: "https://c0.jdbstatic.com/a.jpg", releaseDate: null, hasSubtitle: true, magnetCount: 2, newMagnets: false, providerId: "javdb" },
    ]);
    expect(request.mock.calls[0][0].url).toContain("period=weekly");
});
