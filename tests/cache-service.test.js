import { afterEach, describe, expect, it, vi } from "vitest";
import { CacheService, THIRD_PARTY_CACHE_KEY } from "../src/services/cache-service.js";

function backend() {
    const data = new Map();
    return {
        data,
        get: vi.fn(async key => data.get(key)),
        set: vi.fn(async (key, value) => data.set(key, value)),
        remove: vi.fn(async key => data.delete(key)),
        keys: vi.fn(async () => [ ...data.keys() ]),
        commitAtomicBatch: vi.fn(async ({ expected, deletes }) => {
            for (const [key, entry] of Object.entries(expected)) {
                if (data.get(key) !== entry.value) throw new Error("replaced");
            }
            for (const key of deletes) data.delete(key);
        }),
    };
}

afterEach(() => vi.useRealTimers());

describe("CacheService L1/L2 cache", () => {
    it("serializes invalidation of existing third-party entries and preserves other cached data", async () => {
        const storage = backend(), cache = new CacheService({ storage });
        const keep = { time: 10, ttl: 1000, data: "keep" };
        storage.data.set(THIRD_PARTY_CACHE_KEY, { a: { time: 1 }, b: { time: 2 }, keep });
        storage.data.set("setting", { themeMode: "dark" });

        await Promise.all([cache.deleteThirdPartyCacheEntry("a"), cache.deleteThirdPartyCacheEntry("b")]);
        expect(await cache.getThirdPartyCache()).toEqual({ keep });
        await cache.clearThirdPartyCache();
        expect(storage.data.has(THIRD_PARTY_CACHE_KEY)).toBe(false);
        expect(storage.data.get("setting")).toEqual({ themeMode: "dark" });
    });

    it("reuses public entries across instances through the storage layer", async () => {
        const storage = backend(), first = new CacheService({ storage }), second = new CacheService({ storage });
        await first.set("provider:key", { status: 200 }, { scope: "public", ttlMs: 60_000 });
        expect((await second.get("provider:key", { scope: "public" })).value).toEqual({ status: 200 });
        expect(second.publicCache.size).toBe(1);
    });

    it("expires public entries and removes their persisted representation", async () => {
        vi.useFakeTimers();
        const storage = backend(), cache = new CacheService({ storage });
        await cache.set("expiring", "value", { scope: "public", ttlMs: 1_000 });
        vi.advanceTimersByTime(1_001);
        await expect(cache.get("expiring", { scope: "public" })).resolves.toMatchObject({ hit: false });
        expect([ ...storage.data.keys() ]).toHaveLength(0);
    });

    it("never persists session entries", async () => {
        const storage = backend(), first = new CacheService({ storage }), second = new CacheService({ storage });
        await first.set("auth", "secret", { scope: "session", sessionScopeId: "tab-1", ttlMs: 60_000 });
        await expect(second.get("auth", { scope: "session", sessionScopeId: "tab-1" })).resolves.toMatchObject({ hit: false });
        expect(storage.set).not.toHaveBeenCalled();
    });

    it("clearPublic forces the next request to miss both L1 and L2", async () => {
        const storage = backend(), first = new CacheService({ storage }), second = new CacheService({ storage });
        await first.set("network", "old", { scope: "public", ttlMs: 60_000 });
        await first.clearPublic();
        expect((await second.get("network", { scope: "public" })).hit).toBe(false);
        expect(first.publicCache.size).toBe(0);
    });

    it("does not let an in-flight read repopulate after clearPublic", async () => {
        let resolveRead;
        const persisted = { version: 1, value: "stale", expiresAt: Date.now() + 60_000, negative: false, lastUsed: Date.now() };
        const storage = backend();
        storage.get.mockImplementationOnce(() => new Promise(resolve => { resolveRead = () => resolve(persisted); }));
        const cache = new CacheService({ storage });
        const pending = cache.get("race", { scope: "public" });
        await vi.waitFor(() => expect(storage.get).toHaveBeenCalledOnce());
        await cache.clearPublic();
        resolveRead();
        await expect(pending).resolves.toMatchObject({ hit: false });
        expect(cache.publicCache.size).toBe(0);
    });

    it("defers persistent pruning and performs one bounded scan per maintenance batch", async () => {
        const storage = backend(), cache = new CacheService({ storage });
        for (let index = 0; index < 128; index += 1) await cache.set(`key-${index}`, index, { scope: "public", ttlMs: 60_000 });
        await cache.waitForPrune();
        expect(storage.keys.mock.calls.length).toBeLessThanOrEqual(2);
        expect(storage.get.mock.calls.length).toBeLessThanOrEqual(256);
    });

    it("keeps a persisted entry refreshed by another tab instead of pruning it", async () => {
        vi.useFakeTimers();
        const storage = backend(), stale = new CacheService({ storage }), fresh = new CacheService({ storage });
        await stale.set("shared", "old", { scope: "public", ttlMs: 1_000 });
        vi.advanceTimersByTime(500);
        await fresh.set("shared", "new", { scope: "public", ttlMs: 60_000 });
        vi.advanceTimersByTime(600);
        await stale.prunePublic();
        expect(storage.data.size).toBe(1);
        await expect(fresh.get("shared", { scope: "public" })).resolves.toMatchObject({ value: "new" });
    });

    it.each(["prune", "read"])("retains a write that replaces an expired entry just before %s cleanup commits", async (mode) => {
        vi.useFakeTimers();
        const storage = backend(), cleaning = new CacheService({ storage }), writing = new CacheService({ storage });
        await cleaning.set("shared", "old", { scope: "public", ttlMs: 1_000 });
        vi.advanceTimersByTime(2_000);
        const commit = storage.commitAtomicBatch.getMockImplementation();
        storage.commitAtomicBatch.mockImplementationOnce(async batch => {
            await writing.set("shared", "new", { scope: "public", ttlMs: 60_000 });
            return commit(batch);
        });
        if (mode === "prune") await cleaning.prunePublic();
        else await cleaning.get("shared", { scope: "public" });
        const reader = new CacheService({ storage });
        await expect(reader.get("shared", { scope: "public" })).resolves.toMatchObject({ value: "new" });
    });

    it("tries the next eviction candidate if the first one is refreshed", async () => {
        vi.useFakeTimers();
        const storage = backend(), cache = new CacheService({ storage }), writing = new CacheService({ storage });
        await cache.set("oldest", "before", { scope: "public", ttlMs: 60_000 });
        vi.advanceTimersByTime(100);
        for (let index = 0; index < 500; index++) {
            storage.data.set(cache.publicPrefix + "test-" + index, { version: 2, expiresAt: Date.now() + 60_000, lastUsed: Date.now(), value: index });
        }
        const commit = storage.commitAtomicBatch.getMockImplementation();
        storage.commitAtomicBatch.mockImplementationOnce(async batch => {
            await writing.set("oldest", "after", { scope: "public", ttlMs: 60_000 });
            return commit(batch);
        });
        await cache.prunePublic();
        expect(storage.data.size).toBe(500);
        await expect(new CacheService({ storage }).get("oldest", { scope: "public" })).resolves.toMatchObject({ value: "after" });
    });

    it("does not persist a response with an obsolete public generation", async () => {
        const storage = backend(), cache = new CacheService({ storage }), generation = cache.publicGeneration;
        await cache.clearPublic();
        await cache.set("race", "stale", { scope: "public", ttlMs: 60_000, generation });
        expect(storage.set).not.toHaveBeenCalled();
        expect(cache.publicCache.size).toBe(0);
    });

    it("isolates namespaces and clears only the selected persisted namespace", async () => {
        const storage = backend(), cache = new CacheService({ storage });
        await cache.set("actress-info", "same-key", "actress", { scope: "public", ttlMs: 60_000 });
        await cache.set("screenshot", "same-key", "shot", { scope: "public", ttlMs: 60_000 });
        expect((await cache.get("actress-info", "same-key", { scope: "public" })).value).toBe("actress");
        expect((await cache.get("screenshot", "same-key", { scope: "public" })).value).toBe("shot");
        await cache.clearNamespace("actress-info");
        expect((await cache.get("actress-info", "same-key", { scope: "public" })).hit).toBe(false);
        expect((await cache.get("screenshot", "same-key", { scope: "public" })).value).toBe("shot");
        expect([...storage.data.keys()].some((key) => key.includes(":actress-info:") || key.includes(":screenshot:"))).toBe(true);
    });
});
