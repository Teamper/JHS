class HitShowPlugin extends BasePlugin {
    constructor() {
        super(), i(this, "$contentBox", $(".section .container"));
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
        $(".section .container .box").remove(), this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-hitshow-list"></div>');
    }
    async handlePlayback() {
        if (!window.location.href.includes("handlePlayback=1")) return;
        let e = new URLSearchParams(window.location.search).get("period");
        this.hookPage(), this.toolBar(e);
        let t = $(".movie-list");
        t.html("");
        let n = loading();
        let a = !1;
        for (let s = 1; s <= 3 && !a; s++) try {
            const n = await W(e);
            let i = this.markDataListHtml(n);
            t.html(i), await this.loadScore(n), await this.getBean("ListPageButtonPlugin").sortItems(), a = !0;
        } catch (i) {
            s < 3 ? (clog.error(`获取热播数据失败 (第 ${s} 次重试)`, i), await new Promise((e => setTimeout(e, 1e3)))) : clog.error("所有重试尝试均失败，无法获取数据。", i);
        } finally {
            (a || 3 === s) && n.close();
        }
    }
    toolBar(e) {
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
    async loadScore(e) {
        if (0 === e.length) return;
        let t = "jhs_score_info";
        for (const a of e) try {
                const e = a.id;
                if (!$(`#score_${e}`).length) continue;
                if ($(`#${e}`).is(":hidden")) continue;
                const n = localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {}, i = n[e];
                if (i) {
                    const t = "string" == typeof i ? (i.match(/由(\d+)人/) || [ 0, 0 ])[1] : i.watchedCount || 0;
                    this.appendScoreHtml(e, "string" == typeof i ? i : i.html, Number(t));
                    continue;
                }
                for (;!document.hasFocus(); ) await new Promise((e => setTimeout(e, 500)));
                const s = await V(e);
                let o = s.score, r = s.watchedCount, l = `\n                        <span class="value">\n                            <span class="score-stars">${this.getStarRating(o)}</span> \n                            &nbsp; ${o}分，由${r}人評價\n                        </span>\n                    `;
                this.appendScoreHtml(e, l, r), n[e] = { html: l, watchedCount: r }, localStorage.setItem(t, JSON.stringify(n)),
                await new Promise((e => setTimeout(e, 500)));
            } catch (n) {
                $(`#${a.id}`).attr("data-jhs-rate-count", "0"), clog.error(`解析评分数据失败 | 编号: ${a.number}\n`, `错误详情: ${n.message}\n`, n.stack ? `调用栈:\n${n.stack}` : "");
            }
    }
    appendScoreHtml(e, t, n = 0) {
        $(`#${e}`).attr("data-jhs-rate-count", String(Number(n) || 0));
        let a = $(`#score_${e}`);
        a.length && "" === a.html().trim() && a.slideUp(0, (function() {
            $(this).html(t).slideDown(500);
        }));
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach(((e, index) => {
            t += `\n                <div class="item" id="${escapeHtml(e.id)}" data-jhs-publish-time="${escapeHtml(e.release_date)}" data-jhs-rate-count="0" data-original-index="${index}">\n                    <a href="/v/${escapeHtml(e.id)}" class="box" title="${escapeHtml(e.origin_title)}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${e.cover_url.replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${escapeHtml(e.number)}</strong> ${escapeHtml(e.origin_title)}</div>\n                        <div class="score" id="score_${escapeHtml(e.id)}"></div>\n                        <div class="meta">${escapeHtml(e.release_date)}</div>\n                        <div class="tags has-addons">\n                           ${e.has_cnsub ? '<span class="tag is-warning">含中字磁鏈</span>' : e.magnets_count > 0 ? '<span class="tag is-success">含磁鏈</span>' : '<span class="tag is-info">无磁鏈</span>'}\n                           ${e.new_magnets ? '<span class="tag is-info">今日新種</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
