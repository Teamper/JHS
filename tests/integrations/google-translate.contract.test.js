import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createGoogleTranslateAdapter } from "../../src/integrations/google-translate/manifest.js";
import { parseGoogleTranslation } from "../../src/integrations/google-translate/parser.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/integrations/google-translate/translation.json"), "utf8"));

it("normalizes a translation response", () => {
    expect(parseGoogleTranslation(fixture)).toBe("翻译结果");
});

it("loads translations through the declared HTTP boundary", async () => {
    const request = vi.fn(async options => ({ data: fixture, finalUrl: options.url }));
    await expect(createGoogleTranslateAdapter({ request }).translate("原題")).resolves.toBe("翻译结果");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "google-translate", responseType: "json", cacheScope: "public" }), undefined);
});
