class pe extends X {
    constructor() {
        super(), i(this, "$contentBox", $(".section .container"));
    }
    getName() {
        return "HitShowPlugin";
    }
    handle() {
        $('a[href*="rankings/playback"]').on("click", (e => {
            e.preventDefault(), e.stopPropagation(), window.location.href = "/advanced_search?handlePlayback=1&period=daily";
        })), this.handlePlayback().then();
    }
    hookPage() {
        let e = $("h2.section-title");
        e.contents().first().replaceWith("热播"), e.css("marginBottom", "0"), $(".empty-message").remove(),
        $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>');
    }
    async handlePlayback() {
        if (!window.location.href.includes("handlePlayback=1")) return;
        let e = new URLSearchParams(window.location.search).get("period");
        this.toolBar(e), this.hookPage();
        let t = $(".movie-list");
        t.html("");
        let n = loading();
        let a = !1;
        for (let s = 1; s <= 3 && !a; s++) try {
            const n = await W(e);
            let i = this.markDataListHtml(n);
            t.html(i), this.loadScore(n), a = !0;
        } catch (i) {
            s < 3 ? (clog.error(`获取热播数据失败 (第 ${s} 次重试)`, i), await new Promise((e => setTimeout(e, 1e3)))) : clog.error("所有重试尝试均失败，无法获取数据。", i);
        } finally {
            (a || 3 === s) && n.close();
        }
    }
    toolBar(e) {
        let t = `\n            <div class="button-group" style="margin-top:18px">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small ${"daily" === e ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"weekly" === e ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"monthly" === e ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n                </div>\n            </div>\n        `;
        this.$contentBox.append(t);
    }
    getStarRating(e) {
        let t = "";
        const n = Math.floor(e);
        for (let a = 0; a < n; a++) t += '<i class="icon-star"></i>';
        for (let a = 0; a < 5 - n; a++) t += '<i class="icon-star gray"></i>';
        return t;
    }
    loadScore(e) {
        if (0 === e.length) return;
        (async () => {
            let t = "jhs_score_info";
            for (const a of e) try {
                const e = a.id;
                if (!$(`#score_${e}`).length) return;
                if ($(`#${e}`).is(":hidden")) continue;
                const n = localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {}, i = n[e];
                if (i) {
                    this.appendScoreHtml(e, i);
                    continue;
                }
                for (;!document.hasFocus(); ) await new Promise((e => setTimeout(e, 500)));
                const s = await V(e);
                let o = s.score, r = s.watchedCount, l = `\n                        <span class="value">\n                            <span class="score-stars">${this.getStarRating(o)}</span> \n                            &nbsp; ${o}分，由${r}人評價\n                        </span>\n                    `;
                this.appendScoreHtml(e, l), n[e] = l, localStorage.setItem(t, JSON.stringify(n)),
                await new Promise((e => setTimeout(e, 500)));
            } catch (n) {
                clog.error(`🚨 解析评分数据失败 | 编号: ${a.number}\n`, `错误详情: ${n.message}\n`, n.stack ? `调用栈:\n${n.stack}` : "");
            }
        })();
    }
    appendScoreHtml(e, t) {
        let n = $(`#score_${e}`);
        n.length && "" === n.html().trim() && n.slideUp(0, (function() {
            $(this).html(t).slideDown(500);
        }));
    }
    markDataListHtml(e) {
        let t = "";
        return e.forEach((e => {
            t += `\n                <div class="item" id="${e.id}">\n                    <a href="/v/${e.id}" class="box" title="${e.origin_title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${e.cover_url.replace("https://tp-iu.cmastd.com/rhe951l4q", "https://c0.jdbstatic.com")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${e.number}</strong> ${e.origin_title}</div>\n                        <div class="score" id="score_${e.id}">\n                        </div>\n                        <div class="meta">\n                            ${e.release_date}\n                        </div>\n                        <div class="tags has-addons">\n                           ${e.has_cnsub ? '<span class="tag is-warning">含中字磁鏈</span>' : e.magnets_count > 0 ? '<span class="tag is-success">含磁鏈</span>' : '<span class="tag is-info">无磁鏈</span>'}\n                           ${e.new_magnets ? '<span class="tag is-info">今日新種</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        })), t;
    }
}
