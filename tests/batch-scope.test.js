import { describe, expect, it } from "vitest";
import { isSamePageUrl, resolveFirstPageUrl } from "../src/features/list/batch-scope.js";

describe("resolveFirstPageUrl", () => {
    it("drops the page query param on JavDB and keeps other search conditions", () => {
        expect(resolveFirstPageUrl("https://javdb.com/actors/abc?page=3&v=1", "javdb"))
            .toBe("https://javdb.com/actors/abc?v=1");
        expect(resolveFirstPageUrl("https://javdb.com/actors/abc?q=test&page=2", "javdb"))
            .toBe("https://javdb.com/actors/abc?q=test");
        expect(resolveFirstPageUrl("https://javdb.com/actors/abc?page=1", "javdb"))
            .toBe("https://javdb.com/actors/abc");
    });

    it("strips JavBus /page/N", () => {
        expect(resolveFirstPageUrl("https://www.javbus.com/page/3", "javbus"))
            .toBe("https://www.javbus.com/");
        expect(resolveFirstPageUrl("https://www.javbus.com/page/3?x=1", "javbus"))
            .toBe("https://www.javbus.com/?x=1");
    });

    it("strips JavBus /star/<id>/N and other paged list prefixes", () => {
        expect(resolveFirstPageUrl("https://www.javbus.com/star/abc/3", "javbus"))
            .toBe("https://www.javbus.com/star/abc");
        expect(resolveFirstPageUrl("https://www.javbus.com/genre/xyz/2", "javbus"))
            .toBe("https://www.javbus.com/genre/xyz");
        expect(resolveFirstPageUrl("https://www.javbus.com/maker/m/4", "javbus"))
            .toBe("https://www.javbus.com/maker/m");
    });

    it("leaves unpaged and unknown URLs untouched", () => {
        expect(resolveFirstPageUrl("https://www.javbus.com/star/abc", "javbus"))
            .toBe("https://www.javbus.com/star/abc");
        expect(resolveFirstPageUrl("https://www.javbus.com/abc-123", "javbus"))
            .toBe("https://www.javbus.com/abc-123");
        expect(resolveFirstPageUrl("https://example.com/x?page=2", "unknown"))
            .toBe("https://example.com/x?page=2");
        expect(resolveFirstPageUrl("not-a-url", "javdb")).toBe("not-a-url");
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
