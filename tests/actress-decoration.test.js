import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jquery from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "../src/plugins/status/compat-enhancements.js"), "utf8");
async function render(html, url, favorites = [], blacklist = []) {
    const dom = new JSDOM(html, { url }), $ = jquery(dom.window);
    const context = vm.createContext({ window: dom.window, document: dom.window.document, URL, decodeURIComponent, $, BasePlugin: class { getPageInfo() { return {}; } }, storageManager: { getFavoriteActressList: async () => favorites, getBlacklist: async () => blacklist }, isDetailPage: false });
    vm.runInContext(`${source};globalThis.Plugin=CompatibilityEnhancementsPlugin`, context);
    await new context.Plugin().decorateActresses(); return $;
}
describe("actress status decoration", () => {
    it("decorates the actor profile once and never decorates filter links", async () => {
        const $ = await render('<div class="actor-section-name">演员甲</div><div class="toolbar"><a href="/actors/abc123?sort=release">发布日期排序</a><a href="/actors/abc123?sort=score">评分排序</a><a href="/actors/abc123?type=playable">可播放</a></div>', "https://javdb.com/actors/abc123", [{ starId: "abc123" }], [{ starId: "abc123" }]);
        expect($(".actor-section-name .jhs-badge--fav")).toHaveLength(1); expect($(".actor-section-name .jhs-badge--danger")).toHaveLength(1);
        expect($(".toolbar").text()).not.toContain("已关注"); expect($(".toolbar").text()).not.toContain("已拉黑");
    });
    it("decorates only real actor cards", async () => {
        const $ = await render('<div class="actor-box"><a href="/actors/a">A</a></div><div class="actor-box"><a href="/actors/b">B</a></div><nav><a href="/actors/a">nav</a></nav>', "https://javdb.com/actors", [{ starId: "a" }], [{ starId: "b" }]);
        expect($(".actor-box").eq(0).text()).toContain("已关注"); expect($(".actor-box").eq(1).text()).toContain("已拉黑"); expect($("nav").text()).toBe("nav");
    });
});
