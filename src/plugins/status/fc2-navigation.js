// @ts-check

import { jhsEventBus } from "../../core/event-bus.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { readListItem } from "../../core/list-item-reader.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */

/**
 * FC2 list-card navigation lives outside list.core so the FC2 path keeps
 * working when the generic list plugin is disabled. It owns:
 * - FC2 card identification on JavDB list pages
 * - primary-anchor ownership without rewriting native hrefs
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
        const scope = await this.getRuntimeService("scope")();
        const initialRoot = host?.locateListRoot?.() ?? null;
        let boundRoot = null;
        // JHS 自渲染榜单页（热播/Top250）在启动时还没有列表根，这里必须支持延迟挂载：
        // 列表渲染后（list-items-added）再保护卡片并绑定对话框导航，否则 FC2 点击被统一详情导航吞掉。
        const ensureAttached = async () => {
            const current = host?.locateListRoot?.();
            if (!current) return;
            const root = $(current).first();
            if (!root.length) return;
            await this.protectFc2Navigation(root, fc2).catch((error) => clog.warn("FC2 导航保护初始化失败", error));
            this.bindFc2Navigation(root, fc2);
            if (boundRoot !== current) {
                boundRoot = current;
                scope.addCleanup(() => {
                    root.off(".jhsFc2Navigation");
                    root.find('.item a[data-jhs-fc2-primary="true"]').off(".jhsFc2Navigation");
                });
            }
        };
        await ensureAttached();

        // 6.5: protect FC2 cards added after initial render (AutoPage waterfall pages, filter re-render).
        // Prefer the list-items-added event; keep a MutationObserver fallback so FC2 navigation keeps
        // working when list.core is disabled.
        let reprotectTimer = null;
        const reprotect = () => {
            if (reprotectTimer != null) return;
            reprotectTimer = setTimeout(() => {
                reprotectTimer = null;
                void ensureAttached().catch((error) => clog.warn("FC2 动态导航保护失败", error));
            }, 80);
        };
        scope.addCleanup(() => {
            if (reprotectTimer != null) { clearTimeout(reprotectTimer); reprotectTimer = null; }
        });
        const unsubscribeItems = jhsEventBus.on("list-items-added", (payload) => { if (payload?.items?.length) reprotect(); });
        scope.addCleanup(unsubscribeItems);
        if (initialRoot && typeof MutationObserver !== "undefined") {
            scope.observe(initialRoot, (records) => {
                if (records.some((record) => record.addedNodes.length)) reprotect();
            }, { childList: true, subtree: false });
        }
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
                const primaryAnchor = item.find("a").first();
                if (!primaryAnchor.length) continue;
                item.attr({
                    "data-jhs-original-url": aHref,
                    "data-jhs-fc2-source": source,
                    "data-jhs-fc2-protected": "true",
                });
                primaryAnchor.attr("data-jhs-fc2-primary", "true");
            } catch (error) {
                clog.warn("FC2 导航保护初始化失败", error);
            }
        }
    }

    /** @param {JQueryHandle} root @param {any} fc2 */
    bindFc2Navigation(root, fc2) {
        const selector = '.item a[data-jhs-fc2-primary="true"]';
        const handleNavigation = async (/** @type {any} */ event) => {
                if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
                if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
                const item = $(event.currentTarget).closest(".item");
                const shouldOpenTab = Boolean(event.ctrlKey || event.metaKey || 1 === event.button);
                const fallbackToNative = (href, carNum, error) => {
                    clog.error("打开 FC2 详情失败，回退原始链接", error);
                    if (shouldOpenTab) utils.openPage(href, carNum, !0, { event, newTab: true });
                    else window.location.href = href;
                };
                let carNum;
                let aHref;
                let fc2Source;
                try {
                    const record = readListItem(item);
                    carNum = record.carNum;
                    aHref = item.attr("data-jhs-original-url") || record.aHref;
                    fc2Source = record.fc2Source;
                } catch (error) {
                    aHref = item.attr("data-jhs-original-url") || item.find("a").first().attr("href");
                    carNum = item.find(".video-title strong").first().text().trim();
                    if (!aHref) return;
                    event.preventDefault();
                    event.stopPropagation();
                    fallbackToNative(aHref, carNum, error);
                    return;
                }
                if (!carNum?.includes("FC2-") || !aHref) return;
                event.preventDefault();
                event.stopPropagation();
                try {
                    const movieId = await fc2.resolveMovieIdForRecord(carNum, aHref);
                    const source = fc2Source || (await fc2.resolveFc2Source({ url: aHref })) || "";
                    if (shouldOpenTab) {
                        await fc2.openFc2Page(movieId, carNum, aHref, { event, newTab: true }, { source });
                    } else {
                        fc2.openFc2Dialog(movieId, carNum, aHref, { source });
                    }
                } catch (error) { fallbackToNative(aHref, carNum, error); }
            };
        root.off("click.jhsFc2Navigation auxclick.jhsFc2Navigation", selector);
        root.find(selector).each((/** @type {number} */ _index, /** @type {Element} */ element) => {
            $(element).off("click.jhsFc2Navigation auxclick.jhsFc2Navigation").on("click.jhsFc2Navigation auxclick.jhsFc2Navigation", handleNavigation);
        });
    }
}
