class HitShowPlugin extends BasePlugin {
    constructor() {
        super(), i(this, "$contentBox", $(".section .container")), i(this, "loadGeneration", 0);
    }
    getName() {
        return "HitShowPlugin";
    }
    async initCss() {
        return `<style>.jhs-hitshow-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--jhs-space-3);flex-wrap:wrap}.jhs-hitshow-title{margin:0!important}.jhs-hitshow-list{margin-top:var(--jhs-space-3)}</style>`;
    }
    async handle() {
        $('a[href*="rankings/playback"]').on("click", (e => {
            e.preventDefault(), e.stopPropagation(), window.location.href = "/advanced_search?handlePlayback=1&period=daily";
        })), await this.handlePlayback();
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("热播"), e.addClass("jhs-hitshow-title"), e.parent(".jhs-hitshow-heading").length || e.wrap('<header class="jhs-hitshow-heading"></header>'), $(".empty-message").remove(),
        $(".section .container .box").remove(), $(".movie-list.jhs-hitshow-list").remove(), this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-hitshow-list"></div>');
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
            $(".movie-list").html(this.markDataListHtml(movies));
            await this.initializeRenderedList();
            await this.getBean("ListPageButtonPlugin").sortItems();
            loadingObj.close(), loadingClosed = !0;
            void this.loadScore(movies, generation).then((async () => {
                if (generation === this.loadGeneration && "rateCount" === localStorage.getItem("jhs_sortMethod")) await this.getBean("ListPageButtonPlugin").sortItems();
            })).catch((error => clog.error("热播评分补全失败", error)));
        } catch (error) {
            clog.error("所有重试尝试均失败，无法获取数据。", error);
        } finally {
            loadingClosed || loadingObj.close();
        }
    }
    async fetchPlaybackWithRetry(period) {
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) try {
            return await W(period);
        } catch (error) {
            lastError = error;
            if (attempt < 3) clog.error(`获取热播数据失败 (第 ${attempt} 次重试)`, error), await new Promise((resolve => setTimeout(resolve, 1e3)));
        }
        throw lastError;
    }
    async initializeRenderedList() {
        const listPage = this.getBean("ListPagePlugin");
        listPage.replaceHdImg(), await listPage.doFilter(), listPage.applyVisibility();
        $(listPage.getSelector().itemSelector + " a").attr("target", "_blank"), this.getBean("CoverButtonPlugin").addSvgBtn();
    }
    toolBar(e) {
        $("#jhs-hitshow-period").remove();
        let t = `\n            <nav id="jhs-hitshow-period" class="jhs-segmented" role="tablist" aria-label="热播周期">\n                <a role="tab" class="jhs-segmented__item ${"daily" === e ? "active" : ""}" aria-selected="${"daily" === e ? "true" : "false"}" tabindex="${"daily" === e ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                <a role="tab" class="jhs-segmented__item ${"weekly" === e ? "active" : ""}" aria-selected="${"weekly" === e ? "true" : "false"}" tabindex="${"weekly" === e ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                <a role="tab" class="jhs-segmented__item ${"monthly" === e ? "active" : ""}" aria-selected="${"monthly" === e ? "true" : "false"}" tabindex="${"monthly" === e ? "0" : "-1"}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n            </nav>\n        `;
        $(".jhs-hitshow-heading").append(t);
    }
    getStarRating(e) {
        let t = "";
        const n = Math.floor(e);
        for (let a = 0; a < n; a++) t += '<i class="icon-star"></i>';
        for (let a = 0; a < 5 - n; a++) t += '<i class="icon-star gray"></i>';
        return t;
    }
    async loadScore(movies, generation = this.loadGeneration) {
        if (0 === movies.length) return;
        const cacheKey = "jhs_score_info";
        let cache = {};
        try { cache = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch (error) { clog.warn("评分缓存解析失败，将重新建立缓存", error); }
        const queue = [ ...movies ], workers = Array.from({ length: Math.min(4, queue.length) }, (() => this.scoreWorker(queue, cache, generation)));
        await Promise.all(workers), localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
    async scoreWorker(queue, cache, generation) {
        for (;;) {
            const movie = queue.shift();
            if (!movie) return;
            try {
                if (generation !== this.loadGeneration) return;
                const id = movie.id;
                if (!$(`#score_${id}`).length || $(`#${id}`).is(":hidden")) continue;
                if (cache[id]) {
                    const cached = this.normalizeScoreData(cache[id]);
                    this.appendScore(id, cached.score, cached.watchedCount);
                    continue;
                }
                const result = await V(id);
                if (generation !== this.loadGeneration) return;
                const score = Number(result.score), watchedCount = Number(result.watchedCount);
                this.appendScore(id, score, watchedCount), cache[id] = { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
            } catch (error) {
                $(`#${movie.id}`).attr("data-jhs-rate-count", "0"), clog.error(`解析评分数据失败 | 编号: ${movie.number}\n`, `错误详情: ${error.message}\n`, error.stack ? `调用栈:\n${error.stack}` : "");
            }
        }
    }
    normalizeScoreData(value) {
        const html = "string" == typeof value ? value : String(value?.html || ""), score = Number(value?.score ?? (html.match(/([\d.]+)分/) || [ 0, 0 ])[1]), watchedCount = Number(value?.watchedCount ?? (html.match(/由(\d+)人/) || [ 0, 0 ])[1]);
        return { score: Number.isFinite(score) ? score : 0, watchedCount: Number.isFinite(watchedCount) ? watchedCount : 0 };
    }
    appendScore(e, score, watchedCount = 0) {
        const safeScore = Math.min(5, Math.max(0, Number(score) || 0)), safeCount = Math.max(0, Number(watchedCount) || 0), card = $(`#${e}`), target = $(`#score_${e}`);
        card.attr("data-jhs-rate-count", String(safeCount));
        if (!target.length || "" !== target.text().trim()) return;
        const value = $('<span class="value"></span>'), stars = $('<span class="score-stars"></span>').html(this.getStarRating(safeScore));
        value.append(stars, document.createTextNode(`  ${safeScore}分，由${safeCount}人评价`)), target.hide().empty().append(value).slideDown(500);
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach(((e, index) => {
            const coverUrl = normalizeHttpUrl(String(e.cover_url || "").replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com"));
            t += `\n                <div class="item" id="${escapeHtml(e.id)}" data-jhs-publish-time="${escapeHtml(e.release_date)}" data-jhs-rate-count="0" data-original-index="${index}">\n                    <a href="/v/${escapeHtml(e.id)}" class="box" title="${escapeHtml(e.origin_title)}">\n                        <div class="cover ">${coverUrl ? `<img loading="lazy" src="${escapeHtml(coverUrl)}" alt="">` : ""}</div>\n                        <div class="video-title"><strong>${escapeHtml(e.number)}</strong> ${escapeHtml(e.origin_title)}</div>\n                        <div class="score" id="score_${escapeHtml(e.id)}"></div>\n                        <div class="meta">${escapeHtml(e.release_date)}</div>\n                        <div class="jhs-toolbar">\n                           ${e.has_cnsub ? '<span class="jhs-badge jhs-badge--watch">含中字磁力</span>' : e.magnets_count > 0 ? '<span class="jhs-badge jhs-badge--success">含磁力</span>' : '<span class="jhs-badge jhs-badge--neutral">无磁力</span>'}\n                           ${e.new_magnets ? '<span class="jhs-badge jhs-badge--accent">今日新增</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
