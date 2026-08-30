// @ts-check

import { escapeHtml, normalizeCarNum } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { format115Size, normalize115Keyword, preview115Rename } from "./client.js";

export class OneOneFiveMatchPlugin extends BasePlugin {
    constructor() { super(), this.observer = null, this.unsubscribeItems = null, this.pendingCards = new Set, this.flushTimer = null, this.lifecycleScope = null, this.concurrency = 4, this.cacheMinutes = 60; }
    getName() { return "OneOneFiveMatchPlugin"; }
    async handle() {
        if (!await storageManager.getSetting("enable115Match", !1)) return;
        const hostAdapter = this.getRuntimeService("host"), offline = this.getRuntimeService("offline");
        this.lifecycleScope = await this.getRuntimeService("scope")();
        if (!isDetailPage) {
            await this.setupListMatching(hostAdapter), this.lifecycleScope.ownObserver(this.observer), this.lifecycleScope.addCleanup((() => {
                this.unsubscribeItems?.(), this.unsubscribeItems = null, this.flushTimer && clearTimeout(this.flushTimer), this.flushTimer = null, this.pendingCards.clear();
            }));
            return;
        }
        const carNum = this.getPageInfo().carNum, keyword = normalize115Keyword(carNum); if (!keyword) return;
        const host = $(hostAdapter.locateDetailSlots().summary); host.append('<div class="panel-block jhs-115-match"><strong>115匹配：</strong><span>匹配中</span></div>');
        try {
            const cacheMinutes = Math.max(1, Number(await storageManager.getSetting("oneOneFiveCacheMinutes", 60)) || 60), matches = await offline.searchFiles("one115", keyword, { scope: this.lifecycleScope, ttlMs: cacheMinutes * 6e4 });
            const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>");
            if (!matches.length) return void box.append(document.createTextNode("未匹配 "), $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload())));
            matches.forEach(((/** @type {any} */ match) => { const row = $('<span class="jhs-115-match-row"></span>'), playUrl = offline.getPlayUrl("one115", match); playUrl ? row.append($("<a></a>").addClass("jhs-btn jhs-btn--secondary").attr({ href: playUrl, target: "_blank" }).text(`${match.name} (${format115Size(match.size)})`)) : row.append($("<span></span>").text(`${match.name} (${format115Size(match.size)}) · 不可播放`)); match.fileId && row.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-rename\">重命名</button>").data("match", match)); box.append(row); }));
            box.on("click", ".jhs-115-rename", ((/** @type {MouseEvent} */ event) => this.renameWithPreview(event, $(event.currentTarget).data("match"), carNum)));
        } catch (error) { const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>", document.createTextNode("未登录或请求失败 ")); box.append($("<a></a>").addClass("jhs-btn jhs-btn--ghost").attr({ href: offline.getIntegrationHomeUrl("one115"), target: "_blank" }).text("去登录"), $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload()))); clog.error("115 匹配失败", error); }
    }
    async setupListMatching(/** @type {any} */ hostAdapter) {
        if (!jhsEventBus) throw new Error("JHS EventBus 尚未初始化");
        this.concurrency = Math.max(1, Math.min(10, Number(await storageManager.getSetting("oneOneFiveConcurrency", 4)) || 4)), this.cacheMinutes = Math.max(1, Number(await storageManager.getSetting("oneOneFiveCacheMinutes", 60)) || 60);
        this.observer = new IntersectionObserver((entries => {
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
            const cards = [ ...this.pendingCards ];
            this.pendingCards.clear(), this.flushTimer = null, await mapLimit(cards, this.concurrency, (card => this.matchCard(card)));
        }), 50));
    }
    async matchCard(/** @type {HTMLElement} */ element, /** @type {boolean} */ force = !1) {
        const card = $(element), carNum = normalizeCarNum(card.find(".video-title strong").first().text());
        if (!carNum || "pending" === element.dataset.jhs115State && !force) return;
        try {
            element.dataset.jhs115State = "pending";
            const offline = this.getRuntimeService("offline"), matches = await offline.searchFiles("one115", normalize115Keyword(carNum), { scope: this.lifecycleScope, ttlMs: this.cacheMinutes * 6e4, force });
            card.find(".jhs-115-list-match").remove();
            const badge = $("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-list-match\"></button>").text(matches.length ? `匹配${matches.length}个` : "未匹配").data("matches", matches);
            card.find(".video-title").first().prepend(badge), element.dataset.jhs115State = "matched";
            badge.on("click", (() => { if (!matches.length) return this.matchCard(element, !0); if (1 === matches.length) return window.open(offline.getPlayUrl("one115", matches[0]), "_blank"); const links = matches.map(((/** @type {any} */ match) => `<a href="${escapeHtml(offline.getPlayUrl("one115", match))}" target="_blank">${escapeHtml(match.name)}</a>`)).join("<br>"); this.getRuntimeService("dialog").open({ type: 1, title: `${carNum} 115匹配`, content: `<div class="jhs-dialog-content">${links}</div>`, area: utils.getResponsiveArea([ "560px", "auto" ]) }); }));
        } catch (error) {
            element.dataset.jhs115State = "failed", card.find(".jhs-115-list-match").remove(), card.find(".video-title").first().prepend($('<button type="button" class="jhs-btn jhs-btn--ghost jhs-115-list-match">失败·重试</button>').one("click", (() => this.matchCard(element, !0)))), clog.warn("115 单卡匹配失败", error);
        }
    }
    destroy() {
        this.unsubscribeItems?.(), this.observer?.disconnect(), this.flushTimer && clearTimeout(this.flushTimer), this.pendingCards.clear();
    }
    renameWithPreview(/** @type {Event} */ event, /** @type {any} */ match, /** @type {string} */ carNum) {
        const nextName = preview115Rename(match.name, carNum, { uppercase: !0, keepSuffix: !0 });
        utils.q(event, `确认重命名？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, (async () => { try { await this.getRuntimeService("offline").renameFile("one115", match.fileId, nextName, { scope: this.lifecycleScope }), show.ok("重命名完成"); } catch (error) { clog.error("115 重命名失败", error), show.error("重命名失败：" + (error instanceof Error ? error.message : String(error))); } }));
    }
}
