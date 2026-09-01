// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { MagnetHubPlugin } from "../src/features/detail/detail-external-magnets-controller.js";

function createPlugin() {
    const request = vi.fn(async options => ({ status: 200, data: "payload", finalUrl: options.url }));
    const plugin = new MagnetHubPlugin();
    plugin.runtimeServices = Object.freeze({ http: { request }, scope: async () => ({ id: "scope" }) });
    return { plugin, request };
}

describe("MagnetHub HttpService boundary", () => {
    it("uses public cache and a declared host for built-in GET sources", async () => {
        const { plugin, request } = createPlugin();
        await expect(plugin.requestSource("u9a9", "https://u9a9.com/?search=ABC", { hosts: ["u9a9.com"] })).resolves.toBe("payload");
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            providerId: "magnet:u9a9", method: "GET", cacheScope: "public",
            urlPolicy: { trustClass: "builtin-public", hosts: ["u9a9.com"] },
        }), { id: "scope" });
    });

    it("uses custom-public trust for user sources", async () => {
        const { plugin, request } = createPlugin();
        await plugin.requestSource("custom", "https://search.example/?q=ABC", { custom: true, responseType: "json" });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ responseType: "json", urlPolicy: { trustClass: "custom-public" } }), expect.anything());
    });

    it("never applies generic cache to mutation requests", async () => {
        const { plugin, request } = createPlugin();
        await plugin.requestSource("btsow", "https://btsow.lol/search", { method: "POST", body: "[]", hosts: ["btsow.lol"] });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", cacheScope: "none", body: "[]" }), expect.anything());
    });
});
