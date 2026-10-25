import { vi } from "vitest";
import { StorageManager } from "../../src/core/storage.js";
import { StateService } from "../../src/core/state-service.js";
import { StorageMutationCoordinator } from "../../src/core/storage-mutation-coordinator.js";
import { WebDavSyncStore } from "../../src/core/webdav-sync-store.js";
import { WebDavSyncService } from "../../src/services/webdav-sync-service.js";
import { SettingsService } from "../../src/services/settings-service.js";
import { parseSyncFileName } from "../../src/core/webdav-sync-model.js";
import { SettingsRegistry } from "../../src/app/settings-registry.js";
import { registerDefaultSettings } from "../../src/app/settings-catalog.js";

export function memoryDav() {
    const files = new Map();
    const client = {
        ensureFolder: vi.fn(async () => {}),
        listSyncFiles: vi.fn(async () => [...files.keys()].map(parseSyncFileName).filter(Boolean)),
        readSyncFile: vi.fn(async (name, missingOK) => {
            if (files.has(name)) return files.get(name);
            if (missingOK) return null;
            throw Object.assign(new Error("missing"), { details: { status: 404 } });
        }),
        writeSyncFile: vi.fn(async (name, content) => { files.set(name, content); }),
        deleteSyncFile: vi.fn(async name => { files.delete(name); }),
    };
    return { files, client };
}

export async function syncReplica(remote, options = {}) {
    const registry = new SettingsRegistry(); registerDefaultSettings(registry);
    const validateSetting = (key, value) => registry.validateSync(key, value);
    let now = Date.UTC(2026, 9, 22, 8);
    const values = options.values ?? new Map(Object.entries({ data_version: 3, car_list: [], favorite_actresses: [], setting: {}, ...options.data }));
    const forage = { getItem: vi.fn(async key => structuredClone(values.get(key) ?? null)), setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }), removeItem: vi.fn(async key => { values.delete(key); }), keys: async () => [...values.keys()] };
    vi.stubGlobal("localforage", { createInstance: () => forage });
    vi.stubGlobal("window", { location: { href: "https://javdb.com/", origin: "https://javdb.com" } });
    vi.stubGlobal("utils", { getNowStr: () => new Date(now).toISOString() });
    vi.stubGlobal("clog", { log: vi.fn(), error: vi.fn() });
    StorageManager.instance = null;
    const storage = new StorageManager();
    const coordinator = new StorageMutationCoordinator({ lockManager: null });
    storage.mutationCoordinator = coordinator;
    const events = { emit: vi.fn(async () => {}) };
    const state = new StateService(storage, events, coordinator);
    storage.stateService = state;
    let store;
    const settings = new SettingsService({ get: key => forage.getItem(key), set: async (key, value) => { await store?.capture(key); await forage.setItem(key, value); } }, { mutationCoordinator: coordinator });
    await settings.load();
    store = new WebDavSyncStore({ forage, coordinator, storage, settings, events, clock: () => now, validateSetting });
    storage.syncState = store; store.enabled = true;
    coordinator.observer = store; coordinator.beforeMutation = store.recoverBeforeMutation;
    const shared = Object.assign(new EventTarget(), {
        profile: options.profile ?? { url: "https://dav.example/dav", username: "user", password: "synthetic" }, revision: "one", isPaused: false,
        migrate: vi.fn(async () => {}), snapshot: vi.fn(async () => ({ profile: shared.profile, revision: shared.revision })), paused: async () => shared.isPaused,
        setPaused: async value => { shared.isPaused = value; shared.dispatchEvent(new Event("changed")); }, watch: () => {},
    });
    let held = false;
    const locks = { request: vi.fn(async (_name, _options, callback) => { if (held) return callback(null); held = true; try { return await callback({}); } finally { held = false; } }) };
    const webdav = { createClient: vi.fn(() => remote.client) };
    const service = new WebDavSyncService({ store, shared, webdav, settings, storage, events, clock: () => now, locks: options.locks === undefined ? locks : options.locks, window: { setTimeout: () => 0, clearTimeout: () => {} }, validateSetting });
    await store.initialize();
    return { values, forage, coordinator, storage, state, settings, store, shared, webdav, service, locks, advance: ms => { now += ms; }, restart: () => syncReplica(remote, { ...options, values }) };
}
