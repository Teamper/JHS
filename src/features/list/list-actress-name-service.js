// @ts-check

import { requestHostPage } from "../../core/host-page-request.js";

/** Own optional detail-page actress-name lookup used by list state actions. */
export class ListActressNameService {
    /** @param {{scope: any, settings?: any, http?: any, site?: string}} options */
    constructor(options) {
        this.scope = options.scope;
        this.settings = options.settings ?? null;
        this.http = options.http ?? null;
        this.site = options.site ?? "";
        this.disposed = false;
    }

    isEnabled() {
        return this.settings?.snapshot?.().enableSaveActressCarInfo === "yes";
    }

    /** @param {string} url */
    async parse(url) {
        if (this.disposed || !this.http || !url || !this.isEnabled()) return null;
        /** @type {any} */ (globalThis).clog?.debug?.("鉴定补录演员信息-已启用, 开始解析详情页");
        const html = await requestHostPage(this.http, url, this.scope);
        const document = new DOMParser().parseFromString(html, "text/html");
        const names = this.site === "javdb"
            ? [ ...document.querySelectorAll(".female") ].map((element) => element.previousElementSibling?.textContent?.trim() ?? "")
            : [ ...document.querySelectorAll('span[onmouseover*="star_"] a') ].map((element) => element.textContent?.trim() ?? "");
        const result = names.filter(Boolean).join(" ");
        /** @type {any} */ (globalThis).clog?.debug?.("解析到名称:", result);
        return result || null;
    }

    dispose() {
        this.disposed = true;
    }
}
