// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "../src/app/create-app-context.js";

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
