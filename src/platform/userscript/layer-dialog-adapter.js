// @ts-check

import { closeOwnedPopover } from "../../core/owned-popover.js";
import { prepareDialogOptions } from "../../core/dialog-shell.js";
import { JHS_Z_INDEX } from "../../core/theme.js";

export class LayerDialogAdapter {
    /** @param {{open: (options: Record<string, unknown>) => number, close: (id: number) => void, confirm: (message: string, options: Record<string, unknown>, yes: (id: number) => void, no?: (id: number) => void) => number, alert: (message: string, options?: Record<string, unknown>) => number}} layerRuntime */
    constructor(layerRuntime) { this.layer = layerRuntime; }
    /** @param {Record<string, unknown>} options */
    open(options) { return this.layer.open(this.withDefaultLayer(options)); }
    /** @param {number} id */
    close(id) { this.layer.close(id); }
    /** @param {string} message @param {Record<string, unknown>} options @param {(id: number) => void} yes @param {(id: number) => void} [onCancel] */
    confirm(message, options = {}, yes, onCancel) {
        const { confirmText, cancelText, ...dialogOptions } = options;
        if (confirmText == null && cancelText == null) return onCancel ? this.layer.confirm(message, this.withDefaultLayer(options), yes, onCancel) : this.layer.confirm(message, this.withDefaultLayer(options), yes);
        const skin = [ dialogOptions.skin, "jhs-confirm-actions" ].filter(Boolean).join(" ");
        return this.layer.confirm(message, this.withDefaultLayer({ ...dialogOptions, skin, btn: [ cancelText || "取消", confirmText || "确定" ] }), (id) => { try { onCancel?.(id); } finally { this.layer.close(id); } }, yes);
    }
    /** @param {string} message @param {Record<string, unknown>} [options] */
    alert(message, options) { return this.layer.alert(message, this.withDefaultLayer(options)); }
    /** @param {Record<string, unknown> | undefined} options */
    withDefaultLayer(options = {}) {
        let baseZ = JHS_Z_INDEX.layer;
        if (typeof document !== "undefined") {
            closeOwnedPopover(document);
            for (const el of document.querySelectorAll(".layui-layer")) {
                const z = Number(/** @type {HTMLElement} */ (el).style?.zIndex || 0);
                if (z >= baseZ) baseZ = z + 2;
            }
        }
        const value = { zIndex: baseZ, ...options };
        return options.ui ? prepareDialogOptions(value, /** @type {any} */ (globalThis).utils) : value;
    }
}
