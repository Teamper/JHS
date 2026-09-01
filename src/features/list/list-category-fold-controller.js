// @ts-check

import { createLatestSettingWriter } from "../../ui/settings/setting-binding-controller.js";

const HIGHLIGHTED_TAGS_KEY = "highlighted_tags";
const TAG_SELECTOR = "#tags a.tag, .tags a.tag";

/** Own list tag highlighting and selected-category folding without the legacy plugin runtime. */
export class ListCategoryFoldController {
    /** @param {{hostAdapter: any, settings: any, storage: any, storageMutation?: any, ui?: any, scope: any, route?: string}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document ?? null;
        this.settings = options.settings;
        this.storage = options.storage;
        this.storageMutation = options.storageMutation ?? null;
        this.ui = options.ui ?? null;
        this.scope = options.scope;
        this.route = options.route ?? "unknown";
        this.started = false;
        this.disposed = false;
        this.foldWriter = null;
        this.foldButtons = /** @type {HTMLButtonElement[]} */ ([]);
        this.categoryBox = null;
        this.controlsReady = false;
        this.scope.addCleanup(() => this.dispose());
    }

    async start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.document) return;
        this.started = true;
        const pageWindow = this.document.defaultView ?? globalThis.window;
        const href = this.hostAdapter?.location?.href ?? this.document.location?.href ?? pageWindow?.location?.href ?? "";
        if (!(pageWindow?.isListPage || ["list", "other"].includes(this.route)) || href.includes("advanced_search")) return;

        this.bindHighlightEvents();
        this.bindHighlightSettings();
        await this.restoreHighlights();
        this.expandTagCategories();
        this.scheduleFoldControls();
    }

    bindHighlightEvents() {
        this.scope.listen(this.document, "pointerover", (/** @type {Event} */ event) => {
            const target = event.target instanceof Element ? event.target.closest(TAG_SELECTOR) : null;
            const related = /** @type {any} */ (event).relatedTarget;
            if (!target || (related instanceof Node && target.contains(related)) || target.querySelector(".highlight-btn")) return;
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn highlight-btn";
            button.title = "高亮显示";
            button.setAttribute("aria-label", "高亮显示分类");
            button.textContent = "★";
            target.append(button);
        });
        this.scope.listen(this.document, "pointerout", (/** @type {Event} */ event) => {
            const target = event.target instanceof Element ? event.target.closest(TAG_SELECTOR) : null;
            const related = /** @type {any} */ (event).relatedTarget;
            if (!target || (related instanceof Node && target.contains(related))) return;
            target.querySelector(".highlight-btn")?.remove();
        });
        this.scope.listen(this.document, "click", (/** @type {Event} */ event) => {
            const target = event.target instanceof Element ? event.target.closest(".highlight-btn") : null;
            const tag = target?.closest(TAG_SELECTOR);
            if (!target || !tag) return;
            event.preventDefault();
            event.stopPropagation();
            void this.toggleHighlight(tag, /** @type {HTMLButtonElement} */ (target));
        });
    }

    bindHighlightSettings() {
        this.applyHighlightStyle(this.settings?.snapshot?.() ?? {});
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = event.detail?.names;
            if (!Array.isArray(names) || names.some((name) => ["highlightedTagNumber", "highlightedTagColor"].includes(name))) this.applyHighlightStyle(this.settings.snapshot());
        });
    }

    /** @param {Record<string, any>} settings */
    applyHighlightStyle(settings) {
        const root = this.document.documentElement;
        const width = Number(settings.highlightedTagNumber);
        const color = typeof settings.highlightedTagColor === "string" && settings.highlightedTagColor ? settings.highlightedTagColor : "var(--jhs-status-filter)";
        root.style.setProperty("--jhs-highlighted-tag-number", `${Number.isFinite(width) && width >= 0 ? width : 1}px`);
        root.style.setProperty("--jhs-highlighted-tag-color", color);
    }

    /** @param {Element} element */
    readTagName(element) {
        const clone = /** @type {Element} */ (element.cloneNode(true));
        clone.querySelector(".highlight-btn")?.remove();
        return clone.textContent?.trim().replace(/\s*\(\d+\)$/, "") ?? "";
    }

    async readHighlightedTags() {
        const value = await this.storage?.get?.(HIGHLIGHTED_TAGS_KEY);
        return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
    }

    async restoreHighlights() {
        try {
            const highlighted = await this.readHighlightedTags();
            if (this.disposed) return;
            this.document.querySelectorAll(TAG_SELECTOR).forEach((/** @type {Element} */ element) => {
                element.classList.toggle("highlighted", highlighted.includes(this.readTagName(element)));
            });
        } catch (error) {
            this.ui?.getClog?.().warn?.("分类高亮恢复失败", error);
        }
    }

    /** @param {Element} tag @param {HTMLButtonElement} button */
    async toggleHighlight(tag, button) {
        button.disabled = true;
        try {
            const operation = async () => {
                let highlighted = await this.readHighlightedTags();
                const name = this.readTagName(tag);
                if (!name) return;
                if (highlighted.includes(name)) {
                    highlighted = highlighted.filter((item) => item !== name);
                    tag.classList.remove("highlighted");
                } else {
                    highlighted = [...highlighted, name];
                    tag.classList.add("highlighted");
                }
                await this.storage?.set?.(HIGHLIGHTED_TAGS_KEY, highlighted);
            };
            if (this.storageMutation?.runExclusive) await this.storageMutation.runExclusive(operation);
            else await operation();
        } catch (error) {
            this.ui?.getClog?.().error?.("分类高亮保存失败", error);
            this.ui?.show?.error?.("分类高亮保存失败");
        } finally {
            if (!this.disposed) button.disabled = false;
        }
    }

    expandTagCategories() {
        this.document.querySelectorAll("#tags .tag-category .tag-expand").forEach((/** @type {Element} */ element) => {
            const parent = element.parentElement;
            if (parent?.classList.contains("collapse")) /** @type {HTMLElement} */ (element).click();
        });
    }

    scheduleFoldControls() {
        const deadline = Date.now() + 10_000;
        const attempt = () => {
            if (this.disposed) return;
            if (this.createFoldControls() || Date.now() >= deadline) return;
            const timer = setTimeout(attempt, 250);
            this.scope.ownTimeout(timer);
        };
        attempt();
    }

    createFoldControls() {
        if (this.disposed) return false;
        const selected = [...this.document.querySelectorAll("#tags dl div.tag.is-info")]
            .map((/** @type {Element} */ element) => element.textContent?.replaceAll("\n", "").replaceAll(" ", "") ?? "")
            .join(" ");
        if (!selected) return false;
        const tabs = this.document.querySelector(".tabs");
        if (tabs && !tabs.querySelector(".jhs-fold-category-toolbar")) {
            const toolbar = this.document.createElement("div");
            toolbar.className = "jhs-layout-8453d189 jhs-fold-category-toolbar";
            const label = this.document.createElement("div");
            label.append(this.document.createTextNode("已选分类: "));
            const value = this.document.createElement("span");
            value.className = "jhs-check-tag";
            value.textContent = selected;
            label.append(value);
            toolbar.append(label, this.createFoldButton());
            tabs.append(toolbar);
        }

        const sectionTitle = this.document.querySelector("h2.section-title");
        const box = this.document.querySelector("section > div > div.box");
        if (sectionTitle && box) {
            const holder = sectionTitle.querySelector(".jhs-fold-category-box") ?? this.document.createElement("div");
            if (!holder.parentElement) {
                holder.className = "jhs-fold-category-box";
                sectionTitle.append(holder);
            }
            if (!holder.querySelector(".jhs-fold-category-btn")) holder.append(this.createFoldButton());
            this.categoryBox = /** @type {HTMLElement} */ (box);
        }
        this.foldButtons = [...this.document.querySelectorAll(".jhs-fold-category-btn")];
        if (!this.foldButtons.length || !this.categoryBox) return false;
        this.foldButtons.forEach((button) => button.addEventListener("click", this.onFoldClick));
        this.foldWriter = createLatestSettingWriter({
            settings: this.settings,
            key: "foldCategoryCollapsed",
            fallback: false,
            apply: (value) => this.applyCollapsed(value === true),
            onError: (error) => {
                this.ui?.getClog?.().error?.("分类折叠设置保存失败，已恢复", error);
                this.ui?.show?.error?.("分类折叠设置保存失败，已恢复原设置");
            },
        });
        this.applyCollapsed(this.settings?.snapshot?.().foldCategoryCollapsed === true);
        this.controlsReady = true;
        return true;
    }

    createFoldButton() {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--ghost jhs-layout-3a1fc324 jhs-fold-category-btn";
        button.append(this.document.createElement("span"), this.document.createElement("i"));
        return button;
    }

    /** @param {boolean} collapsed */
    applyCollapsed(collapsed) {
        this.foldButtons.forEach((button) => {
            const label = button.querySelector("span");
            const icon = button.querySelector("i");
            if (label) label.textContent = collapsed ? "展开" : "折叠";
            if (icon) icon.className = collapsed ? "icon-angle-double-down" : "icon-angle-double-up";
            button.setAttribute("aria-expanded", String(!collapsed));
        });
        if (this.categoryBox) this.categoryBox.hidden = collapsed;
    }

    onFoldClick = (/** @type {Event} */ event) => {
        event.preventDefault();
        const collapsed = this.settings?.snapshot?.().foldCategoryCollapsed === true;
        void this.foldWriter?.(!collapsed);
    };

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.foldButtons.forEach((button) => button.removeEventListener("click", this.onFoldClick));
        this.foldButtons = [];
        this.foldWriter = null;
        this.categoryBox = null;
        this.document?.querySelectorAll(".highlight-btn").forEach((/** @type {Element} */ element) => element.remove());
        this.document?.querySelectorAll(".jhs-fold-category-toolbar, .jhs-fold-category-box").forEach((/** @type {Element} */ element) => element.remove());
        this.document?.documentElement?.style.removeProperty("--jhs-highlighted-tag-number");
        this.document?.documentElement?.style.removeProperty("--jhs-highlighted-tag-color");
        this.controlsReady = false;
    }
}
