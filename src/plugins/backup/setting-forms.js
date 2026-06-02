/** Load all settings from storage into the main settings dialog form fields. */
async function loadSettingForm(getBean) {
    let e = await storageManager.getSetting();
    $("#videoQuality").val(e.videoQuality), $("#reviewCount").val(e.reviewCount || 20),
    $("#tagPosition").val(e.tagPosition || "rightTop"), $("#waitCheckCount").val(e.waitCheckCount || 5),
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
    $("#httpTimeout").val(e.httpTimeout || 5e3), $("#httpRetryCount").val(e.httpRetryCount || 3),
    $("#webDavUrl").val(e.webDavUrl || ""), $("#webDavUsername").val(e.webDavUsername || ""),
    $("#webDavPassword").val(await decryptCredential(e.webDavPassword) || ""), $("#enableTitleSelectFilter").prop("checked", !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _),
    $("#enableFavoriteActresses").prop("checked", !e.enableFavoriteActresses || e.enableFavoriteActresses === _),
    $("#enableSaveActressCarInfo").prop("checked", !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _),
    $("#enableScreenSvg").prop("checked", !e.enableScreenSvg || e.enableScreenSvg === _),
    $("#enableVideoSvg").prop("checked", !e.enableVideoSvg || e.enableVideoSvg === _),
    $("#enableHandleSvg").prop("checked", !e.enableHandleSvg || e.enableHandleSvg === _),
    $("#enableSiteSvg").prop("checked", !e.enableSiteSvg || e.enableSiteSvg === _),
    $("#enableCopySvg").prop("checked", !e.enableCopySvg || e.enableCopySvg === _);
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
}

/** Initialize the hover quick-settings form with current values and bind event handlers. */
async function initSimpleSettingForm(getBean, getSelector, openSettingDialogFn) {
    let e = await storageManager.getSetting();
    $("#containerColumns").val(e.containerColumns || 5), $("#showContainerColumns").text(e.containerColumns || 5),
    $("#containerWidth").val((e.containerWidth || 100) - 70), $("#showContainerWidth").text((e.containerWidth || 100) + "%"),
    $("#needClosePage").prop("checked", !e.needClosePage || e.needClosePage === _),
    $("#autoPage").prop("checked", !e.autoPage || e.autoPage === _), $("#translateTitle").prop("checked", !e.translateTitle || e.translateTitle === _),
    $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
    $("#enableLoadOtherSite").prop("checked", !e.enableLoadOtherSite || e.enableLoadOtherSite === _),
    $("#containerColumns").on("input", (async t => {
        let n = $("#containerColumns").val();
        if ($("#showContainerColumns").text(n), r) {
            document.querySelector(".movie-list").style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
        }
        if (l) {
            document.querySelector(".masonry").style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
        }
        await storageManager.saveSettingItem("containerColumns", n), applyImageMode();
    })), $("#containerWidth").on("input", (async t => {
        let n = parseInt($(t.target).val());
        const a = n + 70 + "%";
        if ($("#showContainerWidth").text(a), r) {
            document.querySelector("section .container").style.minWidth = a;
        }
        if (l) {
            document.querySelector(".container-fluid .row").style.minWidth = a;
        }
        storageManager.saveSettingItem("containerWidth", n + 70);
    })), $("#showFilterItem").prop("checked", !!e.showFilterItem && e.showFilterItem === _),
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
        await storageManager.saveSettingItem("autoPage", n), n === _ ? $("#sort-toggle-btn").hide() : $("#sort-toggle-btn").show();
    })), $("#translateTitle").on("change", (async t => {
        const n = $("#translateTitle").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("translateTitle", n), n === _ ? (await getBean("ListPagePlugin").doFilter(),
        isDetailPage && await getBean("TranslatePlugin").translate()) : (await getBean("ListPagePlugin").revertTranslation(),
        $(".translated-title").remove());
    })), $("#hoverBigImg").prop("checked", !!e.hoverBigImg && e.hoverBigImg === _),
    $("#hoverBigImg").on("change", (async t => {
        const n = $("#hoverBigImg").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("hoverBigImg", n), n === _ ? window.imageHoverPreviewObj = new ImageHoverPreview({
            selector: getSelector().coverImgSelector
        }) : window.imageHoverPreviewObj && window.imageHoverPreviewObj.destroy();
    })), $("#enableLoadActressInfo").on("change", (async t => {
        const n = $("#enableLoadActressInfo").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadActressInfo", n), n === _ ? getBean("ActressInfoPlugin").loadActressInfo() : $(".actress-info").remove();
    })), $("#enableLoadOtherSite").on("change", (async t => {
        const n = $("#enableLoadOtherSite").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadOtherSite", n), n === _ ? getBean("OtherSitePlugin").loadOtherSite().then() : $("#otherSiteBox").remove();
    })), $("#enableLoadScreenShot").prop("checked", !e.enableLoadScreenShot || e.enableLoadScreenShot === _),
    $("#enableLoadScreenShot").on("change", (async t => {
        const n = $("#enableLoadScreenShot").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadScreenShot", n), n === _ ? getBean("ScreenShotPlugin").loadScreenShot().then() : $(".screen-container").remove();
    })), $("#enableLoadPreviewVideo").prop("checked", !e.enableLoadPreviewVideo || e.enableLoadPreviewVideo === _),
    $("#enableLoadPreviewVideo").on("change", (async t => {
        const n = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableLoadPreviewVideo", n);
    })), $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
    $("#enableVerticalModel").on("change", (async t => {
        const n = $("#enableVerticalModel").is(":checked") ? _ : C;
        await storageManager.saveSettingItem("enableVerticalModel", n), applyImageMode();
    })), $("#moreBtn").on("click", (() => {
        $(".simple-setting").html("").hide(), openSettingDialogFn("base-panel");
    })), $("#helpBtn").on("click", (() => {
        layer.open({
            type: 1,
            title: "",
            shadeClose: !0,
            scrollbar: !1,
            content: '\n<style>\n    .help-container {\n        font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;\n        color: #333;\n        padding: 15px;\n        max-height: 100%;\n        overflow-y: auto;\n    }\n    \n    .help-section {\n        margin-bottom: 25px;\n    }\n    \n    .help-section summary {\n        font-size: 18px;\n        color: #3498db;\n        margin-bottom: 12px;\n        cursor: pointer;\n    }\n    \n    .help-content {\n        background-color: #f9f9f9;\n        border-radius: 5px;\n        padding: 15px;\n        border-left: 4px solid #3498db;\n    }\n    \n    .help-content p {\n        line-height: 1.6;\n        margin-bottom: 10px;\n    }\n    .help-section img {\n        max-width: 100%;\n        height: auto;\n        border: 1px solid #ddd;\n        border-radius: 4px;\n        box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n    }\n\n</style>\n\n<div class="help-container">\n    <h1 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">使用说明</h1>\n    \n    <details class="help-section">\n        <summary>1. 无法查看预览视频，提示分流?</summary>\n        <div class="help-content">\n            <p>JavDB限制日本IP的访问，而预览视频来自DMM，需要日本IP才能访问。</p>\n            <p>这样会导致二者无法同时使用，需要对其一进行代理转发。</p>\n            <p>将 cc3001.dmm.co.jp 及 dmm.co 分流到日本ip。</p>\n            <p><a href="https://youtu.be/wQUK8z_YeU4?t=121" target="_blank">Clash Verge分流规则设置 </a> (如果你是别的代理软件，自行搜索如何分流)</p>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>2. 如何屏蔽某一系列的番号?</summary>\n        <div class="help-content">\n            <p>方法一：设置中-添加视频标题关键词，如: VENX-</p>\n            <p>方法二：进入详情页，选中标题文字，右键可加入</p>\n            <img src="https://i.imgur.com/lVnhK5A.png" alt="进入详情页，选中标题，进行右键"/>\n        </div>\n    </details>\n\n    <details class="help-section">\n        <summary>3. 屏蔽某演员，如何只屏蔽单体影片?</summary>\n        <div class="help-content">\n            <p>屏蔽演员前，先筛选分类，再点屏蔽</p>\n            <img src="https://imgur.com/Ue7eCAi.png" alt="屏蔽演员前，先筛选分类，再点屏蔽"/>\n        </div>\n    </details>\n    \n    \n</div>\n',
            area: utils.getResponsiveArea([ "50%", "90%" ])
        });
    }));
}

/** Read all form values and save to storage. */
async function saveSettingForm(getBean) {
    let e = await storageManager.getSetting();
    e.videoQuality = $("#videoQuality").val(), e.reviewCount = $("#reviewCount").val(),
    e.tagPosition = $("#tagPosition").val(), e.waitCheckCount = $("#waitCheckCount").val(), e.highlightedTagNumber = $("#highlightedTagNumber").val(),
    e.highlightedTagColor = $("#highlightedTagColor").val(), e.checkConcurrencyCount = $("#checkConcurrencyCount").val(),
    e.checkRequestSleep = $("#checkRequestSleep").val(), e.enableCheckBlacklist = $("#enableCheckBlacklist").val(),
    e.checkBlacklist_intervalTime = $("#checkBlacklist_intervalTime").val(), e.checkBlacklist_ruleTime = $("#checkBlacklist_ruleTime").val(),
    e.enableCheckFavoriteActress = $("#enableCheckFavoriteActress").val(), e.checkFavoriteActress_IntervalTime = $("#checkFavoriteActress_IntervalTime").val(),
    e.enableCheckNewVideo = $("#enableCheckNewVideo").val(), e.checkNewVideo_intervalTime = $("#checkNewVideo_intervalTime").val(),
    e.checkNewVideo_ruleTime = $("#checkNewVideo_ruleTime").val(), e.httpTimeout = Number($("#httpTimeout").val()) || 5e3,
    e.httpRetryCount = Number($("#httpRetryCount").val()) || 3, e.circuitBreakerThreshold = Number($("#circuitBreakerThreshold").val()) || 3,
    e.circuitBreakerCooldown = Number($("#circuitBreakerCooldownSec").val()) * 1e3, e.enableClog = $("#enableClog").val(),
    e.enableClog === _ ? clog.show() : clog.hide(), e.clogMsgCount = $("#clogMsgCount").val(),
    e.mobileMode = $("#mobileMode").val(),
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
    e.enableCopySvg = $("#enableCopySvg").is(":checked") ? _ : C, await storageManager.saveSetting(e);
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
    let a, i = "#cbd5e1", s = "#333";
    /^[a-z]{2,}-/i.test(t) && r ? (s = "#3477ad", a = $(`
                <a class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}" href="/video_codes/${t.replace("-", "")}" target="_blank">
                    ${t}
                    <span class="keyword-remove">×</span>
                </a>
            `)) : a = $(`
                <div class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}">
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
