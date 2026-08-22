const STATE_FLAG_NAMES = Object.freeze([ "favorite", "downloaded", "watched", "blocked" ]);
const LEGACY_STATUS_TO_FLAG = Object.freeze({ [h]: "favorite", [g]: "downloaded", [p]: "watched", [d]: "blocked" });

function createEmptyStateFlags() {
    return { favorite: !1, downloaded: !1, watched: !1, blocked: !1 };
}

/** 仅供迁移和兼容边界读取旧单值状态。 */
function stateFlagsFromLegacyStatus(status) {
    const flags = createEmptyStateFlags(), flag = LEGACY_STATUS_TO_FLAG[status];
    return flag && (flags[flag] = !0), flags;
}

function normalizeStateFlags(flags) {
    const normalized = createEmptyStateFlags();
    return STATE_FLAG_NAMES.forEach((name => normalized[name] = !0 === flags?.[name])), normalized;
}

function projectLegacyStatus(flags) {
    const normalized = normalizeStateFlags(flags);
    return normalized.blocked ? d : normalized.watched ? p : normalized.downloaded ? g : normalized.favorite ? h : "";
}

/** legacy status 只能由此函数生成，避免双源漂移。 */
function syncLegacyStatus(record) {
    return record.stateFlags = normalizeStateFlags(record.stateFlags), record.status = projectLegacyStatus(record.stateFlags), record;
}

function hasAnyState(flags) {
    const normalized = normalizeStateFlags(flags);
    return STATE_FLAG_NAMES.some((name => normalized[name]));
}

function legacyActionToFlag(actionType) {
    return LEGACY_STATUS_TO_FLAG[actionType] || null;
}

function mergeCanonicalCarRecords(records) {
    const groups = new Map, collisions = [], unknownStatuses = [];
    records.filter(Boolean).forEach((record => {
        const original = record.carNum, carNum = normalizeCarNum(original);
        if (!carNum) return;
        const item = { ...record, carNum, stateFlags: record.stateFlags ? normalizeStateFlags(record.stateFlags) : stateFlagsFromLegacyStatus(record.status) };
        record.stateFlags || !record.status || LEGACY_STATUS_TO_FLAG[record.status] || unknownStatuses.push({ carNum, status: record.status });
        const group = groups.get(carNum) || [];
        group.push({ original, item }), groups.set(carNum, group);
    }));
    const list = [];
    for (const [carNum, group] of groups) {
        const sorted = group.map((entry => entry.item)).sort(((left, right) => String(left.updateDate || "").localeCompare(String(right.updateDate || ""))));
        const merged = {}, flags = createEmptyStateFlags();
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
