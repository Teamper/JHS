import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import { parseJavDbActorList } from "../../src/integrations/javdb/parser.js";
import { createJavDbAdapter } from "../../src/integrations/javdb/manifest.js";

it("normalizes JavDB actor contracts", () => {
    const dom = new JSDOM('<div id="actors"><div class="actor-box"><a href="/actors/a1" title="Actor"><span class="info">有码</span></a></div></div>');
    expect(parseJavDbActorList(jquery(dom.window)(dom.window.document), "https://javdb.com")).toMatchObject({ state: "valid", actors: [{ starId: "a1", name: "Actor" }] });
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
        .mockResolvedValueOnce({ data: { data: { movie: { id: 9, number: "ABC-123", origin_title: "Title", actors: [{ id: 2, name: "Actor", gender: 0 }], preview_images: [{ large_url: "https://old/rhe951l4q/a.jpg" }], watched_count: 8 } } } })
        .mockResolvedValueOnce({ data: { data: { magnets: [{ hash: "abc", name: "Magnet", hd: true, cnsub: false, size: 2048, files_count: 2 }] } } });
    const adapter = createJavDbAdapter({ request }, () => "signature");
    await expect(adapter.getDetail({ movieId: "9" })).resolves.toMatchObject({ movieId: "9", carNum: "ABC-123", title: "Title", imageUrls: ["https://c0.jdbstatic.com/a.jpg"] });
    await expect(adapter.listMagnets({ movieId: "9" })).resolves.toEqual([{ hash: "abc", title: "Magnet", hasHdTag: true, hasSubtitleTag: false, createdAt: null, seeders: 0, sizeMb: 2048, fileCount: 2, providerId: "javdb" }]);
});

it("normalizes JavDB ranking contracts", async () => {
    const request = vi.fn(async () => ({ data: { data: { movies: [{ id: 9, number: "ABC-123", origin_title: "Title", cover_url: "https://old/rhe951l4q/a.jpg", has_cnsub: true, magnets_count: 2 }] } } }));
    await expect(createJavDbAdapter({ request }, () => "signature").listRankings({ period: "weekly" })).resolves.toEqual([
        { movieId: "9", carNum: "ABC-123", title: "Title", coverUrl: "https://c0.jdbstatic.com/a.jpg", releaseDate: null, hasSubtitle: true, magnetCount: 2, newMagnets: false, providerId: "javdb" },
    ]);
    expect(request.mock.calls[0][0].url).toContain("period=weekly");
});
