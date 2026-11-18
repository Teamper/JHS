// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppContext } from "../src/app/create-app-context.js";

// Node 26 默认在 globalThis 定义 localStorage 访问器（未提供 --localstorage-file 时取值为 undefined），
// Vitest 的 jsdom 环境因此跳过注入；这里显式绑定本环境 jsdom 窗口的真实 Storage。
beforeEach(() => { vi.stubGlobal("localStorage", globalThis.jsdom.window.localStorage); });
afterEach(() => { vi.unstubAllGlobals(); });

function createRuntime(initial = {}) {
    const values = new Map([[ "setting", { ...initial } ]]);
    window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    return {
        values,
        runtime: {
            gmRequest: vi.fn(), gmGetValue: (_key, fallback) => fallback, gmSetValue: vi.fn(),
            storageForage: {
                getItem: async key => values.get(key),
                setItem: async (key, value) => { values.set(key, value); },
                removeItem: async key => { values.delete(key); },
            },
            localStorage: window.localStorage, layer: {}, stateService: {}, localOrigins: initial.trustedLocalOrigins ?? [],
        },
    };
}

describe("trusted local origin runtime synchronization", () => {
    it("preserves viewer ownership, sequence and initial index through the real composition root", () => {
        const { runtime } = createRuntime(), context = createAppContext(runtime);
        const open = vi.fn(); vi.stubGlobal("showImageViewer", open);
        const source = document.createElement("img"), trigger = document.createElement("button");
        const options = { owner:trigger, trigger, scope:context.rootScope, images:[{url:"https://example.test/full.jpg",alt:"全图"}], initialViewIndex:0 };
        context.services.domUi.openImageViewer(source, options);
        expect(open).toHaveBeenCalledExactlyOnceWith(source, "", options);
        context.rootScope.dispose(); vi.unstubAllGlobals();
    });
    it("injects the shared DialogService into supporting utility runtimes", () => {
        const { runtime } = createRuntime();
        runtime.legacyUtils = { setDialogService: vi.fn() };
        const context = createAppContext(runtime);
        expect(runtime.legacyUtils.setDialogService).toHaveBeenCalledExactlyOnceWith(context.services.dialog);
        context.rootScope.dispose();
    });

    it("routes resource settings through the coordinated SettingsService writer", async () => {
        const { runtime } = createRuntime();
        const context = createAppContext(runtime);
        await context.services.settings.load();
        const source = {
            id: "fixture-source", name: "Fixture", enabled: true,
            searchUrlTemplate: "https://search.example/?q={keyword}",
            targetUrlTemplate: "https://search.example/?q={keyword}", parserType: "magnet-links",
        };

        await context.services.resourceSettings.saveMagnetSources([source]);

        expect(await context.services.resourceSettings.getMagnetSources()).toEqual([source]);
        expect(context.services.settings.snapshot().customMagnetSources).toBe(JSON.stringify([source]));
        context.rootScope.dispose();
    });

    it("applies additions and revocations without reloading the application", async () => {
        const { runtime } = createRuntime({ trustedLocalOrigins: [] });
        const context = createAppContext(runtime);
        await context.services.settings.load();
        const policy = { trustClass: "user-local", expectedOrigin: "http://192.168.1.10:5244" };

        expect(() => context.services.urlPolicy.assertAllowed("http://192.168.1.10:5244/dav", policy)).toThrow();
        await context.services.settings.set("trustedLocalOrigins", [ "http://192.168.1.10:5244" ]);
        expect(context.services.urlPolicy.assertAllowed("http://192.168.1.10:5244/dav", policy).pathname).toBe("/dav");
        await context.services.settings.set("trustedLocalOrigins", []);
        expect(() => context.services.urlPolicy.assertAllowed("http://192.168.1.10:5244/dav", policy)).toThrow();
        context.rootScope.dispose();
    });

    it("updates the policy when a remote or legacy write is refreshed", async () => {
        const { runtime, values } = createRuntime({ trustedLocalOrigins: [] });
        const context = createAppContext(runtime);
        await context.services.settings.load();
        values.set("setting", { trustedLocalOrigins: [ "http://localhost:8080" ] });

        await context.services.settings.refresh();

        expect(context.services.urlPolicy.assertAllowed("http://localhost:8080/dav", { trustClass: "user-local", expectedOrigin: "http://localhost:8080" }).pathname).toBe("/dav");
        context.rootScope.dispose();
    });
});
