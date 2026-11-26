// @ts-check

import { mountEnhancementSettings } from "../../ui/settings/enhancement-settings.js";
import { closeOwnedPopover } from "../../core/owned-popover.js";
import { renderTaskStatus } from "../../core/task-status-view.js";
import { JhsSelect } from "../../core/ui-primitives.js";
import { BUILT_IN_NATIVE_MAGNET_SOURCES, ResourceSettingsService } from "../../services/resource-settings-service.js";
import { BUILT_IN_SCREENSHOT_SOURCES } from "../../services/screenshot-sources.js";
import { loadSettingForm } from "./setting-forms.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { bindShortcutRecorder } from "../../ui/settings/shortcut-recorder.js";
import { FullSettingsSession } from "../../ui/settings/full-settings-session.js";

/** @typedef {import("./settings-controller.js").SettingPlugin} SettingPlugin */
/** @typedef {import("./settings-controller.js").JQueryHandle} JQueryHandle */
/** @typedef {import("./settings-controller.js").SettingsDialog} SettingsDialog */

/** @returns {Promise<void | null>}
 * @param {SettingPlugin} owner
 */
export async function openSettingDialog(owner, e = "appearance-panel", /** @type {(() => void) | undefined} */ t = undefined) {
    await owner.fullSettingsStyleLoader?.();
    if (owner._settingScope?.disposed) return;
    const current = owner._settingsDialog;
    if (current?.closing) { await current.closed; return owner.openSettingDialog(e, t); }
    if (current && !current.scope.disposed) {
        current.panel = e;
        if (current.root?.[0]?.isConnected) {
            owner.activateSettingPanel(current.root, e);
            current.root.find(".side-menu-item.active")[0]?.focus();
            t?.();
        }
        return owner._settingsDialogOpenPromise;
    }
    const defaults = Object.fromEntries(owner.getRuntimeService("settingsRegistry").list().filter((/** @type {import('../../app/settings-registry.js').SettingDescriptor} */ item) => item.defaultValue !== undefined).map((/** @type {import('../../app/settings-registry.js').SettingDescriptor} */ item) => [item.key, item.defaultValue]));
    const session = new FullSettingsSession(owner.getRuntimeService("settings"), { detailShortcuts: {}, disabledPlugins: "[]", customMagnetSources: "[]", magnetTagRules: "[]", magnetFilterRules: "[]", magnetBuiltInSources: "[]", screenshotProviders: "[]", screenshotMode: "auto", privacyTargets: ["title", "code", "actors", "images", "video"], privacyShortcut: null, translationConcurrency: 2, enableMediaLibrary: false, ...defaults }, { magnetBuiltInSources: [...BUILT_IN_NATIVE_MAGNET_SOURCES, ...(owner.getRuntimeService("magnet")?.getBuiltInSources?.() || [])], screenshotProviders: [...BUILT_IN_SCREENSHOT_SOURCES] });
    /** @type {SettingsDialog} */
    const instance = {
        panel: e, root: null, id: null, generation: ++owner._settingsDialogGeneration,
        scope: new LifecycleScope("full-settings"), formReady: false, resourcesReady: false,
        session, resources: new ResourceSettingsService(session),
    };
    instance.closed = new Promise(resolve => { instance.resolveClosed = resolve; });
    instance.scope.addCleanup(() => session.dispose());
    owner._settingsDialog = instance;
    const releaseParent = owner._settingScope?.addCleanup(() => {
        if (instance.scope.disposed) return;
        instance.scope.dispose();
        if (instance.id != null) owner.getRuntimeService("dialog").close(instance.id);
        if (owner._settingsDialog === instance) owner._settingsDialog = null;
    });
    instance.scope.addCleanup(() => releaseParent?.());
    const pending = owner.loadSettingDialog(instance, t);
    owner._settingsDialogOpenPromise = pending;
    try { return await pending; }
    catch (error) { instance.scope.dispose(); if (owner._settingsDialog === instance) owner._settingsDialog = null; throw error; }
    finally { if (owner._settingsDialogOpenPromise === pending) owner._settingsDialogOpenPromise = null; }
}

/** @param {SettingPlugin} owner */
export async function loadSettingDialog(owner, /** @type {SettingsDialog} */ instance, /** @type {(() => void) | undefined} */ t) {
    owner._quickSettingInstance?.close(!1);
    for (const surface of owner._desktopQuickSurfaces.values()) surface.close();
    closeOwnedPopover(owner.document);
    await owner.getRuntimeService("settings").waitForIdle();
    const [templates, panels] = await Promise.all([import("../../ui/settings/setting-templates.js"), import("../../ui/settings/setting-panels.js")]);
    if (instance.scope.disposed || owner._settingsDialog !== instance) return;
    owner._settingPanels = panels;
    owner._settingTemplates = templates;
    const s = templates.buildSettingDialogHtml(instance.panel, owner.cacheItems, owner.getRuntimeService("settingsRegistry"));
    instance.id = owner.getRuntimeService("dialog").open({
        type: 1,
        title: "设置",
        content: s,
        ui: { size: "lg", body: "scroll", focus: "caller" }, area: owner.utils.getDialogArea("lg"),
        scrollbar: !1,
        cancel: () => { void owner.requestSettingsClose(instance); return false; },
        success: async (/** @type {HTMLElement | {0: HTMLElement}} */ e, /** @type {number} */ n) => {
            if (instance.scope.disposed || owner._settingsDialog !== instance) return;
            const generation = instance.generation;
            owner.pendingCarImport = null;
            owner._carImportRevision++;
            const layerRoot = owner.jquery(e);
            instance.root = layerRoot;
            layerRoot.find(".jhs-setting-body").prop("inert", true);
            layerRoot.data("jhsFullSettingsSession", instance.session);
            owner._settingsFocusCleanup?.();
            owner._settingsFocusCleanup = owner.utils.trapFocus(layerRoot[0], layerRoot.find(".side-menu-item.active")[0]);
            instance.scope.addCleanup(owner._settingsFocusCleanup);
            layerRoot.data("jhsSettingsGeneration", generation);
            layerRoot.find(".layui-layer-content").css("position", "relative");
            owner.renderTaskStatuses(layerRoot);
            templates.injectHealthPanel(owner.jquery, layerRoot), templates.injectPluginMgmtPanel(owner.jquery, layerRoot), templates.injectSnapshotPanel(owner.jquery, layerRoot), templates.injectNetworkPanel(owner.jquery, layerRoot), templates.injectResourceSourcesPanel(owner.jquery, layerRoot);
            const binding = owner.hydrateLiveSettings(layerRoot);
            owner._fullSettingBinding = binding;
            if (binding) instance.scope.addCleanup(() => binding.dispose());
            await mountEnhancementSettings({ document: owner.document, root: layerRoot[0], session: instance.session, scope: instance.scope,
                translation: owner.getRuntimeService("translation"), media: owner.getRuntimeService("mediaLibrary") });
            owner.bindClick(layerRoot);
            const connectionChanged = () => { void owner.syncFullConnection(instance); };
            instance.scope.listen(owner.getRuntimeService("settings"), "settings.changed", rawEvent => {
                const event = /** @type {CustomEvent<{names?: string[]}>} */ (rawEvent);
                if (event.detail?.names?.some((/** @type {string} */ key) => ["webDavUrl", "webDavUsername", "webDavProfileRevision"].includes(key))) connectionChanged();
            });
            const sharedProfile = owner.getRuntimeService("webdav")?.sharedProfile;
            if (sharedProfile) instance.scope.listen(sharedProfile, "changed", connectionChanged);
            instance.scope.listen(instance.session, "settings.changed", rawEvent => {
                const event = /** @type {CustomEvent<{external: boolean, names: string[]}>} */ (rawEvent);
                if (!event.detail.external || !instance.formReady || !instance.resourcesReady) return;
                if (event.detail.names.some((/** @type {string} */ name) => ["disabledPlugins", "enableSubtitle115Upload"].includes(name)) && layerRoot.find("#advanced-panel").hasClass("active")) void panels.renderPluginMgmtPanel(owner.getRuntimeService("diagnostics"), instance.session, owner.getFormDependencies());
                if (event.detail.names.some((/** @type {string} */ key) => ["customMagnetSources", "magnetTagRules", "magnetFilterRules", "magnetBuiltInSources", "screenshotMode", "screenshotProviders"].includes(key))) {
                    void owner.loadResourceSettings(layerRoot, generation).catch(error => owner.logger.error("资源设置同步失败", error));
                }
            });
            bindShortcutRecorder({ root: layerRoot[0], settings: instance.session, scope: instance.scope, deferred: true, onManage: () => owner.activateSettingPanel(layerRoot, "plugin-mgmt-panel") });
            layerRoot.find(".side-menu-item.active").attr("aria-current", "page");
            owner.utils.setupEscClose(n, { requestClose: () => owner.requestSettingsClose(instance) }), t && t();
            owner.renderTaskStatuses(layerRoot), owner.taskStatusUnsubscribe?.(), owner.taskStatusUnsubscribe = owner.events.on("task-status-changed", (() => owner.renderTaskStatuses(layerRoot)));
            owner.activateSettingPanel(layerRoot, instance.panel);
            const sections = await Promise.allSettled([ owner.hydrateSettingForm(e, generation), owner.loadResourceSettings(e, generation) ]), resourceResult = sections[1];
            instance.resourcesReady = resourceResult.status === "fulfilled";
            if (instance.scope.disposed || owner._settingsDialog !== instance) return;
            layerRoot.find(".jhs-setting-body").prop("inert", !instance.formReady);
            JhsSelect.refreshAll(e);
            owner.updateSettingsReady(instance);
            if (resourceResult.status === "rejected") {
                owner.logger.error("resource-settings 加载失败", resourceResult.reason), owner.getRuntimeService("diagnostics").recordError({ source: "resource-settings", message: resourceResult.reason?.message || String(resourceResult.reason) }), owner.notifications.error("资源设置加载失败，请重试");
                layerRoot.find("#saveBtn").prop("disabled", true).attr("data-jhs-settings-ready", "false");
                const retry = owner.jquery('<button type="button" class="jhs-btn jhs-btn--secondary">重试加载资源</button>');
                layerRoot.find("#settings-hydration-status").empty().append(retry);
                retry.on("click", async () => {
                    retry.prop("disabled", true);
                    try { await owner.loadResourceSettings(e, generation); if (instance.scope.disposed) return; retry.remove(); instance.resourcesReady = true; owner.updateSettingsReady(instance); }
                    catch { if (!instance.scope.disposed) retry.prop("disabled", false); }
                });
            }
        },
        end: () => {
            instance.root?.data("jhsSettingsDraft")?.dispose();
            if (instance.closeConfirmation != null) owner.getRuntimeService("dialog").close(instance.closeConfirmation);
            if (instance.id != null) owner.utils.releaseEscClose(instance.id);
            instance.scope.dispose();
            instance.resolveClosed?.();
            if (owner._settingsDialog !== instance) return;
            owner._settingsDialog = null;
            owner._settingsDialogGeneration++;
            owner.pendingCarImport = null;
            owner._carImportRevision++;
            owner._cloudLoginScope?.dispose();
            owner._cloudLoginScope = null;
            owner.cancelResourceTests();
            owner._fullSettingBinding = null;
            owner._cloudSettingBinding?.dispose?.();
            owner._cloudSettingBinding = null;
            owner._settingsFocusCleanup = null;
            owner.taskStatusUnsubscribe?.(), owner.taskStatusUnsubscribe = null;
            owner.readCoverButtons?.()?.enableSvgBtn();
        }
    });
}

/** @param {SettingPlugin} owner */
export async function requestSettingsClose(owner, /** @type {SettingsDialog} */ instance) {
    if (instance.scope.disposed || owner._settingsDialog !== instance || instance.closeConfirmation != null) return;
    const root = instance.root, dialog = owner.getRuntimeService("dialog");
    if (root?.find("#saveBtn").data("jhsBusy")) {
        instance.pendingClose = true;
        root.find("#settings-draft-status").text("正在保存，请稍候"); return;
    }
    const draft = root?.data("jhsSettingsDraft")?.refresh();
    if (!draft?.count && !draft?.pending) { instance.closing = true; return dialog.close(instance.id); }
    const previousFocus = /** @type {HTMLElement | null} */ (owner.document.activeElement);
    instance.closeConfirmation = dialog.confirm("放弃尚未保存的修改？", {
        title: "放弃修改？", confirmText: "放弃修改", cancelText: "继续编辑", tone: "danger", ui: { size: "sm", body: "scroll", initialFocus: ".layui-layer-btn0" },
        success: (/** @type {HTMLElement | {0: HTMLElement}} */ element, /** @type {number} */ id) => { owner.utils.setupEscClose(id); owner.jquery(element).find(".layui-layer-btn0").trigger("focus"); },
        end: () => {
            const id = instance.closeConfirmation; instance.closeConfirmation = null;
            if (id != null) owner.utils.releaseEscClose(id);
            if (previousFocus?.isConnected) previousFocus.focus();
        },
    }, (/** @type {number} */ id) => { instance.closing = true; dialog.close(id); dialog.close(instance.id); });
}

/** @param {SettingPlugin} owner */
export async function syncFullConnection(owner, /** @type {SettingsDialog} */ instance) {
    const root = instance.root, draft = root?.data("jhsSettingsDraft");
    if (!draft || instance.scope.disposed || owner._settingsDialog !== instance) return;
    const generation = instance.connectionGeneration = (instance.connectionGeneration || 0) + 1;
    try {
        const profile = await owner.getRuntimeService("webdav").getProfile();
        if (instance.scope.disposed || owner._settingsDialog !== instance || generation !== instance.connectionGeneration) return;
        for (const [key, value] of Object.entries({ webDavUrl: profile.url, webDavUsername: profile.username, webDavPassword: profile.password })) {
            if (draft.submitting.has(key) || draft.value(`#${key}`) !== draft.baseline.fields[key]) continue;
            root.find(`#${key}`).val(value || "");
            draft.baseline.fields[key] = draft.value(`#${key}`);
        }
        draft.refresh();
    } catch {
        if (!instance.scope.disposed && owner._settingsDialog === instance) owner.notifications.error("连接信息更新失败，请重新打开设置");
    }
}

/** @param {SettingPlugin} owner */
export function updateSettingsReady(owner, /** @type {SettingsDialog} */ instance) {
    if (instance.scope.disposed || owner._settingsDialog !== instance) return;
    const ready = instance.formReady && instance.resourcesReady;
    instance.root?.find(".jhs-setting-body").prop("inert", !instance.formReady);
    instance.root?.find("#saveBtn").attr("data-jhs-settings-ready", String(ready)).prop("disabled", !ready);
}

/** @param {JQueryHandle | HTMLElement} layerRoot @param {number} generation
 * @param {SettingPlugin} owner
 */
export async function hydrateSettingForm(owner, layerRoot, generation) {
    const button = owner.jquery(layerRoot).find("#saveBtn"), status = owner.jquery(layerRoot).find("#settings-hydration-status");
    button.attr("data-jhs-settings-ready", "false").prop("disabled", !0).attr("title", "加载中…"), status.empty().text("加载中…");
    const root = owner.jquery(layerRoot);
    root.attr("aria-busy", "true");
    try {
        await loadSettingForm(owner.getFormDependencies(), root);
        if (!button[0]?.isConnected || generation !== owner._settingsDialogGeneration || root.data("jhsSettingsGeneration") !== generation) return !1;
        JhsSelect.refreshAll(layerRoot), button.removeAttr("title data-tip"), status.empty();
        if (owner._settingsDialog?.generation === generation) { owner._settingsDialog.formReady = true; owner.updateSettingsReady(owner._settingsDialog); }
        return !0;
    } catch (error) {
        if (!button[0]?.isConnected || generation !== owner._settingsDialogGeneration || root.data("jhsSettingsGeneration") !== generation) return !1;
        owner.logger.error("settings-form 加载失败", error), owner.getRuntimeService("diagnostics").recordError({ source: "settings-form", message: error instanceof Error ? error.message : String(error) });
        const retry = owner.jquery('<button type="button" class="jhs-btn jhs-btn--secondary">重试加载</button>').on("click", (() => void owner.hydrateSettingForm(layerRoot, generation)));
        status.empty().append(owner.document.createTextNode("设置加载失败，重试后可保存"), retry), owner.notifications.error("设置加载失败，请重试");
        return !1;
    } finally {
        if (generation === root.data("jhsSettingsGeneration") || !root[0]?.isConnected) root.attr("aria-busy", "false");
    }
}

/** @param {SettingPlugin} owner */
export function renderTaskStatuses(owner, layerRoot = owner._settingsDialog?.root) {
    if (!layerRoot) return;
    const container = owner.jquery(layerRoot).find("#setting-task-status-list");
    const taskPlugin = owner.readTask?.();
    if (!taskPlugin?.getTaskStatusSnapshot) return void container.empty();
    const settings = owner.getRuntimeService("settings").snapshot();
    container.empty();
    for (const name of ["blacklist", "favoriteActress", "newVideo"]) container.append(renderTaskStatus(owner.jquery, name, taskPlugin.getTaskStatusSnapshot(name), settings, true));
}

/** Switch categories without rebuilding controls or resetting form drafts. */
/** @param {SettingPlugin} owner */
export function activateSettingPanel(owner, /** @type {any} */ layerRoot, /** @type {string} */ panel) {
    const root = owner.jquery(layerRoot);
    const { _settingTemplates: templates, _settingPanels: panels } = owner;
    if (!templates || !panels) return;
    const target = templates.resolveSettingPanel(panel);
    if (root.data("jhsActiveSettingGroup") === "resources-panel" && target.group !== "resources-panel") owner.cancelResourceTests();
    root.data("jhsActiveSettingGroup", target.group);
    root.find("#jhs-settings-category").val(target.group);
    JhsSelect.refresh(root.find("#jhs-settings-category"));
    root.find(".side-menu-item").removeClass("active").removeAttr("aria-current");
    const activeNav = root.find(`[data-panel="${target.group}"]`).addClass("active").attr("aria-current", "page");
    activeNav[0]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    root.find(".content-panel").removeClass("active").prop("hidden", true);
    const group = root.find(`#${target.group}`).addClass("active").prop("hidden", false);
    if (target.section) group.find(`#${target.section}`)[0]?.scrollIntoView?.({ block: "start" });
    const dependencies = owner.getFormDependencies();
    const actions = target.group === "data-panel" ? [() => panels.renderSnapshotPanel(dependencies)]
        : target.group === "advanced-panel" ? [
            () => panels.renderDataHealthPanel(dependencies),
            () => panels.renderPluginMgmtPanel(owner.getRuntimeService("diagnostics"), owner.fullSettings, dependencies),
            () => panels.renderNetworkPanel(owner.getRuntimeService("diagnostics"), dependencies),
        ] : [];
    void Promise.allSettled(actions.map((action) => Promise.resolve().then(action))).then((results) => {
        for (const result of results) if (result.status === "rejected") owner.logger.error("设置工具加载失败", result.reason);
    });
}

/** @param {SettingPlugin} owner */
export function hasUnsavedConnection(owner, /** @type {any} */ root) {
    const draft = root.data("jhsSettingsDraft"); draft?.refresh();
    return ["webDavUrl", "webDavUsername", "webDavPassword"].some(key => root.data("jhsDirtyManualKeys")?.has(key));
}
