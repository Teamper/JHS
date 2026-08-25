// @ts-check

import { C, _, r } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { parseNumberSetting } from "../../core/feature-helpers.js";
import { applyImageMode } from "./setting-styles.js";
import { decryptCredential, encryptCredential } from "../../core/credential-crypto.js";
import { normalizeQuickFilterKey } from "../../features/list/list-filters.js";

/** @typedef {Record<string, any>} SettingDependencies */
const settingsEventBus = /** @type {NonNullable<typeof jhsEventBus>} */ (jhsEventBus);

/** Load all settings from storage into the main settings dialog form fields. */
/** @param {SettingDependencies} dependencies */
export async function loadSettingForm(dependencies) {
    let e = dependencies.settings.snapshot();
    $("#videoQuality").val(e.videoQuality), $("#reviewCount").val(e.reviewCount || 20),
    $("#tagPosition").val(e.tagPosition || "rightTop"), $("#defaultQuickFilterTab").val(normalizeQuickFilterKey(e.defaultQuickFilterTab)), $("#needClosePageBasic").prop("checked", !e.needClosePage || e.needClosePage === _), $("#autoRemoveNewVideoMarkAfterBrowse").prop("checked", !!e.autoRemoveNewVideoMarkAfterBrowse && e.autoRemoveNewVideoMarkAfterBrowse === _), $("#waitCheckCount").val(e.waitCheckCount || 5),
    $("#checkConcurrencyCount").val(parseNumberSetting(e.checkConcurrencyCount, 2, { min: 2, max: 5 })), $("#checkRequestSleep").val(parseNumberSetting(e.checkRequestSleep, 100, { min: 0, max: 3e3 })),
    $("#enableCheckBlacklist").val(e.enableCheckBlacklist || _), $("#checkBlacklist_intervalTime").val(e.checkBlacklist_intervalTime || 12),
    $("#checkBlacklist_ruleTime").val(parseNumberSetting(e.checkBlacklist_ruleTime, 8760, { min: 0 })), $("#enableCheckFavoriteActress").val(e.enableCheckFavoriteActress || _),
    $("#checkFavoriteActress_IntervalTime").val(e.checkFavoriteActress_IntervalTime || 24),
    $("#enableCheckNewVideo").val(e.enableCheckNewVideo || _), $("#checkNewVideo_intervalTime").val(e.checkNewVideo_intervalTime || 12),
    $("#checkNewVideo_ruleTime").val(parseNumberSetting(e.checkNewVideo_ruleTime, 8760, { min: 0 }));
    const t = e.highlightedTagNumber || 1, n = e.highlightedTagColor || "#ce2222";
    $("#highlightedTagNumber").val(e.highlightedTagNumber || 1), $("#highlightedTagColor").val(e.highlightedTagColor || "#ce2222"),
    $("#highlightedTagLabel").css("border", `${t}px solid ${n}`), $("#enableClog").val(e.enableClog || _),
    $("#clogMsgCount").val(e.clogMsgCount || 2e3), $("#mobileMode").val(e.mobileMode || "auto"),
    $("#themeMode").val(e.themeMode || "light"),
    $("#httpTimeout").val(e.httpTimeout || 5e3), $("#httpRetryCount").val(e.httpRetryCount || 3),
    $("#webDavUrl").val(e.webDavUrl || ""), $("#webDavUsername").val(e.webDavUsername || ""),
    $("#webDavPassword").val(await decryptCredential(e.webDavPassword) || ""), $("#enableTitleSelectFilter").prop("checked", !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _),
    $("#enableFavoriteActresses").prop("checked", !e.enableFavoriteActresses || e.enableFavoriteActresses === _),
    $("#enableSaveActressCarInfo").prop("checked", !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _),
    $("#enableScreenSvg").prop("checked", !e.enableScreenSvg || e.enableScreenSvg === _),
    $("#enableVideoSvg").prop("checked", !e.enableVideoSvg || e.enableVideoSvg === _),
    $("#enableHandleSvg").prop("checked", !e.enableHandleSvg || e.enableHandleSvg === _),
    $("#enableSiteSvg").prop("checked", !e.enableSiteSvg || e.enableSiteSvg === _),
    $("#enableCopySvg").prop("checked", !e.enableCopySvg || e.enableCopySvg === _),
    $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
    $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
    $("#containerColumns").val(e.containerColumns || 5), $("#showContainerColumns").text(e.containerColumns || 5),
    $("#containerWidth").val((e.containerWidth || 100) - 70), $("#showContainerWidth").text((e.containerWidth || 100) + "%");
    const movie = dependencies.movie, i = movie.externalSiteOrigin("missAvBtn", e), s = movie.externalSiteOrigin("jableBtn", e), o = movie.externalSiteOrigin("avgleBtn", e), r = movie.externalSiteOrigin("javTrailersBtn", e), l = movie.providerOrigin("av123") || "", c = movie.externalSiteOrigin("javDbBtn", e), d = movie.externalSiteOrigin("javBusBtn", e), h = movie.externalSiteOrigin("supJavBtn", e);
    $("#missAvUrl").val(i), $("#jableUrl").val(s), $("#avgleUrl").val(o), $("#javTrailersUrl").val(r),
    $("#av123Url").val(l), $("#javDbUrl").val(c), $("#javBusUrl").val(d), $("#supJavUrl").val(h);
    let g = await storageManager.getReviewFilterKeywordList(), p = await storageManager.getTitleFilterKeyword();
    g && g.forEach((/** @type {string} */ e) => {
        addLabelTag("#reviewKeywordContainer", e);
    }), p && p.forEach((/** @type {string} */ e) => {
        addLabelTag("#filterKeywordContainer", e);
    }), [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((/** @type {string} */ e) => {
        $(`${e} .add-tag-btn`).on("click", ((/** @type {any} */ t) => addKeyword(t, e))), $(`${e} .keyword-input`).on("keypress", ((/** @type {any} */ t) => {
            "Enter" === t.key && addKeyword(t, e);
        }));
    });
    bindLayoutRangeEvents(dependencies.busImg, dependencies.host, dependencies.settings);
}

/** Bind the shared layout range controls without accumulating handlers. */
/** @param {any} busImgPlugin @param {any} hostAdapter @param {any} settings */
function bindLayoutRangeEvents(busImgPlugin, hostAdapter, settings) {
    $("#containerColumns").off(".jhsSetting").on("input.jhsSetting", (() => {
        const columns = $("#containerColumns").val();
        $("#showContainerColumns").text(columns);
        const listRoot = hostAdapter?.locateListRoot?.();
        listRoot && (listRoot.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`);
    })).on("change.jhsSetting", (async (/** @type {any} */ event) => {
        await settings.set("containerColumns", $(event.currentTarget).val()), await applyImageMode(busImgPlugin);
    }));
    $("#containerWidth").off(".jhsSetting").on("input.jhsSetting", ((/** @type {any} */ event) => {
        const width = parseInt($(event.target).val()) + 70, widthText = `${width}%`;
        $("#showContainerWidth").text(widthText);
        const layoutContainer = hostAdapter?.getListLayoutContainer?.();
        layoutContainer && (layoutContainer.style.minWidth = widthText);
    })).on("change.jhsSetting", ((/** @type {any} */ event) => settings.set("containerWidth", parseInt($(event.currentTarget).val()) + 70)));
}

/** Initialize quick settings in either the desktop popover or mobile layer. */
/** @param {SettingDependencies} dependencies @param {() => any} getSelector @param {(panel: string) => void} openSettingDialogFn */
export async function initQuickSettingForm(dependencies, getSelector, openSettingDialogFn) {
    let e = dependencies.settings.snapshot();
    $("#needClosePage").prop("checked", !e.needClosePage || e.needClosePage === _),
    $("#autoPage").prop("checked", !e.autoPage || e.autoPage === _), $("#translateTitle").prop("checked", !e.translateTitle || e.translateTitle === _),
    $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
    $("#enableLoadOtherSite").prop("checked", !e.enableLoadOtherSite || e.enableLoadOtherSite === _),
    $("#needClosePage").on("change", (async (/** @type {any} */ t) => {
        await dependencies.settings.set("needClosePage", $("#needClosePage").is(":checked") ? _ : C),
        await settingsEventBus.emit("filter-rules-changed");
    })), $("#autoPage").on("change", (async (/** @type {any} */ t) => {
        const n = $("#autoPage").is(":checked") ? _ : C;
        await dependencies.settings.set("autoPage", n), $("#sort-toggle-btn").prop("disabled", n === _).attr("title", n === _ ? "瀑布流模式仅支持默认排序" : "选择列表排序方式");
    })), $("#translateTitle").on("change", (async (/** @type {any} */ t) => {
        const n = $("#translateTitle").is(":checked") ? _ : C;
        await dependencies.settings.set("translateTitle", n), n === _ ? (await dependencies.listPage?.doFilter?.(),
        isDetailPage && await dependencies.translate?.translate?.()) : (await dependencies.listPage?.revertTranslation?.(),
        $(".translated-title").remove());
    })), $("#hoverBigImg").prop("checked", !!e.hoverBigImg && e.hoverBigImg === _),
    $("#hoverBigImg").on("change", (async (/** @type {any} */ t) => {
        const n = $("#hoverBigImg").is(":checked") ? _ : C;
        const runtimeWindow = /** @type {any} */ (window);
        await dependencies.settings.set("hoverBigImg", n), runtimeWindow.imageHoverPreviewObj && (runtimeWindow.imageHoverPreviewObj.destroy(),
        runtimeWindow.imageHoverPreviewObj = null), n === _ && (runtimeWindow.imageHoverPreviewObj = new ImageHoverPreview({
            selector: getSelector().coverImgSelector
        }));
    })), $("#enableLoadActressInfo").on("change", (async (/** @type {any} */ t) => {
        const n = $("#enableLoadActressInfo").is(":checked") ? _ : C;
        await dependencies.settings.set("enableLoadActressInfo", n), n === _ ? dependencies.actressInfo?.loadActressInfo() : $(".actress-info").remove();
    })), $("#enableLoadOtherSite").on("change", (async (/** @type {any} */ t) => {
        const n = $("#enableLoadOtherSite").is(":checked") ? _ : C;
        await dependencies.settings.set("enableLoadOtherSite", n), n === _ ? await dependencies.otherSite?.loadOtherSite?.() : $("#otherSiteBox").remove();
    })), $("#enableLoadScreenShot").prop("checked", !e.enableLoadScreenShot || e.enableLoadScreenShot === _),
    $("#enableLoadScreenShot").on("change", (async (/** @type {any} */ t) => {
        const n = $("#enableLoadScreenShot").is(":checked") ? _ : C;
        await dependencies.settings.set("enableLoadScreenShot", n), n === _ ? await dependencies.screenshot?.loadScreenShot?.() : $(".screen-container").remove();
    })), $("#enableLoadPreviewVideo").prop("checked", !e.enableLoadPreviewVideo || e.enableLoadPreviewVideo === _),
    $("#enableLoadPreviewVideo").on("change", (async (/** @type {any} */ t) => {
        const n = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
        await dependencies.settings.set("enableLoadPreviewVideo", n);
    })), $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
    $("#enableVerticalModel").on("change", (async (/** @type {any} */ t) => {
        const n = $("#enableVerticalModel").is(":checked") ? _ : C;
        await dependencies.settings.set("enableVerticalModel", n), applyImageMode(dependencies.busImg);
    })), $("#moreBtn").on("click", (() => {
        $(".simple-setting, .mini-simple-setting").html("").hide(), openSettingDialogFn("base-panel");
    }));
}

/** Read all form values and save to storage. */
/** @param {SettingDependencies} dependencies */
export async function saveSettingForm(dependencies) {
    let e = { ...dependencies.settings.snapshot() };
    const nextWebDavUrl = String($("#webDavUrl").val() || "").trim();
    let nextWebDavOrigin = null;
    if (nextWebDavUrl) {
        try {
            const parsed = new URL(nextWebDavUrl);
            if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
            nextWebDavOrigin = parsed.origin;
        } catch {
            return void show.error("WebDAV 地址必须是有效的 HTTP/HTTPS URL");
        }
    }
    const trustedOrigins = new Set(Array.isArray(e.trustedLocalOrigins) ? e.trustedLocalOrigins : []);
    if (nextWebDavOrigin && !trustedOrigins.has(nextWebDavOrigin)) {
        const authorized = await new Promise((resolve) => utils.q(null, `仅授权 WebDAV 精确来源：${nextWebDavOrigin}，是否继续？`, () => resolve(true), () => resolve(false)));
        if (!authorized) return void show.info("已取消 WebDAV 来源授权");
        trustedOrigins.add(nextWebDavOrigin);
    }
    e.videoQuality = $("#videoQuality").val(), e.reviewCount = $("#reviewCount").val(),
    e.tagPosition = $("#tagPosition").val(), e.defaultQuickFilterTab = normalizeQuickFilterKey($("#defaultQuickFilterTab").val()), e.needClosePage = $("#needClosePageBasic").is(":checked") ? _ : C, e.autoRemoveNewVideoMarkAfterBrowse = $("#autoRemoveNewVideoMarkAfterBrowse").is(":checked") ? _ : C, e.waitCheckCount = $("#waitCheckCount").val(), e.highlightedTagNumber = $("#highlightedTagNumber").val(),
    e.highlightedTagColor = $("#highlightedTagColor").val(), e.checkConcurrencyCount = $("#checkConcurrencyCount").val(),
    e.checkRequestSleep = $("#checkRequestSleep").val(), e.enableCheckBlacklist = $("#enableCheckBlacklist").val(),
    e.checkBlacklist_intervalTime = $("#checkBlacklist_intervalTime").val(), e.checkBlacklist_ruleTime = $("#checkBlacklist_ruleTime").val(),
    e.enableCheckFavoriteActress = $("#enableCheckFavoriteActress").val(), e.checkFavoriteActress_IntervalTime = $("#checkFavoriteActress_IntervalTime").val(),
    e.enableCheckNewVideo = $("#enableCheckNewVideo").val(), e.checkNewVideo_intervalTime = $("#checkNewVideo_intervalTime").val(),
    e.checkNewVideo_ruleTime = $("#checkNewVideo_ruleTime").val(), e.httpTimeout = Number($("#httpTimeout").val()) || 5e3,
    e.httpRetryCount = Number($("#httpRetryCount").val()) || 3, e.circuitBreakerThreshold = Number($("#circuitBreakerThreshold").val()) || 3,
    e.circuitBreakerCooldown = Number($("#circuitBreakerCooldownSec").val()) * 1e3, e.enableClog = $("#enableClog").val(),
    e.enableClog === _ ? clog.show() : clog.hide(), e.clogMsgCount = $("#clogMsgCount").val(),
    e.mobileMode = $("#mobileMode").val(), e.themeMode = $("#themeMode").val(),
    e.webDavUrl = nextWebDavUrl, e.trustedLocalOrigins = [...trustedOrigins], e.webDavUsername = $("#webDavUsername").val(),
    e.webDavPassword = await encryptCredential($("#webDavPassword").val()), e.missAvUrl = $("#missAvUrl").val().replace(/\/$/, ""),
    e.jableUrl = $("#jableUrl").val().replace(/\/$/, ""), e.avgleUrl = $("#avgleUrl").val().replace(/\/$/, ""),
    e.javTrailersUrl = $("#javTrailersUrl").val().replace(/\/$/, ""), e.av123Url = $("#av123Url").val().replace(/\/$/, ""),
    e.javDbUrl = $("#javDbUrl").val().replace(/\/$/, ""), e.javBusUrl = $("#javBusUrl").val().replace(/\/$/, ""),
    e.supJavUrl = $("#supJavUrl").val().replace(/\/$/, ""), e.enableTitleSelectFilter = $("#enableTitleSelectFilter").is(":checked") ? _ : C,
    e.enableFavoriteActresses = $("#enableFavoriteActresses").is(":checked") ? _ : C,
    e.enableSaveActressCarInfo = $("#enableSaveActressCarInfo").is(":checked") ? _ : C,
    e.enableScreenSvg = $("#enableScreenSvg").is(":checked") ? _ : C, e.enableVideoSvg = $("#enableVideoSvg").is(":checked") ? _ : C,
    e.enableHandleSvg = $("#enableHandleSvg").is(":checked") ? _ : C, e.enableSiteSvg = $("#enableSiteSvg").is(":checked") ? _ : C,
    e.enableCopySvg = $("#enableCopySvg").is(":checked") ? _ : C,
    e.enableLoadActressInfo = $("#enableLoadActressInfo").is(":checked") ? _ : C, e.enableVerticalModel = $("#enableVerticalModel").is(":checked") ? _ : C,
    e.containerColumns = Number($("#containerColumns").val()) || 5, e.containerWidth = Number($("#containerWidth").val()) + 70 || 100;
    // 6.5: only the dirty fields are written, and they are merged by SettingsService onto the freshly
    // re-read stored value (single write entry), so concurrent tabs or legacy writes are never clobbered.
    const previous = /** @type {Readonly<Record<string, unknown>>} */ (dependencies.settings.snapshot()), changedValues = /** @type {Record<string, unknown>} */ ({});
    for (const key of Object.keys(e)) if (e[key] !== previous[key]) changedValues[key] = e[key];
    if (Object.keys(changedValues).length) await dependencies.settings.patch(changedValues);
    /** @type {string[]} */
    let t = [];
    $("#reviewKeywordContainer .keyword-label").toArray().forEach((/** @type {Element} */ e) => {
        let n = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
        t.push(n);
    }), await storageManager.saveReviewFilterKeyword(t);
    /** @type {string[]} */
    let n = [];
    $("#filterKeywordContainer .keyword-label").toArray().forEach((/** @type {Element} */ e) => {
        let t = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
        n.push(t);
    }), await storageManager.saveTitleFilterKeyword(n), show.ok("保存成功"), await settingsEventBus.emit("filter-rules-changed", { scope: "title-keyword" });
    const a = dependencies.newVideo;
    a?.resetBtnTip?.(), dependencies.blacklist?.resetBtnTip?.(), dependencies.blacklist?.reloadTable?.();
}

/** Create a removable keyword label tag in the filter panel. */
/** @param {string} e @param {string} t */
function addLabelTag(e, t) {
    const n = $(`${e} .tag-box`);
    let a;
    /^[a-z]{2,}-/i.test(t) && r ? (a = $(`
                <a class="keyword-label keyword-label--link" data-keyword="${t}" href="/video_codes/${t.replace("-", "")}" target="_blank">
                    ${t}
                    <span class="keyword-remove">×</span>
                </a>
            `)) : a = $(`
                <div class="keyword-label" data-keyword="${t}">
                    ${t}
                    <span class="keyword-remove">×</span>
                </div>
            `),
    a.find(".keyword-remove").click(((/** @type {any} */ e) => {
        e.stopPropagation(), e.preventDefault();
        const t = $(e.currentTarget);
        const n = t.closest(".keyword-label").attr("data-keyword").split(" ")[0];
        utils.q(e, `是否移除屏蔽词  ${n}?`, (async () => {
            t.parent().remove();
        }));
    })), n.append(a);
}

/** Add a keyword from the input field to the tag box. */
/** @param {any} e @param {string} t */
function addKeyword(e, t) {
    let n = $(`${t} .keyword-input`);
    const a = n.val().trim();
    a && (addLabelTag(t, a), n.val(""));
}
