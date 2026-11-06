import { afterEach, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { WebDavSyncStore, SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
import { BackupChangeTracker, AUTO_BACKUP_STATE_KEY } from "../src/core/backup-change-tracker.js";
import { SYNC_PENDING_KEY } from "../src/core/sync-pending-ledger.js";

afterEach(() => vi.unstubAllGlobals());
async function fixture({ unavailable = false, fail = false } = {}) {
    vi.stubGlobal("utils", { getNowStr: () => "2026-11-05T00:00:00.000Z" });
    vi.stubGlobal("window", { location: { href: "https://javdb.com/" } });
    const values = new Map([["car_list", [{ carNum: "ABC-123", stateFlags: { favorite: false } }]]]);
    const forage = {
        getItem: async key => structuredClone(values.get(key) ?? null),
        setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }),
        removeItem: async key => values.delete(key),
    };
    const coordinator = new StorageMutationCoordinator({ lockManager: null });
    const sync = new WebDavSyncStore({ forage, coordinator });
    await sync.initialize(); sync.enabled = true;
    const backup = new BackupChangeTracker(forage, coordinator); backup.enabled = true;
    coordinator.observer = { begin() { sync.begin(); backup.begin(); }, async finish(ok) { await sync.finish(ok); await backup.finish(ok); } };
    const storage = { car_list_key: "car_list", favorite_actresses_key: "favorite_actresses", forage, syncState: sync, backupChanges: backup,
        _invalidateCache: vi.fn(), _getCacheGeneration: () => 0,
        atomicStorage: { commitLockedBatch: vi.fn(async ({ puts }) => {
            if (unavailable) return false;
            const staged = structuredClone(puts);
            if (fail) throw new Error("injected native abort");
            for (const [key, value] of Object.entries(staged)) values.set(key, value);
            return true;
        }) },
    };
    const state = new StateService(storage, { emit: vi.fn() }, coordinator);
    forage.setItem.mockClear();
    return { state, storage, values, sync, backup };
}
it("commits business data, activity, sync receipt and backup count together", async () => {
    const f = await fixture();
    try {
        const result = await f.state.toggle("ABC-123", "favorite");
        expect(f.values.get("car_list")[0].stateFlags.favorite).toBe(true);
        expect(f.values.get("activity_log").entries[0].commitState).toBe("committed");
        expect(f.values.get(SYNC_PENDING_KEY).localUndoIds).toContain(result.transactionId);
        expect(f.values.get(AUTO_BACKUP_STATE_KEY).totalRevision).toBe(1);
        expect(f.storage.forage.setItem.mock.calls.some(([key]) => key === "mutation_journal")).toBe(false);
        expect(f.storage.atomicStorage.commitLockedBatch).toHaveBeenCalledOnce();
        expect(f.sync.canUndo(result.transactionId)).toBe(true);
    } finally { f.sync.dispose(); }
});
it("aborts every prepared domain and receipt when the native transaction fails", async () => {
    const f = await fixture({ fail: true });
    const before = structuredClone([...f.values]);
    try {
        await expect(f.state.toggle("ABC-123", "favorite")).rejects.toThrow("native abort");
        expect([...f.values]).toEqual(before);
        expect(f.storage.atomicStorage.commitLockedBatch).toHaveBeenCalledOnce();
    } finally { f.sync.dispose(); }
});
it("reuses metadata only while all ledger revision fields match", async () => {
    const f = await fixture();
    try {
        await f.sync.read();
        const read = vi.spyOn(f.sync, "read");
        const cached = await f.sync.readMetadata();
        expect(read).not.toHaveBeenCalled();
        expect(cached.model).toBeUndefined();
        await f.state.toggle("ABC-123", "favorite");
        expect((await f.sync.readMetadata()).dirty).toBe(true);
        expect(read).toHaveBeenCalledOnce();
    } finally { f.sync.dispose(); }
});
it("reuses only database-owned round records and overlays fresh local receipts", async () => {
    const f = await fixture();
    try {
        await f.sync.readForRound();
        const read = vi.spyOn(f.sync, "read");
        const changed = await f.state.toggle("ABC-123", "favorite");
        const snapshot = await f.sync.readForRound();
        expect(snapshot.dirty).toBe(true);
        expect(f.sync.canUndo(changed.transactionId)).toBe(true);
        expect(read).not.toHaveBeenCalled();
        snapshot.model.records["test"] = {};
        expect((await f.sync.readForRound()).model.records.test).toBeUndefined();
    } finally { f.sync.dispose(); }
});
it("does not refill released snapshots from an in-flight database read", async () => {
    const f = await fixture();
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const reading = new Promise(resolve => { entered = resolve; });
    const original = f.storage.forage.getItem;
    vi.spyOn(f.storage.forage, "getItem").mockImplementation(async key => {
        if (key === SYNC_STATE_KEY) { entered(); await gate; }
        return original(key);
    });
    try {
        const pending = f.sync.readForRound();
        await reading; f.sync.releaseSnapshots(); release(); await pending;
        expect(f.sync.roundState).toBeNull(); expect(f.sync.metadata).toBeNull();
    } finally { f.sync.dispose(); }
});
it("waits for the sidecar commit before caching an advanced ledger revision", async () => {
    const f = await fixture();
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const writing = new Promise(resolve => { entered = resolve; });
    const original = f.storage.forage.setItem.getMockImplementation();
    vi.spyOn(f.storage.forage, "setItem").mockImplementation(async (key, value) => {
        if (key === SYNC_STATE_KEY) { entered(); await gate; }
        return original(key, value);
    });
    try {
        const writer = f.sync.update(state => { state.counter = 99; });
        await writing;
        // An unlocked compatibility read may observe the previous graph, but
        // it must never publish it into a revision-validated reusable cache.
        expect((await f.sync.read()).counter).not.toBe(99);
        const round = f.sync.readForRound(), metadata = f.sync.readMetadata();
        release(); await writer;
        expect((await round).counter).toBe(99);
        expect((await metadata).counter).toBe(99);
        expect(f.sync.roundState.state.counter).toBe(99);
    } finally { release(); f.sync.dispose(); }
});
it("records poll windows without rewriting model graphs and fences later errors", async () => {
    const f = await fixture();
    try {
        const before = await f.sync.ledger.read();
        await f.sync.recordCheck("profile", 100, 30100, async () => {});
        expect(f.storage.forage.setItem.mock.calls.map(([key]) => key)).toEqual([SYNC_PENDING_KEY]);
        expect((await f.sync.ledger.read()).metadataRevision).toBe(before.metadataRevision);
        expect(await f.sync.readMetadata()).toMatchObject({ checkedRevision: "profile", lastCheckAt: 100, nextCheckAt: 30100, error: "", paused: false });
        await f.sync.update(state => { state.error = "later failure"; state.retryAt = 99999; state.paused = true; });
        expect(await f.sync.readMetadata()).toMatchObject({ error: "later failure", retryAt: 99999, paused: true });
    } finally { f.sync.dispose(); }
});
it("does not persist a late poll receipt after cancellation", async () => {
    const f = await fixture();
    let checks = 0;
    try {
        const before = structuredClone([...f.values]);
        await expect(f.sync.recordCheck("profile", 100, 30100, async () => {
            if (++checks === 2) throw new DOMException("cancelled", "AbortError");
        })).rejects.toHaveProperty("name", "AbortError");
        expect([...f.values]).toEqual(before);
    } finally { f.sync.dispose(); }
});
it("uses the existing journal when native capability is unavailable before writes", async () => {
    const f = await fixture({ unavailable: true });
    try {
        await f.state.toggle("ABC-123", "favorite");
        expect(f.storage.forage.setItem.mock.calls.some(([key]) => key === "mutation_journal")).toBe(true);
        expect(f.values.get("car_list")[0].stateFlags.favorite).toBe(true);
        expect(f.values.has("mutation_journal")).toBe(false);
        expect(f.values.has(SYNC_STATE_KEY)).toBe(true);
    } finally { f.sync.dispose(); }
});
