// @ts-check
import { formatUiDateTime } from "../../core/ui-date-time.js";

import { escapeHtml } from "../../core/constants.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { getIcon } from "../../core/icons.js";
import { createPanelLoading } from "./primitives.js";

export class ReviewPanel {
    /** @param {{review: any, settings: any, keywordRules: Pick<import("../../services/keyword-rules-service.js").KeywordRulesService, "getReviewKeywords"|"addReviewKeyword">, scope: () => Promise<any>, jquery?: (value: any) => any, document?: Document, window?: Window, ui?: any, clipboard?: any, notifications?: any, diagnostics?: any, logger?: Pick<Console, "error">}} dependencies */
    constructor(dependencies) {
        this.review = dependencies.review;
        this.settings = dependencies.settings;
        this.keywordRules = dependencies.keywordRules;
        this.scope = dependencies.scope;
        this.jquery = dependencies.jquery ?? ((/** @type {any} */ value) => /** @type {any} */ (globalThis).$(value));
        this.document = dependencies.document ?? /** @type {any} */ (globalThis).document;
        this.window = dependencies.window ?? /** @type {any} */ (globalThis).window;
        this.ui = dependencies.ui ?? null;
        this.clipboard = dependencies.clipboard ?? null;
        this.notifications = dependencies.notifications ?? null;
        this.diagnostics = dependencies.diagnostics;
        this.logger = dependencies.logger ?? console;
    }

    /** @param {string} movieId @param {any} target @param {{ownedSection?: any, isActive?: () => boolean, ownCleanup?: (cleanup: () => void) => unknown, awaitInitialLoad?: boolean}} [options] */
    async show(movieId, target, options = {}) {
        const jq = this.jquery, isActive = options.isActive ?? (() => true);
        if (!isActive() || !target?.length) return jq([]);
        const existing = target.children('[data-jhs-panel="reviews"]').filter((/** @type {number} */ _index, /** @type {Element} */ element) => jq(element).attr("data-jhs-movie-id") === String(movieId)).first();
        if (existing.length) return existing;
        const panel = jq('<section class="jhs-review-panel jhs-ui" data-jhs-panel="reviews"></section>').attr("data-jhs-movie-id", String(movieId));
        const header = jq('<header class="jhs-panel-header"><h3>评论</h3></header>');
        const toggle = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-review-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
        const parentScope = await this.scope(), panelScope = new LifecycleScope(`reviews:${movieId}`);
        if (!isActive() || parentScope?.disposed) return jq([]);
        const releaseParent = parentScope?.addCleanup?.(() => panelScope.dispose());
        options.ownCleanup?.(() => { panelScope.dispose(); releaseParent?.(); });
        const state = { movieId, panel, panelScope, floorIndex: 1, loaded: false, loading: false, page: 1, showFiltered: false, keywords: /** @type {string[]} */ ([]), enabled: false, generation: 0, isActive: () => !panelScope.disposed && isActive(), requestScope: /** @type {LifecycleScope | null} */ (null) };
        panelScope.addCleanup(() => panel.remove());
        header.append(toggle);
        if (options.ownedSection) options.ownedSection.find('[data-jhs-section-actions="reviews"]').first().append(toggle); else panel.append(header);
        panel.append('<div class="jhs-review-list jhs-review-container"></div>', '<div class="jhs-panel-footer jhs-review-footer"></div>');
        const filters = jq('<div class="jhs-toolbar jhs-review-filters"></div>');
        const reveal = jq('<button type="button" class="jhs-btn jhs-btn--ghost" aria-pressed="false"></button>').hide();
        const block = jq('<button type="button" class="jhs-btn jhs-btn--ghost">屏蔽所选词</button>');
        filters.append(reveal, block);
        panel.prepend(filters);
        reveal.on("click", () => { state.showFiltered = !state.showFiltered; this.filterReviews(state); reveal.trigger("focus"); });
        block.on("mousedown", (/** @type {any} */ event) => event.preventDefault());
        block.on("click", (/** @type {any} */ event) => void this.filterSelection(event, state));
        target.append(panel); this.bindFilter(panel, state);
        const enabled = (this.settings.snapshot().enableLoadReview ?? "yes") === "yes";
        const applyExpanded = (/** @type {unknown} */ value) => {
            if (!state.isActive()) return;
            const next = value === "yes";
            if (state.enabled !== next) {
                state.enabled = next; state.generation++;
                if (!next) { state.requestScope?.dispose(); state.loading = false; panel.attr("aria-busy", "false"); }
            }
            this.updateToggle(toggle, next);
            panel.find(".jhs-review-container, .jhs-review-footer, .jhs-review-filters").toggle(next);
            panel.find(".jhs-review-load-more").prop("disabled", false).text("加载更多评论");
            if (next && !state.loaded && !state.loading) return this.fetch(state);
        };
        if (this.settings.addEventListener) panelScope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            if (event.detail?.names?.includes("enableLoadReview")) void applyExpanded(this.settings.snapshot().enableLoadReview ?? "yes");
        });
        toggle.on("click", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            const expanded = toggle.find(".toggle-text").text() === "展开";
            const desired = expanded ? "yes" : "no";
            void applyExpanded(desired);
        });
        panelScope.addCleanup(() => { state.requestScope?.dispose(); panel.attr("aria-busy", "false"); toggle.off("click"); panel.off("contextmenu.jhsReviewFilter"); });
        const initialLoad = applyExpanded(enabled ? "yes" : "no");
        if (options.awaitInitialLoad !== false) await initialLoad;
        return panel;
    }

    /** @param {any} toggle @param {boolean} expanded */
    updateToggle(toggle, expanded) {
        toggle.attr("aria-expanded", String(expanded)); toggle.find(".toggle-text").text(expanded ? "折叠" : "展开");
        const icon = toggle.find(".toggle-icon").empty();
        icon[0]?.insertAdjacentHTML("beforeend", getIcon(expanded ? "chevron-up" : "chevron-down"));
    }

    /** @param {any} state */
    async fetch(state) {
        if (state.loading || !state.enabled || !state.isActive()) return;
        const jq = this.jquery, container = state.panel.find(".jhs-review-container"), footer = state.panel.find(".jhs-review-footer");
        state.loading = true; state.panel.attr("aria-busy", "true"); container.empty().append(createPanelLoading(undefined, this.jquery)); footer.empty();
        const pageSize = Number(this.settings.snapshot().reviewCount) || 20, generation = state.generation;
        const scope = new LifecycleScope(`reviews:${state.movieId}:page:1`), release = state.panelScope.addCleanup(() => scope.dispose());
        state.requestScope = scope;
        try {
            const reviews = await this.review.list({ movieId: state.movieId }, { page: 1, limit: pageSize, scope });
            if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
            const keywords = await this.getKeywords();
            state.keywords = keywords;
            if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
            state.loading = false; state.loaded = true; container.empty();
            if (!reviews.length) return void container.append(jq('<div class="jhs-panel-state"></div>').text("暂无评论"));
            await this.display(state, reviews, container);
            if (reviews.length === pageSize) this.bindLoadMore(state, pageSize, container, footer); else footer.append(jq('<div class="jhs-panel-end"></div>').text("已加载全部评论"));
        } catch (error) {
            if (generation === state.generation) state.loading = false;
            if (!state.isActive() || scope?.signal?.aborted) return;
            this.reportError("获取评论失败", error);
            this.renderRetry(container, "获取评论失败", () => void this.fetch(state));
        } finally { release(); if (generation === state.generation) { state.loading = false; state.panel.attr("aria-busy", "false"); } if (state.requestScope === scope) state.requestScope = null; }
    }

    async getKeywords() { return this.keywordRules.getReviewKeywords(); }
    /** @param {string} text */
    async saveKeyword(text) { await this.keywordRules.addReviewKeyword(text); }

    /** @param {any} container @param {string} message @param {() => void} retry */
    renderRetry(container, message, retry) {
        const jq = this.jquery;
        container.empty().append(jq('<div class="jhs-panel-state"></div>').append(this.document.createTextNode(`${message} `), jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry)));
    }

    /** @param {any} state @param {number} pageSize @param {any} container @param {any} footer */
    bindLoadMore(state, pageSize, container, footer) {
        const jq = this.jquery, button = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-review-load-more">加载更多评论</button>'), end = jq('<div class="jhs-panel-end jhs-review-end">已加载全部评论</div>').hide();
        footer.empty().append(button, end);
        button.on("click", async () => {
            if (!state.enabled || !state.isActive() || state.loading) return;
            const nextPage = state.page + 1, generation = state.generation, scope = new LifecycleScope(`reviews:${state.movieId}:page:${nextPage}`), release = state.panelScope.addCleanup(() => scope.dispose());
            state.requestScope = scope; state.loading = true; state.panel.attr("aria-busy", "true"); button.text("加载中…").attr("aria-busy", "true").prop("disabled", true);
            try {
                const reviews = await this.review.list({ movieId: state.movieId }, { page: nextPage, limit: pageSize, scope });
                if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
                state.page = nextPage; await this.display(state, reviews, container);
                if (reviews.length < pageSize) button.remove(), end.show(); else button.text("加载更多评论").prop("disabled", false);
            } catch (error) {
                if (!state.isActive() || scope?.signal?.aborted) return;
                this.reportError("加载更多评论失败", error); button.text("加载失败，请重试").prop("disabled", false);
            } finally { release(); button.attr("aria-busy", "false"); if (generation === state.generation) { state.loading = false; state.panel.attr("aria-busy", "false"); } if (state.requestScope === scope) state.requestScope = null; }
        });
    }

    /** @param {any} state @param {any[]} reviews @param {any} container */
    async display(state, reviews, container) {
        const jq = this.jquery;
        for (const review of reviews) {
            const content = String(review.content || "");
            const item = jq('<article class="jhs-review-item"></article>'), meta = jq('<div class="jhs-review-meta"></div>'), body = jq('<div class="review-content jhs-review-content"></div>');
            meta.append(jq("<span></span>").addClass("jhs-review-author").text(review.author || "匿名用户"));
            const stars = jq('<span class="score-stars" aria-label="评分"></span>'), score = Math.max(0, Math.min(5, Number(review.score) || 0));
            for (let index = 0; index < score; index++) stars.append(getIcon("star"));
            const formatted = this.ui?.formatDate?.(review.createdAt) ?? formatUiDateTime(review.createdAt);
            meta.append(stars, jq("<time></time>").text(formatted), jq("<span></span>").text(`点赞：${Number(review.likes) || 0}`), jq("<span></span>").addClass("jhs-review-floor").text(`#${state.floorIndex++}楼`));
            this.appendContent(body, content);
            item.data("jhsReviewContent", content).append(meta, body);
            container.append(item);
        }
        this.filterReviews(state);
    }

    /** @param {any} state */
    filterReviews(state) {
        const pattern = state.keywords.map((/** @type {string} */ value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        const filter = pattern ? new RegExp(pattern, "i") : null;
        let hidden = 0;
        state.panel.find(".jhs-review-item").each((/** @type {number} */ _, /** @type {HTMLElement} */ node) => {
            const matches = Boolean(filter?.test(this.jquery(node).data("jhsReviewContent")));
            if (matches) hidden++;
            node.hidden = matches && !state.showFiltered;
        });
        const reveal = state.panel.find(".jhs-review-filters [aria-pressed]");
        reveal.toggle(hidden > 0).attr("aria-pressed", String(state.showFiltered))
            .text(state.showFiltered ? "重新隐藏 " + hidden + " 条匹配评论" : "已隐藏 " + hidden + " 条匹配评论 · 展开");
    }

    /** @param {any} container @param {string} content */
    appendContent(container, content) {
        const pattern = /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`,;\u4e00-\u9fa5，。？！（）【】]+/g;
        let cursor = 0, match;
        while ((match = pattern.exec(content))) { if (match.index > cursor) container.append(this.document.createTextNode(content.slice(cursor, match.index))); this.appendLink(container, match[0]); cursor = match.index + match[0].length; }
        if (cursor < content.length) container.append(this.document.createTextNode(content.slice(cursor)));
    }

    /** @param {any} container @param {string} value */
    appendLink(container, value) {
        const jq = this.jquery, isEd2k = value.startsWith("ed2k://"), isMagnet = value.startsWith("magnet:"), label = isEd2k ? "ED2K 链接" : isMagnet ? "Magnet 链接" : "打开链接", isResource = isEd2k || isMagnet;
        const wrapper = jq(isResource ? '<span class="jhs-review-link-wrap"></span>' : '<span class="jhs-review-inline-controls"></span>'), main = jq('<span class="jhs-review-link-main"></span>');
        const copyResource = () => this.clipboard.copyText(label, value);
        const open = isEd2k ? jq('<button type="button" class="jhs-btn jhs-review-link"></button>').text(label).on("click", copyResource) : jq("<a></a>").addClass("jhs-review-link jhs-link").attr({ href: value, target: "_blank", rel: "noopener noreferrer" }).text(label);
        const copy = jq('<button type="button" class="jhs-btn jhs-review-link jhs-review-link-copy">复制</button>').on("click", copyResource);
        main.append(open, copy); wrapper.append(main);
        if (isResource) wrapper.append(jq('<span class="jhs-review-link-actions"></span>').append(jq('<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn jhs-offline-btn">离线</button>').attr("data-resource", value)));
        container.append(wrapper);
    }

    /** @param {any} panel @param {any} state */
    bindFilter(panel, state) {
        panel.on("contextmenu.jhsReviewFilter", ".review-content", (/** @type {any} */ event) => void this.filterSelection(event, state));
    }

    /** @param {any} event @param {any} state */
    async filterSelection(event, state) {
        if ((this.settings.snapshot().enableTitleSelectFilter ?? "yes") !== "yes") return;
        const selection = this.window.getSelection();
        const text = String(selection?.toString() || "").trim();
        if (!text || !state.panel[0].contains(selection?.anchorNode)) return;
        event.preventDefault();
        this.ui.confirm(event, `屏蔽评论关键词「${escapeHtml(text)}」？`, async () => {
            try {
                await this.saveKeyword(text);
                if (!state.isActive()) return;
                state.keywords = await this.getKeywords();
                if (!state.isActive()) return;
                state.showFiltered = false;
                this.filterReviews(state);
                this.notify("ok", "已屏蔽关键词");
            } catch (error) {
                this.reportError("保存评论屏蔽关键词失败", error);
                if (state.isActive()) this.notify("error", "保存关键词失败，请重试");
            }
        }, { confirmText: "屏蔽", tone: "danger" });
    }

    /** @param {"error" | "ok"} kind @param {string} message */
    notify(kind, message) {
        this.notifications?.[kind](message);
    }

    /** @param {string} message @param {unknown} error */
    reportError(message, error) {
        this.diagnostics?.recordError?.({ source: "detail-review-panel", message, cause: error instanceof Error ? error.message : String(error) });
        if (!this.diagnostics) this.logger.error(message, error);
    }
}
