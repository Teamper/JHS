// @ts-check
import { OwnedPopover } from "./owned-popover.js";

import { getIcon } from "./icons.js";

export { buildUiPrimitivesCss } from "./ui-primitives-styles.js";


/**
 * 在现有容器内渲染安全的 loading、empty 或 error 状态。
 * @param {any} container
 * @param {{ type?: string, title?: string, description?: string, actionLabel?: string, onAction?: (() => unknown) | null, jquery?: (value: any) => any }} [options]
 */
export function renderStateView(container, { type = "empty", title = "", description = "", actionLabel = "", onAction = null, jquery = undefined } = {}) {
    const jq = jquery ?? /** @type {any} */ (globalThis).$;
    const root = container?.jquery ? container : jq(container), state = jq('<div class="jhs-state"></div>').addClass(`jhs-state--${type}`).attr("role", "error" === type ? "alert" : "status"), content = jq('<div class="jhs-state__content"></div>');
    root.attr("aria-busy", String(type === "loading"));
    if (type === "loading" && !title) title = "加载中…";
    title && content.append(jq('<p class="jhs-state__title"></p>').text(title)), description && content.append(jq('<p class="jhs-state__description"></p>').text(description));
    if (actionLabel && "function" == typeof onAction) content.append(jq('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').text(actionLabel).on("click", onAction));
    return state.append(content), root.empty().append(state), state;
}

/** 为动态注入的 JHS 控件补齐可访问名称与图标按钮语义。 */
/** @param {import("./lifecycle-scope.js").LifecycleScope} lifecycleScope */
export function initializeUiAccessibility(lifecycleScope) {
    if (!lifecycleScope || "function" != typeof lifecycleScope.observe) throw new TypeError("UI accessibility requires an app LifecycleScope");
    const selector = "button.jhs-btn, a.jhs-btn[role='button'], .card-btn, .jhs-icon-btn, [class*='jhs-'] button, [class*='jhs-'] a[role='button']";
    const enhance = (/** @type {any} */ e) => {
        const selects = e.matches?.("select.jhs-field,select.jhs-select-source") ? [e] : [];
        if (e.querySelectorAll) selects.push(...e.querySelectorAll("select.jhs-field,select.jhs-select-source"));
        for (const select of selects) if (!select.multiple && select.closest(".jhs-ui,.jhs-dialog")) {
            select.classList.add("jhs-select-source");
            JhsSelect.enhance(select);
        }
        const links = e.querySelectorAll ? [...e.querySelectorAll(".jhs-ui a[href]")] : [];
        if (e.nodeType === Node.ELEMENT_NODE && e.closest?.(".jhs-ui")) {
            if (e.matches?.("a[href]")) links.push(e);
            links.push(...e.querySelectorAll("a[href]"));
        }
        links.forEach(link => {
            if (!link.matches(".jhs-btn,.jhs-segmented__item,[role='button'],[role='tab'],.movie-box,.jhs-media-card") && !link.querySelector("img,svg")) link.classList.add("jhs-link");
        });
        const skeletons = e.querySelectorAll ? [...e.querySelectorAll(".jhs-skeleton")] : [];
        if (e.matches?.(".jhs-skeleton")) skeletons.push(e);
        skeletons.forEach(node => node.setAttribute("aria-hidden", "true"));
        const t = e.nodeType === Node.ELEMENT_NODE && e.matches?.(selector) ? [ e ] : [];
        const n = e.querySelectorAll ? [ ...e.querySelectorAll(selector) ] : [];
        [ ...t, ...n ].forEach((e => {
            if (e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby") || e.textContent.trim()) return;
            const t = e.getAttribute("title") || e.getAttribute("data-tip");
            t && e.setAttribute("aria-label", t);
        }));
    };
    enhance(document);
    const blockDisabled = (/** @type {Event} */ event) => {
        if (event.type === "keydown" && !["Enter", " "].includes(/** @type {KeyboardEvent} */ (event).key)) return;
        const disabled = /** @type {Element | null} */ (event.target)?.closest?.('[aria-disabled="true"]');
        if (disabled?.closest(".jhs-ui,.jhs-btn,.jhs-icon-btn,.card-btn")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    lifecycleScope.listen(document, "click", blockDisabled, true);
    lifecycleScope.listen(document, "keydown", blockDisabled, true);
    const pending = new Set;
    let scheduled = !1;
    let timer = 0;
    lifecycleScope.addCleanup(() => { clearTimeout(timer); pending.clear(); });
    const flush = () => {
        scheduled = !1;
        if (lifecycleScope.disposed) { pending.clear(); return; }
        const roots = [...pending].filter(node => {
            for (let parent = node.parentElement; parent; parent = parent.parentElement) if (pending.has(parent)) return false;
            return node.isConnected;
        });
        pending.clear();
        const deadline = performance.now() + 4;
        for (let index = 0; index < roots.length; index++) {
            if (index > 0 && performance.now() >= deadline) {
                roots.slice(index).forEach(node => pending.add(node));
                scheduled = true;
                timer = setTimeout(flush, 0);
                break;
            }
            enhance(roots[index]);
        }
    };
    return lifecycleScope.observe(document.documentElement, (records => {
        for (const record of records) {
            const source = record.target.parentElement?.closest("select.jhs-select-source") || (record.target.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (record.target).matches("select.jhs-select-source") ? record.target : null);
            if (source) JhsSelect.refresh(source);
            for (const removed of record.removedNodes) if (removed.nodeType === Node.ELEMENT_NODE) {
                const element = /** @type {Element} */ (removed);
                const selects = element.matches("select.jhs-select-source") ? [element] : [];
                selects.push(...element.querySelectorAll("select.jhs-select-source"));
                for (const select of selects) {
                    if (!select.isConnected) JhsSelect.instances.get(select)?.close();
                }
            }
        }
        records.forEach((record => record.addedNodes.forEach((node => {
            node.nodeType === Node.ELEMENT_NODE && pending.add(node);
        }))));
        pending.size && !scheduled && (scheduled = !0, queueMicrotask(flush));
    }), {
        childList: true,
        subtree: true
    });
}

/** 以隐藏原生 select 为值源的统一 JHS 选择器。 */
export class JhsSelect {
    /** @type {WeakMap<object, JhsSelect>} */
    static instances = new WeakMap();
    static _globalClickBound = false;
    static nextId = 0;
    id = "";
    activeIndex = -1;
    search = "";
    searchTime = 0;
    /** @type {HTMLLabelElement[]} */
    labels = [];
    static _ensureGlobalClickHandler() {
        if (JhsSelect._globalClickBound) return;
        JhsSelect._globalClickBound = true;
        $(document).on("click.jhsSelect", (/** @type {any} */ event) => {
            if (!$(event.target).closest(".jhs-select-control,.jhs-owned-popover").length) JhsSelect.closeAll();
        });
    }
    /** @param {any} select */
    constructor(select) {
        this.source = $(select);
        if (!this.source.length) return;
        const existing = JhsSelect.instances.get(this.source[0]);
        if (existing) return existing;
        this.id = `jhs-select-${++JhsSelect.nextId}`;
        this.activeIndex = -1;
        this.search = "";
        this.searchTime = 0;
        const initiallyHidden = this.source.hasClass("jhs-is-hidden") || this.source[0].style.display === "none";
        this.labels = [...(this.source[0].labels || [])];
        const enclosingLabel = this.source[0].closest("label");
        if (!this.labels.length && enclosingLabel) this.labels.push(enclosingLabel);
        this.trigger = $('<button type="button" class="jhs-btn jhs-field jhs-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false"><span class="jhs-select-value"></span></button>').attr({ id: this.id, "aria-controls": `${this.id}-listbox` }).append(getIcon("chevron-down"));
        this.menu = $('<div class="jhs-popover jhs-select-menu" role="listbox"></div>').attr("id", `${this.id}-listbox`);
        this.source.wrap('<div class="jhs-select-control"></div>');
        this.control = this.source.parent().append(this.trigger, this.menu);
        this.source.addClass("jhs-select-source-native").attr({ "aria-hidden": "true", tabindex: "-1" });
        if (initiallyHidden) this.control.addClass("jhs-is-hidden");
        this.popover = new OwnedPopover(this.trigger[0], this.menu[0], { manageKeyboard: false, onClose: () => {
            this.control.removeClass("is-open");
            this.trigger.attr("aria-expanded", "false").removeAttr("aria-activedescendant");
            this.menu.find(".is-active").removeClass("is-active");
            this.menu.find(".jhs-select-option").each((/** @type {number} */ _, /** @type {HTMLElement} */ item) => item.setAttribute("aria-selected", String(Number(item.dataset.index) === this.source[0].selectedIndex)));
            this.activeIndex = -1;
        } });
        JhsSelect.instances.set(this.source[0], this);
        this.bind(); this.refresh();
    }
    /** @param {any} [root] */
    static enhance(root = document) {
        const scope = $(root), selects = scope.is("select.jhs-select-source") ? scope : scope.find("select.jhs-select-source");
        selects.each((/** @type {number} */ _, /** @type {HTMLSelectElement} */ select) => new JhsSelect(select));
        return selects;
    }
    /** @param {any} select */
    static get(select) { const element = $(select)[0]; return element ? JhsSelect.instances.get(element) || new JhsSelect(element) : null; }
    /** @param {any} select @param {any} value @param {boolean} [emit] */
    static setValue(select, value, emit = false) {
        const instance = JhsSelect.get(select);
        if (!instance) return;
        instance.source.val(value);
        if (emit) instance.emitChange(); else instance.refresh();
    }
    /** @param {any} select */
    static refresh(select) { JhsSelect.get(select)?.refresh(); }
    /** @param {any} [root] */
    static refreshAll(root = document) {
        JhsSelect.enhance(root);
        $(root).find("select.jhs-select-source").each((/** @type {number} */ _, /** @type {HTMLSelectElement} */ select) => JhsSelect.refresh(select));
    }
    /** @param {any} select @param {boolean} visible */
    static setVisible(select, visible) { const instance = JhsSelect.get(select); if (!visible) instance?.close(); instance?.control.toggleClass("jhs-is-hidden", !visible); }
    /** @param {JhsSelect | null} [except] */
    static closeAll(except = null) {
        $(".jhs-select-control.is-open").each((/** @type {number} */ _, /** @type {HTMLElement} */ control) => {
            const source = $(control).children("select.jhs-select-source")[0], instance = source && JhsSelect.instances.get(source);
            if (instance && instance !== except) instance.close();
        });
    }
    render() {
        this.menu.empty();
        let index = 0;
        const appendOption = (/** @type {HTMLOptionElement} */ option, /** @type {any} */ target, disabled = false) => {
            const item = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-select-option" role="option" tabindex="-1"></button>');
            const unavailable = disabled || option.disabled;
            item.attr({ id: `${this.id}-option-${index}`, "data-index": String(index++), "data-value": option.value, "aria-selected": String(option.selected), "aria-disabled": String(unavailable) }).prop("disabled", unavailable).text(option.text);
            target.append(item);
        };
        this.source.children().each((/** @type {number} */ _, /** @type {HTMLOptionElement | HTMLOptGroupElement} */ child) => {
            if (child.tagName === "OPTGROUP") {
                const group = $('<div class="jhs-select-group" role="group"></div>').attr("aria-label", child.label);
                group.append($('<div class="jhs-select-group__label" aria-hidden="true"></div>').text(child.label));
                $(child).children("option").each((/** @type {number} */ _, /** @type {HTMLOptionElement} */ option) => appendOption(option, group, child.disabled));
                this.menu.append(group);
            } else if (child.tagName === "OPTION") appendOption(/** @type {HTMLOptionElement} */ (child), this.menu);
        });
    }
    bind() {
        this.trigger.on("click", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            if (!this.source.prop("disabled")) this.popover?.opened ? this.close() : this.open();
        }).on("keydown", (/** @type {any} */ event) => this.handleKey(event));
        this.menu.on("pointerdown", ".jhs-select-option", (/** @type {any} */ event) => event.preventDefault())
            .on("click", ".jhs-select-option", (/** @type {any} */ event) => { event.preventDefault(); this.choose($(event.currentTarget)); });
        this.source.on("change.jhsSelect", () => this.refresh()).on("invalid.jhsSelect", (/** @type {any} */ event) => {
            event.preventDefault(); this.trigger.attr("aria-invalid", "true").trigger("focus");
        });
        this.labels.forEach((/** @type {HTMLLabelElement} */ label) => $(label).on("click.jhsSelect", (/** @type {any} */ event) => {
            if ($(event.target).closest("button,input,select,textarea,a").length) return;
            event.preventDefault(); this.trigger.trigger("focus");
        }));
        JhsSelect._ensureGlobalClickHandler();
    }
    /** @param {any} event */
    handleKey(event) {
        if (this.source.prop("disabled")) return;
        const key = event.key, opened = this.popover?.opened;
        if (key === "Tab") { if (opened) this.choose(this.activeOption(), false); return; }
        if (key === "Escape") {
            if (opened) { event.preventDefault(); event.stopPropagation(); this.close(true); }
            return;
        }
        if (["Enter", " "].includes(key)) {
            event.preventDefault(); event.stopPropagation();
            if (opened) this.choose(this.activeOption()); else this.open();
            return;
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
            event.preventDefault(); event.stopPropagation();
            if (!opened) { this.open(key === "Home" ? "first" : key === "End" ? "last" : "selected"); return; }
            const items = this.options(), index = items.index(this.activeOption()[0]);
            const next = key === "Home" ? 0 : key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (key === "ArrowDown" ? 1 : -1)));
            this.setActive(items.eq(next));
            return;
        }
        if (key?.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (!opened) this.open();
            const now = Date.now(), letter = key.toLocaleLowerCase();
            this.search = now - this.searchTime < 700 ? this.search + letter : letter; this.searchTime = now;
            const text = [...this.search].every(character => character === letter) ? letter : this.search;
            const items = this.options(), current = items.index(this.activeOption()[0]);
            for (let offset = 1; offset <= items.length; offset++) {
                const item = items.eq((current + offset + items.length) % items.length);
                if (item.text().trim().toLocaleLowerCase().startsWith(text)) { this.setActive(item); break; }
            }
        }
    }
    options() { return this.menu.find(".jhs-select-option:not(:disabled)"); }
    activeOption() { return this.menu.find(`.jhs-select-option[data-index="${this.activeIndex}"]:not(:disabled)`); }
    /** @param {any} item */
    setActive(item) {
        if (!item.length || item.prop("disabled")) return;
        this.activeIndex = Number(item.attr("data-index"));
        this.menu.find(".jhs-select-option").removeClass("is-active").attr("aria-selected", "false"); item.addClass("is-active").attr("aria-selected", "true");
        this.trigger.attr("aria-activedescendant", item.attr("id"));
        item[0].scrollIntoView?.({ block: "nearest" });
    }
    open(focus = "selected") {
        if (this.source.prop("disabled")) return;
        JhsSelect.closeAll(this); this.refresh();
        this.control.addClass("is-open"); this.trigger.attr("aria-expanded", "true");
        this.popover?.open(this.trigger[0]);
        const items = this.options(), selected = items.filter('[aria-selected="true"]');
        this.setActive(focus === "last" ? items.last() : focus === "first" ? items.first() : selected.length ? selected.first() : items.first());
    }
    close(focus = false) { this.popover?.close(focus); }
    /** @param {any} item @param {boolean} [restoreFocus] */
    choose(item, restoreFocus = true) {
        if (!item.length || item.prop("disabled") || this.source.prop("disabled")) return this.close();
        this.source[0].selectedIndex = Number(item.attr("data-index"));
        this.emitChange(); this.close(restoreFocus);
    }
    /** Dispatch exactly one native change for both DOM and jQuery listeners. */
    emitChange() { this.source[0]?.dispatchEvent(new Event("change", { bubbles: true })); }
    refresh() {
        const source = this.source[0], selected = this.source.find("option:selected").first();
        const active = this.activeIndex;
        this.render();
        this.trigger.find(".jhs-select-value").text(selected.text());
        this.trigger.prop("disabled", source.disabled).attr("aria-disabled", String(source.disabled));
        for (const name of ["aria-labelledby", "aria-label", "aria-describedby", "aria-invalid"]) {
            const value = source.getAttribute(name);
            if (value != null) this.trigger.attr(name, value); else this.trigger.removeAttr(name);
        }
        if (!source.hasAttribute("aria-labelledby") && !source.hasAttribute("aria-label")) {
            const name = this.labels.map((/** @type {HTMLLabelElement} */ label) => {
                const copy = label.cloneNode(true);
                /** @type {Element} */ (copy).querySelectorAll("input,select,textarea,button,.jhs-select-control,.jhs-setting-row__description").forEach(node => node.remove());
                return copy.textContent?.trim() || "";
            }).filter(Boolean).join(" ");
            if (name) this.trigger.attr("aria-label", name);
        }
        this.trigger.attr("aria-required", String(source.required));
        for (const name of ["aria-labelledby", "aria-label"]) {
            const value = this.trigger.attr(name); if (value) this.menu.attr(name, value); else this.menu.removeAttr(name);
        }
        if (source.disabled) this.close();
        else if (this.popover?.opened) {
            const item = this.menu.find(`.jhs-select-option[data-index="${active}"]:not(:disabled)`);
            this.setActive(item.length ? item : this.options().first());
        }
    }
}
