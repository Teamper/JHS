class ReviewPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "floorIndex", 1), i(this, "isInit", !1), i(this, "$panel", null);
    }
    getName() {
        return "ReviewPlugin";
    }
    async initCss() {
        return `
            <style>
                .jhs-review-panel { min-width:0; }
                .jhs-panel-header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-panel-header h3 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-xl); }
                .jhs-panel-toggle { flex:none; }
                .jhs-review-list { display:grid; }
                .jhs-review-item { min-width:0; padding:var(--jhs-space-4) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
                .jhs-review-item:last-child { border-bottom:0; }
                .jhs-review-meta { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-1) var(--jhs-space-3); color:var(--jhs-text-muted); font-size:14px; }
                .jhs-review-author { color:var(--jhs-text); font-size:15px; font-weight:600; }
                .jhs-review-floor { margin-left:auto; color:var(--jhs-text-faint); }
                .jhs-review-content { margin:var(--jhs-space-3) 0 0; color:var(--jhs-text); font-size:16px; line-height:1.7; overflow-wrap:anywhere; white-space:pre-wrap; }
                .jhs-review-link { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); padding:2px var(--jhs-space-2); border:0; border-radius:var(--jhs-radius-pill); background:var(--jhs-accent-tint); color:var(--jhs-accent); font:inherit; font-size:var(--jhs-font-size-sm); line-height:1.5; text-decoration:none; vertical-align:baseline; cursor:pointer; }
                .jhs-review-link-copy { color:var(--jhs-text-muted); }
                .jhs-review-link-wrap { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-2); width:100%; margin:var(--jhs-space-1) 0; }
                .jhs-review-link-main { display:inline-flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
                .jhs-review-link-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin-left:auto; flex-shrink:0; }
                .jhs-review-offline-btn { background:var(--jhs-accent) !important; color:var(--jhs-accent-text-on) !important; }
                .jhs-panel-state { padding:var(--jhs-space-4) 0; color:var(--jhs-text-muted); text-align:center; }
                .jhs-panel-footer { display:flex; justify-content:center; padding-top:var(--jhs-space-3); }
                .jhs-panel-end { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); }
                @media (max-width:767px) { .jhs-review-floor { width:100%; margin-left:0; } }
            </style>`;
    }
    async handle() {
        if (!window.isDetailPage) return;
        if (r) {
            const movieId = this.parseMovieId(window.location.href);
            await this.showReview(movieId), await this.getBean("RelatedPlugin").showRelated($("#magnets-content"), movieId);
        }
        if (l) {
            const carNumber = this.getPageInfo().carNum;
            if (!carNumber) return void clog.warn("跳过 JavBus 评论解析：番号不可用");
            const movies = await (async value => {
                const url = `${U}/v2/search`, headers = {
                    "user-agent": "Dart/3.5 (dart:io)",
                    "accept-language": "zh-TW",
                    host: "jdforrepam.com",
                    jdsignature: await O()
                }, params = {
                    q: value,
                    page: 1,
                    type: "movie",
                    limit: 1,
                    movie_type: "all",
                    from_recent: "false",
                    movie_filter_by: "all",
                    movie_sort_by: "relevance"
                };
                return (await gmHttp.get(url, params, headers)).data.movies;
            })(carNumber);
            const match = movies.find((movie => movie.number.toLowerCase() === carNumber.toLowerCase()));
            match && await this.showReview(match.id, $("#sample-waterfall"));
        }
    }
    async showReview(movieId, target) {
        const enabled = await storageManager.getSetting("enableLoadReview", _), host = target || $("#magnets-content");
        const panel = $('<section class="jhs-review-panel" data-jhs-panel="reviews"></section>');
        const header = $('<header class="jhs-panel-header"><h3>评论</h3></header>');
        const toggle = $('<button type="button" id="reviewsFold" class="jhs-btn jhs-btn--secondary jhs-panel-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
        header.append(toggle), panel.append(header, '<div id="reviewsContainer" class="jhs-review-list"></div>', '<div id="reviewsFooter" class="jhs-panel-footer"></div>'), host.append(panel), this.$panel = panel;
        this.updateToggle(toggle, enabled === _);
        toggle.on("click", (event => {
            event.preventDefault(), event.stopPropagation();
            const expanded = "展开" === toggle.find(".toggle-text").text();
            this.updateToggle(toggle, expanded), panel.find("#reviewsContainer, #reviewsFooter").toggle(expanded), expanded && !this.isInit && (this.fetchAndDisplayReviews(movieId),
            this.isInit = !0), storageManager.saveSettingItem("enableLoadReview", expanded ? _ : C);
        }));
        enabled === _ ? (await this.fetchAndDisplayReviews(movieId), this.isInit = !0) : panel.find("#reviewsContainer, #reviewsFooter").hide();
    }
    updateToggle(toggle, expanded) {
        toggle.attr("aria-expanded", String(expanded)), toggle.find(".toggle-text").text(expanded ? "折叠" : "展开"),
        toggle.find(".toggle-icon").text(expanded ? "▲" : "▼");
    }
    async fetchAndDisplayReviews(movieId) {
        const container = this.$panel.find("#reviewsContainer"), footer = this.$panel.find("#reviewsFooter");
        container.empty().append($('<div class="jhs-panel-state"></div>').text("获取评论中...")), footer.empty();
        const pageSize = await storageManager.getSetting("reviewCount", 20);
        let reviews;
        try {
            reviews = await R(movieId, 1, pageSize);
        } catch (error) {
            error.toString().includes("簽名已過期") && show.error("生成签名失败, 请检查系统时间及时区是否正确!"), clog.error("获取评论失败:", error),
            clog.error("获取评论失败:", error);
            return void this.renderRetry(container, "获取评论失败", (() => this.fetchAndDisplayReviews(movieId)));
        }
        container.empty();
        if (!reviews.length) return void container.append($('<div class="jhs-panel-state"></div>').text("无评论"));
        const keywords = await storageManager.getReviewFilterKeywordList();
        await this.displayReviews(reviews, container, keywords), reviews.length === pageSize && R(movieId, 2, pageSize).catch((() => {}));
        reviews.length === pageSize ? this.bindLoadMore(movieId, pageSize, keywords, container, footer) : footer.append($('<div class="jhs-panel-end"></div>').text("已加载全部评论"));
    }
    renderRetry(container, message, retry) {
        container.empty();
        const state = $('<div class="jhs-panel-state"></div>').append(document.createTextNode(`${message} `));
        const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry);
        state.append(button), container.append(state);
    }
    bindLoadMore(movieId, pageSize, keywords, container, footer) {
        const button = $('<button type="button" id="loadMoreReviews" class="jhs-btn jhs-btn--secondary">加载更多评论</button>'), end = $('<div id="reviewsEnd" class="jhs-panel-end">已加载全部评论</div>').hide();
        footer.empty().append(button, end);
        let page = 1;
        button.on("click", (async () => {
            button.text("加载中...").prop("disabled", !0), page++;
            try {
                const reviews = await R(movieId, page, pageSize);
                await this.displayReviews(reviews, container, keywords), reviews.length < pageSize ? (button.remove(), end.show()) : button.text("加载更多评论").prop("disabled", !1);
            } catch (error) {
                clog.error("加载更多评论失败:", error), button.text("加载失败，请重试").prop("disabled", !1);
            }
        }));
    }
    async displayReviews(reviews, container, keywords) {
        if (!reviews.length) return;
        const filter = keywords.length > 0 ? new RegExp(keywords.map((value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("|")) : null;
        for (const review of reviews) {
            const content = String(review.content || "");
            if (filter?.test(content)) continue;
            const item = $('<article class="jhs-review-item"></article>'), meta = $('<div class="jhs-review-meta"></div>'), body = $('<div class="review-content jhs-review-content"></div>');
            meta.append($("<span></span>").addClass("jhs-review-author").text(review.username || "匿名用户"));
            const stars = $('<span class="score-stars" aria-label="评分"></span>'), score = Math.max(0, Math.min(5, Number(review.score) || 0));
            for (let index = 0; index < score; index++) stars.append('<i class="icon-star"></i>');
            meta.append(stars, $("<time></time>").text(utils.formatDate(review.created_at)), $("<span></span>").text(`点赞：${Number(review.likes_count) || 0}`),
            $("<span></span>").addClass("jhs-review-floor").text(`#${this.floorIndex++}楼`));
            await this.appendReviewContent(body, content), item.append(meta, body), container.append(item);
        }
        this.rightClickFilter();
    }
    async appendReviewContent(container, content) {
        const linkPattern = /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+/g;
        const enable115Offline = await storageManager.getSetting("enable115Offline", !1);
        let cursor = 0, match;
        while ((match = linkPattern.exec(content))) {
            match.index > cursor && container.append(document.createTextNode(content.slice(cursor, match.index)));
            await this.appendLinkControls(container, match[0], enable115Offline), cursor = match.index + match[0].length;
        }
        cursor < content.length && container.append(document.createTextNode(content.slice(cursor)));
    }
    async appendLinkControls(container, value, enable115Offline) {
        const isEd2k = value.startsWith("ed2k://"), isMagnet = value.startsWith("magnet:"), label = isEd2k ? "ED2K 链接" : isMagnet ? "Magnet 链接" : "打开链接";
        const wrapper = $('<span class="jhs-review-link-wrap"></span>');
        const main = $('<span class="jhs-review-link-main"></span>');
        const open = isEd2k ? $('<button type="button" class="jhs-btn jhs-review-link"></button>').text(label).on("click", (() => utils.copyToClipboard(label, value))) : $("<a></a>").addClass("jhs-review-link").attr({
            href: value,
            target: "_blank",
            rel: "noopener noreferrer"
        }).text(label);
        const copy = $('<button type="button" class="jhs-btn jhs-review-link jhs-review-link-copy">复制</button>').on("click", (() => utils.copyToClipboard(label, value)));
        main.append(open, copy), wrapper.append(main);
        if (isMagnet || isEd2k) {
            const actions = $('<span class="jhs-review-link-actions"></span>');
            enable115Offline && actions.append(`<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn one115-offline-btn" data-magnet="${escapeHtml(value)}">115离线</button>`);
            isMagnet && actions.append(`<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn one23-offline-btn" data-magnet="${escapeHtml(value)}">123离线</button>`);
            wrapper.append(actions);
        }
        container.append(wrapper);
    }
    async rightClickFilter() {
        await storageManager.getSetting("enableTitleSelectFilter", _) === _ && utils.rightClick(document.body, ".review-content", (async event => {
            const text = window.getSelection().toString();
            text && (event.preventDefault(), await utils.q(event, `是否将 '${text}' 加入评论区关键词?`, (async () => {
                await storageManager.saveReviewFilterKeyword(text), show.ok("操作成功, 刷新页面后生效");
            })));
        }));
    }
}
