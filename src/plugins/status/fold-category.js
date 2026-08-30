// @ts-check

import { o } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { createLatestSettingWriter } from "../../ui/settings/setting-binding-controller.js";

export class FoldCategoryPlugin extends BasePlugin {
    getName() {
        return "FoldCategoryPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        return `\n            <style>\n                #tags a.tag, .tags a.tag {\n                    position:relative;\n                }\n                .highlight-btn {\n                    position: absolute;\n                    top: -10px;\n                    right: -10px;\n                    background-color: var(--jhs-status-down);\n                    color: var(--jhs-status-down-on);\n                    border: none;\n                    border-radius: 50%;\n                    width: 24px;\n                    height: 24px;\n                    font-size: 14px;\n                    line-height: 24px;\n                    text-align: center;\n                    cursor: pointer;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n                    display: none;\n                    z-index: var(--jhs-z-dropdown);\n                }\n                /* 当父元素被高亮时，按钮变为其他颜色 */\n                .highlighted .highlight-btn {\n                    background-color: var(--jhs-status-watch);\n                }\n                /* 高亮状态下的标签样式 */\n                .highlighted {\n                    /* 浅黄色 */\n                    border: ${e.highlightedTagNumber || 1}px solid ${e.highlightedTagColor || "var(--jhs-status-filter)"};\n                }\n            </style>\n        `;
    }
    async handle() {
        const scope = await this.getRuntimeService("scope")();
        window.isListPage && (o.includes("advanced_search") || (this.highlightTag(), utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            this.createFoldBtn();
        }), 1, 1e4, !0, scope), $("#tags .tag-category .tag-expand").each(((/** @type {number} */ e, /** @type {HTMLElement} */ t) => {
            $(t).parent().hasClass("collapse") && t.click();
        }))));
    }
    /** @param {HTMLElement} element 读取标签名：剥掉高亮按钮与 “(计数)” 后缀，与点击写入口径一致 */
    readTagName(element) {
        return $(element).clone().find(".highlight-btn").remove().end().text().trim().replace(/\s*\(\d+\)$/, "");
    }
    highlightTag() {
        (async () => {
            const e = await storageManager.getHighlightedTags(), tags = $("#tags a.tag, .tags a.tag");
            // 精确匹配：不用 :contains（子串误匹配 + 特殊字符会破坏选择器）
            e && e.forEach(((/** @type {string} */ tag) => {
                tags.filter(((/** @type {number} */ _, /** @type {HTMLElement} */ element) => this.readTagName(element) === tag)).addClass("highlighted");
            }));
        })().catch((error => clog.error("分类高亮恢复失败", error)));
        // 委托绑定：瀑布流后加载的卡片同样获得高亮按钮
        $(document).off(".jhsHighlight").on("mouseenter.jhsHighlight", "#tags a.tag, .tags a.tag", ((/** @type {MouseEvent} */ event) => {
            const e = $(event.currentTarget);
            if (e.find(".highlight-btn").length) return;
            const t = $('<button class="jhs-btn highlight-btn" title="高亮显示">★</button>');
            e.append(t), t.fadeIn(0);
        })).on("mouseleave.jhsHighlight", "#tags a.tag, .tags a.tag", ((/** @type {MouseEvent} */ event) => {
            const button = $(event.currentTarget).find(".highlight-btn");
            button.fadeOut(0, (() => button.remove()));
        })).on("click.jhsHighlight", ".highlight-btn", (async (/** @type {MouseEvent} */ e) => {
            e.stopPropagation(), e.preventDefault();
            const t = $(e.currentTarget).closest("a.tag"), a = this.readTagName(t[0]);
            let i = await storageManager.getHighlightedTags();
            i.includes(a) ? (i = i.filter(((/** @type {string} */ e) => e !== a)), t.removeClass("highlighted")) : (i.push(a),
            t.addClass("highlighted")), await storageManager.setHighlightedTags(i);
        }));
    }
    async createFoldBtn() {
        let t = $("#tags"), n = $("#tags dl div.tag.is-info").map(((/** @type {number} */ _index, /** @type {Element} */ element) => {
            return $(element).text().replaceAll("\n", "").replaceAll(" ", "");
        })).get().join(" ");
        if (!n) return;
        // 折叠按钮用 class 而非 id：两种挂载位置（.tabs / h2.section-title）可能同时出现，重复 id 会让第二个按钮失效
        $(".tabs").append(`\n            <div class="jhs-layout-8453d189">\n                <div>已选分类: <span id="jhs-check-tag">${n}</span></div>\n                <button type="button" class="jhs-btn jhs-btn--ghost jhs-layout-3a1fc324 jhs-fold-category-btn">\n                    <span></span>\n                    <i class="jhs-layout-78fa54ea"></i>\n                </button>\n\n            </div>\n        `);
        let a = $("h2.section-title");
        if (a.length > 0 && (a.append('\n                <div class="jhs-fold-category-box">\n                    <button type="button" class="jhs-btn jhs-btn--ghost jhs-layout-2100e73d jhs-fold-category-btn">\n                        <span></span>\n                        <i class="jhs-layout-78fa54ea"></i>\n                    </button>\n                </div>\n            '),
        t = $("section > div > div.box")), !t) return;
        const settings = this.getRuntimeService("settings");
        let i = $(".jhs-fold-category-btn"), s = settings.snapshot().foldCategoryCollapsed === !0, [label0, icon0] = s ? [ "展开", "icon-angle-double-down" ] : [ "折叠", "icon-angle-double-up" ];
        i.find("span").text(label0).end().find("i").attr("class", icon0), window.location.href.includes("noFold=1") || t[s ? "hide" : "show"]();
        const createFoldWriter = createLatestSettingWriter({ settings, key: "foldCategoryCollapsed", fallback: false, apply: (value) => {
            s = value === true;
            const [label, icon] = s ? [ "展开", "icon-angle-double-down" ] : [ "折叠", "icon-angle-double-up" ];
            i.find("span").text(label).end().find("i").attr("class", icon);
            t[s ? "hide" : "show"]();
        }, onError: (error) => {
            clog.error("分类折叠设置保存失败，已恢复", error), show.error("分类折叠设置保存失败，已恢复原设置");
        } });
        i.on("click", (async (/** @type {MouseEvent} */ e) => {
            e.preventDefault();
            await createFoldWriter(!s);
        }));
    }
}
