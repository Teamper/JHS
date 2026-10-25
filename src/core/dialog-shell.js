// @ts-check
import { LifecycleScope } from "./lifecycle-scope.js";
import { acquirePageScrollLock } from "./page-scroll-lock.js";
import { dismissActiveTooltip } from "./tooltip-controller.js";
import { ownedPopoverRoots } from "./owned-popover.js";

/** @type {WeakMap<Document, Set<{root: HTMLElement, previous: HTMLElement | null}>>} */
const focusOwners = new WeakMap();

/** Limit focus to the top owned dialog and its portal children. @param {HTMLElement} root @param {string | undefined} initialFocus */
function bindDialogFocus(root, initialFocus) {
    const doc = root.ownerDocument, view = doc.defaultView;
    const owners = focusOwners.get(doc) || new Set();
    focusOwners.set(doc, owners);
    const owner = { root, previous: /** @type {HTMLElement | null} */ (doc.activeElement) };
    owners.add(owner);
    let disposed = false;
    const visible = (/** @type {HTMLElement} */ node) => {
        if (!node.isConnected || node.closest('[hidden],[inert]')) return false;
        for (let element = /** @type {HTMLElement | null} */ (node); element; element = element.parentElement) {
            const style = view?.getComputedStyle(element);
            if (style?.display === "none" || style?.visibility === "hidden") return false;
        }
        return true;
    };
    const blocked = () => {
        const z = Number(view?.getComputedStyle(root).zIndex || root.style.zIndex) || 0;
        const layers = [...doc.querySelectorAll('.layui-layer,.jhs-quick-setting-sheet,.viewer-container')];
        return layers.some(node => {
            const element = /** @type {HTMLElement} */ (node);
            if (element === root || !visible(element)) return false;
            if (element.matches('.viewer-container')) return !element.classList.contains('viewer-hide');
            const layerZ = Number(view?.getComputedStyle(element).zIndex) || 0;
            return layerZ > z || layerZ === z && Boolean(root.compareDocumentPosition(element) & 4);
        });
    };
    const contains = (/** @type {Node | null} */ node) => Boolean(node && (root.contains(node) || ownedPopoverRoots(root).some(portal => portal.contains(node))));
    const items = () => [root, ...ownedPopoverRoots(root)].flatMap(node => [...node.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),iframe,[tabindex]:not([tabindex="-1"])')]).map(node => /** @type {HTMLElement} */ (node)).filter(node => visible(node) && node.getAttribute('aria-disabled') !== 'true');
    const focusFirst = () => {
        const list = items(), requested = initialFocus ? root.querySelector(initialFocus) : null;
        const target = requested && list.includes(/** @type {HTMLElement} */ (requested)) ? requested : list[0] || root;
        /** @type {HTMLElement} */ (target).focus({ preventScroll: true });
    };
    const keydown = (/** @type {KeyboardEvent} */ event) => {
        if (disposed || !visible(root) || blocked() || event.key !== 'Tab') return;
        const list = items(), current = /** @type {HTMLElement | null} */ (doc.activeElement);
        if (!list.length) { event.preventDefault(); root.focus({ preventScroll: true }); return; }
        if (!contains(current) || event.shiftKey && current === list[0] || !event.shiftKey && current === list[list.length - 1]) {
            event.preventDefault();
            (event.shiftKey ? list[list.length - 1] : list[0]).focus({ preventScroll: true });
        }
    };
    const focusin = (/** @type {FocusEvent} */ event) => {
        if (!disposed && visible(root) && !blocked() && !contains(/** @type {Node | null} */ (event.target))) focusFirst();
    };
    root.setAttribute('tabindex', '-1');
    doc.addEventListener('keydown', keydown, true);
    doc.addEventListener('focusin', focusin, true);
    queueMicrotask(() => { if (!disposed && visible(root) && !blocked()) focusFirst(); });
    return () => {
        if (disposed) return;
        disposed = true;
        doc.removeEventListener('keydown', keydown, true);
        doc.removeEventListener('focusin', focusin, true);
        owners.delete(owner);
        for (const nested of owners) if (nested.previous && root.contains(nested.previous)) nested.previous = owner.previous;
        if (owner.previous && visible(owner.previous) && !blocked()) owner.previous.focus({ preventScroll: true });
    };
}

/** @type {WeakMap<HTMLElement, () => void>} */
const buttonBindings = new WeakMap();

/** Enhance vendor anchors once, including bootstrap-free confirmation callers. @param {HTMLElement} root */
export function enhanceDialogButtons(root) {
    const existing = buttonBindings.get(root);
    if (existing) return existing;
    const selector = ".layui-layer-btn > a, .layui-layer-setwin .layui-layer-close";
    for (const button of root.querySelectorAll(selector)) {
        button.setAttribute("role", "button");
        button.setAttribute("tabindex", "0");
        if (button.matches(".layui-layer-close")) button.setAttribute("aria-label", "关闭弹窗");
    }
    const keydown = (/** @type {KeyboardEvent} */ event) => {
        const button = /** @type {HTMLElement | null} */ (/** @type {Element | null} */ (event.target)?.closest?.(selector));
        if (!button || !root.contains(button) || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        if (button.getAttribute("aria-disabled") !== "true" && !button.hasAttribute("disabled")) button.click();
    };
    root.addEventListener("keydown", keydown);
    let disposed = false;
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        root.removeEventListener("keydown", keydown);
        buttonBindings.delete(root);
    };
    buttonBindings.set(root, cleanup);
    return cleanup;
}

const prepared = new WeakSet();
/** @type {WeakMap<Function, (element: HTMLElement, id: number) => boolean>} */
const shellMounts = new WeakMap();

/** Mount the iframe shell before its remote document finishes loading. @param {Record<string, any>} options @param {number} id @param {Document} doc */
export function mountPendingDialogShell(options, id, doc) {
    const root = doc.getElementById(`layui-layer${id}`);
    return Boolean(root && shellMounts.get(options.success)?.(root, id));
}

/** 消费内部 UI 配置，保留 vendor 回调、返回值和关闭策略。 */
/** @param {Record<string, any>} options @param {{getDialogArea?: (size: string) => string[]}} [utils] */
export function prepareDialogOptions(options = {}, utils = {}) {
    if (prepared.has(options) || prepared.has(options.success)) return options;
    const { ui, ...vendor } = options;
    const lockScroll = vendor.scrollbar === false;
    if (lockScroll) vendor.scrollbar = true;
    const body = ["scroll", "table", "media"].includes(ui?.body) ? ui.body : "scroll";
    if (ui?.size && utils.getDialogArea) vendor.area = utils.getDialogArea(ui.size);
    /** @type {LifecycleScope | undefined} */
    let scope;
    /** @type {HTMLElement | undefined} */
    let ownedRoot;
    let ended = false;
    const success = vendor.success, end = vendor.end;
    const mount = function(/** @type {any} */ element, /** @type {number} */ id) {
        const root = element?.nodeType === 1 ? element : element?.[0] || globalThis.document?.getElementById(`layui-layer${id}`);
        if (ended || root && !root.isConnected) return false;
        // Layer can call success on every iframe load; one root owns one lock/listener scope.
        if (root?.classList && root !== ownedRoot) {
            scope?.dispose();
            ownedRoot = root;
            dismissActiveTooltip(root.ownerDocument);
            root.classList.add("jhs-dialog", "jhs-ui");
            root.dataset.jhsDialogBody = body;
            root.setAttribute("role", "dialog");
            root.setAttribute("aria-modal", "true");
            const title = root.querySelector(".layui-layer-title");
            if (title?.textContent?.trim()) {
                title.id ||= `jhs-dialog-title-${id}`;
                root.setAttribute("aria-labelledby", title.id);
            } else if (!root.hasAttribute("aria-label")) root.setAttribute("aria-label", typeof vendor.title === "string" ? vendor.title : "弹窗");
            scope = new LifecycleScope(`dialog-shell-${id}`);
            const ownerScope = scope, view = root.ownerDocument.defaultView;
            if (root.parentElement && view?.MutationObserver) {
                const observer = new view.MutationObserver(() => { if (!root.isConnected) ownerScope.dispose(); });
                observer.observe(root.parentElement, {childList:true});
                ownerScope.ownObserver(observer);
            }
            scope.addCleanup(() => dismissActiveTooltip(root.ownerDocument, root));
            if (lockScroll) scope.addCleanup(acquirePageScrollLock(root));
            scope.addCleanup(enhanceDialogButtons(root));
            if (Number(vendor.type) !== 2 && ui?.focus !== "caller") scope.addCleanup(bindDialogFocus(root, ui?.initialFocus));
            const resize = () => {
                if (ui?.size && utils.getDialogArea) {
                    const [width, height] = utils.getDialogArea(ui.size);
                    Object.assign(root.style, { width, height });
                    const content = root.querySelector(".layui-layer-content"), frame = root.querySelector("iframe");
                    if (frame && content) {
                        const titleHeight = root.querySelector(".layui-layer-title")?.getBoundingClientRect().height || 0;
                        content.style.height = `${Math.max(0,parseFloat(height)-titleHeight)}px`;
                        frame.style.height = content.style.height;
                    }
                }
                root.style.maxWidth = `${Math.max(0, window.innerWidth - 16)}px`;
                root.style.maxHeight = `${Math.max(0, window.innerHeight - 16)}px`;
                const rect = root.getBoundingClientRect();
                // 使用当前位置的偏移量，兼容宿主通过 transform 居中的外壳。
                if (ui?.size || rect.right > window.innerWidth - 8 || rect.left < 8) root.style.left = `${root.offsetLeft + Math.max(8, (window.innerWidth - rect.width) / 2) - rect.left}px`;
                if (ui?.size || rect.bottom > window.innerHeight - 8 || rect.top < 8) root.style.top = `${root.offsetTop + Math.max(8, (window.innerHeight - rect.height) / 2) - rect.top}px`;
            };
            scope.listen(window, "resize", resize);
            resize();
        }
        return true;
    };
    vendor.success = function(/** @type {any} */ element, /** @type {number} */ id) {
        if (!mount(element, id)) return;
        try { return success?.call(this, element, id); }
        catch (error) { scope?.dispose(); throw error; }
    };
    shellMounts.set(vendor.success, mount);
    vendor.end = function(/** @type {any[]} */ ...args) {
        ended = true;
        scope?.dispose();
        return end?.apply(this, args);
    };
    prepared.add(vendor);
    prepared.add(vendor.success);
    return vendor;
}
