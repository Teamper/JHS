// @ts-check
import { normalizeSharedWebDavProfile } from "../../services/webdav-shared-profile.js";
import { MANUAL_SETTINGS } from "../../contracts/manual-settings.js";

import { getIcon } from "../../core/icons.js";
import { C, _, r, escapeHtml } from "../../core/constants.js";
import { parseNumberSetting } from "../../core/feature-helpers.js";
import { applyImageMode } from "../../services/layout-settings-service.js";
import { normalizeQuickFilterKey } from "../../core/list-filters.js";
import { bindSettingRows } from "../../ui/settings/setting-control-renderer.js";
import { SYNC_DEFAULTS, syncRetention } from "../../core/webdav-sync-model.js";
import { SettingsDraft } from "../../ui/settings/settings-draft.js";

/** @typedef {Record<string, any>} SettingDependencies */

export const MANUAL_FORM_SETTING_KEYS = Object.freeze(MANUAL_SETTINGS.map(descriptor => descriptor.key));
export const MANUAL_FORM_SELECTORS = Object.freeze(Object.fromEntries(MANUAL_SETTINGS.map(descriptor => [descriptor.key, descriptor.formSelector])));

/** @param {any} root */
function bindManualDirtyTracking(root) {
    root.data("jhsSettingsDraft")?.dispose();
    root.data("jhsDirtyManualKeys", new Set());
    root.data("jhsSettingsDraft", new SettingsDraft(root, MANUAL_FORM_SELECTORS));
}

/** @param {any} layerRoot */
/** @param {SettingDependencies} dependencies @param {any} layerRoot */
function formRoot(dependencies, layerRoot) {
    if (typeof dependencies.jquery !== "function") throw new Error("Settings form UI dependency is unavailable");
    return layerRoot ? dependencies.jquery(layerRoot) : dependencies.jquery(dependencies.document);
}

/** Keep a broken credential recoverable without blocking unrelated settings. @param {any} root @param {SettingDependencies} dependencies @param {any} error */
function showWebDavCredentialError(root, dependencies, error) {
    root.data("jhsWebDavCredentialError", error);
    root.find("#jhs-webdav-credential-error").remove();
    root.find("#webDavPassword").attr({ "aria-invalid": "true", "aria-describedby": "jhs-webdav-credential-error" }).closest(".jhs-setting-row")
        .after(dependencies.jquery('<p id="jhs-webdav-credential-error" class="jhs-field-error" role="alert"></p>').text(error.message));
}

/** Load all settings from storage into the main settings dialog form fields. */
/** @param {SettingDependencies} dependencies @param {any} [layerRoot] */
export async function loadSettingForm(dependencies, layerRoot = null) {
    if (dependencies.isActive?.() === false) return;
    const root = formRoot(dependencies, layerRoot);
    const e = dependencies.settings.snapshot();
    for (const definition of MANUAL_SETTINGS) {
        const descriptor = dependencies.settingsRegistry?.get?.(definition.key) || definition;
        if (descriptor.sensitive) continue;
        const field = root.find(descriptor.formSelector);
        const value = e[descriptor.key] ?? descriptor.defaultValue;
        if (descriptor.type === "boolean") field.prop("checked", (descriptor.normalize?.(value) ?? value) === "yes");
        else if (descriptor.siteId) field.val(descriptor.key === "av123Url" ? dependencies.movie.providerOrigin("av123") || value : dependencies.movie.externalSiteOrigin(descriptor.siteId, e) || value);
        else field.val(descriptor.type === "number" ? Number(descriptor.normalize?.(value) ?? value) / descriptor.formScale : value);
    }
    root.find("#highlightedTagLabel").css("border", root.find("#highlightedTagNumber").val() + "px solid " + root.find("#highlightedTagColor").val());
    const webdav = dependencies.webdav;
    let profile = { url: e.webDavUrl, username: e.webDavUsername, password: "" };
    try {
        if (webdav?.getProfile) profile = await webdav.getProfile();
        root.removeData("jhsWebDavCredentialError");
        root.find("#jhs-webdav-credential-error").remove();
        root.find("#webDavPassword").removeAttr("aria-invalid aria-describedby");
    } catch (error) {
        if (/** @type {any} */ (error)?.code !== "WEBDAV_CREDENTIAL_UNREADABLE") throw error;
        showWebDavCredentialError(root, dependencies, error);
    }
    if (dependencies.isActive?.() === false) return;
    root.find("#webDavUrl").val(profile.url || "");
    root.find("#webDavUsername").val(profile.username || "");
    root.find("#webDavPassword").val(profile.password || "");
    root.trigger("jhsAutoBackupFormLoaded");
    let g = await dependencies.keywordRules.getReviewKeywords(), p = await dependencies.keywordRules.getTitleKeywords();
    if (dependencies.isActive?.() === false) return;
    // “重试加载”会重跑本函数：先清空标签容器并解绑旧事件，否则关键词显示两份、添加事件翻倍
    [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((/** @type {string} */ container) => {
        root.find(`${container} .tag-box`).empty();
        root.find(`${container} .add-tag-btn`).off(".jhsKeywordBind"), root.find(`${container} .keyword-input`).off(".jhsKeywordBind");
    });
    g && g.forEach((/** @type {string} */ item) => {
        addLabelTag(dependencies, "#reviewKeywordContainer", item, root);
    });
    p && p.forEach((/** @type {string} */ item) => {
        addLabelTag(dependencies, "#filterKeywordContainer", item, root);
    });
    [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((/** @type {string} */ container) => {
        root.find(`${container} .add-tag-btn`).on("click.jhsKeywordBind", ((/** @type {any} */ event) => addKeyword(dependencies, event, container, root)));
        root.find(`${container} .keyword-input`).on("keypress.jhsKeywordBind", ((/** @type {any} */ event) => {
            "Enter" === event.key && addKeyword(dependencies, event, container, root);
        }));
    });
    bindManualDirtyTracking(root);
    bindKeywordDirtyTracking(root);
    bindLayoutRangeEvents(root, null, dependencies.utilities);
}

/** Bind the shared layout range controls without accumulating handlers. */
/**
 * Updates the local range label. Full settings passes no host adapter, so
 * dragging does not apply layout before the explicit save.
 *
 * @param {any} root @param {any} hostAdapter @param {{ isMobileMode?: () => boolean }} utilities
 */
function bindLayoutRangeEvents(root, hostAdapter, utilities) {
    root.find("#containerColumns").off(".jhsSetting").on("input.jhsSetting", (() => {
        applyLayoutRangeValue(root, hostAdapter, "containerColumns", root.find("#containerColumns").val(), utilities?.isMobileMode?.() ?? false);
    }));
    root.find("#containerWidth").off(".jhsSetting").on("input.jhsSetting", ((/** @type {any} */ event) => {
        applyLayoutRangeValue(root, hostAdapter, "containerWidth", parseInt(root.find("#containerWidth").val()) + 70, utilities?.isMobileMode?.() ?? false);
    }));
}

/** Applies a persisted layout value to the control while preserving the mobile host layout. @param {any} root @param {any} hostAdapter @param {"containerColumns" | "containerWidth"} key @param {unknown} value @param {boolean} [mobile] */
export function applyLayoutRangeValue(root, hostAdapter, key, value, mobile = false) {
    if (key === "containerColumns") {
        const columns = Math.min(8, Math.max(2, Math.round(Number(value) || 5)));
        root.find("#containerColumns").val(String(columns));
        root.find("#showContainerColumns").text(String(columns));
        const listRoot = hostAdapter?.locateListRoot?.();
        if (listRoot) listRoot.style.gridTemplateColumns = `repeat(${mobile ? 1 : columns}, minmax(0, 1fr))`;
        return;
    }
    const width = Math.min(100, Math.max(70, Math.round(Number(value) || 100)));
    const widthText = `${width}%`;
    root.find("#containerWidth").val(String(width - 70));
    root.find("#showContainerWidth").text(widthText);
    const layoutContainer = hostAdapter?.getListLayoutContainer?.();
    if (layoutContainer) layoutContainer.style.minWidth = mobile ? "100%" : widthText;
}

/** Dispose one quick-setting host's binding and clear its DOM. */
/** @param {any} host */
/** @param {any} host @param {(value: any) => any} jquery */
export function disposeQuickSettingHost(host, jquery) {
    if (typeof jquery !== "function") throw new Error("Settings form UI dependency is unavailable");
    const root = jquery(host);
    root.data("jhsQuickSettingBinding")?.dispose?.();
    root.removeData("jhsQuickSettingBinding");
    root.empty().hide();
}

/** Initialize quick settings in either the desktop popover or mobile layer. */
/** @param {SettingDependencies} dependencies @param {() => any} getSelector @param {(panel: string) => void} openSettingDialogFn @param {any} root */
export async function initQuickSettingForm(dependencies, getSelector, openSettingDialogFn, root) {
    const host = dependencies.jquery(root);
    if (!host.length) {
        throw new Error("Quick setting root is required");
    }
    const registry = dependencies.settingsRegistry;
    if (!registry) return;
    const descriptors = registry.list({ surfaces: [ "quick" ] });
    const binding = bindSettingRows(host, descriptors, { settings: dependencies.settings, onWriteError: () => dependencies.notifications.error("设置保存失败，已恢复原设置") });
    host.data("jhsQuickSettingBinding", binding);
    host.find("#moreBtn")
        .off(".jhsQuickSetting")
        .on("click.jhsQuickSetting", (async (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentBinding = host.data("jhsQuickSettingBinding");
            await currentBinding?.flush?.();
            host.hide();
            await openSettingDialogFn("appearance-panel");
        }));
}

/** Read all form values and save to storage. */
/** @param {SettingDependencies} dependencies @param {any} [layerRoot] */
export async function saveSettingForm(dependencies, layerRoot = null) {
    const root = formRoot(dependencies, layerRoot);
    const draft = root.data("jhsSettingsDraft");
    draft?.refresh();
    const submitted = draft?.beginSubmission();
    const jsonField = root.find("#advanced-resource-json");
    const submittedJson = jsonField.length && !jsonField.prop("readonly") ? String(jsonField.val() || "") : null;
    const tracked = root.data("jhsDirtyManualKeys");
    const dirtyKeys = tracked instanceof Set ? new Set(tracked) : null;
    const dirtyReviewKeywords = root.data("jhsDirtyReviewKeywords") === true;
    const dirtyTitleKeywords = root.data("jhsDirtyTitleKeywords") === true;
    const session = root.data("jhsFullSettingsSession");
    const sessionSubmitted = session?.capture() || {};
    try {
        const editorSubmission = session?.captureEditors?.() || [];
        if (dirtyKeys instanceof Set && dependencies.webdav?.getProfile && ["webDavUrl", "webDavUsername", "webDavPassword"].some(key => dirtyKeys.has(key))) {
            const currentProfile = {
                webDavUrl: String(submitted?.fields.webDavUrl ?? root.find("#webDavUrl").val() ?? "").trim(),
                webDavUsername: String(submitted?.fields.webDavUsername ?? root.find("#webDavUsername").val() ?? ""),
                webDavPassword: String(submitted?.fields.webDavPassword ?? root.find("#webDavPassword").val() ?? ""),
            };
            try { await dependencies.webdav.getProfile(); }
            catch (error) {
                if (/** @type {any} */ (error)?.code !== "WEBDAV_CREDENTIAL_UNREADABLE") throw error;
                showWebDavCredentialError(root, dependencies, error);
                // An untouched empty field is not consent to erase a damaged record.
                if (currentProfile.webDavPassword) dirtyKeys.add("webDavPassword");
            }
            // Only locally edited profile fields may be submitted; other entries can change externally.
        }
        const patch = { ...sessionSubmitted, ...collectManualSettingPatch(root, dependencies.settingsRegistry, dirtyKeys, submitted?.fields) };
        if (dependencies.isActive?.() === false) return { canceled: true };
        if (Object.keys(SYNC_DEFAULTS).some(key => Object.hasOwn(patch, key))) {
            try { syncRetention({ ...dependencies.settings.snapshot(), ...patch }); }
            catch (error) {
                root.find("#jhs-auto-backup-status").text(/** @type {Error} */ (error).message);
                for (const key of Object.keys(SYNC_DEFAULTS)) {
                    const input = root.find(`#${key}`);
                    if (input.length && !input[0].checkValidity()) { input.attr({ "aria-invalid": "true", "aria-describedby": "jhs-auto-backup-status" }).trigger("focus"); break; }
                }
                throw error;
            }
            root.find("#webDavSyncKeepCount,#webDavSyncHistoryDays").removeAttr("aria-invalid aria-describedby");
        }
        for (const [key, value] of Object.entries(patch)) dependencies.settingsRegistry?.validateSync?.(key, value);
        /** @type {string | null} */
        let nextWebDavUrl = null;
        /** @type {string | null} */
        let nextWebDavOrigin = null;
        // WebDAV validation/authorization only applies when the user actually changed
        // the WebDAV URL; unrelated saves must not be blocked by a historical URL.
        if (!dirtyKeys || dirtyKeys.has("webDavUrl")) {
            nextWebDavUrl = String(submitted?.fields.webDavUrl ?? root.find("#webDavUrl").val() ?? "").trim();
            if (nextWebDavUrl) {
                nextWebDavUrl = normalizeSharedWebDavProfile({ url: nextWebDavUrl }).url;
                nextWebDavOrigin = new URL(nextWebDavUrl).origin;
            }
            const currentTrusted = new Set(Array.isArray(dependencies.settings.snapshot().trustedLocalOrigins) ? dependencies.settings.snapshot().trustedLocalOrigins : []);
            if (nextWebDavOrigin && !currentTrusted.has(nextWebDavOrigin)) {
                const originToAuthorize = nextWebDavOrigin;
                const authorized = await new Promise((resolve) => dependencies.utilities.q(null, `授权此 WebDAV 地址？仅允许访问 ${escapeHtml(originToAuthorize)}`, () => resolve(true), () => resolve(false), { confirmText: "授权", cancelText: "取消" }));
                if (!authorized) return { canceled: true };
            }
        }

        if (dependencies.isActive?.() === false) return { canceled: true };
        const applySettingPatch = (/** @type {Record<string, any>} */ draft) => {
            Object.assign(draft, patch);
            if (nextWebDavOrigin) {
                const origins = new Set(Array.isArray(draft.trustedLocalOrigins) ? draft.trustedLocalOrigins : []);
                origins.add(nextWebDavOrigin);
                draft.trustedLocalOrigins = [ ...origins ];
            }
        };
        const connectionErrors = await session?.saveEditors?.(editorSubmission) || [];
        /** @type {Record<string, string[]>} */
        const groupPreferences = { translation: ["translationPrompt", "translationConcurrency"], media: ["enableMediaLibrary"] };
        for (const { id } of connectionErrors) for (const key of groupPreferences[id] || []) {
            delete patch[key];
            delete sessionSubmitted[key];
        }
        const webdavDirty = !dirtyKeys || ["webDavUrl", "webDavUsername", "webDavPassword"].some((key) => dirtyKeys.has(key));
        const repairingCredential = root.data("jhsWebDavCredentialError") && dirtyKeys?.has("webDavPassword");
        if (webdavDirty && dependencies.webdav?.saveProfile) {
            await dependencies.webdav.saveProfile({
                ...(!dirtyKeys || dirtyKeys.has("webDavUrl") || repairingCredential ? { url: String(submitted?.fields.webDavUrl ?? root.find("#webDavUrl").val() ?? "").trim() } : {}),
                ...(!dirtyKeys || dirtyKeys.has("webDavUsername") || repairingCredential ? { username: String(submitted?.fields.webDavUsername ?? root.find("#webDavUsername").val() ?? "") } : {}),
                ...(!dirtyKeys || dirtyKeys.has("webDavPassword") ? { password: String(submitted?.fields.webDavPassword ?? root.find("#webDavPassword").val() ?? "") } : {}),
            }, applySettingPatch);
            root.removeData("jhsWebDavCredentialError");
            root.find("#jhs-webdav-credential-error").remove();
            root.find("#webDavPassword").removeAttr("aria-invalid aria-describedby");
        } else if (Object.keys(patch).length) await dependencies.settings.update(applySettingPatch);
        session?.commit(sessionSubmitted);
        if (submittedJson !== null) draft?.commitPending("#advanced-resource-json", submittedJson);
        if (draft) draft.commitFields(submitted, [...Object.keys(patch), ...(webdavDirty && dependencies.webdav?.saveProfile ? ["webDavUrl", "webDavUsername", "webDavPassword"] : [])]);
        else root.data("jhsDirtyManualKeys", new Set());

        const keywordErrors = connectionErrors.map((/** @type {any} */ { error }) => error);
        if (dirtyReviewKeywords) {
            try {
                // replaceAll 清掉删除按钮的 ×；去重避免重复标签落库
                const reviewKeywords = [ ...new Set(root.find("#reviewKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
                    const text = dependencies.jquery(element).text().replaceAll("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
                    return text;
                }).filter(Boolean)) ];
                await dependencies.keywordRules.saveReviewKeywords(submitted?.review ?? reviewKeywords);
                if (draft) draft.commitKeywords(submitted, "review"); else root.data("jhsDirtyReviewKeywords", false);
            } catch (error) {
                keywordErrors.push(error);
            }
        }
        if (dirtyTitleKeywords) {
            try {
                const titleKeywords = [ ...new Set(root.find("#filterKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
                    const text = dependencies.jquery(element).text().replaceAll("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
                    return text;
                }).filter(Boolean)) ];
                await dependencies.keywordRules.saveTitleKeywords(submitted?.title ?? titleKeywords);
                if (draft) draft.commitKeywords(submitted, "title"); else root.data("jhsDirtyTitleKeywords", false);
            } catch (error) {
                keywordErrors.push(error);
            }
        }
        if (keywordErrors.length) {
            const error = /** @type {any} */ (new Error("部分设置保存失败，请重试"));
            error.partialFailure = true;
            error.cause = keywordErrors[0];
            throw error;
        }
        draft?.refresh();
        // Best-effort UI post-processing; one failed refresh must not skip the rest.
        /** @type {Array<[string, () => unknown | Promise<unknown>]>} */
        const postSaveEffects = [
            ["filter rules", async () => {
                if (!dependencies.events) throw new Error("EventBus 尚未初始化");
                await dependencies.events.emit("filter-rules-changed", { scope: "title-keyword" });
            }],
            ["new-video status", () => dependencies.newVideo?.resetBtnTip?.()],
            ["blacklist status", () => dependencies.blacklist?.resetBtnTip?.()],
            ["blacklist table", () => dependencies.blacklist?.reloadTable?.()],
        ];
        for (const [name, effect] of postSaveEffects) {
            try { await effect(); }
            catch (error) {
                dependencies.logger?.error?.(`设置保存后 ${name} 刷新失败（已忽略）`, error);
            }
        }
        const requiresNavigation = Object.keys(patch).some(key => dependencies.settingsRegistry?.get(key)?.effect === "nextNavigation");
        return requiresNavigation ? { ok: true, requiresNavigation: true } : { ok: true };
    } finally { session?.release(); draft?.release(); }
}

/** @param {any} root */
function bindKeywordDirtyTracking(root) {
    // Dirty is only set after a keyword is actually added or actually removed.
    // Event-level marking caused false positives on empty Add and cancelled Delete.
    root.data("jhsDirtyReviewKeywords", false);
    root.data("jhsDirtyTitleKeywords", false);
}

/** @param {any} root @param {any} registry @param {Set<string>|null} dirtyKeys @param {Record<string, any>|null} [submitted] */
function collectManualSettingPatch(root, registry, dirtyKeys, submitted) {
    const patch = /** @type {Record<string, unknown>} */ ({});
    for (const definition of MANUAL_SETTINGS) {
        const { key } = definition;
        const descriptor = registry?.get?.(key) || definition;
        if (descriptor.sensitive || dirtyKeys && !dirtyKeys.has(key)) continue;
        const field = root.find(descriptor.formSelector);
        if (!field.length) continue;
        const raw = submitted && Object.hasOwn(submitted, key) ? submitted[key]
            : descriptor.type === "boolean" ? field.is(":checked") : field.val();
        const retention = Object.hasOwn(SYNC_DEFAULTS, key);
        const value = descriptor.type === "number" ? (String(raw ?? "").trim() ? Number(raw) * descriptor.formScale : NaN) : raw;
        const normalize = descriptor.readFormValue ?? descriptor.normalize;
        patch[key] = retention ? value : normalize?.(value) ?? value;
    }
    return patch;
}

/** Create a removable keyword label tag in the filter panel. */
/** @param {string} container @param {string} text @param {any} root */
/** @param {SettingDependencies} dependencies @param {string} container @param {string} text @param {any} root */
function addLabelTag(dependencies, container, text, root) {
    const target = root.find(`${container} .tag-box`);
    const value = String(text);
    const node = dependencies.jquery("<span>").addClass("keyword-label").attr("data-keyword", value);
    if (/^[a-z]{2,}-/i.test(value) && r) {
        node.append(dependencies.jquery("<a>").addClass("keyword-label--link")
            .attr("href", `/video_codes/${value.replace("-", "")}`).attr("target", "_blank").attr("rel", "noopener noreferrer").text(value));
    } else node.append(dependencies.document.createTextNode(value));
    node.append(dependencies.jquery('<button type="button" class="keyword-remove jhs-btn jhs-btn--ghost"></button>').attr("aria-label", `移除屏蔽词“${value}”`).append(getIcon("x")));
    const dirtyKey = container === "#reviewKeywordContainer" ? "jhsDirtyReviewKeywords" : "jhsDirtyTitleKeywords";
    node.find(".keyword-remove").click(((/** @type {any} */ event) => {
        event.stopPropagation(), event.preventDefault();
        const current = dependencies.jquery(event.currentTarget);
        const keyword = current.closest(".keyword-label").attr("data-keyword").split(" ")[0];
        dependencies.utilities.q(event, `移除屏蔽词“${escapeHtml(keyword)}”？`, (async () => {
            current.closest(".keyword-label").remove();
            root.data(dirtyKey, true);
            root.data("jhsSettingsDraft")?.refresh();
        }), null, { confirmText: "移除", cancelText: "取消", tone: "danger" });
    }));
    target.append(node);
}

/** Add a keyword from the input field to the tag box. */
/** @param {any} event @param {string} container @param {any} root */
/** @param {SettingDependencies} dependencies @param {any} event @param {string} container @param {any} root */
function addKeyword(dependencies, event, container, root) {
    const input = root.find(`${container} .keyword-input`);
    const value = input.val().trim();
    if (!value) return;
    // 与存储层去重语义一致：重复关键词直接忽略，不再各走各的
    const exists = root.find(`${container} .keyword-label`).toArray().some(((/** @type {Element} */ element) => dependencies.jquery(element).text().replaceAll("×", "").trim() === value));
    if (!exists) addLabelTag(dependencies, container, value, root);
    input.val("");
    root.data(container === "#reviewKeywordContainer" ? "jhsDirtyReviewKeywords" : "jhsDirtyTitleKeywords", true);
    root.data("jhsSettingsDraft")?.refresh();
}
