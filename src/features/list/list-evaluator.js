// @ts-check

import { normalizeStateFlags } from "../../core/state-model.js";
import { isHardHidden, matchesQuickFilter } from "./list-filters.js";

/** @typedef {import("../../core/state-model.js").StateFlags} StateFlags */
/** @typedef {{ keyword?: boolean, actorBlacklist?: boolean, actressBlacklist?: boolean }} VisibilityReasons */

/**
 * 唯一列表判定器：页面展示、AutoPage 增量、跨页批量操作共用同一套
 * 屏蔽 / 状态 / 关键词 / 演员黑名单 / recent 语义，禁止第二套筛选判断。
 */

/** @param {string[]} keywords @param {string} title @param {string} carNum */
export function findMatchedTitleKeyword(keywords, title, carNum) {
    for (const keyword of keywords) if (title.includes(keyword) || carNum.startsWith(keyword)) return keyword;
    return null;
}

/** @param {{ titleKeywords?: string[], carMap?: Map<string, Record<string, any>>, actorCarNumToNameMap?: Map<string, string>, actressCarNumToNameMap?: Map<string, string>, recentCarNums?: Set<string>, settings?: Record<string, any> }} options */
export function createListEvaluationContext(options = {}) {
    return {
        titleKeywords: Array.isArray(options.titleKeywords) ? options.titleKeywords : [],
        carMap: options.carMap instanceof Map ? options.carMap : new Map(),
        actorCarNumToNameMap: options.actorCarNumToNameMap instanceof Map ? options.actorCarNumToNameMap : new Map(),
        actressCarNumToNameMap: options.actressCarNumToNameMap instanceof Map ? options.actressCarNumToNameMap : new Map(),
        recentCarNums: options.recentCarNums instanceof Set ? options.recentCarNums : new Set(),
        settings: options.settings ?? {},
    };
}

/**
 * @param {{ carNum?: string | null, title?: string }} record
 * @param {ReturnType<typeof createListEvaluationContext>} context
 * @param {{ filter?: unknown }} [options]
 * @returns {{ flags: StateFlags, visibilityReasons: VisibilityReasons, recent: boolean, hardHidden: boolean, matchesCurrentFilter: boolean }}
 */
export function evaluateListItem(record, context, { filter = "waitCheck" } = {}) {
    const carNum = record?.carNum;
    const state = carNum ? context.carMap.get(carNum) : null;
    const flags = normalizeStateFlags(state?.stateFlags);
    const keyword = context.titleKeywords.length && carNum ? findMatchedTitleKeyword(context.titleKeywords, record.title || "", carNum) : null;
    const visibilityReasons = {
        keyword: !!keyword,
        actorBlacklist: carNum ? context.actorCarNumToNameMap.has(carNum) : false,
        actressBlacklist: carNum ? context.actressCarNumToNameMap.has(carNum) : false,
    };
    const recent = carNum ? context.recentCarNums.has(carNum) : false;
    const hardHidden = isHardHidden(flags, visibilityReasons);
    return {
        flags,
        visibilityReasons,
        recent,
        hardHidden,
        matchesCurrentFilter: matchesQuickFilter(filter, flags, { visibilityReasons, recent }),
    };
}
