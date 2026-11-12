// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import jquery from "jquery";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";

const html = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javstore/search-dmm-padding.html"), "utf8");
const candidate = "https://javstore.net/505080-reducing-mosaic-sone917-fixture-pn.html";
const cover = "https://pics.dmm.co.jp/digital/video/sone00917/sone00917pl.jpg";

it("accepts the observed SONE-917 card with a zero-padded DMM digital cover ID", () => {
    expect(parseJavStoreSearch(html, "SONE-917")).toEqual([candidate]);
    expect(parseJavStoreSearch(jquery(html), "SONE-917")).toEqual([candidate]);
});

it.each([
    ["SONE-917", "sone00917", "ps"],
    ["SONE-0917", "sone00917", "pl"],
    ["SONE-00917", "sone00917", "pl"],
    ["SONE-1917", "sone01917", "pl"],
    ["SONE-10917", "sone10917", "pl"],
    ["SNOS-439", "snos00439", "pl"],
])("recognizes the structured DMM digital cover for %s", (carNum, cid, suffix) => {
    const card = html.replaceAll("SONE-917", carNum).replaceAll("sone917-fixture", `${carNum.toLowerCase().replace("-", "")}-fixture`)
        .replace(cover, `https://pics.dmm.co.jp/digital/video/${cid}/${cid}${suffix}.jpg`);
    expect(parseJavStoreSearch(card, carNum)).toHaveLength(1);
});

it.each([
    "https://other.example/digital/video/sone00917/sone00917pl.jpg",
    "https://pics.dmm.co.jp.evil.example/digital/video/sone00917/sone00917pl.jpg",
    "https://user@pics.dmm.co.jp/digital/video/sone00917/sone00917pl.jpg",
    "https://pics.dmm.co.jp/other/sone00917/sone00917pl.jpg",
    "https://pics.dmm.co.jp/digital/video/sone00918/sone00918pl.jpg",
    "https://pics.dmm.co.jp/digital/video/sone00917/sone00918pl.jpg",
    "https://pics.dmm.co.jp/digital/video/sone00918/sone00917pl.jpg",
    "https://pics.dmm.co.jp/digital/video/sone00917/sone00917-other.jpg",
    "https://pics.dmm.co.jp/digital/video/sone000917/sone000917pl.jpg",
    "https://pics.dmm.co.jp/digital/video/1sone00917/1sone00917pl.jpg",
])("retains conflicting image evidence from %s", src => {
    expect(parseJavStoreSearch(html.replace(cover, src), "SONE-917")).toEqual([]);
});

it.each([
    html.replace("sone917-fixture", "sone918-fixture"),
    html.replace("<h3>Reducing Mosaic SONE-917", "<h3>Reducing Mosaic SONE-918"),
    html.replace('alt="Reducing Mosaic SONE-917 Fixture"', 'alt="SONE-918"'),
    html.replace("<img src=", '<img title="SONE-918" src='),
    html.replace("</a>", '<img src="https://other.example/SONE-918.jpg"></a>'),
    html.replaceAll("SONE-917", "SONE-00917"),
    html.replace("sone917-fixture", "sone00917-fixture"),
])("does not let DMM padding override conflicting card identity", card => {
    expect(parseJavStoreSearch(card, "SONE-917")).toEqual([]);
});

it("reaches the screenshot adapter through the padded search cover", async () => {
    const image = "https://img.javstore.net/images/2025/09/22/ARCHIVE-MOSAIC-SONE-917_s.jpg";
    const request = vi.fn(async options => ({
        data: options.url.includes("/search?") ? html : `<main><a href="${image}">CLICK HERE!</a></main>`,
        finalUrl: options.url,
    }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "SONE-917" }))
        .resolves.toEqual([{ url: image, providerId: "javstore" }]);
    expect(request.mock.calls.map(([options]) => options.url))
        .toEqual(["https://javstore.net/search?q=SONE-917", candidate]);
});

it.each(["fhdsdsone917", "4ksone917"])("accepts only a known quality prefix in an article slug %s", slug => {
    const card = html.replace("reducing-mosaic-sone917-fixture", `${slug}-fixture`);
    expect(parseJavStoreSearch(card, "SONE-917")).toHaveLength(1);
    expect(parseJavStoreSearch(card.replace("<h3>Reducing Mosaic SONE-917", "<h3>SONE-918"), "SONE-917")).toEqual([]);
});
