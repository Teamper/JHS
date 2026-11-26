// @ts-check

const PRIMARY_TITLES = new Set(["新作品检测", "新作品", "鉴定记录", "演员黑名单", "统计", "设置"]);

/** Strip simple HTML tags from a dialog title to match logical workspace names. @param {unknown} title */
function normalizeTitle(title) {
    return String(title ?? "").replace(/<[^>]*>/g, "").trim();
}

/**
 * DialogPort adapter for extension pages: renders primary workspaces inline inside the
 * manager shell without layui-layer overlays, and delegates secondary modals to fallbackDialog.
 */
export class ExtensionDialogAdapter {
    /** @param {{open: (options: Record<string, unknown>) => number, close: (id: number) => void, confirm: (message: string, options: Record<string, unknown>, yes: (id: number) => void, no?: (id: number) => void) => number, alert: (message: string, options?: Record<string, unknown>) => number}} fallbackDialog @param {{releaseEscClose?: (id: number) => void, jquery?: (value: any) => any}} [options] */
    constructor(fallbackDialog, options = {}) {
        this.fallback = fallbackDialog;
        this.releaseEscClose = options.releaseEscClose ?? null;
        this.jquery = options.jquery ?? null;
        /** @type {HTMLElement | null} */ this.inlineContainer = null;
        /** @type {(() => void) | null} */ this.onInlineClosed = null;
        /** @type {{id: number, element: HTMLElement, options: Record<string, any>} | null} */ this.activeInline = null;
        this.nextInlineId = 900001;
    }

    /** @param {HTMLElement | null} container @param {(() => void) | null} [onInlineClosed] */
    setInlineHost(container, onInlineClosed = null) {
        this.inlineContainer = container;
        this.onInlineClosed = onInlineClosed;
    }

    hasActiveInline() {
        return Boolean(this.activeInline?.element?.isConnected);
    }

    /** Ask the active inline workspace (e.g. Settings with unsaved draft) to close. @returns {Promise<boolean>} */
    async requestCloseInline() {
        const current = this.activeInline;
        if (!current) return true;
        if (typeof current.options.cancel === "function") {
            const allowed = current.options.cancel(current.id);
            if (allowed === false) return false;
        }
        this.close(current.id);
        return true;
    }

    /** Force-close any mounted inline workspace without confirmation. */
    disposeInline() {
        const current = this.activeInline;
        if (!current) return;
        this.close(current.id);
    }

    /** @param {Record<string, any>} options */
    open(options = {}) {
        const title = normalizeTitle(options.title);
        if (this.inlineContainer && Number(options.type ?? 1) === 1 && PRIMARY_TITLES.has(title)) {
            this.disposeInline();
            const id = this.nextInlineId++;
            const doc = this.inlineContainer.ownerDocument;
            const wrapper = doc.createElement("div");
            wrapper.id = `layui-layer${id}`;
            wrapper.className = "jhs-ext-inline-dialog jhs-dialog jhs-ui";
            wrapper.dataset.jhsInlineTitle = title;
            const content = doc.createElement("div");
            content.className = "layui-layer-content";
            if (typeof options.content === "string") {
                content.innerHTML = options.content;
            } else if (options.content?.jquery && options.content[0]) {
                const node = options.content[0];
                if (node.style) node.style.display = "";
                content.append(node);
            } else if (options.content instanceof Node) {
                if (/** @type {HTMLElement} */ (options.content).style) {
                    /** @type {HTMLElement} */ (options.content).style.display = "";
                }
                content.append(options.content);
            }
            wrapper.append(content);
            this.inlineContainer.replaceChildren(wrapper);
            this.activeInline = { id, element: wrapper, options };
            if (typeof options.success === "function") {
                options.success(this.jquery ? this.jquery(wrapper) : wrapper, id);
            }
            // Prevent page-level Escape from closing a primary manager view.
            this.releaseEscClose?.(id);
            return id;
        }
        return this.fallback.open(options);
    }

    /** @param {number} id */
    close(id) {
        if (this.activeInline && this.activeInline.id === id) {
            const current = this.activeInline;
            this.activeInline = null;
            try {
                current.options.end?.();
            } finally {
                current.element.remove();
                this.onInlineClosed?.();
            }
            return;
        }
        this.fallback.close(id);
    }

    /** @param {string} message @param {Record<string, unknown>} options @param {(id: number) => void} yes @param {(id: number) => void} [onCancel] */
    confirm(message, options = {}, yes, onCancel) {
        return this.fallback.confirm(message, options, yes, onCancel);
    }

    /** @param {string} message @param {Record<string, unknown>} [options] */
    alert(message, options) {
        return this.fallback.alert(message, options);
    }
}
