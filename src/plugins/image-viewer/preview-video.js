import { ProviderError } from "../../core/cache-policy.js";
import { C, L, _, normalizeCarNum, o } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";

export const Z = (e, t) => {
    if (!e || 0 === e.length) return null;
    const n = new Set(e);
    if (n.has(t)) return t;
    const a = L.map((e => e.quality)).reverse();
    for (const i of a) if (n.has(i)) return i;
    return e[0];
}, ee = "jhs_dmm_video";

class DmmPreviewParser {
    constructor(e, storage, movie, scope) {
        this.carNum = e, this.storage = storage, this.movie = movie, this.scope = scope, this.lastError = null;
    }
    _checkCache() {
        const cached = this.storage.getLocal(ee), e = cached ? JSON.parse(cached) : {};
        return e[this.carNum] ? (clog.debug("缓存中存在预览视频信息", e[this.carNum]), e[this.carNum]) : null;
    }
    _updateCache(e) {
        const cached = this.storage.getLocal(ee), t = cached ? JSON.parse(cached) : {};
        t[this.carNum] = e, clog.debug("成功解析出预览视频并已缓存:", e), this.storage.setLocal(ee, JSON.stringify(t));
    }
    async _fetchRemote() {
        const result = await this.movie.preview("dmm", { carNum: this.carNum }, { scope: this.scope });
        const button = $("#fanzaBtn");
        if (!result.sources) {
            clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
            button.attr("href", result.searchUrl).attr("title", "未查询到, 点击前往搜索页").css("backgroundColor", "var(--jhs-status-filter)");
            return null;
        }
        button.attr("href", result.pageUrl).css("backgroundColor", "var(--jhs-status-down)");
        if (result.matchType === "multiple") button.append('<span class="site-tag jhs-layout-294497f1">多结果</span>');
        const cacheKey = "jhs_other_site_dmm", cached = this.storage.getLocal(cacheKey), cache = cached ? JSON.parse(cached) : {};
        cache[this.carNum] = { type: result.matchType, url: result.pageUrl };
        this.storage.setLocal(cacheKey, JSON.stringify(cache));
        return result.sources;
    }
    async fetchVideo() {
        const carNum = normalizeCarNum(this.carNum);
        if (!carNum) return clog.warn("跳过 DMM 解析：番号不可用"), null;
        this.carNum = carNum;
        const e = this._checkCache();
        if (e) return e;
        try {
            const e = this.carNum.toLowerCase();
            if (e.startsWith("heyzo") || /^(n\d+|\d+(-\d+)*)$/.test(e) || /^n\d+$/.test(e)) return clog.debug("无码番号类型，取消 DMM 解析"), null;
            if (this.carNum.includes("VR-")) return clog.debug("VR 类型，取消 DMM 解析"), null;
            const sources = await this._fetchRemote();
            if (!sources) return null;
            return this._updateCache(sources), sources;
        } catch (n) {
            this.lastError = n instanceof ProviderError ? n : new ProviderError("dmm", n?.code || "PARSE_ERROR", n.message || String(n), {
                cause: n,
                retryable: n?.retryable === true
            }), clog.error("DMM API 搜索失败:", this.lastError);
            const e = $("#fanzaBtn");
            return e.attr("href", this.movie.searchUrl("dmm", { carNum: this.carNum })),
            e.attr("title", "未查询到, 点击前往搜索页"), e.css("backgroundColor", "var(--jhs-status-filter)"), null;
        }
    }
}

/** 获取 DMM 预览源及可供界面判断的失败原因。 */
export async function fetchDmmPreview(carNum, storage, movie, scope) {
    const parser = new DmmPreviewParser(carNum, storage, movie, scope), sources = await parser.fetchVideo();
    return {
        sources,
        error: parser.lastError
    };
}

export class PreviewVideoPlugin extends BasePlugin {
    getName() {
        return "PreviewVideoPlugin";
    }
    async initCss() {
        return ".jhs-dmm-preview-player{display:none;width:100%;height:auto}.jhs-dmm-preview-player.is-active{display:block}.jhs-native-preview-hidden{display:none!important}";
    }
    async handle() {
        if (!isDetailPage) return;
        const trigger = $(".preview-video-container"), openVideo = () => {
            utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
                this.handleVideo().catch((error => clog.error("预览视频处理失败", error)));
            }));
        };
        trigger.off("click.jhsVideo").on("click.jhsVideo", openVideo);
        await storageManager.getSetting("enableLoadPreviewVideo", _) !== _ || o.includes("autoPlay=1") || this.initDmm();
        const url = window.location.href;
        (url.includes("gallery-1") || url.includes("gallery-2")) && openVideo(), url.includes("autoPlay=1") && trigger.length > 0 && trigger[0].click();
    }
    async initDmm() {
        try {
            const {sources} = await this.getDmmPreview();
            if (!sources) return;
            const $video = $("#preview-video"), video = $video[0];
            if (video) return;
            clog.debug("JavDB没有视频播放元素, 开始创建...");
            const cover = $(".column-video-cover img").attr("src");
            $(".preview-images").prepend(`\n                <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">\n                    <span>预告片</span>\n                    <img src="${cover}" class="video-cover jhs-layout-8cf76fd7" alt="">\n                </a>\n            `), $(".preview-video-container").off("click.jhsVideo").on("click.jhsVideo", (() => {
                utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => this.handleVideo().catch((error => clog.error("预览视频处理失败", error)))));
            }));
        } catch (error) {
            clog.error("预加载 DMM 失败:", error);
        }
    }
    /** 复用单次 DMM 请求，避免预加载和点击处理重复抓取。 */
    getDmmPreview() {
        if (this.dmmPreviewPromise) return this.dmmPreviewPromise;
        this.dmmPreviewPromise = fetchDmmPreview(this.getPageInfo().carNum, this.getRuntimeService("storage"), this.getRuntimeService("movie"), this.getRuntimeService("scope")()).then((result => {
            (result.error?.retryable || "HTTP_ERROR" === result.error?.code) && (this.dmmPreviewPromise = null);
            return result;
        }), (error => {
            this.dmmPreviewPromise = null;
            throw error;
        }));
        return this.dmmPreviewPromise;
    }
    /** 创建与 JavDB HLS 生命周期完全隔离的 DMM 播放器。 */
    createDmmPlayer($nativeVideo) {
        const $host = $nativeVideo.parent(), existing = $host.find("#jhs-preview-video");
        if (existing.length) return existing;
        const $player = $('<video id="jhs-preview-video" class="jhs-video-player jhs-dmm-preview-player" controls playsinline></video>');
        return $nativeVideo.after($player), $player;
    }
    /** 销毁 JHS 播放器并把播放权完整交回 JavDB。 */
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
        const settings = this.getRuntimeService("settings"), $host = $nativeVideo.parent().css("position", "relative"), nativeVideo = $nativeVideo[0], muted = settings.snapshot().videoMuted;
        void safePlay(nativeVideo, {
            context: "JavDB 原生预览",
            notify: !1
        });
        const dmmEnabled = await storageManager.getSetting("enableLoadPreviewVideo", _) !== C, dmmResult = dmmEnabled ? await this.getDmmPreview() : {
            sources: null,
            error: null
        }, {sources, error} = dmmResult, $toolbar = $("<div></div>").attr("id", "video-bottom-toolbar").addClass("jhs-video-toolbar"), $qualityList = $("<div></div>").addClass("jhs-video-quality-list").attr({
            role: "group",
            "aria-label": "视频画质"
        });
        $host.find("#video-bottom-toolbar").remove();
        let dmmPlayed = !1, $dmmVideo = null, dmmVideo = null;
        if (sources) {
            const preferredQuality = await storageManager.getSetting("videoQuality"), selectedQuality = Z(Object.keys(sources), preferredQuality), source = sources[selectedQuality];
            const currentTime = nativeVideo.currentTime;
            $dmmVideo = this.createDmmPlayer($nativeVideo), dmmVideo = $dmmVideo[0], dmmVideo.muted = muted == null || muted === !0,
            $dmmVideo.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (() => {
                void settings.set("videoMuted", dmmVideo.muted).catch((error => clog.error("保存视频静音设置失败", error)));
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
        $actions.append('<button type="button" class="jhs-btn jhs-btn--filter jhs-layout-3f0d74e1" id="video-filterBtn">屏蔽</button>', '<button type="button" class="jhs-btn jhs-btn--fav jhs-layout-2afc43dc" id="video-favoriteBtn">收藏</button>', '<button type="button" class="jhs-btn jhs-btn--down jhs-layout-5c319329" id="speed-btn">快进</button>'),
        $toolbar.append($actions), $host.append($toolbar), sources || await safePlay(nativeVideo, {
            context: "JavDB 预览视频",
            notify: !0,
            message: "REGION_BLOCKED" === error?.code ? error.message : "当前视频源无法播放"
        });
        $toolbar.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async event => {
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
        $toolbar.off("contextmenu.jhsVideo").on("contextmenu.jhsVideo", "#speed-btn", (event => (event.preventDefault(),
        this.getDependency("DetailPageButtonPlugin").filterOne(event)))),
        $("#video-filterBtn").off("click.jhsVideo").on("click.jhsVideo", (event => this.getDependency("DetailPageButtonPlugin").filterOne(event))),
        $("#video-favoriteBtn").off("click.jhsVideo").on("click.jhsVideo", (event => this.getDependency("DetailPageButtonPlugin").favoriteOne(event)));
    }
}
