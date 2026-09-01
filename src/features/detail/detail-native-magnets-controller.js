// @ts-check

import { _ } from "../../core/constants.js";
import { calcMagnetScore, getMagnetQualitySignals } from "../../core/magnet-quality.js";

export class DetailNativeMagnetsController {
    /** @param {{hostAdapter?: any, settings?: any, eventBus?: any, ui?: any, styles?: any, scope?: any}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.settings = options.settings ?? null;
        this.eventBus = options.eventBus ?? null;
        this.ui = options.ui ?? null;
        this.styles = options.styles ?? null;
        this.scope = options.scope ?? null;
        this.styleRelease = null;
        this._settingsListenerBound = false;
        /** @type {Record<string, any> | null} */ this.runtimeServices = null;
    }
    /** @param {string} name */
    getRuntimeService(name) { return this.runtimeServices?.[name] ?? null; }
    getJQuery() { return this.ui?.getJQuery?.() ?? this.getRuntimeService("ui")?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getClog() { return this.ui?.getClog?.() ?? this.getRuntimeService("ui")?.getClog?.() ?? {}; }
    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        const settings = this.settings ?? this.getRuntimeService("settings"), scope = options.scope ?? this.scope ?? await this.getRuntimeService("scope")?.();
        if (!settings || !scope) return;
        this.scope = scope;
        if (!this._settingsListenerBound) {
            this._settingsListenerBound = true;
            const onSettingsChanged = (/** @type {any} */ event) => {
                const names = /** @type {string[] | undefined} */ (event.detail?.names);
                if (!names?.includes("enableMagnetsFilter")) return;
                this.reconfigure();
            };
            settings.addEventListener("settings.changed", onSettingsChanged);
            scope.addCleanup((() => {
                settings.removeEventListener("settings.changed", onSettingsChanged);
                this._settingsListenerBound = false;
                this.showAll();
            }));
        }
        scope.addCleanup(this.eventBus?.on?.("magnet-items-updated", (() => this.reconfigure())) || (() => {}));
        this.reconfigure();
        if (!this.styleRelease) {
            const css = this.initCss().replace(/^\s*<style(?:\s[^>]*)?>/i, "").replace(/<\/style>\s*$/i, "");
            this.styleRelease = this.styles?.register?.("jhs-detail-native-magnets", css) ?? null;
        }
    }
    /** 唯一 reconfigure：settings.changed 与 magnet-items-updated 共用；同时同步本地按钮文案/aria。 */
    reconfigure() {
        const enabled = ((this.settings ?? this.getRuntimeService("settings"))?.snapshot?.().enableMagnetsFilter ?? _) === _;
        const $ = this.getJQuery();
        enabled ? this.doFilterMagnet() : this.showAll();
        $("#magnets-span").text(enabled ? "关闭磁力过滤" : "开启磁力过滤");
        $("#enable-magnets-filter").attr("aria-pressed", String(enabled));
    }
    initCss() {
        return `<style>.jhs-magnet-score{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;vertical-align:middle;cursor:help}</style>`;
    }
    doFilterMagnet() {
        const $ = this.getJQuery();
        const boundary = this.hostAdapter?.getDetailResourceBoundary?.() ?? this.getRuntimeService("host")?.getDetailResourceBoundary?.();
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
            const badge = this.getJQuery()(`<span class="jhs-magnet-score" title="${tip}">${label} ${total}</span>`).css({ color: onColor, backgroundColor: color });
            el.append(badge);
        } catch (e) { this.getClog().debug?.("磁力评分徽章注入失败，已忽略", e); }
    }
    getQualitySignals(/** @type {string} */ title, /** @type {boolean} */ hasSubtitleTag = !1) {
        return getMagnetQualitySignals(title, hasSubtitleTag);
    }
    updateFilterHint(/** @type {boolean} */ hasMatch) {
        this.getJQuery()("#enable-magnets-filter").removeClass("do-hide").attr("data-tip", hasMatch ? "仅显示识别到的高质量或字幕磁力" : "未识别到可过滤项，当前未隐藏磁力");
    }
    showAll() {
        this.getJQuery()("#enable-magnets-filter").removeClass("do-hide").removeAttr("data-tip");
        const boundary = this.hostAdapter?.getDetailResourceBoundary?.() ?? this.getRuntimeService("host")?.getDetailResourceBoundary?.();
        boundary?.rows().forEach(((/** @type {any} */ row) => {
            $(row).removeClass("high-quality").show();
            const title = boundary.getTitleTarget(row);
            title && $(title).css("color", "").find(".jhs-magnet-score").remove();
        }));
    }
    dispose() {
        if (!this.scope) return;
        this.showAll();
        this.styleRelease?.();
        this.styleRelease = null;
        this.scope = null;
    }
}

/** Compatibility export for retained settings and tests. */
export const HighlightMagnetPlugin = DetailNativeMagnetsController;
