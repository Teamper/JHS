// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDmmPreview } from "../src/plugins/image-viewer/preview-video.js";

afterEach(() => vi.unstubAllGlobals());

describe("DMM preview persistence boundary", () => {
    it("reads the legacy cache key through the declared StorageService", async () => {
        const sources = { mhb_w: "https://example.test/preview.mp4" }, storage = {
            getLocal: vi.fn((key) => key === "jhs_dmm_video" ? JSON.stringify({ "ABC-123": sources }) : null),
            setLocal: vi.fn(),
        };
        vi.stubGlobal("clog", { debug: vi.fn(), warn: vi.fn(), error: vi.fn() });
        await expect(fetchDmmPreview("ABC-123", storage)).resolves.toEqual({ sources, error: null });
        expect(storage.getLocal).toHaveBeenCalledWith("jhs_dmm_video");
        expect(storage.setLocal).not.toHaveBeenCalled();
    });
});
