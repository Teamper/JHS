import { describe, expect, it, vi } from "vitest";
import { StatsRepository } from "../src/features/stats/stats-repository.js";

describe("stats repository", () => {
    it("loads one consistent library snapshot through the domain storage contracts", async () => {
        const storage = {
            getCarList: vi.fn(async () => [{ carNum: "ABC-1" }]),
            getFavoriteActressList: vi.fn(async () => [{ starId: "actor-1" }]),
            getBlacklist: vi.fn(async () => [{ starId: "actor-2" }]),
        };
        const state = { getActivityLog: vi.fn(async () => ({ entries: [] })) };
        const repository = new StatsRepository({ storage, state });

        await expect(repository.loadLibrarySnapshot()).resolves.toEqual({
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
});
