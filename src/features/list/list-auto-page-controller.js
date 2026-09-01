// @ts-check

import { l, o, r } from "../../core/constants.js";
import { requestHostPage } from "../../core/host-page-request.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { getDefaultListSelectors } from "../../core/list-selectors.js";

const AUTO_PAGE_CSS = `
    .jhs-scroll {
        text-align: center;
        padding-top: 20px;
        font-size: 14px;
    }
    .jhs-scroll.waterfall-loading { color: var(--jhs-text); }
    .jhs-scroll.waterfall-error { color: var(--jhs-status-filter); cursor: pointer; }
    .jhs-scroll.waterfall-no-more { color: var(--jhs-status-down); }
`;

/** Own list waterfall loading and its live page lifecycle. */
export class ListAutoPageController {
    /** @param {{hostAdapter?: any, settings?: any, http?: any, features?: any, ui?: any, styles?: any, scope?: any, document?: Document, window?: Window}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.settings = options.settings ?? null;
        this.http = options.http ?? null;
        this.features = options.features ?? null;
        this.ui = options.ui ?? null;
        this.styles = options.styles ?? null;
        this.scope = options.scope ?? null;
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? globalThis.window;
        /** @type {Record<string, any>} */ this.runtimeServices = {};
        this.preloadDistance = 500;
        this.currentPage = this.getInitialPageNumber();
        /** @type {Array<{ page: number, top: number, url: string }>} */ this.pageItems = [];
        /** @type {boolean} */ this.started = false;
        /** @type {import("../../core/lifecycle-scope.js").LifecycleScope | null} */ this.liveScope = null;
        /** @type {number} */ this.generation = 0;
        /** @type {HTMLElement | undefined} */ this.container = undefined;
        /** @type {HTMLDivElement | undefined} */ this.loader = undefined;
        /** @type {string | null} */ this.nextUrl = null;
        this.hasMore = false;
        this.isLoading = false;
        /** @type {any} */ this.listFeatureApi = null;
        this.styleRelease = null;
        this.disposed = false;
    }

    /** @param {string} name */
    getRuntimeService(name) {
        return this.runtimeServices[name] ?? ({
            host: this.hostAdapter,
            settings: this.settings,
            http: this.http,
            features: this.features,
            ui: this.ui,
            scope: this.scope,
        }[name] ?? null);
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getUtils() { return this.ui?.getUtils?.() ?? /** @type {any} */ (globalThis).utils ?? {}; }
    getClog() { return this.ui?.getClog?.() ?? /** @type {any} */ (globalThis).clog ?? {}; }
    getShow() { return this.ui?.show ?? /** @type {any} */ (globalThis).show ?? {}; }
    getWindow() { return this.hostAdapter?.document?.defaultView ?? this.window ?? globalThis.window; }
    getLocation() { return this.hostAdapter?.location ?? this.getWindow()?.location ?? null; }
    getHref() { return this.getLocation()?.href ?? o; }
    isJavBus() { return this.hostAdapter?.site === "javbus" || (!this.hostAdapter && l); }
    isJavDb() { return this.hostAdapter?.site === "javdb" || (!this.hostAdapter && r); }

    /** Resolve the list capability used by the waterfall contribution. */
    async getListFeatureApi() {
        if (this.listFeatureApi) return this.listFeatureApi;
        return this.getRuntimeService("features")?.getFeatureApi?.("list") ?? null;
    }

    initCss() { return AUTO_PAGE_CSS; }

    registerStyles() {
        if (this.styleRelease || !this.styles) return;
        this.styleRelease = this.styles.register?.("jhs-list-auto-page", AUTO_PAGE_CSS) ?? null;
    }

    async resolveOuterScope() {
        const scope = this.getRuntimeService("scope");
        return typeof scope === "function" ? scope() : scope;
    }

    /** @param {{scope?: any, listFeatureApi?: any}} [options] */
    async handle(options = {}) {
        this.listFeatureApi = options.listFeatureApi ?? this.listFeatureApi;
        const settings = this.getRuntimeService("settings"), scope = options.scope ?? await this.resolveOuterScope();
        if (!settings || !scope) return;
        this.scope = scope;
        this.registerStyles();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("autoPage")) return;
            void Promise.resolve(this.reconfigure()).catch((error) => this.getClog().error?.("自动翻页重配置失败", error));
        };
        settings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup(() => settings.removeEventListener("settings.changed", onSettingsChanged));
        scope.addCleanup(() => this.dispose());
        return this.reconfigure();
    }

    /** 总开关 live 生命周期：OFF→stop，ON→start（不刷新页面）。 */
    reconfigure() {
        const enabled = this.getRuntimeService("settings")?.snapshot?.().autoPage !== "no";
        if (enabled) return this.start();
        return this.stop();
    }

    start() {
        if (this.disposed) return;
        if (this.started) return this.waterfallPromise || (this.waterfallPromise = this.waterfall().finally(() => { this.waterfallPromise = null; }));
        this.registerStyles();
        this.started = true;
        this.liveScope?.dispose();
        this.liveScope = new LifecycleScope("autopage:live");
        this.generation++;
        this.waterfallPromise = this.waterfall().finally(() => { this.waterfallPromise = null; });
        return this.waterfallPromise;
    }

    /** 真正 stop：释放 live scope（scroll listener/定时器/请求全部随之 dispose），并使在途请求作废。 */
    stop() {
        this.started = false;
        this.generation++;
        this.liveScope?.dispose();
        this.liveScope = null;
        this.nextUrl = null;
        this.hasMore = false;
        this.isLoading = false;
        this.loader?.remove();
        this.loader = undefined;
        this.container = undefined;
        this.pageItems = [];
    }

    getInitialPageNumber() {
        const href = this.getHref();
        if (this.isJavBus()) {
            const match = href.match(/\/(?:page|star\/[^/]+)\/(\d+)/);
            return match ? parseInt(match[1], 10) : 1;
        }
        if (this.isJavDb()) {
            const match = href.match(/[?&]page=(\d+)/);
            return match ? parseInt(match[1], 10) : 1;
        }
        return 1;
    }

    getSelector() {
        return getDefaultListSelectors(this.isJavBus() ? "javbus" : "javdb");
    }

    async waterfall() {
        if (!this.started || !this.liveScope) return;
        if (await this.shouldDisablePaging()) return;
        if (!this.started || !this.liveScope || this.liveScope.disposed) return;
        const scope = this.liveScope, listFeature = await this.getListFeatureApi(), selectors = listFeature?.getListSelectors?.(), doc = this.document, pageWindow = this.getWindow(), clog = this.getClog();
        if (!listFeature || !selectors) return void clog.error?.("列表功能不可用,停止瀑布流!");
        const container = /** @type {HTMLElement | null} */ (doc?.querySelector?.(selectors.boxSelector));
        if (!container || !container.parentNode) return void clog.error?.("没有找到容器节点,停止瀑布流!");
        this.container = container;
        const loader = doc.createElement("div");
        this.loader = loader;
        loader.className = "jhs-scroll";
        container.parentNode.insertBefore(loader, container.nextSibling);
        this.pageItems.push({ page: this.currentPage, top: 0, url: pageWindow.location.href });
        scope.listen(loader, "click", () => {
            if (loader.classList.contains("waterfall-error")) void this.loadNextPage().catch((error) => clog.error?.("瀑布流重试失败", error));
        });
        let scheduled = false;
        const requestFrame = /** @type {(callback: () => void) => void} */ (pageWindow.requestAnimationFrame?.bind(pageWindow) ?? /** @type {any} */ (globalThis).requestAnimationFrame ?? ((/** @type {() => void} */ callback) => setTimeout(callback, 0)));
        scope.listen(pageWindow, "scroll", () => {
            if (scheduled) return;
            scheduled = true;
            requestFrame(() => {
                this.checkLoad();
                this.checkScrollPosition();
                scheduled = false;
            });
        });
        const next = /** @type {HTMLAnchorElement | null} */ (doc.querySelector(selectors.nextPageSelector));
        this.nextUrl = next?.href ?? null;
        this.hasMore = !!this.nextUrl;
        scope.ownTimeout(setTimeout(() => this.checkLoad(), 1000));
        if (!this.hasMore) this.setState("waterfall-no-more", "已经到底了");
    }

    async loadNextPage() {
        if (!this.started) return;
        if (this.getRuntimeService("settings")?.snapshot?.().autoPage === "no") return void this.setState("waterfall-loading", "");
        if (this.isLoading || !this.nextUrl || !this.container) return;
        const listFeature = await this.getListFeatureApi(), selectors = listFeature?.getListSelectors?.();
        if (!listFeature || !selectors) {
            this.nextUrl = null;
            this.hasMore = false;
            return void this.setState("waterfall-error", "列表功能已禁用，无法继续翻页");
        }
        this.isLoading = true;
        this.setState("waterfall-loading", "加载中...");
        const nextUrl = this.nextUrl, generation = this.generation, scope = this.liveScope, clog = this.getClog(), $ = this.getJQuery(), utils = this.getUtils();
        try {
            if (!scope || scope.disposed || generation !== this.generation) return;
            const response = await requestHostPage(this.getRuntimeService("http"), nextUrl, scope);
            if (!this.started || !this.liveScope || this.liveScope.disposed || generation !== this.generation) return;
            clog.log?.("请求下一页内容:", nextUrl);
            if (!$ || typeof utils.htmlTo$dom !== "function") throw new Error("列表 HTML 解析器不可用");
            const parsed = utils.htmlTo$dom(response);
            this.isJavBus() && parsed.find(".avatar-box").length > 0 && parsed.find(".avatar-box").parent().remove();
            const items = parsed.find(selectors.requestDomItemSelector);
            const current = this.getBoxCarInfoList(), incoming = this.getBoxCarInfoList(items);
            if (this.checkDuplicateCarNumbers(current, incoming)) {
                this.nextUrl = null;
                this.hasMore = false;
                return void this.setState("waterfall-error", "翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流");
            }
            if (!this.started || !this.liveScope || this.liveScope.disposed || generation !== this.generation) return;
            const top = this.container.scrollHeight;
            this.pageItems.push({ page: this.currentPage + 1, top, url: nextUrl });
            const images = parsed.find(selectors.coverImgSelector);
            listFeature.replaceHdImg?.(images);
            $(selectors.boxSelector).append(items);
            this.nextUrl = parsed.find(selectors.nextPageSelector).attr("href") ?? null;
            this.hasMore = !!this.nextUrl;
            const pagination = parsed.find(".pagination");
            $(".pagination").replaceWith(pagination);
            this.setState("waterfall-loading", "");
            if (!this.hasMore) this.setState("waterfall-no-more", "已经到底了");
        } catch (error) {
            if (this.started && this.loader) this.setState("waterfall-error", "加载失败，点击重试");
            clog.error?.("加载失败:", error);
        } finally {
            this.isLoading = false;
        }
    }

    checkScrollPosition() {
        const scrollY = this.getWindow().scrollY;
        for (let index = this.pageItems.length - 1; index >= 0; index--) {
            const item = this.pageItems[index];
            if (scrollY >= item.top) {
                if (this.currentPage !== item.page) {
                    this.currentPage = item.page;
                    this.updatePageUrl(item.url);
                }
                break;
            }
        }
    }

    checkLoad() {
        if (!this.loader) return;
        if (this.loader.classList.contains("waterfall-error")) return;
        if (this.loader.getBoundingClientRect().top < this.getWindow().innerHeight + this.preloadDistance) void this.loadNextPage().catch((error) => this.getClog().error?.("瀑布流自动加载失败", error));
    }

    async shouldDisablePaging() {
        const pageWindow = this.getWindow(), href = this.getHref();
        if (!pageWindow?.isListPage) return true;
        const enabled = this.getRuntimeService("settings")?.snapshot?.().autoPage;
        return enabled === "no" || [ "search?q", "handlePlayback=1", "handleTop=1", "/want_watch_videos", "/watched_videos", "/advanced_search?type=100" ].some((part) => href.includes(part));
    }

    /** @param {string} url */
    updatePageUrl(url) {
        this.getWindow().history.replaceState({}, "", url);
        if (this.isJavBus()) this.document.title = this.document.title.replace(/第\d+頁/, `第${this.currentPage}頁`);
    }

    /** @param {string} state @param {string} text */
    setState(state, text) {
        if (!this.loader) return;
        this.loader.className = `jhs-scroll ${state}`;
        this.loader.textContent = text;
    }

    /** @param {any} element */
    getBoxCarInfo(element) {
        const $ = this.getJQuery(), anchor = element.find("a"), href = anchor.attr("href");
        let carNum = null, title = null, publishTime = null;
        const videoTitle = element.find(".video-title");
        if (videoTitle.length > 0) {
            const strong = videoTitle.find("strong");
            carNum = strong.length > 0 ? strong.text().trim() : null;
            title = anchor.attr("title")?.trim() || null;
            if (!title) {
                const text = videoTitle.text().trim();
                title = carNum && text.includes(carNum) ? text.replace(carNum, "").trim() : text;
            }
            publishTime = element.find(".meta").text().trim();
        }
        if (!carNum) {
            const image = element.find("img");
            title = image.attr("title")?.trim() || image.attr("data-title")?.trim() || title;
            const dates = element.find("date").map((/** @type {number} */ _index, /** @type {HTMLElement} */ node) => $(node).text().trim()).get();
            const isDate = (/** @type {string} */ value) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(value);
            publishTime = dates.find(isDate) || null;
            carNum = dates.find((/** @type {string} */ value) => !isDate(value)) || null;
        }
        if (!carNum) {
            const error = new Error("提取番号信息失败: carNum 为空");
            this.getClog().error?.("Error in getBoxCarInfo:", error, "Box Element:", element.get?.(0));
            this.getShow().error?.(error.message);
            throw error;
        }
        return { carNum, url: href || "", title: title || "", publishTime: publishTime || "" };
    }

    /** @param {any} [elements] */
    getBoxCarInfoList(elements = null) {
        const $ = this.getJQuery(), items = elements || $(this.getSelector().itemSelector);
        if (!items?.length) {
            this.getClog().error?.("获取当前列表页所有item的番号信息失败!");
            return [];
        }
        /** @type {any[]} */ const result = [];
        items.each((/** @type {number} */ index, /** @type {HTMLElement} */ node) => {
            try { result.push(this.getBoxCarInfo($(node))); }
            catch (error) { this.getClog().error?.("[getBoxCarInfoList] 提取单个 boxCar 信息失败:", error instanceof Error ? error.message : String(error), "元素索引:", index); }
        });
        return result;
    }

    /** @param {{carNum?: string}[]} current @param {{carNum?: string}[]} incoming */
    checkDuplicateCarNumbers(current, incoming) {
        if (!current?.length || !incoming?.length) return false;
        const existing = new Set(current.map((item) => item.carNum).filter(Boolean));
        if (!existing.size) return false;
        let consecutive = 0;
        for (const item of incoming) {
            if (item?.carNum && existing.has(item.carNum)) {
                consecutive++;
                if (consecutive >= 2) {
                    this.getClog().warn?.("警告: 检测到连续番号信息重复, 该类别可能已被限制页码。");
                    return true;
                }
            } else consecutive = 0;
        }
        return false;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.stop();
        this.styleRelease?.();
        this.styleRelease = null;
    }
}

/** Compatibility export for the retained disabled-plugin ID. */
export const AutoPagePlugin = ListAutoPageController;
