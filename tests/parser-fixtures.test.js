import { normalizeJavStoreAssetUrl, parseJavStoreSearch, parseJavStorePreview } from "../src/integrations/javstore/parser.js";
import { parseHostListPage } from "../src/core/list-item-reader.js";
import { parse123AvCards, merge123AvCards, parse123AvSourceMaxPage, parse123AvVideoInfo } from "../src/integrations/av123/parser.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import jquery from "jquery";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixture = (name) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

const javdbPage = new JSDOM("", { url: "https://javdb.com/" });
const javdb = new JavDbHostAdapter(javdbPage.window.document, javdbPage.window.location);
beforeAll(() => vi.stubGlobal("DOMParser", javdbPage.window.DOMParser));
afterAll(() => { vi.unstubAllGlobals(); javdbPage.window.close(); });

const $ = jquery(javdbPage.window);
const parsePage = html => $(new DOMParser().parseFromString(html, "text/html"));

describe("third-party parser fixtures", () => {
    it("keeps matching JavStore candidates in document order", () => {
        const page = parsePage(fixture("javstore-search.html"));
        expect(Array.from(parseJavStoreSearch(page, "IPZZ-479"))).toEqual([
            "https://javstore.net/first-ipzz479-pn.html",
            "https://javstore.net/second-ipzz479-pn.html"
        ]);
    });

    it("absolutizes a preview and returns null when it is absent", () => {
        let page = parsePage(fixture("javstore-detail-with-preview.html"));
        expect(parseJavStorePreview(page, "https://javstore.net/item-pn.html")).toBe("https://img.javstore.net/preview.jpg");
        page = parsePage(fixture("javstore-detail-without-preview.html"));
        expect(parseJavStorePreview(page, "https://javstore.net/item-pn.html")).toBeNull();
    });

    it("upgrades only JavStore-owned HTTP previews to HTTPS", () => {
        let page = parsePage(fixture("javstore-detail-http-preview.html"));
        expect(parseJavStorePreview(page, "https://javstore.net/item-pn.html")).toBe("https://img2.javstore.net/preview.jpg");
        page = parsePage('<a href="http://images.example.net/preview.th.jpg">CLICK HERE!</a>');
        expect(parseJavStorePreview(page, "https://javstore.net/item-pn.html")).toBe("http://images.example.net/preview.jpg");
    });

    it("normalizes legacy JavStore assets without rewriting unrelated HTTP hosts", () => {
        expect(normalizeJavStoreAssetUrl("http://img.javstore.net/legacy.jpg")).toBe("https://img.javstore.net/legacy.jpg");
        expect(normalizeJavStoreAssetUrl("http://javstore.net/legacy.jpg")).toBe("https://javstore.net/legacy.jpg");
        expect(normalizeJavStoreAssetUrl("http://images.example.net/legacy.jpg")).toBe("http://images.example.net/legacy.jpg");
        expect(normalizeJavStoreAssetUrl("javascript:alert(1)")).toBeNull();
    });

    it("parses actor identity, aliases, relative resources and pagination", () => {
        const parsed = javdb.parseActorCollection(fixture("javdb-actor-list.html"), "https://javdb.com/users/collection_actors");
        expect(parsed.state).toBe("valid");
        expect(parsed.isEmpty).toBe(false);
        expect(JSON.parse(JSON.stringify(parsed.actors))).toEqual([{
            starId: "actor-1", name: "演员甲", allName: ["演员甲", "别名甲"], avatar: "https://javdb.com/actor.jpg",
            actressType: "uncensored", lastCheckTime: null, lastUpdateTime: null
        }]);
        expect(parsed.nextUrl).toBe("https://javdb.com/users/collection_actors?page=2");
    });

    it("distinguishes valid empty, challenge, login and malformed actor collection pages", () => {
        expect(javdb.parseActorCollection(fixture("javdb-empty-actor-list.html"), "https://javdb.com/users/collection_actors")).toMatchObject({ state: "valid", isEmpty: true, actors: [] });
        expect(javdb.parseActorCollection(fixture("cloudflare-challenge.html"), "https://javdb.com/users/collection_actors").state).toBe("challenge");
        expect(javdb.parseActorCollection(fixture("javdb-login.html"), "https://javdb.com/users/collection_actors").state).toBe("invalid");
        expect(javdb.parseActorCollection(fixture("javdb-malformed-actor-list.html"), "https://javdb.com/users/collection_actors").state).toBe("invalid");
    });

    it("distinguishes normal, valid empty and challenge pages", () => {
        const selectors = { boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item" };
        let page = parsePage(fixture("javdb-detail.html"));
        expect(parseHostListPage(page, selectors).state).toBe("valid");
        page = parsePage(fixture("javdb-empty-list.html"));
        expect(parseHostListPage(page, selectors)).toMatchObject({ state: "valid", isEmpty: true });
        page = parsePage(fixture("cloudflare-challenge.html"));
        expect(parseHostListPage(page, selectors).state).toBe("challenge");
    });

    it("parses the 12-card 123AV Chinese listing contract", () => {
        const items = parse123AvCards(fixture("123av-cards.html"), "https://123av.com");
        expect(items).toHaveLength(12);
        expect(items[0]).toMatchObject({
            carNum: "FC2-4959150",
            title: "中文标题",
            imgSrc: "https://icdn.123av.me/img2/s360/4959150/cover.jpg",
            href: "https://123av.com/cn/v/fc2-ppv-4959150"
        });
    });

    it("merges 123AV source pages by car number", () => {
        expect(Array.from(merge123AvCards([[{ carNum: "FC2-1", title: "旧" }], [{ carNum: "FC2-1", title: "新" }, { carNum: "FC2-2" }]]))).toEqual([
            { carNum: "FC2-1", title: "新" }, { carNum: "FC2-2" }
        ]);
    });

    it("reads the 123AV last page and input fallback", () => {
        let page = parsePage(fixture("123av-cards.html"));
        expect(parse123AvSourceMaxPage(page[0])).toBe(2756);
        expect(Math.ceil(parse123AvSourceMaxPage(page[0]) / 2)).toBe(1378);
        page = parsePage(fixture("123av-pager-input.html"));
        expect(parse123AvSourceMaxPage(page[0])).toBe(2756);
    });

    it("parses 123AV detail without requiring legacy media elements", () => {
        expect(parse123AvVideoInfo(fixture("123av-detail.html"), "https://123av.com/cn/v/fc2-ppv-4959150")).toEqual({
            id: "4959150", publishDate: "2026-08-11", title: "中文标题", moviePoster: null
        });
    });
});
