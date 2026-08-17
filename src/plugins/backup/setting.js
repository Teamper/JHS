class SettingPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "folderName", "JHS-数据备份"), i(this, "resourceSettings", new ResourceSettingsService()), i(this, "pendingCarImport", null), i(this, "cacheItems", [ {
            key: "jhs_dmm_video",
            text: "预览视频缓存",
            title: "预览视频缓存"
        }, {
            key: "jhs_other_site",
            text: "第三方站点缓存",
            title: "第三方站点资源检测结果, 如missav,123Av等"
        }, {
            key: "jhs_screenShot",
            text: "缩略图缓存",
            title: "缩略图缓存"
        }, {
            key: "jhs_translate",
            text: "标题翻译",
            title: "标题翻译"
        }, {
            key: "jhs_actress_info",
            text: "演员信息",
            title: "演员的年龄三围等数据信息"
        }, {
            key: "jhs_score_info",
            text: "Top250|热播 评分数据",
            title: "Top250及热播的评分数据"
        }, {
            key: "third_party_ttl_cache",
            text: "第三方TTL缓存",
            title: "评论、相关清单、磁力搜索、缩略图等请求缓存"
        }, {
            key: "_circuitBreaker",
            text: "熔断状态",
            title: "各站点的熔断计数和状态"
        }, {
            key: "_domainStats",
            text: "域名请求统计",
            title: "各域名的请求次数和错误统计"
        } ]);
    }
    getName() {
        return "SettingPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        let t = (null == e ? void 0 : e.containerWidth) ?? "100";
        utils.isMobileMode() && (t = "100");
        let n = utils.isMobileMode() ? 1 : (null == e ? void 0 : e.containerColumns) ?? 5;
        window.getBeanForSetting = this.getBean.bind(this);
        applyImageMode().catch((e => clog.error("[JHS] applyImageMode failed:", e)));
        return buildSettingCss(t, n, l, r);
    }
    async handle() {
        await storageManager.getSetting("enableClog", _) === _ && clog.show();
        if (utils.isMobileMode()) return;
        if (r) {
            let e = function() {
                $(".navbar-search").is(":hidden") ? ($(".mini-setting-box").hide(), $(".setting-box").show()) : ($(".mini-setting-box").show(),
                $(".setting-box").hide());
            };
            $("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box jhs-setting-nav-item">\n                    <button type="button" id="setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-nav-button">\n                        设置\n                    </button>\n                    <div class="simple-setting"></div>\n                </div>'),
            utils.loopDetector((() => $("#miniHistoryBtn").length > 0), (() => {
                $(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box jhs-mini-setting-box">\n                        <button type="button" id="mini-setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-mini-setting-trigger">\n                            设置\n                        </button>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '),
                e();
            })), $(window).resize(e);
        }
        l && (isDetailPage ? $("h3").before('\n                    <div class="container-fluid jhs-setting-detail-anchor">\n                        <div id="top-right-box" class="jhs-setting-anchor">\n                            <div class="setting-box">\n                                <button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark">\n                                    <span>设置</span>\n                                </button>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ') : window.isListPage && utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            $("#waitCheckBtn").parent().append('\n                    <div id="top-right-box" class="jhs-setting-anchor">\n                        <div class="setting-box">\n                            <button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark">\n                                <span>设置</span>\n                            </button>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ');
        }), 1, 1e4, !1)),
        $(".main-nav, .container-fluid").on("click", "#setting-btn, #mini-setting-btn", (() => {
            $(".simple-setting, .mini-simple-setting").html("").hide(), clog.lowZIndex(), void this.openSettingDialog().catch((error => clog.error("设置中心打开失败", error)));
        })), $(".main-nav, .container-fluid").on("mouseenter", ".setting-box", (async () => {
            $(".simple-setting").html(buildQuickSettingHtml()).show();
            try { await initQuickSettingForm(this.getBean.bind(this), this.getSelector.bind(this), this.openSettingDialog.bind(this)); } catch (error) { clog.warn("桌面快捷设置初始化失败", error); }
            clog.lowZIndex();
        })).on("mouseleave", ".setting-box", (() => {
            $(".simple-setting").html("").hide();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".mini-setting-box", (async () => {
            $(".mini-simple-setting").html(buildQuickSettingHtml()).show();
            try { await initQuickSettingForm(this.getBean.bind(this), this.getSelector.bind(this), this.openSettingDialog.bind(this)); } catch (error) { clog.warn("迷你快捷设置初始化失败", error); }
            clog.lowZIndex();
        })).on("mouseleave", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html("").hide();
        }));
    }
    /** Open shared quick settings in the mobile bottom sheet. */
    async openQuickSetting() {
        $("#jhs-quick-setting-backdrop, #jhs-quick-setting-sheet").remove();
        const previousFocus = document.activeElement;
        let closed = !1;
        const closeQuickSetting = (restoreFocus = !0) => {
            if (closed) return;
            closed = !0, $(document).off("keydown.jhsQuickSetting"), $("#jhs-quick-setting-backdrop, #jhs-quick-setting-sheet").remove();
            restoreFocus && previousFocus?.isConnected && "function" == typeof previousFocus.focus && previousFocus.focus();
        };
        const backdrop = $('<div id="jhs-quick-setting-backdrop" class="jhs-quick-setting-backdrop"></div>');
        const sheet = $(`<section id="jhs-quick-setting-sheet" class="jhs-quick-setting-sheet jhs-ui" role="dialog" aria-modal="true" aria-labelledby="jhs-quick-setting-title">
            <header class="jhs-quick-setting__header"><h2 id="jhs-quick-setting-title">快捷设置</h2><button type="button" class="jhs-btn jhs-btn--ghost jhs-quick-setting__close" aria-label="关闭快捷设置">×</button></header>
            <div class="jhs-quick-setting"></div>
        </section>`);
        sheet.find(".jhs-quick-setting").html(buildQuickSettingHtml()), $("body").append(backdrop, sheet), clog.lowZIndex();
        backdrop.on("click.jhsQuickSetting", (() => closeQuickSetting())), sheet.on("click.jhsQuickSetting", ".jhs-quick-setting__close", (() => closeQuickSetting())),
        $(document).off("keydown.jhsQuickSetting").on("keydown.jhsQuickSetting", (event => {
            if ("Escape" === event.key) return event.preventDefault(), closeQuickSetting();
            if ("Tab" !== event.key) return;
            const focusable = sheet.find('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])').filter(((index, element) => !element.hidden && "true" !== element.getAttribute("aria-hidden")));
            if (!focusable.length) return void event.preventDefault();
            const first = focusable[0], last = focusable[focusable.length - 1];
            event.shiftKey && document.activeElement === first ? (event.preventDefault(), last.focus()) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), first.focus());
        }));
        try {
            await initQuickSettingForm(this.getBean.bind(this), this.getSelector.bind(this), (panel => {
                closeQuickSetting(!1), void this.openSettingDialog(panel).catch((error => clog.error("完整设置打开失败", error)));
            })), sheet.find(".jhs-quick-setting__close").trigger("focus");
        } catch (error) {
            closeQuickSetting(), clog.error("快捷设置初始化失败", error), show.error("快捷设置加载失败");
        }
    }
    async openSettingDialog(e = "backup-panel", t) {
        const a = this.getBean("CoverButtonPlugin");
        const s = buildSettingDialogHtml(e, this.cacheItems, a);
        layer.open({
            type: 1,
            title: "设置",
            content: s,
            area: utils.getDialogArea("lg"),
            scrollbar: !1,
            success: async (e, n) => {
                $(e).find(".layui-layer-content").css("position", "relative"), injectHealthPanel(), injectPluginMgmtPanel(), injectSnapshotPanel(), injectNetworkPanel(), injectResourceSourcesPanel(), await loadSettingForm(this.getBean.bind(this)), await this.loadResourceSettings(),
                JhsSelect.enhance(e), this.bindClick(), $(".side-menu-item.active").attr("aria-current", "page"), utils.setupEscClose(n), t && t();
                if (utils.isMobileMode()) {
                    this.collapseAdvancedTabs();
                }
            },
            end: () => {
                this.getBean("CoverButtonPlugin").enableSvgBtn();
            }
        });
    }
    collapseAdvancedTabs() {
        const advancedPanels = [
            { id: "health-panel", label: "数据体检", render: renderDataHealthPanel },
            { id: "plugin-mgmt-panel", label: "插件管理", render: renderPluginMgmtPanel },
            { id: "snapshot-panel", label: "恢复点", render: renderSnapshotPanel },
            { id: "network-panel", label: "外部请求", render: renderNetworkPanel }
        ];
        const sidebar = $(".jhs-mobile-sidebar");
        const contentParent = $(".content-panel").parent();
        if (!sidebar.length || !contentParent.length) return;
        advancedPanels.forEach(p => {
            sidebar.find(`[data-panel="${p.id}"]`).remove();
        });
        if (!sidebar.find('[data-panel="more-tools-panel"]').length) {
            sidebar.append('<button type="button" class="jhs-btn side-menu-item" data-panel="more-tools-panel" aria-controls="more-tools-panel">更多工具</button>');
        }
        if ($("#more-tools-panel").length) return;
        let subTabsHtml = advancedPanels.map((p, i) =>
            `<button type="button" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? "0" : "-1"}" class="jhs-btn jhs-sub-tab${i === 0 ? " active" : ""}" data-sub-panel="${p.id}">${p.label}</button>`
        ).join("");
        let subPanelsHtml = advancedPanels.map((p, i) =>
            `<div id="sub-${p.id}" class="jhs-sub-panel${i === 0 ? " active" : ""}" data-rendered="false"></div>`
        ).join("");
        const wrapperHtml = `
            <div id="more-tools-panel" class="content-panel jhs-more-tools-panel">
                <div class="jhs-sub-tabs" role="tablist" aria-label="更多工具">${subTabsHtml}</div>
                <div class="jhs-sub-panels">${subPanelsHtml}</div>
            </div>
        `;
        contentParent.append(wrapperHtml);
        advancedPanels.forEach(p => {
            const src = $(`#${p.id}`);
            if (src.length) {
                src.children().appendTo(`#sub-${p.id}`);
                src.remove();
                $(`#sub-${p.id}`).attr("data-rendered", "true");
            }
        });
        sidebar.on("click", '[data-panel="more-tools-panel"]', function() {
            $(".side-menu-item").removeClass("active").attr("aria-current", "false"), $(this).addClass("active").attr("aria-current", "page"), $(".content-panel").hide();
            $("#more-tools-panel").show(), $("#saveBtn").show(), $("#clean-all").addClass("jhs-is-hidden");
        });
        $("#more-tools-panel").on("click", ".jhs-sub-tab", function() {
            const target = $(this).data("sub-panel");
            $("#more-tools-panel .jhs-sub-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
            $(this).addClass("active").attr({ "aria-selected": "true", tabindex: "0" });
            $("#more-tools-panel .jhs-sub-panel").removeClass("active");
            $(`#sub-${target}`).addClass("active");
            if ($(`#sub-${target}`).attr("data-rendered") !== "true") {
                $(`#sub-${target}`).attr("data-rendered", "true");
            }
            const panel = advancedPanels.find(p => p.id === target);
            if (panel && panel.render) {
                panel.render();
            }
        }).on("keydown", ".jhs-sub-tab", function(e) {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(e.key)) return;
            e.preventDefault();
            const tabs = $("#more-tools-panel .jhs-sub-tab"), current = tabs.index(this);
            const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : e.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
            tabs.eq(next).trigger("click").trigger("focus");
        });
    }
    bindClick() {
        const settingPlugin = this;
        $(".side-menu-item").on("click", (function() {
            $(".side-menu-item").removeClass("active").attr("aria-current", "false"), $(this).addClass("active").attr("aria-current", "page"), $(".content-panel").hide();
            const e = $(this).data("panel");
            $("#" + e).show(), "cache-panel" === e ? ($("#saveBtn").hide(), $("#clean-all").removeClass("jhs-is-hidden")) : ($("#saveBtn").show(),
            $("#clean-all").addClass("jhs-is-hidden")), "health-panel" === e && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderDataHealthPanel()),
            "plugin-mgmt-panel" === e && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderPluginMgmtPanel()),
            "snapshot-panel" === e && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderSnapshotPanel()),
            "network-panel" === e && ($("#saveBtn").hide(), $("#clean-all").addClass("jhs-is-hidden"), renderNetworkPanel());
        })), $("#importBtn").on("click", (e => importSettingData(showDiffPreview))), $("#exportBtn").on("click", (e => exportSettingData())),
        $("#preview-car-number-import").on("click", (() => this.previewCarNumbers())), $("#confirm-car-number-import").on("click", (async e => this.confirmCarNumbers(e))),
        $("#webdavBackupBtn").on("click", (e => backupDataByWebDav(this.folderName))), $("#webdavBackupListBtn").on("click", (e => backupListBtnByWebDav(this.folderName, (files, client, label) => openFileListDialog(files, client, label, this.folderName, showDiffPreview)))),
        $("#saveBtn").on("click", (() => saveSettingForm(this.getBean.bind(this)))), $("#runHealthCheckBtn").on("click", (() => renderDataHealthPanel())),
        $("#repairHealthBtn").on("click", (e => {
            utils.q(e, "修复前会自动下载备份，是否继续?", (() => repairDataHealthWithBackup()));
        })), $("#pm-clear-log").on("click", (() => {
            unsafeWindow.pluginManager.clearErrorLog(), $("#plugin-error-log").text("无错误记录"), show.ok("错误日志已清空");
        })), $("#createSnapshotBtn").on("click", (async () => {
            let e = loading();
            try {
                await storageManager.createSnapshot("手动快照", "manual"), show.ok("快照创建成功"), renderSnapshotPanel();
            } catch (t) {
                clog.error(t), show.error("创建快照失败: " + t.message);
            } finally { e.close(); }
        })), $(".clean-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key"), n = this.cacheItems.find((e => e.key === t));
            t === storageManager.third_party_cache_key ? await storageManager.clearThirdPartyCache() : "_circuitBreaker" === t ? gmHttp.resetAllCircuitBreakers() : "_domainStats" === t ? gmHttp.clearDomainStats() : localStorage.removeItem(t),
            show.ok(`${n.text} 清理成功`), $("#cache-data-display").addClass("jhs-is-hidden"),
            "jhs_dmm_video" === t && localStorage.removeItem("jhs_other_site_dmm");
        })), $("#clean-all").on("click", (async () => {
            this.cacheItems.forEach((e => localStorage.removeItem(e.key))), show.ok("全部缓存已清理"),
            $("#cache-data-display").addClass("jhs-is-hidden"), localStorage.removeItem("jhs_other_site_dmm"), await storageManager.clearThirdPartyCache();
        })), $(".view-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key");
            let n;
            if (t === storageManager.third_party_cache_key) n = JSON.stringify(await storageManager.getThirdPartyCache());
            else if ("_circuitBreaker" === t) n = JSON.stringify(gmHttp.getCircuitBreakerStatus());
            else if ("_domainStats" === t) n = JSON.stringify(gmHttp.getDomainStats());
            else n = localStorage.getItem(t);
            const a = $("#cache-data-display"), i = a.find("pre");
            if (a.removeClass("jhs-is-hidden"), n) try {
                const e = JSON.parse(n);
                i.text(JSON.stringify(e, null, 2));
            } catch {
                i.text(n);
            } else i.text("无数据");
        }));
        const e = $("#highlightedTagNumber"), t = $("#highlightedTagColor"), n = $("#highlightedTagLabel");
        function a() {
            const a = e.val(), i = t.val();
            n.css("border", `${a}px solid ${i}`);
        }
        e.on("input", a), t.on("input", a);
        $("#themeMode").on("change", (async function() {
            await storageManager.saveSettingItem("themeMode", $(this).val()), applyTheme();
        }));
    }
    async loadResourceSettings() {
        const [custom, tags, filters, builtInOverrides, screenshot, cloud] = await Promise.all([this.resourceSettings.getMagnetSources(), this.resourceSettings.getMagnetTagRules(), this.resourceSettings.getMagnetFilterRules(), this.resourceSettings.getBuiltInSources(), this.resourceSettings.getScreenshotSettings(), this.resourceSettings.getCloudSettings()]);
        this.resourceState = { custom, tags, filters, builtIn: BUILT_IN_MAGNET_SOURCES.map((source => ({ ...source, ...(builtInOverrides.find((item => item.id === source.id)) || {}) }))), screenshot: { mode: screenshot.mode, providers: BUILT_IN_SCREENSHOT_SOURCES.map((source => { const merged = { ...source, ...(screenshot.providers.find((item => item.id === source.id)) || {}) }; return false === source.implemented ? { ...merged, enabled: false } : merged; })) } };
        this.renderResourceSettings(); $("#enable115Offline").prop("checked", cloud.enable115Offline); $("#enable115Match").prop("checked", cloud.enable115Match); $("#oneOneFiveConcurrency").val(cloud.concurrency); $("#oneOneFiveCacheMinutes").val(cloud.cacheMinutes); if (cloud.enable115Offline || cloud.enable115Match) this.checkOneOneFiveLogin();
        $("#cloud-services-panel input").off("change.jhsResource").on("change.jhsResource", (() => this.saveCloudSettings())); $("#resource-sources-panel").off("change.jhsResource", 'input[name="screenshotMode"]').on("change.jhsResource", 'input[name="screenshotMode"]', (event => { this.resourceState.screenshot.mode = event.currentTarget.value; this.resourceSettings.saveScreenshotSettings(this.resourceState.screenshot); }));
        $("#add-custom-magnet-source").off("click.jhsResource").on("click.jhsResource", (() => this.openSourceDialog())); $("#add-magnet-tag-rule").off("click.jhsResource").on("click.jhsResource", (() => this.openRuleDialog("tag"))); $("#add-magnet-filter-rule").off("click.jhsResource").on("click.jhsResource", (() => this.openRuleDialog("filter")));
        $("#export-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => $("#advanced-resource-json").val(JSON.stringify(await this.resourceSettings.exportConfig(), null, 2)).prop("readonly", true))); $("#edit-resource-config").off("click.jhsResource").on("click.jhsResource", (() => $("#advanced-resource-json").prop("readonly", false).trigger("focus"))); $("#import-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => { try { await this.resourceSettings.importConfig($("#advanced-resource-json").val()); show.ok("资源配置导入成功"); await this.loadResourceSettings(); } catch (error) { show.error(error.message); } }));
        $("#car-number-import,#car-number-import-status").off("input.jhsResource change.jhsResource").on("input.jhsResource change.jhsResource", (() => { this.pendingCarImport = null; $("#confirm-car-number-import").prop("disabled", true).text("确认导入"); }));
        $("#check-one-one-five-login").off("click.jhsResource").on("click.jhsResource", (() => this.checkOneOneFiveLogin()));
    }
    renderResourceSettings() {
        const card = (source, custom, kind) => { const node = $('<article class="jhs-card jhs-resource-card"></article>'); node.append($('<div class="jhs-setting-row"></div>').append($('<div></div>').append($("<strong></strong>").text(source.name), source.experimental ? '<span class="jhs-badge">实验性</span>' : "", $("<small></small>").text(`${source.type || "截图来源"} · ${source.domain || (() => { try { return new URL(source.searchUrlTemplate).hostname; } catch { return "未配置域名"; } })()} · 优先级 ${source.priority}`)), $('<input type="checkbox" class="mini-switch jhs-source-toggle">').prop("checked", source.enabled))); const actions = $('<div class="jhs-toolbar"></div>').append('<button type="button" class="jhs-btn jhs-source-test">测试</button>'); if (custom) actions.append('<button type="button" class="jhs-btn jhs-source-edit">编辑</button><button type="button" class="jhs-btn jhs-btn--danger jhs-source-delete">删除</button>'); node.append(actions); node.on("change", ".jhs-source-toggle", async event => { source.enabled = event.currentTarget.checked; "screenshot" === kind ? await this.resourceSettings.saveScreenshotSettings(this.resourceState.screenshot) : custom ? await this.resourceSettings.saveMagnetSources(this.resourceState.custom) : await this.resourceSettings.saveBuiltInSources(this.resourceState.builtIn); }); node.on("click", ".jhs-source-test", event => this.testSource(event.currentTarget, source.baseUrl || source.searchUrlTemplate?.replace("{keyword}", "test"))); custom && node.on("click", ".jhs-source-edit", (() => this.openSourceDialog(source))).on("click", ".jhs-source-delete", (event => utils.q(event, `确认删除来源「${source.name}」？`, (async () => { this.resourceState.custom = this.resourceState.custom.filter((item => item.id !== source.id)); await this.resourceSettings.saveMagnetSources(this.resourceState.custom); this.renderResourceSettings(); })))); return node; };
        $("#builtin-magnet-source-list").empty().append(this.resourceState.builtIn.map((source => card(source, false, "magnet")))); $("#custom-magnet-source-list").empty().append(this.resourceState.custom.length ? this.resourceState.custom.map((source => card(source, true, "magnet"))) : '<p class="jhs-setting-help">暂无自定义来源</p>'); $("#screenshot-source-list").empty().append(this.resourceState.screenshot.providers.map((source => card(source, false, "screenshot")))); this.resourceState.screenshot.providers.forEach(((source, index) => { if (false === source.implemented) $("#screenshot-source-list .jhs-resource-card").eq(index).find(".jhs-source-toggle").prop("disabled", true).end().find("strong").after('<span class="jhs-badge">未实现</span>').end().find(".jhs-source-test").remove(); })); $(`input[name="screenshotMode"][value="${this.resourceState.screenshot.mode}"]`).prop("checked", true); this.renderRules("tag"); this.renderRules("filter");
    }
    renderRules(kind) { const list = "tag" === kind ? this.resourceState.tags : this.resourceState.filters, host = $("#magnet-" + kind + "-rule-list").empty(); if (!list.length) host.append('<p class="jhs-setting-help">暂无规则</p>'); list.forEach((rule => { const node = $('<article class="jhs-card"></article>').append($("<strong></strong>").text(rule.name), $("<p></p>").text(`${"regex" === rule.type ? "正则" : "包含"}：${rule.pattern}${"tag" === kind ? ` · 权重 ${Number(rule.weight) >= 0 ? "+" : ""}${rule.weight || 0}` : ` · ${"hide" === rule.action ? "隐藏" : `降权 ${rule.penalty || -20}`}`}`), '<div class="jhs-toolbar"><button class="jhs-btn jhs-rule-edit">编辑</button><button class="jhs-btn jhs-btn--danger jhs-rule-delete">删除</button></div>'); node.on("click", ".jhs-rule-edit", (() => this.openRuleDialog(kind, rule))).on("click", ".jhs-rule-delete", (event => utils.q(event, `确认删除规则「${rule.name}」？`, (async () => { const key = "tag" === kind ? "tags" : "filters"; this.resourceState[key] = this.resourceState[key].filter((item => item.id !== rule.id)); await ("tag" === kind ? this.resourceSettings.saveMagnetTagRules(this.resourceState[key]) : this.resourceSettings.saveMagnetFilterRules(this.resourceState[key])); this.renderRules(kind); })))); host.append(node); })); }
    openSourceDialog(existing = null) { const fields = ["rowSelector","titleSelector","magnetSelector","sizeSelector","dateSelector","seedersSelector","leechersSelector","resultsPath","titlePath","magnetPath","hashPath","sizePath","datePath","seedersPath"]; const content = $(`<div class="jhs-setting-section jhs-resource-form"><label>名称<input name="name" class="jhs-field"></label><label>启用<input name="enabled" type="checkbox" class="mini-switch"></label><label>优先级<input name="priority" type="number" class="jhs-field" min="1"></label><label>搜索地址模板<input name="searchUrlTemplate" class="jhs-field"></label><label>原网页地址模板<input name="targetUrlTemplate" class="jhs-field"></label><label>解析类型<select name="parserType" class="jhs-select-source"><option value="magnet-links">自动寻找磁力链接</option><option value="torrent-table">表格/列表页面</option><option value="json">JSON API</option></select></label><div class="jhs-parser-fields"></div></div>`); const renderFields = () => { const type = content.find('[name="parserType"]').val(), names = "torrent-table" === type ? fields.slice(0, 7) : "json" === type ? fields.slice(7) : []; content.find(".jhs-parser-fields").html(names.map((name => `<label>${name}<input name="${name}" class="jhs-field"></label>`)).join("")); names.forEach((name => content.find(`[name="${name}"]`).val(existing?.[name] || ""))); }; Object.entries(existing || { enabled: true, priority: 100, parserType: "magnet-links" }).forEach(([key, value]) => { const input = content.find(`[name="${key}"]`); "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value); }); content.on("change", '[name="parserType"]', renderFields); renderFields(); content.appendTo("body").hide(); layer.open({ type: 1, title: existing ? "编辑自定义磁力源" : "添加自定义磁力源", content, area: utils.getDialogArea("md"), btn: ["保存", "取消"], success: () => content.show(), end: () => content.remove(), yes: async index => { const form = Object.fromEntries(content.find("input,select").map(((i, element) => [element.name, "checkbox" === element.type ? element.checked : element.value])).get()); try { const source = buildCustomMagnetSource(form, existing); const target = existing ? this.resourceState.custom.findIndex((item => item.id === existing.id)) : -1; target >= 0 ? this.resourceState.custom.splice(target, 1, source) : this.resourceState.custom.push(source); await this.resourceSettings.saveMagnetSources(this.resourceState.custom); layer.close(index); this.renderResourceSettings(); } catch (error) { show.error(error.message); } } }); }
    openRuleDialog(kind, existing = null) { const isTag = "tag" === kind, content = $(`<div class="jhs-setting-section"><label>名称<input name="name" class="jhs-field"></label>${isTag ? "" : '<label>匹配范围<select name="target" class="jhs-select-source"><option value="title">标题</option><option value="file">文件名</option></select></label>'}<label>匹配方式<select name="type" class="jhs-select-source"><option value="contains">包含</option><option value="regex">正则</option></select></label><label>匹配内容<input name="pattern" class="jhs-field"></label>${isTag ? '<label>权重<input name="weight" type="number" class="jhs-field"></label>' : '<label>动作<select name="action" class="jhs-select-source"><option value="hide">隐藏</option><option value="penalty">降权</option></select></label><label>降权分数<input name="penalty" type="number" class="jhs-field"></label>'}<label>启用<input name="enabled" type="checkbox" class="mini-switch"></label></div>`); Object.entries(existing || { enabled: true, type: "contains", weight: 0, action: "hide", penalty: -20 }).forEach(([key, value]) => { const input = content.find(`[name="${key}"]`); "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value); }); content.appendTo("body").hide(); layer.open({ type: 1, title: `${existing ? "编辑" : "新建"}${isTag ? "标签" : "过滤"}规则`, content, area: utils.getDialogArea("sm"), btn: ["保存", "取消"], success: () => content.show(), end: () => content.remove(), yes: async index => { const rule = Object.fromEntries(content.find("input,select").map(((i, element) => [element.name, "checkbox" === element.type ? element.checked : element.value])).get()); rule.id = existing?.id || `rule-${Date.now()}`; rule.weight = Number(rule.weight); rule.penalty = Number(rule.penalty); try { validateRule(rule); const key = isTag ? "tags" : "filters", target = existing ? this.resourceState[key].findIndex((item => item.id === existing.id)) : -1; target >= 0 ? this.resourceState[key].splice(target, 1, rule) : this.resourceState[key].push(rule); await (isTag ? this.resourceSettings.saveMagnetTagRules(this.resourceState[key]) : this.resourceSettings.saveMagnetFilterRules(this.resourceState[key])); layer.close(index); this.renderRules(kind); } catch (error) { show.error(error.message); } } }); }
    async saveCloudSettings() { await this.resourceSettings.saveCloudSettings({ enable115Offline: $("#enable115Offline").is(":checked"), enable115Match: $("#enable115Match").is(":checked"), concurrency: Number($("#oneOneFiveConcurrency").val()), cacheMinutes: Number($("#oneOneFiveCacheMinutes").val()) }); }
    async checkOneOneFiveLogin() { const badge = $("#one-one-five-state").text("检测中"); try { badge.text(await new OneOneFiveClient().checkLogin() ? "已登录" : "未登录"); } catch { badge.text("检测失败"); } }
    async testSource(button, url) { if (!url) return show.info("本站来源无需跨站测试"); const node = $(button).prop("disabled", true), badge = node.siblings(".jhs-source-test-state").length ? node.siblings(".jhs-source-test-state") : $('<span class="jhs-badge jhs-source-test-state"></span>').insertAfter(node); badge.text("检测中"); try { const response = await gmHttp.get(url); badge.text(response ? "200 · 可解析" : "空响应"); } catch (error) { badge.text(error?._cfBlocked ? "Cloudflare 拦截" : error?.status === 404 ? "404" : error?._circuitBreaker ? "熔断" : "请求失败"); } finally { node.prop("disabled", false).text("测试"); } }
    previewCarNumbers() { const parsed = parseCarNumberText($("#car-number-import").val()), actionType = $("#car-number-import-status").val(); this.pendingCarImport = actionType && parsed.values.length ? { ...parsed, actionType } : null; $("#car-number-import-preview").text(`识别 ${parsed.recognized} 条 · 有效 ${parsed.values.length} · 重复 ${Math.max(0, parsed.recognized - parsed.values.length - parsed.invalid.length)} · 无效 ${parsed.invalid.length}${parsed.invalid.length ? ` · 异常示例：${parsed.invalid.slice(0, 5).join("、")}` : ""}`); $("#confirm-car-number-import").prop("disabled", !this.pendingCarImport).text(this.pendingCarImport ? `确认导入 ${parsed.values.length} 条` : "确认导入"); if (!actionType) show.info("请选择导入状态"); }
    async confirmCarNumbers(event) { if (!this.pendingCarImport) return show.info("请先解析预览"); const pending = this.pendingCarImport; utils.q(event, `确认导入 ${pending.values.length} 条记录？`, (async () => { const existing = new Map((await storageManager.getCarList()).map((item => [item.carNum, item]))), summary = { added: 0, updated: 0, failed: 0 }; for (const carNum of pending.values) try { await storageManager.saveCar({ ...(existing.get(carNum) || {}), carNum, url: existing.get(carNum)?.url || buildFallbackCarUrl(carNum), names: existing.get(carNum)?.names || "", actionType: pending.actionType, publishTime: existing.get(carNum)?.publishTime || "" }); existing.has(carNum) ? summary.updated++ : summary.added++; } catch (error) { summary.failed++; clog.warn(`番号 ${carNum} 导入失败`, error); } this.pendingCarImport = null; $("#confirm-car-number-import").prop("disabled", true); show.ok(`导入完成：新增 ${summary.added}，更新 ${summary.updated}，失败 ${summary.failed}`); }));
    }
}
