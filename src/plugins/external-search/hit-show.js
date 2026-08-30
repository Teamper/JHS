// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { normalizeJavdbMediaUrl } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { isHitShowPage } from "../../core/site-context.js";

/** @typedef {Record<string, any>} HitMovie */

export class HitShowPlugin extends BasePlugin {
    constructor() {
        super();
        /** @type {any} */ this.$contentBox = null;
        /** @type {any} */ this.$listRoot = null;
        this.loadGeneration = 0;
    }
    getName() {
        return "HitShowPlugin";
    }
    async initCss() {
        return `<style>.jhs-hitshow-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--jhs-space-3);flex-wrap:wrap}.jhs-hitshow-title{margin:0!important}.jhs-hitshow-list{margin-top:var(--jhs-space-3)}.jhs-hitshow-state{display:flex;min-height:180px;align-items:center;justify-content:center;flex-direction:column;gap:var(--jhs-space-3);color:var(--jhs-text-muted);text-align:center}</style>`;
    }
    async handle() {
        $('a[href*="rankings/playback"]').on("click", ((/** @type {MouseEvent} */ e) => {
            // 修饰键/中键点击保留“新标签打开”的原生语义
            if (e.ctrlKey || e.metaKey || 1 === e.button) return void window.open("/advanced_search?handlePlayback=1&period=daily", "_blank");
            e.preventDefault(), e.stopPropagation(), window.location.href = "/advanced_search?handlePlayback=1&period=daily";
        })), await this.handlePlayback();
    }
    hookPage() {
        const host = this.getRuntimeService("host"), contentBox = host.getListContainer?.() ?? host.getListLayoutContainer?.();
        if (!contentBox || !host.createOwnedListRoot) throw new Error("JavDB 列表容器不可用");
        this.$contentBox = $(contentBox), this.$listRoot = $(host.createOwnedListRoot([ "jhs-hitshow-list" ]));
        let e = $("h2.section-title");
        e.length || (e = $("<h2></h2>").addClass("section-title").prependTo(this.$contentBox)), e.contents().first().replaceWith("热播"), e.addClass("jhs-hitshow-title"), e.parent(".jhs-hitshow-heading").length || e.wrap('<header class="jhs-hitshow-heading"></header>'), $(".empty-message").remove(),
        this.$contentBox.children(".box").remove(), this.$contentBox.children(".jhs-hitshow-list").remove(), this.$contentBox.append(this.$listRoot);
    }
    async handlePlayback() {
        if (!isHitShowPage()) return;
        const period = new URLSearchParams(window.location.search).get("period"), generation = ++this.loadGeneration, loadingObj = loading();
        let loadingClosed = !1;
        try {
            this.hookPage(), this.toolBar(period);
            // 操作按钮行（开始鉴定/批量操作/排序）挂进热播自有标题容器，由 ListPageButtonPlugin 提供
            await this.getOptionalDependency("ListPageButtonPlugin")?.mountOwnedRankingControls?.()?.catch?.((/** @type {unknown} */ error) => clog.error("热播操作按钮挂载失败", error));
            const movies = await this.fetchPlaybackWithRetry(period);
            if (generation !== this.loadGeneration) return;
            if (!movies.length) return void this.renderState("当前周期暂无热播数据");
            // 自有榜单初始固定“默认”（榜单原始顺序），排序由页内覆盖控制，不读全局 sortMethod
            this.$listRoot.html(this.markDataListHtml(movies));
            await this.initializeRenderedList();
            // 周期工具栏被任何后挂载 UI 挪走时自愈，保证日榜/周榜/月榜切换始终可见
            $("#jhs-hitshow-period").length || $(".jhs-hitshow-heading").length && this.toolBar(period);
            loadingObj.close(), loadingClosed = !0;
            void this.loadScore(movies, generation).catch((error => clog.error("热播评分补全失败", error)));
        } catch (error) {
            clog.error("所有重试尝试均失败，无法获取数据。", error);
            this.$listRoot?.length ? this.renderState("热播数据加载失败，请稍后重试", !0) : show.error("热播页面初始化失败");
        } finally {
            loadingClosed || loadingObj.close();
        }
    }
    /** @param {string} message @param {boolean} [retryable] */
    renderState(message, retryable = !1) {
        if (!this.$listRoot?.length) return;
        const state = $("<div></div>").addClass(`jhs-hitshow-state${retryable ? " jhs-hitshow-state--error" : ""}`).attr("role", retryable ? "alert" : "status"), text = $("<p></p>").text(message);
        state.append(text);
        if (retryable) state.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary\"></button>").text("重新加载").on("click", (() => void this.handlePlayback())));
        this.$listRoot.empty().append(state);
    }
    async fetchPlaybackWithRetry(/** @type {string | null} */ period) {
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) try {
            const scope = await this.getRuntimeService("scope")();
            return await this.getRuntimeService("movie").rankings({ period, scope });
        } catch (error) {
            lastError = error;
            if (attempt < 3) clog.error(`获取热播数据失败 (第 ${attempt} 次重试)`, error), await new Promise((resolve => setTimeout(resolve, 1e3)));
        }
        throw lastError;
    }
    async initializeRenderedList() {
        const listPage = this.getOptionalDependency("ListPagePlugin");
        if (listPage) {
            const revision = listPage.advanceListGeneration?.() ?? null;
            const hoverBigImg = this.getRuntimeService("settings").snapshot().hoverBigImg;
            listPage.configureHoverPreview(hoverBigImg === "yes" ? "yes" : "no"), listPage.replaceHdImg(), await listPage.doFilter(revision || undefined),
            // 自有榜单页（热播/Top250）不走 ListPagePlugin.handle，需手动恢复快速筛选条（待鉴定/已下载/全部等）
            // 并重建卡片索引，让 car-state-changed 的定向重筛能找到这些卡片
            await listPage.createQuickFilter?.(), revision !== null && listPage.reconcileListItems ? listPage.reconcileListItems(null, revision) : listPage.applyVisibility(), listPage.rebuildItemIndex?.(), listPage.bindMovieDetailNavigation(listPage.getSelector().boxSelector),
            // 补齐右键屏蔽与列表视频点击绑定（bindClick 已命名空间化，可重复调用）
            await listPage.bindClick?.();
        }
        await this.getOptionalDependency("CoverButtonPlugin")?.addSvgBtn?.();
        // 通知 Fc2NavigationPlugin 等监听者：自有榜单的卡片已就绪（FC2 保护与对话框导航延迟挂载）
        await jhsEventBus?.emit("list-items-added", { items: this.$listRoot?.find(".item").toArray() ?? [] }, { broadcast: !1 });
    }
    toolBar(/** @type {string | null} */ e) {
        $("#jhs-hitshow-period").remove();
        // URL 缺 period 参数时数据按日榜兜底，激活态须与之一致
        const active = "weekly" === e ? "weekly" : "monthly" === e ? "monthly" : "daily";
        const tab = (/** @type {string} */ value, /** @type {string} */ label) => `<a role="tab" class="jhs-segmented__item ${active === value ? "active" : ""}" aria-selected="${active === value ? "true" : "false"}" tabindex="${active === value ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=${value}">${label}</a>`;
        const t = `\n            <nav id="jhs-hitshow-period" class="jhs-segmented" role="tablist" aria-label="热播周期">\n                ${tab("daily", "日榜")}\n                ${tab("weekly", "周榜")}\n                ${tab("monthly", "月榜")}\n            </nav>\n        `;
        const heading = $(".jhs-hitshow-heading");
        if (!heading.length) return;
        // 插到标题之后而非容器末尾，避免自愈重排时被按钮行挤到下一行
        const title = heading.children("h2.section-title");
        title.length ? title.after(t) : heading.append(t);
        // roving tabindex 的方向键导航（左/右/Home/End）
        const nav = $("#jhs-hitshow-period");
        nav.off("keydown.jhsPeriod").on("keydown.jhsPeriod", ((/** @type {any} */ event) => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const items = nav.find("[role=\"tab\"]"), index = items.index(event.target);
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowRight" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.get(next)?.focus();
        }));
    }
    getStarRating(/** @type {number} */ e) {
        let t = "";
        const n = Math.floor(e);
        for (let a = 0; a < n; a++) t += '<i class="icon-star"></i>';
        for (let a = 0; a < 5 - n; a++) t += '<i class="icon-star gray"></i>';
        return t;
    }
    async loadScore(/** @type {HitMovie[]} */ movies, /** @type {number} */ generation = this.loadGeneration) {
        if (0 === movies.length) return;
        // 持久化评分缓存（7 天 TTL）：此前为页内内存缓存，每次整页导航（含周期切换）后清零，评分逐个重拉
        const cacheKey = "jhs_hitshow_scores_v1";
        const persisted = await storageManager.cachedRequest(cacheKey, 604_800_000, async () => ({}));
        const cache = persisted && "object" == typeof persisted && !Array.isArray(persisted) ? { ...persisted } : {};
        const queue = [ ...movies ], workers = Array.from({ length: Math.min(4, queue.length) }, (() => this.scoreWorker(queue, cache, generation)));
        await Promise.all(workers);
        // 错误态“重新加载”连点时，旧代际的结果不得写回缓存
        generation === this.loadGeneration && await storageManager.cacheSet(cacheKey, cache, 604_800_000);
        // 评分补全后按需重排：仅当生效排序为评价人数（页内覆盖或普通列表页的全局设置）时才需要二次排序
        if (generation === this.loadGeneration) {
            const listButtons = this.getOptionalDependency("ListPageButtonPlugin");
            if ("rateCount" === (listButtons?.activeSortMethod?.() ?? "default")) await listButtons?.sortItems?.();
        }
    }
    async scoreWorker(/** @type {HitMovie[]} */ queue, /** @type {Record<string, any>} */ cache, /** @type {number} */ generation) {
        for (;;) {
            const movie = queue.shift();
            if (!movie) return;
            try {
                if (generation !== this.loadGeneration) return;
                const id = movie.movieId ?? movie.id;
                // 仅在评分容器不存在时跳过；不能按可见性跳过——默认"待鉴定"筛选下被隐藏的卡片
                // 切回"全部/下载"后仍需有评分与评价人数，否则按评价人数排序会把它们沉底。
                if (!$(`#score_${id}`).length) continue;
                if (cache[id]) {
                    const cached = this.normalizeScoreData(cache[id]);
                    this.appendScore(id, cached.score, cached.watchedCount);
                    continue;
                }
                const scope = await this.getRuntimeService("scope")();
                const result = await this.getRuntimeService("movie").detail({ movieId: id, providerId: "javdb" }, { scope });
                if (!result) throw new Error("JavDB 影片详情不存在");
                if (generation !== this.loadGeneration) return;
                const score = Number(result.score), watchedCount = Number(result.watchedCount);
                this.appendScore(id, score, watchedCount), cache[id] = { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
            } catch (error) {
                const id = movie.movieId ?? movie.id, carNum = movie.carNum ?? movie.number;
                const failure = error instanceof Error ? error : new Error(String(error));
                $(`#${id}`).attr("data-jhs-rate-count", "0"), clog.error(`解析评分数据失败 | 编号: ${carNum}\n`, `错误详情: ${failure.message}\n`, failure.stack ? `调用栈:\n${failure.stack}` : "");
            }
        }
    }
    normalizeScoreData(/** @type {unknown} */ value) {
        const record = value && "object" == typeof value ? /** @type {HitMovie} */ (value) : {};
        const html = "string" == typeof value ? value : String(record.html || ""), score = Number(record.score ?? (html.match(/([\d.]+)分/) || [ 0, 0 ])[1]), watchedCount = Number(record.watchedCount ?? (html.match(/由(\d+)人/) || [ 0, 0 ])[1]);
        return { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
    }
    appendScore(/** @type {string | number} */ e, /** @type {unknown} */ score, /** @type {unknown} */ watchedCount = 0) {
        const safeScore = Math.min(5, Math.max(0, Number(score) || 0)), safeCount = Math.max(0, Number(watchedCount) || 0), card = $(`#${e}`), target = $(`#score_${e}`);
        card.attr("data-jhs-rate-count", String(safeCount));
        if (!target.length || "" !== target.text().trim()) return;
        const value = $('<span class="value"></span>'), stars = $('<span class="score-stars"></span>').html(this.getStarRating(safeScore));
        value.append(stars, document.createTextNode(`  ${safeScore}分，由${safeCount}人评价`)), target.hide().empty().append(value).slideDown(500);
    }
    /** @param {HitMovie[]} e @param {{thumbnailFirst?: boolean}} [options] */
    markDataListHtml(e, { thumbnailFirst = !0 } = {}) {
        let t = "";
        return e.forEach(((e, index) => {
            const id = e.movieId ?? e.id, carNum = e.carNum ?? e.number, title = e.title ?? e.origin_title,
                releaseDate = e.releaseDate ?? e.release_date, coverUrl = normalizeJavdbMediaUrl(e.coverUrl ?? e.cover_url), explicitThumbUrl = normalizeJavdbMediaUrl(e.thumbUrl ?? e.thumb_url),
                thumbUrl = explicitThumbUrl ?? (coverUrl ? coverUrl.replace("/covers/", "/thumbs/") : null), initialImageUrl = thumbnailFirst ? thumbUrl ?? coverUrl : coverUrl ?? thumbUrl, fullImageUrl = coverUrl ?? thumbUrl ?? "",
                hasSubtitle = e.hasSubtitle ?? e.has_cnsub, magnetCount = Number(e.magnetCount ?? e.magnets_count), newMagnets = e.newMagnets ?? e.new_magnets;
            t += `\n                <div class="item" id="${escapeHtml(id)}" data-jhs-publish-time="${escapeHtml(releaseDate)}" data-jhs-rate-count="0" data-original-index="${index}">\n                    <a href="/v/${escapeHtml(id)}" class="box" title="${escapeHtml(title)}">\n                        <div class="cover ">${initialImageUrl ? `<img loading="lazy" decoding="async" src="${escapeHtml(initialImageUrl)}" data-full="${escapeHtml(fullImageUrl)}" alt="">` : ""}</div>\n                        <div class="video-title"><strong>${escapeHtml(carNum)}</strong> ${escapeHtml(title)}</div>\n                        <div class="score" id="score_${escapeHtml(id)}"></div>\n                        <div class="meta">${escapeHtml(releaseDate)}</div>\n                        <div class="tags"></div>\n                        <div class="jhs-toolbar">\n                           ${hasSubtitle ? '<span class="jhs-badge jhs-badge--watch">含中字磁力</span>' : magnetCount > 0 ? '<span class="jhs-badge jhs-badge--success">含磁力</span>' : '<span class="jhs-badge jhs-badge--neutral">无磁力</span>'}\n                           ${newMagnets ? '<span class="jhs-badge jhs-badge--accent">今日新增</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
