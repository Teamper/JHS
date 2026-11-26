// @ts-check
import { createImageViewer } from "./image-viewer.js";
import { ImageHoverPreview } from "./image-hover-preview.js";
import { createLogPanel, isLogLevel, logFilterKey } from "./log-panel.js";
import { createToastNotifications, startLoading } from "./toast-notifications.js";
import { initializeTooltips } from "./tooltip-controller.js";

/** @typedef {import("./lifecycle-scope.js").LifecycleScope} LifecycleScope */
/** @typedef {import("./log-panel.js").LogEntry} LogEntry */
/** @typedef {import("./log-panel.js").LogLevel} LogLevel */
/** @typedef {import("./log-panel.js").DialogUi & {isMobileMode?: () => boolean}} DialogUi */

class Logger {
    /** @param {LifecycleScope} scope @param {number} limit @param {{open: (options: Record<string, unknown>) => unknown} | undefined} layer @param {DialogUi | undefined} dialog */
    constructor(scope, limit, layer, dialog) {
        this.scope = scope;
        this.limit = limit;
        this.layer = layer;
        this.dialog = dialog;
        const previousFilter = localStorage.getItem(logFilterKey);
        /** @type {LogLevel} */
        this.currentFilter = isLogLevel(previousFilter) ? previousFilter : "base";
        /** @type {LogEntry[]} */
        this.logs = [];
        /** @type {ReturnType<typeof createLogPanel> | undefined} */
        this.panel = undefined;
    }

    get isInitialized() { return Boolean(this.panel); }
    get container() { return this.panel?.container; }
    get content() { return this.panel?.content; }
    get toggleBtn() { return this.panel?.toggle; }
    get maximizeBtn() { return this.panel?.maximize; }

    tryInitialize() {
        if (this.scope.disposed || document.readyState === "loading") return false;
        this.panel ??= createLogPanel(this.scope, {
            entries: () => this.logs, filter: () => this.currentFilter,
            changeFilter: level => this.setFilter(level), clear: () => this.clear(),
        });
        return true;
    }

    /** @param {unknown} value @param {string} [level] @param {unknown[]} args */
    addLog(value, level = "base", ...args) { this.append(false, value, level, args); }

    /** @param {unknown} value @param {string} [level] @param {unknown[]} args */
    addHtmlLog(value, level = "base", ...args) { this.append(true, value, level, args); }

    /** @param {boolean} html @param {unknown} value @param {string} level @param {unknown[]} args */
    append(html, value, level, args) {
        if (this.scope.disposed) return;
        this.tryInitialize();
        const type = isLogLevel(level) ? level : "base";
        const values = isLogLevel(level) ? [value, ...args] : [value, level, ...args];
        let json = false;
        const message = values.map(part => {
            if (part !== null && typeof part === "object" && Object.prototype.toString.call(part) !== "[object Error]") {
                try {
                    const text = JSON.stringify(part, null, 2);
                    json = true;
                    return "<br/>" + text;
                } catch { json = false; }
            }
            return String(part);
        }).join("  ");
        const entry = { message, type, json, html, timestamp: new Date() };
        this.logs.push(entry);
        const evicted = this.logs.length > this.limit ? this.logs.shift() : undefined;
        this.panel?.append(entry, evicted);
    }

    /** @param {LogLevel} level @param {unknown[]} values @param {boolean} [html] */
    enqueue(level, [value, ...args], html = false) {
        setTimeout(() => this.append(html, value, level, args), 0);
    }

    /** @param {unknown[]} values */
    log(...values) { this.enqueue("base", values); }
    /** @param {unknown[]} values */
    warn(...values) { this.enqueue("warn", values); }
    /** @param {unknown[]} values */
    error(...values) { console.error(...values); this.enqueue("error", values); }
    /** @param {unknown[]} values */
    debug(...values) { this.enqueue("debug", values); }
    /** @param {unknown[]} values */
    html(...values) { this.enqueue("base", values, true); }
    /** @param {unknown[]} values */
    htmlDebug(...values) { this.enqueue("debug", values, true); }

    /** @param {LogLevel} level */
    setFilter(level) {
        if (this.currentFilter === level) return;
        this.currentFilter = level;
        localStorage.setItem(logFilterKey, level);
        this.panel?.update();
    }

    clear() { this.logs.length = 0; this.content?.replaceChildren(); }
    show() { if (this.tryInitialize()) this.panel?.show(); }
    hide() { this.panel?.hide(); }
    toggleExpandCollapsed() { this.panel?.toggleExpand(); }
    toggleMaximize() { this.panel?.toggleMaximize(); }
    lowZIndex() { this.panel?.setRaised(false); }
    highZIndex() { this.panel?.setRaised(true); }
    openDialog() {
        if (this.layer && this.dialog && this.tryInitialize()) this.panel?.openDialog(this.layer, this.dialog);
    }
}

/** @param {Logger} local */
function reuseParentLogger(local) {
    try {
        const host = /** @type {{unsafeWindow?: Window}} */ (globalThis).unsafeWindow;
        const parent = /** @type {(Window & {clog?: Logger}) | undefined} */ (host?.parent);
        return parent && parent !== host && typeof parent.clog?.log === "function" ? parent.clog : local;
    } catch {
        // Only the same-origin parent can own this frame's log panel.
        return local;
    }
}

/** @param {LifecycleScope} scope @param {{clogMsgCount?: number, vendors?: Record<string, any>, utilities?: DialogUi}} options */
function createLoggerRuntime(scope, { clogMsgCount = 2000, vendors = window, utilities }) {
    initializeTooltips(scope, document);
    const { Toastify, layer } = vendors;
    const clog = reuseParentLogger(new Logger(scope, Math.min(3000, Math.max(100, Number(clogMsgCount) || 2000)), layer, utilities));
    scope.listen(window, "error", event => {
        const { filename, message } = /** @type {ErrorEvent} */ (event);
        if (typeof filename === "string" && (filename.includes("javdb") || filename.includes("javbus"))) return;
        clog.error(`[全局 Error 异常捕获] ${message} 来源: ${filename ?? "未知"}`);
    });
    scope.listen(window, "unhandledrejection", event => {
        const { reason } = /** @type {PromiseRejectionEvent} */ (event);
        const message = reason?.message ?? "";
        if (["NotAllowedError", "AbortError", "NotSupportedError"].includes(reason?.name) || message.includes("play()") || message.includes("The element has no supported sources")) {
            clog.warn("[全局媒体播放异常] 当前媒体源无法播放", reason);
        } else {
            if (message.includes("<span>1005</span>") && message.includes("fc2ppvdb")) return;
            clog.error(`[全局 Promise 异常捕获] ${reason?.message || reason}`, reason);
        }
        event.preventDefault();
    });
    scope.listen(document, "mousedown", event => {
        if (!clog.container || !(event.target instanceof Element)) return;
        if (event.target.closest(".console-logger-container, .layui-layer-shade, .loading-container")) clog.highZIndex();
        else clog.lowZIndex();
    });
    return Object.freeze({
        loading: startLoading, show: createToastNotifications(Toastify), clog, showImageViewer: createImageViewer(scope),
        ImageHoverPreview: class extends ImageHoverPreview {
            /** @param {import("./image-hover-preview.js").HoverPreviewOptions} [config] */
            constructor(config) { super(config, utilities?.isMobileMode && (() => utilities.isMobileMode?.() ?? false)); }
        },
    });
}

/** @type {ReturnType<typeof createLoggerRuntime> | undefined} */
let loggerRuntime;

/** @param {LifecycleScope} scope @param {Parameters<typeof createLoggerRuntime>[1]} [options] */
export function initializeLoggerRuntime(scope, options = {}) {
    if (loggerRuntime) return loggerRuntime;
    const runtime = createLoggerRuntime(scope, options);
    loggerRuntime = runtime;
    scope.addCleanup(() => { if (loggerRuntime === runtime) loggerRuntime = undefined; });
    return runtime;
}
