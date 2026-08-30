import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { attachCompatibilityFacade } from "../src/app/compatibility-facade.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const bootstrap = readFileSync(join(import.meta.dirname, "../src/app/bootstrap.js"), "utf8");
const logger = readFileSync(join(import.meta.dirname, "../src/core/logger.js"), "utf8");
const appContext = readFileSync(join(import.meta.dirname, "../src/app/create-app-context.js"), "utf8");

describe("bootstrap compatibility P0", () => {
    it("compatibility facade rejects when clog is missing", () => {
        expect(() => attachCompatibilityFacade({
            pluginManager: {}, utils: {}, gmHttp: {}, storageManager: {}, stateService: {}, jhsEventBus: {},
            show: () => {}, loading: () => {},
        }, {})).toThrow(/Compatibility facade is missing clog/);
    });

    it("copies logger runtime values into the target instead of reading globalThis", () => {
        const clog = { log() {} };
        const show = { ok() {}, error() {}, info() {} };
        const loading = () => ({ close() {} });
        const target = {};
        attachCompatibilityFacade({ pluginManager: {}, utils: {}, gmHttp: {}, storageManager: {}, stateService: {}, jhsEventBus: {}, clog, show, loading }, target);
        expect(target.clog).toBe(clog);
        expect(target.show).toBe(show);
        expect(target.loading).toBe(loading);
    });

    it("bootstrap passes logger.clog/show/loading, not globalThis.*", () => {
        expect(bootstrap).toContain("clog: logger.clog");
        expect(bootstrap).toContain("show: logger.show");
        expect(bootstrap).toContain("loading: logger.loading");
        expect(bootstrap).not.toContain("clog: globalThis.clog");
        expect(bootstrap).not.toContain("show: globalThis.show");
        expect(bootstrap).not.toContain("loading: globalThis.loading");
    });

    it("attaches compatibility before FeatureRuntime.start", () => {
        const attachIndex = bootstrap.indexOf("attachCompatibilityFacade({");
        const startIndex = bootstrap.indexOf("await context.registries.features.start();");
        expect(attachIndex).toBeGreaterThan(-1);
        expect(startIndex).toBeGreaterThan(attachIndex);
    });

    it("recovers and migrates persistent state before FeatureRuntime.start", () => {
        const recoverIndex = bootstrap.indexOf("await stateService.recoverPendingTransaction();");
        const migrateIndex = bootstrap.indexOf("await runDataMigrations(storageManager, storageMutationCoordinator);");
        const attachIndex = bootstrap.indexOf("attachCompatibilityFacade({");
        const startIndex = bootstrap.indexOf("await context.registries.features.start();");
        expect(recoverIndex).toBeGreaterThan(-1);
        expect(migrateIndex).toBeGreaterThan(recoverIndex);
        expect(attachIndex).toBeGreaterThan(migrateIndex);
        expect(startIndex).toBeGreaterThan(attachIndex);
    });

    it("logger runtime is frozen and exposes clog/show/loading before mirroring to window", () => {
        expect(logger).toContain("loggerRuntime = Object.freeze({ loading: loggerLoading, show: loggerShow, clog: loggerClog })");
        expect(logger).toContain("window.clog = loggerRuntime.clog");
        expect(logger).not.toContain("await storageManager.getSetting");
        expect(logger).not.toContain("async function()");
    });

    it("refreshes settings on pageshow/BFCache restore", () => {
        expect(appContext).toContain('rootScope.listen(window, "pageshow"');
        expect(appContext).toContain("runtime.legacyStorage?.invalidateSettingCache?.()");
        expect(appContext).toContain("await settings.refresh()");
    });

    it("exposes clog synchronously before compatibility attach", async () => {
        vi.resetModules();
        const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "https://javdb.com/" });
        const scope = new LifecycleScope("test-logger-runtime");
        const previous = {
            window: globalThis.window,
            document: globalThis.document,
            localStorage: globalThis.localStorage,
            unsafeWindow: globalThis.unsafeWindow,
        };
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = dom.window.localStorage;
        globalThis.unsafeWindow = dom.window;
        try {
            const { initializeLoggerRuntime } = await import("../src/core/logger.js?test=" + Date.now());
            const runtime = initializeLoggerRuntime(scope, { clogMsgCount: 2000 });
            expect(runtime.clog).toBeTruthy();
            expect(typeof runtime.clog.log).toBe("function");
            expect(runtime.show?.error).toBeTypeOf("function");
            expect(typeof runtime.loading).toBe("function");
            const handle = runtime.loading(), overlay = dom.window.document.querySelector(".loading-container");
            expect(overlay?.getAttribute("role")).toBe("status");
            expect(overlay?.getAttribute("aria-live")).toBe("polite");
            expect(overlay?.getAttribute("aria-busy")).toBe("true");
            expect(overlay?.getAttribute("aria-label")).toBe("处理中");
            handle.close();
            expect(dom.window.document.querySelector(".loading-container")).toBeNull();
        } finally {
            globalThis.window = previous.window;
            globalThis.document = previous.document;
            globalThis.localStorage = previous.localStorage;
            globalThis.unsafeWindow = previous.unsafeWindow;
            scope.dispose();
        }
    });

    it("does not depend on async storage hydration to create clog", async () => {
        vi.resetModules();
        const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "https://javdb.com/" });
        const scope = new LifecycleScope("test-logger-no-storage");
        const previous = {
            window: globalThis.window,
            document: globalThis.document,
            localStorage: globalThis.localStorage,
            unsafeWindow: globalThis.unsafeWindow,
            storageManager: globalThis.storageManager,
        };
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = dom.window.localStorage;
        globalThis.unsafeWindow = dom.window;
        const getSetting = vi.fn(() => new Promise(() => {}));
        globalThis.storageManager = { getSetting };
        try {
            const { initializeLoggerRuntime } = await import("../src/core/logger.js?no-storage=" + Date.now());
            const runtime = initializeLoggerRuntime(scope, { clogMsgCount: 2000 });
            expect(runtime.clog).toBeTruthy();
            expect(getSetting).not.toHaveBeenCalled();
        } finally {
            globalThis.window = previous.window;
            globalThis.document = previous.document;
            globalThis.localStorage = previous.localStorage;
            globalThis.unsafeWindow = previous.unsafeWindow;
            globalThis.storageManager = previous.storageManager;
            scope.dispose();
        }
    });
});
