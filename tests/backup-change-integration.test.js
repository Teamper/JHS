// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { BackupChangeTracker } from "../src/core/backup-change-tracker.js";
import { IndexedDbStorageAdapter } from "../src/platform/userscript/indexeddb-storage-adapter.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

beforeEach(() => {
    initializeRuntimeConstants(new URL("https://javdb.com/"));
    vi.stubGlobal("utils", { getNowStr: () => "2026-10-21 08:00:00" });
    vi.stubGlobal("clog", { warn: vi.fn(), log: vi.fn(), error: vi.fn(), debug: vi.fn() });
    vi.stubGlobal("show", { error: vi.fn() });
    StorageManager.instance = null;
});
afterEach(() => { StorageManager.instance = null; vi.unstubAllGlobals(); });

function fixture(initial = {}) {
    const values = new Map(Object.entries({ data_version: 3, setting: {}, car_list: [], favorite_actresses: [], ...initial }));
    const forage = { getItem: vi.fn(async key => structuredClone(values.get(key) ?? null)), setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }), removeItem: vi.fn(async key => values.delete(key)), keys: async () => [...values.keys()] };
    vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => forage });
    const storage = new StorageManager(), coordinator = new StorageMutationCoordinator({ lockManager: null });
    const tracker = new BackupChangeTracker(forage, coordinator);
    storage.mutationCoordinator = coordinator; storage.backupChanges = tracker;
    const state = new StateService(storage, { emit: vi.fn(async () => {}) }, coordinator);
    storage.stateService = state; coordinator.observer = tracker; tracker.enabled = true;
    return { values, forage, storage, coordinator, tracker, state };
}

describe("backup accounting at real persistence boundaries", () => {
    it("counts StateService batches once despite journal and new-video side effects", async () => {
        const f = fixture({ favorite_actresses: [{ starId: "actor", newVideoList: [{ carNum: "ABC-101" }, { carNum: "ABC-102" }] }] });
        const first = await f.state.patch(["ABC-101", "ABC-102"], { favorite: true });
        expect((await f.tracker.read()).totalRevision).toBe(2);
        await f.state.patch(["ABC-101", "ABC-102"], { favorite: true });
        expect((await f.tracker.read()).totalRevision).toBe(2);
        await f.state.undoTransaction(first.transactionId);
        expect((await f.tracker.read()).totalRevision).toBe(4);
        await f.state.recoverPendingTransaction();
        expect((await f.tracker.read()).totalRevision).toBe(4);
    });
    it("captures actor changes before in-place cache mutation and skips no-op writes", async () => {
        const f = fixture({ favorite_actresses: [{ starId: "actor", name: "Actor", newVideoList: [] }] });
        await f.storage.updateFavoriteActress({ starId: "actor", remark: "new note" });
        expect((await f.tracker.read()).totalRevision).toBe(1);
        await f.storage.updateFavoriteActress({ starId: "actor", remark: "new note" });
        expect((await f.tracker.read()).totalRevision).toBe(1);
        await f.storage.removeFavoriteActress("actor");
        expect((await f.tracker.read()).totalRevision).toBe(2);
    });
    it("covers the legacy tag API and the native Feature's direct storage adapter", async () => {
        const f = fixture();
        await f.storage.setHighlightedTags(["one"]);
        const adapter = new IndexedDbStorageAdapter(f.forage, {}, () => {}, () => {});
        adapter.beforeSet = key => f.tracker.capture(key);
        await f.coordinator.runExclusive(() => adapter.set("highlighted_tags", ["one", "two"]));
        expect((await f.tracker.read()).totalRevision).toBe(2);
    });
    it("counts successful import differences once and preserves the local schedule", async () => {
        const f = fixture({ car_list: [{ carNum: "ABC-101", remark: "old" }], setting: { webDavAutoBackupEnabled: "no", webDavAutoBackupMinutes: 30 } });
        await f.storage.importData({ data_version: 3, car_list: [{ carNum: "ABC-101", remark: "new" }, { carNum: "ABC-102" }], setting: { webDavAutoBackupEnabled: "yes", webDavAutoBackupMinutes: 1 } });
        expect((await f.tracker.read()).totalRevision).toBe(2);
        expect(f.values.get("setting")).toMatchObject({ webDavAutoBackupEnabled: "no", webDavAutoBackupMinutes: 30 });
    });
    it("does not count a failed import that restored all business tables", async () => {
        const f = fixture({ car_list: [{ carNum: "ABC-101", remark: "old" }] }), original = f.forage.setItem.getMockImplementation();
        let failed = false;
        f.forage.setItem.mockImplementation(async (key, value) => { if (key === "favorite_actresses" && !failed) { failed = true; throw new Error("injected import failure"); } return original(key, value); });
        await expect(f.storage.importData({ data_version: 3, car_list: [{ carNum: "ABC-102" }], favorite_actresses: [{ starId: "actor" }] })).rejects.toThrow("injected");
        expect(f.values.get("car_list")).toEqual([{ carNum: "ABC-101", remark: "old" }]);
        expect((await f.tracker.read()).totalRevision).toBe(0);
    });
});
