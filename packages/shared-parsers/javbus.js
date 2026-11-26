// @ts-check
import { readJavBusIdentifier } from "../../src/integrations/javbus/public-detail.js";
import { findJavBusDetailRoot, readJavBusDetailImageSequence } from "../../src/core/javbus-detail-images.js";
import { getMovieStateEligibility, normalizeMovieCarNum } from "../../src/core/movie-identity.js";
import { httpsLink, publicMagnet } from "./links.js";
export { parseJavBusMovieDetail } from "../../src/integrations/javbus/public-detail.js";
/** @param {Element | null | undefined} node */
const text = node => node?.textContent?.trim() ?? "";

/** @param {Document} page @param {string} href @param {number} pageNumber */
export function parseJavBusCatalog(page, href, pageNumber) {
    const url = new URL(href);
    const root = page.querySelector("#waterfall");
    if (!root && !/找不到|沒有結果|没有结果|No results/i.test(page.body?.textContent ?? "")) {
        throw new Error("无法识别 JavBus 作品列表。");
    }
    const items = [...(root?.querySelectorAll("a.movie-box[href]") ?? [])].flatMap(card => {
        const link = httpsLink(card.getAttribute("href"), url, url.origin);
        const id = link && /^\/([\w-]{1,64})\/?$/.exec(new URL(link).pathname)?.[1];
        if (!id) return [];
        const dates = card.querySelectorAll(".photo-info date");
        const carNum = normalizeMovieCarNum(text(dates[0]));
        const label = /** @type {Element | undefined} */ (card.querySelector(".photo-info span")?.cloneNode(true));
        for (const date of label?.querySelectorAll("date") ?? []) date.remove();
        const image = card.querySelector("img");
        return [{ id, url: link, carNum, stateEligibility: getMovieStateEligibility(carNum),
            title: text(label) || image?.getAttribute("title") || carNum || id,
            coverUrl: httpsLink(image?.getAttribute("data-src") || image?.getAttribute("src"), url), releaseDate: text(dates[1]) }];
    });
    const next = httpsLink(page.querySelector("a#next")?.getAttribute("href"), url, url.origin);
    const path = url.pathname.replace(/\/\d+\/?$/, "").replace(/\/$/, "");
    const target = next && new URL(next);
    const expectedPath = url.pathname === "/" || /^\/page\/\d+$/.test(url.pathname) ? "/page/" : path + "/";
    return { items: [...new Map(items.map(item => [item.id, item])).values()],
        nextPage: target && target.pathname.replace(/\/$/, "") === expectedPath + (pageNumber + 1) ? pageNumber + 1 : null };
}

/** @param {Document} page @param {string} href */
export function parseJavBusCatalogDetail(page, href) {
    const root = findJavBusDetailRoot(page);
    if (!root) throw new Error("无法识别 JavBus 作品详情。");
    const url = new URL(href);
    const fields = [...root.querySelectorAll(".info p")].flatMap(row => {
        const label = text(row.querySelector(".header"));
        return label ? [{ label, value: text(row).slice(label.length).trim() }] : [];
    });
    const actors = [...root.querySelectorAll('a[href*="/star/"]')].flatMap(link => {
        const href = httpsLink(link.getAttribute("href"), url, url.origin);
        const id = href && /^\/star\/([\w-]{1,64})\/?$/.exec(new URL(href).pathname)?.[1];
        const name = text(link) || link.querySelector("img")?.getAttribute("title");
        return id && name ? [{ id, name, url: href, role: "unknown" }] : [];
    });
    const nativeCarNum = [...root.querySelectorAll("span.header")].find(label => /識別碼|识别码/.test(text(label)));
    const carNum = normalizeMovieCarNum(text(nativeCarNum?.parentElement).replace(/^.*?[：:]/, ""));
    const stills = readJavBusDetailImageSequence(root, href).flatMap(entry => {
        const original = httpsLink(entry.url, url);
        return original ? [{ url: original, thumbnail: httpsLink(entry.image.getAttribute("data-src") || entry.image.getAttribute("src"), url) }] : [];
    });
    const magnets = [...page.querySelectorAll('#magnet-table a[href^="magnet:"]')].flatMap(anchor => {
        const uri = publicMagnet(anchor.getAttribute("href"));
        return uri ? [{ uri, name: text(anchor), meta: text(anchor.closest("tr")?.querySelector("td:nth-child(2)")), subtitle: /字幕/.test(text(anchor.closest("tr"))) }] : [];
    });
    const identity = carNum ?? readJavBusIdentifier(page, href);
    return { carNum: identity, title: text(root.querySelector("h3")) || identity || "",
        stateEligibility: getMovieStateEligibility(carNum), coverUrl: httpsLink(root.querySelector(".bigImage img")?.getAttribute("src"), url),
        releaseDate: fields.find(field => /日期|發行|发行/.test(field.label))?.value ?? "", fields, actors, stills, magnets };
}

/** @param {Document} page @param {string} href @param {string} id */
export function readJavBusActorProfile(page, href, id) {
    const card = page.querySelector(".avatar-box .photo-info, .star-info");
    const name = text(card?.querySelector(".star-name, .pb10, h4, h3"));
    if (!name) return null;
    return { id, name, names: [name], url: new URL("/star/" + id, href).href,
        coverUrl: httpsLink(card?.closest(".avatar-box")?.querySelector("img")?.getAttribute("src"), href) };
}
