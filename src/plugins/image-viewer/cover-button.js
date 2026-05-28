class Ue extends X {
    getName() {
        return "CoverButtonPlugin";
    }
    async initCss() {
        return `\n            <style>\n                .box .tags {\n                    justify-content: space-between;\n                }\n                .tool-box span{\n                    opacity:.3\n                }\n                .tool-box span:hover{\n                    opacity:1\n                }\n                ${l ? ".tool-box .icon, .setting-label .icon{ height: 24px; width: 24px; }" : ""}\n                .tool-box svg path {\n                  fill: blue;\n                }\n                [data-theme="dark"] .tool-box svg path {\n                  fill: white;\n                }\n                \n                \n                /* 鼠标移入时的弹性动画 */\n                .elastic-in {\n                    animation: elasticIn 0.2s ease-out forwards;  /* 动画名称 | 时长 | 缓动函数 | 保持最终状态 */\n                }\n                \n                /* 鼠标移出时的弹性动画 */\n                .elastic-out {\n                    animation: elasticOut 0.2s ease-in forwards;\n                }\n                /* 弹性进入动画（像果冻弹入） */\n                @keyframes elasticIn {\n                    0% {\n                        opacity: 0;\n                        transform: scale(0.8);  /* 起始状态：80% 大小 */\n                    }\n                    50% {\n                        opacity: 1;\n                        transform: scale(1.1);  /* 弹到 110%（超调一点） */\n                    }\n                    70% {\n                        transform: scale(0.95); /* 回弹到 95%（模拟弹性阻尼） */\n                    }\n                    100% {\n                        opacity: 1;\n                        transform: scale(1);    /* 最终恢复正常大小 */\n                    }\n                }\n                /* 弹性离开动画（像果冻弹出） */\n                @keyframes elasticOut {\n                    0% {\n                        opacity: 1;\n                        transform: scale(1);    /* 起始状态：正常大小 */\n                    }\n                    30% {\n                        transform: scale(1.05); /* 先弹大一点（105%） */\n                    }\n                    100% {\n                        opacity: 0;\n                        transform: scale(0.8);  /* 最终缩小并消失 */\n                    }\n                }\n                \n                \n                .loading {\n                    opacity: 0.7;\n                    filter: blur(1px);\n                }\n                .loading-spinner {\n                    position: absolute;\n                    top: 50%;\n                    left: 50%;\n                    transform: translate(-50%, -50%);\n                    width: 40px;\n                    height: 40px;\n                    border: 3px solid rgba(255,255,255,.3);\n                    border-radius: 50%;\n                    border-top-color: #fff;\n                    animation: spin 1s ease-in-out infinite;\n                    z-index: 20;\n                }\n                @keyframes spin {\n                    to { transform: translate(-50%, -50%) rotate(360deg); }\n                }\n            </style>\n        `;
    }
    handle() {
        window.isListPage && (this.addSvgBtn(), this.bindClick().then());
    }
    async addSvgBtn() {
        $(this.getSelector().itemSelector).toArray().forEach((e => {
            let t = $(e);
            if (!(t.find(".tool-box").length > 0) && (r && t.find(".tags").append(`\n                    <div class="tool-box" style="margin-left: auto; display: flex; align-items: center">\n                        <span class="screenSvg" title="长缩略图" style="margin-right: 15px;">${this.screenSvg}</span>\n                        \n                        <span class="videoSvg" title="播放视频" style="margin-right: 15px;">${this.videoSvg}</span>\n                        \n                        <div class="more-tools-container handleSvg" style="position: relative; margin-right: 15px;">\n                            <div title="鉴定处理" style="padding: 5px; margin: -5px;opacity:.3">${this.handleSvg}</div>\n                            \n                            <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="menu-btn hasWatchBtn" style="background-color:${S};color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${k}</span></a>\n                                <a class="menu-btn hasDownBtn" style="background-color:${x}; color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${y}</span></a>\n                                <a class="menu-btn favoriteBtn" style="background-color:${w}; color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${v}</span></a>\n                                <a class="menu-btn filterBtn" style="background-color:${f};   color:white !important;margin-bottom: 5px"><span style="opacity: 1;">${m}</span></a>\n                            </div>\n                        </div>\n                        \n                        <div class="more-tools-container siteSvg"  style="position: relative; margin-right: 15px;">\n                            <div title="第三方网站" style="padding: 5px; margin: -5px;opacity:.3">${this.siteSvg}</div>\n                            \n                             <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="site-btn site-jable" style="color:white !important;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">Jable</span>\n                                </a>\n                                <a class="site-btn site-avgle" style="margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">Avgle</span>\n                                </a>\n                                <a class="site-btn site-miss-av" style="color:white !important;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">MissAv</span>\n                                </a>\n                                <a class="site-btn site-123-av" style="color:white !important;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;">123Av</span>\n                                </a>\n                            </div>\n                        </div>\n                        \n                        <div class="more-tools-container copySvg" style="position: relative; margin-right: 15px;">\n                            <div title="复制按钮" style="padding: 5px; margin: -5px;opacity:.3">${this.copySvg}</div>\n                            \n                            <div class="more-tools" style="\n                                position: absolute;\n                                bottom: 20px;\n                                right: -10px;\n                                display: none;\n                                background: white;\n                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);\n                                border-radius: 20px;\n                                padding: 10px 0;\n                                margin-bottom: 15px;\n                                z-index: 10;\n                            ">\n                                <span class="carNumSvg" title="复制番号" style="padding: 5px 10px; white-space: nowrap;">${this.carNumSvg}</span>\n                                <span class="titleSvg" title="复制标题" style="padding: 5px 10px; white-space: nowrap;">${this.titleSvg}</span>\n                                <span class="downSvg" title="下载封面" style="padding: 5px 10px; white-space: nowrap;">${this.downSvg}</span>\n                            </div>\n                        </div>\n                    </div>\n                `),
            l)) {
                if (t.find(".avatar-box").length > 0) return;
                t.find(".photo-info").append(`\n                    <div class="tool-box" style="display: flex; align-items: center;justify-content: flex-end">\n                        <span class="screenSvg" title="长缩略图" style="margin-right: 15px;">${this.screenSvg}</span>\n\n                        <span class="videoSvg" title="播放视频" style="margin-right: 15px;">${this.videoSvg}</span>\n                        \n                        <div class="more-tools-container handleSvg" style="position: relative; margin-right: 15px;">\n                            <div title="鉴定处理" style="padding: 5px; margin: -5px;opacity:.3">${this.handleSvg}</div>\n                            \n                            <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="menu-btn hasWatchBtn" style="background-color:${S};color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${k}</span></a>\n                                <a class="menu-btn hasDownBtn" style="background-color:${x}; color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${y}</span></a>\n                                <a class="menu-btn favoriteBtn" style="background-color:${w}; color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${v}</span></a>\n                                <a class="menu-btn filterBtn" style="background-color:${f};   color:white;margin-bottom: 5px"><span style="opacity: 1;display: inline; color:white !important">${m}</span></a>\n                            </div>\n                        </div>\n                        \n                        <div class="more-tools-container siteSvg" style="position: relative; margin-right: 15px;">\n                            <div title="第三方网站" style="padding: 5px; margin: -5px;opacity:.3">${this.siteSvg}</div>\n                            \n                             <div class="more-tools" style=" position: absolute; bottom: 33px; right: -30px; display: none;\n                                background-color: rgba(255, 255, 255, 0);z-index: 10;">\n                                <a class="site-btn site-jable" style="color:white;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">Jable</span>\n                                </a>\n                                <a class="site-btn site-avgle" style="margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">Avgle</span>\n                                </a>\n                                <a class="site-btn site-miss-av" style="color:white;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">MissAv</span>\n                                </a>\n                                <a class="site-btn site-123-av" style="color:white;margin-bottom: 5px;background-color:#71bb59;">\n                                    <span style="opacity: 1;display: inline; color:white !important">123Av</span>\n                                </a>\n                            </div>\n                        </div>\n                      \n                        <div class="more-tools-container copySvg" style="position: relative;">\n                            <div title="复制按钮" style="padding: 5px; margin: -5px;opacity:.3">${this.copySvg}</div>\n                            \n                            <div class="more-tools" style="\n                                max-width: 44px;\n                                position: absolute;\n                                bottom: 20px;\n                                right: -10px;\n                                display: none;\n                                background: white;\n                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);\n                                border-radius: 20px;\n                                padding: 10px 0;\n                                margin-bottom: 15px;\n                                z-index: 10;\n                                text-align: center;\n                            ">\n                                <span class="carNumSvg" title="复制番号" style="padding: 5px 10px; white-space: nowrap;display: inline">${this.carNumSvg}</span>\n                                <span class="titleSvg" title="复制标题"  style="padding: 5px 10px; white-space: nowrap;display: inline">${this.titleSvg}</span>\n                                <span class="downSvg" title="下载封面"   style="padding: 5px 10px; white-space: nowrap;display: inline">${this.downSvg}</span>\n                            </div>\n                        </div>\n                    </div>\n                `);
            }
        })), this.enableSvgBtn();
    }
    async enableSvgBtn() {
        const e = await storageManager.getSetting(), {enableScreenSvg: t = _, enableVideoSvg: n = _, enableHandleSvg: a = _, enableSiteSvg: i = _, enableCopySvg: s = _} = e;
        [ {
            selector: ".screenSvg",
            enabled: t
        }, {
            selector: ".videoSvg",
            enabled: n
        }, {
            selector: ".handleSvg",
            enabled: a
        }, {
            selector: ".siteSvg",
            enabled: i
        }, {
            selector: ".copySvg",
            enabled: s
        } ].forEach((({selector: e, enabled: t}) => {
            $(e).toggle(t === _);
        }));
    }
    async bindClick() {
        this.getSelector();
        const e = this.getBean("ListPagePlugin");
        $(document).on("click", ".more-tools-container", (e => {
            e.preventDefault();
            var t = $(e.target).closest(".more-tools-container").find(".more-tools");
            $(".more-tools").not(t).stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide(),
            t.is(":visible") ? t.stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide() : t.stop(!0, !0).removeClass("elastic-out").addClass("elastic-in").show();
        })), $(document).on("click", (function(e) {
            $(e.target).closest(".more-tools-container").length || $(".more-tools").stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide();
        })), $(document).on("click", ".videoSvg", (t => {
            t.preventDefault(), $('.videoSvg[title!="播放视频"]').each(((t, n) => {
                const a = $(n);
                let i = a.closest(".item"), s = i.find("img"), {carNum: o} = e.findCarNumAndHref(i);
                this.showImg(a, s, o), a.html(this.videoSvg).attr("title", "播放视频");
            }));
            const n = $(t.target).closest(".item"), a = n.find(".videoSvg");
            if ("播放视频" === a.attr("title")) {
                a.html(this.recoveryVideoSvg).attr("title", "切回封面");
                const {carNum: t} = e.findCarNumAndHref(n);
                let i = n.find("img");
                if (!i.length) return void show.error("没有找到图片");
                this.showVideo(a, i, t).then();
            }
        })), $(document).on("click", ".screenSvg", (async t => {
            t.preventDefault();
            let n = loading();
            try {
                const a = $(t.currentTarget).closest(".item");
                let {carNum: i} = e.findCarNumAndHref(a);
                i = i.replace("FC2-", "");
                const s = await this.getBean("ScreenShotPlugin").getScreenshot(i);
                n.close(), showImageViewer(s);
            } catch (a) {
                console.error("图片预览出错:", a), show.error("图片预览出错:" + a);
            } finally {
                n.close();
            }
        })), $(document).on("click", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", (t => {
            t.preventDefault(), t.stopPropagation();
            try {
                const n = $(t.target).closest(".menu-btn"), a = n.closest(".item"), {carNum: i, url: s, publishTime: o} = e.findCarNumAndHref(a), r = async t => {
                    try {
                        let n = await e.parseActressName(s);
                        await storageManager.saveCar({
                            carNum: i,
                            url: s,
                            names: n,
                            actionType: t,
                            publishTime: o
                        }), window.refresh(), show.ok("操作成功");
                    } catch (r) { console.error("保存操作失败:", r), show.error("操作失败"); }
                };
                n.hasClass("filterBtn") ? utils.q(t, `是否屏蔽${i}?`, (() => r(d))) : n.hasClass("favoriteBtn") ? r(h).then() : n.hasClass("hasDownBtn") ? r(g).then() : n.hasClass("hasWatchBtn") && r(p).then(),
                $(".more-tools").stop(!0, !0).removeClass("elastic-in").addClass("elastic-out").hide();
            } catch (t) { console.error("按钮点击处理失败:", t); }
        }));
        const t = this.getBean("OtherSitePlugin"), n = await t.getMissAvUrl(), a = await t.getjableUrl(), i = await t.getAvgleUrl(), s = await t.getAv123Url();
        $(document).on("click", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", (t => {
            try {
                t.preventDefault(), t.stopPropagation();
                const o = $(t.currentTarget), r = o.closest(".item"), {carNum: l} = e.findCarNumAndHref(r);
                let c = null;
                o.hasClass("site-jable") ? c = `${a}/search/${l}/` : o.hasClass("site-avgle") ? c = `${i}/vod/search.html?wd=${l}` : o.hasClass("site-miss-av") ? c = `${n}/search/${l}` : o.hasClass("site-123-av") && (c = `${s}/ja/search?keyword=${l}`),
                t && (t.ctrlKey || t.metaKey) ? GM_openInTab(c, {
                    insert: 0
                }) : window.open(c);
            } catch (t) { console.error("站点按钮处理失败:", t); }
        })), $(document).on("click", ".titleSvg, .carNumSvg, .downSvg", (t => {
            t.preventDefault(), t.stopPropagation();
            const n = $(t.currentTarget).closest(".item"), {carNum: a, title: i} = e.findCarNumAndHref(n), s = n.find(l ? ".photo-frame img" : ".cover img");
            $(t.currentTarget).hasClass("titleSvg") ? utils.copyToClipboard("标题", i) : $(t.currentTarget).hasClass("carNumSvg") ? utils.copyToClipboard("番号", a) : $(t.currentTarget).hasClass("downSvg") && fetch(s.attr("src")).then((e => e.blob())).then((e => {
                utils.download(e, a + " " + i + ".jpg");
            }));
        }));
    }
    showImg(e, t, n) {
        e.html(this.videoSvg).attr("title", "播放视频");
        let a = $(`#${`${n}_preview_video`}`);
        a.length > 0 && (a[0].pause(), a.parent().hide()), t.show(), t.removeClass("loading"),
        t.next(".loading-spinner").remove();
    }
    async showVideo(e, t, n) {
        const a = `${n}_preview_video`;
        let i = $(`#${a}`);
        if (i.length > 0) return i.parent().show(), i[0].play(), void t.hide();
        t.addClass("loading"), t.after('<div class="loading-spinner"></div>');
        const s = t.attr("src"), o = await ne(n);
        if (!o) return show.error("未解析到视频"), void this.showImg(e, t, n);
        let r = await storageManager.getSetting("videoQuality");
        r = Z(Object.keys(o), r);
        let c = o[r], d = `\n            <div style="display: flex; justify-content: center; align-items: center; position: absolute; top:0; left:0; height: 100%; width: 100%; z-index: 10; overflow: hidden">\n                <video \n                    src="${c}" \n                    poster="${s}" \n                    id="${a}" \n                    controls \n                    loop \n                    muted \n                    playsinline\n                    style="max-height: 100%; max-width: 100%; object-fit: contain"\n                ></video>\n            </div>\n        `;
        l && (d = `\n                <div>\n                    <video \n                        src="${c}" \n                        poster="${s}" \n                        id="${a}" \n                        controls \n                        loop \n                        muted \n                        playsinline\n                        style="max-height: 100%; max-width: 100%; object-fit: contain"\n                    ></video>\n                </div>\n            `),
        t.parent().append(d), t.hide(), t.removeClass("loading"), t.next(".loading-spinner").remove(),
        i = $(`#${a}`);
        let h = i[0];
        h.load(), h.muted = !1, h.play(), i.trigger("focus");
    }
}
