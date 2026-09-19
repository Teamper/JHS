import { expect, it } from "vitest";
import { createGfriendsAdapter, parseGfriendsCatalog } from "../../src/integrations/gfriends/manifest.js";

it("rejects malformed catalogs and unknown sources", async () => {
    expect(() => parseGfriendsCatalog({}, "https://cdn.example/")).toThrow(/缺少 Content/);
    const adapter = createGfriendsAdapter({ request: async () => ({ data: {} }) });
    await expect(adapter.searchAvatars(["Alice"], { sourceId: "unknown" })).rejects.toMatchObject({ code: "UNSUPPORTED" });
});
