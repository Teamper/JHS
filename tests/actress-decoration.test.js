// @vitest-environment jsdom

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";

async function render(html, url, favorites = [], blacklist = []) {
    const dom = new JSDOM(html, { url });
    const controller = new CompatibilityController({
        hostAdapter: { site: "javdb", document: dom.window.document, location: dom.window.location },
        storage: { get: vi.fn(async key => ({ favorite_actresses: favorites, blacklist }[key] ?? [])) },
        state: {}, features: {}, styles: {}, route: "other",
        scope: { assertActive: vi.fn(), addCleanup: vi.fn() },
    });
    await controller.decorateActresses();
    return dom.window.document;
}
describe("actress status decoration", () => {
    it("decorates the actor profile once and never decorates filter links", async () => {
        const document = await render('<div class="actor-section-name">演员甲</div><div class="toolbar"><a href="/actors/abc123?sort=release">发布日期排序</a><a href="/actors/abc123?sort=score">评分排序</a><a href="/actors/abc123?type=playable">可播放</a></div>', "https://javdb.com/actors/abc123", [{ starId: "abc123" }], [{ starId: "abc123" }]);
        expect(document.querySelectorAll(".actor-section-name .jhs-badge--fav")).toHaveLength(1);
        expect(document.querySelectorAll(".actor-section-name .jhs-badge--danger")).toHaveLength(1);
        expect(document.querySelector(".toolbar")?.textContent).not.toContain("已关注");
        expect(document.querySelector(".toolbar")?.textContent).not.toContain("已拉黑");
    });
    it("decorates only real actor cards", async () => {
        const document = await render('<div class="actor-box"><a href="/actors/a">A</a></div><div class="actor-box"><a href="/actors/b">B</a></div><nav><a href="/actors/a">nav</a></nav>', "https://javdb.com/actors", [{ starId: "a" }], [{ starId: "b" }]);
        expect(document.querySelectorAll(".actor-box")[0].textContent).toContain("已关注");
        expect(document.querySelectorAll(".actor-box")[1].textContent).toContain("已拉黑");
        expect(document.querySelector("nav")?.textContent).toBe("nav");
    });
});
