import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseJavDbActorList } from "../../src/integrations/javdb/parser.js";
import { createJavDbAdapter } from "../../src/integrations/javdb/manifest.js";

it("classifies malformed JavDB actor pages", () => {
    const dom = new JSDOM("<main></main>");
    expect(parseJavDbActorList(jquery(dom.window)(dom.window.document), "https://javdb.com").state).toBe("invalid");
});

it("rejects malformed JavDB API contracts", async () => {
    const adapter = createJavDbAdapter({ request: async () => ({ data: { data: {} } }) }, () => "signature");
    await expect(adapter.listReviews({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listRelated({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.getDetail({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listMagnets({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listRankings()).rejects.toThrow(/invalid/);
});
