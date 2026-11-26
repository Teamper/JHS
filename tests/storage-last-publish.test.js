// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { PortableBackupService } from "../src/services/portable-backup-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { storageFromForage } from "./helpers/atomic-storage.js";

function createStorage(initial, { failAfterPersistKey = null, failEvent = false } = {}) {
    const emit = vi.fn(async type => { if (failEvent && type === "new-video-changed") throw new Error("event channel closed"); });
    const clog = { log: vi.fn(), html: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    let failed = false;
    const data = new Map(Object.entries(initial)), forage = {
        getItem: vi.fn(async key => data.get(key)), setItem: vi.fn(async (key, value) => {
            data.set(key, value);
            if (!failed && key === failAfterPersistKey) {
                failed = true;
                throw new Error(`injected ${key} failure after persistence`);
            }
        }), removeItem: vi.fn(async key => data.delete(key))
    };
    const storage = storageFromForage(forage);
    const coordinator = new StorageMutationCoordinator({ lockManager: null });
    const state = new StateService(storage, { emit }, coordinator, {
        logger: clog, origin: () => "https://javdb.com", currentUrl: () => "https://javdb.com/",
    });
    return { state, backup: new PortableBackupService({ storage, coordinator, state }), data, emit, clog };
}

describe("last publication persistence", () => {
    it("inbox removal preserves the actress publication date", async () => {
        const harness = createStorage({ favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "A-1" }] }] });
        await harness.state.removeFromNewVideoList([ "A-1" ]);
        expect(harness.data.get("favorite_actresses")[0]).toMatchObject({ lastPublishTime: "2026-09-03", newVideoList: [] });
    });

    it("broadcasts one normalized new-video invalidation when blacklist persistence removes inbox items", async () => {
        const harness = createStorage({ blacklist_car_list: [], favorite_actresses: [{ starId: "a", newVideoList: [{ carNum: "abc_1" }, { carNum: "KEEP-1" }] }] });
        await harness.state.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", names: "A", starId: "a", actionType: "filter" }]);
        expect(harness.emit.mock.calls.filter(([type]) => type === "new-video-changed")).toEqual([["new-video-changed", { reason: "blacklist-car-removed", carNums: ["ABC-1"] }, { broadcastFirst: true }]]);
        expect(harness.data.get("favorite_actresses")[0].newVideoList).toEqual([{ carNum: "KEEP-1" }]);
    });

    it("restores both blacklist and new-video records when the second persisted write fails", async () => {
        const before = {
            blacklist_car_list: [],
            favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "ABC-1" }] }]
        };
        const harness = createStorage(before, { failAfterPersistKey: "favorite_actresses" });

        await expect(harness.state.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", names: "A", starId: "a", actionType: "filter" }]))
            .rejects.toThrow("injected favorite_actresses failure after persistence");

        expect(harness.data.get("blacklist_car_list")).toEqual(before.blacklist_car_list);
        expect(harness.data.get("favorite_actresses")).toEqual(before.favorite_actresses);
        expect(harness.emit).not.toHaveBeenCalled();
    });

    it("keeps a durable blacklist update successful when its cross-tab notification fails", async () => {
        const harness = createStorage({ blacklist_car_list: [], favorite_actresses: [{ starId: "a", newVideoList: [{ carNum: "ABC-1" }] }] }, { failEvent: true });
        const result = await harness.state.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", names: "A", starId: "a", actionType: "filter" }]);

        expect(result).toEqual({ changed: [ "ABC-1" ] });
        expect(harness.data.get("blacklist_car_list")).toHaveLength(1);
        expect(harness.data.get("favorite_actresses")[0].newVideoList).toEqual([]);
        expect(harness.clog.warn).toHaveBeenCalledOnce();
        expect(harness.emit).toHaveBeenCalledWith("blacklist-rules-changed", {}, { broadcastFirst: true });
    });

    it("data-health repair removes handled inbox items without clearing publication dates", async () => {
        const harness = createStorage({ car_list: [{ carNum: "A-1" }], favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "A-1" }] }], blacklist: [], blacklist_car_list: [] });
        await harness.backup.repairDataHealth();
        expect(harness.data.get("favorite_actresses")[0]).toMatchObject({ lastPublishTime: "2026-09-03", newVideoList: [] });
    });
});
