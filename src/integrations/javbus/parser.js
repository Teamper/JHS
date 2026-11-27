// @ts-check
import { parseJavBusMovieRef as readRef, parseJavBusMovieDetail as readDetail } from "./public-detail.js";

/** @param {any} page */
const documentFor = page => typeof page === "string" ? new DOMParser().parseFromString(page, "text/html") : page;

/** @param {any} page @param {string} url */
export function parseJavBusMovieRef(page, url) { return readRef(documentFor(page), url); }

/** @param {any} page @param {string} url */
export function parseJavBusMovieDetail(page, url) { return readDetail(documentFor(page), url); }
