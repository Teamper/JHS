class $e extends X {
    constructor() {
        super(...arguments), i(this, "floorIndex", 1), i(this, "isInit", !1);
    }
    getName() {
        return "ReviewPlugin";
    }
    async handle() {
        if (window.isDetailPage) {
            if (r) {
                const e = this.parseMovieId(window.location.href);
                await this.showReview(e), await this.getBean("RelatedPlugin").showRelated($("#magnets-content"), e);
            }
            if (l) {
                let e = this.getPageInfo().carNum;
                const t = await (async e => {
                    let t = `${U}/v2/search`, n = {
                        "user-agent": "Dart/3.5 (dart:io)",
                        "accept-language": "zh-TW",
                        host: "jdforrepam.com",
                        jdsignature: await O()
                    }, a = {
                        q: e,
                        page: 1,
                        type: "movie",
                        limit: 1,
                        movie_type: "all",
                        from_recent: "false",
                        movie_filter_by: "all",
                        movie_sort_by: "relevance"
                    };
                    return (await gmHttp.get(t, a, n)).data.movies;
                })(e);
                let n = null;
                for (let a = 0; a < t.length; a++) {
                    let i = t[a];
                    if (i.number.toLowerCase() === e.toLowerCase()) {
                        n = i.id;
                        break;
                    }
                }
                if (!n) return;
                this.showReview(n, $("#sample-waterfall")).then();
            }
        }
    }
    async showReview(e, t) {
        const n = await storageManager.getSetting("enableLoadReview", _), a = t || $("#magnets-content");
        a.append(`\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;" data-tip="想要发表评论? 滑上去, 点击上面的按钮-看过">评论区</span>\n                <a id="reviewsFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${n === _ ? "折叠" : "展开"}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${n === _ ? "▲" : "▼"}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `),
        $("#reviewsFold").on("click", (t => {
            t.preventDefault(), t.stopPropagation();
            const n = $("#reviewsFold .toggle-text"), a = $("#reviewsFold .toggle-icon"), i = "展开" === n.text();
            n.text(i ? "折叠" : "展开"), a.text(i ? "▲" : "▼"), i ? ($("#reviewsContainer").show(),
            $("#reviewsFooter").show(), this.isInit || (this.fetchAndDisplayReviews(e), this.isInit = !0),
            storageManager.saveSettingItem("enableLoadReview", _)) : ($("#reviewsContainer").hide(),
            $("#reviewsFooter").hide(), storageManager.saveSettingItem("enableLoadReview", C));
        })), a.append('<div id="reviewsContainer"></div>'), a.append('<div id="reviewsFooter"></div>'),
        n === _ && await this.fetchAndDisplayReviews(e);
    }
    async fetchAndDisplayReviews(e) {
        const t = $("#reviewsContainer"), n = $("#reviewsFooter");
        t.append('<div id="reviewsLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取评论中...</div>');
        const a = await storageManager.getSetting("reviewCount", 20);
        let i = null;
        try {
            i = await R(e, 1, a);
        } catch (o) {
            o.toString().includes("簽名已過期") && show.error("生成签名失败, 请检查系统时间及时区是否正确!"), clog.error("获取评论失败:", o),
            console.error("获取评论失败:", o);
        } finally {
            $("#reviewsLoading").remove();
        }
        if (!i) return t.append('\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取评论失败\n                    <a id="retryFetchReviews" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            '),
        void $("#retryFetchReviews").on("click", (async () => {
            $("#retryFetchReviews").parent().remove(), await this.fetchAndDisplayReviews(e);
        }));
        if (0 === i.length) return void t.append('<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无评论</div>');
        const s = await storageManager.getReviewFilterKeywordList();
        if (this.displayReviews(i, t, s), i.length === a) {
            n.html('\n                <button id="loadMoreReviews" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多评论\n                </button>\n                <div id="reviewsEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>\n            ');
            let i = 1, r = $("#loadMoreReviews");
            r.on("click", (async () => {
                let n;
                r.text("加载中...").prop("disabled", !0), i++;
                try {
                    n = await R(e, i, a);
                } catch (o) {
                    console.error("加载更多评论失败:", o);
                } finally {
                    r.text("加载失败, 请点击重试").prop("disabled", !1);
                }
                n && (this.displayReviews(n, t, s), n.length < a ? (r.remove(), $("#reviewsEnd").show()) : r.text("加载更多评论").prop("disabled", !1));
            }));
        } else n.html('<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部评论</div>');
    }
    displayReviews(e, t, n) {
        if (!e.length) return;
        const o = [];
        e.forEach((e => {
            if (n.some((t => e.content.includes(t)))) return;
            const a = Array(e.score).fill('<i class="icon-star"></i>').join(""), i = e.content.replace(/ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+/g, (e => e.startsWith("ed2k://") ? `\n                            <span style="word-break: break-all;background: #e0f2fe;color: #0369a1;">${e}</span>\n\n                        ` : e.startsWith("magnet:") ? `\n                            <a href="${e}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${e}</a>\n\n                        ` : e.startsWith("http://") || e.startsWith("https://") ? `\n                            <a href="${e}" class="a-primary" style="padding:0; word-break: break-all; white-space: pre-wrap;" target="_blank" rel="noopener noreferrer">${e}</a>\n                        ` : e)), s = `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                    <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${this.floorIndex++}楼</span>\n                    ${e.username} &nbsp;&nbsp; <span class="score-stars">${a}</span> \n                    <span class="time">${utils.formatDate(e.created_at)}</span> \n                    &nbsp;&nbsp; 点赞:${e.likes_count}\n                    <p class="review-content" style="margin-top: 5px;"> ${i} </p>\n                </div>\n            `;
            o.push(s);
        })), o.length && t.append(o.join("")), this.rightClickFilter();
    }
    async rightClickFilter() {
        await storageManager.getSetting("enableTitleSelectFilter", _) === _ && utils.rightClick(document.body, ".review-content", (async e => {
            const t = window.getSelection().toString();
            t && (e.preventDefault(), await utils.q(e, `是否将 '${t}' 加入评论区关键词?`, (async () => {
                await storageManager.saveReviewFilterKeyword(t), show.ok("操作成功, 刷新页面后生效");
            })));
        }));
    }
}
