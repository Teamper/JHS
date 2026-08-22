/** Load all settings from storage into the main settings dialog form fields. */
async function loadSettingForm(getBean) {
    let e = await storageManager.getSetting();
    $("#videoQuality").val(e.videoQuality), $("#reviewCount").val(e.reviewCount || 20),
    $("#tagPosition").val(e.tagPosition || "rightTop"), $("#defaultQuickFilterTab").val(e.defaultQuickFilterTab || "waitCheck"), $("#needClosePageBasic").prop("checked", !e.needClosePage || e.needClosePage === _), $("#autoRemoveNewVideoMarkAfterBrowse").prop("checked", !!e.autoRemoveNewVideoMarkAfterBrowse && e.autoRemoveNewVideoMarkAfterBrowse === _), $("#waitCheckCount").val(e.waitCheckCount || 5),
    $("#checkConcurrencyCount").val(e.checkConcurrencyCount || 2), $("#checkRequestSleep").val(e.checkRequestSleep || 100),
    $("#enableCheckBlacklist").val(e.enableCheckBlacklist || _), $("#checkBlacklist_intervalTime").val(e.checkBlacklist_intervalTime || 12),
    $("#checkBlacklist_ruleTime").val(e.checkBlacklist_ruleTime || 8760), $("#enableCheckFavoriteActress").val(e.enableCheckFavoriteActress || _),
    $("#checkFavoriteActress_IntervalTime").val(e.checkFavoriteActress_IntervalTime || 24),
    $("#enableCheckNewVideo").val(e.enableCheckNewVideo || _), $("#checkNewVideo_intervalTime").val(e.checkNewVideo_intervalTime || 12),
    $("#checkNewVideo_ruleTime").val(e.checkNewVideo_ruleTime || 8760);
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
    $("#showFilterItem").prop("checked", !!e.showFilterItem && e.showFilterItem === _),
    $("#showFilterActorItem").prop("checked", !!e.showFilterActorItem && e.showFilterActorItem === _),
    $("#showFilterKeywordItem").prop("checked", !!e.showFilterKeywordItem && e.showFilterKeywordItem === _),
    $("#showFavoriteItem").prop("checked", !e.showFavoriteItem || e.showFavoriteItem === _),
    $("#showHasDownItem").prop("checked", !e.showHasDownItem || e.showHasDownItem === _),
    $("#showHasWatchItem").prop("checked", !e.showHasWatchItem || e.showHasWatchItem === _),
    $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
    $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
    $("#containerColumns").val(e.containerColumns || 5), $("#showContainerColumns").text(e.containerColumns || 5),
    $("#containerWidth").val((e.containerWidth || 100) - 70), $("#showContainerWidth").text((e.containerWidth || 100) + "%");
    const a = getBean("OtherSitePlugin"), i = await a.getMissAvUrl(), s = await a.getjableUrl(), o = await a.getAvgleUrl(), r = await a.getJavTrailersUrl(), l = await a.getAv123Url(), c = await a.getJavDbUrl(), d = await a.getJavBusUrl(), h = await a.getSupJavUrl();
    $("#missAvUrl").val(i), $("#jableUrl").val(s), $("#avgleUrl").val(o), $("#javTrailersUrl").val(r),
    $("#av123Url").val(l), $("#javDbUrl").val(c), $("#javBusUrl").val(d), $("#supJavUrl").val(h);
    let g = await storageManager.getReviewFilterKeywordList(), p = await storageManager.getTitleFilterKeyword();
    g && g.forEach((e => {
        addLabelTag("#reviewKeywordContainer", e);
    })), p && p.forEach((e => {
        addLabelTag("#filterKeywordContainer", e);
    })), [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((e => {
        $(`${e} .add-tag-btn`).on("click", (t => addKeyword(t, e))), $(`${e} .keyword-input`).on("keypress", (t => {
            "Enter" === t.key && addKeyword(t, e);
        }));
    }));
    bindLayoutRangeEvents();
}

/** Bind the shared layout range controls without accumulating handlers. */
function bindLayoutRangeEvents() {
    $("#containerColumns").off(".jhsSetting").on("input.jhsSetting", (() => {
        const columns = $("#containerColumns").val();
        $("#showContainerColumns").text(columns);
        const movieList = document.querySelector(".movie-list"), masonry = document.querySelector(".masonry");
        movieList && (movieList.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`);
        masonry && (masonry.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`);
    })).on("change.jhsSetting", (async event => {
        await storageManager.saveSettingItem("containerColumns", $(event.currentTarget).val()), await applyImageMode();
    }));
    $("#containerWidth").off(".jhsSetting").on("input.jhsSetting", (event => {
        const width = parseInt($(event.target).val()) + 70, widthText = `${width}%`;
        $("#showContainerWidth").text(widthText);
        const javdbContainer = document.querySelector("section .container"), javbusContainer = document.querySelector(".container-fluid .row");
        javdbContainer && (javdbContainer.style.minWidth = widthText);
        javbusContainer && (javbusContainer.style.minWidth = widthText);
    })).on("change.jhsSetting", (event => storageManager.saveSettingItem("containerWidth", parseInt($(event.currentTarget).val()) + 70)));
}

/** Initialize quick settings in either the desktop popover or mobile layer. */
async function initQuickSettingForm(getBean, getSelector, openSettingDialogFn) {
    let e = await storageManager.getSetting();
    $("#needClosePage").prop("checked", !e.needClosePage || e.needClosePage === _),
    $("#autoPage").prop("checked", !e.autoPage || e.autoPage === _), $("#translateTitle").prop("checked", !e.translateTitle || e.translateTitle === _),
    $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
    $("#enableLoadOtherSite").prop("checked", !e.enableLoadOtherSite || e.enableLoadOtherSite === _),
    $("#showFilterItem").prop("checked", !!e.showFilterItem && e.showFilterItem === _),
    $("#showFilterActorItem").prop("checked", !!e.showFilterActorItem && e.showFilterActorItem === _),
    $("#showFilterKeywordItem").prop("checked", !!e.showFilterKeywordItem && e.showFilterKeywordItem === _),
    $("#showFavoriteItem").prop("checked", !e.showFavoriteItem || e.showFavoriteItem === _),
    $("#showHasDownItem").prop("checked", !e.showHasDownItem || e.showHasDownItem === _),
    $("#showHasWatchItem").prop("checked", !e.showHasWatchItem || e.showHasWatchItem === _),
    $("#showFilterItem").on("change", (async t => {
        let n = $("#showFilterItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showFilterItem", n), window.refresh();
    })), $("#showFilterActorItem").on("change", (async t => {
        let n = $("#showFilterActorItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showFilterActorItem", n), window.refresh();
    })), $("#showFilterKeywordItem").on("change", (async t => {
        let n = $("#showFilterKeywordItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showFilterKeywordItem", n), window.refresh();
    })), $("#showFavoriteItem").on("change", (async t => {
        let n = $("#showFavoriteItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showFavoriteItem", n), window.refresh();
    })), $("#showHasDownItem").on("change", (async t => {
        let n = $("#showHasDownItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showHasDownItem", n), window.refresh();
    })), $("#showHasWatchItem").on("change", (async t => {
        let n = $("#showHasWatchItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showHasWatchItem", n), window.refresh();
    }));
    const t = $("#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasDownItem, #showHasWatchItem"), n = () => {
        const e = $("#showAllItem").is(":checked");
        t.prop("disabled", e), e ? t.attr("data-tip", "请先关闭显示所有才可点击") : t.removeAttr("data-tip");
    };
    $("#showAllItem").prop("checked", !!e.showAllItem && e.showAllItem === _), $("#showAllItem").on("change", (async t => {
        let a = $("#showAllItem").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("showAllItem", a), n(), window.refresh();
    })), n(), $("#needClosePage").on("change", (async t => {
        await storageManager.saveSettingItem("needClosePage", $("#needClosePage").is(":checked") ? _ : C),
        window.refresh();
    })), $("#autoPage").on("change", (async t => {
        const n = $("#autoPage").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("autoPage", n), $("#sort-toggle-btn").prop("disabled", n === _).attr("title", n === _ ? "瀑布流模式仅支持默认排序" : "选择列表排序方式");
    })), $("#translateTitle").on("change", (async t => {
        const n = $("#translateTitle").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("translateTitle", n), n === _ ? (await getBean("ListPagePlugin").doFilter(),
        isDetailPage && await getBean("TranslatePlugin").translate()) : (await getBean("ListPagePlugin").revertTranslation(),
        $(".translated-title").remove());
    })), $("#hoverBigImg").prop("checked", !!e.hoverBigImg && e.hoverBigImg === _),
    $("#hoverBigImg").on("change", (async t => {
        const n = $("#hoverBigImg").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("hoverBigImg", n), window.imageHoverPreviewObj && (window.imageHoverPreviewObj.destroy(),
        window.imageHoverPreviewObj = null), n === _ && (window.imageHoverPreviewObj = new ImageHoverPreview({
            selector: getSelector().coverImgSelector
        }));
    })), $("#enableLoadActressInfo").on("change", (async t => {
        const n = $("#enableLoadActressInfo").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadActressInfo", n), n === _ ? getBean("ActressInfoPlugin").loadActressInfo() : $(".actress-info").remove();
    })), $("#enableLoadOtherSite").on("change", (async t => {
        const n = $("#enableLoadOtherSite").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadOtherSite", n), n === _ ? await getBean("OtherSitePlugin").loadOtherSite() : $("#otherSiteBox").remove();
    })), $("#enableLoadScreenShot").prop("checked", !e.enableLoadScreenShot || e.enableLoadScreenShot === _),
    $("#enableLoadScreenShot").on("change", (async t => {
        const n = $("#enableLoadScreenShot").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadScreenShot", n), n === _ ? await getBean("ScreenShotPlugin").loadScreenShot() : $(".screen-container").remove();
    })), $("#enableLoadPreviewVideo").prop("checked", !e.enableLoadPreviewVideo || e.enableLoadPreviewVideo === _),
    $("#enableLoadPreviewVideo").on("change", (async t => {
        const n = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadPreviewVideo", n);
    })), $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
    $("#enableVerticalModel").on("change", (async t => {
        const n = $("#enableVerticalModel").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableVerticalModel", n), applyImageMode();
    })), $("#moreBtn").on("click", (() => {
        $(".simple-setting, .mini-simple-setting").html("").hide(), openSettingDialogFn("base-panel");
    }));
}

/** Read all form values and save to storage. */
async function saveSettingForm(getBean) {
    let e = await storageManager.getSetting();
    e.videoQuality = $("#videoQuality").val(), e.reviewCount = $("#reviewCount").val(),
    e.tagPosition = $("#tagPosition").val(), e.defaultQuickFilterTab = $("#defaultQuickFilterTab").val(), e.needClosePage = $("#needClosePageBasic").is(":checked") ? _ : C, e.autoRemoveNewVideoMarkAfterBrowse = $("#autoRemoveNewVideoMarkAfterBrowse").is(":checked") ? _ : C, e.waitCheckCount = $("#waitCheckCount").val(), e.highlightedTagNumber = $("#highlightedTagNumber").val(),
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
    e.webDavUrl = $("#webDavUrl").val(), e.webDavUsername = $("#webDavUsername").val(),
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
    e.showFilterItem = $("#showFilterItem").is(":checked") ? _ : C, e.showFilterActorItem = $("#showFilterActorItem").is(":checked") ? _ : C,
    e.showFilterKeywordItem = $("#showFilterKeywordItem").is(":checked") ? _ : C, e.showFavoriteItem = $("#showFavoriteItem").is(":checked") ? _ : C,
    e.showHasDownItem = $("#showHasDownItem").is(":checked") ? _ : C, e.showHasWatchItem = $("#showHasWatchItem").is(":checked") ? _ : C,
    e.enableLoadActressInfo = $("#enableLoadActressInfo").is(":checked") ? _ : C, e.enableVerticalModel = $("#enableVerticalModel").is(":checked") ? _ : C,
    e.containerColumns = Number($("#containerColumns").val()) || 5, e.containerWidth = Number($("#containerWidth").val()) + 70 || 100,
    await storageManager.saveSetting(e);
    let t = [];
    $("#reviewKeywordContainer .keyword-label").toArray().forEach((e => {
        let n = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
        t.push(n);
    })), await storageManager.saveReviewFilterKeyword(t);
    let n = [];
    $("#filterKeywordContainer .keyword-label").toArray().forEach((e => {
        let t = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
        n.push(t);
    })), await storageManager.saveTitleFilterKeyword(n), show.ok("保存成功"), window.refresh();
    const a = getBean("NewVideoPlugin");
    a && a.resetBtnTip(), getBean("BlacklistPlugin").resetBtnTip(), getBean("BlacklistPlugin").reloadTable();
}

/** Create a removable keyword label tag in the filter panel. */
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
    a.find(".keyword-remove").click((e => {
        e.stopPropagation(), e.preventDefault();
        const t = $(e.currentTarget);
        const n = t.closest(".keyword-label").attr("data-keyword").split(" ")[0];
        utils.q(e, `是否移除屏蔽词  ${n}?`, (async () => {
            t.parent().remove();
        }));
    })), n.append(a);
}

/** Add a keyword from the input field to the tag box. */
function addKeyword(e, t) {
    let n = $(`${t} .keyword-input`);
    const a = n.val().trim();
    a && (addLabelTag(t, a), n.val(""));
}
