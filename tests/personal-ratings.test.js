import { afterEach, describe, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { StorageManager } from "../src/core/storage.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { CURRENT_DATA_VERSION } from "../src/core/constants.js";
import { getPortableDataKeys, normalizePortableData, runDataMigrations, validatePortableData } from "../src/core/migration.js";
import { emptySyncModel, joinSyncModels, materializeSyncData, projectSyncData, validateSyncEnvelope, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { memoryAtomicStorage } from "./helpers/atomic-storage.js";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_JOURNAL_KEY } from "../src/core/webdav-sync-store.js";

const timestamp = "2026-11-07T00:00:00.000Z";
const score = rating => ({ rating, updatedAt: timestamp });
const replicaA = "11111111-1111-4111-8111-111111111111";
const replicaB = "22222222-2222-4222-8222-222222222222";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function fixture(initial = {}, { atomic = false } = {}) {
    vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn(), error: vi.fn() });
    const data = new Map(Object.entries({ data_version: 4, car_list: [], activity_log: { entries: [] }, personal_ratings: {}, ...initial }));
    const clone = value => value == null ? value : structuredClone(value);
    const storage = Object.create(StorageManager.prototype);
    storage.car_list_key = "car_list";
    storage.favorite_actresses_key = "favorite_actresses";
    storage.setting_key = "setting";
    storage.forage = { getItem: vi.fn(async key => clone(data.get(key))), setItem: vi.fn(async (key, value) => { data.set(key, clone(value)); }), removeItem: vi.fn(async key => data.delete(key)), keys: async () => [...data.keys()] };
    storage._setItemAndInvalidate = (key, value) => storage.forage.setItem(key, value);
    storage._invalidateCache = vi.fn();
    const coordinator = new StorageMutationCoordinator({ lockManager: null });
    storage.mutationCoordinator = coordinator;
    if (atomic) {
        const port = memoryAtomicStorage(data);
        storage.atomicStorage = { ...port, commitLockedBatch: async batch => { await port.commitAtomicBatch({ expected: {}, deletes: [], ...batch }); return true; } };
    }
    const events = { emit: vi.fn(async () => {}) };
    const state = new StateService(storage, events, coordinator);
    storage.stateService = state;
    return { data, storage, state, events, coordinator };
}

describe("independent personal rating transactions", () => {
    it("preserves incomplete v4 journals before reading or rewriting any domain", async () => {
        const f = fixture({mutation_journal:{schema:2,dataVersion:4,id:"incomplete",touchedDomains:["ratings"],before:{},after:{ratings:{}}},personal_ratings:{"ABC-123":score(5)}});
        await expect(f.state.recoverPendingTransactionWithoutLock()).rejects.toThrow("缺少数据域快照");
        expect(f.storage.forage.setItem).not.toHaveBeenCalled();
        expect(f.data.get("personal_ratings")["ABC-123"].rating).toBe(5);
        expect(f.data.has("mutation_journal")).toBe(true);
    });
    it.each([false, true])("sets, clears and undoes without writing movie flags, atomic=%s", async atomic => {
        const f = fixture({ car_list: [{ carNum: "ABC-123", stateFlags: { favorite: true } }] }, { atomic });
        const before = structuredClone(f.data.get("car_list"));
        const result = await f.state.setPersonalRating(["abc123", "FC2-PPV-0012345"], 4);
        expect(result.changed).toEqual(["ABC-123", "FC2-PPV-0012345"]);
        expect((await f.state.getPersonalRatings())["ABC-123"].rating).toBe(4);
        expect(f.data.get("car_list")).toEqual(before);
        expect(f.storage.forage.setItem.mock.calls.some(([key]) => key === "car_list")).toBe(false);
        const cleared = await f.state.clearPersonalRating("ABC-123");
        expect(f.data.get("personal_ratings")["ABC-123"]).toBeUndefined();
        await f.state.undoTransaction(cleared.transactionId);
        expect(f.data.get("personal_ratings")["ABC-123"].rating).toBe(4);
        expect(f.events.emit).toHaveBeenCalledWith("personal-rating-changed", expect.objectContaining({ carNums: ["ABC-123"] }), { broadcastFirst: true });
    });

    it("serializes concurrent ratings and preserves independent FC2 digits", async () => {
        const f = fixture();
        const [first] = await Promise.all([f.state.setPersonalRating("ABC-123", 2), f.state.setPersonalRating("ABC-123", 5), f.state.setPersonalRating("FC2-PPV-12345", 1)]);
        expect(f.data.get("personal_ratings")).toMatchObject({ "ABC-123": { rating: 5 }, "FC2-PPV-12345": { rating: 1 } });
        expect(f.data.get("personal_ratings")["FC2-PPV-0012345"]).toBeUndefined();
        const undo = await f.state.undoTransaction(first.transactionId);
        expect(undo.conflicts).toEqual(["ABC-123"]);
        expect(f.data.get("personal_ratings")["ABC-123"].rating).toBe(5);
    });

    it.each([0, 6, 2.5, "4", NaN])("rejects invalid score %s before writing", async rating => {
        const f = fixture();
        await expect(f.state.setPersonalRating("ABC-123", rating)).rejects.toThrow();
        expect(f.storage.forage.setItem).not.toHaveBeenCalled();
    });

    it("prewrites versioned intent and rolls back a failed partial rating transaction", async () => {
        const f = fixture(), write = f.storage.forage.setItem.getMockImplementation();
        const journals = [];
        let failed = false;
        f.storage.forage.setItem.mockImplementation(async (key, value) => {
            if (key === "mutation_journal") journals.push(structuredClone(value));
            if (key === "personal_ratings" && !failed) { failed = true; throw new Error("disk full"); }
            return write(key, value);
        });
        await expect(f.state.setPersonalRating("ABC-123", 5)).rejects.toThrow("disk full");
        expect(journals[0]).toMatchObject({ dataVersion: 4, touchedDomains: ["ratings", "activity"], before: { ratings: {} } });
        expect(f.data.get("personal_ratings")).toEqual({});
        expect(f.data.get("activity_log").entries).toEqual([]);
        await f.state.setPersonalRating("ABC-123", 5);
        expect(f.data.get("personal_ratings")["ABC-123"].rating).toBe(5);
    });

    it("rejects a future local database and future mutation journal without writes", async () => {
        const f = fixture({ data_version: 5 });
        await expect(f.state.setPersonalRating("ABC-123", 3)).rejects.toThrow("更新版本");
        expect(f.storage.forage.setItem).not.toHaveBeenCalled();
        f.data.set("data_version", 4);
        f.data.set("mutation_journal", { schema: 2, dataVersion: 5 });
        await expect(f.state.recoverPendingTransaction()).rejects.toThrow("不支持");
        expect(f.storage.forage.setItem).not.toHaveBeenCalled();
    });
});

describe("rating migration, portable restore and synchronization", () => {
    it("recovers legacy state before the v4 recovery point and rating initialization", async () => {
        const before = { carList: [], activity: { entries: [] } };
        const after = { carList: [{ carNum: "ABC-123" }], activity: { entries: [] } };
        const f = fixture({ data_version: 3, personal_ratings: undefined, car_list: after.carList, mutation_journal: { schema: 2, id: "interrupted", before, after, touchedDomains: ["carList", "activity"] } });
        await f.coordinator.runExclusive(() => runDataMigrations(f.storage, f.coordinator, true));
        expect(f.data.get("data_version")).toBe(4);
        expect(f.data.get("car_list")).toEqual([]);
        expect(f.data.get("personal_ratings")).toEqual({});
        const snapshots = f.data.get("snapshots");
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toMatchObject({ targetDataVersion: 4, data: { data_version: 3, car_list: [] } });
        expect(snapshots[0].itemCount).toBe(0);
        expect(snapshots[0].time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(snapshots[0].data).not.toHaveProperty("personal_ratings");
        await f.coordinator.runExclusive(() => runDataMigrations(f.storage, f.coordinator, true));
        expect(f.data.get("snapshots")).toHaveLength(1);
    });

    it("keeps the v3 marker and ratings intact if the upgrade recovery point fails", async () => {
        const f = fixture({ data_version: 3, personal_ratings: { "ABC-123": score(4) } });
        f.storage._saveSnapshots = vi.fn(async () => { throw new Error("snapshot failure"); });
        await expect(runDataMigrations(f.storage)).rejects.toThrow("snapshot failure");
        expect(f.data.get("data_version")).toBe(3);
        expect(f.data.get("personal_ratings")).toEqual({ "ABC-123": score(4) });
    });

    it("reports the recovered film count in the pre-upgrade recovery point", async () => {
        const f = fixture({data_version:3,personal_ratings:undefined,car_list:[{carNum:"ABC-123"},{carNum:"ABC-124"}]});
        await runDataMigrations(f.storage);
        expect(f.data.get("snapshots")[0].itemCount).toBe(2);
    });

    it("preserves ratings when restoring an older partial backup and exports v4 ratings", async () => {
        vi.stubGlobal("utils", { getNowStr: () => timestamp });
        const f = fixture({ personal_ratings: { "ABC-123": score(4) } }, { atomic: true });
        await f.storage.importData({ data_version: 3, car_list: [] });
        expect(f.data.get("personal_ratings")).toEqual({ "ABC-123": score(4) });
        const exported = await f.storage.exportPortableData();
        expect(exported).toMatchObject({ data_version: 4, personal_ratings: { "ABC-123": score(4) } });
        expect(getPortableDataKeys(3)).not.toContain("personal_ratings");
        expect(getPortableDataKeys(4)).toContain("personal_ratings");
        expect(normalizePortableData({ data_version: 3, setting: {} }).data).not.toHaveProperty("personal_ratings");
        expect(() => validatePortableData({ data_version: 4, personal_ratings: { "abc123": score(3) } })).toThrow();
        expect(() => validatePortableData({ data_version: 5 })).toThrow();
    });

    it("joins concurrent scores deterministically and retains clear tombstones against an old offline edit", () => {
        const before = projectSyncData({ personal_ratings: { "ABC-123": score(3) } });
        const base = versionSyncDiff(emptySyncModel(), {}, before, [1, replicaA]).model;
        const left = versionSyncDiff(base, before, projectSyncData({ personal_ratings: { "ABC-123": score(4) } }), [2, replicaA]).model;
        const right = versionSyncDiff(base, before, projectSyncData({ personal_ratings: { "ABC-123": score(5) } }), [2, replicaB]).model;
        expect(materializeSyncData(joinSyncModels(left, right), {}).personal_ratings["ABC-123"].rating).toBe(5);
        const cleared = versionSyncDiff(left, projectSyncData({ personal_ratings: { "ABC-123": score(4) } }), {}, [3, replicaA]).model;
        const stale = versionSyncDiff(base, before, projectSyncData({ personal_ratings: { "ABC-123": score(1) } }), [100, replicaB]).model;
        expect(materializeSyncData(joinSyncModels(cleared, stale), {}).personal_ratings).toEqual({});
        expect(() => validateSyncEnvelope({ schema: 1, dataVersion: CURRENT_DATA_VERSION + 1 })).toThrow("更新");
    });

    it("recovers an old sync journal without overwriting the new ratings domain", async () => {
        const a = await syncReplica(memoryDav(), { data: { data_version: 4, personal_ratings: { "ABC-123": score(4) } } });
        const after = await a.store.readData();
        delete after.personal_ratings;
        a.values.set(SYNC_JOURNAL_KEY, { schema: 1, state: "prepared", after, afterState: await a.store.read(), notificationId: "old-notice", carNums: [] });
        await a.coordinator.runExclusive(() => a.store.recoverWithoutLock());
        expect(a.values.get("personal_ratings")).toEqual({ "ABC-123": score(4) });
        a.store.dispose();
    });

    it("synchronizes scores, clearing and an offline replica through the existing service entry point", async () => {
        const remote = memoryDav();
        const a = await syncReplica(remote, { data: { data_version: 4 } });
        await a.state.setPersonalRating("ABC-123", 4);
        await a.service.check();
        const b = await syncReplica(remote, { data: { data_version: 4 } });
        await b.service.check();
        expect(b.values.get("personal_ratings")["ABC-123"].rating).toBe(4);
        await a.state.clearPersonalRating("ABC-123");
        await a.service.check();
        await b.service.check();
        expect(b.values.get("personal_ratings")).toEqual({});
        expect(b.store.deps.events.emit).toHaveBeenCalledWith("personal-rating-changed", expect.objectContaining({ carNums: ["ABC-123"] }));
        const journals = a.forage.setItem.mock.calls.filter(([key, value]) => key === SYNC_JOURNAL_KEY && value.state === "prepared");
        expect(journals.length).toBeGreaterThan(0);
        expect(journals.every(([, value]) => value.dataVersion === 4)).toBe(true);
        a.store.dispose(); b.store.dispose();
    });

    it("pauses a v3 client at a v4 remote snapshot before it can publish", async () => {
        const remote = memoryDav(), a = await syncReplica(remote, { data: { data_version: 4 } });
        await a.state.setPersonalRating("ABC-123", 5);
        await a.service.check();
        const published = remote.client.writeSyncFile.mock.calls.length;
        a.store.dispose();
        vi.resetModules();
        vi.doMock("../src/core/constants.js", async original => ({ ...await original(), CURRENT_DATA_VERSION: 3 }));
        try {
            const { syncReplica: oldReplica } = await import("./helpers/webdav-sync-fixture.js");
            const old = await oldReplica(remote);
            await old.service.check();
            expect((await old.store.read()).paused).toBe(true);
            expect((await old.store.read()).error).toContain("更新");
            expect(remote.client.writeSyncFile).toHaveBeenCalledTimes(published);
            expect(old.values.get("personal_ratings")).toBeUndefined();
            old.store.dispose();
        } finally { vi.doUnmock("../src/core/constants.js"); vi.resetModules(); }
    });
});
