// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";

const html = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javstore/search-dmm-prefix.html"), "utf8");
const candidate = "https://javstore.net/594423-[FHD/SD]-NHDTC-262-Fixture-pn.html";
const imageUrl = "https://pics.dmm.co.jp/mono/movie/adult/1nhdtc262/1nhdtc262pl.jpg";

it("accepts the observed NHDTC-262 card with a DMM maker-prefixed cover ID", () => {
    expect(parseJavStoreSearch(html, "NHDTC-262")).toEqual([candidate]);
});

it.each(["118nhdtc262/118nhdtc262pl", "1nhdtc262/1nhdtc262ps"])("recognizes matching DMM cover ID structure %s", path => {
    expect(parseJavStoreSearch(html.replace("1nhdtc262/1nhdtc262pl", path), "NHDTC-262")).toEqual([candidate]);
});

it.each([
    "https://other.example/mono/movie/adult/1nhdtc262/1nhdtc262pl.jpg",
    "https://pics.dmm.co.jp.evil.example/mono/movie/adult/1nhdtc262/1nhdtc262pl.jpg",
    "https://user@pics.dmm.co.jp/mono/movie/adult/1nhdtc262/1nhdtc262pl.jpg",
    "https://pics.dmm.co.jp/other/1nhdtc262/1nhdtc262pl.jpg",
    "https://pics.dmm.co.jp/mono/movie/adult/1nhdtc263/1nhdtc263pl.jpg",
    "https://pics.dmm.co.jp/mono/movie/adult/1nhdtc262/1nhdtc263pl.jpg",
    "https://pics.dmm.co.jp/mono/movie/adult/1nhdtc262/1nhdtc262-other.jpg",
])("retains conflicting image evidence from %s", src => {
    expect(parseJavStoreSearch(html.replace(imageUrl, src), "NHDTC-262")).toEqual([]);
});

it.each([
    html.replace("NHDTC-262-Fixture-pn.html", "NHDTC-263-Fixture-pn.html"),
    html.replace("</a>", " NHDTC-263</a>"),
    html.replace('alt="[FHD/SD] NHDTC-262 Fixture"', 'alt="NHDTC-263"'),
    html.replace('<img src=', '<img title="NHDTC-263" src='),
    html.replace("</a>", '<img src="https://other.example/NHDTC-263.jpg"></a>'),
])("does not let DMM equivalence override conflicting card identity", card => {
    expect(parseJavStoreSearch(card, "NHDTC-262")).toEqual([]);
});

it("preserves a genuine numeric-prefix movie identity without stripping its first digit", () => {
    const card = html.replaceAll("NHDTC-262", "1NHDTC-262");
    expect(parseJavStoreSearch(card, "1NHDTC-262")).toEqual([candidate.replace("NHDTC-262", "1NHDTC-262")]);
    expect(parseJavStoreSearch(card, "NHDTC-262")).toEqual([]);
    expect(parseJavStoreSearch(card.replaceAll("1nhdtc262", "11nhdtc262"), "1NHDTC-262")).toEqual([]);
});
