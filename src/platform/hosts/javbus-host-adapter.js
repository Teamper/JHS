// @ts-check

import { normalizeMovieCarNum } from "../../core/movie-identity.js";

/** JavBus 带分页的列表路径前缀（除 /page/N 外的 /<prefix>/<id>/N 形式）。 */
const JAVBUS_LIST_PREFIXES = new Set([ "star", "genre", "maker", "actress", "series", "tag", "search", "director", "studio", "label" ]);

export class JavBusHostAdapter {
    /** @param {Document} [documentRuntime] @param {Location} [locationRuntime] */
    constructor(documentRuntime = document, locationRuntime = window.location) { this.site = "javbus"; this.document = documentRuntime; this.location = locationRuntime; }
    /** 解析当前搜索条件第一页：去掉 /page/N 与 /<list-prefix>/<id>/N 的页码段；非法 URL 原样返回。 */
    /** @param {string} currentUrl */
    resolveFirstPageUrl(currentUrl) {
        try {
            const url = new URL(currentUrl);
            const segments = url.pathname.split("/").filter(Boolean);
            const last = segments[segments.length - 1];
            const secondLast = segments[segments.length - 2];
            if (segments.length >= 2 && /^\d+$/.test(last)) {
                const removable = secondLast === "page"
                    || (segments.length >= 3 && JAVBUS_LIST_PREFIXES.has(segments[segments.length - 3]) && !/^\d+$/.test(secondLast));
                if (removable) {
                    const remaining = secondLast === "page" ? segments.slice(0, -2) : segments.slice(0, -1);
                    url.pathname = remaining.length ? "/" + remaining.join("/") : "/";
                }
            }
            return url.href;
        } catch {
            return currentUrl;
        }
    }
    detectRoute() { return this.locateNativeMagnets() ? "detail" : this.locateListRoot() ? "list" : "other"; }
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
        const urlCarNum = (() => {
            try {
                const segments = new URL(this.location.href).pathname.split("/").filter(Boolean);
                const last = segments.at(-1) ?? "";
                return normalizeMovieCarNum(last.replace(/_\d{4}-\d{2}-\d{2}$/, ""));
            } catch {
                return null;
            }
        })();
        const dataNode = this.document.querySelector("[data-car-number]"), dataValue = dataNode?.getAttribute("data-car-number") || dataNode?.textContent?.trim() || "";
        const header = [...this.document.querySelectorAll(".info .header")].find((element) => /識別碼|识别码/i.test(element.textContent?.trim() ?? ""));
        const valueNode = header?.nextElementSibling;
        const rowText = header?.parentElement?.textContent?.replace(header.textContent ?? "", "").trim() ?? "";
        const rawCarNum = dataValue || valueNode?.textContent?.trim() || rowText;
        const carNum = urlCarNum || normalizeMovieCarNum(rawCarNum);
        if (!carNum) return null;
        const actress = [...this.document.querySelectorAll('span[onmouseover*="star_"] a')].map((anchor) => anchor.textContent?.trim() ?? "").filter(Boolean).join(" ");
        const publishHeader = [...this.document.querySelectorAll("span.header")].find((element) => /發行日期|发行日期/i.test(element.textContent?.trim() ?? ""));
        const publishTime = publishHeader?.parentElement?.textContent?.replace(publishHeader.textContent ?? "", "").trim() ?? "";
        return Object.freeze({ carNum, url: pageUrl, site: "javbus", actress, publishTime });
    }
    locateListRoot() { return this.document.querySelector(".masonry"); }
    locateListItems() { return [...(this.locateListRoot()?.querySelectorAll(":scope > .item, :scope > .movie-box") ?? [])]; }
    getListContainer() { return this.locateListRoot()?.parentElement ?? null; }
    /** Normalize JavBus list wrappers and title nodes before feature filtering. */
    prepareList() {
        const legacyRoot = this.document.querySelector("#waterfall_h");
        legacyRoot?.removeAttribute("id");
        legacyRoot?.setAttribute("id", "no-page");
        for (const waterfall of [ ...this.document.querySelectorAll('[id="waterfall"]') ]) {
            if (waterfall.classList.contains("masonry")) continue;
            const parent = waterfall.parentElement;
            if (!parent) continue;
            while (waterfall.firstElementChild) parent.insertBefore(waterfall.firstElementChild, waterfall);
            waterfall.remove();
        }
        this.prepareListItems(this.locateListItems());
    }
    /** @param {Element[]} items */
    prepareListItems(items) {
        for (const item of items) {
            if (item.querySelector(".avatar-box")) continue;
            const titleNode = item.querySelector(".photo-info span"), image = item.querySelector("img"), title = image?.getAttribute("title")?.trim() ?? "";
            if (!titleNode || titleNode.firstElementChild?.classList.contains("video-title")) {
                item.querySelectorAll("br").forEach((lineBreak) => lineBreak.remove());
                continue;
            }
            const titleBox = this.document.createElement("span");
            titleBox.className = "video-title";
            titleBox.setAttribute("title", title);
            const firstContent = titleNode.firstChild;
            if (firstContent) titleBox.append(firstContent);
            else titleBox.textContent = title;
            titleNode.prepend(titleBox);
            item.querySelectorAll("br").forEach((lineBreak) => lineBreak.remove());
        }
    }
    getListSelectors() {
        return Object.freeze({
            boxSelector: ".masonry", itemSelector: ".masonry .item", coverImgSelector: ".masonry .movie-box .photo-frame img",
            requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next",
        });
    }
    getListLayoutContainer() { return this.document.querySelector(".container-fluid .row"); }
    /** @param {string[]} [classes] */
    createOwnedListRoot(classes = []) {
        const root = this.document.createElement("div");
        root.classList.add("masonry", ...classes);
        return root;
    }
    locateDetailRoot() { return this.locateNativeMagnets()?.closest(".container") ?? this.document.querySelector(".container .row.movie")?.parentElement ?? null; }
    locateDetailSlots() {
        const root = this.locateDetailRoot();
        return Object.freeze({
            summary: root?.querySelector('[data-jhs-slot="summary-actions"]') ?? root?.querySelector(".row.movie") ?? null,
            resources: this.locateNativeMagnets(),
            reviews: root?.querySelector('[data-jhs-slot="reviews"]') ?? this.document.querySelector("#reviews"),
            related: root?.querySelector('[data-jhs-slot="related"]'),
        });
    }
    locateNativeGallery() { return this.document.querySelector("#sample-waterfall, .sample-box"); }
    locateNativeMagnets() { return this.document.querySelector("#magnet-table"); }
    getDetailResourceBoundary() {
        const resourceRoot = this.locateNativeMagnets(), hostRoot = this.locateDetailRoot();
        if (!hostRoot || !resourceRoot) return null;
        return Object.freeze({
            site: "javbus", hostRoot, controller: resourceRoot, observeRoot: resourceRoot.parentElement, resourceRoot,
            resourceRegion: [...hostRoot.children].find((child) => child === resourceRoot || child.contains(resourceRoot)) || resourceRoot,
            rows: () => [...resourceRoot.querySelectorAll("tr")].filter((row) => row.querySelector('td a[href^="magnet:"],td a[href^="ed2k:"]')),
            sortSelect: null,
            getResource: (/** @type {Element} */ row) => row.querySelector('td a[href^="magnet:"],td a[href^="ed2k:"]')?.getAttribute("href") || "",
            getTitleTarget: (/** @type {Element} */ row) => row.querySelector("td:first-child a:first-child"),
            hasSubtitleTag: (/** @type {Element} */ row) => [...row.querySelectorAll("td:first-child a")].slice(1).some((anchor) => anchor.textContent?.includes("字幕")),
            getActionTarget(/** @type {Element} */ row) {
                const stable = [...row.querySelectorAll(".buttons,.actions,.btn-group")].filter((element) => element.closest("td")).at(-1);
                if (stable) return stable;
                const resourceLink = row.querySelector('td a[href^="magnet:"],td a[href^="ed2k:"]'), resourceCell = resourceLink?.closest("td");
                return resourceCell || null;
            },
            actionTargetRequiresWrapper: (/** @type {Element} */ row) => ![...row.querySelectorAll(".buttons,.actions,.btn-group")].some((element) => element.closest("td")),
        });
    }
}
