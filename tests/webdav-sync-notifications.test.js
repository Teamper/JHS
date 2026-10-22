import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { SYNC_JOURNAL_KEY, SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
import { projectSyncData, SYNC_DOMAINS, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

afterEach(() => vi.unstubAllGlobals());

function queuedLocks() {
    let queue = Promise.resolve();
    const locks = { held: false, request(_name, callback) {
        const run = queue.then(async () => {
            locks.held = true;
            try { return await callback(); } finally { locks.held = false; }
        });
        queue = run.then(() => undefined, () => undefined);
        return run;
    } };
    return locks;
}

async function prepareJournal(replica, { theme = "dark", committed = false, legacy = false } = {}) {
    const state = await replica.store.read(), after = await replica.store.readData();
    after.setting.themeMode = theme;
    const projection = projectSyncData(after, state.model.frontiers);
    const afterState = { ...state, counter: state.counter + 1, model: versionSyncDiff(state.model, state.shadow, projection, [state.counter + 1, state.replicaId]).model, shadow: projection };
    const journal = { schema: 1, state: committed ? "committed" : "prepared", after, afterState, binding: state.binding };
    if (!legacy) Object.assign(journal, { notificationId: crypto.randomUUID(), carNums: after.car_list.map(car => car.carNum) });
    replica.values.set(SYNC_JOURNAL_KEY, structuredClone(journal));
    if (committed) {
        for (const domain of SYNC_DOMAINS) replica.values.set(domain, structuredClone(after[domain]));
        replica.values.set(SYNC_STATE_KEY, structuredClone(afterState));
    }
    return journal;
}

describe("durable remote-apply notifications", () => {
    it.each([false, true])("refreshes recovered settings after release without deadlocking queued settings writes (Web Locks=%s)", async useLocks => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "light" } } });
        await a.service.check();
        const locks = queuedLocks();
        if (useLocks) a.coordinator.lockManager = locks;
        await prepareJournal(a, { legacy: true });
        const refresh = a.settings.refresh.bind(a.settings), emitted = a.store.deps.events.emit;
        vi.spyOn(a.settings, "refresh").mockImplementation(async () => { expect(locks.held).toBe(false); return refresh(); });
        emitted.mockImplementation(async () => { expect(locks.held).toBe(false); });

        await Promise.all([a.settings.set("videoMuted", true), a.settings.refresh()]);
        await a.store.flushAppliedNotifications();
        expect(a.settings.snapshot()).toMatchObject({ themeMode: "dark", videoMuted: true });
        expect(a.values.get(SYNC_JOURNAL_KEY)).toBeUndefined();
        expect(emitted.mock.calls.map(([type]) => type)).toContain("settings-changed");
        expect(emitted.mock.calls.every(([, payload]) => payload.source === "remote-sync")).toBe(true);
    });

    it("keeps the original business failure while still notifying an already recovered commit", async () => {
        const a = await syncReplica(memoryDav(), { data: { setting: { themeMode: "light" } } });
        await a.service.check(); await prepareJournal(a);
        await expect(a.coordinator.runExclusive(() => { throw new Error("business failed"); })).rejects.toThrow("business failed");
        await a.store.flushAppliedNotifications();
        expect(a.settings.snapshot().themeMode).toBe("dark");
        expect(a.values.has(SYNC_JOURNAL_KEY)).toBe(false);
    });

    it("does not notify a partially replayed transaction and retries it before the next writer", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        a.store.deps.events.emit.mockClear();
        await prepareJournal(a, { legacy: true });
        const write = a.forage.setItem.getMockImplementation();
        let failed = false;
        a.forage.setItem.mockImplementation(async (key, value) => {
            if (key === "favorite_actresses" && !failed) { failed = true; throw new Error("write interrupted"); }
            return write(key, value);
        });
        const operation = vi.fn();
        await expect(a.coordinator.runExclusive(operation)).rejects.toThrow("write interrupted");
        expect(operation).not.toHaveBeenCalled();
        expect(a.values.get(SYNC_JOURNAL_KEY).state).toBe("prepared");
        expect(a.store.deps.events.emit).not.toHaveBeenCalled();
        await a.coordinator.runExclusive(() => "saved"); await a.store.flushAppliedNotifications();
        expect(a.settings.snapshot().themeMode).toBe("dark");
        expect(a.values.has(SYNC_JOURNAL_KEY)).toBe(false);
    });

    it.each(["refresh", "broadcast"])("retains committed state after %s failure and retries without replay or upload echo", async failure => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "light" } } });
        await a.service.check(); await prepareJournal(a);
        if (failure === "refresh") vi.spyOn(a.settings, "refresh").mockRejectedValueOnce(new Error("read interrupted"));
        else a.store.deps.events.emit.mockRejectedValueOnce(new Error("channel interrupted"));
        await expect(a.coordinator.runExclusive(() => "saved")).resolves.toBe("saved");
        await a.store.flushAppliedNotifications();
        expect(a.values.get(SYNC_JOURNAL_KEY).state).toBe("committed");
        expect(a.store.notificationError).toContain("刷新未完成");
        const state = await a.store.read(), writes = dav.client.writeSyncFile.mock.calls.length;
        a.forage.setItem.mockClear(); a.advance(30001);
        await a.coordinator.runExclusive(() => "retry trigger"); await a.store.flushAppliedNotifications();
        expect(a.values.has(SYNC_JOURNAL_KEY)).toBe(false);
        expect(a.forage.setItem.mock.calls.some(([key]) => SYNC_DOMAINS.includes(key))).toBe(false);
        expect(await a.store.read()).toEqual(state);
        expect(a.values.get("activity_log")?.entries || []).toEqual([]);
        await a.service.check();
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
        expect(a.store.notificationError).toBe("");
    });

    it("upgrades a committed legacy journal after reopening without overwriting newer business values", async () => {
        const a = await syncReplica(memoryDav(), { data: { setting: { themeMode: "light" } } });
        await a.service.check(); await prepareJournal(a, { committed: true, legacy: true });
        a.values.set("setting", { themeMode: "dark", videoMuted: true });
        const restarted = await a.restart(); await restarted.store.flushAppliedNotifications();
        expect(restarted.values.get("setting")).toEqual({ themeMode: "dark", videoMuted: true });
        expect(restarted.values.has(SYNC_JOURNAL_KEY)).toBe(false);
        expect(restarted.store.deps.events.emit).toHaveBeenCalledWith("settings-changed", expect.objectContaining({ source: "remote-sync" }));
        expect(restarted.forage.setItem.mock.calls.some(([key]) => SYNC_DOMAINS.includes(key))).toBe(false);
    });

    it("does not let an old notification acknowledgement erase a newer remote apply", async () => {
        const a = await syncReplica(memoryDav(), { data: { setting: { themeMode: "light" }, car_list: [{ carNum: "OLD-1", stateFlags: { favorite: true } }] } });
        await a.service.check(); const first = await prepareJournal(a);
        let release, entered;
        const gate = new Promise(resolve => { release = resolve; }), notified = new Promise(resolve => { entered = resolve; });
        a.store.deps.events.emit.mockImplementationOnce(async () => { entered(); await gate; });
        await a.coordinator.runExclusive(() => "recovered"); await notified;
        const state = await a.store.read(), data = await a.store.readData();
        data.setting.themeMode = "auto"; data.car_list.push({ carNum: "NEW-2", stateFlags: { watched: true } });
        const remote = versionSyncDiff(state.model, state.shadow, projectSyncData(data), [state.counter + 1, state.replicaId]).model;
        const pendingMerge = a.store.merge([remote], state.binding, async () => {});
        await vi.waitFor(() => expect(a.values.get(SYNC_JOURNAL_KEY).notificationId).not.toBe(first.notificationId));
        const second = a.values.get(SYNC_JOURNAL_KEY).notificationId, removed = [];
        const remove = a.forage.removeItem.getMockImplementation();
        a.forage.removeItem.mockImplementation(async key => { if (key === SYNC_JOURNAL_KEY) removed.push(a.values.get(key)?.notificationId); return remove(key); });
        release(); await pendingMerge; await a.store.flushAppliedNotifications();
        expect(removed).toEqual([second]);
        expect(a.settings.snapshot().themeMode).toBe("auto");
        expect(a.values.get("car_list").map(car => car.carNum)).toEqual(["NEW-2", "OLD-1"]);
        expect(a.store.deps.events.emit.mock.calls.filter(([type]) => type === "car-state-changed").at(-1)[1].carNums).toEqual(expect.arrayContaining(["OLD-1", "NEW-2"]));
    });

    it("persists metadata-only merges without replaying domains or emitting UI updates", async () => {
        const a = await syncReplica(memoryDav(), { data: { setting: { themeMode: "light" } } }); await a.service.check();
        const state = await a.store.read(), remote = structuredClone(state.model);
        remote.records["setting/themeMode"].fields.value.v = [state.counter + 1, state.replicaId];
        a.forage.setItem.mockClear(); a.store.deps.events.emit.mockClear();
        await a.store.merge([remote], state.binding, async () => {});
        expect(a.forage.setItem.mock.calls.some(([key]) => SYNC_DOMAINS.includes(key) || key === SYNC_JOURNAL_KEY)).toBe(false);
        expect(a.store.deps.events.emit).not.toHaveBeenCalled();
        expect((await a.store.read()).counter).toBe(state.counter + 1);
    });
});

describe("post-release coordinator scheduling", () => {
    it("keeps release-hook failures out of successful and failed business results", async () => {
        const coordinator = new StorageMutationCoordinator({ lockManager: queuedLocks() });
        coordinator.afterRelease = vi.fn(() => { throw new Error("hook failed"); });
        await expect(coordinator.runExclusive(() => "saved")).resolves.toBe("saved");
        await expect(coordinator.runExclusive(() => { throw new Error("business failed"); })).rejects.toThrow("business failed");
        expect(coordinator.afterRelease).toHaveBeenCalledTimes(2);
    });
});
