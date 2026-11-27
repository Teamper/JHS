// @ts-check
import { LifecycleScope } from "./lifecycle-scope.js";
import { JHS_Z_INDEX } from "./theme.js";

/** @typedef {{width: number, height: number}} ImageDimensions */
/** @typedef {HTMLElement | {jquery: string, 0?: HTMLElement} | null} HoverOwner */
/** @typedef {{selector?: string, dataAttribute?: string, maxWidth?: number, maxHeight?: number, offsetX?: number, offsetY?: number, zIndex?: number, owner?: HoverOwner, resolveOwner?: (() => HoverOwner) | null, zIndexStrategy?: string, transition?: number, hideDelay?: number, loadedUrlLimit?: number, autoAdjustPosition?: boolean}} HoverPreviewOptions */

export class ImageHoverPreview {
    /** @param {HoverPreviewOptions} [config] @param {() => boolean} [isMobileMode] */
    constructor(config = {}, isMobileMode = () => false) {
        this.scope = new LifecycleScope(`ui:image-hover:${Date.now()}`);
        this.config = {
            selector: ".hover-preview",
            dataAttribute: "data-full",
            maxWidth: 1e3,
            maxHeight: 1e3,
            offsetX: 20,
            offsetY: 20,
            zIndex: JHS_Z_INDEX.hoverPreview,
            owner: null,
            resolveOwner: null,
            zIndexStrategy: "fixed",
            transition: .2,
            hideDelay: 100,
            loadedUrlLimit: 128,
            autoAdjustPosition: !0,
            ...config
        };
        this.config.loadedUrlLimit = Math.max(1, Number(this.config.loadedUrlLimit) || 128);
        /** @type {HTMLDivElement | null} */
        this.preview = null;
        /** @type {Element | null} */
        this.currentTarget = null;
        /** @type {number | null} */
        this.timer = null;
        /** @type {HTMLImageElement | null} */
        this.imgElement = null;
        /** @type {HTMLImageElement | null} */
        this.pendingImage = null;
        /** @type {{horizontal: "left" | "right", vertical: "top" | "bottom"} | null} */
        this.placement = null;
        /** @type {{x: number, y: number} | null} */
        this.pointer = null;
        /** @type {number | null} */
        this.animationFrame = null;
        this.loadGeneration = 0;
        this.destroyed = !1;
        /** @type {string | null} */
        this.currentUrl = null;
        /** @type {string | null} */
        this.pendingUrl = null;
        /** @type {Map<string, ImageDimensions>} */
        this.loadedUrls = new Map();
        this.eventsBound = !1;
        /** @type {MutationObserver | null} */
        this.overlayObserver = null;
        this.onDocumentOver = (/** @type {Event} */ event) => this.handleDocumentOver(/** @type {MouseEvent} */ (event));
        this.onDocumentOut = (/** @type {Event} */ event) => this.handleDocumentOut(/** @type {MouseEvent} */ (event));
        this.onDocumentMove = (/** @type {Event} */ event) => this.handleDocumentMove(/** @type {MouseEvent} */ (event));
        this.onDocumentScroll = () => this.handleDocumentScroll();
        this.suppressUntilMouseMove = !1;
        if (!isMobileMode()) {
            this.injectStyles();
            this.createPreviewElement();
            this.bindEvents();
        }
    }
    injectStyles() {
        if (document.getElementById("jhs-image-hover-preview-style")) return;
        const style = document.createElement("style");
        style.id = "jhs-image-hover-preview-style";
        style.textContent = `
            .image-hover-preview {
                position: fixed;
                display: block;
                visibility: hidden;
                overflow: hidden;
                pointer-events: none;
                opacity: 0;
                border-radius: var(--jhs-radius-xs);
                background-color: var(--jhs-surface);
                box-shadow: var(--jhs-shadow-lg);
                transition: opacity var(--jhs-motion-base) var(--jhs-ease);
            }
            .image-hover-preview.active { visibility: visible; opacity: 1; }
            html[data-jhs-privacy-mask-images] .image-hover-preview { visibility:hidden; }
            .image-hover-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }
            .image-hover-preview::after {
                position: absolute;
                inset: 0;
                pointer-events: none;
                background: var(--jhs-preview-scrim);
                content: "";
            }
            .image-hover-preview.loading { min-width: 120px; min-height: 72px; }
            .image-hover-preview.loading::before {
                position: absolute;
                top: 50%;
                left: 50%;
                color: var(--jhs-text-muted);
                font-size: var(--jhs-font-size-md);
                content: "加载中…";
                transform: translate(-50%, -50%);
            }
            .image-hover-preview__error { padding: var(--jhs-space-3); color: var(--jhs-danger-text); }
        `;
        document.head.appendChild(style);
    }
    createPreviewElement() {
        this.preview = document.createElement("div");
        this.preview.className = "image-hover-preview";
        this.preview.style.zIndex = String(this.resolvePreviewZIndex());
        document.body.appendChild(this.preview);
    }
    resolveOwnerElement() {
        const owner = typeof this.config.resolveOwner === "function" ? this.config.resolveOwner() : this.config.owner;
        return owner && "jquery" in owner ? owner[0] ?? null : owner;
    }
    resolvePreviewZIndex() {
        let value = Number(this.config.zIndex) || JHS_Z_INDEX.hoverPreview;
        if (this.config.zIndexStrategy !== "owner" && !this.resolveOwnerElement()) return value;
        /** @type {Element | null} */
        let owner = this.resolveOwnerElement();
        while (owner) {
            const computed = typeof getComputedStyle === "function" ? getComputedStyle(owner).zIndex : "";
            const candidate = Number((owner instanceof HTMLElement ? owner.style.zIndex : '') || computed);
            if (Number.isFinite(candidate) && candidate > 0) {
                value = candidate + 1;
                break;
            }
            owner = owner.parentElement;
        }
        return value;
    }
    refreshOwnerZIndex() {
        if (this.preview && (this.config.zIndexStrategy === "owner" || this.resolveOwnerElement())) {
            const value = String(this.resolvePreviewZIndex());
            if (this.preview.style.zIndex !== value) this.preview.style.zIndex = value;
        }
    }
    isOwnerUncovered() {
        if (document.documentElement.hasAttribute("data-jhs-privacy-mask-images")) return false;
        const owner = this.resolveOwnerElement();
        if (!owner) return this.config.zIndexStrategy !== "owner";
        if (!owner.isConnected || !this.currentTarget?.isConnected || !owner.contains(this.currentTarget) || !this.currentTarget.getClientRects().length) return false;
        const ownerLayer = owner.closest(".layui-layer"), ownerZ = Number(ownerLayer && window.getComputedStyle(ownerLayer).zIndex) || 0;
        return ![...document.querySelectorAll(".layui-layer, .viewer-container, .fancybox-container, .loading-container, .jhs-owned-popover.is-open, #jhs-quick-setting-sheet.is-open, .simple-setting.is-open, .mini-simple-setting.is-open, .jhs-fab-menu.jhs-fab-menu-open")].some(root => {
            if (root === ownerLayer || root.contains(owner)) return false;
            const style = window.getComputedStyle(root);
            if (!root.getClientRects().length || style.display === "none" || style.visibility === "hidden") return false;
            return !root.matches(".layui-layer") || Number(style.zIndex) >= ownerZ;
        });
    }
    watchOwnerOverlays() {
        if (!this.resolveOwnerElement() || this.overlayObserver) return;
        // 仅在悬停会话内观察：弹窗/遮罩出现时及时隐藏，不能靠固定 viewer 层级封顶。
        this.overlayObserver = this.scope.observe(document.body, () => {
            if (!this.isOwnerUncovered()) this.hidePreview();
            else this.refreshOwnerZIndex();
        }, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    }
    bindEvents() {
        if (this.eventsBound || this.destroyed) return;
        this.scope.listen(document, "mouseover", this.onDocumentOver), this.scope.listen(document, "mouseout", this.onDocumentOut),
        this.scope.listen(document, "mousemove", this.onDocumentMove),
        // 滚动会让光标下的卡片变化，浏览器补发的边界 mouse 事件会造成预览反复闪现
        this.scope.listen(document, "scroll", this.onDocumentScroll, { capture: !0, passive: !0 }),
        this.scope.listen(document, "wheel", this.onDocumentScroll, { passive: !0 }),
        this.eventsBound = !0;
    }
    handleDocumentScroll() {
        if (this.destroyed || !this.currentTarget) return;
        // 立即隐藏，并抑制到下一次真实鼠标移动为止
        this.suppressUntilMouseMove = !0, clearTimeout(this.timer ?? undefined), this.timer = null, this.hidePreview();
    }
    /** @param {MouseEvent} event */
    findTarget(event) {
        const target = event.target;
        return target instanceof Element ? target.closest(this.config.selector) : null;
    }
    /** @param {MouseEvent} event */
    handleDocumentOver(event) {
        if (this.suppressUntilMouseMove) return;
        const target = this.findTarget(event);
        target && (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget)) && this.handleMouseEnter(event, target);
    }
    /** @param {MouseEvent} event */
    handleDocumentOut(event) {
        const target = this.findTarget(event);
        target && (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget)) && this.handleMouseLeave();
    }
    /** @param {MouseEvent} event */
    handleDocumentMove(event) {
        const resumeAfterScroll = this.suppressUntilMouseMove;
        this.suppressUntilMouseMove = !1;
        if (resumeAfterScroll) {
            const target = this.findTarget(event);
            if (target) return this.handleMouseEnter(event, target);
        }
        if (!this.currentTarget) return;
        (event.target === this.currentTarget || event.target instanceof Node && this.currentTarget.contains(event.target)) && this.handleMouseMove(event);
    }
    /** @param {MouseEvent} event @param {Element | null} [delegatedTarget] */
    handleMouseEnter(event, delegatedTarget = this.findTarget(event)) {
        if (this.destroyed || !this.preview || !delegatedTarget) return;
        this.refreshOwnerZIndex();
        clearTimeout(this.timer ?? undefined);
        this.timer = null;
        this.currentTarget = delegatedTarget;
        if (!this.isOwnerUncovered()) return this.hidePreview();
        this.watchOwnerOverlays();
        this.pointer = {
            x: event.clientX,
            y: event.clientY
        };
        this.placement = null;
        const source = this.currentTarget.getAttribute(this.config.dataAttribute) || (delegatedTarget instanceof HTMLImageElement ? delegatedTarget.src : null);
        if (!source) return;
        if (source === this.currentUrl && this.imgElement) return this.showCurrentPreview();
        if (source === this.pendingUrl) return void this.preview.classList.add("active");
        const cached = this.loadedUrls.get(source);
        if (cached) {
            // 缓存命中同样要递增代际并解绑在途加载，否则先悬停的慢图完成后会“劫持”当前预览
            return ++this.loadGeneration, this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null),
            this.pendingImage = null, this.pendingUrl = null, this.loadedUrls.delete(source), this.loadedUrls.set(source, cached), void this.commitPreview(source, cached);
        }
        const generation = ++this.loadGeneration;
        this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null);
        this.pendingUrl = source;
        this.currentUrl ? this.showCurrentPreview() : (this.preview.replaceChildren(), this.preview.classList.add("loading", "active"));
        const image = new Image();
        this.pendingImage = image;
        image.onload = () => {
            if (this.destroyed || generation !== this.loadGeneration || !this.preview) return;
            const {width, height} = this.calculateImageSize(image);
            const cachedImage = { width, height };
            this.loadedUrls.set(source, cachedImage);
            if (this.loadedUrls.size > this.config.loadedUrlLimit) this.loadedUrls.delete(/** @type {string} */ (this.loadedUrls.keys().next().value));
            this.pendingImage = null, this.pendingUrl = null, this.commitPreview(source, cachedImage);
        };
        image.onerror = () => {
            if (this.destroyed || generation !== this.loadGeneration || !this.preview) return;
            this.pendingImage = null, this.pendingUrl = null;
            if (this.currentUrl) return void this.preview.classList.add("active");
            const error = document.createElement("div");
            error.className = "image-hover-preview__error";
            error.textContent = "图片加载失败";
            this.preview.replaceChildren(error);
            this.preview.classList.remove("loading");
            if (this.isOwnerUncovered()) this.preview.classList.add("active");
        };
        image.src = source;
    }
    /** @param {string} source @param {ImageDimensions} cached */
    commitPreview(source, cached) {
        if (!this.preview) return;
        const previewImage = document.createElement("img");
        previewImage.src = source, previewImage.alt = "预览图", this.preview.replaceChildren(previewImage), this.imgElement = previewImage,
        this.currentUrl = source, this.preview.style.width = `${cached.width}px`, this.preview.style.height = `${cached.height}px`,
        this.preview.classList.remove("loading"), this.showCurrentPreview();
    }
    showCurrentPreview() {
        if (!this.preview || !this.pointer || !this.imgElement) return;
        if (!this.isOwnerUncovered()) return this.hidePreview();
        const width = this.preview.offsetWidth, height = this.preview.offsetHeight;
        this.placement = this.choosePlacement(this.pointer.x, this.pointer.y, width, height), this.preview.classList.add("active"), this.schedulePosition();
    }
    /** @param {HTMLImageElement} image */
    calculateImageSize(image) {
        const viewportPadding = 8;
        const availableWidth = Math.max(1, window.innerWidth - 2 * (viewportPadding + this.config.offsetX));
        const availableHeight = Math.max(1, window.innerHeight - 2 * (viewportPadding + this.config.offsetY));
        const maxWidth = Math.min(this.config.maxWidth, availableWidth);
        const maxHeight = Math.min(this.config.maxHeight, availableHeight);
        const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        return {
            width: Math.max(1, Math.round(image.naturalWidth * scale)),
            height: Math.max(1, Math.round(image.naturalHeight * scale))
        };
    }
    /** @param {number} x @param {number} y @param {number} width @param {number} height @returns {{horizontal: 'left' | 'right', vertical: 'top' | 'bottom'}} */
    choosePlacement(x, y, width, height) {
        if (!this.config.autoAdjustPosition) return {
            horizontal: "right",
            vertical: "bottom"
        };
        const rightSpace = window.innerWidth - x - this.config.offsetX;
        const leftSpace = x - this.config.offsetX;
        const bottomSpace = window.innerHeight - y - this.config.offsetY;
        const topSpace = y - this.config.offsetY;
        return {
            horizontal: rightSpace >= width || rightSpace >= leftSpace ? "right" : "left",
            vertical: bottomSpace >= height || bottomSpace >= topSpace ? "bottom" : "top"
        };
    }
    /** @param {MouseEvent} event */
    handleMouseMove(event) {
        if (!this.currentTarget || !this.preview?.classList.contains("active")) return;
        this.pointer = {
            x: event.clientX,
            y: event.clientY
        };
        this.schedulePosition();
    }
    schedulePosition() {
        if (this.animationFrame || !this.pointer || !this.placement) return;
        this.animationFrame = requestAnimationFrame((() => {
            this.animationFrame = null;
            this.applyPosition();
        }));
    }
    applyPosition() {
        if (!this.preview || !this.pointer || !this.placement) return;
        const padding = 8;
        const width = this.preview.offsetWidth;
        const height = this.preview.offsetHeight;
        let left = "right" === this.placement.horizontal ? this.pointer.x + this.config.offsetX : this.pointer.x - width - this.config.offsetX;
        let top = "bottom" === this.placement.vertical ? this.pointer.y + this.config.offsetY : this.pointer.y - height - this.config.offsetY;
        left = Math.min(Math.max(padding, left), Math.max(padding, window.innerWidth - width - padding));
        top = Math.min(Math.max(padding, top), Math.max(padding, window.innerHeight - height - padding));
        this.preview.style.left = `${left}px`;
        this.preview.style.top = `${top}px`;
    }
    handleMouseLeave() {
        if (!this.preview) return;
        clearTimeout(this.timer ?? undefined), this.timer = setTimeout((() => this.hidePreview()), this.config.hideDelay);
    }
    hidePreview() {
        if (!this.preview) return;
        clearTimeout(this.timer ?? undefined);
        if (this.overlayObserver) this.scope.releaseObserver(this.overlayObserver), this.overlayObserver = null;
        ++this.loadGeneration, this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null),
        this.pendingImage = null, this.pendingUrl = null, this.preview.classList.remove("active", "loading"), this.currentTarget = null,
        this.pointer = null, this.placement = null, this.timer = null;
    }
    destroy() {
        if (this.destroyed) return;
        this.destroyed = !0;
        ++this.loadGeneration;
        clearTimeout(this.timer ?? undefined);
        this.animationFrame && cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
        this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null);
        this.pendingImage = null;
        this.eventsBound && (this.scope.dispose(), this.eventsBound = !1);
        this.overlayObserver = null;
        this.loadedUrls.clear();
        this.preview?.remove();
        this.preview = null;
        this.currentTarget = null;
    }
}
