// @ts-check

import { safePlay } from "../../core/feature-helpers.js";
import { JHS_Z_INDEX } from "../../core/theme.js";

const VIDEO_SELECTOR = "#vjs_video_3_html5_api";
const PLAYER_SELECTOR = "#videoPlayerContainer";

export class JavTrailersController {
    /** @param {{document?: Document, window?: Window, scope: import("../../core/lifecycle-scope.js").LifecycleScope, navigate?: (url: string) => void, playVideo?: (video: HTMLVideoElement) => void}} options */
    constructor({ document: doc = document, window: win = window, scope, navigate = (url) => { win.location.href = url; }, playVideo = (video) => { void safePlay(video, { context: "JavTrailers 预览" }); } }) {
        this.document = doc;
        this.window = win;
        this.scope = scope;
        this.navigate = navigate;
        this.playVideo = playVideo;
        this.hasBand = false;
    }

    start() {
        this.scope.assertActive();
        const href = this.window.location.href;
        if (!href.includes("handle=1")) return false;
        if (this.redirectMissingVideo(href) || this.redirectSearchMatch(href)) return true;
        this.bindPlaybackControls();
        this.startPlaybackPreview();
        return true;
    }

    /** @param {string} href */
    redirectMissingVideo(href) {
        const heading = this.document.querySelector("h1")?.textContent?.toLowerCase() || "";
        if (!heading.includes("page not found")) return false;
        const videoPath = new URL(href).pathname.split("/video/")[1];
        if (!videoPath) return false;
        const carNum = videoPath.toLowerCase().replace("00", "-");
        this.navigate(`/search/${encodeURIComponent(carNum)}${this.window.location.search}`);
        return true;
    }

    /** @param {string} href */
    redirectSearchMatch(href) {
        const cards = [...this.document.querySelectorAll(".videos-list .video-link")];
        if (!cards.length) return false;
        const searchTerm = new URL(href).pathname.split("/search/")[1]?.toLowerCase();
        if (!searchTerm) return false;
        const card = cards.find((item) => (item.querySelector(".vid-title")?.textContent || "").toLowerCase().includes(searchTerm));
        const target = card?.getAttribute("href");
        if (!target) return false;
        this.navigate(`${target}${this.window.location.search}`);
        return true;
    }

    bindPlaybackControls() {
        const container = this.document.querySelector(PLAYER_SELECTOR);
        if (container) this.scope.listen(container, "click", () => this.startPlaybackPreview());
        this.scope.listen(this.window, "message", () => {
            const element = this.document.querySelector(VIDEO_SELECTOR);
            if (!element || element.tagName !== "VIDEO") return;
            const video = /** @type {HTMLVideoElement} */ (element);
            video.currentTime += 5;
        });
    }

    startPlaybackPreview() {
        if (this.hasBand || this.scope.signal.aborted) return;
        this.waitFor(() => this.document.querySelector(VIDEO_SELECTOR), (video) => {
            const timer = setTimeout(() => {
                if (this.scope.signal.aborted) return;
                this.hasBand = true;
                const element = this.document.querySelector(VIDEO_SELECTOR);
                if (!element || element.tagName !== "VIDEO") return;
                const currentVideo = /** @type {HTMLVideoElement} */ (element);
                this.playVideo(currentVideo);
                currentVideo.currentTime = 5;
                this.scope.listen(currentVideo, "timeupdate", () => {
                    if (currentVideo.currentTime >= 14 && currentVideo.currentTime < 16) currentVideo.currentTime += 2;
                });
                this.applyStyles(currentVideo, {
                    position: "fixed", width: "100vw", height: "100vh", objectFit: "cover",
                    zIndex: String(JHS_Z_INDEX.debug),
                });
                const controls = this.document.querySelector(".vjs-control-bar");
                if (controls) this.applyStyles(/** @type {HTMLElement} */ (controls), { position: "fixed", bottom: "20px", zIndex: String(JHS_Z_INDEX.debug) });
            }, 100);
            this.scope.ownTimeout(timer);
        });
        this.waitFor(() => this.document.querySelector("#vjs_video_3 canvas"), (canvas) => {
            if (!canvas) return;
            this.applyStyles(/** @type {HTMLElement} */ (canvas), {
                position: "fixed", width: "100vw", height: "100vh", objectFit: "cover",
                top: "0", right: "0", zIndex: String(JHS_Z_INDEX.debug - 1),
            });
        });
    }

    /** @param {() => Element | null} find @param {(element: Element | null) => void} onFound */
    waitFor(find, onFound) {
        let settled = false;
        let intervalId = 0;
        let timeoutId = 0;
        const release = this.scope.addCleanup(() => {
            settled = true;
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        });
        const check = () => {
            if (settled || this.scope.signal.aborted) return;
            const element = find();
            if (!element) return;
            release();
            onFound(element);
        };
        intervalId = setInterval(check, 20);
        timeoutId = setTimeout(release, 10_000);
        check();
    }

    /** @param {HTMLElement} element @param {Partial<CSSStyleDeclaration>} styles */
    applyStyles(element, styles) {
        /** @type {Map<string, string>} */
        const previous = new Map();
        /** @type {Map<string, string>} */
        const applied = new Map();
        for (const [property, value] of Object.entries(styles)) {
            if (typeof value !== "string") continue;
            const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
            previous.set(property, element.style.getPropertyValue(cssProperty));
            element.style.setProperty(cssProperty, value);
            applied.set(property, element.style.getPropertyValue(cssProperty));
        }
        this.scope.addCleanup(() => {
            for (const [property, value] of Object.entries(styles)) {
                if (typeof value !== "string") continue;
                const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
                if (element.style.getPropertyValue(cssProperty) !== applied.get(property)) continue;
                const original = previous.get(property) || "";
                if (original) element.style.setProperty(cssProperty, original);
                else element.style.removeProperty(cssProperty);
            }
        });
    }
}
