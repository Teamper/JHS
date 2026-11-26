import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";
import { storageFromForage } from "./helpers/atomic-storage.js";

function createSettings(options) {
    const data = new Map();
    const write = vi.fn(async (key, value) => data.set(key, value));
    const storage = storageFromForage({ getItem: async key => data.get(key), setItem: write });
    return { settings: new SettingsService(storage, options), data, write };
}

describe("settings write completion", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reports success after a durable write even when cross-tab notification fails", async () => {
        const notification = vi.fn(async () => { throw new Error("event channel closed"); });
        const error = vi.fn(() => { throw new Error("logger unavailable"); });
        const { settings, data } = createSettings({ afterPersist: notification, logger: { error } });

        await expect(settings.set("enableDark", "yes")).resolves.toEqual({ enableDark: "yes" });
        expect(data.get("setting")).toEqual({ enableDark: "yes" });
        expect(notification).toHaveBeenCalledOnce();
        expect(error).toHaveBeenCalledOnce();
    });

    it("still rejects when persistence itself fails", async () => {
        const notification = vi.fn();
        const { settings, write } = createSettings({ afterPersist: notification });
        write.mockRejectedValueOnce(new Error("IndexedDB unavailable"));

        await expect(settings.set("enableDark", "yes")).rejects.toThrow("IndexedDB unavailable");
        expect(notification).not.toHaveBeenCalled();
    });
});
