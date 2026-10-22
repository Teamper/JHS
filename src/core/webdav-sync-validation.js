// @ts-check

import { normalizeCarNum } from "./constants.js";

const ENTITIES = new Set(["car_list", "blacklist_car_list", "favorite_actresses", "blacklist"]);
const MEMBERS = new Set(["filter_keyword_title", "filter_keyword_review", "highlighted_tags"]);
const OMITTED = new Set(["status", "checkTime", "lastCheckTime", "stateFlags", "newVideoList"]);
const TEXT_METADATA = new Set(["name", "names", "url", "avatar", "remark", "title", "role", "movieType", "actressType", "fc2Source", "createDate", "updateDate", "createTime", "publishTime", "lastPublishTime"]);
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

/** @param {any} value @returns {boolean} */
export function isSyncObject(value) { return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
/** @param {any} value @returns {boolean} */
function jsonValue(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(jsonValue);
    return isSyncObject(value) && Object.values(value).every(jsonValue);
}
/** @param {any} value */
function text(value) { return typeof value === "string"; }
/** @param {any} value */
function date(value) { return text(value) && Number.isFinite(Date.parse(value)); }
/** @param {any} value */
function carId(value) { return text(value) && !!normalizeCarNum(value); }
/** @param {any} value */
function actorId(value) { return (text(value) && value !== "") || typeof value === "number" && Number.isFinite(value); }
/** @param {any} value @param {string} key @param {(value: any) => boolean} test */
function optional(value, key, test) { return !Object.hasOwn(value, key) || value[key] == null || test(value[key]); }
/** Unknown metadata remains JSON-compatible for existing imported records. @param {string} name @param {any} value */
function metadata(name, value) {
    if (!jsonValue(value)) return false;
    if (value === null) return true;
    if (TEXT_METADATA.has(name)) return text(value);
    if (name === "allName") return Array.isArray(value) && value.every(text);
    if (name === "starId") return actorId(value);
    if (name === "carNum") return carId(value);
    return true;
}
/** @param {any} value @param {string} id */
function newVideo(value, id) {
    if (text(value)) return normalizeCarNum(value) === id;
    return isSyncObject(value) && carId(value.carNum) && normalizeCarNum(value.carNum) === id && Object.entries(value).every(([name, item]) => metadata(name, item));
}
/** @param {any} value @param {string} id @param {boolean} activity */
function history(value, id, activity) {
    if (!isSyncObject(value) || value.id !== id || !date(value.createdAt) || !jsonValue(value)) return false;
    if (!activity) return optional(value, "carNum", item => item === "" || carId(item)) && ["providerId", "providerName", "resource", "resourceType", "status", "submissionOutcome", "errorCode", "errorMessage", "retryOf"].every(key => optional(value, key, text));
    return value.commitState === "committed" && optional(value, "type", text) && optional(value, "originReplicaId", item => text(item) && UUID.test(item)) && optional(value, "undoAttemptedAt", date) && Array.isArray(value.changes) && value.changes.every((/** @type {any} */ change) =>
        isSyncObject(change) && carId(change.carNum) && optional(change, "operation", text) && optional(change, "fields", item => Array.isArray(item) && item.every(text)) && optional(change, "undoState", item => ["pending", "reverted", "conflict"].includes(item)));
}
/** Validate field meaning as well as shape; never coerce remote values. @param {string} domain @param {string} id @param {Record<string, any>} record @param {boolean} active */
export function validateSyncRecordFields(domain, id, record, active) {
    const fail = () => { throw new Error(`同步字段内容无效：${domain}/${id}`); };
    const entity = ENTITIES.has(domain), primary = ["car_list", "blacklist_car_list"].includes(domain) ? "carNum" : "starId";
    if (entity && primary === "carNum" && normalizeCarNum(id) !== id) fail();
    for (const [name, field] of Object.entries(record.fields)) {
        let allowed = name === "value" && !entity;
        if (entity && name.startsWith("f:")) allowed = name.length > 2 && !OMITTED.has(name.slice(2));
        if (domain === "car_list" && /^flag:(favorite|downloaded|watched|blocked)$/.test(name)) allowed = true;
        if (domain === "favorite_actresses" && name.startsWith("video:")) allowed = !!name.slice(6) && normalizeCarNum(name.slice(6)) === name.slice(6);
        if (!allowed) fail();
        if (field.unset === true) {
            if (name === `f:${primary}` || name.startsWith("flag:") || name === "value" && active) fail();
            continue;
        }
        const value = field.value;
        if (name.startsWith("f:")) {
            if (!metadata(name.slice(2), value)) fail();
            if (name === `f:${primary}` && (primary === "carNum" ? normalizeCarNum(value) !== id : !actorId(value) || String(value) !== id)) fail();
        } else if (name.startsWith("flag:")) { if (typeof value !== "boolean") fail(); }
        else if (name.startsWith("video:")) { if (!newVideo(value, name.slice(6))) fail(); }
        else if (MEMBERS.has(domain)) { if (!text(value) || value !== id) fail(); }
        else if (domain === "activity_log" || domain === "offline_history") { if (!history(value, id, domain === "activity_log")) fail(); }
        else if (domain === "new_video_decisions") {
            if (!isSyncObject(value) || !jsonValue(value) || !["ignored", "snoozed", "dismissed"].includes(value.action) || !["until", "createdAt", "updatedAt"].every(key => optional(value, key, date))) fail();
        } else if (!jsonValue(value)) fail();
    }
    const required = entity ? `f:${primary}` : "value";
    if (active && (!Object.hasOwn(record.fields, required) || record.fields[required].unset)) fail();
}

/** @param {any} frontiers */
export function validateSyncFrontiers(frontiers) {
    if (!isSyncObject(frontiers)) throw new Error("同步历史边界无效");
    for (const [domain, value] of Object.entries(frontiers)) {
        const parts = typeof value === "string" ? value.split("\u0000") : [];
        if (!["activity_log", "offline_history"].includes(domain) || value !== "" && (parts.length !== 2 || !date(parts[0]) || !parts[1])) throw new Error("同步历史边界无效");
    }
}
