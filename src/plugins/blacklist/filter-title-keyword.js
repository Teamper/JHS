// @ts-check

import { _, l, r } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { BasePlugin } from "../../core/plugin-manager.js";

export class FilterTitleKeywordPlugin extends BasePlugin {
    getName() {
        return "FilterTitleKeywordPlugin";
    }
    async handle() {
        if (!isDetailPage) return;
        await this.bindDetailRoot(document);
    }
    async bindDetailRoot(/** @type {ParentNode} */ root, /** @type {{layerIndex?: number | null}} */ { layerIndex = null } = {}) {
        if (await storageManager.getSetting("enableTitleSelectFilter", _) !== _) return;
        const host = $(root), selector = r ? ".title strong, .current-title" : l ? "h3" : ".current-title, .origin-title, .jhs-detail-title";
        host.off("contextmenu.jhsTitleFilter", selector).on("contextmenu.jhsTitleFilter", selector, ((/** @type {MouseEvent} */ e) => {
            const t = window.getSelection()?.toString() || "";
            if (t) {
                e.preventDefault();
                let n = {
                    clientX: e.clientX,
                    clientY: e.clientY + 80
                };
                utils.q(n, `是否屏蔽标题关键词 ${t}?`, (async () => {
                    await storageManager.saveTitleFilterKeyword(t), await jhsEventBus?.emit("filter-rules-changed", { scope: "title-keyword" }), utils.closePage({ root: host, layerIndex });
                }));
            }
        }));
    }
}
