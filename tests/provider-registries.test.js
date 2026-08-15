import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function load(path, exports, extra = {}) {
    const context = vm.createContext({ URL, console, clog: { warn() {} }, ...extra });
    vm.runInContext(`${readFileSync(join(import.meta.dirname, "..", path), "utf8")};globalThis.result={${exports.join(",")}}`, context);
    return context.result;
}

describe("MagnetSourceRegistry", () => {
    const api = load("src/plugins/external-search/magnet-source-registry.js", ["MagnetSourceRegistry", "extractInfoHash", "deduplicateMagnetResults", "validateCustomMagnetSource", "applyMagnetRules", "parseCustomMagnetResponse"], { utils: {}, $: () => ({}) });
    it("sorts enabled providers and skips disabled providers", () => {
        const search = vi.fn(), registry = new api.MagnetSourceRegistry([
            { id: "late", name: "Late", enabled: true, priority: 20, search, targetUrl() {} },
            { id: "off", name: "Off", enabled: false, priority: 1, search, targetUrl() {} },
            { id: "first", name: "First", enabled: true, priority: 10, search, targetUrl() {} }
        ]);
        expect(Array.from(registry.getEnabledSources(), (item) => item.id)).toEqual(["first", "late"]);
    });
    it("deduplicates equal hex info hashes across sources", () => {
        const hash = "0123456789abcdef0123456789abcdef01234567";
        const results = api.deduplicateMagnetResults([
            { source: "a", magnet: `magnet:?xt=urn:btih:${hash}` },
            { source: "b", magnet: `magnet:?dn=x&xt=urn:btih:${hash.toUpperCase()}` }
        ]);
        expect(results).toHaveLength(1);
        expect(Array.from(results[0].sources)).toEqual(["a", "b"]);
    });
    it("rejects unsafe custom source URLs and unknown fields", () => {
        expect(() => api.validateCustomMagnetSource({ id: "x", parserType: "json", searchUrlTemplate: "javascript:alert(1)" })).toThrow();
        expect(() => api.validateCustomMagnetSource({ id: "x", parserType: "json", searchUrlTemplate: "https://x.test/{keyword}", run: "code" })).toThrow();
    });
    it("applies custom tag weights and non-destructive filters", () => {
        const result = api.applyMagnetRules({ title: "ABC 4K sample", files: [] }, [{ enabled: true, type: "contains", pattern: "4K", name: "4K", weight: 20 }], [{ enabled: true, type: "contains", pattern: "sample", action: "penalty", penalty: 30 }]);
        expect(result).toMatchObject({ tags: ["4K"], customTagWeight: 20, filterPenalty: 30, hidden: false });
        expect(result.title).toBe("ABC 4K sample");
    });
    it("maps declarative JSON sources without executing user code", () => {
        const results = api.parseCustomMagnetResponse({ name: "Test", parserType: "json", searchUrlTemplate: "https://x.test/{keyword}", targetUrlTemplate: "https://x.test/{keyword}", resultsPath: "data", titlePath: "name", hashPath: "hash", sizePath: "size" }, { data: [{ name: "ABC", hash: "0123456789abcdef0123456789abcdef01234567", size: "1 GB" }] }, "x");
        expect(Array.from(results)[0]).toMatchObject({ title: "ABC", source: "custom:x" });
    });
});

describe("ScreenshotProviderRegistry", () => {
    const { ScreenshotProviderRegistry } = load("src/plugins/image-viewer/screenshot-provider-registry.js", ["ScreenshotProviderRegistry"]);
    it("falls through misses and errors in priority order", async () => {
        const registry = new ScreenshotProviderRegistry([
            { id: "miss", name: "Miss", priority: 1, async getScreenshot() { return null; } },
            { id: "error", name: "Error", priority: 2, async getScreenshot() { throw new Error("404"); } },
            { id: "ok", name: "OK", priority: 3, async getScreenshot() { return { url: "https://img.test/a.jpg", source: "ok" }; } }
        ]);
        await expect(registry.first("ABC-1")).resolves.toMatchObject({ source: "ok" });
    });
});
