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
        /** @type {Map<HTMLAnchorElement, string>} */
        this.changedEntryLinks = new Map();
        this.entryCleanupRegistered = false;
    }
    getJQuery() { return this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getClog() { return this.ui?.getClog?.() ?? /** @type {any} */ (globalThis).clog ?? {}; }

    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        if (this.disposed) return;
        const scope = options.scope || this.scope;
        if (!scope) return;
        // 6.4.1/6.5 rewrote the FC2 entry links on every JavDB page. Keep this
        // outside the list-page guard; otherwise detail/other pages fall back
        // to the host's membership route before JHS can intercept the click.
        this.redirectFc2EntryLinks(scope);
        if (!this.window?.isListPage) return;
        const fc2 = this.fc2;
        if (!fc2) return;
        const $ = this.getJQuery(), clog = this.getClog(), host = this.hostAdapter;
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
        // 6.5: protect FC2 cards added after initial render (AutoPage waterfall pages, filter re-render).
        // Prefer the list-items-added event; keep a MutationObserver fallback so FC2 navigation keeps
        // working when list.core is disabled.
        /** @type {ReturnType<typeof setTimeout> | null} */
        let reprotectTimer = null;
        const reprotect = () => {
            if (reprotectTimer != null) return;
            reprotectTimer = setTimeout(() => {
                reprotectTimer = null;
                this.redirectFc2EntryLinks(scope);
                void ensureAttached().catch((error) => clog.warn?.("FC2 动态导航保护失败", error));
            }, 80);
        };
        scope.addCleanup(() => {
            if (reprotectTimer != null) { clearTimeout(reprotectTimer); reprotectTimer = null; }
        });
        const unsubscribeItems = this.eventBus?.on?.("list-items-added", (/** @type {any} */ payload) => { if (payload?.items?.length) reprotect(); });
        unsubscribeItems && scope.addCleanup(unsubscribeItems);
        if (typeof MutationObserver !== "undefined") {
            const observeTargets = [ initialRoot, this.document?.body, this.document?.documentElement ].filter(Boolean);
            for (const observeRoot of [ ...new Set(observeTargets) ]) scope.observe(observeRoot, (/** @type {MutationRecord[]} */ records) => {
                if (records.some((/** @type {MutationRecord} */ record) => record.addedNodes.length)) reprotect();
            }, { childList: true, subtree: true });
        }
        // Register listeners/observers before the first attach: HotShow creates its list asynchronously.
        await ensureAttached();
    }

    /** Redirect JavDB FC2 entry points to the legacy-compatible search route before the host login gate runs. */
    /** @param {any} scope */
    redirectFc2EntryLinks(scope) {
        const origin = this.window?.location?.origin;
        if (!origin || !this.document) return;
        const target = "/advanced_search?type=3&score_min=0&d=1";
        for (const element of this.document.querySelectorAll("a[href]")) {
            const anchor = /** @type {HTMLAnchorElement} */ (element);
            let url;
            try { url = new URL(anchor.href, origin); } catch { continue; }
            const isFc2Entry = url.origin === origin && (
                "/fc2" === url.pathname || "/tags/fc2" === url.pathname
                || "/rankings/movies" === url.pathname && "fc2" === url.searchParams.get("t")
            );
            if (!isFc2Entry || this.changedEntryLinks.has(anchor)) continue;
            this.changedEntryLinks.set(anchor, anchor.getAttribute("href") || anchor.href);
            anchor.setAttribute("href", target);
        }
        if (this.entryCleanupRegistered) return;
        this.entryCleanupRegistered = true;
        scope.addCleanup(() => {
            for (const [anchor, href] of this.changedEntryLinks) {
                if (anchor.isConnected) anchor.setAttribute("href", href);
            }
            this.changedEntryLinks.clear();
            this.entryCleanupRegistered = false;
        });
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
        const selector = ".item";
        const $ = this.getJQuery(), clog = this.getClog();
        root.off("click.jhsFc2Navigation auxclick.jhsFc2Navigation", selector)
            .on("click.jhsFc2Navigation auxclick.jhsFc2Navigation", selector, (async (/** @type {any} */ event) => {
                if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
                if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
                if ($(event.target).closest(".jhs-cover-tools, .jhs-card-menu, .item video").length) return;
                const item = $(event.currentTarget), primaryAnchor = item.find("a[href]").first()[0], clickedAnchor = $(event.target).closest("a")[0];
                if (clickedAnchor && primaryAnchor && clickedAnchor !== primaryAnchor) return;
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
