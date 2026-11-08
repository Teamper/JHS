import { describe, expect, it } from "vitest";
import { deduplicateMagnetResults, extractInfoHash } from "../src/services/magnet-source-registry.js";
import { magnetSizeBytes, selectMagnetResults } from "../src/ui/detail/magnet-results.js";

const link = hash => `magnet:?xt=urn:btih:${hash}`;
describe("magnet result identity and selection", () => {
    it("canonicalizes equivalent Base32 and hex hashes", () => {
        expect(extractInfoHash(link("A".repeat(32)))).toBe("0".repeat(40));
        expect(extractInfoHash(link("7".repeat(32)))).toBe("F".repeat(40));
        expect(extractInfoHash("invalid")).toBeNull();
        const results = deduplicateMagnetResults([
            { source: "first", magnet: link("A".repeat(32)), title: "preferred", size: "", files: ["a"] },
            { source: "second", magnet: link("0".repeat(40)), title: "other", size: "2 GiB", files: ["a", "b"] },
        ]);
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ title: "preferred", size: "2 GiB", sources: ["first", "second"], files: ["a", "b"] });
    });
    it("parses SI and binary sizes and sorts unknowns last in both directions", () => {
        expect(magnetSizeBytes("2 GiB")).toBe(2 * 1024 ** 3);
        expect(magnetSizeBytes("2 GB")).toBe(2e9);
        expect(magnetSizeBytes("unknown")).toBeNull();
        const records = [{ size: "unknown" }, { size: "2 GB" }, { size: "1 GB" }];
        expect(selectMagnetResults(records, "size-asc").map(item => item.size)).toEqual(["1 GB", "2 GB", "unknown"]);
        expect(selectMagnetResults(records, "size-desc").map(item => item.size)).toEqual(["2 GB", "1 GB", "unknown"]);
    });
    it("intersects quality dimensions and preserves the input array", () => {
        const records = [{ title: "4K 中字 破解", _score: { total: 10 } }, { title: "1080p 中字", _score: { total: 20 } }];
        expect(selectMagnetResults(records, "quality", ["4k", "subtitle", "uncensored"])).toEqual([records[0]]);
        expect(records[0].title).toBe("4K 中字 破解");
    });
    it("places unknown seeder counts after a real zero", () => {
        const records = [null, "", undefined, -1, 0, 7].map(seeders => ({ seeders }));
        expect(selectMagnetResults(records, "seeders").map(item => item.seeders)).toEqual([7, 0, null, "", undefined, -1]);
    });
});
