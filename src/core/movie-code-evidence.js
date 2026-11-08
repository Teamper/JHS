// @ts-check

import { normalizeCarNum } from "./movie-identity.js";

/** @param {string} value */
export function movieCodeKey(value) {
    const normalized = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase();
    const fc2 = normalized.match(/^FC2[\s_-]*(?:PPV[\s_-]*)?(\d+)$/);
    return fc2 ? `FC2-${fc2[1]}` : normalized.replace(/[\s_-]+/g, "");
}

/** @param {string} value */
export function movieCodeTokens(value) {
    const text = value.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").toUpperCase();
    return [...text.matchAll(/(?<![A-Z0-9])(?:FC2[\s_-]*(?:PPV[\s_-]*)?\d+|(?:[A-Z]{2,10}|\d{1,3}[A-Z]{2,8})[\s_-]*\d{2,}|\d{6}[\s_-]+\d{2,})(?![A-Z0-9])/g)]
        .map(match => movieCodeKey(match[0])).filter(token => !/^(?:[HX]26[45]|HEVC\d+|CD\d+|DISC\d+|PART\d+)$/.test(token));
}

/** Match complete code tokens and reject contradictory identities. @param {string[]} evidence @param {unknown} carNum */
export function matchesMovieCodeEvidence(evidence, carNum) {
    const normalized = normalizeCarNum(carNum);
    if (!normalized) return false;
    const target = movieCodeKey(normalized);
    const tokens = movieCodeTokens(evidence.join(" "));
    return tokens.length > 0 && tokens.every(token => token === target);
}

/** @param {string} value @param {string} baseUrl @param {string} host */
export function ownHttpsUrl(value, baseUrl, host) {
    try {
        if (!value.trim()) return null;
        const url = new URL(value, baseUrl);
        decodeURIComponent(url.pathname);
        return url.protocol === "https:" && !url.username && !url.password && (url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url : null;
    } catch { return null; }
}

/** @param {string} html */
export function screenshotDocument(html) {
    if (typeof html !== "string") throw new TypeError("截图来源响应不是 HTML");
    const document = new DOMParser().parseFromString(html, "text/html");
    if (/Just a moment|cf-chl-|Checking your browser/i.test(`${document.title} ${document.body?.textContent || ""}`)) {
        throw Object.assign(new Error("截图来源需要浏览器验证"), { code: "CF_BLOCKED" });
    }
    return document;
}
