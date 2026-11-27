// @ts-check
import { THIRD_PARTY_CACHE_KEY } from "../../services/cache-service.js";
import { ENHANCEMENT_SETTINGS_STYLES } from "../../ui/settings/enhancement-settings.js";
import { l } from "../../core/constants.js";
import { parseCarNumberText } from "../../core/feature-helpers.js";
import { ResourceSettingsService } from "../../services/resource-settings-service.js";
import { buildSettingCss, FULL_SETTINGS_STYLES } from "../../ui/settings/setting-styles.js";
import { bindSettingRows } from "../../ui/settings/setting-control-renderer.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { SHORTCUT_RECORDER_STYLES } from "../../ui/settings/shortcut-recorder.js";
import { FullSettingsSession } from "../../ui/settings/full-settings-session.js";
import { activateFeatureSurface, disposeQuickSettings, syncDesktopSettingNav, mountDesktopSettingNav, mountDesktopQuickSettings, unmountDesktopSettingNav, openQuickSetting } from "./quick-settings-controller.js";
import { openSettingDialog, loadSettingDialog, requestSettingsClose, syncFullConnection, updateSettingsReady, hydrateSettingForm, renderTaskStatuses, activateSettingPanel, hasUnsavedConnection } from "./full-settings-dialog.js";
import { hydrateLiveSettings, bindClick, previewCarNumbers, confirmCarNumbers } from "./settings-form-actions.js";
import { loadResourceSettings, renderCloudSettings, renderResourceSettings, renderRules, openSourceDialog, openRuleDialog, checkOneOneFiveLogin, cancelResourceTests, testSource } from "./resource-settings-controller.js";
/** @typedef {import("../../services/resource-settings-service.js").ResourceRecord} ResourceRecord */
/** @typedef {MouseEvent & {currentTarget: HTMLElement, target: HTMLElement, key: string, delegateTarget: HTMLElement}} JQueryEvent */
/** @typedef {Event & {currentTarget: HTMLInputElement, target: HTMLElement}} JQueryInputEvent */
/** @typedef {import("../../contracts/ports.js").DialogPort} DialogPort */
/** @typedef {import("../../services/dom-ui-service.js").DomUiService} DomUi */
/** @typedef {any} JQueryHandle */
/** @typedef {{scope: LifecycleScope, previousFocus: HTMLElement | null, close: (restoreFocus?: boolean) => void}} QuickSettings */
/** @typedef {{panel: string, root: any, id: number | null, generation: number, scope: LifecycleScope, formReady: boolean, resourcesReady: boolean, session: FullSettingsSession, resources: ResourceSettingsService, closing?: boolean, closed?: Promise<void>, resolveClosed?: () => void, closeConfirmation?: number | null, pendingClose?: boolean, connectionGeneration?: number}} SettingsDialog */
/** @typedef {ReturnType<typeof parseCarNumberText> & {actionType: string, revision: number, raw: string, running?: boolean}} CarImport */
/** @typedef {{custom: ResourceRecord[], tags: ResourceRecord[], filters: ResourceRecord[], builtIn: ResourceRecord[], screenshot: {mode: string, providers: ResourceRecord[]}}} ResourceState */
/** @typedef {{jquery: (value: any) => any, utilities: DomUi, notifications: {error: (message: string) => unknown, ok: (message: string) => unknown, info: (message: string) => unknown}, logger: Pick<Console, "warn" | "error" | "debug" | "log"> & {lowZIndex: () => void}, events: {on: (type: string, handler: (payload: any) => unknown) => () => void, emit: (type: string, payload?: any) => Promise<unknown>}, domUi: DomUi, document: Document, window: Window & typeof globalThis, site: string, route: string, runtimeServices: Record<string, any> & {dialog: DialogPort, settings: import("../../services/settings-service.js").SettingsService, resourceSettings: ResourceSettingsService, settingsRegistry: import("../../app/settings-registry.js").SettingsRegistry}, readTask?: () => any, readBlacklist?: () => any, readListPage?: () => any, readNewVideo?: () => any, readExternalSites?: () => any, readCoverButtons?: () => any}} SettingsControllerOptions */

/** @template {(...args: any[]) => unknown} F @typedef {Parameters<F> extends [any, ...infer Args] ? Args : never} ActionArgs */
export class SettingPlugin {
    /** @type {typeof import("../../ui/settings/setting-panels.js") | undefined} */ _settingPanels = undefined;
    /** @type {typeof import("../../ui/settings/setting-templates.js") | undefined} */ _settingTemplates = undefined;
    /** @param {SettingsControllerOptions} options */
    constructor(options) {
        this.runtimeServices = options.runtimeServices;
        this.readTask = options.readTask;
        this.readBlacklist = options.readBlacklist;
        this.readListPage = options.readListPage;
        this.readNewVideo = options.readNewVideo;
        this.jquery = options.jquery;
        this.utils = options.utilities;
        this.notifications = options.notifications;
        this.logger = options.logger;
        this.events = options.events;
        this.domUi = options.domUi;
        this.document = options.document;
        this.window = options.window;
        this.site = options.site;
        this.route = options.route;
        this._resourceTestScopes = new Set();
        this._sourceRenderGeneration = 0;
        this._carImportRevision = 0;
        /** @type {LifecycleScope | null} */ this._cloudLoginScope = null;
        this._desktopQuickSurfaces = new Map();
        /** @type {QuickSettings | null} */ this._quickSettingInstance = null;
        /** @type {SettingsDialog | null} */ this._settingsDialog = null;
        /** @type {Promise<void> | null} */ this._settingsDialogOpenPromise = null;
        /** @type {(() => Promise<void>) | null} */ this.fullSettingsStyleLoader = null;
        this.readExternalSites = options.readExternalSites;
        this.readCoverButtons = options.readCoverButtons;
        this.folderName = "JHS-数据备份";
        /** @type {ResourceSettingsService} */ this.resourceSettings = this.getRuntimeService("resourceSettings");
        /** @type {CarImport | null} */ this.pendingCarImport = null;
        /** @type {(() => void) | null} */ this.taskStatusUnsubscribe = null;
        this._desktopSettingNavMounted = false;
        /** @type {LifecycleScope | null} */ this._settingScope = null;
        /** @type {(() => void) | null} */ this._settingNavResizeCleanup = null;
        this._desktopNavGeneration = 0;
        this._settingsDialogGeneration = 0;
        /** @type {ReturnType<typeof bindSettingRows> | null} */ this._fullSettingBinding = null;
        /** @type {ReturnType<typeof bindSettingRows> | null} */ this._cloudSettingBinding = null;
        /** @type {(() => void) | null} */ this._settingsFocusCleanup = null;
        /** @type {ResourceState} */ this.resourceState = {custom: [], tags: [], filters: [], builtIn: [], screenshot: {mode: 'priority', providers: []}};
        this.cacheItems = [ {
            key: "jhs_dmm_video",
            text: "预览视频缓存",
            title: "预览视频缓存"
        }, {
            key: "jhs_other_site",
            text: "第三方站点缓存",
            title: "第三方站点资源检测结果"
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
            text: "榜单评分缓存",
            title: "榜单与热播评分"
        }, {
            key: THIRD_PARTY_CACHE_KEY,
            text: "第三方缓存",
            title: "评论、相关清单、磁力搜索、缩略图等请求缓存"
        }, {
            key: "_circuitBreaker",
            text: "熔断状态",
            title: "各站点的熔断计数和状态"
        }, {
            key: "_domainStats",
            text: "域名请求统计",
            title: "各域名的请求次数和错误统计"
        } ];
    }
    get fullSettings() { return this._settingsDialog?.session || this.getRuntimeService("settings"); }
    get fullResources() { return this._settingsDialog?.resources || this.resourceSettings; }
    getName() {
        return "SettingPlugin";
    }
    /** @param {string} name */
    getRuntimeService(name) { return this.runtimeServices[name]; }
    /** Preserve the legacy selector API through the injected site Host. */
    getSelector() {
        const selectors = this.getRuntimeService("host")?.getListSelectors?.();
        if (!selectors) throw new Error("类型错误: 无法确定选择器类型 (JavDb 或 JavBus)");
        return selectors;
    }
    getFormDependencies() {
        const instance = this._settingsDialog;
        return Object.freeze({
            otherSite: this.readExternalSites?.(), listPage: this.readListPage?.(),
            newVideo: this.readNewVideo?.(), blacklist: this.readBlacklist?.(),
            imageLayout: this.getRuntimeService("busImageLayout"), host: this.getRuntimeService("host"), movie: this.getRuntimeService("movie"), settings: this.getRuntimeService("settings"),
            settingsRegistry: this.getRuntimeService("settingsRegistry"),
            webdav: this.getRuntimeService("webdav"),
            webdavSync: this.getRuntimeService("webdavSync"),
            jquery: this.jquery, document: this.document, keywordRules: this.getRuntimeService("keywordRules"), backup: this.getRuntimeService("backup"),
            utilities: this.utils, events: this.events, notifications: this.notifications, logger: this.logger, domUi: this.domUi, window: this.window,
            root: instance?.root,
            draftSettings: instance?.session,
            scope: instance?.scope,
            isActive: () => !instance || this._settingsDialog === instance && !instance.scope.disposed,
            getScope: instance ? async () => instance.scope : this.getRuntimeService("scope"),
        });
    }
    initCss() { return FULL_SETTINGS_STYLES + SHORTCUT_RECORDER_STYLES + ENHANCEMENT_SETTINGS_STYLES; }
    initEntryCss() {
        const { containerWidth = 100, containerColumns = 5 } = this.getRuntimeService("settings").snapshot();
        const mobile = this.utils.isMobileMode();
        return buildSettingCss(mobile ? 100 : containerWidth, mobile ? 1 : containerColumns, l);
    }
    /** @param {ActionArgs<typeof activateFeatureSurface>} args */
    activateFeatureSurface(...args) { return activateFeatureSurface(this, ...args); }
    disposeQuickSettings() { return disposeQuickSettings(this); }
    /** @param {ActionArgs<typeof syncDesktopSettingNav>} args */
    syncDesktopSettingNav(...args) { return syncDesktopSettingNav(this, ...args); }
    mountDesktopSettingNav() { return mountDesktopSettingNav(this); }
    mountDesktopQuickSettings() { return mountDesktopQuickSettings(this); }
    unmountDesktopSettingNav() { return unmountDesktopSettingNav(this); }
    openQuickSetting() { return openQuickSetting(this); }
    /** @param {ActionArgs<typeof openSettingDialog>} args */
    openSettingDialog(...args) { return openSettingDialog(this, ...args); }
    /** @param {ActionArgs<typeof loadSettingDialog>} args */
    loadSettingDialog(...args) { return loadSettingDialog(this, ...args); }
    /** @param {ActionArgs<typeof requestSettingsClose>} args */
    requestSettingsClose(...args) { return requestSettingsClose(this, ...args); }
    /** @param {ActionArgs<typeof hydrateLiveSettings>} args */
    hydrateLiveSettings(...args) { return hydrateLiveSettings(this, ...args); }
    /** @param {ActionArgs<typeof syncFullConnection>} args */
    syncFullConnection(...args) { return syncFullConnection(this, ...args); }
    /** @param {ActionArgs<typeof updateSettingsReady>} args */
    updateSettingsReady(...args) { return updateSettingsReady(this, ...args); }
    /** @param {ActionArgs<typeof hydrateSettingForm>} args */
    hydrateSettingForm(...args) { return hydrateSettingForm(this, ...args); }
    /** @param {ActionArgs<typeof renderTaskStatuses>} args */
    renderTaskStatuses(...args) { return renderTaskStatuses(this, ...args); }
    /** @param {ActionArgs<typeof activateSettingPanel>} args */
    activateSettingPanel(...args) { return activateSettingPanel(this, ...args); }
    /** @param {ActionArgs<typeof hasUnsavedConnection>} args */
    hasUnsavedConnection(...args) { return hasUnsavedConnection(this, ...args); }
    /** @param {ActionArgs<typeof bindClick>} args */
    bindClick(...args) { return bindClick(this, ...args); }
    /** @param {ActionArgs<typeof loadResourceSettings>} args */
    loadResourceSettings(...args) { return loadResourceSettings(this, ...args); }
    /** @param {ActionArgs<typeof renderCloudSettings>} args */
    renderCloudSettings(...args) { return renderCloudSettings(this, ...args); }
    /** @param {ActionArgs<typeof renderResourceSettings>} args */
    renderResourceSettings(...args) { return renderResourceSettings(this, ...args); }
    /** @param {ActionArgs<typeof renderRules>} args */
    renderRules(...args) { return renderRules(this, ...args); }
    /** @param {ActionArgs<typeof openSourceDialog>} args */
    openSourceDialog(...args) { return openSourceDialog(this, ...args); }
    /** @param {ActionArgs<typeof openRuleDialog>} args */
    openRuleDialog(...args) { return openRuleDialog(this, ...args); }
    /** @param {ActionArgs<typeof checkOneOneFiveLogin>} args */
    checkOneOneFiveLogin(...args) { return checkOneOneFiveLogin(this, ...args); }
    cancelResourceTests() { return cancelResourceTests(this); }
    /** @param {ActionArgs<typeof testSource>} args */
    testSource(...args) { return testSource(this, ...args); }
    /** @param {ActionArgs<typeof previewCarNumbers>} args */
    previewCarNumbers(...args) { return previewCarNumbers(this, ...args); }
    /** @param {ActionArgs<typeof confirmCarNumbers>} args */
    confirmCarNumbers(...args) { return confirmCarNumbers(this, ...args); }
}
