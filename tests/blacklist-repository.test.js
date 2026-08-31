import { describe, expect, it, vi } from "vitest";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { BlacklistRepository } from "../src/features/library/blacklist-repository.js";

function createRepository() {
    const values = new Map([
        ["blacklist", []],
        ["blacklist_car_list", []],
    ]);
    const mutation = new StorageMutationCoordinator({ lockManager: null });
    const eventBus = { emit: vi.fn(async () => {}) };
    const state = {
        removeFromNewVideoList: vi.fn((carNums, reason) => mutation.runExclusive(async () => ({ carNums, reason }))),
    };
    const storage = {
        get: vi.fn(async key => values.get(key)),
        set: vi.fn(async (key, value) => { values.set(key, value); }),
    };
    return { repository: new BlacklistRepository({ storage, state, eventBus, mutation }), storage, state, eventBus, values };
}

describe("BlacklistRepository", () => {
    it("writes generic storage keys and emits one invalidation event per actor mutation", async () => {
        const { repository, storage, eventBus } = createRepository();
        await repository.add({ starId: "a", name: "演员甲", role: "actress", movieType: "censored", url: "https://javdb.com/actors/a" });
        await repository.saveCars([{ starId: "a", carNum: "ABC-1", names: "演员甲" }]);

        expect(storage.set).toHaveBeenCalledWith("blacklist", expect.arrayContaining([expect.objectContaining({ starId: "a", name: "演员甲" })]));
        expect(storage.set).toHaveBeenCalledWith("blacklist_car_list", [expect.objectContaining({ carNum: "ABC-1" })]);
        expect(eventBus.emit).toHaveBeenNthCalledWith(1, "blacklist-rules-changed", { changed: true });
        expect(eventBus.emit).toHaveBeenNthCalledWith(2, "blacklist-rules-changed", { carNums: ["ABC-1"] });
    });

    it("serializes concurrent car saves without losing records", async () => {
        const { repository, values } = createRepository();
        await Promise.all([
            repository.saveCars([{ starId: "a", carNum: "ABC-1" }]),
            repository.saveCars([{ starId: "b", carNum: "ABC-2" }]),
        ]);
        expect(values.get("blacklist_car_list").map(item => item.carNum)).toEqual(["ABC-1", "ABC-2"]);
    });

    it("runs new-video cleanup after releasing the storage mutation lock", async () => {
        const { repository, state, eventBus } = createRepository();
        await repository.saveCars([{ starId: "a", carNum: "ABC-1" }]);
        expect(state.removeFromNewVideoList).toHaveBeenCalledWith(["ABC-1"], "blacklist-car-removed");
        expect(eventBus.emit).toHaveBeenCalledWith("blacklist-rules-changed", { carNums: ["ABC-1"] });
    });

    it("removes actor rules and associated cars together", async () => {
        const { repository, values, state } = createRepository();
        values.set("blacklist", [{ starId: "a", name: "演员甲", role: "actress" }, { starId: "b", name: "演员乙", role: "actor" }]);
        values.set("blacklist_car_list", [{ starId: "a", carNum: "ABC-1" }, { starId: "b", carNum: "ABC-2" }]);

        await expect(repository.remove("a")).resolves.toMatchObject({ changed: true, removedCars: ["ABC-1"] });
        expect(values.get("blacklist")).toEqual([{ starId: "b", name: "演员乙", role: "actor" }]);
        expect(values.get("blacklist_car_list")).toEqual([{ starId: "b", carNum: "ABC-2" }]);
        expect(state.removeFromNewVideoList).toHaveBeenCalledWith(["ABC-1"], "blacklist-removed");
    });
});
