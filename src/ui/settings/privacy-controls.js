// @ts-check
import { readDetailShortcuts, shortcutFromEvent, shortcutLabel, shortcutMatches } from "../../core/detail-shortcuts.js";

export const PRIVACY_STYLES = `
html[data-jhs-privacy-active] [data-jhs-privacy-text] { color:transparent!important; text-shadow:none!important; background:var(--jhs-surface-2)!important; user-select:none; }
html[data-jhs-privacy-active] [data-jhs-privacy-media] { visibility:hidden!important; }
.jhs-privacy-tools { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); align-items:center; }
.jhs-privacy-config { display:flex; flex-direction:column; gap:var(--jhs-space-3); padding:var(--jhs-space-4); color:var(--jhs-text); background:var(--jhs-bg); }
.jhs-privacy-config label { display:flex; gap:var(--jhs-space-2); align-items:center; }
.jhs-privacy-config label.jhs-privacy-config__shortcut { flex-direction:column; align-items:stretch; }
.jhs-privacy-config input[type=text] { min-width:0; width:100%; font:inherit; color:var(--jhs-text); background:var(--jhs-surface); border:1px solid var(--jhs-border); padding:var(--jhs-space-2); }
`;

/** @param {{document: Document, scope: any, settings: any, onClose: () => void}} options */
export function createPrivacyPreferences({ document, scope, settings, onClose }) {
    const root = document.createElement("div");
    root.className = "jhs-privacy-config";
    const values = settings.snapshot();
    const selected = Array.isArray(values.privacyTargets) ? values.privacyTargets : ["title", "code", "actors", "images", "video"];
    /** @type {Map<string, HTMLInputElement>} */ const inputs = new Map();
    for (const [value, text] of Object.entries({ title: "影片标题", code: "番号", actors: "演员信息", images: "封面与截图", video: "视频画面" })) {
        const label = document.createElement("label"), input = document.createElement("input");
        input.type = "checkbox";
        input.checked = selected.includes(value);
        inputs.set(value, input);
        label.append(input, text);
        root.append(label);
    }
    const label = document.createElement("label"), shortcut = document.createElement("input");
    let binding = values.privacyShortcut || null;
    shortcut.type = "text";
    shortcut.readOnly = true;
    shortcut.placeholder = "按键录制，Backspace 清除";
    shortcut.value = shortcutLabel(binding);
    label.className = "jhs-privacy-config__shortcut";
    label.append("切换快捷键", shortcut);
    root.append(label);
    scope.listen(shortcut, "keydown", (/** @type {KeyboardEvent} */ event) => {
        if (["Tab", "Escape"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        binding = ["Backspace", "Delete"].includes(event.key) ? null : shortcutFromEvent(event) || binding;
        shortcut.value = shortcutLabel(binding);
    });
    const note = document.createElement("p");
    note.textContent = "遮罩从脚本运行后生效。首次加载可能短暂显示内容。临时查看松开后恢复，视频需手动继续播放。";
    const status = document.createElement("p"), save = document.createElement("button");
    status.setAttribute("role", "status");
    save.type = "button";
    save.className = "jhs-btn jhs-btn--primary";
    save.textContent = "保存遮罩偏好";
    scope.listen(save, "click", async () => {
        save.disabled = true;
        try {
            if (binding && Object.values(readDetailShortcuts(settings.snapshot().detailShortcuts)).some(value => shortcutMatches(value, binding))) {
                status.textContent = "该快捷键已用于影片状态操作，请换一个快捷键";
                save.disabled = false;
                return;
            }
            await settings.patch({ privacyTargets: [...inputs].filter(([, input]) => input.checked).map(([key]) => key), privacyShortcut: binding });
            if (!scope.disposed) onClose();
        } catch { if (!scope.disposed) { status.textContent = "保存失败，请重试"; save.disabled = false; } }
    });
    root.append(note, status, save);
    return root;
}
