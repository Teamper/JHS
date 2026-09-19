// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createTorrentSourcesAdapter, parseBtsowSource, parseTorrentSource } from "../../src/integrations/torrent-sources/manifest.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/torrent-sources/results.html"), "utf8");

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
    expect(adapter.targetUrl("btsow", "ABC 123")).toBe("https://btsow.lol/search/ABC%20123");
});
