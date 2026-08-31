// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { normalizeJavdbMediaUrl } from "../../core/feature-helpers.js";
import { isHitShowPage } from "../../core/site-context.js";

/** @typedef {Record<string, any>} HitMovie */

/** Own the JavDB hot-ranking page and its score completion pipeline. */
export class HitShowController {
    /** @param {{document?: Document, window?: any, hostAdapter: any, movie: any, settings: any, storage: any, features: any, listActions?: any, coverActions?: any, eventBus?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.hostAdapter = options.hostAdapter;
        this.movie = options.movie;
        this.settings = options.settings;
        this.storage = options.storage;
        this.features = options.features;
        this.listActions = options.listActions;
        this.coverActions = options.coverActions;
        this.eventBus = options.eventBus;
        this.ui = options.ui;
        this.scope = options.scope;
        /** @type {any} */ this.$contentBox = null;
        /** @type {any} */ this.$listRoot = null;
        this.loadGeneration = 0;
        this.discoveryApi = null;
        this.started = false;
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? this.window?.jQuery; }
    getLoading() { return this.ui?.getLoading?.(); }
    getShow() { return this.ui?.show ?? {}; }
    getClog() { return this.ui?.getClog?.() ?? {}; }

    /** Start the hot-ranking page enhancement. */
    /** @param {{discoveryApi?: any}} [options] */
    async start(options = {}) {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        this.discoveryApi = options.discoveryApi;
        this.scope.addCleanup(() => this.dispose());
        const $ = this.getJQuery(), links = $("a[href*=\"rankings/playback\"]");
        links.off("click.jhsHitShow").on("click.jhsHitShow", (/** @type {MouseEvent} */ event) => {
            if (event.ctrlKey || event.metaKey || event.button === 1) return void this.window.open("/advanced_search?handlePlayback=1&period=daily", "_blank");
            event.preventDefault();
            event.stopPropagation();
            this.window.location.href = "/advanced_search?handlePlayback=1&period=daily";
        });
        this.scope.addCleanup(() => links.off("click.jhsHitShow"));
        await this.handlePlayback();
    }

    async handlePlayback() {
        if (!isHitShowPage(this.window.location)) return;
        const $ = this.getJQuery(), period = new URLSearchParams(this.window.location.search).get("period"), generation = ++this.loadGeneration;
        const loadingFactory = this.getLoading(), loadingObj = loadingFactory?.(), loadingClosed = { value: false };
        try {
            this.hookPage();
            this.toolBar(period);
            await this.listActions?.mountOwnedRankingControls?.(null, this.discoveryApi)?.catch?.((/** @type {unknown} */ error) => this.getClog().error?.("热播操作按钮挂载失败", error));
            const movies = await this.fetchPlaybackWithRetry(period);
            if (generation !== this.loadGeneration) return;
            if (!movies.length) return void this.renderState("当前周期暂无热播数据");
            this.$listRoot.html(this.markDataListHtml(movies));
            await this.initializeRenderedList();
            $("#jhs-hitshow-period").length || $(".jhs-hitshow-heading").length && this.toolBar(period);
            loadingObj?.close?.();
            loadingClosed.value = true;
            void this.loadScore(movies, generation).catch((error) => this.getClog().error?.("热播评分补全失败", error));
        } catch (error) {
            this.getClog().error?.("所有重试尝试均失败，无法获取数据。", error);
            this.$listRoot?.length ? this.renderState("热播数据加载失败，请稍后重试", true) : this.getShow().error?.("热播页面初始化失败");
        } finally {
            loadingClosed.value || loadingObj?.close?.();
        }
    }

    hookPage() {
        const $ = this.getJQuery(), contentBox = this.hostAdapter?.getListContainer?.() ?? this.hostAdapter?.getListLayoutContainer?.();
        if (!contentBox || !this.hostAdapter?.createOwnedListRoot) throw new Error("JavDB 列表容器不可用");
        this.$contentBox = $(contentBox);
        this.$listRoot = $(this.hostAdapter.createOwnedListRoot([ "jhs-hitshow-list" ]));
        let title = $("h2.section-title");
        title.length || (title = $("<h2></h2>").addClass("section-title").prependTo(this.$contentBox));
        title.contents().first().replaceWith("热播");
        title.addClass("jhs-hitshow-title");
        title.parent(".jhs-hitshow-heading").length || title.wrap('<header class="jhs-hitshow-heading"></header>');
        $(".empty-message").remove();
        this.$contentBox.children(".box,.jhs-hitshow-list").remove();
        this.$contentBox.append(this.$listRoot);
    }

    /** @param {string} message @param {boolean} [retryable] */
    renderState(message, retryable = false) {
        if (!this.$listRoot?.length) return;
        const $ = this.getJQuery(), state = $("<div></div>").addClass(`jhs-hitshow-state${retryable ? " jhs-hitshow-state--error" : ""}`).attr("role", retryable ? "alert" : "status"), text = $("<p></p>").text(message);
        state.append(text);
        retryable && state.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary\"></button>").text("重新加载").on("click", () => void this.handlePlayback()));
        this.$listRoot.empty().append(state);
    }

    async fetchPlaybackWithRetry(/** @type {string | null} */ period) {
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) try {
            return await this.movie.rankings({ period, scope: this.scope });
        } catch (error) {
            lastError = error;
            if (attempt < 3) {
                this.getClog().error?.(`获取热播数据失败 (第 ${attempt} 次重试)`, error);
                await new Promise((resolve) => setTimeout(resolve, 1e3));
            }
        }
        throw lastError;
    }

    async initializeRenderedList() {
        let listFeature = null;
        try { listFeature = await this.features.getFeatureApi("list"); }
        catch (error) { this.getClog().warn?.("列表 Feature API 不可用，跳过状态管线", error); }
        if (listFeature) {
            const revision = listFeature.advanceListGeneration?.() ?? null, hoverBigImg = this.settings.snapshot().hoverBigImg;
            listFeature.configureHoverPreview(hoverBigImg === "yes" ? "yes" : "no");
            listFeature.replaceHdImg();
            await listFeature.doFilter(revision || undefined);
            await listFeature.createQuickFilter?.();
            revision !== null && listFeature.reconcileListItems ? listFeature.reconcileListItems(null, revision) : listFeature.applyVisibility();
            listFeature.rebuildItemIndex?.();
            listFeature.bindMovieDetailNavigation(listFeature.getListSelectors().boxSelector);
            await listFeature.bindClick?.();
        }
        await this.coverActions?.addSvgBtn?.();
        await this.eventBus?.emit?.("list-items-added", { items: this.$listRoot?.find(".item").toArray() ?? [] }, { broadcast: false });
    }

    /** @param {string | null} period */
    toolBar(period) {
        const $ = this.getJQuery(), active = period === "weekly" ? "weekly" : period === "monthly" ? "monthly" : "daily";
        $("#jhs-hitshow-period").remove();
        const tab = (/** @type {string} */ value, /** @type {string} */ label) => `<a role="tab" class="jhs-segmented__item ${active === value ? "active" : ""}" aria-selected="${active === value ? "true" : "false"}" tabindex="${active === value ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=${value}">${label}</a>`;
        const html = `<nav id="jhs-hitshow-period" class="jhs-segmented" role="tablist" aria-label="热播周期">${tab("daily", "日榜")}${tab("weekly", "周榜")}${tab("monthly", "月榜")}</nav>`, heading = $(".jhs-hitshow-heading");
        if (!heading.length) return;
        const title = heading.children("h2.section-title");
        title.length ? title.after(html) : heading.append(html);
        const nav = $("#jhs-hitshow-period");
        nav.off("keydown.jhsPeriod").on("keydown.jhsPeriod", (/** @type {any} */ event) => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const items = nav.find('[role="tab"]'), index = items.index(event.target), next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowRight" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.get(next)?.focus();
        });
        this.scope.addCleanup(() => nav.off("keydown.jhsPeriod"));
    }

    /** @param {number} score */
    getStarRating(score) {
        const full = Math.floor(score);
        return `${'<i class="icon-star"></i>'.repeat(full)}${'<i class="icon-star gray"></i>'.repeat(5 - full)}`;
    }

    async loadScore(/** @type {HitMovie[]} */ movies, /** @type {number} */ generation = this.loadGeneration) {
        if (!movies.length) return;
        const cacheKey = "jhs_hitshow_scores_v1", persisted = await this.storage.cachedRequest(cacheKey, 604_800_000, async () => ({})), cache = persisted && typeof persisted === "object" && !Array.isArray(persisted) ? { ...persisted } : {}, queue = [ ...movies ];
        await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => this.scoreWorker(queue, cache, generation)));
        generation === this.loadGeneration && await this.storage.cacheSet(cacheKey, cache, 604_800_000);
        if (generation === this.loadGeneration && this.listActions?.activeSortMethod?.() === "rateCount") await this.listActions.sortItems?.();
    }

    async scoreWorker(/** @type {HitMovie[]} */ queue, /** @type {Record<string, any>} */ cache, /** @type {number} */ generation) {
        const $ = this.getJQuery();
        for (;;) {
            const movie = queue.shift();
            if (!movie) return;
            try {
                if (generation !== this.loadGeneration) return;
                const id = movie.movieId ?? movie.id;
                if (!$(`#score_${id}`).length) continue;
                if (cache[id]) {
                    const cached = this.normalizeScoreData(cache[id]);
                    this.appendScore(id, cached.score, cached.watchedCount);
                    continue;
                }
                const result = await this.movie.detail({ movieId: id, providerId: "javdb" }, { scope: this.scope });
                if (!result) throw new Error("JavDB 影片详情不存在");
                if (generation !== this.loadGeneration) return;
                const score = Number(result.score), watchedCount = Number(result.watchedCount);
                this.appendScore(id, score, watchedCount);
                cache[id] = { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
            } catch (error) {
                const failure = error instanceof Error ? error : new Error(String(error));
                $(`#${movie.movieId ?? movie.id}`).attr("data-jhs-rate-count", "0");
                this.getClog().error?.(`解析评分数据失败 | 编号: ${movie.carNum ?? movie.number}\n`, `错误详情: ${failure.message}\n`, failure.stack ? `调用栈:\n${failure.stack}` : "");
            }
        }
    }

    normalizeScoreData(/** @type {unknown} */ value) {
        const record = value && typeof value === "object" ? /** @type {HitMovie} */ (value) : {}, html = typeof value === "string" ? value : String(record.html || "");
        return { score: Number.isFinite(Number(record.score ?? (html.match(/([\d.]+)分/) || [ 0, 0 ])[1])) ? Number(record.score ?? (html.match(/([\d.]+)分/) || [ 0, 0 ])[1]) : 0, watchedCount: Number.isFinite(Number(record.watchedCount ?? (html.match(/由(\d+)人/) || [ 0, 0 ])[1])) ? Number(record.watchedCount ?? (html.match(/由(\d+)人/) || [ 0, 0 ])[1]) : 0 };
    }

    /** @param {string | number} id @param {unknown} score @param {unknown} [watchedCount] */
    appendScore(id, score, watchedCount = 0) {
        const $ = this.getJQuery(), safeScore = Math.min(5, Math.max(0, Number(score) || 0)), safeCount = Math.max(0, Number(watchedCount) || 0), card = $(`#${id}`), target = $(`#score_${id}`);
        card.attr("data-jhs-rate-count", String(safeCount));
        if (!target.length || target.text().trim() !== "") return;
        const value = $('<span class="value"></span>'), stars = $('<span class="score-stars"></span>').html(this.getStarRating(safeScore));
        value.append(stars, this.document.createTextNode(`  ${safeScore}分，由${safeCount}人评价`));
        target.hide().empty().append(value).slideDown(500);
    }

    /** @param {HitMovie[]} movies @param {{thumbnailFirst?: boolean}} [options] */
    markDataListHtml(movies, { thumbnailFirst = true } = {}) {
        let html = "";
        movies.forEach((movie, index) => {
            const id = movie.movieId ?? movie.id, carNum = movie.carNum ?? movie.number, title = movie.title ?? movie.origin_title, releaseDate = movie.releaseDate ?? movie.release_date, coverUrl = normalizeJavdbMediaUrl(movie.coverUrl ?? movie.cover_url, this.window.location.href), explicitThumbUrl = normalizeJavdbMediaUrl(movie.thumbUrl ?? movie.thumb_url, this.window.location.href), thumbUrl = explicitThumbUrl ?? (coverUrl ? coverUrl.replace("/covers/", "/thumbs/") : null), initialImageUrl = thumbnailFirst ? thumbUrl ?? coverUrl : coverUrl ?? thumbUrl, fullImageUrl = coverUrl ?? thumbUrl ?? "", hasSubtitle = movie.hasSubtitle ?? movie.has_cnsub, magnetCount = Number(movie.magnetCount ?? movie.magnets_count), newMagnets = movie.newMagnets ?? movie.new_magnets;
            html += `<div class="item" id="${escapeHtml(id)}" data-jhs-publish-time="${escapeHtml(releaseDate)}" data-jhs-rate-count="0" data-original-index="${index}"><a href="/v/${escapeHtml(id)}" class="box" title="${escapeHtml(title)}"><div class="cover ">${initialImageUrl ? `<img loading="lazy" decoding="async" src="${escapeHtml(initialImageUrl)}" data-full="${escapeHtml(fullImageUrl)}" alt="">` : ""}</div><div class="video-title"><strong>${escapeHtml(carNum)}</strong> ${escapeHtml(title)}</div><div class="score" id="score_${escapeHtml(id)}"></div><div class="meta">${escapeHtml(releaseDate)}</div><div class="tags"></div><div class="jhs-toolbar">${hasSubtitle ? '<span class="jhs-badge jhs-badge--watch">含中字磁力</span>' : magnetCount > 0 ? '<span class="jhs-badge jhs-badge--success">含磁力</span>' : '<span class="jhs-badge jhs-badge--neutral">无磁力</span>'}${newMagnets ? '<span class="jhs-badge jhs-badge--accent">今日新增</span>' : ""}</div></a></div>`;
        });
        return html;
    }

    dispose() {
        this.loadGeneration++;
        this.started = false;
        this.discoveryApi = null;
    }
}
