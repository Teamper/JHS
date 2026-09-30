// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { readListItem } from "../../core/list-item-reader.js";
import { requestHostPage } from "../../core/host-page-request.js";

export const AUTO_PAGE_STYLES = `
    .jhs-scroll { text-align:center; padding-top:20px; font-size:14px; }
    .jhs-scroll.waterfall-loading { color:var(--jhs-text); }
    .jhs-scroll.waterfall-error { color:var(--jhs-status-filter); cursor:pointer; }
    .jhs-scroll.waterfall-stopped { color:var(--jhs-status-filter); }
    .jhs-scroll.waterfall-paused { color:var(--jhs-text); }
    .jhs-scroll__continue { display:inline-flex; margin-inline-start:var(--jhs-space-2); }
    .jhs-scroll.waterfall-no-more { color:var(--jhs-status-down); }
`;

/** Feature-owned waterfall pagination; all list access crosses injected capabilities. */
export class AutoPageController {
    /** @param {{hostAdapter: any, http: any, settings: any, list?: any, ui: {jquery: (value: any) => any}, eventBus?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, document?: Document, window?: Window, logger?: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.http = options.http;
        this.settings = options.settings;
        this.list = options.list ?? null;
        this.ui = options.ui;
        this.eventBus = options.eventBus ?? null;
        this.scope = options.scope;
        this.document = options.document ?? options.hostAdapter?.document ?? globalThis.document;
        this.window = options.window ?? options.hostAdapter?.location?.window ?? globalThis.window;
        this.logger = options.logger ?? /** @type {any} */ (globalThis).clog ?? console;
        this.preloadDistance = 500;
        this.currentPage = this.getInitialPageNumber();
        /** @type {Array<{page: number, top: number, url: string}>} */ this.pageItems = [];
        /** @type {boolean} */ this.started = false;
        /** @type {import("../../core/lifecycle-scope.js").LifecycleScope | null} */ this.liveScope = null;
        /** @type {number} */ this.generation = 0;
        /** @type {HTMLElement | undefined} */ this.container = undefined;
        /** @type {HTMLDivElement | undefined} */ this.loader = undefined;
        /** @type {string | null} */ this.nextUrl = null;
        this.hasMore = false;
        this.isLoading = false;
        this.pausedFilter = null;
        this.visibilitySnapshot = this.list?.getVisibilitySnapshot?.() ?? null;
        this.mounted = false;
        this.disposed = false;
        this.settingsListener = null;
        this.unsubscribeItems = null;
        this.waterfallPromise = null;
    }

    async mount() {
        this.scope.assertActive();
        if (this.mounted || this.disposed) return false;
        this.mounted = true;
        this.scope.addCleanup(() => this.dispose());
        this.settingsListener = (/** @type {any} */ event) => {
            if (event.detail?.names?.includes("autoPage")) void this.reconfigure();
        };
        this.settings.addEventListener("settings.changed", this.settingsListener);
        this.scope.addCleanup(() => this.settings.removeEventListener("settings.changed", this.settingsListener));
        this.unsubscribeItems = this.eventBus?.on?.("list-items-added", (/** @type {any} */ payload) => {
            this.visibilitySnapshot = this.list?.getVisibilitySnapshot?.() ?? this.visibilitySnapshot;
            if (payload?.items?.length) this.checkLoad();
        }) ?? null;
        if (this.unsubscribeItems) this.scope.addCleanup(this.unsubscribeItems);
        this.unsubscribeVisibility = this.eventBus?.on?.("list-visibility-changed", (/** @type {any} */ snapshot) => this.onVisibilityChanged(snapshot)) ?? null;
        if (this.unsubscribeVisibility) this.scope.addCleanup(this.unsubscribeVisibility);
        await this.reconfigure();
        return !this.disposed && !this.scope.disposed;
    }

    /** Turns the live scroll/request scope on or off when the master setting changes. */
    reconfigure() {
        if (this.disposed || this.scope.disposed) return Promise.resolve(false);
        return this.settings.snapshot().autoPage === "no" ? (this.stop(), Promise.resolve(false)) : this.start();
    }

    start() {
        if (this.disposed || this.scope.disposed) return Promise.resolve(false);
        if (this.started) return this.waterfallPromise || (this.waterfallPromise = this.waterfall().finally(() => { this.waterfallPromise = null; }));
        this.started = true;
        this.liveScope?.dispose();
        this.liveScope = new LifecycleScope("autopage:live");
        this.generation++;
        this.waterfallPromise = this.waterfall().finally(() => { this.waterfallPromise = null; });
        return this.waterfallPromise;
    }

    /** Releases the live scope and invalidates all in-flight page responses. */
    stop() {
        this.started = false;
        this.generation++;
        this.liveScope?.dispose();
        this.liveScope = null;
        this.nextUrl = null;
        this.hasMore = false;
        this.isLoading = false;
        this.pausedFilter = null;
        this.loader?.remove();
        this.loader = undefined;
        this.container = undefined;
        this.pageItems = [];
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.settingsListener) this.settings.removeEventListener("settings.changed", this.settingsListener);
        this.settingsListener = null;
        this.unsubscribeItems?.();
        this.unsubscribeItems = null;
        this.stop();
    }

    getInitialPageNumber() {
        const location = this.hostAdapter?.location ?? this.window?.location;
        const pathPage = this.hostAdapter?.site === "javbus" ? location?.pathname?.match(/\/(?:page|star\/[^/]+)\/(\d+)/) : null;
        const queryPage = this.hostAdapter?.site === "javdb" ? new URLSearchParams(location?.search ?? "").get("page") : null;
        const page = pathPage?.[1] ?? queryPage;
        return page && /^\d+$/.test(page) ? Number.parseInt(page, 10) : 1;
    }

    getSelector() { return this.hostAdapter.getListSelectors(); }

    async waterfall() {
        if (!this.started || !this.liveScope || await this.shouldDisablePaging()) return;
        if (!this.started || !this.liveScope || this.liveScope.disposed) return;
        const scope = this.liveScope;
        const selectors = this.getSelector();
        const container = /** @type {HTMLElement | null} */ (this.document.querySelector(selectors.boxSelector));
        if (!container || !container.parentNode) return this.log("error", "没有找到容器节点,停止瀑布流!");
        this.container = container;
        const loader = this.document.createElement("div");
        this.loader = loader;
        loader.className = "jhs-scroll";
        container.parentNode.insertBefore(loader, container.nextSibling);
        this.pageItems.push({ page: this.currentPage, top: 0, url: this.window.location.href });
        loader.addEventListener("click", (/** @type {MouseEvent} */ event) => this.handleLoaderClick(event));
        let scheduled = false;
        scope.listen(this.window, "scroll", () => {
            if (scheduled) return;
            scheduled = true;
            this.window.requestAnimationFrame?.(() => {
                this.checkLoad();
                this.checkScrollPosition();
                scheduled = false;
            }) ?? setTimeout(() => { this.checkLoad(); this.checkScrollPosition(); scheduled = false; }, 0);
        });
        const next = /** @type {HTMLAnchorElement | null} */ (this.document.querySelector(selectors.nextPageSelector));
        this.nextUrl = next?.href ?? null;
        this.hasMore = Boolean(this.nextUrl);
        this.onVisibilityChanged(this.list?.getVisibilitySnapshot?.() ?? this.visibilitySnapshot);
        scope.ownTimeout(setTimeout(() => this.checkLoad(), 1000));
        if (!this.hasMore) this.setState("waterfall-no-more", "已经到底了");
    }

    /** Pause automatic pagination when a quick filter has no matching loaded cards. */
    /** @param {any} snapshot */
    onVisibilityChanged(snapshot) {
        if (!snapshot || !Number.isFinite(snapshot.visible) || !Number.isFinite(snapshot.total)) return;
        const previousFilter = this.visibilitySnapshot?.filter;
        this.visibilitySnapshot = snapshot;
        const filter = String(snapshot.filter || "waitCheck");
        const hasNoMatches = filter !== "all" && snapshot.visible === 0;
        if (this.pausedFilter) {
            if (filter !== previousFilter && !hasNoMatches) {
                this.pausedFilter = null;
                if (!this.hasMore) return this.loader?.classList.contains("waterfall-stopped") ? undefined : this.setState("waterfall-no-more", "已经到底了");
                this.setState("waterfall-loading", "");
                this.checkLoad();
                return;
            }
            this.pausedFilter = filter;
            this.renderPausedState();
            return;
        }
        if (hasNoMatches) {
            this.pausedFilter = filter;
            this.renderPausedState();
        }
    }

    renderPausedState() {
        if (!this.loader || this.isLoading) return;
        if (!this.hasMore) return this.loader.classList.contains("waterfall-stopped") ? undefined : this.setState("waterfall-no-more", "已经到底了");
        const hasMatches = this.visibilitySnapshot?.filter === this.pausedFilter && this.visibilitySnapshot.visible > 0;
        this.setState("waterfall-paused", hasMatches ? "自动翻页已暂停" : "已加载内容无匹配");
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--secondary jhs-scroll__continue";
        button.textContent = "继续加载一页";
        this.loader.append(" ", button);
    }

    /** @param {{manual?: boolean}} [options] */
    async loadNextPage({ manual = false } = {}) {
        if (!this.started) return;
        if (this.settings.snapshot().autoPage === "no") return this.setState("waterfall-loading", "");
        if (this.pausedFilter && !manual) return;
        if (this.isLoading || !this.nextUrl || !this.container) return;
        if (!this.list) {
            this.nextUrl = null;
            this.hasMore = false;
            return this.setState("waterfall-error", "列表功能已禁用，无法继续翻页");
        }
        this.isLoading = true;
        this.setState("waterfall-loading", "加载中...");
        const selectors = this.getSelector();
        const generation = this.generation;
        const scope = this.liveScope;
        try {
            if (!this.isCurrent(generation, scope)) return;
            const html = await requestHostPage(this.http, this.nextUrl, scope ?? undefined);
            if (!this.isCurrent(generation, scope)) return;
            this.log("log", "请求下一页内容:", this.nextUrl);
            const parsedDocument = new this.window.DOMParser().parseFromString(html, "text/html");
            const page = this.ui.jquery(parsedDocument);
            if (this.hostAdapter.site === "javbus" && page.find(".avatar-box").length > 0) page.find(".avatar-box").parent().remove();
            const cards = page.find(selectors.requestDomItemSelector);
            if (this.hasRepeatedCarNumbers(this.readCarNumbers(this.ui.jquery(selectors.itemSelector)), this.readCarNumbers(cards))) {
                this.nextUrl = null;
                this.hasMore = false;
                return this.setState("waterfall-stopped", "下一页包含重复内容，已停止自动翻页");
            }
            if (!this.isCurrent(generation, scope)) return;
            const container = this.container;
            if (!container) return;
            const pageUrl = this.nextUrl;
            this.pageItems.push({ page: this.currentPage + 1, top: container.scrollHeight, url: pageUrl });
            this.list.replaceCoverImages?.(page.find(selectors.coverImgSelector).toArray());
            this.ui.jquery(container).append(cards);
            this.nextUrl = page.find(selectors.nextPageSelector).first().attr("href") ?? null;
            this.hasMore = Boolean(this.nextUrl);
            this.ui.jquery(".pagination").replaceWith(page.find(".pagination"));
            this.setState("waterfall-loading", "");
            if (!this.hasMore) this.setState("waterfall-no-more", "已经到底了");
        } catch (error) {
            this.started && this.loader && this.setState("waterfall-error", "加载失败，点击重试");
            this.log("error", "加载失败:", error);
        } finally {
            if (generation === this.generation) {
                this.isLoading = false;
                if (this.pausedFilter) this.renderPausedState();
            }
        }
    }

    /** @param {MouseEvent} event */
    handleLoaderClick(event) {
        if (!this.loader) return;
        if (event.target instanceof Element && event.target.closest(".jhs-scroll__continue")) {
            event.preventDefault();
            event.stopPropagation();
            void this.loadNextPage({ manual: true }).catch((/** @type {unknown} */ error) => this.log("error", "手动加载下一页失败", error));
            return;
        }
        if (this.loader.classList.contains("waterfall-error")) {
            void this.loadNextPage({ manual: Boolean(this.pausedFilter) }).catch((/** @type {unknown} */ error) => this.log("error", "瀑布流重试失败", error));
        }
    }

    /** @param {any} collection */
    readCarNumbers(collection) {
        return collection.toArray().flatMap((/** @type {Element} */ element, /** @type {number} */ index) => {
            try { return [readListItem(this.ui.jquery(element)).carNum]; }
            catch (error) { this.log("error", "[AutoPage] 忽略番号无效的列表项", index, error); return []; }
        });
    }

    /** Stops only after two consecutive numbers repeat from the current page. */
    /** @param {string[]} current @param {string[]} next */
    hasRepeatedCarNumbers(current, next) {
        if (!current.length || !next.length) return false;
        const existing = new Set(current);
        let consecutive = 0;
        for (const carNum of next) {
            if (carNum && existing.has(carNum)) {
                if (++consecutive >= 2) return true;
            } else consecutive = 0;
        }
        return false;
    }

    checkScrollPosition() {
        const scrollY = this.window.scrollY;
        for (let index = this.pageItems.length - 1; index >= 0; index--) {
            const page = this.pageItems[index];
            if (scrollY >= page.top) {
                if (this.currentPage !== page.page) {
                    this.currentPage = page.page;
                    this.updatePageUrl(page.url);
                }
                break;
            }
        }
    }

    checkLoad() {
        if (!this.loader || !this.hasMore || this.pausedFilter || this.loader.classList.contains("waterfall-error") || this.loader.classList.contains("waterfall-stopped")) return;
        if (this.loader.getBoundingClientRect().top < this.window.innerHeight + this.preloadDistance) {
            void this.loadNextPage().catch((/** @type {unknown} */ error) => this.log("error", "瀑布流自动加载失败", error));
        }
    }

    async shouldDisablePaging() {
        if (!this.window.isListPage) return true;
        if (this.settings.snapshot().autoPage === "no") return true;
        const url = this.window.location.href;
        return ["search?q", "/rankings/movies", "/rankings/playback", "/rankings/top", "/want_watch_videos", "/watched_videos", "jhs_source=123av"].some((part) => url.includes(part));
    }

    /** @param {string} url */
    updatePageUrl(url) {
        this.window.history.replaceState({}, "", url);
        if (this.hostAdapter.site === "javbus") this.document.title = this.document.title.replace(/第\d+頁/, `第${this.currentPage}頁`);
    }

    /** @param {string} state @param {string} text */
    setState(state, text) {
        if (!this.loader) return;
        this.loader.className = `jhs-scroll ${state}`;
        this.loader.textContent = text;
    }

    /** @param {string} method @param {...any} args */
    log(method, ...args) { this.logger?.[method]?.(...args); }

    /** @param {number} generation @param {import("../../core/lifecycle-scope.js").LifecycleScope | null} scope */
    isCurrent(generation, scope) { return this.started && scope !== null && !scope.disposed && generation === this.generation && !this.scope.disposed; }
}
