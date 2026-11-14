// @ts-check

import { normalizeCarNum } from "../../core/movie-identity.js";
import { movieCodeKey } from "../../core/movie-code-evidence.js";

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

/** Complete display-code tokens; CID aliases are decoded separately. @param {string} value */
function identityTokens(value) {
    const text = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase();
    return [...text.matchAll(/(?<![A-Z0-9])(?:FC2[\s_-]*(?:PPV[\s_-]*)?\d+|(?:[A-Z]{2,10}|\d{1,3}[A-Z]{2,8})[\s_-]*\d{2,}|\d{6}[\s_-]+\d{2,})(?![A-Z0-9])/g)].map(match => movieCodeKey(match[0]));
}

/** Titles and article slugs contain prose after the primary movie code. */
/** @param {string} value */
function proseIdentityTokens(value) {
    value = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-");
    const tokens = identityTokens(value.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, " "));
    // Compact chapter labels after a movie code are metadata. A leading code or
    // an explicit separated code (CASE-01) retains its identity significance.
    const explicit = identityTokens(value.replace(/\b(?:CASE|PART|VOL(?:UME)?|CHAPTER|DISC|CD|EPISODE|SEASON)[ ]*\d{1,3}\b/gi, " "));
    return tokens.filter((token, index) => index === 0 || !/^(?:CASE|PART|VOL(?:UME)?|CHAPTER|DISC|CD|EPISODE|SEASON)\d{1,3}$/.test(token) || explicit.includes(token));
}

/** @param {string} value @param {string} baseUrl */
function javStoreUrlPath(value, baseUrl) {
    if (!value.trim() || /^[?#]/.test(value.trim())) return "";
    try {
        const url = new URL(value, baseUrl);
        return ["https:", "http:"].includes(url.protocol) ? decodeURIComponent(url.pathname) : "";
    } catch { return ""; }
}

/** Decode aliases only inside a trusted, complete DMM cover URL. */
/** @param {string} value @param {string} baseUrl @param {string} target */
function coverIdentity(value, baseUrl, target) {
    const path = javStoreUrlPath(value, baseUrl);
    const tokens = identityTokens(path);
    try {
        const url = new URL(value, baseUrl);
        const cover = path.match(/^\/(digital\/video|mono\/movie\/adult)\/([a-z0-9_]+)\/\2(?:pl|ps)\.jpg$/i);
        if (url.hostname === "pics.dmm.co.jp" && !url.username && !url.password && cover) {
            const cid = cover[2].toUpperCase();
            if (cid === target) return { tokens: [target], unknown: false };
            const movie = target.match(/^([A-Z]{2,10})(\d{2,5})$/);
            const parts = cid.match(/^(?:H_\d{1,4}|\d{1,3})?([A-Z]{2,10})(\d{2,5})$/);
            const validWidth = cover[1].toLowerCase() !== "digital/video" || parts?.[2].length === 5;
            if (movie && parts && validWidth) {
                const matches = parts[1] === movie[1] && parts[2].padStart(5, "0") === movie[2].padStart(5, "0");
                return { tokens: matches ? [target] : [parts[1] + parts[2]], unknown: false };
            }
        }
    } catch { /* Opaque cover names require confirmation on the detail page. */ }
    return { tokens, unknown: Boolean(value) && tokens.length === 0 };
}

/** @param {string[]} tokens @param {string} target */
function hasConflict(tokens, target) { return tokens.some(token => token !== target); }

/** 与现有 builtin-public 请求策略相同的 HTTPS 自有域范围，并拒绝 URL 用户信息。 @param {string} value @param {string} baseUrl */
function javStoreDetailUrl(value, baseUrl) {
    if (!value.trim()) return null;
    try {
        const url = new URL(value, baseUrl);
        return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "javstore.net" || url.hostname.endsWith(".javstore.net")) ? url : null;
    } catch { return null; }
}

/** Inspect structured card evidence without changing the legacy URL-array contract. */
/** @param {any} page @param {unknown} carNum @param {string} [baseUrl] */
export function inspectJavStoreSearch(page, carNum, baseUrl = "https://javstore.net") {
    const normalized = normalizeCarNum(carNum);
    /** @type {{url: string, requiresDetailIdentity: boolean}[]} */
    const candidates = [];
    const result = { candidates, candidateCount: 0, identityRejected: 0, unrecognizedCount: 0 };
    if (!normalized) return result;
    const target = movieCodeKey(normalized), seen = new Set();
    for (const anchor of queryJavStoreElements(page, "a[href]")) {
        if (anchor.closest("aside, nav, header, footer")) continue;
        const url = javStoreDetailUrl(anchor.getAttribute("href") || "", baseUrl);
        if (!url) continue;
        const title = anchor.querySelector("h3")?.textContent ?? anchor.textContent ?? "";
        const titleTokens = proseIdentityTokens(title);
        const path = javStoreUrlPath(url.href, baseUrl).replace(/^(\/\d+-)\[?(?:FHD(?:\/?SD)?|SD|[48]K)\]?[-_ ]?(?=[A-Z]{2,10}[-_]?\d)/i, "$1");
        const pathTokens = proseIdentityTokens(path);
        const primaryTokens = [...pathTokens, ...titleTokens, ...proseIdentityTokens(anchor.getAttribute("title") || "")];
        if (!(/-pn\.html$/i.test(url.pathname) || anchor.matches("main .grid a"))) {
            if (primaryTokens.includes(target) && anchor.querySelector("h3")) result.unrecognizedCount++;
            continue;
        }
        result.candidateCount++;
        const tokens = [...primaryTokens];
        let unknownCover = false;
        for (const image of anchor.querySelectorAll("img")) {
            const cover = coverIdentity(image.getAttribute("src") || image.getAttribute("data-src") || "", baseUrl, target);
            tokens.push(...proseIdentityTokens(image.getAttribute("alt") || ""), ...proseIdentityTokens(image.getAttribute("title") || ""), ...cover.tokens);
            unknownCover ||= cover.unknown;
        }
        if (!tokens.includes(target)) continue;
        if (hasConflict(tokens, target)) { result.identityRejected++; continue; }
        if (unknownCover && !(titleTokens.includes(target) && pathTokens.includes(target))) {
            result.unrecognizedCount++;
            continue;
        }
        if (seen.has(url.href)) continue;
        seen.add(url.href);
        candidates.push({ url: url.href, requiresDetailIdentity: unknownCover });
    }
    // A recognizable search shell without cards or an explicit empty state
    // indicates a layout change. Detached legacy fragments retain their contract.
    if (!result.candidateCount && !result.unrecognizedCount && queryJavStoreElements(page, "main h1").some(node => /search/i.test(node.textContent || ""))) {
        const text = queryJavStoreElements(page, "main").map(node => node.textContent).join(" ");
        if (!/no (?:results|posts|videos)|nothing found|0 results/i.test(text)) result.unrecognizedCount++;
    }
    return result;
}

/** @param {any} page @param {unknown} carNum @param {string} [baseUrl] */
export function parseJavStoreSearch(page, carNum, baseUrl = "https://javstore.net") {
    return inspectJavStoreSearch(page, carNum, baseUrl).candidates.map(candidate => candidate.url);
}

/** @param {any} page @param {string} detailUrl @param {unknown} [carNum] @param {boolean} [requireIdentity] */
export function inspectJavStorePreview(page, detailUrl, carNum, requireIdentity = false) {
    const normalized = normalizeCarNum(carNum);
    const target = normalized ? movieCodeKey(normalized) : null;
    const articles = queryJavStoreElements(page, "main article");
    const body = articles.find(article => article.querySelector("h1")) || articles[0] || page;
    const titleTokens = queryJavStoreElements(body, "h1").flatMap(node => proseIdentityTokens(node.textContent || ""));
    if (target && hasConflict(titleTokens, target)) return { url: null, reason: "identity" };
    const confirmed = Boolean(target && titleTokens.includes(target));
    let reason = null;
    for (const anchor of queryJavStoreElements(body, "a[href]")) {
        if (anchor.closest("aside, nav, header, footer")) continue;
        const href = anchor.getAttribute("href") || "";
        const previewUrl = normalizeJavStoreAssetUrl(href, detailUrl);
        const explicit = /^CLICK HERE!?$/i.test(anchor.textContent?.trim() || "");
        if (!explicit) {
            if (previewUrl && /_s\.jpg$/i.test(new URL(previewUrl).pathname)) reason ||= "structure";
            continue;
        }
        if (!previewUrl) { reason ||= "structure"; continue; }
        const tokens = [...identityTokens(javStoreUrlPath(href, detailUrl)), ...proseIdentityTokens(anchor.getAttribute("title") || "")];
        if (target && (hasConflict(tokens, target) || requireIdentity && !confirmed && !tokens.includes(target))) {
            reason = "identity";
            continue;
        }
        return { url: previewUrl.replace(/\.th(?=\.[a-z]+(?:[?#]|$))/i, ""), reason: null };
    }
    if (!target) return { url: null, reason };
    const candidates = new Set();
    const selector = articles.length ? "img[src]" : "main img[src]";
    for (const image of queryJavStoreElements(body, selector)) {
        if (image.closest("aside, nav, header, footer")) continue;
        const url = normalizeJavStoreAssetUrl(image.getAttribute("src"), detailUrl);
        if (!url || !/_s\.jpg$/i.test(new URL(url).pathname)) continue;
        const anchor = image.closest("a[href]");
        const tokens = [...identityTokens(javStoreUrlPath(url, detailUrl)), ...proseIdentityTokens(image.getAttribute("alt") || ""), ...proseIdentityTokens(image.getAttribute("title") || "")];
        if (anchor) tokens.push(...identityTokens(javStoreUrlPath(anchor.getAttribute("href") || "", detailUrl)), ...proseIdentityTokens(anchor.getAttribute("title") || ""));
        if (!tokens.includes(target) || hasConflict(tokens, target)) { reason = "identity"; continue; }
        candidates.add(url);
    }
    if (candidates.size === 1) return { url: [...candidates][0], reason: null };
    if (candidates.size > 1) reason = "identity";
    if (!articles.length && queryJavStoreElements(body, "main h1").length) reason ||= "structure";
    return { url: null, reason };
}

/** @param {any} page @param {string} detailUrl @param {unknown} [carNum] */
export function parseJavStorePreview(page, detailUrl, carNum) {
    return inspectJavStorePreview(page, detailUrl, carNum).url;
}
