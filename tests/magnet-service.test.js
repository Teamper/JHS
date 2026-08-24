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
});
