// @ts-check

import { escapeHtml, normalizeCarNum } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { parseBooleanSetting } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { format115Size, normalize115Keyword, preview115Rename } from "./client.js";

export class OneOneFiveMatchPlugin extends BasePlugin {
    constructor() { super(), this.observer = null, this.unsubscribeItems = null, this.pendingCards = new Set, this.flushTimer = null, this.lifecycleScope = null, this.concurrency = 4, this.cacheMinutes = 60; }
    getName() { return "OneOneFiveMatchPlugin"; }
    async handle() {
        this.parentScope = await this.getRuntimeService("scope")();
        const settings = this.getRuntimeService("settings");
        this.parentScope.listen(settings, "settings.changed", (/** @type {any} */ event) => {
            if (event.detail?.names?.some((/** @type {string} */ name) => ["enable115Match", "oneOneFiveConcurrency", "oneOneFiveCacheMinutes"].includes(name))) void this.configureMatching().catch(error => clog.error("115 匹配设置更新失败", error));
        });
        this.parentScope.addCleanup(() => { this.matchGeneration++; this.stopMatching(); });
        await this.configureMatching();
    }
    async configureMatching() {
        const generation = this.matchGeneration = (this.matchGeneration || 0) + 1;
        this.stopMatching();
        const enabled = parseBooleanSetting(this.getRuntimeService("settings").snapshot().enable115Match, false);
        if (!enabled || this.parentScope.disposed || generation !== this.matchGeneration) return;
        const scope = this.lifecycleScope = new LifecycleScope(`115-match:${generation}`);
        this.releaseMatchScope = this.parentScope.addCleanup(() => scope.dispose());
        await this.mountMatching(scope);
    }
    stopMatching() {
        this.releaseMatchScope?.(); this.releaseMatchScope = null;
        this.lifecycleScope?.dispose(); this.lifecycleScope = null;
        this.unsubscribeItems?.(); this.unsubscribeItems = null;
        this.observer?.disconnect(); this.observer = null;
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = null; this.pendingCards.clear();
        $(".jhs-115-match,.jhs-115-list-match").remove();
        $("[data-jhs115-observed],[data-jhs115-state]").removeAttr("data-jhs115-observed data-jhs115-state");
    }
    /** @param {LifecycleScope} scope */
    async mountMatching(scope) {
        const hostAdapter = this.getRuntimeService("host"), offline = this.getRuntimeService("offline");
        if (!isDetailPage) {
            await this.setupListMatching(hostAdapter, scope);
            if (scope.disposed) return;
            scope.ownObserver(this.observer), scope.addCleanup((() => {
                this.unsubscribeItems?.(), this.unsubscribeItems = null, this.flushTimer && clearTimeout(this.flushTimer), this.flushTimer = null, this.pendingCards.clear();
            }));
            return;
        }
        const carNum = this.getPageInfo().carNum, keyword = normalize115Keyword(carNum); if (!keyword) return;
        const host = $(hostAdapter.locateDetailSlots().summary); host.append('<div class="panel-block jhs-115-match"><strong>115匹配：</strong><span>匹配中</span></div>');
        try {
            const cacheMinutes = Math.max(1, Number(this.getRuntimeService("settings").snapshot().oneOneFiveCacheMinutes ?? 60) || 60);
            if (scope.disposed || this.lifecycleScope !== scope) return;
            const matches = await offline.searchFiles("one115", keyword, { scope, ttlMs: cacheMinutes * 6e4 });
            if (scope.disposed || this.lifecycleScope !== scope) return;
            const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>");
            if (!matches.length) return void box.append(document.createTextNode("未匹配 "), $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload())));
            matches.forEach(((/** @type {any} */ match) => { const row = $('<span class="jhs-115-match-row"></span>'), playUrl = offline.getPlayUrl("one115", match); playUrl ? row.append($("<a></a>").addClass("jhs-btn jhs-btn--secondary").attr({ href: playUrl, target: "_blank" }).text(`${match.name} (${format115Size(match.size)})`)) : row.append($("<span></span>").text(`${match.name} (${format115Size(match.size)}) · 不可播放`)); match.fileId && row.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-rename\">重命名</button>").data("match", match)); box.append(row); }));
            box.on("click", ".jhs-115-rename", ((/** @type {MouseEvent} */ event) => this.renameWithPreview(event, $(event.currentTarget).data("match"), carNum)));
        } catch (error) { if (scope.disposed || this.lifecycleScope !== scope) return; const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>", document.createTextNode("未登录或请求失败 ")); box.append($("<a></a>").addClass("jhs-btn jhs-btn--ghost").attr({ href: offline.getIntegrationHomeUrl("one115"), target: "_blank" }).text("去登录"), $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload()))); clog.error("115 匹配失败", error); }
    }
    async setupListMatching(/** @type {any} */ hostAdapter, /** @type {LifecycleScope} */ scope) {
        if (!jhsEventBus) throw new Error("JHS EventBus 尚未初始化");
        this.concurrency = Math.max(1, Math.min(10, Number(this.getRuntimeService("settings").snapshot().oneOneFiveConcurrency ?? 4) || 4)), this.cacheMinutes = Math.max(1, Number(this.getRuntimeService("settings").snapshot().oneOneFiveCacheMinutes ?? 60) || 60);
        if (scope.disposed || this.lifecycleScope !== scope) return;
        this.observer = new IntersectionObserver((entries => {
            if (scope.disposed || this.lifecycleScope !== scope) return;
            entries.forEach((entry => entry.isIntersecting && (this.observer.unobserve(entry.target), this.pendingCards.add(entry.target))));
            this.pendingCards.size && this.scheduleFlush();
        }), { rootMargin: "200px" });
        this.registerCards($(hostAdapter.locateListRoot()).find(".item").get()), this.unsubscribeItems = jhsEventBus.on("list-items-added", ((/** @type {any} */ payload) => this.registerCards(payload.items || [])));
    }
    registerCards(/** @type {HTMLElement[]} */ cards) {
        cards.forEach((card => { "true" !== card.dataset.jhs115Observed && "matched" !== card.dataset.jhs115State && (card.dataset.jhs115Observed = "true", this.observer?.observe(card)); }));
    }
    scheduleFlush() {
        this.flushTimer || (this.flushTimer = setTimeout((async () => {
            const cards = [ ...this.pendingCards ], scope = this.lifecycleScope;
            this.pendingCards.clear(), this.flushTimer = null, await mapLimit(cards, this.concurrency, (card => scope && !scope.disposed && this.lifecycleScope === scope ? this.matchCard(card) : undefined));
        }), 50));
    }
    async matchCard(/** @type {HTMLElement} */ element, /** @type {boolean} */ force = !1) {
        const scope = this.lifecycleScope;
        if (!scope || scope.disposed) return;
        const card = $(element), carNum = normalizeCarNum(card.find(".video-title strong").first().text());
        if (!carNum || "pending" === element.dataset.jhs115State) return;
        try {
            element.dataset.jhs115State = "pending";
            const offline = this.getRuntimeService("offline"), matches = await offline.searchFiles("one115", normalize115Keyword(carNum), { scope, ttlMs: this.cacheMinutes * 6e4, force });
            if (scope.disposed || this.lifecycleScope !== scope || !element.isConnected) return;
            card.find(".jhs-115-list-match").remove();
            const badge = $("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-list-match\"></button>").text(matches.length ? `匹配${matches.length}个` : "未匹配").data("matches", matches);
            card.find(".video-title").first().prepend(badge), element.dataset.jhs115State = "matched";
            badge.on("click", ((/** @type {MouseEvent} */ event) => { event.preventDefault(); event.stopPropagation(); if (scope.disposed) return; if (!matches.length) return this.matchCard(element, !0); if (1 === matches.length) return window.open(offline.getPlayUrl("one115", matches[0]), "_blank"); const links = matches.map(((/** @type {any} */ match) => `<a href="${escapeHtml(offline.getPlayUrl("one115", match))}" target="_blank">${escapeHtml(match.name)}</a>`)).join("<br>"); this.getRuntimeService("dialog").open({ type: 1, title: `${carNum} 115匹配`, content: `<div class="jhs-dialog-content">${links}</div>`, area: utils.getResponsiveArea([ "560px", "auto" ]) }); }));
        } catch (error) {
            if (scope.disposed || this.lifecycleScope !== scope || !element.isConnected) return;
            element.dataset.jhs115State = "failed", card.find(".jhs-115-list-match").remove(), card.find(".video-title").first().prepend($('<button type="button" class="jhs-btn jhs-btn--ghost jhs-115-list-match">失败·重试</button>').on("click", ((/** @type {MouseEvent} */ event) => { event.preventDefault(); event.stopPropagation(); if (!scope.disposed) void this.matchCard(element, !0); }))), clog.warn("115 单卡匹配失败", error);
        }
    }
    destroy() {
        this.matchGeneration = (this.matchGeneration || 0) + 1; this.stopMatching();
    }
    renameWithPreview(/** @type {Event} */ event, /** @type {any} */ match, /** @type {string} */ carNum) {
        const nextName = preview115Rename(match.name, carNum, { uppercase: !0, keepSuffix: !0 });
        utils.q(event, `确认重命名？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, (async () => { try { await this.getRuntimeService("offline").renameFile("one115", match.fileId, nextName, { scope: this.lifecycleScope }), show.ok("重命名完成"); } catch (error) { clog.error("115 重命名失败", error), show.error("重命名失败：" + (error instanceof Error ? error.message : String(error))); } }));
    }
}
