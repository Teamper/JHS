// @ts-check

import { createLatestSettingWriter } from "../../ui/settings/setting-binding-controller.js";

const HIGHLIGHTED_TAGS_KEY = "highlighted_tags";
const TAG_SELECTOR = "#tags a.tag, .tags a.tag";

/** Own list tag highlighting and selected-category folding for the List Feature. */
export class ListCategoryFoldController {
    /** @param {{hostAdapter: any, settings: any, storage: any, storageMutation: any, styles: any, notifications: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, route: string}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document ?? null;
        this.settings = options.settings;
        this.storage = options.storage;
        this.storageMutation = options.storageMutation;
        this.styles = options.styles;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.route = options.route;
        this.started = false;
        this.disposed = false;
        this.foldState = false;
        this.foldWriter = null;
        /** @type {HTMLButtonElement[]} */ this.foldButtons = [];
        /** @type {HTMLElement | null} */ this.categoryBox = null;
        /** @type {HTMLElement | null} */ this.categoryToolbar = null;
        /** @type {HTMLElement | null} */ this.sectionHolder = null;
        this.releaseStyles = () => {};
        this.scope.addCleanup(() => this.dispose());
    }

    /** @returns {Promise<boolean>} */
    async start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.document) return false;
        this.started = true;
        const pageWindow = this.document.defaultView ?? globalThis.window;
        const href = this.hostAdapter?.location?.href ?? this.document.location?.href ?? pageWindow?.location?.href ?? "";
        if (!(pageWindow?.isListPage || this.route === "list") || href.includes("advanced_search")) return false;

        this.applyHighlightStyle(this.settings.snapshot());
        this.scope.listen(this.settings, "settings.changed", this.handleSettingsChanged);
        this.bindHighlightEvents();
        await this.restoreHighlights();
        if (this.disposed || this.scope.disposed) return false;
        this.expandTagCategories();
        this.scheduleFoldControls();
        return true;
    }

    /** @param {Record<string, any>} settings */
    applyHighlightStyle(settings) {
        this.releaseStyles();
        const rawWidth = Number(settings.highlightedTagNumber);
        const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
        const rawColor = typeof settings.highlightedTagColor === "string" ? settings.highlightedTagColor : "";
        const color = /^#[\da-f]{3,8}$/iu.test(rawColor) ? rawColor : "var(--jhs-status-filter)";
        const css = `#tags a.tag,.tags a.tag{position:relative}.highlight-btn{position:absolute;top:-10px;right:-10px;background-color:var(--jhs-status-down);color:var(--jhs-status-down-on);border:0;border-radius:50%;width:24px;height:24px;font-size:14px;line-height:24px;text-align:center;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.2);display:none;z-index:var(--jhs-z-dropdown)}.highlighted .highlight-btn{background-color:var(--jhs-status-watch)}#tags a.tag:hover .highlight-btn,#tags a.tag:focus-within .highlight-btn,.tags a.tag:hover .highlight-btn,.tags a.tag:focus-within .highlight-btn{display:block}.highlighted{border:${width}px solid ${color}}`;
        try { this.releaseStyles = this.styles.register("jhs-list-category-fold-feature", css); }
        catch (error) { this.reportError("分类高亮样式注册失败", error); }
    }

    handleSettingsChanged = (/** @type {any} */ event) => {
        const names = event.detail?.names;
        if (Array.isArray(names) && !names.some((/** @type {string} */ name) => ["highlightedTagNumber", "highlightedTagColor"].includes(name))) return;
        this.applyHighlightStyle(this.settings.snapshot());
    };

    bindHighlightEvents() {
        this.scope.listen(this.document, "pointerover", (/** @type {Event} */ event) => {
            const target = this.closestTag(event.target);
            const related = /** @type {any} */ (event).relatedTarget;
            if (!target || (related instanceof Node && target.contains(related)) || target.querySelector(".highlight-btn")) return;
            target.append(this.createHighlightButton());
        });
        this.scope.listen(this.document, "pointerout", (/** @type {Event} */ event) => {
            const target = this.closestTag(event.target);
            const related = /** @type {any} */ (event).relatedTarget;
            if (!target || (related instanceof Node && target.contains(related))) return;
            target.querySelector(".highlight-btn")?.remove();
        });
        this.scope.listen(this.document, "focusin", (/** @type {Event} */ event) => {
            const target = this.closestTag(event.target);
            if (target && !target.querySelector(".highlight-btn")) target.append(this.createHighlightButton());
        });
        this.scope.listen(this.document, "focusout", (/** @type {Event} */ event) => {
            const target = this.closestTag(event.target);
            const related = /** @type {any} */ (event).relatedTarget;
            if (!target || (related instanceof Node && target.contains(related))) return;
            target.querySelector(".highlight-btn")?.remove();
        });
        this.scope.listen(this.document, "click", (/** @type {Event} */ event) => {
            const element = this.asElement(event.target);
            const button = element?.closest(".highlight-btn");
            const tag = button?.closest(TAG_SELECTOR);
            if (!button || !tag) return;
            event.preventDefault();
            event.stopPropagation();
            void this.toggleHighlight(tag, /** @type {HTMLButtonElement} */ (button));
        });
    }

    createHighlightButton() {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn highlight-btn";
        button.title = "高亮显示";
        button.setAttribute("aria-label", "高亮显示分类");
        button.textContent = "★";
        return button;
    }

    /** @param {EventTarget | null} target */
    asElement(target) {
        const ElementCtor = this.document?.defaultView?.Element;
        return ElementCtor && target instanceof ElementCtor ? /** @type {Element} */ (target) : null;
    }

    /** @param {EventTarget | null} target */
    closestTag(target) { return this.asElement(target)?.closest(TAG_SELECTOR) ?? null; }

    /** @param {Element} element */
    readTagName(element) {
        const clone = /** @type {Element} */ (element.cloneNode(true));
        clone.querySelector(".highlight-btn")?.remove();
        return clone.textContent?.trim().replace(/\s*\(\d+\)$/, "") ?? "";
    }

    async readHighlightedTags() {
        const value = await this.storage.get(HIGHLIGHTED_TAGS_KEY);
        return Array.isArray(value) ? value.filter((/** @type {unknown} */ item) => typeof item === "string") : [];
    }

    async restoreHighlights() {
        try {
            const highlighted = await this.readHighlightedTags();
            if (this.disposed || this.scope.disposed) return;
            this.document.querySelectorAll(TAG_SELECTOR).forEach((/** @type {Element} */ element) => {
                element.classList.toggle("highlighted", highlighted.includes(this.readTagName(element)));
            });
        } catch (error) { this.reportError("分类高亮恢复失败", error); }
    }

    /** @param {Element} tag @param {HTMLButtonElement} button */
    async toggleHighlight(tag, button) {
        if (button.disabled || this.disposed) return;
        button.disabled = true;
        try {
            const next = await this.storageMutation.runExclusive(async () => {
                const current = await this.readHighlightedTags(), name = this.readTagName(tag);
                if (!name) return current;
                const updated = current.includes(name) ? current.filter((/** @type {string} */ item) => item !== name) : [...current, name];
                await this.storage.set(HIGHLIGHTED_TAGS_KEY, updated);
                return updated;
            });
            if (this.disposed || this.scope.disposed) return;
            tag.classList.toggle("highlighted", next.includes(this.readTagName(tag)));
        } catch (error) {
            this.reportError("分类高亮保存失败", error);
            this.notifications.error("分类高亮保存失败");
        } finally {
            if (!this.disposed && button.isConnected) button.disabled = false;
        }
    }

    expandTagCategories() {
        this.document.querySelectorAll("#tags .tag-category .tag-expand").forEach((/** @type {Element} */ element) => {
            if (element.parentElement?.classList.contains("collapse")) /** @type {HTMLElement} */ (element).click();
        });
    }

    scheduleFoldControls() {
        const deadline = Date.now() + 10_000;
        const attempt = () => {
            if (this.disposed || this.scope.disposed) return;
            if (this.createFoldControls() || Date.now() >= deadline) return;
            this.scope.ownTimeout(setTimeout(attempt, 1000));
        };
        attempt();
    }

    createFoldControls() {
        if (this.disposed || this.foldButtons.length) return Boolean(this.foldButtons.length);
        const selected = [...this.document.querySelectorAll("#tags dl div.tag.is-info")]
            .map((/** @type {Element} */ element) => element.textContent?.replaceAll("\n", "").replaceAll(" ", "") ?? "")
            .join(" ");
        if (!selected) return false;
        const tabs = this.document.querySelector(".tabs");
        if (tabs) {
            const toolbar = this.document.createElement("div");
            toolbar.className = "jhs-layout-8453d189 jhs-fold-category-toolbar";
            const label = this.document.createElement("div");
            label.append(this.document.createTextNode("已选分类: "));
            const value = this.document.createElement("span");
            value.id = "jhs-check-tag";
            value.textContent = selected;
            label.append(value);
            toolbar.append(label, this.createFoldButton(false));
            tabs.append(toolbar);
            this.categoryToolbar = toolbar;
        }
        const sectionTitle = this.document.querySelector("h2.section-title");
        const box = this.document.querySelector("section > div > div.box");
        if (sectionTitle) {
            const holder = this.document.createElement("div");
            holder.className = "jhs-fold-category-box";
            holder.append(this.createFoldButton(true));
            sectionTitle.append(holder);
            this.sectionHolder = holder;
        }
        this.categoryBox = sectionTitle && box ? /** @type {HTMLElement} */ (box) : this.document.querySelector("#tags");
        if (!this.foldButtons.length) return false;
        this.foldWriter = createLatestSettingWriter({
            settings: this.settings, key: "foldCategoryCollapsed", fallback: false,
            apply: (/** @type {unknown} */ value) => this.applyCollapsed(value === true),
            onError: (error) => {
                this.reportError("分类折叠设置保存失败，已恢复", error);
                this.notifications.error("分类折叠设置保存失败，已恢复原设置");
            },
        });
        const collapsed = this.settings.snapshot().foldCategoryCollapsed === true;
        this.foldState = collapsed;
        this.applyFoldLabels(collapsed);
        if (!(this.hostAdapter?.location?.href ?? "").includes("noFold=1")) this.applyCollapsed(collapsed);
        return true;
    }

    /** @param {boolean} sectionButton */
    createFoldButton(sectionButton) {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = `jhs-btn jhs-btn--ghost ${sectionButton ? "jhs-layout-2100e73d" : "jhs-layout-3a1fc324"} jhs-fold-category-btn`;
        button.setAttribute("aria-label", "折叠已选分类");
        const label = this.document.createElement("span"), icon = this.document.createElement("i");
        button.append(label, icon);
        this.foldButtons.push(button);
        this.scope.listen(button, "click", this.onFoldClick);
        return button;
    }

    /** @param {boolean} collapsed */
    applyFoldLabels(collapsed) {
        this.foldButtons.forEach((button) => {
            const label = button.querySelector("span"), icon = button.querySelector("i");
            if (label) label.textContent = collapsed ? "展开" : "折叠";
            if (icon) icon.className = collapsed ? "icon-angle-double-down" : "icon-angle-double-up";
            button.setAttribute("aria-expanded", String(!collapsed));
            button.setAttribute("aria-label", collapsed ? "展开已选分类" : "折叠已选分类");
        });
    }

    /** @param {boolean} collapsed */
    applyCollapsed(collapsed) {
        this.foldState = collapsed;
        this.applyFoldLabels(collapsed);
        if (this.categoryBox) this.categoryBox.hidden = collapsed;
    }

    onFoldClick = (/** @type {Event} */ event) => {
        event.preventDefault();
        void this.foldWriter?.(!this.foldState);
    };

    /** @param {string} message @param {unknown} error */
    reportError(message, error) {
        this.diagnostics?.recordError?.({ source: "list-category-fold-feature", featureId: "list", contributionId: "list.fold-category", message, detail: error instanceof Error ? error.message : String(error) });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.foldWriter = null;
        this.foldButtons = [];
        this.categoryBox = null;
        this.categoryToolbar?.remove();
        this.categoryToolbar = null;
        this.sectionHolder?.remove();
        this.sectionHolder = null;
        this.document?.querySelectorAll(TAG_SELECTOR).forEach((/** @type {Element} */ element) => {
            element.classList.remove("highlighted");
            element.querySelector(".highlight-btn")?.remove();
        });
        this.releaseStyles();
        this.releaseStyles = () => {};
    }
}
