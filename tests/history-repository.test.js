import { describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "../src/features/library/history-repository.js";

describe("HistoryRepository", () => {
    it("reads the 6.5.1 car_list key through the injected storage service", async () => {
        const record = { carNum: "ABC-123", status: "已看" };
        const storage = { get: vi.fn(async () => [record]) };
        const repository = new HistoryRepository({ storage, state: {} });

        await expect(repository.list()).resolves.toEqual([record]);
        expect(storage.get).toHaveBeenCalledExactlyOnceWith("car_list");
    });

    it("treats malformed persisted list data as empty and keeps the legacy read adapter compatible", async () => {
        const repository = new HistoryRepository({ storage: { get: async () => ({ carNum: "ABC-123" }) }, state: {} });
        await expect(repository.list()).resolves.toEqual([]);

        const legacyRecords = [{ carNum: "XYZ-9" }];
        const legacyStorage = { getCarList: vi.fn(async () => legacyRecords), get: vi.fn() };
        const legacyRepository = new HistoryRepository({ storage: legacyStorage, state: {} });
        await expect(legacyRepository.list()).resolves.toBe(legacyRecords);
        expect(legacyStorage.get).not.toHaveBeenCalled();
    });
});
