import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CacheService } from "../src/services/cache-service.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { canonicalizeUrl, createRequestKey, HttpService } from "../src/services/http-service.js";
import { SettingsService } from "../src/services/settings-service.js";

describe("HTTP, URL and settings contracts", () => {
    it("canonicalizes RequestKey without retaining credential values", async () => {
        expect(canonicalizeUrl("https://api.example.test/a?z=2&a=1#secret")).toBe("https://api.example.test/a?a=1&z=2");
        const key = await createRequestKey({ providerId: "example", method: "GET", url: "https://api.example.test/a", headers: { Authorization: "Bearer secret" }, varyHeaders: ["Authorization"], cacheScope: "session", sessionScopeId: "account-a" });
        expect(JSON.stringify(key)).not.toContain("Bearer secret");
        expect(key.varyHeadersHash).toHaveLength(64);
    });

    it("deduplicates scoped GET consumers and aborts only after the last consumer", async () => {
        let resolveRequest;
        const request = vi.fn(() => new Promise((resolve) => { resolveRequest = resolve; }));
        const diagnostics = new DiagnosticsService();
        const service = new HttpService({ request }, new ExternalUrlPolicy(), { diagnostics, cache: new CacheService({ diagnostics }) });
        const firstScope = new LifecycleScope("first");
        const secondScope = new LifecycleScope("second");
        const options = { providerId: "example", url: "https://api.example.test/data", urlPolicy: { trustClass: "builtin-public", hosts: ["api.example.test"] }, cacheScope: "public", ttlMs: 1000 };
        const first = service.request(options, firstScope);
        const second = service.request(options, secondScope);
        await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
        firstScope.dispose();
        await expect(first).rejects.toMatchObject({ code: "ABORTED" });
        expect(request.mock.calls[0][0].signal.aborted).toBe(false);
        resolveRequest({ status: 200, data: { ok: true }, finalUrl: "https://api.example.test/data" });
        await expect(second).resolves.toMatchObject({ data: { ok: true } });
        expect(diagnostics.exportSnapshot()).toMatchObject({ requestConsumers: 0, underlyingRequests: 0 });
    });

    it("revalidates finalUrl for every trust class", async () => {
        const service = new HttpService({ request: async () => ({ status: 200, finalUrl: "https://evil.example/data" }) }, new ExternalUrlPolicy());
        await expect(service.request({ providerId: "example", url: "https://api.example.test/data", urlPolicy: { trustClass: "builtin-public", hosts: ["api.example.test"] }, cacheScope: "none" })).rejects.toMatchObject({ code: "INVALID_URL" });
    });

    it("permits user-local only for an explicitly authorized exact origin", () => {
        const policy = new ExternalUrlPolicy({ localOrigins: ["http://192.168.1.10:5244"] });
        expect(policy.assertAllowed("http://192.168.1.10:5244/dav", { trustClass: "user-local", expectedOrigin: "http://192.168.1.10:5244" }).pathname).toBe("/dav");
        expect(() => policy.assertFinalUrl("http://192.168.1.10:8080/dav", { trustClass: "user-local", expectedOrigin: "http://192.168.1.10:5244" })).toThrow();
        expect(() => policy.assertAllowed("https://127.0.0.1/data", { trustClass: "custom-public" })).toThrow();
    });

    it("updates a settings snapshot only after persistence succeeds", async () => {
        const values = new Map([["setting", { theme: "light" }]]);
        const storage = { get: async (key) => values.get(key), set: vi.fn(async (key, value) => values.set(key, value)) };
        const settings = new SettingsService(storage, { validators: { theme: (value) => ["light", "dark"].includes(String(value)) } });
        await settings.load();
        await settings.set("theme", "dark");
        expect(settings.snapshot()).toEqual({ theme: "dark" });
        expect(() => settings.set("theme", "invalid")).rejects.toThrow(/Invalid/);
    });

    it("serializes concurrent settings writes without dropping fields", async () => {
        const values = new Map([["setting", { existing: true }]]), storage = {
            get: vi.fn(async key => values.get(key)),
            set: vi.fn(async (key, value) => { await Promise.resolve(); values.set(key, value); }),
        };
        const settings = new SettingsService(storage);
        await settings.load();
        await Promise.all([settings.set("sortMethod", "date"), settings.set("theme", "dark")]);
        expect(settings.snapshot()).toEqual({ existing: true, sortMethod: "date", theme: "dark" });
        expect(values.get("setting")).toEqual(settings.snapshot());
    });
});
