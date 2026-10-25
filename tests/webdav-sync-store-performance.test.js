import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_JOURNAL_KEY, SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
import { SYNC_PENDING_KEY } from "../src/core/sync-pending-ledger.js";
import { historyRank, maximumClock, SYNC_DOMAINS } from "../src/core/webdav-sync-model.js";

afterEach(() => vi.unstubAllGlobals());

async function writeDomain(replica, domain, value, pruned = []) {
    await replica.coordinator.runExclusive(async () => {
        await replica.store.capture(domain);
        replica.store.notePruned(domain, pruned);
        await replica.forage.setItem(domain, value);
    });
    await replica.store.flushPending();
}

describe("incremental WebDAV sync bookkeeping", () => {
    it("uses its registered recovery hook once in each initialization lock", async () => {
        const a = await syncReplica(memoryDav()), recover = vi.spyOn(a.store, "recoverWithoutLock");
        a.coordinator.beforeMutation = a.store.recoverBeforeMutation;
        await a.coordinator.runExclusive(async () => {});
        expect(recover).toHaveBeenCalledOnce();
        recover.mockClear();
        await a.store.initialize();
        expect(recover).toHaveBeenCalledOnce();
        a.values.set(SYNC_PENDING_KEY, { ...a.values.get(SYNC_PENDING_KEY), schema: 99 });
        a.forage.setItem.mockClear();
        await expect(a.store.initialize()).rejects.toThrow("同步待处理记录损坏或来自未来版本");
        expect(a.forage.setItem).not.toHaveBeenCalled();
    });

    it.each(["missing", "unrelated"])("still validates recovery with a %s coordinator hook", async mode => {
        const a = await syncReplica(memoryDav()), recover = vi.spyOn(a.store, "recoverWithoutLock");
        a.coordinator.beforeMutation = mode === "missing" ? null : async () => {};
        a.values.set(SYNC_PENDING_KEY, { ...a.values.get(SYNC_PENDING_KEY), schema: 99 });
        a.forage.setItem.mockClear();
        await expect(a.store.initialize()).rejects.toThrow("同步待处理记录损坏或来自未来版本");
        expect(recover).toHaveBeenCalledOnce();
        expect(a.forage.setItem).not.toHaveBeenCalled();
    });

    it.each(["recovery", "initialized snapshot"])("overlaps independent %s reads while retaining the write barrier", async phase => {
        const a = await syncReplica(memoryDav());
        const before = structuredClone(a.values.get(SYNC_STATE_KEY));
        if (phase !== "recovery") vi.spyOn(a.store, "recoverWithoutLock").mockResolvedValue(null);
        const read = a.forage.getItem.getMockImplementation();
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        a.forage.getItem.mockImplementation(async key => {
            if (key === SYNC_PENDING_KEY) await gate;
            return read(key);
        });
        a.forage.getItem.mockClear(); a.forage.setItem.mockClear();
        const operation = phase === "recovery" ? a.store.recoverWithoutLock() : a.store.initialize();
        try {
            const independentKey = phase === "recovery" ? SYNC_JOURNAL_KEY : SYNC_STATE_KEY;
            await vi.waitFor(() => expect(a.forage.getItem.mock.calls.some(([key]) => key === independentKey)).toBe(true));
            expect(a.forage.setItem).not.toHaveBeenCalled();
        } finally { release(); await operation; }
        expect(a.values.get(SYNC_STATE_KEY)).toEqual(before);
        expect(a.forage.setItem).not.toHaveBeenCalled();
    });

    it("reopens an initialized replica without rewriting its durable epoch or sidecar", async () => {
        const a = await syncReplica(memoryDav());
        const state = structuredClone(a.values.get(SYNC_STATE_KEY)), pending = structuredClone(a.values.get(SYNC_PENDING_KEY));
        a.forage.setItem.mockClear();
        await a.store.initialize();
        expect(a.forage.setItem).not.toHaveBeenCalled();
        expect(a.values.get(SYNC_STATE_KEY)).toEqual(state);
        expect(a.values.get(SYNC_PENDING_KEY)).toEqual(pending);
        expect(pending.replicaId).toBe(state.replicaId);
        expect(pending.epoch).toBe(state.undoEpoch);
    });

    it("rejects a future sidecar before issuing any initialization writes", async () => {
        const a = await syncReplica(memoryDav());
        const future = { ...a.values.get(SYNC_STATE_KEY), schema: 99 };
        a.values.set(SYNC_STATE_KEY, future); a.forage.setItem.mockClear();
        await expect(a.store.initialize()).rejects.toThrow("同步状态损坏或版本不受支持");
        expect(a.forage.setItem).not.toHaveBeenCalled();
        expect(a.values.get(SYNC_STATE_KEY)).toEqual(future);
    });

    it("durably repairs a missing replica identity even when its epoch already matches", async () => {
        const a = await syncReplica(memoryDav());
        a.values.set(SYNC_STATE_KEY, { ...a.values.get(SYNC_STATE_KEY), replicaId: "" });
        const state = await a.store.initialize(), pending = a.values.get(SYNC_PENDING_KEY);
        expect(state.replicaId).not.toBe("");
        expect(a.values.get(SYNC_STATE_KEY).replicaId).toBe(state.replicaId);
        expect(pending.replicaId).toBe(state.replicaId);
    });

    it("adopts a legacy undo baseline and retries a first sidecar write without losing the epoch", async () => {
        const a = await syncReplica(memoryDav());
        const legacy = { ...a.values.get(SYNC_STATE_KEY), undoEligible: ["legacy-undo"] };
        delete legacy.undoEpoch; a.values.set(SYNC_STATE_KEY, legacy);
        await a.store.initialize();
        expect(a.store.canUndo("legacy-undo")).toBe(true);
        expect(a.values.get(SYNC_STATE_KEY).undoEpoch).toBe(a.values.get(SYNC_PENDING_KEY).epoch);
        a.values.delete(SYNC_STATE_KEY); a.values.delete(SYNC_PENDING_KEY);
        const save = a.forage.setItem.getMockImplementation();
        a.forage.setItem.mockImplementation(async (key, value) => { if (key === SYNC_STATE_KEY) throw new Error("sidecar unavailable"); return save(key, value); });
        await expect(a.store.initialize()).rejects.toThrow("sidecar unavailable");
        const epoch = a.values.get(SYNC_PENDING_KEY).epoch;
        expect(a.values.has(SYNC_STATE_KEY)).toBe(false);
        a.forage.setItem.mockImplementation(save);
        const state = await a.store.initialize();
        expect(a.values.get(SYNC_STATE_KEY)).toEqual(state);
        expect(a.values.get(SYNC_PENDING_KEY)).toMatchObject({ epoch, replicaId: state.replicaId });
    });

    it("reads only the changed domain and preserves unrelated fields, tombstones, frontiers and layout", async () => {
        const a = await syncReplica(memoryDav(), { data: { car_list: [{ carNum: "SYNC-1", stateFlags: { favorite: true }, remark: "untouched" }], setting: { containerColumns: 4 }, filter_keyword_review: ["removed"] } });
        await a.service.check();
        await writeDomain(a, "filter_keyword_review", []);
        await a.store.update(state => { state.model.frontiers.offline_history = "2020-01-01T00:00:00.000Z\u0000old"; });
        const before = await a.store.read();
        a.forage.getItem.mockClear();
        await writeDomain(a, "filter_keyword_title", ["new"]);
        const reads = a.forage.getItem.mock.calls.map(([key]) => key);
        expect(reads.filter(key => SYNC_DOMAINS.includes(key))).toEqual(["filter_keyword_title"]);
        // The durable small ledger replaces the previous synchronous sidecar write.
        expect(reads.filter(key => key === SYNC_STATE_KEY)).toHaveLength(1);
        const after = await a.store.read();
        expect(after.model.records["car_list/SYNC-1"]).toEqual(before.model.records["car_list/SYNC-1"]);
        expect(after.shadow["car_list/SYNC-1"]).toEqual(before.shadow["car_list/SYNC-1"]);
        expect(after.model.records["filter_keyword_review/removed"]).toEqual(before.model.records["filter_keyword_review/removed"]);
        expect(after.model.records["filter_keyword_review/removed"].death).toBeTruthy();
        expect(after.model.frontiers).toEqual(before.model.frontiers);
        expect(after.layout).toEqual(before.layout);
        expect(after.counter).toBeGreaterThan(maximumClock(before.model));
    });

    it("does not rewrite sidecar or scan other domains for a no-op settings save", async () => {
        const a = await syncReplica(memoryDav(), { data: { setting: { themeMode: "dark" }, car_list: [{ carNum: "SYNC-1", stateFlags: { favorite: true } }] } });
        await a.service.check();
        const before = await a.store.read(); a.forage.getItem.mockClear(); a.forage.setItem.mockClear();
        await writeDomain(a, "setting", structuredClone(a.values.get("setting")));
        expect(a.forage.getItem.mock.calls.some(([key]) => key === "car_list")).toBe(false);
        expect(a.forage.setItem.mock.calls.some(([key]) => key === SYNC_STATE_KEY)).toBe(false);
        expect((await a.store.read()).localRevision).toBe(before.localRevision);
    });

    it("retains missed domain changes until the full pre-sync reconciliation repairs them", async () => {
        const a = await syncReplica(memoryDav(), { data: { car_list: [{ carNum: "SYNC-1", stateFlags: { favorite: true } }] } });
        await a.service.check(); const initial = await a.store.read();
        const cars = structuredClone(a.values.get("car_list")); cars[0].stateFlags.watched = true; a.values.set("car_list", cars);
        await writeDomain(a, "filter_keyword_title", ["new"]);
        expect((await a.store.read()).model.records["car_list/SYNC-1"]).toEqual(initial.model.records["car_list/SYNC-1"]);
        await a.coordinator.runExclusive(() => a.store.reconcileWithoutLock());
        const repaired = await a.store.read();
        expect(repaired.model.records["car_list/SYNC-1"].fields["flag:watched"].value).toBe(true);
        expect(repaired.model.records["filter_keyword_title/new"].fields.value.value).toBe("new");
        expect(a.values.get("car_list")[0].stateFlags.watched).toBe(true);
    });

    it("compacts old confirmed and pending models without changing aggregate state or durable upload bytes", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        const old = structuredClone(a.values.get(SYNC_STATE_KEY));
        const confirmation = Object.values(old.confirmed)[0]; confirmation.model = structuredClone(old.model);
        old.pending = { name: "durable-file", seq: 9, content: "same-encrypted-bytes", hash: "same-hash", coveredRevision: 7, model: structuredClone(old.model) };
        a.values.set(SYNC_STATE_KEY, old);
        const read = await a.store.read();
        expect(Object.values(read.confirmed)[0]).not.toHaveProperty("model");
        expect(read.pending).not.toHaveProperty("model");
        expect(read.model).toEqual(old.model);
        await a.store.update(() => {});
        const saved = a.values.get(SYNC_STATE_KEY);
        expect(Object.values(saved.confirmed)[0]).toEqual({ seq: confirmation.seq, name: confirmation.name });
        expect(saved.pending).toEqual({ name: "durable-file", seq: 9, content: "same-encrypted-bytes", hash: "same-hash", coveredRevision: 7 });
        expect(saved.model).toEqual(old.model);
    });

    it("prunes only the touched history while retaining the other history's records and undo eligibility", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        await a.state.patch(["SYNC-1"], { favorite: true });
        const old = { id: "old-offline", createdAt: "2020-01-01T00:00:00.000Z", carNum: "SYNC-1" };
        const recent = { id: "recent-offline", createdAt: "2026-10-22T00:00:00.000Z", carNum: "SYNC-2" };
        await writeDomain(a, "offline_history", [old, recent]);
        const before = await a.store.read();
        await writeDomain(a, "offline_history", [recent], [old]);
        const after = await a.store.read();
        expect(after.model.frontiers.offline_history).toBe(historyRank(old));
        expect(after.model.records["offline_history/old-offline"]).toBeUndefined();
        expect(after.model.records["offline_history/recent-offline"]).toEqual(before.model.records["offline_history/recent-offline"]);
        for (const [key, value] of Object.entries(before.model.records)) if (key.startsWith("activity_log/")) expect(after.model.records[key]).toEqual(value);
        expect(after.undoEligible).toEqual(before.undoEligible);
    });
});
