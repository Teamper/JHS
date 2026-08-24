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
});
