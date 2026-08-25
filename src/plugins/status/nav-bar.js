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
    handle() {
        if (this.margeNav(), this.hookSearch(), this.hookOldSearch(), this.toggleOtherNavItem(),
        $(window).resize(this.toggleOtherNavItem), JhsSelect.enhance("#search-box"), window.location.href.includes("/search")) {
            const e = new URLSearchParams(window.location.search);
            let t = e.get("q"), n = e.get("f");
            $("#search-keyword").val(t), n && JhsSelect.setValue("#search-type", n), t && this.highlightKeyword(t);
        }
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
        const hasSearchByImage = !!this.getOptionalDependency("SearchByImagePlugin");
        $("#navbar-menu-hero").after('\n            <div class="navbar-menu jhs-ui" id="search-box">\n                <div class="navbar-start jhs-layout-d9caa2c0">\n                    <select id="search-type" class="jhs-select-source">\n                        <option value="all">影片</option>\n                        <option value="actor">演员</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">导演</option>\n                        <option value="code">番号</option>\n                        <option value="list">清单</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="输入影片番号、演员名等关键词进行检索" class="jhs-field">\n                    <a href="/advanced_search?noFold=1" title="高级检索" class="jhs-btn jhs-btn--secondary"><span>...</span></a>\n                    ' + (hasSearchByImage ? '<button type="button" id="search-img-btn" class="jhs-btn jhs-btn--secondary">识图</button>' : "") + '\n                    <button type="button" id="search-btn" class="jhs-btn jhs-btn--primary">检索</button>\n                </div>\n            </div>\n        '),
        $("#search-keyword").on("paste", ((/** @type {any} */ e) => {
            const t = e.originalEvent?.clipboardData?.items || [];
            for (let n = 0; n < t.length; n++) if (-1 !== t[n].type.indexOf("image")) {
                const e = t[n].getAsFile();
                $("#search-keyword").blur();
                const a = this.getOptionalDependency("SearchByImagePlugin");
                if (!a) return void show.info("以图识图功能已禁用");
                return void a.open((() => {
                    a.handleImageFile(e), a.resetSearchUI();
                }));
            }
        })).on("keypress", ((/** @type {KeyboardEvent} */ e) => {
            "Enter" === e.key && setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })), $("#search-btn").on("click", ((/** @type {MouseEvent} */ e) => {
            let t = $("#search-keyword").val(), n = $("#search-type").val();
            "" !== t && (window.location.href.includes("/search") ? window.location.href = "/search?q=" + t + "&f=" + n : window.open("/search?q=" + t + "&f=" + n));
        })), hasSearchByImage && $("#search-img-btn").on("click", (() => {
            this.getOptionalDependency("SearchByImagePlugin")?.open?.();
        }));
    }
    hookOldSearch() {
        const e = document.querySelector(".search-image");
        if (!e) return;
        const hasSearchByImage = !!this.getOptionalDependency("SearchByImagePlugin");
        const t = e.cloneNode(!0);
        e.parentNode?.replaceChild(t, e), $("#button-search-image").attr("data-tooltip", "以图识图"),
        hasSearchByImage && $(".search-image").on("click", ((/** @type {MouseEvent} */ e) => {
            this.getOptionalDependency("SearchByImagePlugin")?.open?.();
        }));
    }
    margeNav() {
        $('a[href*="/feedbacks/new"]').remove(), $('a[href*="theporndude.com"]').remove();
        const dropdown = $('<div class="navbar-item has-dropdown is-hoverable"><a class="navbar-link">其它</a><div class="navbar-dropdown is-boxed"></div></div>'), links = dropdown.find(".navbar-dropdown");
        links.append($('<a class="navbar-item" href="/feedbacks/new" target="_blank">反饋</a>'));
        this.getRuntimeService("movie").externalNavigationLinks().forEach(((/** @type {{url: string, label: string}} */ item) => links.append($("<a></a>").addClass("navbar-item").attr({ href: item.url, rel: "nofollow noopener", target: "_blank" }).text(item.label))));
        $('a.navbar-link[href="/makers"]').parent().after(dropdown);
    }
    toggleOtherNavItem() {
        let e = $("#search-box"), t = $("#search-bar-container");
        $(window).width() < 1600 && $(window).width() > 1023 && (e.hide(), t.show()), $(window).width() > 1600 && (e.show(),
        t.hide());
    }
}
