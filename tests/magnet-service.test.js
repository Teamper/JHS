import { describe, expect, it, vi } from "vitest";
import { MagnetService } from "../src/services/magnet-service.js";

describe("MagnetService", () => {
    it("loads native magnets only from the selected Integration", async () => {
        const listMagnets = vi.fn(async () => [{ hash: "abc", providerId: "javdb" }]);
        const integrations = { list: vi.fn(() => [{ id: "javdb" }]), getAdapter: vi.fn(() => ({ listMagnets })) };
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        await expect(new MagnetService(providers, integrations).listNative({ movieId: "9", providerId: "javdb" }, { scope: "scope" })).resolves.toEqual([{ hash: "abc", providerId: "javdb" }]);
        expect(listMagnets).toHaveBeenCalledWith({ movieId: "9", providerId: "javdb" }, { scope: "scope" });
        expect(providers.getAvailable).not.toHaveBeenCalled();
    });

    it("routes built-in source discovery and search through the magnet Integration", async () => {
        const sources = [{ id: "u9a9", baseUrl: "https://u9a9.com" }], search = vi.fn(async () => [{ source: "u9a9" }]), targetUrl = vi.fn(() => "https://u9a9.com/?search=ABC");
        const adapter = { getSources: vi.fn(() => sources), search, targetUrl };
        const integrations = { list: vi.fn(() => [{ id: "torrent-sources" }]), getAdapter: vi.fn(() => adapter) };
        const service = new MagnetService({ getAvailable: vi.fn(async () => []) }, integrations);

        expect(service.getBuiltInSources()).toEqual(sources);
        await expect(service.searchSource("u9a9", "ABC", { scope: "scope" })).resolves.toEqual([{ source: "u9a9" }]);
        expect(search).toHaveBeenCalledWith("u9a9", "ABC", { scope: "scope" });
        expect(service.getSourceTargetUrl("u9a9", "ABC")).toBe("https://u9a9.com/?search=ABC");
        expect(targetUrl).toHaveBeenCalledWith("u9a9", "ABC", {});
    });
});
