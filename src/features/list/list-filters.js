// @ts-check

import { hasAnyState } from "../../core/state-model.js";

/** @typedef {import("../../core/state-model.js").StateFlags} StateFlags */
/** @typedef {{ keyword?: boolean, actorBlacklist?: boolean, actressBlacklist?: boolean }} VisibilityReasons */

export const QUICK_FILTER_LABELS = Object.freeze({
    all: "全部", waitCheck: "待鉴定", favorite: "收藏", hasDown: "下载", hasWatch: "已看",
    blockedItems: "屏蔽项", favoriteUndownloaded: "收藏未下载", favoriteUnwatched: "收藏未观看",
    downloadedUnwatched: "下载未观看", recent7d: "最近 7 天"
});

/** @typedef {keyof typeof QUICK_FILTER_LABELS} QuickFilterKey */
/** @type {ReadonlyArray<QuickFilterKey>} */
export const PRIMARY_QUICK_FILTERS = Object.freeze([ "all", "waitCheck", "favorite", "hasDown", "hasWatch" ]);
/** @type {ReadonlyArray<QuickFilterKey>} */
export const SECONDARY_QUICK_FILTERS = Object.freeze([ "blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d" ]);
const VALID_QUICK_FILTERS = new Set([ ...PRIMARY_QUICK_FILTERS, ...SECONDARY_QUICK_FILTERS ]);

/** @param {unknown} value @returns {QuickFilterKey} */
export function normalizeQuickFilterKey(value) {
    if ("filter" === value) return "blockedItems";
    return "string" === typeof value && VALID_QUICK_FILTERS.has(/** @type {QuickFilterKey} */ (value)) ? /** @type {QuickFilterKey} */ (value) : "waitCheck";
}

/** @param {StateFlags} flags @param {VisibilityReasons} [visibilityReasons] */
export function isHardHidden(flags, visibilityReasons = {}) {
    return Boolean(flags.blocked || visibilityReasons.keyword || visibilityReasons.actorBlacklist || visibilityReasons.actressBlacklist);
}

/** @param {unknown} filter @param {StateFlags} flags @param {{ visibilityReasons?: VisibilityReasons, recent?: boolean }} [options] */
export function matchesQuickFilter(filter, flags, { visibilityReasons = {}, recent = !1 } = {}) {
    const normalizedFilter = normalizeQuickFilterKey(filter), hardHidden = isHardHidden(flags, visibilityReasons);
    // 语义冻结："全部"是包含所有 hard-hidden 的真全集；"屏蔽项"单独展示；其余状态筛选排除 hard-hidden。
    if ("all" === normalizedFilter) return !0;
    if ("blockedItems" === normalizedFilter) return hardHidden;
    if (hardHidden) return !1;
    if ("waitCheck" === normalizedFilter) return !hasAnyState(flags);
    if ("favorite" === normalizedFilter) return !!flags.favorite;
    if ("hasDown" === normalizedFilter) return !!flags.downloaded;
    if ("hasWatch" === normalizedFilter) return !!flags.watched;
    if ("favoriteUndownloaded" === normalizedFilter) return !!flags.favorite && !flags.downloaded;
    if ("favoriteUnwatched" === normalizedFilter) return !!flags.favorite && !flags.watched;
    if ("downloadedUnwatched" === normalizedFilter) return !!flags.downloaded && !flags.watched;
    return "recent7d" === normalizedFilter && recent;
}

/** @param {{ filter: unknown, flags: StateFlags, visibilityReasons?: VisibilityReasons, recent?: boolean }} item */
export function shouldShowItem({ filter, flags, visibilityReasons, recent }) {
    return matchesQuickFilter(filter, flags, { visibilityReasons, recent });
}
