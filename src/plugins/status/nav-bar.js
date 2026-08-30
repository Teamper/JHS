// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";
import { JhsSelect } from "../../core/ui-primitives.js";

export class NavBarPlugin extends BasePlugin {
    getName() {
        return "NavBarPlugin";
    }
    async initCss() {
        return "\n            .highlight-red {\n    /* 核心要求：高亮红色文本 */\n    color: var(--jhs-status-filter) !important;\n    \n    /* 建议：增加字体加粗，效果更明显 */\n    font-weight: bold;\n    \n    /* 建议：增加背景色，效果更突出 */\n    /* background-color: yellow; */ \n}\n        ";
    }
    /** @param {{scope?: any, identityApi?: any}} [options] */
    async handle(options = {}) {
        const scope = options.scope ?? await this.getRuntimeService("scope")();
        this.identityApi = options.identityApi ?? null;
        if (this.margeNav(), this.hookSearch(), this.hookOldSearch(), this.toggleOtherNavItem(),
        JhsSelect.enhance("#search-box"), window.location.href.includes("/search")) {
            const e = new URLSearchParams(window.location.search);
            let t = e.get("q"), n = e.get("f");
            $("#search-keyword").val(t), n && JhsSelect.setValue("#search-type", n), t && this.highlightKeyword(t);
        }
        const resize = () => this.toggleOtherNavItem();
        $(window).on("resize.jhsIdentityNav", resize);
        scope.addCleanup(() => {
            $(window).off("resize.jhsIdentityNav", resize);
            $("#search-box, .jhs-identity-other-nav").remove();
            $("#search-keyword, #search-type, #search-btn, #search-img-btn").off(".jhsIdentityNav");
            $(".search-image").off(".jhsIdentityNav");
            this.identityApi = null;
        });
    }
    highlightKeyword(/** @type {string} */ e) {
        const t = e.trim();
        if (!t) return;
        const n = t.toLowerCase();
        $(".video-title strong, .actor-box strong").each(((/** @type {number} */ _index, /** @type {Element} */ element) => {
            const e = $(element);
            e.text().toLowerCase().includes(n) && e.addClass("highlight-red");
        }));
    }
    hookSearch() {
        const hasSearchByImage = Boolean(this.identityApi?.hasSearchByImage);
        $("#navbar-menu-hero").after('\n            <div class="navbar-menu jhs-ui" id="search-box">\n                <div class="navbar-start jhs-layout-d9caa2c0">\n                    <select id="search-type" class="jhs-select-source">\n                        <option value="all">影片</option>\n                        <option value="actor">演员</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">导演</option>\n                        <option value="code">番号</option>\n                        <option value="list">清单</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="输入影片番号、演员名等关键词进行检索" class="jhs-field">\n                    <a href="/advanced_search?noFold=1" title="高级检索" class="jhs-btn jhs-btn--secondary"><span>...</span></a>\n                    ' + (hasSearchByImage ? '<button type="button" id="search-img-btn" class="jhs-btn jhs-btn--secondary">识图</button>' : "") + '\n                    <button type="button" id="search-btn" class="jhs-btn jhs-btn--primary">检索</button>\n                </div>\n            </div>\n        '),
        $("#search-keyword").on("paste.jhsIdentityNav", ((/** @type {any} */ e) => {
            const t = e.originalEvent?.clipboardData?.items || [];
            for (let n = 0; n < t.length; n++) if (-1 !== t[n].type.indexOf("image")) {
                const e = t[n].getAsFile();
                $("#search-keyword").blur();
                const a = this.identityApi;
                if (!a) return void show.info("以图识图功能已禁用");
                return void a.openSearchByImage?.((() => {
                    a.handleSearchImageFile?.(e), a.resetSearchImageUi?.();
                }));
            }
        })).on("keypress.jhsIdentityNav", ((/** @type {KeyboardEvent} */ e) => {
            "Enter" === e.key && setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })), $("#search-btn").on("click.jhsIdentityNav", ((/** @type {MouseEvent} */ e) => {
            let t = $("#search-keyword").val(), n = $("#search-type").val();
            // 关键词须编码：含 &/#/+ 的搜索词会截断或污染查询串
            "" !== t && (window.location.href.includes("/search") ? window.location.href = "/search?q=" + encodeURIComponent(String(t)) + "&f=" + encodeURIComponent(String(n)) : window.open("/search?q=" + encodeURIComponent(String(t)) + "&f=" + encodeURIComponent(String(n))));
        })), hasSearchByImage && $("#search-img-btn").on("click.jhsIdentityNav", (() => {
            this.identityApi?.openSearchByImage?.();
        }));
    }
    hookOldSearch() {
        const hasSearchByImage = Boolean(this.identityApi?.hasSearchByImage);
        if (!hasSearchByImage) return;
        const e = document.querySelector(".search-image");
        if (!e) return;
        const t = e.cloneNode(!0);
        e.parentNode?.replaceChild(t, e), $("#button-search-image").attr("data-tooltip", "以图识图"),
        hasSearchByImage && $(".search-image").on("click.jhsIdentityNav", ((/** @type {MouseEvent} */ e) => {
            this.identityApi?.openSearchByImage?.();
        }));
    }
    margeNav() {
        $('a[href*="/feedbacks/new"]').remove(), $('a[href*="theporndude.com"]').remove();
        const dropdown = $('<div class="navbar-item has-dropdown is-hoverable jhs-identity-other-nav"><a class="navbar-link">其它</a><div class="navbar-dropdown is-boxed"></div></div>'), links = dropdown.find(".navbar-dropdown");
        links.append($('<a class="navbar-item" href="/feedbacks/new" target="_blank">反饋</a>'));
        this.getRuntimeService("movie").externalNavigationLinks().forEach(((/** @type {{url: string, label: string}} */ item) => links.append($("<a></a>").addClass("navbar-item").attr({ href: item.url, rel: "nofollow noopener", target: "_blank" }).text(item.label))));
        $('a.navbar-link[href="/makers"]').parent().after(dropdown);
    }
    toggleOtherNavItem() {
        // 覆盖所有宽度区间：>1600 显示 JHS 搜索框，其余（含 ≤1023 与 1600 整数宽）显示宿主搜索栏，避免双搜索框并存
        let e = $("#search-box"), t = $("#search-bar-container");
        $(window).width() > 1600 ? (e.show(), t.hide()) : (e.hide(), t.show());
    }
}
