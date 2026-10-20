// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { StorageManager } from "../src/core/storage.js";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { SettingsService } from "../src/services/settings-service.js";
import { CREDENTIAL_KEYS, CredentialService } from "../src/services/credential-service.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

const seam = vi.hoisted(() => ({ legacy: null, context: null, contextCreated: vi.fn() }));
vi.mock("../src/core/legacy-runtime.js", () => ({ createLegacyRuntime: () => seam.legacy }));
vi.mock("../src/app/create-app-context.js", () => ({ createAppContext: () => { seam.contextCreated(); return seam.context; } }));
vi.mock("../src/core/constants.js", async (original) => ({ ...await original(), r: false, l: false, initializeRuntimeConstants: () => ({ site: "other" }) }));
vi.mock("../src/platform/userscript/vendor-runtime.js", () => ({ getVendorRuntime: () => ({ layer: { open() {}, close() {} } }) }));
vi.mock("../src/core/event-bus.js", () => ({ initializeEventBus: () => ({ on() {}, emit: async () => {} }) }));
vi.mock("../src/core/css-injection.js", () => ({ injectCoreCss() {} }));
vi.mock("../src/core/logger.js", () => ({ initializeLoggerRuntime: () => ({ clog: {}, show: { info() {} } }) }));
vi.mock("../src/core/theme.js", () => ({ initializeThemeRuntime() {}, applyThemeMode() {} }));
vi.mock("../src/core/ui-primitives.js", () => ({ initializeUiAccessibility() {} }));
vi.mock("../src/app/compatibility-facade.js", () => ({ attachCompatibilityFacade() {} }));
vi.mock("../src/features/catalog.js", () => ({ featureManifests: [] }));
vi.mock("../src/app/integration-catalog.js", () => ({ integrationManifests: [] }));
vi.mock("../src/features/compatibility/contribution-catalog.js", () => ({ registerSiteCompatibility() {} }));
import { bootstrapJhs } from "../src/app/bootstrap.js";

function fixture(version = 3) {
    const clone = (value) => value == null ? value : structuredClone(value);
    const data = new Map(Object.entries({ data_version: version, setting: { webDavPassword: "old-dummy-password", themeMode: "dark" }, car_list: [] }));
    const writes = [], gmWrites = [], gm = new Map();
    let depth = 0;
    const coordinator = new StorageMutationCoordinator({ lockManager: null }), exclusive = coordinator.runExclusive.bind(coordinator);
    coordinator.runExclusive = (operation) => exclusive(async () => { depth++; try { return await operation(); } finally { depth--; } });
    const forage = {
        getItem: async (key) => clone(data.get(key) ?? null),
        setItem: async (key, value) => { writes.push({ key, version: data.get("data_version"), depth }); data.set(key, clone(value)); },
        removeItem: async (key) => { writes.push({ key, version: data.get("data_version"), depth }); data.delete(key); },
        keys: async () => [...data.keys()],
    };
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => forage });
    vi.stubGlobal("utils", undefined);
    vi.stubGlobal("storageManager", undefined);
    vi.stubGlobal("settingsService", undefined);
    vi.stubGlobal("credentialService", undefined);
    vi.stubGlobal("clog", { log() {}, warn() {}, debug() {}, error() {} });
    StorageManager.instance = null;
    const storage = new StorageManager(), state = new StateService(storage, { emit: async () => {} }, coordinator);
    storage.mutationCoordinator = coordinator;
    storage.stateService = state;
    const settings = new SettingsService({ get: forage.getItem, set: forage.setItem }, { mutationCoordinator: coordinator });
    const credential = new CredentialService({
        getValue: async (key, fallback) => clone(gm.get(key) ?? fallback),
        setValue: async (key, value) => { gmWrites.push({ key, version: data.get("data_version"), depth }); gm.set(key, clone(value)); },
        removeValue: async (key) => gm.delete(key),
    }, localStorage);
    const features = { register() {}, start: vi.fn(async () => {}), scheduleIdle: vi.fn() };
    seam.context = { services: { settings, credential, profile: { start: vi.fn() }, styles: {}, diagnostics: new DiagnosticsService() }, rootScope: {}, container: { register() {} }, registries: { integrations: { register() {} }, features } };
    seam.legacy = { utils: { importResource() {} }, gmHttp: {}, storageManager: storage, stateService: state, storageMutationCoordinator: coordinator };
    seam.contextCreated.mockClear();
    return { data, writes, gmWrites, settings, credential, features, context: seam.context };
}

afterEach(() => { StorageManager.instance = null; vi.restoreAllMocks(); localStorage.clear(); vi.unstubAllGlobals(); });

function watchLegacyPageStorage() {
    localStorage.setItem(CREDENTIAL_KEYS.javdbToken, "old-dummy-token");
    localStorage.setItem(CREDENTIAL_KEYS.installationSecret, "old-dummy-secret");
    const before = { ...localStorage };
    const mutations = ["setItem", "removeItem", "clear"].map(method => vi.spyOn(Storage.prototype, method));
    return () => {
        for (const mutation of mutations) expect(mutation).not.toHaveBeenCalled();
        expect({ ...localStorage }).toEqual(before);
    };
}

describe("bootstrap future-version write protection", () => {
    it("rejects a future database before constructing the app or writing IDB/GM values", async () => {
        const f = fixture(4), before = structuredClone(Object.fromEntries(f.data));
        const assertPageStorageUntouched = watchLegacyPageStorage();
        await expect(bootstrapJhs()).rejects.toThrow(/数据来自更新版本/);
        expect(seam.contextCreated).not.toHaveBeenCalled();
        expect(f.writes).toEqual([]);
        expect(f.gmWrites).toEqual([]);
        expect(Object.fromEntries(f.data)).toEqual(before);
        expect(f.context.services.profile.start).not.toHaveBeenCalled();
        assertPageStorageUntouched();
    });

    it("rechecks inside the settings lock after another tab upgrades during settings load", async () => {
        const f = fixture(), load = f.settings._readSnapshot.bind(f.settings);
        const assertPageStorageUntouched = watchLegacyPageStorage();
        vi.spyOn(f.settings, "_readSnapshot").mockImplementation(async (...args) => { const result = await load(...args); f.data.set("data_version", 4); return result; });
        await expect(bootstrapJhs()).rejects.toThrow(/数据来自更新版本/);
        expect(f.writes).toEqual([]);
        expect(f.gmWrites).toEqual([]);
        expect(f.features.start).not.toHaveBeenCalled();
        assertPageStorageUntouched();
    });

    it("keeps supported bootstrap migrations in one non-reentrant write window", async () => {
        const f = fixture();
        await expect(bootstrapJhs()).resolves.toBe(f.context);
        expect(f.gmWrites.length).toBeGreaterThan(0);
        expect(f.data.get("setting").enableLoadScreenShot).toBe("yes");
        expect([...f.writes, ...f.gmWrites].every((write) => write.version === 3 && write.depth === 1)).toBe(true);
        expect(f.context.services.profile.start).toHaveBeenCalledOnce();
        expect(f.features.start).toHaveBeenCalledOnce();
    });
});
