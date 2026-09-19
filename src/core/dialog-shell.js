// @ts-check
import { LifecycleScope } from "./lifecycle-scope.js";

const prepared = new WeakSet();

/** 消费内部 UI 配置，保留 vendor 回调、返回值和关闭策略。 */
/** @param {Record<string, any>} options @param {{getDialogArea?: (size: string) => string[]}} [utils] */
export function prepareDialogOptions(options = {}, utils = {}) {
    if (prepared.has(options) || prepared.has(options.success)) return options;
    const { ui, ...vendor } = options;
    const body = ["scroll", "table", "media"].includes(ui?.body) ? ui.body : "scroll";
    if (ui?.size && utils.getDialogArea) vendor.area = utils.getDialogArea(ui.size);
    /** @type {LifecycleScope | undefined} */
    let scope;
    const success = vendor.success, end = vendor.end;
    vendor.success = function(/** @type {any} */ element, /** @type {number} */ id) {
        const root = element?.nodeType === 1 ? element : element?.[0] || globalThis.document?.getElementById(`layui-layer${id}`);
        if (root?.classList) {
            root.classList.add("jhs-dialog", "jhs-ui");
            root.dataset.jhsDialogBody = body;
            scope = new LifecycleScope(`dialog-shell-${id}`);
            const close = root.querySelector(".layui-layer-close");
            if (close) {
                close.setAttribute("role", "button");
                close.setAttribute("tabindex", "0");
                close.setAttribute("aria-label", "关闭弹窗");
                scope.listen(close, "keydown", event => {
                    const key = /** @type {KeyboardEvent} */ (event).key;
                    if (key === "Enter" || key === " ") { event.preventDefault(); close.click(); }
                });
            }
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
        try { return success?.call(this, element, id); }
        catch (error) { scope?.dispose(); throw error; }
    };
    vendor.end = function(/** @type {any[]} */ ...args) {
        scope?.dispose();
        return end?.apply(this, args);
    };
    prepared.add(vendor);
    prepared.add(vendor.success);
    return vendor;
}
