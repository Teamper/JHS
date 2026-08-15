import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const warnings = [], notices = [];
const context = vm.createContext({ URL, window: { location: { href: "https://javdb.com/" } }, encodeURIComponent, normalizeCarNum: value => typeof value === "string" && value.trim() && !["null", "undefined"].includes(value.trim().toLowerCase()) ? value.trim() : null, escapeHtml: value => value, clog: { warn: (...args) => warnings.push(args), debug: () => {} }, show: { error: message => notices.push(message) } });
const source = readFileSync(join(import.meta.dirname, "../src/core/feature-helpers.js"), "utf8");
vm.runInContext(`${source};globalThis.api={mapLimit,normalizeDmmCid,normalizeHttpUrl,normalizeBtihHash,resolveHighResCover,parseCarNumberText,buildFallbackCarUrl,linkCommentImageReferences,safePlay}`, context);
const api = context.api;

describe("feature helpers", () => {
    it("limits concurrency while preserving order", async () => {
        let active = 0, max = 0;
        const result = await api.mapLimit([1, 2, 3, 4, 5], 2, async value => { active++; max = Math.max(max, active); await Promise.resolve(); active--; return value * 2; });
        expect(Array.from(result)).toEqual([2, 4, 6, 8, 10]); expect(max).toBeLessThanOrEqual(2);
    });
    it("creates prioritized DMM CID candidates", () => expect(Array.from(api.normalizeDmmCid("ABF-142"))).toEqual(["abf142", "abf00142", "abf0142"]));
    it("accepts only HTTP(S) URLs and supported BTIH hashes", () => {
        expect(api.normalizeHttpUrl("/cover.jpg")).toBe("https://javdb.com/cover.jpg");
        expect(api.normalizeHttpUrl("javascript:alert(1)")).toBeNull();
        expect(api.normalizeBtihHash("a".repeat(40))).toBe("A".repeat(40));
        expect(api.normalizeBtihHash("b".repeat(32))).toBe("B".repeat(32));
        expect(api.normalizeBtihHash("<script>")).toBeNull();
    });
    it("resolves common high resolution cover paths", () => expect(api.resolveHighResCover("https://img.test/thumbs/a/ps.jpg")).toBe("https://img.test/covers/a/pl.jpg"));
    it("parses newline, comma and space number lists with deduplication", () => {
        const result = api.parseCarNumberText("ABC-001\nABC-002，FC2-1234567 ABC-001 invalid");
        expect(Array.from(result.values)).toEqual(["ABC-001", "ABC-002", "FC2-1234567"]); expect(result.invalid).toContain("invalid");
        expect(api.buildFallbackCarUrl("ABC-001")).toContain("search?q=ABC-001");
    });
    it("links valid comment image references only", () => {
        expect(api.linkCommentImageReferences("图1 图二 图 9", 2)).toContain('data-image-index="0"');
        expect(api.linkCommentImageReferences("图1 图二 图 9", 2)).toContain("图 9");
    });
    it("handles media playback rejection without leaking a promise", async () => {
        warnings.length = 0; notices.length = 0;
        await expect(api.safePlay({ play: () => Promise.resolve() }, { notify: true })).resolves.toBe(true);
        await expect(api.safePlay({ play: () => Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" })) }, { notify: true })).resolves.toBe(false);
        expect(notices).toEqual([]);
        await expect(api.safePlay({ play: () => Promise.reject(Object.assign(new Error("unsupported"), { name: "NotSupportedError" })) }, { notify: true })).resolves.toBe(false);
        expect(notices).toEqual(["当前视频源无法播放"]);
        expect(warnings).toHaveLength(2);
    });
});
