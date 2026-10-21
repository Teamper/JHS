// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackupChangeTracker, AUTO_BACKUP_STATE_KEY } from "../src/core/backup-change-tracker.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { StorageManager } from "../src/core/storage.js";
import { SettingsService } from "../src/services/settings-service.js";
import { WebDavService } from "../src/services/webdav-service.js";
import { AutoBackupService } from "../src/services/auto-backup-service.js";
import { AUTO_BACKUP_DEFAULTS, autoBackupFileName } from "../src/core/auto-backup-policy.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const services = [];
afterEach(() => { services.splice(0).forEach(service => service.cancel()); vi.useRealTimers(); });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function fixture(overrides = {}) {
    const values = new Map(Object.entries({ data_version: 3, car_list: [], setting: { ...AUTO_BACKUP_DEFAULTS, webDavUrl: "https://dav.example/dav", webDavUsername: "user", webDavProfileRevision: "profile-one", ...overrides } }));
    const forage = { getItem: vi.fn(async key => structuredClone(values.get(key) ?? null)), setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }), removeItem: vi.fn(async key => values.delete(key)), keys: async () => [...values.keys()] };
    const coordinator = new StorageMutationCoordinator({ lockManager: null });
    const tracker = new BackupChangeTracker(forage, coordinator);
    coordinator.observer = tracker;
    const storage = Object.assign(Object.create(StorageManager.prototype), { forage, mutationCoordinator: coordinator, backupChanges: tracker, setting_key: "setting", car_list_key: "car_list", _invalidateCache: vi.fn() });
    const settings = new SettingsService({ get: key => forage.getItem(key), set: (key, value) => forage.setItem(key, value) }, { mutationCoordinator: coordinator });
    await settings.load();
    const credential = { readEntry: vi.fn(async () => ({ exists: true, value: "synthetic-password" })) };
    const webdav = new WebDavService({}, credential, settings, "https://javdb.com");
    const client = { listManagedBackups: vi.fn(async () => [...files].sort().reverse()), deleteManagedBackup: vi.fn(async (_folder, name) => { files.splice(files.indexOf(name), 1); }) };
    const files = [];
    const upload = vi.fn(async options => {
        options.scope.assertActive();
        const snapshot = await options.exportSnapshot();
        files.push(options.fileName);
        return { client, fileName: options.fileName, coveredRevision: snapshot.revision, completedAt: now };
    });
    let now = Date.UTC(2026, 9, 21);
    let held = false;
    const locks = { request: vi.fn(async (_name, _options, callback) => {
        if (held) return callback(null);
        held = true;
        try { return await callback({}); } finally { held = false; }
    }) };
    const dependencies = { settings, webdav, tracker, storage, locks, upload, window, clock: () => now };
    const service = new AutoBackupService(dependencies);
    services.push(service);
    return { service, dependencies, settings, webdav, tracker, values, forage, upload, client, files, locks, coordinator, credential, storage, advance: minutes => { now += minutes * 60000; }, change: count => tracker.update(state => { state.totalRevision += count; }) };
}

describe("WebDAV automatic backup", () => {
    it("stays off and makes no upload for an unconfigured or disabled installation", async () => {
        const f = await fixture({ webDavUrl: "", webDavUsername: "" });
        await f.service.check();
        expect(f.credential.readEntry).not.toHaveBeenCalled();
        expect(f.upload).not.toHaveBeenCalled();
        expect(f.values.has(AUTO_BACKUP_STATE_KEY)).toBe(false);
        await expect(f.service.enable()).rejects.toThrow("验证失败");
        expect(f.upload).not.toHaveBeenCalled();
        expect(f.settings.snapshot().webDavAutoBackupEnabled).toBe("no");
    });
    it("creates and verifies the first portable backup before enabling", async () => {
        const f = await fixture();
        expect(f.settings.snapshot().webDavAutoBackupEnabled).toBe("no");
        await f.service.enable();
        expect(f.client.listManagedBackups).toHaveBeenCalledOnce();
        expect(f.settings.snapshot().webDavAutoBackupEnabled).toBe("yes");
        const options = f.upload.mock.calls[0][0], snapshot = await options.exportSnapshot();
        expect(snapshot.data.setting).not.toHaveProperty("webDavAutoBackupEnabled");
        expect(snapshot.data.setting).not.toHaveProperty("webDavProfileRevision");
        expect(snapshot.data).not.toHaveProperty(AUTO_BACKUP_STATE_KEY);
        expect(await f.service.getStatus()).toMatchObject({ enabled: true, pendingChanges: 0, verifiedRevision: "profile-one" });
    });
    it("keeps the switch off if upload cannot be confirmed in a successful listing", async () => {
        const f = await fixture();
        f.client.listManagedBackups.mockResolvedValue([]);
        await expect(f.service.enable()).rejects.toThrow("验证失败");
        expect(f.settings.snapshot().webDavAutoBackupEnabled).toBe("no");
        expect(f.files).toHaveLength(1);
        expect(f.client.deleteManagedBackup).not.toHaveBeenCalled();
    });
    it("never uploads with an unreadable credential", async () => {
        const f = await fixture();
        f.credential.readEntry.mockRejectedValue(new Error("damaged"));
        await expect(f.service.enable()).rejects.toThrow();
        expect(f.upload).not.toHaveBeenCalled();
    });
    it.each([
        [{ webDavAutoBackupOnChanges: "yes", webDavAutoBackupOnInterval: "no" }, true, false],
        [{ webDavAutoBackupOnChanges: "no", webDavAutoBackupOnInterval: "yes" }, false, true],
        [{ webDavAutoBackupOnChanges: "yes", webDavAutoBackupOnInterval: "yes" }, true, true],
    ])("supports independent and combined trigger policies %j", async (policy, byChanges, byTime) => {
        const f = await fixture({ ...policy, webDavAutoBackupChangeCount: 10 });
        await f.service.enable();
        await f.change(9); await f.service.check();
        expect(f.upload).toHaveBeenCalledTimes(1);
        await f.change(1); await f.service.check();
        expect(f.upload).toHaveBeenCalledTimes(byChanges ? 2 : 1);
        f.advance(31); await f.service.check();
        expect(f.upload).toHaveBeenCalledTimes((byChanges ? 2 : 1) + (byTime ? 1 : 0));
    });
    it("persists progress across instances and catches up only once after a long absence", async () => {
        const f = await fixture(); await f.service.enable(); f.service.cancel();
        const reopened = new AutoBackupService(f.dependencies); services.push(reopened);
        f.advance(10000); await reopened.check(); await reopened.check();
        expect(f.upload).toHaveBeenCalledTimes(2);
    });
    it("keeps changes made while the captured snapshot is uploading", async () => {
        const f = await fixture({ webDavAutoBackupChangeCount: 10 }); await f.service.enable();
        await f.change(10);
        f.upload.mockImplementationOnce(async options => {
            const snapshot = await options.exportSnapshot();
            await f.change(3);
            return { client: f.client, fileName: options.fileName, coveredRevision: snapshot.revision };
        });
        await f.service.check();
        expect(await f.service.getStatus()).toMatchObject({ pendingChanges: 3, totalRevision: 13, backedUpRevision: 10 });
    });
    it("serializes tabs and rechecks the shared successful checkpoint", async () => {
        const f = await fixture(); await f.service.enable(); f.advance(31);
        const other = new AutoBackupService(f.dependencies); services.push(other);
        await Promise.all([f.service.check(), other.check()]);
        await other.check();
        expect(f.upload).toHaveBeenCalledTimes(2);
    });
    it("does not clear a recovery request created after snapshot export", async () => {
        const f = await fixture(); await f.service.enable(); await f.change(100);
        f.upload.mockImplementationOnce(async options => {
            const snapshot = await options.exportSnapshot();
            await f.tracker.update(state => { state.needsBackup = true; state.recoveryToken = "late-recovery"; });
            f.tracker.needsBackup = true; f.tracker.recoveryToken = "late-memory-recovery";
            return { client: f.client, fileName: options.fileName, coveredRevision: snapshot.revision };
        });
        await f.service.check();
        expect((await f.tracker.read()).needsBackup).toBe(true);
        expect(f.tracker.needsBackup).toBe(true);
    });
    it("retains old files and counters on failure and persists retry cooldown", async () => {
        const f = await fixture({ webDavAutoBackupChangeCount: 10 }); await f.service.enable(); await f.change(10);
        const before = await f.tracker.read();
        f.upload.mockRejectedValueOnce(new Error("timeout"));
        await f.service.check(); await f.service.check();
        expect(f.upload).toHaveBeenCalledTimes(2);
        expect(f.client.deleteManagedBackup).not.toHaveBeenCalled();
        expect(await f.tracker.read()).toMatchObject({ totalRevision: 10, backedUpRevision: 0, lastSuccessAt: before.lastSuccessAt, failures: 1 });
        const reopened = new AutoBackupService(f.dependencies); services.push(reopened); await reopened.check();
        expect(f.upload).toHaveBeenCalledTimes(2);
        f.advance(1); await reopened.check();
        expect(f.upload).toHaveBeenCalledTimes(3);
    });
    it("pauses an invalid authorization until explicitly reverified", async () => {
        const f = await fixture(); await f.service.enable(); f.advance(31);
        f.upload.mockRejectedValueOnce(Object.assign(new Error("denied"), { details: { status: 403 } }));
        await f.service.check(); f.advance(100); await f.service.check();
        expect(f.upload).toHaveBeenCalledTimes(2);
        expect(await f.tracker.read()).toMatchObject({ paused: true });
        await f.service.enable();
        expect(await f.tracker.read()).toMatchObject({ paused: false, failures: 0 });
    });
    it("uploads first, then keeps the configured number of automatic files", async () => {
        const f = await fixture({ webDavAutoBackupKeepCount: 2 }); await f.service.enable();
        const state = await f.tracker.read();
        f.files.push(autoBackupFileName(state.sourceId, Date.UTC(2020, 0, 1)), autoBackupFileName(state.sourceId, Date.UTC(2021, 0, 1)));
        f.advance(31); await f.service.check();
        expect(f.files).toHaveLength(2);
        expect(f.client.deleteManagedBackup).toHaveBeenCalledTimes(2);
        expect(f.files.every(name => !name.includes("20200101") && !name.includes("20210101"))).toBe(true);
    });
    it("reports cleanup failure independently without immediately repeating a successful upload", async () => {
        const f = await fixture({ webDavAutoBackupKeepCount: 1 }); await f.service.enable(); f.advance(31);
        f.client.deleteManagedBackup.mockRejectedValue(new Error("no DELETE permission"));
        await f.service.check(); await f.service.check();
        expect(f.upload).toHaveBeenCalledTimes(2);
        expect(await f.tracker.read()).toMatchObject({ error: "", cleanupError: expect.stringContaining("清理未完成"), failures: 0 });
    });
    it("cancels a late upload after disabling, without advancing progress or deleting files", async () => {
        const f = await fixture(); await f.service.enable();
        const owner = new LifecycleScope("test"); f.service.start(owner, document); f.advance(31);
        const pending = deferred(), entered = deferred();
        f.upload.mockImplementationOnce(async options => { const snapshot = await options.exportSnapshot(); entered.resolve(); await pending.promise; return { client: f.client, coveredRevision: snapshot.revision, fileName: options.fileName }; });
        const before = await f.tracker.read(), task = f.service.check(); await entered.promise;
        await f.settings.set("webDavAutoBackupEnabled", "no"); pending.resolve(); await task;
        expect((await f.tracker.read()).lastSuccessAt).toBe(before.lastSuccessAt);
        expect(f.client.deleteManagedBackup).not.toHaveBeenCalled(); owner.dispose();
    });
    it("does not commit or clean up a result for an old connection", async () => {
        const f = await fixture(); await f.service.enable(); f.advance(31);
        const before = await f.tracker.read();
        f.upload.mockImplementationOnce(async options => { await f.settings.set("webDavProfileRevision", "profile-two"); return { client: f.client, coveredRevision: 0, fileName: options.fileName }; });
        await f.service.check();
        expect((await f.tracker.read()).lastSuccessAt).toBe(before.lastSuccessAt);
        expect(f.client.deleteManagedBackup).not.toHaveBeenCalled();
        await f.service.check(); expect(f.upload).toHaveBeenCalledTimes(2);
    });
    it("rechecks a remote disable even before its change notification is delivered", async () => {
        const f = await fixture(); await f.service.enable(); f.advance(31);
        const before = await f.tracker.read();
        f.upload.mockImplementationOnce(async options => {
            const setting = f.values.get("setting"); setting.webDavAutoBackupEnabled = "no";
            return { client: f.client, coveredRevision: 0, fileName: options.fileName };
        });
        await f.service.check();
        expect((await f.tracker.read()).lastSuccessAt).toBe(before.lastSuccessAt);
        expect(f.client.deleteManagedBackup).not.toHaveBeenCalled();
    });
    it("requires reliable cross-tab locks without affecting manual backup APIs", async () => {
        const f = await fixture(); f.service.locks = null;
        await expect(f.service.enable()).rejects.toThrow("跨页互斥");
        expect(f.upload).not.toHaveBeenCalled();
    });
    it("rejects unsupported local state without overwriting it", async () => {
        const f = await fixture(); f.values.set(AUTO_BACKUP_STATE_KEY, { schema: 99, evidence: "preserve" });
        await expect(f.service.enable()).rejects.toThrow();
        expect(f.values.get(AUTO_BACKUP_STATE_KEY)).toEqual({ schema: 99, evidence: "preserve" });
        expect(f.upload).not.toHaveBeenCalled();
    });
});
