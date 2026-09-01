// @ts-check

import { r } from "../../core/constants.js";
import { RelatedPanel } from "../../ui/detail/related-panel.js";

export class RelatedPlugin {
    /** @param {{host?: any, related?: any, settings?: any, scope?: any, ui?: any}} [options] */
    constructor(options = {}) {
        this.host = options.host ?? null;
        this.related = options.related ?? null;
        this.settings = options.settings ?? null;
        this.scope = options.scope ?? null;
        this.ui = options.ui ?? null;
    }
    getName() {
        return "RelatedPlugin";
    }
    async initCss() {
        return `
            <style>
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
    }
    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        if (!window.isDetailPage || !r) return;
        const movieId = new URL(window.location.href).pathname.split("/").filter(Boolean).pop();
        if (movieId) await this.showRelated(this.getHostedSlot("related"), movieId, { scope: options.scope ?? await this.getLifecycleScope() });
    }
    getHostedSlot(/** @type {string} */ name) {
        const element = this.host?.locateDetailSlots?.()[name];
        const jq = this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$;
        return element ? jq(element) : jq();
    }
    async showRelated(/** @type {any} */ target, /** @type {string} */ movieId, /** @type {Record<string, unknown>} */ options = {}) {
        const panel = new RelatedPanel({ related: this.related, settings: this.settings, scope: () => options.scope ? Promise.resolve(options.scope) : this.getLifecycleScope() });
        return panel.show(target?.length ? target : this.getHostedSlot("related"), movieId, options);
    }
    async getLifecycleScope() {
        const scope = this.scope;
        return typeof scope === "function" ? await scope() : scope;
    }
}
