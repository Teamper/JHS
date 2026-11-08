// @ts-check

import { DETAIL_SHORTCUT_ACTIONS, readDetailShortcuts, shortcutFromEvent, shortcutLabel, shortcutMatches } from "../../core/detail-shortcuts.js";
import { parseDisabledPlugins } from "../../core/legacy-plugin-contributions.js";

export const SHORTCUT_RECORDER_STYLES = `
    #detail-shortcut-settings .jhs-setting-row { grid-template-columns:64px minmax(0,1fr); gap:var(--jhs-space-3); }
    #detail-shortcut-settings .jhs-setting-row__control { width:100%; }
    .jhs-shortcut-fields { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--jhs-space-2); min-width:0; width:100%; }
    .jhs-shortcut-fields .jhs-field { min-width:0; width:100%; }
    .jhs-shortcut-feedback { grid-column:1/-1; min-height:1.5em; margin:0; overflow-wrap:anywhere; color:var(--jhs-text-muted); }
    @media(max-width:767px) { #detail-shortcut-settings .jhs-setting-row { grid-template-columns:minmax(0,1fr); } }
`;

/** @param {{root: Element, settings: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, onManage: () => void, deferred?: boolean}} options */
export function bindShortcutRecorder({ root, settings, scope, onManage, deferred = false }) {
    const inputs = [...root.querySelectorAll("[data-shortcut-action]")].map(node => /** @type {HTMLInputElement} */ (node));
    const clearButtons = [...root.querySelectorAll("[data-shortcut-clear]")].map(node => /** @type {HTMLButtonElement} */ (node));
    const alive = () => !scope.disposed && root.isConnected;
    const render = () => {
        if (!alive()) return;
        const snapshot = settings.snapshot(), shortcuts = readDetailShortcuts(snapshot.detailShortcuts);
        const disabled = parseDisabledPlugins(snapshot.disabledPlugins).some(id => ["detail", "detail.shortcuts", "DetailShortcutPlugin"].includes(id));
        const notice = root.querySelector("[data-shortcut-disabled]");
        if (notice) notice.toggleAttribute("hidden", !disabled);
        for (const input of inputs) {
            input.value = shortcutLabel(shortcuts[/** @type {keyof typeof DETAIL_SHORTCUT_ACTIONS} */ (input.dataset.shortcutAction)]);
            input.disabled = disabled;
        }
        for (const button of clearButtons) button.disabled = disabled;
    };
    /** @param {string} key @param {string} text */
    const feedback = (key, text) => {
        if (!alive()) return;
        const status = root.querySelector(`[data-shortcut-status="${key}"]`);
        if (status) status.textContent = text;
    };
    /** @param {keyof typeof DETAIL_SHORTCUT_ACTIONS} key @param {import("../../core/detail-shortcuts.js").DetailShortcut | null} shortcut */
    const save = async (key, shortcut) => {
        try {
            await settings.update((/** @type {Record<string, unknown>} */ draft) => {
                const shortcuts = readDetailShortcuts(draft.detailShortcuts);
                if (shortcut && shortcutMatches(readDetailShortcuts({ favorite: draft.privacyShortcut }).favorite, shortcut)) throw new Error("该快捷键已被隐私遮罩使用");
                const conflict = shortcut && Object.entries(DETAIL_SHORTCUT_ACTIONS).find(([other]) => other !== key && shortcutMatches(shortcuts[/** @type {keyof typeof DETAIL_SHORTCUT_ACTIONS} */ (other)], shortcut));
                if (conflict) throw new Error(`该快捷键已被“${conflict[1].label}”使用`);
                if (shortcut) shortcuts[key] = shortcut; else delete shortcuts[key];
                draft.detailShortcuts = shortcuts;
            });
            feedback(key, shortcut ? (deferred ? "" : "已保存") : (deferred ? "" : "已清除"));
        } catch (error) {
            feedback(key, error instanceof Error && error.message.includes("已被") ? error.message : "保存失败，已保留原快捷键");
        } finally { render(); }
    };
    render();
    scope.listen(settings, "settings.changed", render);
    for (const input of inputs) {
        const key = /** @type {keyof typeof DETAIL_SHORTCUT_ACTIONS} */ (input.dataset.shortcutAction);
        scope.listen(input, "focus", () => feedback(key, deferred ? "" : "请按键录制；Escape 退出，Tab 切换"));
        scope.listen(input, "keydown", rawEvent => {
            const event = /** @type {KeyboardEvent} */ (rawEvent);
            if (input.disabled || event.key === "Tab") return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") { render(); input.blur(); feedback(key, "已退出录制"); return; }
            const shortcut = shortcutFromEvent(event);
            if (shortcut) void save(key, shortcut);
        });
    }
    for (const button of clearButtons) scope.listen(button, "click", () => { if (!button.disabled) void save(/** @type {keyof typeof DETAIL_SHORTCUT_ACTIONS} */ (button.dataset.shortcutClear), null); });
    const manage = root.querySelector("[data-shortcut-manage]");
    if (manage) scope.listen(manage, "click", onManage);
}
