// @ts-check

import { JhsSelect } from "../../core/ui-primitives.js";

const SEARCH_TYPES = Object.freeze([
    ["all", "影片"], ["actor", "演员"], ["series", "系列"], ["maker", "片商"],
    ["director", "导演"], ["code", "番号"], ["list", "清单"],
]);

export const JAVDB_NAVIGATION_CSS = ".highlight-red { color: var(--jhs-status-filter) !important; font-weight: bold; }";

/** Own JavDB search controls and navigation embellishments for the page lifetime. */
export class JavDbNavigationController {
    /** @param {{document: Document, location: Location, movie: {externalNavigationLinks: () => Array<{url: string, label: string}>}, navigation: {assign: (url: string) => void, open: (url: string, options?: {newTab?: boolean}) => unknown}, searchImage?: {open: (options?: {file?: File | null}) => unknown} | null, notifications?: {info?: (message: string) => void}, jquery?: any, onError?: (error: unknown) => void}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.document.defaultView;
        this.location = options.location;
        this.movie = options.movie;
        this.navigation = options.navigation;
        this.searchImage = options.searchImage ?? null;
        this.notifications = options.notifications ?? null;
        this.jquery = options.jquery ?? /** @type {any} */ (globalThis).jQuery;
        this.onError = options.onError ?? null;
        /** @type {Array<{target: EventTarget, type: string, listener: EventListener}>} */
        this.bindings = [];
        /** @type {Set<ReturnType<typeof setTimeout>>} */
        this.timers = new Set();
        /** @type {Array<{node: Element, parent: Node | null, next: Node | null}>} */
        this.removedNavigationLinks = [];
        /** @type {Array<{original: Element, replacement: HTMLElement}>} */
        this.replacedImageLinks = [];
        /** @type {Set<Element>} */
        this.highlightedElements = new Set();
        /** @type {Map<Element, string | null>} */
        this.displaySnapshots = new Map();
        this.searchBox = null;
        this.dropdown = null;
        this.searchType = null;
        this.searchKeyword = null;
        this.searchButton = null;
        this.imageSearchButton = null;
        /** @type {{element: Element, value: string | null} | null} */
        this.tooltipSnapshot = null;
        this.disposed = false;
    }

    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    start(scope) {
        scope.assertActive();
        if (this.disposed) return false;
        this.mergeNavigation();
        this.mountSearchBox();
        this.hookHostImageSearch();
        this.toggleOtherNavigationItems();
        if (this.window) this.bind(this.window, "resize", this.handleResize);
        this.initializeSearchPage();
        scope.addCleanup(() => this.dispose());
        return true;
    }

    /** @param {EventTarget} target @param {string} type @param {(event: any) => void} listener */
    bind(target, type, listener) {
        const eventListener = /** @type {EventListener} */ (listener);
        target.addEventListener(type, eventListener);
        this.bindings.push({ target, type, listener: eventListener });
    }

    mergeNavigation() {
        for (const anchor of this.document.querySelectorAll('a[href*="/feedbacks/new"], a[href*="theporndude.com"]')) {
            this.removedNavigationLinks.push({ node: anchor, parent: anchor.parentNode, next: anchor.nextSibling });
            anchor.remove();
        }

        const makerLink = this.document.querySelector('a.navbar-link[href="/makers"]');
        if (!makerLink?.parentNode) return;
        const dropdown = this.document.createElement("div");
        dropdown.className = "navbar-item has-dropdown is-hoverable";
        const trigger = this.document.createElement("a");
        trigger.className = "navbar-link";
        trigger.textContent = "其它";
        const menu = this.document.createElement("div");
        menu.className = "navbar-dropdown is-boxed";
        const feedback = this.document.createElement("a");
        feedback.className = "navbar-item";
        feedback.href = "/feedbacks/new";
        feedback.target = "_blank";
        feedback.textContent = "反饋";
        menu.append(feedback);
        /** @type {Array<{url: string, label: string}>} */
        let externalLinks = [];
        try {
            externalLinks = this.movie.externalNavigationLinks();
        } catch (error) {
            this.onError?.(error);
        }
        for (const item of externalLinks) {
            const link = this.document.createElement("a");
            link.className = "navbar-item";
            link.href = item.url;
            link.rel = "nofollow noopener";
            link.target = "_blank";
            link.textContent = item.label;
            menu.append(link);
        }
        dropdown.append(trigger, menu);
        makerLink.parentNode.parentNode?.insertBefore(dropdown, makerLink.parentNode.nextSibling);
        this.dropdown = dropdown;
    }

    mountSearchBox() {
        const hero = this.document.querySelector("#navbar-menu-hero");
        if (!hero?.parentNode) return;
        const box = this.document.createElement("div");
        box.className = "navbar-menu jhs-ui";
        box.id = "search-box";
        const controls = this.document.createElement("div");
        controls.className = "navbar-start jhs-layout-d9caa2c0";
        const type = this.document.createElement("select");
        type.id = "search-type";
        type.className = "jhs-select-source";
        for (const [value, label] of SEARCH_TYPES) {
            const option = this.document.createElement("option");
            option.value = value;
            option.textContent = label;
            type.append(option);
        }
        const keyword = this.document.createElement("input");
        keyword.id = "search-keyword";
        keyword.type = "text";
        keyword.placeholder = "输入影片番号、演员名等关键词进行检索";
        keyword.className = "jhs-field";
        const advanced = this.document.createElement("a");
        advanced.href = "/search_advanced?noFold=1";
        advanced.title = "高级检索";
        advanced.className = "jhs-btn jhs-btn--secondary";
        const advancedText = this.document.createElement("span");
        advancedText.textContent = "...";
        advanced.append(advancedText);
        controls.append(type, keyword, advanced);

        if (this.searchImage) {
            const imageButton = this.document.createElement("button");
            imageButton.type = "button";
            imageButton.id = "search-img-btn";
            imageButton.className = "jhs-btn jhs-btn--secondary";
            imageButton.textContent = "识图";
            controls.append(imageButton);
            this.imageSearchButton = imageButton;
            this.bind(imageButton, "click", this.handleImageSearchClick);
        }

        const searchButton = this.document.createElement("button");
        searchButton.type = "button";
        searchButton.id = "search-btn";
        searchButton.className = "jhs-btn jhs-btn--primary";
        searchButton.textContent = "检索";
        controls.append(searchButton);
        box.append(controls);
        hero.parentNode.insertBefore(box, hero.nextSibling);

        this.searchBox = box;
        this.searchType = type;
        this.searchKeyword = keyword;
        this.searchButton = searchButton;
        JhsSelect.enhance(box);
        this.bind(keyword, "paste", this.handlePaste);
        this.bind(keyword, "keypress", this.handleKeypress);
        this.bind(searchButton, "click", this.handleSearchClick);
    }

    hookHostImageSearch() {
        if (!this.searchImage) return;
        const hostLinks = this.document.querySelectorAll(".search-image");
        for (const original of hostLinks) {
            const replacement = /** @type {HTMLElement} */ (original.cloneNode(true));
            original.parentNode?.replaceChild(replacement, original);
            this.replacedImageLinks.push({ original, replacement });
            this.bind(replacement, "click", this.handleImageSearchClick);
        }
        const tooltip = this.document.querySelector("#button-search-image");
        if (tooltip) {
            this.tooltipSnapshot = { element: tooltip, value: tooltip.getAttribute("data-tooltip") };
            tooltip.setAttribute("data-tooltip", "以图识图");
        }
    }

    initializeSearchPage() {
        if (!this.searchBox || !this.searchKeyword || !this.searchType || !this.location.href.includes("/search")) return;
        const params = new URLSearchParams(this.location.search);
        const keyword = params.get("q") ?? "";
        const filter = params.get("f");
        this.searchKeyword.value = keyword;
        if (filter) JhsSelect.setValue(this.searchType, filter);
        if (keyword) this.highlightKeyword(keyword);
    }

    /** @param {string} value */
    highlightKeyword(value) {
        const keyword = value.trim().toLowerCase();
        if (!keyword) return;
        for (const element of this.document.querySelectorAll(".video-title strong, .actor-box strong")) {
            if (element.textContent?.toLowerCase().includes(keyword)) {
                element.classList.add("highlight-red");
                this.highlightedElements.add(element);
            }
        }
    }

    /** @param {ClipboardEvent} event */
    handlePaste = (event) => {
        const items = event.clipboardData?.items ?? [];
        for (const item of items) {
            if (!item.type.includes("image")) continue;
            const file = item.getAsFile();
            this.searchKeyword?.blur();
            if (!this.searchImage) {
                this.notifications?.info?.("以图识图功能已禁用");
                return;
            }
            this.searchImage.open({ file });
            return;
        }
    };

    /** @param {KeyboardEvent} event */
    handleKeypress = (event) => {
        if (event.key !== "Enter" || !this.searchButton) return;
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (!this.disposed) this.searchButton?.click();
        }, 0);
        this.timers.add(timer);
    };

    /** @param {MouseEvent} event */
    handleSearchClick = (event) => {
        event.preventDefault();
        const keyword = this.searchKeyword?.value ?? "";
        if (!keyword) return;
        const filter = this.searchType?.value ?? "all";
        const url = `/search?q=${encodeURIComponent(keyword)}&f=${encodeURIComponent(filter)}`;
        if (this.location.href.includes("/search")) this.navigation.assign(url);
        else this.navigation.open(url, { newTab: true });
    };

    /** @param {MouseEvent} event */
    handleImageSearchClick = (event) => {
        event.preventDefault();
        this.searchImage?.open?.();
    };

    handleResize = () => this.toggleOtherNavigationItems();

    toggleOtherNavigationItems() {
        const wide = Number(this.window?.innerWidth ?? 0) > 1600;
        this.setVisibility(this.searchBox, wide);
        this.setVisibility(this.document.querySelector("#search-bar-container"), !wide);
    }

    /** @param {Element | null} element @param {boolean} visible */
    setVisibility(element, visible) {
        if (!element || !this.jquery) return;
        if (!this.displaySnapshots.has(element)) this.displaySnapshots.set(element, element.getAttribute("style"));
        visible ? this.jquery(element).show() : this.jquery(element).hide();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        for (const { target, type, listener } of this.bindings) target.removeEventListener(type, listener);
        this.bindings = [];
        this.searchBox?.remove();
        this.dropdown?.remove();
        for (const { replacement, original } of this.replacedImageLinks) {
            if (replacement.parentNode) replacement.parentNode.replaceChild(original, replacement);
        }
        this.replacedImageLinks = [];
        for (const { node, parent, next } of [...this.removedNavigationLinks].reverse()) {
            if (parent && !node.isConnected) parent.insertBefore(node, next?.parentNode === parent ? next : null);
        }
        this.removedNavigationLinks = [];
        for (const [element, style] of this.displaySnapshots) {
            if (style === null) element.removeAttribute("style");
            else element.setAttribute("style", style);
        }
        this.displaySnapshots.clear();
        for (const element of this.highlightedElements) element.classList.remove("highlight-red");
        this.highlightedElements.clear();
        if (this.tooltipSnapshot) {
            const { element, value } = this.tooltipSnapshot;
            value === null ? element.removeAttribute("data-tooltip") : element.setAttribute("data-tooltip", value);
            this.tooltipSnapshot = null;
        }
    }
}
