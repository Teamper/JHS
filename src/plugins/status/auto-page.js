class Be extends X {
    constructor() {
        super(...arguments), i(this, "preloadDistance", 500), i(this, "currentPage", this.getInitialPageNumber()),
        i(this, "pageItems", []);
    }
    getName() {
        return "AutoPagePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .jhs-scroll {\n                    text-align: center;\n                    padding-top: 20px;\n                    font-size: 14px;\n                }\n                .jhs-scroll.waterfall-loading { color: var(--jhs-text); }\n                .jhs-scroll.waterfall-error { color: var(--jhs-status-filter); cursor: pointer; }\n                .jhs-scroll.waterfall-no-more { color: var(--jhs-status-down); }\n            </style>\n        ";
    }
    async handle() {
        this.waterfall().then();
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
        if (await this.shouldDisablePaging()) return;
        const e = this.getSelector();
        if (this.container = document.querySelector(e.boxSelector), !this.container) return void console.error("没有找到容器节点,停止瀑布流!");
        this.loader = document.createElement("div"), this.loader.className = "jhs-scroll",
        this.container.parentNode.insertBefore(this.loader, this.container.nextSibling),
        this.pageItems.push({
            page: this.currentPage,
            top: 0,
            url: window.location.href
        }), this.loader.addEventListener("click", (() => {
            this.loader.classList.contains("waterfall-error") && this.loadNextPage().then();
        })), (() => {
            let t = !1;
            window.addEventListener("scroll", (() => {
                t || (t = !0, requestAnimationFrame((() => {
                    this.checkLoad(), this.checkScrollPosition(), t = !1;
                })));
            }));
        })();
        const t = document.querySelector(e.nextPageSelector);
        this.nextUrl = null == t ? void 0 : t.href, this.hasMore = !!this.nextUrl, setTimeout((() => {
            this.checkLoad();
        }), 1e3), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
    }
    async loadNextPage() {
        var e;
        if (await storageManager.getSetting("autoPage", _) === C) return void this.setState("waterfall-loading", "");
        if (this.isLoading || !this.nextUrl) return;
        this.isLoading = !0, this.setState("waterfall-loading", "加载中...");
        const t = this.getSelector();
        try {
            const i = await gmHttp.get(this.nextUrl);
            clog.log("请求下一页内容:", this.nextUrl);
            const s = utils.htmlTo$dom(i);
            l && s.find(".avatar-box").length > 0 && s.find(".avatar-box").parent().remove();
            let c = s.find(this.getSelector().requestDomItemSelector);
            const d = this.getBoxCarInfoList(), h = this.getBoxCarInfoList(c);
            if (this.checkDuplicateCarNumbers(d, h)) return this.nextUrl = null, this.hasMore = !1,
            void this.setState("waterfall-error", "翻页内容出现重复数据, 页码受JavDB限制, 已停止瀑布流");
            const g = this.container.scrollHeight;
            this.pageItems.push({
                page: this.currentPage + 1,
                top: g,
                url: this.nextUrl
            });
            const p = this.getBean("ListPagePlugin");
            let m = s.find(this.getSelector().coverImgSelector);
            p.replaceHdImg(m), $(this.getSelector().boxSelector).append(c), this.nextUrl = null == (e = s.find(t.nextPageSelector)) ? void 0 : e.attr("href"),
            this.hasMore = !!this.nextUrl;
            let u = s.find(".pagination");
            $(".pagination").replaceWith(u), this.setState("waterfall-loading", ""), this.hasMore || this.setState("waterfall-no-more", "已经到底了");
        } catch (n) {
            clog.error("加载失败:", n), this.setState("waterfall-error", "加载失败，点击重试");
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
        this.loader.getBoundingClientRect().top < window.innerHeight + this.preloadDistance && this.loadNextPage().then();
    }
    async shouldDisablePaging() {
        if (!window.isListPage) return !0;
        return await storageManager.getSetting("autoPage", _), [ "search?q", "handlePlayback=1", "handleTop=1", "/want_watch_videos", "/watched_videos", "/advanced_search?type=100" ].some((e => o.includes(e)));
    }
    updatePageUrl(e) {
        window.history.replaceState({}, "", e), l && (document.title = document.title.replace(/第\d+頁/, `第${this.currentPage}頁`));
    }
    setState(e, t) {
        this.loader.className = `jhs-scroll ${e}`, this.loader.textContent = t;
    }
}
