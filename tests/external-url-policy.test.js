import { describe, expect, it, vi } from "vitest";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { HttpService } from "../src/services/http-service.js";
import { ResourceSettingsService } from "../src/services/resource-settings-service.js";
import { IntegrationRegistry } from "../src/app/integration-registry.js";
import { MagnetService } from "../src/services/magnet-service.js";
import torrentManifest from "../src/integrations/torrent-sources/manifest.js";
import { SERVICE } from "../src/contracts/tokens.js";

const privateMapped = ["::ffff:127.0.0.1", "::ffff:192.168.1.1", "::ffff:10.0.0.1", "::ffff:172.16.1.2", "::ffff:169.254.1.2", "::ffff:0.1.2.3", "::ffff:7f00:1", "0:0:0:0:0:ffff:c0a8:0101"];

describe("mapped IPv6 URL policy", () => {
    it.each(privateMapped)("rejects private literal %s before transport and after a redirect", (host) => {
        const policy = new ExternalUrlPolicy(), options = { trustClass: "custom-public" }, url = `https://[${host}]/data`;
        expect(() => policy.assertAllowed(url, options)).toThrow(/公网 HTTPS/);
        expect(() => policy.assertFinalUrl(url, options)).toThrow(/公网 HTTPS/);
    });

    it.each(["https://[::ffff:8.8.8.8]/data", "https://[::ffff:0808:0808]/data", "https://[2001:4860:4860::8888]/data", "https://example.test/data"])("keeps public origin %s available", (url) => {
        expect(new ExternalUrlPolicy().assertAllowed(url, { trustClass: "custom-public" }).href).toBe(new URL(url).href);
    });

    it("retains exact explicit user-local authorization for mapped addresses", () => {
        const origin = "https://[::ffff:7f00:1]:5244", policy = new ExternalUrlPolicy({ localOrigins: [origin] });
        expect(policy.assertAllowed(`${origin}/dav`, { trustClass: "user-local", expectedOrigin: origin }).origin).toBe(origin);
        expect(() => policy.assertAllowed("https://[::ffff:7f00:1]:5245/dav", { trustClass: "user-local", expectedOrigin: origin })).toThrow();
    });

    it.each(privateMapped.slice(0, 3))("blocks imported configuration %s along the real source search chain", async (host) => {
        const values = new Map(), settings = new ResourceSettingsService({ getSetting: async (key, fallback) => values.get(key) ?? fallback, saveSettingItem: async (key, value) => values.set(key, value) });
        await settings.importConfig(JSON.stringify({ magnetBuiltInSources: [{ id: "u9a9", baseUrl: `https://[${host}]`, enabled: true, priority: 20 }] }));
        const source = (await settings.getBuiltInSources())[0], request = vi.fn(() => { throw new Error("No network is permitted"); });
        const http = new HttpService({ request }, new ExternalUrlPolicy());
        const integrations = new IntegrationRegistry({ resolveDeclared: () => ({ [SERVICE.http]: http }) }, { recordError() {} });
        integrations.register(torrentManifest);
        await expect(new MagnetService(null, integrations).searchSource(source.id, "audit", { baseUrl: source.baseUrl })).rejects.toMatchObject({ code: "INVALID_URL" });
        expect(request).not.toHaveBeenCalled();
    });
});
