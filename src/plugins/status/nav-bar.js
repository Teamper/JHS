class NavBarPlugin extends BasePlugin {
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
    highlightKeyword(e) {
        const t = e.trim();
        if (!t) return;
        const n = t.toLowerCase();
        $(".video-title strong, .actor-box strong").each((function() {
            const e = $(this);
            e.text().toLowerCase().includes(n) && e.addClass("highlight-red");
        }));
    }
    hookSearch() {
        $("#navbar-menu-hero").after('\n            <div class="navbar-menu jhs-ui" id="search-box">\n                <div class="navbar-start jhs-layout-d9caa2c0">\n                    <select id="search-type" class="jhs-select-source">\n                        <option value="all">影片</option>\n                        <option value="actor">演员</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">导演</option>\n                        <option value="code">番号</option>\n                        <option value="list">清单</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="输入影片番号、演员名等关键词进行检索" class="jhs-field">\n                    <a href="/advanced_search?noFold=1" title="高级检索" class="jhs-btn jhs-btn--secondary"><span>...</span></a>\n                    <button type="button" id="search-img-btn" class="jhs-btn jhs-btn--secondary">识图</button>\n                    <button type="button" id="search-btn" class="jhs-btn jhs-btn--primary">检索</button>\n                </div>\n            </div>\n        '),
        $("#search-keyword").on("paste", (e => {
            const t = e.originalEvent.clipboardData.items;
            for (let n = 0; n < t.length; n++) if (-1 !== t[n].type.indexOf("image")) {
                const e = t[n].getAsFile();
                $("#search-keyword").blur();
                const a = this.getBean("SearchByImagePlugin");
                return void a.open((() => {
                    a.handleImageFile(e), a.resetSearchUI();
                }));
            }
        })).on("keypress", (e => {
            "Enter" === e.key && setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })), $("#search-btn").on("click", (e => {
            let t = $("#search-keyword").val(), n = $("#search-type").val();
            "" !== t && (window.location.href.includes("/search") ? window.location.href = "/search?q=" + t + "&f=" + n : window.open("/search?q=" + t + "&f=" + n));
        })), $("#search-img-btn").on("click", (() => {
            this.getBean("SearchByImagePlugin").open();
        }));
    }
    hookOldSearch() {
        const e = document.querySelector(".search-image");
        if (!e) return;
        const t = e.cloneNode(!0);
        e.parentNode.replaceChild(t, e), $("#button-search-image").attr("data-tooltip", "以图识图"),
        $(".search-image").on("click", (e => {
            this.getBean("SearchByImagePlugin").open();
        }));
    }
    margeNav() {
        $('a[href*="/feedbacks/new"]').remove(), $('a[href*="theporndude.com"]').remove(),
        $('a.navbar-link[href="/makers"]').parent().after('\n            <div class="navbar-item has-dropdown is-hoverable">\n                <a class="navbar-link">其它</a>\n                <div class="navbar-dropdown is-boxed">\n                  <a class="navbar-item" href="/feedbacks/new" target="_blank" >反饋</a>\n                  <a class="navbar-item" rel="nofollow noopener" target="_blank" href="https://theporndude.com/zh">ThePornDude</a>\n                </div>\n              </div>\n        ');
    }
    toggleOtherNavItem() {
        let e = $("#search-box"), t = $("#search-bar-container");
        $(window).width() < 1600 && $(window).width() > 1023 && (e.hide(), t.show()), $(window).width() > 1600 && (e.show(),
        t.hide());
    }
}
