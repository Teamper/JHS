import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { attachCompatibilityFacade } from "../src/app/compatibility-facade.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("bootstrap compatibility P0", () => {
    it("compatibility facade rejects when clog is missing", () => {
        expect(() => attachCompatibilityFacade({
            pluginManager: {}, utils: {}, stateService: {}, jhsEventBus: {},
            show: () => {}, loading: () => {},
        }, {})).toThrow(/Compatibility facade is missing clog/);
    });

    it("copies logger runtime values into the target instead of reading globalThis", () => {
        const clog = { log() {} };
        const show = { ok() {}, error() {}, info() {} };
        const loading = () => ({ close() {} });
        const target = {};
        attachCompatibilityFacade({ pluginManager: {}, utils: {}, stateService: {}, jhsEventBus: {}, clog, show, loading }, target);
        expect(target.clog).toBe(clog);
        expect(target.show).toBe(show);
        expect(target.loading).toBe(loading);
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
            expect(Object.isFrozen(runtime)).toBe(true);
            expect(dom.window.clog).toBeUndefined();
            expect(dom.window.show).toBeUndefined();
            expect(dom.window.loading).toBeUndefined();
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
