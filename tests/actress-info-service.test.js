import { expect, it, vi } from "vitest";
import { CACHE_TTL } from "../src/core/cache-policy.js";
import { JhsError } from "../src/core/jhs-error.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ActressInfoService } from "../src/services/actress-info-service.js";
import { CacheService } from "../src/services/cache-service.js";

it("normalizes aliases, uses v2 cache prefix with 7d/24h TTLs, and caches actress information", async () => {
    const lookup = vi.fn(async name => ({ name, url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(name)}` }));
    const adapter = { lookup, profileUrl: name => `profile:${name}` };
    const integrations = { list: () => [{ id: "wikipedia" }], getAdapter: () => adapter };
    const cache = new CacheService();
    const setSpy = vi.spyOn(cache, "set");
    const service = new ActressInfoService(integrations, cache);

    await expect(service.lookup("三上悠亞")).resolves.toMatchObject({ name: "三上悠亜" });
    await expect(service.lookup("三上悠亞")).resolves.toMatchObject({ name: "三上悠亜" });
    expect(lookup).toHaveBeenCalledOnce();
    expect(setSpy).toHaveBeenCalledWith("actress-info", "actress-info:v2:三上悠亜", expect.any(Object), expect.objectContaining({
        scope: "public",
        ttlMs: CACHE_TTL.actressInfo,
        negative: false,
    }));
    expect(service.profileUrl("A")).toBe("profile:A");
});

it("caches normal misses and NOT_FOUND errors for 24h while propagating abort and network errors", async () => {
    const lookup = vi.fn(async () => null);
    const cache = new CacheService();
    const setSpy = vi.spyOn(cache, "set");
    const service = new ActressInfoService({ list: () => [{ id: "wikipedia" }], getAdapter: () => ({ lookup, profileUrl: () => "" }) }, cache);
    await expect(service.lookup("Missing")).resolves.toBeNull();
    await expect(service.lookup("Missing")).resolves.toBeNull();
    expect(lookup).toHaveBeenCalledOnce();
    expect(setSpy).toHaveBeenCalledWith("actress-info", "actress-info:v2:Missing", null, expect.objectContaining({
        scope: "public",
        ttlMs: CACHE_TTL.actressInfoNegative,
        negative: true,
    }));

    const notFoundLookup = vi.fn(async () => { throw new JhsError("NOT_FOUND", "404", { details: { status: 404 } }); });
    const notFoundService = new ActressInfoService({ list: () => [{ id: "wikipedia" }], getAdapter: () => ({ lookup: notFoundLookup, profileUrl: () => "" }) }, new CacheService());
    await expect(notFoundService.lookup("Gone")).resolves.toBeNull();
    await expect(notFoundService.lookup("Gone")).resolves.toBeNull();
    expect(notFoundLookup).toHaveBeenCalledOnce();

    const failing = vi.fn(async () => { throw new Error("network"); });
    const failingService = new ActressInfoService({ list: () => [{ id: "wikipedia" }], getAdapter: () => ({ lookup: failing, profileUrl: () => "" }) }, new CacheService());
    await expect(failingService.lookup("Error")).rejects.toThrow("network");

    const aborted = vi.fn(async () => { throw new JhsError("ABORTED", "aborted"); });
    const abortService = new ActressInfoService({ list: () => [{ id: "wikipedia" }], getAdapter: () => ({ lookup: aborted, profileUrl: () => "" }) }, new CacheService());
    await expect(abortService.lookup("AbortMe")).rejects.toMatchObject({ code: "ABORTED" });
});

it("lookupAny deduplicates names in order, returns first hit, ignores NOT_FOUND, and short-circuits on abort or transient block", async () => {
    const called = [];
    const lookup = vi.fn(async (name) => {
        called.push(name);
        if (name === "三上悠亜") return null;
        if (name === "鬼頭桃菜") return { birthday: "1993年8月16日", url: "https://ja.wikipedia.org/wiki/Kito" };
        return null;
    });
    const service = new ActressInfoService({ list: () => [{ id: "wikipedia" }], getAdapter: () => ({ lookup }) }, new CacheService());
    await expect(service.lookupAny(["三上悠亞 (無碼)", "三上悠亜", "鬼頭桃菜[1]", "备用名"])).resolves.toEqual({
        info: { birthday: "1993年8月16日", url: "https://ja.wikipedia.org/wiki/Kito" },
        matchedName: "鬼頭桃菜",
    });
    expect(called).toEqual(["三上悠亜", "鬼頭桃菜"]);

    const blockCalls = [];
    const blockService = new ActressInfoService({
        list: () => [{ id: "wikipedia" }],
        getAdapter: () => ({
            lookup: vi.fn(async (name) => {
                blockCalls.push(name);
                throw new JhsError("RATE_LIMITED", "429", { retryable: true });
            }),
        }),
    }, new CacheService());
    await expect(blockService.lookupAny(["First", "Second"])).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(blockCalls).toEqual(["First"]);

    const scope = new LifecycleScope("lookup-any-abort");
    scope.dispose();
    await expect(service.lookupAny(["Unreached"], { scope })).rejects.toMatchObject({ code: "ABORTED" });

    const notFoundService = new ActressInfoService({ list: () => [{ id: "wikipedia" }], getAdapter: () => ({ lookup: vi.fn(async () => null) }) }, new CacheService());
    await expect(notFoundService.lookupAny(["One", "Two"])).resolves.toBeNull();
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
