import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import { createPan123Adapter, signPan123Url } from "../../src/integrations/pan123/manifest.js";
import { OfflineService } from "../../src/services/offline-service.js";

const fixture = (name) => JSON.parse(readFileSync(join(import.meta.dirname, `../fixtures/integrations/pan123/${name}.json`), "utf8"));

describe("pan123 integration contract", () => {
    it("signs requests without Math.random and normalizes resolve/submit results", async () => {
        const scope = new LifecycleScope("feature:external-bridge"), request = vi.fn(async options => ({ status: 200, data: options.url.includes("/resolve") ? fixture("resolve") : fixture("submit"), finalUrl: options.url }));
        const adapter = createPan123Adapter({ request }, { now: () => new Date("2026-08-24T12:34:00.000Z"), nonce: () => 123456 });
        expect(adapter.homeUrl).toBe("https://yun.123pan.com");
        await expect(adapter.submit("magnet:?xt=urn:btih:test", { token: "secret", scope })).resolves.toEqual({ fileCount: 2, totalSize: 300 });
        expect(request).toHaveBeenCalledTimes(2);
        for (const [options, receivedScope] of request.mock.calls) {
            expect(options).toMatchObject({ providerId: "pan123", capability: expect.stringMatching(/^offline\.(resolve|submit)$/), method: "POST", responseType: "json", timeout: 5000, urlPolicy: { trustClass: "builtin-public", hosts: ["123pan.com"] } });
            expect(options.url).toMatch(/^https:\/\/yun\.123pan\.com\/b\/api\/v2\/offline_download\/task\/(resolve|submit)\?/);
            expect(options.headers.Authorization).toBe("Bearer secret");
            expect(receivedScope).toBe(scope);
        }
        expect(JSON.parse(request.mock.calls[0][0].body)).toEqual({ urls: "magnet:?xt=urn:btih:test" });
        expect(JSON.parse(request.mock.calls[1][0].body)).toEqual({ resource_list: [{ resource_id: 42, select_file_id: [101, 102] }] });
        expect(signPan123Url("https://yun.123pan.com/path", { now: new Date("2026-08-24T12:34:00.000Z"), nonce: 123456 })).toContain("123456");
    });

    it("keeps Feature callers behind OfflineService", async () => {
        const submit = vi.fn(async () => ({ fileCount: 1, totalSize: 100 })), integrations = { getAdapter: vi.fn(() => ({ submit })) };
        const service = new OfflineService({ getAvailable: vi.fn() }, integrations);
        await expect(service.submitWithIntegration("pan123", "magnet:test", { token: "secret" })).resolves.toEqual({ fileCount: 1, totalSize: 100 });
        expect(integrations.getAdapter).toHaveBeenCalledWith("pan123");
        expect(submit).toHaveBeenCalledWith("magnet:test", { token: "secret" });
    });
});
