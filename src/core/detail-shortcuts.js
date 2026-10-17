// @ts-check

export const DETAIL_SHORTCUT_ACTIONS = Object.freeze({
    blocked: { id: "filterBtn", label: "屏蔽" },
    favorite: { id: "favoriteBtn", label: "收藏" },
    downloaded: { id: "hasDownBtn", label: "已下载" },
    watched: { id: "hasWatchBtn", label: "已观看" }
});

export function shortcutFromEvent(event = new KeyboardEvent("keydown")) {
    if (event.isComposing || event.repeat || !event.code || /^(Control|Shift|Alt|Meta)/.test(event.code) || ["Escape", "Tab", "Unidentified"].includes(event.code)) return null;
    return { code: event.code, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey };
}

export function shortcutLabel(shortcut = Object.create(null)) {
    if (!shortcut || typeof shortcut.code !== "string") return "";
    const key = shortcut.code.replace(/^Key(?=[A-Z]$)|^Digit(?=\d$)/g, "");
    return [shortcut.ctrl && "Ctrl", shortcut.alt && "Alt", shortcut.shift && "Shift", shortcut.meta && "Meta", key].filter(Boolean).join("+");
}

export function shortcutMatches(left = Object.create(null), right = Object.create(null)) {
    return !!left && !!right && left.code === right.code && ["ctrl", "alt", "shift", "meta"].every(key => !!left[key] === !!right[key]);
}

export function readDetailShortcuts(value = Object.create(null)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return Object.create(null);
    return Object.fromEntries(Object.keys(DETAIL_SHORTCUT_ACTIONS).filter(key => {
        const item = value[key];
        return item && typeof item.code === "string" && /^[A-Za-z][A-Za-z0-9]*$/.test(item.code) && !/^(Control|Shift|Alt|Meta)/.test(item.code) && !["Escape", "Tab", "Unidentified"].includes(item.code);
    }).map(key => [key, value[key]]));
}
