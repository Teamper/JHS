import { BasePlugin } from "../../core/plugin-manager.js";

export class DetailPagePlugin extends BasePlugin {
    getName() {
        return "DetailPagePlugin";
    }
    constructor() {
        super();
    }
    handle() {
        window.isDetailPage && ($(".video-meta-panel a").each((function() {
            const e = $(this).attr("href");
            if (!e) return;
            try { ["http:", "https:"].includes(new URL(e, window.location.href).protocol) && $(this).attr("target", "_blank"); } catch {}
        })));
    }
}
