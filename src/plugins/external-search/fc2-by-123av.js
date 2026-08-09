class Oe extends X {
    constructor() {
        super(...arguments), i(this, "$contentBox", $(".section .container")), i(this, "urlParams", new URLSearchParams(window.location.search)),
        i(this, "sortVal", this.urlParams.get("sort") || "release_date"), i(this, "currentPage", this.urlParams.get("page") ? parseInt(this.urlParams.get("page")) : 1),
        i(this, "maxPage", null), i(this, "keyword", this.urlParams.get("keyword") || null);
    }
    getName() {
        return "Fc2By123AvPlugin";
    }
    async getBaseUrl() {
        const e = this.getBean("OtherSitePlugin");
        return await e.getAv123Url() + "/ja";
    }
    handle() {
        $("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)").after('<a class="navbar-item" href="/advanced_search?type=100&released_start=2099-09">123Av-Fc2</a>'),
        $('.tabs li:contains("FC2")').after('<li><a href="/advanced_search?type=100&released_start=2099-09"><span>123Av-Fc2</span></a></li>'),
        o.includes("/advanced_search?type=100") && (this.hookPage(), this.handleQuery().then());
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("123Av"), e.css("marginBottom", "0"), e.append('\n            <div style="margin-left: 100px; width: 400px;">\n                <input id="search-123av-keyword" type="text" placeholder="搜索123Av Fc2ppv内容" style="padding: 4px 5px;margin-right: 0">\n                <a id="search-123av-btn" class="a-primary" style="margin-left: 0">搜索</a>\n                <a id="clear-123av-btn" class="a-info" style="margin-left: 0">重置</a>\n            </div>\n        '),
        $("#search-123av-keyword").val(this.keyword), $("#search-123av-btn").on("click", (async () => {
            let e = $("#search-123av-keyword").val().trim();
            e && (this.keyword = e, utils.setHrefParam("keyword", e), await this.handleQuery());
        })), $("#clear-123av-btn").on("click", (async () => {
            $("#search-123av-keyword").val(""), this.keyword = "", utils.setHrefParam("keyword", ""),
            $(".page-box").show(), $(".tool-box").show(), await this.handleQuery();
        })), $(".empty-message").remove(), $("#foldCategoryBtn").remove(), $(".section .container .box").remove(),
        $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="page-box"></div>');
        $(".tool-box").append('\n            <div class="button-group">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="release_date">发布日期</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="recent_update">最近更新</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="trending">热门</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed_today">今天最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed_week">本周最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed_month">本月最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_viewed">最多观看</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-sort="most_favourited">最受欢迎</a>\n                </div>\n            </div>\n        '),
        $(`#conditionBox a[data-sort="${this.sortVal}"]`).addClass("is-info"), utils.setHrefParam("sort", this.sortVal),
        utils.setHrefParam("page", this.currentPage), $("#conditionBox").on("click", "a.button", (e => {
            let t = $(e.target);
            this.sortVal = t.data("sort"), utils.setHrefParam("sort", this.sortVal), t.siblings().removeClass("is-info"),
            t.addClass("is-info"), this.handleQuery();
        }));
        $(".page-box").append('\n            <nav class="pagination">\n                <a class="pagination-previous">上一页</a>\n                <ul class="pagination-list"></ul>\n                <a class="pagination-next">下一页</a>\n            </nav>\n        '),
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
        t > 1 && (e.append('<li><a class="pagination-link" data-page="1">1</a></li>'), t > 2 && e.append('<li><span class="pagination-ellipsis">…</span></li>'));
        for (let a = t; a <= n; a++) {
            const t = a === this.currentPage ? " is-current" : "";
            e.append(`<li><a class="pagination-link${t}" data-page="${a}">${a}</a></li>`);
        }
        n < this.maxPage && (n < this.maxPage - 1 && e.append('<li><span class="pagination-ellipsis">…</span></li>'),
        e.append(`<li><a class="pagination-link" data-page="${this.maxPage}">${this.maxPage}</a></li>`));
    }
    async handleQuery() {
        let e = loading();
        try {
            let e = [];
            e = 1 === this.currentPage ? [ 1, 2 ] : [ 2 * this.currentPage - 1, 2 * this.currentPage ],
            this.keyword && (e = [ 1 ], $(".page-box").hide(), $(".tool-box").hide());
            const t = await this.getBaseUrl(), n = e.map((e => {
                let n = `${t}/tags/fc2?sort=${this.sortVal}&page=${e}`;
                return this.keyword && (n = `${t}/search?keyword=${this.keyword}`), gmHttp.get(n);
            })), a = await Promise.all(n);
            let i = [];
            for (const o of a) {
                let e = $(o);
                if (e.find(".box-item").each(((e, n) => {
                    const a = $(n), s = a.find("img").attr("data-src");
                    let o = a.find("img").attr("title");
                    const r = a.find(".detail a"), l = r.attr("href"), c = t + (l.startsWith("/") ? l : "/" + l), d = r.text().trim().replace(o + " - ", "");
                    o = o.replace("FC2-PPV", "FC2"), i.push({
                        imgSrc: s,
                        carNum: o,
                        href: c,
                        title: d
                    });
                })), !this.maxPage) {
                    let t, n = e.find(".page-item:not(.disabled)").last();
                    if (n.find("a.page-link").length) {
                        let e = n.find("a.page-link").attr("href");
                        t = parseInt(e.split("page=")[1]);
                    } else t = parseInt(n.find("span.page-link").text());
                    this.maxPage = Math.ceil(t / 2), this.renderPagination();
                }
            }
            if (0 === i.length) {
                clog.log(i), show.error("无结果");
                let e = `${t}/dm4/tags/fc2?sort=${this.sortVal}`;
                this.keyword && (e = `${t}/search?keyword=${this.keyword}`), console.error("获取数据失败!", e);
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
        await storageManager.getSetting("enableLoadOtherSite", _) === _ && (n = '<div class="movie-panel-info fc2-movie-panel-info" style="margin-top:20px"><strong>第三方站点: </strong></div>');
        let a = `\n            <div class="movie-detail-container">\n               \x3c!-- <div class="movie-poster-container">\n                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>\n                </div>\n                <div class="right-box">--\x3e\n                    <div class="movie-info-container">\n                        <div class="search-loading">加载中...</div>\n                    </div>\n                    \n                    ${n}\n                    \n                    <div style="margin: 10px 0">\n                        <a id="filterBtn" class="menu-btn" style="background-color:${f}"><span>${m}</span></a>\n                        <a id="favoriteBtn" class="menu-btn" style="background-color:${w}"><span>${v}</span></a>\n                        <a id="hasDownBtn" class="menu-btn" style="background-color:${x}"><span>${y}</span></a>\n                        <a id="hasWatchBtn" class="menu-btn" style="background-color:${S};"><span>${k}</span></a>\n                        \n                        <a id="search-subtitle-btn" class="menu-btn fr-btn" style="background:linear-gradient(to bottom, #8d5656, rgb(196,159,91))">\n                            <span>字幕 (SubTitleCat)</span>\n                        </a>\n                        <a id="xunLeiSubtitleBtn" class="menu-btn fr-btn" style="background:linear-gradient(to left, #375f7c, #2196F3)">\n                            <span>字幕 (迅雷)</span>\n                        </a>\n                    </div>\n                    <div class="message video-panel" style="margin-top:20px">\n                        <div id="magnets-content" class="magnet-links">\n                        </div>\n                    </div>\n                    <div id="reviews-content">\n                    </div>\n                    <div id="related-content">\n                    </div>\n                    <span id="data-actress" style="display: none"></span>\n               \x3c!-- </div>--\x3e\n            </div>\n        `;
        layer.open({
            type: 1,
            title: e,
            content: a,
            area: utils.getResponsiveArea(),
            skin: "movie-detail-layer",
            scrollbar: !1,
            success: (n, a) => {
                utils.setupEscClose(a), this.loadData(e, t);
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
            const {id: n, publishDate: a, title: i, moviePoster: s} = await this.get123AvVideoInfo(t);
            $(".movie-info-container").html(`\n                    <h3 class="movie-title" style="margin-bottom: 10px"><strong class="current-title">${escapeHtml(i || "无标题")}</strong></h3>\n                    <div class="movie-meta" style="margin-bottom: 10px">\n                        <span><strong>番号: </strong>${e || "未知"}</span>\n                        <span><strong>年份: </strong>${a || "未知"}</span>\n                        <span>\n                            <strong>站点: </strong>\n                            <a href="https://fc2ppvdb.com/articles/${e.replace("FC2-", "")}" target="_blank">fc2ppvdb</a>\n                            <a style="margin-left: 5px;" href="https://adult.contents.fc2.com/article/${e.replace("FC2-", "")}/" target="_blank">fc2电子市场</a>\n                        </span>\n                    </div>\n                    <div class="movie-actors" style="margin-bottom: 10px">\n                        <div class="actor-list"><strong>主演: </strong></div>\n                    </div>\n                    <div class="movie-seller" style="margin-bottom: 10px">\n                        <span><strong>販売者: </strong></span>\n                    </div>\n                    <div class="movie-gallery" style="margin-bottom: 10px">\n                        <strong>剧照: </strong>\n                        <div class="image-list"></div>\n                    </div>\n                    \n                    <div id="data-publishTime" style="display: none">${a || ""}</div>\n\n                `),
            this.getImgList(e).then(), this.getActressInfo(e).then(), this.getBean("TranslatePlugin").translate(e, !1).then();
        } catch (a) {
            console.error(a);
        } finally {
            n.close();
        }
    }
    handleLongImg(e) {
        utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
            $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container" style="overflow:hidden;max-height: 150px;max-width:150px; text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> ');
            const t = await this.getBean("ScreenShotPlugin").getScreenshot(e);
            t && ($(".screen-container").html(`<img src="${t}" alt="" loading="lazy" style="width: 100%;">`),
            $(".screen-container").on("click", (e => {
                e.stopPropagation(), e.preventDefault(), showImageViewer(e.currentTarget);
            })));
        }));
    }
    async get123AvVideoInfo(e) {
        const t = await gmHttp.get(e), n = t.match(/v-scope="Movie\({id:\s*(\d+),/), a = n ? n[1] : null, i = utils.htmlTo$dom(t);
        return {
            id: a,
            publishDate: i.find('span:contains("リリース日:")').next("span").text(),
            title: i.find("h1").text().trim(),
            moviePoster: i.find("#player").attr("data-poster")
        };
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
            t += `\n                <div class="item">\n                    <a href="${e.href}" class="box" title="${e.title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${e.imgSrc.replace("/s360", "")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${e.carNum}</strong> ${e.title}</div>\n                        <div class="score">\n                        </div>\n                        <div class="meta">\n                        </div>\n                        <div class="tags has-addons">\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
