import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { Fc2By123AvPlugin } from "../src/plugins/external-search/fc2-by-123av.js";

afterEach(() => vi.unstubAllGlobals());

describe("123AV external catalog rendering", () => {
    it("escapes external labels and rejects executable URLs", () => {
        const dom = new JSDOM("<body></body>", { url: "https://javdb.com/tags/fc2?c10=1&jhs_source=123av" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        const plugin = new Fc2By123AvPlugin();
        const html = plugin.markDataListHtml([
            { url: "javascript:alert(1)", imageUrl: "javascript:alert(2)", title: "bad", carNum: "FC2-1" },
            { url: "https://123av.com/cn/v/fc2-ppv-2", imageUrl: "https://123av.com/poster.jpg", title: '<img src=x onerror="boom">', carNum: "FC2-2" },
        ]);
        dom.window.document.body.innerHTML = html;
        const cards = dom.window.document.querySelectorAll(".item");
        expect(cards).toHaveLength(1);
        expect(cards[0].querySelector(".video-title").textContent).toContain('<img src=x onerror="boom">');
        expect(cards[0].querySelector(".video-title img")).toBeNull();
        expect(cards[0].querySelector("a").getAttribute("href")).toBe("https://123av.com/cn/v/fc2-ppv-2");
        expect(cards[0].querySelector(".cover img").getAttribute("src")).toBe("https://123av.com/poster.jpg");
    });
});
