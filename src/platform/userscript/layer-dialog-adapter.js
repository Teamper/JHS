// @ts-check

export class LayerDialogAdapter {
    /** @param {{open: (options: Record<string, unknown>) => number, close: (id: number) => void}} layerRuntime */
    constructor(layerRuntime) { this.layer = layerRuntime; }
    /** @param {Record<string, unknown>} options */
    open(options) { return this.layer.open(options); }
    /** @param {number} id */
    close(id) { this.layer.close(id); }
}
