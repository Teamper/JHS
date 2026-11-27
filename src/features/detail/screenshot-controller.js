// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";
import { CANDIDATE_SCREENSHOT_LABEL, renderScreenshotPanel } from "../../ui/detail/screenshot-panel.js";
import { SCREENSHOT_PANEL_STYLES } from "../../ui/detail/panel-styles.js";
import { screenshotErrorMessage } from "../../ui/detail/screenshot-error.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

const SCREENSHOT_STYLES = SCREENSHOT_PANEL_STYLES + `.jhs-screenshot-message{padding-block:var(--jhs-space-3);color:var(--jhs-text-muted)}.screen-container:is(.sample-box,.tile-item){overflow:hidden;text-align:center}.screen-container.sample-box{height:110px}.screen-container.tile-item{max-height:215px}.jhs-screenshot-open img{width:100%}.sample-box .jhs-screenshot-open img{height:inherit}.screen-container .jhs-screenshot-open{display:block;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in}.screen-container .retry-link{padding:0;border:0;background:transparent;font:inherit;cursor:pointer}.screen-container .retry-link[aria-disabled="true"]{cursor:wait}:root .screen-container[data-jhs-screenshot-mode="manual"]{height:auto;max-height:none}.screen-container .jhs-screenshot-source{position:absolute;top:var(--jhs-space-1);left:var(--jhs-space-1);right:var(--jhs-space-1);z-index:var(--jhs-z-elevated);padding:var(--jhs-space-half);border-radius:var(--jhs-radius-sm);background:var(--jhs-surface);font-size:var(--jhs-font-size-sm);pointer-events:none}.screen-container[data-jhs-screenshot-mode="manual"] .jhs-screenshot-source{position:relative;inset:auto;padding:var(--jhs-space-half)}`;

/** Owns the host detail-page screenshot tile and its retry/settings lifecycle. */
export class ScreenshotController {
    /** @param {{document: Document, window: Window, hostAdapter: any, route: string, settings: any, screenshot: any, styles: any, ui: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.settings = options.settings;
        this.screenshot = options.screenshot;
        this.styles = options.styles;
        this.ui = options.ui;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.generation = 0;
        this.started = false;
        this.disposed = false;
        this.hostContainer = null;
        this.requestScope = null;
        this.releaseRequestScope = null;
        /** @type {Element|null} */ this.galleryRegion = null;
        /** @type {MutationObserver|null} */ this.galleryObserver = null;
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.route !== "detail") return false;
        this.started = true;
        const releaseStyle = this.styles.register("jhs-detail-screenshot-feature", SCREENSHOT_STYLES);
        this.scope.addCleanup(releaseStyle);
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.some(name => ["enableLoadScreenShot", "screenshotMode", "screenshotProviders"].includes(name))) return;
            this.unmountHosted();
            if (this.screenshot.isEnabled(this.settings.snapshot())) this.mountHosted();
        });
        this.scope.listen(this.document, "click", (/** @type {Event} */ event) => this.handleClick(/** @type {MouseEvent} */ (event)));
        this.scope.addCleanup(() => this.dispose());
        const root = this.hostAdapter.locateDetailRoot?.();
        if (root) this.scope.observe(root, () => this.refreshGallery(), {childList:true});
        this.refreshGallery();
        return true;
    }

    /** Follow gallery replacement without observing unrelated detail subtrees. */
    refreshGallery() {
        if (this.disposed || this.scope.disposed) return;
        const gallery = this.hostAdapter.locateNativeGallery?.();
        const boundary = this.hostAdapter.getDetailGalleryBoundaries?.().find((/** @type {any} */ item) => item.root === gallery);
        const region = boundary?.region ?? gallery?.parentElement ?? this.hostAdapter.getNativeGalleryRegion?.();
        if (region && region !== this.galleryRegion) {
            if (this.galleryObserver) this.scope.releaseObserver(this.galleryObserver);
            this.galleryRegion = region;
            this.galleryObserver = this.scope.observe(region, records => {
                const changed = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
                    if (node.nodeType !== 1) return false;
                    const element = /** @type {Element} */ (node);
                    return element.matches('.tile-images,.preview-images,.tile-item:not(.screen-container),#sample-waterfall,.sample-box:not(.screen-container)')
                        || !!element.querySelector('.tile-images,.preview-images,#sample-waterfall');
                }));
                if (changed) this.refreshGallery();
            },{childList:true,subtree:true});
        }
        if (this.hostContainer && !this.hostContainer.isConnected) { this.generation++; this.abortActiveRequest(); this.hostContainer=null; }
        if (this.screenshot.isEnabled(this.settings.snapshot())) this.mountHosted();
    }

    mountHosted() {
        if (this.disposed || this.scope.disposed || !this.screenshot.isEnabled(this.settings.snapshot())) return;
        if (this.hostContainer?.isConnected) return;
        const gallery = this.hostAdapter.locateNativeGallery?.();
        const fallback = this.hostAdapter.locateDetailRoot?.();
        if (!gallery && !fallback) return;
        const container = this.document.createElement("div");
        container.className = this.hostAdapter.site === "javbus"
            ? "sample-box screen-container"
            : "tile-item screen-container";
        container.classList.add("jhs-ui");
        const firstTile = this.hostAdapter.site === "javbus"
            ? gallery?.matches(".sample-box") ? gallery : gallery?.querySelector(".sample-box")
            : gallery?.querySelector(".tile-item");
        if (firstTile) {
            if (this.hostAdapter.site === "javbus") firstTile.after(container);
            else firstTile.before(container);
        }
        else (gallery ?? fallback).append(container);
        this.hostContainer = container;
        const generation = ++this.generation;
        if (firstTile || this.screenshot.getScreenshotSettings(this.settings.snapshot()).mode === "manual") {
            void this.loadIntoContainer(container, generation);
        } else {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-screenshot-load jhs-btn jhs-btn--secondary";
            button.textContent = "加载缩略图";
            container.append(button);
        }
    }

    unmountHosted() {
        this.generation += 1;
        this.abortActiveRequest();
        this.hostContainer?.remove();
        this.hostContainer = null;
    }

    /** @param {string | null} rawCarNum @param {{allowWhenDisabled?: boolean, scope?: any, refreshCache?: boolean}} [options] */
    async getScreenshot(rawCarNum, options = {}) {
        const carNum = normalizeCarNum(rawCarNum);
        if (!carNum) throw new Error("缩略图番号不可用");
        const settings = this.settings.snapshot();
        if (!options.allowWhenDisabled && !this.screenshot.isEnabled(settings)) return null;
        const images = await this.screenshot.resolve({ carNum }, {
            scope: options.scope ?? this.scope,
            settings,
            allowWhenDisabled: options.allowWhenDisabled === true,
            ...(options.refreshCache ? { refreshCache: true } : {}),
        });
        const image = Array.isArray(images) ? images[0] : images;
        return image?.url || null;
    }

    /** @param {Element} container @param {number} generation @param {boolean} [refreshCache] */
    async loadIntoContainer(container, generation, refreshCache = false) {
        this.abortActiveRequest();
        const movie = this.hostAdapter.readMovieInfo?.() ?? this.hostAdapter.readMovieRef?.();
        const rawCarNum = new URL(this.window.location.href).searchParams.get("jhsCarNum") ?? movie?.carNum ?? null;
        const carNum = normalizeCarNum(rawCarNum);
        if (!carNum) return this.showErrorFallback(container, rawCarNum, null);
        const title = normalizeCarNum(movie?.carNum) === carNum ? movie?.title : undefined;
        const requestScope = new LifecycleScope(`detail-screenshot:${generation}`);
        this.releaseRequestScope = this.scope.addCleanup(() => requestScope.dispose());
        this.requestScope = requestScope;
        const manual = this.screenshot.getScreenshotSettings(this.settings.snapshot()).mode === "manual";
        try {
            await renderScreenshotPanel({
                target: container, carNum, title, screenshot: this.screenshot, settings: this.settings.snapshot(),
                scope: requestScope, refreshCache, openImageViewer: (image, options) => this.ui.openImageViewer(image, options), isActive: () => this.isCurrent(container, generation),
                ...(!manual ? {
                    renderImage: (image, alt) => this.renderImage(container, alt, image),
                    renderError: error => { if (error) this.report(error); this.showErrorFallback(container, rawCarNum, error); },
                    renderLoading: retry => { if (!retry) { const status = this.document.createElement("div"); status.setAttribute("role", "status"); status.textContent = "加载中…"; container.replaceChildren(status); } },
                } : {}),
            });
        } catch (error) {
            if (this.isCurrent(container, generation)) { this.report(error); this.showErrorFallback(container, rawCarNum, error); }
        }
        // The panel owns future manual selections and image errors until unmount.
    }

    /** @param {Element} container @param {number} generation */
    isCurrent(container, generation) {
        return !this.disposed && !this.scope.disposed && generation === this.generation && container.isConnected;
    }

    /** @param {Element} container @param {string} alt @param {HTMLImageElement} image */
    renderImage(container, alt, image) {
        const generation = this.generation;
        (this.requestScope ?? this.scope).listen(image,"error",() => {
            if (!this.isCurrent(container,generation) || !container.contains(image)) return;
            const error = new Error("缩略图图片加载失败");
            this.report(error);
            this.showErrorFallback(container,this.hostAdapter.readMovieRef?.()?.carNum ?? null,error);
        },{once:true});
        image.alt = alt;
        if (this.hostAdapter.site === "javbus") {
            image.title = alt;
        }
        const frame = this.document.createElement("button");
        frame.type = "button";
        frame.className = this.hostAdapter.site === "javbus" ? "photo-frame jhs-screenshot-open" : "jhs-screenshot-open";
        frame.setAttribute("aria-label", `查看${alt}`);
        frame.append(image);
        const restoreFocus = container.contains(this.document.activeElement);
        container.replaceChildren(frame);
        if (restoreFocus) frame.focus({ preventScroll:true });
        return true;
    }

    /** @param {Element} container @param {string | null} rawCarNum @param {unknown} error */
    showErrorFallback(container, rawCarNum, error) {
        const message = this.document.createElement("div");
        message.className = "jhs-screenshot-message";
        message.setAttribute("role", "status");
        const carNum = normalizeCarNum(rawCarNum);
        if (!carNum) {
            message.textContent = "无法获取番号，缩略图未加载";
            container.replaceChildren(message);
            return;
        }
        message.textContent = error instanceof Error ? screenshotErrorMessage(error) : "暂无缩略图";
        const retry = this.document.createElement("button");
        retry.type = "button";
        retry.className = "retry-link jhs-link";
        retry.textContent = "重试";
        const restoreFocus = container.contains(this.document.activeElement);
        container.replaceChildren(message, this.document.createElement("br"), retry);
        const searchUrl = normalizeHttpUrl(this.screenshot.getSearchUrl({ carNum }, this.settings.snapshot()), this.window.location.href);
        if (searchUrl) {
            container.append(this.document.createTextNode(" 或 "));
            const search = this.document.createElement("a");
            search.className = "check-link jhs-link";
            search.href = searchUrl;
            search.target = "_blank";
            search.rel = "noopener noreferrer";
            search.textContent = "查看来源";
            container.append(search);
        }
        if (restoreFocus) retry.focus({ preventScroll:true });
    }

    /** @param {MouseEvent} event */
    handleClick(event) {
        const target = event.target && "nodeType" in event.target && event.target.nodeType === 1
            ? /** @type {Element} */ (event.target)
            : null;
        const container = target?.closest(".screen-container");
        if (!container) return;
        const retry = target?.closest(".retry-link"), load = target?.closest(".jhs-screenshot-load");
        if (retry || load) {
            event.preventDefault();
            event.stopPropagation();
            if (container.getAttribute("aria-busy") === "true") return;
            const message = container.querySelector(".jhs-screenshot-message");
            if (message) message.textContent = "正在重试…";
            const trigger = retry ?? /** @type {Element} */ (load);
            trigger.textContent = retry ? "重试中…" : "加载中…";
            trigger.setAttribute("aria-disabled", "true");
            const generation = ++this.generation;
            void this.loadIntoContainer(container, generation, Boolean(retry));
            return;
        }
        if (target?.closest(".check-link")) return;
        if (target?.closest(".jhs-screenshot-open") || (this.hostAdapter.site !== "javbus" && target?.matches("img"))) {
            event.preventDefault();
            event.stopPropagation();
            const candidate = container.querySelector("img")?.alt === CANDIDATE_SCREENSHOT_LABEL;
            try { this.ui.openImageViewer(container, {
                imageKind: "contact-sheet", trigger: target.closest("button,a") || container, owner: container, scope: this.scope,
                ...(candidate ? { caption: CANDIDATE_SCREENSHOT_LABEL } : {}),
            }); }
            catch (error) { this.report(error); }
        }
    }

    /** @param {unknown} error */
    report(error) {
        this.diagnostics?.recordError?.({
            source: "detail-screenshot", featureId: "detail", contributionId: "detail.screenshot",
            message: error instanceof Error ? error.message : String(error),
        });
    }

    abortActiveRequest() {
        this.hostContainer?.setAttribute("aria-busy", "false");
        this.releaseRequestScope?.();
        this.requestScope?.dispose();
        this.releaseRequestScope = null;
        this.requestScope = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        if(this.galleryObserver) this.scope.releaseObserver(this.galleryObserver);
        this.galleryObserver = null;
        this.unmountHosted();
    }
}
