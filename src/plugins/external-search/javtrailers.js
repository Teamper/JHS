// @ts-check

import { safePlay } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { JHS_Z_INDEX } from "../../core/theme.js";

export class JavTrailersPlugin extends BasePlugin {
    getName() {
        return "JavTrailersPlugin";
    }
    constructor() {
        super(), this.hasBand = !1;
    }
    async handle() {
        let e = window.location.href;
        if (!e.includes("handle=1")) return;
        if ($("h1:contains('Page not found')").length) {
            clog.log("番号无法匹配, 跳搜索");
            let t = e.split("?")[0].split("video/")[1].toLowerCase().replace("00", "-");
            return void (window.location.href = "/search/" + encodeURIComponent(t) + window.location.search);
        }
        let t = $(".videos-list .video-link").toArray();
        if (t.length) {
            const n = e.split("?")[0].split("search/")[1].toLowerCase(), a = t.find(((/** @type {Element} */ e) => $(e).find(".vid-title").text().toLowerCase().includes(n)));
            if (a) return void (window.location.href = $(a).attr("href") + window.location.search);
        }
        const scope = await this.getRuntimeService("scope")();
        this.handlePlayJavTrailers(scope), this.bindPlaybackControls(scope);
    }
    bindPlaybackControls(/** @type {any} */ scope) {
        const container = $("#videoPlayerContainer"), replay = () => this.handlePlayJavTrailers(scope);
        container.off("click.jhsJavTrailers").on("click.jhsJavTrailers", replay), scope.addCleanup((() => container.off("click.jhsJavTrailers", replay))), scope.listen(window, "message", (() => {
            let t = /** @type {HTMLVideoElement | null} */ (document.getElementById("vjs_video_3_html5_api"));
            t && (t.currentTime += 5);
        }));
    }
    handlePlayJavTrailers(/** @type {any} */ scope) {
        if (this.hasBand || scope.signal.aborted) return;
        const playerWait = utils.loopDetector((() => 0 !== $("#vjs_video_3_html5_api").length), (() => {
            if (scope.signal.aborted) return;
            scope.ownTimeout(setTimeout((() => {
                if (scope.signal.aborted) return;
                this.hasBand = !0;
                let e = /** @type {HTMLVideoElement | null} */ (document.getElementById("vjs_video_3_html5_api"));
                if (!e) return;
                clog.debug(e), safePlay(e, {
                    context: "JavTrailers 预览"
                }), e.currentTime = 5, scope.listen(e, "timeupdate", (function() {
                    e.currentTime >= 14 && e.currentTime < 16 && (e.currentTime += 2);
                })), $("#vjs_video_3_html5_api").css({
                    position: "fixed",
                    width: "100vw",
                    height: "100vh",
                    objectFit: "cover",
                    zIndex: String(JHS_Z_INDEX.debug)
                }), $(".vjs-control-bar").css({
                    position: "fixed",
                    bottom: "20px",
                    zIndex: String(JHS_Z_INDEX.debug)
                });
            }), 100));
        }), 20, 1e4, !0, scope), canvasWait = utils.loopDetector((() => $("#vjs_video_3 canvas").length > 0), (() => {
            if (scope.signal.aborted) return;
            0 !== $("#vjs_video_3 canvas").length && $("#vjs_video_3 canvas").css({
                position: "fixed",
                width: "100vw",
                height: "100vh",
                objectFit: "cover",
                top: "0",
                right: "0",
                zIndex: String(JHS_Z_INDEX.debug - 1)
            });
        }), 20, 1e4, !0, scope);
        scope.addCleanup(playerWait), scope.addCleanup(canvasWait);
    }
}
