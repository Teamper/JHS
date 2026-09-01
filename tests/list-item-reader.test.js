import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it } from "vitest";
import { readListItem } from "../src/core/list-item-reader.js";

afterEach(() => { delete globalThis.$; });

function card(html) {
    const dom = new JSDOM(html), $ = jqueryFactory(dom.window);
    globalThis.$ = $;
    return $(dom.window.document.body).children().first();
}

describe("list item reader", () => {
    it("reads JavDB-style cards and preserves explicit FC2 source", () => {
        const item = card('<div data-jhs-fc2-source="123av"><a href="/v/a" title="标题"><div class="video-title"><strong>fc2-123</strong> fallback</div><div class="meta">2026-08-24</div></a></div>');
        expect(readListItem(item)).toMatchObject({ carNum: "FC2-123", url: "/v/a", title: "标题", publishTime: "2026-08-24", fc2Source: "123av" });
    });

    it("reads JavBus-style date nodes", () => {
        const item = card('<div><a href="/ABC-123"><img title="Bus title"></a><date>ABC-123</date><date>2026-8-4</date></div>');
        expect(readListItem(item)).toMatchObject({ carNum: "ABC-123", title: "Bus title", publishTime: "2026-8-4", fc2Source: "" });
    });

    it("rejects cards without an identity", () => expect(() => readListItem(card("<div></div>"))).toThrow("提取番号信息失败"));
});
