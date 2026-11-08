// @ts-check
import { matchesMovieCodeEvidence, ownHttpsUrl, screenshotDocument } from "../../core/movie-code-evidence.js";

/** @param {string} html @param {string} carNum @param {string} baseUrl */
export function parseJavFreeSearch(html, carNum, baseUrl) {
    const document = screenshotDocument(html), urls = new Set();
    for (const anchor of document.querySelectorAll(".entry-title a[href]")) {
        const url = ownHttpsUrl(anchor.getAttribute("href") || "", baseUrl, "javfree.me");
        if (!url || !/^\/\d+\/[^/]+\/?$/.test(url.pathname)) continue;
        if (matchesMovieCodeEvidence([decodeURIComponent(url.pathname), anchor.textContent || ""], carNum)) urls.add(url.href);
    }
    return [...urls];
}

/** @param {string} html @param {string} carNum @param {string} detailUrl */
export function parseJavFreeImages(html, carNum, detailUrl) {
    const document = screenshotDocument(html), heading = document.querySelector("article h1.entry-title, h1.entry-title");
    if (!matchesMovieCodeEvidence([heading?.textContent || "", decodeURIComponent(new URL(detailUrl).pathname)], carNum)) return [];
    const urls = new Set();
    const fc2 = String(carNum).match(/^FC2[\s_-]*(?:PPV[\s_-]*)?(\d+)$/i)?.[1];
    for (const image of document.querySelectorAll(".entry-content img")) {
        const url = ownHttpsUrl(image.getAttribute("data-src") || image.getAttribute("src") || "", detailUrl, "javfree.me");
        if (!url) continue;
        const numericSheet = fc2 && new RegExp(`/${fc2}_1\\.(?:jpe?g|png|webp)$`, "i").test(url.pathname);
        if (!numericSheet && !/-(?:1080p|demosaic)\.(?:jpe?g|png|webp)$/i.test(url.pathname)) continue;
        if (matchesMovieCodeEvidence([numericSheet ? `FC2-${fc2}` : decodeURIComponent(url.pathname), image.getAttribute("alt") || ""], carNum)) urls.add(url.href);
    }
    return [...urls].sort((left, right) => Number(/-1080p\./i.test(right)) - Number(/-1080p\./i.test(left))).map(url => ({ url, providerId: "javfree" }));
}
