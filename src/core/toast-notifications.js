// @ts-check
import { getIcon } from "./icons.js";

/** @typedef {{text?: unknown, node?: Node, duration?: number, close?: boolean, gravity?: string, position?: string, stopOnFocus?: boolean, oldestFirst?: boolean, ariaLive?: "assertive" | "polite", offset?: {x?: string | number, y?: string | number}, className?: string}} ToastOptions */
/** @typedef {{toastElement?: HTMLElement, showToast: () => void, closeShow?: () => void}} ToastHandle */

export function startLoading() {
    const container = document.createElement("div");
    container.className = "loading-container jhs-ui";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-label", "处理中");
    container.setAttribute("aria-busy", "true");
    const animation = document.createElement("div");
    animation.className = "loading-animation";
    animation.setAttribute("aria-hidden", "true");
    container.append(animation);
    document.body.append(container);
    return { close() { container.setAttribute("aria-busy", "false"); container.remove(); } };
}

/** @param {(options: ToastOptions) => ToastHandle} createToast */
export function createToastNotifications(createToast) {
    const icons = { info: "info", success: "circle-check", error: "triangle-alert" };
    /** @param {keyof typeof icons} kind */
    const notify = kind =>
        /** @param {unknown} text @param {string | ToastOptions} [gravity] @param {string | ToastOptions} [position] @param {ToastOptions} [options] */
        (text, gravity = "center", position, options) => {
            const custom = typeof gravity === "object"
                ? { ...gravity, gravity: gravity.gravity || "top", position: gravity.position || "center" }
                : { ...(typeof position === "object" ? position : options), gravity: gravity || "top", position: typeof position === "string" ? position : "center" };
            if (custom.gravity === "center") custom.offset = { y: "calc(50vh - 150px)" };

            const content = document.createElement("span");
            content.className = "jhs-toast__content";
            content.insertAdjacentHTML("beforeend", getIcon(icons[kind]));
            const message = document.createElement("span");
            message.className = "jhs-toast__message";
            message.textContent = String(text ?? "");
            content.append(message);
            const toast = createToast({
                text, node: content, duration: kind === "error" ? 5000 : 3000,
                close: kind === "error", stopOnFocus: true, oldestFirst: false,
                ariaLive: kind === "error" ? "assertive" : "polite",
                ...custom, ...(custom.duration === -1 ? { close: true } : {}),
                className: `jhs-toast jhs-ui jhs-toast--${kind}${custom.className ? ` ${custom.className}` : ""}`,
            });
            toast.showToast();
            toast.toastElement?.setAttribute("role", kind === "error" ? "alert" : "status");
            const close = toast.toastElement?.querySelector(".toast-close");
            if (close) {
                close.setAttribute("aria-label", "关闭提示");
                close.replaceChildren();
                close.insertAdjacentHTML("beforeend", getIcon("x"));
            }
            toast.closeShow = () => toast.toastElement?.remove();
            return toast;
        };
    return { ok: notify("success"), error: notify("error"), info: notify("info") };
}
