// @ts-check

import { d, g, h, p } from "./constants.js";
import { normalizeStateFlags } from "./state-model.js";

/** 按字段为数组数据构建运行时索引。 */
export function createIndexedMap(/** @type {Record<string, any>[]} */ items, /** @type {string} */ key) {
    return new Map(items.filter((item => item && item[key])).map((item => [ item[key], item ])));
}

/** 为番号组合状态构建运行时 Set 索引。 */
export function createStatusMap(/** @type {Record<string, any>[]} */ items) {
    const statusMap = {
        [d]: new Set,
        [h]: new Set,
        [g]: new Set,
        [p]: new Set
    };
    items.forEach((item => {
        if (!item?.carNum) return;
        const flags = normalizeStateFlags(item.stateFlags);
        flags.blocked && statusMap[d].add(item.carNum), flags.favorite && statusMap[h].add(item.carNum),
        flags.downloaded && statusMap[g].add(item.carNum), flags.watched && statusMap[p].add(item.carNum);
    }));
    return statusMap;
}

/** 统计指定字段的重复值。 */
export function groupDuplicateItems(/** @type {Record<string, any>[]} */ items, /** @type {string} */ key) {
    /** @type {Map<any, number>} */
    const counts = new Map;
    items.forEach((item => {
        const value = item && item[key];
        value && counts.set(value, (counts.get(value) || 0) + 1);
    }));
    return Array.from(counts.entries()).filter((item => item[1] > 1));
}

/** 按字段去重，保留第一条记录并合并后续字段。 */
export function dedupeByKey(/** @type {Record<string, any>[]} */ items, /** @type {string} */ key) {
    /** @type {Map<any, Record<string, any>>} */
    const seen = new Map;
    /** @type {Record<string, any>[]} */
    const list = [];
    let changed = !1;
    for (const item of items) {
        const value = item && item[key];
        if (!value) {
            list.push(item);
            continue;
        }
        const existing = seen.get(value);
        if (existing) {
            Object.assign(existing, item), changed = !0;
        } else seen.set(value, item), list.push(item);
    }
    return {
        list,
        changed
    };
}
