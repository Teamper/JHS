// @ts-check
import { escapeHtml } from "./constants.js";
import { prepareDialogOptions } from "./dialog-shell.js";
import { getIcon } from "./icons.js";
import { JHS_Z_INDEX } from "./theme.js";

/** @typedef {"base" | "warn" | "error" | "debug"} LogLevel */
/** @typedef {{message: string, type: LogLevel, json: boolean, html: boolean, timestamp: Date}} LogEntry */
/** @typedef {{getDialogArea: (size?: string) => [string, string], setupEscClose?: (index: number) => void, releaseEscClose?: (index: number) => void}} DialogUi */

const labels = { base: "信息", warn: "警告", error: "错误", debug: "调试" };
const filters = { base: ["base", "warn", "error"], warn: ["warn"], error: ["error"], debug: Object.keys(labels) };
export const logFilterKey = "jhs_clog_filter";
const expandKey = "jhs_clog_expand";
const maximizeKey = "jhs_clog_maximize";
const urlPattern = /(?:(?:https?|ftp):\/\/|www\.|\/\/)[-A-Z0-9+&@#/%.?=~_|!:,;]*[-A-Z0-9+&@#/%=~_|]/gi;

/** @param {unknown} level @returns {level is LogLevel} */
export function isLogLevel(level) {
    return typeof level === "string" && Object.hasOwn(labels, level);
}

/** @param {string} url */
function linkHref(url) {
    if (url.startsWith("//")) return `http:${url}`;
    return url.startsWith("www.") ? `http://${url}` : url;
}

/** @param {LogEntry} entry */
function renderEntry(entry) {
    const row = document.createElement("div");
    row.className = "console-logger-entry";
    row.dataset.type = entry.type;
    const time = document.createElement("span");
    time.className = "console-logger-timestamp";
    time.textContent = `[${entry.timestamp.toTimeString().split(" ")[0]}]`;
    const message = document.createElement("span");
    message.className = "console-logger-message";
    message.dataset.type = entry.json ? "json" : "msg";
    if (entry.html) {
        message.innerHTML = entry.message.replace(urlPattern, url =>
            `<a href="${escapeHtml(linkHref(url))}" target="_blank">${escapeHtml(url)}</a>`);
    } else {
        const text = entry.message.replace(/<br\s*\/?>/gi, "\n");
        let previous = 0;
        for (const match of text.matchAll(urlPattern)) {
            const [url] = match;
            const index = match.index ?? previous;
            message.append(text.slice(previous, index));
            const link = document.createElement("a");
            link.href = linkHref(url);
            link.target = "_blank";
            link.textContent = url;
            message.append(link);
            previous = index + url.length;
        }
        message.append(text.slice(previous));
    }
    row.append(time, message);
    return row;
}

/** @param {string} className @param {string} [text] */
function button(className, text) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    if (text) element.textContent = text;
    return element;
}

/** @param {import("./lifecycle-scope.js").LifecycleScope} scope @param {{entries: () => LogEntry[], filter: () => LogLevel, changeFilter: (level: LogLevel) => void, clear: () => void, copy?: (value: string) => Promise<unknown>}} model */
export function createLogPanel(scope, model) {
    const container = document.createElement("div");
    container.className = "console-logger-container jhs-ui";
    container.style.display = "none";
    const toggle = button("console-logger-toggle collapsed");
    toggle.setAttribute("aria-label", "展开或收起运行日志");
    toggle.innerHTML = getIcon("chevron-down");
    const panel = document.createElement("div");
    panel.className = "console-logger-window collapsed";
    const header = document.createElement("div");
    header.className = "console-logger-header";
    const title = document.createElement("div");
    title.className = "console-logger-title";
    title.textContent = "JHS 运行日志";
    const controls = document.createElement("div");
    controls.className = "console-logger-controls";
    const maximize = button("console-logger-maximize-toggle");
    const clear = button("", "清空");
    clear.addEventListener("click", model.clear);
    const copy = button("", "复制全部日志");
    if (model.copy) {
        scope.listen(copy, "click", () => {
            const value = model.entries().map(entry => `[${entry.timestamp.toLocaleTimeString()}] ${labels[entry.type]} ${renderEntry(entry).textContent.replace(/^\[[^\]]*\]\s*/u, "")}`).join("\n");
            void model.copy?.(value);
        });
        controls.append(copy);
    }
    controls.append(maximize, clear);
    header.append(title, controls);
    const filterBar = document.createElement("div");
    filterBar.className = "console-logger-filters";
    const filterGroup = document.createElement("div");
    filterGroup.className = "console-logger-filter-group";
    for (const key of Object.keys(labels)) {
        const level = /** @type {LogLevel} */ (key);
        const filter = button("jhs-btn console-logger-filter", labels[level]);
        filter.dataset.type = level;
        filter.addEventListener("click", () => model.changeFilter(level));
        filterGroup.append(filter);
    }
    const bottom = button("console-logger-scroll-to-bottom", "到底部");
    const search = document.createElement("input");
    search.type = "search"; search.className = "jhs-field"; search.placeholder = "搜索日志";
    search.setAttribute("aria-label", "搜索日志");
    filterBar.append(filterGroup, search, bottom);
    const content = document.createElement("div");
    content.className = "console-logger-content jhs-scrollbar";
    panel.append(header, filterBar, content);
    container.append(toggle, panel);
    document.body.append(container);
    scope.addCleanup(() => { document.body.removeAttribute("data-jhs-debug-visible"); container.remove(); });

    let userScrolledUp = false, dialogOpen = false;
    const scrollToBottom = () => { content.scrollTop = content.scrollHeight; userScrolledUp = false; };
    const visible = () => dialogOpen || container.style.display !== "none" && !panel.classList.contains("collapsed");
    const matches = (/** @type {LogEntry} */ entry) => filters[model.filter()].includes(entry.type) && entry.message.toLowerCase().includes(search.value.trim().toLowerCase());
    const update = () => {
        const currentFilter = model.filter();
        for (const filter of filterGroup.querySelectorAll("button")) filter.classList.toggle("active", filter.dataset.type === currentFilter);
        if (!visible()) return;
        setTimeout(() => {
            if (scope.disposed || !visible()) return;
            content.replaceChildren(...model.entries().filter(matches).map(renderEntry));
            scrollToBottom();
        }, 0);
    };
    /** @param {boolean} expanded */
    const setExpanded = expanded => {
        panel.classList.toggle("collapsed", !expanded);
        toggle.classList.toggle("collapsed", !expanded);
        toggle.setAttribute("aria-expanded", String(expanded));
    };
    /** @param {boolean} expanded */
    const setMaximized = expanded => {
        panel.classList.toggle("maximized", expanded);
        maximize.classList.toggle("active", expanded);
        maximize.innerHTML = getIcon(expanded ? "minimize-2" : "maximize-2");
        maximize.setAttribute("aria-label", expanded ? "还原日志窗口" : "放大日志窗口");
        maximize.setAttribute("aria-pressed", String(expanded));
    };
    const toggleExpand = () => {
        const expand = panel.classList.contains("collapsed");
        setExpanded(expand);
        localStorage.setItem(expandKey, expand ? "yes" : "no");
        if (expand) update();
    };
    const toggleMaximize = () => {
        const expand = !panel.classList.contains("maximized");
        setMaximized(expand);
        localStorage.setItem(maximizeKey, expand ? "maximized" : "minimized");
        if (!panel.classList.contains("collapsed")) scrollToBottom();
    };
    const initialExpand = localStorage.getItem(expandKey);
    setExpanded(Boolean(initialExpand && initialExpand !== "no"));
    setMaximized(localStorage.getItem(maximizeKey) === "maximized");
    update();
    scope.listen(search, "input", update);
    toggle.addEventListener("click", toggleExpand);
    maximize.addEventListener("click", toggleMaximize);
    bottom.addEventListener("click", scrollToBottom);
    content.addEventListener("scroll", () => {
        userScrolledUp = content.scrollHeight - content.clientHeight > content.scrollTop + 5;
    });
    content.addEventListener("wheel", event => {
        const atTop = content.scrollTop === 0;
        const atBottom = content.scrollHeight - content.clientHeight <= content.scrollTop + 1;
        if (atTop && event.deltaY < 0 || atBottom && event.deltaY > 0) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, { passive: false });

    return {
        container, toggle, maximize, content, update, toggleExpand, toggleMaximize,
        show() { container.style.display = ""; document.body.setAttribute("data-jhs-debug-visible", "true"); update(); },
        hide() { container.style.display = "none"; document.body.removeAttribute("data-jhs-debug-visible"); },
        setRaised(/** @type {boolean} */ raised) { container.style.zIndex = String(raised ? JHS_Z_INDEX.debug : JHS_Z_INDEX.debugLow); },
        append(/** @type {LogEntry} */ entry, /** @type {LogEntry | undefined} */ evicted) {
            if (evicted && matches(evicted)) content.firstElementChild?.remove();
            if (!visible() || !matches(entry)) return;
            content.append(renderEntry(entry));
            if (!userScrolledUp) scrollToBottom();
        },
        /** @param {{open: (options: Record<string, unknown>) => unknown}} layer @param {DialogUi} dialog */
        openDialog(layer, dialog) {
            if (dialogOpen) return;
            const host = document.createElement("div");
            const originalParent = panel.parentNode, originalStyle = panel.getAttribute("style");
            host.className = "jhs-ui jhs-logger-dialog";
            host.style.height = "100%";
            panel.classList.remove("collapsed", "maximized");
            Object.assign(panel.style, { width: "100%", height: "100%", border: "0", borderRadius: "0", boxShadow: "none" });
            /** @type {number | undefined} */
            let index;
            layer.open(prepareDialogOptions({
                type: 1, zIndex: JHS_Z_INDEX.layer, scrollbar: false, ui: { size: "md", body: "scroll" },
                title: "JHS 运行日志", content: host.outerHTML, area: dialog.getDialogArea("md"), anim: -1,
                success(/** @type {HTMLElement | {0: HTMLElement}} */ element, /** @type {number} */ id) {
                    index = id;
                    dialog.setupEscClose?.(id);
                    const root = element instanceof HTMLElement ? element : element[0];
                    root.querySelector(".jhs-logger-dialog")?.append(panel);
                    dialogOpen = true;
                    update();
                },
                end() {
                    dialogOpen = false;
                    if (index != null) dialog.releaseEscClose?.(index);
                    originalParent?.appendChild(panel);
                    if (originalStyle === null) panel.removeAttribute("style");
                    else panel.setAttribute("style", originalStyle);
                    setExpanded(false);
                },
            }, dialog));
        },
    };
}
