// @ts-check

import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { isHitShowPage } from "../../core/site-context.js";

export class JavDbHostAdapter {
    /** @param {Document} [documentRuntime] @param {Location} [locationRuntime] */
    constructor(documentRuntime = document, locationRuntime = window.location) { this.site = "javdb"; this.document = documentRuntime; this.location = locationRuntime; }
    /** 解析当前搜索条件第一页：删除 page 查询参数，保留其余搜索条件；非法 URL 原样返回。 */
    /** @param {string} currentUrl */
    resolveFirstPageUrl(currentUrl) {
        try {
            const url = new URL(currentUrl);
            url.searchParams.delete("page");
            return url.href;
        } catch {
            return currentUrl;
        }
    }
    detectRoute() {
        if (this.location.pathname.startsWith("/v/") || this.location.pathname.startsWith("/movies/")) return "detail";
        if (this.location.pathname === "/users/collection_codes") return "owned-detail";
        // JHS 自渲染榜单页（热播/Top250）没有原生列表节点，但语义是列表页（对齐 site-context.isListPage），
        // 否则 window.isListPage=false 会让筛选判定与状态刷新监听整体失效。
        if (this.location.pathname === "/advanced_search" && [ "handlePlayback", "handleTop" ].some((key => new URLSearchParams(this.location.search).get(key) === "1"))) return "list";
        return this.locateListRoot() ? "list" : "other";
    }
    readMovieRef() {
        const pageUrl = (() => {
            try {
                const url = new URL(this.location.href);
                url.search = "";
                url.hash = "";
                return url.href;
            } catch {
                return this.location.href;
            }
        })();
        const injectedCarNum = (() => {
            try { return new URL(this.location.href).searchParams.get("jhsCarNum"); } catch { return null; }
        })();
        const copy = this.document.querySelector('.column-video-info a[data-clipboard-text][title*="番"], .video-detail a[data-clipboard-text][title*="番"], a[title="複製番號"]')?.getAttribute("data-clipboard-text");
        const panelValues = [];
        const panels = [...this.document.querySelectorAll(".column-video-info .panel-block, .video-detail .panel-block, .movie-panel-info .panel-block")];
        for (const element of panels) {
            const label = element.querySelector("strong, .label")?.textContent?.trim() ?? "";
            if (/(?:番号|番號|^ID)\s*[:：]?/i.test(label)) panelValues.push(element.querySelector("[data-clipboard-text]")?.getAttribute("data-clipboard-text") || element.querySelector(".value")?.textContent || element.textContent || "");
        }
        const legacyValue = this.document.querySelector(".panel-block.first-block .value")?.textContent;
        const dataValue = this.document.querySelector("[data-car-number]")?.getAttribute("data-car-number") || this.document.querySelector("[data-car-number]")?.textContent;
        const fallback = this.document.querySelector("#video_id, .video-id, .video-title strong")?.textContent;
        for (const candidate of [injectedCarNum, copy, dataValue, ...panelValues, legacyValue, fallback]) {
            const text = String(candidate ?? "").trim(), labeled = text.match(/(?:番号|番號|識別碼|ID)\s*[:：]\s*([A-Z0-9][A-Z0-9 _-]*)/i)?.[1], carNum = normalizeMovieCarNum(labeled || text);
            if (carNum) {
                const actress = [...this.document.querySelectorAll(".female")].map((marker) => marker.previousElementSibling?.textContent?.trim() ?? "").filter(Boolean).join(" ");
                const datePanel = panels.find((element) => /日期\s*[:：]?/i.test(element.querySelector("strong, .label")?.textContent?.trim() ?? ""));
                const publishTime = datePanel?.querySelector(".value")?.textContent?.trim() ?? "";
                return Object.freeze({ carNum, url: pageUrl, site: "javdb", actress, publishTime });
            }
        }
        return null;
    }
    locateListRoot() { return this.document.querySelector(".movie-list"); }
    locateListItems() { return [...(this.locateListRoot()?.querySelectorAll(":scope > .item") ?? [])]; }
    getListContainer() { return this.locateListRoot()?.parentElement ?? null; }
    getListSelectors() {
        return Object.freeze({
            boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img",
            requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next",
        });
    }
    getListLayoutContainer() { return this.document.querySelector("section .container"); }
    /** @param {string[]} [classes] */
    createOwnedListRoot(classes = []) {
        const root = this.document.createElement("div");
        root.classList.add("movie-list", "h", "cols-4", "vcols-8", ...classes);
        return root;
    }
    locateDetailRoot() { return this.document.querySelector(".video-detail") ?? this.document.querySelector(".movie-panel-info")?.closest(".container") ?? this.document.querySelector("main"); }
    locateDetailSlots() {
        const root = this.locateDetailRoot();
        return Object.freeze({
            summary: root?.querySelector('[data-jhs-slot="summary-actions"]') ?? this.document.querySelector(".movie-panel-info"),
            resources: this.document.querySelector("#magnets-content"),
            reviews: root?.querySelector('[data-jhs-slot="reviews"]') ?? this.document.querySelector("#reviews"),
            related: root?.querySelector('[data-jhs-slot="related"]'),
        });
    }
    locateNativeGallery() { return this.document.querySelector(".tile-images, .preview-images"); }
    locateNativeMagnets() { return this.document.querySelector("#magnets-content"); }
    getDetailResourceBoundary() {
        const resourceRoot = this.locateNativeMagnets(), controller = resourceRoot?.closest('[data-controller="magnet-sort"]'), hostRoot = this.locateDetailRoot();
        if (!hostRoot || !controller || !resourceRoot) return null;
        const resourceRegion = [...hostRoot.children].find((child) => child === controller || child.contains(controller)) || controller;
        return Object.freeze({
            site: "javdb", hostRoot, controller, observeRoot: controller, resourceRoot, resourceRegion,
            rows: () => [...resourceRoot.children].filter((row) => row.matches(".item")),
            sortSelect: controller.querySelector('select[data-action*="magnet-sort#sort"]'),
            getResource(/** @type {Element} */ row) { return row.querySelector('.copy-to-clipboard[data-clipboard-text^="magnet:"]')?.getAttribute("data-clipboard-text") || row.querySelector('.magnet-name a[href^="magnet:"]')?.getAttribute("href") || ""; },
            getActionTarget: (/** @type {Element} */ row) => row.querySelector(":scope > .buttons"),
            actionTargetRequiresWrapper: () => false,
            getTitleTarget: (/** @type {Element} */ row) => row.querySelector(".name"), hasSubtitleTag: () => false,
        });
    }
    /** @param {string} html @param {string} baseUrl */
    parseActorMovies(html, baseUrl) {
        if (typeof html !== "string") throw new TypeError("JavDB actor page must be HTML text");
        const document = new DOMParser().parseFromString(html, "text/html"), challenge = document.querySelector("title")?.textContent ?? document.body?.textContent ?? "";
        if (/Just a moment|cf-chl-|Cloudflare/i.test(challenge)) throw new TypeError("JavDB actor page is a challenge page");
        const items = [...document.querySelectorAll(".movie-list .item")];
        return Object.freeze(items.flatMap((item) => {
            const titleNode = item.querySelector(".video-title"), rawCarNum = titleNode?.querySelector("strong")?.textContent?.trim() ?? "", carNum = normalizeMovieCarNum(rawCarNum);
            if (!carNum) return [];
            const rawCover = item.querySelector("img")?.getAttribute("src") ?? "", href = item.querySelector("a[href]")?.getAttribute("href") ?? "";
            const scoreText = item.querySelector(".score .value, .score")?.textContent?.trim() ?? "", countText = item.querySelector(".score .count, .meta .count")?.textContent?.trim() ?? "";
            return [Object.freeze({
                carNum, title: (titleNode?.textContent ?? "").replace(rawCarNum, "").trim(),
                coverUrl: rawCover ? new URL(rawCover, baseUrl).href.replace("thumbs", "covers") : null,
                url: href ? new URL(href, baseUrl).href : null, publishTime: item.querySelector(".meta")?.textContent?.trim() || null,
                score: Number.parseFloat(scoreText) || 0, voteCount: Number.parseInt(countText.replace(/[^\d]/g, "")) || 0,
            })];
        }));
    }
    /** @param {string} html @param {string} baseUrl */
    parseActorCollection(html, baseUrl) {
        if (typeof html !== "string") throw new TypeError("JavDB actor collection must be HTML text");
        const document = new DOMParser().parseFromString(html, "text/html"), challenge = document.querySelector("title")?.textContent ?? document.body?.textContent ?? "";
        if (/Just a moment|cf-chl-|Cloudflare/i.test(challenge)) return Object.freeze({ state: "challenge", isEmpty: false, actors: Object.freeze([]), nextUrl: null });
        const container = document.querySelector("#actors");
        if (!container) return Object.freeze({ state: "invalid", isEmpty: false, actors: Object.freeze([]), nextUrl: null });
        try {
            const boxes = [...container.querySelectorAll(".actor-box")], actors = boxes.map((box) => {
                const anchor = box.querySelector("a[title][href]"), title = anchor?.getAttribute("title") ?? "", href = anchor?.getAttribute("href") ?? "";
                const avatarSrc = anchor?.querySelector("img")?.getAttribute("src") ?? "", allName = title.split(",").map((name) => name.trim()).filter(Boolean), actorUrl = new URL(href, baseUrl), starId = actorUrl.pathname.split("/").filter(Boolean).pop() ?? "";
                if (!starId || !allName.length) throw new TypeError("演员卡身份字段无效");
                return Object.freeze({
                    starId, name: allName[0], allName: Object.freeze(allName), avatar: avatarSrc ? new URL(avatarSrc, baseUrl).href : null,
                    actressType: anchor?.querySelector(".info")?.textContent?.trim().includes("無碼") ? "uncensored" : "censored", lastCheckTime: null, lastUpdateTime: null,
                });
            });
            const nextHref = document.querySelector(".pagination-next")?.getAttribute("href"), nextUrl = nextHref ? new URL(nextHref, baseUrl).href : null;
            return Object.freeze({ state: "valid", isEmpty: boxes.length === 0, actors: Object.freeze(actors), nextUrl });
        } catch { return Object.freeze({ state: "invalid", isEmpty: false, actors: Object.freeze([]), nextUrl: null }); }
    }
}
