// @ts-check

import { getMovieStateEligibility, normalizeMovieCarNum } from "../../core/movie-identity.js";
import { classifyJavDbPage } from "../../core/site-context.js";




/** @typedef {{name: string, starId: string | null, role: "actress" | "actor" | "unknown", url: string | null, link: Element | null}} MovieActor */

/** Resolve actor identities only from a canonical, same-host actor detail link. @param {Element | null} link @param {string} baseUrl */
function readActorIdentity(link, baseUrl) {
    try {
        const href = link?.getAttribute("href");
        if (!href) return null;
        const base = new URL(baseUrl), url = new URL(href, base);
        const match = url.pathname.match(/^\/actors\/([\w-]+)\/?$/u);
        if (!match || !["http:", "https:"].includes(url.protocol) || url.origin !== base.origin) return null;
        return { starId: match[1], url: `${url.origin}/actors/${match[1]}` };
    } catch { return null; }
}

/** Read transient cast DOM references without inferring a role from an unmarked actor link.
 * @param {Document | Element} root @param {string} baseUrl
 * @returns {{actors: MovieActor[], panel: Element | null}}
 */
function parseJavDbMovieActors(root, baseUrl) {
    const heading = [...root.querySelectorAll("strong, .label")].find((element) => /^(?:演员|演員)\s*[:：]?$/u.test(element.textContent?.trim() || ""));
    const firstMarker = root.querySelector(".actor-female, .actor-male, .female, .male");
    const panel = heading?.closest(".panel-block") ?? heading?.parentElement ?? firstMarker?.closest(".panel-block") ?? null;
    const castRoot = panel?.querySelector("a[href], .female, .male") ? panel : root;
    /** @type {MovieActor[]} */ const actors = [];
    const seen = new Set();
    for (const element of castRoot.querySelectorAll("a[href], .female, .male")) {
        let source = element;
        /** @type {MovieActor["role"]} */ let role = "unknown";
        if (element.matches(".female, .male")) {
            role = element.matches(".female") ? "actress" : "actor";
            let previous = element.previousSibling;
            while (previous && !previous.textContent?.trim()) previous = previous.previousSibling;
            if (!previous) continue;
            if (previous.nodeType !== 1) {
                const name = previous.textContent?.trim() || "", key = `${role}:name:${name}`;
                if (name && !seen.has(key)) { seen.add(key); actors.push({ name, role, starId: null, url: null, link: null }); }
                continue;
            }
            source = /** @type {Element} */ (previous);
        } else {
            const marker = element.nextElementSibling;
            if (element.matches(".actor-female") || marker?.matches(".female")) role = "actress";
            else if (element.matches(".actor-male") || marker?.matches(".male")) role = "actor";
        }
        const link = source.matches("a[href]") ? source : null;
        const identity = readActorIdentity(link, baseUrl), name = source.textContent?.trim() || "";
        if (!name || role === "unknown" && !identity) continue;
        const key = `${role}:${identity ? `id:${identity.starId}` : `name:${name}`}`;
        if (seen.has(key)) continue;
        seen.add(key);
        actors.push({ name, role, starId: identity?.starId ?? null, url: identity?.url ?? null, link });
    }
    return { actors, panel };
}

export class JavDbHostAdapter {
    /** @param {Document} [documentRuntime] @param {Location} [locationRuntime] @param {{getSubjectInfo: (options: any) => any, parseFilterPage: (options: any) => any} | null} [blacklistParser] */
    constructor(documentRuntime = document, locationRuntime = window.location, blacklistParser = null) {
        this.site = "javdb";
        this.document = documentRuntime;
        this.location = locationRuntime;
        this.blacklistParser = blacklistParser;
        /** @type {WeakMap<Element, {container: Element, replacedNodes: Array<{node: Element, anchor: Comment}>}>} */ this.externalFc2CatalogMounts = new WeakMap();
    }
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
    /** @param {MutationRecord} record */
    isResourceMutation(record) {
        const selector = '[data-controller~="magnet-sort"],#magnets-content';
        if (record.target.nodeType === 1 && /** @type {Element} */ (record.target).closest(selector)) return true;
        return [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && (/** @type {Element} */ (node).matches(selector) || /** @type {Element} */ (node).querySelector(selector)));
    }
    detectRoute() {
        if (this.location.pathname.startsWith("/v/") || this.location.pathname.startsWith("/movies/")) return "detail";
        if (this.location.pathname === "/users/collection_codes") return "owned-detail";
        if (["actor-ranking", "award-ranking"].includes(this.getPageContext().kind)) return "other";
        return this.locateListRoot() ? "list" : "other";
    }
    getPageContext() { return classifyJavDbPage(this.location); }
    getBlacklistSubjectInfo() {
        if (!this.blacklistParser) throw new Error("黑名单页面解析器尚未配置");
        return this.blacklistParser.getSubjectInfo({ site: this.site, href: this.location.href, document: this.document });
    }
    /** @param {any} page @param {string} name @param {string} starId @param {string} [site] */
    parseBlacklistFilterPage(page, name, starId, site = this.site) {
        if (!this.blacklistParser) throw new Error("黑名单页面解析器尚未配置");
        return this.blacklistParser.parseFilterPage({ page, name, starId, site });
    }
    getTop250FilterContainer() { return this.document.querySelector("section .container") ?? this.getListContainer(); }
    locateTop250SubtitleCards() { return this.locateListItems(); }
    /** @param {Element} controls */
    mountTop250SubtitleControls(controls) {
        const root = this.locateListRoot();
        root?.parentElement?.insertBefore(controls, root);
    }
    /** @param {Element} root */
    mountExternalFc2Catalog(root) {
        const container = this.getListContainer();
        if (!container) throw new Error("JavDB 列表容器不可用");
        const replacedNodes = [...container.children].filter((child) => child.matches(".movie-list, nav.pagination, .box, .tool-box")).map((node) => {
            const anchor = this.document.createComment("jhs-fc2-catalog-slot");
            node.before(anchor);
            node.remove();
            return { node, anchor };
        });
        container.append(root);
        this.externalFc2CatalogMounts.set(root, { container, replacedNodes });
    }
    /** Restore host list controls after the 123AV Feature releases its owned catalog root. @param {Element} root */
    unmountExternalFc2Catalog(root) {
        root.remove();
        const mount = this.externalFc2CatalogMounts.get(root);
        if (!mount) return false;
        for (const { node, anchor } of mount.replacedNodes) {
            if (anchor.parentNode !== mount.container) continue;
            if (node.isConnected) anchor.remove();
            else anchor.replaceWith(node);
        }
        this.externalFc2CatalogMounts.delete(root);
        return true;
    }
    /** Carry only the JHS local filter while native TOP250 controls change category, year or page. */
    /** @param {string} value */
    syncTop250SubtitleLinks(value) {
        const container = this.getTop250FilterContainer();
        if (!container) return;
        for (const element of container.querySelectorAll('a[href^="/rankings/top"],select[data-url^="/rankings/top"]')) {
            const attribute = element.matches("select") ? "data-url" : "href";
            const original = element.getAttribute(attribute);
            if (!original) continue;
            const url = new URL(original, this.location.origin);
            value === "all" ? url.searchParams.delete("jhs_subtitle") : url.searchParams.set("jhs_subtitle", value);
            element.setAttribute(attribute, `${url.pathname}${url.search}`);
        }
    }
    readMovieRef() {
        const location = new URL(this.location.href);
        const copiedCarNum = this.document.querySelector('.column-video-info a[data-clipboard-text][title*="番"], .video-detail a[data-clipboard-text][title*="番"]')?.getAttribute("data-clipboard-text");
        const copiedTitleCarNum = this.document.querySelector('a[title="複製番號"]')?.getAttribute("data-clipboard-text");
        let panelCarNum = null;
        for (const panel of this.document.querySelectorAll(".column-video-info .panel-block, .video-detail .panel-block")) {
            const label = panel.querySelector("strong, .label")?.textContent?.trim() ?? "";
            if (!/(?:番号|番號|^ID)\s*[:：]?/i.test(label)) continue;
            panelCarNum = panel.querySelector("[data-clipboard-text]")?.getAttribute("data-clipboard-text") || panel.querySelector(".value")?.textContent;
            if (normalizeMovieCarNum(panelCarNum)) break;
        }
        const fallbackCarNum = [...this.document.querySelectorAll("#video_id, .video-id, .video-title strong")]
            .find(element => !element.closest(".movie-list, .masonry, .item"))?.textContent;
        const native = [copiedCarNum, copiedTitleCarNum, panelCarNum, fallbackCarNum].map(normalizeMovieCarNum).filter(Boolean);
        const hint = normalizeMovieCarNum(location.searchParams.get("jhsCarNum"));
        const carNum = native[0] ?? hint ?? null;
        const stateEligibility = getMovieStateEligibility(carNum);
        if (stateEligibility.eligible && (!native.length || native.some(value => value !== carNum) || hint && hint !== carNum)) {
            stateEligibility.eligible = false;
            stateEligibility.reason = native.length ? "conflicting" : "missing";
        }
        return carNum ? Object.freeze({ carNum, url: this.location.href, site: "javdb", stateEligibility }) : null;
    }
    /** @param {Document | Element} [root] @param {string} [baseUrl] */
    readMovieActors(root = this.document, baseUrl = this.location.href) {
        return parseJavDbMovieActors(root, baseUrl);
    }
    readMovieInfo() {
        const ref = this.readMovieRef();
        if (!ref) return null;
        const { actors } = this.readMovieActors();
        const dateLabel = [...this.document.querySelectorAll("strong")].find((element) => element.textContent?.includes("日期:"));
        const publishTime = dateLabel?.parentElement?.querySelector(".value")?.textContent?.trim() ?? "";
        return Object.freeze({ ...ref, actress: actors.filter(actor => actor.role === "actress").map(actor => actor.name).join(" "), actors: actors.filter(actor => actor.role === "actor").map(actor => actor.name).join(" "), publishTime });
    }
    locateListRoot() {
        if (/^\/v\//.test(this.location.pathname)) return null;
        const root = this.document.querySelector(".movie-list");
        root?.setAttribute("data-jhs-primary-list", "true");
        return root;
    }
    locateListItems() { return [...(this.locateListRoot()?.querySelectorAll(":scope > .item") ?? [])]; }
    getListContainer() { return this.locateListRoot()?.parentElement ?? null; }
    getListSelectors() {
        return Object.freeze({
            boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img",
            requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next",
        });
    }
    getListLayoutContainer() { return /^\/v\//.test(this.location.pathname) ? null : this.document.querySelector("section .container"); }
    /** @param {string[]} [classes] */
    createOwnedListRoot(classes = []) {
        const root = this.document.createElement("div");
        root.classList.add("movie-list", "h", "cols-4", "vcols-8", ...classes);
        return root;
    }
    /** 接管榜单容器，替换原生或旧榜单列表及其分页。 */
    /** @param {Element} container @param {Element} root */
    mountOwnedListRoot(container, root) {
        for (const child of [...container.children]) {
            if (child.matches(".movie-list, nav.pagination")) child.remove();
        }
        container.append(root);
    }
    locateDetailRoot() { return this.document.querySelector(".video-detail") ?? this.document.querySelector(".movie-panel-info")?.closest(".container") ?? this.document.querySelector("main"); }
    /** Detail Feature compatibility behavior: only HTTP(S) metadata links are opened in a new tab. */
    locateDetailExternalLinks() { return [...(this.document.querySelectorAll(".video-meta-panel a") ?? [])]; }
    locateDetailSlots() {
        const root = this.locateDetailRoot();
        return Object.freeze({
            summary: root?.querySelector('[data-jhs-slot="summary-actions"]') ?? this.document.querySelector(".movie-panel-info"),
            resources: this.document.querySelector("#magnets-content"),
            reviews: root?.querySelector('[data-jhs-slot="reviews"]') ?? this.document.querySelector("#reviews"),
            related: root?.querySelector('[data-jhs-slot="related"]'),
        });
    }
    /** Mount JHS detail actions at the host's native action boundary. @param {Element} element */
    mountDetailActions(element) {
        const tabs = this.document.querySelector(".tabs");
        if (!tabs) return false;
        tabs.after(element);
        return true;
    }
    locateNativeGallery() { return this.getDetailGalleryBoundaries()[0]?.root ?? null; }
    getDetailImageSequence() {
        return this.getDetailGalleryBoundaries().flatMap(boundary => boundary.items).flatMap(trigger => {
            if (trigger.closest(".screen-container")) return [];
            const image = trigger.querySelector("img");
            if (!image || trigger.matches(".preview-video-container") || trigger.getAttribute("data-action")?.includes("loadPreview") || trigger.querySelector("video") || trigger.getAttribute("href")?.startsWith("#")) return [];
            const href = trigger.getAttribute("href");
            if (!href) return [];
            let url;
            try { url = new URL(href || image.currentSrc || image.src, this.document.baseURI); } catch { return []; }
            if (url.origin === this.location.origin && /^\/v\//.test(url.pathname)) return [];
            return ["https:","http:"].includes(url.protocol) ? [{ trigger, image, url:url.href }] : [];
        });
    }
    getNativeGalleryRegion() { return this.locateDetailRoot()?.querySelector('.columns.preview, .preview-images') ?? null; }
    /** @param {Element} element */
    isDetailMediaBoundary(element) {
        const selector = '.tile-images,.preview-images,.movie-list,[data-jhs-native-gallery],[data-jhs-native-recommendations]';
        return element.matches(selector) || !!element.querySelector(selector);
    }
    /** Native media boundaries preserve the site's nodes and delegated actions. */
    getDetailGalleryBoundaries() {
        const root = this.locateDetailRoot();
        if (!root) return [];
        return [...root.querySelectorAll(".tile-images,.preview-images")].filter(gallery => !gallery.querySelector(".tile-images,.preview-images") && !this.isDetailRecommendationList(gallery)).map(gallery => ({
            root: gallery, region: this.detailMediaRegion(root, gallery),
            items: [...gallery.querySelectorAll(".tile-item,a,button")].filter(item => item.closest(".screen-container") ? item.matches(".screen-container") : !!item.querySelector("img") && !item.querySelector("a,button,.tile-item")),
        }));
    }
    getDetailRecommendationBoundaries() {
        const root = this.locateDetailRoot();
        if (!root || this.detectRoute() !== "detail") return [];
        return [...this.document.querySelectorAll(".movie-list,.tile-images")].filter(list => this.isDetailRecommendationList(list) && !list.closest("#magnets-content,[data-jhs-slot],.layui-layer") && !list.hasAttribute("data-jhs-primary-list")).map(list => {
            const panel = list.closest('.message.video-panel') || list.closest('section');
            return { root:list, region:this.detailMediaRegion(root,list), panel, heading:panel?.querySelector('.message-header') || panel?.querySelector(':scope > h3') };
        });
    }
    /** Movie tiles share the gallery class but carry navigation and movie metadata. @param {Element} list */
    isDetailRecommendationList(list) {
        return list.matches(".movie-list,.tile-small") || !!list.querySelector('a.tile-item[href] .video-number');
    }
    /** Filter host insertions for the feature-owned title translator. @param {Element} element */
    isDetailRecommendationMutation(element) {
        const selector = '.tile-small,.movie-list,.tile-item,.item,.video-number,.video-title';
        return element.matches(selector) || !!element.querySelector(selector);
    }
    /** @param {Element} root @param {Element} node */
    detailMediaRegion(root,node) {
        if (!root.contains(node)) return node.parentElement ?? node;
        let region = node;
        while (region.parentElement && region.parentElement !== root) region = region.parentElement;
        return region === node ? root : region;
    }
    locateNativeMagnets() { return this.document.querySelector("#magnets-content"); }
    getDetailResourceBoundary() {
        const resourceRoot = this.locateNativeMagnets(), controller = resourceRoot?.closest('[data-controller~="magnet-sort"]') || resourceRoot?.closest(".video-panel") || resourceRoot?.parentElement, hostRoot = this.locateDetailRoot();
        if (!hostRoot || !controller || !resourceRoot) return null;
        const resourceRegion = [...hostRoot.children].find((child) => child === controller || child.contains(controller)) || controller;
        return Object.freeze({
            site: "javdb", hostRoot, controller, observeRoot: controller, resourceRoot, resourceRegion,
            rows: () => [...resourceRoot.querySelectorAll(".item")].filter(row => row.querySelector(".magnet-name") && row.querySelector(".buttons")),
            sortSelect: controller.querySelector('select[data-action*="magnet-sort#sort"]'),
            prepareLayout() {
                resourceRoot.setAttribute("data-jhs-magnets", "true");
                resourceRegion.setAttribute("data-jhs-host-region", "resources");
                const surface = resourceRoot.closest(".message.video-panel, .video-panel") || controller;
                surface.setAttribute("data-jhs-resource-surface", "true");
                const body = resourceRoot.closest(".message-body");
                if (body && surface.contains(body)) body.setAttribute("data-jhs-resource-body", "true");
                for (const row of resourceRoot.querySelectorAll(".item")) {
                    if (!row.matches(".item")) continue;
                    const info = row.querySelector(".magnet-name"), date = row.querySelector(".date"), actions = row.querySelector(".buttons");
                    if (!info || !actions) continue;
                    row.setAttribute("data-jhs-magnet-row", "true");
                    info.setAttribute("data-jhs-magnet-part", "info");
                    date?.setAttribute("data-jhs-magnet-part", "date");
                    actions.setAttribute("data-jhs-magnet-part", "actions");
                }
            },
            getResource(/** @type {Element} */ row) { return row.querySelector('.copy-to-clipboard[data-clipboard-text^="magnet:"]')?.getAttribute("data-clipboard-text") || row.querySelector('.magnet-name a[href^="magnet:"]')?.getAttribute("href") || ""; },
            getActionTarget: (/** @type {Element} */ row) => row.querySelector(".buttons"),
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
            const numbers = [...(titleNode?.querySelectorAll("strong") ?? [])].map(element => normalizeMovieCarNum(element.textContent)).filter(Boolean);
            const stateEligibility = numbers.some(value => value !== carNum) ? {eligible:false,reason: /** @type {const} */ ("conflicting")} : getMovieStateEligibility(carNum);
            const rawCover = item.querySelector("img")?.getAttribute("src") ?? "", href = item.querySelector("a[href]")?.getAttribute("href") ?? "";
            const scoreText = item.querySelector(".score .value, .score")?.textContent?.trim() ?? "", countText = item.querySelector(".score .count, .meta .count")?.textContent?.trim() ?? "";
            return [Object.freeze({
                carNum, stateEligibility, title: (titleNode?.textContent ?? "").replace(rawCarNum, "").trim(),
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
