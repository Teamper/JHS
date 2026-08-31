// @ts-check

/** Own SubtitleCat result filtering and page visibility lifecycle. */
export class SubtitleCatController {
    /** @param {{document?: Document, window?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.ui = options.ui;
        this.scope = options.scope;
        /** @type {Map<Element, string>} */ this.displayValues = new Map;
        this.title = null;
        this.titleChildren = null;
        this.started = false;
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? this.window?.jQuery; }
    getShow() { return this.ui?.show ?? {}; }

    /** Start SubtitleCat filtering. */
    start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        this.scope.addCleanup(() => this.dispose());
        try { this.apply(); }
        catch (error) { this.dispose(); throw error; }
    }

    apply() {
        const $ = this.getJQuery(), search = (new URLSearchParams(this.window.location.search).get("search") || "").toLowerCase();
        [ ...this.document.querySelectorAll(".t-banner-inner, #navbar") ].forEach((element) => this.setDisplay(element, "none"));
        let matched = 0;
        for (const anchor of this.document.querySelectorAll(".sub-table tr td a")) {
            if (($(anchor).text() || "").toLowerCase().includes(search)) matched++;
            else {
                const row = anchor.parentElement?.parentElement;
                row && this.setDisplay(row, "none");
            }
        }
        if (!matched) this.getShow().error?.("该番号无字幕!");
        const title = this.document.querySelector(".sec-title");
        if (!title) return;
        this.title = title;
        this.titleChildren = [ ...title.childNodes ].map((node) => node.cloneNode(true));
        const walker = this.document.createTreeWalker(title, this.window.NodeFilter?.SHOW_TEXT ?? 4);
        const firstText = walker.nextNode();
        if (firstText) firstText.nodeValue = String(firstText.nodeValue || "").replace(/^\d+/, String(matched));
    }

    /** @param {Element} element @param {string} display */
    setDisplay(element, display) {
        const htmlElement = /** @type {HTMLElement} */ (element);
        if (!this.displayValues.has(element)) this.displayValues.set(element, htmlElement.style.display);
        htmlElement.style.display = display;
    }

    dispose() {
        for (const [element, display] of this.displayValues) /** @type {HTMLElement} */ (element).style.display = display;
        this.displayValues.clear();
        if (this.title && this.titleChildren) this.title.replaceChildren(...this.titleChildren.map((node) => node.cloneNode(true)));
        this.title = null;
        this.titleChildren = null;
        this.started = false;
    }
}
