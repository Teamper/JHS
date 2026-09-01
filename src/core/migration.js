// @ts-check

import { CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { hasAnyState, mergeCanonicalCarRecords, normalizeStateFlags } from "./state-model.js";

/** @typedef {Record<string, any>} MigrationRecord */

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

/**
 * 将 6.5 之前为阻止新作重复出现而写入的空墓碑转换为 dismissed 决策。
 * 只有存在未撤销的 new-video-remove 活动证据时才处理，未知空记录保持不动。
 * @param {any} storage
 */
export async function repairNewVideoTombstones(storage) {
    const [cars, decisions, activity] = await Promise.all([
        storage.forage.getItem(storage.car_list_key),
        storage.forage.getItem("new_video_decisions"),
        storage.forage.getItem("activity_log"),
    ]);
    const list = Array.isArray(cars) ? cars : [], nextDecisions = { ...(decisions || {}) }, entries = Array.isArray(activity?.entries) ? activity.entries : [];
    const evidence = new Map;
    entries.filter((/** @param {MigrationRecord} entry */ entry => "new-video-remove" === entry?.type && "committed" === entry?.commitState)).forEach((/** @param {MigrationRecord} entry */ entry => (Array.isArray(entry.changes) ? entry.changes : []).forEach((/** @param {MigrationRecord} change */ change => {
        const key = normalizeCarNum(change?.carNum);
        key && evidence.set(key, entry);
    }))));
    /** @type {string[]} */
    const migrated = [];
    /** @type {MigrationRecord[]} */
    const remaining = [];
    list.forEach((/** @param {MigrationRecord} record */ record => {
        const key = normalizeCarNum(record?.carNum), entry = evidence.get(key), emptyRecord = record && !String(record.url || "").trim() && !String(record.names || "").trim() && !String(record.status || "").trim() && !hasAnyState(normalizeStateFlags(record.stateFlags));
        if (!key || !entry || !emptyRecord) return void remaining.push(record);
        const change = (Array.isArray(entry.changes) ? entry.changes : []).find((/** @param {MigrationRecord} item */ item => normalizeCarNum(item?.carNum) === key));
        if ("reverted" === change?.undoState) return void remaining.push(record);
        const timestamp = record.updateDate || record.createDate || entry.createdAt || new Date().toISOString(), previous = nextDecisions[key];
        nextDecisions[key] = { action: "dismissed", until: null, createdAt: previous?.createdAt || timestamp, updatedAt: previous?.updatedAt || timestamp };
        migrated.push(key);
    }));
    if (!migrated.length) return [];
    await storage.forage.setItem("new_video_decisions", nextDecisions);
    await storage._setItemAndInvalidate(storage.car_list_key, remaining);
    return migrated;
}

/** @type {Readonly<Record<number, (storage: any) => Promise<void>>>} */
const DATA_MIGRATIONS = Object.freeze({ 1: migrateLegacyStorage, 2: migrateStateFlags });

export async function runDataMigrations(/** @type {any} */ storage) {
    // 迁移是“读版本→整表覆写→写版本”的多步过程，必须跨标签页互斥，防止双标签页同时执行互相丢数据
    const locks = globalThis.navigator?.locks;
    const run = async () => {
        let version = await storage.getDataVersion();
        if (version > CURRENT_DATA_VERSION) throw new Error("数据来自更新版本的 JHS，当前版本无法安全读取");
        for (let target = version + 1; target <= CURRENT_DATA_VERSION; target++) {
            const migration = DATA_MIGRATIONS[target];
            if (!migration) throw new Error(`缺少数据迁移: ${target - 1} → ${target}`);
            await migration(storage), await storage.setDataVersion(target), version = target;
        }
        await repairNewVideoTombstones(storage);
        return version;
    };
    return locks?.request ? locks.request("jhs_data_migration", run) : run();
}
