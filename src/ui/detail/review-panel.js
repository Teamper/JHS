// @ts-check

const FILTER_KEY = "review_filter_keyword";

export class ReviewPanel {
    /** @param {{review: any, settings: any, storage: any, scope: () => Promise<any>}} dependencies */
    constructor(dependencies) { this.review = dependencies.review; this.settings = dependencies.settings; this.storage = dependencies.storage; this.scope = dependencies.scope; }

    /** @param {string} movieId @param {any} target @param {{ownedSection?: any, isActive?: () => boolean}} [options] */
    async show(movieId, target, options = {}) {
        const jq = /** @type {any} */ (globalThis).$, isActive = options.isActive ?? (() => true);
        if (!isActive() || !target?.length) return jq();
        const existing = target.children('[data-jhs-panel="reviews"]').filter((/** @type {number} */ _index, /** @type {Element} */ element) => jq(element).attr("data-jhs-movie-id") === String(movieId)).first();
        if (existing.length) return existing;
        const panel = jq('<section class="jhs-review-panel" data-jhs-panel="reviews"></section>').attr("data-jhs-movie-id", String(movieId));
        const header = jq('<header class="jhs-panel-header"><h3>评论</h3></header>');
        const toggle = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-review-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
        const state = { movieId, panel, floorIndex: 1, loaded: false, loading: false, page: 1, isActive };
        header.append(toggle);
        if (options.ownedSection) options.ownedSection.find('[data-jhs-section-actions="reviews"]').first().append(toggle); else panel.append(header);
        panel.append('<div class="jhs-review-list jhs-review-container"></div>', '<div class="jhs-panel-footer jhs-review-footer"></div>');
        target.append(panel); this.bindFilter(panel);
        const enabled = (this.settings.snapshot().enableLoadReview ?? "no") === "yes";
        this.updateToggle(toggle, enabled);
        toggle.on("click", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            const expanded = toggle.find(".toggle-text").text() === "展开";
            this.updateToggle(toggle, expanded); panel.find(".jhs-review-container, .jhs-review-footer").toggle(expanded);
            if (expanded && !state.loaded && !state.loading) void this.fetch(state);
            void this.settings.set("enableLoadReview", expanded ? "yes" : "no");
        });
        if (enabled) await this.fetch(state); else panel.find(".jhs-review-container, .jhs-review-footer").hide();
        return panel;
    }

    /** @param {any} toggle @param {boolean} expanded */
    updateToggle(toggle, expanded) { toggle.attr("aria-expanded", String(expanded)); toggle.find(".toggle-text").text(expanded ? "折叠" : "展开"); toggle.find(".toggle-icon").text(expanded ? "▲" : "▼"); }

    /** @param {any} state */
    async fetch(state) {
        if (state.loading || !state.isActive()) return;
        const jq = /** @type {any} */ (globalThis).$, container = state.panel.find(".jhs-review-container"), footer = state.panel.find(".jhs-review-footer");
        state.loading = true; container.empty().append(jq('<div class="jhs-panel-state"></div>').text("获取评论中...")); footer.empty();
        const pageSize = Number(this.settings.snapshot().reviewCount) || 20; let scope;
        try {
            scope = await this.scope();
            const reviews = await this.review.list({ movieId: state.movieId }, { page: 1, limit: pageSize, scope });
            if (!state.isActive() || scope?.signal?.aborted) return;
            state.loading = false; state.loaded = true; container.empty();
            if (!reviews.length) return void container.append(jq('<div class="jhs-panel-state"></div>').text("无评论"));
            const keywords = await this.getKeywords(); await this.display(state, reviews, container, keywords);
            if (reviews.length === pageSize) this.bindLoadMore(state, pageSize, keywords, container, footer); else footer.append(jq('<div class="jhs-panel-end"></div>').text("已加载全部评论"));
        } catch (error) {
            state.loading = false;
            if (!state.isActive() || scope?.signal?.aborted) return;
            /** @type {any} */ (globalThis).clog?.error("获取评论失败:", error);
            this.renderRetry(container, "获取评论失败", () => void this.fetch(state));
        }
    }

    async getKeywords() { const value = await this.storage.get(FILTER_KEY); return Array.isArray(value) ? value.map(String) : []; }
    /** @param {string} text */
    async saveKeyword(text) { const values = await this.getKeywords(); if (!values.includes(text)) await this.storage.set(FILTER_KEY, [...values, text]); }

    /** @param {any} container @param {string} message @param {() => void} retry */
    renderRetry(container, message, retry) {
        const jq = /** @type {any} */ (globalThis).$;
        container.empty().append(jq('<div class="jhs-panel-state"></div>').append(document.createTextNode(`${message} `), jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry)));
    }

    /** @param {any} state @param {number} pageSize @param {string[]} keywords @param {any} container @param {any} footer */
    bindLoadMore(state, pageSize, keywords, container, footer) {
        const jq = /** @type {any} */ (globalThis).$, button = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-review-load-more">加载更多评论</button>'), end = jq('<div class="jhs-panel-end jhs-review-end">已加载全部评论</div>').hide();
        footer.empty().append(button, end);
        button.on("click", async () => {
            const nextPage = state.page + 1; let scope; button.text("加载中...").prop("disabled", true);
            try {
                scope = await this.scope();
                const reviews = await this.review.list({ movieId: state.movieId }, { page: nextPage, limit: pageSize, scope });
                if (!state.isActive() || scope?.signal?.aborted) return;
                state.page = nextPage; await this.display(state, reviews, container, keywords);
                if (reviews.length < pageSize) button.remove(), end.show(); else button.text("加载更多评论").prop("disabled", false);
            } catch (error) {
                if (!state.isActive() || scope?.signal?.aborted) return;
                /** @type {any} */ (globalThis).clog?.error("加载更多评论失败:", error); button.text("加载失败，请重试").prop("disabled", false);
            }
        });
    }

    /** @param {any} state @param {any[]} reviews @param {any} container @param {string[]} keywords */
    async display(state, reviews, container, keywords) {
        const jq = /** @type {any} */ (globalThis).$;
        const filter = keywords.length ? new RegExp(keywords.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")) : null;
        for (const review of reviews) {
            const content = String(review.content || ""); if (filter?.test(content)) continue;
            const item = jq('<article class="jhs-review-item"></article>'), meta = jq('<div class="jhs-review-meta"></div>'), body = jq('<div class="review-content jhs-review-content"></div>');
            meta.append(jq("<span></span>").addClass("jhs-review-author").text(review.author || "匿名用户"));
            const stars = jq('<span class="score-stars" aria-label="评分"></span>'), score = Math.max(0, Math.min(5, Number(review.score) || 0));
            for (let index = 0; index < score; index++) stars.append('<i class="icon-star"></i>');
            const formatted = /** @type {any} */ (globalThis).utils.formatDate(review.createdAt);
            meta.append(stars, jq("<time></time>").text(formatted), jq("<span></span>").text(`点赞：${Number(review.likes) || 0}`), jq("<span></span>").addClass("jhs-review-floor").text(`#${state.floorIndex++}楼`));
            this.appendContent(body, content); item.append(meta, body); container.append(item);
        }
    }

    /** @param {any} container @param {string} content */
    appendContent(container, content) {
        const pattern = /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+/g;
        let cursor = 0, match;
        while ((match = pattern.exec(content))) { if (match.index > cursor) container.append(document.createTextNode(content.slice(cursor, match.index))); this.appendLink(container, match[0]); cursor = match.index + match[0].length; }
        if (cursor < content.length) container.append(document.createTextNode(content.slice(cursor)));
    }

    /** @param {any} container @param {string} value */
    appendLink(container, value) {
        const jq = /** @type {any} */ (globalThis).$, isEd2k = value.startsWith("ed2k://"), isMagnet = value.startsWith("magnet:"), label = isEd2k ? "ED2K 链接" : isMagnet ? "Magnet 链接" : "打开链接", isResource = isEd2k || isMagnet;
        const wrapper = jq(isResource ? '<span class="jhs-review-link-wrap"></span>' : '<span class="jhs-review-inline-controls"></span>'), main = jq('<span class="jhs-review-link-main"></span>');
        const open = isEd2k ? jq('<button type="button" class="jhs-btn jhs-review-link"></button>').text(label).on("click", () => /** @type {any} */ (globalThis).utils.copyToClipboard(label, value)) : jq("<a></a>").addClass("jhs-review-link").attr({ href: value, target: "_blank", rel: "noopener noreferrer" }).text(label);
        const copy = jq('<button type="button" class="jhs-btn jhs-review-link jhs-review-link-copy">复制</button>').on("click", () => /** @type {any} */ (globalThis).utils.copyToClipboard(label, value));
        main.append(open, copy); wrapper.append(main);
        if (isResource) wrapper.append(jq('<span class="jhs-review-link-actions"></span>').append(jq('<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn jhs-offline-btn">离线</button>').attr("data-resource", value)));
        container.append(wrapper);
    }

    /** @param {any} panel */
    bindFilter(panel) {
        panel.off("contextmenu.jhsReviewFilter", ".review-content").on("contextmenu.jhsReviewFilter", ".review-content", async (/** @type {any} */ event) => {
            if ((this.settings.snapshot().enableTitleSelectFilter ?? "yes") !== "yes") return;
            const text = String(window.getSelection()?.toString() || ""); if (!text) return;
            event.preventDefault();
            await /** @type {any} */ (globalThis).utils.q(event, `是否将 '${text}' 加入评论区关键词?`, async () => { await this.saveKeyword(text); /** @type {any} */ (globalThis).show.ok("操作成功, 刷新页面后生效"); });
        });
    }
}
