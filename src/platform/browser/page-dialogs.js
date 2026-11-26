// @ts-check
import { enhanceDialogButtons, getDialogArea, getOwningLayerIndex, trapDialogFocus } from "../../core/dialog-shell.js";
import { createDetailUrl } from "../../core/detail-url.js";
import { JHS_Z_INDEX } from "../../core/theme.js";

/** @typedef {import("../../contracts/ports.js").DialogPort} DialogPort */
/** @typedef {import("../../contracts/ports.js").NavigationPort} NavigationPort */
/** @typedef {import("../../core/dialog-shell.js").LayerOwner} LayerOwner */
/** @typedef {Pick<MouseEvent, "ctrlKey" | "metaKey" | "button">} OpenEvent */
/** @typedef {{event?: OpenEvent | null, newTab?: boolean, preview?: boolean, onClose?: () => unknown}} OpenOptions */
/** @typedef {{confirmText?: string, cancelText?: string, tone?: string, skin?: string}} ConfirmOptions */

/** @param {{dialog: DialogPort, navigation: NavigationPort, esc: Pick<import("../../core/dialog-esc-controller.js").DialogEscController, "setupEscClose" | "releaseEscClose">, settings: {snapshot: () => Record<string, unknown>}, isMobileMode: () => boolean, logger: {error?: (...parts: unknown[]) => void}, window?: Window}} options */
export function createPageDialogs({ dialog, navigation, esc, settings, isMobileMode, logger, window: view = window }) {
    return {
        dialogService: dialog,
        /** @param {string | URL} href @param {string} title @param {boolean} [shadeClose] @param {OpenOptions | OpenEvent | null} [options] */
        openPage(href, title, shadeClose = true, options = null) {
            const navigationOptions = options && ("event" in options || "newTab" in options || "preview" in options || "onClose" in options)
                ? /** @type {OpenOptions} */ (options) : { event: /** @type {OpenEvent | null} */ (options) };
            const event = navigationOptions.event;
            const destination = createDetailUrl(href, view.location.origin, title, navigationOptions.preview);
            if (navigationOptions.newTab || event && (event.ctrlKey || event.metaKey || event.button === 1)) {
                navigation.open(destination, { background: true, newTab: true });
                return;
            }
            if (!/\/(actors|star)\//.test(destination.pathname)) destination.searchParams.set("hideNav", "1");
            /** @type {number | undefined} */ let index;
            let ended = false;
            dialog.open({
                type: 2, zIndex: JHS_Z_INDEX.layer, ui: { size: "workspace", body: "media" },
                title, content: destination.href, scrollbar: false, shadeClose, area: getDialogArea("workspace", view), isOutAnim: false, anim: -1,
                success(/** @type {unknown} */ _element, /** @type {number} */ id) { index = id; esc.setupEscClose(id); },
                end() {
                    if (ended) return;
                    ended = true;
                    if (index !== undefined) esc.releaseEscClose(index);
                    if (navigationOptions.onClose) void Promise.resolve().then(navigationOptions.onClose).catch(error => logger.error?.("详情关闭后列表刷新失败", error));
                },
            });
        },

        /** @param {LayerOwner} [options] */
        async closePage(options = {}) {
            const snapshot = settings.snapshot();
            const setting = Object.hasOwn(snapshot, "needClosePage") ? snapshot.needClosePage : "yes";
            if (setting !== "yes" && setting !== true) return false;
            const index = getOwningLayerIndex(options, view);
            if (index !== null) {
                if (view.parent && view.parent !== view) {
                    try {
                        const sandbox = /** @type {{unsafeWindow?: Window}} */ (globalThis).unsafeWindow;
                        const parent = /** @type {Window & {utils?: {closePage: (options: LayerOwner) => Promise<boolean>}, layer?: Pick<DialogPort, "close">}} */ (sandbox?.parent ?? view.parent);
                        if (parent.utils?.closePage) return Boolean(await parent.utils.closePage({ layerIndex: index }));
                        if (parent.layer) { parent.layer.close(index); return true; }
                    } catch { /* The parent may belong to another origin. */ }
                }
                dialog.close(index);
            } else view.close();
            return true;
        },

        /** @param {{clientX: number, clientY: number} | null | undefined} position @param {string} message @param {() => unknown} accept @param {(() => unknown) | null} [cancel] @param {ConfirmOptions} [options] */
        q(position, message, accept, cancel, options = {}) {
            /** @type {number | undefined} */ let index;
            /** @type {(() => void) | undefined} */ let releaseUi;
            let decided = false;
            const onCancel = () => {
                if (decided) return;
                decided = true;
                cancel?.();
            };
            const dialogOptions = {
                title: "提示", shade: 0,
                ui: { focus: "caller" }, skin: options.skin, tone: options.tone,
                cancelText: options.cancelText, confirmText: options.confirmText,
                ...(isMobileMode() ? {} : { offset: [position ? position.clientY - 120 : view.innerHeight / 2 - 120, position ? position.clientX - 130 : view.innerWidth / 2 - 120] }),
                success(/** @type {HTMLElement | {0?: HTMLElement} | null} */ element, /** @type {number} */ id) {
                    index = id;
                    esc.setupEscClose(id);
                    const root = element && "nodeType" in element ? element : element?.[0] ?? view.document.getElementById(`layui-layer${id}`);
                    if (!root) return;
                    root.classList.add("jhs-dialog", "jhs-ui");
                    root.setAttribute("role", "dialog");
                    root.setAttribute("aria-modal", "true");
                    root.setAttribute("aria-label", "提示");
                    const releaseButtons = enhanceDialogButtons(root);
                    const releaseFocus = trapDialogFocus(root, /** @type {HTMLElement | null} */ (root.querySelector(".layui-layer-btn0")));
                    releaseUi = () => { releaseButtons(); releaseFocus(); };
                },
                end() {
                    releaseUi?.();
                    releaseUi = undefined;
                    if (index !== undefined) esc.releaseEscClose(index);
                    onCancel();
                },
            };
            index = dialog.confirm(message, dialogOptions, id => {
                if (decided) return;
                decided = true;
                try { accept(); } finally { dialog.close(id ?? index); }
            }, onCancel);
        },
    };
}
