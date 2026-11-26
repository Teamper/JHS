// @ts-check

import { B, D, P, CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { normalizeActressProfileData, readVerifiedActressProfile } from "./actress-measurements.js";
import { hasAnyState, mergeCanonicalCarRecords, normalizeStateFlags } from "./state-model.js";
import { isPersonalRating } from "./personal-rating.js";
import { formatUiDateTime } from "./ui-date-time.js";
import { readReviewKeywords } from "./review-keywords.js";

/** @typedef {Record<string, any>} MigrationRecord */

export const PORTABLE_DATA_KEYS = Object.freeze([ "car_list", "filter_keyword_title", "filter_keyword_review", "setting", "blacklist", "blacklist_car_list", "favorite_actresses", "highlighted_tags", "activity_log", "offline_history", "new_video_decisions", "personal_ratings" ]);
export const IMPORTABLE_DATA_KEYS = Object.freeze([ ...PORTABLE_DATA_KEYS, "third_party_ttl_cache" ]);
/** Settings that are bound to this installation's local trust boundary. */
export const LOCAL_ONLY_SETTING_KEYS = Object.freeze([ "trustedLocalOrigins", "webDavUrl", "webDavUsername", "webDavPassword", "webDavProfileRevision", "webDavAutoBackupEnabled", "webDavAutoBackupOnChanges", "webDavAutoBackupOnInterval", "webDavAutoBackupChangeCount", "webDavAutoBackupMinutes", "webDavAutoBackupKeepCount", "translationRequestsPerMinute", "translationRequestsPerDay", "androidTranslateTitle", "androidCatalogLayout" ]);
/** Settings that contain installation-bound credentials and never belong in portable data. */
export const CREDENTIAL_SETTING_KEYS = Object.freeze([ "webDavPassword" ]);
const PORTABLE_ARRAY_KEYS = new Set([ "car_list", "filter_keyword_title", "filter_keyword_review", "blacklist", "blacklist_car_list", "favorite_actresses", "highlighted_tags", "offline_history" ]);
const PORTABLE_OBJECT_KEYS = new Set([ "setting", "third_party_ttl_cache", "activity_log", "new_video_decisions", "personal_ratings" ]);
export const LEGACY_DATA_ALIASES = Object.freeze({
    filter_actor_actress_info_list: "blacklist", favorite_actresses_info_list: "favorite_actresses",
    car_list_filter_actor_actress: "blacklist_car_list", title_filter_keyword: "filter_keyword_title",
    review_filter_keyword: "filter_keyword_review", highlightedTags: "highlighted_tags",
});

/** Mutate only the supplied draft; no storage or global service access. @param {MigrationRecord} draft */
export function normalizeLegacySettings(draft) {
    const names = {
        enableCheckFilterActorActress: "enableCheckBlacklist", checkIntervalTime_filterActorActress: "checkBlacklist_intervalTime",
        checkIntervalTime_ruleTime: "checkNewVideo_ruleTime", checkIntervalTime_newVideo: "checkNewVideo_intervalTime",
        checkIntervalTime_favoriteActress: "checkFavoriteActress_IntervalTime",
    };
    for (const [old, current] of Object.entries(names)) if (Object.hasOwn(draft, old)) {
        if (!Object.hasOwn(draft, current)) draft[current] = draft[old];
        delete draft[old];
    }
    for (const name of ["checkFilterTime", "checkFilterConcurrencyCount", "checkFilterSleep"]) delete draft[name];
}

/** @param {MigrationRecord[]} actresses */
function normalizeActressNewVideos(actresses) {
    return actresses.map((actress) => {
        if (!actress || typeof actress !== "object") return actress;
        let next = actress;
        if (Array.isArray(actress.newVideoList)) {
            next = {
                ...next,
                newVideoList: actress.newVideoList.filter(Boolean).map((/** @type {any} */ item) => typeof item === "string" ? normalizeCarNum(item) : {
                    ...item, carNum: normalizeCarNum(item.carNum),
                }).map(item => {
                    if (!item || typeof item !== "object" || item.retainedAfterRebind === true) return item;
                    const { retainedAfterRebind: _retention, ...video } = item;
                    return video;
                }).filter((item) => typeof item === "string" ? item : item?.carNum),
            };
        }
        if (Object.hasOwn(next, "actressProfile")) {
            const profile = normalizeActressProfileData(next.actressProfile);
            if (profile) next = { ...next, actressProfile: profile };
            else {
                const { actressProfile: _dropped, actressProfileVerifiedUrl: _verification, ...rest } = next;
                next = rest;
            }
        }
        if (Object.hasOwn(next, "actressProfileVerifiedUrl") && !readVerifiedActressProfile(next)) {
            const { actressProfileVerifiedUrl: _verification, ...rest } = next;
            return rest;
        }
        return next;
    });
}

/** Normalize legacy fields in an owned draft without filtering paired domains. @param {MigrationRecord} data */
export function normalizeLegacyDomains(data) {
    if (data.setting) normalizeLegacySettings(data.setting);
    for (const item of data.blacklist || []) {
        if (Object.hasOwn(item, "isActor") && !item.role) item.role = item.isActor ? B : P;
        delete item.isActor;
        if (Object.hasOwn(item, "recordTime") && !Object.hasOwn(item, "createTime")) item.createTime = item.recordTime;
        delete item.recordTime; delete item.key;
        item.allName ||= item.name ? [item.name] : [];
        item.movieType ||= D;
        if (item.url) try {
            const url = new URL(item.url);
            item.starId ||= url.pathname.split("/").filter(Boolean).pop();
            url.searchParams.delete("sort_type");
            item.url = url.toString();
        } catch { /* Preserve unrecognized historical URLs. */ }
    }
    for (const item of data.blacklist_car_list || []) {
        item.starId ||= data.blacklist?.find((/** @type {MigrationRecord} */ actor) => actor.name === item.actress)?.starId;
        delete item.type;
    }
    for (const item of data.favorite_actresses || []) {
        if (!Object.hasOwn(item, "starId") && item.dbId) item.starId = item.dbId;
        delete item.dbId;
    }
    for (const item of [...(data.car_list || []), ...(data.blacklist_car_list || [])]) if (Object.hasOwn(item, "actress")) {
        if (!Object.hasOwn(item, "names")) item.names = item.actress;
        delete item.actress;
    }
}

/** Normalize only supplied portable domains, never a destination database. @param {unknown} input */
export function normalizePortableData(input) {
    const source = /** @type {MigrationRecord} */ (input);
    const version = validatePortableData(source), selected = { ...source };
    for (const [old, current] of Object.entries(LEGACY_DATA_ALIASES)) {
        if (!Object.hasOwn(selected, current) && Object.hasOwn(source, old)) selected[current] = source[old];
    }
    validatePortableData(selected);
    /** @type {MigrationRecord} */
    const data = {};
    for (const key of PORTABLE_DATA_KEYS) if (Object.hasOwn(selected, key)) {
        data[key] = selected[key] == null ? (PORTABLE_ARRAY_KEYS.has(key) ? [] : {}) : JSON.parse(JSON.stringify(selected[key]));
    }
    if (version < 1) normalizeLegacyDomains(data);
    /** @type {MigrationRecord[]} */
    const warnings = [];
    if (version < 2) {
        if (data.car_list) {
            const result = mergeCanonicalCarRecords(data.car_list);
            data.car_list = result.list;
            appendStateMigrationWarnings(warnings, result);
        }
    }
    if (data.favorite_actresses) data.favorite_actresses = normalizeActressNewVideos(data.favorite_actresses);
    // Partial backups must not borrow destination evidence or rewrite omitted domains.
    if (version < 3 && ["car_list", "activity_log", "new_video_decisions"].every((key) => Object.hasOwn(data, key))) {
        const result = normalizeNewVideoTombstones(data.car_list, data.new_video_decisions, data.activity_log);
        data.car_list = result.remaining; data.new_video_decisions = result.nextDecisions;
    }
    return { data, warnings };
}

/** @param {MigrationRecord[]} warnings @param {ReturnType<typeof mergeCanonicalCarRecords>} result */
function appendStateMigrationWarnings(warnings, result) {
    result.collisions.length && warnings.push({ type: "canonical-collision", createdAt: new Date().toISOString(), items: result.collisions });
    result.unknownStatuses.length && warnings.push({ type: "unknown-legacy-status", createdAt: new Date().toISOString(), items: result.unknownStatuses });
}

/** Remove installation-local and credential fields before exporting portable settings. */
export function selectPortableSettings(/** @type {Record<string, any>} */ settings) {
    const portable = settings && "object" === typeof settings && !Array.isArray(settings) ? { ...settings } : {};
    for (const key of [ ...LOCAL_ONLY_SETTING_KEYS, ...CREDENTIAL_SETTING_KEYS ]) delete portable[key];
    return portable;
}

/** Keep the destination installation's local settings while importing portable settings. */
export function mergePortableSettings(/** @type {Record<string, any>} */ current, /** @type {Record<string, any>} */ imported) {
    const merged = selectPortableSettings(imported);
    for (const key of [ ...LOCAL_ONLY_SETTING_KEYS, ...CREDENTIAL_SETTING_KEYS ]) {
        if (Object.prototype.hasOwnProperty.call(current || {}, key)) merged[key] = current[key];
    }
    return merged;
}

export function validatePortableData(/** @type {Record<string, any>} */ data) {
    if (!data || "object" != typeof data || Array.isArray(data)) throw new TypeError("备份数据格式无效");
    const version = Number(data.data_version ?? 0);
    if (!Number.isInteger(version) || version < 0) throw new TypeError("备份数据版本无效");
    if (version > CURRENT_DATA_VERSION) throw new Error("数据来自更新版本的 JHS，当前版本无法安全读取");
    for (const key of PORTABLE_ARRAY_KEYS) if (null != data[key] && !Array.isArray(data[key])) throw new TypeError(`备份字段 ${key} 必须为数组`);
    for (const key of PORTABLE_OBJECT_KEYS) if (null != data[key] && ("object" != typeof data[key] || Array.isArray(data[key]))) throw new TypeError(`备份字段 ${key} 必须为对象`);
    if (Object.hasOwn(data, "personal_ratings")) {
        if (version < 4) throw new TypeError("个人评分需要数据版本 4");
        for (const [key, value] of Object.entries(data.personal_ratings || {})) {
            if (normalizeCarNum(key) !== key || !isPersonalRating(value)) throw new TypeError("个人评分格式无效");
        }
    }
    return version;
}

/** Read-only guard before settings, credentials or business data are persisted. @param {Pick<MigrationDataPort, "get">} storage */
export async function assertSupportedDataVersion(storage) {
    return validatePortableData({ data_version: await readStoredDataVersion(storage) });
}

/** Old databases can still store user data under pre-v1 keys. @param {number} version */
export function getPortableDataKeys(version) {
    const keys = version < 4 ? PORTABLE_DATA_KEYS.filter(key => key !== "personal_ratings") : PORTABLE_DATA_KEYS;
    return version < 1 ? [...keys, ...Object.keys(LEGACY_DATA_ALIASES)] : keys;
}

/** @typedef {Pick<import("../services/storage-service.js").StorageService, "get"|"set"|"remove">} MigrationDataPort */

/** @param {Pick<MigrationDataPort, "get">} storage @param {number} version */
export async function readPortableData(storage, version) {
    const keys = getPortableDataKeys(version);
    const values = await Promise.all(keys.map(key => storage.get(key)));
    /** @type {MigrationRecord} */ const data = { data_version: version };
    for (const [index, key] of keys.entries()) {
        const value = values[index];
        if (value != null) data[key] = key === "setting" ? selectPortableSettings(value) : value;
    }
    return data;
}

/** @param {Pick<MigrationDataPort, "get">} storage */
export async function readStoredDataVersion(storage) { return await storage.get("data_version") || 0; }

/** @param {MigrationDataPort} storage */
export async function mergeLegacyTableNames(storage) {
    for (const [old, current] of Object.entries(LEGACY_DATA_ALIASES)) {
        if (old === "review_filter_keyword") continue;
        const value = await storage.get(old);
        if (value?.length) await storage.set(current, value);
        await storage.remove(old);
    }
    await readReviewKeywords(storage, undefined, { alreadyLocked: true });
}

/** @param {MigrationDataPort} storage */
export async function cleanLegacyBlacklist(storage) {
    const [cars, actors] = /** @type {[MigrationRecord[], MigrationRecord[]]} */ (await Promise.all([
        storage.get("blacklist_car_list").then(value => value || []),
        storage.get("blacklist").then(value => value || []),
    ]));
    if (cars.length && !cars[0].actress) return;
    const names = new Set(actors.map(actor => actor.name));
    const retainedCars = cars.filter(car => !car.actress || names.has(car.actress));
    if (cars.length !== retainedCars.length) await storage.set("blacklist_car_list", retainedCars);
    const retainedNames = new Set(retainedCars.map(car => car.actress));
    const retainedActors = actors.filter(actor => retainedNames.has(actor.name)).map(({ key, recordTime, ...record }) =>
        recordTime === undefined ? record : { ...record, createTime: recordTime });
    if (actors.length !== retainedActors.length || actors.some(actor => "key" in actor || "recordTime" in actor)) {
        await storage.set("blacklist", retainedActors);
    }
}

/** @param {MigrationDataPort} storage @param {string[]} keys */
export async function normalizeStoredLegacyDomains(storage, keys) {
    const data = Object.fromEntries(await Promise.all(keys.map(async key => [key, await storage.get(key) || []])));
    normalizeLegacyDomains(data);
    for (const [key, value] of Object.entries(data)) await storage.set(key, value);
}

/** @param {Pick<MigrationDataPort, "get">} storage */
export async function hasPortableUserData(storage) {
    const values = await Promise.all(getPortableDataKeys(await readStoredDataVersion(storage)).map(key => storage.get(key)));
    return values.some(value => Boolean(Array.isArray(value) ? value.length : value && "object" == typeof value ? Object.keys(value).length : null != value));
}

/** @param {MigrationDataPort} storage */
async function ensureV2MigrationSnapshot(storage) {
    if (!await hasPortableUserData(storage)) return null;
    const snapshots = await storage.get("snapshots") || [], existing = snapshots.find((/** @type {Record<string, any>} */ item) => "migration-snapshot" === item.kind && 2 === item.targetDataVersion);
    if (existing) return existing;
    const data = await readPortableData(storage, await readStoredDataVersion(storage)), now = new Date().toISOString(), snapshot = {
        id: "migration_v2_" + Date.now(),
        name: "6.4.0-migration-backup",
        source: "migration",
        kind: "migration-snapshot",
        targetDataVersion: 2,
        appVersion: "6.4.0",
        createdAt: now,
        time: formatUiDateTime(now),
        itemCount: Object.values(data).reduce(((sum, value) => sum + (Array.isArray(value) ? value.length : value && "object" == typeof value ? 1 : 0)), 0),
        data
    };
    // runDataMigrations already owns the global write lock, so do not acquire
    // the snapshot lock again from inside it.
    snapshots.push(snapshot);
    snapshots.length > 10 && snapshots.splice(0, snapshots.length - 10);
    await storage.set("snapshots", snapshots);
    return snapshot;
}

/** @typedef {{updateSettings?: (mutator: (settings: MigrationRecord) => unknown) => Promise<unknown>, recoverBeforeV4?: () => Promise<unknown>}} MigrationOptions */

/** @param {MigrationDataPort} storage @param {MigrationOptions} options */
async function migrateV1(storage, options) {
    await mergeLegacyTableNames(storage);
    await cleanLegacyBlacklist(storage);
    if (options.updateSettings) await options.updateSettings(normalizeLegacySettings);
    else {
        const settings = await storage.get("setting") || {};
        normalizeLegacySettings(settings);
        await storage.set("setting", settings);
    }
    await normalizeStoredLegacyDomains(storage, ["blacklist", "blacklist_car_list"]);
    await normalizeStoredLegacyDomains(storage, ["favorite_actresses"]);
    await normalizeStoredLegacyDomains(storage, ["blacklist_car_list", "car_list"]);
}

/** @param {MigrationDataPort} storage */
async function migrateStateFlags(storage) {
    await ensureV2MigrationSnapshot(storage);
    const cars = await storage.get("car_list") || [], result = mergeCanonicalCarRecords(cars);
    await storage.set("car_list", result.list);
    const actresses = await storage.get("favorite_actresses") || [];
    const migratedActresses = normalizeActressNewVideos(actresses);
    await storage.set("favorite_actresses", migratedActresses);
    const warnings = await storage.get("data_health_warnings") || [];
    appendStateMigrationWarnings(warnings, result);
    warnings.length && await storage.set("data_health_warnings", warnings);
}

/**
 * 将 6.5 之前为阻止新作重复出现而写入的空墓碑转换为 dismissed 决策。
 * 只有存在未撤销的 new-video-remove 活动证据时才处理，未知空记录保持不动。
 * @param {MigrationDataPort} storage
 */
export async function repairNewVideoTombstones(storage) {
    const [cars, decisions, activity] = await Promise.all([
        storage.get("car_list"),
        storage.get("new_video_decisions"),
        storage.get("activity_log"),
    ]);
    const { migrated, nextDecisions, remaining } = normalizeNewVideoTombstones(cars, decisions, activity);
    if (!migrated.length) return [];
    await storage.set("new_video_decisions", nextDecisions);
    await storage.set("car_list", remaining);
    return migrated;
}

/** @param {MigrationRecord[]} cars @param {MigrationRecord} decisions @param {MigrationRecord} activity */
function normalizeNewVideoTombstones(cars, decisions, activity) {
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
    return { migrated, nextDecisions, remaining };
}

/** @param {MigrationDataPort & Pick<import("../services/storage-service.js").StorageService, "keys">} storage */
async function migrateV3(storage) {
    await repairNewVideoTombstones(storage);
    for (const key of await storage.keys()) {
        if (key.startsWith("jhs_http_public_cache:v1:")) await storage.remove(key);
    }
}

/** @param {MigrationDataPort} storage @param {MigrationOptions} options */
async function migrateV4(storage, options) {
    await options.recoverBeforeV4?.();
    const snapshots = await storage.get("snapshots") || [];
    if (!snapshots.some((/** @type {MigrationRecord} */ item) => item.kind === "migration-snapshot" && item.targetDataVersion === 4)) {
        const data = await readPortableData(storage, await readStoredDataVersion(storage));
        const now = new Date().toISOString();
        snapshots.push({ id: `migration_v4_${Date.now()}`, name: "个人评分升级前", source: "migration", kind: "migration-snapshot", targetDataVersion: 4, createdAt: now, time: formatUiDateTime(now), itemCount: Array.isArray(data.car_list) ? data.car_list.length : 0, data });
        if (snapshots.length > 10) snapshots.splice(0, snapshots.length - 10);
        await storage.set("snapshots", snapshots);
    }
    const ratings = await storage.get("personal_ratings");
    if (ratings == null) await storage.set("personal_ratings", {});
    else validatePortableData({ data_version: 4, personal_ratings: ratings });
}

const DATA_MIGRATIONS = { 1: migrateV1, 2: migrateStateFlags, 3: migrateV3, 4: migrateV4 };

/** The caller holds the shared mutation lock or owns an isolated import draft.
 * @param {MigrationDataPort & Pick<import("../services/storage-service.js").StorageService, "keys">} storage
 * @param {MigrationOptions} [options] */
export async function runDataMigrations(storage, options = {}) {
    const version = await assertSupportedDataVersion(storage);
    for (let target = version + 1; target <= CURRENT_DATA_VERSION; target++) {
        const migration = DATA_MIGRATIONS[/** @type {keyof typeof DATA_MIGRATIONS} */ (target)];
        if (!migration) throw new Error(`缺少数据迁移: ${target - 1} → ${target}`);
        await migration(storage, options);
        await storage.set("data_version", target);
    }
    return CURRENT_DATA_VERSION;
}
