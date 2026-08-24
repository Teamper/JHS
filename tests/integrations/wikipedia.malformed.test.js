// @vitest-environment jsdom
import { expect, it } from "vitest";
import { parseWikipediaActressInfo } from "../../src/integrations/wikipedia/parser.js";

it("rejects malformed Wikipedia pages", () => {
    expect(() => parseWikipediaActressInfo("<html><body>missing</body></html>", "https://ja.wikipedia.org/wiki/test")).toThrow("information is missing");
});
