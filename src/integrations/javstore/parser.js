// @ts-check

import { normalizeCarNum } from "../../core/movie-identity.js";

/** 规范 JavStore 资源地址，并升级其自有域名的 HTTP 链接。 */
/** @param {unknown} value @param {string} [baseUrl] */
export function normalizeJavStoreAssetUrl(value, baseUrl = "https://javstore.net") {
    if (!value) return null;
    try {
        const url = new URL(String(value), baseUrl), hostname = url.hostname.toLowerCase();
        if (![ "http:", "https:" ].includes(url.protocol)) return null;
        "http:" === url.protocol && ("javstore.net" === hostname || hostname.endsWith(".javstore.net")) && (url.protocol = "https:");
        return url.href;
    } catch {
        return null;
    }
}

/** 提取 JavStore 搜索页中按原始 DOM 顺序排列的匹配候选。 */
/** @param {any} $searchPage @param {unknown} carNum @param {string} [baseUrl] */
export function parseJavStoreSearch($searchPage, carNum, baseUrl = "https://javstore.net") {
    const normalizedCarNum = normalizeCarNum(carNum);
    if (!normalizedCarNum) return [];
    const wrap = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$ ?? $searchPage.constructor;
    return $searchPage.find('a[href$="-pn.html"]').filter(((/** @type {number} */ index, /** @type {Element} */ element) =>
        wrap(element).text().trim().toUpperCase().includes(normalizedCarNum.toUpperCase())
    )).map(((/** @type {number} */ index, /** @type {Element} */ element) => new URL(wrap(element).attr("href"), baseUrl).href)).get();
}
/** 提取 JavStore 详情页 CLICK HERE! 对应的绝对预览图地址。 */
/** @param {any} $detailPage @param {string} detailUrl */
export function parseJavStorePreview($detailPage, detailUrl) {
    const wrap = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$ ?? $detailPage.constructor;
    /** @param {number} index @param {Element} element */
    const isPreviewLink = (index, element) => "CLICK HERE!" === wrap(element).text().trim();
    const previewHref = $detailPage.find("a").filter(isPreviewLink).first().attr("href");
    if (!previewHref) return null;
    const previewUrl = normalizeJavStoreAssetUrl(previewHref, detailUrl);
    return previewUrl ? previewUrl.replace(".th", "") : null;
}
