// @ts-check

import { waitForDom } from "../../core/dom-actions.js";
import { DesktopQuickSettings } from "../../ui/settings/desktop-quick-settings.js";
import { closeOwnedPopover, ownedPopoverRoots } from "../../core/owned-popover.js";
import { acquirePageScrollLock } from "../../core/page-scroll-lock.js";
import { getIcon } from "../../core/icons.js";
import { r } from "../../core/constants.js";
import { disposeQuickSettingHost, initQuickSettingForm } from "./setting-forms.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

/** @typedef {import("./settings-controller.js").SettingPlugin} SettingPlugin */

/** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {{current: () => string} & EventTarget} profile
 * @param {SettingPlugin} owner
 */
export function activateFeatureSurface(owner, scope, profile) {
    owner._settingScope = scope;
    scope.addCleanup((() => owner.unmountDesktopSettingNav()));
    scope.listen(profile, "profile.changed", () => owner.syncDesktopSettingNav(profile.current() === "compact"));
    owner.syncDesktopSettingNav(profile.current() === "compact");
}

/** @param {SettingPlugin} owner */
export function disposeQuickSettings(owner) {
    owner._quickSettingInstance?.close(!1);
    for (const surface of owner._desktopQuickSurfaces.values()) surface.close();
}

/** 桌面设置入口 Surface：compact 卸载，regular/wide 幂等挂载。 */
    /** @param {boolean} compact
 * @param {SettingPlugin} owner
 */
export function syncDesktopSettingNav(owner, compact) {
    if (compact) owner.unmountDesktopSettingNav();
    else owner.mountDesktopSettingNav();
}

/** @param {SettingPlugin} owner */
export function mountDesktopSettingNav(owner) {
    if (owner._desktopSettingNavMounted) return;
    const scope = owner._settingScope;
    if (!scope) return;
    owner._desktopSettingNavMounted = true;
    // surface generation：unmount 后旧 timer/DOM 等待回调不得再把 nav append 回来。
    const generation = owner._desktopNavGeneration;
    if (r) {
        const e = () => {
            owner.jquery(".navbar-search").is(":hidden") ? (owner.jquery(".mini-setting-box").hide(), owner.jquery(".setting-box").show()) : (owner.jquery(".mini-setting-box").show(),
            owner.jquery(".setting-box").hide());
        };
        owner.jquery("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box jhs-setting-nav-item">\n                    <button type="button" id="setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-nav-button">\n                        设置\n                    </button>\n                    <div class="simple-setting"></div>\n                </div>'),
        waitForDom((() => owner.jquery("#miniHistoryBtn").length > 0), (() => {
            if (generation !== owner._desktopNavGeneration || !owner._desktopSettingNavMounted) return;
            owner.jquery(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box jhs-mini-setting-box">\n                        <button type="button" id="mini-setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-mini-setting-trigger">\n                            设置\n                        </button>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '),
            e();
            owner.mountDesktopQuickSettings();
        }), 20, 1e4, !0, scope);
        owner._settingNavResizeCleanup?.();
        owner._settingNavResizeCleanup = scope.listen(owner.window, "resize", e);
    }
    if (owner.site === "javbus" && owner.route === "detail") {
        const anchor = owner.jquery('<div class="container-fluid jhs-setting-detail-anchor"><div id="top-right-box" class="jhs-setting-anchor"><div class="setting-box"><button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark"><span>设置</span></button><div class="simple-setting"></div></div></div></div>');
        const target = owner.jquery("h3").first();
        if (target.length) target.before(anchor);
        else owner.jquery(owner.getRuntimeService("host")?.locateDetailRoot?.()).first().before(anchor);
    } else if (owner.site === "javbus" && owner.route === "list") {
        const anchor = owner.jquery('<div id="top-right-box" class="jhs-setting-anchor"><div class="setting-box"><button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark"><span>设置</span></button><div class="simple-setting"></div></div></div>');
        const primary = owner.jquery("#jhs-page-commandbar .jhs-commandbar__primary").first();
        const commandbar = owner.jquery("#jhs-page-commandbar .jhs-commandbar__left").first();
        const listRoot = owner.jquery(owner.getRuntimeService("host")?.locateListRoot?.()).first();
        if (primary.length) primary.append(anchor);
        else if (commandbar.length) owner.jquery('<div class="jhs-commandbar__primary"></div>').append(anchor).appendTo(commandbar);
        else if (listRoot.length) listRoot.before(anchor);
    }
    owner.mountDesktopQuickSettings();
}

/** Bind each hover host once and retain its shared settings binding until unmount. */
/** @param {SettingPlugin} owner */
export function mountDesktopQuickSettings(owner) {
    for (const box of owner.jquery(".setting-box, .mini-setting-box").toArray()) {
        if (owner._desktopQuickSurfaces.has(box)) continue;
        const host = owner.jquery(box).find(".simple-setting, .mini-simple-setting")[0];
        if (!host || !owner._settingScope) continue;
        const surface = new DesktopQuickSettings({box, host, jquery:owner.jquery, scope:owner._settingScope,
            canOpen: () => !owner._settingsDialog,
            onOpen: () => { for (const other of owner._desktopQuickSurfaces.values()) if (other.box !== box) other.close(); },
            initialize: async () => {
                const { buildQuickSettingHtml } = await import("../../ui/settings/setting-templates.js");
                if (surface.scope.disposed || !box.isConnected) return;
                disposeQuickSettingHost(host, owner.jquery);
                owner.jquery(host).html(buildQuickSettingHtml(owner.getRuntimeService("settingsRegistry")));
                await initQuickSettingForm(owner.getFormDependencies(), owner.getSelector.bind(owner), async panel => {
                    surface.close(); await owner.openSettingDialog(panel);
                }, owner.jquery(host));
                if (surface.scope.disposed) disposeQuickSettingHost(host, owner.jquery);
                owner.logger.lowZIndex();
            },
            onError: error => owner.logger.warn("桌面快捷设置初始化失败", error),
        });
        owner._desktopQuickSurfaces.set(box, surface);
    }
}

/** @param {SettingPlugin} owner */
export function unmountDesktopSettingNav(owner) {
    for (const surface of owner._desktopQuickSurfaces.values()) surface.dispose();
    owner._desktopQuickSurfaces.clear();
    owner._desktopNavGeneration++;
    owner._desktopSettingNavMounted = false;
    owner._settingNavResizeCleanup?.();
    owner._settingNavResizeCleanup = null;
    owner.jquery(".simple-setting, .mini-simple-setting").each((/** @type {number} */ _, /** @type {HTMLElement} */ element) => disposeQuickSettingHost(element, owner.jquery));
    owner.jquery(".jhs-setting-nav-item, .jhs-mini-setting-box, .jhs-setting-anchor, .jhs-setting-detail-anchor").remove();
    owner.jquery(".main-nav, .container-fluid").off("mouseenter.jhsSettingQuick mouseleave.jhsSettingQuick");
}

/** Open shared quick settings in the mobile bottom sheet. */
/** @param {SettingPlugin} owner */
export async function openQuickSetting(owner) {
    if (owner._settingScope?.disposed) return;
    const previousFocus = owner._quickSettingInstance?.previousFocus ?? /** @type {HTMLElement | null} */ (owner.document.activeElement);
    owner._quickSettingInstance?.close(!1);
    closeOwnedPopover(owner.document);
    const scope = new LifecycleScope("mobile-quick-settings");
    /** @type {any} */ let sheet = null;
    /** @type {any} */ let backdrop = null;
    /** @type {any} */ let quickRoot = null;
    /** @type {(() => void) | undefined} */ let releaseOwner;
    let closed = !1;
    const closeQuickSetting = (restoreFocus = !0) => {
        if (closed) return;
        closed = !0;
        scope.dispose();
        releaseOwner?.();
        if (sheet && ownedPopoverRoots(sheet[0]).length) closeOwnedPopover(owner.document);
        if (quickRoot) disposeQuickSettingHost(quickRoot, owner.jquery);
        sheet?.remove();
        backdrop?.remove();
        if (owner._quickSettingInstance === instance) owner._quickSettingInstance = null;
        restoreFocus && previousFocus?.isConnected && "function" == typeof previousFocus.focus && previousFocus.focus();
    };
    const instance = { close: closeQuickSetting, previousFocus, scope };
    owner._quickSettingInstance = instance;
    releaseOwner = owner._settingScope?.addCleanup?.(() => closeQuickSetting(!1));
    scope.listen(owner.document, "keydown", (rawEvent => {
        const event = /** @type {KeyboardEvent} */ (rawEvent);
        if (event.defaultPrevented) return;
        const portals = sheet ? ownedPopoverRoots(sheet[0]) : [];
        if ("Escape" === event.key) {
            if (portals.length) return;
            event.preventDefault();
            closeQuickSetting();
            return;
        }
        if ("Tab" !== event.key || !sheet?.[0]?.isConnected) return;
        const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
        const focusable = [ ...sheet[0].querySelectorAll(selector), ...portals.flatMap(root => [ ...root.querySelectorAll(selector) ]) ].filter(element => !element.closest('[hidden],[aria-hidden="true"]'));
        if (!focusable.length) return void event.preventDefault();
        const first = focusable[0], last = focusable[focusable.length - 1];
        const inside = sheet[0].contains(owner.document.activeElement) || portals.some(root => root.contains(owner.document.activeElement));
        event.shiftKey && (owner.document.activeElement === first || !inside) ? (event.preventDefault(), last.focus()) : !event.shiftKey && (owner.document.activeElement === last || !inside) && (event.preventDefault(), first.focus());
    }), !0);
    try {
        await owner.getRuntimeService("settings").waitForIdle();
        if (closed) return;
        const { buildQuickSettingHtml } = await import("../../ui/settings/setting-templates.js");
        if (closed) return;
        backdrop = owner.jquery('<div id="jhs-quick-setting-backdrop" class="jhs-quick-setting-backdrop"></div>');
        sheet = owner.jquery(`<section id="jhs-quick-setting-sheet" class="jhs-quick-setting-sheet jhs-ui" role="dialog" aria-modal="true" aria-labelledby="jhs-quick-setting-title">
            <header class="jhs-quick-setting__header"><h2 id="jhs-quick-setting-title">快捷设置</h2><button type="button" class="jhs-btn jhs-btn--ghost jhs-quick-setting__close" aria-label="关闭快捷设置">${getIcon("x")}</button></header>
            <div class="jhs-quick-setting"></div>
        </section>`);
        quickRoot = sheet.find(".jhs-quick-setting");
        quickRoot.html(buildQuickSettingHtml(owner.getRuntimeService("settingsRegistry")));
        owner.jquery(owner.document.body).append(backdrop, sheet);
        scope.addCleanup(acquirePageScrollLock(sheet[0]));
        scope.listen(backdrop[0], "click", () => closeQuickSetting());
        scope.listen(sheet.find(".jhs-quick-setting__close")[0], "click", () => closeQuickSetting());
        owner.logger.lowZIndex();
        await initQuickSettingForm(owner.getFormDependencies(), owner.getSelector.bind(owner), (panel => {
            if (closed) return;
            closeQuickSetting(!1), void owner.openSettingDialog(panel).catch(((/** @type {unknown} */ error) => owner.logger.error("完整设置打开失败", error)));
        }), quickRoot);
        if (closed) return void disposeQuickSettingHost(quickRoot, owner.jquery);
        sheet.find(".jhs-quick-setting__close").trigger("focus");
    } catch (error) {
        if (closed) return;
        closeQuickSetting(), owner.logger.error("快捷设置初始化失败", error), owner.notifications.error("快捷设置加载失败");
    }
}
