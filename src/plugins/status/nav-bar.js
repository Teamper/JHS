class fe extends X {
    getName() {
        return "NavBarPlugin";
    }
    async initCss() {
        return "\n            .highlight-red {\n    /* 核心要求：高亮红色文本 */\n    color: red !important; \n    \n    /* 建议：增加字体加粗，效果更明显 */\n    font-weight: bold;\n    \n    /* 建议：增加背景色，效果更突出 */\n    /* background-color: yellow; */ \n}\n        ";
    }
    handle() {
        if (this.margeNav(), this.hookSearch(), this.hookOldSearch(), this.toggleOtherNavItem(),
        $(window).resize(this.toggleOtherNavItem), window.location.href.includes("/search")) {
            const e = new URLSearchParams(window.location.search);
            let t = e.get("q"), n = e.get("f");
            $("#search-keyword").val(t), n && $("#search-type").val(n), t && this.highlightKeyword(t);
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
        $("#navbar-menu-hero").after('\n            <div class="navbar-menu" id="search-box">\n                <div class="navbar-start" style="display: flex; align-items: center; gap: 5px;">\n                    <select id="search-type" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; background-color: #333; color: #eee; font-size: 14px; outline: none;">\n                        <option value="all">影片</option>\n                        <option value="actor">演員</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">導演</option>\n                        <option value="code">番號</option>\n                        <option value="list">清單</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="輸入影片番號，演員名等關鍵字進行檢索" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; flex-grow: 1; font-size: 14px; background-color: #333; color: #eee; outline: none;">\n                    <a href="/advanced_search?noFold=1" title="進階檢索" style="padding: 6px 12px; background-color: #444; border-radius: 4px; text-decoration: none; color: #ddd; font-size: 14px; border: 1px solid #555;"><span>...</span></a>\n                    <a id="search-img-btn" style="padding: 6px 16px; background-color: #444; color: #fff; border-radius: 4px; text-decoration: none; font-weight: 500; cursor: pointer; border: 1px solid #555;">识图</a>\n                    <a id="search-btn" style="padding: 6px 16px; background-color: #444; color: #fff; border-radius: 4px; text-decoration: none; font-weight: 500; cursor: pointer; border: 1px solid #555;">檢索</a>\n                </div>\n            </div>\n        '),
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
            setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })).on("keypress", (e => {
            "Enter" === e.key && setTimeout((() => {
                $("#search-btn").click();
            }), 0);
        })), $("#search-btn").on("click", (e => {
            let t = $("#search-keyword").val(), n = $("#search-type option:selected").val();
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
