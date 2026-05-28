/** 按字段为数组数据构建运行时索引。 */
function createIndexedMap(items, key) {
    return new Map(items.filter((item => item && item[key])).map((item => [ item[key], item ])));
}

/** 为番号状态构建运行时 Set 索引。 */
function createStatusMap(items) {
    const statusMap = {
        [d]: new Set,
        [h]: new Set,
        [g]: new Set,
        [p]: new Set
    };
    items.forEach((item => {
        item && Object.prototype.hasOwnProperty.call(statusMap, item.status) && statusMap[item.status].add(item.carNum);
    }));
    return statusMap;
}

/** 统计指定字段的重复值。 */
function groupDuplicateItems(items, key) {
    const counts = new Map;
    items.forEach((item => {
        const value = item && item[key];
        value && counts.set(value, (counts.get(value) || 0) + 1);
    }));
    return Array.from(counts.entries()).filter((item => item[1] > 1));
}

/** 按字段去重，保留第一条记录并合并后续字段。 */
function dedupeByKey(items, key) {
    const seen = new Map, list = [];
    let changed = !1;
    for (const item of items) {
        const value = item && item[key];
        if (!value) {
            list.push(item);
            continue;
        }
        if (seen.has(value)) {
            Object.assign(seen.get(value), item), changed = !0;
        } else seen.set(value, item), list.push(item);
    }
    return {
        list,
        changed
    };
}
