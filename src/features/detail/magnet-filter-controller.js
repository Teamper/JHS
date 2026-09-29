// @ts-check

import { _ } from "../../core/constants.js";
import { calcMagnetScore, getMagnetQualitySignals } from "../../core/magnet-quality.js";

export const DETAIL_MAGNET_FILTER_STYLES = `
    .jhs-magnet-score{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;vertical-align:middle;cursor:help}
    .jhs-magnet-filter-hidden{display:none!important}
`;

/** Owns native detail magnet filtering while exposing a narrow adapter to legacy UI surfaces. */
export class MagnetFilterController {
    /** @param {{document: Document, hostAdapter: any, settings: any, events: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.hostAdapter = options.hostAdapter;
        this.settings = options.settings;
        this.events = options.events;
        this.scope = options.scope;
        this.started = false;
        this.touchedRows = new Set();
        this.titleStyles = new WeakMap();
        this.compatibilityAdapter = Object.freeze({
            reconfigure: () => this.reconfigure(),
            doFilterMagnet: () => this.doFilterMagnet(),
            showAll: () => this.showAll(),
        });
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.hostAdapter.site !== "javdb" && this.hostAdapter.site !== "javbus") return false;
        this.started = true;
        this.scope.listen(this.settings, "settings.changed", (/** @type {Event} */ rawEvent) => {
            const event = /** @type {CustomEvent<{names?: string[]}>} */ (rawEvent);
            if (event.detail?.names?.includes("enableMagnetsFilter")) this.reconfigure();
        });
        this.scope.addCleanup(this.events.on("magnet-items-updated", () => this.reconfigure()));
        this.scope.addCleanup(() => this.stop());
        this.reconfigure();
        return true;
    }

    reconfigure() {
        if (this.scope.disposed) return;
        const enabled = this.settings.snapshot().enableMagnetsFilter ?? _;
        if (enabled === _) this.doFilterMagnet();
        else this.showAll();
        const button = this.document.querySelector("#enable-magnets-filter"), label = this.document.querySelector("#magnets-span");
        if (label) label.textContent = enabled === _ ? "关闭磁力过滤" : "开启磁力过滤";
        button?.setAttribute("aria-pressed", String(enabled === _));
    }

    doFilterMagnet() {
        const boundary = this.hostAdapter.getDetailResourceBoundary?.();
        if (!boundary) return this.updateFilterHint(false);
        const rows = boundary.rows();
        /** @type {Element[]} */ const validRows = [];
        let hasMatch = false;
        for (const row of rows) {
            const titleTarget = boundary.getTitleTarget(row);
            if (!titleTarget) continue;
            this.touchedRows.add(row);
            if (!this.titleStyles.has(titleTarget)) this.titleStyles.set(titleTarget, {
                color: titleTarget.style.getPropertyValue("color"),
                priority: titleTarget.style.getPropertyPriority("color"),
            });
            const title = titleTarget.textContent?.toLowerCase() ?? "";
            const signals = getMagnetQualitySignals(title, boundary.hasSubtitleTag(row));
            row.classList.remove("high-quality", "jhs-magnet-filter-hidden");
            row.classList.add("magnet-row");
            if (title.includes("4k")) titleTarget.style.setProperty("color", "var(--jhs-status-filter-text)");
            if (signals.highQuality) {
                hasMatch = true;
                row.classList.add("high-quality");
            }
            this.injectScoreBadge(titleTarget, titleTarget.textContent ?? "");
            validRows.push(row);
        }
        if (hasMatch) for (const row of validRows) if (!row.classList.contains("high-quality")) row.classList.add("jhs-magnet-filter-hidden");
        this.updateFilterHint(hasMatch);
    }

    /** Adds a text-only quality badge to one host title. */
    /** @param {Element} target @param {string} title */
    injectScoreBadge(target, title) {
        if (target.querySelector(".jhs-magnet-score")) return;
        const score = calcMagnetScore({ title: title || "", seeders: 0 });
        const label = score.total >= 70 ? "高" : score.total >= 40 ? "中" : "低";
        const badge = this.document.createElement("span");
        badge.className = "jhs-magnet-score";
        badge.title = `分辨率:${score.resolution}/25 字幕:${score.subtitle}/20 做种:${score.seeders}/35 新鲜度:${score.freshness}/15`;
        badge.style.color = score.total >= 70 ? "var(--jhs-status-down-on)" : score.total >= 40 ? "var(--jhs-status-watch-on)" : "var(--jhs-text-muted)";
        badge.style.backgroundColor = score.total >= 70 ? "var(--jhs-status-down)" : score.total >= 40 ? "var(--jhs-status-watch)" : "var(--jhs-surface-2)";
        badge.textContent = `${label} ${score.total}`;
        target.append(badge);
    }

    /** @param {boolean} hasMatch */
    updateFilterHint(hasMatch) {
        const button = this.document.querySelector("#enable-magnets-filter");
        if (!button) return;
        button.classList.remove("do-hide");
        if (hasMatch) button.setAttribute("data-tip", "仅显示识别到的高质量或字幕磁力");
        else button.setAttribute("data-tip", "未识别到可过滤项，当前未隐藏磁力");
    }

    showAll() {
        const boundary = this.hostAdapter.getDetailResourceBoundary?.();
        for (const row of new Set([...this.touchedRows, ...(boundary?.rows() ?? [])])) {
            row.classList.remove("high-quality", "jhs-magnet-filter-hidden");
            const titleTarget = boundary?.getTitleTarget(row) ?? row.querySelector(".name, td:first-child a:first-child");
            if (!titleTarget) continue;
            titleTarget.querySelector(".jhs-magnet-score")?.remove();
            const previous = this.titleStyles.get(titleTarget);
            if (previous?.color) titleTarget.style.setProperty("color", previous.color, previous.priority);
            else titleTarget.style.removeProperty("color");
            this.titleStyles.delete(titleTarget);
        }
        this.touchedRows.clear();
        const button = this.document.querySelector("#enable-magnets-filter");
        button?.classList.remove("do-hide");
        button?.removeAttribute("data-tip");
    }

    stop() {
        this.showAll();
    }
}
