document.head.insertAdjacentHTML("beforeend", '\n        <style>\n            .loading-container {\n                position: fixed;\n                top: 0;\n                left: 0;\n                width: 100%;\n                height: 100%;\n                display: flex;\n                justify-content: center;\n                align-items: center;\n                background-color: rgba(0, 0, 0, 0.1);\n                z-index: var(--jhs-z-loading);\n            }\n    \n            .loading-animation {\n                position: relative;\n                width: 60px;\n                height: 12px;\n                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);\n                border-radius: 6px;\n                animation: loading-animate 1.8s ease-in-out infinite;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before,\n            .loading-animation:after {\n                position: absolute;\n                display: block;\n                content: "";\n                animation: loading-animate 1.8s ease-in-out infinite;\n                height: 12px;\n                border-radius: 6px;\n                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n            }\n    \n            .loading-animation:before {\n                top: -20px;\n                left: 10px;\n                width: 40px;\n                background: linear-gradient(90deg, #ff758c 0%, #ff7eb3 100%);\n            }\n    \n            .loading-animation:after {\n                bottom: -20px;\n                width: 35px;\n                background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 100%);\n            }\n    \n            @keyframes loading-animate {\n                0% {\n                    transform: translateX(40px);\n                }\n                50% {\n                    transform: translateX(-30px);\n                }\n                100% {\n                    transform: translateX(40px);\n                }\n            }\n        </style>\n    ');

unsafeWindow.loading = window.loading = function() {
    const e = document.createElement("div");
    e.className = "loading-container";
    const t = document.createElement("div");
    return t.className = "loading-animation", e.appendChild(t), document.body.appendChild(e),
    {
        close: () => {
            e && e.parentNode && e.parentNode.removeChild(e);
        }
    };
}, function() {
    const e = (e, t, n, a, i) => {
        let s;
        "object" == typeof n ? s = n : (s = "object" == typeof a ? a : i || {}, s.gravity = n || "top",
        s.position = "string" == typeof a ? a : "center"), s.gravity && "center" !== s.gravity || (s.offset = {
            y: "calc(50vh - 150px)"
        });
        const o = "var(--jhs-status-fav)", r = "var(--jhs-status-fav-tint)", l = "var(--jhs-status-down)", c = "var(--jhs-status-down-tint)", d = "var(--jhs-status-filter)", h = "var(--jhs-status-filter-tint)", g = {
            borderRadius: "12px",
            padding: "12px 16px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            minWidth: "150px",
            textAlign: "center",
            zIndex: JHS_Z_INDEX.debug
        }, p = {
            text: e,
            duration: 2500,
            close: !1,
            gravity: "top",
            position: "center",
            style: {
                info: {
                    ...g,
                    background: `${o}`,
                    color: "var(--jhs-status-fav-on)"
                },
                success: {
                    ...g,
                    background: `${l}`,
                    color: "var(--jhs-status-down-on)"
                },
                error: {
                    ...g,
                    background: `${d}`,
                    color: "var(--jhs-status-filter-on)"
                }
            }[t],
            stopOnFocus: !0,
            oldestFirst: !1,
            ...s
        };
        -1 === p.duration && (p.close = !0);
        const m = Toastify(p);
        return m.showToast(), m.closeShow = () => {
            m.toastElement.remove();
        }, m;
    };
    unsafeWindow.show = window.show = {
        ok: (t, n = "center", a, i) => e(t, "success", n, a, i),
        error: (t, n = "center", a, i) => e(t, "error", n, a, i),
        info: (t, n = "center", a, i) => e(t, "info", n, a, i)
    };
}(), function() {
    function e(e = 10) {
        setTimeout((() => {
            const e = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = e > 0 ? "hidden" : "";
        }), e);
    }
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .viewer-canvas {\n                overflow: auto !important;\n            }\n            \n            .viewer-close {\n                background: rgba(222, 51, 51, 0.6) !important; /* 状态红 --jhs-status-filter 半透明弱化 */\n            }\n            .viewer-close:hover {\n                background: rgba(222, 51, 51, 0.8) !important;\n            }\n        </style>\n    "),
    window.showImageViewer = function(t, n = "") {
        let a = null, i = !1;
        "string" == typeof t || t instanceof String ? (a = $('<div class="temporary-container jhs-layout-c8be1ccb">').append(`<img src="${t}" alt="${n}">`).appendTo("body"),
        i = !0) : a = $(t);
        const s = {
            zIndex: JHS_Z_INDEX.viewer,
            navbar: !1,
            zoomOnWheel: !1,
            zoomRatio: .1,
            toggleOnDblclick: !1,
            toolbar: {
                zoomIn: 1,
                zoomOut: 1,
                reset: 1,
                rotateLeft: 0,
                rotateRight: 0,
                flipHorizontal: 0,
                flipVertical: 0
            },
            title: !1,
            keyboard: !1,
            viewed() {
                o.zoomTo(1.4);
                let e = (o.viewerData.width - o.imageData.width) / 2;
                o.moveTo(e, 0);
            },
            shown() {
                i && a.remove(), document.documentElement.style.overflow = "hidden", document.body.style.overflow = "hidden",
                o.handleKeydown = function(t) {
                    "Escape" !== t.key && " " !== t.key || (t.preventDefault(), t.stopPropagation(),
                    o.destroy(), document.removeEventListener("keydown", o.handleKeydown), document.documentElement.style.overflow = "",
                    document.body.style.overflow = "", e());
                }, document.addEventListener("keydown", o.handleKeydown);
            },
            hidden() {
                o && o.handleKeydown && document.removeEventListener("keydown", o.handleKeydown),
                o.destroy(), document.documentElement.style.overflow = "", document.body.style.overflow = "",
                e();
            }
        }, o = new Viewer(a[0], s);
        o.show();
    };
}(), window.ImageHoverPreview = class {
    constructor(config = {}) {
        this.config = {
            selector: ".hover-preview",
            dataAttribute: "data-full",
            maxWidth: 1e3,
            maxHeight: 1e3,
            offsetX: 20,
            offsetY: 20,
            zIndex: JHS_Z_INDEX.tooltip,
            transition: .2,
            hideDelay: 100,
            autoAdjustPosition: !0,
            ...config
        };
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
        this.onMouseEnter = event => this.handleMouseEnter(event);
        this.onMouseLeave = event => this.handleMouseLeave(event);
        this.onMouseMove = event => this.handleMouseMove(event);
        this.onDocumentOver = event => this.handleDocumentOver(event);
        this.onDocumentOut = event => this.handleDocumentOut(event);
        this.onDocumentMove = event => this.handleDocumentMove(event);
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
                transition: opacity var(--jhs-hover-transition, .2s) ease;
            }
            .image-hover-preview.active { visibility: visible; opacity: 1; }
            .image-hover-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }
            .image-hover-preview::after {
                position: absolute;
                inset: 0;
                pointer-events: none;
                background: rgba(0, 0, 0, .03);
                content: "";
            }
            .image-hover-preview.loading { min-width: 120px; min-height: 72px; }
            .image-hover-preview.loading::before {
                position: absolute;
                top: 50%;
                left: 50%;
                color: var(--jhs-text-muted);
                font-size: var(--jhs-font-size-md);
                content: "加载中...";
                transform: translate(-50%, -50%);
            }
            .image-hover-preview__error { padding: var(--jhs-space-3); color: var(--jhs-danger); }
        `;
        document.head.appendChild(style);
    }
    createPreviewElement() {
        this.preview = document.createElement("div");
        this.preview.className = "image-hover-preview";
        this.preview.style.zIndex = String(this.config.zIndex);
        this.preview.style.setProperty("--jhs-hover-transition", `${this.config.transition}s`);
        document.body.appendChild(this.preview);
    }
    bindEvents() {
        if (this.eventsBound || this.destroyed) return;
        document.addEventListener("mouseover", this.onDocumentOver), document.addEventListener("mouseout", this.onDocumentOut),
        document.addEventListener("mousemove", this.onDocumentMove), this.eventsBound = !0;
    }
    findTarget(event) {
        const target = event.target;
        return target?.closest ? target.closest(this.config.selector) : null;
    }
    handleDocumentOver(event) {
        const target = this.findTarget(event);
        target && (!event.relatedTarget || !target.contains(event.relatedTarget)) && this.handleMouseEnter(event, target);
    }
    handleDocumentOut(event) {
        const target = this.findTarget(event);
        target && (!event.relatedTarget || !target.contains(event.relatedTarget)) && this.handleMouseLeave();
    }
    handleDocumentMove(event) {
        this.findTarget(event) === this.currentTarget && this.handleMouseMove(event);
    }
    handleMouseEnter(event, delegatedTarget = event.currentTarget) {
        if (this.destroyed || !this.preview) return;
        clearTimeout(this.timer);
        this.timer = null;
        this.currentTarget = delegatedTarget;
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
        if (cached) return void this.commitPreview(source, cached);
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
            this.loadedUrls.set(source, cachedImage), this.pendingImage = null, this.pendingUrl = null, this.commitPreview(source, cachedImage);
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
        this.eventsBound && (document.removeEventListener("mouseover", this.onDocumentOver), document.removeEventListener("mouseout", this.onDocumentOut),
        document.removeEventListener("mousemove", this.onDocumentMove), this.eventsBound = !1);
        this.loadedUrls.clear();
        this.preview?.remove();
        this.preview = null;
        this.currentTarget = null;
    }
}, async function() {
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .console-logger-container {\n                position: fixed;\n                bottom: 0;\n                right: 0;\n                z-index: var(--jhs-z-loading);\n                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n                display: flex;\n                flex-direction: column; \n                align-items: flex-end;\n                width: fit-content;\n            }\n\n            .console-logger-toggle {\n                width: 40px;\n                height: 30px;\n                background: var(--jhs-accent);\n                border-radius: 120px 10px 0 0;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                cursor: pointer;\n                box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);\n                transition: all 0.3s ease;\n                color: var(--jhs-accent-text-on);\n                font-size: 16px;\n            }\n\n            .console-logger-toggle:hover {\n                background: var(--jhs-accent-hover);\n            }\n\n            .console-logger-toggle::after {\n                content: '▼';\n                transition: transform 0.3s ease;\n            }\n\n            .console-logger-toggle.collapsed::after {\n                content: '▲';\n            }\n\n            .console-logger-window {\n                width: 400px;\n                height: 400px;\n                background: var(--jhs-surface);\n                border-radius: 10px 0 10px 10px;\n                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);\n                display: flex;\n                flex-direction: column;\n                overflow: hidden;\n                transform: translateY(0);\n                opacity: 1;\n                /* 简化过渡属性 */\n                transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.3s ease;\n            }\n\n            .console-logger-window.maximized {\n                width: 600px !important;\n                height: 85vh !important;\n                border-radius: 10px 0 0 10px; /* 调整圆角以匹配右下角 */\n            }\n\n            .console-logger-window.collapsed {\n                height: 0 !important;\n                min-height: 0 !important; \n                opacity: 0;\n            }\n\n            .console-logger-header {\n                background: var(--jhs-accent);\n                color: var(--jhs-accent-text-on);\n                padding: 12px 15px;\n                display: flex;\n                justify-content: space-between;\n                align-items: center;\n                flex-shrink: 0;\n            }\n\n            .console-logger-title {\n                font-weight: 600;\n                font-size: 16px;\n            }\n\n            .console-logger-controls {\n                display: flex;\n                gap: 10px;\n            }\n\n            .console-logger-controls button {\n                background: transparent;\n                border: 1px solid rgba(255, 255, 255, 0.3);\n                padding: 5px 10px;\n                font-size: 12px;\n                color: var(--jhs-accent-text-on);\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n            }\n\n            .console-logger-controls button:hover {\n                background: rgba(255, 255, 255, 0.1);\n            }\n\n            /* 新增的按钮样式 */\n            .console-logger-maximize-toggle {\n                line-height: 1;\n                font-size: 14px !important; /* 使箭头看起来更大 */\n                padding: 5px 8px !important;\n            }\n            .console-logger-maximize-toggle::before {\n                content: '⇱'; /* Unicode symbol for maximized */\n            }\n            .console-logger-maximize-toggle.active::before {\n                content: '⇲'; /* Unicode symbol for minimized */\n            }\n\n\n            .console-logger-filters {\n                display: flex;\n                align-items: center;\n                gap: 5px;\n                padding: 10px;\n                background: var(--jhs-surface-2);\n                border-bottom: 1px solid var(--jhs-border);\n                flex-shrink: 0;\n                overflow-x: hidden; \n            }\n\n            /* 新增: 过滤器按钮组的容器，负责滚动 */\n            .console-logger-filter-group {\n                display: flex;\n                gap: 5px;\n                overflow-x: auto; /* 允许过滤器按钮滚动 */\n                flex-grow: 1; /* 占据剩余空间 */\n                padding-right: 10px; /* 避免滚动条影响按钮 */\n            }\n\n            .console-logger-filter {\n                padding: 5px 10px;\n                font-size: 12px;\n                border-radius: 15px;\n                background: var(--jhs-input-bg);\n                color: var(--jhs-text-muted);\n                border: 1px solid var(--jhs-border);\n                cursor: pointer;\n                transition: all 0.3s;\n                white-space: nowrap;\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-filter.active {\n                background: var(--jhs-accent);\n                color: var(--jhs-accent-text-on);\n                border-color: var(--jhs-accent);\n            }\n\n            /* 新增: 滚动到底部按钮的样式 (位于 filtersContainer 内部右侧) */\n            .console-logger-scroll-to-bottom {\n                background: var(--jhs-accent);\n                border: none;\n                padding: 5px 10px;\n                font-size: 12px;\n                color: var(--jhs-accent-text-on);\n                border-radius: 4px;\n                cursor: pointer;\n                transition: background 0.3s;\n                line-height: 1;\n                height: fit-content;\n                white-space: nowrap;\n                margin-left: auto; /* 将按钮推到最右侧 */\n                flex-shrink: 0; /* 确保不被压缩 */\n            }\n\n            .console-logger-scroll-to-bottom:hover {\n                background: var(--jhs-accent-hover);\n            }\n\n\n            .console-logger-content {\n                flex: 1;\n                overflow-y: auto;\n                padding: 10px;\n                background: var(--jhs-surface);\n                word-wrap: break-word;\n                text-align: left;\n            }\n\n            .console-logger-entry {\n                padding: 8px 10px;\n                margin-bottom: 3px;\n                border-radius: 4px;\n                font-size: 12px;\n                line-height: 1.4;\n                /*animation: consoleFadeIn 0.3s ease;*/\n                border-left: 3px solid transparent;\n            }\n\n            @keyframes consoleFadeIn {\n                from { opacity: 0; transform: translateY(5px); }\n                to { opacity: 1; transform: translateY(0); }\n            }\n\n            .console-logger-timestamp {\n                color: var(--jhs-text-muted);\n                font-size: 11px;\n                margin-right: 2px;\n            }\n\n            @media (max-width: 768px) {\n                .console-logger-container {\n                    right: 10px;\n                    bottom: 10px;\n                }\n\n                .console-logger-window {\n                    width: calc(100vw - 20px);\n                    height: 300px;\n                }\n            }\n            \n            .console-logger-message[data-type=\"json\"] {\n                white-space: pre-wrap; \n            }\n        </style>\n    ");
    const e = {
        base: {
            label: "信息",
            background: "var(--jhs-status-fav-tint)",
            borderLeftColor: "var(--jhs-accent)"
        },
        warn: {
            label: "警告",
            background: "var(--jhs-status-watch-tint)",
            borderLeftColor: "var(--jhs-status-watch)"
        },
        error: {
            label: "错误",
            background: "var(--jhs-status-filter-tint)",
            borderLeftColor: "var(--jhs-status-filter)"
        },
        debug: {
            label: "调试",
            background: "var(--jhs-surface-2)",
            borderLeftColor: "var(--jhs-border-strong)"
        }
    }, t = {
        base: [ "base", "warn", "error" ],
        warn: [ "warn" ],
        error: [ "error" ],
        debug: [ "base", "warn", "error", "debug" ]
    }, n = await storageManager.getSetting("clogMsgCount", 2e3), a = "jhs_clog_maximize", i = "jhs_clog_expand", s = "jhs_clog_filter";
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
            this.container = document.createElement("div"), this.container.className = "console-logger-container",
            this.container.style.display = "none", this.toggleBtn = document.createElement("div"),
            this.toggleBtn.className = "console-logger-toggle collapsed", this.container.appendChild(this.toggleBtn),
            this.window = document.createElement("div"), this.window.className = "console-logger-window collapsed";
            const t = document.createElement("div");
            t.className = "console-logger-header";
            const n = document.createElement("div");
            n.className = "console-logger-title", n.textContent = "JHS Console";
            const a = document.createElement("div");
            a.className = "console-logger-controls", this.maximizeBtn = document.createElement("button"),
            this.maximizeBtn.textContent = "", this.maximizeBtn.classList.add("console-logger-maximize-toggle"),
            a.appendChild(this.maximizeBtn);
            const i = document.createElement("button");
            i.textContent = "清空", i.addEventListener("click", (() => this.clear())), a.appendChild(i),
            t.appendChild(n), t.appendChild(a), this.filtersContainer = document.createElement("div"),
            this.filtersContainer.className = "console-logger-filters", this.filterButtonGroup = document.createElement("div"),
            this.filterButtonGroup.className = "console-logger-filter-group", this.filtersContainer.appendChild(this.filterButtonGroup),
            this.scrollToBottomBtn = document.createElement("button"), this.scrollToBottomBtn.className = "console-logger-scroll-to-bottom",
            this.scrollToBottomBtn.textContent = "到底部", this.filtersContainer.appendChild(this.scrollToBottomBtn),
            this.content = document.createElement("div"), this.content.className = "console-logger-content jhs-scrollbar",
            this.window.appendChild(t), this.window.appendChild(this.filtersContainer), this.window.appendChild(this.content),
            this.container.appendChild(this.window), document.body.appendChild(this.container),
            Object.keys(e).forEach((t => {
                const n = document.createElement("div");
                n.className = "console-logger-filter", t === this.currentFilter && n.classList.add("active"),
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
            this.toggleBtn.classList.toggle("collapsed"), e ? localStorage.setItem(i, "no") : (localStorage.setItem(i, "yes"),
            this.reRenderAllLogs());
        }
        checkInitialCollapseState() {
            const e = localStorage.getItem(i);
            e && "no" !== e ? (this.window.classList.toggle("collapsed"), this.toggleBtn.classList.toggle("collapsed"),
            setTimeout((() => {
                this.content.scrollTop = this.content.scrollHeight;
            }), 0)) : (this.window.classList.add("collapsed"), this.toggleBtn.classList.add("collapsed"));
        }
        checkInitialMaximizeState() {
            "maximized" === localStorage.getItem(a) && (this.window.classList.add("maximized"),
            this.maximizeBtn.classList.add("active"));
        }
        toggleMaximize() {
            const e = this.window.classList.toggle("maximized");
            this.maximizeBtn.classList.toggle("active", e), e ? localStorage.setItem(a, "maximized") : localStorage.setItem(a, "minimized"),
            this.window.classList.contains("collapsed") || (this.content.scrollTop = this.content.scrollHeight);
        }
        addLog(t, a = "base", ...i) {
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
            h = h.replace(/(?:(?:https?|ftp):\/\/|www\.|(?:\/\/))[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi, (e => {
                const t = e.startsWith("http") || e.startsWith("ftp"), n = e.startsWith("//"), a = e.startsWith("www.");
                let i = e;
                return n ? i = `http:${e}` : !t && a && (i = `http://${e}`), `<a href="${escapeHtml(i)}" target="_blank">${escapeHtml(e)}</a>`;
            }));
            const g = {
                message: h,
                messageType: c,
                type: o,
                timestamp: new Date,
                id: Date.now() + Math.random()
            };
            if (this.logs.push(g), this.logs.length > n) {
                const e = this.logs[0];
                if (s) {
                    const t = this.content.querySelector(`.console-logger-entry[data-id="${e.id}"]`);
                    t && (this.logs.shift(), this.content.removeChild(t));
                }
            }
            s && this.renderLog(g);
        }
        log(...e) {
            const [t, ...n] = e;
            setTimeout((() => {
                this.addLog(t, "base", ...n);
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
            const a = e[t.type] || e.base;
            n.style.borderLeft = "3px solid " + a.borderLeftColor, n.style.background = a.background;
            const i = (t.timestamp instanceof Date ? t.timestamp : new Date(t.timestamp)).toTimeString().split(" ")[0];
            return n.innerHTML = `\n                <span class="console-logger-timestamp">[${i}]</span>\n                <span class="console-logger-message" data-type="${t.messageType}">${t.message}</span>\n            `,
            n;
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
        show() {
            (this.isInitialized && this.container || this.tryInitialize() && this.container) && (this.container.style.display = "",
            this.reRenderAllLogs());
        }
        hide() {
            this.isInitialized && this.container && (this.container.style.display = "none");
        }
        lowZIndex() {
            this.isInitialized && this.container && (this.container.style.zIndex = String(JHS_Z_INDEX.debugLow));
        }
        highZIndex() {
            this.isInitialized && this.container && (this.container.style.zIndex = String(JHS_Z_INDEX.debug));
        }
    }
    try {
        unsafeWindow.parent.clog && "function" == typeof unsafeWindow.parent.clog.log ? window.clog = unsafeWindow.clog = unsafeWindow.parent.clog : window.clog = unsafeWindow.clog = new o;
    } catch (r) {
        console.error("创建日志控制台出现异常", r), window.clog = unsafeWindow.clog = new o;
    }
    !function() {
        const e = window.clog || console;
        window.addEventListener("error", (function(t) {
            const n = t.filename, a = t.message;
            n.includes("javdb") || n.includes("javbus") || e.error(`[全局 Error 异常捕获] ${a} 来源: ${n}`);
        })), window.addEventListener("unhandledrejection", (function(t) {
            const n = t.reason, a = (null == n ? void 0 : n.message) ?? "";
            if ([ "NotAllowedError", "AbortError", "NotSupportedError" ].includes(n?.name) || a.includes("play()") || a.includes("The element has no supported sources")) return e.warn("[全局媒体播放异常] 当前媒体源无法播放", n),
            void t.preventDefault();
            if (a.includes("<span>1005</span>") && a.includes("fc2ppvdb")) return;
            const i = `[全局 Promise 异常捕获] ${n.message || n}`;
            e.error(i, n), t.preventDefault();
        }));
    }(), document.addEventListener("mousedown", (e => {
        const t = window.clog;
        if (!t.isInitialized || !t.container) return;
        const n = e.target, a = [ ".console-logger-container", ".layui-layer-shade", ".loading-container" ].join(",");
        n.closest(a) ? t.highZIndex() : t.lowZIndex();
    }));
}(), function() {
    function e(e, t, n) {
        const a = function(e) {
            const t = document.createElement("div");
            t.classList.add("js-tooltip");
            const n = document.createElement("div");
            return n.innerHTML = escapeHtml(e), t.appendChild(n), document.body.appendChild(t), t;
        }(t);
        a.style.display = "block";
        const i = e.getBoundingClientRect(), s = a.getBoundingClientRect();
        a.style.display = "none";
        const o = window.innerWidth, r = window.innerHeight;
        let l, c, d = n;
        const h = e => e >= 8 && e + s.height <= r - 8, g = e => e >= 8 && e + s.width <= o - 8, p = i.left + i.width / 2 - s.width / 2, m = i.top + i.height / 2 - s.height / 2;
        switch (n) {
          case "top":
            c = i.top - s.height - 0, c < 8 && h(i.bottom + 0) && (c = i.bottom + 0, d = "bottom");
            break;

          case "bottom":
            c = i.bottom + 0, c + s.height > r - 8 && h(i.top - s.height - 0) && (c = i.top - s.height - 0,
            d = "top");
            break;

          case "left":
            l = i.left - s.width - 0, l < 8 && g(i.right + 0) && (l = i.right + 0, d = "right");
            break;

          case "right":
            l = i.right + 0, l + s.width > o - 8 && g(i.left - s.width - 0) && (l = i.left - s.width - 0,
            d = "left");
        }
        const u = "left" === d || "right" === d;
        "top" === d || "bottom" === d ? (l = p, l < 8 ? l = 8 : l + s.width > o - 8 && (l = o - s.width - 8)) : u && (c = m,
        c < 8 ? c = 8 : c + s.height > r - 8 && (c = r - s.height - 8)), a.style.left = `${l}px`,
        a.style.top = `${c}px`, a.classList.add("is-active"), e.tooltipElement = a;
    }
    document.head.insertAdjacentHTML("beforeend", "\n        <style>\n            .js-tooltip {\n                position: fixed;\n                padding: 8px 12px;\n                border: 1px solid var(--jhs-border);\n                border-radius: var(--jhs-radius-sm);\n                white-space: normal;\n                max-width: 600px;\n                pointer-events: none;\n                font-size: 14px;\n                line-height: 1.5;\n                z-index: var(--jhs-z-tooltip);\n                background: var(--jhs-surface-2);\n                color: var(--jhs-text);\n                box-shadow: var(--jhs-shadow-md);\n                display: none;\n            }\n            .js-tooltip.is-active {\n                display: block !important;\n            }\n        </style>\n    ");
    const t = "[data-tip-top], [data-tip-bottom], [data-tip-left], [data-tip-right], [data-tip]";
    document.addEventListener("mouseover", (n => {
        const a = n.target.closest(t);
        if (a && !a.tooltipElement) {
            let t, n = "top";
            if (a.hasAttribute("data-tip-bottom") ? (t = a.getAttribute("data-tip-bottom"),
            n = "bottom") : a.hasAttribute("data-tip-left") ? (t = a.getAttribute("data-tip-left"),
            n = "left") : a.hasAttribute("data-tip-right") ? (t = a.getAttribute("data-tip-right"),
            n = "right") : a.hasAttribute("data-tip-top") ? (t = a.getAttribute("data-tip-top"),
            n = "top") : a.hasAttribute("data-tip") && (t = a.getAttribute("data-tip"), n = "top"),
            !t) return;
            a.hoverTimeout = setTimeout((() => {
                a.matches(":hover") && !a.tooltipElement && e(a, t, n);
            }), 50);
        }
    })), document.addEventListener("mouseout", (e => {
        const n = e.target.closest(t);
        var a;
        n && (n.hoverTimeout && (clearTimeout(n.hoverTimeout), n.hoverTimeout = null), n.contains(e.relatedTarget) || n.tooltipElement && ((a = n.tooltipElement) && a.parentNode && a.remove(),
        n.tooltipElement = null));
    }));
}();
