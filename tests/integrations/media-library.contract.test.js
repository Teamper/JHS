import { expect, it, vi } from "vitest";
import { createMediaLibraryAdapter } from "../../src/integrations/media-library/manifest.js";
import { matchesMediaItem, normalizeMediaConnection, mediaApiUrl } from "../../src/core/media-library-model.js";
import { readFile } from "node:fs/promises";

const connection = { id: "a", name: "本机", type: "jellyfin", address: "https://server.example/library/", apiKey: "fixture-api-key", userId: "user-a", enabled: true };
const fixture = JSON.parse(await readFile(new URL("../fixtures/integrations/media-library/items.json", import.meta.url), "utf8"));
it("reads the documented item envelope and metadata fields", async () => {
    const adapter = createMediaLibraryAdapter({ request: async () => ({ data: fixture }) });
    const result = await adapter.readPage(connection, { offset: 0 });
    expect(result).toEqual({ total: 2, items: fixture.Items });
    expect(result.items.filter(item => matchesMediaItem(item, "ABC-123"))).toHaveLength(1);
});

it.each(["jellyfin", "emby"])("uses %s header auth, exact redirect target and proxy prefix", async type => {
    const request = vi.fn(async options => ({ data: options.url.includes("System/Info") ? { Id: "server-a" } : { Items: [], TotalRecordCount: 0 } }));
    const adapter = createMediaLibraryAdapter({ request });
    const profile = normalizeMediaConnection({ ...connection, type });
    expect(await adapter.serverInfo(profile)).toEqual({ id: "server-a", name: "本机" });
    await adapter.readPage(profile, { offset: 20 });
    const options = request.mock.calls[1][0], url = new URL(options.url);
    expect(url.pathname).toBe(type === "emby" ? "/library/emby/Items" : "/library/Items");
    expect(url.searchParams.get(type === "emby" ? "UserId" : "userId")).toBe("user-a");
    expect(url.searchParams.get(type === "emby" ? "StartIndex" : "startIndex")).toBe("20");
    expect(url.searchParams.get(type === "emby" ? "Fields" : "fields")).toContain("Path");
    expect(options.headers).toEqual(type === "emby" ? { "X-Emby-Token": connection.apiKey } : { Authorization: `MediaBrowser Token="${connection.apiKey}"` });
    expect(options).toMatchObject({ requestOptions: { anonymous: true, redirect: "error", fetch: true }, retryCount: 0, urlPolicy: { trustClass: "user-local", expectedOrigin: url.origin, expectedUrl: url.href } });
    expect(options.url).not.toContain(connection.apiKey);
});
it("avoids adding Emby's prefix twice and preserves nested reverse proxy paths", () => {
    for (const suffix of ["emby/", "mediabrowser/"]) expect(mediaApiUrl({ ...connection, type: "emby", address: `https://server.example/a/${suffix}` }, "Items").pathname).toBe(`/a/${suffix}Items`);
    expect(mediaApiUrl({ ...connection, type: "emby", address: "https://server.example/emby-proxy/" }, "Items").pathname).toBe("/emby-proxy/emby/Items");
});
it.each(["https://user:key@server.example/path", "https://server.example/path?api_key=token", "https://server.example/path#token", "file:///private", "https://server.example/a/%2e%2e/", "https://server.example/a%2fb/"])("rejects ambiguous or credential-bearing address %s", address => {
    expect(() => normalizeMediaConnection({ ...connection, address })).toThrow();
});
it.each(['key"injection', "key\r\ninjection", "key\\injection"])("rejects invalid header credentials", apiKey => {
    expect(() => normalizeMediaConnection({ ...connection, apiKey })).toThrow();
});
it("uses name, original title, sources, provider IDs and complete FC2 identity", () => {
    expect(matchesMediaItem({ OriginalTitle: "ABC-123 标题" }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ ProviderIds: { javdb: "ABC-123" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ MediaSources: [{ Path: "/ABC123.mp4" }] }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "ABC-1234" }, "ABC-123")).toBe(false);
    expect(matchesMediaItem({ Name: "FC2-PPV-12345678" }, "FC2-1234567")).toBe(false);
});
it("keeps standard catalog IDs and NAS directory names separate from movie codes", () => {
    expect(matchesMediaItem({ Name: "ABC-123", Path: "\\\\NAS01\\JAV2023\\ABC123.mp4", ProviderIds: { Imdb: "tt1234567", Tmdb: "12345", Javdb: "opaque-id" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", Path: "/NAS01/ABC-123/影片.mkv", ProviderIds: { Imdb: "tt1234567" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { Imdb: "tt1234567" } }, "TT-1234567")).toBe(false);
});
it("keeps filename/title conflicts authoritative and uses the nearest numbered movie folder", () => {
    expect(matchesMediaItem({ Name: "ABC-123", Path: "/ABC-123/ABC-124.mp4" }, "ABC-123")).toBe(false);
    expect(matchesMediaItem({ Name: "本地译名", Path: "/ABC-123/ABC-124/影片.mkv" }, "ABC-123")).toBe(false);
    expect(matchesMediaItem({ Name: "本地译名", Path: "https://media.example/videos/ABC-123/影片.mkv?token=unrelated123" }, "ABC-123")).toBe(true);
});
it("uses explicitly named code fields and exact FC2 numeric IDs", () => {
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { MovieCode: "ABC123" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { FC2: "1234567" } }, "FC2-1234567")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { FC2: "12345678" } }, "FC2-1234567")).toBe(false);
});
