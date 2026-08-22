import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function createAdapter(existing = null) {
    const source = readFileSync(join(import.meta.dirname, "../src/core/storage.js"), "utf8"), show = { error: vi.fn() }, patch = vi.fn(async () => ({ changed: [ "ABC-1" ], transactionId: "tx" })), context = vm.createContext({
        WeakSet, WeakMap, Map, Set, Promise, Date, JSON, Object, Array, Math,
        a: message => { throw new TypeError(message); },
        i: (target, key, value) => (target[key] = value),
        localforage: { INDEXEDDB: "indexeddb", createInstance: () => ({}) },
        show, d: "filter", h: "favorite", g: "hasDown", p: "hasWatch",
        normalizeCarNum: value => String(value || "").trim().toUpperCase(),
        legacyActionToFlag: value => ({ filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" })[value] || null,
        normalizeStateFlags: flags => ({ favorite: !!flags?.favorite, downloaded: !!flags?.downloaded, watched: !!flags?.watched, blocked: !!flags?.blocked }),
        stateService: { patch }, window: { location: { origin: "https://javdb.example" } }, navigator: {}, utils: {}, clog: {}, escapeHtml: value => value,
        CURRENT_DATA_VERSION: 2, PORTABLE_DATA_KEYS: [], hasPortableUserData: async () => false, validatePortableData() {}, runDataMigrations() {}
    });
    vm.runInContext(`${source}; globalThis.Adapter = StorageManager;`, context);
    const adapter = new context.Adapter;
    adapter.getCar = vi.fn(async () => existing), adapter.getCarMap = vi.fn(async () => new Map(existing ? [[ existing.carNum, existing ]] : []));
    return { adapter, patch, show };
}

describe("legacy StorageManager state adapters", () => {
    it("keeps duplicate-state errors while forwarding new writes", async () => {
        const duplicate = createAdapter({ carNum: "ABC-1", stateFlags: { favorite: true } });
        await expect(duplicate.adapter.saveCar({ carNum: "abc-1", url: "/v/1", actionType: "favorite" })).rejects.toThrow("已在收藏列表中");
        expect(duplicate.patch).not.toHaveBeenCalled();

        const fresh = createAdapter();
        await expect(fresh.adapter.saveCar({ carNum: "abc-1", url: "/v/1", actionType: "favorite" })).resolves.toMatchObject({ transactionId: "tx" });
        expect(fresh.patch).toHaveBeenCalledWith("ABC-1", { favorite: true }, expect.objectContaining({ type: "legacy-save" }));
    });

    it("prevalidates a batch before forwarding any group", async () => {
        const { adapter, patch } = createAdapter();
        await expect(adapter.saveCarList([{ carNum: "ABC-1", url: "/1", actionType: "favorite" }, { carNum: "abc-1", url: "/1", actionType: "favorite" }])).rejects.toThrow("状态已存在");
        expect(patch).not.toHaveBeenCalled();
    });

    it("keeps updateCarInfo missing-record behavior", async () => {
        const { adapter, patch } = createAdapter();
        await expect(adapter.updateCarInfo({ carNum: "ABC-1", url: "/1", actionType: "hasDown" })).rejects.toThrow("数据不存在");
        expect(patch).not.toHaveBeenCalled();
    });
});
