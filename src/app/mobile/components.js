// @ts-check
export const STATE_LABELS = Object.freeze({ favorite: "收藏", downloaded: "已下载", watched: "已看", blocked: "屏蔽" });

/** @template {"h2"|"small"|"span"} Tag @param {Tag} tag @param {string} text @param {string} [code] */
export function movieTitle(tag, text, code) {
    const title = el(tag, text, "movie-title-text");
    const original = text.trim();
    if (original && original.toUpperCase() !== code?.trim().toUpperCase()) title.dataset.movieTitle = original;
    return title;
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string | null} [text] @param {string} [className] */
export function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
}

/** @param {string} text @param {(event: MouseEvent) => unknown} handler @param {string} [className] */
export function button(text, handler, className) {
    const node = el("button", text, className);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
}

/** @param {Iterable<string[]>} options @param {string} label */
export function select(options, label) {
    const node = el("select");
    node.setAttribute("aria-label", label);
    for (const [value, text] of options) {
        const option = el("option", text);
        option.value = value;
        node.add(option);
    }
    return node;
}

/** @param {string} type @param {string} label */
export function input(type, label, value = "") {
    const field = el("input");
    field.type = type;
    field.placeholder = label;
    field.setAttribute("aria-label", label);
    field.value = value;
    return field;
}

/** @param {unknown} value @param {URL} [base] */
export function validHttps(value, base) {
    if (typeof value !== "string") return null;
    try {
        const url = new URL(value, base);
        return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

/** @param {unknown} value @param {string} className */
export function image(value, className) {
    const src = validHttps(value);
    if (!src) return el("span", null, className);
    const img = el("img", null, className);
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    return img;
}

/** @param {HTMLElement} root @param {string} title @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {boolean} [showClose] */
export function sheet(root, title, scope, showClose = true) {
    const dialog = el("dialog", null, "mobile-sheet glass");
    const heading = el("h2", title);
    heading.id = "sheet-" + crypto.randomUUID();
    dialog.setAttribute("aria-labelledby", heading.id);
    const header = el("header", null, "sheet-title");
    header.append(heading);
    if (showClose) header.append(button("关闭", () => dialog.close()));
    dialog.append(header);
    root.append(dialog);
    scope.addCleanup(() => { dialog.close(); dialog.remove(); });
    return dialog;
}
