// @ts-check

import { JhsSelect } from "../core/ui-primitives.js";

/** Explicit Feature capability for the existing jQuery boundary and JHS select controls. */
export class DomUiService {
    /** @param {((value: any) => any) | undefined} jquery @param {{q?: (position: {clientX: number, clientY: number}, message: string, onConfirm: () => void) => unknown, closePage?: (options?: Record<string, unknown>) => Promise<unknown> | unknown, getOwningLayerIndex?: (options?: Record<string, unknown>) => number|null, getDialogArea?: (size?: string) => [string, string], getResponsiveArea?: (area?: [string, string]) => [string, string], setupEscClose?: (layerIndex: number) => unknown, download?: (data: any, filename: string) => unknown, formatDate?: (value: any) => string, openPage?: (...args: any[]) => unknown, isHidden?: (element: any) => boolean, smoothScrollToTop?: (duration?: number) => Promise<unknown> | unknown} | undefined} legacyUtils @param {((image: Element) => unknown) | undefined} openImageViewer @param {(() => {close?: () => void} | undefined) | undefined} startLoading @param {((config: Record<string, unknown>) => any) | undefined} createImageHoverPreview @param {any} [tableConstructor] */
    constructor(jquery, legacyUtils, openImageViewer = undefined, startLoading = undefined, createImageHoverPreview = undefined, tableConstructor = undefined) {
        this.tableConstructor = typeof tableConstructor === "function" ? tableConstructor : null;
        this.jqueryRuntime = typeof jquery === "function" ? jquery : null;
        this.jquery = (/** @type {any} */ value) => {
            if (!this.jqueryRuntime) throw new Error("页面 UI 依赖尚未加载");
            return this.jqueryRuntime(value);
        };
        /** @type {(position: {clientX: number, clientY: number}, message: string, onConfirm: () => void) => unknown} */
        this.confirm = (position, message, onConfirm) => {
            if (typeof legacyUtils?.q !== "function") throw new Error("页面确认框依赖尚未加载");
            return legacyUtils.q(position, message, onConfirm);
        };
        /** @type {(options: Record<string, unknown>) => Promise<unknown> | unknown} */
        this.closePage = (options) => {
            if (typeof legacyUtils?.closePage !== "function") throw new Error("页面关闭能力尚未加载");
            return legacyUtils.closePage(options);
        };
        this.getOwningLayerIndex = (/** @type {Record<string, unknown>} */ options) => typeof legacyUtils?.getOwningLayerIndex === "function" ? legacyUtils.getOwningLayerIndex(options) : null;
        /** @type {(image: Element) => unknown} */
        this.openImageViewer = (image) => {
            if (typeof openImageViewer !== "function") throw new Error("图片查看器尚未加载");
            return openImageViewer(image);
        };
        /** @type {() => {close?: () => void}} */
        this.loading = () => {
            if (typeof startLoading !== "function") throw new Error("页面加载提示尚未加载");
            return startLoading() ?? {};
        };
        this.createImageHoverPreview = (/** @type {Record<string, unknown>} */ config) => {
            if (typeof createImageHoverPreview !== "function") throw new Error("图片悬浮预览尚未加载");
            return createImageHoverPreview(config);
        };
        this.getDialogArea = (size = "md") => {
            if (typeof legacyUtils?.getDialogArea === "function") return legacyUtils.getDialogArea(size);
            return size === "lg" ? ["1040px", "760px"] : ["720px", "700px"];
        };
        this.getResponsiveArea = (/** @type {[string, string] | undefined} */ area) => typeof legacyUtils?.getResponsiveArea === "function" ? legacyUtils.getResponsiveArea(area) : (area ?? this.getDialogArea("md"));
        this.setupEscClose = (/** @type {number} */ layerIndex) => legacyUtils?.setupEscClose?.(layerIndex);
        this.download = (/** @type {any} */ data, /** @type {string} */ filename) => {
            if (typeof legacyUtils?.download !== "function") throw new Error("页面下载能力尚未加载");
            return legacyUtils.download(data, filename);
        };
        this.formatDate = (/** @type {any} */ value) => typeof legacyUtils?.formatDate === "function" ? legacyUtils.formatDate(value) : String(value ?? "");
        /** @param {any[]} args */
        this.openPage = (...args) => {
            if (typeof legacyUtils?.openPage !== "function") throw new Error("页面导航能力尚未加载");
            return legacyUtils.openPage(...args);
        };
        this.isHidden = (/** @type {any} */ element) => typeof legacyUtils?.isHidden === "function" ? legacyUtils.isHidden(element) : !element?.[0]?.getClientRects?.().length;
        this.smoothScrollToTop = (duration = 500) => legacyUtils?.smoothScrollToTop?.(duration) ?? Promise.resolve();
        Object.freeze(this);
    }

    /** @param {any} controller */
    enhanceSelect(controller) { return JhsSelect.enhance(controller); }

    /** @param {any} select */
    refreshSelect(select) { return JhsSelect.refresh(select); }

    /** @param {any} select @param {any} value @param {boolean} [emit] */
    setSelectValue(select, value, emit = false) { return JhsSelect.setValue(select, value, emit); }

}
