// @ts-check

/**
 * 批量扫描的范围判定：跨页扫描的“第一页 URL”由各站点 HostAdapter 负责解析
 * （JavBusHostAdapter / JavDbHostAdapter 都实现了 resolveFirstPageUrl），
 * 本模块只保留纯 URL 比较工具。
 */

/** @param {string} value */
function stripTrailingSlashes(value) {
    return value.replace(/\/+$/, "");
}

/**
 * 判断两个 URL 是否指向同一列表页（忽略 hash 与尾部斜杠差异）。
 * @param {string} left @param {string} right
 */
export function isSamePageUrl(left, right) {
    try {
        const a = new URL(left), b = new URL(right);
        return a.origin === b.origin
            && stripTrailingSlashes(a.pathname) === stripTrailingSlashes(b.pathname)
            && a.search === b.search;
    } catch {
        return left === right;
    }
}
