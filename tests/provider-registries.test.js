import { MagnetSourceRegistry, deduplicateMagnetResults, validateCustomMagnetSource, applyMagnetRules, parseCustomMagnetResponse } from "../src/services/magnet-source-registry.js";
import { describe, expect, it, vi } from "vitest";

describe("MagnetSourceRegistry", () => {
    it("sorts enabled providers and skips disabled providers", () => {
        const search = vi.fn(), registry = new MagnetSourceRegistry([
            { id: "late", name: "Late", enabled: true, priority: 20, search, targetUrl() {} },
            { id: "off", name: "Off", enabled: false, priority: 1, search, targetUrl() {} },
            { id: "first", name: "First", enabled: true, priority: 10, search, targetUrl() {} }
        ]);
        expect(Array.from(registry.getEnabledSources(), (item) => item.id)).toEqual(["first", "late"]);
    });
    it("deduplicates equal hex info hashes across sources", () => {
        const hash = "0123456789abcdef0123456789abcdef01234567";
        const results = deduplicateMagnetResults([
            { source: "a", magnet: `magnet:?xt=urn:btih:${hash}` },
            { source: "b", magnet: `magnet:?dn=x&xt=urn:btih:${hash.toUpperCase()}` }
        ]);
        expect(results).toHaveLength(1);
        expect(Array.from(results[0].sources)).toEqual(["a", "b"]);
    });
    it("rejects unsafe custom source URLs and unknown fields", () => {
        expect(() => validateCustomMagnetSource({ id: "x", parserType: "json", searchUrlTemplate: "javascript:alert(1)" })).toThrow();
        expect(() => validateCustomMagnetSource({ id: "x", parserType: "json", searchUrlTemplate: "https://x.test/{keyword}", run: "code" })).toThrow();
    });
    it("applies custom tag weights and non-destructive filters", () => {
        const result = applyMagnetRules({ title: "ABC 4K sample", files: [] }, [{ enabled: true, type: "contains", pattern: "4K", name: "4K", weight: 20 }], [{ enabled: true, type: "contains", pattern: "sample", action: "penalty", penalty: 30 }]);
        expect(result).toMatchObject({ tags: ["4K"], customTagWeight: 20, filterPenalty: 30, hidden: false });
        expect(result.title).toBe("ABC 4K sample");
    });
    it("maps declarative JSON sources without executing user code", () => {
        const results = parseCustomMagnetResponse({ name: "Test", parserType: "json", searchUrlTemplate: "https://x.test/{keyword}", targetUrlTemplate: "https://x.test/{keyword}", resultsPath: "data", titlePath: "name", hashPath: "hash", sizePath: "size" }, { data: [{ name: "ABC", hash: "0123456789abcdef0123456789abcdef01234567", size: "1 GB" }] }, "x");
        expect(Array.from(results)[0]).toMatchObject({ title: "ABC", source: "custom:x" });
    });
});

describe("ScreenshotService provider policy", () => {
    it("merges built-in sources with user config and keeps disabled providers out", async () => {
        const { ScreenshotService } = await import("../src/services/screenshot-service.js");
        const service = new ScreenshotService({ getAvailable: async () => [] }, null);
        const providers = service.getEnabledProviders({
            screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true, priority: 7 }]),
        });
        expect(providers.map((item) => item.id)).toEqual([ "javstore" ]);
        expect(providers[0].priority).toBe(7);
        expect(service.getEnabledProviders({ screenshotProviders: [{ id: "javstore", enabled: false }] })).toEqual([]);
    });
});
