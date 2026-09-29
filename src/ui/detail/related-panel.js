// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { createLatestSettingWriter } from "../settings/setting-binding-controller.js";

export class RelatedPanel {
    /** @param {{related: any, settings: any, scope: () => Promise<any>, jquery?: (value: any) => any, formatDate?: (value: any) => string, document?: Document, notifications?: any, diagnostics?: any}} dependencies */
    constructor(dependencies) {
        this.related = dependencies.related;
        this.settings = dependencies.settings;
        this.scope = dependencies.scope;
        this.jquery = dependencies.jquery ?? /** @type {any} */ (globalThis).$;
        this.formatDate = dependencies.formatDate ?? ((value) => /** @type {any} */ (globalThis).utils.formatDate(value));
        this.document = dependencies.document ?? document;
        this.notifications = dependencies.notifications ?? null;
        this.diagnostics = dependencies.diagnostics ?? null;
    }

    /** @param {any} target @param {string} movieId @param {{ownedSection?: any, isActive?: () => boolean, ownCleanup?: (cleanup: () => void) => unknown, awaitInitialLoad?: boolean}} [options] */
    async show(target, movieId, options = {}) {
        const jq = this.jquery, isActive = options.isActive ?? (() => true);
        if (!movieId) throw new TypeError("未传入movieId");
        if (!isActive() || !target?.length) return jq();
        const existing = target.children('[data-jhs-panel="related"]').filter((/** @type {number} */ _index, /** @type {Element} */ element) => jq(element).attr("data-jhs-movie-id") === String(movieId)).first();
        if (existing.length) return existing;
        const panel = jq('<section class="jhs-related-panel" data-jhs-panel="related"></section>').attr("data-jhs-movie-id", String(movieId));
        const header = jq('<header class="jhs-panel-header"><h3>相关清单</h3></header>');
        const toggle = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-related-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>');
        const parentScope = await this.scope(), panelScope = new LifecycleScope(`related:${movieId}`);
        if (!isActive() || parentScope?.disposed) return jq();
        const releaseParent = parentScope?.addCleanup?.(() => { panelScope.dispose(); panel.remove(); });
        options.ownCleanup?.(() => { panelScope.dispose(); releaseParent?.(); panel.remove(); });
        const state = { movieId, panel, panelScope, floorIndex: 1, loaded: false, loading: false, page: 1, enabled: false, generation: 0, isActive: () => !panelScope.disposed && isActive(), requestScope: /** @type {LifecycleScope | null} */ (null) };
        header.append(toggle);
        if (options.ownedSection) options.ownedSection.find('[data-jhs-section-actions="related"]').first().append(toggle);
        else panel.append(header);
        panel.append('<div class="jhs-related-list jhs-related-container"></div>', '<div class="jhs-panel-footer jhs-related-footer"></div>');
        target.append(panel);
        const enabled = (this.settings.snapshot().enableLoadRelated ?? "no") === "yes";
        const applyExpanded = (/** @type {unknown} */ value) => {
            if (!state.isActive()) return;
            const next = value === "yes";
            if (state.enabled !== next) {
                state.enabled = next; state.generation++;
                if (!next) { state.requestScope?.dispose(); state.loading = false; }
            }
            this.updateToggle(toggle, next);
            panel.find(".jhs-related-container, .jhs-related-footer").toggle(next);
            if (!state.loading) panel.find(".jhs-related-load-more").prop("disabled", false).text("加载更多清单");
            if (next && !state.loaded && !state.loading) return this.fetch(state);
        };
        if (this.settings.addEventListener) panelScope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            if (event.detail?.names?.includes("enableLoadRelated")) void applyExpanded(this.settings.snapshot().enableLoadRelated ?? "no");
        });
        const writeExpanded = createLatestSettingWriter({ settings: this.settings, key: "enableLoadRelated", fallback: "no", apply: value => { void applyExpanded(value); }, onError: error => {
            this.diagnostics?.recordError?.({ source: "detail-related-panel", message: error instanceof Error ? error.message : String(error) });
            if (!this.diagnostics) /** @type {any} */ (globalThis).clog?.error("相关清单展开设置保存失败，已恢复", error);
            if (this.notifications?.error) this.notifications.error("相关清单展开设置保存失败，已恢复原设置");
            else /** @type {any} */ (globalThis).show?.error?.("相关清单展开设置保存失败，已恢复原设置");
        } });
        toggle.on("click", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            void writeExpanded(state.enabled ? "no" : "yes");
        });
        panelScope.addCleanup(() => { state.requestScope?.dispose(); toggle.off("click"); panel.find("button").off("click"); });
        const initialLoad = applyExpanded(enabled ? "yes" : "no");
        if (options.awaitInitialLoad !== false) await initialLoad;
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
        if (state.loading || !state.enabled || !state.isActive()) return;
        state.loading = true;
        const container = state.panel.find(".jhs-related-container"), footer = state.panel.find(".jhs-related-footer");
        container.empty().append(this.jquery("<div></div>").addClass("jhs-panel-state").text("获取清单中..."));
        footer.empty();
        const generation = state.generation, scope = new LifecycleScope(`related:${state.movieId}:page:1`), release = state.panelScope.addCleanup(() => scope.dispose());
        state.requestScope = scope;
        try {
            const related = await this.related.list({ movieId: state.movieId }, { page: 1, limit: 20, scope });
            if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
            state.loading = false; state.loaded = true; container.empty();
            if (!related.length) return void container.append(this.jquery("<div></div>").addClass("jhs-panel-state").text("无清单"));
            this.display(state, related, container);
            if (related.length === 20) this.bindLoadMore(state, container, footer);
            else footer.append(this.jquery("<div></div>").addClass("jhs-panel-end").text("已加载全部清单"));
        } catch (error) {
            if (generation === state.generation) state.loading = false;
            if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
            this.diagnostics?.recordError?.({ source: "detail-related-panel", message: error instanceof Error ? error.message : String(error) });
            if (!this.diagnostics) /** @type {any} */ (globalThis).clog?.error("获取清单失败:", error);
            this.renderRetry(container, () => void this.fetch(state));
        } finally { release(); if (state.requestScope === scope) state.requestScope = null; }
    }

    /** @param {any} container @param {() => void} retry */
    renderRetry(container, retry) {
        const jq = this.jquery;
        container.empty().append(jq('<div class="jhs-panel-state"></div>').append(this.document.createTextNode("获取清单失败 "), jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry)));
    }

    /** @param {any} state @param {any} container @param {any} footer */
    bindLoadMore(state, container, footer) {
        const jq = this.jquery, button = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-related-load-more">加载更多清单</button>'), end = jq('<div class="jhs-panel-end jhs-related-end">已加载全部清单</div>').hide();
        footer.empty().append(button, end);
        button.on("click", async () => {
            if (!state.enabled || !state.isActive() || state.loading) return;
            const nextPage = state.page + 1, generation = state.generation, scope = new LifecycleScope(`related:${state.movieId}:page:${nextPage}`), release = state.panelScope.addCleanup(() => scope.dispose());
            state.loading = true; state.requestScope = scope;
            button.text("加载中...").prop("disabled", true);
            try {
                const related = await this.related.list({ movieId: state.movieId }, { page: nextPage, limit: 20, scope });
                if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
                state.page = nextPage; this.display(state, related, container);
                if (related.length < 20) button.remove(), end.show(); else button.text("加载更多清单").prop("disabled", false);
            } catch (error) {
                if (!state.isActive() || scope.signal.aborted || generation !== state.generation || !state.enabled) return;
                this.diagnostics?.recordError?.({ source: "detail-related-panel", message: error instanceof Error ? error.message : String(error) });
                if (!this.diagnostics) /** @type {any} */ (globalThis).clog?.error("加载更多清单失败:", error);
                button.text("加载失败，请重试").prop("disabled", false);
            } finally { release(); if (generation === state.generation) state.loading = false; if (state.requestScope === scope) state.requestScope = null; }
        });
    }

    /** @param {any} state @param {any[]} related @param {any} container */
    display(state, related, container) {
        const jq = this.jquery;
        related.forEach((item) => {
            const title = jq("<a></a>").addClass("jhs-related-title").attr({ href: `/lists/${encodeURIComponent(item.id)}`, target: "_blank", rel: "noopener noreferrer" }).text(item.name || "未命名清单");
            const heading = jq('<div class="jhs-related-heading"></div>').append(jq("<span></span>").addClass("jhs-related-index").text(`#${state.floorIndex++}`), title);
            const meta = jq('<div class="jhs-related-meta"></div>');
            const formatted = item.createdAt ? this.formatDate(item.createdAt) : "未知";
            meta.append(jq("<span></span>").text(`视频：${Number(item.movieCount) || 0}`), jq("<span></span>").text(`收藏：${Number(item.collectionCount) || 0}`), jq("<span></span>").text(`查看：${Number(item.viewCount) || 0}`), jq('<time class="jhs-related-time"></time>').text(`创建时间：${formatted}`));
            container.append(jq('<article class="jhs-related-item"></article>').append(heading, meta));
        });
    }
}
