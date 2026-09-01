// @ts-check

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
export class ListFc2NavigationController {
    /** @param {{hostAdapter?: any, fc2?: any, eventBus?: any, ui?: any, scope?: any, document?: Document, window?: Window}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.fc2 = options.fc2 ?? null;
        this.eventBus = options.eventBus ?? null;
        this.ui = options.ui ?? null;
        this.scope = options.scope ?? null;
        this.document = options.document ?? this.hostAdapter?.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.disposed = false;
    }
    getJQuery() { return this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getClog() { return this.ui?.getClog?.() ?? /** @type {any} */ (globalThis).clog ?? {}; }

    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        if (this.disposed || !this.window?.isListPage) return;
        const fc2 = this.fc2;
        if (!fc2) return;
        const $ = this.getJQuery(), clog = this.getClog(), host = this.hostAdapter;
        const scope = options.scope || this.scope;
        if (!scope) return;
        fc2.registerStyles?.();
        const initialRoot = host?.locateListRoot?.() ?? null;
        /** @type {Element | null} */
        let boundRoot = null;
        // JHS 自渲染榜单页（热播/Top250）在启动时还没有列表根，这里必须支持延迟挂载：
        // 列表渲染后（list-items-added）再保护卡片并绑定对话框导航，否则 FC2 点击被统一详情导航吞掉。
        const ensureAttached = async () => {
            const current = host?.locateListRoot?.();
            if (!current) return;
            const root = $(current).first();
            if (!root.length) return;
            await this.protectFc2Navigation(root, fc2).catch((error) => clog.warn?.("FC2 导航保护初始化失败", error));
            if (boundRoot !== current) {
                boundRoot = current;
                this.bindFc2Navigation(root, fc2);
                scope.addCleanup(() => root.off(".jhsFc2Navigation"));
            }
        };
        await ensureAttached();

        // 6.5: protect FC2 cards added after initial render (AutoPage waterfall pages, filter re-render).
        // Prefer the list-items-added event; keep a MutationObserver fallback so FC2 navigation keeps
        // working when list.core is disabled.
        /** @type {ReturnType<typeof setTimeout> | null} */
        let reprotectTimer = null;
        const reprotect = () => {
            if (reprotectTimer != null) return;
            reprotectTimer = setTimeout(() => {
                reprotectTimer = null;
                void ensureAttached().catch((error) => clog.warn?.("FC2 动态导航保护失败", error));
            }, 80);
        };
        scope.addCleanup(() => {
            if (reprotectTimer != null) { clearTimeout(reprotectTimer); reprotectTimer = null; }
        });
        const unsubscribeItems = this.eventBus?.on?.("list-items-added", (/** @type {any} */ payload) => { if (payload?.items?.length) reprotect(); });
        unsubscribeItems && scope.addCleanup(unsubscribeItems);
        if (initialRoot && typeof MutationObserver !== "undefined") {
            scope.observe(initialRoot, (/** @type {MutationRecord[]} */ records) => {
                if (records.some((/** @type {MutationRecord} */ record) => record.addedNodes.length)) reprotect();
            }, { childList: true, subtree: false });
        }
    }

    /** @param {JQueryHandle} root @param {any} fc2 */
    async protectFc2Navigation(root, fc2) {
        for (const element of root.find(".item").toArray()) {
            const item = this.getJQuery()(element);
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
                this.getClog().warn?.("FC2 导航保护初始化失败", error);
            }
        }
    }

    /** @param {JQueryHandle} root @param {any} fc2 */
    bindFc2Navigation(root, fc2) {
        const selector = ".item img, .item .video-title";
        const $ = this.getJQuery(), clog = this.getClog();
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
                    clog.error?.("打开 FC2 详情失败", error);
                }
            }));
    }

    /** Expose FC2 navigation capabilities to other Feature-owned consumers. */
    getFc2Api() {
        const route = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => this.fc2?.[name]?.(...args);
        return Object.freeze({
            hasFc2: Boolean(this.fc2),
            resolveFc2Source: route("resolveFc2Source"),
            resolveMovieIdForRecord: route("resolveMovieIdForRecord"),
            openFc2Dialog: route("openFc2Dialog"),
            openFc2Page: route("openFc2Page"),
        });
    }

    dispose() {
        this.disposed = true;
        this.fc2?.dispose?.();
        this.fc2 = null;
    }
}

/** Compatibility export for the retained disabled-plugin ID. */
export const Fc2NavigationPlugin = ListFc2NavigationController;
