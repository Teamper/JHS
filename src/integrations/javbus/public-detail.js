// @ts-check

import { defineMovieDetail, defineMovieRef } from "../../contracts/models.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
import { findJavBusDetailRoot, readJavBusDetailImageSequence } from "../../core/javbus-detail-images.js";

/** @param {any} page */
function resolveDocument(page) {
    if (typeof page?.querySelector === "function") return page;
    const candidate = page?.[0] ?? page?.get?.(0);
    if (typeof candidate?.querySelector === "function") return candidate;
    throw new TypeError("JavBus document is invalid");
}

/** @param {any} page @param {string} url */
export function readJavBusIdentifier(page, url) {
    if (typeof page?.find === "function") {
        return normalizeCarNum(page.find("span.header:contains('識別碼:')").parent().text().replace("識別碼:", ""))
            ?? normalizeCarNum(new URL(url).pathname.split("/").filter(Boolean).pop());
    }
    const document = resolveDocument(page);
    const label = [...document.querySelectorAll("span.header")].find((element) => element.textContent?.includes("識別碼"));
    return normalizeCarNum(label?.parentElement?.textContent?.replace("識別碼:", ""))
        ?? normalizeCarNum(new URL(url).pathname.split("/").filter(Boolean).pop());
}

/** @param {any} page @param {string} url */
export function parseJavBusMovieRef(page, url) {
    const carNum = readJavBusIdentifier(page, url);
    if (!carNum) throw new TypeError("JavBus movie identifier is missing");
    return defineMovieRef({ carNum, url: new URL(url).href });
}

/** @param {any} page @param {string} url */
export function parseJavBusMovieDetail(page, url) {
    const movieRef = parseJavBusMovieRef(page, url);
    const nativeDocument = typeof page?.find === "function" ? null : resolveDocument(page);
    const title = nativeDocument
        ? nativeDocument.querySelector("h3")?.textContent?.trim() || movieRef.carNum
        : page.find("h3").first().text().trim() || movieRef.carNum;
    const coverValue = nativeDocument
        ? nativeDocument.querySelector(".bigImage img[src], a.bigImage img[src]")?.getAttribute("src")
        : page.find(".bigImage img[src], a.bigImage img[src]").first().attr("src");
    const stills = nativeDocument ? readJavBusDetailImageSequence(findJavBusDetailRoot(nativeDocument), url).map(entry => ({
        url: entry.url, thumbnail: entry.image.getAttribute("data-src") || entry.image.getAttribute("src"),
    })).map(entry => ({ ...entry, thumbnail: entry.thumbnail ? new URL(entry.thumbnail, url).href : null })) : [];
    return defineMovieDetail({ ...movieRef, title, coverUrl: coverValue ? new URL(coverValue, url).href : null, stills, providerId: "javbus" });
}

