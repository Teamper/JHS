// @ts-check
import { getIcon } from "../../core/icons.js";

export const PERSONAL_RATING_STYLES = `
.jhs-personal-rating { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-2); margin-block:var(--jhs-space-3); color:var(--jhs-text); }
.jhs-rating-stars { display:inline-flex; gap:var(--jhs-space-1); }
.jhs-rating-stars .jhs-btn { padding:var(--jhs-space-2); }
.jhs-rating-stars [data-filled="true"] svg { fill:currentColor; }
.jhs-rating-status { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
.jhs-rating-badge { display:inline-flex; margin:var(--jhs-space-1); }
.jhs-rating-badge[hidden] { display:none; }
.jhs-rating-movies { max-height:220px; overflow:auto; overscroll-behavior:contain; }
`;

/** @param {{document: Document, scope: any, rating: number | null, mixed?: boolean, onChange: (value: number | null) => Promise<void>}} options */
export function createPersonalRatingControl({ document, scope, rating, mixed = false, onChange }) {
    const root = document.createElement("div"), label = document.createElement("span"), group = document.createElement("div"), clear = document.createElement("button"), status = document.createElement("span");
    root.className = "jhs-personal-rating jhs-ui";
    label.textContent = "个人评分";
    group.className = "jhs-rating-stars";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "个人评分");
    clear.type = "button";
    clear.className = "jhs-btn jhs-btn--secondary jhs-btn--sm";
    clear.textContent = "清除评分";
    status.className = "jhs-rating-status";
    status.setAttribute("role", "status");
    root.append(label, group, clear, status);
    let current = rating, busy = false;
    /** @type {HTMLButtonElement[]} */ const stars = [];
    const render = () => {
        for (let index = 0; index < stars.length; index++) {
            const button = stars[index], value = index + 1;
            button.setAttribute("aria-checked", String(value === current));
            button.setAttribute("aria-disabled", String(busy));
            button.setAttribute("data-filled", String(value <= (current || 0)));
            button.tabIndex = value === (current || 1) ? 0 : -1;
        }
        clear.setAttribute("aria-disabled", String(busy || current === null && !mixed));
        root.setAttribute("aria-busy", String(busy));
        status.textContent = busy ? "正在保存" : mixed ? "所选影片评分不同" : current ? `${current} / 5` : "未评分";
    };
    const save = async (/** @type {number | null} */ value) => {
        if (busy || scope.disposed || !root.isConnected || value === current && !mixed) return;
        busy = true;
        render();
        let failed = false;
        try { await onChange(value); if (!scope.disposed) { current = value; mixed = false; } }
        catch { failed = true; }
        finally {
            busy = false;
            if (!scope.disposed && root.isConnected) { render(); if (failed) status.textContent = "评分保存失败，请重试"; }
        }
    };
    for (let value = 1; value <= 5; value++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--ghost jhs-btn--sm";
        button.setAttribute("role", "radio");
        button.setAttribute("aria-label", `${value} 星`);
        button.innerHTML = getIcon("star");
        group.append(button);
        stars.push(button);
        scope.listen(button, "click", () => { void save(value); });
        scope.listen(button, "keydown", (/** @type {KeyboardEvent} */ event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            const target = event.key === "Home" ? 1 : event.key === "End" ? 5 : Math.max(1, Math.min(5, value + (event.key === "ArrowLeft" ? -1 : 1)));
            stars[target - 1].focus();
            void save(target);
        });
    }
    scope.listen(clear, "click", () => { if (current !== null || mixed) void save(null); });
    render();
    return { root, update: (/** @type {number | null} */ value) => { if (!scope.disposed && !busy) { current = value; render(); } } };
}
