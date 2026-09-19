// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createDmmAdapter } from "../../src/integrations/dmm/manifest.js";
import { parseDmmItemCandidates, parseDmmPlayerSources, parseDmmPreview } from "../../src/integrations/dmm/parser.js";

it("rejects malformed DMM preview HTML", () => {
    expect(() => parseDmmPreview("<html></html>", "https://www.dmm.co.jp/")).toThrow(/missing/);
});

it("rejects malformed API and player responses", () => {
    expect(() => parseDmmItemCandidates({ result: {} }, "ABC-123", "ABC-123")).toThrow(/结构无效/);
    expect(() => parseDmmPlayerSources("<html></html>", "https://www.dmm.co.jp/player/1")).toThrow(/const args/);
});

it("preserves region-blocked errors across candidate fallback", async () => {
    const request = async options => {
        if (options.url.includes("affiliate/v3")) return {
            status: 200, data: { result: { result_count: 1, items: [{ content_id: "abc00123", maker_product: "ABC-123", service_code: "digital", floor_code: "videoa", URL: "https://www.dmm.co.jp/item/1" }] } }, finalUrl: options.url,
        };
        return { status: 200, data: "このサービスはお住まいの地域からは", finalUrl: options.url };
    };
    await expect(createDmmAdapter({ request }).getPreviewForMovie({ carNum: "ABC-123" })).rejects.toMatchObject({ code: "REGION_BLOCKED" });
});

it("does not silently normalize an unavailable provider", async () => {
    const request = vi.fn(async () => { throw new Error("provider unavailable"); });
    const adapter = createDmmAdapter({ request });
    await expect(adapter.getPreview({ url: "https://www.dmm.co.jp/player/1" })).rejects.toThrow("provider unavailable");
    await expect(adapter.getPreviewForMovie({ carNum: "ABC-123" })).rejects.toThrow("provider unavailable");
    expect(request).toHaveBeenCalledTimes(2);
});
