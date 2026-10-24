// @ts-check

import { computationBudget, finishComputation, jsonCloneSteps as cloneSteps } from "./cooperative-work.js";
import { CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { LOCAL_ONLY_SETTING_KEYS } from "./migration.js";
import { mergeCanonicalCarRecords, normalizeStateFlags, syncLegacyStatus } from "./state-model.js";
import { isSyncObject, validateSyncFrontiers, validateSyncRecordFields } from "./webdav-sync-validation.js";

/** @typedef {Record<string, any>} Dict */
export const SYNC_FOLDER = "JHS-同步";
export const SYNC_DEFAULTS = Object.freeze({ webDavSyncKeepCount: 5, webDavSyncHistoryDays: 7 });
export const SYNC_LEGACY_DEFAULTS = Object.freeze({ webDavSyncKeepCount: 10, webDavSyncHistoryDays: 30 });
/** Pin implicit library policy as ordinary settings without replacing explicit values. @param {Dict} values @param {boolean} [existingLibrary] @returns {Dict} */
export function withSyncRetentionDefaults(values, existingLibrary = true) {
    return { ...(existingLibrary ? SYNC_LEGACY_DEFAULTS : SYNC_DEFAULTS), ...values };
}
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
export function projectSyncData(data, frontiers = {}) { return finishComputation(projectSyncDataSteps(data, frontiers)); }
/** @returns {Dict} */
export function emptySyncModel() { return { records: {}, frontiers: {} }; }
/** @param {Dict} model */
export function maximumClock(model) { return finishComputation(maximumClockSteps(model)); }
/** Assign one version to the actual differences of one successful commit. @param {Dict} model @param {Dict} before @param {Dict} after @param {any} version */
export function versionSyncDiff(model, before, after, version) { return finishComputation(versionSyncDiffSteps(model, before, after, version)); }
/** Commutative, associative and idempotent join. @param {Dict} left @param {Dict} right @returns {Dict} */
export function joinSyncModels(left, right) { return finishComputation(joinSyncModelsSteps(left, right)); }
/** @param {Dict} model @returns {Dict} */
export function visibleSyncRecords(model) { return finishComputation(visibleSyncRecordsSteps(model)); }
/** Materialize only shared domains; local credentials/layout are retained. @param {Dict} model @param {Dict} local @param {string[]} [undoEligible] @returns {Dict} */
export function materializeSyncData(model, local, undoEligible = []) { return finishComputation(materializeSyncDataSteps(model, local, undoEligible)); }
/** Drop expired history payloads using monotone frontiers, retaining business tombstones. @param {Dict} model @param {Dict} local @param {number} now */
export function pruneSyncHistory(model, local, now) { return finishComputation(pruneSyncHistorySteps(model, local, now)); }
/** Validate before merging external state. @param {any} envelope @param {(key: string, value: any) => boolean} [validateSetting] */
export function validateSyncEnvelope(envelope, validateSetting) {
    if (!envelope || envelope.schema !== 1 || envelope.dataVersion > CURRENT_DATA_VERSION) throw Object.assign(new Error("同步数据来自不支持的版本，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
    if (!isSyncObject(envelope) || !Number.isInteger(envelope.dataVersion) || envelope.dataVersion < 0 || typeof envelope.replicaId !== "string" || !UUID.test(envelope.replicaId) || !Number.isSafeInteger(envelope.seq) || envelope.seq < 1 || typeof envelope.createdAt !== "string" || !Number.isFinite(Date.parse(envelope.createdAt))) throw new Error("同步快照格式无效");
    validateSyncState(envelope.state, validateSetting);
    return envelope;
}
/** Shared by network parsing and the final merged-state persistence boundary. @param {any} model @param {(key: string, value: any) => boolean} [validateSetting] */
export function validateSyncState(model, validateSetting) { return finishComputation(validateSyncStateSteps(model, validateSetting)); }
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


/** @param {any[]} items @param {(a: any, b: any) => number} [compare] @returns {Generator<void, any[], unknown>} */
function* sortSteps(items, compare = (a, b) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0) {
    // Most canonical nodes have only a few keys. Keep the native operation
    // bounded, and retain cooperative merge sort for large record dictionaries.
    if (items.length <= 64) { items.sort(compare); yield; return items; }
    let source = items.slice(), target = new Array(items.length);
    for (let width = 1; width < items.length; width *= 2) {
        for (let start = 0; start < items.length; start += 2 * width) {
            const middle = Math.min(start + width, items.length), end = Math.min(start + 2 * width, items.length);
            let left = start, right = middle;
            for (let i = start; i < end; i++) {
                target[i] = left < middle && (right >= end || compare(source[left], source[right]) <= 0) ? source[left++] : source[right++];
                yield;
            }
        }
        [source, target] = [target, source];
    }
    for (let i = 0; i < items.length; i++) { items[i] = source[i]; yield; }
    return items;
}
/** @param {any} value @returns {Generator<void, string, unknown>} */
function* canonicalSteps(value) {
    yield;
    if (value === undefined) return "undefined";
    if (!value || typeof value !== "object") return JSON.stringify(value);
    const parts = [];
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) { parts.push(i in value ? yield* canonicalSteps(value[i]) : ""); yield; }
        return "[" + parts.join(",") + "]";
    }
    const keys = yield* sortSteps(Object.keys(value));
    for (const key of keys) { parts.push(JSON.stringify(key) + ":" + (yield* canonicalSteps(value[key]))); yield; }
    return "{" + parts.join(",") + "}";
}
/** Equality of canonical values without allocating their encodings. Exceptional array slots retain the old encoding semantics.
 * @param {any} left @param {any} right @param {boolean} [ignoreUpdateDate] @param {boolean} [property]
 * @returns {Generator<void, boolean, unknown>} */
function* equalValueSteps(left, right, ignoreUpdateDate = false, property = false) {
    yield;
    const object = (/** @type {any} */ value) => value !== null && typeof value === "object";
    const unusual = (/** @type {any} */ value) => ["function", "symbol", "bigint"].includes(typeof value);
    if (unusual(left) || unusual(right)) {
        const a = yield* canonicalSteps(left), b = yield* canonicalSteps(right);
        return property ? String(a) === String(b) : a === b;
    }
    if (!object(left) || !object(right)) {
        if (object(left) || object(right)) return false;
        if (left === right) return true;
        const a = left === undefined ? "undefined" : JSON.stringify(left), b = right === undefined ? "undefined" : JSON.stringify(right);
        return a === b;
    }
    const array = Array.isArray(left);
    if (array !== Array.isArray(right)) return false;
    if (array) {
        // A lone hole/function encodes like an empty array in the established canonical format.
        if (left.length !== right.length) return left.length <= 1 && right.length <= 1 ? (yield* canonicalSteps(left)) === (yield* canonicalSteps(right)) : false;
        for (let index = 0; index < left.length; index++) {
            if (!(index in left) || !(index in right) || unusual(left[index]) || unusual(right[index])) return (yield* canonicalSteps(left)) === (yield* canonicalSteps(right));
            if (!(yield* equalValueSteps(left[index], right[index]))) return false;
        }
        return true;
    }
    const keys = Object.keys(left).filter(key => !ignoreUpdateDate || key !== "f:updateDate");
    if (keys.length !== Object.keys(right).filter(key => !ignoreUpdateDate || key !== "f:updateDate").length) return false;
    for (const key of keys) {
        if (!Object.prototype.propertyIsEnumerable.call(right, key) || !(yield* equalValueSteps(left[key], right[key], false, true))) return false;
    }
    return true;
}
/** A mismatch must not hide an unsupported value which canonical comparison used to reject.
 * No encoded strings are retained; ordinary JSON leaves need no serialization.
 * @param {any} value @param {boolean} [ignoreUpdateDate] @param {Set<any>} [ancestors]
 * @returns {Generator<void, void, unknown>} */
function* validateComparableSteps(value, ignoreUpdateDate = false, ancestors = new Set()) {
    yield;
    if (!value || typeof value !== "object") {
        if (["bigint", "function", "symbol"].includes(typeof value)) JSON.stringify(value);
        return;
    }
    if (ancestors.has(value)) throw new RangeError("Maximum call stack size exceeded");
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) if (index in value) yield* validateComparableSteps(value[index], false, ancestors);
        } else {
            const keys = yield* sortSteps(Object.keys(value));
            for (const key of keys) if (!ignoreUpdateDate || key !== "f:updateDate") yield* validateComparableSteps(value[key], false, ancestors);
        }
    } finally { ancestors.delete(value); }
}
/** @param {any} left @param {any} right @param {boolean} [ignoreUpdateDate] @returns {Generator<void, boolean, unknown>} */
function* checkedEqualValueSteps(left, right, ignoreUpdateDate = false) {
    const equal = yield* equalValueSteps(left, right, ignoreUpdateDate);
    if (!equal) { yield* validateComparableSteps(left, ignoreUpdateDate); yield* validateComparableSteps(right, ignoreUpdateDate); }
    return equal;
}
/** @param {string} domain @param {any} item @returns {Generator<void, any, unknown>} */
function* fieldSteps(domain, item) {
    if (["setting", "new_video_decisions", "filter_keyword_title", "filter_keyword_review", "highlighted_tags"].includes(domain)) return { value: yield* cloneSteps(item) };
    if (domain === "activity_log") {
        const changes = [];
        for (const change of item.changes || []) { changes.push({ carNum: change.carNum, operation: change.operation, fields: change.fields, undoState: change.undoState }); yield; }
        return { value: { id: item.id, type: item.type, createdAt: item.createdAt, commitState: "committed", originReplicaId: item.originReplicaId, undoAttemptedAt: item.undoAttemptedAt ?? null, changes } };
    }
    if (domain === "offline_history") return { value: yield* cloneSteps(item) };
    /** @type {Dict} */ const result = {};
    for (const [key, value] of Object.entries(item)) {
        if (OMIT.has(key) || key === "stateFlags" || key === "newVideoList") continue;
        Object.defineProperty(result, "f:" + key, { value: yield* cloneSteps(value), enumerable: true, writable: true, configurable: true });
        yield;
    }
    if (domain === "car_list") for (const [key, value] of Object.entries(normalizeStateFlags(item.stateFlags))) { result["flag:" + key] = value; yield; }
    if (domain === "favorite_actresses") for (const video of item.newVideoList || []) {
        const id = normalizeCarNum(typeof video === "string" ? video : video.carNum);
        if (id) result["video:" + id] = yield* cloneSteps(video);
        yield;
    }
    return result;
}

/** @param {Dict} data @param {Dict} frontiers @returns {Generator<void, any, unknown>} */
function* projectSyncDataSteps(data, frontiers) {
    /** @type {Dict} */ const result = {};
    for (const domain of SYNC_DOMAINS) {
        let raw = data[domain];
        if (domain === "blacklist_car_list" && raw?.length) {
            /** @type {Map<string, Dict[]>} */ const groups = new Map();
            for (const item of raw) {
                yield;
                const id = normalizeCarNum(item?.carNum);
                if (!id) throw new Error(`同步记录缺少稳定标识：${domain}`);
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id)?.push(item);
            }
            // Historical blocked cards were keyed by their original spelling.
            // Only merge collisions; retain explicit null/unset values otherwise.
            raw = [];
            for (const group of groups.values()) { raw.push(group.length > 1 ? mergeCanonicalCarRecords(group).list[0] : group[0]); yield; }
        }
        const entries = domain === "setting" || domain === "new_video_decisions" ? Object.entries(raw || {}) : (domain === "activity_log" ? raw?.entries || [] : raw || []).map((/** @type {any} */ item) => [identity(domain, item), item]);
        for (const [id, item] of entries) {
            yield;
            if (domain === "setting" && !isSharedSetting(id)) continue;
            if (HISTORY.has(domain) && (domain === "activity_log" && item.commitState !== "committed" || historyRank(item) <= (frontiers[domain] || ""))) continue;
            if (id == null || id === "") throw new Error(`同步记录缺少稳定标识：${domain}`);
            const key = `${domain}/${encodeURIComponent(id)}`;
            if (Object.hasOwn(result, key)) throw new Error(`同步记录标识重复：${domain}`);
            result[key] = yield* fieldSteps(domain, item);
        }
    }
    return result;
}

/** @param {Dict} model @returns {Generator<void, number, unknown>} */
function* maximumClockSteps(model) {
    let maximum = 0;
    for (const record of Object.values(model.records)) {
        maximum = Math.max(maximum, record.birth?.[0] || 0, record.death?.[0] || 0);
        for (const field of Object.values(record.fields)) { maximum = Math.max(maximum, field.v?.[0] || 0); yield; }
        yield;
    }
    return maximum;
}
/** @param {Dict} model @param {Dict} before @param {Dict} after @param {any} version @param {boolean} [reuseRecords] @returns {Generator<void, any, unknown>} */
function* versionSyncDiffSteps(model, before, after, version, reuseRecords = false) {
    const next = reuseRecords ? { records: { ...model.records }, frontiers: { ...model.frontiers } } : yield* cloneSteps(model);
    let changed = false;
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        yield;
        if (yield* checkedEqualValueSteps(before[key], after[key], true)) continue;
        changed = true;
        let record = next.records[key];
        if (reuseRecords && record) record = next.records[key] = yield* cloneSteps(record);
        if (!Object.hasOwn(after, key)) { if (record) record.death = version; continue; }
        const creating = !record || compareVersion(record.birth, record.death) <= 0 || !Object.hasOwn(before, key);
        if (creating) record = next.records[key] = { birth: version, generation: record?.death ?? null, death: record?.death ?? null, fields: {} };
        for (const name of new Set([...Object.keys(before[key] || {}), ...Object.keys(after[key])])) {
            yield;
            if (!(yield* checkedEqualValueSteps(before[key]?.[name], after[key][name])) || creating && !Object.hasOwn(record.fields, name)) {
                if (creating && (name.startsWith("f:") && (after[key][name] === "" || after[key][name] == null) || name.startsWith("flag:") && after[key][name] === false)) continue;
                record.fields[name] = Object.hasOwn(after[key], name) ? { v: version, value: yield* cloneSteps(after[key][name]) } : { v: version, unset: true };
            }
        }
    }
    return { model: next, changed };
}
/** @param {Dict} left @param {Dict} right @returns {Generator<void, any, unknown>} */
function* joinSyncModelsSteps(left, right) {
    const result = yield* cloneSteps(left);
    for (const [key, incoming] of Object.entries(right.records)) {
        yield;
        const local = result.records[key];
        if (!local) { result.records[key] = yield* cloneSteps(incoming); continue; }
        const generationOrder = compareVersion(local.generation, incoming.generation);
        const fields = generationOrder > 0 ? local.fields : generationOrder < 0 ? incoming.fields : { ...local.fields };
        if (generationOrder === 0) for (const [name, field] of Object.entries(incoming.fields)) {
            const old = fields[name], order = compareVersion(old?.v, field.v);
            if (old && order === 0 && !(yield* checkedEqualValueSteps(old, field))) throw new Error("同步版本冲突：同一版本包含不同数据");
            if (!old || order < 0) fields[name] = yield* cloneSteps(field);
            yield;
        }
        result.records[key] = { generation: generationOrder >= 0 ? local.generation ?? null : incoming.generation ?? null, birth: generationOrder > 0 ? local.birth : generationOrder < 0 ? incoming.birth : compareVersion(local.birth, incoming.birth) >= 0 ? local.birth : incoming.birth, death: compareVersion(local.death, incoming.death) >= 0 ? local.death : incoming.death, fields: yield* cloneSteps(fields) };
    }
    for (const domain of HISTORY) result.frontiers[domain] = String(left.frontiers[domain] || "") > String(right.frontiers[domain] || "") ? left.frontiers[domain] : right.frontiers[domain] || "";
    return result;
}
/** @param {Dict} model @returns {Generator<void, any, unknown>} */
function* visibleSyncRecordsSteps(model) {
    /** @type {Dict} */ const result = {};
    for (const [key, record] of Object.entries(model.records)) {
        yield;
        if (compareVersion(record.birth, record.death) <= 0) continue;
        /** @type {Dict} */ const value = {};
        for (const [name, field] of Object.entries(record.fields)) { if (!field.unset) Object.defineProperty(value, name, { value: yield* cloneSteps(field.value), enumerable: true, configurable: true, writable: true }); yield; }
        const domain = key.split("/")[0];
        if (HISTORY.has(domain) && historyRank(value.value) <= (model.frontiers[domain] || "")) continue;
        result[key] = value;
    }
    return result;
}

/** @param {Dict} model @param {Dict} local @param {string[]} undoEligible @returns {Generator<void, any, unknown>} */
function* materializeSyncDataSteps(model, local, undoEligible) {
    /** @type {Dict} */ const result = Object.fromEntries(SYNC_DOMAINS.map(domain => [domain, ["setting", "new_video_decisions"].includes(domain) ? {} : domain === "activity_log" ? { ...(local.activity_log || {}), entries: [] } : []]));
    result.setting = Object.fromEntries(Object.entries(local.setting || {}).filter(([key]) => !isSharedSetting(key)));
    const eligibleIds = new Set(undoEligible);
    const localActivities = new Map((local.activity_log?.entries || []).map((/** @type {any} */ entry) => [entry.id, entry]));
    const localRecords = new Map(SYNC_DOMAINS.flatMap(domain => Array.isArray(local[domain]) ? local[domain].map((/** @type {any} */ item) => [`${domain}/${identity(domain, item)}`, item]) : []));
    for (const [key, value] of Object.entries(yield* visibleSyncRecordsSteps(model))) {
        yield;
        const slash = key.indexOf("/"), domain = key.slice(0, slash), id = decodeURIComponent(key.slice(slash + 1));
        if (["setting", "new_video_decisions"].includes(domain)) { Object.defineProperty(result[domain], id, { value: value.value, enumerable: true, configurable: true, writable: true }); continue; }
        if (domain === "activity_log") { result.activity_log.entries.push(eligibleIds.has(id) && localActivities.has(id) ? yield* cloneSteps(localActivities.get(id)) : value.value); continue; }
        if (Object.hasOwn(value, "value")) { result[domain].push(value.value); continue; }
        const item = Object.fromEntries(Object.entries(value).filter(([name]) => name.startsWith("f:")).map(([name, field]) => [name.slice(2), field]));
        const old = localRecords.get(`${domain}/${id}`);
        for (const name of ["checkTime", "lastCheckTime"]) if (old && Object.hasOwn(old, name)) item[name] = old[name];
        if (domain === "car_list") { item.carNum = id; item.stateFlags = Object.fromEntries(Object.entries(value).filter(([name]) => name.startsWith("flag:")).map(([name, flag]) => [name.slice(5), flag])); syncLegacyStatus(item); }
        if (domain === "favorite_actresses") item.newVideoList = (yield* sortSteps(Object.entries(value).filter(([name]) => name.startsWith("video:")))).map(([, video]) => video);
        result[domain].push(item);
    }
    result.activity_log.entries.push(...(local.activity_log?.entries || []).filter((/** @type {any} */ entry) => entry.commitState === "pending"));
    yield* sortSteps(result.activity_log.entries, (/** @type {any} */ a, /** @type {any} */ b) => historyRank(a).localeCompare(historyRank(b), "en"));
    yield* sortSteps(result.offline_history, (/** @type {any} */ a, /** @type {any} */ b) => historyRank(a).localeCompare(historyRank(b), "en"));
    for (const domain of SYNC_DOMAINS) if (Array.isArray(result[domain]) && !HISTORY.has(domain)) yield* sortSteps(result[domain], (/** @type {any} */ a, /** @type {any} */ b) => String(identity(domain, a)).localeCompare(String(identity(domain, b)), "en"));
    return result;
}

/** @param {Dict} model @param {Dict} local @param {number} now @returns {Generator<void, any, unknown>} */
function* pruneSyncHistorySteps(model, local, now) {
    const data = yield* materializeSyncDataSteps(model, local, []);
    for (const domain of HISTORY) {
        const entries = domain === "activity_log" ? data[domain].entries.filter((/** @type {any} */ entry) => entry.commitState === "committed") : data[domain];
        let keep = domain === "offline_history" ? 1000 : Math.min(10000, Math.max(1000, entries.filter((/** @type {any} */ entry) => Date.parse(entry.createdAt) >= now - 30 * 86400000).length));
        const removed = entries.slice(0, Math.max(0, entries.length - keep));
        if (removed.length) model.frontiers[domain] = [model.frontiers[domain] || "", historyRank(removed.at(-1))].sort().at(-1);
        for (const [key, record] of Object.entries(model.records)) { if (key.startsWith(`${domain}/`) && historyRank(record.fields.value?.value || {}) <= (model.frontiers[domain] || "")) delete model.records[key]; yield; }
    }
    return model;
}

/** @param {any} model @param {any} validateSetting @returns {Generator<void, any, unknown>} */
function* validateSyncStateSteps(model, validateSetting) {
    if (!isSyncObject(model) || !isSyncObject(model.records)) throw new Error("同步快照格式无效");
    validateSyncFrontiers(model.frontiers);
    const checkVersion = (/** @type {any} */ version) => Array.isArray(version) && version.length === 2 && Number.isSafeInteger(version[0]) && version[0] > 0 && typeof version[1] === "string" && UUID.test(version[1]);
    for (const [key, record] of Object.entries(/** @type {Dict} */ (model.records))) {
        yield;
        const slash = key.indexOf("/"), domain = key.slice(0, slash), encodedId = key.slice(slash + 1);
        let id;
        try { id = decodeURIComponent(encodedId); } catch { throw new Error("同步记录标识无效"); }
        if (slash < 1 || !id || encodeURIComponent(id) !== encodedId || !SYNC_DOMAINS.includes(domain)) throw new Error("同步记录标识无效");
        if (!isSyncObject(record) || !checkVersion(record.birth) || record.death != null && !checkVersion(record.death) || record.generation != null && (!checkVersion(record.generation) || compareVersion(record.birth, record.generation) <= 0) || !isSyncObject(record.fields)) throw new Error("同步字段版本无效");
        if (domain === "setting" && !isSharedSetting(id)) throw new Error("同步快照包含本机专属设置");
        for (const field of Object.values(/** @type {Dict} */ (record.fields))) { yield; if (!isSyncObject(field) || !checkVersion(field.v) || compareVersion(field.v, record.generation) <= 0 || Object.hasOwn(field, "unset") && field.unset !== true || (field.unset === true ? Object.hasOwn(field, "value") : !Object.hasOwn(field, "value"))) throw new Error("同步字段内容无效"); }
        validateSyncRecordFields(domain, id, record, compareVersion(record.birth, record.death) > 0);
        if (domain === "setting" && compareVersion(record.birth, record.death) > 0 && !record.fields.value?.unset && validateSetting?.(id, record.fields.value?.value) === false) throw new Error(`同步设置无效：${id}`);
    }
    return model;
}

/** @param {any} value @param {any} [work] */
export async function syncJsonAsync(value, work) {
    const budget = computationBudget(work), result = await budget.run("sync.serialize", canonicalSteps(value));
    budget.diagnostics?.recordWork("sync.serializedCharacters", result?.length || 0);
    return result;
}
/** @param {any} value @param {any} [work] */
export function syncCloneAsync(value, work) { return computationBudget(work).run("sync.clone", cloneSteps(value)); }

/** @param {any} data @param {any} [frontiers] @param {any} [work] */
export async function projectSyncDataAsync(data, frontiers = {}, work = undefined) {
    const budget = computationBudget(work), result = await budget.run("sync.projectSyncData", projectSyncDataSteps(data, frontiers));
    if (budget.diagnostics?.performanceRecording) budget.diagnostics.recordWork("sync.projectedRecords", Object.keys(result).length);
    return result;
}

/** @param {any} model @param {any} [work] */
export function maximumClockAsync(model, work = undefined) { return computationBudget(work).run("sync.maximumClock", maximumClockSteps(model)); }

/** Locked-snapshot callers may opt into immutable unchanged-record sharing. @param {any} model @param {any} before @param {any} after @param {any} version @param {any} [work] @param {boolean} [reuseRecords] */
export function versionSyncDiffAsync(model, before, after, version, work = undefined, reuseRecords = false) { return computationBudget(work).run("sync.versionSyncDiff", versionSyncDiffSteps(model, before, after, version, reuseRecords)); }

/** @param {any} left @param {any} right @param {any} [work] */
export function joinSyncModelsAsync(left, right, work = undefined) { return computationBudget(work).run("sync.joinSyncModels", joinSyncModelsSteps(left, right)); }

/** @param {any} model @param {any} [work] */
export function visibleSyncRecordsAsync(model, work = undefined) { return computationBudget(work).run("sync.visibleSyncRecords", visibleSyncRecordsSteps(model)); }

/** @param {any} model @param {any} local @param {any} [undoEligible] @param {any} [work] */
export function materializeSyncDataAsync(model, local, undoEligible = [], work = undefined) { return computationBudget(work).run("sync.materializeSyncData", materializeSyncDataSteps(model, local, undoEligible)); }

/** @param {any} model @param {any} local @param {any} now @param {any} [work] */
export function pruneSyncHistoryAsync(model, local, now, work = undefined) { return computationBudget(work).run("sync.pruneSyncHistory", pruneSyncHistorySteps(model, local, now)); }

/** @param {any} model @param {any} [validateSetting] @param {any} [work] */
export function validateSyncStateAsync(model, validateSetting = undefined, work = undefined) { return computationBudget(work).run("sync.validateSyncState", validateSyncStateSteps(model, validateSetting)); }

/** Compare domain entries once; order remains the original insertion order. @param {Dict} before @param {Dict} after @returns {Generator<void, string[], unknown>} */
function* changedKeysSteps(before, after) {
    const changed = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!(yield* checkedEqualValueSteps(before[key], after[key]))) changed.push(key);
        yield;
    }
    return changed;
}
/** @param {any[]} items @param {string} key @returns {Generator<void, Map<string, string>, unknown>} */
function* recordMapSteps(items, key) {
    const result = new Map();
    for (const item of items) { result.set(item[key], yield* canonicalSteps(item)); yield; }
    return result;
}
/** @param {Dict} model @returns {Generator<void, boolean, unknown>} */
function* needsHistoryPruneSteps(model) {
    if (model.frontiers.activity_log || model.frontiers.offline_history) return true;
    let activity = 0, offline = 0;
    for (const key of Object.keys(model.records)) {
        if (key.startsWith("activity_log/") && ++activity > 1000 || key.startsWith("offline_history/") && ++offline > 1000) return true;
        yield;
    }
    return false;
}
/** @param {Dict} before @param {Dict} after @param {any} [work] */
export function changedSyncKeysAsync(before, after, work) { return computationBudget(work).run("sync.compare", changedKeysSteps(before, after)); }
/** Internal semantic comparison; portable encoding and integrity bytes remain canonical. @param {any} left @param {any} right @param {any} [work] */
export function equalSyncValuesAsync(left, right, work) { return computationBudget(work).run("sync.equal", checkedEqualValueSteps(left, right)); }
/** @param {any[]} items @param {string} key @param {any} [work] */
export function syncRecordMapAsync(items, key, work) { return computationBudget(work).run("sync.recordMap", recordMapSteps(items, key)); }
/** Conservative shortcut: at most 1000 history records and no frontier cannot need trimming. @param {Dict} model @param {any} [work] */
export function needsHistoryPruneAsync(model, work) { return computationBudget(work).run("sync.historyCheck", needsHistoryPruneSteps(model)); }

/** Native JSON order/omission semantics for the existing portable envelope. @param {any} value @param {string} [key] @param {Set<any>} [ancestors] @returns {Generator<void, any, unknown>} */
function* stringifySteps(value, key = "", ancestors = new Set()) {
    yield;
    if (value && typeof value.toJSON === "function") value = value.toJSON(key);
    if (!value || typeof value !== "object" || !Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return JSON.stringify(value);
    if (ancestors.has(value)) throw new TypeError("Converting circular structure to JSON");
    ancestors.add(value);
    const parts = [], array = Array.isArray(value);
    if (array) for (let i = 0; i < value.length; i++) parts.push((yield* stringifySteps(value[i], String(i), ancestors)) ?? "null");
    else for (const name of Object.keys(value)) {
        const text = yield* stringifySteps(value[name], name, ancestors);
        if (text !== undefined) parts.push(JSON.stringify(name) + ":" + text);
        yield;
    }
    ancestors.delete(value);
    return (array ? "[" : "{") + parts.join(",") + (array ? "]" : "}");
}
/** @param {any} value @param {any} [work] */
export function stringifySyncDataAsync(value, work) { return computationBudget(work).run("sync.stringify", stringifySteps(value)); }

/** @param {any} envelope @param {any} [validateSetting] @param {any} [work] */
export async function validateSyncEnvelopeAsync(envelope, validateSetting, work) {
    if (!envelope || envelope.schema !== 1 || envelope.dataVersion > CURRENT_DATA_VERSION) throw Object.assign(new Error("同步数据来自不支持的版本，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
    if (!isSyncObject(envelope) || !Number.isInteger(envelope.dataVersion) || envelope.dataVersion < 0 || typeof envelope.replicaId !== "string" || !UUID.test(envelope.replicaId) || !Number.isSafeInteger(envelope.seq) || envelope.seq < 1 || typeof envelope.createdAt !== "string" || !Number.isFinite(Date.parse(envelope.createdAt))) throw new Error("同步快照格式无效");
    await validateSyncStateAsync(envelope.state, validateSetting, work);
    return envelope;
}
