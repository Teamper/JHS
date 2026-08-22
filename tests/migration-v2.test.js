import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadMigration() {
    const constants = readFileSync(join(repoRoot, "src/core/constants.js"), "utf8"), start = constants.indexOf("function normalizeCarNum"), end = constants.indexOf("function assertPageInfoContract", start), state = readFileSync(join(repoRoot, "src/core/state-model.js"), "utf8"), migration = readFileSync(join(repoRoot, "src/core/migration.js"), "utf8"), context = vm.createContext({ d: "filter", h: "favorite", g: "hasDown", p: "hasWatch", CURRENT_DATA_VERSION: 2, Date, Object, Array, Map, Set, JSON, utils: { getNowStr: () => "2026-08-22" } });
    vm.runInContext(`${constants.slice(start, end)}\n${state}\n${migration}; globalThis.api = { run: runDataMigrations, validate: validatePortableData };`, context);
    return context.api;
}

function fakeStorage(version, initial = {}) {
    const data = new Map([["data_version", version], ...Object.entries(initial)]), snapshots = [], storage = {
        car_list_key: "car_list", favorite_actresses_key: "favorite_actresses",
        forage: { getItem: vi.fn(async key => data.get(key)), setItem: vi.fn(async (key, value) => data.set(key, value)) },
        getDataVersion: async () => data.get("data_version") || 0,
        setDataVersion: vi.fn(async value => data.set("data_version", value)),
        _setItemAndInvalidate: vi.fn(async (key, value) => data.set(key, value)),
        _getSnapshots: async () => snapshots, _saveSnapshots: vi.fn(async value => { snapshots.splice(0, snapshots.length, ...value); }),
        exportPortableData: async () => Object.fromEntries(data),
        merge_table_name: vi.fn(), clean_no_url_blacklist: vi.fn(), async_merge_other: vi.fn(), merge_blacklist: vi.fn(), merge_favoriteActress: vi.fn(), merge_tow_car_list_table: vi.fn()
    };
    return { storage, data, snapshots };
}

describe("data migration v2", () => {
    it("rejects future data before every write", async () => {
        const { run } = loadMigration(), { storage } = fakeStorage(3);
        await expect(run(storage)).rejects.toThrow("数据来自更新版本");
        expect(storage.setDataVersion).not.toHaveBeenCalled();
        expect(storage._setItemAndInvalidate).not.toHaveBeenCalled();
    });

    it("migrates v1 records, creates one identified snapshot and reports collisions", async () => {
        const { run } = loadMigration(), { storage, data, snapshots } = fakeStorage(1, { car_list: [{ carNum: "abc-123", status: "favorite" }, { carNum: "ABC123", status: "hasDown" }], favorite_actresses: [] });
        await expect(run(storage)).resolves.toBe(2);
        expect(data.get("car_list")).toHaveLength(1);
        expect(data.get("car_list")[0].stateFlags).toMatchObject({ favorite: true, downloaded: true });
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toMatchObject({ kind: "migration-snapshot", targetDataVersion: 2, appVersion: "6.4.0" });
        expect(data.get("data_health_warnings")[0].type).toBe("canonical-collision");
        await run(storage);
        expect(snapshots).toHaveLength(1);
    });

    it("validates every portable domain before import writes begin", () => {
        const { validate } = loadMigration();
        expect(() => validate({ data_version: 2, car_list: {} })).toThrow("car_list 必须为数组");
        expect(() => validate({ data_version: 2, activity_log: [] })).toThrow("activity_log 必须为对象");
        expect(() => validate({ data_version: 3, car_list: [] })).toThrow("数据来自更新版本");
        expect(validate({ data_version: 2, car_list: [], new_video_decisions: {} })).toBe(2);
    });
});
