// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createFc2PpvDbAdapter } from "../../src/integrations/fc2ppvdb/manifest.js";
import { parseFc2PpvDbDetail } from "../../src/integrations/fc2ppvdb/parser.js";

it("rejects malformed FC2PPVDB HTML", () => {
    expect(() => parseFc2PpvDbDetail("<html></html>", "https://fc2ppvdb.com/articles/12345")).toThrow(/malformed/);
});

it("rejects invalid identifiers before issuing a request", async () => {
    const adapter = createFc2PpvDbAdapter({ request: async () => { throw new Error("must not request"); } });
    await expect(adapter.getDetail({ carNum: "invalid" })).rejects.toThrow(/identifier/);
});
