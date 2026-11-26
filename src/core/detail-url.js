// @ts-check
import { normalizeMovieCarNum } from "./movie-identity.js";

/** @param {string | URL} href @param {string} origin @param {unknown} carNum @param {boolean} [preview] */
export function createDetailUrl(href, origin, carNum, preview = false) {
    const destination = new URL(href, origin);
    const normalized = normalizeMovieCarNum(carNum);
    if (/^\/v\/[^/]+/.test(destination.pathname) && normalized) destination.searchParams.set("jhsCarNum", normalized);
    if (preview) destination.searchParams.set("autoPlay", "1");
    return destination;
}
