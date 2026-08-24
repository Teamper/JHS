import { expect, it, vi } from "vitest";
import { ActressInfoService } from "../src/services/actress-info-service.js";
import { CacheService } from "../src/services/cache-service.js";

it("normalizes aliases and caches actress information", async () => {
    const lookup = vi.fn(async name => ({ name }));
    const adapter = { lookup, profileUrl: name => `profile:${name}` };
    const integrations = { list: () => [{ id: "wikipedia" }], getAdapter: () => adapter };
    const service = new ActressInfoService(integrations, new CacheService());
    await expect(service.lookup("三上悠亞")).resolves.toEqual({ name: "三上悠亜" });
    await expect(service.lookup("三上悠亞")).resolves.toEqual({ name: "三上悠亜" });
    expect(lookup).toHaveBeenCalledOnce();
    expect(service.profileUrl("A")).toBe("profile:A");
});

it("routes avatar source lookup and placeholders through declared Integrations", async () => {
    const searchAvatars = vi.fn(async () => ["avatar:a"]), adapters = {
        gfriends: { getSources: () => [{ id: "jsdelivr" }], searchAvatars },
        javdb: { actorPlaceholderUrl: () => "avatar:placeholder" },
    };
    const integrations = { list: capability => capability === "person.avatar-search" ? [{ id: "gfriends" }] : [], getAdapter: id => adapters[id] };
    const service = new ActressInfoService(integrations, new CacheService());
    expect(service.getAvatarSources()).toEqual([{ id: "jsdelivr" }]);
    await expect(service.searchAvatars(["Alice"], "jsdelivr", { scope: "scope" })).resolves.toEqual(["avatar:a"]);
    expect(searchAvatars).toHaveBeenCalledWith(["Alice"], { sourceId: "jsdelivr", scope: "scope" });
    expect(service.placeholderUrl("javdb")).toBe("avatar:placeholder");
});
