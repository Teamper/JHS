import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListActressNameService } from "../src/features/list/list-actress-name-service.js";

afterEach(() => vi.unstubAllGlobals());

describe("ListActressNameService", () => {
    it("parses JavDB actress names from the detail-page response", async () => {
        const dom = new JSDOM("", { url: "https://javdb.com/search" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("DOMParser", dom.window.DOMParser);
        const request = vi.fn(async () => ({ data: "<a>Actress A</a><span class=\"female\">女</span><a>Actress B</a><span class=\"female\">女</span>" }));
        const service = new ListActressNameService({ scope: new LifecycleScope("feature:list"), settings: { snapshot: () => ({ enableSaveActressCarInfo: "yes" }) }, http: { request }, site: "javdb" });

        await expect(service.parse("/v/ABC-123")).resolves.toBe("Actress A Actress B");
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://javdb.com/v/ABC-123", providerId: "host-page" }), expect.anything());
        service.dispose();
    });

    it("uses JavBus actress links and skips requests when disabled", async () => {
        const dom = new JSDOM("", { url: "https://javbus.com/ABC-123" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("DOMParser", dom.window.DOMParser);
        const request = vi.fn(async () => ({ data: '<span onmouseover="star_1"><a>Actress A</a></span>' }));
        const settings = { snapshot: () => ({ enableSaveActressCarInfo: "no" }) };
        const service = new ListActressNameService({ scope: new LifecycleScope("feature:list"), settings, http: { request }, site: "javbus" });

        await expect(service.parse("/ABC-123")).resolves.toBeNull();
        expect(request).not.toHaveBeenCalled();
        settings.snapshot = () => ({ enableSaveActressCarInfo: "yes" });
        await expect(service.parse("/ABC-123")).resolves.toBe("Actress A");
        service.dispose();
    });
});
