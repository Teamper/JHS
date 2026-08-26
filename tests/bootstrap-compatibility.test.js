import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { attachCompatibilityFacade } from "../src/app/compatibility-facade.js";

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

    it("logger runtime is frozen and exposes clog/show/loading before mirroring to window", () => {
        expect(logger).toContain("loggerRuntime = Object.freeze({ loading: loggerLoading, show: loggerShow, clog: loggerClog })");
        expect(logger).toContain("window.clog = loggerRuntime.clog");
    });

    it("refreshes settings on pageshow/BFCache restore", () => {
        expect(appContext).toContain('rootScope.listen(window, "pageshow"');
        expect(appContext).toContain("runtime.legacyStorage?.invalidateSettingCache?.()");
        expect(appContext).toContain("await settings.refresh()");
    });
});
