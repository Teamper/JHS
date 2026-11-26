import { describe, expect, it, vi } from "vitest";
import { resolveImageSearch } from "../src/features/identity/image-search-controller.js";

describe("ImageSearchService", () => {
    it("uploads data images and returns normalized targets", async () => {
        const adapter = { upload: vi.fn(async () => "https://i.imgur.com/a.png"), createTargets: vi.fn(url => [{ id: "google", name: "Google", url, iconUrl: "icon" }]) };
        const integrations = { list: vi.fn(() => [{ id: "image-search" }]), getAdapter: vi.fn(() => adapter) };
        const scope = {};
        await expect(resolveImageSearch(integrations, "data:image/png;base64,YQ==", { scope })).resolves.toEqual({
            imageUrl: "https://i.imgur.com/a.png", targets: [{ id: "google", name: "Google", url: "https://i.imgur.com/a.png", iconUrl: "icon" }],
        });
        expect(adapter.upload).toHaveBeenCalledWith("data:image/png;base64,YQ==", { scope });
    });

    it("rejects non-http image URLs before creating targets", async () => {
        const adapter = { upload: vi.fn(), createTargets: vi.fn() };
        const integrations = { list: () => [{ id: "image-search" }], getAdapter: () => adapter };
        await expect(resolveImageSearch(integrations, "file:///private/image.png")).rejects.toMatchObject({ code: "INVALID_URL" });
        expect(adapter.createTargets).not.toHaveBeenCalled();
    });
});
