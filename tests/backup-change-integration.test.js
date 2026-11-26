// @vitest-environment jsdom
import { memoryAtomicStorage, storageFromForage } from "./helpers/atomic-storage.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortableBackupService } from "../src/services/portable-backup-service.js";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { IndexedDbStorageAdapter } from "../src/platform/userscript/indexeddb-storage-adapter.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

beforeEach(() => {
    initializeRuntimeConstants(new URL("https://javdb.com/"));
    vi.stubGlobal("utils", { getNowStr: () => "2026-10-21 08:00:00" });
    vi.stubGlobal("clog", { warn: vi.fn(), log: vi.fn(), error: vi.fn(), debug: vi.fn() });
    vi.stubGlobal("show", { error: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

function fixture(initial = {}) {
    const values = new Map(Object.entries({ data_version: 3, setting: {}, car_list: [], favorite_actresses: [], ...initial }));
    const forage = { getItem: vi.fn(async key => structuredClone(values.get(key) ?? null)), setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }), removeItem: vi.fn(async key => values.delete(key)), keys: async () => [...values.keys()] };
    vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => forage });
    const storage = storageFromForage(forage, memoryAtomicStorage(values));
    const coordinator = new StorageMutationCoordinator({ lockManager: null });
    const state = new StateService(storage, { emit: vi.fn(async () => {}) }, coordinator);
    const backup = new PortableBackupService({ storage, coordinator, state });
    return { values, forage, storage, coordinator, state, backup };
}

describe("business writes at real persistence boundaries", () => {
    it("commits each changed movie once and undoes its new-video side effects", async () => {
        const f = fixture({ favorite_actresses: [{ starId: "actor", newVideoList: [{ carNum: "ABC-101" }, { carNum: "ABC-102" }] }] });
        const first = await f.state.patch(["ABC-101", "ABC-102"], { favorite: true });
        expect(f.values.get("car_list").map(row => row.stateFlags.favorite)).toEqual([true, true]);
        await f.state.patch(["ABC-101", "ABC-102"], { favorite: true });
        expect(f.values.get("activity_log").entries).toHaveLength(1);
        await f.state.undoTransaction(first.transactionId);
        await f.state.recoverPendingTransaction();
        expect(f.values.get("car_list").some(row => row.stateFlags.favorite)).toBe(false);
        expect(f.values.get("favorite_actresses")[0].newVideoList.map(row => row.carNum)).toEqual(["ABC-101", "ABC-102"]);
    });
    it("persists actor edits and removal through the state service", async () => {
        const f = fixture({ favorite_actresses: [{ starId: "actor", name: "Actor", newVideoList: [] }] });
        await f.state.updateFavoriteActress({ starId: "actor", remark: "new note" });
        expect(f.values.get("favorite_actresses")[0].remark).toBe("new note");
        await f.state.updateFavoriteActress({ starId: "actor", remark: "new note" });
        expect(f.values.get("favorite_actresses")).toHaveLength(1);
        await f.state.removeFavoriteActress("actor");
        expect(f.values.get("favorite_actresses")).toEqual([]);
    });
    it("shares highlighted tags between StorageService and IndexedDbStorageAdapter", async () => {
        const f = fixture();
        const adapter = new IndexedDbStorageAdapter(f.forage, {}, () => {}, () => {});
        await f.coordinator.runExclusive(() => f.storage.set("highlighted_tags", ["one"]));
        expect(await adapter.get("highlighted_tags")).toEqual(["one"]);
        await f.coordinator.runExclusive(() => adapter.set("highlighted_tags", ["one", "two"]));
        expect(f.values.get("highlighted_tags")).toEqual(["one", "two"]);
    });
    it("imports business records and preserves the local schedule", async () => {
        const f = fixture({ car_list: [{ carNum: "ABC-101", remark: "old" }], setting: { webDavAutoBackupEnabled: "no", webDavAutoBackupMinutes: 30 } });
        await f.backup.importData({ data_version: 3, car_list: [{ carNum: "ABC-101", remark: "new" }, { carNum: "ABC-102" }], setting: { webDavAutoBackupEnabled: "yes", webDavAutoBackupMinutes: 1 } });
        expect(f.values.get("car_list")).toMatchObject([{ carNum: "ABC-101", remark: "new" }, { carNum: "ABC-102" }]);
        expect(f.values.get("setting")).toMatchObject({ webDavAutoBackupEnabled: "no", webDavAutoBackupMinutes: 30 });
    });
    it("leaves the original business tables intact after a failed import", async () => {
        const f = fixture({ car_list: [{ carNum: "ABC-101", remark: "old" }] });
        const atomic = memoryAtomicStorage(f.values, { beforeWrite: async key => { if (key === "favorite_actresses") throw new Error("injected import failure"); } });
        const backup = new PortableBackupService({ storage: storageFromForage(f.forage, atomic), coordinator: f.coordinator, state: f.state });
        await expect(backup.importData({ data_version: 3, car_list: [{ carNum: "ABC-102" }], favorite_actresses: [{ starId: "actor" }] })).rejects.toThrow("injected");
        expect(f.values.get("car_list")).toEqual([{ carNum: "ABC-101", remark: "old" }]);
        expect(f.values.get("favorite_actresses")).toEqual([]);
    });
});
