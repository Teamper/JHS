import { describe, expect, it, vi } from "vitest";
import { ImageSearchService } from "../src/services/image-search-service.js";

describe("ImageSearchService", () => {
    it("uploads data images and returns normalized targets", async () => {
        const adapter = { upload: vi.fn(async () => "https://i.imgur.com/a.png"), createTargets: vi.fn(url => [{ id: "google", name: "Google", url, iconUrl: "icon" }]) };
        const integrations = { list: vi.fn(() => [{ id: "image-search" }]), getAdapter: vi.fn(() => adapter) };
        const service = new ImageSearchService(integrations), scope = {};
        await expect(service.resolve("data:image/png;base64,YQ==", { scope })).resolves.toEqual({
            imageUrl: "https://i.imgur.com/a.png", targets: [{ id: "google", name: "Google", url: "https://i.imgur.com/a.png", iconUrl: "icon" }],
        });
        expect(adapter.upload).toHaveBeenCalledWith("data:image/png;base64,YQ==", { scope });
    });

    it("rejects non-http image URLs before creating targets", async () => {
        const adapter = { upload: vi.fn(), createTargets: vi.fn() };
        const service = new ImageSearchService({ list: () => [{ id: "image-search" }], getAdapter: () => adapter });
        await expect(service.resolve("file:///private/image.png")).rejects.toMatchObject({ code: "INVALID_URL" });
        expect(adapter.createTargets).not.toHaveBeenCalled();
    });
});
