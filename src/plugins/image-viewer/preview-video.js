// @ts-check

import { L, o } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { Z, fetchDmmPreview, isDmmEnabled, isPreviewEnabled } from "../../services/preview-service.js";

/** @typedef {any} JQueryHandle */
/** @typedef {{ code?: string, message?: string, retryable?: boolean }} PreviewFailure */

export class PreviewVideoPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        /** @type {number} */ this.previewGeneration = 0;
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
            }));
        }
        this.reconfigure();
    }
    /** 统一 reconfigure：总开关与 DMM 子开关都从这里走，禁止递归 handle()。 */
    reconfigure() {
        this.previewGeneration++;
        const settings = this.getRuntimeService("settings").snapshot();
        if (!isPreviewEnabled(settings)) return void this.unmountPreview();
        this.mountPreview();
        if (isDmmEnabled(settings)) void this.initDmm(this.lifecycleScope).catch((error => clog.error("预加载 DMM 失败", error)));
        else this.unmountDmmPlayer();
    }
    /** 幂等挂载：入口可见、click 绑定；gallery/autoPlay 只处理一次。 */
    mountPreview() {
        if (this._previewMounted) return;
        this._previewMounted = true;
        $(".preview-video-container").removeClass("jhs-native-preview-hidden");
        const trigger = $(".preview-video-container"), openVideo = () => {
            utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
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
        $('[data-jhs-dmm-trigger]').remove();
        const $dmm = $("#jhs-preview-video"), dmm = $dmm[0];
        dmm && (dmm.pause(), $dmm.removeAttr("src"), dmm.load(), $dmm.remove());
        $("#video-bottom-toolbar").remove();
        $("#preview-video").removeClass("jhs-native-preview-hidden");
        this.dmmPreviewPromise = null;
    }
    /** 总开关 OFF：卸载播放器、隐藏入口。 */
    unmountPreview() {
        this._previewMounted = false;
        this.unmountDmmPlayer();
        $(".preview-video-container").addClass("jhs-native-preview-hidden");
    }
    /** 卸载 JHS 播放器并把控制权交回宿主（宿主原生 UI 只做可逆隐藏，不销毁）。 */
    unmountJhsPreview() {
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
            const $video = $("#preview-video"), video = $video[0];
            if (video) return;
            clog.debug("JavDB没有视频播放元素, 开始创建...");
            const cover = $(".column-video-cover img").attr("src");
            $(".preview-images").prepend(`\n                <a class="preview-video-container" data-jhs-dmm-trigger="true" data-fancybox="gallery" href="#preview-video">\n                    <span>预告片</span>\n                    <img src="${cover}" class="video-cover jhs-layout-8cf76fd7" alt="">\n                </a>\n            `), $(".preview-video-container").off("click.jhsVideo").on("click.jhsVideo", (() => {
                utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => this.handleVideo().catch((error => clog.error("预览视频处理失败", error)))), 20, 1e4, !0, scope);
            }));
        } catch (error) {
            clog.error("预加载 DMM 失败:", error);
        }
    }
    /** 复用单次 DMM 请求，避免预加载和点击处理重复抓取。 */
    /** @param {any} [scope] @returns {Promise<import("../../services/preview-service.js").PreviewResult>} */
    getDmmPreview(scope = this.lifecycleScope) {
        if (this.dmmPreviewPromise) return this.dmmPreviewPromise;
        this.dmmPreviewPromise = Promise.resolve(scope || this.getRuntimeService("scope")()).then((requestScope => fetchDmmPreview(this.getPageInfo().carNum, this.getRuntimeService("storage"), this.getRuntimeService("movie"), requestScope))).then((result => {
            (result.error?.retryable || "HTTP_ERROR" === result.error?.code) && (this.dmmPreviewPromise = null);
            return result;
        }), (error => {
            this.dmmPreviewPromise = null;
            throw error;
        }));
        return this.dmmPreviewPromise;
    }
    /** 创建与 JavDB HLS 生命周期完全隔离的 DMM 播放器。 */
    /** @param {JQueryHandle} $nativeVideo @returns {JQueryHandle} */
    createDmmPlayer($nativeVideo) {
        const $host = $nativeVideo.parent(), existing = $host.find("#jhs-preview-video");
        if (existing.length) return existing;
        const $player = $('<video id="jhs-preview-video" class="jhs-video-player jhs-dmm-preview-player" controls playsinline></video>');
        return $nativeVideo.after($player), $player;
    }
    /** 销毁 JHS 播放器并把播放权完整交回 JavDB。 */
    /** @param {JQueryHandle} $nativeVideo @param {HTMLVideoElement} nativeVideo @param {boolean} [notify] */
    async restoreNativePlayer($nativeVideo, nativeVideo, notify = !1) {
        const $dmmVideo = $nativeVideo.parent().find("#jhs-preview-video"), dmmVideo = $dmmVideo[0];
        dmmVideo && (dmmVideo.pause(), $dmmVideo.removeAttr("src"), dmmVideo.load(), $dmmVideo.remove());
        $nativeVideo.removeClass("jhs-native-preview-hidden");
        return safePlay(nativeVideo, {
            context: "JavDB 原生预览回退",
            notify
        });
    }
    async handleVideo() {
        const $nativeVideo = $("#preview-video");
        if (!$nativeVideo.length) return;
        const settings = this.getRuntimeService("settings"), $host = $nativeVideo.parent().css("position", "relative"), nativeVideo = /** @type {HTMLVideoElement} */ ($nativeVideo[0]), muted = settings.snapshot().videoMuted;
        void safePlay(nativeVideo, {
            context: "JavDB 原生预览",
            notify: !1
        });
        const generation = this.previewGeneration;
        const dmmEnabled = isDmmEnabled(this.getRuntimeService("settings").snapshot()), dmmResult = dmmEnabled ? await this.getDmmPreview() : {
            sources: null,
            error: null
        };
        if (generation !== this.previewGeneration || !isPreviewEnabled(settings.snapshot()) || !isDmmEnabled(settings.snapshot())) return;
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
            const currentTime = nativeVideo.currentTime;
            $dmmVideo = this.createDmmPlayer($nativeVideo), dmmVideo = $dmmVideo[0], dmmVideo.muted = muted == null || muted === !0,
            $dmmVideo.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (() => {
                void settings.set("videoMuted", dmmVideo.muted).catch((/** @type {unknown} */ error) => clog.error("保存视频静音设置失败", error));
            })), $dmmVideo.attr("src", source), dmmVideo.load(), dmmVideo.currentTime = currentTime, $dmmVideo.addClass("is-active");
            dmmPlayed = await safePlay(dmmVideo, {
                context: "JavDB 高画质预览",
                notify: !1
            });
            if (!dmmPlayed && !dmmVideo.muted) dmmVideo.muted = !0, dmmPlayed = await safePlay(dmmVideo, {
                context: "JavDB 高画质预览静音重试",
                notify: !1
            });
            dmmPlayed ? (nativeVideo.pause(), $nativeVideo.addClass("jhs-native-preview-hidden")) : ($dmmVideo.removeClass("is-active"),
            await this.restoreNativePlayer($nativeVideo, nativeVideo, !0));
            dmmPlayed && L.forEach((quality => {
                const qualitySource = sources[quality.quality];
                if (!qualitySource) return;
                const active = dmmPlayed && selectedQuality === quality.quality;
                $qualityList.append($(`<button type="button" class="jhs-btn jhs-video-quality-btn${active ? " active" : ""}" data-quality="${quality.quality}" data-video-src="${qualitySource}" aria-pressed="${active ? "true" : "false"}">${quality.text}</button>`));
            }));
        }
        $toolbar.append($qualityList);
        const $actions = $("<div></div>").addClass("jhs-toolbar");
        const hasDetailActions = !!this.getOptionalDependency("DetailPageButtonPlugin");
        $actions.append(hasDetailActions ? '<button type="button" class="jhs-btn jhs-btn--filter jhs-layout-3f0d74e1" id="video-filterBtn">屏蔽</button>' : "", hasDetailActions ? '<button type="button" class="jhs-btn jhs-btn--fav jhs-layout-2afc43dc" id="video-favoriteBtn">收藏</button>' : "", '<button type="button" class="jhs-btn jhs-btn--down jhs-layout-5c319329" id="speed-btn">快进</button>'),
        $toolbar.append($actions), $host.append($toolbar), sources || await safePlay(nativeVideo, {
            context: "JavDB 预览视频",
            notify: !0,
            message: "REGION_BLOCKED" === error?.code ? error.message : "当前视频源无法播放"
        });
        $toolbar.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async (/** @type {MouseEvent} */ event) => {
            const $button = $(event.currentTarget);
            if ($button.hasClass("active")) return;
            try {
                if (!dmmVideo) return;
                const currentTime = dmmVideo.currentTime, previousSource = $dmmVideo.attr("src");
                $dmmVideo.attr("src", $button.data("video-src")), dmmVideo.load(), dmmVideo.currentTime = currentTime;
                const played = await safePlay(dmmVideo, {
                    context: "JavDB 画质切换",
                    notify: !1
                });
                if (played) $toolbar.find(".jhs-video-quality-btn").removeClass("active").attr("aria-pressed", "false"),
                $button.addClass("active").attr("aria-pressed", "true"); else {
                    previousSource && ($dmmVideo.attr("src", previousSource), dmmVideo.load(), dmmVideo.currentTime = currentTime);
                    const restored = previousSource && await safePlay(dmmVideo, {
                    context: "JavDB 画质切换回退",
                    notify: !1
                    });
                    restored || await this.restoreNativePlayer($nativeVideo, nativeVideo, !0);
                }
            } catch (playbackError) {
                clog.error("切换画质失败:", playbackError);
            }
        })), $("#speed-btn").off("click.jhsVideo").on("click.jhsVideo", (() => {
            dmmVideo && (dmmVideo.currentTime += 10);
        })),
        $toolbar.off("contextmenu.jhsVideo").on("contextmenu.jhsVideo", "#speed-btn", ((/** @type {MouseEvent} */ event) => (event.preventDefault(),
        this.getOptionalDependency("DetailPageButtonPlugin")?.filterOne?.(event)))),
        $("#video-filterBtn").off("click.jhsVideo").on("click.jhsVideo", ((/** @type {MouseEvent} */ event) => this.getOptionalDependency("DetailPageButtonPlugin")?.filterOne?.(event))),
        $("#video-favoriteBtn").off("click.jhsVideo").on("click.jhsVideo", ((/** @type {MouseEvent} */ event) => this.getOptionalDependency("DetailPageButtonPlugin")?.favoriteOne?.(event)));
    }
}
