// @ts-check

import { normalizeHttpUrl } from "../../core/feature-helpers.js";
import { classifyJavDbPage } from "../../core/site-context.js";
import { createFc2SourceLinks, renderFc2Gallery, renderFc2State } from "../../ui/detail/fc2-workspace-view.js";

/** @typedef {{ root: any, carNum: string, isAlive: () => boolean }} Fc2DetailContext */

/** Native owner for the 123AV FC2 catalog and the FC2 detail lookup capability. */
export class Fc2CatalogController {
    /** @param {{document: Document, window: Window, site: string, route: string, hostAdapter: any, movie: any, ui: any, notifications: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, processAddedItems?: (items: Element[]) => Promise<unknown> | unknown}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.site = options.site;
        this.route = options.route;
        this.hostAdapter = options.hostAdapter;
        this.movie = options.movie;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.processAddedItems = options.processAddedItems ?? null;
        this.jquery = this.ui.jquery;
        this.urlParams = new URLSearchParams(this.window.location.search);
        this.currentPage = Math.max(1, Number.parseInt(this.urlParams.get("page") || "1", 10) || 1);
        this.maxPage = null;
        this.keyword = this.urlParams.get("keyword") || "";
        this.queryGeneration = 0;
        this.started = false;
        this.categoryLink = null;
        this.catalogRoot = null;
        this.contentBox = null;
        this.heading = null;
        this.headingSnapshot = null;
        this.ownedHeading = false;
        this.searchInput = null;
        this.pageBox = null;
        this.paginationList = null;
        this.namespace = ".jhsFc2Catalog";
        /** @type {Array<() => void>} */ this.listenerCleanups = [];
        this.managedByFeature = true;
        this.runtimeStatus = "managed-feature";
    }

    /** @returns {Promise<boolean>} */
    async start() {
        if (this.started || this.scope.disposed || this.site !== "javdb") return false;
        this.started = true;
        this.scope.addCleanup(() => this.dispose());
        this.mountCategoryLink();
        if (classifyJavDbPage(this.window.location).kind === "external-fc2-catalog") {
            this.mountCatalog();
            await this.query();
        }
        return true;
    }

    /** Resolve the JavDB movie associated with an FC2 number. @param {string} carNum */
    async resolveMovieId(carNum) {
        const movie = await this.movie.resolve({ carNum }, { scope: this.scope });
        return movie?.movieId || null;
    }

    mountCategoryLink() {
        const categoryLink = this.document.querySelector('#navbar-menu-hero a[href^="/tags/fc2"]');
        if (!categoryLink || this.document.querySelector("#jhs-123av-nav")) return;
        const link = this.document.createElement("a");
        link.id = "jhs-123av-nav";
        link.className = "navbar-item";
        link.href = "/tags/fc2?c10=1&jhs_source=123av";
        link.textContent = "123AV · FC2片库";
        categoryLink.after(link);
        this.categoryLink = link;
    }

    mountCatalog() {
        const container = this.hostAdapter.getListContainer?.();
        if (!container) throw new Error("JavDB 列表容器不可用");
        this.contentBox = container;
        const existingHeading = container.querySelector("h2.section-title");
        if (existingHeading) {
            this.heading = existingHeading;
            this.headingSnapshot = existingHeading.cloneNode(true);
            existingHeading.textContent = "123AV · FC2片库";
        } else {
            this.heading = this.document.createElement("h2");
            this.heading.className = "section-title";
            this.heading.textContent = "123AV · FC2片库";
            container.prepend(this.heading);
            this.ownedHeading = true;
        }
        this.heading.style.marginBottom = "0";

        const controls = this.document.createElement("div");
        controls.className = "jhs-layout-f5f47b30";
        this.searchInput = this.document.createElement("input");
        this.searchInput.id = "search-123av-keyword";
        this.searchInput.type = "text";
        this.searchInput.placeholder = "搜索123AV FC2内容";
        this.searchInput.className = "jhs-field";
        this.searchInput.value = this.keyword;
        const searchButton = this.createButton("搜索", "jhs-btn jhs-btn--primary jhs-layout-21a4fe43");
        const clearButton = this.createButton("重置", "jhs-btn jhs-btn--secondary jhs-layout-21a4fe43");
        controls.append(this.searchInput, searchButton, clearButton);
        this.heading.append(controls);

        this.catalogRoot = this.hostAdapter.createOwnedListRoot(["jhs-123av-list", "jhs-layout-d2c171b1"]);
        this.hostAdapter.mountExternalFc2Catalog(this.catalogRoot);
        this.contentBox.querySelector(".empty-message")?.remove();
        this.contentBox.querySelector("#foldCategoryBtn")?.remove();
        this.pageBox = this.document.createElement("div");
        this.pageBox.className = "page-box";
        const nav = this.document.createElement("nav");
        nav.className = "pagination";
        const previous = this.createButton("上一页", "jhs-btn pagination-previous");
        this.paginationList = this.document.createElement("ul");
        this.paginationList.className = "pagination-list";
        const next = this.createButton("下一页", "jhs-btn pagination-next");
        nav.append(previous, this.paginationList, next);
        this.pageBox.append(nav);
        this.contentBox.append(this.pageBox);
        this.updateUrlParameter("page", String(this.currentPage));

        this.listen(searchButton, "click", () => void this.search());
        this.listen(clearButton, "click", () => void this.clearSearch());
        this.listen(previous, "click", (event) => {
            event.preventDefault();
            if (this.currentPage > 1) void this.changePage(this.currentPage - 1);
        });
        this.listen(next, "click", (event) => {
            event.preventDefault();
            if (this.currentPage < (this.maxPage ?? 0)) void this.changePage(this.currentPage + 1);
        });
        this.listen(this.paginationList, "click", (event) => {
            const target = /** @type {Element | null} */ (event.target);
            const button = target && typeof target.closest === "function" ? target.closest(".pagination-link") : null;
            if (!button || !this.paginationList?.contains(button)) return;
            event.preventDefault();
            const page = Number.parseInt(button.getAttribute("data-page") || "", 10);
            if (Number.isInteger(page) && page >= 1) void this.changePage(page);
        });
    }

    /** @param {EventTarget} target @param {string} type @param {EventListener} listener */
    listen(target, type, listener) { this.listenerCleanups.push(this.scope.listen(target, type, listener)); }

    /** @param {string} label @param {string} className */
    createButton(label, className) {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        return button;
    }

    async search() {
        const keyword = this.searchInput?.value.trim() ?? "";
        if (!keyword) return;
        this.keyword = keyword;
        this.updateUrlParameter("keyword", keyword);
        this.currentPage = 1;
        this.maxPage = null;
        this.updateUrlParameter("page", "1");
        await this.query();
    }

    async clearSearch() {
        if (this.searchInput) this.searchInput.value = "";
        this.keyword = "";
        this.updateUrlParameter("keyword", "");
        this.currentPage = 1;
        this.maxPage = null;
        this.updateUrlParameter("page", "1");
        if (this.pageBox) this.pageBox.hidden = false;
        await this.query();
    }

    /** @param {number} page */
    async changePage(page) {
        this.currentPage = page;
        this.updateUrlParameter("page", String(page));
        this.renderPagination();
        await this.query();
    }

    /** @param {string} key @param {string} value */
    updateUrlParameter(key, value) {
        const url = new URL(this.window.location.href);
        url.searchParams.set(key, value);
        this.window.history.pushState({}, "", url.toString());
    }

    renderPagination() {
        if (!this.paginationList) return;
        this.paginationList.replaceChildren();
        const maxPage = this.maxPage ?? 1;
        let first = Math.max(1, this.currentPage - 2), last = Math.min(maxPage, this.currentPage + 2);
        if (this.currentPage <= 3) last = Math.min(6, maxPage);
        else if (this.currentPage >= maxPage - 2) first = Math.max(maxPage - 5, 1);
        if (first > 1) {
            this.appendPageButton(1);
            if (first > 2) this.appendEllipsis();
        }
        for (let page = first; page <= last; page += 1) this.appendPageButton(page, page === this.currentPage);
        if (last < maxPage) {
            if (last < maxPage - 1) this.appendEllipsis();
            this.appendPageButton(maxPage);
        }
    }

    /** @param {number} page @param {boolean} [current] */
    appendPageButton(page, current = false) {
        if (!this.paginationList) return;
        const item = this.document.createElement("li");
        const button = this.createButton(String(page), `jhs-btn pagination-link${current ? " is-current" : ""}`);
        button.setAttribute("data-page", String(page));
        if (current) button.setAttribute("aria-current", "page");
        item.append(button);
        this.paginationList.append(item);
    }

    appendEllipsis() {
        if (!this.paginationList) return;
        const item = this.document.createElement("li");
        const span = this.document.createElement("span");
        span.className = "pagination-ellipsis";
        span.textContent = "…";
        item.append(span);
        this.paginationList.append(item);
    }

    async query() {
        if (!this.catalogRoot || this.scope.disposed) return;
        const generation = ++this.queryGeneration;
        const loading = this.ui.loading();
        try {
            if (this.pageBox) this.pageBox.hidden = false;
            const result = await this.movie.catalog("av123", { page: this.currentPage, keyword: this.keyword }, { scope: this.scope });
            if (this.scope.disposed || generation !== this.queryGeneration) return;
            const items = Array.isArray(result?.items) ? result.items : [];
            this.maxPage = Math.max(1, Number(result?.maxPage) || 1);
            this.currentPage = Math.min(Math.max(1, this.currentPage), this.maxPage);
            this.renderPagination();
            this.renderItems(items);
            if (!items.length) this.notifications.error("无结果");
            if (this.processAddedItems) await this.processAddedItems([...this.catalogRoot.querySelectorAll(".item")]);
            await this.ui.smoothScrollToTop?.();
        } catch (error) {
            if (!this.scope.disposed && generation === this.queryGeneration) this.diagnostics.recordError({ source: "fc2-catalog", featureId: "external-bridge", contributionId: "detail.fc2-lookup", message: error instanceof Error ? error.message : String(error) });
        } finally {
            loading?.close?.();
        }
    }

    /** @param {Array<{url?: string, imageUrl?: string, title?: string, carNum?: string}>} items */
    renderItems(items) {
        if (!this.catalogRoot) return;
        const fragment = this.document.createDocumentFragment();
        for (const item of items) {
            const href = normalizeHttpUrl(item.url);
            if (!href) continue;
            const card = this.document.createElement("div");
            card.className = "item";
            card.setAttribute("data-jhs-fc2-source", "123av");
            const link = this.document.createElement("a");
            link.className = "box";
            link.href = href;
            link.title = String(item.title ?? "");
            const cover = this.document.createElement("div");
            cover.className = "cover";
            const imageUrl = normalizeHttpUrl(item.imageUrl);
            if (imageUrl) {
                const image = this.document.createElement("img");
                image.loading = "lazy";
                image.src = imageUrl;
                image.alt = "";
                cover.append(image);
            }
            const title = this.document.createElement("div");
            title.className = "video-title";
            const carNum = this.document.createElement("strong");
            carNum.textContent = String(item.carNum ?? "");
            title.append(carNum, this.document.createTextNode(` ${String(item.title ?? "")}`));
            const score = this.document.createElement("div"); score.className = "score";
            const meta = this.document.createElement("div"); meta.className = "meta";
            const toolbar = this.document.createElement("div"); toolbar.className = "jhs-toolbar";
            link.append(cover, title, score, meta, toolbar);
            card.append(link);
            fragment.append(card);
        }
        this.catalogRoot.replaceChildren(fragment);
    }

    /** Load 123AV details into the active FC2 workspace. @param {Fc2DetailContext} context @param {string} url */
    async loadDetail(context, url) {
        const infoPromise = this.loadSummary(context, url);
        const imagesPromise = this.getImgList(context.carNum);
        const actressPromise = this.getActressInfo(context.carNum);
        imagesPromise.then((images) => context.isAlive() && renderFc2Gallery(context, images, null)).catch(() => context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="gallery-grid"]'), "剧照加载失败", () => void this.reloadImages(context)));
        actressPromise.then(async (data) => {
            await infoPromise.catch(() => null);
            if (context.isAlive()) this.render123AvActress(context, data);
        }).catch((error) => this.diagnostics.recordError({ source: "fc2-catalog", message: error instanceof Error ? error.message : String(error) }));
        await Promise.allSettled([infoPromise, imagesPromise, actressPromise]);
    }

    /** @param {Fc2DetailContext} context @param {string} url */
    async loadSummary(context, url) {
        try {
            const info = await this.get123AvVideoInfo(context.carNum, url);
            if (!context.isAlive()) return null;
            this.render123AvSummary(context, info);
            return info;
        } catch (error) {
            if (context.isAlive()) renderFc2State(context.root.find('[data-jhs-role="summary-content"]'), "影片信息加载失败", () => void this.loadSummary(context, url));
            this.diagnostics.recordError({ source: "fc2-catalog", message: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /** @param {Fc2DetailContext} context @param {{title: string, publishDate: string}} info */
    render123AvSummary(context, info) {
        const $ = this.jquery;
        const body = context.root.find('[data-jhs-role="summary-content"]').empty();
        const title = $('<h1 class="jhs-fc2-title"><strong class="current-title"></strong></h1>');
        title.find("strong").text(info.title || "无标题");
        body.append(title, $('<div class="jhs-fc2-meta"></div>').append($('<span></span>').text(`番号：${context.carNum}`), $('<span></span>').text(`发行：${info.publishDate || "未知"}`)), '<div class="jhs-fc2-actors" data-jhs-role="actors"><strong>主演：</strong><span>正在加载演员…</span></div>', '<div class="jhs-fc2-meta" data-jhs-role="seller"></div>', createFc2SourceLinks(context, this.movie), $('<span class="jhs-is-hidden" data-jhs-role="publish-time"></span>').text(info.publishDate || ""));
    }

    /** @param {string} carNum @param {string} url */
    async get123AvVideoInfo(carNum, url) {
        const detail = await this.movie.detail({ carNum, url, providerId: "av123" }, { scope: this.scope });
        return { title: detail?.title || "", publishDate: detail?.releaseDate || "", moviePoster: null };
    }

    /** @param {string} carNum */
    async getActressInfo(carNum) { return this.movie.people("fc2ppvdb", { carNum }, { scope: this.scope }); }

    /** @param {string} carNum */
    async getImgList(carNum) {
        const images = /** @type {Array<{url: string}>} */ (await this.movie.images("fc2content", { carNum }, { scope: this.scope }));
        return images.map((item) => item.url);
    }

    /** @param {Fc2DetailContext} context */
    async reloadImages(context) {
        try {
            const images = await this.getImgList(context.carNum);
            if (context.isAlive()) renderFc2Gallery(context, images, null);
        } catch {
            if (context.isAlive()) renderFc2State(context.root.find('[data-jhs-role="gallery-grid"]'), "剧照加载失败", () => void this.reloadImages(context));
        }
    }

    /** @param {Fc2DetailContext} context @param {{actors: Array<{name: string, url: string}>, seller?: {name: string, url?: string} | null}} data */
    render123AvActress(context, data) {
        const $ = this.jquery;
        const host = context.root.find('[data-jhs-role="actors"]').empty().append("<strong>主演：</strong>");
        if (data.actors.length) data.actors.forEach((actor) => host.append($('<a></a>').addClass("jhs-fc2-actor").attr({ href: actor.url, target: "_blank", rel: "noopener noreferrer" }).text(actor.name)));
        else host.append($('<span></span>').text("暂无演员信息"));
        context.root.find('[data-jhs-role="actress-data"]').remove();
        context.root.find(".jhs-fc2-summary__body").append($('<span class="jhs-is-hidden" data-jhs-role="actress-data"></span>').text(data.actors.map((actor) => actor.name).join(" ")));
        if (data.seller) context.root.find('[data-jhs-role="seller"]').empty().append("卖家：", data.seller.url ? $('<a></a>').attr({ href: data.seller.url, target: "_blank", rel: "noopener noreferrer" }).text(data.seller.name) : this.document.createTextNode(data.seller.name));
    }

    dispose() {
        this.queryGeneration += 1;
        for (const cleanup of this.listenerCleanups.splice(0).reverse()) cleanup();
        if (this.catalogRoot) {
            if (typeof this.hostAdapter.unmountExternalFc2Catalog === "function") this.hostAdapter.unmountExternalFc2Catalog(this.catalogRoot);
            else this.catalogRoot.remove();
        }
        this.pageBox?.remove();
        if (this.heading && this.headingSnapshot && this.heading.parentNode) this.heading.replaceWith(this.headingSnapshot);
        else if (this.ownedHeading) this.heading?.remove();
        this.categoryLink?.remove();
        this.catalogRoot = null;
        this.pageBox = null;
        this.heading = null;
        this.categoryLink = null;
        this.started = false;
    }

}
