// @ts-check

import { escapeHtml } from "../../core/constants.js";

/** Owns title-selection filtering, including title nodes inserted by owned-detail dialogs. */
export class TitleKeywordController {
    /** @param {{document: Document, window: Window, site: string, route: string, settings: any, keywords: any, events: any, ui: any, scope: any, diagnostics?: any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.site = options.site;
        this.route = options.route;
        this.settings = options.settings;
        this.keywords = options.keywords;
        this.events = options.events;
        this.ui = options.ui;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics;
        this.removeTitleListener = null;
    }

    /** @returns {boolean} */
    start() {
        const selector = this.getSelector();
        if (!selector) return false;
        this.removeTitleListener = this.scope.listen(this.document, "contextmenu", (/** @type {MouseEvent} */ event) => {
            const value = this.settings.snapshot().enableTitleSelectFilter;
            if ((value == null ? "yes" : value) !== "yes") return;
            const target = event.target;
            if (!target || typeof /** @type {any} */ (target).closest !== "function") return;
            const title = /** @type {Element} */ (target).closest(selector);
            if (!title) return;
            const selectedText = this.window.getSelection()?.toString() || "";
            if (!selectedText) return;
            event.preventDefault();
            try {
                this.ui.confirm(
                    { clientX: event.clientX, clientY: event.clientY + 80 },
                    `是否屏蔽标题关键词 ${escapeHtml(selectedText)}?`,
                    () => { void this.addKeyword(selectedText, title); },
                );
            } catch (error) {
                this.report(error);
            }
        });
        return true;
    }

    /** @returns {string | null} */
    getSelector() {
        if (this.site === "javdb") return this.route === "detail" ? ".title strong, .current-title" : ".current-title";
        if (this.site === "javbus" && this.route === "detail") return "h3";
        return null;
    }

    /** @param {string} selectedText @param {Element} title */
    async addKeyword(selectedText, title) {
        try {
            const keyword = selectedText.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 120);
            if (keyword) await this.keywords.add(keyword);
            await this.events?.emit?.("filter-rules-changed", { scope: "title-keyword" });
            await this.ui.closePage({ root: this.ui.jquery(title) });
        } catch (error) {
            this.report(error);
        }
    }

    /** @param {unknown} error */
    report(error) {
        this.diagnostics?.recordError?.({ source: "title-keyword-feature", featureId: "library", contributionId: "library.keyword-filter", message: error instanceof Error ? error.message : String(error) });
    }

    dispose() {
        this.removeTitleListener?.();
        this.removeTitleListener = null;
    }
}
