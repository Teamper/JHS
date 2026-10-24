// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import jquery from "jquery";
import { parseJavStorePreview, parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";

const html = readFileSync(join(import.meta.dirname,"../fixtures/integrations/javstore/search-article-ids.html"), "utf8");
const candidates = ["455954-reducing-mosaic", "458181-sub", "454426-fhdsd", "461479-reducing-mosaic"].map(prefix => `https://javstore.net/${prefix}-ipzz479-fixture-pn.html`);

it("does not treat public article IDs and numeric thumbnail filenames as conflicting movie numbers", () => {
    expect(parseJavStoreSearch(html, "IPZZ-479")).toEqual(candidates);
});

it("preserves all roots of detached legacy jQuery HTML responses", () => {
    expect(jquery(html).length).toBeGreaterThan(1);
    expect(parseJavStoreSearch(jquery(html), "IPZZ-479")).toEqual(candidates);
    const detail = jquery('<meta charset="utf-8"><section><a href="/preview.th.jpg">CLICK HERE!</a></section>');
    expect(parseJavStorePreview(detail, "https://javstore.net/455954-ipzz479-pn.html", "IPZZ-479")).toBe("https://javstore.net/preview.jpg");
});

it("resolves the actual article-ID URL shape through the adapter and legacy explicit preview link", async () => {
    const image = "https://img.javstore.net/images/2025/02/13/MOSAIC-ARCHIVE-ipzz-479_s.jpg";
    const request = vi.fn(async options => ({data:options.url.includes("/search?") ? html : `<a href="${image}">CLICK HERE!</a>`,finalUrl:options.url}));
    await expect(createJavStoreAdapter({request}).getImages({carNum:"IPZZ-479"})).resolves.toEqual([{url:image,providerId:"javstore"}]);
    expect(request.mock.calls.map(([options])=>options.url)).toEqual(["https://javstore.net/search?q=IPZZ-479",candidates[0]]);
});

it("ignores article IDs for FC2 aliases while keeping every movie digit exact", () => {
    const page = '<main><div class="grid"><a href="/455954-FC2-PPV-1234567-pn.html">FC2-1234567</a><a href="/455955-FC2-PPV-12345678-pn.html">FC2-12345678</a></div></main>';
    expect(parseJavStoreSearch(page,"FC2-PPV-1234567")).toEqual(["https://javstore.net/455954-FC2-PPV-1234567-pn.html"]);
});
