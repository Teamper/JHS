import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { nextSyncDelay, syncPublishDueAt } from "../src/services/webdav-sync-scheduling.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

afterEach(() => vi.unstubAllGlobals());

describe("same-origin sync polling", () => {
    it("shares the poll window across staggered tabs and refreshed pages", async () => {
        const dav = memoryDav(), first = await syncReplica(dav);
        await first.service.check({ scheduled: true });
        const tabs = [first];
        for (let i = 0; i < 4; i++) tabs.push(await syncReplica(dav, { values: first.values, locks: first.locks }));
        const lists = dav.client.listSyncFiles.mock.calls.length;
        for (const tab of tabs) await tab.service.check({ scheduled: true });
        expect(dav.client.ensureFolder).toHaveBeenCalledOnce();
        expect(dav.client.listSyncFiles).toHaveBeenCalledTimes(lists);
        const reads = dav.client.readSyncFile.mock.calls.length;
        for (const tab of tabs) tab.advance(30001);
        for (const tab of tabs) await tab.service.check({ scheduled: true });
        expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        expect(dav.client.readSyncFile).toHaveBeenCalledTimes(reads);
        expect(dav.client.writeSyncFile).toHaveBeenCalledOnce();
    });

    it("publishes pending local edits and allows explicit checks before the poll deadline", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check({ scheduled: true });
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        await a.state.patch(["POLL-1"], { favorite: true });
        b.advance(5000);
        await b.service.check({ scheduled: true });
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
        await a.service.retry(); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(3);
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
    });

    it("repairs a previous page's missed metadata before suppressing the first scheduled poll", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check({ scheduled: true });
        // Business persistence completed, but its metadata write never happened.
        a.values.set("filter_keyword_title", ["saved-before-crash"]);
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        await b.service.check({ scheduled: true });
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
        expect((await b.store.read()).model.records["filter_keyword_title/saved-before-crash"].fields.value.value).toBe("saved-before-crash");
    });

    it("honors foreground/background intervals and checks again after a clock rollback", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); a.service.document = { hidden: true };
        await a.service.check({ scheduled: true }); a.advance(30001);
        await a.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledOnce();
        a.service.document = { hidden: false };
        await a.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        a.advance(-60000); await a.service.check({ scheduled: true });
        expect(dav.client.ensureFolder).toHaveBeenCalledTimes(3);
    });

    it("does not skip a changed connection or bypass another tab's retry backoff", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check({ scheduled: true });
        a.shared.revision = "updated";
        dav.client.listSyncFiles.mockRejectedValueOnce(new Error("offline"));
        await a.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        const b = await syncReplica(dav, { values: a.values, locks: a.locks }); b.shared.revision = "updated";
        await b.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        b.advance(60001); await b.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(3);
    });
});

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function recordTimers(service) {
    const timers = [];
    service.window = { setTimeout: (_callback, delay) => { timers.push(delay); return timers.length; }, clearTimeout: () => {} };
    return timers;
}

describe("durable publication deadlines", () => {
    it("retains the first unpublished change across tabs and refresh, while debouncing later edits", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        await a.state.patch(["POLL-1"], { favorite: true }); const first = (await a.store.read()).dirtySinceAt;
        a.advance(4000); await a.state.patch(["POLL-2"], { favorite: true });
        expect((await a.store.read()).dirtySinceAt).toBe(first);
        const b = await syncReplica(dav, { values: a.values, locks: a.locks }); b.advance(4000); b.service.document = { hidden: true };
        const timers = recordTimers(b.service); await b.service.reschedule(); expect(timers.at(-1)).toBe(5000);
        await b.service.check({ scheduled: true }); expect(dav.client.writeSyncFile).toHaveBeenCalledOnce();
        b.advance(5000); await b.service.check({ scheduled: true }); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
        expect(await b.store.read()).toMatchObject({ dirty: false, dirtySinceAt: 0, lastLocalChangeAt: 0 });
    });

    it("caps continuous edits at the persisted 30-second deadline", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        await a.state.patch(["POLL-1"], { favorite: true }); const first = (await a.store.read()).dirtySinceAt;
        for (let i = 0; i < 7; i++) { a.advance(4000); await a.state.patch([`POLL-${i + 2}`], { favorite: true }); }
        expect(syncPublishDueAt(await a.store.read(), first + 28000)).toBe(first + 30000);
        const timers = recordTimers(a.service); await a.service.reschedule(); expect(timers.at(-1)).toBe(2000);
    });

    it("retries lock contention promptly and retains changes made during another tab's upload", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        a.service.document = b.service.document = { hidden: true };
        const aTimers = recordTimers(a.service), bTimers = recordTimers(b.service), entered = deferred(), gate = deferred();
        const original = dav.client.writeSyncFile.getMockImplementation();
        dav.client.writeSyncFile.mockImplementationOnce(async (...args) => { entered.resolve(); await gate.promise; return original(...args); });
        await a.state.patch(["POLL-1"], { favorite: true });
        const upload = a.service.check(); await entered.promise;
        await b.state.patch(["POLL-2"], { favorite: true }); a.advance(5000); b.advance(5000);
        await b.service.check({ scheduled: true }); expect(bTimers.at(-1)).toBe(1000);
        gate.resolve(); await upload;
        expect((await a.store.read()).dirty).toBe(true); expect(aTimers.at(-1)).toBeLessThanOrEqual(1000);
        b.advance(1000); await b.service.check({ scheduled: true });
        expect((await b.store.read()).dirty).toBe(false); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(3);
    });

    it("wakes the editing tab when another tab drains its deferred changes first", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        const timers = recordTimers(b.service), owner = new LifecycleScope("editing-tab");
        b.service.window = Object.assign(new EventTarget(), b.service.window);
        b.service.start(owner, Object.assign(new EventTarget(), { hidden: false }));
        await b.service.reschedule();
        const entered = deferred(), gate = deferred(), original = dav.client.writeSyncFile.getMockImplementation();
        let upload;
        dav.client.writeSyncFile.mockImplementationOnce(async (...args) => { entered.resolve(); await gate.promise; return original(...args); });
        try {
            await a.state.patch("POLL-1", { favorite: true });
            upload = a.service.check(); await entered.promise;
            await b.state.patch("POLL-1", { watched: true });
            // The application forwards the committed business event to this method.
            b.store.requestReconciliation();
            // Another tab can drain the shared intent before this tab's delayed worker.
            await a.store.flushPending(); await b.store.flushPending();
            await vi.waitFor(() => expect(timers.at(-1)).toBeLessThanOrEqual(1000));
            await b.service.check({ scheduled: true });
            expect(timers.at(-1)).toBe(1000);
            const pending = await b.store.read();
            expect(pending.localRevision).toBeGreaterThan(pending.pending.coveredRevision);
            expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
            gate.resolve(); await upload;
            b.advance(5000); await b.service.check({ scheduled: true });
            expect((await b.service.getStatus()).pendingChanges).toBe(0);
            expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(3);
            const reader = await syncReplica(dav); await reader.service.check();
            expect(reader.values.get("car_list")[0].stateFlags).toMatchObject({ favorite: true, watched: true });
        } finally { gate.resolve(); await upload; owner.dispose(); }
    });

    it("repairs missing/future deadlines immediately and lets network backoff outrank publication", async () => {
        const now = Date.UTC(2026, 9, 22);
        expect(syncPublishDueAt({ dirty: true }, now)).toBe(now);
        expect(syncPublishDueAt({ dirty: true, dirtySinceAt: now + 1, lastLocalChangeAt: now + 1 }, now)).toBe(now);
        expect(nextSyncDelay({ dirty: true, pending: {}, errorRevision: "one", retryAt: now + 60000 }, now, true, "one", true)).toBe(60000);
        const dav = memoryDav(), a = await syncReplica(dav); a.service.document = { hidden: true };
        const timers = recordTimers(a.service); dav.client.ensureFolder.mockRejectedValueOnce(new Error("offline"));
        await a.service.check(); expect(timers.at(-1)).toBe(60000);
        a.shared.isPaused = true; await a.service.reschedule(); expect(a.service.nextDueAt).toBe(0);
    });

    it("keeps an old dirty state without deadlines overdue when another edit arrives before the next check", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        await a.state.patch(["POLL-1"], { favorite: true });
        await a.store.update(state => { delete state.dirtySinceAt; delete state.lastLocalChangeAt; });
        a.advance(60000); await a.state.patch(["POLL-2"], { favorite: true });
        const state = await a.store.read();
        expect(syncPublishDueAt(state, state.lastLocalChangeAt)).toBeLessThanOrEqual(state.lastLocalChangeAt);
        const timers = recordTimers(a.service); await a.service.reschedule(); expect(timers.at(-1)).toBe(0);
    });

    it("does not recreate a timer after cancellation while a scheduling read is pending", async () => {
        const a = await syncReplica(memoryDav()), gate = deferred(), entered = deferred();
        const timers = recordTimers(a.service), original = a.store.read.bind(a.store);
        vi.spyOn(a.store, "read").mockImplementationOnce(async () => { entered.resolve(); await gate.promise; return original(); });
        const scheduling = a.service.reschedule(); await entered.promise; a.service.cancel(); gate.resolve(); await scheduling;
        expect(timers).toEqual([]); expect(a.service.nextDueAt).toBe(0);
    });
});
