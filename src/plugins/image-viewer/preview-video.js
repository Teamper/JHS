// @ts-check

import { createStateActions } from "../../ui/detail/state-actions.js";

import { L, o } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { Z, canUseDmmPreview, canUsePreview, fetchDmmPreview, isDmmEnabled, isPreviewEnabled } from "../../services/preview-service.js";

/** @typedef {any} JQueryHandle */
/** @typedef {{ code?: string, message?: string, retryable?: boolean }} PreviewFailure */

export class PreviewVideoPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        /** @type {number} */ this.previewGeneration = 0;
        /** @type {any} */ this.previewSession = null;
    }
    getName() {
        return "PreviewVideoPlugin";
    }
    async initCss() {
        return ".jhs-dmm-preview-player{display:none;width:100%;height:auto}.jhs-dmm-preview-player.is-active{display:block}.jhs-native-preview-hidden{display:none!important}";
    }
    async handle() {
        if (!isDetailPage) return;
        const settingsService = this.getRuntimeService("settings");
        if (!this.lifecycleScope) this.lifecycleScope = await this.getRuntimeService("scope")();
        if (!this._settingsListenerBound) {
            this._settingsListenerBound = true;
            const onSettingsChanged = (/** @type {any} */ event) => {
                const names = /** @type {string[] | undefined} */ (event.detail?.names);
                if (!names?.some((name) => name === "enablePreviewVideo" || name === "enableLoadPreviewVideo")) return;
                this.reconfigure();
            };
            settingsService.addEventListener("settings.changed", onSettingsChanged);
            this.lifecycleScope.addCleanup((() => {
                settingsService.removeEventListener("settings.changed", onSettingsChanged);
                this._settingsListenerBound = false;
                this.unmountPreview();
            }));
        }
        this.reconfigure();
    }
    /** 统一 reconfigure：总开关与 DMM 子开关都从这里走，禁止递归 handle()。 */
    reconfigure() {
        this.previewGeneration++;
        const settings = this.getRuntimeService("settings").snapshot();
        if (!canUsePreview(settings)) return void this.unmountPreview();
        this.mountPreview();
        if (canUseDmmPreview(settings)) void this.initDmm(this.lifecycleScope).catch((error => clog.error("预加载 DMM 失败", error)));
        else {
            this.unmountDmmPlayer();
            if ($(".fancybox-content #preview-video").length && !$("#video-bottom-toolbar").length) void this.handleVideo().catch(error => clog.error("恢复原生预览操作失败", error));
        }
    }
    /** 幂等挂载：入口可见、click 绑定；gallery/autoPlay 只处理一次。 */
    mountPreview() {
        if (this._previewMounted) return;
        this._previewMounted = true;
        $(".preview-video-container").removeClass("jhs-native-preview-hidden");
        const trigger = $(".preview-video-container"), openVideo = () => {
            this.cancelOpenWait?.();
            this.cancelOpenWait = utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
                this.handleVideo().catch((error => clog.error("预览视频处理失败", error)));
            }), 20, 1e4, !0, this.lifecycleScope);
        };
        trigger.off("click.jhsVideo").on("click.jhsVideo", openVideo);
        this.lifecycleScope.addCleanup((() => trigger.off("click.jhsVideo", openVideo)));
        const url = window.location.href;
        (url.includes("gallery-1") || url.includes("gallery-2")) && openVideo(), url.includes("autoPlay=1") && trigger.length > 0 && trigger[0].click();
    }
    /** 只销毁 JHS DMM 播放器并把控制权交回宿主原生预览（总开关仍开启时保留入口）。 */
    unmountDmmPlayer() {
        this.dmmRequestScope?.dispose();
        $('[data-jhs-dmm-trigger]').remove();
        const $dmm = $("#jhs-preview-video"), dmm = $dmm[0];
        const native = this.previewSession?.native;
        if (native && dmm && this.isSessionOpen(this.previewSession)) {
            this.seekVideo(native, dmm.currentTime);
            if (!dmm.paused && isPreviewEnabled(this.getRuntimeService("settings").snapshot())) void safePlay(native, { context: "恢复原生预览", notify: false }).then(() => {
                if (this.previewSession?.native !== native) native.pause();
            });
            else native.pause();
        }
        dmm && (dmm.pause(), $dmm.removeAttr("src"), dmm.load(), $dmm.remove());
        $("#video-bottom-toolbar .jhs-video-quality-list").empty();
        $("#preview-video").removeClass("jhs-native-preview-hidden");
        this.dmmPreviewPromise = null;
        if (this.previewSession && !native) this.disposePreviewSession();
    }
    /** 总开关 OFF：卸载播放器、隐藏入口。 */
    unmountPreview() {
        this._previewMounted = false;
        this.cancelOpenWait?.();
        this.disposePreviewSession();
        this.unmountDmmPlayer();
        $("#video-bottom-toolbar").remove();
        $(".preview-video-container").addClass("jhs-native-preview-hidden");
    }
    /** 卸载 JHS 播放器并把控制权交回宿主（宿主原生 UI 只做可逆隐藏，不销毁）。 */
    unmountJhsPreview() {
        this.disposePreviewSession();
        $('[data-jhs-dmm-trigger]').remove();
        const $dmm = $("#jhs-preview-video"), dmm = $dmm[0];
        dmm && (dmm.pause(), $dmm.removeAttr("src"), dmm.load(), $dmm.remove());
        $("#video-bottom-toolbar").remove();
        $("#preview-video").removeClass("jhs-native-preview-hidden");
        $(".preview-video-container").addClass("jhs-native-preview-hidden");
    }
    /** @param {any} scope */
    async initDmm(scope) {
        const generation = this.previewGeneration, settings = this.getRuntimeService("settings");
        try {
            const {sources} = await this.getDmmPreview(scope);
            if (generation !== this.previewGeneration || scope?.disposed || !isPreviewEnabled(settings.snapshot()) || !isDmmEnabled(settings.snapshot())) return;
            if (!sources) return;
            if ($(".fancybox-content #preview-video").length) { await this.handleVideo(); return; }
            const $video = $("#preview-video"), video = $video[0];
            if (video) return;
            clog.debug("JavDB没有视频播放元素, 开始创建...");
            const cover = $(".column-video-cover img").attr("src");
            if ($('[data-jhs-dmm-trigger]').length) return;
            const trigger = $('<button type="button" class="jhs-btn preview-video-container" data-jhs-dmm-trigger="true"><span>预告片</span></button>');
            trigger.append($('<img class="video-cover jhs-layout-8cf76fd7" alt="">').attr("src", cover || ""));
            $(".preview-images").first().prepend(trigger);
            trigger.on("click.jhsVideo", () => this.openDmmDialog());
        } catch (error) {
            clog.error("预加载 DMM 失败:", error);
        }
    }
    /** 复用单次 DMM 请求，避免预加载和点击处理重复抓取。 */
    /** @param {any} [scope] @returns {Promise<import("../../services/preview-service.js").PreviewResult>} */
    getDmmPreview(scope = this.lifecycleScope) {
        if (this.dmmPreviewPromise) return this.dmmPreviewPromise;
        const requestScope = new LifecycleScope("javdb-dmm-request");
        this.dmmRequestScope = requestScope;
        /** @type {(() => void) | undefined} */ let releaseOwner;
        /** @type {Promise<import("../../services/preview-service.js").PreviewResult>} */
        const pending = Promise.resolve(scope || this.getRuntimeService("scope")()).then(owner => {
            if (owner?.disposed || requestScope.disposed) throw new Error("预览请求已取消");
            releaseOwner = owner?.addCleanup?.(() => requestScope.dispose());
            return fetchDmmPreview(this.getPageInfo().carNum, this.getRuntimeService("storage"), this.getRuntimeService("movie"), requestScope);
        }).then((result => {
            if (this.dmmPreviewPromise === pending && (result.error?.retryable || "HTTP_ERROR" === result.error?.code)) this.dmmPreviewPromise = null;
            return result;
        }), (error => {
            if (this.dmmPreviewPromise === pending) this.dmmPreviewPromise = null;
            throw error;
        })).finally(() => { requestScope.dispose(); if (typeof releaseOwner === "function") releaseOwner(); });
        this.dmmPreviewPromise = pending;
        return pending;
    }
    /** 创建与 JavDB HLS 生命周期完全隔离的 DMM 播放器。 */
    /** @param {JQueryHandle} $nativeVideo @returns {JQueryHandle} */
    createDmmPlayer($nativeVideo) {
        const $host = $nativeVideo.length ? $nativeVideo.parent() : $(this.previewSession?.host), existing = $host.find("#jhs-preview-video");
        if (existing.length) return existing;
        const $player = $('<video id="jhs-preview-video" class="jhs-video-player jhs-dmm-preview-player" controls playsinline></video>');
        return $host.append($player), $player;
    }
    /** @param {any} session */
    isSessionOpen(session) {
        if (!session || session.scope.disposed || !session.host.isConnected || session.native && !session.host.contains(session.native)) return false;
        for (let node = session.host; node; node = node.parentElement) if (node.getAttribute("aria-hidden") === "true" || getComputedStyle(node).display === "none") return false;
        return true;
    }
    /** @param {HTMLVideoElement} video @param {number} time */
    seekVideo(video, time) {
        const seek = () => { try { video.currentTime = Math.max(0, Math.min(time || 0, Number.isFinite(video.duration) ? video.duration : Infinity)); } catch {} };
        seek();
        const session = this.previewSession;
        session?.seekCleanups?.get(video)?.();
        if (!video.readyState && session) {
            session.seekCleanups ||= new Map();
            const loaded = () => { cleanup(); if (this.isSessionOpen(session)) seek(); };
            const failed = () => cleanup();
            const timer = setTimeout(failed, 5000);
            const cleanup = session.scope.addCleanup(() => {
                clearTimeout(timer); video.removeEventListener("loadedmetadata", loaded); video.removeEventListener("error", failed); session.seekCleanups.delete(video);
            });
            video.addEventListener("loadedmetadata", loaded, {once:true}); video.addEventListener("error", failed, {once:true});
            session.seekCleanups.set(video, cleanup);
        }
    }
    disposePreviewSession() {
        const session = this.previewSession;
        this.previewSession = null;
        if (!session) return;
        this.dmmRequestScope?.dispose();
        this.dmmPreviewPromise = null;
        session.scope.dispose();
        $(session.host).find("#video-bottom-toolbar").remove();
        const player = session.host.querySelector("#jhs-preview-video");
        if (player) { player.pause(); player.removeAttribute("src"); player.load(); player.remove(); }
        session.native?.classList.remove("jhs-native-preview-hidden");
        session.native?.pause();
        if (session.dialogId != null) this.getRuntimeService("dialog").close(session.dialogId);
    }
    openDmmDialog() {
        if (!canUseDmmPreview(this.getRuntimeService("settings").snapshot()) || this.previewSession) return;
        const host = $('<div data-jhs-preview-host="true"></div>');
        this.getRuntimeService("dialog").open({ type: 1, title: "预告片", ui: { body: "media" }, content: host, area: utils.getDialogArea("lg"),
            success: (/** @type {any} */ layer, /** @type {number} */ id) => { void this.handleVideo(host[0], id).catch(error => clog.error("预览失败", error)); },
            end: () => { if (this.previewSession?.host === host[0]) this.disposePreviewSession(); }
        });
    }
    /** 销毁 JHS 播放器并把播放权完整交回 JavDB。 */
    /** Wait for decodable media without treating a paused player as loaded. @param {HTMLVideoElement} video */
    waitForDmmReady(video) {
        const signal = this.previewSession?.scope.signal;
        if (signal?.aborted || video.error) return Promise.resolve(false);
        if (video.readyState >= 3) return Promise.resolve(true);
        return new Promise(resolve => {
            const finish = (/** @type {boolean} */ ready) => {
                clearTimeout(timer);
                video.removeEventListener("canplay", loaded);
                video.removeEventListener("error", failed);
                signal?.removeEventListener("abort", failed);
                resolve(ready);
            };
            const loaded = () => finish(true), failed = () => finish(false);
            const timer = setTimeout(failed, 10000);
            video.addEventListener("canplay", loaded, { once: true });
            video.addEventListener("error", failed, { once: true });
            signal?.addEventListener("abort", failed, { once: true });
        });
    }
    /** @param {JQueryHandle} $nativeVideo @param {HTMLVideoElement | undefined} nativeVideo @param {boolean} [notify] */
    async restoreNativePlayer($nativeVideo, nativeVideo, notify = !1, shouldPlay = !0) {
        if (!nativeVideo || !this.isSessionOpen(this.previewSession)) return false;
        const $dmmVideo = $nativeVideo.parent().find("#jhs-preview-video"), dmmVideo = $dmmVideo[0];
        dmmVideo && (dmmVideo.pause(), $dmmVideo.removeAttr("src"), dmmVideo.load(), $dmmVideo.remove());
        $nativeVideo.removeClass("jhs-native-preview-hidden");
        if (!shouldPlay) { nativeVideo.pause(); return true; }
        return safePlay(nativeVideo, {
            context: "JavDB 原生预览回退",
            notify
        });
    }
    async handleVideo(/** @type {HTMLElement | null} */ ownedHost = null, /** @type {number | null} */ dialogId = null) {
        const $nativeVideo = $(".fancybox-content #preview-video");
        const host = ownedHost || $nativeVideo[0]?.closest(".fancybox-content");
        if (!host || !isPreviewEnabled(this.getRuntimeService("settings").snapshot()) || getComputedStyle(host).display === "none") return;
        if (this.previewSession?.host !== host) {
            this.disposePreviewSession();
            const scope = new LifecycleScope("javdb-preview");
            this.previewSession = { host, native: $nativeVideo[0] || null, scope, dialogId };
            scope.observe(document.body, () => { if (this.previewSession?.host === host && !this.isSessionOpen(this.previewSession)) this.disposePreviewSession(); }, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "aria-hidden"] });
        }
        const session = this.previewSession;
        if (session.generation === this.previewGeneration) return;
        session.generation = this.previewGeneration;
        const alive = () => this.previewSession === session && this.isSessionOpen(session) && generation === this.previewGeneration && isPreviewEnabled(this.getRuntimeService("settings").snapshot());
        const settings = this.getRuntimeService("settings"), $host = $(host), nativeVideo = /** @type {HTMLVideoElement | undefined} */ ($nativeVideo[0]), muted = settings.snapshot().videoMuted;
        const generation = this.previewGeneration;
        const dmmEnabled = isDmmEnabled(this.getRuntimeService("settings").snapshot()), dmmResult = dmmEnabled ? await this.getDmmPreview() : {
            sources: null,
            error: null
        };
        if (!alive()) return;
        const {sources, error} = dmmResult, $toolbar = $("<div></div>").attr("id", "video-bottom-toolbar").addClass("jhs-video-toolbar"), $qualityList = $("<div></div>").addClass("jhs-video-quality-list").attr({
            role: "group",
            "aria-label": "视频画质"
        });
        $host.find("#video-bottom-toolbar").remove();
        let dmmPlayed = !1;
        /** @type {JQueryHandle | null} */
        let $dmmVideo = null;
        /** @type {any} Legacy jQuery media handle promoted to an HTMLVideoElement at runtime. */
        let dmmVideo = null;
        if (sources) {
            const preferredQuality = this.getRuntimeService("settings").snapshot().videoQuality, selectedQuality = /** @type {string} */ (Z(Object.keys(sources), preferredQuality)), source = /** @type {string} */ (sources[selectedQuality]);
            const currentTime = nativeVideo?.currentTime || 0, shouldPlay = !nativeVideo || !nativeVideo.paused;
            $dmmVideo = this.createDmmPlayer($nativeVideo), dmmVideo = $dmmVideo[0], dmmVideo.muted = muted == null || muted === !0,
            $dmmVideo.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (() => {
                void settings.set("videoMuted", dmmVideo.muted).catch((/** @type {unknown} */ error) => clog.error("保存视频静音设置失败", error));
            })), $dmmVideo.attr("src", source), dmmVideo.load(), this.seekVideo(dmmVideo, currentTime), $dmmVideo.addClass("is-active");
            const ready = await this.waitForDmmReady(dmmVideo);
            if (!alive()) { dmmVideo.pause(); return; }
            dmmPlayed = ready && (!shouldPlay || await safePlay(dmmVideo, {
                context: "JavDB 高画质预览",
                notify: !1
            }));
            if (!alive()) { dmmVideo.pause(); return; }
            if (ready && !dmmPlayed && !dmmVideo.muted) dmmVideo.muted = !0, dmmPlayed = await safePlay(dmmVideo, {
                context: "JavDB 高画质预览静音重试",
                notify: !1
            });
            if (!alive()) { dmmVideo.pause(); return; }
            dmmPlayed ? (nativeVideo?.pause(), $nativeVideo.addClass("jhs-native-preview-hidden")) : ($dmmVideo.removeClass("is-active"),
            await this.restoreNativePlayer($nativeVideo, nativeVideo, !0, shouldPlay));
            if (!alive()) return;
            if (!dmmPlayed && !nativeVideo) { show.error("当前视频源无法播放"); this.disposePreviewSession(); return; }
            dmmPlayed && L.forEach((quality => {
                const qualitySource = sources[quality.quality];
                if (!qualitySource) return;
                const active = dmmPlayed && selectedQuality === quality.quality;
                $qualityList.append($('<button type="button" class="jhs-btn jhs-video-quality-btn"></button>').toggleClass("active", active).attr({ "data-quality": quality.quality, "data-video-src": qualitySource, "aria-pressed": String(active) }).text(quality.text));
            }));
        }
        $toolbar.append($qualityList);
        const $actions = $("<div></div>").addClass("jhs-toolbar");
        const hasDetailActions = !!this.getOptionalDependency("DetailPageButtonPlugin");
        if (hasDetailActions) $actions.append(createStateActions({ actions: ["blocked", "favorite"], ids: { blocked: "video-filterBtn", favorite: "video-favoriteBtn" } }));
        $actions.append('<button type="button" class="jhs-btn jhs-btn--secondary" id="speed-btn">快进</button>');
        if (!alive()) return;
        $toolbar.append($actions); $host.append($toolbar);
        $toolbar.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async (/** @type {MouseEvent} */ event) => {
            const $button = $(event.currentTarget);
            if ($button.hasClass("active")) return;
            try {
                if (!dmmVideo?.isConnected || !alive()) return;
                const currentTime = dmmVideo.currentTime, previousSource = $dmmVideo.attr("src"), shouldPlay = !dmmVideo.paused;
                $dmmVideo.attr("src", $button.data("video-src")), dmmVideo.load(), this.seekVideo(dmmVideo, currentTime);
                const ready = await this.waitForDmmReady(dmmVideo);
                if (!alive()) return;
                const played = ready && (!shouldPlay || await safePlay(dmmVideo, {
                    context: "JavDB 画质切换",
                    notify: !1
                }));
                if (!alive()) return;
                if (played) $toolbar.find(".jhs-video-quality-btn").removeClass("active").attr("aria-pressed", "false"),
                $button.addClass("active").attr("aria-pressed", "true"); else {
                    previousSource && ($dmmVideo.attr("src", previousSource), dmmVideo.load(), dmmVideo.currentTime = currentTime);
                    const restored = previousSource && await this.waitForDmmReady(dmmVideo) && (!shouldPlay || await safePlay(dmmVideo, {
                    context: "JavDB 画质切换回退",
                    notify: !1
                    }));
                    if (!alive()) return;
                    restored || await this.restoreNativePlayer($nativeVideo, nativeVideo, !0, shouldPlay);
                }
            } catch (playbackError) {
                clog.error("切换画质失败:", playbackError);
            }
        })), $("#speed-btn").off("click.jhsVideo").on("click.jhsVideo", (() => {
            const current = $host.find("#jhs-preview-video.is-active")[0] || nativeVideo;
            if (current?.isConnected && this.isSessionOpen(session)) this.seekVideo(current, current.currentTime + 10);
        })),
        $toolbar.off("contextmenu.jhsVideo").on("contextmenu.jhsVideo", "#speed-btn", ((/** @type {MouseEvent} */ event) => (event.preventDefault(),
        this.getOptionalDependency("DetailPageButtonPlugin")?.filterOne?.(event)))),
        $("#video-filterBtn").off("click.jhsVideo").on("click.jhsVideo", ((/** @type {MouseEvent} */ event) => this.getOptionalDependency("DetailPageButtonPlugin")?.filterOne?.(event))),
        $("#video-favoriteBtn").off("click.jhsVideo").on("click.jhsVideo", ((/** @type {MouseEvent} */ event) => this.getOptionalDependency("DetailPageButtonPlugin")?.favoriteOne?.(event)));
        const detail = this.getOptionalDependency("DetailPageButtonPlugin"), controller = detail?.getDetailStateController?.();
        if (controller) {
            $toolbar.find("#video-filterBtn,#video-favoriteBtn").off("click.jhsVideo");
            const config = controller.bind({ root: $toolbar[0], closeRoot: document.documentElement, carNum: this.getPageInfo().carNum, layerIndex: utils.getOwningLayerIndex({ root: document.documentElement }), getRecord: () => detail.getStateRecord(), selectors: { blocked: "#video-filterBtn", favorite: "#video-favoriteBtn" } });
            session.stateCleanup?.();
            session.stateCleanup = jhsEventBus?.on("car-state-changed", payload => { if (payload.carNums?.includes(config.carNum) && this.isSessionOpen(session)) return controller.render(config); });
            if (session.stateCleanup) session.scope.addCleanup(session.stateCleanup);
        }
    }
}
