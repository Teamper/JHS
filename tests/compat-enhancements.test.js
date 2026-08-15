import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = readFileSync(join(import.meta.dirname, "../src/plugins/status/compat-enhancements.js"), "utf8");
const nav = readFileSync(join(import.meta.dirname, "../src/plugins/status/nav-bar.js"), "utf8");
describe("status and media UX contracts", () => {
    it("removes records through StorageManager", () => expect(source).toContain("storageManager.removeCar(carNum)"));
    it("loads actress state once into sets", () => { expect(source).toContain("new Set((await storageManager.getFavoriteActressList())"); expect(source).toContain("new Set((await storageManager.getBlacklist())"); });
    it("links bounded comment images without rebuilding review DOM", () => { expect(source).toContain("createTreeWalker"); expect(source).toContain("SHOW_TEXT"); expect(source).toContain("showImageViewer"); expect(source).not.toContain("node.html("); });
    it("intercepts image paste only on the navigation search input", () => { expect(nav).toContain('$("#search-keyword").on("paste"'); expect(nav).toContain('type.indexOf("image")'); });
    it("uses configured 115 concurrency and cache lifetime", () => { const one15 = readFileSync(join(import.meta.dirname, "../src/plugins/one-one-five/plugins.js"), "utf8"); expect(one15).toContain("mapLimit(cards, concurrency"); expect(one15).toContain('getSetting("oneOneFiveConcurrency"'); expect(one15).toContain('getSetting("oneOneFiveCacheMinutes"'); });
});
