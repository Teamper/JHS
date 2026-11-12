// @vitest-environment jsdom
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";

it("normalizes JavStore search results", () => {
    expect(parseJavStoreSearch('<a href="/ABC-123-pn.html">ABC-123</a>', "ABC-123")).toEqual(["https://javstore.net/ABC-123-pn.html"]);
});

it("owns the JavStore confirmation URL", () => {
    expect(createJavStoreAdapter({ request: async () => ({}) }).getSearchUrl({ carNum: "ABC 123" })).toBe("https://javstore.net/search?q=ABC%20123");
});

it("loads normalized images through the declared HTTP boundary", async () => {
    const request = vi.fn(async options => ({
        status: 200,
        data: options.url.includes("/search?") ? '<a href="/ABC-123-pn.html">ABC-123</a>' : '<a href="/images/ABC-123.th.jpg">CLICK HERE!</a>',
        finalUrl: options.url,
    }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "ABC-123" })).resolves.toEqual([
        { url: "https://javstore.net/images/ABC-123.jpg", providerId: "javstore" },
    ]);
    expect(request).toHaveBeenCalledTimes(2);
});

it("continues through candidates after missing or invalid details", async () => {
    const notFound = Object.assign(new Error("missing"), { code: "NOT_FOUND" });
    const request = vi.fn()
        .mockResolvedValueOnce({ data: '<a href="/first-pn.html">ABC-123</a><a href="/second-pn.html">ABC-123</a><a href="/third-pn.html">ABC-123</a>', finalUrl: "https://javstore.net/search?q=ABC-123" })
        .mockRejectedValueOnce(notFound)
        .mockResolvedValueOnce({ data: "<html></html>", finalUrl: "https://javstore.net/second-pn.html" })
        .mockResolvedValueOnce({ data: '<a href="/preview.th.jpg">CLICK HERE!</a>', finalUrl: "https://javstore.net/third-pn.html" });
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "ABC-123" })).resolves.toEqual([
        { url: "https://javstore.net/preview.jpg", providerId: "javstore" },
    ]);
    expect(request).toHaveBeenCalledTimes(4);
});

it.each(["FC2-4995326", "FC2-PPV-4995326"])("uses the full FC2 query to find the exact article for %s", async carNum => {
    const search = await readFile(resolve(import.meta.dirname, "../fixtures/integrations/javstore/search-fc2-4995326.html"), "utf8");
    const request = vi.fn(async options => ({
        data: options.url.includes("/search?") ? search : '<main><img src="http://img2.javstore.net/images/2026/10/22/fc2ppv-4995326_s.jpg" alt="FC2PPV-4995326"></main>',
        finalUrl: options.url,
    }));
    const adapter = createJavStoreAdapter({ request });
    expect(adapter.getSearchUrl({ carNum })).toBe("https://javstore.net/search?q=FC2-PPV-4995326");
    await expect(adapter.getImages({ carNum })).resolves.toEqual([{ url: "https://img2.javstore.net/images/2026/10/22/fc2ppv-4995326_s.jpg", providerId: "javstore" }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0].url).toContain("/594223-");
});
