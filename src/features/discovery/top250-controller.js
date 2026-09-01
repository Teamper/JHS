// @ts-check

import { encryptData } from "../../core/credential-crypto.js";
import { escapeHtml } from "../../core/constants.js";
import { isTop250Page } from "../../core/site-context.js";

const CREDENTIAL_KEY = "jhs_appAuthorization";
/** @typedef {Record<string, any>} TopMovie */

/** Own the JavDB Top250 page, including auth, filters, pagination, and rendering. */
export class Top250Controller {
    /** @param {{document?: Document, window?: any, hostAdapter: any, movie: any, dialog: any, account: any, storage: any, features?: any, listActions?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.hostAdapter = options.hostAdapter;
        this.movie = options.movie;
        this.dialog = options.dialog;
        this.account = options.account;
        this.storage = options.storage;
        this.features = options.features;
        this.listActions = options.listActions;
        this.ui = options.ui;
        this.scope = options.scope;
        /** @type {any} */ this.$contentBox = null;
        /** @type {any} */ this.$listRoot = null;
        /** @type {TopMovie[]} */ this.movies = [];
        this.hasCnsub = "";
        this.discoveryApi = null;
        this.started = false;
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? this.window?.jQuery; }
    getLoading() { return this.ui?.getLoading?.(); }
    getShow() { return this.ui?.show ?? {}; }
    getClog() { return this.ui?.getClog?.() ?? {}; }
    getUtils() { return this.ui?.getUtils?.() ?? {}; }

    /** Start the Top250 page enhancement. */
    /** @param {{discoveryApi?: any}} [options] */
    async start(options = {}) {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        this.discoveryApi = options.discoveryApi;
        this.scope.addCleanup(() => this.dispose());
        this.bindEntryLinks();
        await this.handleTop();
    }

    bindEntryLinks() {
        const $ = this.getJQuery();
        if (!$) return;
        const topTab = $('.main-tabs ul li:contains("猜你喜歡")').length ? $('.main-tabs ul li:contains("猜你喜歡")') : $('.main-tabs ul li:contains("猜你喜欢")');
        topTab.length && topTab.html('<a href="/rankings/top"><span>Top250</span></a>');
        const links = $('a[href*="rankings/top"]');
        links.off("click.jhsTop250").on("click.jhsTop250", (/** @type {MouseEvent} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = $(event.target), href = (target.is("a") ? target : target.closest("a")).attr("href");
            if (!href) return;
            const query = new URL(href, this.window.location.href).searchParams;
            this.checkLogin(event, query);
        });
        this.scope.addCleanup(() => links.off("click.jhsTop250"));
    }

    hookPage() {
        const $ = this.getJQuery(), contentBox = this.hostAdapter?.getListContainer?.() ?? this.hostAdapter?.getListLayoutContainer?.();
        if (!contentBox || !this.hostAdapter?.createOwnedListRoot) throw new Error("JavDB 列表容器不可用");
        this.$contentBox = $(contentBox);
        this.$listRoot = $(this.hostAdapter.createOwnedListRoot([ "jhs-top250-list" ]));
        let title = $("h2.section-title");
        title.length || (title = $("<h2></h2>").addClass("section-title").prependTo(this.$contentBox));
        title.contents().first().replaceWith("Top250");
        $(".empty-message").remove();
        this.$contentBox.children(".box,.jhs-top250-list,.jhs-top250-filters,.tool-box,nav.pagination,#sort-toggle-btn").remove();
        this.$contentBox.append(this.$listRoot);
    }

    /** @param {string} type @param {string} typeValue */
    toolBar(type, typeValue) {
        const $ = this.getJQuery(), selected = (/** @type {string} */ value, /** @type {string} */ kind) => kind === "all" ? type === "all" : type === kind && typeValue === value;
        const href = (/** @type {string} */ kind, /** @type {string} */ value) => {
            const params = new URLSearchParams(this.window.location.search);
            params.set("handleTop", "1");
            params.set("handleType", kind);
            params.set("type_value", kind === "all" ? "" : value);
            params.set("has_cnsub", this.hasCnsub);
            params.delete("page");
            return `/advanced_search?${params.toString()}`;
        };
        let years = "";
        for (let year = new Date().getFullYear(); year >= 2008; year--) {
            years += `<a role="tab" class="jhs-segmented__item ${selected(String(year), "year") ? "active" : ""}" aria-selected="${selected(String(year), "year") ? "true" : "false"}" tabindex="${selected(String(year), "year") ? "0" : "-1"}" href="${href("year", String(year))}">${year}</a>`;
        }
        const typeLink = (/** @type {string} */ value, /** @type {string} */ label, /** @type {string} */ kind) => `<a role="tab" class="jhs-segmented__item ${selected(value, kind) ? "active" : ""}" aria-selected="${selected(value, kind) ? "true" : "false"}" tabindex="${selected(value, kind) ? "0" : "-1"}" href="${href(kind, value)}">${label}</a>`;
        const html = `<div class="jhs-top250-filters"><nav class="jhs-segmented" role="tablist" aria-label="类型条件">${typeLink("all", "全部", "all")}${typeLink("0", "有码", "video_type")}${typeLink("1", "无码", "video_type")}${typeLink("2", "欧美", "video_type")}${typeLink("3", "Fc2", "video_type")}<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm ${this.hasCnsub === "1" ? "active" : ""}" aria-pressed="${this.hasCnsub === "1"}" data-cnsub-value="1">含中字磁力</button><button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm ${this.hasCnsub === "0" ? "active" : ""}" aria-pressed="${this.hasCnsub === "0"}" data-cnsub-value="0">无字幕</button><button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm" aria-pressed="false" data-cnsub-value="">重置</button></nav><nav class="jhs-segmented" role="tablist" aria-label="年份条件">${years}</nav></div>`;
        const title = this.$contentBox.children("h2.section-title").first();
        title.length ? title.after(html) : this.$contentBox.prepend(html);
        this.$contentBox.off("click.jhsTop250Filter").on("click.jhsTop250Filter", "button[data-cnsub-value]", (/** @type {MouseEvent} */ event) => {
            const value = String($(event.currentTarget).data("cnsub-value")), params = new URLSearchParams(this.window.location.search);
            params.set("handleTop", "1");
            params.set("handleType", type);
            params.set("type_value", typeValue);
            params.set("has_cnsub", value);
            params.delete("page");
            this.window.location.href = `/advanced_search?${params.toString()}`;
        });
        this.scope.addCleanup(() => this.$contentBox?.off("click.jhsTop250Filter"));
    }

    renderPagination() {
        const $ = this.getJQuery(), current = Number(new URLSearchParams(this.window.location.search).get("page")) || 1, hasNext = current < 5;
        const pageButton = (/** @type {number} */ page) => `<li><button type="button" class="jhs-btn pagination-link ${current === page ? "is-current" : ""}" aria-current="${current === page ? "page" : "false"}" data-page="${page}">${page}</button></li>`;
        const html = `<nav class="pagination" aria-label="Top250 分页"><button type="button" class="jhs-btn pagination-previous ${current <= 1 ? "do-hide" : ""}" aria-label="上一页" data-page="${current - 1}">上一页</button><button type="button" class="jhs-btn pagination-next ${hasNext ? "" : "do-hide"}" aria-label="下一页" data-page="${current + 1}">下一页</button><ul class="pagination-list">${[1, 2, 3, 4, 5].map(pageButton).join("")}</ul></nav>`;
        this.$contentBox.append(html);
        this.$contentBox.off("click.jhsTop250Pagination").on("click.jhsTop250Pagination", ".pagination-link,.pagination-previous,.pagination-next", (/** @type {MouseEvent} */ event) => {
            event.preventDefault();
            const page = Number($(event.currentTarget).data("page"));
            if (!Number.isInteger(page) || page <= 0) return;
            const params = new URLSearchParams(this.window.location.search);
            params.set("page", String(page));
            this.window.history.pushState({}, "", `?${params.toString()}`);
            this.window.location.reload();
        });
        this.scope.addCleanup(() => this.$contentBox?.off("click.jhsTop250Pagination"));
    }

    async handleTop() {
        if (!isTop250Page(this.window.location)) return;
        if (!this.discoveryApi?.hasHitShow) return void this.getShow().info?.("热播列表功能已禁用");
        const params = new URLSearchParams(this.window.location.search), type = params.get("handleType") || "all", typeValue = params.get("type_value") || "";
        this.hasCnsub = params.get("has_cnsub") || "";
        const page = Number(params.get("page")) || 1;
        this.hookPage();
        this.toolBar(type, typeValue);
        this.renderPagination();
        const listActions = this.listActions ?? await this.features?.getFeatureApi?.("list");
        await listActions?.mountOwnedRankingControls?.($(".jhs-top250-filters"), this.discoveryApi)?.catch?.((/** @type {unknown} */ error) => this.getClog().error?.("Top250 操作按钮挂载失败", error));
        const $list = this.$listRoot, loadingFactory = this.getLoading(), loading = loadingFactory?.(), state = { done: false };
        $list.html("");
        for (let attempt = 1; attempt <= 3 && !state.done; attempt++) {
            try {
                const response = await this.movie.topRankings({ type, typeValue, page, limit: 50, scope: this.scope });
                if (response?.success === 1) {
                    const movies = Array.isArray(response.movies) ? response.movies : [];
                    if (!movies.length) {
                        this.getShow().error?.("无数据");
                        state.done = true;
                        continue;
                    }
                    this.movies = movies;
                    const filtered = this.filterMovies(movies), hitShow = this.discoveryApi, rendered = hitShow.markDataListHtml(filtered, { thumbnailFirst: true });
                    $list.html(rendered);
                    await hitShow.initializeRenderedList();
                    await hitShow.loadScore(filtered);
                    state.done = true;
                } else {
                    const message = String(response?.message || "Top250 数据加载失败");
                    this.getClog().error?.(response);
                    $list.html(`<h3>${escapeHtml(message)}</h3>`);
                    this.getShow().error?.(message);
                    if (response?.action === "JWTVerificationError") {
                        this.removeCredential();
                        await this.checkLogin(null, params);
                    }
                    state.done = true;
                }
            } catch (error) {
                if (attempt < 3) {
                    this.getClog().error?.(`获取Top数据失败 (第 ${attempt} 次重试):`, error);
                    await new Promise((resolve) => setTimeout(resolve, 1e3));
                } else {
                    this.getClog().error?.("所有重试尝试均失败，无法获取Top数据。", error);
                    $list.html("<h3>无法加载数据，请稍后再试。</h3>");
                }
            } finally {
                (state.done || attempt === 3) && loading?.close?.();
            }
        }
    }

    /** @param {TopMovie[]} movies */
    filterMovies(movies) {
        if (this.hasCnsub === "1") return movies.filter((movie) => this.hasSubtitle(movie));
        if (this.hasCnsub === "0") return movies.filter((movie) => !this.hasSubtitle(movie));
        return movies;
    }

    /** @param {TopMovie} movie */
    hasSubtitle(movie) { return movie.hasSubtitle === true || movie.hasSubtitle === "1" || movie.has_cnsub === true || movie.has_cnsub === "1"; }

    /** @param {MouseEvent | null} event @param {URLSearchParams} params */
    async checkLogin(event, params) {
        if (!this.hasCredential()) {
            this.getShow().error?.("该类别依赖移动端接口，请先完成登录");
            return this.openLoginDialog();
        }
        let type = "all", typeValue = "", selected = params.get("t") || "";
        if (/^y\d+$/.test(selected)) [type, typeValue] = ["year", selected.substring(1)];
        else if (selected) [type, typeValue] = ["video_type", selected];
        const query = new URLSearchParams({ handleTop: "1", handleType: type, type_value: typeValue });
        if (event?.ctrlKey || event?.metaKey) {
            const openInTab = /** @type {any} */ (globalThis).GM_openInTab;
            return openInTab?.(new URL(`/advanced_search?${query.toString()}`, this.window.location.origin).href, { insert: 0 });
        }
        this.window.location.href = `/advanced_search?${query.toString()}`;
    }

    hasCredential() { return Boolean(this.storage?.getLocal?.(CREDENTIAL_KEY) ?? globalThis.localStorage?.getItem?.(CREDENTIAL_KEY)); }

    removeCredential() {
        if (this.storage?.removeLocal) this.storage.removeLocal(CREDENTIAL_KEY);
        else globalThis.localStorage?.removeItem?.(CREDENTIAL_KEY);
    }

    /** @param {string} token */
    async storeCredential(token) {
        const encrypted = await encryptData(token);
        if (this.storage?.setLocal) this.storage.setLocal(CREDENTIAL_KEY, encrypted);
        else globalThis.localStorage?.setItem?.(CREDENTIAL_KEY, encrypted);
    }

    /** @param {{onSuccess?: (() => unknown | Promise<unknown>) | null}} [options] */
    openLoginDialog({ onSuccess = null } = {}) {
        const $ = this.getJQuery(), area = this.getUtils().getResponsiveArea?.([ "360px", "auto" ]) ?? [ "360px", "auto" ];
        this.dialog.open({
            type: 1, title: "JavDB", closeBtn: 1, area, shadeClose: false,
            content: '<div><div><input type="text" id="username" name="username" placeholder="用户名 | 邮箱" class="jhs-field"></div><div><input type="password" id="password" name="password" placeholder="密码" class="jhs-field"></div><button id="loginBtn" type="button" class="jhs-btn">登录</button></div>',
            success: (/** @type {Element} */ _element, /** @type {number} */ index) => {
                $("#loginBtn").on("click.jhsTop250Login", async () => {
                    const username = String($("#username").val() || ""), password = String($("#password").val() || "");
                    if (!username || !password) return void this.getShow().error?.("请输入用户名和密码");
                    const loadingFactory = this.getLoading(), loading = loadingFactory?.();
                    try {
                        const result = await this.account.login("javdb", { username, password }, { scope: this.scope });
                        if (!result?.success) return void this.getShow().error?.(result?.message || "登录失败");
                        await this.storeCredential(result.token);
                        this.getShow().ok?.("登录成功");
                        this.dialog.close(index);
                        if (typeof onSuccess === "function") await onSuccess();
                        else this.window.location.href = "/advanced_search?handleTop=1&period=daily";
                    } catch (error) {
                        this.getClog().error?.("登录异常:", error);
                        this.getShow().error?.(error instanceof Error ? error.message : String(error));
                    } finally {
                        loading?.close?.();
                    }
                });
                this.scope.addCleanup(() => $("#loginBtn").off("click.jhsTop250Login"));
            },
        });
    }

    dispose() {
        this.started = false;
        this.discoveryApi = null;
        this.$contentBox?.off(".jhsTop250Filter").off(".jhsTop250Pagination");
    }
}
