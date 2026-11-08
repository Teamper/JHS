// @ts-check
import { matchesMovieCodeEvidence, ownHttpsUrl, screenshotDocument } from "../../core/movie-code-evidence.js";

/** @param {string} html @param {string} baseUrl @param {string} carNum */
export function parseSubtitleCatSearch(html, baseUrl, carNum) {
    const doc = screenshotDocument(html), results = new Map();
    for (const anchor of doc.querySelectorAll('a[href*="subs/"]')) {
        const url = ownHttpsUrl(anchor.getAttribute("href") || "", baseUrl, "subtitlecat.com");
        if (!url || !/^\/subs\/\d+\/[^/]+\.html$/i.test(url.pathname)) continue;
        const title = anchor.textContent?.trim() || "";
        if (!matchesMovieCodeEvidence([decodeURIComponent(url.pathname), title], carNum)) continue;
        results.set(url.href, { name: title, url: url.href });
    }
    return [...results.values()];
}

/** @param {string} html @param {string} baseUrl @param {string} carNum @param {string} name */
export function parseSubtitleCatDownloads(html, baseUrl, carNum, name) {
    if (!matchesMovieCodeEvidence([decodeURIComponent(new URL(baseUrl).pathname)], carNum)) return [];
    const doc = screenshotDocument(html), results = new Map();
    for (const anchor of doc.querySelectorAll('a[id^="download_"][href]')) {
        const url = ownHttpsUrl(anchor.getAttribute("href") || "", baseUrl, "subtitlecat.com");
        if (!url || !/\.(srt|ass|ssa|vtt)$/i.test(url.pathname) || !matchesMovieCodeEvidence([decodeURIComponent(url.pathname)], carNum)) continue;
        const language = anchor.id.slice("download_".length);
        if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language)) continue;
        results.set(url.href, { providerId: "subtitlecat", name, language, extension: url.pathname.split(".").pop()?.toLowerCase(), url: url.href });
    }
    return [...results.values()];
}

/** @param {any} page @param {string} baseUrl */
export function parseSubtitleCatResults(page, baseUrl) {
    return Object.freeze(page.find("a[href*='/subtitles/']").map((/** @type {number} */ _index, /** @type {Element} */ element) => {
        const anchor = page.constructor(element);
        return Object.freeze({ language: anchor.text().trim(), url: new URL(anchor.attr("href"), baseUrl).href });
    }).get());
}
