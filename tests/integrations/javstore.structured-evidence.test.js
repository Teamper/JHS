// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import jquery from "jquery";
import { expect, it, vi } from "vitest";
import { inspectJavStoreSearch, parseJavStoreSearch, parseJavStorePreview } from "../../src/integrations/javstore/parser.js";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";

const fixture = name => readFileSync(join(import.meta.dirname, "../fixtures/integrations/javstore", name), "utf8");
const msfh = fixture("msfh-search.html");
const tenn = fixture("tenn-search.html");
const urls = (html, code) => parseJavStoreSearch(html, code);
const msfhImage = "https://img.javstore.net/images/2025/12/04/MOSAIC-ARCHIVE-msfh-021_s.jpg";
const tennImage = "https://img2.javstore.net/images/2026/09/12/TENN-052.1080p_s.jpg";

it.each(["MSFH-021", "TENN-052"])("recognizes all actual search cards for %s in every supported document form", code => {
    const html = code === "MSFH-021" ? msfh : tenn;
    const expected = code === "MSFH-021" ? 4 : 2;
    for (const page of [html, new DOMParser().parseFromString(html, "text/html"), jquery(html)]) {
        expect(urls(page, code)).toHaveLength(expected);
    }
});

it.each(["Case01", "Case 01", "Ｃａｓｅ０１", "Case　01", "Part02", "Volume03", "Chapter04", "Disc05", "CD06", "Episode07", "Season08"])("reads chapter marker %s as prose after the primary identity", label => {
    expect(urls(msfh.replaceAll("Case01", label), "MSFH-021")).toHaveLength(4);
});

it.each(["CASE-01", "PART-02", "MSFH-022", "TENN-052"])("preserves explicit secondary code conflict %s", other => {
    expect(urls(msfh.replaceAll("Case01", other), "MSFH-021")).toEqual([]);
});

it("keeps a chapter-like primary identifier as a real movie code", () => {
    expect(urls('<a href="/CASE01-pn.html">CASE01 Fixture</a>', "CASE-01")).toEqual(["https://javstore.net/CASE01-pn.html"]);
    expect(urls('<a href="/MSFH021-pn.html">CASE01 Fixture</a>', "MSFH-021")).toEqual([]);
});

it.each([
    ["digital/video", "h_491tenn00052"], ["mono/movie/adult", "h_491tenn052"],
    ["digital/video", "1tenn00052"], ["mono/movie/adult", "118tenn00052"],
    ["digital/video", "tenn00052"], ["mono/movie/adult", "tenn052"],
])("normalizes CID aliases only in the complete DMM %s/%s cover structure", (directory, cid) => {
    const html = `<a href="/TENN052-pn.html"><h3>TENN-052 Fixture</h3><img src="https://pics.dmm.co.jp/${directory}/${cid}/${cid}pl.jpg"></a>`;
    expect(urls(html, "TENN-052")).toHaveLength(1);
    expect(urls(html.replaceAll(cid, cid.replace(/52$/, "53")), "TENN-052")).toEqual([]);
});

it.each([
    "https://pics.dmm.co.jp/mono/movie/adult/h_491tenn053/h_491tenn053pl.jpg",
    "https://pics.dmm.co.jp/digital/video/h_491tenn00052/h_491tenn00053pl.jpg",
    "https://pics.dmm.co.jp.evil.example/digital/video/h_491tenn00052/h_491tenn00052pl.jpg",
    "https://user@pics.dmm.co.jp/digital/video/h_491tenn00052/h_491tenn00052pl.jpg",
])("retains conflicting cover evidence for %s", cover => {
    const card = `<a href="/TENN052-pn.html"><h3>TENN-052 Fixture</h3><img src="${cover}"></a>`;
    expect(urls(card, "TENN-052")).toEqual([]);
});

it.each([["MSFH-021", msfh, 3, msfhImage, "msfh"], ["TENN-052", tenn, 1, tennImage, "tenn"]])("resolves %s through the actual ordered detail chain", async (code, html, detailCount, image, prefix) => {
    const candidates = urls(html, code);
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? html : fixture(`${prefix}-detail-${candidates.indexOf(options.url) + 1}.html`), finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: code })).resolves.toEqual([{ url: image, providerId: "javstore" }]);
    expect(request.mock.calls.map(([options]) => options.url)).toEqual([`https://javstore.net/search?q=${code}`, ...candidates.slice(0, detailCount)]);
});

it.each(["<h1>MSFH-021 Fixture</h1>", ""])("verifies opaque covers with article or image identity before accepting a preview %s", async title => {
    const html = '<a href="/MSFH021-pn.html"><h3>MSFH-021 Fixture</h3><img src="/opaque-cover.jpg"></a>';
    expect(inspectJavStoreSearch(html, "MSFH-021").candidates[0].requiresDetailIdentity).toBe(true);
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? html : `<main><article>${title}<a href="/images/${title ? "opaque" : "MSFH-021"}_s.jpg">CLICK HERE!</a></article></main>`, finalUrl: options.url }));
    expect((await createJavStoreAdapter({ request }).getImages({ carNum: "MSFH-021" }))[0].url).toContain("_s.jpg");
});

it("reports unverified opaque previews instead of accepting them", async () => {
    const html = '<a href="/MSFH021-pn.html"><h3>MSFH-021 Fixture</h3><img src="/opaque-cover.jpg"></a>';
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? html : '<main><article><a href="/opaque.jpg">CLICK HERE!</a></article></main>', finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "MSFH-021" })).rejects.toMatchObject({ code: "INVALID_RESPONSE", source: "javstore", details: { stage: "detail", reason: "identity", candidateCount: 1 } });
});

it("confines explicit links to the article and rejects contradictory detail titles", () => {
    const detail = '<main><article><h1>MSFH-021 Fixture Case01:CA</h1><a href="/MSFH-021_s.jpg">CLICK HERE!</a></article><aside><a href="/wrong.jpg">CLICK HERE!</a></aside></main>';
    expect(parseJavStorePreview(detail, "https://javstore.net/MSFH021-pn.html", "MSFH-021")).toBe("https://javstore.net/MSFH-021_s.jpg");
    expect(parseJavStorePreview(detail.replace("<h1>MSFH-021", "<h1>MSFH-022"), "https://javstore.net/MSFH021-pn.html", "MSFH-021")).toBeNull();
});

it.each([
    ['<main><h1>Search: MSFH-021</h1><div>Changed layout</div></main>', "structure"],
    ['<main><a href="/MSFH021-pn.html"><h3>MSFH-022</h3></a></main>', "identity"],
    ['<main><a href="/new-route"><h3>MSFH-021</h3></a></main>', "structure"],
])("reports bounded search diagnostics for %s", async (html, reason) => {
    const request = vi.fn(async options => ({ data: html, finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "MSFH-021" })).rejects.toMatchObject({ code: "INVALID_RESPONSE", details: { stage: "search", reason } });
    expect(request).toHaveBeenCalledOnce();
});

it("treats explicit empty searches and ordinary-photo-only details as empty results", async () => {
    const empty = '<main><h1>Search: MSFH-021</h1><p>No results found</p></main>';
    await expect(createJavStoreAdapter({ request: async () => ({ data: empty }) }).getImages({ carNum: "MSFH-021" })).resolves.toEqual([]);
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? '<a href="/MSFH021-pn.html">MSFH-021</a>' : fixture("msfh-detail-1.html"), finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "MSFH-021" })).resolves.toEqual([]);
});

it("returns empty for valid photo-only candidates even when other search cards conflict", async () => {
    const html = '<a href="/MSFH021-pn.html">MSFH-021</a><a href="/MSFH022-pn.html">MSFH-021</a>';
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? html : fixture("msfh-detail-1.html"), finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "MSFH-021" })).resolves.toEqual([]);
});

it("reports a detail layout change and keeps trying later candidates", async () => {
    const html = '<a href="/first-pn.html">MSFH-021</a><a href="/second-pn.html">MSFH-021</a>';
    const changed = '<main><h1>MSFH-021 Fixture</h1><div>Unsupported detail layout</div></main>';
    const request = vi.fn(async options => ({ data: options.url.includes("/search?") ? html : options.url.includes("first") ? changed : fixture("msfh-detail-3.html"), finalUrl: options.url }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "MSFH-021" })).resolves.toEqual([{ url: msfhImage, providerId: "javstore" }]);
    const failed = createJavStoreAdapter({ request: async options => ({ data: options.url.includes("/search?") ? html : changed, finalUrl: options.url }) });
    await expect(failed.getImages({ carNum: "MSFH-021" })).rejects.toMatchObject({ details: { stage: "detail", reason: "structure", unrecognizedCount: 2 } });
});
