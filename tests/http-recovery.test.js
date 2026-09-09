import { describe, expect, it, vi } from "vitest";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { CacheService } from "../src/services/cache-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const options = { providerId: "test", url: "https://api.example.test/data", cacheScope: "none", retryDelayMs: 0, urlPolicy: { trustClass: "builtin-public", hosts: ["example.test"] } };
describe("HTTP recovery regressions", () => {
    it("releases a cancelled probe without blocking the next request", async () => {
        const scope = new LifecycleScope("probe"), request = vi.fn(async () => { scope.dispose(); throw new DOMException("aborted", "AbortError"); });
        const http = new HttpService({ request }, new ExternalUrlPolicy());
        http.ensureCircuit("api.example.test").state = "half-open";
        await expect(http.request(options, scope)).rejects.toMatchObject({ code: "ABORTED" });
        request.mockResolvedValue({ status: 200 });
        await expect(http.request(options)).resolves.toMatchObject({ status: 200 });
    });
    it("cleans up a consumer if its scope is disposed synchronously by the transport", async () => {
        const scope = new LifecycleScope("transport"), request = vi.fn(async () => { scope.dispose(); return { status: 200 }; });
        const http = new HttpService({ request }, new ExternalUrlPolicy());
        await expect(http.request({ ...options, cacheScope: "public" }, scope)).rejects.toBeDefined();
        expect(request.mock.calls[0][0].signal.aborted).toBe(true);
        await vi.waitFor(() => expect(http.inflight.size).toBe(0));
    });
    it.each([401, 404, 429])("releases a half-open probe after HTTP %s", async status => {
        const request = vi.fn(async () => ({ status })), http = new HttpService({ request }, new ExternalUrlPolicy());
        Object.assign(http.ensureCircuit("api.example.test"), { state: "half-open" });
        await expect(http.request(options)).rejects.toBeDefined();
        request.mockResolvedValue({ status: 200 });
        await expect(http.request(options)).resolves.toMatchObject({ status: 200 });
    });
    it("allows the probe owner to retry", async () => {
        const request = vi.fn().mockResolvedValueOnce({ status: 503 }).mockResolvedValue({ status: 200 });
        const http = new HttpService({ request }, new ExternalUrlPolicy());
        http.ensureCircuit("api.example.test").state = "half-open";
        await expect(http.request({ ...options, retryCount: 1 })).resolves.toMatchObject({ status: 200 });
    });
    it("uses live settings with total-attempt semantics but does not retry writes by default", async () => {
        let snapshot = { httpTimeout: 1234, httpRetryCount: 3, circuitBreakerThreshold: 20 };
        const request = vi.fn(async () => ({ status: 503 })), http = new HttpService({ request }, new ExternalUrlPolicy(), { settings: { snapshot: () => snapshot } });
        await expect(http.request(options)).rejects.toBeDefined();
        expect(request).toHaveBeenCalledTimes(3);
        expect(request.mock.calls[0][0].timeout).toBe(1234);
        snapshot = { ...snapshot, httpRetryCount: 10 };
        request.mockClear();
        await expect(http.request(options)).rejects.toBeDefined();
        expect(request).toHaveBeenCalledTimes(10);
        request.mockClear();
        await expect(http.request({ ...options, method: "POST" })).rejects.toBeDefined();
        expect(request).toHaveBeenCalledTimes(1);
    });
    it("starts fresh work after public cache clearing while old work is pending", async () => {
        const resolve = [], request = vi.fn(() => new Promise(done => resolve.push(done))), cache = new CacheService();
        const http = new HttpService({ request }, new ExternalUrlPolicy(), { cache });
        const first = http.request({ ...options, cacheScope: "public", ttlMs: 1000 });
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
        await cache.clearPublic();
        const second = http.request({ ...options, cacheScope: "public", ttlMs: 1000 });
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        resolve[0]({ status: 200, data: "old" });
        await first;
        expect(http.inflight.size).toBe(1);
        resolve[1]({ status: 200, data: "new" });
        expect((await second).data).toBe("new");
    });
    it("does not start a request after its scope closes during key derivation", async () => {
        const request = vi.fn(async () => ({ status: 200 })), http = new HttpService({ request }, new ExternalUrlPolicy());
        const scope = new LifecycleScope("closed"), pending = http.request({ ...options, cacheScope: "public" }, scope);
        scope.dispose();
        await expect(pending).rejects.toBeDefined();
        expect(request).not.toHaveBeenCalled();
        expect(http.inflight.size).toBe(0);
    });
});
