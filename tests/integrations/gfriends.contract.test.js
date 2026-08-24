import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createGfriendsAdapter, parseGfriendsCatalog } from "../../src/integrations/gfriends/manifest.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/integrations/gfriends/catalog.json"), "utf8"));

it("normalizes the Gfriends catalog into actor avatar URLs", async () => {
    const index = parseGfriendsCatalog(fixture, "https://cdn.example/Content/");
    expect(index.get("alice")).toEqual(["https://cdn.example/Content/%E5%A5%B3%E4%BC%98/alice%2Favatar%2001.jpg?raw=1"]);
    const request = vi.fn(async () => ({ data: fixture })), adapter = createGfriendsAdapter({ request });
    await expect(adapter.searchAvatars(["Alice"], { sourceId: "jsdelivr", scope: "scope" })).resolves.toEqual([
        "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/%E5%A5%B3%E4%BC%98/alice%2Favatar%2001.jpg?raw=1",
    ]);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "gfriends:jsdelivr", cacheScope: "public", urlPolicy: { trustClass: "builtin-public", hosts: ["cdn.jsdelivr.net"] } }), "scope");
});
