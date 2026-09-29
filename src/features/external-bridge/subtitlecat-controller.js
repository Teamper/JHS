// @ts-check

export class SubtitleCatController {
    /** @param {{document?: Document, window?: Window, scope: import("../../core/lifecycle-scope.js").LifecycleScope, notifications: {error: (message: string) => unknown}}} options */
    constructor({ document: doc = document, window: win = window, scope, notifications }) {
        this.document = doc;
        this.window = win;
        this.scope = scope;
        this.notifications = notifications;
    }

    start() {
        this.scope.assertActive();
        const search = (new URLSearchParams(this.window.location.search).get("search") || "").toLowerCase();
        const banner = this.document.querySelector(".t-banner-inner");
        const navbar = this.document.querySelector("#navbar");
        banner && this.setDisplay(/** @type {HTMLElement} */ (banner), "none");
        navbar && this.setDisplay(/** @type {HTMLElement} */ (navbar), "none");

        const links = [...this.document.querySelectorAll(".sub-table tr td a")];
        let matches = 0;
        for (const link of links) {
            if ((link.textContent || "").toLowerCase().includes(search)) {
                matches += 1;
                continue;
            }
            const row = link.closest("tr");
            row && this.setDisplay(/** @type {HTMLElement} */ (row), "none");
        }

        const title = this.document.querySelector(".sec-title");
        const titleNode = title?.firstChild;
        if (titleNode?.nodeType === 3 && titleNode.textContent) {
            const textNode = /** @type {Text} */ (titleNode);
            const updated = textNode.textContent.replace(/^\d+/, String(matches));
            if (updated !== textNode.textContent) {
                const previous = textNode.textContent;
                textNode.textContent = updated;
                this.scope.addCleanup(() => {
                    if (textNode.textContent === updated) textNode.textContent = previous;
                });
            }
        }
        if (!matches) this.notifications.error("该番号无字幕!");
        return true;
    }

    /** @param {Element} element @param {string} value */
    setDisplay(/** @type {HTMLElement} */ element, /** @type {string} */ value) {
        const previous = element.style.getPropertyValue("display");
        const priority = element.style.getPropertyPriority("display");
        element.style.setProperty("display", value);
        const applied = element.style.getPropertyValue("display");
        this.scope.addCleanup(() => {
            if (element.style.getPropertyValue("display") !== applied) return;
            if (previous) element.style.setProperty("display", previous, priority);
            else element.style.removeProperty("display");
        });
    }
}
