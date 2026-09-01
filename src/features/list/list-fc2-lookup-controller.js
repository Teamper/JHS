// @ts-check

import { _, escapeHtml, o } from "../../core/constants.js";
import { createFc2SourceLinks, renderFc2Gallery, renderFc2State } from "../../ui/detail/fc2-workspace-view.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */
/** @typedef {{ preventDefault: () => void, target: EventTarget }} JQueryClickEvent */
/** @typedef {{ root: JQueryHandle, carNum: string, isAlive: () => boolean }} Fc2DetailContext */
/** @typedef {{ title: string, publishDate: string, moviePoster: null }} Fc2Summary */
/** @typedef {{ actors: Array<{ name: string, url: string }>, seller?: { name: string, url?: string } | null }} Fc2People */
/** @typedef {{ url: string, imageUrl?: string, title: string, carNum: string }} Fc2CatalogItem */

export class ListFc2LookupController {
    /** @param {{hostAdapter?: any, movie?: any, translation?: any, settings?: any, ui?: any, scope?: any, document?: Document, window?: Window}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.movie = options.movie ?? null;
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
    /** 将 123AV 数据填入 Fc2Plugin 创建的固定工作区。 */
    /** @param {Fc2DetailContext} context @param {string} url */
    async loadDetail(context, url) {
        const infoPromise = this.loadSummary(context, url), imagesPromise = this.getImgList(context.carNum), actressPromise = this.getActressInfo(context.carNum);
        imagesPromise.then((images => context.isAlive() && renderFc2Gallery(context, images, null))).catch((error => context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="gallery-grid"]'), "剧照加载失败", (() => void this.reloadImages(context)))));
        actressPromise.then((async data => {
            await infoPromise.catch((() => null));
            context.isAlive() && this.render123AvActress(context, data);
        })).catch((error => clog.error("FC2 演员信息加载失败", error)));
        await Promise.allSettled([ infoPromise, imagesPromise, actressPromise ]);
    }
    /** @param {Fc2DetailContext} context @param {string} url */
    async loadSummary(context, url) {
        try {
            const info = await this.get123AvVideoInfo(context.carNum, url);
            if (!context.isAlive()) return null;
            this.render123AvSummary(context, info);
            return info;
        } catch (error) {
            context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="summary-content"]'), "影片信息加载失败", (() => void this.loadSummary(context, url))), this.getClog().error?.("123AV 详情加载失败", error);
            throw error;
        }
    }
    /** @param {Fc2DetailContext} context @param {Fc2Summary} info */
    render123AvSummary(context, info) {
        const body = context.root.find('[data-jhs-role="summary-content"]').empty(), title = $('<h1 class="jhs-fc2-title"><strong class="current-title"></strong></h1>');
        title.find("strong").text(info.title || "无标题"), body.append(title, $('<div class="jhs-fc2-meta"></div>').append($("<span></span>").text(`番号：${context.carNum}`), $("<span></span>").text(`发行：${info.publishDate || "未知"}`)), '<div class="jhs-fc2-actors" data-jhs-role="actors"><strong>主演：</strong><span>正在加载演员…</span></div>', '<div class="jhs-fc2-meta" data-jhs-role="seller"></div>', createFc2SourceLinks(context, this.getRuntimeService("movie")), $('<span class="jhs-is-hidden" data-jhs-role="publish-time"></span>').text(info.publishDate || ""));
    }
    /** @param {string} carNum @param {string} e */
    async get123AvVideoInfo(carNum, e) {
        const scope = await this.getLifecycleScope();
        const detail = await this.getRuntimeService("movie").detail({ carNum, url: e, providerId: "av123" }, { scope });
        return { title: detail?.title || "", publishDate: detail?.releaseDate || "", moviePoster: null };
    }
    /** @param {string} e */
    async getActressInfo(e) {
        const scope = await this.getLifecycleScope();
        return this.getRuntimeService("movie").people("fc2ppvdb", { carNum: e }, { scope });
    }
    /** @param {string} e */
    async getImgList(e) {
        const scope = await this.getLifecycleScope();
        return (await this.getRuntimeService("movie").images("fc2content", { carNum: e }, { scope })).map(((/** @type {{ url: string }} */ item) => item.url));
    }
    /** @param {Fc2DetailContext} context */
    async reloadImages(context) {
        try {
            const images = await this.getImgList(context.carNum);
            context.isAlive() && renderFc2Gallery(context, images, null);
        } catch (error) {
            context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="gallery-grid"]'), "剧照加载失败", (() => void this.reloadImages(context)));
        }
    }
    /** @param {Fc2DetailContext} context @param {Fc2People} data */
    render123AvActress(context, data) {
        const host = context.root.find('[data-jhs-role="actors"]').empty().append("<strong>主演：</strong>");
        data.actors.length ? data.actors.forEach((actor => host.append($("<a></a>").addClass("jhs-fc2-actor").attr({ href: actor.url, target: "_blank", rel: "noopener noreferrer" }).text(actor.name)))) : host.append($("<span></span>").text("暂无演员信息"));
        context.root.find('[data-jhs-role="actress-data"]').remove(), context.root.find(".jhs-fc2-summary__body").append($('<span class="jhs-is-hidden" data-jhs-role="actress-data"></span>').text(data.actors.map((actor => actor.name)).join(" ")));
        if (data.seller) context.root.find('[data-jhs-role="seller"]').empty().append("卖家：", data.seller.url ? $("<a></a>").attr({ href: data.seller.url, target: "_blank", rel: "noopener noreferrer" }).text(data.seller.name) : this.document.createTextNode(data.seller.name));
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
