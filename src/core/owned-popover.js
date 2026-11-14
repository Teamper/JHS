// @ts-check
import { dismissActiveTooltip } from "./tooltip-controller.js";
import { JHS_Z_INDEX } from "./theme.js";

/** @type {WeakMap<Document, OwnedPopover>} */
const activeByDocument = new WeakMap();

/** Logical dialog children mounted outside clipping ancestors. @param {Element} owner */
export function ownedPopoverRoots(owner) {
    const active = activeByDocument.get(owner.ownerDocument);
    return active && owner.contains(active.anchor) ? [active.menu] : [];
}

/** Close the active portal without stealing focus from an outside action. @param {Document} document @param {boolean} [restoreFocus] */
export function closeOwnedPopover(document, restoreFocus = false) { activeByDocument.get(document)?.close(restoreFocus); }

/** One lifecycle-owned, keyboard-operable portal per document. */
export class OwnedPopover {
    /** @param {HTMLElement} anchor @param {HTMLElement} menu @param {{onClose?: () => void, manageKeyboard?: boolean}} [options] */
    constructor(anchor, menu, options = {}) {
        this.anchor = anchor;
        this.menu = menu;
        this.options = options;
        this.opened = false;
        /** @type {Comment | null} */ this.placeholder = null;
        /** @type {MutationObserver | null} */ this.observer = null;
        this.reposition = () => this.position();
        this.outside = (/** @type {Event} */ event) => {
            const target = /** @type {Node} */ (event.target);
            if (!this.menu.contains(target) && !this.anchor.contains(target)) this.close();
        };
        this.keyboard = (/** @type {KeyboardEvent} */ event) => {
            if (event.key === "Escape" && dismissActiveTooltip(this.menu.ownerDocument)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
            if (this.options.manageKeyboard === false) {
                if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); this.close(true); }
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault(); event.stopImmediatePropagation(); this.close(true);
            } else if (event.key === "Tab" && this.menu.contains(/** @type {Node} */ (event.target))) this.close(true);
            else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && this.menu.contains(/** @type {Node} */ (event.target))) {
                event.preventDefault(); event.stopImmediatePropagation();
                const items = this.items(), index = items.indexOf(/** @type {HTMLElement} */ (this.menu.ownerDocument.activeElement));
                const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
            }
        };
    }
    items() { return [...this.menu.querySelectorAll('button:not(:disabled),a[href],[role="menuitem"]')].filter(node => !node.hasAttribute("disabled")).map(node => /** @type {HTMLElement} */ (node)); }
    /** @param {HTMLElement | null} [focus] */
    open(focus = null) {
        if (this.opened) return;
        const doc = this.anchor.ownerDocument;
        if (this.options.manageKeyboard !== false) dismissActiveTooltip(doc);
        activeByDocument.get(doc)?.close(); activeByDocument.set(doc,this); this.opened = true;
        this.placeholder = doc.createComment("jhs-popover-anchor");
        this.menu.before(this.placeholder);
        this.menu.classList.add("jhs-ui", "jhs-popover", "jhs-scrollbar", "jhs-owned-popover", "is-open");
        this.menu.hidden = false;
        doc.body.append(this.menu);
        this.anchor.setAttribute("aria-expanded", "true");
        doc.addEventListener("pointerdown", this.outside, true);
        doc.addEventListener("keydown", this.keyboard, true);
        doc.addEventListener("scroll", this.reposition, true);
        doc.defaultView?.addEventListener("resize", this.reposition);
        doc.defaultView?.visualViewport?.addEventListener("resize", this.reposition);
        doc.defaultView?.visualViewport?.addEventListener("scroll", this.reposition);
        this.observer = new (/** @type {Window & typeof globalThis} */ (doc.defaultView).MutationObserver)(() => { if (!this.anchorAvailable()) this.close(); });
        this.observer.observe(doc.body, {childList:true, subtree:true, attributes:true, attributeFilter:["hidden","class","style"]});
        this.position(); if (this.opened) (focus || this.items()[0])?.focus();
    }
    anchorAvailable() {
        if (!this.anchor.isConnected || this.anchor.closest("[hidden]")) return false;
        const view = this.anchor.ownerDocument.defaultView;
        for (let node = /** @type {HTMLElement | null} */ (this.anchor); node; node = node.parentElement) {
            const style = view?.getComputedStyle(node);
            if (style?.display === "none" || style?.visibility === "hidden") return false;
        }
        return true;
    }
    position() {
        if (!this.opened) return;
        if (!this.anchorAvailable()) return this.close();
        const view = this.anchor.ownerDocument.defaultView, viewport = view?.visualViewport;
        const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0, width = viewport?.width || view?.innerWidth || 0, height = viewport?.height || view?.innerHeight || 0;
        const anchorRect = this.anchor.getBoundingClientRect();
        if (anchorRect.width > 0) {
            if (anchorRect.bottom <= top || anchorRect.top >= top + height || anchorRect.right <= left || anchorRect.left >= left + width) return this.close();
            for (let node = this.anchor.parentElement; node && node !== this.anchor.ownerDocument.body; node = node.parentElement) {
                const style = view?.getComputedStyle(node);
                if (!/(auto|scroll|hidden|clip)/.test(`${style?.overflowX} ${style?.overflowY}`)) continue;
                const bounds = node.getBoundingClientRect();
                if (anchorRect.bottom <= bounds.top || anchorRect.top >= bounds.bottom || anchorRect.right <= bounds.left || anchorRect.left >= bounds.right) return this.close();
            }
        }
        const rect = anchorRect, availableBelow = top + height - rect.bottom - 16, availableAbove = rect.top - top - 16;
        const above = availableBelow < Math.min(320, this.menu.scrollHeight) && availableAbove > availableBelow;
        const menuWidth = Math.max(0, Math.min(Math.max(rect.width, 240), 360, width - 16));
        const owner = this.anchor.closest(".layui-layer"), z = owner ? Number(view?.getComputedStyle(owner).zIndex) || 0 : 0;
        Object.assign(this.menu.style, {position:"fixed", display:"grid", width:`${menuWidth}px`, minWidth:"0", maxWidth:`${Math.max(0,width-16)}px`, maxHeight:`${Math.max(0,Math.min(320,above ? availableAbove : availableBelow))}px`, left:`${Math.max(left+8,Math.min(rect.left,left+width-menuWidth-8))}px`, top:"auto", right:"auto", bottom:"auto", zIndex:String(Math.max(JHS_Z_INDEX.pagePopover,z+1))});
        const menuHeight = this.menu.getBoundingClientRect().height;
        const desiredTop = above ? rect.top-menuHeight-8 : rect.bottom+8;
        this.menu.style.top = `${Math.max(top+8,Math.min(desiredTop,top+height-menuHeight-8))}px`;
    }
    /** @param {boolean} [restoreFocus] */
    close(restoreFocus = false) {
        if (!this.opened) return;
        this.opened = false;
        const doc = this.anchor.ownerDocument;
        dismissActiveTooltip(doc, this.menu); dismissActiveTooltip(doc, this.anchor);
        doc.removeEventListener("pointerdown", this.outside, true); doc.removeEventListener("keydown", this.keyboard, true); doc.removeEventListener("scroll", this.reposition, true);
        doc.defaultView?.removeEventListener("resize", this.reposition);
        doc.defaultView?.visualViewport?.removeEventListener("resize", this.reposition); doc.defaultView?.visualViewport?.removeEventListener("scroll", this.reposition);
        this.observer?.disconnect(); this.observer = null;
        this.menu.classList.remove("is-open", "jhs-owned-popover"); this.menu.removeAttribute("style");
        if (this.placeholder?.isConnected) this.placeholder.replaceWith(this.menu); else this.menu.remove();
        this.placeholder = null; this.anchor.setAttribute("aria-expanded", "false");
        if (activeByDocument.get(doc) === this) activeByDocument.delete(doc);
        this.options.onClose?.();
        if (restoreFocus && this.anchor.isConnected) this.anchor.focus();
    }
}
