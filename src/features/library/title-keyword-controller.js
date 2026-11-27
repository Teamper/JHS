// @ts-check

import { escapeHtml } from "../../core/constants.js";

/** Owns title-selection filtering, including title nodes inserted by owned-detail dialogs. */
export class TitleKeywordController {
    /** @param {{document: Document, window: Window, host: {getTitleKeywordSelector: (route: string) => string}, route: string, settings: any, saveKeyword: (keyword: string) => Promise<unknown>, events: any, ui: any, notifications: {ok: (message: string) => unknown, error: (message: string) => unknown}, scope: any, diagnostics?: any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.host = options.host;
        this.route = options.route;
        this.settings = options.settings;
        this.saveKeyword = options.saveKeyword;
        this.events = options.events;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics;
        this.removeTitleListener = null;
    }

    /** @returns {boolean} */
    start() {
        const selector = this.host.getTitleKeywordSelector(this.route);
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
                    `屏蔽标题关键词「${escapeHtml(selectedText)}」？`,
                    () => { void this.addKeyword(selectedText, title); },
                    { confirmText: "屏蔽" },
                );
            } catch (error) {
                this.report(error);
            }
        });
        return true;
    }

    /** @param {string} selectedText @param {Element} title */
    async addKeyword(selectedText, title) {
        try {
            const keyword = selectedText.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 120);
            if (!keyword) return;
            await this.saveKeyword(keyword);
            if (this.scope.disposed) return;
            this.notifications.ok("已添加屏蔽关键词");
            await this.events?.emit?.("filter-rules-changed", { scope: "title-keyword" });
            await this.ui.closePage({ root: this.ui.jquery(title) });
        } catch (error) {
            this.report(error);
            if (error instanceof Error && "code" in error && error.code === "DUPLICATE_TITLE_KEYWORD") this.notifications.error(error.message);
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
