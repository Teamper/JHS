// @ts-check

import { DETAIL_SHORTCUT_ACTIONS, readDetailShortcuts, shortcutFromEvent, shortcutLabel, shortcutMatches } from "../../core/detail-shortcuts.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { parseDisabledPlugins } from "../../core/legacy-plugin-contributions.js";

export function bindShortcutRecorder(root = Object.create(null), settings = Object.create(null), scope = new LifecycleScope("shortcut-recorder")) {
    let disposed = false;
    const inputs = root.find("[data-shortcut-action]"), status = root.find("#shortcut-status");
    const render = () => {
        if (disposed) return;
        const disabled = parseDisabledPlugins(settings.snapshot().disabledPlugins).some(id => id === "detail.shortcuts" || id === "DetailShortcutPlugin");
        const tab = root.find('[data-panel="shortcut-panel"]');
        if (disabled && tab.hasClass("active")) root.find('[data-panel="base-panel"]').trigger("click");
        tab.prop("hidden", disabled).toggle(!disabled);
        const panel = root.find("#shortcut-panel");
        panel.prop("hidden", disabled);
        if (disabled) panel.hide();
        const shortcuts = readDetailShortcuts(settings.snapshot().detailShortcuts);
        for (const key of Object.keys(DETAIL_SHORTCUT_ACTIONS)) root.find(`[data-shortcut-action="${key}"]`).val(shortcutLabel(shortcuts[key]));
    };
    const save = async (key = "", shortcut = Object.create(null)) => {
        if (disposed) return;
        try {
            await settings.update((draft = Object.create(null)) => {
                const shortcuts = readDetailShortcuts(draft.detailShortcuts);
                if (shortcut) {
                    const conflict = Object.entries(DETAIL_SHORTCUT_ACTIONS).find(([other]) => other !== key && shortcutMatches(shortcuts[other], shortcut));
                    if (conflict) throw new Error(`该快捷键已被“${conflict[1].label}”使用`);
                    shortcuts[key] = shortcut;
                } else delete shortcuts[key];
                draft.detailShortcuts = shortcuts;
            });
            if (!disposed) status.text("快捷键已保存");
        } catch (error) {
            if (!disposed) status.text(error instanceof Error && error.message.includes("已被") ? error.message : "保存失败，已保留原快捷键");
        } finally { render(); }
    };
    render();
    inputs.off(".jhsShortcut").on("keydown.jhsShortcut", (event = Object.create(null)) => {
        if (event.key === "Tab") return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") { render(); event.currentTarget.blur(); return; }
        const shortcut = shortcutFromEvent(event.originalEvent || event);
        if (!shortcut) return;
        const key = event.currentTarget.dataset.shortcutAction;
        const conflict = Object.entries(DETAIL_SHORTCUT_ACTIONS).find(([other]) => other !== key && shortcutMatches(readDetailShortcuts(settings.snapshot().detailShortcuts)[other], shortcut));
        if (conflict) { status.text(`该快捷键已被“${conflict[1].label}”使用`); return; }
        void save(key, shortcut);
    });
    const clear = root.find("[data-shortcut-clear]");
    clear.off(".jhsShortcut").on("click.jhsShortcut", (event = Object.create(null)) => void save(event.currentTarget.dataset.shortcutClear, null));
    const unlisten = scope.listen(settings, "settings.changed", render);
    return scope.addCleanup(() => {
        disposed = true;
        inputs.off(".jhsShortcut");
        clear.off(".jhsShortcut");
        unlisten();
    });
}
