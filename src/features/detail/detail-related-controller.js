// @ts-check

import { RelatedPanel } from "../../ui/detail/related-panel.js";

export const DETAIL_RELATED_CSS = `<style>
    .jhs-related-panel { min-width:0; }
    .jhs-related-list { display:grid; }
    .jhs-related-item { display:grid; gap:var(--jhs-space-2); padding:var(--jhs-space-3) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
    .jhs-related-item:last-child { border-bottom:0; }
    .jhs-related-heading { display:flex; min-width:0; align-items:baseline; gap:var(--jhs-space-2); }
    .jhs-related-index { flex:none; color:var(--jhs-text-faint); font-size:14px; }
    .jhs-related-title { min-width:0; overflow:hidden; color:var(--jhs-accent); font-size:16px; font-weight:600; text-overflow:ellipsis; text-decoration:none; white-space:nowrap; }
    .jhs-related-meta { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2) var(--jhs-space-4); color:var(--jhs-text-muted); font-size:14px; }
    .jhs-related-time { color:var(--jhs-text-faint); font-size:14px; white-space:nowrap; }
</style>`;

/** Own related-list lookup and render the result into the host detail slot. */
export class DetailRelatedController {
    /** @param {{hostAdapter: any, related: any, settings: any, ui?: any, styles?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.related = options.related;
        this.settings = options.settings;
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
        if (this.started || this.disposed || this.hostAdapter?.site !== "javdb") return;
        this.started = true;
        this.styleRelease = this.styles?.register?.("jhs-detail-related", DETAIL_RELATED_CSS.replace(/^\s*<style>|<\/style>\s*$/g, "")) ?? null;
        const movieId = this.hostAdapter.location?.pathname?.split("/").filter(Boolean).pop();
        const target = this.getSlot();
        if (movieId && target) await this.showRelated(target, movieId);
    }

    getSlot() {
        const element = this.hostAdapter.locateDetailSlots?.()?.related;
        const jq = this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$;
        return element && typeof jq === "function" ? jq(element) : null;
    }

    /** @param {any} target @param {string} movieId */
    async showRelated(target, movieId) {
        const panel = new RelatedPanel({ related: this.related, settings: this.settings, scope: () => Promise.resolve(this.scope) });
        return panel.show(target ?? this.getSlot(), movieId, { isActive: () => !this.scope.disposed });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.styleRelease?.();
        this.styleRelease = null;
    }
}
