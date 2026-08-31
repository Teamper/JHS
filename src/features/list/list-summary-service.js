// @ts-check

import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { isHardHidden } from "./list-filters.js";

/** Own current-page status aggregation and its deferred recount lifecycle. */
export class ListSummaryService {
    /** @param {{scope: any, document?: Document, window?: any, selectors: Record<string, string>, site?: string, onSummary?: (summary: any) => void}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        this.site = options.site ?? "";
        this.onSummary = options.onSummary ?? (() => {});
        this.recountFrame = null;
        this.frameCleanup = null;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** Collect status and visibility counts from the current list DOM. */
    collectCurrentPageSummary() {
        const summary = { total: 0, pending: 0, blockedItems: 0, favorite: 0, downloaded: 0, watched: 0, debug: { manualBlocked: 0, keywordBlocked: 0, actorBlocked: 0, actressBlocked: 0 } };
        if (!this.document || !this.selectors.itemSelector) return summary;
        for (const item of this.document.querySelectorAll(this.selectors.itemSelector)) {
            if (this.site === "javbus" && item.querySelector(".avatar-box")) continue;
            const flags = normalizeStateFlags(this.readJson(item.getAttribute("data-jhs-flags"))), reasons = this.readJson(item.getAttribute("data-jhs-visibility")), hardHidden = isHardHidden(flags, reasons);
            summary.total++;
            flags.favorite && summary.favorite++;
            flags.downloaded && summary.downloaded++;
            flags.watched && summary.watched++;
            hardHidden && summary.blockedItems++;
            !hasAnyState(flags) && !hardHidden && summary.pending++;
            flags.blocked && summary.debug.manualBlocked++;
            reasons.keyword && summary.debug.keywordBlocked++;
            reasons.actorBlacklist && summary.debug.actorBlocked++;
            reasons.actressBlacklist && summary.debug.actressBlocked++;
        }
        return summary;
    }

    /** Recount immediately and project the result to the compatibility owner. */
    recountStatuses() {
        const summary = this.collectCurrentPageSummary();
        this.onSummary(summary);
        return summary;
    }

    /** Schedule one owned recount for the current animation frame. */
    scheduleRecount() {
        if (this.disposed || this.recountFrame !== null) return;
        const recount = () => {
            this.recountFrame = null;
            this.frameCleanup?.();
            this.frameCleanup = null;
            if (!this.disposed) this.recountStatuses();
        };
        if (typeof this.window?.requestAnimationFrame === "function") {
            this.recountFrame = this.window.requestAnimationFrame(recount);
            this.frameCleanup = this.scope.addCleanup(() => this.window.cancelAnimationFrame?.(this.recountFrame));
            return;
        }
        const timer = setTimeout(recount, 0);
        this.recountFrame = timer;
        this.frameCleanup = this.scope.ownTimeout(timer);
    }

    /** @param {string | null} value */
    readJson(value) {
        if (!value) return {};
        try { return JSON.parse(value); } catch { return {}; }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.frameCleanup?.();
        this.frameCleanup = null;
        this.recountFrame = null;
    }
}
