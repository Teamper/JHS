// @ts-check

import { C, _, r } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { parseNumberSetting } from "../../core/feature-helpers.js";
import { applyImageMode } from "./setting-styles.js";
import { decryptCredential, encryptCredential } from "../../core/credential-crypto.js";
import { normalizeQuickFilterKey } from "../../features/list/list-filters.js";
import { bindSettingRows } from "../../ui/settings/setting-control-renderer.js";

/** @typedef {Record<string, any>} SettingDependencies */
const settingsEventBus = /** @type {NonNullable<typeof jhsEventBus>} */ (jhsEventBus);

/**
 * Explicit ownership whitelist for the bottom "保存设置" button.
 *
 * These are the only keys the full settings form is allowed to write on a
 * manual save. Every live/next-navigation setting is intentionally excluded and
 * is persisted by its own change handler / binding.
 */
export const MANUAL_FORM_SETTING_KEYS = Object.freeze([
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

/** @param {any} layerRoot */
function formRoot(layerRoot) {
    return layerRoot ? /** @type {any} */ (globalThis).$(layerRoot) : /** @type {any} */ (globalThis).$(document);
}

/** Load all settings from storage into the main settings dialog form fields. */
/** @param {SettingDependencies} dependencies @param {any} [layerRoot] */
export async function loadSettingForm(dependencies, layerRoot = null) {
    const root = formRoot(layerRoot);
    const e = dependencies.settings.snapshot();
    root.find("#videoQuality").val(e.videoQuality);
    root.find("#reviewCount").val(e.reviewCount || 20);
    root.find("#tagPosition").val(e.tagPosition || "rightTop");
    root.find("#defaultQuickFilterTab").val(normalizeQuickFilterKey(e.defaultQuickFilterTab));
    root.find("#needClosePageBasic").prop("checked", !e.needClosePage || e.needClosePage === _);
    root.find("#autoRemoveNewVideoMarkAfterBrowse").prop("checked", !!e.autoRemoveNewVideoMarkAfterBrowse && e.autoRemoveNewVideoMarkAfterBrowse === _);
    root.find("#waitCheckCount").val(e.waitCheckCount || 5);
    root.find("#checkConcurrencyCount").val(parseNumberSetting(e.checkConcurrencyCount, 2, { min: 2, max: 5 }));
    root.find("#checkRequestSleep").val(parseNumberSetting(e.checkRequestSleep, 100, { min: 0, max: 3e3 }));
    root.find("#enableCheckBlacklist").val(e.enableCheckBlacklist || _);
    root.find("#checkBlacklist_intervalTime").val(e.checkBlacklist_intervalTime || 12);
    root.find("#checkBlacklist_ruleTime").val(parseNumberSetting(e.checkBlacklist_ruleTime, 8760, { min: 0 }));
    root.find("#enableCheckFavoriteActress").val(e.enableCheckFavoriteActress || _);
    root.find("#checkFavoriteActress_IntervalTime").val(e.checkFavoriteActress_IntervalTime || 24);
    root.find("#enableCheckNewVideo").val(e.enableCheckNewVideo || _);
    root.find("#checkNewVideo_intervalTime").val(e.checkNewVideo_intervalTime || 12);
    root.find("#checkNewVideo_ruleTime").val(parseNumberSetting(e.checkNewVideo_ruleTime, 8760, { min: 0 }));
    const t = e.highlightedTagNumber || 1, n = e.highlightedTagColor || "#ce2222";
    root.find("#highlightedTagNumber").val(e.highlightedTagNumber || 1);
    root.find("#highlightedTagColor").val(e.highlightedTagColor || "#ce2222");
    root.find("#highlightedTagLabel").css("border", `${t}px solid ${n}`);
    root.find("#enableClog").val(e.enableClog || _);
    root.find("#clogMsgCount").val(e.clogMsgCount || 2e3);
    root.find("#mobileMode").val(e.mobileMode || "auto");
    root.find("#themeMode").val(e.themeMode || "light");
    root.find("#httpTimeout").val(e.httpTimeout || 5e3);
    root.find("#httpRetryCount").val(e.httpRetryCount || 3);
    root.find("#webDavUrl").val(e.webDavUrl || "");
    root.find("#webDavUsername").val(e.webDavUsername || "");
    root.find("#webDavPassword").val(await decryptCredential(e.webDavPassword) || "");
    root.find("#enableTitleSelectFilter").prop("checked", !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _);
    root.find("#enableFavoriteActresses").prop("checked", !e.enableFavoriteActresses || e.enableFavoriteActresses === _);
    root.find("#enableSaveActressCarInfo").prop("checked", !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _);
    root.find("#containerColumns").val(e.containerColumns || 5);
    root.find("#showContainerColumns").text(e.containerColumns || 5);
    root.find("#containerWidth").val((e.containerWidth || 100) - 70);
    root.find("#showContainerWidth").text((e.containerWidth || 100) + "%");
    const movie = dependencies.movie;
    root.find("#missAvUrl").val(movie.externalSiteOrigin("missAvBtn", e));
    root.find("#jableUrl").val(movie.externalSiteOrigin("jableBtn", e));
    root.find("#avgleUrl").val(movie.externalSiteOrigin("avgleBtn", e));
    root.find("#javTrailersUrl").val(movie.externalSiteOrigin("javTrailersBtn", e));
    root.find("#av123Url").val(movie.providerOrigin("av123") || "");
    root.find("#javDbUrl").val(movie.externalSiteOrigin("javDbBtn", e));
    root.find("#javBusUrl").val(movie.externalSiteOrigin("javBusBtn", e));
    root.find("#supJavUrl").val(movie.externalSiteOrigin("supJavBtn", e));
    let g = await storageManager.getReviewFilterKeywordList(), p = await storageManager.getTitleFilterKeyword();
    g && g.forEach((/** @type {string} */ item) => {
        addLabelTag("#reviewKeywordContainer", item, root);
    });
    p && p.forEach((/** @type {string} */ item) => {
        addLabelTag("#filterKeywordContainer", item, root);
    });
    [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((/** @type {string} */ container) => {
        root.find(`${container} .add-tag-btn`).on("click", ((/** @type {any} */ event) => addKeyword(event, container, root)));
        root.find(`${container} .keyword-input`).on("keypress", ((/** @type {any} */ event) => {
            "Enter" === event.key && addKeyword(event, container, root);
        }));
    });
    bindLayoutRangeEvents(root, dependencies.busImg, dependencies.host, dependencies.settings);
}

/** Bind the shared layout range controls without accumulating handlers. */
/**
 * This only handles live drag preview. The actual commit is owned by
 * SettingBindingHub through the static control binding created in
 * SettingPlugin.hydrateLiveSettings(), so persistence and rollback stay unified.
 *
 * @param {any} root @param {any} busImgPlugin @param {any} hostAdapter @param {any} settings
 */
function bindLayoutRangeEvents(root, busImgPlugin, hostAdapter, settings) {
    root.find("#containerColumns").off(".jhsSetting").on("input.jhsSetting", (() => {
        const columns = root.find("#containerColumns").val();
        root.find("#showContainerColumns").text(columns);
        const listRoot = hostAdapter?.locateListRoot?.();
        listRoot && (listRoot.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`);
    }));
    root.find("#containerWidth").off(".jhsSetting").on("input.jhsSetting", ((/** @type {any} */ event) => {
        const width = parseInt($(event.target).val()) + 70, widthText = `${width}%`;
        root.find("#showContainerWidth").text(widthText);
        const layoutContainer = hostAdapter?.getListLayoutContainer?.();
        layoutContainer && (layoutContainer.style.minWidth = widthText);
    }));
}

/** Initialize quick settings in either the desktop popover or mobile layer. */
/** @param {SettingDependencies} dependencies @param {() => any} getSelector @param {(panel: string) => void} openSettingDialogFn @param {any} [root] */
export async function initQuickSettingForm(dependencies, getSelector, openSettingDialogFn, root = null) {
    const registry = dependencies.settingsRegistry;
    if (!registry) return;
    const host = root ? $(root) : $(".simple-setting, .mini-simple-setting, .jhs-quick-setting").first();
    if (!host.length) return;
    const descriptors = registry.list({ surfaces: [ "quick" ] });
    const binding = bindSettingRows(host, descriptors, { settings: dependencies.settings });
    host.data("jhsQuickSettingBinding", binding);
    host.find("#moreBtn").off("click").on("click", (() => {
        host.data("jhsQuickSettingBinding")?.dispose?.();
        $(".simple-setting, .mini-simple-setting").html("").hide();
        openSettingDialogFn("base-panel");
    }));
}

/** Read all form values and save to storage. */
/** @param {SettingDependencies} dependencies @param {any} [layerRoot] */
export async function saveSettingForm(dependencies, layerRoot = null) {
    const root = formRoot(layerRoot);
    const nextWebDavUrl = String(root.find("#webDavUrl").val() || "").trim();
    let nextWebDavOrigin = null;
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
        const authorized = await new Promise((resolve) => utils.q(null, `仅授权 WebDAV 精确来源：${nextWebDavOrigin}，是否继续？`, () => resolve(true), () => resolve(false)));
        if (!authorized) return { canceled: true };
    }

    const patch = await collectManualSettingPatch(root);
    await dependencies.settings.update((/** @type {Record<string, any>} */ draft) => {
        Object.assign(draft, patch);
        if (nextWebDavOrigin) {
            const origins = new Set(Array.isArray(draft.trustedLocalOrigins) ? draft.trustedLocalOrigins : []);
            origins.add(nextWebDavOrigin);
            draft.trustedLocalOrigins = [ ...origins ];
        }
    });

    const keywordErrors = [];
    try {
        const reviewKeywords = root.find("#reviewKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
            const text = $(element).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
            return text;
        });
        await storageManager.saveReviewFilterKeyword(reviewKeywords);
    } catch (error) {
        keywordErrors.push(error);
    }
    try {
        const titleKeywords = root.find("#filterKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
            const text = $(element).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
            return text;
        });
        await storageManager.saveTitleFilterKeyword(titleKeywords);
    } catch (error) {
        keywordErrors.push(error);
    }
    if (keywordErrors.length) {
        const error = /** @type {any} */ (new Error("部分设置保存失败，请重试"));
        error.partialFailure = true;
        error.cause = keywordErrors[0];
        throw error;
    }

    // Best-effort UI post-processing; it must never turn a successful save into a failure.
    try {
        await settingsEventBus.emit("filter-rules-changed", { scope: "title-keyword" });
        dependencies.newVideo?.resetBtnTip?.();
        dependencies.blacklist?.resetBtnTip?.();
        dependencies.blacklist?.reloadTable?.();
    } catch (error) {
        if (typeof /** @type {any} */ (globalThis).clog?.error === "function") /** @type {any} */ (globalThis).clog.error("设置保存后 UI 刷新失败（已忽略）", error);
    }
    return { ok: true };
}

/** @param {any} root */
async function collectManualSettingPatch(root) {
    const patch = /** @type {Record<string, unknown>} */ ({});
    for (const key of MANUAL_FORM_SETTING_KEYS) {
        patch[key] = undefined;
    }
    patch.videoQuality = root.find("#videoQuality").val();
    patch.reviewCount = root.find("#reviewCount").val();
    patch.tagPosition = root.find("#tagPosition").val();
    patch.autoRemoveNewVideoMarkAfterBrowse = root.find("#autoRemoveNewVideoMarkAfterBrowse").is(":checked") ? _ : C;
    patch.waitCheckCount = root.find("#waitCheckCount").val();
    patch.highlightedTagNumber = root.find("#highlightedTagNumber").val();
    patch.highlightedTagColor = root.find("#highlightedTagColor").val();
    patch.checkConcurrencyCount = root.find("#checkConcurrencyCount").val();
    patch.checkRequestSleep = root.find("#checkRequestSleep").val();
    patch.enableCheckBlacklist = root.find("#enableCheckBlacklist").val();
    patch.checkBlacklist_intervalTime = root.find("#checkBlacklist_intervalTime").val();
    patch.checkBlacklist_ruleTime = root.find("#checkBlacklist_ruleTime").val();
    patch.enableCheckFavoriteActress = root.find("#enableCheckFavoriteActress").val();
    patch.checkFavoriteActress_IntervalTime = root.find("#checkFavoriteActress_IntervalTime").val();
    patch.enableCheckNewVideo = root.find("#enableCheckNewVideo").val();
    patch.checkNewVideo_intervalTime = root.find("#checkNewVideo_intervalTime").val();
    patch.checkNewVideo_ruleTime = root.find("#checkNewVideo_ruleTime").val();
    patch.httpTimeout = Number(root.find("#httpTimeout").val()) || 5e3;
    patch.httpRetryCount = Number(root.find("#httpRetryCount").val()) || 3;
    patch.circuitBreakerThreshold = Number(root.find("#circuitBreakerThreshold").val()) || 3;
    patch.circuitBreakerCooldown = Number(root.find("#circuitBreakerCooldownSec").val()) * 1e3;
    patch.clogMsgCount = root.find("#clogMsgCount").val();
    patch.webDavUrl = String(root.find("#webDavUrl").val() || "").trim();
    patch.webDavUsername = String(root.find("#webDavUsername").val() || "");
    patch.webDavPassword = await encryptCredential(String(root.find("#webDavPassword").val() || ""));
    patch.missAvUrl = String(root.find("#missAvUrl").val() || "").replace(/\/$/, "");
    patch.jableUrl = String(root.find("#jableUrl").val() || "").replace(/\/$/, "");
    patch.avgleUrl = String(root.find("#avgleUrl").val() || "").replace(/\/$/, "");
    patch.javTrailersUrl = String(root.find("#javTrailersUrl").val() || "").replace(/\/$/, "");
    patch.av123Url = String(root.find("#av123Url").val() || "").replace(/\/$/, "");
    patch.javDbUrl = String(root.find("#javDbUrl").val() || "").replace(/\/$/, "");
    patch.javBusUrl = String(root.find("#javBusUrl").val() || "").replace(/\/$/, "");
    patch.supJavUrl = String(root.find("#supJavUrl").val() || "").replace(/\/$/, "");
    patch.enableTitleSelectFilter = root.find("#enableTitleSelectFilter").is(":checked") ? _ : C;
    patch.enableFavoriteActresses = root.find("#enableFavoriteActresses").is(":checked") ? _ : C;
    patch.enableSaveActressCarInfo = root.find("#enableSaveActressCarInfo").is(":checked") ? _ : C;
    return patch;
}

/** Create a removable keyword label tag in the filter panel. */
/** @param {string} container @param {string} text @param {any} root */
function addLabelTag(container, text, root) {
    const target = root.find(`${container} .tag-box`);
    let node;
    if (/^[a-z]{2,}-/i.test(text) && r) {
        node = $(`
            <a class="keyword-label keyword-label--link" data-keyword="${text}" href="/video_codes/${text.replace("-", "")}" target="_blank">
                ${text}
                <span class="keyword-remove">×</span>
            </a>
        `);
    } else {
        node = $(`
            <div class="keyword-label" data-keyword="${text}">
                ${text}
                <span class="keyword-remove">×</span>
            </div>
        `);
    }
    node.find(".keyword-remove").click(((/** @type {any} */ event) => {
        event.stopPropagation(), event.preventDefault();
        const current = $(event.currentTarget);
        const keyword = current.closest(".keyword-label").attr("data-keyword").split(" ")[0];
        utils.q(event, `是否移除屏蔽词  ${keyword}?`, (async () => {
            current.parent().remove();
        }));
    }));
    target.append(node);
}

/** Add a keyword from the input field to the tag box. */
/** @param {any} event @param {string} container @param {any} root */
function addKeyword(event, container, root) {
    const input = root.find(`${container} .keyword-input`);
    const value = input.val().trim();
    value && (addLabelTag(container, value, root), input.val(""));
}
