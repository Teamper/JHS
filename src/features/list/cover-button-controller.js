// @ts-check
import { OwnedPopover } from "../../core/owned-popover.js";
import { MediaPreviewSession } from "../../core/media-preview-session.js";
import { invalidateDmmPreview, isDmmEnabled } from "../../services/preview-service.js";

import { PRODUCT_NAMES } from "../../core/product-names.js";

import { _, d, g, h, k, m, p, v, y, escapeHtml } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { FEATURE_ICONS } from "../../core/feature-icons.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { assertMovieStateEligible, getMovieStateEligibility } from "../../core/movie-identity.js";
import { Z, canUseCardPreview, fetchDmmPreviewIfEnabled, isPreviewEnabled } from "../../services/preview-service.js";

/** @typedef {any} JQueryHandle */
/** @typedef {MouseEvent & { ctrlKey?: boolean, metaKey?: boolean }} CardActionEvent */

const COVER_BUTTON_STYLES = `
                .box .tags { justify-content:space-between; }
                .jhs-cover-tools { display:flex; flex-wrap:wrap; max-width:100%; align-items:center; justify-content:flex-end; gap:var(--jhs-space-2); margin-left:auto; }
                .jhs-cover-tools .screenSvg, .jhs-cover-tools .videoSvg { opacity:.65; }
                .jhs-cover-tools .screenSvg:hover, .jhs-cover-tools .videoSvg:hover { opacity:1; }
                `;
const COVER_MENU_STYLES = `
                .more-tools-container { position:relative; }
                .jhs-card-menu .jhs-btn, .jhs-card-menu .site-btn { width:100%; min-height:var(--jhs-control-height); justify-content:flex-start; margin:0; }
                .jhs-card-menu__dot { width:8px; height:8px; flex:none; border-radius:50%; background:var(--jhs-border-strong); }
                .jhs-card-menu__dot--watch { background:var(--jhs-status-watch); }
                .jhs-card-menu__dot--down { background:var(--jhs-status-down); }
                .jhs-card-menu__dot--fav { background:var(--jhs-status-fav); }
                .jhs-card-menu__dot--filter { background:var(--jhs-status-filter); }
                .loading { opacity:.7; filter:blur(1px); }
                .loading-spinner { position:absolute; top:50%; left:50%; width:64px; height:12px; transform:translate(-50%,-50%); z-index:var(--jhs-z-elevated); }
                .loading-spinner .loading-animation { display:block; }
            `;

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
        /** @type {any} */ this.activePreview = null;
        /** @type {OwnedPopover | null} */ this.activeCardPopover = null;
        this.started = false;
    }
    getStyles() { return `<style>${COVER_BUTTON_STYLES}${this.isJavBus ? ".jhs-cover-tools .icon, .setting-label .icon{height:24px;width:24px}" : ""}${COVER_MENU_STYLES}</style>`; }
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
                        <a role="menuitem" class="site-btn site-jable"><span>${PRODUCT_NAMES.jable}</span></a>
                        <a role="menuitem" class="site-btn site-avgle"><span>${PRODUCT_NAMES.avgle}</span></a>
                        <a role="menuitem" class="site-btn site-miss-av"><span>${PRODUCT_NAMES.missav}</span></a>
                        <a role="menuitem" class="site-btn site-123-av"><span>${PRODUCT_NAMES.av123}</span></a>
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
        // 卡片入口跟随预览总开关，DMM 关闭时转到详情原生预览。
        [ { selector: ".screenSvg", enabled: t === _ && screenshotAvailable ? _ : "no" }, { selector: ".videoSvg", enabled: n === _ && canUseCardPreview(e) ? _ : "no" }, { selector: ".handleSvg", enabled: a }, { selector: ".siteSvg", enabled: i }, { selector: ".copySvg", enabled: s } ].forEach((({selector: e, enabled: t}) => {
            scope.find(e).toggle(t === _);
        }));
        const cards = items ? $(items) : $(this.list.getSelector().itemSelector);
        cards.each((/** @type {number} */ _index, /** @type {Element} */ element) => {
            const card = $(element);
            let eligible = false;
            try { eligible = getMovieStateEligibility(this.list.findCarNumAndHref(card)).eligible; } catch { /* Resource and browsing actions remain available when identity is missing. */ }
            card.find(".jhs-card-status-item").prop("disabled", !eligible).attr("aria-disabled", String(!eligible));
        });
    }
    /** @param {JQueryHandle} card @param {string} [expectedCarNum] */
    readEligibleCard(card, expectedCarNum) {
        let record;
        try { record = this.list.findCarNumAndHref(card); } catch (error) { assertMovieStateEligible(null); throw error; }
        const stateEligibility = expectedCarNum && record.carNum !== expectedCarNum
            ? { eligible: false, reason: "conflicting" } : getMovieStateEligibility(record);
        assertMovieStateEligible({ ...record, stateEligibility });
        return { ...record, stateEligibility };
    }
    /** @param {JQueryHandle} button */
    cardForButton(button) {
        const direct = button.closest(".item");
        return direct.length ? direct : this.ui.jquery(button.closest(".jhs-card-menu").data("jhsCardOwner"));
    }
    closeCardMenus(focus = !1) {
        const popover = this.activeCardPopover;
        popover?.close(focus); this.activeCardPopover = null;
        if (focus && popover && this.document.activeElement === this.document.body) this.focusCard(popover.anchor, this.ui.jquery(popover.menu).data("jhsCardOwner"));
    }
    /** @param {HTMLElement | undefined} anchor @param {HTMLElement | undefined} card */
    focusCard(anchor, card) {
        if (this.scope.disposed) return;
        const cards = [...this.document.querySelectorAll(this.list.getSelector().itemSelector)], index = cards.indexOf(card);
        const candidates = [anchor, card?.querySelector("a[href]"), ...cards.slice(index + 1), ...cards.slice(0, index).reverse()].map(node => node?.matches(".item") ? node.querySelector("a[href]") : node);
        candidates.push(this.document.querySelector("#jhs-fab, #jhs-page-commandbar button"));
        const target = candidates.find(node => node?.isConnected && !node.matches(":disabled") && !node.closest("[hidden],[inert]") && node.getClientRects().length && this.window.getComputedStyle(node).visibility !== "hidden");
        /** @type {HTMLElement | undefined} */ (target)?.focus({ preventScroll: true });
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
            this.closeCardMenus();
            if (open) {
                menu.data("jhsCardOwner",trigger.closest(".item")[0]);
                this.activeCardPopover = new OwnedPopover(trigger[0],menu[0]); this.activeCardPopover.open();
            }
        })).on("keydown.jhsCoverButton", ".jhs-card-menu [role='menuitem']", ((/** @type {KeyboardEvent} */ event) => {
            const menu = $(event.currentTarget).closest(".jhs-card-menu"), items = menu.find("[role='menuitem']:not(:disabled)"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), this.closeCardMenus(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        })).on("click.jhsCoverButton", ((/** @type {CardActionEvent} */ event) => {
            $(event.target).closest(".more-tools-container,.jhs-owned-popover").length || this.closeCardMenus();
        }));
        documentRoot.on("click.jhsCoverButton", ".videoSvg", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault();
            const card = $(event.currentTarget).closest(".item"), button = card.find(".videoSvg"), image = card.find("img").first();
            const {carNum} = list.findCarNumAndHref(card);
            if (this.activePreview?.card === card[0]) return void this.showImg(button, image, carNum);
            this.stopAllPreviews();
            button.html(this.icons.recoveryVideoSvg).attr({title:"切回封面", "aria-label":"切回封面"});
            if (!image.length) return void this.notifications.error("没有找到封面");
            void this.showVideo(button, image, carNum).catch(error => this.recordError("卡片预览视频打开失败", error));
        }));
        documentRoot.on("click.jhsCoverButton", ".screenSvg", (async (/** @type {CardActionEvent} */ event) => {
            event.preventDefault();
            const trigger = event.currentTarget;
            const loading = this.ui.loading();
            try {
                const card = $(event.currentTarget).closest(".item");
                const { carNum } = list.findCarNumAndHref(card), settings = this.settings.snapshot();
                const result = await this.screenshot.resolve({ carNum }, { allowWhenDisabled: true, scope, settings });
                if (scope.disposed) return;
                const image = Array.isArray(result) ? result[0] : result;
                if (image?.url) {
                    this.ui.openImageViewer(image.url, {imageKind:"contact-sheet", owner:card[0], trigger, scope});
                } else this.notifications.info("暂无长缩略图");
            } catch (error) {
                this.recordError("图片预览出错", error);
                this.notifications.error("图片预览失败，请重试");
            } finally { loading.close?.(); }
        }));
        documentRoot.on("click.jhsCoverButton", ".filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault(); event.stopPropagation();
            try {
                const button = $(event.currentTarget), card = this.cardForButton(button);
                const { carNum } = this.readEligibleCard(card);
                const anchor = this.activeCardPopover?.anchor;
                this.closeCardMenus(!0);
                const applyState = async (/** @type {string} */ action) => {
                    if (scope.disposed) return;
                    let ownsFocus = !!anchor;
                    const moved = (/** @type {Event} */ event) => { if (event.target !== anchor) ownsFocus = false; };
                    const releaseFocus = scope.listen(this.document, "focusin", moved, true), releasePointer = scope.listen(this.document, "pointerdown", moved, true);
                    try {
                        const source = this.readEligibleCard(card, carNum);
                        const names = await list.parseActressName(source.url, scope);
                        if (scope.disposed) return;
                        const { url, publishTime, fc2Source, stateEligibility } = this.readEligibleCard(card, carNum);
                        const flag = legacyActionToFlag(action);
                        if (!flag) throw new Error("不支持的状态操作");
                        await this.state.patch(carNum, { [flag]: true }, { type: "list-card-state", record: { carNum, url, names, publishTime, fc2Source, stateEligibility } });
                        if (!scope.disposed) this.notifications.ok("已更新影片状态");
                    } catch (error) { if (!scope.disposed) { this.recordError("保存操作失败", error); this.notifications.error(/** @type {any} */ (error)?.code === "UNRELIABLE_MOVIE_IDENTITY" ? `已跳过 1 项：${/** @type {Error} */ (error).message}` : "状态更新失败，请重试"); } }
                    finally {
                        releaseFocus(); releasePointer();
                        if (ownsFocus && (this.document.activeElement === anchor || this.document.activeElement === this.document.body)) this.focusCard(anchor, card[0]);
                    }
                };
                button.hasClass("filterBtn") ? this.ui.confirm(event, `屏蔽「${escapeHtml(carNum)}」？`, () => applyState(d), { confirmText: "屏蔽" }) : button.hasClass("favoriteBtn") ? void applyState(h) : button.hasClass("hasDownBtn") ? void applyState(g) : button.hasClass("hasWatchBtn") && void applyState(p);
            } catch (error) {
                this.recordError("按钮点击处理失败", error);
                if (!scope.disposed && /** @type {any} */ (error)?.code === "UNRELIABLE_MOVIE_IDENTITY") this.notifications.error(`已跳过 1 项：${/** @type {Error} */ (error).message}`);
            }
        }));
        const settings = this.settings.snapshot(), movie = this.movie;
        const missAv = movie.externalSiteOrigin("missAvBtn", settings), jable = movie.externalSiteOrigin("jableBtn", settings), avgle = movie.externalSiteOrigin("avgleBtn", settings), av123 = movie.providerOrigin("av123") || "";
        $(this.list.getSelector().itemSelector).each(((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => {
            const card = $(element);
            if (this.isJavBus && card.find(".avatar-box").length) return;
            let carNum;
            try { ({ carNum } = list.findCarNumAndHref(card)); } catch { return; }
            card.find(".site-jable").attr({ href: `${jable}/search/${carNum}/`, target: "_blank", rel: "noopener noreferrer" });
            card.find(".site-avgle").attr({ href: `${avgle}/vod/search.html?wd=${carNum}`, target: "_blank", rel: "noopener noreferrer" });
            card.find(".site-miss-av").attr({ href: `${missAv}/search/${carNum}`, target: "_blank", rel: "noopener noreferrer" });
            card.find(".site-123-av").attr({ href: `${av123}/cn/search?keyword=${encodeURIComponent(carNum)}`, target: "_blank", rel: "noopener noreferrer" });
        }));
        documentRoot.on("click.jhsCoverButton", ".site-jable, .site-avgle, .site-miss-av, .site-123-av", ((/** @type {CardActionEvent} */ event) => {
            try {
                event.preventDefault(); event.stopPropagation();
                const button = $(event.currentTarget), { carNum } = list.findCarNumAndHref(this.cardForButton(button));
                const url = button.hasClass("site-jable") ? `${jable}/search/${carNum}/`
                    : button.hasClass("site-avgle") ? `${avgle}/vod/search.html?wd=${carNum}`
                        : button.hasClass("site-miss-av") ? `${missAv}/search/${carNum}`
                            : `${av123}/cn/search?keyword=${encodeURIComponent(carNum)}`;
                this.closeCardMenus(!0);
                this.navigation.open(url, { newTab: true, background: event.ctrlKey || event.metaKey });
            } catch (error) { this.recordError("站点按钮处理失败", error); }
        }));
        documentRoot.on("click.jhsCoverButton", ".titleSvg, .carNumSvg, .downSvg", ((/** @type {CardActionEvent} */ event) => {
            event.preventDefault(); event.stopPropagation();
            const button = $(event.currentTarget), card = this.cardForButton(button), { carNum, title } = list.findCarNumAndHref(card);
            const cover = card.find(this.isJavBus ? ".photo-frame img" : ".cover img");
            this.closeCardMenus(!0);
            if (button.hasClass("titleSvg")) void this.clipboard.copyText("标题", title);
            else if (button.hasClass("carNumSvg")) void this.clipboard.copyText("番号", carNum);
            else if (button.hasClass("downSvg")) void this.downloadCover(cover.attr("src"), `${carNum} ${title}.jpg`);
        }));
    }
    /** @param {JQueryHandle} e @param {JQueryHandle} t @param {string} n */
    showImg(e, t, n) {
        const session = this.activePreview;
        if (session && session.card === e.closest(".item")[0]) { this.activePreview = null; session.dispose(); session.wrapper?.remove(); session.release?.(); }
        e.html(this.icons.videoSvg).attr({title:"播放视频", "aria-label":"播放视频"});
        t.show().removeClass("loading"); t.next(".loading-spinner").remove();
    }
    /** @param {any} button @param {any} image @param {string} carNum */
    async showVideo(button, image, carNum) {
        const settings = this.settings.snapshot();
        if (!canUseCardPreview(settings)) return;
        const session = /** @type {any} */ (new MediaPreviewSession());
        session.card = this.cardForButton(button)[0]; this.activePreview = session;
        session.release = this.scope.addCleanup(() => session.dispose());
        const alive = () => this.activePreview === session && !session.scope.disposed && session.card.isConnected && isPreviewEnabled(this.settings.snapshot());
        const fallback = () => {
            if (!alive()) return;
            const reference = this.list.findCarNumAndHref(this.ui.jquery(session.card));
            this.showImg(button,image,carNum);
            if (reference.url && this.ui.openPage) this.ui.openPage(reference.url, carNum, true, {preview:true});
            else this.notifications.info("暂无可用预览视频");
        };
        if (!isDmmEnabled(settings)) return fallback();
        image.addClass("loading"); image.after('<div class="loading-spinner" role="status" aria-label="加载预览视频"><span class="loading-animation"></span></div>');
        let refreshed = false;
        const attempt = async () => {
            const result = await fetchDmmPreviewIfEnabled(carNum,this.storage,this.movie,session.scope,this.settings.snapshot());
            if (!alive()) return;
            if (!result.sources) return fallback();
            const quality = Z(Object.keys(result.sources),this.settings.snapshot().videoQuality);
            if (!quality || !result.sources[quality]) return fallback();
            const wrapper = this.document.createElement("div"), video = this.document.createElement("video");
            wrapper.className = "jhs-card-preview"; video.className = "jhs-layout-a38a0e50";
            video.src = result.sources[quality]; video.poster = image.attr("data-full") || image.attr("src") || "";
            video.controls = true; video.tabIndex = 0; video.loop = true; video.muted = this.settings.snapshot().videoMuted !== false; video.playsInline = true;
            wrapper.append(video); image.parent().append(wrapper); session.wrapper = wrapper; session.video = video;
            session.scope.listen(video,"error",()=>{
                if (!alive() || !session.mediaReady || session.video !== video || session.recovering) return;
                session.recovering=true; session.mediaReady=false; video.pause(); wrapper.remove(); image.show();
                this.recordError(`预览媒体错误 provider=dmm quality=${quality} code=${video.error?.code || 0} ready=${video.readyState} network=${video.networkState}`,"media-error");
                if (!refreshed) { refreshed=true; invalidateDmmPreview(carNum,this.storage); void attempt().catch(error=>{if(alive()){this.recordError("预览恢复失败",error);fallback();}}); }
                else fallback();
            });
            session.scope.addCleanup(() => { video.pause(); video.removeAttribute("src"); video.load(); wrapper.remove(); });
            video.load();
            const ready = await session.waitReady(video);
            if (!alive()) return;
            if (!ready) {
                this.recordError(`预览媒体加载失败 provider=dmm quality=${quality} code=${video.error?.code || 0} ready=${video.readyState} network=${video.networkState}`, "load-error");
                wrapper.remove();
                if (video.error && !refreshed) { refreshed = true; invalidateDmmPreview(carNum,this.storage); return attempt(); }
                return fallback();
            }
            session.mediaReady=true; session.recovering=false;
            image.hide().removeClass("loading"); image.next(".loading-spinner").remove();
            try {
                let rejection;
                const played = await safePlay(video, {notify:false, warn:(_message,error)=>{ rejection=error; }});
                if (!played) throw rejection || new Error("媒体元素不可用");
            }
            catch (error) {
                if (!alive()) return;
                this.recordError(`预览播放拒绝 provider=dmm quality=${quality} code=${video.error?.code || 0} ready=${video.readyState} network=${video.networkState}`,error);
                if (/** @type {any} */ (error)?.name === "NotAllowedError") { video.focus(); return; }
                if (/** @type {any} */ (error)?.name === "AbortError") return;
                wrapper.remove();
                if (!refreshed) { refreshed = true; invalidateDmmPreview(carNum,this.storage); return attempt(); }
                return fallback();
            }
            if (!alive()) video.pause(); else video.focus();
        };
        try { await attempt(); }
        catch (error) { if (alive()) { this.recordError("预览解析失败",error); fallback(); } }
    }

    /** @param {string} message @param {unknown} error */
    recordError(message, error) {
        this.diagnostics.recordError({ source: "cover-button-feature", featureId: "list", contributionId: "detail.cover-state-actions", message: `${message}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}` });
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
        const session = this.activePreview;
        if (session) this.showImg(this.ui.jquery(session.card).find(".videoSvg"), this.ui.jquery(session.card).find("img").first(), "");
        this.closeCardMenus();

    }
}
