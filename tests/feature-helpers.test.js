import { mapLimit, parseNumberSetting, parseTaskTimestamp, shouldSkipStopped, selectLatestPublishTime, normalizeHttpUrl, normalizeJavdbMediaUrl, normalizeBtihHash, parseCarNumberText, buildFallbackCarUrl, safePlay } from "../src/core/feature-helpers.js";
import { describe, expect, it } from "vitest";

const warnings = [], notices = [];

describe("feature helpers", () => {
    it("parses task settings and timestamps without losing zero or downgrade compatibility", () => {
        expect(parseNumberSetting("0", 8760, { min: 0 })).toBe(0);
        expect(parseNumberSetting("0", 12, { min: Number.EPSILON })).toBe(12);
        expect(parseTaskTimestamp("2026-08-23 13:20:00")).toBe(new Date(2026, 7, 23, 13, 20, 0).getTime());
        expect(parseTaskTimestamp(String(1787462400000))).toBe(1787462400000);
        expect(parseTaskTimestamp("invalid")).toBeNull();
    });
    it("shares stopped detection and selects the maximum valid publication date", () => {
        const now = new Date("2026-08-23T00:00:00Z").getTime();
        expect(shouldSkipStopped("2020-01-01", 0, now)).toBe(false);
        expect(shouldSkipStopped("2020-01-01", 8760, now)).toBe(true);
        expect(shouldSkipStopped("invalid", 8760, now)).toBe(false);
        expect(selectLatestPublishTime(["2026-08-01", "invalid", "2026-09-03", "2026-08-20"])).toBe("2026-09-03");
    });
    it("limits concurrency while preserving order", async () => {
        let active = 0, max = 0;
        const result = await mapLimit([1, 2, 3, 4, 5], 2, async value => { active++; max = Math.max(max, active); await Promise.resolve(); active--; return value * 2; });
        expect(Array.from(result)).toEqual([2, 4, 6, 8, 10]); expect(max).toBeLessThanOrEqual(2);
    });
    it("accepts only HTTP(S) URLs and supported BTIH hashes", () => {
        expect(normalizeHttpUrl("/cover.jpg", "https://javdb.com/")).toBe("https://javdb.com/cover.jpg");
        expect(normalizeHttpUrl("javascript:alert(1)", "https://javdb.com/")).toBeNull();
        expect(normalizeJavdbMediaUrl("https://jdforrepam.com/rhe951l4q/thumbs/a.jpg", "https://javdb.com/")).toBe("https://c0.jdbstatic.com/thumbs/a.jpg");
        expect(normalizeJavdbMediaUrl("https://c0.jdbstatic.com/covers/a.jpg", "https://javdb.com/")).toBe("https://c0.jdbstatic.com/covers/a.jpg");
        expect(normalizeBtihHash("a".repeat(40))).toBe("A".repeat(40));
        expect(normalizeBtihHash("b".repeat(32))).toBe("B".repeat(32));
        expect(normalizeBtihHash("<script>")).toBeNull();
    });
    it("parses newline, comma and space number lists with deduplication", () => {
        const result = parseCarNumberText("ABC-001\nABC-002，FC2-1234567 ABC-001 invalid");
        expect(Array.from(result.values)).toEqual(["ABC-001", "ABC-002", "FC2-1234567"]); expect(result.invalid).toContain("INVALID");
        expect(buildFallbackCarUrl("ABC-001")).toContain("search?q=ABC-001");
    });
    it("rejects label-only and prefix-only imports while retaining full nonhyphenated identities", () => {
        const parsed = parseCarNumberText("STUDIO-NAME FC2 FC2-PPV IPZZ HEYZO1234 1234567 ABC1234 ＡＢＣ＿１２３ FC2-PPV-1234567");
        expect(Array.from(parsed.values)).toEqual(["HEYZO-1234", "1234567", "ABC-1234", "ABC-123", "FC2-PPV-1234567"]);
        expect(Array.from(parsed.invalid)).toEqual(["STUDIO-NAME", "FC2", "FC2-PPV", "IPZZ"]);
    });
    it("handles media playback rejection without leaking a promise", async () => {
        warnings.length = 0; notices.length = 0;
        const feedback = { notify: true, notifyUser: message => notices.push(message), warn: (...args) => warnings.push(args) };
        await expect(safePlay({ play: () => Promise.resolve() }, feedback)).resolves.toBe(true);
        await expect(safePlay({ play: () => Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" })) }, feedback)).resolves.toBe(false);
        expect(notices).toEqual([]);
        await expect(safePlay({ play: () => Promise.reject(Object.assign(new Error("unsupported"), { name: "NotSupportedError" })) }, feedback)).resolves.toBe(false);
        expect(notices).toEqual(["当前视频源无法播放"]);
        expect(warnings).toHaveLength(2);
    });
});
