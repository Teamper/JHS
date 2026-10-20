// @ts-check

import { L } from "../../core/constants.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { safePlay } from "../../core/feature-helpers.js";
import { Z, canUseDmmPreview, fetchDmmPreviewIfEnabled, isPreviewEnabled } from "../../services/preview-service.js";
import { getIcon } from "../../core/icons.js";

export const JAVBUS_PREVIEW_STYLES = `
    .bus-preview-modal-content { position:relative; display:flex; flex-direction:column; align-items:center; gap:var(--jhs-space-3); }
    .bus-preview-modal .video-player-wrapper { position:relative; width:100%; max-width:calc((100dvh - 140px) * 16 / 9); aspect-ratio:16/9; background:var(--jhs-media-bg); }
    .video-player-wrapper #preview-video { position:absolute; inset:0; }
`;

/** Owns the JavBus DMM preview surface and its asynchronous media lifetime. */
export class JavBusPreviewController {
    /** @param {{document: Document, window: Window, hostAdapter: any, route: string, settings: any, events: any, storage: any, movie: any, dialog: any, ui: any, diagnostics: any, scope: LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.settings = options.settings;
        this.events = options.events;
        this.storage = options.storage;
        this.movie = options.movie;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.started = false;
        this.previewIntentConsumed = false;
        this.mounted = false;
        this.generation = 0;
        /** @type {{scope: LifecycleScope, index: number | null} | null} */ this.session = null;
        /** @type {any} */ this.player = null;
        /** @type {LifecycleScope | null} */ this.playerScope = null;
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
        this.closeVideoModal();
        if (!canUseDmmPreview(this.settings.snapshot())) return this.unmountPreview();
        this.mountPreview();
    }

    initModal() {
        return this.player ||= this.ui.jquery('<div id="bus-preview-modal" class="bus-preview-modal"><div class="bus-preview-modal-content"></div></div>');
    }

    closeVideoModal(session = this.session) {
        if (!session || session.scope.disposed) return;
        session.scope.dispose();
        if (this.session !== session) return;
        this.session = null;
        this.generation += 1;
        this.player?.find("video")[0]?.pause();
        // Keep the paused player (time, quality and mute) without retaining a dialog lock.
        this.player?.removeClass("is-open").detach();
        if (session.index !== null) this.dialog.close(session.index);
    }

    unmountPreview() {
        this.mounted = false;
        this.closeVideoModal();
        this.playerScope?.dispose();
        this.playerScope = null;
        this.player?.remove();
        this.player = null;
        this.ui.jquery(this.document).find(".preview-video-container").off(".jhsBusPreview").remove();
    }

    mountPreview() {
        if (this.mounted || this.scope.disposed) return;
        const $ = this.ui.jquery, galleryElement = this.hostAdapter.locateNativeGallery?.();
        if (!galleryElement) return;
        this.mounted = true;
        const gallery = $(galleryElement), imageSource = gallery.find(".sample-box .photo-frame img").first().attr("src");
        const button = $(`<button type="button" class="jhs-btn preview-video-container sample-box jhs-layout-3b6a3a65"><div class="photo-frame jhs-layout-87db2275"><img class="video-cover" alt=""><span class="play-icon jhs-play-overlay" aria-hidden="true">${getIcon("play")}</span></div></button>`);
        if (imageSource) button.find("img.video-cover").attr("src", imageSource);
        button.on("click.jhsBusPreview", (/** @type {MouseEvent} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            void this.handleVideo();
        });
        gallery.prepend(button);
        if (!this.previewIntentConsumed && this.window.location.href.includes("autoPlay=1")) { this.previewIntentConsumed = true; button[0].scrollIntoView?.({block:"center"}); button.trigger("focus").trigger("click"); }
    }

    async handleVideo() {
        if (this.scope.disposed || !canUseDmmPreview(this.settings.snapshot())) return;
        if (this.session) return this.ui.notifications?.info?.("正在加载，请稍候");
        const generation = this.generation, modal = this.initModal();
        const session = { scope: new LifecycleScope("javbus-preview"), index: /** @type {number | null} */ (null) };
        this.session = session;
        try {
            let video = modal.find("video")[0];
            if (!video) {
                const carNum = this.hostAdapter.readMovieRef?.()?.carNum;
                if (!carNum) throw new Error("番号不可用");
                const { sources, error } = await fetchDmmPreviewIfEnabled(carNum, this.storage, this.movie, session.scope, this.settings.snapshot());
                if (generation !== this.generation || this.scope.disposed || !isPreviewEnabled(this.settings.snapshot())) return;
                if (!sources || !Object.keys(sources).length) throw new Error(error?.code === "REGION_BLOCKED" ? "视频访问受限" : "未找到可用视频");
                await this.createVideoPlayerAndControls(sources, modal.find(".bus-preview-modal-content"));
                if (!this.isActive(session)) return;
                video = modal.find("video")[0];
            }
            // A quality change may have replaced the source before its old play promise settled.
            modal.find(".jhs-video-quality-btn").each((/** @type {number} */ _index, /** @type {Element} */ element) => {
                const button = this.ui.jquery(element), selected = button.attr("data-video-src") === video.querySelector("source")?.getAttribute("src");
                button.toggleClass("active", selected).attr("aria-pressed", String(selected));
            });
            session.index = this.dialog.open({
                type: 1, title: "视频预览", content: '<div data-jhs-bus-preview-host></div>', shadeClose: true, scrollbar: false, anim: -1,
                area: this.ui.getResponsiveArea(["80%", "80%"]), ui: { size: "lg", body: "media", initialFocus: "#preview-video" },
                success: (/** @type {any} */ element, /** @type {number} */ id) => {
                    session.index = id; modal.addClass("is-open"); this.ui.setupEscClose(id);
                    const root = element?.nodeType === 1 ? element : element[0];
                    // Layer requires connected object content; keep its shell textual and move the live player.
                    root.querySelector("[data-jhs-bus-preview-host]").append(modal[0]);
                    session.scope.observe(root.parentNode, () => { if (!root.isConnected) this.closeVideoModal(session); }, { childList: true });
                },
                end: () => { session.index = null; this.closeVideoModal(session); },
            });
            await this.playVideo(video, session);
        } catch (error) {
            if (this.isActive(session)) this.ui.notifications?.error?.(error instanceof Error ? error.message : "视频预览失败，请重试");
            this.closeVideoModal(session);
        } finally {
            if (session.index === null) this.closeVideoModal(session);
        }
    }

    /** @param {NonNullable<JavBusPreviewController["session"]>} session */
    isActive(session) { return this.session === session && !session.scope.disposed && !this.scope.disposed; }

    /** @param {HTMLVideoElement} media @param {NonNullable<JavBusPreviewController["session"]>} session */
    async playVideo(media, session) {
        if (!this.isActive(session)) return false;
        const generation = session.scope.nextGeneration();
        const active = () => this.isActive(session) && session.scope.canCommit(generation);
        const played = await safePlay(media, { context: "JavBus 预览视频", notify: true, notifyUser: message => { if (active()) this.ui.notifications?.error?.(message); } });
        if (!this.session || this.player?.find("video")[0] !== media) media.pause();
        return played && active();
    }

    /** @param {Record<string, string>} sources @param {any} target */
    async createVideoPlayerAndControls(sources, target) {
        const $ = this.ui.jquery, settings = this.settings.snapshot(), quality = Z(Object.keys(sources), settings.videoQuality);
        if (!quality) return;
        const wrapper = $('<div class="video-player-wrapper"></div>');
        const video = $('<video id="preview-video" class="jhs-video-player" controls playsinline tabindex="0" aria-label="影片预览"></video>');
        const source = this.document.createElement("source");
        source.src = sources[quality];
        video.append(source);
        wrapper.append(video);
        const toolbar = $('<div class="jhs-video-toolbar jhs-video-quality-list" role="group" aria-label="视频画质"></div>');
        target.empty().append(wrapper, toolbar);
        const media = /** @type {HTMLVideoElement | undefined} */ (video[0]);
        if (!media) return;
        media.muted = settings.videoMuted == null || settings.videoMuted === true;
        this.playerScope?.dispose();
        const scope = this.playerScope = new LifecycleScope("javbus-player");
        scope.listen(media, "volumechange", () => {
            if (!this.session || !this.isActive(this.session)) return;
            void this.settings.set("videoMuted", media.muted).catch((/** @type {unknown} */ error) => this.diagnostics.recordError({ source: "javbus-preview", message: error instanceof Error ? error.message : String(error) }));
        });
        for (const item of L) {
            const sourceUrl = sources[item.quality];
            if (!sourceUrl) continue;
            const active = quality === item.quality, button = $('<button type="button" class="jhs-btn jhs-video-quality-btn"></button>');
            button.attr({ "data-quality": item.quality, "data-video-src": sourceUrl, "aria-pressed": String(active) }).text(item.text).toggleClass("active", active);
            toolbar.append(button);
        }
        scope.listen(toolbar[0], "click", async (event) => {
            const selected = $(/** @type {Element} */ (event.target)).closest(".jhs-video-quality-btn"), session = this.session;
            if (!selected.length || selected.hasClass("active") || !session || !this.isActive(session)) return;
            const nextSource = selected.attr("data-video-src");
            const currentTime = media.currentTime;
            source.src = nextSource;
            media.load();
            try { media.currentTime = currentTime; } catch { /* Preserve the newly selected source when metadata is not ready. */ }
            if (await this.playVideo(media, session)) {
                toolbar.find(".jhs-video-quality-btn").removeClass("active").attr("aria-pressed", "false");
                selected.addClass("active").attr("aria-pressed", "true");
            }
        });
    }

    stop() {
        this.generation += 1;
        this.unmountPreview();
    }
}
