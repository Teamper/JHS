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

/** Preserve every detached HTML root supported by the legacy jQuery response interface. @param {any} page @param {string} selector @returns {Element[]} */
function queryJavStoreElements(page, selector) {
    return page?.jquery && typeof page.find === "function"
        ? Array.from(page.find(selector))
        : [...resolveDocument(page).querySelectorAll(selector)];
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

/** 仅把编号的大小写、宽度和分隔符作为等价形式；FC2 的 PPV 段可省略。 @param {string} value */
function javStoreIdentityKey(value) {
    const normalized = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase();
    const fc2 = normalized.match(/^FC2[\s_-]*(?:PPV[\s_-]*)?(\d+)$/);
    return fc2 ? `FC2-${fc2[1]}` : normalized.replace(/[\s_-]+/g, "");
}

/** 提取完整编号，不以查询参数或编号子串作为匹配证据。 @param {string} value */
function javStoreIdentityTokens(value) {
    const text = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase();
    // Bare numeric path segments are article/image IDs, not independent movie-number evidence.
    return [...text.matchAll(/(?<![A-Z0-9])(?:FC2[\s_-]*(?:PPV[\s_-]*)?\d+|(?:[A-Z]{2,10}|\d{1,3}[A-Z]{2,8})[\s_-]*\d{2,}|\d{6}[\s_-]+\d{2,})(?![A-Z0-9])/g)].map(match => javStoreIdentityKey(match[0]));
}

/** @param {string} value @param {string} baseUrl */
function javStoreUrlPath(value, baseUrl) {
    if (!value.trim() || /^[?#]/.test(value.trim())) return "";
    try {
        const url = new URL(value, baseUrl);
        return ["https:", "http:"].includes(url.protocol) ? decodeURIComponent(url.pathname) : "";
    } catch { return ""; }
}

/** 全部可识别编号必须一致，且至少存在一项目标编号证据。 @param {string[]} evidence @param {string} target */
function matchesJavStoreIdentity(evidence, target) {
    const tokens = evidence.flatMap(javStoreIdentityTokens);
    return tokens.length > 0 && tokens.every(token => token === target);
}

/** 与现有 builtin-public 请求策略相同的 HTTPS 自有域范围，并拒绝 URL 用户信息。 @param {string} value @param {string} baseUrl */
function javStoreDetailUrl(value, baseUrl) {
    if (!value.trim()) return null;
    try {
        const url = new URL(value, baseUrl);
        return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "javstore.net" || url.hostname.endsWith(".javstore.net")) ? url : null;
    } catch { return null; }
}

/** 提取 JavStore 搜索页中按原始 DOM 顺序排列的匹配候选。 */
/** @param {any} $searchPage @param {unknown} carNum @param {string} [baseUrl] */
export function parseJavStoreSearch($searchPage, carNum, baseUrl = "https://javstore.net") {
    const normalizedCarNum = normalizeCarNum(carNum);
    if (!normalizedCarNum) return [];
    const target = javStoreIdentityKey(normalizedCarNum), candidates = new Set();
    for (const anchor of queryJavStoreElements($searchPage, "a[href]")) {
        const url = javStoreDetailUrl(anchor.getAttribute("href") || "", baseUrl);
        if (!url || !(/-pn\.html$/i.test(url.pathname) || anchor.matches("main .grid a"))) continue;
        const evidence = [javStoreUrlPath(url.href, baseUrl), anchor.textContent || "", anchor.getAttribute("title") || ""];
        for (const image of anchor.querySelectorAll("img")) evidence.push(image.getAttribute("alt") || "", image.getAttribute("title") || "", javStoreUrlPath(image.getAttribute("src") || "", baseUrl));
        if (matchesJavStoreIdentity(evidence, target)) candidates.add(url.href);
    }
    return [...candidates];
}
/** 提取 JavStore 详情页 CLICK HERE! 对应的绝对预览图地址。 */
/** @param {any} $detailPage @param {string} detailUrl @param {unknown} [carNum] */
export function parseJavStorePreview($detailPage, detailUrl, carNum) {
    const previewHref = queryJavStoreElements($detailPage, "a")
        .find(element => /^CLICK HERE!?$/.test(element.textContent?.trim() || ""))?.getAttribute("href");
    if (previewHref) {
        const previewUrl = normalizeJavStoreAssetUrl(previewHref, detailUrl);
        return previewUrl ? previewUrl.replace(".th", "") : null;
    }
    const normalizedCarNum = normalizeCarNum(carNum);
    if (!normalizedCarNum) return null;
    const target = javStoreIdentityKey(normalizedCarNum), candidates = new Set();
    for (const image of queryJavStoreElements($detailPage, "main img[src]")) {
        if (image.closest("aside, nav, header, footer")) continue;
        const url = normalizeJavStoreAssetUrl(image.getAttribute("src"), detailUrl);
        if (!url || !/_s\.jpg$/i.test(new URL(url).pathname)) continue;
        const anchor = image.closest("a[href]");
        const evidence = [javStoreUrlPath(url, detailUrl), image.getAttribute("alt") || "", image.getAttribute("title") || ""];
        if (anchor) evidence.push(javStoreUrlPath(anchor.getAttribute("href") || "", detailUrl), anchor.getAttribute("title") || "");
        if (matchesJavStoreIdentity(evidence, target)) candidates.add(url);
    }
    return candidates.size === 1 ? [...candidates][0] : null;
}
