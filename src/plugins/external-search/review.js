class ReviewPlugin extends BasePlugin {
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
                .jhs-review-inline-controls { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); }
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
            const workspace = this.getBean("DetailWorkspacePlugin");
            await Promise.all([ this.showReview(movieId, workspace?.getSlot("reviews")), this.getBean("RelatedPlugin").showRelated(workspace?.getSlot("related"), movieId) ]);
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
            match && await this.showReview(match.id, this.getBean("DetailWorkspacePlugin")?.getSlot("reviews"));
        }
    }
    async showReview(movieId, target) {
        const enabled = await storageManager.getSetting("enableLoadReview", _), host = target?.length ? target : this.getBean("DetailWorkspacePlugin")?.getSlot("reviews") || $("#magnets-content");
        const existing = host.children('[data-jhs-panel="reviews"]').filter(((_, element) => $(element).attr("data-jhs-movie-id") === String(movieId))).first();
        if (existing.length) return existing;
        const panel = $('<section class="jhs-review-panel" data-jhs-panel="reviews"></section>').attr("data-jhs-movie-id", String(movieId));
        const header = $('<header class="jhs-panel-header"><h3>评论</h3></header>');
        const toggle = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-review-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
        const state = { movieId, panel, floorIndex: 1, loaded: !1, loading: !1, page: 1 };
        header.append(toggle), panel.append(header, '<div class="jhs-review-list jhs-review-container"></div>', '<div class="jhs-panel-footer jhs-review-footer"></div>'), host.append(panel), this.bindRightClickFilter();
        this.updateToggle(toggle, enabled === _);
        toggle.on("click", (event => {
            event.preventDefault(), event.stopPropagation();
            const expanded = "展开" === toggle.find(".toggle-text").text();
            this.updateToggle(toggle, expanded), panel.find(".jhs-review-container, .jhs-review-footer").toggle(expanded), expanded && !state.loaded && !state.loading && void this.fetchAndDisplayReviews(state), storageManager.saveSettingItem("enableLoadReview", expanded ? _ : C);
        }));
        enabled === _ ? await this.fetchAndDisplayReviews(state) : panel.find(".jhs-review-container, .jhs-review-footer").hide();
        return panel;
    }
    updateToggle(toggle, expanded) {
        toggle.attr("aria-expanded", String(expanded)), toggle.find(".toggle-text").text(expanded ? "折叠" : "展开"),
        toggle.find(".toggle-icon").text(expanded ? "▲" : "▼");
    }
    async fetchAndDisplayReviews(state) {
        if (state.loading) return;
        state.loading = !0;
        const { movieId, panel } = state, container = panel.find(".jhs-review-container"), footer = panel.find(".jhs-review-footer");
        container.empty().append($('<div class="jhs-panel-state"></div>').text("获取评论中...")), footer.empty();
        const pageSize = await storageManager.getSetting("reviewCount", 20);
        let reviews;
        try {
            reviews = await R(movieId, 1, pageSize);
        } catch (error) {
            error.toString().includes("簽名已過期") && show.error("生成签名失败, 请检查系统时间及时区是否正确!"), clog.error("获取评论失败:", error),
            clog.error("获取评论失败:", error);
            state.loading = !1;
            return void this.renderRetry(container, "获取评论失败", (() => this.fetchAndDisplayReviews(state)));
        }
        state.loading = !1, state.loaded = !0;
        container.empty();
        if (!reviews.length) return void container.append($('<div class="jhs-panel-state"></div>').text("无评论"));
        const keywords = await storageManager.getReviewFilterKeywordList();
        await this.displayReviews(state, reviews, container, keywords), reviews.length === pageSize && R(movieId, 2, pageSize).catch((() => {}));
        reviews.length === pageSize ? this.bindLoadMore(state, pageSize, keywords, container, footer) : footer.append($('<div class="jhs-panel-end"></div>').text("已加载全部评论"));
    }
    renderRetry(container, message, retry) {
        container.empty();
        const state = $('<div class="jhs-panel-state"></div>').append(document.createTextNode(`${message} `));
        const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry);
        state.append(button), container.append(state);
    }
    bindLoadMore(state, pageSize, keywords, container, footer) {
        const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-review-load-more">加载更多评论</button>'), end = $('<div class="jhs-panel-end jhs-review-end">已加载全部评论</div>').hide();
        footer.empty().append(button, end);
        button.on("click", (async () => {
            button.text("加载中...").prop("disabled", !0), state.page++;
            try {
                const reviews = await R(state.movieId, state.page, pageSize);
                await this.displayReviews(state, reviews, container, keywords), reviews.length < pageSize ? (button.remove(), end.show()) : button.text("加载更多评论").prop("disabled", !1);
            } catch (error) {
                clog.error("加载更多评论失败:", error), button.text("加载失败，请重试").prop("disabled", !1);
            }
        }));
    }
    async displayReviews(state, reviews, container, keywords) {
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
            $("<span></span>").addClass("jhs-review-floor").text(`#${state.floorIndex++}楼`));
            await this.appendReviewContent(body, content), item.append(meta, body), container.append(item);
        }
    }
    appendReviewContent(container, content) {
        const linkPattern = /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+/g;
        let cursor = 0, match;
        while ((match = linkPattern.exec(content))) {
            match.index > cursor && container.append(document.createTextNode(content.slice(cursor, match.index)));
            this.appendLinkControls(container, match[0]), cursor = match.index + match[0].length;
        }
        cursor < content.length && container.append(document.createTextNode(content.slice(cursor)));
    }
    appendLinkControls(container, value) {
        const isEd2k = value.startsWith("ed2k://"), isMagnet = value.startsWith("magnet:"), label = isEd2k ? "ED2K 链接" : isMagnet ? "Magnet 链接" : "打开链接";
        const isResource = isMagnet || isEd2k, wrapper = $(isResource ? '<span class="jhs-review-link-wrap"></span>' : '<span class="jhs-review-inline-controls"></span>');
        const main = $('<span class="jhs-review-link-main"></span>');
        const open = isEd2k ? $('<button type="button" class="jhs-btn jhs-review-link"></button>').text(label).on("click", (() => utils.copyToClipboard(label, value))) : $("<a></a>").addClass("jhs-review-link").attr({
            href: value,
            target: "_blank",
            rel: "noopener noreferrer"
        }).text(label);
        const copy = $('<button type="button" class="jhs-btn jhs-review-link jhs-review-link-copy">复制</button>').on("click", (() => utils.copyToClipboard(label, value)));
        main.append(open, copy), wrapper.append(main);
        if (isResource) {
            const actions = $('<span class="jhs-review-link-actions"></span>');
            actions.append(`<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn jhs-offline-btn" data-resource="${escapeHtml(value)}">离线</button>`);
            wrapper.append(actions);
        }
        container.append(wrapper);
    }
    bindRightClickFilter() {
        $(document).off("contextmenu.jhsReviewFilter", ".review-content").on("contextmenu.jhsReviewFilter", ".review-content", (async event => {
            if (await storageManager.getSetting("enableTitleSelectFilter", _) !== _) return;
            const text = window.getSelection().toString();
            text && (event.preventDefault(), await utils.q(event, `是否将 '${text}' 加入评论区关键词?`, (async () => {
                await storageManager.saveReviewFilterKeyword(text), show.ok("操作成功, 刷新页面后生效");
            })));
        }));
    }
}
