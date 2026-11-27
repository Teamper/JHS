// @ts-check
import { OwnedPopover } from "../../core/owned-popover.js";

/** @type {WeakMap<Element, {host: HTMLElement, menu: HTMLElement, popover: OwnedPopover}>} */
const actions = new WeakMap();

/** @param {Element} host @param {HTMLElement} button @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {boolean} [inline] */
export function mountEnhancementAction(host, button, scope, inline = false) {
    const surface = host.closest("[data-jhs-movie-code],[data-jhs-workspace-site]") ?? host.closest("main") ?? host;
    const target = surface.querySelector(".jhs-fc2-toolbar,.jhs-detail-extra-tools") ?? surface.querySelector('[data-jhs-slot="summary-actions"]') ?? host;
    if (inline) {
        target.append(button);
        scope.addCleanup(() => button.remove());
        return;
    }
    let panel = actions.get(surface);
    if (!panel) {
        const doc = host.ownerDocument;
        const wrapper = doc.createElement("div"), trigger = doc.createElement("button"), menu = doc.createElement("div");
        wrapper.className = "jhs-detail-extra-actions";
        trigger.type = "button";
        trigger.className = "jhs-btn jhs-btn--secondary";
        trigger.textContent = "更多操作";
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        menu.className = "jhs-popover";
        menu.setAttribute("role", "menu");
        wrapper.append(trigger, menu);
        const popover = new OwnedPopover(trigger, menu);
        menu.addEventListener("click", event => {
            if (/** @type {Element} */ (event.target)?.closest('button[role="menuitem"]:not([disabled]),a[role="menuitem"]')) popover.close(true);
        }, true);
        trigger.addEventListener("click", () => popover.opened ? popover.close(true) : popover.open());
        panel = { host: wrapper, menu, popover };
        actions.set(surface, panel);
    }
    target.append(panel.host);
    button.setAttribute("role", "menuitem");
    panel.menu.append(button);
    const owner = panel;
    scope.addCleanup(() => {
        button.remove();
        if (owner.menu.childElementCount) return;
        owner.popover.close();
        owner.host.remove();
        actions.delete(surface);
    });
}
