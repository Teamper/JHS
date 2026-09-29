import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";
import { StorageMutationCoordinator, STORAGE_MUTATION_LOCK } from "../src/core/storage-mutation-coordinator.js";

/** A name-keyed mutex standing in for navigator.locks so read-modify-write serializes. */
function createFakeLocks() {
    const queues = new Map();
    return {
        names: [],
        request(name, callback) {
            this.names.push(name);
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

    it("uses the shared storage mutation lock for settings read-modify-write", async () => {
        const locks = createFakeLocks(), coordinator = new StorageMutationCoordinator({ lockManager: locks });
        const storage = createSharedStorage({});
        const tabA = new SettingsService(storage, { mutationCoordinator: coordinator });
        const tabB = new SettingsService(storage, { mutationCoordinator: coordinator });
        await Promise.all([ tabA.set("sortMethod", "date"), tabB.set("videoMuted", "yes") ]);
        expect(storage.read()).toMatchObject({ sortMethod: "date", videoMuted: "yes" });
        expect(locks.names.length).toBe(2);
        expect(new Set(locks.names)).toEqual(new Set([ STORAGE_MUTATION_LOCK ]));
    });

    it("supports migration writes inside an already-held storage mutation lock", async () => {
        const locks = createFakeLocks(), coordinator = new StorageMutationCoordinator({ lockManager: locks });
        const storage = createSharedStorage({ legacyKey: "old" });
        const service = new SettingsService(storage, { mutationCoordinator: coordinator });
        await coordinator.runExclusive(() => service.updateWithoutLock((draft) => { draft.migratedKey = draft.legacyKey; delete draft.legacyKey; }));
        expect(storage.read()).toEqual({ migratedKey: "old" });
        expect(locks.names).toEqual([ STORAGE_MUTATION_LOCK ]);
    });

    it("does not deadlock a locked migration behind a queued settings writer", async () => {
        const locks = createFakeLocks(), coordinator = new StorageMutationCoordinator({ lockManager: locks });
        const storage = createSharedStorage({ legacyKey: "old" });
        const service = new SettingsService(storage, { mutationCoordinator: coordinator });
        let enterMigration, releaseMigration;
        const migrationEntered = new Promise((resolve) => { enterMigration = resolve; });
        const migrationGate = new Promise((resolve) => { releaseMigration = resolve; });
        const migration = coordinator.runExclusive(async () => {
            enterMigration();
            await migrationGate;
            await service.updateWithoutLock((draft) => { draft.migratedKey = draft.legacyKey; delete draft.legacyKey; });
        });
        await migrationEntered;

        const normalWrite = service.set("sortMethod", "date");
        while (locks.names.length < 2) await Promise.resolve();
        releaseMigration();

        await Promise.all([ migration, normalWrite ]);
        expect(storage.read()).toEqual({ migratedKey: "old", sortMethod: "date" });
        expect(locks.names).toEqual([ STORAGE_MUTATION_LOCK, STORAGE_MUTATION_LOCK ]);
    });

    it("still works without navigator.locks (node/jsdom fallback)", async () => {
        const storage = createSharedStorage({});
        const service = new SettingsService(storage);
        await service.set("themeMode", "dark");
        expect(storage.read()).toMatchObject({ themeMode: "dark" });
    });

    it("persists the normalized value rather than a UI-only clamp", async () => {
        const value = { setting: { oneOneFiveConcurrency: 4 } };
        const service = new SettingsService({
            async get(key) { return value[key]; },
            async set(key, next) { value[key] = next; },
        }, { normalizers: { oneOneFiveConcurrency: (input) => Math.min(10, Math.max(1, Math.round(Number(input) || 4))) } });
        await service.set("oneOneFiveConcurrency", 99);
        expect(value.setting.oneOneFiveConcurrency).toBe(10);
        expect(service.snapshot().oneOneFiveConcurrency).toBe(10);
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

    it("orders refresh behind an in-flight write so a stale read cannot replace the committed snapshot", async () => {
        const value = { setting: { themeMode: "light" } };
        let getCalls = 0;
        let markCommitted;
        const committed = new Promise((resolve) => { markCommitted = resolve; });
        const storage = {
            async get(key) {
                getCalls += 1;
                const captured = { ...value[key] };
                if (getCalls >= 3) await committed;
                return captured;
            },
            async set(key, next) {
                value[key] = next;
                markCommitted();
            },
        };
        const service = new SettingsService(storage);
        await service.load();

        await Promise.all([ service.set("themeMode", "dark"), service.refresh() ]);

        expect(value.setting.themeMode).toBe("dark");
        expect(service.snapshot().themeMode).toBe("dark");
    });

    it("recovers the operation queue after refresh fails", async () => {
        const value = { setting: { themeMode: "light" } };
        let rejectRead = false;
        const service = new SettingsService({
            async get(key) {
                if (rejectRead) { rejectRead = false; throw new Error("read failed"); }
                return value[key];
            },
            async set(key, next) { value[key] = next; },
        });
        await service.load();
        rejectRead = true;
        await expect(service.refresh()).rejects.toThrow("read failed");
        await expect(service.set("themeMode", "dark")).resolves.toMatchObject({ themeMode: "dark" });
    });

    it("does not report a committed setting as failed when post-commit diagnostics also fail", async () => {
        const value = { setting: {} };
        const afterPersist = vi.fn(async () => { throw new Error("broadcast failed"); });
        vi.stubGlobal("clog", { error: vi.fn(() => { throw new Error("logger failed"); }) });
        const service = new SettingsService({
            async get(key) { return value[key]; },
            async set(key, next) { value[key] = next; },
        }, { afterPersist });

        await expect(service.set("themeMode", "dark")).resolves.toMatchObject({ themeMode: "dark" });
        expect(value.setting.themeMode).toBe("dark");
        await expect(service.set("videoMuted", "yes")).resolves.toMatchObject({ themeMode: "dark", videoMuted: "yes" });
        expect(afterPersist).toHaveBeenCalledTimes(2);
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
        adapter.forage.getItem = vi.fn(async () => ({ a: 1 }));
        const saveSetting = vi.fn(async () => {});
        adapter._saveSettingWithoutLock = saveSetting;
        await adapter.saveSettingItem("a", 2);
        expect(saveSetting).toHaveBeenCalledWith({ a: 2 });
    });
});
