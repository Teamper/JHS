import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_STATE_KEY, SYNC_JOURNAL_KEY } from "../src/core/webdav-sync-store.js";
import { syncJson, parseSyncFileName } from "../src/core/webdav-sync-model.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

describe("automatic bidirectional WebDAV sync", () => {
    it("keeps the existing offline history limit even without a sync observer", async () => {
        const a = await syncReplica(memoryDav()); a.storage.syncState = null;
        a.values.set("offline_history", Array.from({ length: 1000 }, (_, index) => ({ id: `old-${index}`, createdAt: "2020-01-01T00:00:00.000Z" })));
        await a.state.appendOfflineHistory({ id: "fresh", carNum: "SYNC-1" });
        const history = a.values.get("offline_history"); expect(history).toHaveLength(1000); expect(history[0].id).toBe("old-1"); expect(history.at(-1).id).toBe("fresh");
    });
    it("refuses a prepared journal before touching a future-version database", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check();
        const after = await a.store.readData(); after.car_list = [{ carNum: "OLD-1" }];
        a.values.set(SYNC_JOURNAL_KEY, { schema: 1, state: "prepared", after, afterState: await a.store.read() }); a.values.set("data_version", 999);
        await expect(a.settings.set("themeMode", "dark")).rejects.toThrow();
        expect(a.values.get("car_list")).toEqual([]); expect(a.values.get("data_version")).toBe(999); expect(a.values.get(SYNC_JOURNAL_KEY).state).toBe("prepared");
    });
    it("does not publish unchanged writes, cache changes or a rolled-back business transaction", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check();
        const before = await a.store.read(), writes = dav.client.writeSyncFile.mock.calls.length;
        await a.state.patch(["SYNC-1"], { favorite: true }); await a.forage.setItem("third_party_ttl_cache", { test: true });
        const save = a.forage.setItem.getMockImplementation(); let failed = false;
        a.forage.setItem.mockImplementation(async (key, value) => { if (key === "car_list" && !failed) { failed = true; throw new Error("quota"); } return save(key, value); });
        await expect(a.state.patch(["SYNC-1"], { watched: true })).rejects.toThrow("quota");
        a.forage.setItem.mockImplementation(save); await a.service.check();
        expect(a.values.get("car_list")[0].stateFlags.watched).toBe(false);
        expect((await a.store.read()).counter).toBe(before.counter); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
    });
    it("keeps local sync identity, progress and credentials out of portable imports", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check(); const before = await a.store.read();
        await a.settings.patch({ containerColumns: 2, webDavPassword: "local-only" });
        const backup = await a.storage.exportData();
        expect(backup).not.toHaveProperty(SYNC_STATE_KEY); expect(backup.setting).not.toHaveProperty("webDavPassword");
        await a.storage.importData({ ...backup, [SYNC_STATE_KEY]: { schema: 999 }, [SYNC_JOURNAL_KEY]: { schema: 999 }, setting: { themeMode: "dark", webDavPassword: "foreign" } });
        expect((await a.store.read()).replicaId).toBe(before.replicaId); expect((await a.store.read()).seq).toBe(before.seq);
        expect(a.values.get("setting").webDavPassword).toBe("local-only"); expect(a.values.get(SYNC_JOURNAL_KEY)).toBeUndefined();
    });
    it("debounces durable changes and wakes on visible/online/pageshow without reviving a hidden page", async () => {
        const a = await syncReplica(memoryDav()); await a.service.check(); vi.useFakeTimers();
        const win = Object.assign(new EventTarget(), { setTimeout, clearTimeout }), doc = Object.assign(new EventTarget(), { hidden: false });
        a.service.window = win; const check = vi.spyOn(a.service, "check").mockResolvedValue(); const owner = new LifecycleScope("test");
        a.service.start(owner, doc); await vi.advanceTimersByTimeAsync(1000); expect(check).toHaveBeenCalledOnce();
        await a.state.patch(["WAKE-1"], { favorite: true }); await a.service.reschedule();
        await vi.advanceTimersByTimeAsync(4999); expect(check).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(1); expect(check).toHaveBeenCalledTimes(2);
        win.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(1); expect(check).toHaveBeenCalledTimes(3);
        win.dispatchEvent(new Event("pagehide")); await a.state.patch(["WAKE-2"], { favorite: true }); await vi.advanceTimersByTimeAsync(120000); expect(check).toHaveBeenCalledTimes(3);
        win.dispatchEvent(new Event("pageshow")); await vi.advanceTimersByTimeAsync(1); expect(check).toHaveBeenCalledTimes(4);
        doc.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(1); expect(check).toHaveBeenCalledTimes(5);
        owner.dispose();
    });
    it("does not confirm or delete after a connection changes during upload", async () => {
        const dav = memoryDav(), a = await syncReplica(dav), gate = deferred(), entered = deferred();
        const write = dav.client.writeSyncFile.getMockImplementation();
        dav.client.writeSyncFile.mockImplementationOnce(async (...args) => { entered.resolve(); await gate.promise; await write(...args); });
        const running = a.service.check(); await entered.promise; a.shared.revision = "changed"; gate.resolve(); await running;
        expect((await a.store.read()).pending).toBeTruthy(); expect((await a.store.read()).lastSuccessAt).toBe(0); expect(dav.client.deleteSyncFile).not.toHaveBeenCalled();
    });
    it("retains only its own files and retries a failed cleanup without uploading again", async () => {
        const dav = memoryDav(), a = await syncReplica(dav), b = await syncReplica(dav); await a.service.check(); await b.service.check();
        const foreign = [...dav.files.keys()].find(name => parseSyncFileName(name).replicaId === b.store.replicaId);
        await a.settings.patch({ webDavSyncKeepCount: 3, webDavSyncHistoryDays: 0 });
        for (let i = 0; i < 2; i++) { await a.state.patch([`SYNC-${i}`], { favorite: true }); await a.service.check(); }
        dav.client.deleteSyncFile.mockRejectedValueOnce(new Error("cannot delete"));
        await a.state.patch(["SYNC-3"], { favorite: true }); await a.service.check();
        expect((await a.store.read()).cleanupError).toContain("同步已成功"); const writes = dav.client.writeSyncFile.mock.calls.length;
        await a.service.check(); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes); expect((await a.store.read()).cleanupError).toContain("同步已成功");
        a.advance(60001); await a.service.check(); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes); expect((await a.store.read()).cleanupError).toBe("");
        expect(dav.files.has(foreign)).toBe(true); expect([...dav.files.keys()].filter(name => parseSyncFileName(name).replicaId === a.store.replicaId)).toHaveLength(3);
    });
    it("pauses future protocols before applying or publishing", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check(); const current = [...dav.files][0];
        dav.files.set(current[0].replace("sync_v1_", "sync_v2_"), current[1]);
        await expect(a.service.restore(current[0].replace("sync_v1_", "sync_v2_"))).rejects.toMatchObject({ code: "SYNC_FUTURE_VERSION" });
        await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check();
        expect((await a.store.read()).paused).toBe(true); expect(dav.client.writeSyncFile).toHaveBeenCalledOnce(); expect(dav.client.deleteSyncFile).not.toHaveBeenCalled();
    });
    it("restores selected preferences and layout as new changes without rewinding identity or sequence", async () => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "dark", containerColumns: 7 } } }); await a.service.check(); const oldFile = [...dav.files.keys()][0];
        await a.settings.patch({ themeMode: "light", containerColumns: 2 }); await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check();
        const before = await a.store.read();
        await a.service.restore(oldFile, true, undefined, { preferences: true, data: false });
        expect(a.values.get("setting")).toMatchObject({ themeMode: "dark", containerColumns: 7 }); expect(a.values.get("car_list")).toHaveLength(1);
        const restored = await a.store.read(); expect(restored.replicaId).toBe(before.replicaId); expect(restored.seq).toBe(before.seq); expect(restored.counter).toBeGreaterThan(before.counter);
        await a.service.check(); expect((await a.store.read()).seq).toBeGreaterThan(before.seq);
    });
    it("makes zero HTTP requests without a complete connection or reliable lock", async () => {
        const dav = memoryDav(), a = await syncReplica(dav, { profile: { url: "", username: "", password: "" } });
        await a.service.check();
        expect(a.webdav.createClient).not.toHaveBeenCalled();
        const b = await syncReplica(dav, { locks: null }); await b.service.check();
        expect(b.webdav.createClient).not.toHaveBeenCalled(); expect((await b.service.getStatus()).message).toContain("互斥");
    });
    it("joins with cloud priority and local-only additions, keeps layout/credentials and creates a restore point", async () => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "dark", containerColumns: 7 }, car_list: [{ carNum: "SYNC-1", stateFlags: { favorite: true }, remark: "cloud" }] } });
        await a.service.check(); expect(dav.files.size).toBe(1);
        const b = await syncReplica(dav, { data: { setting: { themeMode: "light", containerColumns: 2, webDavPassword: "local" }, car_list: [{ carNum: "SYNC-1", stateFlags: { favorite: false, blocked: true }, remark: "old", publishTime: "2026-01-01" }, { carNum: "SYNC-2", stateFlags: { watched: true } }] } });
        await b.service.check();
        expect(b.values.get("car_list")).toHaveLength(2);
        expect(b.values.get("car_list").find(r => r.carNum === "SYNC-1")).toMatchObject({ remark: "cloud", publishTime: "2026-01-01", stateFlags: { favorite: true, blocked: false } });
        expect(b.values.get("setting")).toMatchObject({ themeMode: "dark", containerColumns: 2, webDavPassword: "local" });
        expect(b.values.get("snapshots")[0]).toMatchObject({ source: "sync-join" });
        await a.service.check(); expect(a.values.get("car_list")).toHaveLength(2);
        const writes = dav.client.writeSyncFile.mock.calls.length; await a.service.check(); await b.service.check();
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
    });
    it("converges after concurrent fields, cancellation, deletion, stale offline edits and explicit recreation", async () => {
        const dav = memoryDav(), a = await syncReplica(dav), b = await syncReplica(dav);
        await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check(); await b.service.check();
        await a.state.patch(["SYNC-1"], { downloaded: true }); await b.state.patch(["SYNC-1"], { watched: true });
        await Promise.all([a.service.check(), b.service.check()]); await a.service.check(); await b.service.check();
        expect(a.values.get("car_list")[0].stateFlags).toEqual(b.values.get("car_list")[0].stateFlags);
        expect(a.values.get("car_list")[0].stateFlags).toMatchObject({ favorite: true, downloaded: true, watched: true });
        await a.state.patch(["SYNC-1"], { favorite: false }); await a.service.check(); await b.service.check();
        expect(b.values.get("car_list")[0].stateFlags.favorite).toBe(false);
        await a.state.remove(["SYNC-1"]); await a.service.check();
        await b.state.patch(["SYNC-1"], {}, { record: { remark: "stale offline" } }); await b.service.check(); await a.service.check();
        expect(a.values.get("car_list")).toEqual([]); expect(b.values.get("car_list")).toEqual([]);
        await b.state.patch(["SYNC-1"], { favorite: true }); await b.service.check(); await a.service.check();
        expect(a.values.get("car_list")[0].remark || "").toBe("");
    });
    it("preserves new data during upload and confirms only the captured local revision", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const gate = deferred(), entered = deferred(), original = dav.client.writeSyncFile.getMockImplementation();
        dav.client.writeSyncFile.mockImplementationOnce(async (...args) => { entered.resolve(); await gate.promise; await original(...args); });
        await a.state.patch(["SYNC-1"], { favorite: true });
        const running = a.service.check(); await entered.promise;
        await a.state.patch(["SYNC-2"], { watched: true }); gate.resolve(); await running;
        expect((await a.store.read()).dirty).toBe(true);
        await a.service.check(); expect((await a.store.read()).dirty).toBe(false);
        const b = await syncReplica(dav); await b.service.check(); expect(b.values.get("car_list")).toHaveLength(2);
    });
    it("reuses the same persisted file when PUT succeeds but its response or listing is lost", async () => {
        const dav = memoryDav(), a = await syncReplica(dav), original = dav.client.writeSyncFile.getMockImplementation();
        dav.client.writeSyncFile.mockImplementationOnce(async (...args) => { await original(...args); throw new Error("lost response"); });
        await a.service.check(); const pending = (await a.store.read()).pending;
        expect(pending).toBeTruthy(); expect(dav.files.has(pending.name)).toBe(true);
        const restarted = await a.restart(); restarted.advance(60001); await restarted.service.check();
        expect((await restarted.store.read()).pending).toBeNull(); expect(dav.files.size).toBe(1); expect(dav.client.writeSyncFile).toHaveBeenCalledOnce();
    });
    it("keeps confirmed data on directory rollback and rejects corrupt snapshots without any delete", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check();
        const b = await syncReplica(dav); await b.service.check(); await b.service.check();
        const before = syncJson(b.values.get("car_list"));
        dav.client.listSyncFiles.mockResolvedValueOnce([]); await b.service.check();
        expect(syncJson(b.values.get("car_list"))).toBe(before); expect(dav.client.deleteSyncFile).not.toHaveBeenCalled();
        b.advance(60001); await a.state.patch(["SYNC-2"], { favorite: true }); await a.service.check();
        const latest = [...dav.files.keys()].map(parseSyncFileName).filter(f => f.replicaId === (a.values.get(SYNC_STATE_KEY)).replicaId).sort((x, y) => y.seq - x.seq)[0];
        dav.files.set(latest.name, "corrupt"); await b.service.check();
        expect(syncJson(b.values.get("car_list"))).toBe(before); expect(dav.client.deleteSyncFile).not.toHaveBeenCalled();
    });
    it("repairs a business-to-sidecar crash window from the persisted shadow, including deletion", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check();
        const b = await syncReplica(dav); await b.service.check();
        const save = a.forage.setItem.getMockImplementation();
        a.forage.setItem.mockImplementation(async (key, value) => { if (key === SYNC_STATE_KEY) throw new Error("quota"); return save(key, value); });
        await expect(a.state.remove(["SYNC-1"])).resolves.toMatchObject({ changed: ["SYNC-1"] });
        expect(a.values.get("car_list")).toEqual([]); expect(a.store.error).toContain("已保存");
        a.forage.setItem.mockImplementation(save);
        const restarted = await a.restart(); await restarted.service.check(); await b.service.check();
        expect(b.values.get("car_list")).toEqual([]);
    });
    it("rolls a prepared remote journal forward before the next business edit", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const state = await a.store.read(), data = await a.store.readData(); data.setting.themeMode = "dark";
        a.values.set(SYNC_JOURNAL_KEY, { schema: 1, state: "prepared", after: data, afterState: state });
        await a.settings.set("videoMuted", true);
        await a.store.flushAppliedNotifications();
        expect(a.values.get(SYNC_JOURNAL_KEY)).toBeUndefined(); expect(a.values.get("setting")).toMatchObject({ themeMode: "dark", videoMuted: true });
    });
    it("pauses authorization failures, resets on new profile and never advances success on failure", async () => {
        const dav = memoryDav(), a = await syncReplica(dav);
        dav.client.ensureFolder.mockRejectedValueOnce(Object.assign(new Error("unauthorized"), { details: { status: 401 } }));
        await a.service.check(); await a.service.check(); expect(dav.client.ensureFolder).toHaveBeenCalledOnce(); expect((await a.store.read()).lastSuccessAt).toBe(0);
        a.shared.revision = "two"; await a.service.check(); expect((await a.store.read()).lastSuccessAt).toBeGreaterThan(0);
    });
    it("does not allow a foreign activity to be undone or replay an offline job", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); const result = await a.state.patch(["SYNC-1"], { favorite: true }); await a.service.check();
        const b = await syncReplica(dav); await b.service.check();
        expect((await b.state.getActivityLog()).entries[0].undoAvailable).toBe(false);
        await expect(b.state.undoTransaction(result.transactionId)).rejects.toThrow("其他设备");
        await expect(a.state.undoTransaction(result.transactionId)).resolves.toBeTruthy();
    });
});
