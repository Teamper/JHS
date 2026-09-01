// @ts-check

import { _, d, g, h, k, l, m, p, r, v, y } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { LIST_CARD_ICONS } from "../../core/list-card-icons.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { Z, canUseCardPreview, fetchDmmPreviewIfEnabled, isPreviewEnabled } from "../../services/preview-service.js";

/** @typedef {any} JQueryHandle */
/** @typedef {MouseEvent & { ctrlKey?: boolean, metaKey?: boolean }} CardActionEvent */

export class ListCoverStateActionsController {
    /** @param {{hostAdapter?: any, settings?: any, storage?: any, movie?: any, screenshot?: any, state?: any, features?: any, ui?: any, styles?: any, scope?: any, document?: Document, window?: Window, icons?: Record<string, string>}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.settings = options.settings ?? null;
        this.storage = options.storage ?? null;
        this.movie = options.movie ?? null;
        this.screenshot = options.screenshot ?? null;
        this.state = options.state ?? null;
        this.features = options.features ?? null;
        this.ui = options.ui ?? null;
        this.styles = options.styles ?? null;
        this.scope = options.scope ?? null;
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.icons = { ...LIST_CARD_ICONS, ...options.icons };
        /** @type {Record<string, any>} */ this.runtimeServices = {};
        this.styleRelease = null;
        this.disposed = false;
        this._settingsListenerBound = false;
        /** @type {number} */ this.previewGeneration = 0;
    }

    /** @param {string} name */
    getRuntimeService(name) {
        return this.runtimeServices[name] ?? ({
            host: this.hostAdapter,
            settings: this.settings,
            storage: this.storage,
            movie: this.movie,
            screenshot: this.screenshot,
            state: this.state,
            features: this.features,
            ui: this.ui,
            scope: this.scope,
        }[name] ?? null);
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getClog() { return this.ui?.getClog?.() ?? /** @type {any} */ (globalThis).clog ?? {}; }
    getShow() { return this.ui?.show ?? /** @type {any} */ (globalThis).show ?? {}; }
    getUtils() { return this.ui?.getUtils?.() ?? /** @type {any} */ (globalThis).utils ?? {}; }
    getLoading() { return this.ui?.getLoading?.() ?? /** @type {any} */ (globalThis).loading; }
    isListPage() { return Boolean(this.window?.isListPage); }

    /** Resolve the list capability used by card actions. */
    async getListFeatureApi(fallback = null) {
        if (fallback) return fallback;
        try {
            return await this.getRuntimeService("features")?.getFeatureApi?.("list");
        } catch (error) {
            this.getClog().warn?.("列表 Feature API 不可用，跳过卡片操作", error);
            return null;
        }
    }
    initCss() {
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

    registerStyles() {
        if (this.styleRelease || !this.styles) return;
        this.styleRelease = this.styles.register?.("jhs-list-cover-actions", this.initCss().replace(/^\s*<style>|<\/style>\s*$/g, "")) ?? null;
    }

    async resolveScope() {
        const scope = this.getRuntimeService("scope");
        return typeof scope === "function" ? scope() : scope;
    }

    /** @param {{scope?: any, listFeatureApi?: any}} [options] */
    async handle(options = {}) {
        if (!this.isListPage()) return;
        const scope = options.scope || await this.resolveScope();
        if (!scope) return;
        this.scope = scope;
        this.registerStyles();
        const listFeatureApi = options.listFeatureApi || await this.getListFeatureApi();
        const settingsService = this.getRuntimeService("settings");
        if (!settingsService) return;
        const $ = this.getJQuery();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
            if (names.some((name) => name === "enablePreviewVideo" || name === "enableLoadPreviewVideo")) {
                this.previewGeneration++;
                if (canUseCardPreview(settingsService.snapshot())) void this.addSvgBtn().catch((error => this.getClog().error?.("卡片预览重新挂载失败", error)));
                else {
                    $('[id$="_preview_video"]').each((/** @type {number} */ _, /** @type {HTMLVideoElement} */ element) => {
                        element.pause?.(), $(element).parent().remove();
                    });
                    void this.enableSvgBtn();
                }
            }
            // 长缩略图与卡片按钮开关即时重建工具箱，不保留死按钮。
            if (names.some((name) => [ "enableLoadScreenShot", "enableVideoSvg", "enableHandleSvg", "enableSiteSvg", "enableCopySvg" ].includes(name))) void this.enableSvgBtn();
        };
        // 6.5：listener 只注册一次，避免 ON→OFF→ON 循环累积；重新开启只重建按钮，不再递归 handle()。
        if (!this._settingsListenerBound) {
            this._settingsListenerBound = true;
            settingsService.addEventListener("settings.changed", onSettingsChanged);
            scope.addCleanup((() => {
                settingsService.removeEventListener("settings.changed", onSettingsChanged);
                this._settingsListenerBound = false;
            }));
        }
        this.addSvgBtn(null, listFeatureApi);
        await this.bindClick(scope, listFeatureApi);
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
    async addSvgBtn(items = null, listFeatureApi = null) {
        const $ = this.getJQuery();
        const listFeature = await this.getListFeatureApi(listFeatureApi), selectors = listFeature?.getListSelectors?.();
        if (!listFeature || !selectors) return;
        (items ? $(items).toArray() : $(selectors.itemSelector).toArray()).forEach(((/** @type {Element} */ element) => {
            const item = $(element);
            if (item.find(".tool-box").length || l && item.find(".avatar-box").length) return;
            const host = r ? item.find(".tags").first() : item.find(".photo-info").first();
            host.length && host.append(this.buildToolBox());
        })), this.enableSvgBtn(items);
    }
    /** @param {JQueryHandle | Element | null} [items] */
    async enableSvgBtn(items = null) {
        const $ = this.getJQuery(), e = this.getRuntimeService("settings")?.snapshot?.() ?? {}, {enableLoadScreenShot: t = _, enableVideoSvg: n = _, enablePreviewVideo: q = _, enableHandleSvg: a = _, enableSiteSvg: i = _, enableCopySvg: s = _} = e;
        const scope = items ? $(items) : $(this.document);
        // videoSvg 是 DMM-only 入口：Preview 总开关与 DMM 子开关都必须 ON，否则不显示（不留死按钮）。
        const screenshot = this.getRuntimeService("screenshot");
        [ { selector: ".screenSvg", enabled: t === _ && Boolean(screenshot?.isEnabled?.(e)) ? _ : "no" }, { selector: ".videoSvg", enabled: n === _ && canUseCardPreview(e) ? _ : "no" }, { selector: ".handleSvg", enabled: a }, { selector: ".siteSvg", enabled: i }, { selector: ".copySvg", enabled: s } ].forEach((({selector: e, enabled: t}) => {
            scope.find(e).toggle(t === _);
        }));
    }
    closeCardMenus(focus = !1) {
        const $ = this.getJQuery();
        const openMenus = $(".jhs-card-menu.is-open"), triggers = openMenus.siblings(".jhs-card-menu-trigger");
        openMenus.removeClass("is-open"), triggers.attr("aria-expanded", "false"), focus && triggers.first().trigger("focus");
    }
    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    async bindClick(scope, listFeatureApi = null) {
        const e = await this.getListFeatureApi(listFeatureApi), selectors = e?.getListSelectors?.();
        if (!e || !selectors) return;
        const $ = this.getJQuery(), show = this.getShow(), utils = this.getUtils(), loading = this.getLoading() ?? (() => ({ close: () => {} })), clog = this.getClog();
        const documentRoot = $(this.document);
        documentRoot.off(".jhsCoverButton");
        scope.addCleanup((() => documentRoot.off(".jhsCoverButton")));
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
        })), documentRoot.on("click.jhsCoverButton", ".videoSvg", ((/** @type {CardActionEvent} */ t) => {
            t.preventDefault(), $('.videoSvg[title!="播放视频"]').each(((/** @type {number} */ t, /** @type {HTMLElement} */ n) => {
                const a = $(n);
                let i = a.closest(".item"), s = i.find("img"), {carNum: o} = e.findCarNumAndHref(i);
                this.showImg(a, s, o), a.html(this.icons.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
            }));
            const n = $(t.target).closest(".item"), a = n.find(".videoSvg");
            if ("播放视频" === a.attr("title")) {
                a.html(this.icons.recoveryVideoSvg).attr({ title: "切回封面", "aria-label": "切回封面" });
                const {carNum: t} = e.findCarNumAndHref(n);
                let i = n.find("img");
                if (!i.length) return void show.error?.("没有找到图片");
                void this.showVideo(a, i, t).catch((error => clog.error?.("卡片预览视频打开失败", error)));
            }
        })), documentRoot.on("click.jhsCoverButton", ".screenSvg", (async (/** @type {CardActionEvent} */ t) => {
            t.preventDefault();
            let n = loading();
            try {
                const a = $(t.currentTarget).closest(".item");
                let {carNum: i} = e.findCarNumAndHref(a);
                i = i.replace("FC2-", "");
                const screenshot = this.getRuntimeService("screenshot"), settings = this.getRuntimeService("settings").snapshot();
                if (!screenshot?.isEnabled?.(settings)) throw new Error("剧照功能已禁用");
                const images = await screenshot.resolve({ carNum: i }, { scope: await this.getRuntimeService("scope")(), settings }), s = Array.isArray(images) ? images[0]?.url : images?.url;
                if (!s) throw new Error("暂无剧照结果");
                n.close(), (/** @type {any} */ (globalThis)).showImageViewer(s);
            } catch (a) {
                clog.error?.("图片预览出错:", a), show.error?.("图片预览出错:" + a);
            } finally { n.close(); }
        })), documentRoot.on("click.jhsCoverButton", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", ((/** @type {CardActionEvent} */ t) => {
            t.preventDefault(), t.stopPropagation();
            try {
                const n = $(t.currentTarget), a = n.closest(".item"), {carNum: i, url: s, publishTime: o, fc2Source} = e.findCarNumAndHref(a), r = async (/** @type {string} */ t) => {
                    try {
                        let n = await e.parseActressName(s);
                        const flag = legacyActionToFlag(t);
                        if (!flag) throw new Error("不支持的状态操作");
                        await this.getRuntimeService("state")?.patch?.(i, { [flag]: !0 }, { type: "list-card-state", record: { carNum: i, url: s, names: n, publishTime: o, fc2Source } }), show.ok?.("操作成功");
                    } catch (r) { clog.error?.("保存操作失败:", r), show.error?.("操作失败"); }
                };
                n.hasClass("filterBtn") ? utils.q(t, `是否屏蔽${i}?`, (() => r(d))) : n.hasClass("favoriteBtn") ? void r(h) : n.hasClass("hasDownBtn") ? void r(g) : n.hasClass("hasWatchBtn") && void r(p), this.closeCardMenus();
            } catch (t) { clog.error?.("按钮点击处理失败:", t); }
        }));
        const settings = this.getRuntimeService("settings")?.snapshot?.() ?? {}, movie = this.getRuntimeService("movie");
        if (!movie) return;
        const n = movie.externalSiteOrigin("missAvBtn", settings), a = movie.externalSiteOrigin("jableBtn", settings), i = movie.externalSiteOrigin("avgleBtn", settings), s = movie.providerOrigin("av123") || "";
        $(selectors.itemSelector).each(((/** @type {number} */ t, /** @type {HTMLElement} */ o) => {
            const r = $(o), {carNum: l} = e.findCarNumAndHref(r);
            r.find(".site-jable").attr({ href: `${a}/search/${l}/`, target: "_blank", rel: "noopener noreferrer" }),
            r.find(".site-avgle").attr({ href: `${i}/vod/search.html?wd=${l}`, target: "_blank", rel: "noopener noreferrer" }),
            r.find(".site-miss-av").attr({ href: `${n}/search/${l}`, target: "_blank", rel: "noopener noreferrer" }),
            r.find(".site-123-av").attr({ href: `${s}/cn/search?keyword=${encodeURIComponent(l)}`, target: "_blank", rel: "noopener noreferrer" });
        }));
        documentRoot.on("click.jhsCoverButton", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", ((/** @type {CardActionEvent} */ t) => {
            try {
                t.preventDefault(), t.stopPropagation();
                const o = $(t.currentTarget), r = o.closest(".item"), {carNum: l} = e.findCarNumAndHref(r);
                let c = null;
                o.hasClass("site-jable") ? c = `${a}/search/${l}/` : o.hasClass("site-avgle") ? c = `${i}/vod/search.html?wd=${l}` : o.hasClass("site-miss-av") ? c = `${n}/search/${l}` : o.hasClass("site-123-av") && (c = `${s}/cn/search?keyword=${encodeURIComponent(l)}`);
                if (!c) return;
            t.ctrlKey || t.metaKey ? GM_openInTab(c, { insert: 0 }) : this.window?.open?.(c), this.closeCardMenus();
            } catch (t) { clog.error?.("站点按钮处理失败:", t); }
        })), documentRoot.on("click.jhsCoverButton", ".titleSvg, .carNumSvg, .downSvg", ((/** @type {CardActionEvent} */ t) => {
            t.preventDefault(), t.stopPropagation();
            const n = $(t.currentTarget).closest(".item"), {carNum: a, title: i} = e.findCarNumAndHref(n), s = n.find(l ? ".photo-frame img" : ".cover img");
            $(t.currentTarget).hasClass("titleSvg") ? utils.copyToClipboard("标题", i) : $(t.currentTarget).hasClass("carNumSvg") ? utils.copyToClipboard("番号", a) : $(t.currentTarget).hasClass("downSvg") && fetch(s.attr("src")).then((e => e.blob())).then((e => utils.download(e, a + " " + i + ".jpg"))), this.closeCardMenus();
        }));
    }
    /** @param {JQueryHandle} e @param {JQueryHandle} t @param {string} n */
    showImg(e, t, n) {
        const $ = this.getJQuery();
        e.html(this.icons.videoSvg).attr({ title: "播放视频", "aria-label": "播放视频" });
        let a = $(`#${`${n}_preview_video`}`);
        a.length > 0 && (a[0].pause(), a.parent().hide()), t.show(), t.removeClass("loading"), t.next(".loading-spinner").remove();
    }
    /** @param {JQueryHandle} e @param {JQueryHandle} t @param {string} n */
    async showVideo(e, t, n) {
        const $ = this.getJQuery(), show = this.getShow(), settingsService = this.getRuntimeService("settings"), settings = settingsService?.snapshot?.() ?? {};
        if (!canUseCardPreview(settings)) return show.error?.("预览视频已关闭");
        const generation = this.previewGeneration;
        const a = `${n}_preview_video`;
        let i = $(`#${a}`);
        if (i.length > 0) return i.parent().show(), await safePlay(i[0], {
            context: "列表卡片预览",
            notify: !0
        }), void t.hide();
        t.addClass("loading"), t.after('<div class="loading-spinner"></div>');
        const s = t.attr("data-full") || t.attr("src"), scope = await this.resolveScope(), {sources: o, error: previewError} = await fetchDmmPreviewIfEnabled(n, this.getRuntimeService("storage"), this.getRuntimeService("movie"), scope, settings);
        if (generation !== this.previewGeneration || !isPreviewEnabled(settingsService?.snapshot?.() ?? {})) return void this.showImg(e, t, n);
        if (!o) return show.error?.("REGION_BLOCKED" === previewError?.code ? previewError.message : "未解析到视频"), void this.showImg(e, t, n);
        let r = settingsService?.snapshot?.().videoQuality;
        r = Z(Object.keys(o), r);
        const c = o[r], wrapper = this.document.createElement("div"), video = this.document.createElement("video");
        l || (wrapper.className = "jhs-layout-d543acf8"), video.src = c, video.poster = s || "", video.id = a, video.controls = !0, video.loop = !0, video.muted = !0, video.playsInline = !0, video.className = "jhs-layout-a38a0e50", wrapper.appendChild(video),
        t.parent().append(wrapper), t.hide(), t.removeClass("loading"), t.next(".loading-spinner").remove(), i = $(video);
        let h = i[0];
        h.load(), h.muted = !1, await safePlay(h, {
            context: "列表卡片预览",
            notify: !0,
            message: "REGION_BLOCKED" === previewError?.code ? previewError.message : "当前视频源无法播放"
        }), i.trigger("focus");
    }

    dispose() {
        this.disposed = true;
        this.previewGeneration++;
        this.styleRelease?.();
        this.styleRelease = null;
    }
}

/** Compatibility export for the retained disabled-plugin ID. */
export const CoverButtonPlugin = ListCoverStateActionsController;
