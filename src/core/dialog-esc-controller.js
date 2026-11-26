// @ts-check

/** @typedef {KeyboardEvent & {originalEvent?: KeyboardEvent, isDefaultPrevented?: () => boolean}} DialogKeyEvent */
/** @typedef {{frame: HTMLIFrameElement, document: Document | null, onLoad: () => void}} FrameBinding */

/** Routes Escape to the highest live dialog and owns its iframe listeners. */
export class DialogEscController {
    /** @param {{jquery: (value: any) => any, close: (index: number) => void, document: Document, logger?: {warn?: (...parts: unknown[]) => void, error?: (...parts: unknown[]) => void}}} options */
    constructor(options) {
        this.jquery = options.jquery;
        this.close = options.close;
        this.document = options.document;
        this.logger = options.logger ?? console;
        /** @type {number[]} */
        this.layerIndexStack = [];
        /** @type {Map<number, () => unknown>} */
        this.escCloseRequests = new Map();
        /** @type {Map<number, FrameBinding>} */
        this.iframeEscBindings = new Map();
        this.listening = false;
        this.handleKey = this._handleGlobalEscKey.bind(this);
    }

    /** @param {DialogKeyEvent} event */
    _handleGlobalEscKey(event) {
        if (event.key !== "Escape" && event.keyCode !== 27) return;
        if (event.defaultPrevented || event.originalEvent?.defaultPrevented || event.isDefaultPrevented?.()) return;
        const target = /** @type {Node | null} */ (event.target);
        const sourceDocument = target?.ownerDocument ?? (target?.nodeType === 9 ? /** @type {Document} */ (target) : this.document);
        if (sourceDocument.fullscreenElement || this.document.fullscreenElement) return;
        const $ = this.jquery;
        if (sourceDocument !== this.document && $(sourceDocument).find(".layui-layer:visible, .jhs-popover:visible, .jhs-quick-setting-sheet:visible").length) return;
        while (this.layerIndexStack.length) {
            const index = this.layerIndexStack[this.layerIndexStack.length - 1];
            if (this.document.getElementById(`layui-layer${index}`)) break;
            this.releaseEscClose(index);
        }
        const index = this.layerIndexStack.at(-1);
        if (index === undefined) return;
        const layerId = `layui-layer${index}`;
        /** @param {Document} root */
        const hasPreview = root => [...root.querySelectorAll(".viewer-container, .fancybox-container.fancybox-is-open, .fancybox-container.fancybox-is-closing")].some(preview => {
            const owner = preview.closest(".layui-layer");
            return (!owner || owner.id === layerId) && $(preview).is(":visible");
        });
        if (hasPreview(this.document)) return;
        const frame = /** @type {HTMLIFrameElement | null} */ (this.document.getElementById(`layui-layer-iframe${index}`));
        try {
            if (frame?.contentDocument && hasPreview(frame.contentDocument)) return;
        } catch { this.logger.warn?.("无法检查跨域 iframe 内的预览容器"); }

        event.preventDefault();
        event.stopImmediatePropagation();
        const requestClose = this.escCloseRequests.get(index);
        if (requestClose) void requestClose();
        else {
            this.releaseEscClose(index);
            this.close(index);
        }
    }

    /** @param {number} index @param {{requestClose?: (() => unknown) | null}} [options] */
    setupEscClose(index, { requestClose = null } = {}) {
        if (requestClose) this.escCloseRequests.set(index, requestClose);
        if (!this.listening) {
            this.jquery(this.document).on("keydown.globalLayerEsc", this.handleKey);
            this.listening = true;
        }
        if (!this.layerIndexStack.includes(index)) this.layerIndexStack.push(index);
        const frame = /** @type {HTMLIFrameElement | null} */ (this.document.getElementById(`layui-layer-iframe${index}`));
        if (!frame) return;
        let binding = this.iframeEscBindings.get(index);
        if (binding && binding.frame !== frame) {
            this.releaseFrame(index, binding);
            binding = undefined;
        }
        if (!binding) {
            binding = { frame, document: null, onLoad: () => this.bindFrameDocument(index) };
            this.iframeEscBindings.set(index, binding);
            frame.addEventListener("load", binding.onLoad);
        }
        this.bindFrameDocument(index);
    }

    /** @param {number} index */
    bindFrameDocument(index) {
        const binding = this.iframeEscBindings.get(index);
        if (!binding) return;
        try {
            const frameDocument = binding.frame.contentDocument;
            if (frameDocument === binding.document) return;
            const namespace = `keydown.layerEsc${index}`;
            if (binding.document) this.jquery(binding.document).off(namespace, this.handleKey);
            binding.document = frameDocument;
            if (!frameDocument) { binding.frame.removeAttribute("data-esc-bound"); return; }
            this.jquery(frameDocument).on(namespace, this.handleKey);
            binding.frame.setAttribute("data-esc-bound", "yes");
        } catch (error) { this.logger.error?.("iframe监听失败 (跨域或未加载完毕):", error); }
    }

    /** @param {number} index @param {FrameBinding} binding */
    releaseFrame(index, binding) {
        binding.frame.removeEventListener("load", binding.onLoad);
        binding.frame.removeAttribute("data-esc-bound");
        if (binding.document) this.jquery(binding.document).off(`keydown.layerEsc${index}`, this.handleKey);
        this.iframeEscBindings.delete(index);
    }

    /** @param {number} [index] */
    releaseEscClose(index = this.layerIndexStack.at(-1)) {
        if (index === undefined) return;
        const position = this.layerIndexStack.indexOf(index);
        if (position !== -1) this.layerIndexStack.splice(position, 1);
        this.escCloseRequests.delete(index);
        const binding = this.iframeEscBindings.get(index);
        if (binding) this.releaseFrame(index, binding);
        if (!this.layerIndexStack.length && this.listening) {
            this.jquery(this.document).off("keydown.globalLayerEsc", this.handleKey);
            this.listening = false;
        }
    }

    dispose() {
        for (const index of [...this.layerIndexStack]) this.releaseEscClose(index);
    }
}
