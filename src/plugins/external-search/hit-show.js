// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";
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
        return `<style>.jhs-hitshow-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--jhs-space-3);flex-wrap:wrap}.jhs-hitshow-title{margin:0!important}.jhs-hitshow-list{margin-top:var(--jhs-space-3)}</style>`;
    }
    async handle() {
        $('a[href*="rankings/playback"]').on("click", ((/** @type {MouseEvent} */ e) => {
            e.preventDefault(), e.stopPropagation(), window.location.href = "/advanced_search?handlePlayback=1&period=daily";
        })), await this.handlePlayback();
    }
    hookPage() {
        const host = this.getRuntimeService("host"), listRoot = host.locateListRoot?.(), contentBox = host.getListContainer?.();
        if (!listRoot || !contentBox) throw new Error("JavDB 列表容器不可用");
        this.$contentBox = $(contentBox), this.$listRoot = $(host.createOwnedListRoot([ "jhs-hitshow-list" ]));
        let e = $("h2.section-title");
        e.contents().first().replaceWith("热播"), e.addClass("jhs-hitshow-title"), e.parent(".jhs-hitshow-heading").length || e.wrap('<header class="jhs-hitshow-heading"></header>'), $(".empty-message").remove(),
        this.$contentBox.children(".box").remove(), this.$contentBox.children(".jhs-hitshow-list").remove(), this.$contentBox.append(this.$listRoot);
    }
    async handlePlayback() {
        if (!isHitShowPage()) return;
        const period = new URLSearchParams(window.location.search).get("period"), generation = ++this.loadGeneration;
        this.hookPage(), this.toolBar(period);
        const loadingObj = loading();
        let loadingClosed = !1;
        try {
            const movies = await this.fetchPlaybackWithRetry(period);
            if (generation !== this.loadGeneration) return;
            this.$listRoot.html(this.markDataListHtml(movies));
            await this.initializeRenderedList();
            await this.getDependency("ListPageButtonPlugin").sortItems();
            loadingObj.close(), loadingClosed = !0;
            void this.loadScore(movies, generation).then((async () => {
                if (generation === this.loadGeneration && "rateCount" === this.getRuntimeService("settings").snapshot().sortMethod) await this.getDependency("ListPageButtonPlugin").sortItems();
            })).catch((error => clog.error("热播评分补全失败", error)));
        } catch (error) {
            clog.error("所有重试尝试均失败，无法获取数据。", error);
        } finally {
            loadingClosed || loadingObj.close();
        }
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
        const listPage = this.getDependency("ListPagePlugin");
        listPage.replaceHdImg(), await listPage.doFilter(), listPage.applyVisibility(), listPage.bindMovieDetailNavigation(listPage.getSelector().boxSelector);
        this.getDependency("CoverButtonPlugin").addSvgBtn();
    }
    toolBar(/** @type {string | null} */ e) {
        $("#jhs-hitshow-period").remove();
        let t = `\n            <nav id="jhs-hitshow-period" class="jhs-segmented" role="tablist" aria-label="热播周期">\n                <a role="tab" class="jhs-segmented__item ${"daily" === e ? "active" : ""}" aria-selected="${"daily" === e ? "true" : "false"}" tabindex="${"daily" === e ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                <a role="tab" class="jhs-segmented__item ${"weekly" === e ? "active" : ""}" aria-selected="${"weekly" === e ? "true" : "false"}" tabindex="${"weekly" === e ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                <a role="tab" class="jhs-segmented__item ${"monthly" === e ? "active" : ""}" aria-selected="${"monthly" === e ? "true" : "false"}" tabindex="${"monthly" === e ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n            </nav>\n        `;
        $(".jhs-hitshow-heading").append(t);
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
        const cacheKey = "jhs_score_info";
        const cacheService = this.getRuntimeService("cache"), cached = cacheService.get(cacheKey, { scope: "public" });
        const cache = cached.hit && cached.value && typeof cached.value === "object" ? { ...cached.value } : {};
        const queue = [ ...movies ], workers = Array.from({ length: Math.min(4, queue.length) }, (() => this.scoreWorker(queue, cache, generation)));
        await Promise.all(workers), cacheService.set(cacheKey, cache, { scope: "public", ttlMs: 604_800_000 });
    }
    async scoreWorker(/** @type {HitMovie[]} */ queue, /** @type {Record<string, any>} */ cache, /** @type {number} */ generation) {
        for (;;) {
            const movie = queue.shift();
            if (!movie) return;
            try {
                if (generation !== this.loadGeneration) return;
                const id = movie.movieId ?? movie.id;
                if (!$(`#score_${id}`).length || $(`#${id}`).is(":hidden")) continue;
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
    markDataListHtml(/** @type {HitMovie[]} */ e) {
        let t = "";
        return e.forEach(((e, index) => {
            const id = e.movieId ?? e.id, carNum = e.carNum ?? e.number, title = e.title ?? e.origin_title,
                releaseDate = e.releaseDate ?? e.release_date, coverUrl = normalizeHttpUrl(e.coverUrl ?? e.cover_url),
                hasSubtitle = e.hasSubtitle ?? e.has_cnsub, magnetCount = Number(e.magnetCount ?? e.magnets_count), newMagnets = e.newMagnets ?? e.new_magnets;
            t += `\n                <div class="item" id="${escapeHtml(id)}" data-jhs-publish-time="${escapeHtml(releaseDate)}" data-jhs-rate-count="0" data-original-index="${index}">\n                    <a href="/v/${escapeHtml(id)}" class="box" title="${escapeHtml(title)}">\n                        <div class="cover ">${coverUrl ? `<img loading="lazy" src="${escapeHtml(coverUrl)}" alt="">` : ""}</div>\n                        <div class="video-title"><strong>${escapeHtml(carNum)}</strong> ${escapeHtml(title)}</div>\n                        <div class="score" id="score_${escapeHtml(id)}"></div>\n                        <div class="meta">${escapeHtml(releaseDate)}</div>\n                        <div class="jhs-toolbar">\n                           ${hasSubtitle ? '<span class="jhs-badge jhs-badge--watch">含中字磁力</span>' : magnetCount > 0 ? '<span class="jhs-badge jhs-badge--success">含磁力</span>' : '<span class="jhs-badge jhs-badge--neutral">无磁力</span>'}\n                           ${newMagnets ? '<span class="jhs-badge jhs-badge--accent">今日新增</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
