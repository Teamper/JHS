// @ts-check

import { l, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { ReviewPanel } from "../../ui/detail/review-panel.js";

export class ReviewPlugin extends BasePlugin {
    getName() {
        return "ReviewPlugin";
    }
    async initCss() {
        return `
            <style>
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
    }
    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        if (!window.isDetailPage) return;
        const scope = options.scope ?? await this.getRuntimeService("scope")();
        if (r) {
            const movieId = this.parseMovieId(window.location.href);
            await this.showReview(movieId, this.getHostedSlot("reviews"), { scope });
        }
        if (l) {
            const carNumber = this.getPageInfo().carNum;
            if (!carNumber) return void clog.warn("跳过 JavBus 评论解析：番号不可用");
            try {
                const movieRef = await this.getRuntimeService("movie").resolve({ carNum: carNumber }, { scope });
                movieRef?.movieId && await this.showReview(movieRef.movieId, this.getHostedSlot("reviews"), { scope });
            } catch (error) {
                clog.warn("跳过 JavBus 评论解析：番号解析失败", error);
            }
        }
    }
    getHostedSlot(/** @type {string} */ name) {
        const element = this.getRuntimeService("host").locateDetailSlots()[name];
        return element ? $(element) : $();
    }
    async showReview(/** @type {string} */ movieId, /** @type {any} */ target, /** @type {Record<string, unknown>} */ options = {}) {
        const panel = new ReviewPanel({ review: this.getRuntimeService("review"), settings: this.getRuntimeService("settings"), storage: this.getRuntimeService("storage"), scope: () => options.scope ? Promise.resolve(options.scope) : this.getRuntimeService("scope")() });
        return panel.show(movieId, target?.length ? target : this.getHostedSlot("reviews"), options);
    }
}
