// @ts-check

import { C, _, l, o, r } from "../../core/constants.js";
import { requestHostPage } from "../../core/host-page-request.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { BasePlugin } from "../../core/plugin-manager.js";

export class AutoPagePlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.preloadDistance = 500;
        this.currentPage = this.getInitialPageNumber();
        /** @type {Array<{ page: number, top: number, url: string }>} */
        this.pageItems = [];
        /** @type {boolean} */ this.started = false;
        /** @type {import("../../core/lifecycle-scope.js").LifecycleScope | null} */ this.liveScope = null;
        /** @type {number} */ this.generation = 0;
        /** @type {HTMLElement | undefined} */
        this.container = void 0;
        /** @type {HTMLDivElement | undefined} */
        this.loader = void 0;
        /** @type {string | null} */
        this.nextUrl = null;
        this.hasMore = false;
        this.isLoading = false;
    }
    getName() {
        return "AutoPagePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .jhs-scroll {\n                    text-align: center;\n                    padding-top: 20px;\n                    font-size: 14px;\n                }\n                .jhs-scroll.waterfall-loading { color: var(--jhs-text); }\n                .jhs-scroll.waterfall-error { color: var(--jhs-status-filter); cursor: pointer; }\n                .jhs-scroll.waterfall-no-more { color: var(--jhs-status-down); }\n            </style>\n        ";
    }
    async handle() {
        const settings = this.getRuntimeService("settings"), scope = await this.getRuntimeService("scope")();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("autoPage")) return;
            this.reconfigure();
        };
        settings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => settings.removeEventListener("settings.changed", onSettingsChanged)));
        scope.addCleanup((() => this.stop()));
        this.reconfigure();
    }
    /** 总开关 live 生命周期：OFF→stop，ON→start（不刷新页面）。 */
    reconfigure() {
        const enabled = this.getRuntimeService("settings").snapshot().autoPage !== "no";
        if (enabled) return this.start();
        return this.stop();
    }
    start() {
        if (this.started) return this.waterfallPromise || (this.waterfallPromise = this.waterfall().finally((() => { this.waterfallPromise = null; })));
        this.started = true;
        this.liveScope?.dispose();
        this.liveScope = new LifecycleScope("autopage:live");
        this.generation++;
        this.waterfallPromise = this.waterfall().finally((() => { this.waterfallPromise = null; }));
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
        if (l) {
            const e = o.match(/\/(page|star\/[^/]+)\/(\d+)/);
            return e ? parseInt(e[2], 10) : 1;
        }
        if (r) {
            const e = o.match(/[?&]page=(\d+)/);
            return e ? parseInt(e[1], 10) : 1;
        }
        return 1;
    }
    async waterfall() {
        if (!this.started || !this.liveScope) return;
        if (await this.shouldDisablePaging()) return;
        if (!this.started || !this.liveScope || this.liveScope.disposed) return;
        const scope = this.liveScope;
        const e = this.getSelector();
        const container = /** @type {HTMLElement | null} */ (document.querySelector(e.boxSelector));
        if (!container || !container.parentNode) return void clog.error("没有找到容器节点,停止瀑布流!");
        this.container = container;
        const loader = document.createElement("div");
        this.loader = loader, loader.className = "jhs-scroll",
        container.parentNode.insertBefore(loader, container.nextSibling),
        this.pageItems.push({
            page: this.currentPage,
            top: 0,
            url: window.location.href
        }), loader.addEventListener("click", (() => {
            loader.classList.contains("waterfall-error") && void this.loadNextPage().catch((error => clog.error("瀑布流重试失败", error)));
        })), (() => {
            let t = !1;
            scope.listen(window, "scroll", (() => {
                t || (t = !0, requestAnimationFrame((() => {
                    this.checkLoad(), this.checkScrollPosition(), t = !1;
                })));
            }));
        })();
        const t = /** @type {HTMLAnchorElement | null} */ (document.querySelector(e.nextPageSelector));
        this.nextUrl = t?.href ?? null, this.hasMore = !!this.nextUrl, scope.ownTimeout(setTimeout((() => {
            this.checkLoad();
        }), 1e3)), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
    }
    async loadNextPage() {
        var e;
        if (!this.started) return;
        if (this.getRuntimeService("settings").snapshot().autoPage === "no") return void this.setState("waterfall-loading", "");
        if (this.isLoading || !this.nextUrl || !this.container) return;
        this.isLoading = !0, this.setState("waterfall-loading", "加载中...");
        const t = this.getSelector(), generation = this.generation, scope = this.liveScope;
        try {
            if (!scope || scope.disposed || generation !== this.generation) return;
            const i = await requestHostPage(this.getRuntimeService("http"), this.nextUrl, scope);
            if (!this.started || !this.liveScope || this.liveScope.disposed || generation !== this.generation) return;
            clog.log("请求下一页内容:", this.nextUrl);
            const s = utils.htmlTo$dom(i);
            l && s.find(".avatar-box").length > 0 && s.find(".avatar-box").parent().remove();
            let c = s.find(this.getSelector().requestDomItemSelector);
            const d = this.getBoxCarInfoList(), h = this.getBoxCarInfoList(c);
            if (this.checkDuplicateCarNumbers(d, h)) return this.nextUrl = null, this.hasMore = !1,
            void this.setState("waterfall-error", "翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流");
            if (!this.started || !this.liveScope || this.liveScope.disposed || generation !== this.generation) return;
            const g = this.container.scrollHeight;
            this.pageItems.push({
                page: this.currentPage + 1,
                top: g,
                url: this.nextUrl
            });
            const p = this.getOptionalDependency("ListPagePlugin");
            if (!p) return void this.setState("waterfall-error", "列表功能已禁用，无法继续翻页");
            let m = s.find(this.getSelector().coverImgSelector);
            p.replaceHdImg(m), $(this.getSelector().boxSelector).append(c), this.nextUrl = null == (e = s.find(t.nextPageSelector)) ? void 0 : e.attr("href"),
            this.hasMore = !!this.nextUrl;
            let u = s.find(".pagination");
            $(".pagination").replaceWith(u), this.setState("waterfall-loading", ""), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
        } catch (n) {
            this.started && this.loader && this.setState("waterfall-error", "加载失败，点击重试"), clog.error("加载失败:", n);
        } finally {
            this.isLoading = !1;
        }
    }
    checkScrollPosition() {
        const e = window.scrollY;
        for (let t = this.pageItems.length - 1; t >= 0; t--) {
            const n = this.pageItems[t];
            if (e >= n.top) {
                this.currentPage !== n.page && (this.currentPage = n.page, this.updatePageUrl(n.url));
                break;
            }
        }
    }
    checkLoad() {
        if (!this.loader) return;
        this.loader.getBoundingClientRect().top < window.innerHeight + this.preloadDistance && void this.loadNextPage().catch((error => clog.error("瀑布流自动加载失败", error)));
    }
    async shouldDisablePaging() {
        if (!window.isListPage) return !0;
        const enabled = this.getRuntimeService("settings").snapshot().autoPage;
        return enabled === "no" || [ "search?q", "handlePlayback=1", "handleTop=1", "/want_watch_videos", "/watched_videos", "/advanced_search?type=100" ].some((e => o.includes(e)));
    }
    updatePageUrl(/** @type {string} */ e) {
        window.history.replaceState({}, "", e), l && (document.title = document.title.replace(/第\d+頁/, `第${this.currentPage}頁`));
    }
    setState(/** @type {string} */ e, /** @type {string} */ t) {
        if (!this.loader) return;
        this.loader.className = `jhs-scroll ${e}`, this.loader.textContent = t;
    }
}
