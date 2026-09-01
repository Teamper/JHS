// @ts-check

import { C, _, r } from "../../../core/constants.js";
import { jhsEventBus } from "../../../core/event-bus.js";
import { parseNumberSetting } from "../../../core/feature-helpers.js";
import { applyImageMode } from "./setting-styles.js";
import { decryptCredential, encryptCredential } from "../../../core/credential-crypto.js";
import { normalizeQuickFilterKey } from "../../list/list-filters.js";
import { bindSettingRows } from "../../../ui/settings/setting-control-renderer.js";

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


/** Selector map used to track dirty manual fields on the full settings form. */
export const MANUAL_FORM_SELECTORS = Object.freeze({
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
    const dirty = new Set();
    root.data("jhsDirtyManualKeys", dirty);
    for (const key of MANUAL_FORM_SETTING_KEYS) {
        const selector = /** @type {Record<string, string>} */ (MANUAL_FORM_SELECTORS)[key];
        if (!selector) continue;
        root.find(selector).off(".jhsDirty").on("change.jhsDirty", () => dirty.add(key));
    }
}

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
    // BindingHub-owned live/nextNavigation fields are intentionally NOT hydrated
    // here: they are owned by SettingPlugin.hydrateLiveSettings().
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
    root.find("#clogMsgCount").val(e.clogMsgCount || 2e3);
    root.find("#httpTimeout").val(e.httpTimeout || 5e3);
    root.find("#httpRetryCount").val(e.httpRetryCount || 3);
    root.find("#webDavUrl").val(e.webDavUrl || "");
    root.find("#webDavUsername").val(e.webDavUsername || "");
    root.find("#webDavPassword").val(await decryptCredential(e.webDavPassword) || "");
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
    let g = await storageManager.getReviewFilterKeywordList(), p = await storageManager.getTitleFilterKeyword();
    // “重试加载”会重跑本函数：先清空标签容器并解绑旧事件，否则关键词显示两份、添加事件翻倍
    [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((/** @type {string} */ container) => {
        root.find(`${container} .tag-box`).empty();
        root.find(`${container} .add-tag-btn`).off(".jhsKeywordBind"), root.find(`${container} .keyword-input`).off(".jhsKeywordBind");
    });
    g && g.forEach((/** @type {string} */ item) => {
        addLabelTag("#reviewKeywordContainer", item, root);
    });
    p && p.forEach((/** @type {string} */ item) => {
        addLabelTag("#filterKeywordContainer", item, root);
    });
    [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((/** @type {string} */ container) => {
        root.find(`${container} .add-tag-btn`).on("click.jhsKeywordBind", ((/** @type {any} */ event) => addKeyword(event, container, root)));
        root.find(`${container} .keyword-input`).on("keypress.jhsKeywordBind", ((/** @type {any} */ event) => {
            "Enter" === event.key && addKeyword(event, container, root);
        }));
    });
    bindManualDirtyTracking(root);
    bindKeywordDirtyTracking(root);
    bindLayoutRangeEvents(root, dependencies.host);
}

/** Bind the shared layout range controls without accumulating handlers. */
/**
 * This only handles live drag preview. The actual commit is owned by
 * SettingBindingHub through the static control binding created in
 * SettingPlugin.hydrateLiveSettings(), so persistence and rollback stay unified.
 *
 * @param {any} root @param {any} hostAdapter
 */
function bindLayoutRangeEvents(root, hostAdapter) {
    root.find("#containerColumns").off(".jhsSetting").on("input.jhsSetting", (() => {
        applyLayoutRangeValue(root, hostAdapter, "containerColumns", root.find("#containerColumns").val());
    }));
    root.find("#containerWidth").off(".jhsSetting").on("input.jhsSetting", ((/** @type {any} */ event) => {
        applyLayoutRangeValue(root, hostAdapter, "containerWidth", parseInt($(event.target).val()) + 70);
    }));
}

/** Applies one persisted layout value to both the control and the live host DOM. @param {any} root @param {any} hostAdapter @param {"containerColumns" | "containerWidth"} key @param {unknown} value */
export function applyLayoutRangeValue(root, hostAdapter, key, value) {
    if (key === "containerColumns") {
        const columns = Math.min(10, Math.max(2, Math.round(Number(value) || 5)));
        root.find("#containerColumns").val(String(columns));
        root.find("#showContainerColumns").text(String(columns));
        const listRoot = hostAdapter?.locateListRoot?.();
        if (listRoot) listRoot.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        return;
    }
    const width = Math.min(100, Math.max(70, Math.round(Number(value) || 100)));
    const widthText = `${width}%`;
    root.find("#containerWidth").val(String(width - 70));
    root.find("#showContainerWidth").text(widthText);
    const layoutContainer = hostAdapter?.getListLayoutContainer?.();
    if (layoutContainer) layoutContainer.style.minWidth = widthText;
}

/** Dispose one quick-setting host's binding and clear its DOM. */
/** @param {any} host */
export function disposeQuickSettingHost(host) {
    const root = $(host);
    root.data("jhsQuickSettingBinding")?.dispose?.();
    root.removeData("jhsQuickSettingBinding");
    root.empty().hide();
}

/** Initialize quick settings in either the desktop popover or mobile layer. */
/** @param {SettingDependencies} dependencies @param {() => any} getSelector @param {(panel: string) => void} openSettingDialogFn @param {any} root */
export async function initQuickSettingForm(dependencies, getSelector, openSettingDialogFn, root) {
    const host = $(root);
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
            disposeQuickSettingHost(host);
            await openSettingDialogFn("base-panel");
        }));
}

/** Read all form values and save to storage. */
/** @param {SettingDependencies} dependencies @param {any} [layerRoot] */
export async function saveSettingForm(dependencies, layerRoot = null) {
    const root = formRoot(layerRoot);
    const dirtyKeys = root.data("jhsDirtyManualKeys") || null;
    /** @type {string | null} */
    let nextWebDavUrl = null;
    /** @type {string | null} */
    let nextWebDavOrigin = null;
    // WebDAV validation/authorization only applies when the user actually changed
    // the WebDAV URL; unrelated saves must not be blocked by a historical URL.
    if (!dirtyKeys || dirtyKeys.has("webDavUrl")) {
        nextWebDavUrl = String(root.find("#webDavUrl").val() || "").trim();
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
    }

    const patch = await collectManualSettingPatch(root, dirtyKeys);
    await dependencies.settings.update((/** @type {Record<string, any>} */ draft) => {
        Object.assign(draft, patch);
        if (nextWebDavOrigin) {
            const origins = new Set(Array.isArray(draft.trustedLocalOrigins) ? draft.trustedLocalOrigins : []);
            origins.add(nextWebDavOrigin);
            draft.trustedLocalOrigins = [ ...origins ];
        }
    });
    root.data("jhsDirtyManualKeys", new Set());

    const keywordErrors = [];
    const dirtyReviewKeywords = root.data("jhsDirtyReviewKeywords") === true;
    const dirtyTitleKeywords = root.data("jhsDirtyTitleKeywords") === true;
    if (dirtyReviewKeywords) {
        try {
            // replaceAll 清掉删除按钮的 ×；去重避免重复标签落库
            const reviewKeywords = [ ...new Set(root.find("#reviewKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
                const text = $(element).text().replaceAll("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
                return text;
            }).filter(Boolean)) ];
            await storageManager.saveReviewFilterKeyword(reviewKeywords);
        } catch (error) {
            keywordErrors.push(error);
        }
    }
    if (dirtyTitleKeywords) {
        try {
            const titleKeywords = [ ...new Set(root.find("#filterKeywordContainer .keyword-label").toArray().map((/** @type {Element} */ element) => {
                const text = $(element).text().replaceAll("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
                return text;
            }).filter(Boolean)) ];
            await storageManager.saveTitleFilterKeyword(titleKeywords);
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
    root.data("jhsDirtyReviewKeywords", false);
    root.data("jhsDirtyTitleKeywords", false);

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
function bindKeywordDirtyTracking(root) {
    // Dirty is only set after a keyword is actually added or actually removed.
    // Event-level marking caused false positives on empty Add and cancelled Delete.
    root.data("jhsDirtyReviewKeywords", false);
    root.data("jhsDirtyTitleKeywords", false);
}

/** @param {any} root @param {Set<string> | null | undefined} [dirtyKeys] */
async function collectManualSettingPatch(root, dirtyKeys = null) {
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
        videoQuality: () => root.find("#videoQuality").val(),
        reviewCount: () => root.find("#reviewCount").val(),
        tagPosition: () => root.find("#tagPosition").val(),
        autoRemoveNewVideoMarkAfterBrowse: () => root.find("#autoRemoveNewVideoMarkAfterBrowse").is(":checked") ? _ : C,
        waitCheckCount: () => root.find("#waitCheckCount").val(),
        highlightedTagNumber: () => root.find("#highlightedTagNumber").val(),
        highlightedTagColor: () => root.find("#highlightedTagColor").val(),
        checkConcurrencyCount: () => root.find("#checkConcurrencyCount").val(),
        checkRequestSleep: () => root.find("#checkRequestSleep").val(),
        enableCheckBlacklist: () => root.find("#enableCheckBlacklist").val(),
        checkBlacklist_intervalTime: () => root.find("#checkBlacklist_intervalTime").val(),
        checkBlacklist_ruleTime: () => root.find("#checkBlacklist_ruleTime").val(),
        enableCheckFavoriteActress: () => root.find("#enableCheckFavoriteActress").val(),
        checkFavoriteActress_IntervalTime: () => root.find("#checkFavoriteActress_IntervalTime").val(),
        enableCheckNewVideo: () => root.find("#enableCheckNewVideo").val(),
        checkNewVideo_intervalTime: () => root.find("#checkNewVideo_intervalTime").val(),
        checkNewVideo_ruleTime: () => root.find("#checkNewVideo_ruleTime").val(),
        httpTimeout: () => clamp(root.find("#httpTimeout").val(), 5e3, 1e3, 120e3),
        httpRetryCount: () => clamp(root.find("#httpRetryCount").val(), 3, 1, 10),
        circuitBreakerThreshold: () => clamp(root.find("#circuitBreakerThreshold").val(), 3, 1, 20),
        circuitBreakerCooldown: () => clamp(Number(root.find("#circuitBreakerCooldownSec").val()) * 1e3, 6e4, 1e3, 3600e3),
        clogMsgCount: () => root.find("#clogMsgCount").val(),
        webDavUrl: () => configuredUrl(root.find("#webDavUrl").val(), { allowLocalHttp: !0 }),
        webDavUsername: () => String(root.find("#webDavUsername").val() || ""),
        webDavPassword: async () => encryptCredential(String(root.find("#webDavPassword").val() || "")),
        missAvUrl: () => configuredUrl(root.find("#missAvUrl").val()),
        jableUrl: () => configuredUrl(root.find("#jableUrl").val()),
        avgleUrl: () => configuredUrl(root.find("#avgleUrl").val()),
        javTrailersUrl: () => configuredUrl(root.find("#javTrailersUrl").val()),
        av123Url: () => configuredUrl(root.find("#av123Url").val()),
        javDbUrl: () => configuredUrl(root.find("#javDbUrl").val()),
        javBusUrl: () => configuredUrl(root.find("#javBusUrl").val()),
        supJavUrl: () => configuredUrl(root.find("#supJavUrl").val()),
        enableTitleSelectFilter: () => root.find("#enableTitleSelectFilter").is(":checked") ? _ : C,
        enableFavoriteActresses: () => root.find("#enableFavoriteActresses").is(":checked") ? _ : C,
        enableSaveActressCarInfo: () => root.find("#enableSaveActressCarInfo").is(":checked") ? _ : C,
    };
    const keys = dirtyKeys instanceof Set
        ? MANUAL_FORM_SETTING_KEYS.filter((key) => dirtyKeys.has(key))
        : MANUAL_FORM_SETTING_KEYS;
    const patch = /** @type {Record<string, unknown>} */ ({});
    for (const key of keys) {
        const getter = getters[key];
        if (getter) patch[key] = await getter();
    }
    return patch;
}

/** Create a removable keyword label tag in the filter panel. */
/** @param {string} container @param {string} text @param {any} root */
function addLabelTag(container, text, root) {
    const target = root.find(`${container} .tag-box`);
    const value = String(text);
    let node;
    if (/^[a-z]{2,}-/i.test(value) && r) {
        node = $("<a>")
            .addClass("keyword-label keyword-label--link")
            .attr("data-keyword", value)
            .attr("href", `/video_codes/${value.replace("-", "")}`)
            .attr("target", "_blank");
    } else {
        node = $("<div>")
            .addClass("keyword-label")
            .attr("data-keyword", value);
    }
    node.append(document.createTextNode(value));
    node.append($("<span>").addClass("keyword-remove").text("×"));
    const dirtyKey = container === "#reviewKeywordContainer" ? "jhsDirtyReviewKeywords" : "jhsDirtyTitleKeywords";
    node.find(".keyword-remove").click(((/** @type {any} */ event) => {
        event.stopPropagation(), event.preventDefault();
        const current = $(event.currentTarget);
        const keyword = current.closest(".keyword-label").attr("data-keyword").split(" ")[0];
        utils.q(event, `是否移除屏蔽词  ${keyword}?`, (async () => {
            current.parent().remove();
            root.data(dirtyKey, true);
        }));
    }));
    target.append(node);
}

/** Add a keyword from the input field to the tag box. */
/** @param {any} event @param {string} container @param {any} root */
function addKeyword(event, container, root) {
    const input = root.find(`${container} .keyword-input`);
    const value = input.val().trim();
    if (!value) return;
    // 与存储层去重语义一致：重复关键词直接忽略，不再各走各的
    const exists = root.find(`${container} .keyword-label`).toArray().some(((/** @type {Element} */ element) => $(element).text().replaceAll("×", "").trim() === value));
    if (!exists) addLabelTag(container, value, root);
    input.val("");
    root.data(container === "#reviewKeywordContainer" ? "jhsDirtyReviewKeywords" : "jhsDirtyTitleKeywords", true);
}
