// @ts-check

import { isSamePageUrl } from "./batch-scope.js";

/**
 * 跨分页批量扫描器（纯协调逻辑，可单测）：
 * 总是从当前搜索条件的第一页开始逐页解析（firstPageUrl 与当前页不同时先请求第一页），
 * 使用调用方注入的 ListEvaluator 判定，
 * 只收集 matchesCurrentFilter === true 的记录并按番号去重。
 */

/** @param {any} options */
export async function scanAllPages({
    startDom,
    itemSelector,
    nextPageSelector,
    fetchHtml,
    parseItem,
    evaluate,
    isCancelled = () => false,
    onProgress = () => {},
    pageDelayMs = 500,
    maxPages = 200,
    currentUrl = null,
    firstPageUrl = null,
}) {
    /** @type {Array<Record<string, any>>} */
    const records = [];
    const seen = new Set();
    let dom = startDom, page = 1, scanned = 0;
    if (firstPageUrl && currentUrl && !isSamePageUrl(firstPageUrl, currentUrl)) {
        if (isCancelled()) return records;
        const html = await fetchHtml(firstPageUrl);
        if (isCancelled()) return records;
        const parsed = new DOMParser().parseFromString(html, "text/html");
        dom = $(parsed);
    }
    while (dom && dom.length) {
        if (isCancelled()) break;
        onProgress({ page, scanned, matched: records.length });
        const items = dom.find(itemSelector).toArray();
        for (const element of items) {
            if (isCancelled()) break;
            let item = null;
            try { item = parseItem($(element)); } catch { continue; }
            if (!item?.carNum) continue;
            scanned++;
            const evaluated = evaluate(item);
            if (evaluated?.matchesCurrentFilter && !seen.has(item.carNum)) {
                seen.add(item.carNum);
                records.push({ ...item, flags: evaluated.flags, visibilityReasons: evaluated.visibilityReasons, hardHidden: evaluated.hardHidden });
            }
        }
        const nextUrl = dom.find(nextPageSelector).attr("href");
        if (!nextUrl) break;
        if (isCancelled() || page >= maxPages) break;
        if (pageDelayMs) await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
        if (isCancelled()) break;
        const html = await fetchHtml(nextUrl);
        const parsed = new DOMParser().parseFromString(html, "text/html");
        dom = $(parsed);
        page++;
    }
    return records;
}
