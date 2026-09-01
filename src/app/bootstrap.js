// @ts-check

import { initializeRuntimeConstants, l, r } from "../core/constants.js";
import { injectCoreCss } from "../core/css-injection.js";
import { JhsError } from "../core/jhs-error.js";
import { runDataMigrationsWithoutLock } from "../core/migration.js";
import { StorageMutationCoordinator } from "../core/storage-mutation-coordinator.js";
import { normalizeScreenshotSettingDraft } from "../core/settings-migration.js";
import { createLegacyRuntime } from "../core/legacy-runtime.js";
import { initializeEventBus } from "../core/event-bus.js";
import { migrateDisabledPlugins, parseDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { initializeLoggerRuntime } from "../core/logger.js";
import { applyThemeMode, initializeThemeRuntime } from "../core/theme.js";
import { initializeUiAccessibility } from "../core/ui-primitives.js";
import { getVendorRuntime } from "../platform/userscript/vendor-runtime.js";
import { JavBusHostAdapter } from "../platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../platform/hosts/javdb-host-adapter.js";
import { featureManifests } from "../features/catalog.js";
import { createAppContext } from "./create-app-context.js";
import { integrationManifests } from "./integration-catalog.js";

function patchLayerRuntime(layerRuntime, utilsRuntime) {
    const originalClose = layerRuntime.close;
    layerRuntime.close = function(id) {
        const result = originalClose.call(this, id);
        // 非 Esc 途径（X 按钮/shadeClick/close 调用）关闭时同步清理 Esc 栈，避免 Esc 被陈旧索引吞掉
        utilsRuntime?.releaseEscClose?.(id);
        setTimeout(() => {
            const shades = document.querySelectorAll(".layui-layer-shade").length;
            document.documentElement.style.overflow = shades > 0 ? "hidden" : "";
        }, 10);
        return result;
    };
    const originalOpen = layerRuntime.open;
    layerRuntime.open = function(options = {}) {
        const success = options.success;
        return originalOpen.call(this, { ...options, success(element, id) {
            if (typeof success === "function") success.call(this, element, id);
            utilsRuntime.setupEscClose(id);
        } });
    };
}

function importVendorStyles(utilsRuntime) {
    for (const url of [
        "https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css",
        "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css",
        "https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css",
        "https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css",
    ]) utilsRuntime.importResource(url);
}

async function readDisabledPluginSettings(storageManager) {
    const raw = await storageManager.getSetting("disabledPlugins", "[]");
    const previous = parseDisabledPlugins(raw);
    const migrated = migrateDisabledPlugins(previous);
    return { migrated, needsMigration: JSON.stringify(previous) !== JSON.stringify(migrated) };
}

async function resolveLocalOrigins(storageManager) {
    // Read-only phase. Persisting is deferred until SettingsService exists so
    // the migration can run as an atomic patch on the freshest stored draft.
    const settings = await storageManager.getSetting();
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

/** @param {Record<string, unknown>} draft @param {{origins: string[], needsOrigin?: boolean, needsNotice?: boolean}} resolved @param {{sortMethod: string|null, foldCategory: string|null, videoMuted: string|null}} legacy */
function applyBootstrapSettingMigrations(draft, resolved, legacy) {
    const previous = parseDisabledPlugins(typeof draft.disabledPlugins === "string" ? draft.disabledPlugins : "[]");
    const migrated = migrateDisabledPlugins(previous);
    if (JSON.stringify(previous) !== JSON.stringify(migrated)) draft.disabledPlugins = JSON.stringify(migrated);
    normalizeScreenshotSettingDraft(draft);
    if (resolved.needsOrigin || resolved.needsNotice) {
        if (resolved.needsOrigin) {
            const origins = new Set(Array.isArray(draft.trustedLocalOrigins) ? draft.trustedLocalOrigins : []);
            const legacyOrigin = resolved.origins[resolved.origins.length - 1];
            if (legacyOrigin) origins.add(legacyOrigin);
            draft.trustedLocalOrigins = [ ...origins ];
        }
        draft.localOriginTrustNoticeV1 = true;
    }
    if (draft.sortMethod == null && ["default", "rateCount", "date"].includes(legacy.sortMethod || "")) draft.sortMethod = legacy.sortMethod;
    if (draft.foldCategoryCollapsed == null && ["yes", "no"].includes(legacy.foldCategory || "")) draft.foldCategoryCollapsed = legacy.foldCategory === "yes";
    if (draft.videoMuted == null && ["yes", "no"].includes(legacy.videoMuted || "")) draft.videoMuted = legacy.videoMuted === "yes";
}

export async function bootstrapJhs() {
    try {
        const bootstrapStartedAt = performance.now(), diagnostics = globalThis.__jhsBrowserDiagnostics, markPhase = (phase) => diagnostics && ((diagnostics.bootstrapPhases ||= {})[phase] = performance.now() - bootstrapStartedAt);
        const siteContext = initializeRuntimeConstants(window.location);
        const vendors = getVendorRuntime();
        const jhsEventBus = initializeEventBus();
        const storageMutationCoordinator = new StorageMutationCoordinator();
        const { utils, gmHttp, storageManager, stateService } = createLegacyRuntime(jhsEventBus, storageMutationCoordinator);
        markPhase("legacy-runtime");
        Object.assign(globalThis, { utils, gmHttp, storageManager, stateService, jhsEventBus });
        // 黑名单/关键词规则可被其他标签页修改：内存派生缓存不随事件自动失效，必须在此主动清空
        [ "blacklist-rules-changed", "filter-rules-changed", "legacy-refresh" ].forEach((type => jhsEventBus.on(type, (() => storageManager._invalidateCache()))));
        patchLayerRuntime(vendors.layer, utils);
        importVendorStyles(utils);
        markPhase("pre-settings");
        const disabledMigration = await readDisabledPluginSettings(storageManager);
        const disabled = disabledMigration.migrated;
        const localOriginSettings = await resolveLocalOrigins(storageManager);
        const javdbHostAdapter = new JavDbHostAdapter(), javbusHostAdapter = new JavBusHostAdapter();
        const hostAdapter = r ? javdbHostAdapter : l ? javbusHostAdapter : null;
        const route = hostAdapter?.detectRoute() ?? "other";
        const context = createAppContext({
            gmRequest: globalThis.GM_xmlhttpRequest, gmGetValue: globalThis.GM_getValue, gmSetValue: globalThis.GM_setValue,
            legacyHttp: gmHttp, legacyStorage: storageManager, eventBus: jhsEventBus, storageForage: storageManager.forage, localStorage: globalThis.localStorage,
            layer: vendors.layer, stateService, storageMutationCoordinator, hostAdapter, hostAdapters: { javdb: javdbHostAdapter, javbus: javbusHostAdapter }, site: siteContext.site, route, disabled, localOrigins: localOriginSettings.origins,
        });
        markPhase("context");
        injectCoreCss(context.services.styles);
        // 6.5: expose the single settings write entry so legacy writers (storageManager.saveSetting/saveSettingItem)
        // route through SettingsService with lock + re-read + merge.
        Object.assign(globalThis, { settingsService: context.services.settings });
        await context.services.settings.load();
        markPhase("settings-load");
        const legacySortMethod = localStorage.getItem("jhs_sortMethod");
        const legacyFoldCategory = localStorage.getItem("jhs_foldCategory");
        const legacyVideoMuted = localStorage.getItem("jhs_videoMuted");
        await context.services.settings.update((draft) => {
            applyBootstrapSettingMigrations(draft, localOriginSettings, { sortMethod: legacySortMethod, foldCategory: legacyFoldCategory, videoMuted: legacyVideoMuted });
        });
        context.services.profile.start();
        markPhase("settings-migration");
        const logger = initializeLoggerRuntime(context.rootScope, {
            clogMsgCount: context.services.settings.snapshot().clogMsgCount,
        });
        context.services.ui.configure({ show: logger.show, clog: logger.clog, loading: logger.loading, jquery: globalThis.$ ?? window.jQuery, utils, confirm: utils.q?.bind(utils), showImageViewer: window.showImageViewer, getDialogArea: utils.getDialogArea?.bind(utils), setupEscClose: utils.setupEscClose?.bind(utils), time: utils.time?.bind(utils), openPage: utils.openPage?.bind(utils) });
        markPhase("logger");
        initializeThemeRuntime(context.rootScope);
        initializeUiAccessibility(context.rootScope);
        markPhase("theme-ui");
        context.services.diagnostics.setBrowserMetadata({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            ...(globalThis.__jhsBrowserTestMetadata ?? {}),
        });
        Object.assign(globalThis, logger);
        if (localOriginSettings.notice) logger.show.info(localOriginSettings.notice);
        for (const manifest of integrationManifests) context.registries.integrations.register(manifest);
        for (const manifest of featureManifests) context.registries.features.register(manifest);
        context.services.diagnostics.setFeatureCatalog(featureManifests.flatMap((manifest) => manifest.contributes.map((id) => ({ id, featureId: manifest.id, disableable: manifest.disableable }))));
        markPhase("registry");
        window.isDetailPage = route === "detail";
        window.isListPage = route === "list";
        await storageMutationCoordinator.runExclusive(async () => {
            await stateService.recoverPendingTransactionWithoutLock();
            await runDataMigrationsWithoutLock(storageManager);
        });
        markPhase("data-prepare");
        await context.registries.features.start();
        const featureRuntimeApi = Object.freeze({
            getFeatureApi: (/** @type {string} */ id) => context.registries.features.getFeatureApi(id),
            getActiveFeatureIds: () => context.registries.features.getActiveFeatureIds(),
            getDiagnostics: () => context.services.diagnostics.exportSnapshot(),
        });
        const publicTarget = globalThis.unsafeWindow ?? globalThis;
        Object.assign(globalThis, { __jhsFeatureRuntime: featureRuntimeApi });
        if (publicTarget !== globalThis) Object.assign(publicTarget, { __jhsFeatureRuntime: featureRuntimeApi });
        if (globalThis.__jhsBrowserTestMetadata?.fixture) {
            const browserTestApi = Object.freeze({
                getFeatureApi: featureRuntimeApi.getFeatureApi,
                services: Object.freeze({ http: context.services.http, movie: context.services.movie, settings: context.services.settings }),
            });
            Object.assign(globalThis, { __jhsBrowserTestApi: browserTestApi });
            if (publicTarget !== globalThis) Object.assign(publicTarget, { __jhsBrowserTestApi: browserTestApi });
        }
        markPhase("feature-runtime");
        await applyThemeMode(context.services.settings.snapshot().themeMode);
        markPhase("feature-css");
        if (r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie)) logger.show.error("请切换到中文语言下才可正常使用本脚本", { duration: -1 });
        markPhase("first-ready");
        markPhase("total");
        return context;
    } catch (cause) {
        throw cause instanceof JhsError ? cause : new JhsError("BOOTSTRAP_FAILED", cause instanceof Error ? cause.message : "JHS 启动失败", { source: "bootstrap", cause });
    }
}

export function mountBootstrapError(error) {
    console.error("[JHS] bootstrap failed:", error);
    if (globalThis.show?.error) return globalThis.show.error(error?.message || "JHS 启动失败", { duration: -1 });
    const surface = document.createElement("div");
    surface.id = "jhs-bootstrap-error";
    surface.setAttribute("role", "alert");
    surface.textContent = `JHS 启动失败：${error?.message || "未知错误"}`;
    Object.assign(surface.style, { position: "fixed", inset: "12px 12px auto", zIndex: "2147483647", padding: "12px", background: "#7f1d1d", color: "white" });
    document.documentElement.append(surface);
}
