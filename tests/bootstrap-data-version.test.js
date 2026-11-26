// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { storageFromForage } from "./helpers/atomic-storage.js";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { KeywordRulesService } from "../src/services/keyword-rules-service.js";
import { SettingsService } from "../src/services/settings-service.js";
import { CREDENTIAL_KEYS, CredentialService } from "../src/services/credential-service.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { CURRENT_DATA_VERSION } from "../src/core/constants.js";

const seam = vi.hoisted(() => ({ context: null, contextCreated: vi.fn(), emit: vi.fn(), attachFacade: vi.fn() }));
vi.mock("../src/platform/browser/resource-loader.js", () => ({ importVendorStyles() {}, importResource() {} }));
vi.mock("../src/app/create-app-context.js", () => ({ createAppContext: runtime => { seam.contextCreated(); seam.context.feedback = runtime.createFeedback(seam.context.rootScope); return seam.context; } }));
vi.mock("../src/core/constants.js", async (original) => ({ ...await original(), r: false, l: false, initializeRuntimeConstants: () => ({ site: "other" }) }));
vi.mock("../src/platform/userscript/vendor-runtime.js", () => ({ getVendorRuntime: () => ({ layer: { open() {}, close() {} } }) }));
vi.mock("../src/core/event-bus.js", () => ({ initializeEventBus: () => ({ on() {}, emit: seam.emit }) }));
vi.mock("../src/core/css-injection.js", () => ({ injectCoreCss() {} }));
vi.mock("../src/core/logger.js", () => ({ initializeLoggerRuntime: () => ({ clog: {}, show: { info() {} }, loading() {} }) }));
vi.mock("../src/core/theme.js", () => ({ initializeThemeRuntime() {}, applyThemeMode() {} }));
vi.mock("../src/core/ui-primitives.js", () => ({ initializeUiAccessibility() {} }));
vi.mock("../src/app/compatibility-facade.js", () => ({ attachCompatibilityFacade: seam.attachFacade }));
vi.mock("../src/features/catalog.js", () => ({ featureManifests: [] }));
vi.mock("../src/app/integration-catalog.js", () => ({ integrationManifests: [] }));
import { bootstrapJhs } from "../src/app/bootstrap.js";

function fixture(version = CURRENT_DATA_VERSION) {
    const clone = (value) => value == null ? value : structuredClone(value);
    const data = new Map(Object.entries({ data_version: version, setting: { webDavPassword: "old-dummy-password", themeMode: "dark" }, car_list: [] }));
    const writes = [], gmWrites = [], gm = new Map();
    let depth = 0;
    const coordinator = new StorageMutationCoordinator({ lockManager: null }), exclusive = coordinator.runExclusive.bind(coordinator);
    coordinator.runExclusive = vi.fn((operation) => exclusive(async () => { depth++; try { return await operation(); } finally { depth--; } }));
    const forage = {
        getItem: async (key) => clone(data.get(key) ?? null),
        setItem: async (key, value) => { writes.push({ key, version: data.get("data_version"), depth }); data.set(key, clone(value)); },
        removeItem: async (key) => { writes.push({ key, version: data.get("data_version"), depth }); data.delete(key); },
        keys: async () => [...data.keys()],
    };
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => forage });
    vi.stubGlobal("utils", undefined);
    vi.stubGlobal("settingsService", undefined);
    vi.stubGlobal("credentialService", undefined);
    vi.stubGlobal("clog", { log() {}, warn() {}, debug() {}, error() {} });
    const storage = storageFromForage(forage), state = new StateService(storage, { emit: async () => {} }, coordinator);
    const settings = new SettingsService({ get: forage.getItem, set: forage.setItem }, { mutationCoordinator: coordinator });
    const credential = new CredentialService({
        getValue: async (key, fallback) => clone(gm.get(key) ?? fallback),
        setValue: async (key, value) => { gmWrites.push({ key, version: data.get("data_version"), depth }); gm.set(key, clone(value)); },
        removeValue: async (key) => gm.delete(key),
    }, localStorage);
    const features = { runtimeLookup: { getBean: () => undefined }, register() {}, start: vi.fn(async () => {}), scheduleIdle: vi.fn() };
    seam.context = { services: { domUi: {isMobileMode: () => false}, clipboard: {copyText: vi.fn()}, dialog: {}, backgroundWork: { markReady: vi.fn() }, settings, credential, storage, state, keywordRules: new KeywordRulesService({ storage, coordinator, state }), profile: { start: vi.fn() }, styles: {}, diagnostics: new DiagnosticsService() }, rootScope: {}, container: { register() {} }, registries: { integrations: { register() {} }, features } };
    seam.contextCreated.mockClear();
    seam.attachFacade.mockClear();
    seam.emit.mockClear();
    return { data, writes, gmWrites, settings, credential, coordinator, features, context: seam.context, options: { storage, storageMutationCoordinator: coordinator } };
}

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); vi.unstubAllGlobals(); });

// Node 26 默认在 globalThis 定义 localStorage 访问器（未提供 --localstorage-file 时取值为 undefined），
// Vitest 的 jsdom 环境因此跳过注入；这里显式绑定本环境 jsdom 窗口的真实 Storage。
beforeEach(() => { vi.stubGlobal("localStorage", globalThis.jsdom.window.localStorage); });

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
        const f = fixture(CURRENT_DATA_VERSION + 1), before = structuredClone(Object.fromEntries(f.data));
        const assertPageStorageUntouched = watchLegacyPageStorage();
        await expect(bootstrapJhs(f.options)).rejects.toThrow(/数据来自更新版本/);
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
        vi.spyOn(f.settings, "_readSnapshot").mockImplementation(async (...args) => { const result = await load(...args); f.data.set("data_version", CURRENT_DATA_VERSION + 1); return result; });
        await expect(bootstrapJhs(f.options)).rejects.toThrow(/数据来自更新版本/);
        expect(f.writes).toEqual([]);
        expect(f.gmWrites).toEqual([]);
        expect(f.features.start).not.toHaveBeenCalled();
        assertPageStorageUntouched();
    });

    it("keeps supported bootstrap migrations in one non-reentrant write window", async () => {
        const f = fixture();
        await expect(bootstrapJhs(f.options)).resolves.toBe(f.context);
        expect(f.gmWrites.length).toBeGreaterThan(0);
        expect(f.data.get("setting").enableLoadScreenShot).toBe("yes");
        expect(f.coordinator.runExclusive).toHaveBeenCalledOnce();
        expect([...f.writes, ...f.gmWrites].every((write) => write.version === CURRENT_DATA_VERSION && write.depth === 1)).toBe(true);
        expect(f.context.services.profile.start).toHaveBeenCalledOnce();
        expect(f.features.start).toHaveBeenCalledOnce();
        expect(f.context.services.backgroundWork.markReady).toHaveBeenCalledOnce();
        expect(f.context.services.backgroundWork.markReady.mock.invocationCallOrder[0]).toBeGreaterThan(f.features.start.mock.invocationCallOrder[0]);
    });

    it("recovers state and attaches the runtime facade before features start, then signals first ready before scheduling idle work", async () => {
        const f = fixture();
        const recovery = vi.spyOn(f.context.services.state, "recoverPendingTransactionWithoutLock");
        const browserDiagnostics = {};
        const target = {};
        vi.stubGlobal("unsafeWindow", target);
        vi.stubGlobal("__jhsBrowserDiagnostics", browserDiagnostics);
        f.features.scheduleIdle.mockImplementation(() => {
            expect(browserDiagnostics.bootstrapPhases["first-ready"]).toBeGreaterThanOrEqual(0);
        });
        await expect(bootstrapJhs(f.options)).resolves.toBe(f.context);
        expect(seam.attachFacade).toHaveBeenCalledWith(expect.objectContaining(f.context.feedback), target);
        const [start] = f.features.start.mock.invocationCallOrder;
        expect(recovery.mock.invocationCallOrder.at(-1)).toBeLessThan(start);
        expect(seam.attachFacade.mock.invocationCallOrder[0]).toBeLessThan(start);
        const signal = seam.emit.mock.calls.findIndex(([name]) => name === "jhs-features-ready");
        expect(signal).toBeGreaterThanOrEqual(0);
        expect(seam.emit.mock.invocationCallOrder[signal]).toBeGreaterThan(start);
        expect(f.features.scheduleIdle).toHaveBeenCalledOnce();
        expect(f.features.scheduleIdle.mock.invocationCallOrder[0]).toBeGreaterThan(seam.emit.mock.invocationCallOrder[signal]);
    });
});
