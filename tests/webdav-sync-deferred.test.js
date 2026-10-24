import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
import { SYNC_PENDING_KEY } from "../src/core/sync-pending-ledger.js";
import { ComputationBudget } from "../src/core/cooperative-work.js";
import { historyRank } from "../src/core/webdav-sync-model.js";

afterEach(() => vi.unstubAllGlobals());

describe("durable deferred sync bookkeeping", () => {
    it("fails closed and repairs a reset interrupted between the ledger epoch and sidecar write", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        const result = await a.state.patch("SYNC-1", { downloaded: true }); await a.store.flushPending();
        const pending = a.values.get(SYNC_PENDING_KEY);
        a.values.set(SYNC_PENDING_KEY, { ...pending, epoch: "interrupted-reset", localUndoIds: [] });
        expect((await a.store.read()).undoEligible).toEqual([]);
        expect(a.store.canUndo(result.transactionId)).toBe(false);
        await a.store.initialize();
        expect(a.values.get(SYNC_STATE_KEY).undoEpoch).toBe("interrupted-reset");
        expect(a.values.get(SYNC_STATE_KEY).undoEligible).toEqual([]);
    });
    it("cannot install an old undo baseline using the epoch of a later import", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const result = await a.state.patch("SYNC-1", { downloaded: true }); await a.store.flushPending();
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        const get = b.forage.getItem.getMockImplementation();
        let resume, enter, armed = true;
        const entered = new Promise(resolve => { enter = resolve; });
        b.forage.getItem.mockImplementation(async key => {
            const value = await get(key);
            if (key === SYNC_STATE_KEY && armed) { armed = false; enter(); await new Promise(resolve => { resume = resolve; }); }
            return value;
        });
        const delayed = b.store.read(); await entered;
        const data = await a.storage.exportPortableData(); await a.storage.importData(data);
        resume(); await delayed;
        const log = await b.state.getActivityLog();
        expect(log.entries.find(entry => entry.id === result.transactionId).undoAvailable).toBe(false);
        await expect(b.state.undoTransaction(result.transactionId)).rejects.toThrow("不能在本机撤销");
    });
    it("keeps a different tab's newly committed operation undoable after its bookkeeping is flushed", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        const result = await a.state.patch("SYNC-1", { downloaded: true });
        await a.store.flushPending();
        const log = await b.state.getActivityLog();
        expect(log.entries.find(entry => entry.id === result.transactionId).undoAvailable).toBe(true);
        await b.state.undoTransaction(result.transactionId);
        expect((await b.state.getState("SYNC-1"))?.stateFlags.downloaded ?? false).toBe(false);
    });

    it("retries when another tab changes only synchronization metadata during calculation", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        await a.state.patch("SYNC-1", { downloaded: true });
        let resume, enter;
        const entered = new Promise(resolve => { enter = resolve; }), calculate = a.store.computeReconciliation.bind(a.store);
        const computation = vi.spyOn(a.store, "computeReconciliation").mockImplementationOnce(async (...args) => { enter(); await new Promise(resolve => { resume = resolve; }); return calculate(...args); });
        const running = a.store.flushPending(); await entered;
        await a.store.update(state => { state.cleanupError = "retain concurrent metadata"; });
        resume(); await running;
        expect(computation.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect((await a.store.read()).cleanupError).toBe("retain concurrent metadata");
    });
    it("pauses a background CPU continuation while a business mutation owns the shared lock", async () => {
        const a = await syncReplica(memoryDav());
        let release, entered;
        const started = new Promise(resolve => { entered = resolve; });
        const business = a.coordinator.runExclusive(async () => { entered(); await new Promise(resolve => { release = resolve; }); });
        await started;
        let resumed = false;
        const work = a.store.idleBudget(new ComputationBudget({ yieldTask: async () => {} }));
        const continuation = work.yieldTask().then(() => { resumed = true; });
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(resumed).toBe(false);
        release(); await business; await continuation;
        expect(resumed).toBe(true);
    });
    it("retains the intent when sidecar persistence fails and repairs it after restart", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        const save = a.forage.setItem.getMockImplementation();
        await a.state.patch("SYNC-1", { downloaded: true });
        a.forage.setItem.mockImplementation(async (key, value) => { if (key === SYNC_STATE_KEY) throw new Error("sidecar unavailable"); return save(key, value); });
        await expect(a.store.flushPending()).rejects.toThrow("sidecar unavailable");
        expect(a.values.get(SYNC_PENDING_KEY).domains.car_list).toBeGreaterThan(0);
        a.forage.setItem.mockImplementation(save);
        const b = await a.restart(); await b.store.flushPending();
        expect((await b.store.read()).model.records["car_list/SYNC-1"].fields["flag:downloaded"].value).toBe(true);
        expect(b.values.get(SYNC_PENDING_KEY).domains).toEqual({});
    });

    it("keeps committed journal evidence when local undo handoff fails", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        const save = a.forage.setItem.getMockImplementation(); let failed = false;
        a.forage.setItem.mockImplementation(async (key, value) => {
            if (key === SYNC_PENDING_KEY && value.localUndoIds.length && !failed) { failed = true; throw new Error("handoff interrupted"); }
            return save(key, value);
        });
        const result = await a.state.patch("SYNC-1", { downloaded: true });
        expect(a.values.get("mutation_journal").id).toBe(result.transactionId);
        a.forage.setItem.mockImplementation(save);
        await a.state.recoverPendingTransaction();
        expect(a.store.canUndo(result.transactionId)).toBe(true);
        expect(a.values.get("mutation_journal")).toBeUndefined();
    });

    it("refuses a future ledger before a business write", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        a.values.set(SYNC_PENDING_KEY, { schema: 2 });
        await expect(a.state.patch("SYNC-1", { downloaded: true })).rejects.toThrow("未来版本");
        expect(a.values.get("car_list")).toEqual([]);
    });

    it("never applies a prepared pruning floor to surviving durable history", async () => {
        const old = { id: "old", createdAt: "2020-01-01T00:00:00.000Z", carNum: "SYNC-1" };
        const a = await syncReplica(memoryDav(), { data: { offline_history: [old] } }); await a.service.check();
        await a.coordinator.runExclusive(async () => { a.store.notePruned("offline_history", [old]); await a.store.capture("offline_history"); });
        await a.store.flushPending();
        const state = await a.store.read();
        expect((state.model.frontiers.offline_history || "") < historyRank(old)).toBe(true);
        expect(state.model.records["offline_history/old"]).toBeTruthy();
    });

    it("does not regrant restored local activity IDs after pending bookkeeping", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        const result = await a.state.patch("SYNC-1", { downloaded: true });
        const data = await a.storage.exportPortableData();
        expect(data).not.toHaveProperty(SYNC_PENDING_KEY);
        await a.storage.importData(data);
        await a.store.flushPending({ full: true });
        expect(a.store.canUndo(result.transactionId)).toBe(false);
        await expect(a.state.undoTransaction(result.transactionId)).rejects.toThrow("不能在本机撤销");
    });

    it("keeps pending work when computation is cancelled", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        await a.state.patch("SYNC-1", { downloaded: true });
        const abort = new AbortController(); abort.abort();
        await expect(a.store.flushPending({ work: new ComputationBudget({ signal: abort.signal }) })).rejects.toMatchObject({ name: "AbortError" });
        expect(a.values.get(SYNC_PENDING_KEY).domains.car_list).toBeGreaterThan(0);
        await a.store.flushPending();
        expect(a.values.get(SYNC_PENDING_KEY).domains).toEqual({});
    });
    it("returns a durable downloaded mark without reading or rewriting the full sync sidecar", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        a.forage.getItem.mockClear(); a.forage.setItem.mockClear();
        const marked = await a.state.patch("SYNC-1", { downloaded: true });
        expect(a.values.get("car_list")[0].stateFlags.downloaded).toBe(true);
        expect(a.forage.getItem.mock.calls.some(([key]) => key === SYNC_STATE_KEY)).toBe(false);
        expect(a.forage.setItem.mock.calls.some(([key]) => key === SYNC_STATE_KEY)).toBe(false);
        expect(a.store.canUndo(marked.transactionId)).toBe(true);
        await a.store.flushPending();
        expect((await a.store.read()).model.records["car_list/SYNC-1"].fields["flag:downloaded"].value).toBe(true);
    });

    it("allows a second mutation while reconciliation is computing outside the lock and retries its stale result", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        await a.state.patch("SYNC-1", { favorite: true });
        let resume, computing;
        const entered = new Promise(resolve => { computing = resolve; });
        const compute = a.store.computeReconciliation.bind(a.store);
        vi.spyOn(a.store, "computeReconciliation").mockImplementationOnce(async (...args) => {
            computing(); await new Promise(resolve => { resume = resolve; }); return compute(...args);
        });
        const drain = a.store.flushPending(); await entered;
        await a.state.patch("SYNC-1", { downloaded: true });
        resume(); await drain;
        const record = (await a.store.read()).model.records["car_list/SYNC-1"];
        expect(record.fields["flag:favorite"].value).toBe(true);
        expect(record.fields["flag:downloaded"].value).toBe(true);
    });

    it("recovers queued changes and local undo eligibility after the detail runtime is destroyed", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const result = await a.state.patch("SYNC-1", { downloaded: true });
        const b = await a.restart();
        expect((await b.state.getActivityLog()).entries.find(entry => entry.id === result.transactionId).undoAvailable).toBe(true);
        await b.service.check();
        expect((await b.store.read()).model.records["car_list/SYNC-1"].fields["flag:downloaded"].value).toBe(true);
    });
});
