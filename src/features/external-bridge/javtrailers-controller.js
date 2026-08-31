// @ts-check

import { safePlay } from "../../core/feature-helpers.js";
import { JHS_Z_INDEX } from "../../core/theme.js";

/** Own JavTrailers preview playback and its page navigation lifecycle. */
export class JavTrailersController {
    /** @param {{document?: Document, window?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.scope = options.scope;
        this.hasBand = false;
        this.started = false;
    }

    getJQuery() { return /** @type {any} */ (globalThis).$ ?? this.window?.jQuery; }
    getUtils() { return /** @type {any} */ (globalThis).utils ?? {}; }
    getClog() { return /** @type {any} */ (globalThis).clog ?? {}; }

    /** Start the JavTrailers page enhancement. */
    async start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        this.hasBand = false;
        this.scope.addCleanup(() => this.dispose());
        try { await this.handle(); }
        catch (error) { this.dispose(); throw error; }
    }

    async handle() {
        const $ = this.getJQuery(), href = this.window.location.href;
        if (!href.includes("handle=1")) return;
        if ($("h1:contains('Page not found')").length) {
            this.getClog().log?.("番号无法匹配, 跳搜索");
            const keyword = href.split("?")[0].split("video/")[1].toLowerCase().replace("00", "-");
            this.window.location.href = "/search/" + encodeURIComponent(keyword) + this.window.location.search;
            return;
        }
        const links = $(".videos-list .video-link").toArray();
        if (links.length) {
            const keyword = href.split("?")[0].split("search/")[1].toLowerCase();
            const match = links.find((/** @type {Element} */ link) => $(link).find(".vid-title").text().toLowerCase().includes(keyword));
            if (match) {
                this.window.location.href = $(match).attr("href") + this.window.location.search;
                return;
            }
        }
        this.handlePlayJavTrailers(this.scope);
        this.bindPlaybackControls(this.scope);
    }

    /** @param {any} scope */
    bindPlaybackControls(scope) {
        const $ = this.getJQuery(), container = $("#videoPlayerContainer"), replay = () => this.handlePlayJavTrailers(scope);
        container.off("click.jhsJavTrailers").on("click.jhsJavTrailers", replay);
        scope.addCleanup(() => container.off("click.jhsJavTrailers", replay));
        scope.listen(this.window, "message", () => {
            const video = /** @type {HTMLVideoElement | null} */ (this.document.getElementById("vjs_video_3_html5_api"));
            if (video) video.currentTime += 5;
        });
    }

    /** @param {any} scope */
    handlePlayJavTrailers(scope) {
        if (this.hasBand || scope.signal.aborted) return;
        const $ = this.getJQuery(), loopDetector = this.getUtils().loopDetector;
        const playerWait = loopDetector(() => $("#vjs_video_3_html5_api").length !== 0, () => {
            if (scope.signal.aborted) return;
            scope.ownTimeout(setTimeout(() => {
                if (scope.signal.aborted) return;
                this.hasBand = true;
                const video = /** @type {HTMLVideoElement | null} */ (this.document.getElementById("vjs_video_3_html5_api"));
                if (!video) return;
                this.getClog().debug?.(video);
                void safePlay(video, { context: "JavTrailers 预览" });
                video.currentTime = 5;
                scope.listen(video, "timeupdate", () => {
                    video.currentTime >= 14 && video.currentTime < 16 && (video.currentTime += 2);
                });
                $("#vjs_video_3_html5_api").css({ position: "fixed", width: "100vw", height: "100vh", objectFit: "cover", zIndex: String(JHS_Z_INDEX.debug) });
                $(".vjs-control-bar").css({ position: "fixed", bottom: "20px", zIndex: String(JHS_Z_INDEX.debug) });
            }, 100));
        }, 20, 1e4, true, scope);
        const canvasWait = loopDetector(() => $("#vjs_video_3 canvas").length > 0, () => {
            if (scope.signal.aborted) return;
            $("#vjs_video_3 canvas").length && $("#vjs_video_3 canvas").css({ position: "fixed", width: "100vw", height: "100vh", objectFit: "cover", top: "0", right: "0", zIndex: String(JHS_Z_INDEX.debug - 1) });
        }, 20, 1e4, true, scope);
        scope.addCleanup(playerWait);
        scope.addCleanup(canvasWait);
    }

    dispose() {
        this.started = false;
        this.hasBand = false;
    }
}
