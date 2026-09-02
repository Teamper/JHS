import { afterEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "../src/services/cache-service.js";

function backend() {
    const data = new Map();
    return {
        data,
        get: vi.fn(async key => data.get(key)),
        set: vi.fn(async (key, value) => data.set(key, value)),
        remove: vi.fn(async key => data.delete(key)),
        keys: vi.fn(async () => [ ...data.keys() ]),
    };
}

afterEach(() => vi.useRealTimers());

describe("CacheService L1/L2 cache", () => {
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
