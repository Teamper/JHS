// @vitest-environment jsdom
import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseJavDbActorList } from "../../src/integrations/javdb/parser.js";
import { createJavDbAdapter } from "../../src/integrations/javdb/manifest.js";
import { JavDbHostAdapter } from "../../src/platform/hosts/javdb-host-adapter.js";

it("classifies malformed JavDB actor pages", () => {
    const dom = new JSDOM("<main></main>");
    expect(parseJavDbActorList(jquery(dom.window.document), "https://javdb.com").state).toBe("invalid");
});

it("rejects JavDB actor challenge pages", () => {
    expect(() => new JavDbHostAdapter().parseActorMovies("<title>Just a moment...</title>", "https://javdb.com")).toThrow(/challenge/);
});

it("rejects malformed JavDB API contracts", async () => {
    const adapter = createJavDbAdapter({ request: async () => ({ data: { data: {} } }) }, () => "signature");
    await expect(adapter.listReviews({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listRelated({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.getDetail({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listMagnets({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listRankings()).rejects.toThrow(/invalid/);
    const malformedTopAdapter = createJavDbAdapter({ request: async () => ({ data: { success: 1, data: {} } }) }, () => "signature");
    await expect(malformedTopAdapter.listTopRankings()).rejects.toThrow(/invalid/);
});

it("rejects malformed JavDB login responses", async () => {
    const adapter = createJavDbAdapter({ request: async () => ({ data: { success: 1, data: {} } }) }, () => "signature");
    await expect(adapter.login({ username: "user", password: "secret" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
