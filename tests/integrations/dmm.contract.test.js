// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createDmmAdapter } from "../../src/integrations/dmm/manifest.js";
import { parseDmmPreview } from "../../src/integrations/dmm/parser.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/dmm/preview.html"), "utf8");

it("normalizes a DMM preview", () => {
    expect(parseDmmPreview(fixture, "https://www.dmm.co.jp/").url).toBe("https://www.dmm.co.jp/preview/sample.mp4");
});

it("loads previews through the declared HTTP boundary", async () => {
    const request = vi.fn(async options => ({ status: 200, data: fixture, finalUrl: options.url }));
    await expect(createDmmAdapter({ request }).getPreview({ url: "https://www.dmm.co.jp/player/1" })).resolves.toEqual({ url: "https://www.dmm.co.jp/preview/sample.mp4" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "dmm", cacheScope: "public", ttlMs: 604_800_000 }), undefined);
});
