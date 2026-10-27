// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";
import { renderScreenshotPanel } from "../../ui/detail/screenshot-panel.js";
import { screenshotErrorMessage } from "../../ui/detail/screenshot-error.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

const SCREENSHOT_STYLES = `.jhs-screenshot-message{margin-top:50px;color:var(--jhs-text-muted);cursor:auto}.jhs-screenshot-message--bus{margin-top:30px}.screen-container .jhs-screenshot-open{display:block;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in}.screen-container .retry-link{padding:0;border:0;background:transparent;font:inherit;cursor:pointer}.screen-container .retry-link[aria-disabled="true"]{cursor:wait}`;

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
        if (!gallery) return;
        const container = this.document.createElement("div");
        container.className = this.hostAdapter.site === "javbus"
            ? "sample-box screen-container jhs-layout-b5c4e4f7"
            : "tile-item screen-container jhs-layout-cd9d5db1";
        container.classList.add("jhs-ui");
        const loading = this.document.createElement("div");
        loading.className = this.hostAdapter.site === "javbus" ? "jhs-layout-3536a853" : "jhs-layout-9db87399";
        loading.textContent = "加载中…";
        loading.setAttribute("role", "status");
        container.append(loading);

        if (this.hostAdapter.site === "javbus") {
            const firstSample = gallery.matches?.(".sample-box") ? gallery : gallery.querySelector(".sample-box");
            if (!firstSample?.parentElement) return;
            firstSample.after(container);
        } else {
            const firstTile = gallery.querySelector(".tile-item");
            if (!firstTile?.parentElement) return;
            firstTile.before(container);
        }
        this.hostContainer = container;
        const generation = ++this.generation;
        void this.loadIntoContainer(container, generation);
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
        const rawCarNum = new URL(this.window.location.href).searchParams.get("jhsCarNum") ?? this.hostAdapter.readMovieRef?.()?.carNum ?? null;
        const carNum = normalizeCarNum(rawCarNum);
        if (!carNum) return this.showErrorFallback(container, rawCarNum, null);
        const requestScope = new LifecycleScope(`detail-screenshot:${generation}`);
        this.releaseRequestScope = this.scope.addCleanup(() => requestScope.dispose());
        this.requestScope = requestScope;
        const manual = this.screenshot.getScreenshotSettings(this.settings.snapshot()).mode === "manual";
        try {
            await renderScreenshotPanel({
                target: container, carNum, screenshot: this.screenshot, settings: this.settings.snapshot(),
                scope: requestScope, refreshCache, isActive: () => this.isCurrent(container, generation),
                ...(!manual ? {
                    renderImage: url => this.renderImage(container, "缩略图", url),
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

    /** @param {Element} container @param {string} alt @param {string} rawUrl */
    renderImage(container, alt, rawUrl) {
        const url = this.screenshot.normalizeAssetUrl(rawUrl, this.window.location.href);
        if (!url) return false;
        const image = this.document.createElement("img");
        const generation = this.generation;
        (this.requestScope ?? this.scope).listen(image,"error",() => {
            if (!this.isCurrent(container,generation) || !container.contains(image)) return;
            const error = new Error("缩略图图片加载失败");
            this.report(error);
            this.showErrorFallback(container,this.hostAdapter.readMovieRef?.()?.carNum ?? null,error);
        },{once:true});
        image.src = url;
        image.alt = alt;
        image.loading = "lazy";
        if (this.hostAdapter.site === "javbus") {
            image.title = alt;
            image.classList.add("jhs-layout-d4a575e8");
        } else {
            image.classList.add("jhs-layout-cad980f4");
        }
        const frame = this.document.createElement("button");
        frame.type = "button";
        frame.className = this.hostAdapter.site === "javbus" ? "photo-frame jhs-screenshot-open" : "jhs-screenshot-open";
        frame.setAttribute("aria-label", "查看缩略图");
        frame.append(image);
        const restoreFocus = container.contains(this.document.activeElement);
        container.replaceChildren(frame);
        if (restoreFocus) frame.focus({ preventScroll:true });
        return true;
    }

    /** @param {Element} container @param {string | null} rawCarNum @param {unknown} error */
    showErrorFallback(container, rawCarNum, error) {
        const bus = this.hostAdapter.site === "javbus";
        const message = this.document.createElement("div");
        message.className = `jhs-screenshot-message${bus ? " jhs-screenshot-message--bus" : ""}`;
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
        const searchUrl = normalizeHttpUrl(this.screenshot.getSearchUrl({ carNum }), this.window.location.href);
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
        const retry = target?.closest(".retry-link");
        if (retry) {
            event.preventDefault();
            event.stopPropagation();
            if (container.getAttribute("aria-busy") === "true") return;
            const message = container.querySelector(".jhs-screenshot-message");
            if (message) message.textContent = "正在重试…";
            retry.textContent = "重试中…";
            retry.setAttribute("aria-disabled", "true");
            const generation = ++this.generation;
            void this.loadIntoContainer(container, generation, true);
            return;
        }
        if (target?.closest(".check-link")) return;
        if (target?.closest(".jhs-screenshot-open") || (this.hostAdapter.site !== "javbus" && target?.matches("img"))) {
            event.preventDefault();
            event.stopPropagation();
            try { this.ui.openImageViewer(container, { imageKind:"contact-sheet", trigger: target.closest("button,a") || container, owner: container, scope: this.scope }); }
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
