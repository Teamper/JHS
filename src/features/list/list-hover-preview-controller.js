// @ts-check

import { _ } from "../../core/constants.js";

/** Own the list-cover hover preview instance and its live setting subscription. */
export class ListHoverPreviewController {
    /** @param {{hostAdapter: any, settings: any, ui: any, scope: any, window?: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.settings = options.settings;
        this.ui = options.ui;
        this.scope = options.scope;
        this.window = /** @type {any} */ (options.window ?? globalThis.window ?? null);
        /** @type {"yes" | "no" | null} */ this.enabled = null;
        this.instance = null;
        this.started = false;
        this.releaseSettings = null;
    }

    start() {
        if (this.started || !this.window || !this.settings?.snapshot || !this.ui?.createImageHoverPreview) return false;
        this.scope.assertActive();
        this.started = true;
        const onSettingsChanged = (/** @type {any} */ event) => {
            if (!event.detail?.names?.includes("hoverBigImg")) return;
            this.configure(this.settings.snapshot().hoverBigImg === "yes" ? "yes" : "no");
        };
        this.releaseSettings = this.scope.listen(this.settings, "settings.changed", onSettingsChanged);
        const configured = this.settings.snapshot().hoverBigImg;
        this.configure(configured === _ ? "yes" : "no");
        return true;
    }

    /** @param {string} enabled */
    configure(enabled) {
        if (!this.window) return;
        const nextEnabled = enabled === "yes" ? "yes" : "no";
        if (this.enabled === nextEnabled && (nextEnabled === "no" || this.window.imageHoverPreviewObj === this.instance)) return;
        this.destroyInstance();
        if (nextEnabled === "yes") {
            const selector = this.hostAdapter.getListSelectors?.()?.coverImgSelector;
            if (!selector) return;
            this.instance = this.ui.createImageHoverPreview({ selector });
            this.window.imageHoverPreviewObj = this.instance;
        }
        this.enabled = nextEnabled;
    }

    destroyInstance() {
        if (!this.window) return;
        const existing = this.instance ?? this.window.imageHoverPreviewObj;
        existing?.destroy?.();
        if (this.window.imageHoverPreviewObj === existing) this.window.imageHoverPreviewObj = null;
        this.instance = null;
    }

    dispose() {
        this.releaseSettings?.();
        this.releaseSettings = null;
        this.destroyInstance();
        this.enabled = "no";
        this.started = false;
    }
}
