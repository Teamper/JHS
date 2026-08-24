// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createFc2ContentAdapter } from "../../src/integrations/fc2content/manifest.js";
import { parseFc2ContentImages } from "../../src/integrations/fc2content/parser.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/fc2content/images.html"), "utf8");
it("normalizes FC2 content sample images", () => expect(parseFc2ContentImages(fixture, "https://adult.contents.fc2.com/article/123/")).toHaveLength(2));
it("loads FC2 content images through HttpService", async () => {
    const request = vi.fn(async options => ({ data: fixture, finalUrl: options.url }));
    await expect(createFc2ContentAdapter({ request }).getImages({ carNum: "FC2-123" })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ providerId: "fc2content" })]));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "fc2content", cacheScope: "public" }), undefined);
});
