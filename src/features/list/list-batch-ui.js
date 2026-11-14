// @ts-check

import { requestCancelBatchRun } from "./batch-coordinator.js";

export const LIST_BATCH_UI_STYLES = `.jhs-batch-progress{position:fixed;right:16px;bottom:16px;max-width:calc(100vw - 32px);box-sizing:border-box;z-index:var(--jhs-z-modal);display:flex;align-items:center;gap:var(--jhs-space-2);padding:var(--jhs-space-2) var(--jhs-space-3);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md);background:var(--jhs-surface);color:var(--jhs-text);box-shadow:var(--jhs-shadow-md)}.jhs-batch-progress__label{min-width:0;overflow-wrap:anywhere}.jhs-batch-progress .jhs-btn{flex:none}html.jhs-fab-mounted .jhs-batch-progress{bottom:calc(92px + env(safe-area-inset-bottom,0px))}.jhs-btn.jhs-batch-busy{opacity:.55;cursor:not-allowed}`;

/** Native Feature-owned confirmation and progress presentation for cross-page batch work. */
export class ListBatchUi {
    /** @param {{document?: Document, dialog: any, notifications: any, diagnostics?: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.dialog = options.dialog;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics ?? null;
        /** @type {Map<HTMLElement, () => void>} */ this.progressCleanups = new Map();
        /** @type {Map<HTMLElement, ReturnType<typeof setTimeout>>} */ this.progressTimers = new Map();
        /** @type {Set<() => void>} */ this.confirmClosers = new Set();
        /** @type {ResizeObserver | null} */ this.progressObserver = null;
        this.disposed = false;
    }

    /** @param {string} message @param {{confirmText?: string, tone?: string}} [options] */
    confirm(message, options = {}) {
        if (this.disposed) return Promise.resolve(false);
        return new Promise((resolve) => {
            let settled = false;
            /** @type {number | null} */ let dialogId = null;
            /** @param {boolean} accepted */
            const finish = (accepted) => {
                if (settled) return;
                settled = true;
                this.confirmClosers.delete(close);
                resolve(accepted);
            };
            const close = () => {
                finish(false);
                if (dialogId != null) this.dialog.close(dialogId);
            };
            const accept = () => {
                finish(true);
                if (dialogId != null) this.dialog.close(dialogId);
            };
            this.confirmClosers.add(close);
            try {
                dialogId = this.dialog.confirm(message, {
                    title: "提示",
                    confirmText: options.confirmText || "开始处理",
                    cancelText: "取消",
                    ...(options.tone ? { tone: options.tone } : {}),
                    ui: { size: "sm", body: "scroll" },
                    shade: 0,
                    end: () => finish(false),
                }, accept);
                if (this.disposed) close();
            } catch (error) {
                this.confirmClosers.delete(close);
                settled = true;
                this.diagnostics?.recordError?.({ source: "list-batch-ui", message: error instanceof Error ? error.message : String(error) });
                resolve(false);
            }
        });
    }

    /** @param {any} run */
    beginProgress(run) {
        if (this.disposed) throw new DOMException("List batch UI is disposed", "AbortError");
        this.removeProgress(this.document.getElementById("jhs-batch-progress"));
        const progress = this.document.createElement("div");
        progress.id = "jhs-batch-progress";
        progress.className = "jhs-ui jhs-batch-progress";
        progress.setAttribute("role", "status");
        const label = this.document.createElement("span");
        label.className = "jhs-batch-progress__label";
        label.textContent = "正在扫描…";
        const cancel = this.document.createElement("button");
        cancel.type = "button";
        cancel.className = "jhs-btn jhs-btn--secondary jhs-btn--sm";
        cancel.id = "jhs-batch-cancel";
        cancel.textContent = "取消";
        const onCancel = () => {
            if (!cancel.disabled) requestCancelBatchRun(run);
        };
        cancel.addEventListener("click", onCancel);
        progress.append(label, cancel);
        this.document.body.append(progress);
        const measure = () => this.document.documentElement.style.setProperty("--jhs-batch-clearance", `${Math.ceil(progress.getBoundingClientRect().height) + 12}px`);
        const Observer = this.document.defaultView?.ResizeObserver;
        if (Observer) { this.progressObserver = new Observer(measure); this.progressObserver.observe(progress); }
        measure();
        this.progressCleanups.set(progress, () => cancel.removeEventListener("click", onCancel));
        return progress;
    }

    /** @param {any} progress @param {string} text */
    setProgress(progress, text) {
        const label = progress?.querySelector?.(".jhs-batch-progress__label");
        if (label) label.textContent = text;
        else this.notifications.debug?.(text);
    }

    /** @param {any} progress */
    markWriting(progress) {
        const cancel = progress?.querySelector?.("#jhs-batch-cancel");
        if (cancel) {
            cancel.disabled = true;
            cancel.title = "正在写入，无法取消";
        }
    }

    /** @param {any} progress */
    completeProgress(progress) { this.scheduleRemoval(progress, 1800); }

    /** @param {any} progress @param {string} [message] */
    failProgress(progress, message = "批量处理失败，请重试") {
        this.notifications.error?.(message);
        if (!progress) return;
        this.setProgress(progress, message);
        progress?.classList?.add("jhs-batch-progress--error");
        progress.setAttribute("role", "alert");
        const cancel = progress.querySelector("#jhs-batch-cancel");
        if (cancel) { cancel.hidden = true; cancel.disabled = true; }
        const close = this.document.createElement("button");
        close.type = "button"; close.className = "jhs-btn jhs-btn--secondary jhs-btn--sm"; close.textContent = "关闭";
        const dismiss = () => this.removeProgress(progress);
        close.addEventListener("click", dismiss);
        const cleanup = this.progressCleanups.get(progress);
        this.progressCleanups.set(progress, () => { cleanup?.(); close.removeEventListener("click", dismiss); });
        progress.append(close);
    }

    /** @param {any} progress */
    removeProgress(progress) {
        if (!progress) return;
        this.progressObserver?.disconnect(); this.progressObserver = null;
        this.document.documentElement.style.removeProperty("--jhs-batch-clearance");
        const element = /** @type {HTMLElement} */ (progress);
        const timer = this.progressTimers.get(element);
        if (timer != null) clearTimeout(timer);
        this.progressTimers.delete(element);
        this.progressCleanups.get(element)?.();
        this.progressCleanups.delete(element);
        element.remove();
    }

    /** @param {boolean} disabled */
    setButtonsDisabled(disabled) {
        this.document.querySelectorAll("#favoriteAllVideo, #hasDownAllVideo, #filterAllVideo, #jhs-fab-menu [data-page-action]").forEach((element) => {
            element.setAttribute("aria-disabled", String(disabled));
            if (element instanceof (/** @type {Window & typeof globalThis} */ (this.document.defaultView)).HTMLButtonElement) element.disabled = disabled;
            element.classList.toggle("jhs-batch-busy", disabled);
        });
    }

    /** @param {string} message */
    error(message) { this.notifications.error?.(message); }

    /** @param {string} message @param {unknown} error */
    debug(message, error) { this.notifications.debug?.(message, error); }

    /** @param {unknown} error */
    reportError(error) {
        this.diagnostics?.recordError?.({ source: "list-batch", message: error instanceof Error ? error.message : String(error) });
        this.notifications.debug?.("批量操作失败:", error);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const close of [ ...this.confirmClosers ]) close();
        this.confirmClosers.clear();
        for (const progress of [ ...this.progressCleanups.keys() ]) this.removeProgress(progress);
        this.setButtonsDisabled(false);
    }

    /** @param {any} progress @param {number} delay */
    scheduleRemoval(progress, delay) {
        if (!progress) return;
        const element = /** @type {HTMLElement} */ (progress);
        const existing = this.progressTimers.get(element);
        if (existing != null) clearTimeout(existing);
        this.progressTimers.set(element, setTimeout(() => this.removeProgress(element), delay));
    }
}
