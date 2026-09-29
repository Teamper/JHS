// @ts-check

import { b, k, u, y } from "../../core/constants.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { isHardHidden } from "./list-filters.js";
import { evaluateListItem, findMatchedTitleKeyword } from "./list-evaluator.js";

export const LIST_CARD_STATE_STYLES = `.jhs-status-tags{position:absolute;z-index:var(--jhs-z-content);top:5px;display:flex;flex-wrap:wrap;gap:4px;max-width:90%}.jhs-status-tags--right{right:0;justify-content:flex-end}.jhs-status-tags--left{left:0}.status-tag{padding:0 5px;border-radius:10px}`;

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
        this.yieldFrame = options.yieldFrame ?? (() => new Promise((resolve) => {
            const view = this.document?.defaultView;
            view?.requestAnimationFrame ? view.requestAnimationFrame(() => setTimeout(resolve)) : setTimeout(resolve);
        }));
    }

    /** Evaluate and present a stable list generation, yielding between card groups to keep input responsive. */
    /** @param {Element[]} items @param {{context: any, filter: unknown, tagPosition?: string, isCurrent: () => boolean}} options */
    async processItems(items, { context, filter, tagPosition = "rightTop", isCurrent }) {
        if (!this.readCardIdentity) throw new Error("List card identity reader is unavailable");
        const visibleItems = [];
        for (let index = 0; index < items.length; index++) {
            if (!isCurrent()) return null;
            if (index > 0 && index % 12 === 0) {
                await this.yieldFrame();
                if (!isCurrent()) return null;
            }
            const item = items[index];
            if (this.hostAdapter?.site === "javbus" && item.querySelector(".avatar-box")) continue;
            const { carNum, title } = this.readCardIdentity(item);
            const evaluation = evaluateListItem({ carNum, title }, context, { filter });
            this.presentCard({ item, carNum, title, evaluation, context, tagPosition });
            if (!evaluation.hardHidden) visibleItems.push(item);
        }
        return visibleItems;
    }

    /**
     * @param {{item: Element, carNum: string, title: string, evaluation: any, context: any, tagPosition?: string}} options
     */
    presentCard({ item, carNum, title, evaluation, context, tagPosition = "rightTop" }) {
        const { flags, visibilityReasons, recent, hardHidden } = evaluation;
        item.setAttribute("data-jhs-flags", JSON.stringify(flags));
        item.setAttribute("data-jhs-visibility", JSON.stringify(visibilityReasons));
        item.setAttribute("data-jhs-recent", recent ? "yes" : "no");
        item.setAttribute("data-jhs-tag-position", tagPosition);

        const signature = JSON.stringify({ flags, visibilityReasons, P: tagPosition });
        if (item.getAttribute("data-jhs-state-signature") !== signature) {
            item.setAttribute("data-jhs-state-signature", signature);
            item.querySelectorAll(".jhs-status-tags").forEach((node) => node.remove());
            this.renderBadges(item, { carNum, title, flags, visibilityReasons, context, tagPosition });
        }
        return hardHidden;
    }

    /** @param {Element} item @param {{carNum: string, title: string, flags: any, visibilityReasons: any, context: any, tagPosition: string}} options */
    renderBadges(item, { carNum, title, flags, visibilityReasons, context, tagPosition }) {
        const definitions = [
            [ "blocked", flags.blocked, "单番号屏蔽" ],
            [ "favorite", flags.favorite ],
            [ "downloaded", flags.downloaded ],
            [ "watched", flags.watched ],
            [ "keyword", visibilityReasons.keyword, findMatchedTitleKeyword(context.titleKeywords, title, carNum) || "未知" ],
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
    }

    /** Collect the same current-page state and debug counters exposed by the 6.5.1 compatibility surface. */
    collectSummary(items = null) {
        const selectors = this.hostAdapter?.getListSelectors?.();
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
