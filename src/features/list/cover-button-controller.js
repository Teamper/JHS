// @ts-check

import { _, d, g, h, k, m, p, v, y, escapeHtml } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { FEATURE_ICONS } from "../../core/feature-icons.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { Z, canUseCardPreview, fetchDmmPreviewIfEnabled, isPreviewEnabled } from "../../services/preview-service.js";

/** @typedef {any} JQueryHandle */
/** @typedef {MouseEvent & { ctrlKey?: boolean, metaKey?: boolean }} CardActionEvent */

export class CoverButtonController {
    /** @param {{document: Document, window: Window & typeof globalThis, list: any, settings: any, state: any, screenshot: any, storage: any, movie: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, ui: any, clipboard: any, notifications: any, diagnostics: any, navigation: any, screenshotAvailable: boolean, isJavBus: boolean}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.list = options.list;
        this.settings = options.settings;
        this.state = options.state;
        this.screenshot = options.screenshot;
        this.storage = options.storage;
        this.movie = options.movie;
        this.scope = options.scope;
        this.ui = options.ui;
        this.clipboard = options.clipboard;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.navigation = options.navigation;
        this.screenshotAvailable = options.screenshotAvailable;
        this.isJavBus = options.isJavBus;
        /** @type {typeof FEATURE_ICONS} */ this.icons = FEATURE_ICONS;
        /** @type {number} */ this.previewGeneration = 0;
        this.started = false;
    }
    getStyles() {
        return `
            <style>
                .box .tags { justify-content:space-between; }
                .jhs-cover-tools { display:flex; flex-wrap:wrap; max-width:100%; align-items:center; justify-content:flex-end; gap:var(--jhs-space-2); margin-left:auto; }
                .jhs-cover-tools svg path { fill:var(--jhs-icon-color); }
                .jhs-cover-tools .screenSvg, .jhs-cover-tools .videoSvg { opacity:.65; }
                .jhs-cover-tools .screenSvg:hover, .jhs-cover-tools .videoSvg:hover { opacity:1; }
                ${this.isJavBus ? ".jhs-cover-tools .icon, .setting-label .icon{height:24px;width:24px}" : ""}
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
    async start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        const $ = this.ui.jquery;
        const scope = this.scope;
        const settingsService = this.settings;
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
            if (names.some((name) => name === "enablePreviewVideo" || name === "enableLoadPreviewVideo")) {
                this.previewGeneration++;
                if (canUseCardPreview(settingsService.snapshot())) void this.addSvgBtn().catch((error => this.recordError("卡片预览重新挂载失败", error)));
                else {
                    this.stopAllPreviews();
                    void this.enableSvgBtn();
                }
            }
            // 长缩略图与卡片按钮开关即时重建工具箱，不保留死按钮。
            if (names.some((name) => [ "enableScreenSvg", "enableVideoSvg", "enableHandleSvg", "enableSiteSvg", "enableCopySvg" ].includes(name))) void this.enableSvgBtn();
        };
        // 6.5：listener 只注册一次，避免 ON→OFF→ON 循环累积；重新开启只重建按钮，不再递归 handle()。
        settingsService.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup(() => {
            settingsService.removeEventListener("settings.changed", onSettingsChanged);
            this.started = false;
            this.previewGeneration += 1;
            this.stopAllPreviews();
        });
        await this.addSvgBtn();
        await this.bindClick(scope);
    }
    /** 构建卡片工具和三个卡片内 popover。 */
    buildToolBox() {
        return `
            <div class="tool-box jhs-cover-tools">
                <button type="button" class="jhs-btn jhs-icon-btn screenSvg" title="长缩略图" aria-label="长缩略图">${this.icons.screenSvg}</button>
                <button type="button" class="jhs-btn jhs-icon-btn videoSvg" title="播放视频" aria-label="播放视频">${this.icons.videoSvg}</button>
                <div class="more-tools-container handleSvg">
                    <button type="button" title="鉴定处理" aria-label="鉴定处理" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.icons.handleSvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item hasWatchBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--watch"></span><span>${k}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item hasDownBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--down"></span><span>${y}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item favoriteBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--fav"></span><span>${v}</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost jhs-card-status-item filterBtn"><span class="jhs-card-menu__dot jhs-card-menu__dot--filter"></span><span>${m}</span></button>
                    </div>
                </div>
                <div class="more-tools-container siteSvg">
                    <button type="button" title="第三方网站" aria-label="第三方网站" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.icons.siteSvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <a role="menuitem" class="site-btn site-jable"><span>Jable</span></a>
                        <a role="menuitem" class="site-btn site-avgle"><span>Avgle</span></a>
                        <a role="menuitem" class="site-btn site-miss-av"><span>MissAv</span></a>
                        <a role="menuitem" class="site-btn site-123-av"><span>123Av</span></a>
                    </div>
                </div>
                <div class="more-tools-container copySvg">
                    <button type="button" title="复制" aria-label="复制" aria-haspopup="menu" aria-expanded="false" class="jhs-btn jhs-icon-btn jhs-card-menu-trigger">${this.icons.copySvg}</button>
                    <div class="jhs-popover jhs-card-menu" role="menu">
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost carNumSvg">${this.icons.carNumSvg}<span>复制番号</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost titleSvg">${this.icons.titleSvg}<span>复制标题</span></button>
                        <button type="button" role="menuitem" class="jhs-btn jhs-btn--ghost downSvg">${this.icons.downSvg}<span>下载封面</span></button>
                    </div>
                </div>
            </div>`;
    }
    /** @param {JQueryHandle | Element | null} [items] */
    async addSvgBtn(items = null) {
        const $ = this.ui.jquery;
        if (!this.list) return;
        (items ? $(items).toArray() : $(this.list.getSelector().itemSelector).toArray()).forEach(((/** @type {Element} */ element) => {
            const item = $(element);
            if (item.find(".tool-box").length || this.isJavBus && item.find(".avatar-box").length) return;
            const host = !this.isJavBus ? item.find(".tags").first() : item.find(".photo-info").first();
            host.length && host.append(this.buildToolBox());
        })), this.enableSvgBtn(items);
    }
    /** @param {JQueryHandle | Element | null} [items] */
    async enableSvgBtn(items = null) {
        const $ = this.ui.jquery;
        const e = this.settings.snapshot(), {enableScreenSvg: t = _, enableVideoSvg: n = _, enablePreviewVideo: q = _, enableHandleSvg: a = _, enableSiteSvg: i = _, enableCopySvg: s = _} = e;
        const scope = items ? $(items) : $(this.document);
        const screenshotAvailable = this.screenshotAvailable === true;
        // videoSvg 是 DMM-only 入口：Preview 总开关与 DMM 子开关都必须 ON，否则不显示（不留死按钮）。
        [ { selector: ".screenSvg", enabled: t === _ && screenshotAvailable ? _ : "no" }, { selector: ".videoSvg", enabled: n === _ && canUseCardPreview(e) ? _ : "no" }, { selector: ".handleSvg", enabled: a }, { selector: ".siteSvg", enabled: i }, { selector: ".copySvg", enabled: s } ].forEach((({selector: e, enabled: t}) => {
            scope.find(e).toggle(t === _);
        }));
    }
    closeCardMenus(focus = !1) {
        const $ = this.ui.jquery;
        const openMenus = $(".jhs-card-menu.is-open"), triggers = openMenus.siblings(".jhs-card-menu-trigger");
        openMenus.removeClass("is-open"), triggers.attr("aria-expanded", "false"), focus && triggers.first().trigger("focus");
    }
    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    async bindClick(scope) {
        const $ = this.ui.jquery;
        const list = this.list;
        if (!list) return;
        const documentRoot = $(this.document);
        documentRoot.off(".jhsCoverButton");
        scope.addCleanup(() => documentRoot.off(".jhsCoverButton"));
        documentRoot.on("click.jhsCoverButton", ".jhs-card-menu-trigger", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault(), event.stopPropagation();
            const trigger = $(event.currentTarget), menu = trigger.siblings(".jhs-card-menu"), open = !menu.hasClass("is-open");
            this.closeCardMenus(), menu.toggleClass("is-open", open), trigger.attr("aria-expanded", String(open)), open && menu.children().first().trigger("focus");
        })).on("keydown.jhsCoverButton", ".jhs-card-menu [role='menuitem']", ((/** @type {KeyboardEvent} */ event) => {
            const menu = $(event.currentTarget).closest(".jhs-card-menu"), items = menu.find("[role='menuitem']"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), this.closeCardMenus(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        })).on("click.jhsCoverButton", ((/** @type {CardActionEvent} */ event) => {
            $(event.target).closest(".more-tools-container").length || this.closeCardMenus();
        }));
        documentRoot.on("click.jhsCoverButton", ".videoSvg", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault();
            $('.videoSvg[title!="播放视频"]').each(((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => {
                const button = $(element), card = button.closest(".item"), image = card.find("img");
                const { carNum } = list.findCarNumAndHref(card);
                this.showImg(button, image, carNum);
            }));
            const card = $(event.target).closest(".item"), button = card.find(".videoSvg");
            if (button.attr("title") !== "播放视频") return;
            button.html(this.icons.recoveryVideoSvg).attr({ title: "切回封面", "aria-label": "切回封面" });
            const { carNum } = list.findCarNumAndHref(card), image = card.find("img");
            if (!image.length) { this.notifications.error("没有找到图片"); return; }
            void this.showVideo(button, image, carNum).catch((error) => this.recordError("卡片预览视频打开失败", error));
        }));
        documentRoot.on("click.jhsCoverButton", ".screenSvg", (async (/** @type {CardActionEvent} */ event) => {
            event.preventDefault();
            const loading = this.ui.loading();
            try {
                const card = $(event.currentTarget).closest(".item");
                const { carNum } = list.findCarNumAndHref(card), settings = this.settings.snapshot();
                const result = await this.screenshot.resolve({ carNum: carNum.replace("FC2-", "") }, { allowWhenDisabled: true, scope, settings });
                if (scope.disposed) return;
                const image = Array.isArray(result) ? result[0] : result;
                if (image?.url) {
                    const preview = this.document.createElement("img");
                    preview.src = image.url;
                    this.ui.openImageViewer(preview);
                }
            } catch (error) {
                this.recordError("图片预览出错", error);
                this.notifications.error(`图片预览出错:${error instanceof Error ? error.message : String(error)}`);
            } finally { loading.close?.(); }
        }));
        documentRoot.on("click.jhsCoverButton", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault(); event.stopPropagation();
            try {
                const button = $(event.currentTarget), card = button.closest(".item");
                const { carNum, url, publishTime, fc2Source } = list.findCarNumAndHref(card);
                const applyState = async (/** @type {string} */ action) => {
                    try {
                        const names = await list.parseActressName(url);
                        const flag = legacyActionToFlag(action);
                        if (!flag) throw new Error("不支持的状态操作");
                        await this.state.patch(carNum, { [flag]: true }, { type: "list-card-state", record: { carNum, url, names, publishTime, fc2Source } });
                        this.notifications.ok("操作成功");
                    } catch (error) { this.recordError("保存操作失败", error); this.notifications.error("操作失败"); }
                };
                button.hasClass("filterBtn") ? this.ui.confirm(event, `是否屏蔽${escapeHtml(carNum)}?`, () => applyState(d)) : button.hasClass("favoriteBtn") ? void applyState(h) : button.hasClass("hasDownBtn") ? void applyState(g) : button.hasClass("hasWatchBtn") && void applyState(p);
                this.closeCardMenus();
            } catch (error) { this.recordError("按钮点击处理失败", error); }
        }));
        const settings = this.settings.snapshot(), movie = this.movie;
        const missAv = movie.externalSiteOrigin("missAvBtn", settings), jable = movie.externalSiteOrigin("jableBtn", settings), avgle = movie.externalSiteOrigin("avgleBtn", settings), av123 = movie.providerOrigin("av123") || "";
        $(this.list.getSelector().itemSelector).each(((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => {
            const card = $(element);
            if (this.isJavBus && card.find(".avatar-box").length) return;
            const { carNum } = list.findCarNumAndHref(card);
            card.find(".site-jable").attr({ href: `${jable}/search/${carNum}/`, target: "_blank", rel: "noopener noreferrer" });
            card.find(".site-avgle").attr({ href: `${avgle}/vod/search.html?wd=${carNum}`, target: "_blank", rel: "noopener noreferrer" });
            card.find(".site-miss-av").attr({ href: `${missAv}/search/${carNum}`, target: "_blank", rel: "noopener noreferrer" });
            card.find(".site-123-av").attr({ href: `${av123}/cn/search?keyword=${encodeURIComponent(carNum)}`, target: "_blank", rel: "noopener noreferrer" });
        }));
        documentRoot.on("click.jhsCoverButton", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", ((/** @type {CardActionEvent} */ event) => {
            try {
                event.preventDefault(); event.stopPropagation();
                const button = $(event.currentTarget), { carNum } = list.findCarNumAndHref(button.closest(".item"));
                const url = button.hasClass("site-jable") ? `${jable}/search/${carNum}/`
                    : button.hasClass("site-avgle") ? `${avgle}/vod/search.html?wd=${carNum}`
                        : button.hasClass("site-miss-av") ? `${missAv}/search/${carNum}`
                            : `${av123}/cn/search?keyword=${encodeURIComponent(carNum)}`;
                this.navigation.open(url, { newTab: true, background: event.ctrlKey || event.metaKey });
                this.closeCardMenus();
            } catch (error) { this.recordError("站点按钮处理失败", error); }
        }));
        documentRoot.on("click.jhsCoverButton", ".titleSvg, .carNumSvg, .downSvg", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault(); event.stopPropagation();
            const button = $(event.currentTarget), card = button.closest(".item"), { carNum, title } = list.findCarNumAndHref(card);
            const cover = card.find(this.isJavBus ? ".photo-frame img" : ".cover img");
            if (button.hasClass("titleSvg")) void this.clipboard.copyText("标题", title);
            else if (button.hasClass("carNumSvg")) void this.clipboard.copyText("番号", carNum);
            else if (button.hasClass("downSvg")) void this.downloadCover(cover.attr("src"), `${carNum} ${title}.jpg`);
            this.closeCardMenus();
        }));
    }
    /** @param {JQueryHandle} e @param {JQueryHandle} t @param {string} n */
    showImg(e, t, n) {
        const $ = this.ui.jquery;
        e.html(this.icons.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
        let a = $(`#${`${n}_preview_video`}`);
        a.length > 0 && (a[0].pause(), a.parent().hide()), t.show(), t.removeClass("loading"), t.next(".loading-spinner").remove();
    }
    /** @param {JQueryHandle} e @param {JQueryHandle} t @param {string} n */
    async showVideo(e, t, n) {
        const $ = this.ui.jquery;
        const settings = this.settings.snapshot();
        if (!canUseCardPreview(settings)) return this.notifications.error("预览视频已关闭");
        const generation = this.previewGeneration;
        const a = `${n}_preview_video`;
        let i = $(`#${a}`);
        if (i.length > 0) return i.parent().show(), await this.playVideo(i[0], "当前视频源无法播放"), void t.hide();
        t.addClass("loading"), t.after('<div class="loading-spinner"></div>');
        const s = t.attr("data-full") || t.attr("src"), scope = this.scope, {sources: o, error: previewError} = await fetchDmmPreviewIfEnabled(n, this.storage, this.movie, scope, settings);
        if (generation !== this.previewGeneration || scope.disposed || !isPreviewEnabled(this.settings.snapshot())) return void this.showImg(e, t, n);
        if (!o) return this.notifications.error("REGION_BLOCKED" === previewError?.code ? previewError.message : "未解析到视频"), void this.showImg(e, t, n);
        let r = this.settings.snapshot().videoQuality;
        r = Z(Object.keys(o), r);
        const c = o[r];
        if (!c) return this.showImg(e, t, n);
        const wrapper = this.document.createElement("div"), video = this.document.createElement("video");
        this.isJavBus && (wrapper.className = "jhs-layout-d543acf8"), video.src = c, video.poster = s || "", video.id = a, video.controls = !0, video.loop = !0, video.muted = !0, video.playsInline = !0, video.className = "jhs-layout-a38a0e50", wrapper.appendChild(video),
        t.parent().append(wrapper), t.hide(), t.removeClass("loading"), t.next(".loading-spinner").remove(), i = $(video);
        const h = i[0];
        h.load(); h.muted = false;
        await this.playVideo(h, "REGION_BLOCKED" === previewError?.code ? previewError.message || "访问受限" : "当前视频源无法播放");
        i.trigger("focus");
    }

    /** @param {string} message @param {unknown} error */
    recordError(message, error) {
        this.diagnostics.recordError({ source: "cover-button-feature", featureId: "list", contributionId: "detail.cover-state-actions", message: `${message}: ${error instanceof Error ? error.message : String(error)}` });
    }

    /** @param {HTMLMediaElement} media @param {string} message */
    async playVideo(media, message) {
        return safePlay(media, {
            context: "列表卡片预览", notify: true, message,
            notifyUser: (text) => this.notifications.error(text), warn: (text, error) => this.recordError(text, error),
        });
    }

    /** @param {string | undefined} source @param {string} filename */
    async downloadCover(source, filename) {
        if (!source) return;
        try {
            const response = await this.window.fetch(source);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const objectUrl = this.window.URL.createObjectURL(await response.blob());
            const anchor = this.document.createElement("a");
            anchor.href = objectUrl; anchor.download = filename; this.document.body.appendChild(anchor); anchor.click(); anchor.remove();
            this.window.setTimeout(() => this.window.URL.revokeObjectURL(objectUrl), 100);
        } catch (error) { this.recordError("封面下载失败", error); this.notifications.error("封面下载失败"); }
    }

    stopAllPreviews() {
        const $ = this.ui.jquery;
        this.document.querySelectorAll('[id$="_preview_video"]').forEach((element) => {
            if (element instanceof this.window.HTMLVideoElement) element.pause();
            $(element).parent().remove();
        });
        $(".jhs-card-menu.is-open").removeClass("is-open");
        $(".jhs-card-menu-trigger").attr("aria-expanded", "false");
        $(".loading-spinner").remove();
        $(".videoSvg[title='切回封面']").each((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => {
            const button = $(element), card = button.closest(".item");
            card.find("img").show(); button.html(this.icons.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
        });
    }
}
