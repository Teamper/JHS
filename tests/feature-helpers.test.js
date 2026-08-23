import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const warnings = [], notices = [];
const context = vm.createContext({ URL, window: { location: { href: "https://javdb.com/" } }, encodeURIComponent, normalizeCarNum: value => typeof value === "string" && value.trim() && !["null", "undefined"].includes(value.trim().toLowerCase()) ? value.trim() : null, escapeHtml: value => value, clog: { warn: (...args) => warnings.push(args), debug: () => {} }, show: { error: message => notices.push(message) } });
const source = readFileSync(join(import.meta.dirname, "../src/core/feature-helpers.js"), "utf8");
vm.runInContext(`${source};globalThis.api={mapLimit,parseNumberSetting,parseTaskTimestamp,shouldSkipStopped,selectLatestPublishTime,normalizeDmmCid,normalizeHttpUrl,normalizeBtihHash,resolveHighResCover,parseCarNumberText,buildFallbackCarUrl,linkCommentImageReferences,safePlay}`, context);
const api = context.api;

describe("feature helpers", () => {
    it("parses task settings and timestamps without losing zero or downgrade compatibility", () => {
        expect(api.parseNumberSetting("0", 8760, { min: 0 })).toBe(0);
        expect(api.parseNumberSetting("0", 12, { min: Number.EPSILON })).toBe(12);
        expect(api.parseTaskTimestamp("2026-08-23 13:20:00")).toBe(new Date(2026, 7, 23, 13, 20, 0).getTime());
        expect(api.parseTaskTimestamp(String(1787462400000))).toBe(1787462400000);
        expect(api.parseTaskTimestamp("invalid")).toBeNull();
    });
    it("shares stopped detection and selects the maximum valid publication date", () => {
        const now = new Date("2026-08-23T00:00:00Z").getTime();
        expect(api.shouldSkipStopped("2020-01-01", 0, now)).toBe(false);
        expect(api.shouldSkipStopped("2020-01-01", 8760, now)).toBe(true);
        expect(api.shouldSkipStopped("invalid", 8760, now)).toBe(false);
        expect(api.selectLatestPublishTime(["2026-08-01", "invalid", "2026-09-03", "2026-08-20"])).toBe("2026-09-03");
    });
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
