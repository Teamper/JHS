import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";

function createStorage() {
    const data = new Map();
    const storage = Object.create(StorageManager.prototype);
    storage.setting_key = "setting";
    storage._withCrossTabLock = async (_name, operation) => operation();
    storage._setItemAndInvalidate = vi.fn(async (key, value) => { data.set(key, value); });
    storage.forage = { getItem: vi.fn(async key => data.get(key)) };
    return { storage, data };
}

describe("legacy settings write completion", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reports success after a durable write even when cross-tab notification fails", async () => {
        const { storage, data } = createStorage();
        const notification = vi.fn(async () => { throw new Error("event channel closed"); });
        const warn = vi.fn(() => { throw new Error("logger unavailable"); });
        vi.stubGlobal("window", { clean_cacheSettingObj: notification });
        vi.stubGlobal("clog", { warn });
        vi.stubGlobal("settingsService", undefined);

        await expect(storage.saveSettingItem("enableDark", "yes")).resolves.toBeUndefined();
        expect(data.get("setting")).toEqual({ enableDark: "yes" });
        expect(notification).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledOnce();
    });

    it("still rejects when persistence itself fails", async () => {
        const { storage } = createStorage();
        const notification = vi.fn();
        storage._setItemAndInvalidate.mockRejectedValueOnce(new Error("IndexedDB unavailable"));
        vi.stubGlobal("window", { clean_cacheSettingObj: notification });
        vi.stubGlobal("settingsService", undefined);

        await expect(storage.saveSetting({ enableDark: "yes" })).rejects.toThrow("IndexedDB unavailable");
        expect(notification).not.toHaveBeenCalled();
    });
});
