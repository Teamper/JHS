class FoldCategoryPlugin extends BasePlugin {
    getName() {
        return "FoldCategoryPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        return `\n            <style>\n                #tags a.tag, .tags a.tag {\n                    position:relative;\n                }\n                .highlight-btn {\n                    position: absolute;\n                    top: -10px;\n                    right: -10px;\n                    background-color: var(--jhs-status-down);\n                    color: var(--jhs-status-down-on);\n                    border: none;\n                    border-radius: 50%;\n                    width: 24px;\n                    height: 24px;\n                    font-size: 14px;\n                    line-height: 24px;\n                    text-align: center;\n                    cursor: pointer;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n                    display: none;\n                    z-index: var(--jhs-z-dropdown);\n                }\n                /* 当父元素被高亮时，按钮变为其他颜色 */\n                .highlighted .highlight-btn {\n                    background-color: var(--jhs-status-watch);\n                }\n                /* 高亮状态下的标签样式 */\n                .highlighted {\n                    /* 浅黄色 */\n                    border: ${e.highlightedTagNumber || 1}px solid ${e.highlightedTagColor || "var(--jhs-status-filter)"};\n                }\n            </style>\n        `;
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
        })().catch((error => clog.error("分类高亮恢复失败", error))), $("#tags a.tag, .tags a.tag").hover((function() {
            const e = $(this), t = $('<button class="jhs-btn highlight-btn" title="高亮显示">★</button>');
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
        $(".tabs").append(`\n            <div class="jhs-layout-8453d189">\n                <div>已选分类: <span id="jhs-check-tag">${n}</span></div>\n                <button type="button" class="jhs-btn jhs-btn--ghost jhs-layout-3a1fc324" id="foldCategoryBtn">\n                    <span></span>\n                    <i class="jhs-layout-78fa54ea"></i>\n                </button>\n\n            </div>\n        `);
        let a = $("h2.section-title");
        if (a.length > 0 && (a.append('\n                <div id="foldCategoryBtn">\n                    <button type="button" class="jhs-btn jhs-btn--ghost jhs-layout-2100e73d">\n                        <span></span>\n                        <i class="jhs-layout-78fa54ea"></i>\n                    </button>\n                </div>\n            '),
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
