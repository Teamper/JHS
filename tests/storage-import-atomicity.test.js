import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";

function createCoordinator() {
    let tail = Promise.resolve(), depth = 0, entries = 0;
    return {
        get depth() { return depth; },
        get entries() { return entries; },
        runExclusive(operation) {
            const run = tail.then(async () => {
                depth++, entries++;
                try { return await operation(); }
                finally { depth--; }
            });
            tail = run.then(() => undefined, () => undefined);
            return run;
        },
    };
}

function createStorage(options = {}) {
    const data = new Map(Object.entries({
        data_version: 3,
        car_list: [{ carNum: "OLD-1", url: "/v/old" }],
        setting: { themeMode: "light", webDavPassword: "AES:local" },
        favorite_actresses: [{ starId: "old-star", name: "Old" }],
        ...options.initial,
    }));
    const coordinator = createCoordinator(), writes = [];
    let failed = false;
    const writeCounts = new Map;
    const forage = {
        getItem: vi.fn(async (key) => data.has(key) ? data.get(key) : null),
        setItem: vi.fn(async (key, value) => {
            writes.push({ key, depth: coordinator.depth });
            const count = (writeCounts.get(key) || 0) + 1;
            writeCounts.set(key, count);
            if (!failed && options.failKey === key || options.failOnWrite?.key === key && options.failOnWrite.occurrence === count) {
                failed = true;
                throw new Error(`injected ${key} failure`);
            }
            if (options.failEveryWriteTo === key) throw new Error(`persistent ${key} failure`);
            data.set(key, value);
        }),
        removeItem: vi.fn(async (key) => data.delete(key)),
        keys: vi.fn(async () => [...data.keys()]),
    };
    const storage = Object.create(StorageManager.prototype);
    Object.assign(storage, {
        car_list_key: "car_list",
        favorite_actresses_key: "favorite_actresses",
        setting_key: "setting",
        blacklist_key: "blacklist",
        blacklist_car_list_key: "blacklist_car_list",
        filter_keyword_title_key: "filter_keyword_title",
        filter_keyword_review_key: "filter_keyword_review",
        third_party_cache_key: "third_party_ttl_cache",
        mutationCoordinator: coordinator,
        stateService: { recoverPendingTransactionWithoutLock: vi.fn(async () => false) },
        forage,
        _invalidateCache: vi.fn(),
        _setItemAndInvalidate: async (key, value) => {
            await forage.setItem(key, value);
            storage._invalidateCache(key);
        },
    });
    return { storage, data, coordinator, writes };
}

describe("portable import atomicity", () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each(["data_version", "car_list", "setting", "favorite_actresses"])("keeps the pre-import data when persisting %s fails", async (failKey) => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("navigator", {});
        const { storage, data, coordinator, writes } = createStorage({ failKey });

        await expect(storage.importData({
            data_version: 3,
            car_list: [{ carNum: "NEW-1", url: "/v/new" }],
            setting: { themeMode: "dark" },
            favorite_actresses: [{ starId: "new-star", name: "New" }],
        })).rejects.toThrow(`injected ${failKey} failure`);

        expect(data.get("car_list")).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
        expect(data.get("setting")).toEqual({ themeMode: "light", webDavPassword: "AES:local" });
        expect(data.get("favorite_actresses")).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(data.get("data_version")).toBe(3);
        expect(data.get("snapshots")).toHaveLength(1);
        expect(data.get("snapshots")[0]).toMatchObject({ source: "auto-import", data: { car_list: [{ carNum: "OLD-1", url: "/v/old" }] } });
        expect(coordinator.entries).toBe(1);
        expect(writes.every((write) => write.depth === 1)).toBe(true);
    });

    it("restores all data when a data migration fails after import writes", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("navigator", {});
        const oldCar = { carNum: "OLD-1", url: "", names: "", status: "", stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false } };
        const activity = { entries: [{ id: "remove-old", type: "new-video-remove", commitState: "committed", createdAt: "2026-09-26T00:00:00.000Z", changes: [{ carNum: "OLD-1", undoState: "pending" }] }] };
        const { storage, data } = createStorage({ initial: { data_version: 2, car_list: [oldCar], activity_log: activity }, failOnWrite: { key: "car_list", occurrence: 1 } });

        await expect(storage.importData({ data_version: 2 })).rejects.toThrow("injected car_list failure");

        expect(data.get("data_version")).toBe(2);
        expect(data.get("car_list")).toEqual([oldCar]);
        expect(data.get("activity_log")).toEqual(activity);
        expect(data.has("new_video_decisions")).toBe(false);
        expect(data.get("snapshots")[0].data.car_list).toEqual([oldCar]);
    });

    it("reports an incomplete rollback while keeping the pre-import snapshot", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("navigator", {});
        const { storage, data } = createStorage({ failEveryWriteTo: "car_list" });

        await expect(storage.importData({ data_version: 3, car_list: [{ carNum: "NEW-1", url: "/v/new" }] }))
            .rejects.toThrow("导入失败且自动回滚不完整");
        expect(data.get("snapshots")).toHaveLength(1);
        expect(data.get("snapshots")[0].data.car_list).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
    });
});
