// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";

export class SubTitleCatPlugin extends BasePlugin {
    getName() {
        return "SubTitleCatPlugin";
    }
    handle(/** @type {{scope?: any}} */ _options = {}) {
        $(".t-banner-inner").hide(), $("#navbar").hide();
        let e = (new URLSearchParams(window.location.search).get("search") || "").toLowerCase(), t = $(".sub-table tr td a").toArray(), n = 0;
        t.forEach(((/** @type {Element} */ t) => {
            let a = $(t);
            a.text().toLowerCase().includes(e) ? n++ : a.parent().parent().hide();
        })), 0 === n && show.error("该番号无字幕!");
        const a = $(".sec-title"), i = String(a.html() || "").replace(/^\d+/, String(n));
        a.html(i);
    }
}
