import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function createStorage(initial, { failAfterPersistKey = null, failEvent = false } = {}) {
    const emit = vi.fn(async () => { if (failEvent) throw new Error("event channel closed"); });
    const clog = { log: vi.fn(), html: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    const cleanCache = vi.fn(async () => {});
    let failed = false;
    const data = new Map(Object.entries(initial)), forage = {
        getItem: vi.fn(async key => data.get(key)), setItem: vi.fn(async (key, value) => {
            data.set(key, value);
            if (!failed && key === failAfterPersistKey) {
                failed = true;
                throw new Error(`injected ${key} failure after persistence`);
            }
        }), removeItem: vi.fn(async key => data.delete(key))
    };
    const context = vm.createContext({
        console, localforage: { INDEXEDDB: "indexeddb", createInstance: () => forage }, i: (target, key, value) => target[key] = value,
        clog, utils: { getNowStr: () => "2026-08-23 13:00:00" }, show: { error: vi.fn() },
        navigator: { locks: { request: async (key, callback) => callback() } }, window: { location: { origin: "https://javdb.com" }, jhsEventBus: { emit }, clean_cacheSettingObj() {}, cleanCache_filter_actor_actress_car_list: cleanCache }, B: "actor", P: "actress",
        normalizeCarNum: value => String(value || "").trim().toUpperCase().replace(/[_\s]+/g, "-"), escapeHtml: value => String(value || ""), d: "filter",
        CURRENT_DATA_VERSION: 2, PORTABLE_DATA_KEYS: [], hasPortableUserData: async () => false, validatePortableData() {}, runDataMigrations: async () => {}, stateService: {}
    });
    const source = [ "../src/core/storage-index.js", "../src/core/storage.js" ].map(file => readTestFile(join(import.meta.dirname, file), "utf8")).join("\n");
    vm.runInContext(`${source};globalThis.Storage=StorageManager`, context);
    return { storage: new context.Storage, data, emit, clog, cleanCache };
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

    it("restores both blacklist and new-video records when the second persisted write fails", async () => {
        const before = {
            blacklist_car_list: [],
            favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "ABC-1" }] }]
        };
        const harness = createStorage(before, { failAfterPersistKey: "favorite_actresses" });

        await expect(harness.storage.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", names: "A", starId: "a", actionType: "filter" }]))
            .rejects.toThrow("injected favorite_actresses failure after persistence");

        expect(harness.data.get("blacklist_car_list")).toEqual(before.blacklist_car_list);
        expect(harness.data.get("favorite_actresses")).toEqual(before.favorite_actresses);
        expect(harness.emit).not.toHaveBeenCalled();
    });

    it("keeps a durable blacklist update successful when its cross-tab notification fails", async () => {
        const harness = createStorage({ blacklist_car_list: [], favorite_actresses: [{ starId: "a", newVideoList: [{ carNum: "ABC-1" }] }] }, { failEvent: true });
        const result = await harness.storage.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", names: "A", starId: "a", actionType: "filter" }]);

        expect(result).toEqual({ changed: [ "ABC-1" ] });
        expect(harness.data.get("blacklist_car_list")).toHaveLength(1);
        expect(harness.data.get("favorite_actresses")[0].newVideoList).toEqual([]);
        expect(harness.clog.warn).toHaveBeenCalledOnce();
        expect(harness.cleanCache).toHaveBeenCalledOnce();
    });

    it("data-health repair removes handled inbox items without clearing publication dates", async () => {
        const harness = createStorage({ car_list: [{ carNum: "A-1" }], favorite_actresses: [{ starId: "a", lastPublishTime: "2026-09-03", newVideoList: [{ carNum: "A-1" }] }], blacklist: [], blacklist_car_list: [] });
        harness.storage.inspectDataHealth = vi.fn(async () => ({ issues: [] }));
        await harness.storage.repairDataHealth();
        expect(harness.data.get("favorite_actresses")[0]).toMatchObject({ lastPublishTime: "2026-09-03", newVideoList: [] });
    });
});
