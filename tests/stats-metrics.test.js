import { describe, expect, it } from "vitest";
import { computeLibraryStats } from "../src/features/stats/stats-repository.js";

describe("computeLibraryStats frozen semantics", () => {
    it("separates raw and effective numerators for blocked records", () => {
        const stats = computeLibraryStats([
            { carNum: "A", stateFlags: { blocked: true, favorite: true, downloaded: true } },
            { carNum: "B", stateFlags: { favorite: true, downloaded: true, watched: true } },
            { carNum: "C", stateFlags: {} },
        ]);
        expect(stats.total).toBe(3);
        expect(stats.blocked).toBe(1);
        expect(stats.unblocked).toBe(2);
        expect(stats.favoriteRaw).toBe(2);
        expect(stats.favoriteEffective).toBe(1);
        expect(stats.downloadedRaw).toBe(2);
        expect(stats.downloadedEffective).toBe(1);
        expect(stats.watchedRaw).toBe(1);
        expect(stats.watchedEffective).toBe(1);
        expect(stats.pending).toBe(1);
    });

    it("pending excludes any-state records including blocked-only", () => {
        const stats = computeLibraryStats([
            { carNum: "A", stateFlags: { blocked: true } },
            { carNum: "B", stateFlags: { watched: true } },
            { carNum: "C", stateFlags: {} },
        ]);
        expect(stats.unblocked).toBe(2);
        expect(stats.pending).toBe(1);
        expect(stats.blocked).toBe(1);
    });

    it("handles empty and flagless input", () => {
        expect(computeLibraryStats([])).toEqual({
            total: 0, blocked: 0, unblocked: 0,
            favoriteRaw: 0, favoriteEffective: 0,
            downloadedRaw: 0, downloadedEffective: 0,
            watchedRaw: 0, watchedEffective: 0,
            pending: 0,
        });
        expect(computeLibraryStats([{ carNum: "A" }, { carNum: "B" }]).pending).toBe(2);
    });
});
