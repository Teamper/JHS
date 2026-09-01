import { describe, expect, it, vi } from "vitest";
import { ScreenshotService } from "../src/services/screenshot-service.js";

describe("ScreenshotService", () => {
    it("keeps provider priority before integration fallback", async () => {
        const provider = { id: "preferred", resolve: vi.fn(async () => ["provider-image"]) };
        const providers = { getAvailable: vi.fn(async () => [provider]), updateHealth: vi.fn() };
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" })).resolves.toEqual(["provider-image"]);
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("uses normalized Integration images when providers have no result", async () => {
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/a.jpg", providerId: "javstore" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { scope: "scope" })).resolves.toEqual([
            { url: "https://javstore.net/a.jpg", providerId: "javstore" },
        ]);
        expect(getImages).toHaveBeenCalledWith({ carNum: "ABC-123" }, { scope: "scope" });
    });

    it("gets provider confirmation URLs through the Integration boundary", () => {
        const providers = { getAvailable: vi.fn(), updateHealth: vi.fn() };
        const getSearchUrl = vi.fn(() => "https://javstore.net/search?q=ABC-123");
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getSearchUrl })) };
        expect(new ScreenshotService(providers, integrations).getSearchUrl({ carNum: "ABC-123" })).toBe("https://javstore.net/search?q=ABC-123");
        expect(getSearchUrl).toHaveBeenCalledWith({ carNum: "ABC-123" });
    });

    it("allows the list manual button to resolve while detail auto-load is disabled", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/manual.jpg" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "no" };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toBeNull();
        await expect(service.resolve({ carNum: "ABC-123" }, { settings, allowWhenDisabled: true })).resolves.toEqual([{ url: "https://javstore.net/manual.jpg" }]);
    });
});

describe("ScreenshotService explicit provider resolution", () => {
    const threeIntegrations = () => ({ list: vi.fn(() => [ { id: "javstore" }, { id: "javbus" }, { id: "fc2content" } ]), getAdapter: vi.fn() });

    it("resolves an explicit javstore hit and does not consult javbus or fc2content", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://javstore.net/long.jpg", providerId: "javstore" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toEqual([
            { url: "https://javstore.net/long.jpg", providerId: "javstore" },
        ]);
        expect(integrations.getAdapter).toHaveBeenCalledTimes(1);
        expect(integrations.getAdapter).toHaveBeenCalledWith("javstore");
        expect(getImages).toHaveBeenCalledWith({ carNum: "ABC-123" }, { providerId: "javstore" });
    });

    it("returns null on an explicit javstore miss without falling back to javbus or fc2content", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => []);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toBeNull();
        expect(integrations.getAdapter).toHaveBeenCalledTimes(1);
        expect(integrations.getAdapter).toHaveBeenCalledWith("javstore");
    });

    it("does not call an explicit disabled provider or fall back to another source", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://javstore.net/a.jpg" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { get: vi.fn(() => ({ id: "javstore", enabled: false, capabilities: [ "screenshot" ] })), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("never lets JavBus cover or FC2 gallery enter the long-thumbnail path", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://example.com/cover.jpg" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "FC2-123" }, { providerId: "fc2content" })).resolves.toBeNull();
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javbus" })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
        expect(new ScreenshotService(providers, integrations).getSearchUrl({ carNum: "ABC-123" })).toBeNull();
    });

    it("returns null for an unknown explicit providerId without calling any adapter", async () => {
        const integrations = threeIntegrations();
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "missing" })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("defaults to javstore only and never lets javbus or fc2content enter the long-thumbnail path", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://javstore.net/long.jpg", providerId: "javstore" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" })).resolves.toEqual([
            { url: "https://javstore.net/long.jpg", providerId: "javstore" },
        ]);
        expect(integrations.getAdapter).toHaveBeenCalledTimes(1);
        expect(integrations.getAdapter).toHaveBeenCalledWith("javstore");
    });

    it("honors an explicit runtime screenshot provider before the integration", async () => {
        const provider = { id: "javstore", capabilities: [ "screenshot" ], resolve: vi.fn(async () => [ "provider-long" ]) };
        const providers = { get: vi.fn(() => provider), updateHealth: vi.fn() };
        const integrations = threeIntegrations();
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toEqual([ "provider-long" ]);
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });
});

describe("ScreenshotService provider whitelist", () => {
    it("returns null immediately when all providers are disabled", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/a.jpg" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
        expect(providers.getAvailable).not.toHaveBeenCalled();
    });

    it("does not call a disabled javstore through the default fallback", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/a.jpg" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("rejects an explicit providerId that is not in the whitelist", async () => {
        const provider = { id: "projectjav", capabilities: ["screenshot"], resolve: vi.fn(async () => ["x"]) };
        const providers = { get: vi.fn(() => provider), getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        const integrations = { list: vi.fn(() => []), getAdapter: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { providerId: "projectjav", settings })).resolves.toBeNull();
        expect(provider.resolve).not.toHaveBeenCalled();
    });

    it("keeps the whitelisted javstore working in default and explicit modes", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/long.jpg", providerId: "javstore" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true, priority: 5 }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toEqual([{ url: "https://javstore.net/long.jpg", providerId: "javstore" }]);
        await expect(service.resolve({ carNum: "ABC-123" }, { providerId: "javstore", settings })).resolves.toEqual([{ url: "https://javstore.net/long.jpg", providerId: "javstore" }]);
    });

    it("getSearchUrl returns null when javstore is disabled", () => {
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getSearchUrl: () => "https://javstore.net/search?q=ABC-123" })) };
        const service = new ScreenshotService({ getAvailable: vi.fn(), updateHealth: vi.fn() }, integrations);
        expect(service.getSearchUrl({ carNum: "ABC-123" }, { screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) })).toBeNull();
    });
});
