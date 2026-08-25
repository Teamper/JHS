import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CacheService } from "../src/services/cache-service.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { canonicalizeUrl, createRequestKey, HttpService, isCloudflareChallenge } from "../src/services/http-service.js";
import { SettingsService } from "../src/services/settings-service.js";

describe("HTTP, URL and settings contracts", () => {
    it("does not derive RequestKeys for mutation or no-cache requests", async () => {
        const digest = vi.spyOn(crypto.subtle, "digest"), port = { request: vi.fn(async options => ({ status: 200, data: {}, finalUrl: options.url })) };
        const service = new HttpService(port, new ExternalUrlPolicy());
        await service.request({ providerId: "account", method: "POST", url: "https://api.example.test/login?password=secret", responseType: "json", cacheScope: "none", urlPolicy: { trustClass: "builtin-public", hosts: ["example.test"] } });
        expect(digest).not.toHaveBeenCalled();
        digest.mockRestore();
    });
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

    it("cancels non-cached requests with their LifecycleScope", async () => {
        const request = vi.fn(options => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })));
        const service = new HttpService({ request }, new ExternalUrlPolicy()), scope = new LifecycleScope("settings:test-source");
        const pending = service.request({ providerId: "example", url: "https://api.example.test/data", urlPolicy: { trustClass: "builtin-public", hosts: ["api.example.test"] }, cacheScope: "none" }, scope);
        await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
        scope.dispose();
        await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
        expect(request.mock.calls[0][0].signal.aborted).toBe(true);
    });

    it("normalizes authentication and rate-limit HTTP statuses", async () => {
        const policy = new ExternalUrlPolicy(), options = { providerId: "example", url: "https://api.example.test/data", urlPolicy: { trustClass: "builtin-public", hosts: ["api.example.test"] }, cacheScope: "none" };
        const unauthorized = new HttpService({ request: async () => ({ status: 401, finalUrl: options.url }) }, policy);
        await expect(unauthorized.request(options)).rejects.toMatchObject({ code: "AUTH_REQUIRED", retryable: false, details: { status: 401 } });
        const limited = new HttpService({ request: async () => ({ status: 429, finalUrl: options.url }) }, policy);
        await expect(limited.request(options)).rejects.toMatchObject({ code: "RATE_LIMITED", retryable: true, details: { status: 429 } });
    });

    it("retries transient failures and records domain health", async () => {
        const request = vi.fn()
            .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
            .mockResolvedValueOnce({ status: 200, data: "ok", finalUrl: "https://api.example.test/data" });
        const service = new HttpService({ request }, new ExternalUrlPolicy());
        await expect(service.request({ providerId: "example", url: "https://api.example.test/data", cacheScope: "none", retryCount: 1, retryDelayMs: 0, urlPolicy: { trustClass: "builtin-public", hosts: ["example.test"] } })).resolves.toMatchObject({ data: "ok" });
        expect(request).toHaveBeenCalledTimes(2);
        expect(service.getDomainStats()["api.example.test"]).toMatchObject({ count: 2, errors: 1 });
    });

    it("detects Cloudflare challenges and opens a domain circuit", async () => {
        const challenge = '<title>Just a moment...</title><form id="challenge-form"><script src="/cdn-cgi/challenge-platform/x"></script></form>';
        expect(isCloudflareChallenge(challenge, 503)).toBe(true);
        const request = vi.fn(async options => ({ status: 503, data: challenge, responseText: challenge, finalUrl: options.url }));
        const service = new HttpService({ request }, new ExternalUrlPolicy()), options = {
            providerId: "example", url: "https://api.example.test/data?token=secret", cacheScope: "none", retryCount: 0, circuitThreshold: 2,
            urlPolicy: { trustClass: "builtin-public", hosts: ["example.test"] },
        };
        await expect(service.request(options)).rejects.toMatchObject({ code: "CF_BLOCKED", details: { domain: "api.example.test", status: 503 } });
        await expect(service.request(options)).rejects.toMatchObject({ code: "CF_BLOCKED" });
        await expect(service.request(options)).rejects.toMatchObject({ code: "CIRCUIT_OPEN", details: { domain: "api.example.test" } });
        expect(request).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(service.getCircuitBreakerStatus())).not.toContain("secret");
    });

    it("can constrain builtin requests and redirects to an exact origin", () => {
        const policy = new ExternalUrlPolicy(), contract = { trustClass: "builtin-public", hosts: ["example.test"], expectedOrigin: "https://example.test" };
        expect(policy.assertAllowed("https://example.test/page", contract).pathname).toBe("/page");
        expect(() => policy.assertAllowed("https://api.example.test/page", contract)).toThrow(/精确 origin/);
        expect(() => policy.assertFinalUrl("https://api.example.test/page", contract)).toThrow(/精确 origin/);
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

    it("replaces, patches and refreshes the single runtime settings snapshot", async () => {
        const values = new Map([["setting", { mobileMode: "auto", reviewCount: 20 }]]), afterPersist = vi.fn(), storage = {
            get: vi.fn(async key => values.get(key)),
            set: vi.fn(async (key, value) => values.set(key, value)),
        };
        const settings = new SettingsService(storage, { afterPersist });
        await settings.load();
        await settings.patch({ reviewCount: 50, themeMode: "dark" });
        expect(settings.snapshot()).toEqual({ mobileMode: "auto", reviewCount: 50, themeMode: "dark" });
        await settings.replace({ mobileMode: "off" });
        expect(settings.snapshot()).toEqual({ mobileMode: "off" });
        values.set("setting", { mobileMode: "on", legacyWrite: true });
        await settings.refresh();
        expect(settings.snapshot()).toEqual({ mobileMode: "on", legacyWrite: true });
        expect(afterPersist).toHaveBeenCalledTimes(2);
    });

    it("proxies legacy network controls through DiagnosticsService", () => {
        const legacyHttp = {
            getCircuitBreakerStatus: vi.fn(() => ({ "api.example": { state: "open" } })),
            getDomainStats: vi.fn(() => ({ "api.example": { count: 2, errors: 1 } })),
            resetCircuitBreaker: vi.fn(), resetAllCircuitBreakers: vi.fn(), clearDomainStats: vi.fn(),
        };
        const diagnostics = new DiagnosticsService({ legacyHttp });
        expect(diagnostics.getNetworkDiagnostics()).toEqual({
            circuitBreakers: { "api.example": { state: "open" } },
            domainStats: { "api.example": { count: 2, errors: 1 } },
        });
        diagnostics.resetCircuitBreaker("api.example");
        diagnostics.resetAllCircuitBreakers();
        diagnostics.clearDomainStats();
        expect(legacyHttp.resetCircuitBreaker).toHaveBeenCalledWith("api.example");
        expect(legacyHttp.resetAllCircuitBreakers).toHaveBeenCalledOnce();
        expect(legacyHttp.clearDomainStats).toHaveBeenCalledOnce();
    });
});
