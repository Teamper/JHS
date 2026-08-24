// @ts-check

import { _ } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { calcMagnetScore, getMagnetQualitySignals } from "../../core/magnet-quality.js";

export class HighlightMagnetPlugin extends BasePlugin {
    async handle() {
        if (!window.isDetailPage) return;
        const settings = this.getRuntimeService("settings"), scope = await this.getRuntimeService("scope")();
        scope.addCleanup(jhsEventBus?.on("magnet-items-updated", (() => {
            (settings.snapshot().enableMagnetsFilter ?? _) === _ ? this.doFilterMagnet() : this.showAll();
        })) || (() => {}));
    }
    async initCss() {
        return `<style>.jhs-magnet-score{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;vertical-align:middle;cursor:help}</style>`;
    }
    getName() {
        return "HighlightMagnetPlugin";
    }
    doFilterMagnet() {
        const boundary = this.getRuntimeService("host")?.getDetailResourceBoundary?.();
        if (!boundary) return void this.updateFilterHint(!1);
        const rows = boundary.rows();
        /** @type {any[]} */ const validRows = [];
        let hasMatch = !1;
        rows.forEach(((/** @type {any} */ row) => {
            const titleTarget = boundary.getTitleTarget(row);
            if (!titleTarget) return;
            const target = $(titleTarget), title = target.text().toLowerCase(), signals = this.getQualitySignals(title, boundary.hasSubtitleTag(row));
            $(row).removeClass("high-quality").show().addClass("magnet-row"), title.includes("4k") && target.css("color", "var(--jhs-status-filter-text)"),
            signals.highQuality && (hasMatch = !0, $(row).addClass("high-quality")), this.injectScoreBadge(target, target.text()), validRows.push(row);
        }));
        hasMatch && validRows.forEach((row => $(row).hasClass("high-quality") || $(row).hide())), this.updateFilterHint(hasMatch);
    }
    /** 给磁力行注入评分徽章（幂等：已有则跳过） */
    injectScoreBadge(/** @type {any} */ el, /** @type {string} */ title) {
        try {
            if (el.find(".jhs-magnet-score").length > 0) return;
            const score = calcMagnetScore({ title: title || "", seeders: 0 });
            const total = score.total;
            const label = total >= 70 ? "高" : total >= 40 ? "中" : "低";
            const color = total >= 70 ? "var(--jhs-status-down)" : total >= 40 ? "var(--jhs-status-watch)" : "var(--jhs-surface-2)";
            const onColor = total >= 70 ? "var(--jhs-status-down-on)" : total >= 40 ? "var(--jhs-status-watch-on)" : "var(--jhs-text-muted)";
            const tip = `分辨率:${score.resolution}/25 字幕:${score.subtitle}/20 做种:${score.seeders}/35 新鲜度:${score.freshness}/15`;
            const badge = $(`<span class="jhs-magnet-score" title="${tip}">${label} ${total}</span>`).css({ color: onColor, backgroundColor: color });
            el.append(badge);
        } catch (e) { clog.debug("磁力评分徽章注入失败，已忽略", e); }
    }
    getQualitySignals(/** @type {string} */ title, /** @type {boolean} */ hasSubtitleTag = !1) {
        return getMagnetQualitySignals(title, hasSubtitleTag);
    }
    updateFilterHint(/** @type {boolean} */ hasMatch) {
        $("#enable-magnets-filter").removeClass("do-hide").attr("data-tip", hasMatch ? "仅显示识别到的高质量或字幕磁力" : "未识别到可过滤项，当前未隐藏磁力");
    }
    showAll() {
        $("#enable-magnets-filter").removeClass("do-hide").removeAttr("data-tip");
        this.getRuntimeService("host")?.getDetailResourceBoundary?.()?.rows().forEach(((/** @type {any} */ row) => $(row).show()));
    }
}
