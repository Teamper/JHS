import { describe, expect, it, vi } from "vitest";
import { LibraryStatsService } from "../src/services/library-stats-service.js";

describe("library stats read service", () => {
    it("loads the 6.5.1 library snapshot through read-only domain operations", async () => {
        const storage = {
            getCarList: vi.fn(async () => [{ carNum: "ABC-1" }]),
            getFavoriteActressList: vi.fn(async () => [{ starId: "actor-1" }]),
            getBlacklist: vi.fn(async () => [{ starId: "actor-2" }]),
        };
        const state = { getActivityLog: vi.fn(async () => ({ entries: [] })) };
        const service = new LibraryStatsService({ storage, state });

        await expect(service.loadSnapshot()).resolves.toEqual({
            cars: [{ carNum: "ABC-1" }],
            actresses: [{ starId: "actor-1" }],
            blacklist: [{ starId: "actor-2" }],
            activity: { entries: [] },
        });
        expect(storage.getCarList).toHaveBeenCalledOnce();
        expect(storage.getFavoriteActressList).toHaveBeenCalledOnce();
        expect(storage.getBlacklist).toHaveBeenCalledOnce();
        expect(state.getActivityLog).toHaveBeenCalledOnce();
    });

    it("counts pending new videos with the same canonical state and decision rules as the workspace", async () => {
        const storage = {
            getFavoriteActressList: vi.fn(async () => [
                { newVideoList: [" ab-001 ", { carNum: "AB-001" }, "WATCHED-002", "IGNORED-003", "SNOOZED-004", "EXPIRED-005"] },
                { newVideoList: ["AB-001", "AB-006"] },
            ]),
        };
        const now = Date.parse("2026-09-28T00:00:00Z");
        const state = {
            getCarMap: vi.fn(async () => new Map([["WATCHED-002", { stateFlags: { watched: true } }]])),
            getNewVideoDecisions: vi.fn(async () => ({
                "IGNORED-003": { action: "ignored" },
                "SNOOZED-004": { action: "snoozed", until: "2026-09-29T00:00:00Z" },
                "EXPIRED-005": { action: "snoozed", until: "2026-09-27T00:00:00Z" },
            })),
        };
        const service = new LibraryStatsService({ storage, state });

        await expect(service.getPendingNewVideoTotal(now)).resolves.toBe(3);
        expect(storage.getFavoriteActressList).toHaveBeenCalledOnce();
        expect(state.getCarMap).toHaveBeenCalledOnce();
        expect(state.getNewVideoDecisions).toHaveBeenCalledOnce();
    });
});
