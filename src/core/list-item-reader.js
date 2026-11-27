// @ts-check

import { getMovieStateEligibility, normalizeMovieCarNum } from "./movie-identity.js";

/** 区分正常列表、合法空列表和第三方拦截页。
 * @param {any} page @param {{boxSelector: string, requestDomItemSelector: string}} selectors */
export function parseHostListPage(page, selectors) {
    const isChallenge = /Just a moment|cf-chl-|Cloudflare/i.test(page.find("title, body").text());
    const hasContainer = page.find(selectors.boxSelector).length > 0;
    const items = hasContainer ? page.find(selectors.requestDomItemSelector) : null;
    return { state: isChallenge ? "challenge" : hasContainer ? "valid" : "invalid", items, isEmpty: items?.length === 0 };
}

/** 从列表卡片尽力读取演员名（无演员信息的卡片返回空串，绝不用搜索关键词填充）。 @param {any} item */
export function readCardNames(item) {
    const root = item?.jquery ? item[0] : item;
    if (!root?.querySelectorAll) return "";
    /** @type {string[]} */
    const names = [];
    for (const node of root.querySelectorAll('.tags a[href^="/actors/"], span[onmouseover*="star_"] a')) {
        const name = String(node.textContent || "").trim();
        if (name) names.push(name);
    }
    return [ ...new Set(names) ].join(" ");
}

/** Extract JavDB starId values from actor links on a list card when present. @param {any} item @returns {string[]} */
export function readCardStarIds(item) {
    const root = item?.jquery ? item[0] : item;
    if (!root?.querySelectorAll) return [];
    /** @type {string[]} */
    const starIds = [];
    for (const node of root.querySelectorAll('a[href*="/actors/"]')) {
        const href = String(node.getAttribute?.("href") || "");
        const match = href.match(/\/actors\/([\w-]+)/u);
        if (match?.[1]) starIds.push(match[1]);
    }
    return [ ...new Set(starIds) ];
}

/** Read one JavDB/JavBus list card without depending on ListPagePlugin. @param {any} item @param {any} [jquery] */
export function readListItem(item, jquery = /** @type {any} */ (globalThis).$) {
    const jq = jquery, element = item?.jquery ? item : jq(item);
    const anchor = element.is("a[href]") ? element : element.find("a"), url = element.attr("data-jhs-original-url") || anchor.attr("href"), titleNode = element.find(".video-title");
    let carNum, title, publishTime;
    /** @type {string[]} */
    let nativeNumbers = [];
    if (element.is("a.tile-item")) {
        nativeNumbers = element.find(".video-number").map((/** @type {number} */ _, /** @type {Element} */ node) => normalizeMovieCarNum(node.textContent)).get().filter(Boolean);
        carNum = nativeNumbers[0];
        title = element.find(".video-title,.title").text().trim();
    }
    if (titleNode.length) {
        const strong = titleNode.find("strong");
        if (strong.length) {
            nativeNumbers = strong.map((/** @type {number} */ _, /** @type {Element} */ node) => normalizeMovieCarNum(node.textContent)).get().filter(Boolean);
            carNum = nativeNumbers[0];
        }
        title = (anchor.attr("title") || anchor.attr("data-jhs-privacy-original-title")) ? (anchor.attr("title") || anchor.attr("data-jhs-privacy-original-title")).trim() : carNum ? titleNode.text().replace(carNum, "").trim() : titleNode.text().trim();
        publishTime = element.find(".meta").text().trim();
    }
    if (!carNum) {
        const image = element.find("img");
        if (image.length) title = (image.attr("title") || image.attr("data-jhs-privacy-original-title"))?.trim() || image.attr("data-title")?.trim() || title;
        const dates = element.find("date").map((/** @type {number} */ _index, /** @type {Element} */ node) => jq(node).text().trim()).get();
        publishTime = dates.find((/** @type {string} */ value) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(value));
        nativeNumbers = dates.filter((/** @type {string} */ value) => !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)).map(normalizeMovieCarNum).filter(Boolean);
        carNum = nativeNumbers[0];
        if (!carNum && element.closest(".masonry").length && typeof url === "string") {
            const hrefCode = /\/([A-Z0-9]+-[0-9]+)\/?(?:[?#]|$)/i.exec(url)?.[1];
            carNum = normalizeMovieCarNum(hrefCode);
        }
    }
    const normalized = normalizeMovieCarNum(carNum) ?? "";
    title = element.attr("data-jhs-original-title") || title;
    return Object.freeze({
        carNum: normalized, aHref: url, url, title, publishTime,
        stateEligibility: nativeNumbers.some(value => value !== normalized) ? {eligible: false, reason: /** @type {const} */ ("conflicting")} : getMovieStateEligibility(normalized),
        fc2Source: ["fc2", "123av"].includes(element.attr("data-jhs-fc2-source")) ? element.attr("data-jhs-fc2-source") : "fc2",
    });
}
