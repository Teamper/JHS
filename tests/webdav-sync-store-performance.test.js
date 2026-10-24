import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
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
