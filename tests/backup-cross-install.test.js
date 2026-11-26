import { memoryAtomicStorage } from "./helpers/atomic-storage.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortableBackupService } from "../src/services/portable-backup-service.js";
import { StorageService } from "../src/services/storage-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { CURRENT_DATA_VERSION } from "../src/core/constants.js";
import { SettingsService } from "../src/services/settings-service.js";
import { readDetailShortcuts } from "../src/core/detail-shortcuts.js";

function createStorage(initialSetting) {
    const data = new Map([["data_version", 2], ["setting", { ...initialSetting }]]);
    const storage = new StorageService({
        get: async key => data.get(key),
        set: async (key, value) => data.set(key, value),
        remove: async key => data.delete(key),
        keys: async () => [...data.keys()],
        ...memoryAtomicStorage(data),
    });
    const backup = new PortableBackupService({ storage, coordinator: new StorageMutationCoordinator({ lockManager: null }) });
    return { storage, backup, data };
}

describe("portable backup cross-install restore", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("retains shortcut settings through reload, portable import and restore, rejecting future formats", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-10-17 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("window", { stateService: null });
        const source = createStorage({}), destination = createStorage({});
        const shortcuts = { favorite: { code: "KeyF", alt: true } };
        const { storage } = source;
        const settings = new SettingsService(storage);
        await settings.set("detailShortcuts", shortcuts);
        const reloaded = new SettingsService(storage);
        await reloaded.load();
        expect(readDetailShortcuts(reloaded.snapshot().detailShortcuts).favorite.code).toBe("KeyF");
        const backup = await source.backup.exportData();
        await destination.backup.importData(backup);
        expect(destination.data.get("setting").detailShortcuts).toEqual(shortcuts);
        destination.data.set("snapshots", [{ id: "shortcuts", data: { setting: backup.setting } }]);
        destination.data.set("setting", {});
        await destination.backup.restoreSnapshot("shortcuts");
        expect(destination.data.get("setting").detailShortcuts).toEqual(shortcuts);
        await expect(destination.backup.importData({ data_version: CURRENT_DATA_VERSION + 1, setting: {} })).rejects.toThrow("数据来自更新版本");
        expect(destination.data.get("setting").detailShortcuts).toEqual(shortcuts);
    });

    it("exports A data and restores it on B while retaining B WebDAV credentials", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("window", { stateService: null });
        const source = createStorage({ webDavUrl: "https://dav-a.example", webDavUsername: "alice", webDavPassword: "AES:source" });
        const destination = createStorage({ webDavUrl: "https://dav-b.example", webDavUsername: "bob", webDavPassword: "AES:destination" });
        const backup = await source.backup.exportData();

        expect(backup.setting).toEqual({});
        await destination.backup.importData(backup);
        expect(destination.data.get("setting")).toEqual({ webDavUrl: "https://dav-b.example", webDavUsername: "bob", webDavPassword: "AES:destination" });
    });

    it("preserves a destination credential when importing a legacy backup that contains one", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("window", { stateService: null });
        const destination = createStorage({ webDavPassword: "AES:destination", webDavUrl: "https://dav-b.example" });
        await destination.backup.importData({ data_version: 2, setting: { webDavPassword: "AES:source", webDavUrl: "https://dav-a.example" } });
        expect(destination.data.get("setting")).toEqual({ webDavPassword: "AES:destination", webDavUrl: "https://dav-b.example" });
    });
});
