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
    async handle() {
        $("#navbar-menu-hero > div > div:nth-child(1) > div > a:nth-child(4)").after('<a class="navbar-item" href="/advanced_search?type=100&released_start=2099-09">123Av-Fc2</a>'),
        $('.tabs li:contains("FC2")').after('<li><a href="/advanced_search?type=100&released_start=2099-09"><span>123Av-Fc2</span></a></li>'),
        o.includes("/advanced_search?type=100") && (this.hookPage(), await this.handleQuery());
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
                clog.error("获取数据失败!", e);
            }
            let s = this.markDataListHtml(i);
            $(".movie-list").html(s), await utils.smoothScrollToTop();
        } catch (t) {
            clog.error(t);
        } finally {
            e.close();
        }
    }
    async open123AvFc2Dialog(carNum, url) { return this.getBean("Fc2Plugin").openFc2Dialog(null, carNum, url, { source: "123av" }); }
    /** 将 123AV 数据填入 Fc2Plugin 创建的固定工作区。 */
    async loadDetail(context, url) {
        const infoPromise = this.loadSummary(context, url), imagesPromise = this.getImgList(context.carNum), actressPromise = this.getActressInfo(context.carNum), movieIdPromise = resolveJavDbMovieId(context.carNum), fc2Plugin = this.getBean("Fc2Plugin");
        void fc2Plugin.configureJavDbWantButton(context, movieIdPromise), void fc2Plugin.mountPanels(context, movieIdPromise), void movieIdPromise.then((movieId => context.isAlive() && fc2Plugin.fetchAndRenderNativeMagnets(context, movieId))).catch((error => {
            context.isAlive() && fc2Plugin.setState(context.root.find('[data-jhs-role="native-magnets"]'), "站内磁力关联失败", (() => void this.retryResolvedMagnets(context))), clog.error("123AV 磁力关联失败", error);
        }));
        imagesPromise.then((images => context.isAlive() && this.getBean("Fc2Plugin").renderGallery(context, images))).catch((error => context.isAlive() && this.getBean("Fc2Plugin").setState(context.root.find('[data-jhs-role="gallery-grid"]'), "剧照加载失败", (() => void this.reloadImages(context)))));
        actressPromise.then((async data => {
            await infoPromise.catch((() => null));
            context.isAlive() && this.render123AvActress(context, data);
        })).catch((error => clog.error("FC2 演员信息加载失败", error)));
        await Promise.allSettled([ infoPromise, imagesPromise, actressPromise, movieIdPromise ]);
    }
    async loadSummary(context, url) {
        try {
            const info = await this.get123AvVideoInfo(url);
            if (!context.isAlive()) return null;
            this.render123AvSummary(context, info), await this.getBean("TranslatePlugin").translate(context.carNum, !1, { root: context.root });
            return info;
        } catch (error) {
            context.isAlive() && this.getBean("Fc2Plugin").setState(context.root.find('[data-jhs-role="summary-content"]'), "影片信息加载失败", (() => void this.loadSummary(context, url))), clog.error("123AV 详情加载失败", error);
            throw error;
        }
    }
    async retryResolvedMagnets(context) {
        try { return await this.getBean("Fc2Plugin").fetchAndRenderNativeMagnets(context, await resolveJavDbMovieId(context.carNum)); } catch (error) { context.isAlive() && this.getBean("Fc2Plugin").setState(context.root.find('[data-jhs-role="native-magnets"]'), "站内磁力关联失败", (() => void this.retryResolvedMagnets(context))); }
    }
    render123AvSummary(context, info) {
        const body = context.root.find('[data-jhs-role="summary-content"]').empty(), title = $('<h1 class="jhs-fc2-title"><strong class="current-title"></strong></h1>');
        title.find("strong").text(info.title || "无标题"), body.append(title, $('<div class="jhs-fc2-meta"></div>').append($("<span></span>").text(`番号：${context.carNum}`), $("<span></span>").text(`发行：${info.publishDate || "未知"}`)), '<div class="jhs-fc2-actors" data-jhs-role="actors"><strong>主演：</strong><span>正在加载演员…</span></div>', '<div class="jhs-fc2-meta" data-jhs-role="seller"></div>', this.getBean("Fc2Plugin").createSourceLinks(context), $('<span class="jhs-is-hidden" data-jhs-role="publish-time"></span>').text(info.publishDate || ""));
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
        if (0 === i.length || i.length > 1) return { actors: [], seller: null };
        const s = $(i[0]).find("a");
        const actors = [];
        if (s.length > 0) {
            s.each(((t, n) => {
                const link = $(n), name = link.text().trim(), url = normalizeHttpUrl(link.attr("href"), "https://fc2ppvdb.com");
                name && actors.push({ name, url });
            }));
        }
        const r = a.find("div").filter((function() {
            return 0 === $(this).text().trim().indexOf("販売者：");
        }));
        let seller = null;
        if (r.length > 0) {
            const link = $(r[0]).find("a").first();
            link.length && (seller = { name: link.text().trim(), url: normalizeHttpUrl(link.attr("href"), "https://fc2ppvdb.com") });
        }
        return { actors, seller };
    }
    async getImgList(e) {
        let t = e.replace("FC2-", ""), n = `https://adult.contents.fc2.com/article/${e.replace("FC2-", "")}/`;
        const a = await gmHttp.get(n, null, {
            referer: n
        });
        return $(a).find(".items_article_SampleImagesArea img").map((function() {
            return normalizeHttpUrl($(this).attr("src"), n);
        })).get().filter(Boolean);
    }
    async reloadImages(context) {
        try {
            const images = await this.getImgList(context.carNum);
            context.isAlive() && this.getBean("Fc2Plugin").renderGallery(context, images);
        } catch (error) {
            context.isAlive() && this.getBean("Fc2Plugin").setState(context.root.find('[data-jhs-role="gallery-grid"]'), "剧照加载失败", (() => void this.reloadImages(context)));
        }
    }
    render123AvActress(context, data) {
        const host = context.root.find('[data-jhs-role="actors"]').empty().append("<strong>主演：</strong>");
        data.actors.length ? data.actors.forEach((actor => host.append($("<a></a>").addClass("jhs-fc2-actor").attr({ href: actor.url, target: "_blank", rel: "noopener noreferrer" }).text(actor.name)))) : host.append($("<span></span>").text("暂无演员信息"));
        context.root.find('[data-jhs-role="actress-data"]').remove(), context.root.find(".jhs-fc2-summary__body").append($('<span class="jhs-is-hidden" data-jhs-role="actress-data"></span>').text(data.actors.map((actor => actor.name)).join(" ")));
        if (data.seller) context.root.find('[data-jhs-role="seller"]').empty().append("卖家：", data.seller.url ? $("<a></a>").attr({ href: data.seller.url, target: "_blank", rel: "noopener noreferrer" }).text(data.seller.name) : document.createTextNode(data.seller.name));
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach((e => {
            const href = normalizeHttpUrl(e.href, "https://123av.com"), imageUrl = normalizeHttpUrl(e.imgSrc, "https://123av.com");
            if (!href) return;
            t += `\n                <div class="item" data-jhs-fc2-source="123av">\n                    <a href="${escapeHtml(href)}" class="box" title="${escapeHtml(e.title)}">\n                        <div class="cover ">${imageUrl ? `<img loading="lazy" src="${escapeHtml(imageUrl)}" alt="">` : ""}</div>\n                        <div class="video-title"><strong>${escapeHtml(e.carNum)}</strong> ${escapeHtml(e.title)}</div>\n                        <div class="score"></div><div class="meta"></div><div class="jhs-toolbar"></div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
