// @ts-check

import { normalizeCarNum } from "../../core/movie-identity.js";
import { movieCodeKey, movieCodeTokens } from "../../core/movie-code-evidence.js";

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

/** JavStore uses the MGS maker prefix for GANA articles. @param {string} value */
function javStoreCodeKey(value) {
    return movieCodeKey(value).replace(/^200(GANA\d{2,})$/, "$1");
}

const MOVIE_CODE_PATTERN = /(?<![A-Z0-9])(?:FC2[\s_-]*(?:PPV[\s_-]*)?\d+|(?:[A-Z]{2,10}|\d{1,3}[A-Z]{2,8})[\s_-]*\d{2,}|\d{6}[\s_-]+\d{2,})(?![A-Z0-9])/g;
const QUALITY_PREFIX = /^(?:\[(?:ENGSUB|FHD(?:\/?SD)?|SD|[48]K)\][-_\s]*|(?:ENGSUB|FHD(?:\/?SD)?|SD|[48]K)[-_\s]+)+/i;

/** Complete display-code tokens; structured cover IDs are decoded separately. @param {string} value */
function identityTokens(value) {
    const text = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase();
    return [...text.matchAll(MOVIE_CODE_PATTERN)].map(match => javStoreCodeKey(match[0]));
}

/** @param {string} value */
function readHeading(value) {
    const text = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").trim().replace(QUALITY_PREFIX, "");
    const match = text.toUpperCase().matchAll(MOVIE_CODE_PATTERN).next().value;
    if (match?.index !== 0) return { code: "", title: text };
    return { code: javStoreCodeKey(match[0]), title: text.slice(match[0].length).replace(/^[-_\s:]+/, "") };
}

/** @param {string} value */
function titleKey(value) {
    return value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");
}

/** @param {string} code @param {string} target */
function differentSerial(code, target) {
    if (!code || code === target) return false;
    if (code.startsWith("FC2-") && target.startsWith("FC2-")) return true;
    const series = code.match(/^\d{0,3}([A-Z]+)(\d+)$/);
    const expected = target.match(/^\d{0,3}([A-Z]+)(\d+)$/);
    return Boolean(series && expected && series[1] === expected[1] && series[2] !== expected[2]);
}

/** @param {string} code */
function withoutMakerPrefix(code) {
    return code.replace(/^\d{1,3}(?=[A-Z])/, "");
}

/** @param {string} title @param {string} carNum */
export function javStoreTitleQuery(title, carNum) {
    const heading = readHeading(title);
    return !heading.code || heading.code === javStoreCodeKey(carNum) ? heading.title : title.trim();
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

/** Read product codes from recognized cover URL structures. */
/** @param {string} value @param {string} baseUrl @param {string} target */
function coverIdentity(value, baseUrl, target) {
    const path = javStoreUrlPath(value, baseUrl);
    const tokens = identityTokens(path);
    try {
        const url = new URL(value, baseUrl);
        const cover = path.match(/^\/(digital\/video|mono\/movie\/adult)\/([a-z0-9_]+)\/\2(?:pl|ps)\.jpg$/i);
        if (url.hostname === "pics.dmm.co.jp" && !url.username && !url.password && cover) {
            const cid = cover[2].toUpperCase();
            if (cid === target) return { tokens: [target], unknown: false, structured: true };
            const movie = target.match(/^([A-Z]{2,10})(\d{2,5})$/);
            const parts = cid.match(/^(?:H_\d{1,4}|\d{1,3})?([A-Z]{2,10})(\d{2,5})$/);
            const validWidth = cover[1].toLowerCase() !== "digital/video" || parts?.[2].length === 5;
            if (movie && parts && validWidth) {
                const matches = parts[1] === movie[1] && parts[2].padStart(5, "0") === movie[2].padStart(5, "0");
                return { tokens: matches ? [target] : [parts[1] + parts[2]], unknown: false, structured: true };
            }
        }
        if (url.origin === "https://image.mgstage.com" && !url.username && !url.password) {
            // The path repeats the product code, while the pake index identifies the cover variant.
            const mgstage = path.match(/^\/images\/(?:[a-z0-9_-]+\/)*(\d{1,3}[a-z]{2,8})\/(\d{2,})\/pake-\d{2}(?:_sp)?-\1-\2\.jpg$/i);
            if (mgstage) return { tokens: [javStoreCodeKey(`${mgstage[1]}-${mgstage[2]}`)], unknown: false, structured: true };
        }
    } catch { /* Opaque cover names require confirmation on the detail page. */ }
    return { tokens, unknown: Boolean(value) && tokens.length === 0, structured: false };
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

/** @typedef {{url: string, requiresDetailIdentity: boolean, articleKey?: string, articleCode?: string, rank?: number, coverMatch?: boolean}} JavStoreArticle */

/** Inspect structured card evidence without changing the legacy URL-array contract.
 * @param {any} page @param {unknown} carNum @param {string} [baseUrl] @param {{title?: string} | null} [preview] */
export function inspectJavStoreSearch(page, carNum, baseUrl = "https://javstore.net", preview = null) {
    const normalized = normalizeCarNum(carNum);
    /** @type {JavStoreArticle[]} */
    const candidates = [];
    const result = { candidates, candidateCount: 0, identityRejected: 0, unrecognizedCount: 0 };
    if (!normalized) return result;
    const target = javStoreCodeKey(normalized), seen = new Set();
    const originalTitle = titleKey(preview?.title || "");
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
        const coverCodes = [];
        let unknownCover = false;
        for (const image of anchor.querySelectorAll("img")) {
            const cover = coverIdentity(image.getAttribute("src") || image.getAttribute("data-src") || "", baseUrl, target);
            tokens.push(...proseIdentityTokens(image.getAttribute("alt") || ""), ...proseIdentityTokens(image.getAttribute("title") || ""), ...cover.tokens);
            unknownCover ||= cover.unknown;
            if (cover.structured) coverCodes.push(...cover.tokens);
        }
        if (preview) {
            const heading = readHeading(title);
            const headingCode = heading.code;
            const pathCode = readHeading(path.replace(/^\/\d+-/, "").replace(/^\//, "")).code;
            const articleCode = headingCode || pathCode;
            const exactNumber = [headingCode, pathCode, ...coverCodes].includes(target) || !articleCode && primaryTokens.includes(target);
            const seriesNumber = [headingCode, pathCode].some(code => withoutMakerPrefix(code) === withoutMakerPrefix(target));
            const titleMatch = Boolean(originalTitle && originalTitle === titleKey(heading.title));
            if (!exactNumber && !seriesNumber && !titleMatch) continue;
            if (headingCode && pathCode && headingCode !== pathCode
                || differentSerial(articleCode, target)
                || coverCodes.some(code => code !== target && code !== articleCode || differentSerial(code, target))) {
                result.identityRejected++;
                continue;
            }
            const articleKey = url.origin + url.pathname;
            if (seen.has(articleKey)) continue;
            seen.add(articleKey);
            const rank = (exactNumber ? 4 : seriesNumber ? 2 : 0) + Number(titleMatch);
            candidates.push({ url: url.href, requiresDetailIdentity: true, articleKey, articleCode, rank, coverMatch: coverCodes.includes(target) });
            continue;
        }
        if (!tokens.includes(target)) continue;
        if (hasConflict(tokens, target)) { result.identityRejected++; continue; }
        // A title that names the target is independent positive evidence; the detail page still
        // has to confirm it, so an opaque cover alone must not reject the candidate here.
        if (unknownCover && !titleTokens.includes(target)) {
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
    if (preview) candidates.sort((left, right) => (right.rank ?? 0) - (left.rank ?? 0));
    return result;
}

/** @param {any} page @param {unknown} carNum @param {string} [baseUrl] */
export function parseJavStoreSearch(page, carNum, baseUrl = "https://javstore.net") {
    return inspectJavStoreSearch(page, carNum, baseUrl).candidates.map(candidate => candidate.url);
}

/** @typedef {{url: string, match?: "confirmed" | "candidate", rank?: number}} JavStorePreview */

/** @param {string} path @param {...string} headings */
function previewCodes(path, ...headings) {
    return [...movieCodeTokens(path).map(javStoreCodeKey), ...headings.map(value => readHeading(value).code).filter(Boolean)];
}

/** @param {string} url @param {string[]} codes @param {string} target @param {string} detailCode @param {JavStoreArticle} article
 * @returns {JavStorePreview | null} */
function matchArticlePreview(url, codes, target, detailCode, article) {
    const articleCode = detailCode || article.articleCode || "";
    const expected = articleCode || ((article.rank ?? 0) >= 2 ? target : "");
    if (expected ? hasConflict(codes, expected) : new Set(codes).size > 1 || codes.some(code => differentSerial(code, target))) return null;
    if (detailCode === target || codes.includes(target) || article.coverMatch && (!articleCode || articleCode === target)) {
        return { url, match: "confirmed" };
    }
    if (javStoreDetailUrl(url, url)) return { url, match: "candidate", rank: article.rank };
    return null;
}

/** @param {any} page @param {string} detailUrl @param {unknown} carNum @param {boolean} requireIdentity @param {JavStoreArticle} [article] */
function inspectArticlePreviews(page, detailUrl, carNum, requireIdentity, article) {
    const normalized = normalizeCarNum(carNum);
    const target = normalized ? javStoreCodeKey(normalized) : null;
    const articles = queryJavStoreElements(page, "main article");
    const body = articles.find(article => article.querySelector("h1")) || articles[0] || page;
    const headings = queryJavStoreElements(body, "h1");
    const titleTokens = article ? [] : headings.flatMap(node => proseIdentityTokens(node.textContent || ""));
    const detailCode = article ? readHeading(headings[0]?.textContent || "").code : "";
    if (target && (hasConflict(titleTokens, target) || differentSerial(detailCode, target)
        || detailCode && article?.articleCode && detailCode !== article.articleCode)) {
        return { previews: [], reason: "identity" };
    }
    const confirmed = Boolean(target && titleTokens.includes(target));
    /** @type {JavStorePreview[]} */
    const previews = [];
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
        const url = previewUrl.replace(/\.th(?=\.[a-z]+(?:[?#]|$))/i, "");
        const path = javStoreUrlPath(href, detailUrl);
        if (article && target) {
            if (!articles.length && !anchor.closest("main")) continue;
            const match = matchArticlePreview(url, previewCodes(path, anchor.getAttribute("title") || ""), target, detailCode, article);
            if (match) previews.push(match);
            else reason = "identity";
            continue;
        }
        const tokens = [...identityTokens(path), ...proseIdentityTokens(anchor.getAttribute("title") || "")];
        if (target && (hasConflict(tokens, target) || requireIdentity && !confirmed && !tokens.includes(target))) {
            reason = "identity";
            continue;
        }
        return { previews: [{ url }], reason: null };
    }
    if (!target) return { previews, reason };
    /** @type {Map<string, JavStorePreview>} */
    const candidates = new Map();
    const selector = articles.length ? "img[src]" : "main img[src]";
    for (const image of queryJavStoreElements(body, selector)) {
        if (image.closest("aside, nav, header, footer")) continue;
        const url = normalizeJavStoreAssetUrl(image.getAttribute("src"), detailUrl);
        if (!url || !/_s\.jpg$/i.test(new URL(url).pathname)) continue;
        const anchor = image.closest("a[href]");
        const path = javStoreUrlPath(url, detailUrl);
        if (article) {
            const tokens = previewCodes(path, image.getAttribute("alt") || "", image.getAttribute("title") || "", anchor?.getAttribute("title") || "");
            if (anchor) tokens.push(...previewCodes(javStoreUrlPath(anchor.getAttribute("href") || "", detailUrl)));
            const match = tokens.length && matchArticlePreview(url, tokens, target, detailCode, article);
            if (match) candidates.set(url, match);
            else reason = "identity";
            continue;
        }
        const tokens = [...identityTokens(path), ...proseIdentityTokens(image.getAttribute("alt") || ""), ...proseIdentityTokens(image.getAttribute("title") || "")];
        if (anchor) tokens.push(...identityTokens(javStoreUrlPath(anchor.getAttribute("href") || "", detailUrl)), ...proseIdentityTokens(anchor.getAttribute("title") || ""));
        if (!tokens.includes(target) || hasConflict(tokens, target)) { reason = "identity"; continue; }
        candidates.set(url, { url });
    }
    if (candidates.size === 1) previews.push(...candidates.values());
    if (candidates.size > 1) reason = "identity";
    if (!articles.length && queryJavStoreElements(body, "main h1").length) reason ||= "structure";
    return { previews, reason: previews.length ? null : reason };
}

/** @param {any} page @param {string} detailUrl @param {unknown} carNum @param {JavStoreArticle} article */
export function inspectJavStorePreviews(page, detailUrl, carNum, article) {
    return inspectArticlePreviews(page, detailUrl, carNum, true, article);
}

/** @param {any} page @param {string} detailUrl @param {unknown} [carNum] @param {boolean} [requireIdentity] */
export function inspectJavStorePreview(page, detailUrl, carNum, requireIdentity = false) {
    const { previews, reason } = inspectArticlePreviews(page, detailUrl, carNum, requireIdentity);
    return { url: previews[0]?.url ?? null, reason };
}

/** @param {any} page @param {string} detailUrl @param {unknown} [carNum] */
export function parseJavStorePreview(page, detailUrl, carNum) {
    return inspectJavStorePreview(page, detailUrl, carNum).url;
}
