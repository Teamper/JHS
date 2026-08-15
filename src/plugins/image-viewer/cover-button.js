class CoverButtonPlugin extends BasePlugin {
    getName() {
        return "CoverButtonPlugin";
    }
    async initCss() {
        return `
            <style>
                .box .tags { justify-content:space-between; }
                .jhs-cover-tools { display:flex; align-items:center; justify-content:flex-end; gap:var(--jhs-space-2); margin-left:auto; }
                .jhs-cover-tools svg path { fill:var(--jhs-icon-color); }
                .jhs-cover-tools .screenSvg, .jhs-cover-tools .videoSvg { opacity:.65; }
                .jhs-cover-tools .screenSvg:hover, .jhs-cover-tools .videoSvg:hover { opacity:1; }
                ${l ? ".jhs-cover-tools .icon, .setting-label .icon{height:24px;width:24px}" : ""}
                .more-tools-container { position:relative; }
                .jhs-card-menu { top:auto; right:0; bottom:calc(100% + var(--jhs-space-2)); width:152px; }
                .jhs-card-menu .jhs-btn, .jhs-card-menu .site-btn { width:100%; min-height:var(--jhs-control-height); justify-content:flex-start; margin:0; }
                .jhs-card-menu__dot { width:8px; height:8px; flex:none; border-radius:50%; background:var(--jhs-border-strong); }
                .jhs-card-menu__dot--watch { background:var(--jhs-status-watch); }
                .jhs-card-menu__dot--down { background:var(--jhs-status-down); }
                .jhs-card-menu__dot--fav { background:var(--jhs-status-fav); }
                .jhs-card-menu__dot--filter { background:var(--jhs-status-filter); }
                .loading { opacity:.7; filter:blur(1px); }
                .loading-spinner { position:absolute; top:50%; left:50%; width:40px; height:40px; border:3px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; transform:translate(-50%,-50%); animation:spin 1s ease-in-out infinite; z-index:var(--jhs-z-elevated); }
                @keyframes spin { to { transform:translate(-50%,-50%) rotate(360deg); } }
            </style>`;
    }
    async handle() {
        window.isListPage && (this.addSvgBtn(), await this.bindClick());
    }
    /** 构建卡片工具和三个卡片内 popover。 */
    buildToolBox() {
        return `
            <div class="tool-box jhs-cover-tools">
                <button type="button" class="jhs-btn jhs-icon-btn screenSvg" title="长缩略图" aria-label="长缩略图">${this.screenSvg}</button>
                <button type="button" class="jhs-btn jhs-icon-btn videoSvg" title="播放视频" aria-label="播放视频">${this.videoSvg}</button>
                <div class="more-tools-container handleSvg">
                    <button type="button" title="鉴定处理" aria-label="鉴定处理" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.handleSvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item hasWatchBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--watch"></span><span>${k}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item hasDownBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--down"></span><span>${y}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item favoriteBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--fav"></span><span>${v}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item filterBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--filter"></span><span>${m}</span></button>
                    </div>
                </div>
                <div class="more-tools-container siteSvg">
                    <button type="button" title="第三方网站" aria-label="第三方网站" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.siteSvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <a role="menuitem" class="site-btn site-jable"><span>Jable</span></a>
                        <a role="menuitem" class="site-btn site-avgle"><span>Avgle</span></a>
                        <a role="menuitem" class="site-btn site-miss-av"><span>MissAv</span></a>
                        <a role="menuitem" class="site-btn site-123-av"><span>123Av</span></a>
                    </div>
                </div>
                <div class="more-tools-container copySvg">
                    <button type="button" title="复制" aria-label="复制" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.copySvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost carNumSvg">${this.carNumSvg}<span>复制番号</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost titleSvg">${this.titleSvg}<span>复制标题</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost downSvg">${this.downSvg}<span>下载封面</span></button>
                    </div>
                </div>
            </div>`;
    }
    async addSvgBtn() {
        $(this.getSelector().itemSelector).toArray().forEach((element => {
            const item = $(element);
            if (item.find(".tool-box").length || l && item.find(".avatar-box").length) return;
            const host = r ? item.find(".tags").first() : item.find(".photo-info").first();
            host.length && host.append(this.buildToolBox());
        })), this.enableSvgBtn();
    }
    async enableSvgBtn() {
        const e = await storageManager.getSetting(), {enableScreenSvg: t = _, enableVideoSvg: n = _, enableHandleSvg: a = _, enableSiteSvg: i = _, enableCopySvg: s = _} = e;
        [ { selector: ".screenSvg", enabled: t }, { selector: ".videoSvg", enabled: n }, { selector: ".handleSvg", enabled: a }, { selector: ".siteSvg", enabled: i }, { selector: ".copySvg", enabled: s } ].forEach((({selector: e, enabled: t}) => {
            $(e).toggle(t === _);
        }));
    }
    closeCardMenus(focus = !1) {
        const openMenus = $(".jhs-card-menu.is-open"), triggers = openMenus.siblings(".jhs-card-menu-trigger");
        openMenus.removeClass("is-open"), triggers.attr("aria-expanded", "false"), focus && triggers.first().trigger("focus");
    }
    async bindClick() {
        this.getSelector();
        const e = this.getBean("ListPagePlugin");
        $(document).on("click", ".jhs-card-menu-trigger", (event => {
            event.preventDefault(), event.stopPropagation();
            const trigger = $(event.currentTarget), menu = trigger.siblings(".jhs-card-menu"), open = !menu.hasClass("is-open");
            this.closeCardMenus(), menu.toggleClass("is-open", open), trigger.attr("aria-expanded", String(open)), open && menu.children().first().trigger("focus");
        })).on("keydown", ".jhs-card-menu [role='menuitem']", (event => {
            const menu = $(event.currentTarget).closest(".jhs-card-menu"), items = menu.find("[role='menuitem']"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), this.closeCardMenus(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        })).on("click", (event => {
            $(event.target).closest(".more-tools-container").length || this.closeCardMenus();
        })), $(document).on("click", ".videoSvg", (t => {
            t.preventDefault(), $('.videoSvg[title!="播放视频"]').each(((t, n) => {
                const a = $(n);
                let i = a.closest(".item"), s = i.find("img"), {carNum: o} = e.findCarNumAndHref(i);
                this.showImg(a, s, o), a.html(this.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
            }));
            const n = $(t.target).closest(".item"), a = n.find(".videoSvg");
            if ("播放视频" === a.attr("title")) {
                a.html(this.recoveryVideoSvg).attr({ title: "切回封面", "aria-label": "切回封面" });
                const {carNum: t} = e.findCarNumAndHref(n);
                let i = n.find("img");
                if (!i.length) return void show.error("没有找到图片");
                void this.showVideo(a, i, t).catch((error => clog.error("卡片预览视频打开失败", error)));
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
                clog.error("图片预览出错:", a), show.error("图片预览出错:" + a);
            } finally { n.close(); }
        })), $(document).on("click", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", (t => {
            t.preventDefault(), t.stopPropagation();
            try {
                const n = $(t.currentTarget), a = n.closest(".item"), {carNum: i, url: s, publishTime: o} = e.findCarNumAndHref(a), r = async t => {
                    try {
                        let n = await e.parseActressName(s);
                        await storageManager.saveCar({ carNum: i, url: s, names: n, actionType: t, publishTime: o }), window.refresh(), show.ok("操作成功");
                    } catch (r) { clog.error("保存操作失败:", r), show.error("操作失败"); }
                };
                n.hasClass("filterBtn") ? utils.q(t, `是否屏蔽${i}?`, (() => r(d))) : n.hasClass("favoriteBtn") ? void r(h) : n.hasClass("hasDownBtn") ? void r(g) : n.hasClass("hasWatchBtn") && void r(p), this.closeCardMenus();
            } catch (t) { clog.error("按钮点击处理失败:", t); }
        }));
        const t = this.getBean("OtherSitePlugin"), n = await t.getMissAvUrl(), a = await t.getjableUrl(), i = await t.getAvgleUrl(), s = await t.getAv123Url();
        $(this.getSelector().itemSelector).each(((t, o) => {
            const r = $(o), {carNum: l} = e.findCarNumAndHref(r);
            r.find(".site-jable").attr({ href: `${a}/search/${l}/`, target: "_blank", rel: "noopener noreferrer" }),
            r.find(".site-avgle").attr({ href: `${i}/vod/search.html?wd=${l}`, target: "_blank", rel: "noopener noreferrer" }),
            r.find(".site-miss-av").attr({ href: `${n}/search/${l}`, target: "_blank", rel: "noopener noreferrer" }),
            r.find(".site-123-av").attr({ href: `${s}/cn/search?keyword=${encodeURIComponent(l)}`, target: "_blank", rel: "noopener noreferrer" });
        }));
        $(document).on("click", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", (t => {
            try {
                t.preventDefault(), t.stopPropagation();
                const o = $(t.currentTarget), r = o.closest(".item"), {carNum: l} = e.findCarNumAndHref(r);
                let c = null;
                o.hasClass("site-jable") ? c = `${a}/search/${l}/` : o.hasClass("site-avgle") ? c = `${i}/vod/search.html?wd=${l}` : o.hasClass("site-miss-av") ? c = `${n}/search/${l}` : o.hasClass("site-123-av") && (c = `${s}/cn/search?keyword=${encodeURIComponent(l)}`),
                t && (t.ctrlKey || t.metaKey) ? GM_openInTab(c, { insert: 0 }) : window.open(c), this.closeCardMenus();
            } catch (t) { clog.error("站点按钮处理失败:", t); }
        })), $(document).on("click", ".titleSvg, .carNumSvg, .downSvg", (t => {
            t.preventDefault(), t.stopPropagation();
            const n = $(t.currentTarget).closest(".item"), {carNum: a, title: i} = e.findCarNumAndHref(n), s = n.find(l ? ".photo-frame img" : ".cover img");
            $(t.currentTarget).hasClass("titleSvg") ? utils.copyToClipboard("标题", i) : $(t.currentTarget).hasClass("carNumSvg") ? utils.copyToClipboard("番号", a) : $(t.currentTarget).hasClass("downSvg") && fetch(s.attr("src")).then((e => e.blob())).then((e => utils.download(e, a + " " + i + ".jpg"))), this.closeCardMenus();
        }));
    }
    showImg(e, t, n) {
        e.html(this.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
        let a = $(`#${`${n}_preview_video`}`);
        a.length > 0 && (a[0].pause(), a.parent().hide()), t.show(), t.removeClass("loading"), t.next(".loading-spinner").remove();
    }
    async showVideo(e, t, n) {
        const a = `${n}_preview_video`;
        let i = $(`#${a}`);
        if (i.length > 0) return i.parent().show(), await safePlay(i[0], {
            context: "列表卡片预览",
            notify: !0
        }), void t.hide();
        t.addClass("loading"), t.after('<div class="loading-spinner"></div>');
        const s = t.attr("src"), {sources: o, error: previewError} = await fetchDmmPreview(n);
        if (!o) return show.error("REGION_BLOCKED" === previewError?.code ? previewError.message : "未解析到视频"), void this.showImg(e, t, n);
        let r = await storageManager.getSetting("videoQuality");
        r = Z(Object.keys(o), r);
        let c = o[r], d = `
            <div class="jhs-layout-d543acf8">
                <video src="${c}" poster="${s}" id="${a}" controls loop muted playsinline class="jhs-layout-a38a0e50"></video>
            </div>`;
        l && (d = `<div><video src="${c}" poster="${s}" id="${a}" controls loop muted playsinline class="jhs-layout-a38a0e50"></video></div>`),
        t.parent().append(d), t.hide(), t.removeClass("loading"), t.next(".loading-spinner").remove(), i = $(`#${a}`);
        let h = i[0];
        h.load(), h.muted = !1, await safePlay(h, {
            context: "列表卡片预览",
            notify: !0,
            message: "REGION_BLOCKED" === previewError?.code ? previewError.message : "当前视频源无法播放"
        }), i.trigger("focus");
    }
}
