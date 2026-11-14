// @ts-check

import { b, k, u, y } from "../../core/constants.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { isHardHidden } from "./list-filters.js";
import { evaluateListItem, findMatchedTitleKeyword } from "./list-evaluator.js";
import { OwnedPopover } from "../../core/owned-popover.js";

export const LIST_CARD_STATE_STYLES = `.jhs-status-tags{position:absolute;z-index:var(--jhs-z-content);top:5px;display:flex;flex-wrap:wrap;gap:4px;max-width:90%}.jhs-status-tags--right{right:0;justify-content:flex-end}.jhs-status-tags--left{left:0}.status-tag{padding:0 5px;border-radius:10px}.jhs-card-reason{position:absolute;bottom:var(--jhs-space-2);right:var(--jhs-space-2);z-index:var(--jhs-z-content);min-height:var(--jhs-touch-target)}.jhs-card-reason-owner{position:relative}.jhs-card-reasons{padding:var(--jhs-space-3);gap:var(--jhs-space-2);overflow:auto}.jhs-card-reasons p{margin:0;overflow-wrap:anywhere}`;

const BADGES = Object.freeze({
    blocked: { text: u, color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)", tip: "单番号屏蔽" },
    favorite: { text: b, color: "var(--jhs-status-fav)", on: "var(--jhs-status-fav-on)", tip: "" },
    downloaded: { text: y, color: "var(--jhs-status-down)", on: "var(--jhs-status-down-on)", tip: "" },
    watched: { text: k, color: "var(--jhs-status-watch)", on: "var(--jhs-status-watch-on)", tip: "" },
    keyword: { text: "关键词屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
    actorBlacklist: { text: "男演员屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
    actressBlacklist: { text: "女演员屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
});

/** Own list-card state attributes, status badges, and the current-page state summary. */
export class ListCardStatePresenter {
    /** @param {{hostAdapter: any, document?: Document, readCardIdentity?: (item: Element) => any, yieldFrame?: () => Promise<void>}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.document ?? options.hostAdapter?.document ?? globalThis.document;
        this.readCardIdentity = options.readCardIdentity ?? null;
        /** @type {Map<Element, any>} */ this.summaryItems = new Map();
        /** @type {any} */ this.summary = null;
        /** @type {OwnedPopover | null} */ this.reasonPopover = null;
        this.yieldFrame = options.yieldFrame ?? (() => new Promise((resolve) => {
            const view = this.document?.defaultView;
            const scheduler = /** @type {any} */ (view)?.scheduler;
            if (scheduler?.yield) void scheduler.yield().then(resolve); else setTimeout(resolve);
        }));
    }

    /** Evaluate and present a stable list generation, yielding between card groups to keep input responsive. */
    /** @param {Element[]} items @param {{context: any, filter: unknown, tagPosition?: string, isCurrent: () => boolean}} options */
    async processItems(items, { context, filter, tagPosition = "rightTop", isCurrent }) {
        if (!this.readCardIdentity) throw new Error("List card identity reader is unavailable");
        const visibleItems = [];
        let deadline = performance.now() + 4;
        for (let index = 0; index < items.length; index++) {
            if (!isCurrent()) return null;
            if (index > 0 && (index % 12 === 0 || performance.now() >= deadline)) {
                await this.yieldFrame();
                if (!isCurrent()) return null;
                deadline = performance.now() + 4;
            }
            const item = items[index];
            if (this.hostAdapter?.site === "javbus" && item.querySelector(".avatar-box")) continue;
            const record = this.readCardIdentity(item), { carNum, title } = record;
            const evaluation = evaluateListItem(record, context, { filter });
            this.presentCard({ item, carNum, title, evaluation, context, tagPosition });
            if (!evaluation.hardHidden) visibleItems.push(item);
        }
        return visibleItems;
    }

    /**
     * @param {{item: Element, carNum: string, title: string, evaluation: any, context: any, tagPosition?: string}} options
     */
    presentCard({ item, carNum, title, evaluation, context, tagPosition = "rightTop" }) {
        const { flags, visibilityReasons, matchedKeyword = "", recent, hardHidden } = evaluation;
        item.setAttribute("data-jhs-flags", JSON.stringify(flags));
        item.setAttribute("data-jhs-visibility", JSON.stringify(visibilityReasons));
        item.setAttribute("data-jhs-recent", recent ? "yes" : "no");
        item.setAttribute("data-jhs-tag-position", tagPosition);

        const signature = JSON.stringify({ flags, visibilityReasons, P: tagPosition, keyword: visibilityReasons.keyword ? (matchedKeyword || findMatchedTitleKeyword(context.titleKeywords, title, carNum)) : "", actors: context.actorCarNumToNameMap?.get(carNum), actresses: context.actressCarNumToNameMap?.get(carNum) });
        if (item.getAttribute("data-jhs-state-signature") !== signature) {
            item.setAttribute("data-jhs-state-signature", signature);
            if (this.reasonPopover && item.contains(this.reasonPopover.anchor)) this.reasonPopover.close();
            item.querySelectorAll(".jhs-status-tags,.jhs-card-reason").forEach((node) => node.remove());
            this.renderBadges(item, { carNum, title, flags, visibilityReasons, matchedKeyword, context, tagPosition });
        }
        this.updateSummary(item);
        return hardHidden;
    }

    /** @param {Element} item @param {{carNum: string, title: string, flags: any, visibilityReasons: any, matchedKeyword?: string | null, context: any, tagPosition: string}} options */
    renderBadges(item, { carNum, title, flags, visibilityReasons, matchedKeyword, context, tagPosition }) {
        const definitions = [
            [ "blocked", flags.blocked, "单番号屏蔽" ],
            [ "favorite", flags.favorite ],
            [ "downloaded", flags.downloaded ],
            [ "watched", flags.watched ],
            [ "keyword", visibilityReasons.keyword, matchedKeyword || findMatchedTitleKeyword(context.titleKeywords, title, carNum) || "未知" ],
            [ "actorBlacklist", visibilityReasons.actorBlacklist, context.actorCarNumToNameMap.get(carNum) || "" ],
            [ "actressBlacklist", visibilityReasons.actressBlacklist, context.actressCarNumToNameMap.get(carNum) || "" ],
        ].filter(([, enabled]) => enabled);
        if (!definitions.length) return;

        const box = this.document.createElement("span");
        box.className = `jhs-status-tags ${tagPosition === "rightTop" ? "jhs-status-tags--right" : "jhs-status-tags--left"}`;
        const isJavDb = this.hostAdapter?.site === "javdb";
        for (const [key, , tip = ""] of definitions) {
            const definition = BADGES[/** @type {keyof typeof BADGES} */ (key)];
            const badge = this.document.createElement("span");
            badge.className = `jhs-badge ${isJavDb ? "jhs-badge--success" : "jhs-badge--neutral"} status-tag`;
            badge.dataset.tip = tip;
            badge.title = "";
            badge.textContent = definition.text;
            badge.style.color = definition.on;
            badge.style.backgroundColor = definition.color;
            box.append(badge);
        }

        if (isJavDb) item.querySelector(".tags")?.append(box);
        else if (this.hostAdapter?.site === "javbus") {
            const target = item.querySelector(".item-tag") ?? item.querySelector(".photo-info > span > div");
            target?.append(box);
        }
        const reasons = definitions.filter(([key]) => ["keyword", "actorBlacklist", "actressBlacklist"].includes(String(key)));
        if (reasons.length) {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary jhs-card-reason";
            button.textContent = "屏蔽原因";
            button.setAttribute("aria-label", `${carNum} 的屏蔽原因`);
            button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", "false");
            const owner = item.matches("a") ? item.parentElement : item;
            owner?.classList.add("jhs-card-reason-owner"); owner?.append(button);
            button.addEventListener("click", (/** @type {MouseEvent} */ event) => {
                event.preventDefault(); event.stopPropagation();
                const current = this.reasonPopover;
                if (current && current.anchor === button && current.opened) return current.close(true);
                this.reasonPopover?.close();
                const panel = this.document.createElement("div"), title = this.document.createElement("strong"), close = this.document.createElement("button");
                panel.className = "jhs-card-reasons"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", `${carNum} 的屏蔽原因`);
                title.textContent = "规则屏蔽原因"; panel.append(title);
                for (const [key, , tip] of reasons) {
                    const line = this.document.createElement("p");
                    line.textContent = `${BADGES[/** @type {keyof typeof BADGES} */ (String(key))].text}：${tip || "未知"}`; panel.append(line);
                }
                close.type = "button"; close.className = "jhs-btn jhs-btn--secondary"; close.textContent = "关闭"; panel.append(close);
                this.document.body.append(panel);
                const popover = new OwnedPopover(button, panel, { onClose: () => { panel.remove(); if (this.reasonPopover === popover) this.reasonPopover = null; } });
                this.reasonPopover = popover; close.addEventListener("click", () => popover.close(true)); popover.open(close);
            });
        }
    }

    dispose() { this.reasonPopover?.close(); this.reasonPopover = null; this.resetSummary(); }

    /** @param {Element} item */
    updateSummary(item) {
        const next = this.collectSummary([item]), previous = this.summaryItems.get(item);
        this.summary ??= this.collectSummary([]);
        this.adjustSummary(next, 1);
        if (previous) this.adjustSummary(previous, -1);
        this.summaryItems.set(item, next);
    }
    /** @param {any} value @param {number} direction */
    adjustSummary(value, direction) {
        for (const key of Object.keys(value)) {
            if (key === "debug") for (const name of Object.keys(value.debug)) this.summary.debug[name] += direction * value.debug[name];
            else this.summary[key] += direction * value[key];
        }
    }
    removeDetachedSummaries() {
        for (const [item, value] of this.summaryItems) if (!item.isConnected) {
            this.adjustSummary(value, -1);
            this.summaryItems.delete(item);
        }
    }
    resetSummary() { this.summaryItems.clear(); this.summary = null; }
    getSummary() { return this.summary ? { ...this.summary, debug: { ...this.summary.debug } } : this.collectSummary(); }

    /** Collect the same current-page state and debug counters exposed by the 6.5.1 compatibility surface. */
    /** @param {Iterable<Element> | null} [items] */
    collectSummary(items = null) {
        const selectors = items === null ? (this.hostAdapter?.getLiveListSelectors?.() ?? this.hostAdapter?.getListSelectors?.()) : null;
        const cards = items ?? (selectors?.itemSelector && this.document ? this.document.querySelectorAll(selectors.itemSelector) : []);
        const summary = { total: 0, pending: 0, blockedItems: 0, favorite: 0, downloaded: 0, watched: 0, debug: { manualBlocked: 0, keywordBlocked: 0, actorBlocked: 0, actressBlocked: 0 } };
        for (const item of cards) {
            if (this.hostAdapter?.site === "javbus" && item.querySelector(".avatar-box")) continue;
            const flags = normalizeStateFlags(this.readJson(item.getAttribute("data-jhs-flags"), {}));
            const reasons = this.readJson(item.getAttribute("data-jhs-visibility"), {});
            const hardHidden = isHardHidden(flags, reasons);
            summary.total++;
            if (flags.favorite) summary.favorite++;
            if (flags.downloaded) summary.downloaded++;
            if (flags.watched) summary.watched++;
            if (hardHidden) summary.blockedItems++;
            if (!hasAnyState(flags) && !hardHidden) summary.pending++;
            if (flags.blocked) summary.debug.manualBlocked++;
            if (reasons.keyword) summary.debug.keywordBlocked++;
            if (reasons.actorBlacklist) summary.debug.actorBlocked++;
            if (reasons.actressBlacklist) summary.debug.actressBlocked++;
        }
        return summary;
    }

    /** @param {string | null} raw @param {any} fallback */
    readJson(raw, fallback) {
        try { return JSON.parse(raw || ""); } catch { return fallback; }
    }
}
