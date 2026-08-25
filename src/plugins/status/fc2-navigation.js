// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";
import { readListItem } from "../../core/list-item-reader.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */

/**
 * FC2 list-card navigation lives outside list.core so the FC2 path keeps
 * working when the generic list plugin is disabled. It owns:
 * - FC2 card identification on JavDB list pages
 * - original href protection / VIP bypass via owned-detail URL
 * - normal click -> FC2 dialog
 * - Ctrl / Meta / middle click -> FC2 owned detail
 * - source resolution (explicit -> URL inference -> empty)
 */
export class Fc2NavigationPlugin extends BasePlugin {
    getName() { return "Fc2NavigationPlugin"; }

    async handle() {
        if (!window.isListPage) return;
        const fc2 = this.getOptionalDependency("Fc2Plugin");
        if (!fc2) return;
        const host = this.getRuntimeService("host");
        const listRoot = host?.locateListRoot?.();
        if (!listRoot) return;
        const root = $(listRoot).first();
        if (!root.length) return;
        await this.protectFc2Navigation(root, fc2);
        this.bindFc2Navigation(root, fc2);
        const scope = await this.getRuntimeService("scope")();
        scope.addCleanup(() => root.off(".jhsFc2Navigation"));
    }

    /** @param {JQueryHandle} root @param {any} fc2 */
    async protectFc2Navigation(root, fc2) {
        for (const element of root.find(".item").toArray()) {
            const item = $(element);
            if (item.attr("data-jhs-fc2-protected") === "true") continue;
            try {
                const { carNum, aHref, fc2Source } = readListItem(item);
                if (!carNum?.includes("FC2-") || !aHref) continue;
                const source = fc2Source || (await fc2.resolveFc2Source({ url: aHref })) || "";
                item.attr({
                    "data-jhs-original-url": aHref,
                    "data-jhs-fc2-source": source,
                    "data-jhs-fc2-protected": "true",
                });
                item.find("a[href]").attr("href", fc2.createFc2PageUrl(null, carNum, aHref, { source }));
            } catch (error) {
                clog.warn("FC2 导航保护初始化失败", error);
            }
        }
    }

    /** @param {JQueryHandle} root @param {any} fc2 */
    bindFc2Navigation(root, fc2) {
        const selector = ".item img, .item .video-title";
        root.off("click.jhsFc2Navigation auxclick.jhsFc2Navigation", selector)
            .on("click.jhsFc2Navigation auxclick.jhsFc2Navigation", selector, (async (/** @type {any} */ event) => {
                if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
                if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
                const item = $(event.currentTarget).closest(".item");
                const { carNum, aHref, fc2Source } = readListItem(item);
                if (!carNum?.includes("FC2-") || !aHref) return;
                event.preventDefault();
                event.stopPropagation();
                try {
                    const shouldOpenTab = Boolean(event.ctrlKey || event.metaKey || 1 === event.button);
                    const movieId = await fc2.resolveMovieIdForRecord(carNum, aHref);
                    const source = fc2Source || (await fc2.resolveFc2Source({ url: aHref })) || "";
                    if (shouldOpenTab) {
                        fc2.openFc2Page(movieId, carNum, aHref, { event, newTab: true }, { source });
                    } else {
                        fc2.openFc2Dialog(movieId, carNum, aHref, { source });
                    }
                } catch (error) {
                    clog.error("打开 FC2 详情失败", error);
                }
            }));
    }
}
