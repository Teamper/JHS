// @ts-check

import { l, normalizeCarNum, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { normalizeJavStoreAssetUrl } from "../../integrations/javstore/parser.js";
import { renderScreenshotPanel } from "../../ui/detail/screenshot-panel.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */
/** @typedef {{ preventDefault: () => void, stopPropagation: () => void, currentTarget: EventTarget }} JQueryClickEvent */

export class ScreenShotPlugin extends BasePlugin {
    getName() {
        return "ScreenShotPlugin";
    }
    /** @returns {import("../../services/screenshot-service.js").ScreenshotService} */
    getScreenshotService() { return this.getRuntimeService("screenshot"); }
    /** @returns {Record<string, any>} */
    getSettingsSnapshot() { return /** @type {any} */ (this.getRuntimeService("settings"))?.snapshot?.() ?? {}; }
    async initCss() {
        return `<style>.jhs-screenshot-message{margin-top:50px;color:var(--jhs-text-muted);cursor:auto}.jhs-screenshot-message--bus{margin-top:30px}</style>`;
    }
    async handle() {
        if (!isDetailPage) return;
        const settings = this.getRuntimeService("settings"), scope = await this.getRuntimeService("scope")();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("enableLoadScreenShot")) return;
            if (settings.snapshot().enableLoadScreenShot === "no") this.unmountHosted();
            else void this.loadScreenShot().catch((/** @type {unknown} */ error) => clog.error("长缩略图重新加载失败", error));
        };
        settings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => settings.removeEventListener("settings.changed", onSettingsChanged)));
        void this.loadScreenShot().catch((/** @type {unknown} */ error) => clog.error("长缩略图加载失败", error));
    }
    /** 关闭总开关时删除 JHS 自有截图 UI（宿主原生区域不做永久销毁）。 */
    unmountHosted() {
        $(".screen-container, .jhs-screenshot-providers").remove();
    }
    async loadScreenShot() {
        if (!isDetailPage) return;
        const service = this.getScreenshotService();
        if (!service.isEnabled(this.getSettingsSnapshot())) return;
        const carNum = this.getPageInfo().carNum;
        r && $(".preview-images .tile-item").first().before(' <a class="tile-item screen-container jhs-layout-cd9d5db1"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> '),
        l && $("#sample-waterfall .sample-box:first").after(' <a class="sample-box screen-container jhs-layout-b5c4e4f7"><div class="jhs-layout-3536a853">正在加载缩略图</div></a> ');
        try {
            const url = await this.getScreenshot(carNum);
            url ? (this.addImg("缩略图", url), clog.log("加载缩略图:", url)) : this.showErrorFallback(carNum, null);
        } catch (error) {
            this.showErrorFallback(carNum, error);
        }
    }
    /** @param {string | null} e */
    async getScreenshot(e) {
        e = normalizeCarNum(e);
        if (!e) throw clog.warn("跳过缩略图解析：番号不可用"), new Error("缩略图番号不可用");
        const service = this.getScreenshotService(), settings = this.getSettingsSnapshot();
        if (!service.isEnabled(settings)) return clog.warn("长缩略图功能已关闭，跳过请求"), null;
        const scope = await this.getRuntimeService("scope")();
        const images = await service.resolve({ carNum: e }, { scope, settings });
        const image = Array.isArray(images) ? images[0] : images;
        return image?.url || null;
    }
    /** @param {string} e @param {string} t */
    addImg(e, t) {
        const url = normalizeJavStoreAssetUrl(t);
        if (!url) return;
        const container = $(".screen-container").empty(), image = $("<img>").attr({ src: url, alt: e, loading: "lazy" });
        r && container.append(image.addClass("jhs-layout-cad980f4"));
        l && container.append($('<div class="photo-frame"></div>').append(image.attr("title", e).addClass("jhs-layout-d4a575e8")));
        container.on("click", ((/** @type {JQueryClickEvent} */ e) => {
            e.stopPropagation(), e.preventDefault(), (/** @type {any} */ (globalThis)).showImageViewer(e.currentTarget);
        }));
    }
    /** @param {string} e @param {unknown} t */
    showErrorFallback(e, t) {
        const errorMessage = t instanceof Error ? t.message : "";
        t && clog.error("获取缩略图失败:", errorMessage.substring(0, 100));
        const a = `jhs-screenshot-message${l ? " jhs-screenshot-message--bus" : ""}`;
        const carNum = normalizeCarNum(e);
        if (!carNum) return void $(".screen-container").empty().append($("<div></div>").addClass(a).text("无法获取番号，缩略图未加载"));
        const searchUrl = this.getScreenshotService().getSearchUrl({ carNum }), container = $(".screen-container").empty();
        const message = $("<div></div>").addClass(a).text(t instanceof Error ? "获取缩略图失败" : "暂无缩略图结果"), retry = $('<a href="#" class="retry-link">点击重试</a>');
        container.append(message, $("<br>"), retry);
        searchUrl && container.append(document.createTextNode(" 或 "), $('<a class="check-link" target="_blank" rel="noopener noreferrer">前往确认</a>').attr("href", searchUrl));
        container.off("click", ".retry-link").off("click", ".check-link").on("click", ".retry-link", (async (/** @type {JQueryClickEvent} */ t) => {
            t.stopPropagation(), t.preventDefault(), container.empty().append($("<div></div>").addClass(a).text("正在重新加载..."));
            try {
                const result = await this.getScreenshot(carNum);
                result ? this.addImg("缩略图", result) : this.showErrorFallback(carNum, null);
            } catch (n) {
                this.showErrorFallback(carNum, n);
            }
        })).on("click", ".check-link", ((/** @type {JQueryClickEvent} */ t) => {
            t.stopPropagation(), t.preventDefault(), window.open(searchUrl, "_blank");
        }));
    }
    /** 将截图视图挂载到任意自有工作区容器（FC2 / owned detail 共用同一 ScreenshotView）。 */
    /** @param {JQueryHandle | Element} target @param {string} carNum @param {{ isActive?: () => boolean }} [options] */
    async loadInto(target, carNum, { isActive = () => !0 } = {}) {
        const host = $(target);
        if (!host.length || !this.getScreenshotService().isEnabled(this.getSettingsSnapshot())) return host.empty(), null;
        const scope = await this.getRuntimeService("scope")();
        return renderScreenshotPanel({
            target: host, carNum, screenshot: this.getScreenshotService(), settings: this.getSettingsSnapshot(),
            scope, isActive,
        });
    }
    /** @param {JQueryHandle | Element} target @param {string} url @param {string} alt */
    renderInto(target, url, alt) {
        const host = $(target), image = $("<img>").attr({ src: normalizeJavStoreAssetUrl(url), alt, loading: "lazy" }).addClass("jhs-fc2-gallery__image"), button = $('<button type="button" class="jhs-btn jhs-fc2-gallery-item jhs-fc2-screenshot-thumbnail"></button>').attr("aria-label", `查看${alt}大图`).append(image);
        host.empty().append(button).off("click.jhsScreenshot").on("click.jhsScreenshot", ".jhs-fc2-screenshot-thumbnail", ((/** @type {JQueryClickEvent} */ event) => {
            event.preventDefault(), event.stopPropagation(), (/** @type {any} */ (globalThis)).showImageViewer(image[0]);
        }));
    }
}
