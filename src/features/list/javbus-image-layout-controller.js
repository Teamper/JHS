// @ts-check
import { waitForSettlement } from "../../core/async-settlement.js";

import { C, _ } from "../../core/constants.js";

/** Normalize uneven JavBus cover heights within each visible row. */
export class JavBusImageLayoutController {
    /** @param {{hostAdapter: any, settings: any, document?: Document}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.settings = options.settings;
        this.document = options.document ?? document;
        /** @type {Map<HTMLImageElement, {value: string, priority: string, writtenValue: string, writtenPriority: string}>} */
        this.originalHeights = new Map();
        this.runChain = Promise.resolve();
        this.disposed = false;
    }

    /** @param {{vertical?: unknown, columns?: unknown, enableVerticalModel?: unknown, containerColumns?: unknown}} [options] */
    logImageHeightsByRow(options = {}) {
        const operation = this.runChain.then(() => this.apply(options));
        this.runChain = waitForSettlement(operation);
        return operation;
    }

    /** @param {{vertical?: unknown, columns?: unknown, enableVerticalModel?: unknown, containerColumns?: unknown}} options */
    async apply(options) {
        if (this.disposed) return;
        const snapshot = this.settings.snapshot();
        const vertical = options.vertical ?? options.enableVerticalModel ?? snapshot.enableVerticalModel ?? C;
        const list = this.hostAdapter.locateListRoot?.();
        const tracks = list && this.document.defaultView?.getComputedStyle(list).gridTemplateColumns;
        const requested = Number(options.columns ?? options.containerColumns ?? snapshot.containerColumns ?? 5) || 5;
        const columns = tracks && tracks !== "none" && !tracks.includes("(") ? tracks.trim().split(/\s+/).length : requested;
        this.restoreHeights();
        if (vertical === _ || columns < 2) return;

        const itemSelector = this.hostAdapter.getListSelectors?.().itemSelector;
        if (!itemSelector) return;
        const visibleImages = [];
        for (const item of this.document.querySelectorAll(itemSelector)) {
            const style = getComputedStyle(item);
            if ((item.offsetWidth <= 0 && item.offsetHeight <= 0) || style.display === "none") continue;
            const image = item.querySelector("img");
            if (!(image instanceof HTMLImageElement)) continue;
            this.captureOriginalHeight(image);
            const height = image.offsetHeight;
            if (height > 0) visibleImages.push({ imgElement: image, height });
        }
        if (this.disposed) return;

        for (let index = 0; index < visibleImages.length; index += columns) {
            const row = visibleImages.slice(index, index + columns);
            if (row.length < 2) continue;
            const heights = row.map((item) => item.height);
            const minimum = Math.min(...heights);
            const maximum = Math.max(...heights);
            if (maximum - minimum <= 50) continue;
            for (const item of row) {
                if (item.height === minimum) continue;
                item.imgElement.style.setProperty("height", `${minimum}px`, "important");
                this.updateWrittenHeight(item.imgElement);
            }
        }
    }

    /** @param {HTMLImageElement} image */
    captureOriginalHeight(image) {
        if (this.originalHeights.has(image)) return;
        this.originalHeights.set(image, {
            value: image.style.getPropertyValue("height"),
            priority: image.style.getPropertyPriority("height"),
            writtenValue: image.style.getPropertyValue("height"),
            writtenPriority: image.style.getPropertyPriority("height"),
        });
    }

    /** @param {HTMLImageElement} image */
    updateWrittenHeight(image) {
        const original = this.originalHeights.get(image);
        if (!original) return;
        original.writtenValue = image.style.getPropertyValue("height");
        original.writtenPriority = image.style.getPropertyPriority("height");
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.restoreHeights();
    }

    restoreHeights() {
        for (const [image, original] of this.originalHeights) {
            if (image.style.getPropertyValue("height") !== original.writtenValue || image.style.getPropertyPriority("height") !== original.writtenPriority) continue;
            if (original.value) image.style.setProperty("height", original.value, original.priority);
            else image.style.removeProperty("height");
        }
        this.originalHeights.clear();
    }
}
