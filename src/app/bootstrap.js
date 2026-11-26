// @ts-check
import { initializeEnhancementControls } from "../core/enhancement-controls.js";

import { getDialogArea, mountPendingDialogShell, prepareDialogOptions } from "../core/dialog-shell.js";
import { initializeRuntimeConstants, l, r } from "../core/constants.js";
import { detectSite, resolveLegacyJavDbUrl } from "../core/site-context.js";
import { injectCoreCss } from "../core/css-injection.js";
import { JhsError } from "../core/jhs-error.js";
import { assertSupportedDataVersion, runDataMigrations } from "../core/migration.js";
import { DialogEscController } from "../core/dialog-esc-controller.js";
import { isMobileMode } from "../core/dom-actions.js";
import { importVendorStyles } from "../platform/browser/resource-loader.js";
import { createCompatibilityUtils } from "./compatibility-utils.js";
import { StorageService } from "../services/storage-service.js";
import { StorageMutationCoordinator } from "../core/storage-mutation-coordinator.js";
import { createUserscriptStorageAdapter } from "../platform/userscript/indexeddb-storage-adapter.js";
import { initializeEventBus } from "../core/event-bus.js";
import { LEGACY_PLUGIN_CONTRIBUTION_MAP, migrateDisabledPlugins, parseDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { initializeLoggerRuntime } from "../core/logger.js";
import { applyThemeMode, initializeThemeRuntime } from "../core/theme.js";
import { initializeUiAccessibility } from "../core/ui-primitives.js";
import { getVendorRuntime } from "../platform/userscript/vendor-runtime.js";
import { JavBusHostAdapter } from "../platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../platform/hosts/javdb-host-adapter.js";
import { getBlacklistSubjectInfo, parseBlacklistFilterPage } from "../integrations/host-list/blacklist-parser.js";
import { featureManifests } from "../features/catalog.js";
import { attachCompatibilityFacade } from "./compatibility-facade.js";
import { createAppContext } from "./create-app-context.js";
import { integrationManifests } from "./integration-catalog.js";
/** @typedef {import("../services/settings-service.js").SettingsService} SettingsService */
/** @typedef {import("../services/storage-service.js").StorageService} Storage */
/** @typedef {{location?: URL | Location, platform?: Record<string, any>, eventBus?: import("../core/event-bus.js").JhsEventBus, storage?: Storage, storageMutationCoordinator?: StorageMutationCoordinator, bundledStyles?: boolean, headless?: boolean, remote?: boolean}} BootstrapOptions */
/** @typedef {{unsafeWindow: Window & Record<string, any>, GM_xmlhttpRequest: (options: Record<string, any>) => any, __jhsBrowserDiagnostics?: Record<string, any>, __jhsBrowserTestMetadata?: Record<string, unknown>, show?: ReturnType<typeof initializeLoggerRuntime>["show"]}} BootstrapGlobals */

/** @param {any} layerRuntime @param {DialogEscController} dialogEsc */
function patchLayerRuntime(layerRuntime, dialogEsc) {
    const originalClose = layerRuntime.close;
    layerRuntime.close = function(/** @type {number} */ id) {
        const result = originalClose.call(this, id);
        dialogEsc.releaseEscClose(id);
        return result;
    };
    const originalOpen = layerRuntime.open;
    layerRuntime.open = function(options = {}) {
        const prepared = prepareDialogOptions(options, { getDialogArea });
        const success = prepared.success;
        const id = originalOpen.call(this, { ...prepared, success(/** @type {unknown} */ element, /** @type {number} */ id) {
            if (typeof success === "function") success.call(this, element, id);
            if (document.getElementById(`layui-layer${id}`)) dialogEsc.setupEscClose(id);
        } });
        if (Number(prepared.type) === 2 && mountPendingDialogShell(prepared, id, document)) dialogEsc.setupEscClose(id);
        return id;
    };
}

/** @param {Record<string, any>} draft */
export function normalizeScreenshotSetting(draft) {
    if (!Object.prototype.hasOwnProperty.call(draft, "enableLoadScreenShot")) draft.enableLoadScreenShot = "yes";
    if (!Object.prototype.hasOwnProperty.call(draft, "enableScreenSvg")) draft.enableScreenSvg = draft.enableLoadScreenShot ?? "yes";
}

/** Apply bootstrap compatibility values in one atomic settings write.
 * @param {SettingsService} settings @param {ReturnType<typeof resolveLocalOrigins>} localOriginSettings
 * @param {string | null} legacySortMethod @param {string | null} legacyFoldCategory @param {string | null} legacyVideoMuted
 * @param {Awaited<ReturnType<import("../services/credential-service.js").CredentialService["migrateLegacy"]>> | null} [credentialMigration] @param {boolean} [alreadyLocked]
 */
async function persistBootstrapMigration(settings, localOriginSettings, legacySortMethod, legacyFoldCategory, legacyVideoMuted, credentialMigration = null, alreadyLocked = false) {
    await (alreadyLocked ? settings.updateWithoutLock : settings.update).call(settings, (draft) => {
        initializeEnhancementControls(draft);
        const previous = parseDisabledPlugins(typeof draft.disabledPlugins === "string" ? draft.disabledPlugins : "[]");
        const migrated = migrateDisabledPlugins(previous);
        if (JSON.stringify(previous) !== JSON.stringify(migrated)) draft.disabledPlugins = JSON.stringify(migrated);
        if (localOriginSettings.needsOrigin) {
            const origins = new Set(Array.isArray(draft.trustedLocalOrigins) ? draft.trustedLocalOrigins : []);
            for (const origin of localOriginSettings.origins) origins.add(origin);
            draft.trustedLocalOrigins = [ ...origins ];
        }
        if (localOriginSettings.needsNotice) draft.localOriginTrustNoticeV1 = true;
        normalizeScreenshotSetting(draft);
        if (draft.sortMethod == null && ["default", "rateCount", "date"].includes(legacySortMethod || "")) draft.sortMethod = legacySortMethod;
        if (draft.foldCategoryCollapsed == null && ["yes", "no"].includes(legacyFoldCategory || "")) draft.foldCategoryCollapsed = legacyFoldCategory === "yes";
        if (draft.videoMuted == null && ["yes", "no"].includes(legacyVideoMuted || "")) draft.videoMuted = legacyVideoMuted === "yes";
        for (const key of credentialMigration?.cleanup?.settingKeys || []) {
            if (draft[key] === credentialMigration?.cleanup?.settingValues?.[key]) delete draft[key];
        }
    });
}

/** @param {Record<string, any>} settings */
function resolveLocalOrigins(settings) {
    // Read-only phase. Persisting is deferred until SettingsService exists so
    // the migration can run as an atomic patch on the freshest stored draft.
    const origins = new Set(Array.isArray(settings.trustedLocalOrigins) ? settings.trustedLocalOrigins : []);
    let legacyOrigin = null;
    try { if (settings.webDavUrl) legacyOrigin = new URL(settings.webDavUrl).origin; } catch { /* existing invalid values remain untouched */ }
    if (legacyOrigin && !origins.has(legacyOrigin)) {
        origins.add(legacyOrigin);
        return { origins: [...origins], notice: `已按现有 WebDAV 配置授权本地来源：${legacyOrigin}`, needsOrigin: true };
    }
    if (legacyOrigin && !settings.localOriginTrustNoticeV1) {
        return { origins: [...origins], notice: `WebDAV 仅信任精确来源：${legacyOrigin}`, needsNotice: true };
    }
    return { origins: [...origins], notice: null };
}

/** @param {BootstrapOptions} [options] */
export async function bootstrapJhs(options = {}) {
    const globals = /** @type {typeof globalThis & BootstrapGlobals} */ (globalThis);
    try {
        if (detectSite(window.location).isJavDB) {
            const replacement = resolveLegacyJavDbUrl(window.location);
            if (replacement) return void window.location.replace(replacement);
        }
        const bootstrapStartedAt = performance.now(), diagnostics = globals.__jhsBrowserDiagnostics, markPhase = (/** @type {string} */ phase) => diagnostics && ((diagnostics.bootstrapPhases ||= {})[phase] = performance.now() - bootstrapStartedAt);
        const siteContext = initializeRuntimeConstants(options.location ?? window.location);
        const vendors = getVendorRuntime();
        const jhsEventBus = options.eventBus ?? initializeEventBus();
        const dialogEsc = new DialogEscController({ jquery: vendors.$, close: id => vendors.layer.close(id), document });
        const storage = options.storage ?? new StorageService(options.platform?.storage ?? createUserscriptStorageAdapter(vendors.localforage, globalThis));
        const storageMutationCoordinator = options.storageMutationCoordinator ?? new StorageMutationCoordinator();
        /** @type {[unknown, Record<string, any>]} */
        const [, initialSettings] = await Promise.all([
            assertSupportedDataVersion(storage),
            options.platform?.settings?.snapshot() ?? storage.get("setting").then(value => /** @type {Record<string, any>} */ (value ?? {})),
        ]);
        markPhase("storage");
        patchLayerRuntime(vendors.layer, dialogEsc);
        // 先退出整包 IIFE 调用栈，避免首个资源请求为整包同步生成调试源位置。
        await Promise.resolve();
        if (!options.bundledStyles) importVendorStyles();
        markPhase("pre-settings");
        const disabled = migrateDisabledPlugins(parseDisabledPlugins(initialSettings.disabledPlugins));
        const localOriginSettings = resolveLocalOrigins(initialSettings);
        const blacklistParser = Object.freeze({
            getSubjectInfo: (/** @type {Parameters<typeof getBlacklistSubjectInfo>[0]} */ options) => getBlacklistSubjectInfo({ ...options, jquery: vendors.$ }),
            parseFilterPage: (/** @type {Parameters<typeof parseBlacklistFilterPage>[0]} */ options) => parseBlacklistFilterPage({ ...options, jquery: vendors.$ }),
        });
        const javdbHostAdapter = options.platform?.javdbHost ?? new JavDbHostAdapter(document, window.location, blacklistParser), javbusHostAdapter = new JavBusHostAdapter(document, window.location, blacklistParser);
        if (options.platform?.javdbHost) javdbHostAdapter.blacklistParser = blacklistParser;
        const hostAdapter = r ? javdbHostAdapter : l ? javbusHostAdapter : null;
        const route = hostAdapter?.detectRoute() ?? "other";
        let mobileMode = () => isMobileMode(initialSettings.mobileMode);
        const context = createAppContext({
            vendors,
            createFeedback: (scope) => {
                const feedback = options.headless
                    ? { clog: Object.assign(Object.create(console), { html: console.info }), show: { error: console.error, info: console.info, ok: console.info } }
                    : initializeLoggerRuntime(scope, { clogMsgCount: initialSettings.clogMsgCount, vendors, utilities: { getDialogArea, setupEscClose: dialogEsc.setupEscClose.bind(dialogEsc), releaseEscClose: dialogEsc.releaseEscClose.bind(dialogEsc), isMobileMode: () => mobileMode() } });
                javdbHostAdapter.reportListIssue = (/** @type {string} */ message) => feedback.clog.warn(message);
                markPhase("logger");
                return feedback;
            },
            gmRequest: globals.GM_xmlhttpRequest, storage, dialogEsc, eventBus: jhsEventBus,
            storageMutationCoordinator, localStorage: globalThis.localStorage, layer: vendors.layer, hostAdapter, hostAdapters: { javdb: javdbHostAdapter, javbus: javbusHostAdapter }, site: siteContext.site, route, disabled, localOrigins: localOriginSettings.origins,
            platform: options.platform,
        });
        mobileMode = context.services.domUi.isMobileMode;
        if (diagnostics && Object.is(globals.unsafeWindow, globalThis)) {
            const { movie, related, review, settings, storage, state, keywordRules, backup, syncState } = context.services;
            diagnostics.detailServices = { movie, related, review, settings, storage, state, keywordRules, backup, syncState };
            Object.assign(globals.unsafeWindow, { settingsService: settings, credentialService: context.services.credential });
            Object.defineProperty(diagnostics, "diagnostics", { value: context.services.diagnostics });
            diagnostics.getContributionDescriptors = () => {
                const descriptors = new Map(context.services.diagnostics.contributionDescriptors.map(item => [item.id, item.disableable]));
                return Object.entries(LEGACY_PLUGIN_CONTRIBUTION_MAP).flatMap(([name, id]) =>
                    descriptors.has(id) ? [{ name, disableable: descriptors.get(id) }] : []);
            };
            diagnostics.executeCommand = context.registries.commands.execute.bind(context.registries.commands);
            context.registries.features.inspection = diagnostics.features = {};
            diagnostics.activateFeature = async (/** @type {string} */ id) => { await context.registries.features.activate(id); };
        }
        markPhase("context");
        injectCoreCss(context.services.styles);
        if (route === "list" || route === "detail" || route === "owned-detail") {
            const { buildDetailPanelCss } = await import("../ui/detail/panel-styles.js");
            context.rootScope.addCleanup(context.services.styles.register("jhs-detail-panels", buildDetailPanelCss()));
        }
        const credentialMigration = options.remote ? { issues: [] } : await context.services.settings.runExclusive(async () => {
            await assertSupportedDataVersion(storage);
            markPhase("settings-load");
            const migration = await context.services.credential.migrateLegacy(context.services.settings, { deferCleanup: true });
            migration.cleanup = await context.services.credential.validateLegacyCleanup(migration.cleanup);
            await persistBootstrapMigration(context.services.settings, localOriginSettings,
                localStorage.getItem("jhs_sortMethod"), localStorage.getItem("jhs_foldCategory"), localStorage.getItem("jhs_videoMuted"), migration, true);
            await context.services.credential.cleanupLegacyPageStorage(migration.cleanup?.pageKeys, context.services.settings);
            markPhase("settings-migration");
            const { settings, state, syncState, keywordRules } = context.services;
            await runDataMigrations(storage, {
                updateSettings: mutator => settings.updateWithoutLock(mutator),
                recoverBeforeV4: async () => {
                    await syncState.recoverWithoutLock();
                    await state.recoverPendingTransactionWithoutLock();
                },
            });
            await keywordRules.getReviewKeywordsWithoutLock();
            await state.recoverPendingTransactionWithoutLock();
            if (hostAdapter && !options.headless && options.platform?.enabledFeatures?.includes("webdav-sync") !== false) {
                await context.services.webdavSync.initializeStoreWithoutLock?.();
            }
            markPhase("data-prepare");
            return migration;
        });
        if (options.remote) {
            await context.services.settings.load();
            markPhase("settings-migration");
            markPhase("data-prepare");
        }
        if (!options.headless) context.services.profile.start();
        const logger = context.feedback;
        initializeThemeRuntime(context.rootScope, context.services.settings);
        initializeUiAccessibility(context.rootScope);
        markPhase("theme-ui");
        context.services.diagnostics.setBrowserMetadata({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            ...(globals.__jhsBrowserTestMetadata ?? {}),
        });
        if (credentialMigration.issues?.length) logger.show?.info?.("部分旧凭证未能安全迁移，已保留原数据，请重新保存对应凭证");
        if (localOriginSettings.notice) logger.show?.info?.(localOriginSettings.notice);
        for (const manifest of integrationManifests) context.registries.integrations.register(manifest);
        for (const manifest of featureManifests) context.registries.features.register(manifest);
        markPhase("registry");
        // Compatibility infrastructure must be ready before any feature mounts.
        // A missing logger dependency should fail the whole bootstrap, not leave a half-started page.
        if (!options.headless) {
            const { domUi, clipboard, dialog } = context.services;
            const utils = createCompatibilityUtils(domUi, dialogEsc, clipboard.copyText, dialog);
            attachCompatibilityFacade({
                pluginManager: Object.freeze({ getBean: context.registries.features.runtimeLookup.getBean }), utils, stateService: context.services.state, jhsEventBus,
                clog: logger.clog, show: logger.show, loading: logger.loading, showImageViewer: logger.showImageViewer, ImageHoverPreview: logger.ImageHoverPreview,
            }, globals.unsafeWindow);
        }
        window.isDetailPage = route === "detail";
        window.isListPage = route === "list";
        if (options.headless) return context;
        await context.registries.features.start(context.services.settings.snapshot());
        markPhase("feature-runtime");
        applyThemeMode(context.services.settings.snapshot().themeMode);
        if (r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie)) logger.show?.error?.("请切换到中文语言下才可正常使用本脚本", { duration: -1 });
        await jhsEventBus.emit("jhs-features-ready", {}, { broadcast: false });
        markPhase("feature-ready-signal");
        markPhase("first-ready");
        context.services.backgroundWork.markReady();
        context.registries.features.scheduleIdle();
        markPhase("total");
        return context;
    } catch (cause) {
        throw cause instanceof JhsError ? cause : new JhsError("BOOTSTRAP_FAILED", cause instanceof Error ? cause.message : "JHS 启动失败", { source: "bootstrap", cause });
    }
}

/** @param {unknown} error */
export function mountBootstrapError(error) {
    const globals = /** @type {typeof globalThis & BootstrapGlobals} */ (globalThis);
    const message = error instanceof Error ? error.message : "";
    console.error("[JHS] bootstrap failed:", error);
    if (globals.show?.error) return globals.show.error(message || "JHS 启动失败", { duration: -1 });
    const surface = document.createElement("div");
    surface.id = "jhs-bootstrap-error";
    surface.setAttribute("role", "alert");
    surface.textContent = `JHS 启动失败：${message || "未知错误"}`;
    Object.assign(surface.style, { position: "fixed", inset: "12px 12px auto", zIndex: "2147483647", padding: "12px", background: "#7f1d1d", color: "white" });
    document.documentElement.append(surface);
}
