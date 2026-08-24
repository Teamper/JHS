// @ts-check

import { d, g, h, normalizeCarNum, p } from "./constants.js";

/** @typedef {{favorite: boolean, downloaded: boolean, watched: boolean, blocked: boolean}} StateFlags */
/** @type {readonly (keyof StateFlags)[]} */
export const STATE_FLAG_NAMES = Object.freeze([ "favorite", "downloaded", "watched", "blocked" ]);
/** @type {Readonly<Record<string, keyof StateFlags>>} */
const LEGACY_STATUS_TO_FLAG = Object.freeze({ [h]: "favorite", [g]: "downloaded", [p]: "watched", [d]: "blocked" });

/** @returns {StateFlags} */
export function createEmptyStateFlags() {
    return { favorite: !1, downloaded: !1, watched: !1, blocked: !1 };
}

/** 仅供迁移和兼容边界读取旧单值状态。 */
function stateFlagsFromLegacyStatus(/** @type {unknown} */ status) {
    const flags = createEmptyStateFlags(), flag = typeof status === "string" ? LEGACY_STATUS_TO_FLAG[status] : undefined;
    if (flag) flags[flag] = !0;
    return flags;
}

export function normalizeStateFlags(/** @type {Partial<StateFlags> | null | undefined} */ flags) {
    const normalized = createEmptyStateFlags();
    return STATE_FLAG_NAMES.forEach((name => normalized[name] = !0 === flags?.[name])), normalized;
}

function projectLegacyStatus(/** @type {Partial<StateFlags> | null | undefined} */ flags) {
    const normalized = normalizeStateFlags(flags);
    return normalized.blocked ? d : normalized.watched ? p : normalized.downloaded ? g : normalized.favorite ? h : "";
}

/** legacy status 只能由此函数生成，避免双源漂移。 */
export function syncLegacyStatus(/** @type {Record<string, any>} */ record) {
    return record.stateFlags = normalizeStateFlags(record.stateFlags), record.status = projectLegacyStatus(record.stateFlags), record;
}

export function hasAnyState(/** @type {Partial<StateFlags> | null | undefined} */ flags) {
    const normalized = normalizeStateFlags(flags);
    return STATE_FLAG_NAMES.some((name => normalized[name]));
}

export function legacyActionToFlag(/** @type {unknown} */ actionType) {
    return typeof actionType === "string" ? LEGACY_STATUS_TO_FLAG[actionType] || null : null;
}

export function mergeCanonicalCarRecords(/** @type {Record<string, any>[]} */ records) {
    /** @type {Map<string, Array<{original: unknown, item: Record<string, any>}>>} */
    const groups = new Map;
    /** @type {Array<Record<string, any>>} */
    const collisions = [];
    /** @type {Array<Record<string, any>>} */
    const unknownStatuses = [];
    records.filter(Boolean).forEach((record => {
        const original = record.carNum, carNum = normalizeCarNum(original);
        if (!carNum) return;
        const item = { ...record, carNum, stateFlags: record.stateFlags ? normalizeStateFlags(record.stateFlags) : stateFlagsFromLegacyStatus(record.status) };
        record.stateFlags || !record.status || LEGACY_STATUS_TO_FLAG[record.status] || unknownStatuses.push({ carNum, status: record.status });
        const group = groups.get(carNum) || [];
        group.push({ original, item }), groups.set(carNum, group);
    }));
    /** @type {Record<string, any>[]} */
    const list = [];
    for (const [carNum, group] of groups) {
        const sorted = group.map((entry => entry.item)).sort(((left, right) => String(left.updateDate || "").localeCompare(String(right.updateDate || ""))));
        /** @type {Record<string, any>} */
        const merged = {};
        const flags = createEmptyStateFlags();
        sorted.forEach((record => {
            Object.entries(record).forEach((([key, value]) => null != value && "" !== value && "stateFlags" !== key && "status" !== key && (merged[key] = value)));
            STATE_FLAG_NAMES.forEach((name => flags[name] = flags[name] || record.stateFlags[name]));
        }));
        const createDates = sorted.map((item => item.createDate)).filter(Boolean).sort(), updateDates = sorted.map((item => item.updateDate)).filter(Boolean).sort();
        createDates.length && (merged.createDate = createDates[0]), updateDates.length && (merged.updateDate = updateDates.at(-1));
        merged.carNum = carNum, merged.stateFlags = flags, syncLegacyStatus(merged), list.push(merged);
        const originals = [ ...new Set(group.map((entry => entry.original)).filter(Boolean)) ];
        originals.length > 1 && collisions.push({ carNum, originals, count: group.length });
    }
    return { list, collisions, unknownStatuses };
}
