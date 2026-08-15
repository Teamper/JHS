import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jquery from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const fixture = (name) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const source = readFileSync(join(import.meta.dirname, "../src/parsers/third-party-parsers.js"), "utf8");

function loadParsers(html) {
    const dom = new JSDOM(html, { url: "https://javdb.com/" }), $ = jquery(dom.window);
    const context = vm.createContext({ URL, $, A: "uncensored", D: "censored", normalizeCarNum: (value) => value?.trim() || null });
    vm.runInContext(`${source}; globalThis.parsers = { normalizeJavStoreAssetUrl, parseJavStoreSearch, parseJavStorePreview, parseJavDbActorList, parseDetailPage, parse123AvCards, merge123AvCards, parse123AvSourceMaxPage, parse123AvVideoInfo };`, context);
    return { ...context.parsers, $page: $(dom.window.document) };
}

describe("third-party parser fixtures", () => {
    it("keeps matching JavStore candidates in document order", () => {
        const { parseJavStoreSearch, $page } = loadParsers(fixture("javstore-search.html"));
        expect(Array.from(parseJavStoreSearch($page, "IPZZ-479"))).toEqual([
            "https://javstore.net/first-ipzz479-pn.html",
            "https://javstore.net/second-ipzz479-pn.html"
        ]);
    });

    it("absolutizes a preview and returns null when it is absent", () => {
        let loaded = loadParsers(fixture("javstore-detail-with-preview.html"));
        expect(loaded.parseJavStorePreview(loaded.$page, "https://javstore.net/item-pn.html")).toBe("https://img.javstore.net/preview.jpg");
        loaded = loadParsers(fixture("javstore-detail-without-preview.html"));
        expect(loaded.parseJavStorePreview(loaded.$page, "https://javstore.net/item-pn.html")).toBeNull();
    });

    it("upgrades only JavStore-owned HTTP previews to HTTPS", () => {
        let loaded = loadParsers(fixture("javstore-detail-http-preview.html"));
        expect(loaded.parseJavStorePreview(loaded.$page, "https://javstore.net/item-pn.html")).toBe("https://img2.javstore.net/preview.jpg");
        loaded = loadParsers('<a href="http://images.example.net/preview.th.jpg">CLICK HERE!</a>');
        expect(loaded.parseJavStorePreview(loaded.$page, "https://javstore.net/item-pn.html")).toBe("http://images.example.net/preview.jpg");
    });

    it("normalizes legacy JavStore assets without rewriting unrelated HTTP hosts", () => {
        const { normalizeJavStoreAssetUrl } = loadParsers("");
        expect(normalizeJavStoreAssetUrl("http://img.javstore.net/legacy.jpg")).toBe("https://img.javstore.net/legacy.jpg");
        expect(normalizeJavStoreAssetUrl("http://javstore.net/legacy.jpg")).toBe("https://javstore.net/legacy.jpg");
        expect(normalizeJavStoreAssetUrl("http://images.example.net/legacy.jpg")).toBe("http://images.example.net/legacy.jpg");
        expect(normalizeJavStoreAssetUrl("javascript:alert(1)")).toBeNull();
    });

    it("parses actor identity, aliases, relative resources and pagination", () => {
        const { parseJavDbActorList, $page } = loadParsers(fixture("javdb-actor-list.html"));
        const parsed = parseJavDbActorList($page, "https://javdb.com/users/collection_actors");
        expect(JSON.parse(JSON.stringify(parsed.actors))).toEqual([{
            starId: "actor-1", name: "演员甲", allName: ["演员甲", "别名甲"], avatar: "/actor.jpg",
            actressType: "uncensored", lastCheckTime: null, lastUpdateTime: null
        }]);
        expect(parsed.nextUrl).toBe("https://javdb.com/users/collection_actors?page=2");
    });

    it("distinguishes normal, valid empty and challenge pages", () => {
        const selectors = { boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item" };
        let loaded = loadParsers(fixture("javdb-detail.html"));
        expect(loaded.parseDetailPage(loaded.$page, selectors).state).toBe("valid");
        loaded = loadParsers(fixture("javdb-empty-list.html"));
        expect(loaded.parseDetailPage(loaded.$page, selectors)).toMatchObject({ state: "valid", isEmpty: true });
        loaded = loadParsers(fixture("cloudflare-challenge.html"));
        expect(loaded.parseDetailPage(loaded.$page, selectors).state).toBe("challenge");
    });

    it("parses the 12-card 123AV Chinese listing contract", () => {
        const { parse123AvCards, $page } = loadParsers(fixture("123av-cards.html"));
        const items = Array.from(parse123AvCards($page, "https://123av.com"));
        expect(items).toHaveLength(12);
        expect(items[0]).toMatchObject({
            carNum: "FC2-4959150",
            title: "中文标题",
            imgSrc: "https://icdn.123av.me/img2/s360/4959150/cover.jpg",
            href: "https://123av.com/cn/v/fc2-ppv-4959150"
        });
    });

    it("merges 123AV source pages by car number", () => {
        const { merge123AvCards } = loadParsers("");
        expect(Array.from(merge123AvCards([[{ carNum: "FC2-1", title: "旧" }], [{ carNum: "FC2-1", title: "新" }, { carNum: "FC2-2" }]]))).toEqual([
            { carNum: "FC2-1", title: "新" }, { carNum: "FC2-2" }
        ]);
    });

    it("reads the 123AV last page and input fallback", () => {
        let loaded = loadParsers(fixture("123av-cards.html"));
        expect(loaded.parse123AvSourceMaxPage(loaded.$page)).toBe(2756);
        expect(Math.ceil(loaded.parse123AvSourceMaxPage(loaded.$page) / 2)).toBe(1378);
        loaded = loadParsers(fixture("123av-pager-input.html"));
        expect(loaded.parse123AvSourceMaxPage(loaded.$page)).toBe(2756);
    });

    it("parses 123AV detail without requiring legacy media elements", () => {
        const loaded = loadParsers(fixture("123av-detail.html"));
        expect(loaded.parse123AvVideoInfo(loaded.$page, "https://123av.com/cn/v/fc2-ppv-4959150")).toEqual({
            id: "4959150", publishDate: "2026-08-11", title: "中文标题", moviePoster: null
        });
    });
});
