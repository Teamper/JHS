// @ts-check

import { CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { LOCAL_ONLY_SETTING_KEYS } from "./migration.js";
import { normalizeStateFlags, syncLegacyStatus } from "./state-model.js";
import { isSyncObject, validateSyncFrontiers, validateSyncRecordFields } from "./webdav-sync-validation.js";

/** @typedef {Record<string, any>} Dict */
export const SYNC_FOLDER = "JHS-同步";
export const SYNC_DEFAULTS = Object.freeze({ webDavSyncKeepCount: 10, webDavSyncHistoryDays: 30 });
/** @param {any} values */
export function syncRetention(values) {
    const count = Number(values.webDavSyncKeepCount ?? 10), days = Number(values.webDavSyncHistoryDays ?? 30);
    if (!Number.isSafeInteger(count) || count < 3 || count > 1e6 || !Number.isSafeInteger(days) || days < 0 || days > 365) throw new Error("最近版本须为 3 至 1000000 的整数，每日保留天数须为 0 至 365 的整数");
    return { count, days };
}
export const SYNC_LAYOUT_KEYS = Object.freeze(["mobileMode", "containerColumns", "containerWidth"]);
export const SYNC_DOMAINS = Object.freeze(["car_list", "favorite_actresses", "blacklist", "blacklist_car_list", "filter_keyword_title", "filter_keyword_review", "highlighted_tags", "new_video_decisions", "activity_log", "offline_history", "setting"]);
const LOCAL_SETTINGS = new Set([...LOCAL_ONLY_SETTING_KEYS, ...SYNC_LAYOUT_KEYS, "localOriginTrustNoticeV1"]);
const HISTORY = new Set(["activity_log", "offline_history"]);
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const OMIT = new Set(["checkTime", "lastCheckTime", "status"]);
/** @param {any} value @returns {any} */
export const syncClone = value => value == null ? value : JSON.parse(JSON.stringify(value));
/** Canonical JSON for equality and integrity, not a wall-clock ordering. @param {any} value @returns {string} */
export function syncJson(value) {
    if (value === undefined) return "undefined";
    if (!value || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(syncJson).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${syncJson(value[key])}`).join(",")}}`;
}
/** @param {string} name */
export function isSharedSetting(name) {
    return !LOCAL_SETTINGS.has(name) && !/password|token|authorization|cookie|secret|credential/i.test(name) && (!name.startsWith("webDav") || ["webDavSyncKeepCount", "webDavSyncHistoryDays"].includes(name));
}
/** @param {any} value */
export function syncLayout(value) { return Object.fromEntries(SYNC_LAYOUT_KEYS.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]])); }
/** @param {any} a @param {any} b */
export function compareVersion(a, b) { return (a?.[0] || 0) - (b?.[0] || 0) || String(a?.[1] || "").localeCompare(String(b?.[1] || ""), "en"); }
/** @param {any} item */
export function historyRank(item) { return `${item.createdAt || ""}\u0000${item.id || ""}`; }
/** @param {string} domain @param {any} item */
function identity(domain, item) {
    if (["car_list", "blacklist_car_list"].includes(domain)) return normalizeCarNum(item.carNum);
    if (["favorite_actresses", "blacklist"].includes(domain)) return item.starId == null ? null : String(item.starId);
    if (HISTORY.has(domain)) return item.id && String(item.id);
    return String(item);
}
/** Flatten only explicitly independently editable fields. @param {string} domain @param {any} item @returns {Dict} */
function fields(domain, item) {
    if (["setting", "new_video_decisions", "filter_keyword_title", "filter_keyword_review", "highlighted_tags"].includes(domain)) return { value: syncClone(item) };
    if (domain === "activity_log") return { value: { id: item.id, type: item.type, createdAt: item.createdAt, commitState: "committed", originReplicaId: item.originReplicaId, undoAttemptedAt: item.undoAttemptedAt ?? null, changes: (item.changes || []).map((/** @type {any} */ change) => ({ carNum: change.carNum, operation: change.operation, fields: change.fields, undoState: change.undoState })) } };
    if (domain === "offline_history") return { value: syncClone(item) };
    /** @type {Dict} */ const result = {};
    for (const [key, value] of Object.entries(item)) {
        if (OMIT.has(key) || key === "stateFlags" || key === "newVideoList") continue;
        Object.defineProperty(result, `f:${key}`, { value: syncClone(value), enumerable: true, writable: true, configurable: true });
    }
    if (domain === "car_list") for (const [key, value] of Object.entries(normalizeStateFlags(item.stateFlags))) result[`flag:${key}`] = value;
    if (domain === "favorite_actresses") for (const video of item.newVideoList || []) {
        const id = normalizeCarNum(typeof video === "string" ? video : video.carNum);
        if (id) result[`video:${id}`] = syncClone(video);
    }
    return result;
}
/** @param {Dict} data @param {Dict} [frontiers] @returns {Dict} */
export function projectSyncData(data, frontiers = {}) {
    /** @type {Dict} */ const result = {};
    for (const domain of SYNC_DOMAINS) {
        const raw = data[domain], entries = domain === "setting" || domain === "new_video_decisions" ? Object.entries(raw || {}) : (domain === "activity_log" ? raw?.entries || [] : raw || []).map((/** @type {any} */ item) => [identity(domain, item), item]);
        for (const [id, item] of entries) {
            if (domain === "setting" && !isSharedSetting(id)) continue;
            if (HISTORY.has(domain) && (domain === "activity_log" && item.commitState !== "committed" || historyRank(item) <= (frontiers[domain] || ""))) continue;
            if (id == null || id === "") throw new Error(`同步记录缺少稳定标识：${domain}`);
            const key = `${domain}/${encodeURIComponent(id)}`;
            if (Object.hasOwn(result, key)) throw new Error(`同步记录标识重复：${domain}`);
            result[key] = fields(domain, item);
        }
    }
    return result;
}
/** @returns {Dict} */
export function emptySyncModel() { return { records: {}, frontiers: {} }; }
/** @param {Dict} model */
export function maximumClock(model) {
    let maximum = 0;
    for (const record of Object.values(model.records)) for (const version of [record.birth, record.death, ...Object.values(record.fields).map((/** @type {any} */ field) => field.v)]) maximum = Math.max(maximum, version?.[0] || 0);
    return maximum;
}
/** Assign one version to the actual differences of one successful commit. @param {Dict} model @param {Dict} before @param {Dict} after @param {any} version */
export function versionSyncDiff(model, before, after, version) {
    const next = syncClone(model);
    let changed = false;
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const semantic = (/** @type {any} */ value) => value == null ? value : Object.fromEntries(Object.entries(value).filter(([name]) => name !== "f:updateDate"));
        if (syncJson(semantic(before[key])) === syncJson(semantic(after[key]))) continue;
        changed = true;
        let record = next.records[key];
        if (!Object.hasOwn(after, key)) { if (record) record.death = version; continue; }
        const creating = !record || compareVersion(record.birth, record.death) <= 0 || !Object.hasOwn(before, key);
        if (creating) record = next.records[key] = { birth: version, generation: record?.death ?? null, death: record?.death ?? null, fields: {} };
        for (const name of new Set([...Object.keys(before[key] || {}), ...Object.keys(after[key])])) if (syncJson(before[key]?.[name]) !== syncJson(after[key][name]) || creating && !Object.hasOwn(record.fields, name)) {
            // Implicit defaults on a concurrent first add are not edits to another
            // device's fields. Explicit later cancellation still gets a version.
            if (creating && (name.startsWith("f:") && (after[key][name] === "" || after[key][name] == null) || name.startsWith("flag:") && after[key][name] === false)) continue;
            record.fields[name] = Object.hasOwn(after[key], name) ? { v: version, value: syncClone(after[key][name]) } : { v: version, unset: true };
        }
    }
    return { model: next, changed };
}
/** Commutative, associative and idempotent join. @param {Dict} left @param {Dict} right @returns {Dict} */
export function joinSyncModels(left, right) {
    const result = syncClone(left);
    for (const [key, incoming] of Object.entries(right.records)) {
        const local = result.records[key];
        if (!local) { result.records[key] = syncClone(incoming); continue; }
        const generationOrder = compareVersion(local.generation, incoming.generation);
        const fields = generationOrder > 0 ? local.fields : generationOrder < 0 ? incoming.fields : { ...local.fields };
        if (generationOrder === 0) for (const [name, field] of Object.entries(incoming.fields)) {
            const old = fields[name], order = compareVersion(old?.v, field.v);
            if (old && order === 0 && syncJson(old) !== syncJson(field)) throw new Error("同步版本冲突：同一版本包含不同数据");
            if (!old || order < 0) fields[name] = syncClone(field);
        }
        result.records[key] = { generation: generationOrder >= 0 ? local.generation ?? null : incoming.generation ?? null, birth: generationOrder > 0 ? local.birth : generationOrder < 0 ? incoming.birth : compareVersion(local.birth, incoming.birth) >= 0 ? local.birth : incoming.birth, death: compareVersion(local.death, incoming.death) >= 0 ? local.death : incoming.death, fields: syncClone(fields) };
    }
    for (const domain of HISTORY) result.frontiers[domain] = String(left.frontiers[domain] || "") > String(right.frontiers[domain] || "") ? left.frontiers[domain] : right.frontiers[domain] || "";
    return result;
}
/** @param {Dict} model @returns {Dict} */
export function visibleSyncRecords(model) {
    /** @type {Dict} */ const result = {};
    for (const [key, record] of Object.entries(model.records)) if (compareVersion(record.birth, record.death) > 0) {
        const value = Object.fromEntries(Object.entries(record.fields).filter(([, field]) => !field.unset).map(([name, field]) => [name, syncClone(field.value)]));
        const domain = key.split("/")[0];
        if (HISTORY.has(domain) && historyRank(value.value) <= (model.frontiers[domain] || "")) continue;
        result[key] = value;
    }
    return result;
}
/** Materialize only shared domains; local credentials/layout are retained. @param {Dict} model @param {Dict} local @param {string[]} [undoEligible] @returns {Dict} */
export function materializeSyncData(model, local, undoEligible = []) {
    /** @type {Dict} */ const result = Object.fromEntries(SYNC_DOMAINS.map(domain => [domain, ["setting", "new_video_decisions"].includes(domain) ? {} : domain === "activity_log" ? { ...(local.activity_log || {}), entries: [] } : []]));
    result.setting = Object.fromEntries(Object.entries(local.setting || {}).filter(([key]) => !isSharedSetting(key)));
    const localActivities = new Map((local.activity_log?.entries || []).map((/** @type {any} */ entry) => [entry.id, entry]));
    const localRecords = new Map(SYNC_DOMAINS.flatMap(domain => Array.isArray(local[domain]) ? local[domain].map((/** @type {any} */ item) => [`${domain}/${identity(domain, item)}`, item]) : []));
    for (const [key, value] of Object.entries(visibleSyncRecords(model))) {
        const slash = key.indexOf("/"), domain = key.slice(0, slash), id = decodeURIComponent(key.slice(slash + 1));
        if (["setting", "new_video_decisions"].includes(domain)) { Object.defineProperty(result[domain], id, { value: value.value, enumerable: true, configurable: true, writable: true }); continue; }
        if (domain === "activity_log") { result.activity_log.entries.push(undoEligible.includes(id) && localActivities.has(id) ? syncClone(localActivities.get(id)) : value.value); continue; }
        if (Object.hasOwn(value, "value")) { result[domain].push(value.value); continue; }
        const item = Object.fromEntries(Object.entries(value).filter(([name]) => name.startsWith("f:")).map(([name, field]) => [name.slice(2), field]));
        const old = localRecords.get(`${domain}/${id}`);
        for (const name of ["checkTime", "lastCheckTime"]) if (old && Object.hasOwn(old, name)) item[name] = old[name];
        if (domain === "car_list") { item.carNum = id; item.stateFlags = Object.fromEntries(Object.entries(value).filter(([name]) => name.startsWith("flag:")).map(([name, flag]) => [name.slice(5), flag])); syncLegacyStatus(item); }
        if (domain === "favorite_actresses") item.newVideoList = Object.entries(value).filter(([name]) => name.startsWith("video:")).sort().map(([, video]) => video);
        result[domain].push(item);
    }
    result.activity_log.entries.push(...(local.activity_log?.entries || []).filter((/** @type {any} */ entry) => entry.commitState === "pending"));
    result.activity_log.entries.sort((/** @type {any} */ a, /** @type {any} */ b) => historyRank(a).localeCompare(historyRank(b), "en"));
    result.offline_history.sort((/** @type {any} */ a, /** @type {any} */ b) => historyRank(a).localeCompare(historyRank(b), "en"));
    for (const domain of SYNC_DOMAINS) if (Array.isArray(result[domain]) && !HISTORY.has(domain)) result[domain].sort((/** @type {any} */ a, /** @type {any} */ b) => String(identity(domain, a)).localeCompare(String(identity(domain, b)), "en"));
    return result;
}
/** Drop expired history payloads using monotone frontiers, retaining business tombstones. @param {Dict} model @param {Dict} local @param {number} now */
export function pruneSyncHistory(model, local, now) {
    const data = materializeSyncData(model, local);
    for (const domain of HISTORY) {
        const entries = domain === "activity_log" ? data[domain].entries.filter((/** @type {any} */ entry) => entry.commitState === "committed") : data[domain];
        let keep = domain === "offline_history" ? 1000 : Math.min(10000, Math.max(1000, entries.filter((/** @type {any} */ entry) => Date.parse(entry.createdAt) >= now - 30 * 86400000).length));
        const removed = entries.slice(0, Math.max(0, entries.length - keep));
        if (removed.length) model.frontiers[domain] = [model.frontiers[domain] || "", historyRank(removed.at(-1))].sort().at(-1);
        for (const [key, record] of Object.entries(model.records)) if (key.startsWith(`${domain}/`) && historyRank(record.fields.value?.value || {}) <= (model.frontiers[domain] || "")) delete model.records[key];
    }
    return model;
}
/** Validate before merging external state. @param {any} envelope */
export function validateSyncEnvelope(envelope) {
    if (!envelope || envelope.schema !== 1 || envelope.dataVersion > CURRENT_DATA_VERSION) throw Object.assign(new Error("同步数据来自不支持的版本，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
    if (!isSyncObject(envelope) || !Number.isInteger(envelope.dataVersion) || envelope.dataVersion < 0 || typeof envelope.replicaId !== "string" || !UUID.test(envelope.replicaId) || !Number.isSafeInteger(envelope.seq) || envelope.seq < 1 || typeof envelope.createdAt !== "string" || !Number.isFinite(Date.parse(envelope.createdAt))) throw new Error("同步快照格式无效");
    validateSyncState(envelope.state);
    return envelope;
}
/** Shared by network parsing and the final merged-state persistence boundary. @param {any} model */
export function validateSyncState(model) {
    if (!isSyncObject(model) || !isSyncObject(model.records)) throw new Error("同步快照格式无效");
    validateSyncFrontiers(model.frontiers);
    const checkVersion = (/** @type {any} */ version) => Array.isArray(version) && version.length === 2 && Number.isSafeInteger(version[0]) && version[0] > 0 && typeof version[1] === "string" && UUID.test(version[1]);
    for (const [key, record] of Object.entries(/** @type {Dict} */ (model.records))) {
        const slash = key.indexOf("/"), domain = key.slice(0, slash), encodedId = key.slice(slash + 1);
        let id;
        try { id = decodeURIComponent(encodedId); } catch { throw new Error("同步记录标识无效"); }
        if (slash < 1 || !id || encodeURIComponent(id) !== encodedId || !SYNC_DOMAINS.includes(domain)) throw new Error("同步记录标识无效");
        if (!isSyncObject(record) || !checkVersion(record.birth) || record.death != null && !checkVersion(record.death) || record.generation != null && (!checkVersion(record.generation) || compareVersion(record.birth, record.generation) <= 0) || !isSyncObject(record.fields)) throw new Error("同步字段版本无效");
        if (domain === "setting" && !isSharedSetting(id)) throw new Error("同步快照包含本机专属设置");
        for (const field of Object.values(/** @type {Dict} */ (record.fields))) if (!isSyncObject(field) || !checkVersion(field.v) || compareVersion(field.v, record.generation) <= 0 || Object.hasOwn(field, "unset") && field.unset !== true || (field.unset === true ? Object.hasOwn(field, "value") : !Object.hasOwn(field, "value"))) throw new Error("同步字段内容无效");
        validateSyncRecordFields(domain, id, record, compareVersion(record.birth, record.death) > 0);
    }
    return model;
}
/** @param {string} text */
export async function syncHash(text) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
/** @param {string} replicaId @param {number} seq @param {string} createdAt @param {string} hash */
export function syncFileName(replicaId, seq, createdAt, hash) { return `sync_v1_${replicaId}_${String(seq).padStart(16, "0")}_${createdAt.replace(/[-:.]/g, "")}_${hash}.json`; }
/** @param {string} name */
export function parseSyncFileName(name) {
    const match = /^sync_v(\d+)_([a-f0-9-]{36})_(\d{16})_(\d{8}T\d{9}Z)_([a-f0-9]{64})\.json$/.exec(name);
    if (!match || !UUID.test(match[2]) || !Number.isSafeInteger(Number(match[3])) || Number(match[3]) < 1) return null;
    const date = match[4].replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/, "$1-$2-$3T$4:$5:$6.$7Z");
    if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) return null;
    return { name, schema: Number(match[1]), replicaId: match[2], seq: Number(match[3]), createdAt: date, hash: match[5] };
}
/** @param {any[]} files @param {string} replicaId @param {number} count @param {number} days @param {number} now */
export function retainedSyncFiles(files, replicaId, count, days, now) {
    const own = files.filter(file => file.replicaId === replicaId).sort((a, b) => b.seq - a.seq);
    const keep = new Set(own.slice(0, Math.max(3, count)).map(file => file.name)), dates = new Set();
    const cutoff = new Date(now).toISOString().slice(0, 10), minimum = new Date(Date.parse(`${cutoff}T00:00:00Z`) - Math.max(0, days - 1) * 86400000).toISOString().slice(0, 10);
    if (own.some(file => Date.parse(file.createdAt) > now + 300000) || own.some((file, i) => i && file.createdAt > own[i - 1].createdAt)) return new Set(own.map(file => file.name));
    if (days) for (const file of own) { const day = file.createdAt.slice(0, 10); if (day >= minimum && day <= cutoff && !dates.has(day)) { dates.add(day); keep.add(file.name); } }
    return keep;
}
