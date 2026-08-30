// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";

export class ActressInfoPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        /** @type {number} */ this._generation = 0;
    }
    getName() { return "ActressInfoPlugin"; }
    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        const settings = this.getRuntimeService("settings"), scope = options.scope ?? await this.getRuntimeService("scope")();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("enableLoadActressInfo")) return;
            if (settings.snapshot().enableLoadActressInfo === "no") this.unmount();
            else void this.mount().catch((error => clog.error("演员信息重新挂载失败", error)));
        };
        settings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => settings.removeEventListener("settings.changed", onSettingsChanged)));
        await this.mount();
    }
    /** ON：立即加载当前详情/演员页。 */
    async mount() {
        if (this.getRuntimeService("settings").snapshot().enableLoadActressInfo === "no") return;
        this._generation++;
        const path = window.location.pathname;
        if (path.startsWith("/v/") || path.startsWith("/movies/")) await this.handleDetailPage();
        else if (path.startsWith("/actors/")) await this.handleStarPage();
    }
    /** OFF：删除 JHS 演员信息 DOM 并使在途查询作废（generation 防回流）。 */
    unmount() {
        this._generation++;
        $(".actress-info").remove();
    }
    /** 在途查询是否仍然有效：generation 未变且设置仍开启。 */
    isStillActive(/** @type {number} */ generation) {
        return generation === this._generation && this.getRuntimeService("settings").snapshot().enableLoadActressInfo !== "no";
    }
    async initCss() {
        return `<style>
            .info-tag { background-color:var(--jhs-status-fav-tint); display:inline-block; height:32px; padding:0 10px; line-height:30px; font-size:12px; color:var(--jhs-status-fav); border:1px solid var(--jhs-status-fav-tint); border-radius:4px; box-sizing:border-box; white-space:nowrap; }
        </style>`;
    }
    async handleDetailPage() {
        if ($(".actress-info").length > 0) return;
        const generation = this._generation;
        const actressLinks = $(".female");
        const names = actressLinks.prev().map(((/** @type {number} */ index, /** @type {Element} */ item) => $(item).text().trim())).get();
        if (!names.length) return;
        /** @type {any[]} */ const blocks = [];
        for (const name of names) {
            let info = null;
            try { info = await this.searchInfo(name); } catch (error) { clog.error("演员资料查询失败", name, error); }
            if (!this.isStillActive(generation)) return;
            const block = $('<div class="panel-block actress-info"></div>');
            if (info) {
                block.append($("<strong></strong>").text(`${name}:`));
                const link = $("<a></a>").attr({ href: info.url, target: "_blank", rel: "noopener noreferrer" }).addClass("jhs-layout-9813a0dd");
                link.append(
                    $("<span></span>").addClass("info-tag").text(`${info.birthday} ${info.age}`.trim()),
                    $("<span></span>").addClass("info-tag").text(`${info.height} ${info.weight}`.trim()),
                    $("<span></span>").addClass("info-tag").text(`${info.threeSizeText} ${info.braSize}`.trim()),
                );
                block.append(link);
            } else {
                const href = this.getRuntimeService("actressInfo").profileUrl(name);
                block.append($("<a></a>").attr({ href, target: "_blank", rel: "noopener noreferrer" }).append($("<strong></strong>").text(`${name}:`)));
            }
            blocks.push(block);
        }
        if (!this.isStillActive(generation)) return;
        const anchor = $("strong").filter(((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => /^(?:演員|演员)\s*:?$/.test($(element).text().trim()))).first().parent();
        const fallback = actressLinks.first().closest(".panel-block");
        anchor.length ? anchor.after(...blocks) : fallback.after(...blocks);
    }
    async handleStarPage() {
        if ($(".actress-info").length > 0) return;
        const generation = this._generation;
        /** @type {string[]} */ const names = [];
        const title = $(".actor-section-name");
        if (title.length) title.text().trim().split(",").forEach(((/** @type {string} */ name) => names.push(name.trim())));
        const meta = $(".section-meta:not(:contains('影片'))");
        if (meta.length) meta.text().trim().split(",").forEach(((/** @type {string} */ name) => names.push(name.trim())));
        if (!names.length) return;
        let info = null;
        for (const name of names) {
            try { info = await this.searchInfo(name); } catch (error) { clog.error("演员资料查询失败", name, error); }
            if (!this.isStillActive(generation)) return;
            if (info) break;
        }
        const body = $('<div class="jhs-layout-c0d4a511"></div>');
        if (!info) body.text("无此相关演员信息");
        else {
            const row1 = $('<div class="jhs-layout-1b3790ef"></div>'), row2 = $('<div class="jhs-layout-1b3790ef"></div>');
            row1.append($("<span></span>").addClass("jhs-layout-dd5a75f6").text(`出生日期: ${info.birthday}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`年龄: ${info.age}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`身高: ${info.height}`));
            row2.append($("<span></span>").addClass("jhs-layout-dd5a75f6").text(`体重: ${info.weight}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`三围: ${info.threeSizeText}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`罩杯: ${info.braSize}`));
            body.append(row1, row2);
        }
        if (!this.isStillActive(generation)) return;
        const result = info ? $("<a></a>").addClass("actress-info").attr({ href: info.url, target: "_blank", rel: "noopener noreferrer" }).append(body) : body.addClass("actress-info");
        title.parent().append(result);
    }
    async searchInfo(/** @type {string} */ name) {
        const scope = await this.getRuntimeService("scope")();
        return this.getRuntimeService("actressInfo").lookup(name, { scope });
    }
}
