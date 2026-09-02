import { describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";

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
    storage.getDataVersion = vi.fn(async () => data.get("data_version") || 0);
    storage.setDataVersion = vi.fn(async (value) => data.set("data_version", value));
    storage.getSetting = vi.fn(async () => data.get("setting") || {});
    storage._setItemAndInvalidate = vi.fn(async (key, value) => data.set(key, value));
    storage._invalidateCache = vi.fn();
    storage._withCrossTabLock = vi.fn(async (_name, callback) => callback());
    storage.createSnapshot = vi.fn(async () => null);
    storage.data = data;
    return storage;
}

describe("portable backup cross-install restore", () => {
    it("exports A data and restores it on B while retaining B WebDAV credentials", async () => {
        vi.stubGlobal("window", { stateService: null });
        const source = createStorage({ webDavUrl: "https://dav-a.example", webDavUsername: "alice", webDavPassword: "AES:source" });
        const destination = createStorage({ webDavUrl: "https://dav-b.example", webDavUsername: "bob", webDavPassword: "AES:destination" });
        const backup = await source.exportData();

        expect(backup.setting).toEqual({});
        await destination.importData(backup);
        expect(destination.data.get("setting")).toEqual({ webDavUrl: "https://dav-b.example", webDavUsername: "bob", webDavPassword: "AES:destination" });
    });

    it("preserves a destination credential when importing a legacy backup that contains one", async () => {
        vi.stubGlobal("window", { stateService: null });
        const destination = createStorage({ webDavPassword: "AES:destination", webDavUrl: "https://dav-b.example" });
        await destination.importData({ data_version: 2, setting: { webDavPassword: "AES:source", webDavUrl: "https://dav-a.example" } });
        expect(destination.data.get("setting")).toEqual({ webDavPassword: "AES:destination", webDavUrl: "https://dav-b.example" });
    });
});
