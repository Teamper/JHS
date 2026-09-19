// @ts-check
import { defineMovieDetail } from "../../contracts/models.js";
import { normalizeCarNum } from "../../core/movie-identity.js";

/** @param {any} page */
function resolveDocument(page) {
    if (typeof page === "string") return new DOMParser().parseFromString(page, "text/html");
    if (typeof page?.querySelector === "function") return page;
    const candidate = page?.[0] ?? page?.get?.(0);
    if (typeof candidate?.querySelector === "function") return candidate;
    throw new TypeError("FC2PPVDB detail document is invalid");
}

/** @param {any} page @param {string} url */
export function parseFc2PpvDbDetail(page, url) {
    const id = new URL(url).pathname.match(/(?:articles?|videos?)\/(\d+)/i)?.[1];
    const carNum = normalizeCarNum(id ? `FC2-${id}` : "");
    const title = resolveDocument(page).querySelector("h1")?.textContent?.trim() ?? "";
    if (!carNum || !title) throw new TypeError("FC2PPVDB detail is malformed");
    return defineMovieDetail({ carNum, title, url: new URL(url).href });
}

/** @param {any} page @param {string} url */
export function parseFc2PpvDbPeople(page, url) {
    const document = resolveDocument(page), baseUrl = new URL(url);
    const rows = [...document.querySelectorAll("div")];
    const actressRow = rows.find((item) => item.textContent?.trim().startsWith("女優："));
    const sellerRow = rows.find((item) => item.textContent?.trim().startsWith("販売者："));
    const actors = [...(actressRow?.querySelectorAll("a[href]") ?? [])].map((link) => Object.freeze({
        name: link.textContent?.trim() || "", url: new URL(link.getAttribute("href") || "", baseUrl).href,
    })).filter((actor) => actor.name);
    const sellerLink = sellerRow?.querySelector("a[href]");
    const seller = sellerLink ? Object.freeze({ name: sellerLink.textContent?.trim() || "", url: new URL(sellerLink.getAttribute("href") || "", baseUrl).href }) : null;
    return Object.freeze({ actors: Object.freeze(actors), seller });
}
