// @ts-check

import { JHS_Z_INDEX } from "../../core/theme.js";

export class LayerDialogAdapter {
    /** @param {{open: (options: Record<string, unknown>) => number, close: (id: number) => void, confirm: (message: string, options: Record<string, unknown>, yes: (id: number) => void) => number, alert: (message: string, options?: Record<string, unknown>) => number}} layerRuntime */
    constructor(layerRuntime) { this.layer = layerRuntime; }
    /** @param {Record<string, unknown>} options */
    open(options) { return this.layer.open(this.withDefaultLayer(options)); }
    /** @param {number} id */
    close(id) { this.layer.close(id); }
    /** @param {string} message @param {Record<string, unknown>} options @param {(id: number) => void} yes */
    confirm(message, options, yes) { return this.layer.confirm(message, this.withDefaultLayer(options), yes); }
    /** @param {string} message @param {Record<string, unknown>} [options] */
    alert(message, options) { return this.layer.alert(message, this.withDefaultLayer(options)); }
    /** @param {Record<string, unknown> | undefined} options */
    withDefaultLayer(options = {}) { return { zIndex: JHS_Z_INDEX.layer, ...options }; }
}
