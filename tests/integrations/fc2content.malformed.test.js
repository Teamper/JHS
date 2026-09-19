// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createFc2ContentAdapter } from "../../src/integrations/fc2content/manifest.js";
import { parseFc2ContentImages } from "../../src/integrations/fc2content/parser.js";

it("returns an empty normalized contract for missing images", () => expect(parseFc2ContentImages("<html></html>", "https://adult.contents.fc2.com/article/1/")).toEqual([]));
it("does not request invalid FC2 identifiers", async () => {
    let calls = 0;
    await expect(createFc2ContentAdapter({ request: async () => (++calls, {}) }).getImages({ carNum: "ABC-123" })).resolves.toEqual([]);
    expect(calls).toBe(0);
});
