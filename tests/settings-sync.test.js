// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppContext } from "../src/app/create-app-context.js";
import { JhsEventBus } from "../src/core/event-bus.js";
import { IndexedDbStorageAdapter } from "../src/platform/userscript/indexeddb-storage-adapter.js";
import { StorageService } from "../src/services/storage-service.js";

const cleanup = [];
beforeEach(() => {
    vi.stubGlobal("localStorage", window.localStorage);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
    for (const dispose of cleanup.splice(0).reverse()) dispose();
    vi.unstubAllGlobals();
});

function createSharedStorage(initial) {
    const values = new Map([["setting", initial]]);
    const forage = {
        getItem: async key => structuredClone(values.get(key)),
        setItem: async (key, value) => values.set(key, structuredClone(value)),
        removeItem: async key => values.delete(key),
        keys: async () => [...values.keys()],
    };
    return { values, storage: forage };
}

function openTab(channel, forage) {
    const bus = new JhsEventBus(channel);
    cleanup.push(() => bus.channel.close());
    const storage = new StorageService(new IndexedDbStorageAdapter(forage, window.localStorage, (_key, fallback) => fallback, vi.fn()));
    const context = createAppContext({ gmRequest: vi.fn(), storage, localStorage: window.localStorage, layer: {}, eventBus: bus });
    cleanup.push(() => context.rootScope.dispose());
    return { bus, settings: context.services.settings };
}

describe("cross-tab settings sync", () => {
    it("refreshes the remote tab snapshot when the other tab writes", async () => {
        const { storage } = createSharedStorage({ sortMethod: "default" });
        const { settings: settingsA } = openTab("settings-sync", storage);
        const { settings: settingsB } = openTab("settings-sync", storage);
        await settingsA.load(), await settingsB.load();
        await settingsA.set("sortMethod", "date");
        await vi.waitFor(() => expect(settingsB.snapshot().sortMethod).toBe("date"));
    });

    it("keeps the writing tab in sync and notifies ProfileService-style listeners", async () => {
        const { storage } = createSharedStorage({ mobileMode: "off" });
        const { settings: settingsA } = openTab("settings-sync", storage);
        const { settings: settingsB } = openTab("settings-sync", storage);
        const profileListener = vi.fn();
        settingsB.addEventListener("settings.changed", profileListener);
        await settingsA.load(), await settingsB.load();
        await settingsA.set("mobileMode", "on");
        expect(settingsA.snapshot().mobileMode).toBe("on");
        await vi.waitFor(() => expect(settingsB.snapshot().mobileMode).toBe("on"));
        expect(profileListener).toHaveBeenCalledTimes(1);
        expect(profileListener.mock.calls[0][0].detail.names).toContain("mobileMode");
    });

    it("skips local service events but refreshes on local legacy writes", async () => {
        const { storage, values } = createSharedStorage({ a: 1 });
        const { bus, settings } = openTab("settings-local", storage);
        const refresh = vi.spyOn(settings, "refresh");
        await settings.load();
        // Local service write path: afterPersist emits source "service" -> handler must NOT refresh (snapshot already current).
        await bus.emit("settings-changed", { changedNames: ["a"], source: "service" });
        expect(settings.snapshot()).toEqual({ a: 1 });
        expect(refresh).not.toHaveBeenCalled();
        // Local legacy write: source "legacy" -> handler must refresh.
        values.set("setting", { a: 1, themeMode: "dark" });
        await bus.emit("settings-changed", { source: "legacy" });
        expect(settings.snapshot().themeMode).toBe("dark");
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch settings.changed when refresh finds no changes", async () => {
        const { storage } = createSharedStorage({ a: 1 });
        const { settings } = openTab("settings-refresh", storage);
        const listener = vi.fn();
        settings.addEventListener("settings.changed", listener);
        await settings.load();
        await settings.refresh();
        expect(listener).not.toHaveBeenCalled();
    });
});
