// @ts-check

/** One compact extension menu per detail surface, released by its contributors. @param {Element} host @param {HTMLElement} button @param {any} scope @param {boolean} [inline] */
export function mountEnhancementAction(host, button, scope, inline = false) {
    const surface = host.closest("[data-jhs-movie-code],[data-jhs-workspace-site]") || host.closest("main") || host;
    const target = surface.querySelector('[data-jhs-slot="summary-actions"],.jhs-fc2-toolbar') || host;
    if (inline) {
        target.append(button);
        scope.addCleanup(() => button.remove());
        return;
    }
    let menu = surface.querySelector(".jhs-detail-extra-actions");
    if (!menu) {
        menu = host.ownerDocument.createElement("details");
        menu.className = "jhs-detail-extra-actions jhs-ui";
        const summary = host.ownerDocument.createElement("summary");
        summary.className = "jhs-btn jhs-btn--secondary";
        summary.textContent = "更多操作";
        menu.append(summary);
    }
    if (menu.parentElement !== target) target.append(menu);
    menu.append(button);
    scope.addCleanup(() => { button.remove(); if (menu?.children.length === 1) menu.remove(); });
}
