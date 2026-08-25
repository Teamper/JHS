import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";

const busSource = readTestFile(join(import.meta.dirname, "../src/core/event-bus.js"), "utf8");

class FakeBroadcastChannel {
    static channels = [];
    constructor(name) { this.name = name; this.handlers = []; FakeBroadcastChannel.channels.push(this); }
    addEventListener(type, handler) { "message" === type && this.handlers.push(handler); }
    postMessage(data) { FakeBroadcastChannel.channels.filter((channel) => channel.name === this.name).forEach((channel) => channel.handlers.forEach((handler) => handler({ data }))); }
}

function loadBus() {
    const context = vm.createContext({ BroadcastChannel: FakeBroadcastChannel, crypto: { randomUUID: vi.fn().mockReturnValueOnce("tab-a").mockReturnValueOnce("tab-b").mockReturnValue("event-1") }, Date, Math, Map, Set, window: {}, unsafeWindow: {} });
    const end = busSource.indexOf("let jhsEventBus");
    vm.runInContext(`${busSource.slice(0, end)}; globalThis.Bus = JhsEventBus;`, context);
    return context.Bus;
}

function createSharedStorage(initial = {}) {
    return {
        value: { setting: { ...initial } },
        async get(key) { return this.value[key]; },
        async set(key, next) { this.value[key] = next; },
    };
}

/** Mirrors the settings-changed handler wired in create-app-context.js. */
function makeSettingsChangedHandler(bus, settings, legacyStorage = { invalidateSettingCache: vi.fn() }) {
    return async (_payload, event) => {
        const remote = event.originId !== bus.originId;
        const localLegacy = event.originId === bus.originId && event.payload?.source === "legacy";
        if (!remote && !localLegacy) return;
        legacyStorage.invalidateSettingCache();
        await settings.refresh();
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("cross-tab settings sync", () => {
    it("refreshes the remote tab snapshot when the other tab writes", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), busA = new Bus("sync"), busB = new Bus("sync");
        const storage = createSharedStorage({ sortMethod: "default" });
        const settingsA = new SettingsService(storage, { afterPersist: async (_snapshot, changedNames) => { await busA.emit("settings-changed", { changedNames, source: "service" }); } });
        const settingsB = new SettingsService(storage);
        busB.on("settings-changed", makeSettingsChangedHandler(busB, settingsB));
        await settingsA.load(), await settingsB.load();
        await settingsA.set("sortMethod", "date");
        await flush();
        expect(settingsB.snapshot().sortMethod).toBe("date");
    });

    it("keeps the writing tab in sync and notifies ProfileService-style listeners", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), busA = new Bus("sync2"), busB = new Bus("sync2");
        const storage = createSharedStorage({ mobileMode: "off" });
        const settingsA = new SettingsService(storage, { afterPersist: async (_snapshot, changedNames) => { await busA.emit("settings-changed", { changedNames, source: "service" }); } });
        const settingsB = new SettingsService(storage);
        const profileListener = vi.fn();
        settingsB.addEventListener("settings.changed", profileListener);
        busB.on("settings-changed", makeSettingsChangedHandler(busB, settingsB));
        await settingsA.load(), await settingsB.load();
        await settingsA.set("mobileMode", "on");
        await flush();
        expect(settingsA.snapshot().mobileMode).toBe("on");
        expect(settingsB.snapshot().mobileMode).toBe("on");
        expect(profileListener).toHaveBeenCalledTimes(1);
        expect(profileListener.mock.calls[0][0].detail.names).toContain("mobileMode");
    });

    it("skips local service events but refreshes on local legacy writes", async () => {
        FakeBroadcastChannel.channels = [];
        const Bus = loadBus(), bus = new Bus("local");
        const storage = createSharedStorage({ a: 1 });
        const settings = new SettingsService(storage);
        const legacyStorage = { invalidateSettingCache: vi.fn() };
        bus.on("settings-changed", makeSettingsChangedHandler(bus, settings, legacyStorage));
        await settings.load();
        // Local service write path: afterPersist emits source "service" -> handler must NOT refresh (snapshot already current).
        await bus.emit("settings-changed", { changedNames: ["a"], source: "service" });
        expect(settings.snapshot()).toEqual({ a: 1 });
        expect(legacyStorage.invalidateSettingCache).not.toHaveBeenCalled();
        // Local legacy write: source "legacy" -> handler must refresh.
        storage.value.setting.themeMode = "dark";
        await bus.emit("settings-changed", { source: "legacy" });
        expect(settings.snapshot().themeMode).toBe("dark");
        expect(legacyStorage.invalidateSettingCache).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch settings.changed when refresh finds no changes", async () => {
        const storage = createSharedStorage({ a: 1 });
        const settings = new SettingsService(storage);
        const listener = vi.fn();
        settings.addEventListener("settings.changed", listener);
        await settings.load();
        await settings.refresh();
        expect(listener).not.toHaveBeenCalled();
    });
});
