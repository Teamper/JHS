import { detectSite } from "../src/core/site-context.js";
import { describe, expect, it } from "vitest";

describe("detectSite", () => {
    it.each([
        ["https://javdb.com/", "javdb"],
        ["https://javdb123.com/v/1", "javdb"],
        ["https://www.javbus.com/ABC", "javbus"],
        ["https://mirror.javsee.example/ABC", "javbus"],
        ["https://yun.123pan.com/", "123pan"],
        ["https://javtrailers.com/", "javtrailers"],
        ["https://subtitlecat.com/", "subtitlecat"]
    ])("recognizes %s", (url, site) => expect(detectSite(url).site).toBe(site));

    it("does not infer JavBus from a path or query string", () => {
        expect(detectSite("https://example.com/search?site=javbus").site).toBe("unknown");
        expect(detectSite("https://example.com/bus/route").isJavBus).toBe(false);
    });
});
