// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { StatsRepository, computeLibraryStats } from "./stats-repository.js";

/**
 * Own the statistics surface and its page-lifetime UI.
 */
export class StatsController {
    /** @param {{diagnostics: any, dialog: any, movie: any, storage: any, state: any, ui: any, features: any, scope: any, route?: string}} options */
    constructor(options) {
        this.diagnostics = options.diagnostics;
        this.dialog = options.dialog;
        this.movie = options.movie;
        this.storage = options.storage;
        this.features = options.features;
        this.ui = options.ui;
        this.scope = options.scope;
        this.route = options.route ?? "unknown";
        this.statsRepository = new StatsRepository({ storage: this.storage, state: options.state });
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        if (this.route === "list") this.createBtn();
        return Promise.resolve();
    }

    getApi() {
        return Object.freeze({
            hasDashboard: true,
            openDialog: (/** @type {any[]} */ ...args) => this.openDialog(...args),
        });
    }

    createBtn() {
        if (typeof document === "undefined" || document.querySelector("#statsBtn")) return;
        const anchor = document.querySelector("#newVideoBtn");
        if (!anchor) return;
        const button = document.createElement("button");
        button.type = "button";
        button.id = "statsBtn";
        button.className = "jhs-btn jhs-btn--secondary";
        const label = document.createElement("span");
        label.textContent = "统计";
        button.append(label);
        const open = () => void this.openDialog();
        button.addEventListener("click", open);
        anchor.insertAdjacentElement("afterend", button);
        this.scope.addCleanup?.(() => { button.removeEventListener("click", open); button.remove(); });
    }

    /** @param {string} featureId */
    async getFeatureApi(featureId) {
        try { return await this.features?.getFeatureApi?.(featureId); }
        catch (error) { this.ui?.getClog?.().warn?.(`统计 Feature API 不可用: ${featureId}`, error); return null; }
    }

    getDialogArea() {
        return this.ui?.getDialogArea?.("lg") ?? ["1040px", "760px"];
    }

    /** Open the statistics dialog for the current page. */
    async openDialog(/** @type {any[]} */ ..._args) {
        const diagnostics = this.diagnostics.exportSnapshot();
        const { cars, actresses, blacklist, activity } = await this.statsRepository.loadLibrarySnapshot();
        const stats = computeLibraryStats(cars), total = stats.total;
        const actressCounts = new Map();
        cars.forEach((car) => {
            const names = String(car.names || "").replace(/([一-鿿])\s+(?=[一-鿿])/g, "$1、").split(/[,，、]+/).map((name) => name.trim()).filter(Boolean);
            if (car.starId) {
                const key = `id:${car.starId}`, current = actressCounts.get(key) || { starId: car.starId, name: names[0] || car.starId, count: 0 };
                current.count++, actressCounts.set(key, current);
            } else names.forEach((name) => {
                const key = `name:${name}`, current = actressCounts.get(key) || { starId: "", name, count: 0 };
                current.count++, actressCounts.set(key, current);
            });
        });
        const settings = await this.storage.get?.("setting") ?? {};
        const topActresses = [...actressCounts.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)).slice(0, 10);
        const topValue = topActresses[0]?.count || 1;
        const javDbUrl = this.movie.externalSiteOrigin("javDbBtn", settings);
        const counter = await this.getFeatureApi("discovery");
        const listFeature = await this.getFeatureApi("list");
        const newVideos = counter?.hasNewVideo ? await counter.getPendingNewVideoTotal?.() : 0;
        const pageSummary = await listFeature?.getCurrentPageSummary?.() || { blockedItems: 0 };
        const metrics = [
            { label: "总记录", value: total, action: null }, { label: "收藏", value: stats.favoriteRaw, action: null },
            { label: "下载", value: stats.downloadedRaw, action: null }, { label: "已看", value: stats.watchedRaw, action: null },
            { label: "手动屏蔽", value: stats.blocked, action: null }, { label: "未鉴定", value: stats.pending, action: null },
            { label: "收藏演员", value: actresses.length, action: null }, { label: "黑名单演员", value: blacklist.length, action: null },
            { label: "新作品待处理", value: newVideos, action: "new-video" }, { label: "活跃功能", value: diagnostics.activeFeatures.length, action: null },
            { label: "运行错误", value: diagnostics.errors.length, action: null },
        ];
        /** @type {Array<[string, number, number, string]>} */
        const statusRows = [
            ["收藏", stats.favoriteEffective, stats.unblocked, "var(--jhs-status-fav)"], ["下载", stats.downloadedEffective, stats.unblocked, "var(--jhs-status-down)"],
            ["已看", stats.watchedEffective, stats.unblocked, "var(--jhs-status-watch)"], ["手动屏蔽", stats.blocked, stats.total, "var(--jhs-status-filter)"],
            ["未鉴定", stats.pending, stats.unblocked, "var(--jhs-border-strong)"],
        ];
        /** @param {string} label @param {number} value @param {number} max @param {string} color @param {string} [href] @param {boolean} [showPercent] */
        const row = (label, value, max, color, href = "", showPercent = false) => `<div class="jhs-stats__row">${href ? `<a class="jhs-stats__label" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}">${escapeHtml(label)}</a>` : `<span class="jhs-stats__label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`}<span class="jhs-stats__track"><span class="jhs-stats__bar" data-width="${max ? Math.round(value / max * 100) : 0}" data-color="${color}"></span></span><span class="jhs-stats__value">${value}${showPercent && max ? ` (${Math.round(value / max * 100)}%)` : ""}</span></div>`;
        /** @param {number} days */
        const trend = (days) => {
            const cutoff = Date.now() - days * 864e5, result = { identified: 0, downloaded: 0, watched: 0 };
            activity.entries.filter((/** @type {any} */ entry) => entry.commitState === "committed" && Date.parse(entry.createdAt) >= cutoff).forEach((/** @type {any} */ entry) => entry.changes.filter((/** @type {any} */ change) => change.undoState !== "reverted").forEach((/** @type {any} */ change) => {
                const before = normalizeStateFlags(change.before?.stateFlags), after = normalizeStateFlags(change.after?.stateFlags);
                !hasAnyState(before) && hasAnyState(after) && result.identified++;
                !before.downloaded && after.downloaded && result.downloaded++;
                !before.watched && after.watched && result.watched++;
            }));
            return result;
        };
        const trend7 = trend(7), trend30 = trend(30);
        const coverageNote = activity.coverageStart ? `活动记录仅覆盖自 ${escapeHtml(String(activity.coverageStart))} 起` : "仅统计 6.4.0 及之后产生的操作记录";
        /** @param {any} metric */
        const renderMetric = (metric) => metric.action
            ? `<button type="button" class="jhs-btn jhs-stats__metric" data-action="${metric.action}"${metric.filter ? ` data-filter="${metric.filter}"` : ""}><strong>${metric.value}</strong><span>${escapeHtml(metric.label)}</span></button>`
            : `<div class="jhs-stats__metric"><strong>${metric.value}</strong><span>${escapeHtml(metric.label)}</span></div>`;
        const dialogHtml = `<div class="jhs-stats jhs-scrollbar jhs-ui">
            <section class="jhs-stats__group"><h3>全库概览</h3><div class="jhs-stats__metrics">${metrics.map(renderMetric).join("")}</div></section>
            <section class="jhs-stats__group"><h3>当前页面</h3><div class="jhs-stats__metrics">${renderMetric({ label: "屏蔽项", value: pageSummary.blockedItems, action: "filter", filter: "blockedItems" })}</div></section>
            <section class="jhs-stats__group"><h3>状态分布</h3><div class="jhs-stats__rows">${statusRows.map((item) => row(item[0], item[1], item[2], item[3], "", true)).join("")}</div></section>
            <section class="jhs-stats__group"><h3>活动趋势</h3><p class="jhs-helper-text">${coverageNote}</p><div class="jhs-stats__metrics"><div class="jhs-stats__metric"><strong>${trend7.identified}</strong><span>近 7 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend7.downloaded}</strong><span>近 7 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend7.watched}</strong><span>近 7 天标记观看</span></div><div class="jhs-stats__metric"><strong>${trend30.identified}</strong><span>近 30 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend30.downloaded}</strong><span>近 30 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend30.watched}</strong><span>近 30 天标记观看</span></div></div></section>
            ${topActresses.length ? `<section class="jhs-stats__group"><h3>Top 10 演员</h3><div class="jhs-stats__rows">${topActresses.map((item) => row(item.name, item.count, topValue, "var(--jhs-accent)", javDbUrl ? new URL(item.starId ? `/actors/${encodeURIComponent(item.starId)}` : `/search?q=${encodeURIComponent(item.name)}`, javDbUrl).href : "")).join("")}</div></section>` : ""}
        </div>`;
        this.dialog.open({ type: 1, title: "统计", content: dialogHtml, scrollbar: false, area: this.getDialogArea(), anim: -1, success: (/** @type {any} */ layerElement, /** @type {number} */ layerIndex) => {
            const root = typeof layerElement?.querySelectorAll === "function" ? layerElement : layerElement?.[0];
            if (!root) return;
            root.querySelectorAll(".jhs-stats__bar").forEach((/** @type {HTMLElement} */ element) => {
                element.style.setProperty("--jhs-value", `${element.dataset.width}%`);
                element.style.setProperty("--jhs-bar", element.dataset.color || "");
            });
            root.querySelectorAll("button.jhs-stats__metric[data-action]").forEach((/** @type {HTMLButtonElement} */ button) => button.addEventListener("click", () => {
                const action = button.dataset.action;
                this.dialog.close(layerIndex);
                if (action === "new-video") return counter?.openNewVideoDialog?.();
                if (action === "filter") return listFeature?.setQuickFilter?.(button.dataset.filter);
            }));
            this.ui?.setupEscClose?.(layerIndex);
        } });
    }

    dispose() {
        this.started = false;
    }
}
