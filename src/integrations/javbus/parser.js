// @ts-check

import { defineMovieRef } from "../../contracts/models.js";
import { normalizeCarNum } from "../../core/movie-identity.js";

/** @param {any} page @param {string} url */
export function parseJavBusMovieRef(page, url) {
    const carNum = normalizeCarNum(page.find("span.header:contains('識別碼:')").parent().text().replace("識別碼:", ""))
        ?? normalizeCarNum(new URL(url).pathname.split("/").filter(Boolean).pop());
    if (!carNum) throw new TypeError("JavBus movie identifier is missing");
    return defineMovieRef({ carNum, url: new URL(url).href });
}
