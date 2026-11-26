import { storageFromForage } from "./helpers/atomic-storage.js";
import { describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "../src/features/library/history-repository.js";
import { StateService } from "../src/core/state-service.js";

const forage = { getItem: vi.fn() };

function repositoryWith(stored) {
    forage.getItem.mockReset().mockImplementation(async key => key === "car_list" ? stored : null);
    const state = new StateService(storageFromForage(forage), {});
    return { repository: new HistoryRepository({ state }), forage };
}

describe("HistoryRepository", () => {
    it("reads the 6.5.1 car_list key through the injected state service", async () => {
        const record = { carNum: "ABC-123", status: "已看" };
        const { repository, forage } = repositoryWith([record]);

        await expect(repository.list()).resolves.toEqual([{ ...record, personalRating: null }]);
        expect(forage.getItem).toHaveBeenCalledWith("car_list");
    });

    it("treats malformed persisted list data as empty", async () => {
        const { repository } = repositoryWith({ carNum: "ABC-123" });
        await expect(repository.list()).resolves.toEqual([]);
    });
});
