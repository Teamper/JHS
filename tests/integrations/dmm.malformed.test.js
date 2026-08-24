// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createDmmAdapter } from "../../src/integrations/dmm/manifest.js";
import { parseDmmPreview } from "../../src/integrations/dmm/parser.js";

it("rejects malformed DMM preview HTML", () => {
    expect(() => parseDmmPreview("<html></html>", "https://www.dmm.co.jp/")).toThrow(/missing/);
});

it("does not silently normalize an unavailable provider", async () => {
    const adapter = createDmmAdapter({ request: async () => { throw new Error("provider unavailable"); } });
    await expect(adapter.getPreview({ url: "https://www.dmm.co.jp/player/1" })).rejects.toThrow("provider unavailable");
});
