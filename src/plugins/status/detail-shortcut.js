// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";
import { DETAIL_SHORTCUT_ACTIONS, readDetailShortcuts, shortcutFromEvent, shortcutLabel, shortcutMatches } from "../../core/detail-shortcuts.js";

export class DetailShortcutPlugin extends BasePlugin {
    renderShortcuts = () => {};

    getName() { return "DetailShortcutPlugin"; }

    afterPluginsReady() { this.renderShortcuts(); }

    async handle() {
        if (!("isDetailPage" in window) || !window.isDetailPage) return;
        const scope = await this.getRuntimeService("scope")(), settings = this.getRuntimeService("settings");
        if (window.parent !== window) window.focus();
        const style = document.createElement("style");
        style.textContent = ".jhs-shortcut-hint { font: inherit; font-size: 0.85em; margin-inline-start: 0.4em; }";
        document.head.append(style);
        scope.addCleanup(() => style.remove());
        const render = () => {
            const shortcuts = readDetailShortcuts(settings.snapshot().detailShortcuts);
            for (const [key, action] of Object.entries(DETAIL_SHORTCUT_ACTIONS)) {
                const button = document.getElementById(action.id);
                if (!button) continue;
                button.querySelector(".jhs-shortcut-hint")?.remove();
                button.removeAttribute("aria-keyshortcuts");
                const shortcut = shortcuts[key];
                if (!shortcut) continue;
                const hint = document.createElement("kbd");
                hint.className = "jhs-shortcut-hint";
                hint.textContent = shortcutLabel(shortcut);
                button.append(hint);
                button.setAttribute("aria-keyshortcuts", shortcutLabel(shortcut).replace("Ctrl+", "Control+").replace(/Key(?=[A-Z]$)|Digit(?=\d$)/g, ""));
            }
        };
        this.renderShortcuts = render;
        render();
        scope.listen(settings, "settings.changed", render);
        scope.listen(document, "keydown", (event = new Event("keydown")) => {
            if (!(event instanceof window.KeyboardEvent) || event.defaultPrevented) return;
            const target = event.target;
            if (target instanceof window.Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
            if ([...document.querySelectorAll('.layui-layer, [role="dialog"], [aria-modal="true"]')].some(element => {
                const ownStyle = window.getComputedStyle(element);
                if (element.hasAttribute("hidden") || ownStyle.display === "none" || ownStyle.visibility === "hidden" || ownStyle.visibility === "collapse") return false;
                for (let current = element.parentElement; current; current = current.parentElement) {
                    const style = window.getComputedStyle(current);
                    if (current.hasAttribute("hidden") || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
                }
                return true;
            })) return;
            const pressed = shortcutFromEvent(event);
            if (!pressed) return;
            const shortcuts = readDetailShortcuts(settings.snapshot().detailShortcuts);
            const matches = Object.entries(DETAIL_SHORTCUT_ACTIONS).filter(([key]) => shortcutMatches(shortcuts[key], pressed));
            if (matches.length !== 1) return;
            const button = document.getElementById(matches[0][1].id);
            if (!(button instanceof window.HTMLButtonElement) || button.disabled || button.hidden || !button.hasAttribute("aria-pressed") || window.getComputedStyle(button).display === "none") return;
            event.preventDefault();
            button.click();
        });
        scope.addCleanup(() => {
            for (const action of Object.values(DETAIL_SHORTCUT_ACTIONS)) {
                const button = document.getElementById(action.id);
                button?.querySelector(".jhs-shortcut-hint")?.remove();
                button?.removeAttribute("aria-keyshortcuts");
            }
        });
    }
}
