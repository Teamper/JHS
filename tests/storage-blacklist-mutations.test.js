import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";

function createCoordinator() {
    let tail = Promise.resolve(), entries = 0, active = 0;
    return {
        get entries() { return entries; },
        get active() { return active; },
        runExclusive(operation) {
            const run = tail.then(async () => {
                entries++, active++;
                try { return await operation(); }
                finally { active--; }
            });
            tail = run.then(() => undefined, () => undefined);
            return run;
        },
    };
}

function createStorage({ failAfterPersist = false } = {}) {
    const data = new Map([
        ["blacklist", [{ starId: "actor-1", name: "Actor" }, { starId: "actor-2", name: "Other" }]],
        ["blacklist_car_list", [{ starId: "actor-1", carNum: "ABC-1" }, { starId: "actor-2", carNum: "DEF-2" }]],
    ]);
    const writes = [], coordinator = createCoordinator();
    let failed = false;
    const forage = {
        getItem: vi.fn(async key => data.get(key) ?? null),
        setItem: vi.fn(async (key, value) => {
            writes.push({ key, lockDepth: coordinator.active });
            data.set(key, structuredClone(value));
            if (!failed && key === "blacklist" && failAfterPersist) {
                failed = true;
                throw new Error("injected blacklist write failure");
            }
        }),
        removeItem: vi.fn(async key => data.delete(key)),
    };
    const storage = Object.create(StorageManager.prototype);
    Object.assign(storage, {
        car_list_key: "car_list", blacklist_key: "blacklist", blacklist_car_list_key: "blacklist_car_list",
        favorite_actresses_key: "favorite_actresses", filter_keyword_title_key: "filter_keyword_title",
        setting_key: "setting", mutationCoordinator: coordinator, forage,
        cacheCarList: null, cacheBlacklist: null, cacheFavoriteActresses: null,
        cacheTitleFilterKeyword: null, cache_filter_actor_actress_car_list: null, cacheSettingObj: null,
        cacheCarMap: null, cacheStatusMap: null, cacheBlacklistMap: null,
        _pendingReads: new Map(), _cacheGenerations: new Map(), _cacheStats: { hits: 0, misses: 0 },
    });
    return { storage, data, coordinator, writes };
}

describe("blacklist actor mutation coordination", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("removes the actor and all blocked cards in one shared write window", async () => {
        const harness = createStorage(), cleanCache = vi.fn(async () => {});
        vi.stubGlobal("window", { cleanCache_filter_actor_actress_car_list: cleanCache });
        vi.stubGlobal("clog", { warn: vi.fn() });

        await expect(harness.storage.removeBlacklistActor("actor-1")).resolves.toEqual({ removedActor: true, removedCarRecords: 1 });

        expect(harness.coordinator.entries).toBe(1);
        expect(harness.writes).toEqual([
            { key: "blacklist_car_list", lockDepth: 1 },
            { key: "blacklist", lockDepth: 1 },
        ]);
        expect(harness.data.get("blacklist")).toEqual([{ starId: "actor-2", name: "Other" }]);
        expect(harness.data.get("blacklist_car_list")).toEqual([{ starId: "actor-2", carNum: "DEF-2" }]);
        expect(cleanCache).toHaveBeenCalledOnce();
    });

    it("restores the blocked-card list when removing the actor record fails after writing", async () => {
        const harness = createStorage({ failAfterPersist: true });
        vi.stubGlobal("window", { cleanCache_filter_actor_actress_car_list: vi.fn() });
        vi.stubGlobal("clog", { warn: vi.fn() });
        const before = Object.fromEntries(harness.data);

        await expect(harness.storage.removeBlacklistActor("actor-1")).rejects.toThrow("injected blacklist write failure");

        expect(Object.fromEntries(harness.data)).toEqual(before);
        expect(harness.coordinator.entries).toBe(1);
        expect(harness.writes.every(write => write.lockDepth === 1)).toBe(true);
    });

    it("keeps a completed actor deletion successful when cache cleanup and warning both fail", async () => {
        const harness = createStorage();
        vi.stubGlobal("window", { cleanCache_filter_actor_actress_car_list: vi.fn(async () => { throw new Error("cache failed"); }) });
        vi.stubGlobal("clog", { warn: vi.fn(() => { throw new Error("logger failed"); }) });

        await expect(harness.storage.removeBlacklistActor("actor-1")).resolves.toEqual({ removedActor: true, removedCarRecords: 1 });
        expect(harness.data.get("blacklist")).toEqual([{ starId: "actor-2", name: "Other" }]);
        expect(harness.data.get("blacklist_car_list")).toEqual([{ starId: "actor-2", carNum: "DEF-2" }]);
    });

    it("keeps a completed blocked-card deletion successful when cache cleanup and warning both fail", async () => {
        const harness = createStorage();
        vi.stubGlobal("window", { cleanCache_filter_actor_actress_car_list: vi.fn(async () => { throw new Error("cache failed"); }) });
        vi.stubGlobal("clog", { warn: vi.fn(() => { throw new Error("logger failed"); }) });

        await expect(harness.storage.removeBlacklistCarList("actor-1")).resolves.toBeUndefined();
        expect(harness.data.get("blacklist_car_list")).toEqual([{ starId: "actor-2", carNum: "DEF-2" }]);
    });

    it("keeps a completed batch screen successful when its UI and diagnostics fail", async () => {
        const harness = createStorage();
        vi.stubGlobal("window", { location: { origin: "https://javdb.com" }, cleanCache_filter_actor_actress_car_list: vi.fn(async () => { throw new Error("cache failed"); }) });
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-29 00:00:00" });
        vi.stubGlobal("clog", { html: vi.fn(() => { throw new Error("UI failed"); }), warn: vi.fn(() => { throw new Error("logger failed"); }) });

        await expect(harness.storage.batchSaveBlacklistCarList([{ starId: "actor-3", carNum: "GHI-3", url: "https://javdb.com/v/ghi-3", names: "Synthetic", actionType: "filter" }])).resolves.toEqual({ changed: ["GHI-3"] });
        expect(harness.data.get("blacklist_car_list").find((item) => item.carNum === "GHI-3")).toMatchObject({ starId: "actor-3", url: "https://javdb.com/v/ghi-3", names: "Synthetic", status: "filter" });
    });
});
