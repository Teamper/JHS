import { _, i, l, normalizeCarNum, r } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { buildFallbackCarUrl, parseCarNumberText } from "../../core/feature-helpers.js";
import { normalizeQuickFilterKey } from "../../features/list/list-filters.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { registerSettingsUiOwner } from "../../core/settings-ui-owner.js";
import { applyThemeMode } from "../../core/theme.js";
import { JhsSelect } from "../../core/ui-primitives.js";
import { BUILT_IN_NATIVE_MAGNET_SOURCES, ResourceSettingsService, buildCustomMagnetSource, validateRule } from "../../services/resource-settings-service.js";
import { BUILT_IN_SCREENSHOT_SOURCES } from "../../services/screenshot-sources.js";
import { backupDataByWebDav, backupListBtnByWebDav, exportSettingData, importSettingData, openFileListDialog } from "./setting-backup.js";
import { applyLayoutRangeValue, disposeQuickSettingHost, initQuickSettingForm, loadSettingForm, saveSettingForm } from "./setting-forms.js";
import { renderDataHealthPanel, renderNetworkPanel, renderPluginMgmtPanel, renderSnapshotPanel, repairDataHealthWithBackup, showDiffPreview } from "./setting-panels.js";
import { applyLayoutFromSettings, buildSettingCss } from "./setting-styles.js";
import { buildQuickSettingHtml, buildSettingDialogHtml, injectHealthPanel, injectNetworkPanel, injectPluginMgmtPanel, injectResourceSourcesPanel, injectSnapshotPanel } from "./setting-templates.js";
import { bindSettingControl } from "../../ui/settings/setting-binding-controller.js";
import { bindSettingRows, renderSettingRow } from "../../ui/settings/setting-control-renderer.js";

export class SettingPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "folderName", "JHS-数据备份"), i(this, "resourceSettings", new ResourceSettingsService()), i(this, "pendingCarImport", null), i(this, "taskStatusUnsubscribe", null),
i(this, "_desktopSettingNavMounted", !1), i(this, "_settingScope", null), i(this, "_settingNavResizeCleanup", null), i(this, "_desktopNavGeneration", 0), i(this, "_settingsDialogGeneration", 0), i(this, "_fullSettingBinding", null), i(this, "cacheItems", [ {
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
    async getFormDependencies() {
        let blacklist = null;
        try {
            blacklist = await this.getRuntimeService("features").getFeatureApi("library");
        } catch (error) {
            clog.warn("Library Feature API 不可用，跳过黑名单设置刷新", error);
        }
        return Object.freeze({
            otherSite: this.getOptionalDependency("OtherSitePlugin"),
            actressInfo: this.getOptionalDependency("ActressInfoPlugin"), screenshot: this.getOptionalDependency("ScreenShotPlugin"),
            newVideo: this.getOptionalDependency("NewVideoPlugin"), blacklist,
            busImg: this.getOptionalDependency("BusImgPlugin"), host: this.getRuntimeService("host"), movie: this.getRuntimeService("movie"), settings: this.getRuntimeService("settings"),
            settingsRegistry: this.getRuntimeService("settingsRegistry"),
        });
    }
    async initCss() {
        const e = this.getRuntimeService("settings").snapshot();
        let t = (null == e ? void 0 : e.containerWidth) ?? "100";
        utils.isMobileMode() && (t = "100");
        let n = utils.isMobileMode() ? 1 : (null == e ? void 0 : e.containerColumns) ?? 5;
        applyLayoutFromSettings(e, { busImgPlugin: this.getOptionalDependency("BusImgPlugin"), hostAdapter: this.getRuntimeService("host") }).catch((error => clog.error("[JHS] applyLayoutFromSettings failed:", error)));
        return buildSettingCss(t, n, l, r);
    }
    async handle() {
        const settings = this.getRuntimeService("settings");
        this.resourceSettings = new ResourceSettingsService({
            getSetting: async (key = null, fallback) => key === null ? settings.snapshot() : Object.prototype.hasOwnProperty.call(settings.snapshot(), key) ? settings.snapshot()[key] : fallback,
            saveSettingItem: (key, value) => settings.set(key, value),
            updateSetting: (mutator) => settings.update(mutator),
            patch: (values) => settings.patch(values),
        });
        await storageManager.getSetting("enableClog", _) === _ && clog.show();
        const scope = await this.getRuntimeService("scope")();
        this._settingScope = scope;
        // 6.5 live：UI 型设置立即应用（theme/layout），无需等待底部保存。
        const liveSettings = this.getRuntimeService("settings");
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names) || [];
            if (!names.length) return;
            if (names.includes("themeMode")) applyThemeMode(liveSettings.snapshot().themeMode);
            if (names.includes("enableClog")) {
                const value = liveSettings.snapshot().enableClog;
                if (value === "yes") clog.show();
                else clog.hide();
            }
            if (names.some((name) => [ "mobileMode", "enableVerticalModel", "containerColumns", "containerWidth" ].includes(name))) {
                void applyLayoutFromSettings(liveSettings.snapshot(), { busImgPlugin: this.getOptionalDependency("BusImgPlugin"), hostAdapter: this.getRuntimeService("host") }).catch((/** @type {unknown} */ error) => clog.error("布局设置应用失败", error));
            }
        };
        liveSettings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => liveSettings.removeEventListener("settings.changed", onSettingsChanged)));
        const openSettings = async (panel = "backup-panel") => {
            try { return await this.openSettingDialog(panel); }
            catch (error) { clog.error("设置中心打开失败", error), show.error("设置中心打开失败"); throw error; }
        };
        scope.addCleanup(registerSettingsUiOwner(openSettings));
        scope.listen(document, "click", (event => {
            const target = event.target instanceof Element ? event.target.closest("#setting-btn, #mini-setting-btn") : null;
            if (!target) return;
            event.preventDefault();
            $(".simple-setting, .mini-simple-setting").each((_, element) => disposeQuickSettingHost(element));
            clog.lowZIndex();
            void openSettings().catch((() => undefined));
        }));
        scope.addCleanup((() => this.unmountDesktopSettingNav()));
        this.syncDesktopSettingNav(this.getRuntimeService("profile").current() === "compact");
    }
    /** 桌面设置入口 Surface：compact 卸载，regular/wide 幂等挂载。 */
    /** @param {boolean} compact */
    syncDesktopSettingNav(compact) {
        if (compact) this.unmountDesktopSettingNav();
        else this.mountDesktopSettingNav();
    }
    mountDesktopSettingNav() {
        if (this._desktopSettingNavMounted) return;
        const scope = this._settingScope;
        if (!scope) return;
        this._desktopSettingNavMounted = true;
        // surface generation：unmount 后旧 timer/DOM 等待回调不得再把 nav append 回来。
        const generation = this._desktopNavGeneration;
        if (r) {
            let e = function() {
                $(".navbar-search").is(":hidden") ? ($(".mini-setting-box").hide(), $(".setting-box").show()) : ($(".mini-setting-box").show(),
                $(".setting-box").hide());
            };
            $("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box jhs-setting-nav-item">\n                    <button type="button" id="setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-nav-button">\n                        设置\n                    </button>\n                    <div class="simple-setting"></div>\n                </div>'),
            utils.loopDetector((() => $("#miniHistoryBtn").length > 0), (() => {
                if (generation !== this._desktopNavGeneration || !this._desktopSettingNavMounted) return;
                $(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box jhs-mini-setting-box">\n                        <button type="button" id="mini-setting-btn" class="jhs-btn navbar-link nav-btn jhs-nav-btn jhs-mini-setting-trigger">\n                            设置\n                        </button>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '),
                e();
            }), 20, 1e4, !0, scope);
            this._settingNavResizeCleanup?.();
            this._settingNavResizeCleanup = scope.listen(window, "resize", e);
        }
        l && (isDetailPage ? $("h3").before('\n                    <div class="container-fluid jhs-setting-detail-anchor">\n                        <div id="top-right-box" class="jhs-setting-anchor">\n                            <div class="setting-box">\n                                <button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark">\n                                    <span>设置</span>\n                                </button>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ') : window.isListPage && utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            if (generation !== this._desktopNavGeneration || !this._desktopSettingNavMounted) return;
            $("#waitCheckBtn").parent().append('\n                    <div id="top-right-box" class="jhs-setting-anchor">\n                        <div class="setting-box">\n                            <button type="button" id="setting-btn" class="jhs-btn jhs-btn--dark">\n                                <span>设置</span>\n                            </button>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ');
        }), 1, 1e4, !1, scope)),
        $(".main-nav, .container-fluid").off("mouseenter.jhsSettingQuick mouseleave.jhsSettingQuick").on("mouseenter.jhsSettingQuick", ".setting-box", (async (event) => {
            const host = $(event.currentTarget).find(".simple-setting");
            disposeQuickSettingHost(host);
            host.html(buildQuickSettingHtml(this.getRuntimeService("settingsRegistry"))).show();
            try { await initQuickSettingForm(await this.getFormDependencies(), this.getSelector.bind(this), this.openSettingDialog.bind(this), host); } catch (error) { clog.warn("桌面快捷设置初始化失败", error); }
            clog.lowZIndex();
        })).on("mouseleave.jhsSettingQuick", ".setting-box", ((event) => {
            disposeQuickSettingHost($(event.currentTarget).find(".simple-setting"));
        })).on("mouseenter.jhsSettingQuick", ".mini-setting-box", (async (event) => {
            const host = $(event.currentTarget).find(".mini-simple-setting");
            disposeQuickSettingHost(host);
            host.html(buildQuickSettingHtml(this.getRuntimeService("settingsRegistry"))).show();
            try { await initQuickSettingForm(await this.getFormDependencies(), this.getSelector.bind(this), this.openSettingDialog.bind(this), host); } catch (error) { clog.warn("迷你快捷设置初始化失败", error); }
            clog.lowZIndex();
        })).on("mouseleave.jhsSettingQuick", ".mini-setting-box", ((event) => {
            disposeQuickSettingHost($(event.currentTarget).find(".mini-simple-setting"));
        }));
    }
    unmountDesktopSettingNav() {
        this._desktopNavGeneration++;
        this._desktopSettingNavMounted = false;
        this._settingNavResizeCleanup?.();
        this._settingNavResizeCleanup = null;
        $(".simple-setting, .mini-simple-setting").each((_, element) => disposeQuickSettingHost(element));
        $(".jhs-setting-nav-item, .jhs-mini-setting-box, .jhs-setting-anchor, .jhs-setting-detail-anchor").remove();
        $(".main-nav, .container-fluid").off("mouseenter.jhsSettingQuick mouseleave.jhsSettingQuick");
    }
    /** Open shared quick settings in the mobile bottom sheet. */
    async openQuickSetting() {
        $("#jhs-quick-setting-backdrop, #jhs-quick-setting-sheet").remove();
        const previousFocus = document.activeElement;
        await this.getRuntimeService("settings").waitForIdle();
        let closed = !1;
        const closeQuickSetting = (restoreFocus = !0) => {
            if (closed) return;
            closed = !0, $(document).off("keydown.jhsQuickSetting");
            const quickRoot = $("#jhs-quick-setting-sheet .jhs-quick-setting");
            disposeQuickSettingHost(quickRoot);
            $("#jhs-quick-setting-backdrop, #jhs-quick-setting-sheet").remove();
            restoreFocus && previousFocus?.isConnected && "function" == typeof previousFocus.focus && previousFocus.focus();
        };
        const backdrop = $('<div id="jhs-quick-setting-backdrop" class="jhs-quick-setting-backdrop"></div>');
        const sheet = $(`<section id="jhs-quick-setting-sheet" class="jhs-quick-setting-sheet jhs-ui" role="dialog" aria-modal="true" aria-labelledby="jhs-quick-setting-title">
            <header class="jhs-quick-setting__header"><h2 id="jhs-quick-setting-title">快捷设置</h2><button type="button" class="jhs-btn jhs-btn--ghost jhs-quick-setting__close" aria-label="关闭快捷设置">×</button></header>
            <div class="jhs-quick-setting"></div>
        </section>`);
        const quickRoot = sheet.find(".jhs-quick-setting");
        quickRoot.html(buildQuickSettingHtml(this.getRuntimeService("settingsRegistry"))), $("body").append(backdrop, sheet), clog.lowZIndex();
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
            await initQuickSettingForm(await this.getFormDependencies(), this.getSelector.bind(this), (panel => {
                closeQuickSetting(!1), void this.openSettingDialog(panel).catch((error => clog.error("完整设置打开失败", error)));
            }), quickRoot), sheet.find(".jhs-quick-setting__close").trigger("focus");
        } catch (error) {
            closeQuickSetting(), clog.error("快捷设置初始化失败", error), show.error("快捷设置加载失败");
        }
    }
    async openSettingDialog(e = "backup-panel", t) {
        await this.getRuntimeService("settings").waitForIdle();
        const s = buildSettingDialogHtml(e, this.cacheItems);
        this.getRuntimeService("dialog").open({
            type: 1,
            title: "设置",
            content: s,
            area: utils.getDialogArea("lg"),
            scrollbar: !1,
            success: async (e, n) => {
                const generation = ++this._settingsDialogGeneration;
                const layerRoot = $(e);
                this._settingsFocusCleanup?.();
                this._settingsFocusCleanup = utils.trapFocus(layerRoot[0]);
                layerRoot.data("jhsSettingsGeneration", generation);
                layerRoot.find(".layui-layer-content").css("position", "relative");
                this.renderTaskStatuses(layerRoot);
                injectHealthPanel(), injectPluginMgmtPanel(), injectSnapshotPanel(), injectNetworkPanel(), injectResourceSourcesPanel();
                const binding = this.hydrateLiveSettings(layerRoot);
                this._fullSettingBinding = binding;
                this.bindClick(layerRoot);
                layerRoot.find(".side-menu-item.active").attr("aria-current", "page");
                utils.setupEscClose(n), t && t();
                this.renderTaskStatuses(layerRoot), this.taskStatusUnsubscribe?.(), this.taskStatusUnsubscribe = jhsEventBus.on("task-status-changed", (() => this.renderTaskStatuses(layerRoot)));
                if (utils.isMobileMode()) {
                    this.collapseAdvancedTabs(layerRoot);
                }
                const sections = await Promise.allSettled([ this.hydrateSettingForm(e, generation), this.loadResourceSettings(e, generation) ]), resourceResult = sections[1];
                JhsSelect.refreshAll(e);
                if (resourceResult.status === "rejected") {
                    clog.error("resource-settings 加载失败", resourceResult.reason), this.getRuntimeService("diagnostics").recordError({ source: "resource-settings", message: resourceResult.reason?.message || String(resourceResult.reason) }), show.error("资源设置加载失败，基本设置仍可保存");
                }
            },
            end: () => {
                this._settingsDialogGeneration++;
                this._fullSettingBinding?.dispose?.();
                this._fullSettingBinding = null;
                this._settingsFocusCleanup?.();
                this._settingsFocusCleanup = null;
                this.taskStatusUnsubscribe?.(), this.taskStatusUnsubscribe = null;
                this.getOptionalDependency("CoverButtonPlugin")?.enableSvgBtn?.();
            }
        });
    }
    /** 完整设置中由 descriptor 驱动的 live 开关：与快捷设置共用同一 key 与写入路径。 */
    /** @param {JQueryHandle | HTMLElement} layerRoot */
    hydrateLiveSettings(layerRoot) {
        const root = $(layerRoot);
        const host = root.find("#jhs-live-settings");
        const registry = this.getRuntimeService("settingsRegistry"), settings = this.getRuntimeService("settings"), hostAdapter = this.getRuntimeService("host");
        const staticKeys = new Set([ "needClosePage", "themeMode", "mobileMode", "enableClog", "containerColumns", "containerWidth" ]);
        const descriptors = registry.list({ surfaces: [ "full" ] }).filter((descriptor) => (descriptor.effect || "live") === "live" && !staticKeys.has(descriptor.key));
        if (host.length) {
            descriptors.forEach((descriptor) => {
                const { row } = renderSettingRow(descriptor, { value: settings.snapshot()[descriptor.key] ?? descriptor.defaultValue });
                host.append(row);
            });
        }
        const dynamicBinding = host.length ? bindSettingRows(host, descriptors, { settings }) : null;
        const staticBindings = [];
        const registerStatic = (/** @type {any} */ config) => {
            const binding = bindSettingControl({ settings, root, ...config });
            if (binding) staticBindings.push(binding);
        };
        registerStatic({
            selector: "#needClosePageBasic",
            key: "needClosePage",
            getValue: () => root.find("#needClosePageBasic").is(":checked") ? "yes" : "no",
            setValue: (value) => root.find("#needClosePageBasic").prop("checked", value === "yes" || value === true),
            fallback: "yes",
            label: "鉴定后立即关闭",
        });
        registerStatic({
            selector: "#themeMode",
            key: "themeMode",
            getValue: () => root.find("#themeMode").val(),
            setValue: (value) => root.find("#themeMode").val(String(value ?? "")),
            fallback: "light",
            label: "主题",
        });
        registerStatic({
            selector: "#mobileMode",
            key: "mobileMode",
            getValue: () => root.find("#mobileMode").val(),
            setValue: (value) => root.find("#mobileMode").val(String(value ?? "")),
            fallback: "auto",
            label: "移动模式",
        });
        registerStatic({
            selector: "#enableClog",
            key: "enableClog",
            getValue: () => root.find("#enableClog").val(),
            setValue: (value) => root.find("#enableClog").val(String(value ?? "")),
            fallback: "yes",
            label: "日志",
        });
        registerStatic({
            selector: "#containerColumns",
            key: "containerColumns",
            getValue: () => Number(root.find("#containerColumns").val()) || 5,
            setValue: (value) => applyLayoutRangeValue(root, hostAdapter, "containerColumns", value),
            fallback: 5,
            label: "列表列数",
        });
        registerStatic({
            selector: "#containerWidth",
            key: "containerWidth",
            getValue: () => Number(root.find("#containerWidth").val()) + 70,
            setValue: (value) => applyLayoutRangeValue(root, hostAdapter, "containerWidth", value),
            fallback: 100,
            label: "列表宽度",
        });
        registerStatic({
            selector: "#defaultQuickFilterTab",
            key: "defaultQuickFilterTab",
            getValue: () => normalizeQuickFilterKey(root.find("#defaultQuickFilterTab").val()),
            setValue: (value) => root.find("#defaultQuickFilterTab").val(String(value ?? "")),
            fallback: "waitCheck",
            label: "列表默认筛选",
        });
        if (!dynamicBinding && !staticBindings.length) return null;
        return {
            sync: (snapshot) => {
                dynamicBinding?.sync?.(snapshot);
                for (const binding of staticBindings) binding.sync?.(snapshot);
            },
            flush: async (options) => {
                await dynamicBinding?.flush?.(options);
                await Promise.all(staticBindings.map((binding) => binding.flush?.(options)));
            },
            dispose: () => {
                dynamicBinding?.dispose?.();
                for (const binding of staticBindings) binding.dispose();
            },
            setters: dynamicBinding?.setters ?? {},
        };
    }
    /** @param {JQueryHandle | HTMLElement} layerRoot @param {number} generation */
    async hydrateSettingForm(layerRoot, generation) {
        const button = $(layerRoot).find("#saveBtn"), status = $(layerRoot).find("#settings-hydration-status");
        button.attr("data-jhs-settings-ready", "false").prop("disabled", !0).attr("title", "正在加载设置…"), status.empty().text("正在加载设置…");
        const root = $(layerRoot);
        try {
            await loadSettingForm(await this.getFormDependencies(), root);
            if (!button[0]?.isConnected || generation !== this._settingsDialogGeneration || root.data("jhsSettingsGeneration") !== generation) return !1;
            JhsSelect.refreshAll(layerRoot), button.attr("data-jhs-settings-ready", "true").prop("disabled", !1).removeAttr("title"), status.empty().text("设置已加载");
            return !0;
        } catch (error) {
            if (!button[0]?.isConnected || generation !== this._settingsDialogGeneration || root.data("jhsSettingsGeneration") !== generation) return !1;
            clog.error("settings-form 加载失败", error), this.getRuntimeService("diagnostics").recordError({ source: "settings-form", message: error?.message || String(error) });
            const retry = $('<button type="button" class="jhs-btn jhs-btn--secondary">重试加载</button>').on("click", (() => void this.hydrateSettingForm(layerRoot, generation)));
            status.empty().append(document.createTextNode("表单加载失败，已禁止保存。"), retry), show.error("设置表单加载失败，保存已禁用");
            return !1;
        }
    }
    renderTaskStatuses(layerRoot = null) {
        const container = layerRoot ? $(layerRoot).find("#setting-task-status-list") : $("#setting-task-status-list");
        if (!container.length) return;
        const taskPlugin = this.getOptionalDependency("TaskPlugin");
        if (!taskPlugin?.getTaskStatusSnapshot) return void container.empty();
        const names = { blacklist: "黑名单", favoriteActress: "演员同步", newVideo: "新作品" }, labels = { idle: "正常", running: "运行中", pending: "等待下一次任务检查", due: "待运行" }, format = value => value ? new Date(value).toLocaleString() : "无";
        container.empty(), [ "blacklist", "favoriteActress", "newVideo" ].forEach((name => {
            const snapshot = taskPlugin.getTaskStatusSnapshot(name), row = $('<div class="jhs-setting-row jhs-task-setting-status"></div>');
            row.append($("<span class=\"setting-label\"></span>").text(`${names[name]}：${labels[snapshot.state]}`)), row.append($("<span class=\"form-content jhs-helper-text\"></span>").text(`上次完成 ${format(snapshot.completedAt)}；下次检查 ${snapshot.nextAt ? format(snapshot.nextAt) : "立即"}`)), container.append(row);
        }));
    }
    collapseAdvancedTabs(layerRoot = null) {
        const advancedPanels = [
            { id: "health-panel", label: "数据体检", render: () => renderDataHealthPanel(this.getRuntimeService("diagnostics")) },
            { id: "plugin-mgmt-panel", label: "插件管理", render: () => renderPluginMgmtPanel(this.getRuntimeService("diagnostics"), this.getRuntimeService("settings")) },
            { id: "snapshot-panel", label: "恢复点", render: renderSnapshotPanel },
            { id: "network-panel", label: "外部请求", render: () => renderNetworkPanel(this.getRuntimeService("diagnostics")) }
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
    bindClick(layerRoot = null) {
        const settingPlugin = this, webdav = this.getRuntimeService("webdav"), dialog = this.getRuntimeService("dialog"), diagnostics = this.getRuntimeService("diagnostics"), storage = this.getRuntimeService("storage"), translation = this.getRuntimeService("translation"), previewDiff = (diff, imported, restored = null) => showDiffPreview(diff, imported, restored, dialog);
        const root = layerRoot ? $(layerRoot) : $(document);
        root.find("#saveBtn").attr("data-jhs-settings-ready", "false").prop("disabled", !0).attr("title", "正在加载设置…");
        root.find(".side-menu-item").on("click", (function() {
            root.find(".side-menu-item").removeClass("active").attr("aria-current", "false"), $(this).addClass("active").attr("aria-current", "page"), root.find(".content-panel").hide();
            const panel = $(this).data("panel");
            root.find("#" + panel).show(), "cache-panel" === panel ? (root.find("#saveBtn").hide(), root.find("#clean-all").removeClass("jhs-is-hidden")) : (root.find("#saveBtn").show(),
            root.find("#clean-all").addClass("jhs-is-hidden")), "health-panel" === panel && (root.find("#saveBtn").hide(), root.find("#clean-all").addClass("jhs-is-hidden"), renderDataHealthPanel()),
            "plugin-mgmt-panel" === panel && (root.find("#saveBtn").hide(), root.find("#clean-all").addClass("jhs-is-hidden"), renderPluginMgmtPanel(settingPlugin.getRuntimeService("diagnostics"), settingPlugin.getRuntimeService("settings"))),
            "snapshot-panel" === panel && (root.find("#saveBtn").hide(), root.find("#clean-all").addClass("jhs-is-hidden"), renderSnapshotPanel()),
            "network-panel" === panel && (root.find("#saveBtn").hide(), root.find("#clean-all").addClass("jhs-is-hidden"), renderNetworkPanel(diagnostics));
        }));
        root.find("#importBtn").on("click", (e => importSettingData(previewDiff)));
        root.find("#exportBtn").on("click", (e => exportSettingData()));
        root.find("#preview-car-number-import").on("click", (() => this.previewCarNumbers(root)));
        root.find("#confirm-car-number-import").on("click", (async e => this.confirmCarNumbers(e, root)));
        root.find("#webdavBackupBtn").on("click", (e => backupDataByWebDav(this.folderName, webdav)));
        root.find("#webdavBackupListBtn").on("click", (e => backupListBtnByWebDav(this.folderName, (files, client, label) => openFileListDialog(files, client, label, this.folderName, previewDiff, dialog), webdav)));
        root.find("#saveBtn").on("click", (async event => {
            const button = $(event.currentTarget);
            if (button.data("jhsBusy") || "true" !== button.attr("data-jhs-settings-ready")) return;
            button.data("jhsBusy", !0).prop("disabled", !0).attr("aria-busy", "true");
            try {
                // Success toast must only appear after all pending live writes on
                // this Full settings surface have settled.
                await this._fullSettingBinding?.flush?.({ throwOnFailure: true });
                const result = await saveSettingForm(await this.getFormDependencies(), root);
                if (result?.canceled) return;
                show.ok("保存成功");
            } catch (error) {
                if (error?.partialFailure) show.error("部分设置保存失败，请重试");
                else show.error("设置保存失败");
                clog.error("设置保存失败", error);
            } finally {
                button.removeData("jhsBusy").prop("disabled", "true" !== button.attr("data-jhs-settings-ready")).removeAttr("aria-busy");
            }
        }));
        root.find("#runHealthCheckBtn").on("click", (() => renderDataHealthPanel()));
        root.find("#repairHealthBtn").on("click", (e => {
            utils.q(e, "修复前会自动下载备份，是否继续?", (() => repairDataHealthWithBackup()));
        }));
        root.find("#pm-clear-log").on("click", (() => {
            this.getRuntimeService("diagnostics").clearErrors(), root.find("#plugin-error-log").text("无错误记录"), show.ok("错误日志已清空");
        }));
        root.find("#createSnapshotBtn").on("click", (async () => {
            let loadingHandle = loading();
            try {
                await storageManager.createSnapshot("手动快照", "manual"), show.ok("快照创建成功"), renderSnapshotPanel();
            } catch (error) {
                clog.error(error), show.error("创建快照失败: " + error.message);
            } finally { loadingHandle.close(); }
        }));
        root.find(".clean-btn").on("click", (async e => {
            const key = $(e.currentTarget).data("key"), cacheItem = this.cacheItems.find((item => item.key === key));
            key === storageManager.third_party_cache_key ? await storageManager.clearThirdPartyCache() : "_circuitBreaker" === key ? diagnostics.resetAllCircuitBreakers() : "_domainStats" === key ? diagnostics.clearDomainStats() : "jhs_translate" === key ? await translation.clearCache() : storage.removeLocal(key);
            show.ok(`${cacheItem.text} 清理成功`), root.find("#cache-data-display").addClass("jhs-is-hidden");
            "jhs_dmm_video" === key && storage.removeLocal("jhs_other_site_dmm");
        }));
        root.find("#clean-all").on("click", (async () => {
            this.cacheItems.forEach((item => "jhs_translate" !== item.key && storage.removeLocal(item.key))), await translation.clearCache(), show.ok("全部缓存已清理");
            root.find("#cache-data-display").addClass("jhs-is-hidden"), storage.removeLocal("jhs_other_site_dmm"), await storageManager.clearThirdPartyCache();
        }));
        root.find(".view-btn").on("click", (async e => {
            const key = $(e.currentTarget).data("key");
            let raw;
            if (key === storageManager.third_party_cache_key) raw = JSON.stringify(await storageManager.getThirdPartyCache());
            else if ("_circuitBreaker" === key) raw = JSON.stringify(diagnostics.getNetworkDiagnostics().circuitBreakers);
            else if ("_domainStats" === key) raw = JSON.stringify(diagnostics.getNetworkDiagnostics().domainStats);
            else if ("jhs_translate" === key) raw = JSON.stringify(await translation.inspectCache());
            else raw = storage.getLocal(key);
            const display = root.find("#cache-data-display"), pre = display.find("pre");
            if (display.removeClass("jhs-is-hidden"), raw) try {
                const parsed = JSON.parse(raw);
                pre.text(JSON.stringify(parsed, null, 2));
            } catch {
                pre.text(raw);
            } else pre.text("无数据");
        }));
        const numberInput = root.find("#highlightedTagNumber"), colorInput = root.find("#highlightedTagColor"), labelPreview = root.find("#highlightedTagLabel");
        function updatePreview() {
            const count = numberInput.val(), color = colorInput.val();
            labelPreview.css("border", `${count}px solid ${color}`);
        }
        numberInput.on("input", updatePreview), colorInput.on("input", updatePreview);
        // Static live controls are bound through SettingBindingHub in
        // hydrateLiveSettings(); no direct settings.set() handlers here.
    }
    async loadResourceSettings(layerRoot = null, generation = this._settingsDialogGeneration) {
        const root = layerRoot ? $(layerRoot) : $(document);
        const [custom, tags, filters, builtInOverrides, screenshot, cloud] = await Promise.all([this.resourceSettings.getMagnetSources(), this.resourceSettings.getMagnetTagRules(), this.resourceSettings.getMagnetFilterRules(), this.resourceSettings.getBuiltInSources(), this.resourceSettings.getScreenshotSettings(), this.resourceSettings.getCloudSettings()]);
        if (layerRoot && (!root[0]?.isConnected || generation !== this._settingsDialogGeneration)) return;
        const builtInCatalog = [...BUILT_IN_NATIVE_MAGNET_SOURCES, ...this.getRuntimeService("magnet").getBuiltInSources()];
        this.resourceState = { custom, tags, filters, builtIn: builtInCatalog.map((source => ({ ...source, ...(builtInOverrides.find((item => item.id === source.id)) || {}) }))), screenshot: { mode: screenshot.mode, providers: BUILT_IN_SCREENSHOT_SOURCES.map((source => { const merged = { ...source, ...(screenshot.providers.find((item => item.id === source.id)) || {}) }; return false === source.implemented ? { ...merged, enabled: false } : merged; })) } };
        this.resourceCloudState = { enable123Offline: cloud.enable123Offline, enable115Offline: cloud.enable115Offline, enable115Match: cloud.enable115Match, enable115LoginRedirect: cloud.enable115LoginRedirect, providerMode: cloud.providerMode, concurrency: cloud.concurrency, cacheMinutes: cloud.cacheMinutes };
        this.renderResourceSettings(root);
        root.find("#enable123Offline").prop("checked", cloud.enable123Offline);
        root.find("#enable115Offline").prop("checked", cloud.enable115Offline);
        root.find("#offlineProviderMode").val(cloud.providerMode);
        root.find("#enable115Match").prop("checked", cloud.enable115Match);
        root.find("#enable115LoginRedirect").prop("checked", cloud.enable115LoginRedirect);
        root.find("#oneOneFiveConcurrency").val(cloud.concurrency);
        root.find("#oneOneFiveCacheMinutes").val(cloud.cacheMinutes);

        const applyCloudState = (/** @type {string} */ fieldKey, /** @type {any} */ state) => {
            if (fieldKey === "enable123Offline" || fieldKey === "enable115Offline" || fieldKey === "enable115Match" || fieldKey === "enable115LoginRedirect") root.find("#" + fieldKey).prop("checked", !!state[fieldKey]);
            else if (fieldKey === "offlineProviderMode") root.find("#offlineProviderMode").val(state.providerMode);
            else if (fieldKey === "oneOneFiveConcurrency") root.find("#oneOneFiveConcurrency").val(state.concurrency);
            else if (fieldKey === "oneOneFiveCacheMinutes") root.find("#oneOneFiveCacheMinutes").val(state.cacheMinutes);
        };
        root.find("#cloud-services-panel").off("change.jhsResource", "input, select").on("change.jhsResource", "input, select", (event => {
            const field = event.currentTarget;
            const key = field.id;
            let value;
            if ([ "enable123Offline", "enable115Offline", "enable115Match", "enable115LoginRedirect" ].includes(key)) value = field.checked;
            else if ("offlineProviderMode" === key) value = field.value;
            else if ("oneOneFiveConcurrency" === key) value = Number(field.value) || 4;
            else if ("oneOneFiveCacheMinutes" === key) value = Number(field.value) || 60;
            else return;
            const previous = { ...this.resourceCloudState };
            this.resourceCloudState = { ...this.resourceCloudState, [key === "offlineProviderMode" ? "providerMode" : key === "oneOneFiveConcurrency" ? "concurrency" : key === "oneOneFiveCacheMinutes" ? "cacheMinutes" : key]: value };
            void this.resourceSettings.saveCloudSetting(key, value).catch((error) => {
                this.resourceCloudState = previous;
                applyCloudState(key, previous);
                clog.error("云盘设置保存失败", error), show.error("云盘设置保存失败，已恢复原设置");
            });
        }));
        root.find("#resource-sources-panel").off("change.jhsResource", 'input[name="screenshotMode"]').on("change.jhsResource", 'input[name="screenshotMode"]', (event => {
            const previous = this.resourceState.screenshot.mode;
            this.resourceState.screenshot.mode = event.currentTarget.value;
            void this.resourceSettings.saveScreenshotMode(this.resourceState.screenshot.mode).catch((error) => {
                this.resourceState.screenshot.mode = previous;
                root.find(`input[name="screenshotMode"][value="${previous}"]`).prop("checked", true);
                clog.error("截图模式保存失败", error), show.error("截图模式保存失败，已恢复原设置");
            });
        }));
        root.find("#add-custom-magnet-source").off("click.jhsResource").on("click.jhsResource", (() => this.openSourceDialog(null, root)));
        root.find("#add-magnet-tag-rule").off("click.jhsResource").on("click.jhsResource", (() => this.openRuleDialog("tag", null, root)));
        root.find("#add-magnet-filter-rule").off("click.jhsResource").on("click.jhsResource", (() => this.openRuleDialog("filter", null, root)));
        root.find("#export-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => {
            const text = JSON.stringify(await this.resourceSettings.exportConfig(), null, 2);
            root.find("#advanced-resource-json").val(text).prop("readonly", true);
        }));
        root.find("#edit-resource-config").off("click.jhsResource").on("click.jhsResource", (() => root.find("#advanced-resource-json").prop("readonly", false).trigger("focus")));
        root.find("#import-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => {
            try {
                await this.resourceSettings.importConfig(root.find("#advanced-resource-json").val());
                show.ok("资源配置导入成功");
                await this.loadResourceSettings(root, generation);
                JhsSelect.refreshAll();
            } catch (error) { show.error(error.message); }
        }));
        root.find("#car-number-import,#car-number-import-status").off("input.jhsResource change.jhsResource").on("input.jhsResource change.jhsResource", (() => {
            this.pendingCarImport = null;
            root.find("#confirm-car-number-import").prop("disabled", true).text("确认导入");
        }));
        root.find("#check-one-one-five-login").off("click.jhsResource").on("click.jhsResource", (() => this.checkOneOneFiveLogin(root)));
    }
    renderResourceSettings(root = $(document)) {
        const card = (source, custom, kind) => {
            const node = $('<article class="jhs-card jhs-resource-card"></article>');
            node.append($('<div class="jhs-setting-row"></div>').append($('<div></div>').append($("<strong></strong>").text(source.name), source.experimental ? '<span class="jhs-badge">实验性</span>' : "", $("<small></small>").text(`${source.type || "截图来源"} · ${source.domain || (() => { try { return new URL(source.searchUrlTemplate).hostname; } catch { return "未配置域名"; } })()} · 优先级 ${source.priority}`)), $('<input type="checkbox" class="mini-switch jhs-source-toggle">').prop("checked", source.enabled)));
            const actions = $('<div class="jhs-toolbar"></div>').append('<button type="button" class="jhs-btn jhs-source-test">测试</button>');
            if (custom) actions.append('<button type="button" class="jhs-btn jhs-source-edit">编辑</button><button type="button" class="jhs-btn jhs-btn--danger jhs-source-delete">删除</button>');
            node.append(actions);
            node.on("change", ".jhs-source-toggle", async event => {
                const previous = !event.currentTarget.checked;
                source.enabled = event.currentTarget.checked;
                try {
                    if ("screenshot" === kind) {
                        await this.resourceSettings.updateArray("screenshotProviders", (list) => {
                            const found = list.find((item => item.id === source.id));
                            if (found) found.enabled = source.enabled;
                            else list.push({ id: source.id, enabled: source.enabled });
                            return list;
                        });
                    } else if (custom) {
                        await this.resourceSettings.updateArray("customMagnetSources", (list) => {
                            const found = list.find((item => item.id === source.id));
                            if (found) found.enabled = source.enabled;
                            return list;
                        });
                    } else {
                        await this.resourceSettings.updateArray("magnetBuiltInSources", (list) => {
                            const found = list.find((item => item.id === source.id));
                            if (found) found.enabled = source.enabled;
                            else list.push({ id: source.id, enabled: source.enabled });
                            return list;
                        });
                    }
                    this.renderResourceSettings(root);
                } catch (error) {
                    source.enabled = previous;
                    $(event.currentTarget).prop("checked", previous);
                    show.error("来源设置保存失败，已恢复原设置");
                }
            });
            node.on("click", ".jhs-source-test", event => this.testSource(event.currentTarget, source.baseUrl || source.searchUrlTemplate?.replace("{keyword}", "test"), { custom, source }));
            custom && node.on("click", ".jhs-source-edit", (() => this.openSourceDialog(source, root))).on("click", ".jhs-source-delete", (event => utils.q(event, `确认删除来源「${source.name}」？`, (async () => {
                try {
                    await this.resourceSettings.updateArray("customMagnetSources", (list) => list.filter((item => item.id !== source.id)));
                    this.resourceState.custom = await this.resourceSettings.getMagnetSources();
                    this.renderResourceSettings(root);
                } catch (error) { show.error(error.message); }
            }))));
            return node;
        };
        root.find("#builtin-magnet-source-list").empty().append(this.resourceState.builtIn.map((source => card(source, false, "magnet"))));
        root.find("#custom-magnet-source-list").empty().append(this.resourceState.custom.length ? this.resourceState.custom.map((source => card(source, true, "magnet"))) : '<p class="jhs-setting-help">暂无自定义来源</p>');
        root.find("#screenshot-source-list").empty().append(this.resourceState.screenshot.providers.map((source => card(source, false, "screenshot"))));
        this.resourceState.screenshot.providers.forEach(((source, index) => {
            if (false === source.implemented) root.find("#screenshot-source-list .jhs-resource-card").eq(index).find(".jhs-source-toggle").prop("disabled", true).end().find("strong").after('<span class="jhs-badge">未实现</span>').end().find(".jhs-source-test").remove();
        }));
        root.find(`input[name="screenshotMode"][value="${this.resourceState.screenshot.mode}"]`).prop("checked", true);
        this.renderRules("tag", root);
        this.renderRules("filter", root);
    }
    renderRules(kind, root = $(document)) {
        const list = "tag" === kind ? this.resourceState.tags : this.resourceState.filters, host = root.find("#magnet-" + kind + "-rule-list").empty();
        if (!list.length) host.append('<p class="jhs-setting-help">暂无规则</p>');
        list.forEach((rule => {
            const node = $('<article class="jhs-card"></article>').append($("<strong></strong>").text(rule.name), $("<p></p>").text(`${"regex" === rule.type ? "正则" : "包含"}：${rule.pattern}${"tag" === kind ? ` · 权重 ${Number(rule.weight) >= 0 ? "+" : ""}${rule.weight || 0}` : ` · ${"hide" === rule.action ? "隐藏" : `降权 ${rule.penalty || -20}`}`}`), '<div class="jhs-toolbar"><button class="jhs-btn jhs-rule-edit">编辑</button><button class="jhs-btn jhs-btn--danger jhs-rule-delete">删除</button></div>');
            node.on("click", ".jhs-rule-edit", (() => this.openRuleDialog(kind, rule, root))).on("click", ".jhs-rule-delete", (event => utils.q(event, `确认删除规则「${rule.name}」？`, (async () => {
                try {
                    await this.resourceSettings.updateArray("tag" === kind ? "magnetTagRules" : "magnetFilterRules", (list) => list.filter((item => item.id !== rule.id)));
                    this.resourceState["tag" === kind ? "tags" : "filters"] = await this.resourceSettings.getArray("tag" === kind ? "magnetTagRules" : "magnetFilterRules");
                    this.renderRules(kind, root);
                } catch (error) { show.error(error.message); }
            }))));
            host.append(node);
        }));
    }
    openSourceDialog(existing = null, root = null) {
        const dialog = this.getRuntimeService("dialog"), fields = ["rowSelector","titleSelector","magnetSelector","sizeSelector","dateSelector","seedersSelector","leechersSelector","resultsPath","titlePath","magnetPath","hashPath","sizePath","datePath","seedersPath"];
        const content = $(`<div class="jhs-setting-section jhs-resource-form"><label>名称<input name="name" class="jhs-field"></label><label>启用<input name="enabled" type="checkbox" class="mini-switch"></label><label>优先级<input name="priority" type="number" class="jhs-field" min="1"></label><label>搜索地址模板<input name="searchUrlTemplate" class="jhs-field"></label><label>原网页地址模板<input name="targetUrlTemplate" class="jhs-field"></label><label>解析类型<select name="parserType" class="jhs-select-source"><option value="magnet-links">自动寻找磁力链接</option><option value="torrent-table">表格/列表页面</option><option value="json">JSON API</option></select></label><div class="jhs-parser-fields"></div></div>`);
        const renderFields = () => {
            const type = content.find('[name="parserType"]').val(), names = "torrent-table" === type ? fields.slice(0, 7) : "json" === type ? fields.slice(7) : [];
            content.find(".jhs-parser-fields").html(names.map((name => `<label>${name}<input name="${name}" class="jhs-field"></label>`)).join(""));
            names.forEach((name => content.find(`[name="${name}"]`).val(existing?.[name] || "")));
        };
        Object.entries(existing || { enabled: true, priority: 100, parserType: "magnet-links" }).forEach(([key, value]) => {
            const input = content.find(`[name="${key}"]`);
            "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value);
        });
        content.on("change", '[name="parserType"]', renderFields), renderFields(), content.appendTo("body").hide();
        dialog.open({ type: 1, title: existing ? "编辑自定义磁力源" : "添加自定义磁力源", content, area: utils.getDialogArea("md"), btn: ["保存", "取消"], success: () => content.show(), end: () => content.remove(), yes: async index => {
            const form = Object.fromEntries(content.find("input,select").map(((i, element) => [element.name, "checkbox" === element.type ? element.checked : element.value])).get());
            try {
                const source = buildCustomMagnetSource(form, existing);
                await this.resourceSettings.updateArray("customMagnetSources", (list) => {
                    const target = existing ? list.findIndex((item => item.id === existing.id)) : -1;
                    if (target >= 0) list.splice(target, 1, source);
                    else list.push(source);
                    return list;
                });
                this.resourceState.custom = await this.resourceSettings.getMagnetSources();
                dialog.close(index), root && this.renderResourceSettings(root);
            } catch (error) { show.error(error.message); }
        } });
    }
    openRuleDialog(kind, existing = null, root = null) {
        const dialog = this.getRuntimeService("dialog"), isTag = "tag" === kind;
        const content = $(`<div class="jhs-setting-section"><label>名称<input name="name" class="jhs-field"></label>${isTag ? "" : '<label>匹配范围<select name="target" class="jhs-select-source"><option value="title">标题</option><option value="file">文件名</option></select></label>'}<label>匹配方式<select name="type" class="jhs-select-source"><option value="contains">包含</option><option value="regex">正则</option></select></label><label>匹配内容<input name="pattern" class="jhs-field"></label>${isTag ? '<label>权重<input name="weight" type="number" class="jhs-field"></label>' : '<label>动作<select name="action" class="jhs-select-source"><option value="hide">隐藏</option><option value="penalty">降权</option></select></label><label>降权分数<input name="penalty" type="number" class="jhs-field"></label>'}<label>启用<input name="enabled" type="checkbox" class="mini-switch"></label></div>`);
        Object.entries(existing || { enabled: true, type: "contains", weight: 0, action: "hide", penalty: -20 }).forEach(([key, value]) => {
            const input = content.find(`[name="${key}"]`);
            "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value);
        });
        content.appendTo("body").hide();
        dialog.open({ type: 1, title: `${existing ? "编辑" : "新建"}${isTag ? "标签" : "过滤"}规则`, content, area: utils.getDialogArea("sm"), btn: ["保存", "取消"], success: () => content.show(), end: () => content.remove(), yes: async index => {
            const rule = Object.fromEntries(content.find("input,select").map(((i, element) => [element.name, "checkbox" === element.type ? element.checked : element.value])).get());
            rule.id = existing?.id || `rule-${Date.now()}`, rule.weight = Number(rule.weight), rule.penalty = Number(rule.penalty);
            try {
                validateRule(rule);
                await this.resourceSettings.updateArray(isTag ? "magnetTagRules" : "magnetFilterRules", (list) => {
                    const target = existing ? list.findIndex((item => item.id === existing.id)) : -1;
                    if (target >= 0) list.splice(target, 1, rule);
                    else list.push(rule);
                    return list;
                });
                this.resourceState[isTag ? "tags" : "filters"] = await this.resourceSettings.getArray(isTag ? "magnetTagRules" : "magnetFilterRules");
                dialog.close(index), root && this.renderRules(kind, root);
            } catch (error) { show.error(error.message); }
        } });
    }
    async saveCloudSettings(root = $(document)) {
        await this.resourceSettings.saveCloudSettings({ enable123Offline: root.find("#enable123Offline").is(":checked"), enable115Offline: root.find("#enable115Offline").is(":checked"), providerMode: root.find("#offlineProviderMode").val(), enable115Match: root.find("#enable115Match").is(":checked"), enable115LoginRedirect: root.find("#enable115LoginRedirect").is(":checked"), concurrency: Number(root.find("#oneOneFiveConcurrency").val()), cacheMinutes: Number(root.find("#oneOneFiveCacheMinutes").val()) });
    }
    async checkOneOneFiveLogin(root = $(document)) {
        const badge = root.find("#one-one-five-state").text("检测中");
        try {
            const scope = await this.getRuntimeService("scope")(), result = await this.getRuntimeService("offline").checkAccount("one115", { scope });
            badge.text(result.authenticated ? "已登录" : "未登录");
        } catch {
            badge.text("检测失败");
        }
    }
    async testSource(button, url, options = {}) { if (!url) return show.info("本站来源无需跨站测试"); const node = $(button).prop("disabled", true), badge = node.siblings(".jhs-source-test-state").length ? node.siblings(".jhs-source-test-state") : $('<span class="jhs-badge jhs-source-test-state"></span>').insertAfter(node); badge.text("检测中"); try { const parsed = new URL(url), scope = await this.getRuntimeService("scope")(), response = await this.getRuntimeService("http").request({ providerId: `settings-source-${options.source?.id || "unknown"}`, method: "GET", url: parsed.href, responseType: "text", cacheScope: "none", urlPolicy: options.custom ? { trustClass: "custom-public" } : { trustClass: "builtin-public", hosts: [options.source?.domain || parsed.hostname] } }, scope); badge.text(response.data ? "200 · 可解析" : "空响应"); } catch (error) { badge.text("NOT_FOUND" === error?.code ? "404" : "RATE_LIMITED" === error?.code ? "限流" : "AUTH_REQUIRED" === error?.code ? "需要授权" : "请求失败"); } finally { node.prop("disabled", false).text("测试"); } }
    previewCarNumbers(root = $(document)) {
        const parsed = parseCarNumberText(root.find("#car-number-import").val()), actionType = root.find("#car-number-import-status").val();
        this.pendingCarImport = actionType && parsed.values.length ? { ...parsed, actionType } : null;
        root.find("#car-number-import-preview").text(`识别 ${parsed.recognized} 条 · 有效 ${parsed.values.length} · 重复 ${Math.max(0, parsed.recognized - parsed.values.length - parsed.invalid.length)} · 无效 ${parsed.invalid.length}${parsed.invalid.length ? ` · 异常示例：${parsed.invalid.slice(0, 5).join("、")}` : ""}`);
        root.find("#confirm-car-number-import").prop("disabled", !this.pendingCarImport).text(this.pendingCarImport ? `确认导入 ${parsed.values.length} 条` : "确认导入");
        if (!actionType) show.info("请选择导入状态");
    }
    async confirmCarNumbers(event, root = $(document)) {
        if (!this.pendingCarImport) return show.info("请先解析预览");
        const pending = this.pendingCarImport;
        utils.q(event, `确认导入 ${pending.values.length} 条记录？`, (async () => {
            const existing = new Map((await storageManager.getCarList()).map((item => [normalizeCarNum(item.carNum), item]))), summary = { added: 0, updated: 0, failed: 0 }, flag = legacyActionToFlag(pending.actionType);
            const state = this.getRuntimeService("state");
            const records = pending.values.map((rawCarNum) => {
                const carNum = normalizeCarNum(rawCarNum), current = existing.get(carNum);
                return carNum ? { carNum, url: current?.url || buildFallbackCarUrl(carNum), names: current?.names || "", publishTime: current?.publishTime || "" } : null;
            }).filter(Boolean);
            // 分块批量 patch：逐条 patch 会放大为 O(n) 次全库事务
            const CHUNK = 75;
            for (let index = 0; index < records.length; index += CHUNK) {
                const chunk = records.slice(index, index + CHUNK);
                try {
                    await state.patch(chunk.map((record) => record.carNum), { [flag]: !0 }, { type: "manual-car-number-import", records: chunk });
                    chunk.forEach((record) => existing.has(record.carNum) ? summary.updated++ : summary.added++);
                } catch (error) {
                    summary.failed += chunk.length;
                    clog.warn("番号批量导入块失败", error);
                }
            }
            this.pendingCarImport = null;
            root.find("#confirm-car-number-import").prop("disabled", true);
            show.ok(`导入完成：新增 ${summary.added}，更新 ${summary.updated}，失败 ${summary.failed}`);
        }));
    }
}
