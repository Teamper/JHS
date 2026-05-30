class de extends X {
    getName() {
        return "FoldCategoryPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        return `\n            <style>\n                #tags a.tag, .tags a.tag {\n                    position:relative;\n                }\n                .highlight-btn {\n                    position: absolute;\n                    top: -10px;\n                    right: -10px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 50%;\n                    width: 24px;\n                    height: 24px;\n                    font-size: 14px;\n                    line-height: 24px;\n                    text-align: center;\n                    cursor: pointer;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n                    display: none;\n                    z-index: 999;\n                }\n                /* 当父元素被高亮时，按钮变为其他颜色 */\n                .highlighted .highlight-btn {\n                    background-color: #FF5722;\n                }\n                /* 高亮状态下的标签样式 */\n                .highlighted {\n                    /* 浅黄色 */\n                    border: ${e.highlightedTagNumber || 1}px solid ${e.highlightedTagColor || "#ce2222"};\n                }\n            </style>\n        `;
    }
    async handle() {
        window.isListPage && (o.includes("advanced_search") || (this.highlightTag(), utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            this.createFoldBtn();
        }), 1, 1e4, !0), $("#tags .tag-category .tag-expand").each(((e, t) => {
            $(t).parent().hasClass("collapse") && t.click();
        }))));
    }
    highlightTag() {
        (async () => {
            const e = await storageManager.getHighlightedTags();
            e && e.forEach((e => {
                $(`#tags a.tag:contains(${e})`).addClass("highlighted"), $(`.tags a.tag:contains(${e})`).addClass("highlighted");
            }));
        })().then(), $("#tags a.tag, .tags a.tag").hover((function() {
            const e = $(this), t = $('<button class="highlight-btn" title="高亮显示">★</button>');
            e.append(t), t.fadeIn(0);
        }), (function() {
            $(this).find(".highlight-btn").fadeOut(0, (function() {
                $(this).remove();
            }));
        })), $(document).on("click", ".highlight-btn", (async function(e) {
            e.stopPropagation(), e.preventDefault();
            const t = $(this).closest("a.tag"), n = t.clone();
            n.find(".highlight-btn").remove();
            const a = n.text().trim().replace(/\s*\(\d+\)$/, "");
            let i = await storageManager.getHighlightedTags();
            i.includes(a) ? (i = i.filter((e => e !== a)), t.removeClass("highlighted")) : (i.push(a),
            t.addClass("highlighted")), await storageManager.setHighlightedTags(i);
        }));
    }
    async createFoldBtn() {
        let t = $("#tags"), n = $("#tags dl div.tag.is-info").map((function() {
            return $(this).text().replaceAll("\n", "").replaceAll(" ", "");
        })).get().join(" ");
        if (!n) return;
        $(".tabs").append(`\n            <div style="display: flex;align-items: center;flex-grow:1;justify-content: flex-end;">\n                <div>已选分类: <span id="jhs-check-tag">${n}</span></div>\n                <a class="menu-btn  main-tab-btn" id="foldCategoryBtn" style="background-color:#d23e60 !important;">\n                    <span></span>\n                    <i style="margin-left: 10px"></i>\n                </a>\n\n            </div>\n        `);
        let a = $("h2.section-title");
        if (a.length > 0 && (a.append('\n                <div id="foldCategoryBtn">\n                    <a class="menu-btn" style="background-color:#d23e60 !important;margin-left: 20px;border-bottom:none !important;border-radius:3px;">\n                        <span></span>\n                        <i style="margin-left: 10px"></i>\n                    </a>\n                </div>\n            '),
        t = $("section > div > div.box")), !t) return;
        let i = $("#foldCategoryBtn"), s = localStorage.getItem("jhs_foldCategory") === _, [o, r] = s ? [ "展开", "icon-angle-double-down" ] : [ "折叠", "icon-angle-double-up" ];
        i.find("span").text(o).end().find("i").attr("class", r), window.location.href.includes("noFold=1") || t[s ? "hide" : "show"](),
        i.on("click", (async e => {
            e.preventDefault(), s = !s, localStorage.setItem("jhs_foldCategory", s ? _ : C);
            const [n, a] = s ? [ "展开", "icon-angle-double-down" ] : [ "折叠", "icon-angle-double-up" ];
            i.find("span").text(n).end().find("i").attr("class", a), t[s ? "hide" : "show"]();
        }));
    }
}
