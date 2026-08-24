// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createTorrentSourcesAdapter, parseBtsowSource, parseTorrentSource } from "../../src/integrations/torrent-sources/manifest.js";

it("rejects malformed and blocked torrent source responses", () => {
    expect(() => parseTorrentSource(42, "ABC", "u9a9")).toThrow(/不是 HTML/);
    expect(() => parseTorrentSource("<title>Just a moment...</title>", "ABC", "u9a9")).toThrow(/Cloudflare/);
    expect(() => parseBtsowSource("not-json")).toThrow(/无效 JSON/);
    expect(() => parseBtsowSource({ ok: true })).toThrow(/结果数组/);
});

it("rejects unknown built-in source ids", async () => {
    const adapter = createTorrentSourcesAdapter({ request: async () => ({}) });
    await expect(adapter.search("unknown", "ABC")).rejects.toMatchObject({ code: "UNSUPPORTED" });
});
