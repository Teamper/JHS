class Ae extends X {
    constructor() {
        super(...arguments), i(this, "folderName", "JHS-数据备份"), i(this, "cacheItems", [ {
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
        let n = utils.isMobile() && window.innerWidth < 1e3 ? 1 : (null == e ? void 0 : e.containerColumns) ?? 5;
        window.getBeanForSetting = this.getBean.bind(this);
        applyImageMode().catch((e => console.error("[JHS] applyImageMode failed:", e)));
        return buildSettingCss(t, n, l, r);
    }
    async handle() {
        if (await storageManager.getSetting("enableClog", _) === _ && clog.show(), r) {
            let e = function() {
                $(".navbar-search").is(":hidden") ? ($(".mini-setting-box").hide(), $(".setting-box").show()) : ($(".mini-setting-box").show(),
                $(".setting-box").hide());
            };
            $("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box" style="position:relative;">\n                    <a id="setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-right:15px !important;">\n                        设置\n                    </a>\n                    <div class="simple-setting"></div>\n                </div>'),
            utils.loopDetector((() => $("#miniHistoryBtn").length > 0), (() => {
                $(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box" style="position:relative;margin-left: auto;">\n                        <a id="mini-setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-left:0 !important;padding-right:0 !important;">\n                            设置\n                        </a>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '),
                e();
            })), $(window).resize(e);
        }
        l && (utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            $("#waitCheckBtn").parent().append('\n                    <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                        <div class="setting-box">\n                            <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                <span>设置</span>\n                            </a>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ');
        }), 1, 1e4, !1), isDetailPage && $("h3").before('\n                    <div class="container-fluid" style="margin-top:20px">\n                        <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                            <div class="setting-box">\n                                <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                    <span>设置</span>\n                                </a>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ')),
        $(".main-nav, .container-fluid").on("click", "#setting-btn, #mini-setting-btn", (() => {
            clog.lowZIndex(), this.openSettingDialog();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".setting-box", (() => {
            $(".simple-setting").html(buildSimpleSettingHtml()).show(), initSimpleSettingForm(this.getBean.bind(this), this.getSelector.bind(this), this.openSettingDialog.bind(this)).then(),
            clog.lowZIndex();
        })).on("mouseleave", ".setting-box", (() => {
            $(".simple-setting").html("").hide();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html(buildSimpleSettingHtml()).show(), initSimpleSettingForm(this.getBean.bind(this), this.getSelector.bind(this), this.openSettingDialog.bind(this)).then(),
            clog.lowZIndex();
        })).on("mouseleave", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html("").hide();
        }));
    }
    async openSettingDialog(e = "backup-panel", t) {
        const a = this.getBean("CoverButtonPlugin");
        const s = buildSettingDialogHtml(e, this.cacheItems, a);
        layer.open({
            type: 1,
            title: "设置",
            content: s,
            area: utils.getResponsiveArea([ "55%", "90%" ]),
            scrollbar: !1,
            success: (e, n) => {
                $(e).find(".layui-layer-content").css("position", "relative"), injectHealthPanel(), injectPluginMgmtPanel(), injectSnapshotPanel(), injectNetworkPanel(), loadSettingForm(this.getBean.bind(this)),
                this.bindClick(), utils.setupEscClose(n), t && t();
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
            sidebar.append('<div class="side-menu-item" data-panel="more-tools-panel">更多工具</div>');
        }
        if ($("#more-tools-panel").length) return;
        let subTabsHtml = advancedPanels.map((p, i) =>
            `<div class="jhs-sub-tab${i === 0 ? " active" : ""}" data-sub-panel="${p.id}">${p.label}</div>`
        ).join("");
        let subPanelsHtml = advancedPanels.map((p, i) =>
            `<div id="sub-${p.id}" class="jhs-sub-panel${i === 0 ? " active" : ""}" data-rendered="false"></div>`
        ).join("");
        const wrapperHtml = `
            <div id="more-tools-panel" class="content-panel" style="display:none;">
                <div class="jhs-sub-tabs">${subTabsHtml}</div>
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
            $(".side-menu-item").removeClass("active"), $(this).addClass("active"), $(".content-panel").hide();
            $("#more-tools-panel").show(), $("#saveBtn").show(), $("#clean-all").hide();
        });
        $("#more-tools-panel").on("click", ".jhs-sub-tab", function() {
            const target = $(this).data("sub-panel");
            $("#more-tools-panel .jhs-sub-tab").removeClass("active");
            $(this).addClass("active");
            $("#more-tools-panel .jhs-sub-panel").removeClass("active");
            $(`#sub-${target}`).addClass("active");
            if ($(`#sub-${target}`).attr("data-rendered") !== "true") {
                $(`#sub-${target}`).attr("data-rendered", "true");
            }
            const panel = advancedPanels.find(p => p.id === target);
            if (panel && panel.render) {
                panel.render();
            }
        });
    }
    bindClick() {
        const settingPlugin = this;
        $(".side-menu-item").on("click", (function() {
            $(".side-menu-item").removeClass("active"), $(this).addClass("active"), $(".content-panel").hide();
            const e = $(this).data("panel");
            $("#" + e).show(), "cache-panel" === e ? ($("#saveBtn").hide(), $("#clean-all").show()) : ($("#saveBtn").show(),
            $("#clean-all").hide()), "health-panel" === e && ($("#saveBtn").hide(), $("#clean-all").hide(), renderDataHealthPanel()),
            "plugin-mgmt-panel" === e && ($("#saveBtn").hide(), $("#clean-all").hide(), renderPluginMgmtPanel()),
            "snapshot-panel" === e && ($("#saveBtn").hide(), $("#clean-all").hide(), renderSnapshotPanel()),
            "network-panel" === e && ($("#saveBtn").hide(), $("#clean-all").hide(), renderNetworkPanel());
        })), $("#importBtn").on("click", (e => importSettingData(showDiffPreview))), $("#exportBtn").on("click", (e => exportSettingData())),
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
                console.error(t), show.error("创建快照失败: " + t.message);
            } finally { e.close(); }
        })), $(".clean-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key"), n = this.cacheItems.find((e => e.key === t));
            t === storageManager.third_party_cache_key ? await storageManager.clearThirdPartyCache() : "_circuitBreaker" === t ? gmHttp.resetAllCircuitBreakers() : "_domainStats" === t ? gmHttp.clearDomainStats() : localStorage.removeItem(t),
            show.ok(`${n.text} 清理成功`), $("#cache-data-display").hide(),
            "jhs_dmm_video" === t && localStorage.removeItem("jhs_other_site_dmm");
        })), $("#clean-all").on("click", (async () => {
            this.cacheItems.forEach((e => localStorage.removeItem(e.key))), show.ok("全部缓存已清理"),
            $("#cache-data-display").hide(), localStorage.removeItem("jhs_other_site_dmm"), await storageManager.clearThirdPartyCache();
        })), $(".view-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key");
            let n;
            if (t === storageManager.third_party_cache_key) n = JSON.stringify(await storageManager.getThirdPartyCache());
            else if ("_circuitBreaker" === t) n = JSON.stringify(gmHttp.getCircuitBreakerStatus());
            else if ("_domainStats" === t) n = JSON.stringify(gmHttp.getDomainStats());
            else n = localStorage.getItem(t);
            const a = $("#cache-data-display"), i = a.find("pre");
            if (a.show(), n) try {
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
    }
}
