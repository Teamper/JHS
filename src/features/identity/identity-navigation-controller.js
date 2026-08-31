// @ts-check

import { JhsSelect } from "../../core/ui-primitives.js";

/** Own the JavDB navigation surface and its scoped search interactions. */
export class IdentityNavigationController {
    /** @param {{hostAdapter?: any, movie?: any, styles?: any, scope: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.window = this.document?.defaultView ?? globalThis.window;
        this.movie = options.movie;
        this.styles = options.styles;
        this.scope = options.scope;
        this.identityApi = null;
        this.started = false;
    }

    getJQuery() { return /** @type {any} */ (globalThis).$ ?? this.window?.jQuery; }

    async initCss() {
        return `
            .highlight-red {
                color: var(--jhs-status-filter) !important;
                font-weight: bold;
            }
        `;
    }

    /** @param {{identityApi?: any}} [options] */
    async start(options = {}) {
        this.scope.assertActive();
        if (this.started) return;
        if (this.hostAdapter?.site !== "javdb") return;
        this.started = true;
        this.identityApi = options.identityApi ?? null;
        try {
            const css = await this.initCss();
            const removeStyle = this.styles?.register?.("identity-navigation", css);
            if (typeof removeStyle === "function") this.scope.addCleanup?.(removeStyle);
            this.mergeNavigation();
            this.hookSearch();
            this.hookOldSearch();
            this.toggleOtherNavItem();
            JhsSelect.enhance("#search-box");
            if ((this.window?.location?.href ?? "").includes("/search")) {
                const params = new URLSearchParams(this.window.location.search);
                const keyword = params.get("q"), type = params.get("f");
                this.getJQuery()("#search-keyword").val(keyword);
                if (type) JhsSelect.setValue("#search-type", type);
                if (keyword) this.highlightKeyword(keyword);
            }
            const resize = () => this.toggleOtherNavItem();
            this.getJQuery()(this.window).on("resize.jhsIdentityNav", resize);
            this.scope.addCleanup?.(() => {
                this.getJQuery()(this.window).off("resize.jhsIdentityNav", resize);
                this.getJQuery()("#search-box, .jhs-identity-other-nav").remove();
                this.getJQuery()("#search-keyword, #search-type, #search-btn, #search-img-btn").off(".jhsIdentityNav");
                this.getJQuery()(".search-image").off(".jhsIdentityNav");
                this.identityApi = null;
                this.started = false;
            });
        } catch (error) {
            this.started = false;
            throw error;
        }
    }

    /** @param {string} keyword */
    highlightKeyword(keyword) {
        const normalized = keyword.trim().toLowerCase();
        if (!normalized) return;
        this.getJQuery()(".video-title strong, .actor-box strong").each((/** @type {number} */ _index, /** @type {Element} */ element) => {
            const node = this.getJQuery()(element);
            node.text().toLowerCase().includes(normalized) && node.addClass("highlight-red");
        });
    }

    hookSearch() {
        const $ = this.getJQuery(), hasSearchByImage = Boolean(this.identityApi?.hasSearchByImage);
        $("#navbar-menu-hero").after(`
            <div class="navbar-menu jhs-ui" id="search-box">
                <div class="navbar-start jhs-layout-d9caa2c0">
                    <select id="search-type" class="jhs-select-source">
                        <option value="all">影片</option>
                        <option value="actor">演员</option>
                        <option value="series">系列</option>
                        <option value="maker">片商</option>
                        <option value="director">导演</option>
                        <option value="code">番号</option>
                        <option value="list">清单</option>
                    </select>
                    <input id="search-keyword" type="text" placeholder="输入影片番号、演员名等关键词进行检索" class="jhs-field">
                    <a href="/advanced_search?noFold=1" title="高级检索" class="jhs-btn jhs-btn--secondary"><span>...</span></a>
                    ${hasSearchByImage ? '<button type="button" id="search-img-btn" class="jhs-btn jhs-btn--secondary">识图</button>' : ""}
                    <button type="button" id="search-btn" class="jhs-btn jhs-btn--primary">检索</button>
                </div>
            </div>
        `);
        $("#search-keyword").on("paste.jhsIdentityNav", (/** @type {any} */ event) => {
            const items = event.originalEvent?.clipboardData?.items || [];
            for (let index = 0; index < items.length; index++) if (items[index].type.includes("image")) {
                const file = items[index].getAsFile();
                $("#search-keyword").blur();
                const api = this.identityApi;
                if (!api) return void show.info("以图识图功能已禁用");
                return void api.openSearchByImage?.(() => {
                    api.handleSearchImageFile?.(file);
                    api.resetSearchImageUi?.();
                });
            }
        }).on("keypress.jhsIdentityNav", (/** @type {KeyboardEvent} */ event) => {
            if (event.key === "Enter") this.window.setTimeout(() => $("#search-btn").click(), 0);
        });
        $("#search-btn").on("click.jhsIdentityNav", (/** @type {MouseEvent} */ event) => {
            const keyword = $("#search-keyword").val(), type = $("#search-type").val();
            if (keyword === "") return;
            const query = `/search?q=${encodeURIComponent(String(keyword))}&f=${encodeURIComponent(String(type))}`;
            if ((this.window?.location?.href ?? "").includes("/search")) this.window.location.href = query;
            else this.window.open(query, "_blank");
        });
        hasSearchByImage && $("#search-img-btn").on("click.jhsIdentityNav", (() => this.identityApi?.openSearchByImage?.()));
    }

    hookOldSearch() {
        if (!this.identityApi?.hasSearchByImage) return;
        const element = this.document?.querySelector?.(".search-image");
        if (!element) return;
        const clone = element.cloneNode(true);
        element.parentNode?.replaceChild(clone, element);
        this.getJQuery()("#button-search-image").attr("data-tooltip", "以图识图");
        this.getJQuery()(".search-image").on("click.jhsIdentityNav", (() => this.identityApi?.openSearchByImage?.()));
    }

    mergeNavigation() {
        const $ = this.getJQuery();
        $('a[href*="/feedbacks/new"]').remove();
        $('a[href*="theporndude.com"]').remove();
        const dropdown = $('<div class="navbar-item has-dropdown is-hoverable jhs-identity-other-nav"><a class="navbar-link">其它</a><div class="navbar-dropdown is-boxed"></div></div>');
        const links = dropdown.find(".navbar-dropdown");
        links.append($('<a class="navbar-item" href="/feedbacks/new" target="_blank">反饋</a>'));
        this.movie?.externalNavigationLinks?.().forEach((/** @type {{url: string, label: string}} */ item) => links.append($("<a></a>").addClass("navbar-item").attr({ href: item.url, rel: "nofollow noopener", target: "_blank" }).text(item.label)));
        $('a.navbar-link[href="/makers"]').parent().after(dropdown);
    }

    toggleOtherNavItem() {
        const $ = this.getJQuery(), searchBox = $("#search-box"), nativeSearch = $("#search-bar-container");
        $(this.window).width() > 1600 ? (searchBox.show(), nativeSearch.hide()) : (searchBox.hide(), nativeSearch.show());
    }

    dispose() {
        this.started = false;
    }
}
