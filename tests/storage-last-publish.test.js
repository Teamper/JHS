import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function createStorage(initial) {
    const emit = vi.fn(async () => {});
    const data = new Map(Object.entries(initial)), forage = {
        getItem: vi.fn(async key => data.get(key)), setItem: vi.fn(async (key, value) => data.set(key, value)), removeItem: vi.fn(async key => data.delete(key))
    };
    const context = vm.createContext({
        console, localforage: { INDEXEDDB: "indexeddb", createInstance: () => forage }, i: (target, key, value) => target[key] = value,
        clog: { log: vi.fn(), error: vi.fn(), debug: vi.fn() }, utils: { getNowStr: () => "2026-08-23 13:00:00" }, show: { error: vi.fn() },
        navigator: { locks: { request: async (key, callback) => callback() } }, window: { location: { origin: "https://javdb.com" }, jhsEventBus: { emit }, clean_cacheSettingObj() {}, cleanCache_filter_actor_actress_car_list() {} }, B: "actor", P: "actress",
        normalizeCarNum: value => String(value || "").trim().toUpperCase().replace(/[_\s]+/g, "-"), escapeHtml: value => String(value || ""), d: "filter",
        CURRENT_DATA_VERSION: 2, PORTABLE_DATA_KEYS: [], hasPortableUserData: async () => false, validatePortableData() {}, runDataMigrations: async () => {}, stateService: {}
    });
    const source = [ "../src/core/storage-index.js", "../src/core/storage.js" ].map(file => readFileSync(join(import.meta.dirname, file), "utf8")).join("\n");
    vm.runInContext(`${source};globalThis.Storage=StorageManager`, context);
    return { storage: new context.Storage, data, emit };
}

describe("last publication persistence", () => {
    it("legacy inbox removal preserves the actress publication date", async () => {
        const harness = createStorage({ favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "A-1" }] }] });
        await harness.storage.removeNewVideoList([ "A-1" ]);
        expect(harness.data.get("favorite_actresses")[0]).toMatchObject({ lastPublishTime: "2026-09-03", newVideoList: [] });
    });

    it("broadcasts one normalized new-video invalidation when blacklist persistence removes inbox items", async () => {
        const harness = createStorage({ blacklist_car_list: [], favorite_actresses: [{ starId: "a", newVideoList: [{ carNum: "abc_1" }, { carNum: "KEEP-1" }] }] });
        await harness.storage.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", names: "A", starId: "a", actionType: "filter" }]);
        expect(harness.emit).toHaveBeenCalledOnce();
        expect(harness.emit).toHaveBeenCalledWith("new-video-changed", { reason: "blacklist-car-removed", carNums: [ "ABC-1" ] });
        expect(harness.data.get("favorite_actresses")[0].newVideoList).toEqual([{ carNum: "KEEP-1" }]);
    });

    it("data-health repair removes handled inbox items without clearing publication dates", async () => {
        const harness = createStorage({ car_list: [{ carNum: "A-1" }], favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "A-1" }] }], blacklist: [], blacklist_car_list: [] });
        harness.storage.inspectDataHealth = vi.fn(async () => ({ issues: [] }));
        await harness.storage.repairDataHealth();
        expect(harness.data.get("favorite_actresses")[0]).toMatchObject({ lastPublishTime: "2026-09-03", newVideoList: [] });
    });
});
