// @ts-check

import { normalizeMovieCarNum } from "./movie-identity.js";

/** 从列表卡片尽力读取演员名（无演员信息的卡片返回空串，绝不用搜索关键词填充）。 @param {any} item */
export function readCardNames(item) {
    const jq = /** @type {any} */ (globalThis).$, element = item?.jquery ? item : jq(item);
    /** @type {string[]} */
    const names = [];
    element.find('.tags a[href^="/actors/"]').each((/** @type {number} */ _index, /** @type {Element} */ node) => {
        const name = jq(node).text().trim();
        name && names.push(name);
    });
    element.find('span[onmouseover*="star_"] a').each((/** @type {number} */ _index, /** @type {Element} */ node) => {
        const name = jq(node).text().trim();
        name && names.push(name);
    });
    return [ ...new Set(names) ].join(" ");
}

/** Read one JavDB/JavBus list card without depending on ListPagePlugin. @param {any} item */
export function readListItem(item) {
    const jq = /** @type {any} */ (globalThis).$, element = item?.jquery ? item : jq(item);
    const anchor = element.find("a"), url = element.attr("data-jhs-original-url") || anchor.attr("href"), titleNode = element.find(".video-title");
    let carNum, title, publishTime;
    if (titleNode.length) {
        const strong = titleNode.find("strong");
        if (strong.length) carNum = strong.text().trim();
        title = anchor.attr("title") ? anchor.attr("title").trim() : carNum ? titleNode.text().replace(carNum, "").trim() : titleNode.text().trim();
        publishTime = element.find(".meta").text().trim();
    }
    if (!carNum) {
        const image = element.find("img");
        if (image.length) title = image.attr("title")?.trim() || image.attr("data-title")?.trim() || title;
        const dates = element.find("date").map((/** @type {number} */ _index, /** @type {Element} */ node) => jq(node).text().trim()).get();
        publishTime = dates.find((/** @type {string} */ value) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(value));
        carNum = dates.find((/** @type {string} */ value) => !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value));
    }
    const normalized = normalizeMovieCarNum(carNum);
    if (!normalized) throw new TypeError("提取番号信息失败");
    return Object.freeze({
        carNum: normalized, aHref: url, url, title, publishTime,
        fc2Source: ["fc2", "123av"].includes(element.attr("data-jhs-fc2-source")) ? element.attr("data-jhs-fc2-source") : "fc2",
    });
}
