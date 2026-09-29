// @ts-check

import { I, T } from "../../core/constants.js";
import { A, B, D, P } from "../../core/constants.js";
import { selectLatestPublishTime } from "../../core/feature-helpers.js";
import { readListItem } from "../../core/list-item-reader.js";
import { parseDetailPage } from "./parser.js";

const LIST_SELECTORS = Object.freeze({
    javdb: Object.freeze({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }),
    javbus: Object.freeze({ boxSelector: ".masonry", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }),
});

/** Read the actor or tag identity using JavDB/JavBus URL and DOM contracts. */
/** @param {{site: string, href: string, document: Document, jquery: (value: any) => any}} options */
export function getBlacklistSubjectInfo(options) {
    const { site, href, document, jquery } = options;
    const url = new URL(href);
    if (site === T && url.pathname.includes("/tags")) {
        const tag = jquery("#jhs-check-tag").text().trim();
        if (!tag) throw new Error("获取分类名称失败");
        url.searchParams.delete("page");
        return { starId: `no-${tag}`, name: `虚拟演员-${tag}`, allName: ["虚拟演员"], role: "虚拟演员", movieType: tag, blacklistUrl: url.toString() };
    }
    if (site !== T && site !== I) throw new Error("黑名单仅支持 JavDB 与 JavBus 演员页");
    const isActorPage = site === T ? url.pathname.includes("/actors/") : url.pathname.includes("/star/");
    if (!isActorPage) throw new Error("接口调用错误, 非演员详情页");
    /** @type {string[]} */ const names = [];
    const primary = site === T ? jquery(".actor-section-name") : jquery(".avatar-box .photo-info .pb10");
    if (primary.length) primary.text().trim().split(",").forEach((/** @type {string} */ name) => names.push(name.trim()));
    jquery(".section-meta").each((/** @type {number} */ _index, /** @type {Element} */ element) => {
        if (site === T && element.textContent?.includes("影片")) return;
        element.textContent?.trim().split(",").forEach((/** @type {string} */ name) => names.push(name.trim()));
    });
    const allName = [...new Set(names.filter(Boolean))];
    const role = [...document.querySelectorAll(".section-meta")].some((element) => element.textContent?.includes("男優")) ? B : P;
    const movieType = allName.some((name) => name.includes("無碼")) || url.pathname.includes("uncensored") ? A : D;
    let starId = "", blacklistUrl = "";
    if (site === T) {
        starId = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
        url.searchParams.delete("sort_type");
        url.searchParams.delete("page");
        blacklistUrl = url.toString();
    } else {
        const marker = "/star/", markerIndex = url.pathname.indexOf(marker);
        if (markerIndex < 0) throw new Error("提取演员url失败");
        starId = url.pathname.slice(markerIndex + marker.length).split("/").filter(Boolean)[0] ?? "";
        url.pathname = `${url.pathname.slice(0, markerIndex + marker.length)}${starId}`;
        url.search = "";
        blacklistUrl = url.toString();
    }
    if (!starId || !allName[0]) throw new Error("演员身份信息不完整");
    return { starId, name: allName[0], allName, role, movieType, blacklistUrl };
}

/** Parse one JavDB/JavBus actor-list page without mutating storage. */
/** @param {{page: any, name: string, starId: string, site: string, jquery: (value: any) => any}} options */
export function parseBlacklistFilterPage(options) {
    const { page: input, name, starId, site, jquery } = options;
    if (site !== T && site !== I) throw new Error(`未知黑名单来源站点: ${site}`);
    const selectors = LIST_SELECTORS[/** @type {"javdb" | "javbus"} */ (site)];
    const page = input?.jquery ? input : jquery(input || document);
    const pageState = parseDetailPage(page, {
        boxSelector: site === I ? `${selectors.boxSelector}, #waterfall` : selectors.boxSelector,
        requestDomItemSelector: selectors.requestDomItemSelector,
    });
    const nextPageLink = page.find(selectors.nextPageSelector).attr("href") || null;
    if (pageState.state !== "valid") throw new Error(`黑名单作品页面无效: ${pageState.state}`);
    const movieItems = site === I
        ? pageState.items.filter((/** @type {number} */ _index, /** @type {Element} */ item) => !jquery(item).find(".avatar-box").length)
        : pageState.items;
    if (!movieItems.length && nextPageLink) throw new Error("黑名单作品空页面包含下一页");
    const records = [], publishTimes = [];
    for (const item of movieItems.toArray()) {
        const { carNum, url, publishTime } = readListItem(jquery(item));
        if (publishTime) publishTimes.push(publishTime);
        if (url && carNum) records.push({ carNum, url, names: name, actionType: "filter", starId, publishTime });
    }
    return { nextPageLink, lastPublishTime: selectLatestPublishTime(publishTimes), recordCount: records.length, records };
}
