import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";

/** A name-keyed mutex standing in for navigator.locks so read-modify-write serializes. */
function createFakeLocks() {
    const queues = new Map();
    return {
        request(name, callback) {
            const previous = queues.get(name) || Promise.resolve();
            const run = previous.then(() => callback());
            queues.set(name, run.then(() => undefined, () => undefined));
            return run;
        },
    };
}

/** Shared storage with a tiny async delay so interleavings are observable. */
function createSharedStorage(initial = {}) {
    const value = { setting: { ...initial } };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    return {
        async get(key) { await tick(); return value[key]; },
        async set(key, next) { await tick(); value[key] = next; },
        read() { return value.setting; },
    };
}

describe("SettingsService single write entry", () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it("merges concurrent patches from two tabs without losing updates", async () => {
        vi.stubGlobal("navigator", { locks: createFakeLocks() });
        const storage = createSharedStorage({ sortMethod: "default", videoMuted: "no" });
        const tabA = new SettingsService(storage);
        const tabB = new SettingsService(storage);
        await Promise.all([
            tabA.patch({ sortMethod: "date" }),
            tabB.patch({ videoMuted: "yes" }),
        ]);
        // A's change must survive B's concurrent write — the old snapshot-overwrite lost it.
        expect(storage.read()).toMatchObject({ sortMethod: "date", videoMuted: "yes" });
    });

    it("still works without navigator.locks (node/jsdom fallback)", async () => {
        const storage = createSharedStorage({});
        const service = new SettingsService(storage);
        await service.set("themeMode", "dark");
        expect(storage.read()).toMatchObject({ themeMode: "dark" });
    });

    it("patch preserves keys written by other tabs between read and write", async () => {
        vi.stubGlobal("navigator", { locks: createFakeLocks() });
        const storage = createSharedStorage({ a: 1 });
        const service = new SettingsService(storage);
        const promise = service.patch({ b: 2 });
        // Simulate an external legacy write landing before the lock-scoped write commits.
        await new Promise((resolve) => setTimeout(resolve, 2));
        storage.read().c = 3;
        await promise;
        expect(storage.read()).toMatchObject({ a: 1, b: 2, c: 3 });
    });
});

describe("legacy StorageManager delegation", () => {
    function createStorageManager(settingsService) {
        const source = readTestFile(join(process.cwd(), "src/core/storage.js"), "utf8");
        const show = { error: vi.fn() };
        const context = vm.createContext({
            WeakSet, WeakMap, Map, Set, Promise, Date, JSON, Object, Array, Math,
            a: (message) => { throw new TypeError(message); },
            i: (target, key, value) => (target[key] = value),
            localforage: { INDEXEDDB: "indexeddb", createInstance: () => ({}) },
            show, d: "filter", h: "favorite", g: "hasDown", p: "hasWatch",
            normalizeCarNum: (value) => String(value || "").trim().toUpperCase(),
            legacyActionToFlag: (value) => ({ filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" })[value] || null,
            normalizeStateFlags: (flags) => ({ favorite: !!flags?.favorite, downloaded: !!flags?.downloaded, watched: !!flags?.watched, blocked: !!flags?.blocked }),
            stateService: { patch: vi.fn(async () => ({ changed: [], transactionId: "tx" })) },
            window: { location: { origin: "https://javdb.example" } }, navigator: {}, utils: {}, clog: {}, escapeHtml: (value) => value,
            settingsService: settingsService ?? null,
            CURRENT_DATA_VERSION: 2, PORTABLE_DATA_KEYS: [], hasPortableUserData: async () => false, validatePortableData() {}, runDataMigrations() {},
        });
        vm.runInContext(`${source}; globalThis.Adapter = StorageManager;`, context);
        return { adapter: new context.Adapter, context };
    }

    it("routes saveSettingItem through SettingsService.set when available", async () => {
        const set = vi.fn(async () => {});
        const { adapter } = createStorageManager({ set });
        await adapter.saveSettingItem("themeMode", "dark");
        expect(set).toHaveBeenCalledWith("themeMode", "dark");
    });

    it("falls back to the legacy locked path without SettingsService", async () => {
        const { adapter } = createStorageManager(null);
        const getSetting = vi.fn(async () => ({ a: 1 }));
        const saveSetting = vi.fn(async () => {});
        adapter.getSetting = getSetting;
        adapter.saveSetting = saveSetting;
        await adapter.saveSettingItem("a", 2);
        expect(saveSetting).toHaveBeenCalledWith({ a: 2 });
    });
});
