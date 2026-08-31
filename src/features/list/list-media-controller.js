// @ts-check

import { safePlay } from "../../core/feature-helpers.js";

/** Own delegated list-video interaction and its lifecycle listeners. */
export class ListMediaController {
    /** @param {{scope: any, document?: Document, selectors: Record<string, string>}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        /** @type {(() => void)[]} */ this.cleanups = [];
        this.started = false;
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        if (this.disposed || !this.document) return;
        const root = this.document.querySelector(this.selectors.boxSelector);
        if (!root) return;
        this.cleanups.push(this.scope.listen(root, "click", (/** @type {MouseEvent} */ event) => this.handleClick(event, root)));
    }

    /** @param {MouseEvent} event @param {Element} root */
    handleClick(event, root) {
        const target = /** @type {Element | null} */ (event.target);
        const video = target?.closest?.(".item video");
        if (!video || !root.contains(video)) return;
        event.preventDefault();
        event.stopPropagation();
        const media = /** @type {HTMLMediaElement} */ (video);
        if (media.paused) void safePlay(media, { context: "列表视频", notify: true });
        else media.pause();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
    }
}
