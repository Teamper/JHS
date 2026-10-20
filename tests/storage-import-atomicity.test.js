import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";
import { runDataMigrations } from "../src/core/migration.js";
import { SettingsService } from "../src/services/settings-service.js";

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
        getCarList: async () => data.get("car_list") || [],
        getBlacklist: async () => data.get("blacklist") || [],
        getBlacklistCarList: async () => data.get("blacklist_car_list") || [],
        getFavoriteActressList: async () => data.get("favorite_actresses") || [],
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
        const version = failKey === "data_version" ? 2 : 3;
        const { storage, data, coordinator, writes } = createStorage({ failKey, initial: { data_version: version } });

        await expect(storage.importData({
            data_version: 3,
            car_list: [{ carNum: "NEW-1", url: "/v/new" }],
            setting: { themeMode: "dark" },
            favorite_actresses: [{ starId: "new-star", name: "New" }],
        })).rejects.toThrow(`injected ${failKey} failure`);

        expect(data.get("car_list")).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
        expect(data.get("setting")).toEqual({ themeMode: "light", webDavPassword: "AES:local" });
        expect(data.get("favorite_actresses")).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(data.get("data_version")).toBe(version);
        expect(data.get("snapshots")).toHaveLength(1);
        expect(data.get("snapshots")[0]).toMatchObject({ source: "auto-import", data: { car_list: [{ carNum: "OLD-1", url: "/v/old" }] } });
        expect(coordinator.entries).toBe(1);
        expect(writes.every((write) => write.depth === 1)).toBe(true);
    });

    it("restores all data when the destination migration fails before applying the import", async () => {
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

describe("portable migration and consistent exports", () => {
    beforeEach(() => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-10-20 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn(), debug: vi.fn() });
        vi.stubGlobal("navigator", {});
    });
    afterEach(() => vi.unstubAllGlobals());

    it.each([undefined, 0, 1])("imports legacy status from source version %s without downgrading the destination", async (version) => {
        const { storage, data } = createStorage();
        const input = { car_list: [{ carNum: "abc-123", status: "favorite", url: "/old" }] };
        if (version !== undefined) input.data_version = version;
        const original = structuredClone(input), untouched = structuredClone(data.get("favorite_actresses"));
        vi.stubGlobal("settingsService", { updateWithoutLock: vi.fn(() => { throw new Error("input migration reached live settings"); }) });
        await storage.importData(input);
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "ABC-123", stateFlags: { favorite: true } });
        expect(data.get("favorite_actresses")).toEqual(untouched);
        expect(data.get("data_version")).toBe(3);
        expect(input).toEqual(original);
        expect(globalThis.settingsService.updateWithoutLock).not.toHaveBeenCalled();
        expect(storage.forage.setItem.mock.calls.filter(([key]) => key === "data_version")).toEqual([]);
    });

    it("treats explicit null as an empty domain while retaining destination local settings", async () => {
        const { storage, data } = createStorage();
        await storage.importData({ car_list: null, setting: null, favorite_actresses: null });
        expect(data.get("car_list")).toEqual([]);
        expect(data.get("favorite_actresses")).toEqual([]);
        expect(data.get("setting")).toEqual({ webDavPassword: "AES:local" });
    });

    it("upgrades destination data independently and rolls it back if the later import fails", async () => {
        const old = [{ carNum: "old-1", status: "favorite" }];
        const { storage, data } = createStorage({ initial: { data_version: 1, car_list: old }, failKey: "setting" });
        await expect(storage.importData({ data_version: 3, setting: {} })).rejects.toThrow("injected setting failure");
        expect(data.get("data_version")).toBe(1);
        expect(data.get("car_list")).toEqual(old);
        expect(data.get("snapshots")).toHaveLength(1);
        expect(data.get("snapshots")[0].data.data_version).toBe(1);
    });

    it("reuses the legacy database wrappers without migrating imported settings through live services", async () => {
        const { storage, data, coordinator } = createStorage({ initial: {
            data_version: 0, car_list: [{ carNum: "abc123", status: "favorite", actress: "A" }],
            filter_actor_actress_info_list: [{ name: "A", isActor: true, url: "https://example.test/actors/a" }],
            car_list_filter_actor_actress: [{ carNum: "ABC-9", actress: "A", type: "old" }],
            favorite_actresses: [{ dbId: "a", name: "A" }],
            setting: { enableCheckFilterActorActress: "yes", webDavPassword: "AES:local" },
        } });
        await storage.importData({ data_version: 3, setting: { themeMode: "dark" } });
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "ABC-123", names: "A", stateFlags: { favorite: true } });
        expect(data.get("blacklist")[0]).toMatchObject({ starId: "a", role: "actor" });
        expect(data.get("blacklist_car_list")[0]).toMatchObject({ starId: "a", names: "A" });
        expect(data.get("favorite_actresses")[0]).toMatchObject({ starId: "a" });
        expect(data.get("setting")).toEqual({ themeMode: "dark", webDavPassword: "AES:local" });
        expect(data.get("data_version")).toBe(3);
        expect(coordinator.entries).toBe(1);
    });

    it("refreshes the live settings snapshot after a rolled-back v0 migration, outside the import lock", async () => {
        const original = { enableCheckFilterActorActress: "yes", webDavPassword: "AES:local" };
        const { storage, data, coordinator } = createStorage({ initial: { data_version: 0, setting: original }, failKey: "favorite_actresses" });
        const settings = new SettingsService({ get: key => storage.forage.getItem(key), set: (key, value) => storage.forage.setItem(key, value) }, { mutationCoordinator: coordinator });
        await settings.load();
        const changed = [];
        settings.addEventListener("settings.changed", event => changed.push(event.detail.snapshot));
        vi.stubGlobal("settingsService", settings);
        await expect(storage.importData({ setting: { themeMode: "dark" } })).rejects.toThrow("injected favorite_actresses failure");
        expect(changed.some(snapshot => snapshot.enableCheckBlacklist === "yes")).toBe(true);
        expect(data.get("setting")).toEqual(original);
        expect(settings.snapshot()).toEqual(original);
        expect(changed.at(-1)).toEqual(original);
        expect(coordinator.entries).toBe(3); // load, import, refresh; no nested acquisition.
    });

    it("preserves alias-only v0 data in raw snapshots while keeping current exports canonical", async () => {
        const { storage, data } = createStorage({ initial: {
            data_version: 0, car_list: null, setting: null, favorite_actresses: null,
            favorite_actresses_info_list: [{ dbId: "old-star", name: "Old" }],
        } });
        const snapshot = await storage.createSnapshot("alias-only");
        expect(snapshot.data).toEqual({ data_version: 0, favorite_actresses_info_list: [{ dbId: "old-star", name: "Old" }] });
        data.set("data_version", 3);
        await storage.restoreSnapshot(snapshot.id);
        expect(data.get("favorite_actresses")).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(await storage.exportData()).not.toHaveProperty("favorite_actresses_info_list");
    });

    it("retains source versions in manual and migration snapshots and restores both legacy forms", async () => {
        const { storage, data, coordinator } = createStorage({ initial: { data_version: 1, car_list: [{ carNum: "abc-123", status: "favorite" }] } });
        const manual = await storage.createSnapshot("before");
        expect(manual.data.data_version).toBe(1);
        await runDataMigrations(storage, coordinator);
        const migrated = data.get("snapshots").find((item) => item.kind === "migration-snapshot");
        expect(migrated.data.data_version).toBe(1);
        for (const snapshot of [manual, migrated, { id: "old-snapshot", data: { car_list: [{ carNum: "abc-123", status: "favorite" }] } }]) {
            if (snapshot.id === "old-snapshot") data.get("snapshots").push(snapshot);
            data.set("car_list", []);
            await storage.restoreSnapshot(snapshot.id);
            expect(data.get("car_list")[0].stateFlags.favorite).toBe(true);
            expect(data.get("data_version")).toBe(3);
        }
    });

    it("rejects future source and destination versions before snapshot, recovery or writes", async () => {
        const { storage, data, writes } = createStorage();
        await expect(storage.importData({ data_version: 4, setting: {} })).rejects.toThrow("数据来自更新版本");
        data.set("data_version", 4);
        await expect(storage.importData({ setting: {} })).rejects.toThrow("数据来自更新版本");
        await expect(storage.exportData()).rejects.toThrow("数据来自更新版本");
        expect(writes).toEqual([]);
        expect(storage.stateService.recoverPendingTransactionWithoutLock).not.toHaveBeenCalled();
    });

    it("does not borrow destination activity as evidence for source tombstones", async () => {
        const tombstone = { carNum: "ABC-1", status: "", url: "", names: "" };
        const activity = { entries: [{ type: "new-video-remove", commitState: "committed", changes: [{ carNum: "ABC-1" }] }] };
        const { storage, data } = createStorage({ initial: { activity_log: activity, new_video_decisions: { "KEEP-1": { action: "snoozed" } } } });
        await storage.importData({ data_version: 2, car_list: [tombstone], new_video_decisions: {} });
        expect(data.get("car_list")).toEqual([tombstone]);
        expect(data.get("new_video_decisions")).toEqual({});
        await storage.importData({ data_version: 2, car_list: [tombstone], activity_log: activity });
        expect(data.get("car_list")).toEqual([tombstone]);
        expect(data.get("new_video_decisions")).toEqual({});
    });

    it.each(["exportPortableData", "exportData"])("%s holds one lock across every domain read", async (method) => {
        const { storage, data, coordinator } = createStorage();
        let releaseRead, notifyRead;
        const readReached = new Promise((resolve) => { notifyRead = resolve; });
        const readGate = new Promise((resolve) => { releaseRead = resolve; });
        const read = storage.forage.getItem.getMockImplementation();
        storage.forage.getItem.mockImplementation(async (key) => {
            const value = await read(key);
            if (key === "car_list") { notifyRead(); await readGate; }
            return value;
        });
        const exported = storage[method]();
        await readReached;
        let writerEntered = false;
        const mutation = coordinator.runExclusive(async () => {
            writerEntered = true;
            data.set("car_list", [{ carNum: "NEW-1" }]);
            data.set("favorite_actresses", [{ starId: "new" }]);
        });
        await Promise.resolve();
        expect(writerEntered).toBe(false);
        releaseRead();
        const backup = await exported;
        await mutation;
        expect(backup.car_list).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
        expect(backup.favorite_actresses).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(coordinator.entries).toBe(2);
    });

    it("recovers before exporting and refuses a backup when recovery fails", async () => {
        const { storage, data, coordinator } = createStorage();
        storage.stateService.recoverPendingTransactionWithoutLock.mockImplementationOnce(async () => {
            expect(coordinator.depth).toBe(1);
            data.set("car_list", [{ carNum: "RECOVERED-1" }]);
        });
        expect((await storage.exportData()).car_list).toEqual([{ carNum: "RECOVERED-1" }]);
        storage.stateService.recoverPendingTransactionWithoutLock.mockRejectedValueOnce(new Error("recovery unavailable"));
        await expect(storage.exportData()).rejects.toThrow("recovery unavailable");
    });
});
