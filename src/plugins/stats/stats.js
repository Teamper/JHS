// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { StatsRepository, computeLibraryStats } from "../../features/stats/stats-repository.js";

/** @typedef {Record<string, any>} StatsRecord */

export class StatsPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        /** @type {StatsRepository | null} */
        this.statsRepository = null;
    }
    getStatsRepository() { return this.statsRepository ||= new StatsRepository({ storage: storageManager, state: this.getRuntimeService("state") }); }
    getName() { return "StatsPlugin"; }
    /** Resolve the list capability used by the current-page stats action. */
    async getListFeatureApi() {
        try {
            return await this.getRuntimeService("features").getFeatureApi("list");
        } catch (error) {
            clog.warn("列表 Feature API 不可用，跳过当前页统计", error);
            return null;
        }
    }
    async initCss() {
        return `
            <style>
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
            </style>`;
    }
    async handle() { window.isListPage && this.createBtn(); }
    createBtn() {
        const e = '<button type="button" id="statsBtn" class="jhs-btn jhs-btn--secondary"><span>统计</span></button>';
        $("#newVideoBtn").after(e), $("#statsBtn").on("click", (() => this.openDialog()));
    }
    async openDialog() {
        const diagnostics = this.getRuntimeService("diagnostics").exportSnapshot();
        const { cars, actresses, blacklist, activity } = await this.getStatsRepository().loadLibrarySnapshot();
        const stats = computeLibraryStats(cars), total = stats.total;
        const actressCounts = new Map;
        cars.forEach(((/** @type {StatsRecord} */ car) => {
            const names = String(car.names || "").replace(/([一-鿿])\s+(?=[一-鿿])/g, "$1、").split(/[,，、]+/).map((name => name.trim())).filter(Boolean);
            if (car.starId) {
                const key = `id:${car.starId}`, current = actressCounts.get(key) || { starId: car.starId, name: names[0] || car.starId, count: 0 };
                current.count++, actressCounts.set(key, current);
            } else names.forEach((name => { const key = `name:${name}`, current = actressCounts.get(key) || { starId: "", name, count: 0 }; current.count++, actressCounts.set(key, current); }));
        }));
        const topActresses = [ ...actressCounts.values() ].sort(((left, right) => right.count - left.count || left.name.localeCompare(right.name))).slice(0, 10), topValue = topActresses[0]?.count || 1, javDbUrl = this.getRuntimeService("movie").externalSiteOrigin("javDbBtn", await storageManager.getSetting());
        const pending = stats.pending, counter = this.getOptionalDependency("NewVideoPlugin"), listFeature = await this.getListFeatureApi(), newVideos = counter ? await counter.getPendingNewVideoTotal() : 0, pageSummary = await listFeature?.getCurrentPageSummary?.() || { blockedItems: 0 };
        const metrics = [
            { label: "总记录", value: total, action: null },
            { label: "收藏", value: stats.favoriteRaw, action: null },
            { label: "下载", value: stats.downloadedRaw, action: null },
            { label: "已看", value: stats.watchedRaw, action: null },
            { label: "手动屏蔽", value: stats.blocked, action: null },
            { label: "未鉴定", value: pending, action: null },
            { label: "收藏演员", value: actresses.length, action: null },
            { label: "黑名单演员", value: blacklist.length, action: null },
            { label: "新作品待处理", value: newVideos, action: "new-video" }
            , { label: "活跃功能", value: diagnostics.activeFeatures.length, action: null }
            , { label: "运行错误", value: diagnostics.errors.length, action: null }
        ];
        /** @type {Array<[string, number, number, string]>} 状态分布：只统计未屏蔽记录，分母为未屏蔽总数。 */
        const statusRows = [
            [ "收藏", stats.favoriteEffective, stats.unblocked, "var(--jhs-status-fav)" ],
            [ "下载", stats.downloadedEffective, stats.unblocked, "var(--jhs-status-down)" ],
            [ "已看", stats.watchedEffective, stats.unblocked, "var(--jhs-status-watch)" ],
            [ "手动屏蔽", stats.blocked, stats.total, "var(--jhs-status-filter)" ],
            [ "未鉴定", stats.pending, stats.unblocked, "var(--jhs-border-strong)" ],
        ];
        const row = (/** @type {string} */ label, /** @type {number} */ value, /** @type {number} */ max, /** @type {string} */ color, /** @type {string} */ href = "", /** @type {boolean} */ showPercent = false) => `<div class="jhs-stats__row">${href ? `<a class="jhs-stats__label" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}">${escapeHtml(label)}</a>` : `<span class="jhs-stats__label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`}<span class="jhs-stats__track"><span class="jhs-stats__bar" data-width="${max ? Math.round(value / max * 100) : 0}" data-color="${color}"></span></span><span class="jhs-stats__value">${value}${showPercent && max ? ` (${Math.round(value / max * 100)}%)` : ""}</span></div>`;
        const trend = (/** @type {number} */ days) => { const cutoff = Date.now() - days * 864e5, result = { identified: 0, downloaded: 0, watched: 0 }; activity.entries.filter(((/** @type {StatsRecord} */ entry) => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)).forEach(((/** @type {StatsRecord} */ entry) => entry.changes.filter(((/** @type {StatsRecord} */ change) => "reverted" !== change.undoState)).forEach(((/** @type {StatsRecord} */ change) => { const before = normalizeStateFlags(change.before?.stateFlags), after = normalizeStateFlags(change.after?.stateFlags); !hasAnyState(before) && hasAnyState(after) && result.identified++, !before.downloaded && after.downloaded && result.downloaded++, !before.watched && after.watched && result.watched++; })))); return result; }, trend7 = trend(7), trend30 = trend(30);
        const coverageNote = activity.coverageStart ? `活动记录仅覆盖自 ${escapeHtml(activity.coverageStart)} 起` : "仅统计 6.4.0 及之后产生的操作记录";
        const renderMetric = (/** @type {StatsRecord} */ metric) => metric.action
            ? `<button type="button" class="jhs-btn jhs-stats__metric" data-action="${metric.action}"${metric.filter ? ` data-filter="${metric.filter}"` : ""}><strong>${metric.value}</strong><span>${metric.label}</span></button>`
            : `<div class="jhs-stats__metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`;
        const dialogHtml = `<div class="jhs-stats jhs-scrollbar jhs-ui">
            <section class="jhs-stats__group"><h3>全库概览</h3><div class="jhs-stats__metrics">${metrics.map(renderMetric).join("")}</div></section>
            <section class="jhs-stats__group"><h3>当前页面</h3><div class="jhs-stats__metrics">${renderMetric({ label: "屏蔽项", value: pageSummary.blockedItems, action: "filter", filter: "blockedItems" })}</div></section>
            <section class="jhs-stats__group"><h3>状态分布</h3><div class="jhs-stats__rows">${statusRows.map((item => row(item[0], item[1], item[2], item[3], "", true))).join("")}</div></section>
            <section class="jhs-stats__group"><h3>活动趋势</h3><p class="jhs-helper-text">${coverageNote}</p><div class="jhs-stats__metrics"><div class="jhs-stats__metric"><strong>${trend7.identified}</strong><span>近 7 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend7.downloaded}</strong><span>近 7 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend7.watched}</strong><span>近 7 天标记观看</span></div><div class="jhs-stats__metric"><strong>${trend30.identified}</strong><span>近 30 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend30.downloaded}</strong><span>近 30 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend30.watched}</strong><span>近 30 天标记观看</span></div></div></section>
            ${topActresses.length ? `<section class="jhs-stats__group"><h3>Top 10 演员</h3><div class="jhs-stats__rows">${topActresses.map((item => row(item.name, item.count, topValue, "var(--jhs-accent)", new URL(item.starId ? `/actors/${encodeURIComponent(item.starId)}` : `/search?q=${encodeURIComponent(item.name)}`, javDbUrl).href))).join("")}</div></section>` : ""}
        </div>`;
        const dialog = this.getRuntimeService("dialog");
        dialog.open({ type: 1, title: "统计", content: dialogHtml, scrollbar: !1, area: utils.getDialogArea("lg"), anim: -1, success: (/** @type {Element} */ layerElement, /** @type {number} */ layerIndex) => {
            $(layerElement).find(".jhs-stats__bar").each(((/** @type {number} */ _index, /** @type {Element} */ element) => { $(element).css({ "--jhs-value": `${$(element).data("width")}%`, "--jhs-bar": $(element).data("color") }); }));
            $(layerElement).find("button.jhs-stats__metric[data-action]").on("click", ((/** @type {MouseEvent} */ event) => {
                const metric = $(event.currentTarget), action = metric.data("action");
                dialog.close(layerIndex);
                if ("new-video" === action) return counter?.openDialog?.();
                if ("filter" === action) listFeature?.setQuickFilter?.(metric.data("filter"));
            }));
            utils.setupEscClose(layerIndex);
        } });
    }
}
