// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createDmmAdapter } from "../../src/integrations/dmm/manifest.js";
import { parseDmmItemCandidates, parseDmmPlayerSources, parseDmmPreview } from "../../src/integrations/dmm/parser.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/dmm/preview.html"), "utf8");

it("normalizes a DMM preview", () => {
    expect(parseDmmPreview(fixture, "https://www.dmm.co.jp/").url).toBe("https://www.dmm.co.jp/preview/sample.mp4");
});

it("loads previews through the declared HTTP boundary", async () => {
    const request = vi.fn(async options => ({ status: 200, data: fixture, finalUrl: options.url }));
    await expect(createDmmAdapter({ request }).getPreview({ url: "https://www.dmm.co.jp/player/1" })).resolves.toEqual({ url: "https://www.dmm.co.jp/preview/sample.mp4" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "dmm" }), undefined);
});

it("normalizes API candidates and player quality sources", () => {
    const candidates = parseDmmItemCandidates({ result: { result_count: 1, items: [{
        content_id: "abc00123", maker_product: "ABC-123", service_code: "digital", floor_code: "videoa", URL: "https://www.dmm.co.jp/item/1",
    }] } }, "ABC-123", "ABC-123");
    expect(candidates).toHaveLength(1);
    expect(parseDmmPlayerSources('const args = {"bitrates":[{"src":"https://cdn.example/video/hhb.mp4"}]};', "https://www.dmm.co.jp/player/1")).toEqual({ hhb: "https://cdn.example/video/hhb.mp4" });
});

it("resolves a movie preview without exposing DMM requests to the feature", async () => {
    const request = vi.fn(async options => {
        if (options.url.includes("affiliate/v3")) return {
            status: 200, data: { result: { result_count: 1, items: [{ content_id: "abc00123", maker_product: "ABC-123", service_code: "digital", floor_code: "videoa", URL: "https://www.dmm.co.jp/item/1" }] } }, finalUrl: options.url,
        };
        return { status: 200, data: 'const args = {"bitrates":[{"src":"https://cdn.example/video/hhb.mp4"}]};', finalUrl: options.url };
    });
    const result = await createDmmAdapter({ request }).getPreviewForMovie({ carNum: "ABC-123" });
    expect(result).toMatchObject({ sources: { hhb: "https://cdn.example/video/hhb.mp4" }, matchType: "single", pageUrl: "https://www.dmm.co.jp/item/1" });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ headers: expect.objectContaining({ Cookie: "age_check_done=1" }) }), undefined);
});
