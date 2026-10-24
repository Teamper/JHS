import { createImageViewer } from "./image-viewer.js";
import { escapeHtml } from "./constants.js";
import { JHS_Z_INDEX } from "./theme.js";
import { LifecycleScope } from "./lifecycle-scope.js";
import { getIcon } from "./icons.js";
import { initializeTooltips } from "./tooltip-controller.js";

let loggerRuntime;

/** @param {import("./lifecycle-scope.js").LifecycleScope} scope @param {{ clogMsgCount?: number }} [options] */
export function initializeLoggerRuntime(scope, { clogMsgCount = 2000 } = {}) {
if (loggerRuntime) return loggerRuntime;
initializeTooltips(scope, document);

const maxLogCount = Math.min(3000, Math.max(100, Number(clogMsgCount) || 2000));
/** @type {any} */
let loggerClog;

window.loading = function() {
    const e = document.createElement("div");
    e.className = "loading-container jhs-ui", e.setAttribute("role", "status"), e.setAttribute("aria-live", "polite"), e.setAttribute("aria-label", "处理中"), e.setAttribute("aria-busy", "true");
    const t = document.createElement("div");
    return t.className = "loading-animation", t.setAttribute("aria-hidden", "true"), e.appendChild(t), document.body.appendChild(e),
    {
        close: () => {
            e.setAttribute("aria-busy", "false"); e.remove();
        }
    };
}, function() {
    const e = (e, t, n, a, i) => {
        let s;
        "object" == typeof n ? (s = n, s.gravity || (s.gravity = "top"), s.position || (s.position = "center")) : (s = "object" == typeof a ? a : i || {}, s.gravity = n || "top",
        s.position = "string" == typeof a ? a : "center"), s.gravity && "center" !== s.gravity || (s.offset = {
            y: "calc(50vh - 150px)"
        });
        const content = document.createElement("span"), message = document.createElement("span");
        content.className = "jhs-toast__content";
        content.insertAdjacentHTML("beforeend", getIcon({ info: "info", success: "circle-check", error: "triangle-alert" }[t]));
        message.className = "jhs-toast__message"; message.textContent = String(e ?? ""); content.appendChild(message);
        const p = {
            text: e,
            node: content,
            duration: t === "error" ? 5000 : 3000,
            close: t === "error",
            gravity: "top",
            position: "center",
            stopOnFocus: !0,
            oldestFirst: !1,
            ariaLive: t === "error" ? "assertive" : "polite",
            ...s,
            className: `jhs-toast jhs-ui jhs-toast--${t}${s.className ? ` ${s.className}` : ""}`
        };
        -1 === p.duration && (p.close = !0);
        const m = Toastify(p);
        m.showToast();
        m.toastElement?.setAttribute("role", t === "error" ? "alert" : "status");
        const close = m.toastElement?.querySelector(".toast-close");
        if (close) { close.setAttribute("aria-label", "关闭提示"); close.replaceChildren(); close.insertAdjacentHTML("beforeend", getIcon("x")); }
        m.closeShow = () => { m.toastElement?.remove(); };
        return m;
    };
    window.show = {
        ok: (t, n = "center", a, i) => e(t, "success", n, a, i),
        error: (t, n = "center", a, i) => e(t, "error", n, a, i),
        info: (t, n = "center", a, i) => e(t, "info", n, a, i)
    };
}(), window.showImageViewer = createImageViewer(scope), window.ImageHoverPreview = class {
    constructor(config = {}) {
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
        this.preview = null;
        this.currentTarget = null;
        this.timer = null;
        this.imgElement = null;
        this.pendingImage = null;
        this.placement = null;
        this.pointer = null;
        this.animationFrame = null;
        this.loadGeneration = 0;
        this.destroyed = !1;
        this.currentUrl = null;
        this.pendingUrl = null;
        this.loadedUrls = new Map;
        this.eventsBound = !1;
        this.overlayObserver = null;
        this.onMouseEnter = event => this.handleMouseEnter(event);
        this.onMouseLeave = event => this.handleMouseLeave(event);
        this.onMouseMove = event => this.handleMouseMove(event);
        this.onDocumentOver = event => this.handleDocumentOver(event);
        this.onDocumentOut = event => this.handleDocumentOut(event);
        this.onDocumentMove = event => this.handleDocumentMove(event);
        this.onDocumentScroll = () => this.handleDocumentScroll();
        this.suppressUntilMouseMove = !1;
        this.init();
    }
    init() {
        if (utils.isMobileMode()) return;
        this.injectStyles(), this.createPreviewElement(), this.bindEvents();
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
            .image-hover-preview__error { padding: var(--jhs-space-3); color: var(--jhs-danger); }
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
        return owner?.jquery ? owner[0] : owner;
    }
    resolvePreviewZIndex() {
        let value = Number(this.config.zIndex) || JHS_Z_INDEX.hoverPreview;
        if (this.config.zIndexStrategy !== "owner" && !this.resolveOwnerElement()) return value;
        let owner = this.resolveOwnerElement();
        while (owner) {
            const computed = typeof getComputedStyle === "function" ? getComputedStyle(owner).zIndex : "";
            const candidate = Number(owner.style?.zIndex || computed);
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
        const owner = this.resolveOwnerElement();
        if (!owner) return this.config.zIndexStrategy !== "owner";
        if (!owner.isConnected || !this.currentTarget?.isConnected || !owner.contains(this.currentTarget)) return false;
        const ownerLayer = owner.closest(".layui-layer"), ownerZ = Number(ownerLayer && window.getComputedStyle(ownerLayer).zIndex) || 0;
        return ![...document.querySelectorAll(".layui-layer, .viewer-container, .fancybox-container, .loading-container")].some(root => {
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
        this.suppressUntilMouseMove = !0, clearTimeout(this.timer), this.timer = null, this.hidePreview();
    }
    findTarget(event) {
        const target = event.target;
        return target?.closest ? target.closest(this.config.selector) : null;
    }
    handleDocumentOver(event) {
        if (this.suppressUntilMouseMove) return;
        const target = this.findTarget(event);
        target && (!event.relatedTarget || !target.contains(event.relatedTarget)) && this.handleMouseEnter(event, target);
    }
    handleDocumentOut(event) {
        const target = this.findTarget(event);
        target && (!event.relatedTarget || !target.contains(event.relatedTarget)) && this.handleMouseLeave();
    }
    handleDocumentMove(event) {
        const resumeAfterScroll = this.suppressUntilMouseMove;
        this.suppressUntilMouseMove = !1;
        if (resumeAfterScroll) {
            const target = this.findTarget(event);
            if (target) return this.handleMouseEnter(event, target);
        }
        if (!this.currentTarget) return;
        (event.target === this.currentTarget || this.currentTarget.contains(event.target)) && this.handleMouseMove(event);
    }
    handleMouseEnter(event, delegatedTarget = event.currentTarget) {
        if (this.destroyed || !this.preview) return;
        this.refreshOwnerZIndex();
        clearTimeout(this.timer);
        this.timer = null;
        this.currentTarget = delegatedTarget;
        if (!this.isOwnerUncovered()) return this.hidePreview();
        this.watchOwnerOverlays();
        this.pointer = {
            x: event.clientX,
            y: event.clientY
        };
        this.placement = null;
        const source = this.currentTarget.getAttribute(this.config.dataAttribute) || this.currentTarget.src;
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
        const image = new Image;
        this.pendingImage = image;
        image.onload = () => {
            if (this.destroyed || generation !== this.loadGeneration || !this.preview) return;
            const {width, height} = this.calculateImageSize(image);
            const cachedImage = { width, height };
            this.loadedUrls.set(source, cachedImage);
            for (;this.loadedUrls.size > this.config.loadedUrlLimit; ) this.loadedUrls.delete(this.loadedUrls.keys().next().value);
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
            this.preview.classList.add("active");
        };
        image.src = source;
    }
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
        clearTimeout(this.timer), this.timer = setTimeout((() => this.hidePreview()), this.config.hideDelay);
    }
    hidePreview() {
        if (!this.preview) return;
        clearTimeout(this.timer);
        if (this.overlayObserver) this.scope.releaseObserver(this.overlayObserver), this.overlayObserver = null;
        ++this.loadGeneration, this.pendingImage && (this.pendingImage.onload = null, this.pendingImage.onerror = null),
        this.pendingImage = null, this.pendingUrl = null, this.preview.classList.remove("active", "loading"), this.currentTarget = null,
        this.pointer = null, this.placement = null, this.timer = null;
    }
    destroy() {
        if (this.destroyed) return;
        this.destroyed = !0;
        ++this.loadGeneration;
        clearTimeout(this.timer);
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
}, function() {
    const e = {
        base: {
            label: "信息"
        },
        warn: {
            label: "警告"
        },
        error: {
            label: "错误"
        },
        debug: {
            label: "调试"
        }
    }, t = {
        base: [ "base", "warn", "error" ],
        warn: [ "warn" ],
        error: [ "error" ],
        debug: [ "base", "warn", "error", "debug" ]
    }, n = maxLogCount, a = "jhs_clog_maximize", i = "jhs_clog_expand", s = "jhs_clog_filter";
    class o {
        constructor() {
            const t = localStorage.getItem(s);
            this.currentFilter = t && e[t] ? t : "base", this.logs = [], this.isInitialized = !1,
            this.userScrolledUp = !1;
        }
        tryInitialize() {
            return "loading" !== document.readyState && (this.isInitialized || (this.init(),
            this.isInitialized = !0), !0);
        }
        init() {
            this.createContainer(), this.bindEvents(), this.checkInitialMaximizeState(), this.checkInitialCollapseState();
        }
        createContainer() {
            this.container = document.createElement("div"), this.container.className = "console-logger-container jhs-ui",
            this.container.style.display = "none", this.toggleBtn = document.createElement("button"), this.toggleBtn.type = "button", this.toggleBtn.setAttribute("aria-label", "展开或收起运行日志"),
            this.toggleBtn.className = "console-logger-toggle collapsed", this.toggleBtn.insertAdjacentHTML("beforeend", getIcon("chevron-down")), this.toggleBtn.setAttribute("aria-expanded", "false"), this.container.appendChild(this.toggleBtn),
            window.matchMedia?.("(max-width: 767px)").matches && (this.toggleBtn.hidden = !0, this.toggleBtn.style.display = "none"),
            this.window = document.createElement("div"), this.window.className = "console-logger-window collapsed";
            const t = document.createElement("div");
            t.className = "console-logger-header";
            const n = document.createElement("div");
            n.className = "console-logger-title", n.textContent = "JHS 运行日志";
            const a = document.createElement("div");
            a.className = "console-logger-controls", this.maximizeBtn = document.createElement("button"),
            this.maximizeBtn.type = "button", this.maximizeBtn.insertAdjacentHTML("beforeend", getIcon("maximize-2")), this.maximizeBtn.setAttribute("aria-label", "放大日志窗口"), this.maximizeBtn.classList.add("console-logger-maximize-toggle"),
            a.appendChild(this.maximizeBtn);
            const i = document.createElement("button");
            i.type = "button", i.textContent = "清空", i.addEventListener("click", (() => this.clear())), a.appendChild(i),
            t.appendChild(n), t.appendChild(a), this.filtersContainer = document.createElement("div"),
            this.filtersContainer.className = "console-logger-filters", this.filterButtonGroup = document.createElement("div"),
            this.filterButtonGroup.className = "console-logger-filter-group", this.filtersContainer.appendChild(this.filterButtonGroup),
            this.scrollToBottomBtn = document.createElement("button"), this.scrollToBottomBtn.className = "console-logger-scroll-to-bottom",
            this.scrollToBottomBtn.type = "button", this.scrollToBottomBtn.textContent = "到底部", this.filtersContainer.appendChild(this.scrollToBottomBtn),
            this.content = document.createElement("div"), this.content.className = "console-logger-content jhs-scrollbar",
            this.window.appendChild(t), this.window.appendChild(this.filtersContainer), this.window.appendChild(this.content),
            scope.addCleanup(() => { document.body.removeAttribute("data-jhs-debug-visible"); this.container.remove(); }),
            this.container.appendChild(this.window), document.body.appendChild(this.container),
            Object.keys(e).forEach((t => {
                const n = document.createElement("button");
                n.type = "button", n.className = "jhs-btn console-logger-filter", t === this.currentFilter && n.classList.add("active"),
                n.textContent = e[t].label, n.dataset.type = t, n.addEventListener("click", (() => this.setFilter(t))),
                this.filterButtonGroup.appendChild(n);
            }));
        }
        bindEvents() {
            this.toggleBtn.addEventListener("click", (() => {
                this.toggleExpandCollapsed();
            })), this.maximizeBtn.addEventListener("click", (() => this.toggleMaximize())),
            this.scrollToBottomBtn.addEventListener("click", (() => {
                this.content.scrollTop = this.content.scrollHeight, this.userScrolledUp = !1;
            })), this.content.addEventListener("scroll", (() => {
                const e = this.content.scrollHeight - this.content.clientHeight <= this.content.scrollTop + 5;
                this.userScrolledUp = !e;
            })), this.content.addEventListener("wheel", (e => {
                const t = 0 === this.content.scrollTop, n = this.content.scrollHeight - this.content.clientHeight <= this.content.scrollTop + 1;
                (t && e.deltaY < 0 || n && e.deltaY > 0) && (e.preventDefault(), e.stopPropagation());
            }), {
                passive: !1
            });
        }
        toggleExpandCollapsed() {
            const e = this.window.classList.toggle("collapsed");
            this.toggleBtn.classList.toggle("collapsed"), this.toggleBtn.setAttribute("aria-expanded", String(!e)), e ? localStorage.setItem(i, "no") : (localStorage.setItem(i, "yes"),
            this.reRenderAllLogs());
        }
        checkInitialCollapseState() {
            const e = localStorage.getItem(i);
            e && "no" !== e ? (this.window.classList.toggle("collapsed"), this.toggleBtn.classList.toggle("collapsed"),
            setTimeout((() => {
                this.content.scrollTop = this.content.scrollHeight;
            }), 0)) : (this.window.classList.add("collapsed"), this.toggleBtn.classList.add("collapsed"));
            this.toggleBtn.setAttribute("aria-expanded", String(!this.window.classList.contains("collapsed")));
        }
        checkInitialMaximizeState() {
            "maximized" === localStorage.getItem(a) && (this.window.classList.add("maximized"),
            this.maximizeBtn.classList.add("active")), this.updateMaximizeIcon();
        }
        toggleMaximize() {
            const e = this.window.classList.toggle("maximized");
            this.maximizeBtn.classList.toggle("active", e), e ? localStorage.setItem(a, "maximized") : localStorage.setItem(a, "minimized"),
            this.window.classList.contains("collapsed") || (this.content.scrollTop = this.content.scrollHeight);
            this.updateMaximizeIcon();
        }
        updateMaximizeIcon() {
            const maximized = this.window.classList.contains("maximized");
            this.maximizeBtn.replaceChildren();
            this.maximizeBtn.insertAdjacentHTML("beforeend", getIcon(maximized ? "minimize-2" : "maximize-2"));
            this.maximizeBtn.setAttribute("aria-label", maximized ? "还原日志窗口" : "放大日志窗口");
            this.maximizeBtn.setAttribute("aria-pressed", String(maximized));
        }
        addLog(t, a = "base", ...i) {
            return this._appendLog(false, t, a, ...i);
        }
        addHtmlLog(t, a = "base", ...i) {
            return this._appendLog(true, t, a, ...i);
        }
        _appendLog(htmlMode, t, a = "base", ...i) {
            const s = this.tryInitialize();
            let o, r = [];
            e[a] ? (o = a, r = i) : (o = "base", r = [ a, ...i ]), o = e[o] ? o : "base";
            const l = [ t, ...r ];
            let c = "msg";
            const d = [];
            l.forEach((e => {
                if ("[object Error]" === Object.prototype.toString.call(e)) d.push(String(e)); else if ("object" == typeof e && null !== e) try {
                    d.push("<br/>" + JSON.stringify(e, null, 2)), c = "json";
                } catch (t) {
                    d.push(String(e)), c = "msg";
                } else d.push(String(e));
            }));
            let h = d.join("  ");
            if (htmlMode) {
                h = h.replace(/(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi, (e => {
                    const t = e.startsWith("http") || e.startsWith("ftp"), n = e.startsWith("//"), a = e.startsWith("www.");
                    let i = e;
                    return n ? i = `http:${e}` : !t && a && (i = `http://${e}`), `<a href="${escapeHtml(i)}" target="_blank">${escapeHtml(e)}</a>`;
                }));
            }
            const g = {
                message: h,
                messageType: c,
                type: o,
                html: htmlMode,
                timestamp: new Date,
                id: Date.now() + Math.random()
            };
            if (this.logs.push(g), this.logs.length > n) {
                this.logs.shift();
                const e = this.content.querySelector(".console-logger-entry");
                e && e.remove();
            }
            s && this.renderLog(g);
        }
        log(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "base", ...n);
            }), 0);
        }
        html(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addHtmlLog(t, "base", ...n);
            }), 0);
        }
        htmlDebug(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addHtmlLog(t, "debug", ...n);
            }), 0);
        }
        error(...e) {
            const [t, ...n] = e;
            console.error(...e), setTimeout((() => {
                this.addLog(t, "error", ...n);
            }), 0);
        }
        warn(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "warn", ...n);
            }), 0);
        }
        debug(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "debug", ...n);
            }), 0);
        }
        renderLog(e) {
            if ("none" === this.container.style.display) return;
            if (this.window.classList.contains("collapsed")) return;
            if (!(t[this.currentFilter] || []).includes(e.type)) return;
            const n = this._createLogElement(e);
            this.content.appendChild(n), this.window.classList.contains("collapsed") || this.userScrolledUp || (this.content.scrollTop = this.content.scrollHeight);
        }
        reRenderAllLogs() {
            "none" !== this.container.style.display && (this.window.classList.contains("collapsed") || setTimeout((() => {
                if (this.content.innerHTML = "", 0 === this.logs.length) return;
                const e = t[this.currentFilter] || [], n = document.createDocumentFragment();
                this.logs.forEach((t => {
                    if (e.includes(t.type)) {
                        const e = this._createLogElement(t);
                        n.appendChild(e);
                    }
                })), this.content.appendChild(n), this.content.scrollTop = this.content.scrollHeight;
            }), 0));
        }
        _createLogElement(t) {
            const n = document.createElement("div");
            n.className = "console-logger-entry", n.dataset.type = t.type, n.dataset.id = t.id;
            const i = (t.timestamp instanceof Date ? t.timestamp : new Date(t.timestamp)).toTimeString().split(" ")[0];
            const timestamp = document.createElement("span");
            timestamp.className = "console-logger-timestamp";
            timestamp.textContent = `[${i}]`;
            const message = document.createElement("span");
            message.className = "console-logger-message";
            message.dataset.type = t.messageType;
            if (t.html) {
                message.innerHTML = t.message;
            } else {
                const text = t.message.replace(/<br\s*\/?>/gi, "\n");
                const urlPattern = /(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi;
                let lastIndex = 0;
                let match;
                while ((match = urlPattern.exec(text))) {
                    if (match.index > lastIndex) message.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                    let url = match[0];
                    let href = url;
                    if (url.startsWith("//")) href = `http:${url}`;
                    else if (url.startsWith("www.")) href = `http://${url}`;
                    const anchor = document.createElement("a");
                    anchor.href = href;
                    anchor.target = "_blank";
                    anchor.textContent = url;
                    message.appendChild(anchor);
                    lastIndex = match.index + match[0].length;
                }
                if (lastIndex < text.length) message.appendChild(document.createTextNode(text.slice(lastIndex)));
            }
            n.append(timestamp, message);
            return n;
        }
        setFilter(e) {
            if (this.currentFilter === e) return;
            this.currentFilter = e, localStorage.setItem(s, e);
            this.filterButtonGroup.querySelectorAll(".console-logger-filter").forEach((t => {
                t.dataset.type === e ? t.classList.add("active") : t.classList.remove("active");
            })), this.reRenderAllLogs();
        }
        clear() {
            this.logs = [], this.content.innerHTML = "";
        }
        openDialog() {
            if (!this.tryInitialize() || !this.window || "undefined" == typeof layer) return;
            const host = document.createElement("div"), originalParent = this.window.parentNode, originalStyle = this.window.getAttribute("style");
            host.className = "jhs-ui jhs-logger-dialog", host.style.height = "100%", this.window.classList.remove("collapsed", "maximized"), Object.assign(this.window.style, { width: "100%", height: "100%", border: "0", borderRadius: "0", boxShadow: "none" }), this.reRenderAllLogs();
            layer.open({
                type: 1,
                title: "JHS 运行日志",
                content: host.outerHTML,
                area: utils.getDialogArea("md"),
                anim: -1,
                success: layerElement => {
                    $(layerElement).find(".jhs-logger-dialog")[0]?.appendChild(this.window), this.content.scrollTop = this.content.scrollHeight;
                },
                end: () => {
                    originalParent?.appendChild(this.window), null == originalStyle ? this.window.removeAttribute("style") : this.window.setAttribute("style", originalStyle), this.window.classList.add("collapsed"), this.toggleBtn.classList.add("collapsed");
                }
            });
        }
        show() {
            (this.isInitialized && this.container || this.tryInitialize() && this.container) && (this.container.style.display = "", document.body.setAttribute("data-jhs-debug-visible", "true"),
            this.reRenderAllLogs());
        }
        hide() {
            this.isInitialized && this.container && (this.container.style.display = "none", document.body.removeAttribute("data-jhs-debug-visible"));
        }
        lowZIndex() {
            this.isInitialized && this.container && (this.container.style.zIndex = String(JHS_Z_INDEX.debugLow));
        }
        highZIndex() {
            this.isInitialized && this.container && (this.container.style.zIndex = String(JHS_Z_INDEX.debug));
        }
    }
    try {
        unsafeWindow.parent !== unsafeWindow && unsafeWindow.parent.clog && "function" == typeof unsafeWindow.parent.clog.log ? loggerClog = unsafeWindow.parent.clog : loggerClog = new o;
    } catch (r) {
        console.error("创建日志控制台出现异常", r), loggerClog = new o;
    }
    !function() {
        // 运行时再解析 window.clog：IIFE 执行早于 window.clog 赋值，此处若提前捕获会恒为 console
        const resolveClog = () => window.clog || console;
        scope.listen(window, "error", (function(t) {
            const n = t.filename, a = t.message;
            "string" == typeof n && (n.includes("javdb") || n.includes("javbus")) || resolveClog().error(`[全局 Error 异常捕获] ${a} 来源: ${n ?? "未知"}`);
        })), scope.listen(window, "unhandledrejection", (function(t) {
            const e = resolveClog(), n = t.reason, a = (null == n ? void 0 : n.message) ?? "";
            if ([ "NotAllowedError", "AbortError", "NotSupportedError" ].includes(n?.name) || a.includes("play()") || a.includes("The element has no supported sources")) return e.warn("[全局媒体播放异常] 当前媒体源无法播放", n),
            void t.preventDefault();
            if (a.includes("<span>1005</span>") && a.includes("fc2ppvdb")) return;
            const i = `[全局 Promise 异常捕获] ${n.message || n}`;
            e.error(i, n), t.preventDefault();
        }));
    }(), scope.listen(document, "mousedown", (e => {
        const t = window.clog;
        if (!t.isInitialized || !t.container) return;
        const n = e.target, a = [ ".console-logger-container", ".layui-layer-shade", ".loading-container" ].join(",");
        n.closest(a) ? t.highZIndex() : t.lowZIndex();
    }));
}();
const loggerLoading = window.loading;
const loggerShow = window.show;
loggerRuntime = Object.freeze({ loading: loggerLoading, show: loggerShow, clog: loggerClog, showImageViewer: window.showImageViewer });
// The frozen runtime object is the source of truth for bootstrap/compatibility;
// window/globalThis only keep compatibility mirrors for legacy code.
window.loading = loggerRuntime.loading;
window.show = loggerRuntime.show;
window.clog = loggerRuntime.clog;
return loggerRuntime;
}
