// @ts-check

import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { computeLibraryStats } from "./stats-model.js";

/** Escape values using the owning page document without treating input as markup. @param {unknown} value @param {Document} document */
function escapeHtml(value, document) {
    const element = document.createElement("span");
    element.textContent = String(value ?? "");
    return element.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** @typedef {Record<string, any>} StatsRecord */

/** Feature-owned statistics surface; storage and cross-feature actions enter through explicit capabilities. */
export class StatsController {
    /** @param {{document: Document, libraryStats: any, diagnostics: any, notifications: any, movie: any, settings: any, dialog: any, events: any, ui: any, styles: any, scope: any, getPendingNewVideoTotal: () => Promise<number>, getCurrentPageSummary: () => Promise<any>, setQuickFilter: (filter: string) => Promise<unknown>, openNewVideo?: () => Promise<unknown>}} dependencies */
    constructor(dependencies) {
        this.document = dependencies.document;
        this.libraryStats = dependencies.libraryStats;
        this.diagnostics = dependencies.diagnostics;
        this.notifications = dependencies.notifications;
        this.movie = dependencies.movie;
        this.settings = dependencies.settings;
        this.dialog = dependencies.dialog;
        this.events = dependencies.events;
        this.ui = dependencies.ui;
        this.styles = dependencies.styles;
        this.scope = dependencies.scope;
        this.getPendingNewVideoTotal = dependencies.getPendingNewVideoTotal;
        this.getCurrentPageSummary = dependencies.getCurrentPageSummary;
        this.setQuickFilter = dependencies.setQuickFilter;
        this.openNewVideo = dependencies.openNewVideo ?? null;
        this.dialogId = null;
        this.button = null;
    }

    /** @type {Document} */ document;
    /** @type {any} */ libraryStats;
    /** @type {any} */ diagnostics;
    /** @type {any} */ notifications;
    /** @type {any} */ movie;
    /** @type {any} */ settings;
    /** @type {any} */ dialog;
    /** @type {any} */ events;
    /** @type {any} */ ui;
    /** @type {any} */ styles;
    /** @type {any} */ scope;
    /** @type {() => Promise<number>} */ getPendingNewVideoTotal;
    /** @type {() => Promise<any>} */ getCurrentPageSummary;
    /** @type {(filter: string) => Promise<unknown>} */ setQuickFilter;
    /** @type {(() => Promise<unknown>) | null} */ openNewVideo;
    /** @type {number | null} */ dialogId;
    /** @type {HTMLButtonElement | null} */ button;

    start() {
        const css = `
            .jhs-stats { height:100%; padding:var(--jhs-space-4); overflow:auto; }
            .jhs-stats__metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:1px solid var(--jhs-border); border-left:1px solid var(--jhs-border); }
            .jhs-stats__metric { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-4); border:0; border-right:1px solid var(--jhs-border); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface); text-align:left; }
            button.jhs-stats__metric { cursor:pointer; }
            .jhs-stats__metric strong { color:var(--jhs-text); font-size:28px; line-height:1; }
            .jhs-stats__metric span { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
            .jhs-stats__group { margin-top:var(--jhs-space-5); }
            .jhs-stats__group h3 { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
            .jhs-stats__rows { display:grid; gap:var(--jhs-space-2); }
            .jhs-stats__row { display:grid; grid-template-columns:90px minmax(0,1fr) 76px; align-items:center; gap:var(--jhs-space-3); min-height:32px; }
            .jhs-stats__label { overflow:hidden; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-align:right; text-overflow:ellipsis; white-space:nowrap; }
            .jhs-stats__track { height:10px; overflow:hidden; border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); }
            .jhs-stats__bar { display:block; width:var(--jhs-value,0%); height:100%; border-radius:inherit; background:var(--jhs-bar,var(--jhs-accent)); }
            .jhs-stats__value { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
            @media (max-width:767px) { .jhs-stats__metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .jhs-stats__row { grid-template-columns:72px minmax(0,1fr) 58px; gap:var(--jhs-space-2); } }
        `;
        this.scope.addCleanup(this.styles.register("feature-stats-dashboard", css));
        this.mountButton();
        const unsubscribe = this.events?.on?.("jhs-features-ready", () => this.mountButton());
        if (unsubscribe) this.scope.addCleanup(unsubscribe);
    }

    mountButton() {
        if (this.button?.isConnected || this.document.querySelector("#statsBtn")) return;
        const anchor = this.document.querySelector("#newVideoBtn");
        if (!anchor?.parentNode) return;
        const button = this.document.createElement("button");
        button.type = "button";
        button.id = "statsBtn";
        button.className = "jhs-btn jhs-btn--secondary";
        const label = this.document.createElement("span");
        label.textContent = "统计";
        button.append(label);
        anchor.insertAdjacentElement("afterend", button);
        this.button = button;
        this.scope.listen(button, "click", () => { void this.openDialog().catch((error) => this.reportFailure(error)); });
        this.scope.addCleanup(() => { button.remove(); this.button = null; });
    }

    async openDialog() {
        if (this.scope.disposed || this.dialogId !== null) return;
        const diagnostics = this.diagnostics.exportSnapshot();
        const { cars, actresses, blacklist, activity } = await this.libraryStats.loadSnapshot();
        if (this.scope.disposed) return;
        const stats = computeLibraryStats(cars), total = stats.total;
        const actressCounts = new Map();
        cars.forEach((/** @type {StatsRecord} */ car) => {
            const names = String(car.names || "").replace(/([一-鿿])\s+(?=[一-鿿])/g, "$1、").split(/[,，、]+/).map((name) => name.trim()).filter(Boolean);
            if (car.starId) {
                const key = `id:${car.starId}`, current = actressCounts.get(key) || { starId: car.starId, name: names[0] || car.starId, count: 0 };
                current.count++;
                actressCounts.set(key, current);
            } else names.forEach((name) => {
                const key = `name:${name}`, current = actressCounts.get(key) || { starId: "", name, count: 0 };
                current.count++;
                actressCounts.set(key, current);
            });
        });
        const topActresses = [...actressCounts.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)).slice(0, 10);
        const topValue = topActresses[0]?.count || 1;
        const settings = this.settings.snapshot();
        const javDbUrl = this.movie.externalSiteOrigin("javDbBtn", settings);
        const [newVideos, pageSummary] = await Promise.all([
            this.getPendingNewVideoTotal(),
            this.getCurrentPageSummary(),
        ]);
        if (this.scope.disposed) return;
        const metrics = [
            { label: "总记录", value: total, action: null },
            { label: "收藏", value: stats.favoriteRaw, action: null },
            { label: "下载", value: stats.downloadedRaw, action: null },
            { label: "已看", value: stats.watchedRaw, action: null },
            { label: "手动屏蔽", value: stats.blocked, action: null },
            { label: "未鉴定", value: stats.pending, action: null },
            { label: "收藏演员", value: actresses.length, action: null },
            { label: "黑名单演员", value: blacklist.length, action: null },
            { label: "新作品待处理", value: newVideos, action: "new-video" },
            { label: "活跃功能", value: diagnostics.activeFeatures.length, action: null },
            { label: "运行错误", value: diagnostics.errors.length, action: null },
        ];
        /** @type {Array<[string, number, number, string]>} */
        const statusRows = [
            ["收藏", stats.favoriteEffective, stats.unblocked, "var(--jhs-status-fav)"],
            ["下载", stats.downloadedEffective, stats.unblocked, "var(--jhs-status-down)"],
            ["已看", stats.watchedEffective, stats.unblocked, "var(--jhs-status-watch)"],
            ["手动屏蔽", stats.blocked, stats.total, "var(--jhs-status-filter)"],
            ["未鉴定", stats.pending, stats.unblocked, "var(--jhs-border-strong)"],
        ];
        /** @param {string} label @param {number} value @param {number} max @param {string} color @param {string} [href] @param {boolean} [showPercent] */
        const row = (label, value, max, color, href = "", showPercent = false) => `<div class="jhs-stats__row">${href ? `<a class="jhs-stats__label" href="${escapeHtml(href, this.document)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label, this.document)}">${escapeHtml(label, this.document)}</a>` : `<span class="jhs-stats__label" title="${escapeHtml(label, this.document)}">${escapeHtml(label, this.document)}</span>`}<span class="jhs-stats__track"><span class="jhs-stats__bar" data-width="${max ? Math.round(value / max * 100) : 0}" data-color="${color}"></span></span><span class="jhs-stats__value">${value}${showPercent && max ? ` (${Math.round(value / max * 100)}%)` : ""}</span></div>`;
        /** @param {number} days */
        const trend = (days) => {
            const cutoff = Date.now() - days * 864e5, result = { identified: 0, downloaded: 0, watched: 0 };
            activity.entries.filter((/** @type {StatsRecord} */ entry) => entry.commitState === "committed" && Date.parse(entry.createdAt) >= cutoff).forEach((/** @type {StatsRecord} */ entry) => entry.changes.filter((/** @type {StatsRecord} */ change) => change.undoState !== "reverted").forEach((/** @type {StatsRecord} */ change) => {
                const before = normalizeStateFlags(change.before?.stateFlags), after = normalizeStateFlags(change.after?.stateFlags);
                !hasAnyState(before) && hasAnyState(after) && result.identified++;
                !before.downloaded && after.downloaded && result.downloaded++;
                !before.watched && after.watched && result.watched++;
            }));
            return result;
        };
        const trend7 = trend(7), trend30 = trend(30);
        const coverageNote = activity.coverageStart ? `活动记录仅覆盖自 ${escapeHtml(activity.coverageStart, this.document)} 起` : "仅统计 6.4.0 及之后产生的操作记录";
        const renderMetric = (/** @type {StatsRecord} */ metric) => metric.action
            ? `<button type="button" class="jhs-btn jhs-stats__metric" data-action="${metric.action}"><strong>${metric.value}</strong><span>${metric.label}</span></button>`
            : `<div class="jhs-stats__metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`;
        const dialogHtml = `<div class="jhs-stats jhs-scrollbar jhs-ui">
            <section class="jhs-stats__group"><h3>全库概览</h3><div class="jhs-stats__metrics">${metrics.map(renderMetric).join("")}</div></section>
            <section class="jhs-stats__group"><h3>当前页面</h3><div class="jhs-stats__metrics">${renderMetric({ label: "屏蔽项", value: pageSummary.blockedItems, action: "filter" })}</div></section>
            <section class="jhs-stats__group"><h3>状态分布</h3><div class="jhs-stats__rows">${statusRows.map((item) => row(item[0], item[1], item[2], item[3], "", true)).join("")}</div></section>
            <section class="jhs-stats__group"><h3>活动趋势</h3><p class="jhs-helper-text">${coverageNote}</p><div class="jhs-stats__metrics"><div class="jhs-stats__metric"><strong>${trend7.identified}</strong><span>近 7 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend7.downloaded}</strong><span>近 7 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend7.watched}</strong><span>近 7 天标记观看</span></div><div class="jhs-stats__metric"><strong>${trend30.identified}</strong><span>近 30 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend30.downloaded}</strong><span>近 30 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend30.watched}</strong><span>近 30 天标记观看</span></div></div></section>
            ${topActresses.length ? `<section class="jhs-stats__group"><h3>Top 10 演员</h3><div class="jhs-stats__rows">${topActresses.map((item) => row(item.name, item.count, topValue, "var(--jhs-accent)", javDbUrl ? new URL(item.starId ? `/actors/${encodeURIComponent(item.starId)}` : `/search?q=${encodeURIComponent(item.name)}`, javDbUrl).href : "")).join("")}</div></section>` : ""}
        </div>`;
        const dialogId = this.dialog.open({
            type: 1, title: "统计", content: dialogHtml, scrollbar: false,
            ui: { size: "lg", body: "scroll" }, area: this.ui.getDialogArea("lg"), anim: -1,
            success: (/** @type {any} */ layerHandle, /** @type {number} */ layerIndex) => {
                this.dialogId = layerIndex;
                const layerElement = layerHandle?.jquery ? layerHandle[0] : layerHandle;
                layerElement.querySelectorAll(".jhs-stats__bar").forEach((/** @type {Element} */ element) => {
                    const bar = /** @type {HTMLElement} */ (element);
                    bar.style.setProperty("--jhs-value", `${bar.dataset.width || 0}%`);
                    bar.style.setProperty("--jhs-bar", bar.dataset.color || "var(--jhs-accent)");
                });
                layerElement.querySelectorAll("button.jhs-stats__metric[data-action]").forEach((/** @type {HTMLButtonElement} */ element) => element.addEventListener("click", () => {
                    const action = element.getAttribute("data-action");
                    this.dialog.close(layerIndex);
                    this.dialogId = null;
                    if (action === "new-video") return void Promise.resolve(this.openNewVideo?.()).catch((error) => this.reportFailure(error));
                    if (action === "filter") void this.setQuickFilter("blockedItems");
                }));
            },
            end: () => { this.dialogId = null; },
        });
        if (this.dialogId === null && typeof dialogId === "number") this.dialogId = dialogId;
    }

    /** @param {unknown} error */
    reportFailure(error) {
        this.diagnostics.recordError({ source: "stats-feature", featureId: "stats", contributionId: "stats.dashboard", message: error instanceof Error ? error.message : String(error) });
        this.notifications.error("统计面板加载失败");
    }

    dispose() {
        if (this.dialogId !== null) this.dialog.close(this.dialogId);
        this.scope.dispose();
    }
}
