const AV123_REQUEST_OPTIONS = Object.freeze({ cookiePartitionTopLevelSite: "https://123av.com" });

class Fc2By123AvPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "$contentBox", $(".section .container")), i(this, "urlParams", new URLSearchParams(window.location.search)),
        i(this, "currentPage", this.urlParams.get("page") ? parseInt(this.urlParams.get("page")) : 1),
        i(this, "maxPage", null), i(this, "keyword", this.urlParams.get("keyword") || null);
    }
    getName() {
        return "Fc2By123AvPlugin";
    }
    async getBaseUrl() {
        return await this.getBean("OtherSitePlugin").getAv123Url();
    }
    request123Av(e, requestOptions = {}) {
        return gmHttp.get(e, {}, {}, !1, { ...AV123_REQUEST_OPTIONS, ...requestOptions });
    }
    handle() {
        $("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)").after('<a class="navbar-item" href="/advanced_search?type=100&released_start=2099-09">123Av-Fc2</a>'),
        $('.tabs li:contains("FC2")').after('<li><a href="/advanced_search?type=100&released_start=2099-09"><span>123Av-Fc2</span></a></li>'),
        o.includes("/advanced_search?type=100") && (this.hookPage(), this.handleQuery().then());
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("123Av"), e.css("marginBottom", "0"), e.append('\n            <div class="jhs-layout-f5f47b30">\n                <input id="search-123av-keyword" type="text" placeholder="搜索123Av Fc2ppv内容" class="jhs-field">\n                <button type="button" id="search-123av-btn" class="jhs-btn jhs-btn--primary jhs-layout-21a4fe43">搜索</button>\n                <button type="button" id="clear-123av-btn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n            </div>\n        '),
        $("#search-123av-keyword").val(this.keyword), $("#search-123av-btn").on("click", (async () => {
            let e = $("#search-123av-keyword").val().trim();
            e && (this.keyword = e, utils.setHrefParam("keyword", e), await this.handleQuery());
        })), $("#clear-123av-btn").on("click", (async () => {
            $("#search-123av-keyword").val(""), this.keyword = "", utils.setHrefParam("keyword", ""),
            $(".page-box").show(), await this.handleQuery();
        })), $(".empty-message").remove(), $("#foldCategoryBtn").remove(), $(".section .container .box").remove(),
        $("#sort-toggle-btn").remove(),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-layout-d2c171b1"></div>'),
        this.$contentBox.append('<div class="page-box"></div>');
        utils.setHrefParam("page", this.currentPage);
        $(".page-box").append('\n            <nav class="pagination">\n                <button type="button" class="jhs-btn pagination-previous">上一页</button>\n                <ul class="pagination-list"></ul>\n                <button type="button" class="jhs-btn pagination-next">下一页</button>\n            </nav>\n        '),
        $(document).on("click", ".pagination-link", (e => {
            e.preventDefault(), this.currentPage = parseInt($(e.target).data("page")), utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery();
        })), $(".pagination-previous").on("click", (e => {
            e.preventDefault(), this.currentPage > 1 && (this.currentPage--, utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery());
        })), $(".pagination-next").on("click", (e => {
            e.preventDefault(), this.currentPage < this.maxPage && (this.currentPage++, utils.setHrefParam("page", this.currentPage),
            this.renderPagination(), this.handleQuery());
        }));
    }
    renderPagination() {
        const e = $(".pagination-list");
        e.empty();
        let t = Math.max(1, this.currentPage - 2), n = Math.min(this.maxPage, this.currentPage + 2);
        this.currentPage <= 3 ? n = Math.min(6, this.maxPage) : this.currentPage >= this.maxPage - 2 && (t = Math.max(this.maxPage - 5, 1)),
        t > 1 && (e.append('<li><button type="button" class="jhs-btn pagination-link" data-page="1">1</button></li>'), t > 2 && e.append('<li><span class="pagination-ellipsis">…</span></li>'));
        for (let a = t; a <= n; a++) {
            const t = a === this.currentPage ? " is-current" : "";
            e.append(`<li><button type="button" class="jhs-btn pagination-link${t}" data-page="${a}">${a}</button></li>`);
        }
        n < this.maxPage && (n < this.maxPage - 1 && e.append('<li><span class="pagination-ellipsis">…</span></li>'),
        e.append(`<li><button type="button" class="jhs-btn pagination-link" data-page="${this.maxPage}">${this.maxPage}</button></li>`));
    }
    async handleQuery() {
        let e = loading();
        try {
            let e = [ 2 * this.currentPage - 1, 2 * this.currentPage ];
            this.keyword && (e = [ 1 ], $(".page-box").hide());
            const t = await this.getBaseUrl();
            const requests = e.map((sourcePage => this.request123Av(this.keyword
                ? `${t}/cn/search?keyword=${encodeURIComponent(this.keyword)}`
                : `${t}/cn/makers/fc2?page=${sourcePage}`)));
            const pages = (await Promise.all(requests)).map((html => utils.htmlTo$dom(html)));
            const i = merge123AvCards(pages.map(($page => parse123AvCards($page, t))));
            if (!this.keyword && !this.maxPage && pages.length) {
                const sourceMaxPage = parse123AvSourceMaxPage(pages[0], t);
                sourceMaxPage && (this.maxPage = Math.ceil(sourceMaxPage / 2), this.renderPagination());
            }
            if (0 === i.length) {
                clog.log(i), show.error("无结果");
                const e = this.keyword ? `${t}/cn/search?keyword=${encodeURIComponent(this.keyword)}` : `${t}/cn/makers/fc2`;
                console.error("获取数据失败!", e);
            }
            let s = this.markDataListHtml(i);
            $(".movie-list").html(s), await utils.smoothScrollToTop();
        } catch (t) {
            console.error(t);
        } finally {
            e.close();
        }
    }
    async open123AvFc2Dialog(e, t) {
        let n = "";
        await storageManager.getSetting("enableLoadOtherSite", _) === _ && (n = '<div class="movie-panel-info fc2-movie-panel-info jhs-layout-a26bda7d"><strong>第三方站点: </strong></div>');
        let a = `\n            <div class="movie-detail-container">\n               \x3c!-- <div class="movie-poster-container">\n                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>\n                </div>\n                <div class="right-box">--\x3e\n                    <div class="movie-info-container">\n                        <div class="search-loading">加载中...</div>\n                    </div>\n                    \n                    ${n}\n                    \n                    <div class="jhs-layout-f4e719ae">\n                        <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter"><span>${m}</span></button>\n                        <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav"><span>${v}</span></button>\n                        <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down"><span>${y}</span></button>\n                        <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch"><span>${k}</span></button>\n                        \n                        <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent">\n                            <span>字幕 (SubTitleCat)</span>\n                        </button>\n                        <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent">\n                            <span>字幕 (迅雷)</span>\n                        </button>\n                    </div>\n                    <div class="message video-panel jhs-layout-a26bda7d">\n                        <div id="magnets-content" class="magnet-links">\n                        </div>\n                    </div>\n                    <div id="reviews-content">\n                    </div>\n                    <div id="related-content">\n                    </div>\n                    <span id="data-actress" class="jhs-layout-6b99de8b"></span>\n               \x3c!-- </div>--\x3e\n            </div>\n        `;
        layer.open({
            type: 1,
            title: e,
            content: a,
            area: utils.getDialogArea("workspace"),
            skin: "movie-detail-layer",
            scrollbar: !1,
            success: (n, a) => {
                organizeJhsOwnedDetailWorkspace($(n).find(".movie-detail-container")), utils.setupEscClose(a), this.loadData(e, t);
                let i = e.replace("FC2-", "");
                $("#magnets-content").append(this.getBean("MagnetHubPlugin").createMagnetHub(i)),
                $("#favoriteBtn").on("click", (async n => {
                    const a = $("#data-actress").text(), i = $("#data-publishTime").text();
                    await storageManager.saveCar({
                        carNum: e,
                        url: t,
                        names: a,
                        actionType: h,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#filterBtn").on("click", (n => {
                    utils.q(n, `是否屏蔽${e}?`, (async () => {
                        const n = $("#data-actress").text(), a = $("#data-publishTime").text();
                        await storageManager.saveCar({
                            carNum: e,
                            url: t,
                            names: n,
                            actionType: d,
                            publishTime: a
                        }), window.refresh(), layer.closeAll(), window.location.href.includes("collection_codes?movieId") && utils.closePage();
                    }));
                })), $("#hasDownBtn").on("click", (async n => {
                    const a = $("#data-actress").text(), i = $("#data-publishTime").text();
                    await storageManager.saveCar({
                        carNum: e,
                        url: t,
                        names: a,
                        actionType: g,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#hasWatchBtn").on("click", (async n => {
                    const a = $("#data-actress").text(), i = $("#data-publishTime").text();
                    await storageManager.saveCar({
                        carNum: e,
                        url: t,
                        names: a,
                        actionType: p,
                        publishTime: i
                    }), window.refresh(), layer.closeAll();
                })), $("#search-subtitle-btn").on("click", (t => utils.openPage(`https://subtitlecat.com/index.php?search=${e}`, e, !1, t))),
                $("#xunLeiSubtitleBtn").on("click", (() => this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(e)));
                let s = e.replace("FC2-", "");
                this.getBean("OtherSitePlugin").loadOtherSite(s, e).then();
            }
        });
    }
    async loadData(e, t) {
        let n = loading();
        try {
            const {publishDate: a, title: i} = await this.get123AvVideoInfo(t);
            $(".movie-info-container").html(`\n                    <h3 class="movie-title jhs-layout-761d3add"><strong class="current-title">${escapeHtml(i || "无标题")}</strong></h3>\n                    <div class="movie-meta jhs-layout-761d3add">\n                        <span><strong>番号: </strong>${e || "未知"}</span>\n                        <span><strong>年份: </strong>${a || "未知"}</span>\n                        <span>\n                            <strong>站点: </strong>\n                            <a href="https://fc2ppvdb.com/articles/${e.replace("FC2-", "")}" target="_blank">fc2ppvdb</a>\n                            <a href="https://adult.contents.fc2.com/article/${e.replace("FC2-", "")}/" target="_blank" class="jhs-layout-3fed2a7e">fc2电子市场</a>\n                        </span>\n                    </div>\n                    <div class="movie-actors jhs-layout-761d3add">\n                        <div class="actor-list"><strong>主演: </strong></div>\n                    </div>\n                    <div class="movie-seller jhs-layout-761d3add">\n                        <span><strong>販売者: </strong></span>\n                    </div>\n                    <div class="movie-gallery jhs-layout-761d3add">\n                        <strong>剧照: </strong>\n                        <div class="image-list"></div>\n                    </div>\n                    \n                    <div id="data-publishTime" class="jhs-layout-6b99de8b">${a || ""}</div>\n\n                `),
            this.getImgList(e).then(), this.getActressInfo(e).then(), this.getBean("TranslatePlugin").translate(e, !1).then();
        } catch (a) {
            console.error(a);
        } finally {
            n.close();
        }
    }
    handleLongImg(e) {
        utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
            $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container jhs-layout-e5d57abb"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> ');
            const t = await this.getBean("ScreenShotPlugin").getScreenshot(e);
            t && ($(".screen-container").html(`<img src="${t}" alt="" loading="lazy" class="jhs-layout-cad980f4">`),
            $(".screen-container").on("click", (e => {
                e.stopPropagation(), e.preventDefault(), showImageViewer(e.currentTarget);
            })));
        }));
    }
    async get123AvVideoInfo(e) {
        const t = await this.request123Av(e);
        return parse123AvVideoInfo(utils.htmlTo$dom(t), e);
    }
    async getActressInfo(e) {
        let t = `https://fc2ppvdb.com/articles/${e.replace("FC2-", "")}`;
        const n = await gmHttp.get(t), a = $(n), i = a.find("div").filter((function() {
            return 0 === $(this).text().trim().indexOf("女優：");
        }));
        if (0 === i.length || i.length > 1) return void show.error("解析女优信息失败");
        const s = $(i[0]).find("a");
        let o = "<strong>主演: </strong>";
        if (s.length > 0) {
            let e = "";
            s.each(((t, n) => {
                let a = $(n), i = a.text(), s = a.attr("href");
                o += `<span class="actor-tag"><a href="https://fc2ppvdb.com${escapeHtml(s)}" target="_blank">${escapeHtml(i)}</a></span>`,
                e += i + " ";
            })), $("#data-actress").text(e);
        } else o += "<span>暂无演员信息</span>";
        $(".actor-list").html(o);
        const r = a.find("div").filter((function() {
            return 0 === $(this).text().trim().indexOf("販売者：");
        }));
        if (r.length > 0) {
            const e = $(r[0]).find("a");
            if (e.length > 0) {
                const t = $(e[0]);
                let n = t.text(), a = t.attr("href");
                $(".movie-seller").html(`<span><strong>販売者: </strong><a href="https://fc2ppvdb.com${escapeHtml(a)}" target="_blank">${escapeHtml(n)}</a></span>`);
            }
        }
    }
    async getImgList(e) {
        let t = e.replace("FC2-", ""), n = `https://adult.contents.fc2.com/article/${e.replace("FC2-", "")}/`;
        const a = await gmHttp.get(n, null, {
            referer: n
        });
        let i = $(a).find(".items_article_SampleImagesArea img").map((function() {
            return $(this).attr("src");
        })).get(), s = "";
        Array.isArray(i) && i.length > 0 ? s = i.map(((e, t) => `\n                <a href="${e}" data-fancybox="movie-gallery" data-caption="剧照 ${t + 1}">\n                    <img src="${e}" class="movie-image-thumb" loading="lazy" alt=""/>\n                </a>\n            `)).join("") : $(".movie-gallery").html("<h4>剧照: 暂无剧照</h4>"),
        $(".image-list").html(s), this.handleLongImg(t);
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach((e => {
            t += `\n                <div class="item">\n                    <a href="${escapeHtml(e.href)}" class="box" title="${escapeHtml(e.title)}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${escapeHtml(e.imgSrc)}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${escapeHtml(e.carNum)}</strong> ${escapeHtml(e.title)}</div>\n                        <div class="score">\n                        </div>\n                        <div class="meta">\n                        </div>\n                        <div class="tags has-addons">\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
