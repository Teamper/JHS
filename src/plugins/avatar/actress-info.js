import { BasePlugin } from "../../core/plugin-manager.js";

export class ActressInfoPlugin extends BasePlugin {
    getName() { return "ActressInfoPlugin"; }
    async handle() { if ("yes" === await storageManager.getSetting("enableLoadActressInfo", "yes")) await this.loadActressInfo(); }
    async loadActressInfo() { await Promise.all([this.handleDetailPage(), this.handleStarPage()]); }
    async initCss() {
        return `<style>
            .info-tag { background-color:var(--jhs-status-fav-tint); display:inline-block; height:32px; padding:0 10px; line-height:30px; font-size:12px; color:var(--jhs-status-fav); border:1px solid var(--jhs-status-fav-tint); border-radius:4px; box-sizing:border-box; white-space:nowrap; }
        </style>`;
    }
    async handleDetailPage() {
        if ($(".actress-info").length > 0) return;
        const names = $(".female").prev().map(((index, item) => $(item).text().trim())).get();
        if (!names.length) return;
        const blocks = [];
        for (const name of names) {
            let info = null;
            try { info = await this.searchInfo(name); } catch { clog.error("该名称查询失败,尝试其它名称"); }
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
        $('strong:contains("演員")').parent().after(...blocks);
    }
    async handleStarPage() {
        if ($(".actress-info").length > 0) return;
        const names = [], title = $(".actor-section-name");
        if (title.length) title.text().trim().split(",").forEach((name => names.push(name.trim())));
        const meta = $(".section-meta:not(:contains('影片'))");
        if (meta.length) meta.text().trim().split(",").forEach((name => names.push(name.trim())));
        if (!names.length) return;
        let info = null;
        for (const name of names) {
            try { info = await this.searchInfo(name); } catch { clog.error("该名称查询失败,尝试其它名称"); }
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
        const result = info ? $("<a></a>").addClass("actress-info").attr({ href: info.url, target: "_blank", rel: "noopener noreferrer" }).append(body) : body.addClass("actress-info");
        title.parent().append(result);
    }
    async searchInfo(name) {
        const scope = await this.getRuntimeService("scope")();
        return this.getRuntimeService("actressInfo").lookup(name, { scope });
    }
}
