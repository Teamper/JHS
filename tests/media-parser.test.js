import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
const cases = JSON.parse(readTestFile(join(import.meta.dirname, "fixtures/media/cases.json"), "utf8"));
const helpers = readTestFile(join(import.meta.dirname, "../src/core/feature-helpers.js"), "utf8");
describe("media regression fixture matrix", () => {
    it("contains DMM, VR, FC2 and uncensored branches", () => { for (const key of ["dmm", "vr", "fc2", "uncensored"]) expect(cases[key].length).toBeGreaterThan(0); });
    it.each([
        ["https://www.prestige-av.com/images/corner/goods/abc/1.jpg?size=large#photo", "https://image.mgstage.com/images/abc/1.jpg?size=large#photo"],
        ["https://www.prestige-av.com/images/corner/goods/ABC.jpg", "https://image.mgstage.com/images/ABC.jpg"],
        ["http://www.prestige-av.com/images/corner/goods/1.jpg", "http://www.prestige-av.com/images/corner/goods/1.jpg"],
        ["https://prestige-av.com/images/corner/goods/1.jpg", "https://prestige-av.com/images/corner/goods/1.jpg"],
        ["https://www.prestige-av.com:8443/images/corner/goods/1.jpg", "https://www.prestige-av.com:8443/images/corner/goods/1.jpg"],
        ["https://user@www.prestige-av.com/images/corner/goods/1.jpg", "https://user@www.prestige-av.com/images/corner/goods/1.jpg"],
        ["https://www.prestige-av.com/images/corner/goods-old/1.jpg", "https://www.prestige-av.com/images/corner/goods-old/1.jpg"],
        ["https://www.prestige-av.com/other/images/corner/goods/1.jpg", "https://www.prestige-av.com/other/images/corner/goods/1.jpg"],
        ["https://other.example/images/corner/goods/1.jpg", "https://other.example/images/corner/goods/1.jpg"],
    ])("resolves JavBus Viewer image %s without rewriting host nodes", (url, expected) => {
        const dom = new JSDOM('<div class="container"><div class="row movie"></div><div id="sample-waterfall"><a class="sample-box"><img src="/thumb.jpg"></a></div></div>', { url: "https://www.javbus.com/ABC-123" });
        const anchor = dom.window.document.querySelector("a");
        anchor.setAttribute("href", url);
        expect(new JavBusHostAdapter(dom.window.document, dom.window.location).getDetailImageSequence().map(entry => entry.url)).toEqual([expected]);
        expect(anchor.getAttribute("href")).toBe(url);
        expect(anchor.querySelector("img").getAttribute("src")).toBe("/thumb.jpg");
        dom.window.close();
    });
    it("uses candidate CID without per-studio hardcoding", () => { expect(helpers).toContain("function normalizeDmmCid"); expect(helpers).not.toMatch(/NKNKJDVAJ.*===|MCHT.*===/); });
});
