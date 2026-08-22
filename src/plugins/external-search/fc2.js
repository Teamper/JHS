class Fc2Plugin extends BasePlugin {
    getName() {
        return "Fc2Plugin";
    }
    async initCss() {
        return "\n            <style>\n                /* 弹层样式 */\n                .movie-detail-layer .layui-layer-title {\n                    font-size: 18px;\n                    color: var(--jhs-text);\n                    background: var(--jhs-surface-2);\n                }\n                \n                \n                /* 容器样式 */\n                .movie-detail-container {\n                    margin: 40px;\n                    height: 100%;\n                    background: var(--jhs-surface);\n                }\n                \n                .movie-poster-container {\n                    flex: 0 0 60%;\n                    padding: 15px;\n                }\n                \n                .right-box {\n                    flex: 1;\n                    padding: 20px;\n                    overflow-y: auto;\n                }\n                \n                /* 预告片iframe */\n                .movie-trailer {\n                    width: 100%;\n                    height: 100%;\n                    min-height: 400px;\n                    background: #000;\n                    border-radius: 4px;\n                }\n                \n                /* 电影信息样式 */\n                .movie-title {\n                    font-size: 24px;\n                    margin-bottom: 15px;\n                    color: var(--jhs-text);\n                }\n                \n                .movie-meta {\n                    margin-bottom: 20px;\n                    color: var(--jhs-text-muted);\n                }\n                \n                .movie-meta span {\n                    margin-right: 15px;\n                }\n                \n                /* 演员列表 */\n                .actor-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 8px;\n                    margin-top: 10px;\n                }\n                \n                .actor-tag {\n                    padding: 4px 12px;\n                    background: var(--jhs-surface-2);\n                    border-radius: 15px;\n                    font-size: 12px;\n                    color: var(--jhs-text-muted);\n                }\n                \n                /* 图片列表 */\n                .image-list {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 10px;\n                }\n                \n                .movie-image-thumb {\n                    width: 120px;\n                    height: 80px;\n                    object-fit: cover;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    transition: transform 0.3s;\n                }\n                \n                .movie-image-thumb:hover {\n                    transform: scale(1.05);\n                }\n                \n                /* 加载中和错误状态 */\n                .search-loading, .movie-error {\n                    padding: 40px;\n                    text-align: center;\n                    color: var(--jhs-text-faint);\n                }\n                \n                .movie-error {\n                    color: var(--jhs-status-filter);\n                }\n                \n                .fancybox-container{\n                    z-index:var(--jhs-z-loading)\n                 }\n                 \n                 \n                 /* 错误提示样式 */\n                .movie-not-found, .movie-error {\n                    text-align: center;\n                    padding: 30px;\n                    color: var(--jhs-text-muted);\n                }\n                \n                .movie-not-found h3, .movie-error h3 {\n                    color: var(--jhs-status-filter);\n                    margin: 15px 0;\n                }\n                \n                .icon-warning, .icon-error {\n                    font-size: 50px;\n                    color: var(--jhs-status-watch);\n                }\n                \n                .icon-error {\n                    color: var(--jhs-status-filter);\n                }\n                \n                .fc2-movie-panel-info .panel-block {\n                    padding: 0 !important;\n                }\n            </style>\n        ";
    }
    handle() {
        let e = "/advanced_search?type=3&score_min=0&d=1";
        if ($('.navbar-item:contains("FC2")').attr("href", e), $('.tabs a:contains("FC2")').attr("href", e),
        o.includes("advanced_search?type=3")) {
            $("h2.section-title").contents().first().replaceWith("Fc2PPV"), $(".section .container > .box").remove();
        }
        if (o.includes("collection_codes?movieId")) {
            $("section").html("");
            const e = new URLSearchParams(window.location.search);
            let t = e.get("movieId"), n = e.get("carNum"), a = e.get("url");
            t && n && a && this.openFc2Dialog(t, n, a);
        }
    }
    openFc2Dialog(e, t, n) {
        let a = t.replace("FC2-", "");
        if (n.includes("123av")) return void this.getBean("Fc2By123AvPlugin").open123AvFc2Dialog(t, n);
        let i = `\n            <div class="movie-detail-container">\n                \x3c!--<div class="movie-poster-container">\n                    <iframe class="movie-trailer" frameborder="0" allowfullscreen scrolling="no"></iframe>\n                </div>--\x3e\n               \x3c!-- <div class="right-box">--\x3e\n                    <div class="movie-info-container">\n                        <div class="search-loading">加载中...</div>\n                    </div>\n                    \n                    <div class="movie-panel-info fc2-movie-panel-info jhs-layout-a26bda7d"><strong>第三方资源: </strong></div>\n                    \n                    <div class="jhs-layout-ba4750c8">\n                        <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter"><span>${m}</span></button>\n                        <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav"><span>${v}</span></button>\n                        <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down"><span>${y}</span></button>\n                        <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch"><span>${k}</span></button>\n                        \n                        <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent">\n                            <span>字幕 (SubTitleCat)</span>\n                        </button>\n                        <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent">\n                            <span>字幕 (迅雷)</span>\n                        </button>\n                        <button type="button" id="magnetSearchBtn" class="jhs-btn jhs-btn--accent jhs-layout-9fe45cd8">\n                            <span>磁力搜索</span>\n                        </button>\n                    </div>\n                    <div class="message video-panel jhs-layout-a26bda7d">\n                        <div id="magnets-content" class="magnet-links jhs-layout-6d489fc7">\n                            <div class="search-loading">加载中...</div>\n                        </div>\n                    </div>\n                    <div id="reviews-content">\n                    </div>\n                    <div id="related-content">\n                    </div>\n                    <span id="data-actress" class="jhs-layout-6b99de8b"></span>\n                \x3c!--</div>--\x3e\n            </div>\n        `;
        layer.open({
            type: 1,
            title: t,
            content: i,
            area: utils.getDialogArea("workspace"),
            skin: "movie-detail-layer",
            scrollbar: !1,
            success: (i, s) => {
                const root = $(i), detailRoot = root.find(".movie-detail-container");
                organizeJhsOwnedDetailWorkspace(detailRoot), detailStateController.bind({ root: i, layerIndex: s, carNum: t, activityType: "fc2-state", getRecord: () => ({ carNum: t, url: n, names: root.find("#data-actress").text(), publishTime: root.find("#data-releaseDate").text() }) }),
                void this.loadData(e, t).catch((error => clog.error("FC2 详情加载失败", error))), root.find("#search-subtitle-btn").on("click", (e => utils.openPage(`https://subtitlecat.com/index.php?search=${t}`, t, !1, e))),
                $("#xunLeiSubtitleBtn").on("click", (() => this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(t))),
                $("#magnetSearchBtn").on("click", (async () => {
                    let e = await this.getBean("MagnetHubPlugin").createMagnetHub(t);
                    layer.open({
                        type: 1,
                        title: "磁力搜索",
                        content: '<div id="magnetHubBox"></div>',
                        area: utils.getResponsiveArea([ "60%", "80%" ]),
                        scrollbar: !1,
                        success: () => {
                            $("#magnetHubBox").append(e);
                        }
                    });
                })), void this.getBean("OtherSitePlugin").loadOtherSite(a, t).catch((error => clog.error("FC2 外部站点加载失败", error))), utils.setupEscClose(s);
            },
            end() {
                window.location.href.includes("collection_codes?movieId") && utils.closePage();
            }
        });
    }
    async loadData(e, t) {
        const n = t.replace("FC2-", "");
        this.handleLongImg(n), await Promise.all([ this.handleMovieDetail(e), this.handleMagnets(e), this.getBean("ReviewPlugin").showReview(e, $("#reviews-content")), this.getBean("RelatedPlugin").showRelated($("#related-content"), e) ]);
    }
    async handleMovieDetail(e) {
        try {
            const movie = await V(e), t = movie.actors || [], n = movie.imgList || [];
            let a = "";
            if (t.length > 0) {
                let actressNames = "";
                for (let n = 0; n < t.length; n++) {
                    let i = t[n];
                    a += `<span class="actor-tag"><a href="/actors/${escapeHtml(i.id)}" target="_blank">${escapeHtml(i.name)}</a></span>`,
                    0 === i.gender && (actressNames += String(i.name || "") + " ");
                }
                $("#data-actress").text(actressNames);
            } else a = '<span class="no-data">暂无演员信息</span>';
            const images = Array.isArray(n) ? n.map((value => normalizeHttpUrl(value))).filter(Boolean) : [], i = images.length > 0 ? images.map(((value, index) => `\n                <a href="${escapeHtml(value)}" data-fancybox="movie-gallery" data-caption="剧照 ${index + 1}">\n                    <img src="${escapeHtml(value)}" class="movie-image-thumb" loading="lazy" alt=""/>\n                </a>\n            `)).join("") : '<div class="no-data">暂无剧照</div>', carNum = String(movie.carNum || ""), safeCarNum = escapeHtml(carNum || "未知"), releaseDate = escapeHtml(movie.releaseDate || "未知"), score = Number.isFinite(Number(movie.score)) ? escapeHtml(String(movie.score)) : "无", duration = Number.isFinite(Number(movie.duration)) ? `${escapeHtml(String(movie.duration))} m` : "无", articleId = encodeURIComponent(carNum.replace("FC2-", ""));
            $(".movie-info-container").html(`\n                <h3 class="movie-title"><strong class="current-title">${escapeHtml(movie.title || "无标题")}</strong></h3>\n                <div class="movie-meta"><span><strong>番号: </strong>${safeCarNum}</span><span><strong>年份: </strong>${releaseDate}</span><span><strong>评分: </strong>${score}</span><span><strong>时长: </strong>${duration}</span></div>\n                <div class="movie-meta"><span><strong>站点: </strong><a href="https://fc2ppvdb.com/articles/${articleId}" target="_blank">fc2ppvdb</a><a href="https://adult.contents.fc2.com/article/${articleId}/" target="_blank" class="jhs-layout-3fed2a7e">fc2电子市场</a></span></div>\n                <div class="movie-actors"><div class="actor-list"><strong>主演: </strong>${a}</div></div>\n                <div class="movie-gallery jhs-layout-d2c171b1"><strong>剧照: </strong><div class="image-list">${i}</div></div>\n                <div id="data-releaseDate" class="jhs-layout-6b99de8b">${escapeHtml(movie.releaseDate || "")}</div>\n            `), await this.getBean("TranslatePlugin").translate(carNum, !1);
        } catch (error) {
            throw clog.error(error), $(".movie-info-container").html(`<div class="movie-error">加载失败: ${escapeHtml(error.message)}</div>`), error;
        }
    }
    handleLongImg(e) {
        utils.loopDetector((() => $(".movie-gallery .image-list").length > 0), (async () => {
            $(".movie-gallery .image-list").prepend(' <a class="tile-item screen-container jhs-layout-e5d57abb"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> ');
            const t = this.getBean("ScreenShotPlugin"), n = await t.getScreenshot(e);
            n && await t.addImg("缩略图", n);
        }));
    }
    async handleMagnets(e) {
        try {
            const requestUrl = `${U}/v1/movies/${e}/magnets`, n = {
                jdSignature: await O()
            };
            const magnets = (await gmHttp.get(requestUrl, null, n)).data.magnets || [];
            let html = "";
            for (const [index, item] of magnets.entries()) {
                const hash = normalizeBtihHash(item.hash);
                if (!hash) {
                    clog.warn("忽略无效 FC2 磁力哈希", item.hash);
                    continue;
                }
                const magnet = `magnet:?xt=urn:btih:${hash}`, size = Number(item.size), filesCount = Number(item.files_count);
                html += `\n                    <div class="item columns is-desktop ${index % 2 === 0 ? "odd" : ""}"><div class="magnet-name column is-four-fifths"><a href="${magnet}" title="右键点击并选择“复制链接地址”"><span class="name">${escapeHtml(item.name || "")}</span><br><span class="meta">${Number.isFinite(size) ? (size / 1024).toFixed(2) : "0.00"}GB, ${Number.isFinite(filesCount) ? filesCount : 0}个文件</span><br><div class="jhs-toolbar">${item.hd ? '<span class="jhs-badge jhs-badge--accent">高清</span>' : ""}${item.cnsub ? '<span class="jhs-badge jhs-badge--watch">字幕</span>' : ""}</div></a></div><div class="jhs-toolbar column"><button class="jhs-btn jhs-btn--secondary copy-to-clipboard" data-clipboard-text="${magnet}" type="button">复制</button><button class="jhs-btn jhs-btn--secondary jhs-offline-btn" data-resource="${magnet}" data-jhs-offline-owner="fc2" type="button">离线</button></div><div class="date column"><span class="time">${escapeHtml(item.created_at || "")}</span></div></div>`;
            }
            $("#magnets-content").html(html || '<span class="no-data">暂无磁力信息</span>');
        } catch (error) {
            throw clog.error(error), $("#magnets-content").html(`<div class="movie-error">加载失败: ${escapeHtml(error.message)}</div>`), error;
        }
    }
    async openFc2Page(e, t, n, navigation = { newTab: !0 }) {
        const a = this.getBean("OtherSitePlugin");
        let i = await a.getJavDbUrl();
        utils.openPage(`${i}/users/collection_codes?movieId=${e}&carNum=${encodeURIComponent(t)}&url=${encodeURIComponent(n)}`, t, !0, navigation);
    }
}
