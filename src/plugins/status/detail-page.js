// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";

export class DetailPagePlugin extends BasePlugin {
    getName() {
        return "DetailPagePlugin";
    }
    constructor() {
        super();
    }
    handle() {
        isDetailPage && ($(".video-meta-panel a").each(((/** @type {number} */ _index, /** @type {HTMLAnchorElement} */ element) => {
            const node = $(element), e = node.attr("href");
            if (!e) return;
            try { ["http:", "https:"].includes(new URL(e, window.location.href).protocol) && node.attr("target", "_blank"); } catch {}
        })));
    }
}
