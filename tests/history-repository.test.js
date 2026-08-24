import { describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "../src/features/history/history-repository.js";

describe("history repository", () => {
    it("centralizes history reads and mutations without changing state contracts", async () => {
        const storage = { getCarList: vi.fn(async () => [{ carNum: "ABC-1" }]) };
        const state = {
            getActivityLog: vi.fn(async () => ({ entries: [] })), getOfflineHistory: vi.fn(async () => []),
            undoTransaction: vi.fn(async () => ({ reverted: [], conflicts: [] })), remove: vi.fn(async () => ({ changed: ["ABC-1"] })),
            toggle: vi.fn(async () => ({})), patch: vi.fn(async () => ({})), removeOfflineHistory: vi.fn(async () => true),
        };
        const repository = new HistoryRepository({ storage, state });
        await expect(repository.list()).resolves.toEqual([{ carNum: "ABC-1" }]);
        await repository.activity(); await repository.offline(); await repository.undo("tx-1"); await repository.remove("ABC-1");
        await repository.toggle("ABC-1", "favorite", { type: "test" });
        await repository.patch(["ABC-1"], { favorite: true }, { type: "test" }); await repository.removeOffline("offline-1");
        expect(state.undoTransaction).toHaveBeenCalledWith("tx-1");
        expect(state.toggle).toHaveBeenCalledWith("ABC-1", "favorite", { type: "test" });
        expect(state.patch).toHaveBeenCalledWith(["ABC-1"], { favorite: true }, { type: "test" });
        expect(state.removeOfflineHistory).toHaveBeenCalledWith("offline-1");
    });
});
