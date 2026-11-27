import { memoryAtomicStorage, storageFromForage } from "./helpers/atomic-storage.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortableBackupService } from "../src/services/portable-backup-service.js";
import { StateService } from "../src/core/state-service.js";
import { ACTRESS_PROFILE_BACKFILL_KEY, createActressProfileBackfillState } from "../src/core/actress-profile-backfill-state.js";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";
import { runDataMigrations } from "../src/core/migration.js";
import { CURRENT_DATA_VERSION } from "../src/core/constants.js";
import { SettingsService } from "../src/services/settings-service.js";
import { WebDavSyncStore } from "../src/core/webdav-sync-store.js";

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
    const atomic = memoryAtomicStorage(data, { beforeWrite: async key => {
        writes.push({ key, depth: coordinator.depth });
        if (options.failKey === key || options.failEveryWriteTo === key || options.failOnWrite?.key === key) throw new Error(`injected ${key} failure`);
    } });
    const storage = storageFromForage(forage, atomic);
    const state = { recoverPendingTransactionWithoutLock: vi.fn(async () => false) };
    const backup = new PortableBackupService({ storage, coordinator, state });
    return { storage, forage, state, backup, data, coordinator, writes };
}

describe("portable import atomicity", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("keeps a completed import successful when refreshing synchronization fails", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-10-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        const { backup, data, storage, coordinator } = createStorage();
        const sync = backup.sync = new WebDavSyncStore({ storage, coordinator });
        const read = vi.spyOn(sync, "read").mockRejectedValue(new Error("sync refresh failed"));
        const release = vi.spyOn(sync, "releaseSnapshots");
        await expect(backup.importData({ data_version: 3, car_list: [{ carNum: "NEW-123", url: "/v/new" }] })).resolves.toBeUndefined();
        expect(data.get("car_list")).toEqual([expect.objectContaining({ carNum: "NEW-123" })]);
        expect(data.get("snapshots").filter(snapshot => snapshot.source === "auto-import")).toHaveLength(1);
        expect(release).toHaveBeenCalledOnce();
        expect(read).toHaveBeenCalledOnce();
        sync.dispose();
    });

    it.each(["data_version", "car_list", "setting", "favorite_actresses", ACTRESS_PROFILE_BACKFILL_KEY])("keeps the pre-import data when persisting %s fails", async (failKey) => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("navigator", {});
        const version = failKey === "data_version" ? 2 : 3;
        const checkpoint = { ...createActressProfileBackfillState("before"), initialized: true, entries: { "old-star": 1000 } };
        const { backup, data, coordinator, writes } = createStorage({ failKey, initial: { data_version: version, [ACTRESS_PROFILE_BACKFILL_KEY]: checkpoint } });

        await expect(backup.importData({
            data_version: 3,
            car_list: [{ carNum: "NEW-1", url: "/v/new" }],
            setting: { themeMode: "dark" },
            favorite_actresses: [{ starId: "new-star", name: "New" }],
        })).rejects.toThrow(`injected ${failKey} failure`);

        expect(data.get("car_list")).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
        expect(data.get("setting")).toEqual({ themeMode: "light", webDavPassword: "AES:local" });
        expect(data.get("favorite_actresses")).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(data.get(ACTRESS_PROFILE_BACKFILL_KEY)).toEqual(checkpoint);
        expect(data.get("data_version")).toBe(version);
        expect(data.has("snapshots")).toBe(false);
        expect(coordinator.entries).toBe(1);
        expect(writes.every((write) => write.depth === 1)).toBe(true);
    });

    it.each(["import", "snapshot"])("rejects in-flight actress profile writes after a portable %s", async mode => {
        const { backup, storage, data, coordinator } = createStorage({
            initial: { [ACTRESS_PROFILE_BACKFILL_KEY]: { ...createActressProfileBackfillState("before"), initialized: true, entries: { "old-star": 1000 } } },
        });
        const state = new StateService(storage, {}, coordinator);
        const url = "https://ja.wikipedia.org/wiki/Old";
        let release;
        const lookupAny = vi.fn(() => new Promise(resolve => { release = resolve; }));
        const controller = new NewVideoScanController({ state, actressInfo: { lookupAny }, getTimestamp: () => "", onNewItems() {} });
        const inFlight = controller.backfillFavoriteProfiles({ now: 2000, delayMs: 0, force: true });
        const cancelled = expect(inFlight).rejects.toMatchObject({ name: "AbortError" });
        await vi.waitFor(() => expect(lookupAny).toHaveBeenCalledOnce());

        const restored = {
            data_version: 3,
            favorite_actresses: [{ starId: "old-star", name: "Old", actressProfile: { url, matchedName: "Old", height: "170cm" }, actressProfileVerifiedUrl: url }],
        };
        if (mode === "snapshot") {
            vi.spyOn(backup, "getSnapshot").mockResolvedValue({ data: restored });
            await backup.restoreSnapshot("restore-point");
        } else await backup.importData(restored);
        const checkpoint = await state.getActressProfileBackfillState();
        expect(checkpoint).toEqual(createActressProfileBackfillState(expect.any(String)));
        expect(checkpoint.generation).not.toBe("before");
        release({ info: { url, height: "150cm" }, matchedName: "Old" });
        await cancelled;
        expect(await state.getActressProfileBackfillState()).toEqual(checkpoint);
        expect(data.get("favorite_actresses")[0].actressProfile.height).toBe("170cm");
        expect(await controller.needsProfileBackfillInit()).toBe(true);
        expect(await backup.exportPortableData()).not.toHaveProperty(ACTRESS_PROFILE_BACKFILL_KEY);
    });

    it("restores all data when the destination migration fails before applying the import", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("navigator", {});
        const oldCar = { carNum: "OLD-1", url: "", names: "", status: "", stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false } };
        const activity = { entries: [{ id: "remove-old", type: "new-video-remove", commitState: "committed", createdAt: "2026-09-26T00:00:00.000Z", changes: [{ carNum: "OLD-1", undoState: "pending" }] }] };
        const { backup, data } = createStorage({ initial: { data_version: 2, car_list: [oldCar], activity_log: activity }, failOnWrite: { key: "car_list", occurrence: 1 } });

        await expect(backup.importData({ data_version: 2 })).rejects.toThrow("injected car_list failure");

        expect(data.get("data_version")).toBe(2);
        expect(data.get("car_list")).toEqual([oldCar]);
        expect(data.get("activity_log")).toEqual(activity);
        expect(data.has("new_video_decisions")).toBe(false);
        expect(data.has("snapshots")).toBe(false);
    });

    it("rejects repeated write failure without needing rollback or changing snapshots", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("navigator", {});
        const { backup, data } = createStorage({ failEveryWriteTo: "car_list" });

        await expect(backup.importData({ data_version: 3, car_list: [{ carNum: "NEW-1", url: "/v/new" }] }))
            .rejects.toThrow("injected car_list failure");
        expect(data.has("snapshots")).toBe(false);
        expect(data.get("car_list")).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
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
        const { backup, forage, data } = createStorage();
        const input = { car_list: [{ carNum: "abc-123", status: "favorite", url: "/old" }] };
        if (version !== undefined) input.data_version = version;
        const original = structuredClone(input), untouched = structuredClone(data.get("favorite_actresses"));
        vi.stubGlobal("settingsService", { updateWithoutLock: vi.fn(() => { throw new Error("input migration reached live settings"); }) });
        await backup.importData(input);
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "ABC-123", stateFlags: { favorite: true } });
        expect(data.get("favorite_actresses")).toEqual(untouched);
        expect(data.get("data_version")).toBe(CURRENT_DATA_VERSION);
        expect(input).toEqual(original);
        expect(globalThis.settingsService.updateWithoutLock).not.toHaveBeenCalled();
        expect(forage.setItem.mock.calls.filter(([key]) => key === "data_version")).toEqual([]);
    });

    it("treats explicit null as an empty domain while retaining destination local settings", async () => {
        const { backup, data } = createStorage();
        await backup.importData({ car_list: null, setting: null, favorite_actresses: null });
        expect(data.get("car_list")).toEqual([]);
        expect(data.get("favorite_actresses")).toEqual([]);
        expect(data.get("setting")).toEqual({ webDavPassword: "AES:local" });
    });

    it("upgrades destination data independently and rolls it back if the later import fails", async () => {
        const old = [{ carNum: "old-1", status: "favorite" }];
        const { backup, data } = createStorage({ initial: { data_version: 1, car_list: old }, failKey: "setting" });
        await expect(backup.importData({ data_version: 3, setting: {} })).rejects.toThrow("injected setting failure");
        expect(data.get("data_version")).toBe(1);
        expect(data.get("car_list")).toEqual(old);
        expect(data.has("snapshots")).toBe(false);
    });

    it("reuses the legacy database wrappers without migrating imported settings through live services", async () => {
        const { backup, data, coordinator } = createStorage({ initial: {
            data_version: 0, car_list: [{ carNum: "abc123", status: "favorite", actress: "A" }],
            filter_actor_actress_info_list: [{ name: "A", isActor: true, url: "https://example.test/actors/a" }],
            car_list_filter_actor_actress: [{ carNum: "ABC-9", actress: "A", type: "old" }],
            favorite_actresses: [{ dbId: "a", name: "A" }],
            setting: { enableCheckFilterActorActress: "yes", webDavPassword: "AES:local" },
        } });
        await backup.importData({ data_version: 3, setting: { themeMode: "dark" } });
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "ABC-123", names: "A", stateFlags: { favorite: true } });
        expect(data.get("blacklist")[0]).toMatchObject({ starId: "a", role: "actor" });
        expect(data.get("blacklist_car_list")[0]).toMatchObject({ starId: "a", names: "A" });
        expect(data.get("favorite_actresses")[0]).toMatchObject({ starId: "a" });
        expect(data.get("setting")).toEqual({ themeMode: "dark", webDavPassword: "AES:local" });
        expect(data.get("data_version")).toBe(CURRENT_DATA_VERSION);
        expect(coordinator.entries).toBe(1);
    });

    it("never exposes draft settings or emits migration events when an atomic import aborts", async () => {
        const original = { enableCheckFilterActorActress: "yes", webDavPassword: "AES:local" };
        const { backup, forage, data, coordinator } = createStorage({ initial: { data_version: 0, setting: original }, failKey: "favorite_actresses" });
        const settings = new SettingsService({ get: key => forage.getItem(key), set: (key, value) => forage.setItem(key, value) }, { mutationCoordinator: coordinator });
        await settings.load();
        const changed = [];
        settings.addEventListener("settings.changed", event => changed.push(event.detail.snapshot));
        backup.settings = settings;
        await expect(backup.importData({ setting: { themeMode: "dark" } })).rejects.toThrow("injected favorite_actresses failure");
        expect(changed).toEqual([]);
        expect(data.get("setting")).toEqual(original);
        expect(settings.snapshot()).toEqual(original);
        expect(coordinator.entries).toBe(2); // load and import; the failed draft never touches live settings.
    });

    it("preserves alias-only v0 data in raw snapshots while keeping current exports canonical", async () => {
        const { backup, data } = createStorage({ initial: {
            data_version: 0, car_list: null, setting: null, favorite_actresses: null,
            favorite_actresses_info_list: [{ dbId: "old-star", name: "Old" }],
        } });
        const snapshot = await backup.createSnapshot("alias-only");
        expect(snapshot.data).toEqual({ data_version: 0, favorite_actresses_info_list: [{ dbId: "old-star", name: "Old" }] });
        data.set("data_version", 3);
        await backup.restoreSnapshot(snapshot.id);
        expect(data.get("favorite_actresses")).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(await backup.exportData()).not.toHaveProperty("favorite_actresses_info_list");
    });

    it("retains source versions in manual and migration snapshots and restores both legacy forms", async () => {
        const { storage, backup, data, coordinator } = createStorage({ initial: { data_version: 1, car_list: [{ carNum: "abc-123", status: "favorite" }] } });
        const manual = await backup.createSnapshot("before");
        expect(manual.data.data_version).toBe(1);
        await coordinator.runExclusive(() => runDataMigrations(storage));
        const migrated = data.get("snapshots").find((item) => item.kind === "migration-snapshot");
        expect(migrated.data.data_version).toBe(1);
        for (const snapshot of [manual, migrated, { id: "old-snapshot", data: { car_list: [{ carNum: "abc-123", status: "favorite" }] } }]) {
            if (snapshot.id === "old-snapshot") data.get("snapshots").push(snapshot);
            data.set("car_list", []);
            await backup.restoreSnapshot(snapshot.id);
            expect(data.get("car_list")[0].stateFlags.favorite).toBe(true);
            expect(data.get("data_version")).toBe(CURRENT_DATA_VERSION);
        }
    });

    it("rejects future source and destination versions before snapshot, recovery or writes", async () => {
        const { backup, state, data, writes } = createStorage();
        await expect(backup.importData({ data_version: CURRENT_DATA_VERSION + 1, setting: {} })).rejects.toThrow("数据来自更新版本");
        data.set("data_version", CURRENT_DATA_VERSION + 1);
        await expect(backup.importData({ setting: {} })).rejects.toThrow("数据来自更新版本");
        await expect(backup.exportData()).rejects.toThrow("数据来自更新版本");
        expect(writes).toEqual([]);
        expect(state.recoverPendingTransactionWithoutLock).not.toHaveBeenCalled();
    });

    it("does not borrow destination activity as evidence for source tombstones", async () => {
        const tombstone = { carNum: "ABC-1", status: "", url: "", names: "" };
        const activity = { entries: [{ type: "new-video-remove", commitState: "committed", changes: [{ carNum: "ABC-1" }] }] };
        const { backup, data } = createStorage({ initial: { activity_log: activity, new_video_decisions: { "KEEP-1": { action: "snoozed" } } } });
        await backup.importData({ data_version: 2, car_list: [tombstone], new_video_decisions: {} });
        expect(data.get("car_list")).toEqual([tombstone]);
        expect(data.get("new_video_decisions")).toEqual({});
        await backup.importData({ data_version: 2, car_list: [tombstone], activity_log: activity });
        expect(data.get("car_list")).toEqual([tombstone]);
        expect(data.get("new_video_decisions")).toEqual({});
    });

    it.each(["exportPortableData", "exportData"])("%s holds one lock across every domain read", async (method) => {
        const { backup, forage, data, coordinator } = createStorage();
        let releaseRead, notifyRead;
        const readReached = new Promise((resolve) => { notifyRead = resolve; });
        const readGate = new Promise((resolve) => { releaseRead = resolve; });
        const read = forage.getItem.getMockImplementation();
        forage.getItem.mockImplementation(async (key) => {
            const value = await read(key);
            if (key === "car_list") { notifyRead(); await readGate; }
            return value;
        });
        const exported = backup[method]();
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
        const exportedData = await exported;
        await mutation;
        expect(exportedData.car_list).toEqual([{ carNum: "OLD-1", url: "/v/old" }]);
        expect(exportedData.favorite_actresses).toEqual([{ starId: "old-star", name: "Old" }]);
        expect(coordinator.entries).toBe(2);
    });

    it("recovers before exporting and refuses a backup when recovery fails", async () => {
        const { backup, state, data, coordinator } = createStorage();
        state.recoverPendingTransactionWithoutLock.mockImplementationOnce(async () => {
            expect(coordinator.depth).toBe(1);
            data.set("car_list", [{ carNum: "RECOVERED-1" }]);
        });
        expect((await backup.exportData()).car_list).toEqual([{ carNum: "RECOVERED-1" }]);
        state.recoverPendingTransactionWithoutLock.mockRejectedValueOnce(new Error("recovery unavailable"));
        await expect(backup.exportData()).rejects.toThrow("recovery unavailable");
    });
});
