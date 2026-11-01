// @ts-check

/** @type {WeakMap<Document, {trigger: HTMLElement, dismiss: () => void}>} */
const activeTooltips = new WeakMap();
let nextTooltipId = 0;
/** @type {WeakMap<HTMLElement, string>} */
const tooltipIds = new WeakMap();
const selector = "[data-tip],[data-tip-top],[data-tip-bottom],[data-tip-left],[data-tip-right],[title]";

/** Give tooltips priority over their containing menu or dialog. @param {Document} doc @param {Element} [owner] */
export function dismissActiveTooltip(doc, owner) {
    const active = activeTooltips.get(doc);
    if (!active || owner && !owner.contains(active.trigger)) return false;
    active.dismiss();
    return true;
}

/** Bind accessible, hoverable tooltips only to owned surfaces. @param {import("./lifecycle-scope.js").LifecycleScope} scope @param {Document} doc */
export function initializeTooltips(scope, doc) {
    const view = doc.defaultView;
    if (!view) return;
    /** @type {HTMLElement | null} */ let trigger = null;
    /** @type {HTMLElement | null} */ let tooltip = null;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let showTimer;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let hideTimer;
    const hide = () => {
        clearTimeout(showTimer); clearTimeout(hideTimer);
        if (trigger && tooltip) {
            const descriptions = (trigger.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== tooltip?.id);
            if (descriptions.length) trigger.setAttribute("aria-describedby", descriptions.join(" "));
            else trigger.removeAttribute("aria-describedby");
        }
        tooltip?.remove(); tooltip = null; trigger = null;
        activeTooltips.delete(doc);
    };
    const candidate = (/** @type {EventTarget | null} */ target, focused = false) => {
        const element = target instanceof view.Element ? /** @type {HTMLElement | null} */ (target.closest(selector)) : null;
        if (focused && element !== target && !(element instanceof view.HTMLLabelElement && element.control === target)) return null;
        if (!element?.closest(".jhs-ui,.jhs-dialog,.jhs-btn,.jhs-field,.jhs-switch,.mini-switch,.card-btn,.jhs-icon-btn,.jhs-link,.jhs-status-tags")) return null;
        const title = element.getAttribute("title");
        if (title) {
            if (!element.textContent?.trim() && !element.hasAttribute("aria-label") && !element.hasAttribute("aria-labelledby")) element.setAttribute("aria-label", title);
            if (!element.hasAttribute("data-tip")) element.setAttribute("data-tip", title);
            element.removeAttribute("title");
        }
        return element;
    };
    const position = () => {
        if (!trigger || !tooltip) return;
        if (!trigger.isConnected) return hide();
        const anchor = trigger.getBoundingClientRect(), rect = tooltip.getBoundingClientRect();
        const direction = ["bottom", "left", "right", "top"].find(side => trigger?.hasAttribute(`data-tip-${side}`)) || "top";
        let left = anchor.left + (anchor.width - rect.width) / 2;
        let top = direction === "bottom" ? anchor.bottom : anchor.top - rect.height;
        if (direction === "left" || direction === "right") {
            left = direction === "left" ? anchor.left - rect.width : anchor.right;
            top = anchor.top + (anchor.height - rect.height) / 2;
        } else if (top < 8) top = anchor.bottom;
        else if (top + rect.height > view.innerHeight - 8) top = anchor.top - rect.height;
        const menu = trigger.closest(".jhs-owned-popover");
        if (menu) {
            const bounds = menu.getBoundingClientRect();
            if (bounds.right + rect.width <= view.innerWidth - 8) left = bounds.right;
            else if (bounds.left - rect.width >= 8) left = bounds.left - rect.width;
            else { left = bounds.left; top = bounds.bottom; }
            if (left !== bounds.left) top = Math.max(bounds.top, anchor.top + (anchor.height - rect.height) / 2);
        }
        tooltip.style.left = `${Math.max(8, Math.min(left, view.innerWidth - rect.width - 8))}px`;
        tooltip.style.top = `${Math.max(8, Math.min(top, view.innerHeight - rect.height - 8))}px`;
    };
    const show = (/** @type {HTMLElement} */ element) => {
        clearTimeout(hideTimer);
        if (trigger === element && tooltip) return;
        hide();
        const text = ["bottom", "left", "right", "top"].map(side => element.getAttribute(`data-tip-${side}`)).find(Boolean) || element.getAttribute("data-tip");
        if (!text || !element.isConnected) return;
        trigger = element; tooltip = doc.createElement("div");
        tooltip.className = "js-tooltip jhs-ui is-active";
        const id = tooltipIds.get(element) || `jhs-tooltip-${++nextTooltipId}`;
        tooltipIds.set(element, id);
        tooltip.id = id; tooltip.setAttribute("role", "tooltip"); tooltip.textContent = text;
        element.setAttribute("aria-describedby", [...new Set([...(element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean), tooltip.id])].join(" "));
        doc.body.append(tooltip); activeTooltips.set(doc, { trigger: element, dismiss: hide }); position();
    };
    const scheduleHide = () => {
        clearTimeout(showTimer); clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (trigger && candidate(doc.activeElement, true) === trigger || trigger?.matches(":hover") || tooltip?.matches(":hover")) return;
            hide();
        }, 120);
    };
    scope.listen(doc, "pointerover", event => {
        if (tooltip?.contains(/** @type {Node} */ (event.target))) return void clearTimeout(hideTimer);
        const element = candidate(event.target);
        if (!element || element.contains(/** @type {Node | null} */ (/** @type {PointerEvent} */ (event).relatedTarget))) return;
        clearTimeout(showTimer); clearTimeout(hideTimer);
        if (!tooltip) activeTooltips.set(doc, { trigger: element, dismiss: hide });
        showTimer = setTimeout(() => show(element), 50);
    });
    scope.listen(doc, "pointerout", event => {
        const related = /** @type {PointerEvent} */ (event).relatedTarget;
        if (related && (trigger?.contains(/** @type {Node} */ (related)) || tooltip?.contains(/** @type {Node} */ (related)))) return;
        if (candidate(event.target) || tooltip?.contains(/** @type {Node} */ (event.target))) scheduleHide();
    });
    scope.listen(doc, "focusin", event => { const element = candidate(event.target, true); if (element) show(element); });
    scope.listen(doc, "focusout", scheduleHide);
    scope.listen(doc, "keydown", event => {
        const key = /** @type {KeyboardEvent} */ (event).key;
        if (key === "Escape" && dismissActiveTooltip(doc)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    scope.listen(doc, "scroll", position, true);
    scope.listen(view, "resize", position);
    scope.addCleanup(hide);
}
