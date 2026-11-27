// @ts-check
import { privacySelectors } from "../../contracts/privacy-targets.js";
import { findJavBusDetailRoot, readJavBusDetailImageSequence } from "../../core/javbus-detail-images.js";

import { cleanActressName, readCleanActorElementText } from "../../core/actress-measurements.js";
import { getMovieStateEligibility, normalizeMovieCarNum } from "../../core/movie-identity.js";

/** JavBus 带分页的列表路径前缀（除 /page/N 外的 /<prefix>/<id>/N 形式）。 */
const JAVBUS_LIST_PREFIXES = new Set([ "star", "genre", "maker", "actress", "series", "tag", "search", "director", "studio", "label" ]);

export class JavBusHostAdapter {
    /** @param {string} route */
    getTitleKeywordSelector(route) { return route === "detail" ? ".row.movie h3,.container > h3,.current-title" : ".video-title,.jhs-fc2-title"; }
    getPrivacySelectors() { return privacySelectors({ title: ".movie-box .photo-info span,.container > h3,.container > .row > h3", code: ".movie-box date,.info .header + span,.info p", actors: ".star-box,.star-name,.info a[href*='/star/']", images: ".avatar-box,.avatar-box img,.movie-box img,.bigImage img,.sample-box img,.star-box img" }); }
    locateMediaLibraryDetailRoot() { return this.detectRoute() === "detail" ? this.document.querySelector(".container .info") : null; }
    /** @param {Document} [documentRuntime] @param {Location | URL} [locationRuntime] @param {{getSubjectInfo: (options: any) => any, parseFilterPage: (options: any) => any} | null} [blacklistParser] */
    constructor(documentRuntime = document, locationRuntime = window.location, blacklistParser = null) { this.site = "javbus"; this.document = documentRuntime; this.location = locationRuntime; this.blacklistParser = blacklistParser; }
    getBlacklistSubjectInfo() {
        if (!this.blacklistParser) throw new Error("黑名单页面解析器尚未配置");
        return this.blacklistParser.getSubjectInfo({ site: this.site, href: this.location.href, document: this.document });
    }
    /** @param {any} page @param {string} name @param {string} starId @param {string} [site] */
    parseBlacklistFilterPage(page, name, starId, site = this.site) {
        if (!this.blacklistParser) throw new Error("黑名单页面解析器尚未配置");
        return this.blacklistParser.parseFilterPage({ page, name, starId, site });
    }
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
                    || (segments.length >= 3 && JAVBUS_LIST_PREFIXES.has(segments[segments.length - 3]));
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
    /** @param {MutationRecord} record */
    isResourceMutation(record) {
        const selector = '#magnet-table';
        if (record.target.nodeType === 1 && /** @type {Element} */ (record.target).closest(selector)) return true;
        return [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && (/** @type {Element} */ (node).matches(selector) || /** @type {Element} */ (node).querySelector(selector)));
    }
    detectRoute() { return this.locateNativeMagnets() ? "detail" : this.locateListRoot() ? "list" : "other"; }
    /** @param {Document | Element} [root] @param {string} [baseUrl] */
    readActorProfile(root = this.document, baseUrl = this.location.href) {
        let starId = null;
        let isUncensored = false;
        try {
            const parsed = new URL(baseUrl, this.location?.href || "https://www.javbus.com");
            if (parsed.pathname.includes("uncensored")) isUncensored = true;
            const match = parsed.pathname.match(/\/star\/([^/?#]+)/u);
            if (match) {
                try { starId = decodeURIComponent(match[1]); }
                catch { starId = match[1]; }
            }
        } catch {
            starId = null;
        }
        const title = root.querySelector(".avatar-box .photo-info .pb10");
        const anchorParent = title?.parentElement ?? null;
        /** @type {string[]} */
        const names = [];
        const seen = new Set();
        if (title) {
            const titleText = readCleanActorElementText(title);
            if (/無碼|无码/u.test(titleText)) isUncensored = true;
            for (const part of titleText.split(/[,，、]/u)) {
                const cleaned = cleanActressName(part);
                if (!cleaned || seen.has(cleaned)) continue;
                seen.add(cleaned);
                names.push(cleaned);
            }
        }
        if (!names.length) return null;
        return Object.freeze({ starId: starId || null, name: names[0], names: Object.freeze(names), actressType: isUncensored ? "uncensored" : "censored", anchorParent });
    }
    readMovieRef() {
        const pathCarNum = this.location.pathname.split("/").filter(Boolean).pop()?.replace(/_\d{4}-\d{2}-\d{2}$/u, "") ?? null;
        const explicit = this.document.querySelector("[data-car-number]");
        const numberLabel = [...this.document.querySelectorAll(".info p")].find(element => /(?:識別碼|识别码|番号|番號|ID)\s*[:：]/i.test(element.textContent ?? ""));
        const numberValue = numberLabel?.cloneNode(true);
        if (numberValue?.nodeType === 1) /** @type {Element} */ (numberValue).querySelector(".header")?.remove();
        const domCarNum = normalizeMovieCarNum(explicit?.getAttribute("data-car-number") || numberValue?.textContent);
        const path = normalizeMovieCarNum(pathCarNum), carNum = domCarNum ?? path;
        const stateEligibility = getMovieStateEligibility(carNum);
        if (stateEligibility.eligible && domCarNum && path && domCarNum !== path) {
            stateEligibility.eligible = false;
            stateEligibility.reason = "conflicting";
        }
        return carNum ? Object.freeze({ carNum, url: this.location.href, site: "javbus", stateEligibility }) : null;
    }
    readMovieActors() {
        const panel = this.document.querySelector(".row.movie .info,.container .info");
        const links = [...(panel?.querySelectorAll('a[href*="/star/"]') ?? [])];
        const actors = links.flatMap(link => {
            const url = new URL(link.getAttribute("href") || "", this.location.href), id = url.pathname.match(/\/star\/([^/]+)/u)?.[1];
            const name = cleanActressName(readCleanActorElementText(link));
            const role = /男|male/i.test(link.getAttribute("data-role") || link.querySelector("i")?.className || "") && !/female/i.test(link.querySelector("i")?.className || "") ? "actor" : "actress";
            return id && name ? [{ starId: id, name, role, link }] : [];
        });
        return { actors, panel };
    }
    readMovieInfo() {
        const ref = this.readMovieRef();
        if (!ref) return null;
        const actress = [...this.document.querySelectorAll('span[onmouseover*="star_"] a')].map((element) => element.textContent?.trim()).filter(Boolean).join(" ");
        const release = [...this.document.querySelectorAll("span.header")].find((element) => element.textContent?.includes("發行日期:"));
        const publishTime = release?.parentElement?.textContent?.replace("發行日期:", "").trim() ?? "";
        const title = this.document.querySelector(".container > h3, .container > .row > h3")?.textContent?.trim() ?? "";
        return Object.freeze({ ...ref, title, actress, actors: "", publishTime });
    }
    locateListRoot() { return this.document.querySelector(".masonry"); }
    locateListItems() { return [...(this.locateListRoot()?.querySelectorAll(":scope > .item, :scope > .movie-box") ?? [])]; }
    getListContainer() { return this.locateListRoot()?.parentElement ?? null; }
    getListSelectors() {
        return Object.freeze({
            boxSelector: ".masonry", itemSelector: ".masonry .item", coverImgSelector: ".masonry .movie-box .photo-frame img",
            requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next",
        });
    }
    getListLayoutContainer() { return this.locateListRoot()?.closest(".container") ?? null; }
    getPaginationBoundary() {
        const list = this.getListLayoutContainer()?.querySelector("ul.pagination") ?? this.document.querySelector("ul.pagination");
        if (!list?.querySelector(".active,[aria-current='page']")) return null;
        const url = new URL(this.location.href);
        const base = new URL(this.resolveFirstPageUrl(url.href)), prefix = base.pathname.split("/").filter(Boolean)[0] || "";
        const page = base.pathname === url.pathname ? 1 : Number(url.pathname.split("/").filter(Boolean).at(-1)) || 1;
        return { list, page, target: (/** @type {number} */ next) => {
            const address = new URL(base);
            if (next > 1) address.pathname = base.pathname.replace(/\/$/u, "") + (JAVBUS_LIST_PREFIXES.has(prefix) ? "/" : "/page/") + next;
            return address.href;
        } };
    }
    /** @param {string[]} [classes] */
    createOwnedListRoot(classes = []) {
        const root = this.document.createElement("div");
        root.classList.add("masonry", ...classes);
        return root;
    }
    locateDetailRoot() { return findJavBusDetailRoot(this.document); }
    locateDetailSlots() {
        const root = this.locateDetailRoot();
        return Object.freeze({
            summary: root?.querySelector('[data-jhs-slot="summary-actions"]') ?? root?.querySelector(".row.movie") ?? null,
            resources: this.locateNativeMagnets(),
            reviews: root?.querySelector('[data-jhs-slot="reviews"]') ?? this.document.querySelector("#reviews"),
            related: root?.querySelector('[data-jhs-slot="related"]') ?? root?.querySelector(".row.movie")?.parentElement,
        });
    }
    /** Mount JHS detail actions before the native offline-submit control. @param {Element} element */
    mountDetailActions(element) {
        const target = this.document.querySelector("#mag-submit-show");
        if (!target) return false;
        target.before(element);
        return true;
    }
    locateNativeGallery() { return this.document.querySelector("#sample-waterfall, .sample-box:not(.screen-container)"); }
    getDetailImageSequence() {
        return readJavBusDetailImageSequence(this.locateDetailRoot(), this.location.href);
    }
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
