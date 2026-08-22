import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
const source = readFileSync(join(import.meta.dirname, "../src/plugins/status/compat-enhancements.js"), "utf8");
const nav = readFileSync(join(import.meta.dirname, "../src/plugins/status/nav-bar.js"), "utf8");
describe("status and media UX contracts", () => {
    it("injects the single confirmed ad-container rule only on JavDB", async () => {
        const loadCss = async siteContext => {
            const context = vm.createContext({ BasePlugin: class {}, siteContext });
            vm.runInContext(`${source};globalThis.Plugin=CompatibilityEnhancementsPlugin`, context);
            return new context.Plugin().initCss();
        };
        const javdbCss = await loadCss({ isJavDB: true });
        expect(javdbCss).toContain(".sda-content");
        expect(javdbCss).toMatch(/display\s*:\s*none\s*!important/);
        expect(await loadCss({ isJavDB: false, isJavBus: true })).toBe("");
        expect(await loadCss({ isJavDB: false, is123Pan: true })).toBe("");
        const cleanup = source.slice(source.indexOf("async initCss()"), source.indexOf("async handle()"));
        expect(cleanup.match(/\.sda-content/g)).toHaveLength(1);
        expect(cleanup).not.toMatch(/MutationObserver|setInterval|href|https?:\/\//);
    });
    it("removes records through the transactional StateService", () => expect(source).toContain("stateService.remove(carNum)"));
    it("loads actress state once into sets", () => { expect(source).toContain("new Set((await storageManager.getFavoriteActressList())"); expect(source).toContain("new Set((await storageManager.getBlacklist())"); });
    it("links bounded comment images without rebuilding review DOM", () => { expect(source).toContain("createTreeWalker"); expect(source).toContain("SHOW_TEXT"); expect(source).toContain("showImageViewer"); expect(source).not.toContain("node.html("); });
    it("intercepts image paste only on the navigation search input", () => { expect(nav).toContain('$("#search-keyword").on("paste"'); expect(nav).toContain('type.indexOf("image")'); });
    it("uses configured 115 concurrency and cache lifetime", () => { const one15 = readFileSync(join(import.meta.dirname, "../src/plugins/one-one-five/plugins.js"), "utf8"); expect(one15).toContain("mapLimit(cards, this.concurrency"); expect(one15).toContain('getSetting("oneOneFiveConcurrency"'); expect(one15).toContain('getSetting("oneOneFiveCacheMinutes"'); expect(one15).toContain('rootMargin: "200px"'); });
});
