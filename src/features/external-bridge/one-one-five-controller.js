// @ts-check

import { escapeHtml, firstValidCarNum, normalizeCarNum } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { format115Size, normalize115Keyword, preview115Rename } from "./one-one-five-helpers.js";

/** Own 115 matching UI, incremental list work, and scoped cleanup. */
export class OneOneFiveMatchController {
    /** @param {{document?: Document, window?: any, route?: string, hostAdapter: any, offline: any, dialog: any, settings: any, eventBus: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.route = options.route ?? "unknown";
        this.hostAdapter = options.hostAdapter;
        this.offline = options.offline;
        this.dialog = options.dialog;
        this.settings = options.settings;
        this.eventBus = options.eventBus;
        this.scope = options.scope;
        this.observer = null;
        this.observerCleanup = null;
        this.unsubscribeItems = null;
        this.pendingCards = new Set;
        this.flushTimer = null;
        this.concurrency = 4;
        this.cacheMinutes = 60;
        this.started = false;
        this.disposed = false;
    }

    getJQuery() { return /** @type {any} */ (globalThis).$ ?? this.window?.jQuery; }
    getClog() { return /** @type {any} */ (globalThis).clog ?? {}; }
    getShow() { return /** @type {any} */ (globalThis).show ?? {}; }
    getUtils() { return /** @type {any} */ (globalThis).utils ?? {}; }

    /** @param {string} key @param {unknown} fallback */
    getSetting(key, fallback) {
        const value = this.settings?.snapshot?.()[key];
        return value === undefined ? fallback : value;
    }

    /** Start 115 matching for an enabled list or detail contribution. */
    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        this.scope.addCleanup(() => this.dispose());
        return Promise.resolve().then(async () => {
            if (!this.getSetting("enable115Match", false) || ![ "list", "detail" ].includes(this.route)) return;
            if (this.route === "list") await this.setupListMatching();
            else await this.setupDetailMatching();
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    async setupDetailMatching() {
        const carNum = this.readDetailCarNum(), keyword = carNum ? normalize115Keyword(carNum) : null;
        if (!carNum || !keyword) return;
        const $ = this.getJQuery(), summary = this.hostAdapter?.locateDetailSlots?.().summary;
        if (!$ || !summary) return;
        const box = $('<div class="panel-block jhs-115-match"><strong>115匹配：</strong><span>匹配中</span></div>');
        $(summary).append(box);
        this.scope.addCleanup(() => box.remove());
        try {
            const cacheMinutes = Math.max(1, Number(this.getSetting("oneOneFiveCacheMinutes", 60)) || 60);
            const matches = await this.offline.searchFiles("one115", keyword, { scope: this.scope, ttlMs: cacheMinutes * 6e4 });
            if (this.disposed || this.scope.disposed) return;
            box.empty().append("<strong>115匹配：</strong>");
            if (!matches.length) return void box.append(this.document.createTextNode("未匹配 "), $("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost\">重试</button>").on("click", () => this.window.location.reload()));
            matches.forEach((/** @type {any} */ match) => {
                const row = $('<span class="jhs-115-match-row"></span>'), playUrl = this.offline.getPlayUrl("one115", match);
                playUrl ? row.append($("<a></a>").addClass("jhs-btn jhs-btn--secondary").attr({ href: playUrl, target: "_blank", rel: "noopener noreferrer" }).text(`${match.name} (${format115Size(match.size)})`)) : row.append($("<span></span>").text(`${match.name} (${format115Size(match.size)}) · 不可播放`));
                match.fileId && row.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-rename\">重命名</button>").data("match", match));
                box.append(row);
            });
            box.on("click", ".jhs-115-rename", (/** @type {MouseEvent} */ event) => this.renameWithPreview(event, $(event.currentTarget).data("match"), carNum));
        } catch (error) {
            const boxContent = box.empty().append("<strong>115匹配：</strong>").append(this.document.createTextNode("未登录或请求失败 "));
            boxContent.append($("<a></a>").addClass("jhs-btn jhs-btn--ghost").attr({ href: this.offline.getIntegrationHomeUrl("one115"), target: "_blank", rel: "noopener noreferrer" }).text("去登录"), $("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost\">重试</button>").on("click", () => this.window.location.reload()));
            this.getClog().error?.("115 匹配失败", error);
        }
    }

    readDetailCarNum() {
        const hostCarNum = this.hostAdapter?.readMovieRef?.()?.carNum;
        if (hostCarNum) return normalizeCarNum(hostCarNum);
        if (this.hostAdapter?.site === "javbus") {
            const last = this.window.location.pathname.split("/").filter(Boolean).pop()?.replace(/_\d{4}-\d{2}-\d{2}$/, "");
            return firstValidCarNum(last);
        }
        try {
            const params = new URL(this.window.location.href).searchParams;
            const injected = params.get("jhsCarNum");
            const copy = this.document.querySelector('.column-video-info a[data-clipboard-text][title*="番"], .video-detail a[data-clipboard-text][title*="番"], a[title="複製番號"]')?.getAttribute("data-clipboard-text");
            let panel = null;
            for (const element of this.document.querySelectorAll(".column-video-info .panel-block, .video-detail .panel-block")) {
                const label = element.querySelector("strong, .label")?.textContent?.trim() ?? "";
                if (panel || !/(?:番号|番號|^ID)\s*[:：]?/i.test(label)) continue;
                panel = element.querySelector("[data-clipboard-text]")?.getAttribute("data-clipboard-text") || element.querySelector(".value")?.textContent;
            }
            return firstValidCarNum(injected, copy, panel, this.document.querySelector("#video_id, .video-id, .video-title strong")?.textContent);
        } catch { return null; }
    }

    async setupListMatching() {
        if (!this.eventBus?.on) throw new Error("JHS EventBus 尚未初始化");
        const root = this.hostAdapter?.locateListRoot?.(), Observer = this.window?.IntersectionObserver ?? globalThis.IntersectionObserver;
        if (!root || typeof Observer !== "function") return;
        this.concurrency = Math.max(1, Math.min(10, Number(this.getSetting("oneOneFiveConcurrency", 4)) || 4));
        this.cacheMinutes = Math.max(1, Number(this.getSetting("oneOneFiveCacheMinutes", 60)) || 60);
        this.observer = new Observer((/** @type {IntersectionObserverEntry[]} */ entries) => {
            entries.forEach((/** @type {IntersectionObserverEntry} */ entry) => entry.isIntersecting && (this.observer.unobserve(entry.target), this.pendingCards.add(entry.target)));
            this.pendingCards.size && this.scheduleFlush();
        }, { rootMargin: "200px" });
        this.observerCleanup = this.scope.ownObserver(this.observer);
        this.registerCards([ ...root.querySelectorAll(".item") ]);
        this.unsubscribeItems = this.eventBus.on("list-items-added", (/** @type {any} */ payload) => this.registerCards(payload.items || []));
    }

    /** @param {HTMLElement[]} cards */
    registerCards(cards) {
        cards.forEach((card) => { if ("true" !== card.dataset.jhs115Observed && "matched" !== card.dataset.jhs115State) card.dataset.jhs115Observed = "true", this.observer?.observe(card); });
    }

    scheduleFlush() {
        if (this.flushTimer !== null) return;
        this.flushTimer = this.window.setTimeout(async () => {
            const cards = [ ...this.pendingCards ];
            this.pendingCards.clear();
            this.flushTimer = null;
            await mapLimit(cards, this.concurrency, (/** @type {HTMLElement} */ card) => this.matchCard(card));
        }, 50);
    }

    async matchCard(/** @type {HTMLElement} */ element, /** @type {boolean} */ force = false) {
        if (this.disposed || this.scope.disposed) return;
        const $ = this.getJQuery(), card = $(element), carNum = normalizeCarNum(card.find(".video-title strong").first().text());
        if (!carNum || "pending" === element.dataset.jhs115State && !force) return;
        try {
            element.dataset.jhs115State = "pending";
            const matches = await this.offline.searchFiles("one115", normalize115Keyword(carNum), { scope: this.scope, ttlMs: this.cacheMinutes * 6e4, force });
            if (this.disposed || this.scope.disposed) return;
            card.find(".jhs-115-list-match").remove();
            const badge = $("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-list-match\"></button>").text(matches.length ? `匹配${matches.length}个` : "未匹配").data("matches", matches);
            card.find(".video-title").first().prepend(badge);
            element.dataset.jhs115State = "matched";
            badge.on("click", () => {
                if (!matches.length) return this.matchCard(element, true);
                if (matches.length === 1) return this.window.open(this.offline.getPlayUrl("one115", matches[0]), "_blank");
                const links = matches.map((/** @type {any} */ match) => `<a href="${escapeHtml(this.offline.getPlayUrl("one115", match) || "")}" target="_blank" rel="noopener noreferrer">${escapeHtml(match.name)}</a>`).join("<br>");
                this.dialog.open({ type: 1, title: `${carNum} 115匹配`, content: `<div class="jhs-dialog-content">${links}</div>`, area: this.getUtils().getResponsiveArea?.([ "560px", "auto" ]) });
            });
        } catch (error) {
            element.dataset.jhs115State = "failed";
            card.find(".jhs-115-list-match").remove();
            card.find(".video-title").first().prepend($('<button type="button" class="jhs-btn jhs-btn--ghost jhs-115-list-match">失败·重试</button>').one("click", () => this.matchCard(element, true)));
            this.getClog().warn?.("115 单卡匹配失败", error);
        }
    }

    /** @param {Event} event @param {any} match @param {string} carNum */
    renameWithPreview(event, match, carNum) {
        const nextName = preview115Rename(match.name, carNum, { uppercase: true, keepSuffix: true });
        this.getUtils().q?.(event, `确认重命名？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, async () => {
            try {
                await this.offline.renameFile("one115", match.fileId, nextName, { scope: this.scope });
                this.getShow().ok?.("重命名完成");
            } catch (error) {
                this.getClog().error?.("115 重命名失败", error);
                this.getShow().error?.("重命名失败：" + (error instanceof Error ? error.message : String(error)));
            }
        });
    }

    dispose() {
        if (this.unsubscribeItems) this.unsubscribeItems(), this.unsubscribeItems = null;
        if (this.flushTimer !== null) this.window.clearTimeout(this.flushTimer), this.flushTimer = null;
        this.pendingCards.clear();
        this.observerCleanup?.();
        this.observerCleanup = null;
        this.observer?.disconnect();
        this.observer = null;
        this.getJQuery()?.(this.document).find?.(".jhs-115-match, .jhs-115-list-match").remove?.();
        this.disposed = true;
        this.started = false;
    }
}
