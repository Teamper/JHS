// @ts-check

import { LifecycleScope } from "./lifecycle-scope.js";
import { acquirePageScrollLock } from "./page-scroll-lock.js";
import { dismissActiveTooltip } from "./tooltip-controller.js";
import { JHS_Z_INDEX } from "./theme.js";
import { getIcon } from "./icons.js";

/** Shared camera policy; dimensions are CSS pixels, ratio is relative to the source.
 * @param {number} naturalWidth @param {number} naturalHeight @param {number} width @param {number} height @param {string} [mode] @param {'photo'|'contact-sheet'} [imageKind] */
export function getImageView(naturalWidth, naturalHeight, width, height, mode = "default", imageKind) {
    const wide = mode === "width" || mode === "default" && (imageKind === "contact-sheet" || imageKind !== "photo" && naturalHeight / naturalWidth >= 2);
    const ratio = mode === "natural" ? 1 : wide ? width / naturalWidth : Math.min(width / naturalWidth, height / naturalHeight);
    return { ratio, x: (width - naturalWidth * ratio) / 2, y: wide ? 0 : (height - naturalHeight * ratio) / 2 };
}

/** @param {LifecycleScope} runtimeScope */
export function createImageViewer(runtimeScope) {
    /** @type {any} */ let active = null;
    /** @param {any} source @param {string} [alt] @param {any} [options] */
    const showImageViewer = (source, alt = "", options = {}) => {
        if (runtimeScope.disposed || options.scope?.disposed) return;
        // The page-world facade lets a same-origin detail frame use the outer canvas.
        // Access to parent/frameElement is deliberately guarded for cross-origin frames.
        try {
            const parent = (/** @type {any} */ (globalThis)).unsafeWindow?.parent;
            if (window.parent !== window && parent?.showImageViewer && parent.showImageViewer !== showImageViewer) {
                return parent.showImageViewer(source, alt, options);
            }
        } catch { /* The current document remains a complete fallback. */ }

        const node = typeof source === "string" ? null : source?.jquery ? source[0] : source;
        const selected = node?.matches?.("img") ? node : node?.querySelector?.("img");
        const imageKind = options.imageKind;
        const workspace = selected?.closest(".jhs-fc2-workspace");
        const fc2Gallery = workspace?.querySelector('[data-jhs-slot="gallery"]');
        const suppliedGallery = options.galleryRoot?.jquery ? options.galleryRoot[0] : options.galleryRoot;
        const gallery = imageKind === "contact-sheet" ? null : suppliedGallery || (fc2Gallery?.contains(selected) ? fc2Gallery : null);
        const originals = gallery ? [...gallery.querySelectorAll("img")] : selected ? [selected] : [];
        const images = options.images?.length ? options.images.map((/** @type {any} */ image) => typeof image === "string" ? { url: image, alt } : image)
            : typeof source === "string" ? [{ url: source, alt }] : originals.map(image => ({ url: image.currentSrc || image.src, alt: image.alt }));
        if (!images.length || selected && !selected.isConnected) return;
        const initialIndex = Math.min(images.length - 1, Math.max(0, Math.trunc(Number(options.initialViewIndex ?? originals.indexOf(selected)) || 0)));
        const owner = options.owner?.jquery ? options.owner[0] : options.owner || selected?.closest(".layui-layer");
        const suppliedTrigger = options.trigger?.jquery ? options.trigger[0] : options.trigger;
        const sourceDocument = selected?.ownerDocument || owner?.ownerDocument || suppliedTrigger?.ownerDocument || document;
        const trigger = suppliedTrigger || selected?.closest("button,a,[tabindex]") || sourceDocument.activeElement;
        if (owner && !owner.isConnected) return;
        dismissActiveTooltip(document);
        active?.close(false);
        const scope = new LifecycleScope("ui:image-viewer");
        const releases = [acquirePageScrollLock(document)];
        if (sourceDocument !== document) releases.push(acquirePageScrollLock(sourceDocument));
        const host = document.createElement("div");
        host.className = "temporary-container jhs-image-viewer-source";
        host.hidden = true;
        for (const item of images) {
            const image = document.createElement("img");
            image.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";
            image.setAttribute("data-jhs-viewer-source", String(item.url));
            image.alt = String(item.alt || alt); host.appendChild(image);
        }
        document.body.appendChild(host);
        /** @type {any} */ let viewer;
        /** @type {any} */ let counter;
        /** @type {any} */ let status;
        /** @type {any} */ let releaseRuntime;
        /** @type {any} */ let releaseOwner;
        let adjusted = false, applying = false;
        /** @type {Map<string, HTMLButtonElement>} */ const fitButtons = new Map();
        const setFitState = (activeMode = "") => {
            for (const [name, node] of fitButtons) node.setAttribute("aria-pressed", String(name === activeMode));
        };
        const wasInert = workspace?.inert;
        if (workspace) workspace.inert = true;
        const session = { close(restoreFocus = true) {
            if (scope.disposed) return;
            dismissActiveTooltip(document, viewer?.viewer);
            scope.dispose(); releaseRuntime?.(); releaseOwner?.();
            try { viewer?.destroy(); } finally {
                host.remove(); releases.reverse().forEach(release => release());
                if (workspace) workspace.inert = wasInert;
                if (active === session) {
                    active = null;
                    if (restoreFocus && trigger?.isConnected) trigger.focus?.({ preventScroll: true });
                }
            }
        } };
        active = session;
        releaseRuntime = runtimeScope.addCleanup(() => session.close(false));
        releaseOwner = options.scope?.addCleanup?.(() => session.close(false));
        const zIndex = [...document.querySelectorAll(".layui-layer")].reduce((value, root) => {
            const style = window.getComputedStyle(root), z = Number(style.zIndex);
            return style.display !== "none" && Number.isFinite(z) ? Math.max(value, z + 1) : value;
        }, Number(JHS_Z_INDEX.viewer));
        const applyView = (mode = "default") => {
            if (scope.disposed || !viewer?.viewed) return;
            const { naturalWidth, naturalHeight } = viewer.imageData;
            if (!naturalWidth || !naturalHeight) return;
            const height = Math.max(1, viewer.viewerData.height - viewer.footer.offsetHeight);
            const camera = getImageView(naturalWidth, naturalHeight, viewer.viewerData.width, height, mode, imageKind);
            applying = true;
            viewer.zoomTo(camera.ratio); viewer.moveTo(camera.x, camera.y);
            applying = false;
            adjusted = mode !== "default";
            const wide = mode === "width" || mode === "default" && (imageKind === "contact-sheet" || imageKind !== "photo" && naturalHeight / naturalWidth >= 2);
            setFitState(mode === "natural" ? "natural" : wide ? "width" : "contain");
        };
        /** @param {number} direction */
        const navigate = direction => direction < 0 ? viewer?.prev(false) : viewer?.next(false);
        /** @param {number} index */
        const updateNavigation = index => {
            const previous = viewer?.viewer?.querySelector('.jhs-image-viewer-prev'), next = viewer?.viewer?.querySelector('.jhs-image-viewer-next');
            if (previous) previous.disabled = index === 0;
            if (next) next.disabled = index === images.length - 1;
        };
        const bindControls = () => {
            if (scope.disposed || !viewer?.viewer) return;
            const root = viewer.viewer, toolbar = document.createElement("div");
            root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "图片预览"); root.setAttribute("aria-modal", "true");
            root.removeAttribute("aria-labelledby");
            toolbar.className = "jhs-image-viewer-toolbar";
            /** @param {string} label @param {string} text @param {string} className @param {()=>void} action @param {any} [target] */
            const button = (label, text, className, action, target = toolbar) => {
                const control = document.createElement("button");
                control.type = "button"; control.className = `jhs-btn jhs-btn--secondary ${className}`;
                control.setAttribute("aria-label", label);
                if (["x", "chevron-left", "chevron-right"].includes(text)) control.insertAdjacentHTML("beforeend", getIcon(text));
                else control.textContent = text;
                scope.listen(control, "click", event => { event.preventDefault(); event.stopPropagation(); action(); });
                target.appendChild(control); return control;
            };
            const close = button("关闭图片", "x", "jhs-image-viewer-close", () => session.close(), root);
            if (images.length > 1) {
                button("上一张", "chevron-left", "jhs-image-viewer-nav jhs-image-viewer-prev", () => navigate(-1), root);
                button("下一张", "chevron-right", "jhs-image-viewer-nav jhs-image-viewer-next", () => navigate(1), root);
            }
            button("放大图片", "放大", "", () => { viewer.zoom(.1); });
            button("缩小图片", "缩小", "", () => { viewer.zoom(-.1); });
            fitButtons.set("contain", button("完整显示", "完整显示", "", () => applyView("contain")));
            fitButtons.set("width", button("按宽度显示", "按宽度", "", () => applyView("width")));
            fitButtons.set("natural", button("原尺寸", "原尺寸", "", () => applyView("natural")));
            setFitState("");
            counter = document.createElement("span"); counter.className = "jhs-image-viewer-count";
            counter.setAttribute("aria-live", "polite"); toolbar.appendChild(counter); viewer.footer.appendChild(toolbar);
            status = document.createElement("div"); status.className = "jhs-image-viewer-status"; status.setAttribute("role", "status"); status.hidden = true;
            root.appendChild(status);
            const failure = document.createElement("span"); status.appendChild(failure);
            button("重试图片", "重试", "", () => { status.hidden = true; viewer.view(viewer.index); }, status);
            scope.listen(viewer.canvas, "error", event => {
                if (scope.disposed || event.target !== viewer.image) return;
                viewer.canvas.classList.remove("viewer-loading"); failure.textContent = "图片加载失败"; status.hidden = false;
            }, true);
            // Long sheets zoom; normal photographs browse without wrapping.
            let lastWheel = 0;
            scope.listen(root, "wheel", event => {
                if (viewer.canvas.contains(/** @type {Node} */ (event.target))) {
                    if (viewer.viewed && (imageKind === "contact-sheet" || imageKind !== "photo" && viewer.imageData.naturalHeight / viewer.imageData.naturalWidth >= 2)) return;
                    const wheel = /** @type {WheelEvent} */ (event);
                    event.preventDefault(); event.stopImmediatePropagation();
                    if (viewer.viewed && wheel.deltaY && performance.now() - lastWheel > 180) {
                        lastWheel = performance.now(); navigate(wheel.deltaY < 0 ? -1 : 1);
                    }
                    return;
                }
                event.preventDefault(); event.stopImmediatePropagation();
            }, { capture: true, passive: false });
            /** @type {{x:number,y:number}|null} */ let press = null;
            let dragged = false;
            scope.listen(root, 'pointerdown', event => { const e = /** @type {PointerEvent} */ (event); press = {x:e.clientX,y:e.clientY}; dragged = false; }, true);
            scope.listen(root, 'pointermove', event => { const e = /** @type {PointerEvent} */ (event); if (press && Math.hypot(e.clientX-press.x,e.clientY-press.y)>5) dragged = true; }, true);
            scope.listen(root, 'pointerup', () => { press = null; }, true);
            scope.listen(root, 'pointercancel', () => { press = null; dragged = true; }, true);
            scope.listen(root, 'click', event => { if ([viewer.canvas,root,viewer.footer,toolbar].includes(event.target) && !dragged) session.close(); });
            updateNavigation(initialIndex);
            const sizeCanvas = () => { viewer.canvas.style.bottom = `${viewer.footer.offsetHeight}px`; };
            sizeCanvas();
            if (typeof ResizeObserver !== "undefined") {
                const observer = new ResizeObserver(() => { if (!scope.disposed) { sizeCanvas(); if (!adjusted) applyView(); } });
                observer.observe(viewer.footer); scope.ownObserver(observer);
            }
            close.focus({ preventScroll: true });
        };
        try {
            scope.listen(document, "keydown", event => {
                const key = /** @type {KeyboardEvent} */ (event).key;
                if (key === "Escape" && dismissActiveTooltip(document)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
                if (key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); session.close(); return; }
                if (key === "Tab" && viewer?.viewer) {
                    const controls = [...viewer.viewer.querySelectorAll("button")].filter(node => !node.disabled && !node.closest("[hidden]"));
                    const shift = /** @type {KeyboardEvent} */ (event).shiftKey;
                    const index = controls.indexOf(document.activeElement);
                    const current = index < 0 && shift ? 0 : index;
                    event.preventDefault(); event.stopImmediatePropagation(); controls[(current + (shift ? -1 : 1) + controls.length) % controls.length]?.focus(); return;
                }
                if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(key) && viewer?.viewed) {
                    const step = key.startsWith("Page") ? viewer.canvas.clientHeight * .8 : 80;
                    event.preventDefault(); event.stopImmediatePropagation(); viewer.move(0, key.endsWith("Up") ? step : -step); return;
                }
                if (["ArrowLeft", "ArrowRight"].includes(key) && images.length > 1) {
                    event.preventDefault(); event.stopImmediatePropagation(); navigate(key === "ArrowLeft" ? -1 : 1);
                }
            }, true);
            const checkSource = () => { if (selected && !selected.isConnected || owner && !owner.isConnected) session.close(false); };
            scope.observe(sourceDocument.body, checkSource, { childList: true, subtree: true });
            if (sourceDocument !== document) {
                const frame = sourceDocument.defaultView?.frameElement;
                scope.observe(document.body, () => { if (frame && !frame.isConnected) session.close(false); }, { childList: true, subtree: true });
                scope.listen(sourceDocument.defaultView, "pagehide", () => session.close(false));
            }
            const Viewer = (/** @type {any} */ (globalThis)).Viewer;
            viewer = new Viewer(host, {
                className: "jhs-image-viewer jhs-ui", zIndex, url: "data-jhs-viewer-source", initialViewIndex: initialIndex,
                navbar: false, toolbar: false, title: false, button: false, keyboard: false, focus: false,
                backdrop: "static", transition: false, toggleOnDblclick: false, slideOnTouch: false,
                zoomOnWheel: true, zoomOnTouch: true, movable: true, zoomRatio: .1,
                ready: bindControls,
                shown() { if (!scope.disposed) { viewer.viewer.removeAttribute("aria-labelledby"); viewer.viewer.querySelector(".jhs-image-viewer-close")?.focus({ preventScroll:true }); } },
                view(/** @type {any} */ event) { if (!scope.disposed) { adjusted = false; updateNavigation(event.detail.index); if (status) status.hidden = true; if (counter) counter.textContent = `${event.detail.index + 1} / ${images.length}`; } },
                viewed() { if (!scope.disposed) applyView(); },
                zoom() { if (!applying) { adjusted = true; setFitState(""); } }, move() { if (!applying) { adjusted = true; setFitState(""); } },
                hidden() { session.close(); }
            });
            // The shared scroll lock owns compensation and nested locks, not Viewer's body padding.
            viewer.open = () => {}; viewer.close = () => {};
            // Native resize reinitializes the image. Refresh the canvas without resetting a user's camera.
            viewer.resize = () => {
                if (scope.disposed || !viewer.isShown) return;
                viewer.initContainer(); viewer.initViewer(); viewer.renderViewer(); viewer.renderList();
                viewer.canvas.style.bottom = `${viewer.footer.offsetHeight}px`;
                if (viewer.viewed) { if (adjusted) viewer.renderImage(); else applyView(); }
            };
            viewer.show();
        } catch (error) { session.close(false); throw error; }
        return session;
    };
    return showImageViewer;
}
