// @ts-check
import { defineMovieDetail } from "../../contracts/models.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
/** @param {any} page @param {string} url */
export function parseFc2PpvDbDetail(page, url) {
    const id = new URL(url).pathname.match(/(?:articles?|videos?)\/(\d+)/i)?.[1];
    const carNum = normalizeCarNum(id ? `FC2-${id}` : "");
    const title = page.find("h1").first().text().trim();
    if (!carNum || !title) throw new TypeError("FC2PPVDB detail is malformed");
    return defineMovieDetail({ carNum, title, url: new URL(url).href });
}
