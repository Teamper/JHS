import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";

async function render(html, url, favorites = [], blacklist = []) {
    const dom = new JSDOM(html, { url });
    const scope = new LifecycleScope("compatibility-test");
    const controller = new CompatibilityController({
        document: dom.window.document, window: dom.window, location: dom.window.location,
        site: "javdb", route: "list", host: {}, style: { register: () => () => {} },
        state: { getFavoriteActressList: async () => favorites, getBlacklist: async () => blacklist },
        notifications: { ok() {}, error() {} }, ui: { openImageViewer() {}, confirm() {} },
        scope, diagnostics: { recordError: vi.fn() },
    });
    await controller.decorateActresses();
    return { dom, window: dom.window, scope, controller };
}

describe("actress status decoration", () => {
    it("decorates the actor profile once and never decorates filter links", async () => {
        const { window } = await render('<div class="actor-section-name">演员甲</div><div class="toolbar"><a href="/actors/abc123?sort=release">发布日期排序</a><a href="/actors/abc123?sort=score">评分排序</a><a href="/actors/abc123?type=playable">可播放</a></div>', "https://javdb.com/actors/abc123", [{ starId: "abc123" }], [{ starId: "abc123" }]);
        const $ = (selector) => window.document.querySelectorAll(selector);
        expect($(".actor-section-name .jhs-badge--fav")).toHaveLength(1);
        expect($(".actor-section-name .jhs-badge--danger")).toHaveLength(1);
        expect($(".toolbar")[0].textContent).not.toContain("已关注");
        expect($(".toolbar")[0].textContent).not.toContain("已拉黑");
    });

    it("decorates only real actor cards and decodes IDs from links", async () => {
        const { window } = await render('<div class="actor-box"><a href="/actors/a">A</a></div><div class="actor-box"><a href="/actors/b">B</a></div><div class="actor-box"><a href="/actors/a%2Fb">C</a></div><nav><a href="/actors/a">nav</a></nav>', "https://javdb.com/actors", [{ starId: "a" }, { starId: "a/b" }], [{ starId: "b" }]);
        const $ = (selector) => window.document.querySelectorAll(selector);
        expect($(".actor-box")[0].textContent).toContain("已关注");
        expect($(".actor-box")[1].textContent).toContain("已拉黑");
        expect($(".actor-box")[2].textContent).toContain("已关注");
        expect($("nav")[0].textContent).toBe("nav");
    });
});
