// @ts-check
import { getDialogArea, getOwningLayerIndex, trapDialogFocus } from "../core/dialog-shell.js";
import { formatDate } from "../core/ui-date-time.js";
import { JhsSelect } from "../core/ui-primitives.js";
import { getResponsiveArea, isHidden, smoothScrollToTop } from "../core/dom-actions.js";

/** @typedef {ReturnType<typeof import("../platform/browser/page-dialogs.js").createPageDialogs>} PageDialogs */
/** @typedef {Partial<Pick<PageDialogs, "q" | "closePage" | "openPage">> & {
    navigation?: import("../contracts/ports.js").NavigationPort,
    isMobileMode?: () => boolean,
    setupEscClose?: import("../core/dialog-esc-controller.js").DialogEscController["setupEscClose"],
    releaseEscClose?: import("../core/dialog-esc-controller.js").DialogEscController["releaseEscClose"],
    download?: (data: BlobPart | Blob, filename: string) => void
}} PageBindings */

/** Feature-facing DOM capabilities plus the vendor UI boundary. */
export class DomUiService {
    /** @param {((value: any) => any) | undefined} jquery @param {PageBindings} [page] @param {((source: string | Element, alt?: string, options?: Record<string, any>) => unknown)} [openImageViewer] @param {(() => {close?: () => void} | undefined)} [startLoading] @param {((config: Record<string, unknown>) => any)} [createImageHoverPreview] @param {any} [tableConstructor] */
    constructor(jquery, page = {}, openImageViewer, startLoading, createImageHoverPreview, tableConstructor) {
        this.tableConstructor = typeof tableConstructor === "function" ? tableConstructor : null;
        this.jqueryRuntime = jquery ?? null;
        this.jquery = (/** @type {any} */ value) => {
            if (!this.jqueryRuntime) throw new Error("页面 UI 依赖尚未加载");
            return this.jqueryRuntime(value);
        };
        this.q = page.q ?? (() => { throw new Error("页面确认框依赖尚未加载"); });
        /** @type {(position: {clientX: number, clientY: number}, message: string, onConfirm: () => void, options?: import("../platform/browser/page-dialogs.js").ConfirmOptions) => unknown} */
        this.confirm = (position, message, onConfirm, options) =>
            options ? this.q(position, message, onConfirm, undefined, options) : this.q(position, message, onConfirm);
        this.closePage = page.closePage ?? (() => { throw new Error("页面关闭能力尚未加载"); });
        this.openPage = page.openPage ?? (() => { throw new Error("页面导航能力尚未加载"); });
        this.navigation = page.navigation;
        this.download = page.download ?? (() => { throw new Error("页面下载能力尚未加载"); });
        this.isMobileMode = page.isMobileMode ?? (() => false);
        this.getOwningLayerIndex = getOwningLayerIndex;
        this.getDialogArea = getDialogArea;
        this.trapFocus = trapDialogFocus;
        this.getResponsiveArea = (/** @type {[string, string] | undefined} */ area) => getResponsiveArea(this.isMobileMode(), window.innerWidth, area);
        this.setupEscClose = page.setupEscClose ?? (() => {});
        this.releaseEscClose = page.releaseEscClose ?? (() => {});
        this.isHidden = isHidden;
        this.formatDate = formatDate;
        this.smoothScrollToTop = smoothScrollToTop;
        /** @type {(source: string | Element, options?: Record<string, any>) => unknown} */
        this.openImageViewer = (source, options) => {
            if (!openImageViewer) throw new Error("图片查看器尚未加载");
            return openImageViewer(source, "", options);
        };
        /** @type {() => {close?: () => void}} */
        this.loading = () => {
            if (!startLoading) throw new Error("页面加载提示尚未加载");
            return startLoading() ?? {};
        };
        this.createImageHoverPreview = (/** @type {Record<string, unknown>} */ config) => {
            if (!createImageHoverPreview) throw new Error("图片悬浮预览尚未加载");
            return createImageHoverPreview(config);
        };
        Object.freeze(this);
    }

    /** @param {any} controller */
    enhanceSelect(controller) { return JhsSelect.enhance(controller); }

    /** @param {any} select */
    refreshSelect(select) { return JhsSelect.refresh(select); }

    /** @param {any} select @param {any} value @param {boolean} [emit] */
    setSelectValue(select, value, emit = false) { return JhsSelect.setValue(select, value, emit); }
}
