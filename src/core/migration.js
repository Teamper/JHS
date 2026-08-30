// @ts-check

import { CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { mergeCanonicalCarRecords } from "./state-model.js";

export const PORTABLE_DATA_KEYS = Object.freeze([ "car_list", "filter_keyword_title", "filter_keyword_review", "setting", "blacklist", "blacklist_car_list", "favorite_actresses", "highlighted_tags", "activity_log", "offline_history", "new_video_decisions" ]);
export const IMPORTABLE_DATA_KEYS = Object.freeze([ ...PORTABLE_DATA_KEYS, "third_party_ttl_cache" ]);
const PORTABLE_ARRAY_KEYS = new Set([ "car_list", "filter_keyword_title", "filter_keyword_review", "blacklist", "blacklist_car_list", "favorite_actresses", "highlighted_tags", "offline_history" ]);
const PORTABLE_OBJECT_KEYS = new Set([ "setting", "third_party_ttl_cache", "activity_log", "new_video_decisions" ]);

export function validatePortableData(/** @type {Record<string, any>} */ data) {
    if (!data || "object" != typeof data || Array.isArray(data)) throw new TypeError("备份数据格式无效");
    const version = Number(data.data_version || 0);
    if (!Number.isInteger(version) || version < 0) throw new TypeError("备份数据版本无效");
    if (version > CURRENT_DATA_VERSION) throw new Error("数据来自更新版本的 JHS，当前版本无法安全读取");
    for (const key of PORTABLE_ARRAY_KEYS) if (null != data[key] && !Array.isArray(data[key])) throw new TypeError(`备份字段 ${key} 必须为数组`);
    for (const key of PORTABLE_OBJECT_KEYS) if (null != data[key] && ("object" != typeof data[key] || Array.isArray(data[key]))) throw new TypeError(`备份字段 ${key} 必须为对象`);
    return version;
}

export async function hasPortableUserData(/** @type {any} */ storage) {
    for (const key of PORTABLE_DATA_KEYS) {
        const value = await storage.forage.getItem(key);
        if (Array.isArray(value) ? value.length : value && "object" == typeof value ? Object.keys(value).length : null != value) return !0;
    }
    return !1;
}

async function ensureV2MigrationSnapshot(/** @type {any} */ storage) {
    if (!await hasPortableUserData(storage)) return null;
    const snapshots = await storage._getSnapshots(), existing = snapshots.find((/** @type {Record<string, any>} */ item) => "migration-snapshot" === item.kind && 2 === item.targetDataVersion);
    if (existing) return existing;
    const data = await storage.exportPortableData(), snapshot = {
        id: "migration_v2_" + Date.now(),
        name: "6.4.0-migration-backup",
        source: "migration",
        kind: "migration-snapshot",
        targetDataVersion: 2,
        appVersion: "6.4.0",
        createdAt: new Date().toISOString(),
        time: utils.getNowStr(),
        itemCount: Object.values(data).reduce(((sum, value) => sum + (Array.isArray(value) ? value.length : value && "object" == typeof value ? 1 : 0)), 0),
        data
    };
    // 与 createSnapshot 共用同一把快照锁，避免并发迁移/快照互相覆盖
    const save = async () => (snapshots.push(snapshot), snapshots.length > 10 && snapshots.splice(0, snapshots.length - 10), await storage._saveSnapshots(snapshots), snapshot);
    return storage._withCrossTabLock ? await storage._withCrossTabLock("jhs_snapshot_lock", save) : await save();
}

async function migrateLegacyStorage(/** @type {any} */ storage) {
    await storage.merge_table_name(), await storage.clean_no_url_blacklist(), await storage.async_merge_other(),
    await storage.merge_blacklist(), await storage.merge_favoriteActress(), await storage.merge_tow_car_list_table();
}

async function migrateStateFlags(/** @type {any} */ storage) {
    await ensureV2MigrationSnapshot(storage);
    const cars = await storage.forage.getItem(storage.car_list_key) || [], result = mergeCanonicalCarRecords(cars);
    await storage._setItemAndInvalidate(storage.car_list_key, result.list);
    const actresses = await storage.forage.getItem(storage.favorite_actresses_key) || [];
    const migratedActresses = actresses.map((/** @type {Record<string, any>} */ actress) => {
        if (!Array.isArray(actress.newVideoList)) return actress;
        const newVideoList = actress.newVideoList.map((/** @type {any} */ item) => "string" == typeof item ? normalizeCarNum(item) : {
            ...item,
            carNum: normalizeCarNum(item.carNum)
        }).filter((item => "string" == typeof item ? item : item.carNum));
        return { ...actress, newVideoList };
    });
    await storage._setItemAndInvalidate(storage.favorite_actresses_key, migratedActresses);
    const warnings = await storage.forage.getItem("data_health_warnings") || [];
    result.collisions.length && warnings.push({ type: "canonical-collision", createdAt: new Date().toISOString(), items: result.collisions });
    result.unknownStatuses.length && warnings.push({ type: "unknown-legacy-status", createdAt: new Date().toISOString(), items: result.unknownStatuses });
    warnings.length && await storage.forage.setItem("data_health_warnings", warnings);
}

/** @type {Readonly<Record<number, (storage: any) => Promise<void>>>} */
const DATA_MIGRATIONS = Object.freeze({ 1: migrateLegacyStorage, 2: migrateStateFlags });

export async function runDataMigrationsWithoutLock(/** @type {any} */ storage) {
    let version = await storage.getDataVersion();
    if (version > CURRENT_DATA_VERSION) throw new Error("数据来自更新版本的 JHS，当前版本无法安全读取");
    for (let target = version + 1; target <= CURRENT_DATA_VERSION; target++) {
        const migration = DATA_MIGRATIONS[target];
        if (!migration) throw new Error(`缺少数据迁移: ${target - 1} → ${target}`);
        await migration(storage), await storage.setDataVersion(target), version = target;
    }
    return version;
}

export async function runDataMigrations(/** @type {any} */ storage, /** @type {{runExclusive?: (operation: () => any) => Promise<any>} | null} */ coordinator = storage.mutationCoordinator ?? null) {
    // 迁移与状态事务必须共享一个协调器，避免恢复/迁移两个 writer 互相覆盖。
    return coordinator?.runExclusive ? coordinator.runExclusive(() => runDataMigrationsWithoutLock(storage)) : runDataMigrationsWithoutLock(storage);
}
