// @ts-check
import { matchesMovieCodeEvidence, ownHttpsUrl, screenshotDocument } from "../../core/movie-code-evidence.js";

/** @param {string} html @param {string} carNum @param {string} baseUrl */
export function parseProjectJavSearch(html, carNum, baseUrl) {
    const document = screenshotDocument(html), urls = new Set();
    for (const anchor of document.querySelectorAll('a[href*="/movie/"]')) {
        const url = ownHttpsUrl(anchor.getAttribute("href") || "", baseUrl, "projectjav.com");
        if (!url || !/^\/movie\/[^/]+$/.test(url.pathname)) continue;
        const evidence = [decodeURIComponent(url.pathname), anchor.textContent || "", ...[...anchor.querySelectorAll("img")].map(image => image.getAttribute("alt") || "")];
        if (matchesMovieCodeEvidence(evidence, carNum)) urls.add(url.href);
    }
    return [...urls];
}

/** @param {string} html @param {string} carNum @param {string} detailUrl */
export function parseProjectJavImages(html, carNum, detailUrl) {
    const document = screenshotDocument(html);
    const heading = document.querySelector("main h1, h1");
    const movieId = new URL(detailUrl).pathname.match(/\/movie\/[^/]+-(\d+)$/)?.[1];
    if (!movieId || !matchesMovieCodeEvidence([heading?.textContent || "", decodeURIComponent(new URL(detailUrl).pathname)], carNum)) return [];
    const urls = new Set();
    for (const image of document.querySelectorAll("main img, .movie-screenshot img")) {
        const anchor = image.closest("a[href]");
        const value = anchor?.getAttribute("href") || image.getAttribute("data-src") || image.getAttribute("src") || "";
        const url = ownHttpsUrl(value, detailUrl, "projectjav.com");
        if (!url || !new RegExp(`^/data/screenshots/${movieId}\\.(?:jpe?g|png|webp)$`, "i").test(url.pathname)) continue;
        const alt = image.getAttribute("alt") || "";
        if (alt && !matchesMovieCodeEvidence([alt], carNum)) continue;
        url.search = "";
        urls.add(url.href);
    }
    return [...urls].map(url => ({ url, providerId: "projectjav" }));
}
