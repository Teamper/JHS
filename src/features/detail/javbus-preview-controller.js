// @ts-check

import { L } from "../../core/constants.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { safePlay } from "../../core/feature-helpers.js";
import { Z, canUseDmmPreview, fetchDmmPreviewIfEnabled, isPreviewEnabled } from "../../services/preview-service.js";

export const JAVBUS_PREVIEW_STYLES = `
    .bus-preview-modal { position:fixed; inset:0; z-index:var(--jhs-z-modal); display:flex; align-items:center; justify-content:center; visibility:hidden; opacity:0; background:rgba(0,0,0,.95); transition:opacity var(--jhs-motion-base) var(--jhs-ease); }
    .bus-preview-modal.is-open { visibility:visible; opacity:1; }
    .bus-preview-modal-content { position:relative; display:flex; max-width:95%; max-height:95%; flex-direction:column; align-items:center; gap:var(--jhs-space-3); }
    .video-player-wrapper { position:relative; width:80vw; max-width:100%; max-height:85vh; aspect-ratio:16/9; background:#000; }
    .video-player-wrapper #preview-video { position:absolute; inset:0; }
`;

/** Owns the JavBus DMM preview surface and its asynchronous media lifetime. */
export class JavBusPreviewController {
    /** @param {{document: Document, window: Window, hostAdapter: any, route: string, settings: any, events: any, storage: any, movie: any, ui: any, diagnostics: any, scope: LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.settings = options.settings;
        this.events = options.events;
        this.storage = options.storage;
        this.movie = options.movie;
        this.ui = options.ui;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.started = false;
        this.mounted = false;
        this.busy = false;
        this.generation = 0;
        /** @type {LifecycleScope | null} */ this.requestScope = null;
        this.legacyPluginsReady = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.route !== "detail" || this.hostAdapter.site !== "javbus") return false;
        this.started = true;
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (this.legacyPluginsReady && names?.some((name) => name === "enablePreviewVideo" || name === "enableLoadPreviewVideo")) this.reconfigure();
        });
        this.scope.listen(this.document, "keydown", (/** @type {Event} */ rawEvent) => {
            const event = /** @type {KeyboardEvent} */ (rawEvent);
            if (event.key === "Escape" && this.document.querySelector("#bus-preview-modal.is-open")) this.closeVideoModal();
        });
        this.scope.addCleanup(this.events.on("jhs-features-ready", () => {
            this.legacyPluginsReady = true;
            this.reconfigure();
        }));
        this.scope.addCleanup(() => this.stop());
        return true;
    }

    /** Applies the single Preview + DMM eligibility rule on startup and live setting changes. */
    reconfigure() {
        if (this.scope.disposed) return;
        this.generation += 1;
        this.cancelRequest();
        if (!canUseDmmPreview(this.settings.snapshot())) return this.unmountPreview();
        this.mountPreview();
    }

    initModal() {
        const $ = this.ui.jquery;
        let modal = $(this.document).find("#bus-preview-modal").first();
        if (!modal.length) {
            modal = $('<div id="bus-preview-modal" class="bus-preview-modal"><div class="bus-preview-modal-content"></div></div>');
            $(this.document.body).append(modal);
            modal.on("click.jhsBusPreview", (/** @type {MouseEvent} */ event) => {
                if (event.target === modal[0]) this.closeVideoModal();
            });
        }
        return modal;
    }

    closeVideoModal() {
        const $ = this.ui.jquery, video = this.document.querySelector("#preview-video");
        if (video?.tagName === "VIDEO") /** @type {HTMLVideoElement} */ (video).pause();
        $(this.document).find("#bus-preview-modal").removeClass("is-open");
    }

    unmountPreview() {
        this.mounted = false;
        this.busy = false;
        this.cancelRequest();
        this.closeVideoModal();
        this.ui.jquery(this.document).find("#bus-preview-modal, .preview-video-container").off(".jhsBusPreview").remove();
    }

    mountPreview() {
        if (this.mounted || this.scope.disposed) return;
        const $ = this.ui.jquery, galleryElement = this.hostAdapter.locateNativeGallery?.();
        if (!galleryElement) return;
        this.mounted = true;
        this.initModal();
        const gallery = $(galleryElement), imageSource = gallery.find(".sample-box .photo-frame img").first().attr("src");
        const button = $('<button type="button" class="jhs-btn preview-video-container sample-box jhs-layout-3b6a3a65"><div class="photo-frame jhs-layout-87db2275"><img class="video-cover" alt=""><span class="play-icon jhs-play-overlay" aria-hidden="true">▶</span></div></button>');
        if (imageSource) button.find("img.video-cover").attr("src", imageSource);
        button.on("click.jhsBusPreview", async (/** @type {MouseEvent} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.busy) return this.ui.notifications?.info?.("正在加载中, 勿重复点击");
            this.busy = true;
            try { await this.handleVideo(); }
            finally { this.busy = false; }
        });
        gallery.prepend(button);
        if (this.window.location.href.includes("autoPlay=1")) button.trigger("click");
    }

    async handleVideo() {
        const generation = this.generation, $ = this.ui.jquery;
        const modal = $(this.document).find("#bus-preview-modal"), content = modal.find(".bus-preview-modal-content");
        let video = this.document.querySelector("#preview-video");
        if (generation !== this.generation || !isPreviewEnabled(this.settings.snapshot())) return;
        if (video?.tagName === "VIDEO") {
            modal.addClass("is-open");
            await safePlay(/** @type {HTMLVideoElement} */ (video), { context: "JavBus 预览视频", notify: true });
            return;
        }
        const carNum = this.hostAdapter.readMovieRef?.()?.carNum ?? null;
        if (!carNum) return this.ui.notifications?.error?.("番号不可用，无法加载预览");
        const requestScope = new LifecycleScope(`javbus-preview:${carNum}`);
        this.requestScope = requestScope;
        try {
            const { sources, error } = await fetchDmmPreviewIfEnabled(carNum, this.storage, this.movie, requestScope, this.settings.snapshot());
            if (generation !== this.generation || this.scope.disposed || !isPreviewEnabled(this.settings.snapshot())) return;
            if (!sources || !Object.keys(sources).length) {
                this.ui.notifications?.error?.(error?.code === "REGION_BLOCKED" ? error.message : "未找到可用的视频源。");
                return;
            }
            await this.createVideoPlayerAndControls(sources, content);
            video = this.document.querySelector("#preview-video");
            if (video?.tagName !== "VIDEO") return this.ui.notifications?.error?.("视频播放器创建失败。");
            modal.addClass("is-open");
            await safePlay(/** @type {HTMLVideoElement} */ (video), {
                context: "JavBus 预览视频", notify: true,
                message: error?.code === "REGION_BLOCKED" ? error.message : "当前视频源无法播放",
            });
        } finally {
            if (this.requestScope === requestScope) this.requestScope = null;
            requestScope.dispose();
        }
    }

    /** @param {Record<string, string>} sources @param {any} target */
    async createVideoPlayerAndControls(sources, target) {
        const $ = this.ui.jquery, settings = this.settings.snapshot(), quality = Z(Object.keys(sources), settings.videoQuality);
        if (!quality) return;
        const wrapper = $('<div class="video-player-wrapper"></div>');
        const video = $('<video id="preview-video" class="jhs-video-player" controls playsinline></video>');
        const source = this.document.createElement("source");
        source.src = sources[quality];
        video.append(source);
        wrapper.append(video);
        const toolbar = $('<div class="jhs-video-toolbar jhs-video-quality-list" role="group" aria-label="视频画质"></div>');
        target.empty().append(wrapper, toolbar);
        const media = /** @type {HTMLVideoElement | undefined} */ (video[0]);
        if (!media) return;
        media.muted = settings.videoMuted == null || settings.videoMuted === true;
        video.on("volumechange.jhsBusPreview", () => {
            void this.settings.set("videoMuted", media.muted).catch((/** @type {unknown} */ error) => this.diagnostics.recordError({ source: "javbus-preview", message: error instanceof Error ? error.message : String(error) }));
        });
        for (const item of L) {
            const sourceUrl = sources[item.quality];
            if (!sourceUrl) continue;
            const active = quality === item.quality, button = $('<button type="button" class="jhs-btn jhs-video-quality-btn"></button>');
            button.attr({ "data-quality": item.quality, "aria-pressed": String(active) }).text(item.text).data("video-src", sourceUrl).toggleClass("active", active);
            toolbar.append(button);
        }
        toolbar.on("click.jhsBusPreview", ".jhs-video-quality-btn", async (/** @type {MouseEvent} */ event) => {
            const selected = $(event.currentTarget);
            if (selected.hasClass("active") || !media.isConnected || this.scope.disposed) return;
            const nextSource = /** @type {string} */ (selected.data("video-src"));
            const currentTime = media.currentTime;
            source.src = nextSource;
            media.load();
            try { media.currentTime = currentTime; } catch { /* Preserve the newly selected source when metadata is not ready. */ }
            if (await safePlay(media, { context: "JavBus 画质切换", notify: true }) && !this.scope.disposed) {
                toolbar.find(".jhs-video-quality-btn").removeClass("active").attr("aria-pressed", "false");
                selected.addClass("active").attr("aria-pressed", "true");
            }
        });
    }

    cancelRequest() {
        this.requestScope?.dispose();
        this.requestScope = null;
    }

    stop() {
        this.generation += 1;
        this.unmountPreview();
    }
}
