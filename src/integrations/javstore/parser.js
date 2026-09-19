// @ts-check

import { normalizeCarNum } from "../../core/movie-identity.js";

/** @param {any} page */
function resolveDocument(page) {
    if (typeof page === "string") return new DOMParser().parseFromString(page, "text/html");
    if (typeof page?.querySelectorAll === "function") return page;
    const candidate = page?.[0] ?? page?.get?.(0);
    if (typeof candidate?.querySelectorAll === "function") return candidate;
    throw new TypeError("JavStore document is invalid");
}

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
    if (typeof $searchPage?.find === "function") {
        const wrap = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$ ?? $searchPage.constructor;
        return $searchPage.find('a[href$="-pn.html"]')
            .filter(((/** @type {number} */ index, /** @type {Element} */ element) => wrap(element).text().trim().toUpperCase().includes(normalizedCarNum.toUpperCase())))
            .map(((/** @type {number} */ index, /** @type {Element} */ element) => new URL(wrap(element).attr("href"), baseUrl).href)).get();
    }
    return [...resolveDocument($searchPage).querySelectorAll('a[href$="-pn.html"]')]
        .filter((element) => element.textContent?.trim().toUpperCase().includes(normalizedCarNum.toUpperCase()))
        .map((element) => new URL(element.getAttribute("href") || "", baseUrl).href);
}
/** 提取 JavStore 详情页 CLICK HERE! 对应的绝对预览图地址。 */
/** @param {any} $detailPage @param {string} detailUrl */
export function parseJavStorePreview($detailPage, detailUrl) {
    if (typeof $detailPage?.find === "function") {
        const wrap = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$ ?? $detailPage.constructor;
        const link = $detailPage.find("a").filter(((/** @type {number} */ index, /** @type {Element} */ element) => "CLICK HERE!" === wrap(element).text().trim())).first();
        const previewHref = link.attr("href");
        if (!previewHref) return null;
        const previewUrl = normalizeJavStoreAssetUrl(previewHref, detailUrl);
        return previewUrl ? previewUrl.replace(".th", "") : null;
    }
    const previewHref = [...resolveDocument($detailPage).querySelectorAll("a")]
        .find((element) => element.textContent?.trim() === "CLICK HERE!")?.getAttribute("href");
    if (!previewHref) return null;
    const previewUrl = normalizeJavStoreAssetUrl(previewHref, detailUrl);
    return previewUrl ? previewUrl.replace(".th", "") : null;
}
