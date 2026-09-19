// @ts-check

import { r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { RelatedPanel } from "../../ui/detail/related-panel.js";

export class RelatedPlugin extends BasePlugin {
    getName() {
        return "RelatedPlugin";
    }
    async handle() {
        if (!window.isDetailPage || !r) return;
        const movieId = new URL(window.location.href).pathname.split("/").filter(Boolean).pop();
        if (movieId) await this.showRelated(this.getHostedSlot("related"), movieId);
    }
    getHostedSlot(/** @type {string} */ name) {
        const element = this.getRuntimeService("host").locateDetailSlots()[name];
        return element ? $(element) : $();
    }
    async showRelated(/** @type {any} */ target, /** @type {string} */ movieId, /** @type {Record<string, unknown>} */ options = {}) {
        const panel = new RelatedPanel({ related: this.getRuntimeService("related"), settings: this.getRuntimeService("settings"), scope: () => this.getRuntimeService("scope")() });
        return panel.show(target?.length ? target : this.getHostedSlot("related"), movieId, options);
    }
}
