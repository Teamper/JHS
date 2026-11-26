// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createJavDbAdapter } from "../../src/integrations/javdb/manifest.js";
import { JavDbHostAdapter } from "../../src/platform/hosts/javdb-host-adapter.js";

it("classifies malformed JavDB actor pages", () => {
    expect(new JavDbHostAdapter().parseActorCollection("<main></main>", "https://javdb.com").state).toBe("invalid");
});

it("rejects JavDB actor challenge pages and classifies challenge/invalid actor searches", () => {
    const hostAdapter = new JavDbHostAdapter();
    expect(() => hostAdapter.parseActorMovies("<title>Just a moment...</title>", "https://javdb.com")).toThrow(/challenge/);
    expect(hostAdapter.parseActorSearch("<title>Just a moment...</title>", "https://javdb.com").state).toBe("challenge");
    expect(hostAdapter.parseActorSearch("<main></main>", "https://javdb.com").state).toBe("invalid");
});

it("rejects malformed JavDB API contracts", async () => {
    const adapter = createJavDbAdapter({ request: async () => ({ data: { data: {} } }) }, () => "signature");
    await expect(adapter.listReviews({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listRelated({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.getDetail({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listMagnets({ movieId: "m1" })).rejects.toThrow(/invalid/);
    await expect(adapter.listRankings()).rejects.toThrow(/invalid/);
});

it("rejects malformed JavDB login responses", async () => {
    const adapter = createJavDbAdapter({ request: async () => ({ data: { success: 1, data: {} } }) }, () => "signature");
    await expect(adapter.login({ username: "user", password: "secret" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
