// @ts-check

import { getIcon } from "../../core/icons.js";
import { C, _, r, escapeHtml } from "../../core/constants.js";
import { parseNumberSetting } from "../../core/feature-helpers.js";
import { applyImageMode } from "./setting-styles.js";
import { normalizeQuickFilterKey } from "../../features/list/list-filters.js";
import { bindSettingRows } from "../../ui/settings/setting-control-renderer.js";
import { SYNC_DEFAULTS, syncRetention } from "../../core/webdav-sync-model.js";
import { SettingsDraft } from "../../ui/settings/settings-draft.js";

/** @typedef {Record<string, any>} SettingDependencies */

/**
 * Explicit ownership whitelist for the bottom "保存设置" button.
 *
 * These are the only keys the full settings form is allowed to write on a
 * manual save. Descriptor controls are captured separately from the instance session.
 */
export const MANUAL_FORM_SETTING_KEYS = Object.freeze([
    ...Object.keys(SYNC_DEFAULTS),
    "videoQuality",
    "reviewCount",
    "tagPosition",
    "waitCheckCount",
    "highlightedTagNumber",
    "highlightedTagColor",
    "checkConcurrencyCount",
    "checkRequestSleep",
    "enableCheckBlacklist",
    "checkBlacklist_intervalTime",
    "checkBlacklist_ruleTime",
    "enableCheckFavoriteActress",
    "checkFavoriteActress_IntervalTime",
    "enableCheckNewVideo",
    "checkNewVideo_intervalTime",
    "checkNewVideo_ruleTime",
    "httpTimeout",
    "httpRetryCount",
    "circuitBreakerThreshold",
    "circuitBreakerCooldown",
    "clogMsgCount",
    "webDavUrl",
    "webDavUsername",
    "webDavPassword",
    "missAvUrl",
    "jableUrl",
    "avgleUrl",
    "javTrailersUrl",
    "av123Url",
    "javDbUrl",
    "javBusUrl",
    "supJavUrl",
    "enableTitleSelectFilter",
    "enableFavoriteActresses",
    "enableSaveActressCarInfo",
    "autoRemoveNewVideoMarkAfterBrowse",
]);


/** Selector map used to track dirty manual fields on the full settings form. */
export const MANUAL_FORM_SELECTORS = Object.freeze({
    ...Object.fromEntries(Object.keys(SYNC_DEFAULTS).map(key => [key, `#${key}`])),
    videoQuality: "#videoQuality",
    reviewCount: "#reviewCount",
    tagPosition: "#tagPosition",
    waitCheckCount: "#waitCheckCount",
    highlightedTagNumber: "#highlightedTagNumber",
    highlightedTagColor: "#highlightedTagColor",
    checkConcurrencyCount: "#checkConcurrencyCount",
    checkRequestSleep: "#checkRequestSleep",
    enableCheckBlacklist: "#enableCheckBlacklist",
    checkBlacklist_intervalTime: "#checkBlacklist_intervalTime",
    checkBlacklist_ruleTime: "#checkBlacklist_ruleTime",
    enableCheckFavoriteActress: "#enableCheckFavoriteActress",
    checkFavoriteActress_IntervalTime: "#checkFavoriteActress_IntervalTime",
    enableCheckNewVideo: "#enableCheckNewVideo",
    checkNewVideo_intervalTime: "#checkNewVideo_intervalTime",
    checkNewVideo_ruleTime: "#checkNewVideo_ruleTime",
    httpTimeout: "#httpTimeout",
    httpRetryCount: "#httpRetryCount",
    circuitBreakerThreshold: "#circuitBreakerThreshold",
    circuitBreakerCooldown: "#circuitBreakerCooldownSec",
    clogMsgCount: "#clogMsgCount",
    webDavUrl: "#webDavUrl",
    webDavUsername: "#webDavUsername",
    webDavPassword: "#webDavPassword",
    missAvUrl: "#missAvUrl",
    jableUrl: "#jableUrl",
    avgleUrl: "#avgleUrl",
    javTrailersUrl: "#javTrailersUrl",
    av123Url: "#av123Url",
    javDbUrl: "#javDbUrl",
    javBusUrl: "#javBusUrl",
    supJavUrl: "#supJavUrl",
    enableTitleSelectFilter: "#enableTitleSelectFilter",
    enableFavoriteActresses: "#enableFavoriteActresses",
    enableSaveActressCarInfo: "#enableSaveActressCarInfo",
    autoRemoveNewVideoMarkAfterBrowse: "#autoRemoveNewVideoMarkAfterBrowse",
});

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
        .after(dependencies.jquery('<p id="jhs-webdav-credential-error" class="jhs-setting-help" role="alert"></p>').text(error.message));
}

/** Load all settings from storage into the main settings dialog form fields. */
/** @param {SettingDependencies} dependencies @param {any} [layerRoot] */
export async function loadSettingForm(dependencies, layerRoot = null) {
    if (dependencies.isActive?.() === false) return;
    const root = formRoot(dependencies, layerRoot);
    const e = dependencies.settings.snapshot();
    root.find("#videoQuality").val(e.videoQuality || "");
    root.find("#reviewCount").val(e.reviewCount || 20);
    root.find("#tagPosition").val(e.tagPosition || "rightTop");
    // BindingHub-owned live/nextNavigation fields are intentionally NOT hydrated
    // here: they are owned by SettingPlugin.hydrateLiveSettings().
    root.find("#autoRemoveNewVideoMarkAfterBrowse").prop("checked", !!e.autoRemoveNewVideoMarkAfterBrowse && e.autoRemoveNewVideoMarkAfterBrowse === _);
    root.find("#waitCheckCount").val(e.waitCheckCount || 5);
    root.find("#checkConcurrencyCount").val(parseNumberSetting(e.checkConcurrencyCount, 2, { min: 2, max: 5 }));
    root.find("#checkRequestSleep").val(parseNumberSetting(e.checkRequestSleep, 100, { min: 0, max: 3e3 }));
    root.find("#enableCheckBlacklist").prop("checked", (e.enableCheckBlacklist || _) === _);
    root.find("#checkBlacklist_intervalTime").val(e.checkBlacklist_intervalTime || 12);
    root.find("#checkBlacklist_ruleTime").val(parseNumberSetting(e.checkBlacklist_ruleTime, 8760, { min: 0 }));
    root.find("#enableCheckFavoriteActress").prop("checked", (e.enableCheckFavoriteActress || _) === _);
    root.find("#checkFavoriteActress_IntervalTime").val(e.checkFavoriteActress_IntervalTime || 24);
    root.find("#enableCheckNewVideo").prop("checked", (e.enableCheckNewVideo || _) === _);
    root.find("#checkNewVideo_intervalTime").val(e.checkNewVideo_intervalTime || 12);
    root.find("#checkNewVideo_ruleTime").val(parseNumberSetting(e.checkNewVideo_ruleTime, 8760, { min: 0 }));
    const t = e.highlightedTagNumber || 1, n = e.highlightedTagColor || "#ce2222";
    root.find("#highlightedTagNumber").val(e.highlightedTagNumber || 1);
    root.find("#highlightedTagColor").val(e.highlightedTagColor || "#ce2222");
    root.find("#highlightedTagLabel").css("border", `${t}px solid ${n}`);
    root.find("#clogMsgCount").val(e.clogMsgCount || 2e3);
    root.find("#httpTimeout").val(e.httpTimeout || 5e3);
    root.find("#httpRetryCount").val(e.httpRetryCount || 3);
    // Seed manual fields before the draft snapshot, ahead of diagnostic rendering.
    root.find("#circuitBreakerThreshold").val(e.circuitBreakerThreshold ?? 3);
    root.find("#circuitBreakerCooldownSec").val(Number(e.circuitBreakerCooldown ?? 60000) / 1000);
    root.find("#webDavUrl").val(e.webDavUrl || "");
    root.find("#webDavUsername").val(e.webDavUsername || "");
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
    for (const [key, fallback] of Object.entries(SYNC_DEFAULTS)) root.find(`#${key}`).val(e[key] ?? fallback);
    root.trigger("jhsAutoBackupFormLoaded");
    root.find("#enableTitleSelectFilter").prop("checked", !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _);
    root.find("#enableFavoriteActresses").prop("checked", !e.enableFavoriteActresses || e.enableFavoriteActresses === _);
    root.find("#enableSaveActressCarInfo").prop("checked", !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _);
    const movie = dependencies.movie;
    root.find("#missAvUrl").val(movie.externalSiteOrigin("missAvBtn", e));
    root.find("#jableUrl").val(movie.externalSiteOrigin("jableBtn", e));
    root.find("#avgleUrl").val(movie.externalSiteOrigin("avgleBtn", e));
    root.find("#javTrailersUrl").val(movie.externalSiteOrigin("javTrailersBtn", e));
    root.find("#av123Url").val(movie.providerOrigin("av123") || "");
    root.find("#javDbUrl").val(movie.externalSiteOrigin("javDbBtn", e));
    root.find("#javBusUrl").val(movie.externalSiteOrigin("javBusBtn", e));
    root.find("#supJavUrl").val(movie.externalSiteOrigin("supJavBtn", e));
    let g = await dependencies.legacyStorage.getReviewFilterKeywordList(), p = await dependencies.legacyStorage.getTitleFilterKeyword();
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
        const columns = Math.min(10, Math.max(2, Math.round(Number(value) || 5)));
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
    const binding = bindSettingRows(host, descriptors, { settings: dependencies.settings });
    host.data("jhsQuickSettingBinding", binding);
    host.find("#moreBtn")
        .off(".jhsQuickSetting")
        .on("click.jhsQuickSetting", (async (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentBinding = host.data("jhsQuickSettingBinding");
            await currentBinding?.flush?.();
            host.hide();
            await openSettingDialogFn("base-panel");
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
        const patch = { ...sessionSubmitted, ...await collectManualSettingPatch(root, dirtyKeys, submitted?.fields) };
        for (const [key, value] of Object.entries(patch)) dependencies.settingsRegistry?.validateSync(key, value);
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
        /** @type {string | null} */
        let nextWebDavUrl = null;
        /** @type {string | null} */
        let nextWebDavOrigin = null;
        // WebDAV validation/authorization only applies when the user actually changed
        // the WebDAV URL; unrelated saves must not be blocked by a historical URL.
        if (!dirtyKeys || dirtyKeys.has("webDavUrl")) {
            nextWebDavUrl = String(submitted?.fields.webDavUrl ?? root.find("#webDavUrl").val() ?? "").trim();
            if (nextWebDavUrl) {
                try {
                    const parsed = new URL(nextWebDavUrl);
                    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
                    nextWebDavOrigin = parsed.origin;
                } catch {
                    throw new Error("WebDAV 地址必须是有效的 HTTP/HTTPS URL");
                }
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

        const keywordErrors = [];
        if (dirtyReviewKeywords) {
            try {
                // replaceAll 清掉删除按钮的 ×；去重避免重复标签落库
                const reviewKeywords = [ ...new Set(root.find("#reviewKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
                    const text = dependencies.jquery(element).text().replaceAll("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
                    return text;
                }).filter(Boolean)) ];
                await dependencies.legacyStorage.saveReviewFilterKeyword(submitted?.review ?? reviewKeywords);
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
                await dependencies.legacyStorage.saveTitleFilterKeyword(submitted?.title ?? titleKeywords);
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
        const requiresNavigation = Object.keys(patch).some(key => key === "disabledPlugins" || dependencies.settingsRegistry?.get(key)?.effect === "nextNavigation");
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

/** @param {any} root @param {Set<string> | null | undefined} [dirtyKeys] */
/** @param {any} root @param {Set<string>|null} dirtyKeys @param {Record<string, any>|null} submitted */
async function collectManualSettingPatch(root, dirtyKeys = null, submitted = null) {
    const read = (/** @type {string} */ selector) => {
        const key = Object.entries(MANUAL_FORM_SELECTORS).find(([, value]) => value === selector)?.[0];
        return submitted && key && Object.hasOwn(submitted, key) ? submitted[key] : root.find(selector).val();
    };
    const checked = (/** @type {string} */ selector) => {
        const key = Object.entries(MANUAL_FORM_SELECTORS).find(([, value]) => value === selector)?.[0];
        return submitted && key && Object.hasOwn(submitted, key) ? Boolean(submitted[key]) : root.find(selector).is(":checked");
    };
    const clamp = (/** @type {unknown} */ value, /** @type {number} */ fallback, /** @type {number} */ min, /** @type {number} */ max) => Math.min(max, Math.max(min, Number(value) || fallback));
    const configuredUrl = (/** @type {unknown} */ value, { allowLocalHttp = !1 } = {}) => {
        const raw = String(value || "").trim().replace(/\/$/, "");
        if (!raw) return "";
        let url;
        try { url = new URL(raw); } catch { throw new TypeError(`无效 URL：${raw}`); }
        const local = [ "localhost", "127.0.0.1", "[::1]" ].includes(url.hostname);
        if (url.protocol !== "https:" && !(allowLocalHttp && local && url.protocol === "http:")) throw new TypeError(`仅允许 HTTPS URL${allowLocalHttp ? "（本机地址可使用 HTTP）" : ""}：${raw}`);
        return url.href.replace(/\/$/, "");
    };
    /** @type {Record<string, () => unknown | Promise<unknown>>} */
    const getters = {
        videoQuality: () => read("#videoQuality"),
        reviewCount: () => read("#reviewCount"),
        tagPosition: () => read("#tagPosition"),
        autoRemoveNewVideoMarkAfterBrowse: () => checked("#autoRemoveNewVideoMarkAfterBrowse") ? _ : C,
        waitCheckCount: () => read("#waitCheckCount"),
        highlightedTagNumber: () => read("#highlightedTagNumber"),
        highlightedTagColor: () => read("#highlightedTagColor"),
        checkConcurrencyCount: () => read("#checkConcurrencyCount"),
        checkRequestSleep: () => read("#checkRequestSleep"),
        enableCheckBlacklist: () => checked("#enableCheckBlacklist") ? _ : C,
        checkBlacklist_intervalTime: () => read("#checkBlacklist_intervalTime"),
        checkBlacklist_ruleTime: () => read("#checkBlacklist_ruleTime"),
        enableCheckFavoriteActress: () => checked("#enableCheckFavoriteActress") ? _ : C,
        checkFavoriteActress_IntervalTime: () => read("#checkFavoriteActress_IntervalTime"),
        enableCheckNewVideo: () => checked("#enableCheckNewVideo") ? _ : C,
        checkNewVideo_intervalTime: () => read("#checkNewVideo_intervalTime"),
        checkNewVideo_ruleTime: () => read("#checkNewVideo_ruleTime"),
        httpTimeout: () => clamp(read("#httpTimeout"), 5e3, 1e3, 120e3),
        httpRetryCount: () => clamp(read("#httpRetryCount"), 3, 1, 10),
        circuitBreakerThreshold: () => clamp(read("#circuitBreakerThreshold"), 3, 1, 20),
        circuitBreakerCooldown: () => clamp(Number(read("#circuitBreakerCooldownSec")) * 1e3, 6e4, 1e3, 3600e3),
        clogMsgCount: () => read("#clogMsgCount"),
        webDavUrl: () => configuredUrl(read("#webDavUrl"), { allowLocalHttp: !0 }),
        webDavUsername: () => String(read("#webDavUsername") ?? ""),
        missAvUrl: () => configuredUrl(read("#missAvUrl")),
        jableUrl: () => configuredUrl(read("#jableUrl")),
        avgleUrl: () => configuredUrl(read("#avgleUrl")),
        javTrailersUrl: () => configuredUrl(read("#javTrailersUrl")),
        av123Url: () => configuredUrl(read("#av123Url")),
        javDbUrl: () => configuredUrl(read("#javDbUrl")),
        javBusUrl: () => configuredUrl(read("#javBusUrl")),
        supJavUrl: () => configuredUrl(read("#supJavUrl")),
        enableTitleSelectFilter: () => checked("#enableTitleSelectFilter") ? _ : C,
        enableFavoriteActresses: () => checked("#enableFavoriteActresses") ? _ : C,
        enableSaveActressCarInfo: () => checked("#enableSaveActressCarInfo") ? _ : C,
    };
    for (const [key, fallback] of Object.entries(SYNC_DEFAULTS)) getters[key] = () => {
        const field = root.find(`#${key}`);
        if (!field.length) return fallback;
        return typeof fallback === "number" ? Number(read(`#${key}`)) : checked(`#${key}`) ? "yes" : "no";
    };
    const keys = dirtyKeys instanceof Set
        ? MANUAL_FORM_SETTING_KEYS.filter((key) => dirtyKeys.has(key)).filter((key) => !["webDavUrl", "webDavUsername", "webDavPassword"].includes(key))
        : MANUAL_FORM_SETTING_KEYS.filter((key) => !["webDavUrl", "webDavUsername", "webDavPassword"].includes(key));
    const patch = /** @type {Record<string, unknown>} */ ({});
    for (const key of keys) {
        const getter = getters[key];
        if (getter) patch[key] = await getter();
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
        }), null, { confirmText: "移除", cancelText: "取消" });
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
