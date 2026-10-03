// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import manifest, { createTorrentSourcesAdapter, parseBtsowHtml } from "../src/integrations/torrent-sources/manifest.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";

const sample = name => readFileSync(join(import.meta.dirname, "fixtures/integrations/torrent-sources", name), "utf8");
const results = sample("btsow-results.html"), empty = sample("btsow-empty.html");

it("reads BTSOW hash links, title fallbacks and metadata without duplicate or incomplete rows", () => {
    expect(parseBtsowHtml(results)).toEqual([
        expect.objectContaining({ title: "Ubuntu 中文样本", magnet: "magnet:?xt=urn:btih:0123456789ABCDEF0123456789ABCDEF01234567", size: "1.50 GB", date: "2026-10-01", source: "btsow" }),
        expect.objectContaining({ title: "Ubuntu 属性标题", magnet: `magnet:?xt=urn:btih:${"A".repeat(32)}`, size: "512 MiB", date: "", source: "btsow" }),
    ]);
});

it("accepts a recognized successful empty search page", () => {
    expect(parseBtsowHtml(empty)).toEqual([]);
});

it.each([
    "<title>Btsow Lol</title><h1>Directory Index</h1>",
    "<title>BTSOW</title><iframe src='https://so2.btsow.top'></iframe>",
    "<title>BTSOW</title><form action='/search'><input name='key'></form><div id='app'>Homepage</div>",
    empty.replace("磁力搜索结果", "错误页面"),
    empty.replace("name=\"key\"", "name=\"other\""),
])("rejects an unrelated or changed page rather than returning empty", html => {
    expect(() => parseBtsowHtml(html)).toThrow(expect.objectContaining({ code: "INVALID_RESPONSE" }));
});

it("reports a changed result structure instead of claiming no results", () => {
    expect(() => parseBtsowHtml(empty.replace("</h4>", "</h4><div class='card2'>Unrecognized resource</div>")))
        .toThrow(expect.objectContaining({ code: "INVALID_RESPONSE" }));
});

it("preserves Cloudflare failure classification", () => {
    expect(() => parseBtsowHtml("<title>Just a moment...</title>"))
        .toThrow(expect.objectContaining({ code: "CF_BLOCKED" }));
});

it.each([undefined, "https://btsow.lol", "https://btsow.lol/"])("uses the verified GET endpoint including retired default overrides: %s", async baseUrl => {
    const request = vi.fn(async () => ({ data: results })), adapter = createTorrentSourcesAdapter({ request });
    const keyword = "Ubuntu 中文 & 123", url = "https://so2.btsow.top/search?key=Ubuntu%20%E4%B8%AD%E6%96%87%20%26%20123";
    await expect(adapter.search("btsow", keyword, { baseUrl, scope: "scope" })).resolves.toHaveLength(2);
    expect(request).toHaveBeenCalledExactlyOnceWith({
        capability: "magnet.search", providerId: "magnet:btsow", method: "GET", url, responseType: "text", cacheScope: "none",
        urlPolicy: { trustClass: "builtin-public", hosts: ["so2.btsow.top"], expectedOrigin: "https://so2.btsow.top" },
    }, "scope");
    expect(adapter.targetUrl("btsow", keyword, { baseUrl })).toBe(url);
    expect(manifest.hosts).toContain("so2.btsow.top");
    expect(manifest.hosts).not.toContain("btsow.lol");
});

it("retains user-selected mirrors with an exact custom origin", async () => {
    const request = vi.fn(async () => ({ data: empty })), adapter = createTorrentSourcesAdapter({ request });
    await adapter.search("btsow", "Ubuntu", { baseUrl: "https://mirror.example.com" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://mirror.example.com/search?key=Ubuntu", urlPolicy: { trustClass: "custom-public", expectedOrigin: "https://mirror.example.com" } }), undefined);
});

it("continues rejecting a cross-origin redirect through the real HTTP boundary", async () => {
    const request = vi.fn(async () => ({ status: 200, data: empty, finalUrl: "https://ads.example.com/" }));
    const adapter = createTorrentSourcesAdapter(new HttpService({ request }, new ExternalUrlPolicy()));
    await expect(adapter.search("btsow", "Ubuntu")).rejects.toMatchObject({ code: "INVALID_URL" });
    expect(request).toHaveBeenCalledTimes(1);
});

it("retains uncached BTSOW retries through the integration facade while keeping other source caching", async () => {
    const request = vi.fn(async () => ({ data: empty })), facade = createIntegrationRequestFacade({ request }, manifest);
    await createTorrentSourcesAdapter(facade).search("btsow", "Ubuntu");
    expect(request.mock.calls[0][0]).toMatchObject({ cacheScope: "none", ttlMs: 0 });
    await facade.request({ capability: "magnet.search", providerId: "magnet:sukebei", method: "GET", url: "https://sukebei.nyaa.si/" });
    expect(request.mock.calls[1][0]).toMatchObject({ cacheScope: "public", ttlMs: 21_600_000, cacheNamespace: "source" });
});
