// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import jquery from "jquery";
import { parseJavStorePreview, parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";

const fixture = name => readFileSync(join(import.meta.dirname, "../fixtures/integrations/javstore", name), "utf8");

it("unions legacy and main grid candidates in DOM order with safe URLs and consistent full identities", () => {
    const html = fixture("grid-search.html");
    const expected = ["https://javstore.net/legacy-ABC-123-pn.html?from=search", "https://javstore.net/grid-first.html", "https://javstore.net/abc_123-final.html"];
    expect(parseJavStoreSearch(html, "ABC-123")).toEqual(expected);
    const $ = jquery;
    expect(parseJavStoreSearch($(new DOMParser().parseFromString(html, "text/html")), "ABC-123")).toEqual(expected);
});

it.each([
    ["ABC-123", "ABC-1234", []],
    ["ABC-123", "XABC-123", []],
    ["ABC-123", "ABC-123x", []],
    ["ABC-123", "ＡＢＣ＿１２３", ["https://javstore.net/item.html"]],
    ["FC2-PPV-1234567", "FC2-1234567", ["https://javstore.net/item.html"]],
    ["FC2-1234567", "FC2 PPV 1234567", ["https://javstore.net/item.html"]],
    ["FC2-1234567", "1234567", []],
    ["1234567", "FC2-1234567", []],
    ["FC2-1234567", "FC2-12345678", []],
])("matches full target %s against %s", (target, title, expected) => {
    expect(parseJavStoreSearch(`<main><div class="grid"><a href="/item.html">${title}</a></div></main>`, target)).toEqual(expected);
});

it("does not use search queries as identity evidence or let a matching label override a conflicting URL or image", () => {
    const html = '<main><div class="grid"><a href="/item.html?q=ABC-123">Unknown</a><a href="/ABC-124.html?q=ABC-123">ABC-123</a><a href="/item2.html">ABC-123<img alt="ABC-124"></a></div></main>';
    expect(parseJavStoreSearch(html, "ABC-123")).toEqual([]);
});

it("applies full identity and URL restrictions to legacy candidates as well", () => {
    const html = '<a href="/ABC-1234-pn.html">ABC-1234</a><a href="https://outside.example/ABC-123-pn.html">ABC-123</a><a href="/ABC-124-pn.html">ABC-123</a><a href="/XABC-123-pn.html">XABC-123</a>';
    expect(parseJavStoreSearch(html, "ABC-123")).toEqual([]);
});

it("uses a unique verified main-content small preview unchanged, without following image-site pages", async () => {
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? '<main><div class="grid"><a href="/ABC-123.html">ABC-123</a></div></main>' : fixture("detail-small-preview.html"), finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "ABC-123" })).resolves.toEqual([{ url: "http://images.example/sheets/abc123_s.jpg?size=small#sheet", providerId: "javstore" }]);
    expect(request.mock.calls.map(([options]) => options.url)).toEqual(["https://javstore.net/search?q=ABC-123", "https://javstore.net/ABC-123.html"]);
});

it("keeps explicit CLICK HERE links first with both legacy punctuation forms", () => {
    for (const label of ["CLICK HERE!", "CLICK HERE"]) {
        expect(parseJavStorePreview(`<main><img src="/ABC-123_s.jpg"><a href="/preferred.th.jpg">${label}</a></main>`, "https://javstore.net/detail.html", "ABC-123")).toBe("https://javstore.net/preferred.jpg");
    }
});

it("skips conflicting or invalid explicit links before choosing a compatible preview", () => {
    expect(parseJavStorePreview(fixture("detail-conflicting-link.html"), "https://javstore.net/ABC-123-pn.html", "ABC-123")).toBe("https://img.javstore.net/ABC-123.jpg");
    expect(parseJavStorePreview('<main><a href="/XYZ-999_s.jpg">CLICK HERE!</a></main>', "https://javstore.net/ABC-123-pn.html", "ABC-123")).toBeNull();
    expect(parseJavStorePreview('<main><a href="/opaque.th.jpg" title="XYZ-999">CLICK HERE!</a></main>', "https://javstore.net/ABC-123-pn.html", "ABC-123")).toBeNull();
});

it.each([
    ['<main><img src="/unknown_s.jpg"></main>', null],
    ['<main><img src="/ABC-1234_s.jpg" alt="ABC-123"></main>', null],
    ['<main><img src="/ABC-123_s.jpg"><img src="/ABC-123-second_s.jpg"></main>', null],
    ['<main><a href="/ABC-123.html"><img src="/unknown_s.jpg"></a></main>', "https://javstore.net/unknown_s.jpg"],
    ['<main><a href="/wrong.html?q=ABC-123"><img src="/unknown_s.jpg"></a></main>', null],
    ['<main><a href=""><img src="/unknown_s.jpg"></a></main>', null],
    ['<main><img src="/ABC-123.jpg"></main>', null],
    ['<main><img src="/unknown_s.jpg" title="ＡＢＣ　１２３"></main>', "https://javstore.net/unknown_s.jpg"],
    ['<main><img src="/ABC-123_s.jpg"><img src="/ABC-123_s.jpg"></main>', "https://javstore.net/ABC-123_s.jpg"],
    ['<aside><img src="/ABC-123_s.jpg"></aside>', null],
])("bounds fallback selection for %s", (html, expected) => {
    expect(parseJavStorePreview(html, "https://javstore.net/detail.html", "ABC-123")).toBe(expected);
});

it("preserves cancellation instead of retrying the next detail candidate", async () => {
    const abort = Object.assign(new Error("cancelled"), { code: "ABORTED" });
    const scope = { disposed: false };
    const request = vi.fn().mockResolvedValueOnce({ data: '<a href="/first-pn.html">ABC-123</a><a href="/second-pn.html">ABC-123</a>', finalUrl: "https://javstore.net/search" }).mockRejectedValueOnce(abort);
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "ABC-123" }, { scope })).rejects.toBe(abort);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.every(([, actualScope]) => actualScope === scope)).toBe(true);
});

it("does not turn an empty owner href into identity evidence from the detail page URL", () => {
    expect(parseJavStorePreview('<main><a href=""><img src="/unknown_s.jpg"></a></main>', "https://javstore.net/ABC-123.html", "ABC-123")).toBeNull();
});

it.each(["?q=ABC-123", "#ABC-123", "javascript:ABC-123", "data:text/plain,ABC-123"])("does not infer fallback identity from non-path owner href %s", href => {
    expect(parseJavStorePreview(`<main><a href="${href}"><img src="/unknown_s.jpg"></a></main>`, "https://javstore.net/ABC-123.html", "ABC-123")).toBeNull();
});
