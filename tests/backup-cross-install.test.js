import { memoryAtomicStorage } from "./helpers/atomic-storage.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";
import { CURRENT_DATA_VERSION } from "../src/core/constants.js";
import { SettingsService } from "../src/services/settings-service.js";
import { readDetailShortcuts } from "../src/core/detail-shortcuts.js";

function createStorage(initialSetting) {
    const data = new Map([["data_version", 2], ["setting", { ...initialSetting }]]);
    const storage = Object.create(StorageManager.prototype);
    storage.car_list_key = "car_list";
    storage.favorite_actresses_key = "favorite_actresses";
    storage.setting_key = "setting";
    storage.forage = {
        getItem: vi.fn(async (key) => data.get(key)),
        setItem: vi.fn(async (key, value) => data.set(key, value)),
        removeItem: vi.fn(async (key) => data.delete(key)),
    };
    storage.forage.keys = async () => [...data.keys()];
    storage.getDataVersion = vi.fn(async () => data.get("data_version") || 0);
    storage.setDataVersion = vi.fn(async (value) => data.set("data_version", value));
    storage.getSetting = vi.fn(async () => data.get("setting") || {});
    storage._setItemAndInvalidate = vi.fn(async (key, value) => data.set(key, value));
    storage._invalidateCache = vi.fn();
    storage._withCrossTabLock = vi.fn(async (_name, callback) => callback());
    storage.createSnapshot = vi.fn(async () => null);
    storage.atomicStorage = memoryAtomicStorage(data);
    storage.data = data;
    return storage;
}

describe("portable backup cross-install restore", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("retains shortcut settings through reload, portable import and restore, rejecting future formats", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-10-17 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("window", { stateService: null });
        const source = createStorage({}), destination = createStorage({});
        const shortcuts = { favorite: { code: "KeyF", alt: true } };
        const storage = { get: key => source.forage.getItem(key), set: (key, value) => source.forage.setItem(key, value) };
        const settings = new SettingsService(storage);
        await settings.set("detailShortcuts", shortcuts);
        const reloaded = new SettingsService(storage);
        await reloaded.load();
        expect(readDetailShortcuts(reloaded.snapshot().detailShortcuts).favorite.code).toBe("KeyF");
        const backup = await source.exportData();
        await destination.importData(backup);
        expect(destination.data.get("setting").detailShortcuts).toEqual(shortcuts);
        destination.data.set("snapshots", [{ id: "shortcuts", data: { setting: backup.setting } }]);
        destination.data.set("setting", {});
        await destination.restoreSnapshot("shortcuts");
        expect(destination.data.get("setting").detailShortcuts).toEqual(shortcuts);
        await expect(destination.importData({ data_version: CURRENT_DATA_VERSION + 1, setting: {} })).rejects.toThrow("数据来自更新版本");
        expect(destination.data.get("setting").detailShortcuts).toEqual(shortcuts);
    });

    it("exports A data and restores it on B while retaining B WebDAV credentials", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("window", { stateService: null });
        const source = createStorage({ webDavUrl: "https://dav-a.example", webDavUsername: "alice", webDavPassword: "AES:source" });
        const destination = createStorage({ webDavUrl: "https://dav-b.example", webDavUsername: "bob", webDavPassword: "AES:destination" });
        const backup = await source.exportData();

        expect(backup.setting).toEqual({});
        await destination.importData(backup);
        expect(destination.data.get("setting")).toEqual({ webDavUrl: "https://dav-b.example", webDavUsername: "bob", webDavPassword: "AES:destination" });
    });

    it("preserves a destination credential when importing a legacy backup that contains one", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-26 00:00:00" });
        vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn() });
        vi.stubGlobal("window", { stateService: null });
        const destination = createStorage({ webDavPassword: "AES:destination", webDavUrl: "https://dav-b.example" });
        await destination.importData({ data_version: 2, setting: { webDavPassword: "AES:source", webDavUrl: "https://dav-a.example" } });
        expect(destination.data.get("setting")).toEqual({ webDavPassword: "AES:destination", webDavUrl: "https://dav-b.example" });
    });
});
