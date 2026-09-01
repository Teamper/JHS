// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { normalizeJavStoreAssetUrl } from "../../integrations/javstore/parser.js";

export const DETAIL_SCREENSHOT_CSS = `<style>
    .jhs-screenshot-message { margin-top:50px; color:var(--jhs-text-muted); cursor:auto; }
    .jhs-screenshot-message--bus { margin-top:30px; }
</style>`;

/** Own native-detail screenshot loading and its host gallery placeholder. */
export class DetailScreenshotController {
    /** @param {{hostAdapter: any, screenshot: any, settings: any, ui?: any, styles?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.screenshot = options.screenshot;
        this.settings = options.settings;
        this.ui = options.ui ?? null;
        this.styles = options.styles ?? null;
        this.scope = options.scope;
        this.styleRelease = null;
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getClog() { return this.ui?.getClog?.() ?? {}; }
    getSettingsSnapshot() { return this.settings?.snapshot?.() ?? {}; }
    getRoot() { return this.hostAdapter.locateDetailRoot?.() ?? this.hostAdapter.document?.body ?? null; }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !["javdb", "javbus"].includes(this.hostAdapter?.site)) return;
        this.started = true;
        this.styleRelease = this.styles?.register?.("jhs-detail-screenshot", DETAIL_SCREENSHOT_CSS.replace(/^\s*<style>|<\/style>\s*$/g, "")) ?? null;
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names) ?? [];
            if (!names.includes("enableLoadScreenShot")) return;
            if (this.getSettingsSnapshot().enableLoadScreenShot === "no") this.unmountHosted();
            else void this.loadScreenShot().catch((error) => this.getClog().error?.("长缩略图重新加载失败", error));
        });
        void this.loadScreenShot().catch((error) => this.getClog().error?.("长缩略图加载失败", error));
    }

    async loadScreenShot() {
        const settings = this.getSettingsSnapshot();
        if (!this.screenshot?.isEnabled?.(settings)) return this.unmountHosted();
        const carNum = this.hostAdapter.readMovieRef()?.carNum;
        const container = this.ensureHostedContainer();
        if (!container) return;
        container.empty().append(this.getJQuery()("<div></div>").addClass(this.hostAdapter.site === "javbus" ? "jhs-screenshot-message jhs-screenshot-message--bus" : "jhs-screenshot-message").text("正在加载缩略图"));
        try {
            const url = await this.getScreenshot(carNum);
            if (url) this.addImg("缩略图", url);
            else this.showErrorFallback(carNum, null);
        } catch (error) { this.showErrorFallback(carNum, error); }
    }

    ensureHostedContainer() {
        const $ = this.getJQuery(), root = this.getRoot();
        if (!$ || !root) return null;
        const existing = $(root).find(".screen-container").first();
        if (existing.length) return existing;
        const container = $("<a></a>").addClass(`screen-container ${this.hostAdapter.site === "javbus" ? "sample-box" : "tile-item"}`).attr("href", "#");
        if (this.hostAdapter.site === "javbus") {
            const gallery = root.querySelector("#sample-waterfall");
            if (!gallery) return null;
            const first = $(gallery).find(".sample-box").first();
            first.length ? first.after(container) : $(gallery).append(container);
        } else {
            const gallery = this.hostAdapter.locateNativeGallery?.();
            if (!gallery) return null;
            const first = $(gallery).find(".tile-item").first();
            first.length ? first.before(container) : $(gallery).append(container);
        }
        return container;
    }

    unmountHosted() { this.getJQuery()?.(this.getRoot()).find(".screen-container, .jhs-screenshot-providers").remove(); }

    /** @param {string | null} carNum */
    async getScreenshot(carNum) {
        const normalized = normalizeCarNum(carNum);
        if (!normalized) {
            this.getClog().warn?.("跳过缩略图解析：番号不可用");
            throw new Error("缩略图番号不可用");
        }
        const settings = this.getSettingsSnapshot();
        if (!this.screenshot?.isEnabled?.(settings)) return null;
        const images = await this.screenshot.resolve({ carNum: normalized }, { scope: this.scope, settings });
        const image = Array.isArray(images) ? images[0] : images;
        return image?.url || null;
    }

    /** @param {string} label @param {string} value */
    addImg(label, value) {
        const $ = this.getJQuery(), root = this.getRoot(), url = normalizeJavStoreAssetUrl(value), container = root && $(root).find(".screen-container").first();
        if (!$ || !container?.length || !url) return;
        const image = $("<img>").attr({ src: url, alt: label, loading: "lazy" });
        if (this.hostAdapter.site === "javbus") container.empty().append($("<div></div>").addClass("photo-frame").append(image.attr("title", label)));
        else container.empty().append(image);
        container.off("click.jhsScreenshot").on("click.jhsScreenshot", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            this.ui?.showImageViewer?.(image[0]) ?? /** @type {any} */ (globalThis).showImageViewer?.(image[0]);
        });
    }

    /** @param {string | null} carNum @param {unknown} error */
    showErrorFallback(carNum, error) {
        const $ = this.getJQuery(), root = this.getRoot(), container = root && $(root).find(".screen-container").first();
        if (!$ || !container?.length) return;
        if (error) this.getClog().error?.("获取缩略图失败:", error instanceof Error ? error.message.slice(0, 100) : error);
        const normalized = normalizeCarNum(carNum), messageClass = this.hostAdapter.site === "javbus" ? "jhs-screenshot-message jhs-screenshot-message--bus" : "jhs-screenshot-message";
        if (!normalized) return void container.empty().append($("<div></div>").addClass(messageClass).text("无法获取番号，缩略图未加载"));
        const searchUrl = this.screenshot?.getSearchUrl?.({ carNum: normalized }, this.getSettingsSnapshot());
        const message = $("<div></div>").addClass(messageClass).text(error ? "获取缩略图失败" : "暂无缩略图结果"), retry = $("<a href=\"#\"></a>").addClass("retry-link").text("点击重试");
        container.empty().append(message, $("<br>"), retry);
        if (searchUrl) container.append(document.createTextNode(" 或 "), $("<a target=\"_blank\" rel=\"noopener noreferrer\"></a>").addClass("check-link").attr("href", searchUrl).text("前往确认"));
        container.off("click.jhsScreenshot", ".retry-link").on("click.jhsScreenshot", ".retry-link", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation(); container.empty(); void this.loadScreenShot();
        });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.unmountHosted();
        this.styleRelease?.();
        this.styleRelease = null;
    }
}
