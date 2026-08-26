// @ts-check

export class RelatedPanel {
    /** @param {{related: any, settings: any, scope: () => Promise<any>}} dependencies */
    constructor(dependencies) { this.related = dependencies.related; this.settings = dependencies.settings; this.scope = dependencies.scope; }

    /** @param {any} target @param {string} movieId @param {{ownedSection?: any, isActive?: () => boolean}} [options] */
    async show(target, movieId, options = {}) {
        const jq = /** @type {any} */ (globalThis).$, isActive = options.isActive ?? (() => true);
        if (!movieId) throw new TypeError("未传入movieId");
        if (!isActive() || !target?.length) return jq();
        const existing = target.children('[data-jhs-panel="related"]').filter((/** @type {number} */ _index, /** @type {Element} */ element) => jq(element).attr("data-jhs-movie-id") === String(movieId)).first();
        if (existing.length) return existing;
        const panel = jq('<section class="jhs-related-panel" data-jhs-panel="related"></section>').attr("data-jhs-movie-id", String(movieId));
        const header = jq('<header class="jhs-panel-header"><h3>相关清单</h3></header>');
        const toggle = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-related-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
        const state = { movieId, panel, floorIndex: 1, loaded: false, loading: false, page: 1, isActive };
        header.append(toggle);
        if (options.ownedSection) options.ownedSection.find('[data-jhs-section-actions="related"]').first().append(toggle);
        else panel.append(header);
        panel.append('<div class="jhs-related-list jhs-related-container"></div>', '<div class="jhs-panel-footer jhs-related-footer"></div>');
        target.append(panel);
        const enabled = (this.settings.snapshot().enableLoadRelated ?? "no") === "yes";
        this.updateToggle(toggle, enabled);
        toggle.on("click", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            const expanded = toggle.find(".toggle-text").text() === "展开";
            const previous = (this.settings.snapshot().enableLoadRelated ?? "no") === "yes";
            const desired = expanded ? "yes" : "no";
            this.updateToggle(toggle, expanded);
            panel.find(".jhs-related-container, .jhs-related-footer").toggle(expanded);
            if (expanded && !state.loaded && !state.loading) void this.fetch(state);
            this.settings.set("enableLoadRelated", desired).catch((/** @type {unknown} */ error) => {
                this.updateToggle(toggle, previous);
                panel.find(".jhs-related-container, .jhs-related-footer").toggle(previous);
                /** @type {any} */ (globalThis).clog?.error("相关清单展开设置保存失败，已恢复", error);
                /** @type {any} */ (globalThis).show?.error?.("相关清单展开设置保存失败，已恢复原设置");
            });
        });
        if (enabled) await this.fetch(state); else panel.find(".jhs-related-container, .jhs-related-footer").hide();
        return panel;
    }

    /** @param {any} toggle @param {boolean} expanded */
    updateToggle(toggle, expanded) {
        toggle.attr("aria-expanded", String(expanded));
        toggle.find(".toggle-text").text(expanded ? "折叠" : "展开");
        toggle.find(".toggle-icon").text(expanded ? "▲" : "▼");
    }

    /** @param {any} state */
    async fetch(state) {
        if (state.loading || !state.isActive()) return;
        state.loading = true;
        const container = state.panel.find(".jhs-related-container"), footer = state.panel.find(".jhs-related-footer");
        container.empty().append(/** @type {any} */ (globalThis).$("<div></div>").addClass("jhs-panel-state").text("获取清单中..."));
        footer.empty();
        let scope;
        try {
            scope = await this.scope();
            const related = await this.related.list({ movieId: state.movieId }, { page: 1, limit: 20, scope });
            if (!state.isActive() || scope?.signal?.aborted) return;
            state.loading = false; state.loaded = true; container.empty();
            if (!related.length) return void container.append(/** @type {any} */ (globalThis).$("<div></div>").addClass("jhs-panel-state").text("无清单"));
            this.display(state, related, container);
            if (related.length === 20) this.bindLoadMore(state, container, footer);
            else footer.append(/** @type {any} */ (globalThis).$("<div></div>").addClass("jhs-panel-end").text("已加载全部清单"));
        } catch (error) {
            state.loading = false;
            if (!state.isActive() || scope?.signal?.aborted) return;
            /** @type {any} */ (globalThis).clog?.error("获取清单失败:", error);
            this.renderRetry(container, () => void this.fetch(state));
        }
    }

    /** @param {any} container @param {() => void} retry */
    renderRetry(container, retry) {
        const jq = /** @type {any} */ (globalThis).$;
        container.empty().append(jq('<div class="jhs-panel-state"></div>').append(document.createTextNode("获取清单失败 "), jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry)));
    }

    /** @param {any} state @param {any} container @param {any} footer */
    bindLoadMore(state, container, footer) {
        const jq = /** @type {any} */ (globalThis).$, button = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-related-load-more">加载更多清单</button>'), end = jq('<div class="jhs-panel-end jhs-related-end">已加载全部清单</div>').hide();
        footer.empty().append(button, end);
        button.on("click", async () => {
            const nextPage = state.page + 1; let scope;
            button.text("加载中...").prop("disabled", true);
            try {
                scope = await this.scope();
                const related = await this.related.list({ movieId: state.movieId }, { page: nextPage, limit: 20, scope });
                if (!state.isActive() || scope?.signal?.aborted) return;
                state.page = nextPage; this.display(state, related, container);
                if (related.length < 20) button.remove(), end.show(); else button.text("加载更多清单").prop("disabled", false);
            } catch (error) {
                if (!state.isActive() || scope?.signal?.aborted) return;
                /** @type {any} */ (globalThis).clog?.error("加载更多清单失败:", error);
                button.text("加载失败，请重试").prop("disabled", false);
            }
        });
    }

    /** @param {any} state @param {any[]} related @param {any} container */
    display(state, related, container) {
        const jq = /** @type {any} */ (globalThis).$;
        related.forEach((item) => {
            const title = jq("<a></a>").addClass("jhs-related-title").attr({ href: `/lists/${encodeURIComponent(item.id)}`, target: "_blank", rel: "noopener noreferrer" }).text(item.name || "未命名清单");
            const heading = jq('<div class="jhs-related-heading"></div>').append(jq("<span></span>").addClass("jhs-related-index").text(`#${state.floorIndex++}`), title);
            const meta = jq('<div class="jhs-related-meta"></div>');
            const formatted = item.createdAt ? /** @type {any} */ (globalThis).utils.formatDate(item.createdAt) : "未知";
            meta.append(jq("<span></span>").text(`视频：${Number(item.movieCount) || 0}`), jq("<span></span>").text(`收藏：${Number(item.collectionCount) || 0}`), jq("<span></span>").text(`查看：${Number(item.viewCount) || 0}`), jq('<time class="jhs-related-time"></time>').text(`创建时间：${formatted}`));
            container.append(jq('<article class="jhs-related-item"></article>').append(heading, meta));
        });
    }
}
