// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createTorrentSourcesAdapter, parseBtsowSource, parseTorrentSource } from "../../src/integrations/torrent-sources/manifest.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/torrent-sources/results.html"), "utf8");
const sukebei = readFileSync(join(import.meta.dirname, "../fixtures/integrations/torrent-sources/sukebei-comments.html"), "utf8");

it("reads Sukebei resource titles rather than comment links and skips incomplete rows", async () => {
    const results = parseTorrentSource(sukebei, "1234567", "sukebei");
    expect(results.map(result => result.title)).toEqual(["FC2-PPV-1234567 中文字幕样本", "FC2-PPV-1234567 no comments", "FC2 1234567 文本标题"]);
    expect(results[0]).toMatchObject({ source: "sukebei", seeders: 12, leechers: 3, size: "1.5 GiB" });
    const request = vi.fn(async () => ({ data: sukebei }));
    await expect(createTorrentSourcesAdapter({ request }).search("sukebei", "1234567")).resolves.toEqual(results);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://sukebei.nyaa.si/?f=0&c=0_0&q=1234567" }), undefined);
});

it("retains other HTML source parsing and successful empty Sukebei results", () => {
    for (const source of ["u9a9", "u3c3"]) expect(parseTorrentSource(fixture, "ABC-123", source)).toHaveLength(1);
    expect(parseTorrentSource("<h3>No results found</h3>", "1234567", "sukebei")).toEqual([]);
});

it("normalizes HTML and JSON torrent source contracts", () => {
    expect(parseTorrentSource(fixture, "ABC-123", "u9a9")).toEqual([expect.objectContaining({ title: "ABC-123 sample", source: "u9a9", seeders: 12, leechers: 3 })]);
    expect(parseBtsowSource({ data: [{ name: "ABC-123", hash: "0123456789abcdef0123456789abcdef01234567", size: 1073741824, lastUpdateTime: 1787529600 }] })).toEqual([
        expect.objectContaining({ title: "ABC-123", source: "btsow", size: "1.00 GB" }),
    ]);
});

it("routes canonical and overridden sources through the correct URL policy", async () => {
    const request = vi.fn(async options => ({ data: fixture, finalUrl: options.url })), adapter = createTorrentSourcesAdapter({ request });
    await adapter.search("u9a9", "ABC-123", { scope: "scope" });
    expect(request.mock.calls[0][0]).toMatchObject({ providerId: "magnet:u9a9", capability: "magnet.search", urlPolicy: { trustClass: "builtin-public", hosts: ["u9a9.com"], expectedOrigin: "https://u9a9.com" } });
    await adapter.search("u9a9", "ABC-123", { baseUrl: "https://mirror.example.com", scope: "scope" });
    expect(request.mock.calls[1][0].urlPolicy).toEqual({ trustClass: "custom-public", expectedOrigin: "https://mirror.example.com" });
    expect(adapter.targetUrl("btsow", "ABC 123")).toBe("https://so2.btsow.top/search?key=ABC%20123");
});
