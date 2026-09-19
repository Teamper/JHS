import { describe, expect, it } from "vitest";
import { isSamePageUrl } from "../src/features/list/batch-scope.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";

// resolveFirstPageUrl 不触碰 DOM；node 环境显式传 null，避免默认参数引用 document/window。
const javdb = new JavDbHostAdapter(/** @type {any} */ (null), /** @type {any} */ (null));
const javbus = new JavBusHostAdapter(/** @type {any} */ (null), /** @type {any} */ (null));

describe("resolveFirstPageUrl (JavDbHostAdapter)", () => {
    it("drops the page query param and keeps other search conditions", () => {
        expect(javdb.resolveFirstPageUrl("https://javdb.com/actors/abc?page=3&v=1"))
            .toBe("https://javdb.com/actors/abc?v=1");
        expect(javdb.resolveFirstPageUrl("https://javdb.com/actors/abc?q=test&page=2"))
            .toBe("https://javdb.com/actors/abc?q=test");
        expect(javdb.resolveFirstPageUrl("https://javdb.com/actors/abc?page=1"))
            .toBe("https://javdb.com/actors/abc");
        expect(javdb.resolveFirstPageUrl("https://javdb.com/search?q=abc&page=5&f=all"))
            .toBe("https://javdb.com/search?q=abc&f=all");
    });
});

describe("resolveFirstPageUrl (JavBusHostAdapter)", () => {
    it("strips /page/N", () => {
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/page/3"))
            .toBe("https://www.javbus.com/");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/page/3?x=1"))
            .toBe("https://www.javbus.com/?x=1");
    });

    it("strips /star/<id>/N and other paged list prefixes", () => {
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/star/abc/3"))
            .toBe("https://www.javbus.com/star/abc");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/genre/xyz/2"))
            .toBe("https://www.javbus.com/genre/xyz");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/maker/m/4"))
            .toBe("https://www.javbus.com/maker/m");
    });

    it("strips search/director/studio/label paged routes", () => {
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/search/ABC/3"))
            .toBe("https://www.javbus.com/search/ABC");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/director/x/3"))
            .toBe("https://www.javbus.com/director/x");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/studio/x/3"))
            .toBe("https://www.javbus.com/studio/x");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/label/x/3"))
            .toBe("https://www.javbus.com/label/x");
    });

    it("handles site/language prefixed paths such as /en/...", () => {
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/en/search/ABC/3"))
            .toBe("https://www.javbus.com/en/search/ABC");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/en/page/3"))
            .toBe("https://www.javbus.com/en");
    });

    it("leaves unpaged and unknown URLs untouched", () => {
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/star/abc"))
            .toBe("https://www.javbus.com/star/abc");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/abc-123"))
            .toBe("https://www.javbus.com/abc-123");
        expect(javbus.resolveFirstPageUrl("https://www.javbus.com/search/ABC"))
            .toBe("https://www.javbus.com/search/ABC");
        expect(javbus.resolveFirstPageUrl("not-a-url"))
            .toBe("not-a-url");
    });
});

describe("isSamePageUrl", () => {
    it("ignores trailing slashes and hashes", () => {
        expect(isSamePageUrl("https://javdb.com/actors/abc", "https://javdb.com/actors/abc/")).toBe(true);
        expect(isSamePageUrl("https://javdb.com/actors/abc#top", "https://javdb.com/actors/abc")).toBe(true);
    });

    it("treats different queries as different pages", () => {
        expect(isSamePageUrl("https://javdb.com/actors/abc?page=3", "https://javdb.com/actors/abc")).toBe(false);
        expect(isSamePageUrl("https://javdb.com/actors/abc?v=1", "https://javdb.com/actors/abc?v=2")).toBe(false);
    });
});
