// @vitest-environment jsdom
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
