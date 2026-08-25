// @ts-check

/**
 * 批量扫描的范围解析：无论用户当前停在哪一页，批量操作都从
 * “当前演员/搜索条件”的第一页开始扫描，避免从第 2/3 页启动时漏掉前面页面。
 */

/** JavBus 带分页的列表路径前缀（除 /page/N 外的 /<prefix>/<id>/N 形式）。 */
const JAVBUS_LIST_PREFIXES = new Set([ "star", "genre", "maker", "actress", "series", "tag" ]);

/** @param {string} value */
function stripTrailingSlashes(value) {
    return value.replace(/\/+$/, "");
}

/**
 * 解析当前搜索条件的第一页 URL。
 * - javdb：删除 page 查询参数（保留其余搜索条件）。
 * - javbus：去掉路径末尾 /page/N，以及 /star|genre|maker|actress|series|tag/<id>/N 的页码段。
 * - 其他/无法解析：原样返回。
 * @param {string} currentUrl @param {string | null | undefined} site
 */
export function resolveFirstPageUrl(currentUrl, site) {
    try {
        const url = new URL(currentUrl);
        if (site === "javdb") {
            url.searchParams.delete("page");
            return url.href;
        }
        if (site === "javbus") {
            const segments = url.pathname.split("/").filter(Boolean);
            const last = segments[segments.length - 1];
            const secondLast = segments[segments.length - 2];
            if (segments.length >= 2 && /^\d+$/.test(last)) {
                const removable = secondLast === "page"
                    || (segments.length >= 3 && JAVBUS_LIST_PREFIXES.has(segments[segments.length - 3]) && !/^\d+$/.test(secondLast));
                if (removable) {
                    const remaining = secondLast === "page" ? segments.slice(0, -2) : segments.slice(0, -1);
                    url.pathname = remaining.length ? "/" + remaining.join("/") : "/";
                }
            }
            return url.href;
        }
    } catch {
        // 非法 URL 直接回退当前地址。
    }
    return currentUrl;
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
