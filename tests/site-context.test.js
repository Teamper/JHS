import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "../src/core/site-context.js"), "utf8");
const context = vm.createContext({ URL, window: { location: new URL("https://javdb.com/") } });
vm.runInContext(`${source}; globalThis.detectSiteForTest = detectSite;`, context);
const detectSite = context.detectSiteForTest;

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
