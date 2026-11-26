import { describe, expect, it, vi } from "vitest";
import { CURRENT_DATA_VERSION } from "../src/core/constants.js";
import { runDataMigrations, repairNewVideoTombstones, validatePortableData } from "../src/core/migration.js";
import { storageFromForage } from "./helpers/atomic-storage.js";

function fakeStorage(version, initial = {}) {
    const data = new Map([["data_version", version], ...Object.entries(initial)]);
    const forage = {
        getItem: async key => structuredClone(data.get(key)),
        setItem: vi.fn(async (key, value) => data.set(key, structuredClone(value))),
        removeItem: async key => data.delete(key),
        keys: async () => [...data.keys()],
    };
    return { storage: storageFromForage(forage), data, forage };
}

describe("data migration v2", () => {
    it("rejects future data before every write", async () => {
        const { storage, forage } = fakeStorage(CURRENT_DATA_VERSION + 1);
        await expect(runDataMigrations(storage)).rejects.toThrow("数据来自更新版本");
        expect(forage.setItem).not.toHaveBeenCalled();
    });

    it("migrates v1 records, creates one identified snapshot and reports collisions", async () => {
        const { storage, data } = fakeStorage(1, { car_list: [{ carNum: "abc-123", status: "favorite" }, { carNum: "ABC123", status: "hasDown" }], favorite_actresses: [] });
        await expect(runDataMigrations(storage)).resolves.toBe(CURRENT_DATA_VERSION);
        expect(data.get("car_list")).toHaveLength(1);
        expect(data.get("car_list")[0].stateFlags).toMatchObject({ favorite: true, downloaded: true });
        const v2Snapshots = () => data.get("snapshots").filter(snapshot => snapshot.targetDataVersion === 2);
        expect(v2Snapshots()).toHaveLength(1);
        expect(v2Snapshots()[0]).toMatchObject({ kind: "migration-snapshot", targetDataVersion: 2, appVersion: "6.4.0" });
        expect(data.get("data_health_warnings")[0].type).toBe("canonical-collision");
        const snapshots = structuredClone(data.get("snapshots"));
        await runDataMigrations(storage);
        expect(data.get("snapshots")).toEqual(snapshots);
    });

    it("validates every portable domain before import writes begin", () => {
        expect(() => validatePortableData({ data_version: 2, car_list: {} })).toThrow("car_list 必须为数组");
        expect(() => validatePortableData({ data_version: 2, activity_log: [] })).toThrow("activity_log 必须为对象");
        expect(() => validatePortableData({ data_version: CURRENT_DATA_VERSION + 1, car_list: [] })).toThrow("数据来自更新版本");
        expect(validatePortableData({ data_version: 2, car_list: [], new_video_decisions: {} })).toBe(2);
    });

    it("migrates only tombstones with committed new-video removal evidence", async () => {
        const { storage, data } = fakeStorage(2, {
            car_list: [
                { carNum: "ABC-1", url: "", names: "", status: "", stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false } },
                { carNum: "ABC-2", url: "", names: "", status: "", stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false } },
            ],
            new_video_decisions: {},
            activity_log: { entries: [{ id: "remove-1", type: "new-video-remove", commitState: "committed", createdAt: "2026-08-22T00:00:00.000Z", changes: [{ carNum: "ABC-1", undoState: "pending" }] }] },
        });
        await expect(repairNewVideoTombstones(storage)).resolves.toEqual(["ABC-1"]);
        expect(data.get("car_list")).toHaveLength(1);
        expect(data.get("car_list")[0].carNum).toBe("ABC-2");
        expect(data.get("new_video_decisions")["ABC-1"]).toMatchObject({ action: "dismissed" });
        await expect(repairNewVideoTombstones(storage)).resolves.toEqual([]);
        expect(data.get("car_list")).toHaveLength(1);
    });
});
