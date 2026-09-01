// @ts-check

import { ReviewPanel } from "../../ui/detail/review-panel.js";

export const DETAIL_REVIEWS_CSS = `<style>
    .jhs-review-panel { min-width:0; }
    .jhs-panel-header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
    .jhs-panel-header h3 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-xl); }
    .jhs-panel-toggle { flex:none; }
    .jhs-review-list { display:grid; }
    .jhs-review-item { min-width:0; padding:var(--jhs-space-4) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
    .jhs-review-item:last-child { border-bottom:0; }
    .jhs-review-meta { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-1) var(--jhs-space-3); color:var(--jhs-text-muted); font-size:14px; }
    .jhs-review-author { color:var(--jhs-text); font-size:15px; font-weight:600; }
    .jhs-review-floor { margin-left:auto; color:var(--jhs-text-faint); }
    .jhs-review-content { margin:var(--jhs-space-3) 0 0; color:var(--jhs-text); font-size:16px; line-height:1.7; overflow-wrap:anywhere; white-space:pre-wrap; }
    .jhs-review-link { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); padding:2px var(--jhs-space-2); border:0; border-radius:var(--jhs-radius-pill); background:var(--jhs-accent-tint); color:var(--jhs-accent); font:inherit; font-size:var(--jhs-font-size-sm); line-height:1.5; text-decoration:none; vertical-align:baseline; cursor:pointer; }
    .jhs-review-link-copy { color:var(--jhs-text-muted); }
    .jhs-review-link-wrap { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-2); width:100%; margin:var(--jhs-space-1) 0; }
    .jhs-review-inline-controls { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); }
    .jhs-review-link-main { display:inline-flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
    .jhs-review-link-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin-left:auto; flex-shrink:0; }
    .jhs-review-offline-btn { background:var(--jhs-accent) !important; color:var(--jhs-accent-text-on) !important; }
    .jhs-panel-state { padding:var(--jhs-space-4) 0; color:var(--jhs-text-muted); text-align:center; }
    .jhs-panel-footer { display:flex; justify-content:center; padding-top:var(--jhs-space-3); }
    .jhs-panel-end { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); }
    @media (max-width:767px) { .jhs-review-floor { width:100%; margin-left:0; } }
</style>`;

/** Own review lookup and render the result into the host detail slot. */
export class DetailReviewsController {
    /** @param {{hostAdapter: any, movie: any, review: any, settings: any, storage: any, ui?: any, styles?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.movie = options.movie;
        this.review = options.review;
        this.settings = options.settings;
        this.storage = options.storage;
        this.ui = options.ui ?? null;
        this.styles = options.styles ?? null;
        this.scope = options.scope;
        this.styleRelease = null;
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    async start() {
        this.scope.assertActive();
        if (this.started || this.disposed || this.hostAdapter?.site !== "javdb" && this.hostAdapter?.site !== "javbus") return;
        this.started = true;
        this.styleRelease = this.styles?.register?.("jhs-detail-reviews", DETAIL_REVIEWS_CSS.replace(/^\s*<style>|<\/style>\s*$/g, "")) ?? null;
        const slot = this.getSlot();
        if (!slot) return;
        if (this.hostAdapter.site === "javdb") {
            const movieId = this.hostAdapter.location?.pathname?.split("/").filter(Boolean).pop();
            if (movieId) await this.showReview(movieId, slot);
            return;
        }
        const carNum = this.hostAdapter.readMovieRef?.()?.carNum;
        if (!carNum) return void this.ui?.getClog?.().warn?.("跳过 JavBus 评论解析：番号不可用");
        try {
            const movieRef = await this.movie.resolve({ carNum }, { scope: this.scope });
            if (movieRef?.movieId) await this.showReview(movieRef.movieId, slot);
        } catch (error) {
            this.ui?.getClog?.().warn?.("跳过 JavBus 评论解析：番号解析失败", error);
        }
    }

    getSlot() {
        const element = this.hostAdapter.locateDetailSlots?.()?.reviews;
        const jq = this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$;
        return element && typeof jq === "function" ? jq(element) : null;
    }

    /** @param {string} movieId @param {any} target */
    async showReview(movieId, target) {
        const panel = new ReviewPanel({ review: this.review, settings: this.settings, storage: this.storage, scope: () => Promise.resolve(this.scope) });
        return panel.show(movieId, target ?? this.getSlot(), { isActive: () => !this.scope.disposed });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.styleRelease?.();
        this.styleRelease = null;
    }
}
