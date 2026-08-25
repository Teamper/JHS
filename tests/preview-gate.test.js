import { describe, expect, it, vi } from "vitest";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { fetchDmmPreviewIfEnabled, isDmmEnabled, isPreviewEnabled } from "../src/services/preview-service.js";

describe("preview master + DMM sub switch policy", () => {
    it("treats enablePreviewVideo as the master switch", () => {
        expect(isPreviewEnabled({})).toBe(true);
        expect(isPreviewEnabled({ enablePreviewVideo: "yes" })).toBe(true);
        expect(isPreviewEnabled({ enablePreviewVideo: "no" })).toBe(false);
    });

    it("treats enableLoadPreviewVideo as the DMM enhancement sub switch", () => {
        expect(isDmmEnabled({})).toBe(true);
        expect(isDmmEnabled({ enableLoadPreviewVideo: "no" })).toBe(false);
        expect(isDmmEnabled({ enablePreviewVideo: "no", enableLoadPreviewVideo: "yes" })).toBe(true);
    });

    it("DMM sub switch OFF never issues a DMM request", async () => {
        const movie = { preview: vi.fn(async () => ({ sources: { mhb_w: "https://example.test/a.mp4" } })) };
        const result = await fetchDmmPreviewIfEnabled("ABC-123", { getLocal: vi.fn(() => null), setLocal: vi.fn() }, movie, { id: "scope" }, { enableLoadPreviewVideo: "no" });
        expect(result).toEqual({ sources: null, error: null });
        expect(movie.preview).not.toHaveBeenCalled();
    });

    it("DMM sub switch ON still resolves through the movie service", async () => {
        const movie = { preview: vi.fn(async () => ({ sources: { mhb_w: "https://example.test/a.mp4" }, matchType: "single", pageUrl: "https://example.test" })) };
        const storage = { getLocal: vi.fn(() => null), setLocal: vi.fn() };
        vi.stubGlobal("clog", { debug: vi.fn(), warn: vi.fn(), error: vi.fn() });
        vi.stubGlobal("$", vi.fn(() => ({ attr: vi.fn().mockReturnThis(), css: vi.fn().mockReturnThis(), append: vi.fn().mockReturnThis() })));
        const result = await fetchDmmPreviewIfEnabled("ABC-123", storage, movie, { id: "scope" }, { enableLoadPreviewVideo: "yes" });
        expect(movie.preview).toHaveBeenCalledOnce();
        expect(result.sources).toEqual({ mhb_w: "https://example.test/a.mp4" });
        vi.unstubAllGlobals();
    });
});

describe("screenshot master switch policy", () => {
    function createService() {
        const service = new ScreenshotService({ getAvailable: vi.fn(async () => []) }, null);
        service.resolveIntegration = vi.fn(async () => [{ url: "https://img.javstore.net/x.jpg" }]);
        return service;
    }

    it("OFF: resolve returns null without touching any provider", async () => {
        const service = createService();
        const result = await service.resolve({ carNum: "ABC-123" }, { settings: { enableLoadScreenShot: "no" } });
        expect(result).toBeNull();
        expect(service.resolveIntegration).not.toHaveBeenCalled();
    });

    it("ON: resolve still works", async () => {
        const service = createService();
        const result = await service.resolve({ carNum: "ABC-123" }, { settings: { enableLoadScreenShot: "yes" } });
        expect(result).toEqual([{ url: "https://img.javstore.net/x.jpg" }]);
    });

    it("parses JSON-string screenshotProviders and drops disabled sources", () => {
        const service = new ScreenshotService(null, null);
        const providers = service.getEnabledProviders({
            screenshotProviders: JSON.stringify([
                { id: "javstore", enabled: true, priority: 5 },
                { id: "projectjav", enabled: true },
            ]),
        });
        expect(providers.map((item) => item.id)).toEqual([ "javstore", "projectjav" ]);
        expect(providers[0].priority).toBe(5);
        expect(service.getEnabledProviders({ screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) })).toEqual([]);
        expect(service.parseScreenshotProviders("not-json")).toEqual([]);
        expect(service.parseScreenshotProviders([{ id: "javstore" }])).toEqual([{ id: "javstore" }]);
    });
});
