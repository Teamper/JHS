// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createWikipediaAdapter } from "../../src/integrations/wikipedia/manifest.js";
import { parseWikipediaActressInfo } from "../../src/integrations/wikipedia/parser.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/wikipedia/actress.html"), "utf8");

it("normalizes Wikipedia actress information", () => {
    expect(parseWikipediaActressInfo(fixture, "https://ja.wikipedia.org/wiki/test")).toEqual({
        birthday: "1993年8月16日", age: "33岁", height: "159cm", weight: "48 kg",
        threeSizeText: "83 - 59 - 88", braSize: "E", url: "https://ja.wikipedia.org/wiki/test",
    });
});

it("loads Wikipedia through the declared HTTP boundary", async () => {
    const request = vi.fn(async options => ({ data: fixture, finalUrl: options.url }));
    await expect(createWikipediaAdapter({ request }).lookup("三上悠亜")).resolves.toEqual(expect.objectContaining({ age: "33岁" }));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "wikipedia", cacheScope: "public" }), undefined);
});
