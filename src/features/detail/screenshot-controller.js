// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

const SCREENSHOT_STYLES = `.jhs-screenshot-message{margin-top:50px;color:var(--jhs-text-muted);cursor:auto}.jhs-screenshot-message--bus{margin-top:30px}.screen-container .jhs-screenshot-open{display:block;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in}`;

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
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.route !== "detail") return false;
        this.started = true;
        const releaseStyle = this.styles.register("jhs-detail-screenshot-feature", SCREENSHOT_STYLES);
        this.scope.addCleanup(releaseStyle);
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("enableLoadScreenShot")) return;
            if (this.screenshot.isEnabled(this.settings.snapshot())) this.mountHosted();
            else this.unmountHosted();
        });
        this.scope.listen(this.document, "click", (/** @type {Event} */ event) => this.handleClick(/** @type {MouseEvent} */ (event)));
        this.scope.addCleanup(() => this.dispose());
        if (this.screenshot.isEnabled(this.settings.snapshot())) this.mountHosted();
        return true;
    }

    mountHosted() {
        if (this.disposed || this.scope.disposed || !this.screenshot.isEnabled(this.settings.snapshot())) return;
        if (this.hostContainer?.isConnected) return;
        const gallery = this.hostAdapter.locateNativeGallery?.();
        if (!gallery) return;
        const container = this.document.createElement(this.hostAdapter.site === "javbus" ? "div" : "a");
        container.className = this.hostAdapter.site === "javbus"
            ? "sample-box screen-container jhs-layout-b5c4e4f7"
            : "tile-item screen-container jhs-layout-cd9d5db1";
        const loading = this.document.createElement("div");
        loading.className = this.hostAdapter.site === "javbus" ? "jhs-layout-3536a853" : "jhs-layout-9db87399";
        loading.textContent = "正在加载缩略图";
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
        this.document.querySelectorAll(".screen-container, .jhs-screenshot-providers").forEach((node) => node.remove());
        this.hostContainer = null;
    }

    /** @param {string | null} rawCarNum @param {{allowWhenDisabled?: boolean, scope?: any}} [options] */
    async getScreenshot(rawCarNum, options = {}) {
        const carNum = normalizeCarNum(rawCarNum);
        if (!carNum) throw new Error("缩略图番号不可用");
        const settings = this.settings.snapshot();
        if (!options.allowWhenDisabled && !this.screenshot.isEnabled(settings)) return null;
        const images = await this.screenshot.resolve({ carNum }, {
            scope: options.scope ?? this.scope,
            settings,
            allowWhenDisabled: options.allowWhenDisabled === true,
        });
        const image = Array.isArray(images) ? images[0] : images;
        return image?.url || null;
    }

    /** @param {Element} container @param {number} generation */
    async loadIntoContainer(container, generation) {
        const rawCarNum = new URL(this.window.location.href).searchParams.get("jhsCarNum")
            ?? this.hostAdapter.readMovieRef?.()?.carNum
            ?? null;
        const requestScope = new LifecycleScope(`detail-screenshot:${generation}`);
        const releaseRequestScope = this.scope.addCleanup(() => requestScope.dispose());
        this.requestScope = requestScope;
        this.releaseRequestScope = releaseRequestScope;
        try {
            const url = await this.getScreenshot(rawCarNum, { scope: requestScope });
            if (!this.isCurrent(container, generation)) return;
            if (url) this.renderImage(container, "缩略图", url);
            else this.showErrorFallback(container, rawCarNum, null);
        } catch (error) {
            if (!this.isCurrent(container, generation)) return;
            this.report(error);
            this.showErrorFallback(container, rawCarNum, error);
        } finally {
            releaseRequestScope();
            requestScope.dispose();
            if (this.requestScope === requestScope) {
                this.requestScope = null;
                this.releaseRequestScope = null;
            }
        }
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
        image.src = url;
        image.alt = alt;
        image.loading = "lazy";
        if (this.hostAdapter.site === "javbus") {
            image.title = alt;
            image.classList.add("jhs-layout-d4a575e8");
            const frame = this.document.createElement("button");
            frame.type = "button";
            frame.className = "photo-frame jhs-screenshot-open";
            frame.setAttribute("aria-label", "查看缩略图");
            frame.append(image);
            container.replaceChildren(frame);
        } else {
            image.classList.add("jhs-layout-cad980f4");
            container.replaceChildren(image);
        }
        return true;
    }

    /** @param {Element} container @param {string | null} rawCarNum @param {unknown} error */
    showErrorFallback(container, rawCarNum, error) {
        const bus = this.hostAdapter.site === "javbus";
        const message = this.document.createElement("div");
        message.className = `jhs-screenshot-message${bus ? " jhs-screenshot-message--bus" : ""}`;
        const carNum = normalizeCarNum(rawCarNum);
        if (!carNum) {
            message.textContent = "无法获取番号，缩略图未加载";
            container.replaceChildren(message);
            return;
        }
        message.textContent = error instanceof Error ? "获取缩略图失败" : "暂无缩略图结果";
        const retry = this.document.createElement("a");
        retry.href = "#";
        retry.className = "retry-link";
        retry.textContent = "点击重试";
        container.replaceChildren(message, this.document.createElement("br"), retry);
        const searchUrl = normalizeHttpUrl(this.screenshot.getSearchUrl({ carNum }), this.window.location.href);
        if (searchUrl) {
            container.append(this.document.createTextNode(" 或 "));
            const search = this.document.createElement("a");
            search.className = "check-link";
            search.href = searchUrl;
            search.target = "_blank";
            search.rel = "noopener noreferrer";
            search.textContent = "前往确认";
            container.append(search);
        }
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
            const loading = this.document.createElement("div");
            loading.className = this.hostAdapter.site === "javbus" ? "jhs-layout-3536a853" : "jhs-layout-9db87399";
            loading.textContent = "正在重新加载...";
            container.replaceChildren(loading);
            const generation = ++this.generation;
            void this.loadIntoContainer(container, generation);
            return;
        }
        if (target?.closest(".check-link")) return;
        if (target?.closest(".jhs-screenshot-open") || (this.hostAdapter.site !== "javbus" && target?.matches("img"))) {
            event.preventDefault();
            event.stopPropagation();
            try { this.ui.openImageViewer(container); }
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
        this.releaseRequestScope?.();
        this.requestScope?.dispose();
        this.releaseRequestScope = null;
        this.requestScope = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.unmountHosted();
    }
}
