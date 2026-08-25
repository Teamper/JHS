// @ts-check

import { L } from "../../core/constants.js";
import { safePlay } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { Z, fetchDmmPreview, fetchDmmPreviewIfEnabled, isDmmEnabled, isPreviewEnabled } from "../../services/preview-service.js";

export class BusPreviewVideoPlugin extends BasePlugin {
    getName() {
        return "BusPreviewVideoPlugin";
    }
    async initCss() {
        return "\n            .bus-preview-modal { position:fixed; inset:0; z-index:var(--jhs-z-modal); display:flex; align-items:center; justify-content:center; visibility:hidden; opacity:0; background:rgba(0,0,0,.95); transition:opacity var(--jhs-motion-base) var(--jhs-ease); }\n            .bus-preview-modal.is-open { visibility:visible; opacity:1; }\n            .bus-preview-modal-content { position:relative; display:flex; max-width:95%; max-height:95%; flex-direction:column; align-items:center; gap:var(--jhs-space-3); }\n            .video-player-wrapper { position:relative; width:80vw; max-width:100%; max-height:85vh; aspect-ratio:16/9; background:#000; }\n            .video-player-wrapper #preview-video { position:absolute; inset:0; }\n        ";
    }
    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    initModal(scope) {
        if (0 === $("#bus-preview-modal").length) {
            $("body").append('\n                <div id="bus-preview-modal" class="bus-preview-modal">\n                    <div class="bus-preview-modal-content">\n                        </div>\n                </div>\n            ');
            const e = $("#bus-preview-modal");
            e.on("click", ((/** @type {MouseEvent} */ e) => {
                e.target instanceof Element && "bus-preview-modal" === e.target.id && this.closeVideoModal();
            }));
            scope.listen(document, "keydown", ((/** @type {Event} */ event) => {
                event instanceof KeyboardEvent && "Escape" === event.key && e.hasClass("is-open") && this.closeVideoModal();
            }));
            scope.addCleanup((() => {
                e.off();
                e.remove();
            }));
        }
    }
    closeVideoModal() {
        const e = $("#preview-video");
        e.length > 0 && /** @type {HTMLVideoElement} */ (e[0]).pause(), $("#bus-preview-modal").removeClass("is-open");
    }
    /** 总开关 OFF：卸载 JHS 预览入口（宿主无原生预览可保留，直接删除自有 UI）。 */
    unmountPreview() {
        this._busPreviewMounted = false;
        this.closeVideoModal();
        $("#bus-preview-modal").remove();
        $(".preview-video-container").off("click.jhsBusPreview").remove();
    }
    async handle() {
        if (!isDetailPage) return;
        const settingsService = this.getRuntimeService("settings");
        if (!this._busScope) this._busScope = await this.getRuntimeService("scope")();
        if (!this._settingsListenerBound) {
            this._settingsListenerBound = true;
            const onSettingsChanged = (/** @type {any} */ event) => {
                const names = /** @type {string[] | undefined} */ (event.detail?.names);
                if (!names?.some((name) => name === "enablePreviewVideo" || name === "enableLoadPreviewVideo")) return;
                this.reconfigure();
            };
            settingsService.addEventListener("settings.changed", onSettingsChanged);
            this._busScope.addCleanup((() => {
                settingsService.removeEventListener("settings.changed", onSettingsChanged);
                this._settingsListenerBound = false;
            }));
        }
        this.reconfigure();
    }
    /** 统一 reconfigure：总开关 OFF→卸载；DMM 子开关 OFF→停止当前 JHS 播放。 */
    reconfigure() {
        const settings = this.getRuntimeService("settings").snapshot();
        if (!isPreviewEnabled(settings)) return void this.unmountPreview();
        this.mountPreview();
        if (!isDmmEnabled(settings)) this.closeVideoModal();
    }
    /** 幂等挂载：modal、入口按钮、DMM 预载。 */
    mountPreview() {
        if (this._busPreviewMounted) return;
        this._busPreviewMounted = true;
        const scope = this._busScope, settingsService = this.getRuntimeService("settings");
        this.initModal(scope);
        const e = $("#sample-waterfall .sample-box .photo-frame img:first").attr("src"), t = $(`
            <button type="button" class="jhs-btn preview-video-container sample-box jhs-layout-3b6a3a65">
                <div class="photo-frame jhs-layout-87db2275">
                    <img src="${e}" class="video-cover" alt="">
                    <div class="play-icon jhs-play-overlay">
                        ▶
                    </div>
                </div>
            </button>`);
        $("#sample-waterfall").prepend(t);
        if (isDmmEnabled(settingsService.snapshot())) {
            void fetchDmmPreview(this.getPageInfo().carNum, this.getRuntimeService("storage"), this.getRuntimeService("movie"), scope).catch((error => clog.warn("预加载 DMM 失败", error)));
        }
        let n = !1, a = $(".preview-video-container");
        a.on("click", (async (/** @type {MouseEvent} */ e) => {
            if (e.preventDefault(), e.stopPropagation(), n) show.info("正在加载中, 勿重复点击"); else {
                n = !0;
                try {
                    await this.handleVideo();
                } finally {
                    n = !1;
                }
            }
        })), window.location.href.includes("autoPlay=1") && a.trigger("click");
    }
    async handleVideo() {
        const e = $("#bus-preview-modal"), t = e.find(".bus-preview-modal-content");
        let n = $("#preview-video");
        if (n.length > 0) return e.addClass("is-open"), void await safePlay(n[0], {
            context: "JavBus 预览视频",
            notify: !0
        });
        let a = this.getPageInfo().carNum;
        const scope = await this.getRuntimeService("scope")(), {sources: i, error: previewError} = await fetchDmmPreviewIfEnabled(a, this.getRuntimeService("storage"), this.getRuntimeService("movie"), scope, this.getRuntimeService("settings").snapshot());
        i && 0 !== Object.keys(i).length ? (await this.createVideoPlayerAndControls(i, t),
        n = $("#preview-video"), n.length > 0 ? (e.addClass("is-open"), await safePlay(n[0], {
            context: "JavBus 预览视频",
            notify: !0,
            message: "REGION_BLOCKED" === previewError?.code ? previewError.message : "当前视频源无法播放"
        })) : show.error("视频播放器创建失败。")) : show.error("REGION_BLOCKED" === previewError?.code ? previewError.message : "未找到可用的视频源。");
    }
    async createVideoPlayerAndControls(/** @type {Record<string, string>} */ e, /** @type {any} */ t) {
        let n = this.getRuntimeService("settings").snapshot().videoQuality;
        n = Z(Object.keys(e), n);
        let a = e[n];
        t.html(`\n            <div class="video-player-wrapper">\n                <video id="preview-video" class="jhs-video-player" controls playsinline>\n                    <source src="${a}" />\n                </video>\n            </div>\n            <div class="jhs-video-toolbar jhs-video-quality-list" role="group" aria-label="视频画质">\n                </div>\n        `);
        const i = $("#preview-video"), s = i.find("source"), o = t.find(".jhs-video-quality-list");
        if (!i.length || !s.length) return;
        const settings = this.getRuntimeService("settings"), r = /** @type {HTMLVideoElement} */ (i[0]), muted = settings.snapshot().videoMuted;
        r.muted = muted == null || muted === !0, i.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (() => {
            void settings.set("videoMuted", r.muted).catch(((/** @type {unknown} */ error) => clog.error("保存视频静音设置失败", error)));
        }));
        let c = "";
        L.forEach(((/** @type {{quality: string, text: string}} */ t) => {
            let a = e[t.quality];
            if (a) {
                const e = n === t.quality;
                c += `\n                    <button type="button" class="jhs-btn jhs-video-quality-btn${e ? " active" : ""}" \n                            data-quality="${t.quality}"\n                            data-video-src="${a}"\n                            aria-pressed="${e ? "true" : "false"}">\n                        ${t.text}\n                    </button>\n                `;
            }
        })), o.html(c);
        const d = o.find(".jhs-video-quality-btn");
        o.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async (/** @type {MouseEvent} */ e) => {
            try {
                const t = $(e.currentTarget);
                if (t.hasClass("active")) return;
                let n = t.attr("data-video-src");
                s.attr("src", n);
                const a = r.currentTime;
                r.load(), r.currentTime = a, await safePlay(r, {
                    context: "JavBus 画质切换",
                    notify: !0
                }) && (d.removeClass("active").attr("aria-pressed", "false"), t.addClass("active").attr("aria-pressed", "true"));
            } catch (t) {
                clog.error("切换画质失败:", t);
            }
        }));
    }
}
