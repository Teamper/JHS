// @ts-check

import { escapeHtml, o } from "../../core/constants.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */
/** @typedef {{ preventDefault: () => void, target: EventTarget }} JQueryClickEvent */
/** @typedef {{ url: string, imageUrl?: string, title: string, carNum: string }} Fc2CatalogItem */

export class ListFc2LookupController {
    /** @param {{hostAdapter?: any, movie?: any, lookup?: any, translation?: any, settings?: any, ui?: any, scope?: any, document?: Document, window?: Window}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.movie = options.movie ?? null;
        this.lookup = options.lookup ?? null;
        this.translation = options.translation ?? null;
        this.settings = options.settings ?? null;
        this.ui = options.ui ?? null;
        this.scope = options.scope ?? null;
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? globalThis.window;
        /** @type {Record<string, any>} */ this.runtimeServices = {};
        /** @type {JQueryHandle | null} */ this.$contentBox = null;
        /** @type {JQueryHandle | null} */ this.$listRoot = null;
        this.urlParams = new URLSearchParams(this.window.location.search);
        this.currentPage = Math.max(1, parseInt(this.urlParams.get("page") || "1", 10) || 1);
        /** @type {number | null} */ this.maxPage = null;
        /** @type {number} */ this._queryGeneration = 0;
        /** @type {string | null} */ this.keyword = this.urlParams.get("keyword") || null;
        /** @type {any} */ this.lifecycleScope = null;
        /** @type {JQueryHandle | null} */ this.$paginationBox = null;
    }
    /** @param {string} name */
    getRuntimeService(name) { return this.runtimeServices[name] ?? ({ host: this.hostAdapter, movie: this.movie, translation: this.translation, settings: this.settings, ui: this.ui, scope: this.scope }[name] ?? null); }
    getJQuery() { return this.ui?.getJQuery?.() ?? this.getRuntimeService("ui")?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getUtils() { return this.ui?.getUtils?.() ?? this.getRuntimeService("ui")?.getUtils?.() ?? {}; }
    getShow() { return this.ui?.show ?? this.getRuntimeService("ui")?.show ?? {}; }
    getClog() { return this.ui?.getClog?.() ?? this.getRuntimeService("ui")?.getClog?.() ?? {}; }
    getLoading() { return this.ui?.getLoading?.() ?? this.getRuntimeService("ui")?.getLoading?.() ?? (() => ({ close() {} })); }
    async getLifecycleScope() { return this.lifecycleScope || await this.getRuntimeService("scope")?.(); }
    /** @param {any} scope */
    bindLifecycleScope(scope) {
        if (this.lifecycleScope === scope) return;
        this.lifecycleScope = scope;
        if (typeof scope?.addCleanup !== "function") return;
        scope.addCleanup(() => {
            this.getJQuery()(this.document).off(".jhsFc2Lookup");
            $("[data-jhs-owner='fc2-lookup']").remove();
            this.$listRoot?.remove();
            this.$paginationBox?.remove();
            this.$contentBox = null;
            this.$listRoot = null;
            this.$paginationBox = null;
            this._queryGeneration++;
            this.lifecycleScope = null;
        });
    }
    /** @param {string} carNum */
    async resolveMovieId(carNum) {
        const scope = await this.getLifecycleScope();
        if (this.lookup?.resolveMovieId) return this.lookup.resolveMovieId(carNum, { scope });
        return (await this.getRuntimeService("movie").resolve({ carNum }, { scope }))?.movieId || null;
    }
    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        this.bindLifecycleScope(options.scope || await this.getLifecycleScope());
        $("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)").after('<a class="navbar-item" data-jhs-owner="fc2-lookup" href="/advanced_search?type=100&released_start=2099-09">123Av-Fc2</a>'),
        $('.tabs li:contains("FC2")').after('<li data-jhs-owner="fc2-lookup"><a href="/advanced_search?type=100&released_start=2099-09"><span>123Av-Fc2</span></a></li>'),
        o.includes("/advanced_search?type=100") && (this.hookPage(), await this.handleQuery());
    }
    hookPage() {
        const host = this.getRuntimeService("host"), listRoot = host?.locateListRoot?.(), contentBox = host?.getListContainer?.();
        if (!listRoot || !contentBox) throw new Error("JavDB 列表容器不可用");
        const $ = this.getJQuery(), utils = this.getUtils();
        this.$contentBox = $(contentBox), this.$listRoot = $(host.createOwnedListRoot([ "jhs-123av-list", "jhs-layout-d2c171b1" ]));
        let e = $("h2.section-title");
        e.contents().first().replaceWith("123Av"), e.css("marginBottom", "0"), e.append('\n            <div class="jhs-layout-f5f47b30" data-jhs-owner="fc2-lookup">\n                <input id="search-123av-keyword" type="text" placeholder="搜索123Av Fc2ppv内容" class="jhs-field">\n                <button type="button" id="search-123av-btn" class="jhs-btn jhs-btn--primary jhs-layout-21a4fe43">搜索</button>\n                <button type="button" id="clear-123av-btn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n            </div>\n        '),
        $("#search-123av-keyword").val(this.keyword), $("#search-123av-btn").off("click.jhsFc2Lookup").on("click.jhsFc2Lookup", (async () => {
            let e = String($("#search-123av-keyword").val() || "").trim();
            e && (this.keyword = e, utils.setHrefParam("keyword", e), this.currentPage = 1, this.maxPage = null, utils.setHrefParam("page", 1), await this.handleQuery());
        })), $("#clear-123av-btn").off("click.jhsFc2Lookup").on("click.jhsFc2Lookup", (async () => {
            $("#search-123av-keyword").val(""), this.keyword = "", utils.setHrefParam("keyword", ""),
            this.currentPage = 1, this.maxPage = null, utils.setHrefParam("page", 1), this.$paginationBox?.show(), await this.handleQuery();
        })), $(".empty-message").remove(), $("#foldCategoryBtn").remove(), this.$contentBox.children(".box").remove(),
        $("#sort-toggle-btn").remove(),
        this.$contentBox.append(this.$listRoot),
        this.$paginationBox = $('<div class="page-box" data-jhs-owner="fc2-lookup"></div>').appendTo(this.$contentBox);
        utils.setHrefParam("page", this.currentPage);
        this.$paginationBox.append('\n            <nav class="pagination">\n                <button type="button" class="jhs-btn pagination-previous">上一页</button>\n                <ul class="pagination-list"></ul>\n                <button type="button" class="jhs-btn pagination-next">下一页</button>\n            </nav>\n        '),
        $(document).off("click.jhsFc2Lookup", ".pagination-link").on("click.jhsFc2Lookup", ".pagination-link", ((/** @type {JQueryClickEvent} */ e) => {
            e.preventDefault(), this.currentPage = parseInt($(e.target).data("page")), utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery();
        })), this.$paginationBox.find(".pagination-previous").off("click.jhsFc2Lookup").on("click.jhsFc2Lookup", ((/** @type {JQueryClickEvent} */ e) => {
            e.preventDefault(), this.currentPage > 1 && (this.currentPage--, utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery());
        })), this.$paginationBox.find(".pagination-next").off("click.jhsFc2Lookup").on("click.jhsFc2Lookup", ((/** @type {JQueryClickEvent} */ e) => {
            e.preventDefault(), this.currentPage < (this.maxPage ?? 0) && (this.currentPage++, utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery());
        }));
    }
    renderPagination() {
        const e = this.$paginationBox?.find(".pagination-list") || this.getJQuery()(".pagination-list");
        e.empty();
        const maxPage = this.maxPage ?? 1;
        let t = Math.max(1, this.currentPage - 2), n = Math.min(maxPage, this.currentPage + 2);
        this.currentPage <= 3 ? n = Math.min(6, maxPage) : this.currentPage >= maxPage - 2 && (t = Math.max(maxPage - 5, 1)),
        t > 1 && (e.append('<li><button type="button" class="jhs-btn pagination-link" data-page="1">1</button></li>'), t > 2 && e.append('<li><span class="pagination-ellipsis">…</span></li>'));
        for (let a = t; a <= n; a++) {
            const t = a === this.currentPage ? " is-current" : "";
            e.append(`<li><button type="button" class="jhs-btn pagination-link${t}" data-page="${a}">${a}</button></li>`);
        }
        n < maxPage && (n < maxPage - 1 && e.append('<li><span class="pagination-ellipsis">…</span></li>'),
        e.append(`<li><button type="button" class="jhs-btn pagination-link" data-page="${maxPage}">${maxPage}</button></li>`));
    }
    async handleQuery() {
        let e = this.getLoading()();
        const generation = ++this._queryGeneration;
        try {
            this.$paginationBox?.show();
            const scope = await this.getLifecycleScope();
            if (generation !== this._queryGeneration) return;
            const result = await this.getRuntimeService("movie").catalog("av123", { page: this.currentPage, keyword: this.keyword || "" }, { scope });
            if (generation !== this._queryGeneration) return;
            const i = result.items;
            this.maxPage = Math.max(1, Number(result.maxPage) || 1), this.currentPage = Math.min(Math.max(1, this.currentPage), this.maxPage), this.renderPagination();
            if (0 === i.length) {
                this.getClog().log?.(i), this.getShow().error?.("无结果");
                this.getClog().error?.("123AV 获取数据失败");
            }
            let s = this.markDataListHtml(i);
            this.$listRoot?.html(s), await utils.smoothScrollToTop();
        } catch (t) {
            this.getClog().error?.(t);
        } finally {
            e.close();
        }
    }
    /** @param {Fc2CatalogItem[]} e */
    markDataListHtml(e) {
        let t = "";
        return e.forEach((e => {
            const href = e.url, imageUrl = e.imageUrl;
            if (!href) return;
            t += `\n                <div class="item" data-jhs-fc2-source="123av">\n                    <a href="${escapeHtml(href)}" class="box" title="${escapeHtml(e.title)}">\n                        <div class="cover ">${imageUrl ? `<img loading="lazy" src="${escapeHtml(imageUrl)}" alt="">` : ""}</div>\n                        <div class="video-title"><strong>${escapeHtml(e.carNum)}</strong> ${escapeHtml(e.title)}</div>\n                        <div class="score"></div><div class="meta"></div><div class="jhs-toolbar"></div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}

/** Compatibility export for the retained disabled-plugin ID. */
export const Fc2By123AvPlugin = ListFc2LookupController;
