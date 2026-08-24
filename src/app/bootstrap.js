// @ts-check

import { initializeRuntimeConstants, l, r } from "../core/constants.js";
import { injectCoreCss } from "../core/css-injection.js";
import { JhsError } from "../core/jhs-error.js";
import { runDataMigrations } from "../core/migration.js";
import { PluginManager } from "../core/plugin-manager.js";
import { attachStateServiceCompatibility, stateService } from "../core/state-service.js";
import { gmHttp, storageManager, utils } from "../core/http.js";
import { initializeEventBus } from "../core/event-bus.js";
import { migrateDisabledPlugins, parseDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { initializeLoggerRuntime } from "../core/logger.js";
import { applyTheme, initializeThemeRuntime } from "../core/theme.js";
import { initializeUiAccessibility } from "../core/ui-primitives.js";
import { getVendorRuntime } from "../platform/userscript/vendor-runtime.js";
import { JavBusHostAdapter } from "../platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../platform/hosts/javdb-host-adapter.js";
import { featureManifests } from "../features/catalog.js";
import { registerSitePlugins } from "../plugins/registry.js";
import { attachCompatibilityFacade } from "./compatibility-facade.js";
import { createAppContext } from "./create-app-context.js";
import { integrationManifests } from "./integration-catalog.js";

function patchLayerRuntime(layerRuntime) {
    const originalClose = layerRuntime.close;
    layerRuntime.close = function(id) {
        const result = originalClose.call(this, id);
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
            globalThis.utils.setupEscClose(id);
        } });
    };
}

function importVendorStyles() {
    for (const url of [
        "https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css",
        "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css",
        "https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css",
        "https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css",
    ]) utils.importResource(url);
}

async function migrateDisabledPluginSettings() {
    const raw = await storageManager.getSetting("disabledPlugins", "[]");
    const previous = parseDisabledPlugins(raw);
    const migrated = migrateDisabledPlugins(previous);
    if (JSON.stringify(previous) === JSON.stringify(migrated)) return migrated;
    const journalKey = "jhs_settings_migration_journal";
    await storageManager.forage.setItem(journalKey, { status: "pending", previousValues: { disabledPlugins: raw }, createdAt: new Date().toISOString() });
    try {
        await storageManager.saveSettingItem("disabledPlugins", JSON.stringify(migrated));
        await storageManager.forage.removeItem(journalKey);
        return migrated;
    } catch (error) {
        await storageManager.saveSettingItem("disabledPlugins", raw);
        throw error;
    }
}

async function prepareLocalOrigins() {
    const settings = await storageManager.getSetting();
    const origins = new Set(Array.isArray(settings.trustedLocalOrigins) ? settings.trustedLocalOrigins : []);
    let legacyOrigin = null;
    try { if (settings.webDavUrl) legacyOrigin = new URL(settings.webDavUrl).origin; } catch { /* existing invalid values remain untouched */ }
    if (legacyOrigin && !origins.has(legacyOrigin)) {
        origins.add(legacyOrigin);
        await storageManager.saveSetting({ ...settings, trustedLocalOrigins: [...origins], localOriginTrustNoticeV1: true });
        return { origins: [...origins], notice: `已按现有 WebDAV 配置授权本地来源：${legacyOrigin}` };
    } else if (legacyOrigin && !settings.localOriginTrustNoticeV1) {
        await storageManager.saveSetting({ ...settings, localOriginTrustNoticeV1: true });
        return { origins: [...origins], notice: `WebDAV 仅信任精确来源：${legacyOrigin}` };
    }
    return { origins: [...origins], notice: null };
}

export async function bootstrapJhs() {
    try {
        const siteContext = initializeRuntimeConstants(window.location);
        attachStateServiceCompatibility();
        const vendors = getVendorRuntime();
        const jhsEventBus = initializeEventBus();
        Object.assign(globalThis, { utils, gmHttp, storageManager, stateService, jhsEventBus });
        patchLayerRuntime(vendors.layer);
        importVendorStyles();
        injectCoreCss();
        const disabled = await migrateDisabledPluginSettings();
        const localOriginSettings = await prepareLocalOrigins();
        const javdbHostAdapter = new JavDbHostAdapter(), javbusHostAdapter = new JavBusHostAdapter();
        const hostAdapter = r ? javdbHostAdapter : l ? javbusHostAdapter : null;
        const route = hostAdapter?.detectRoute() ?? "other";
        const context = createAppContext({
            gmRequest: globalThis.GM_xmlhttpRequest, gmGetValue: globalThis.GM_getValue, gmSetValue: globalThis.GM_setValue,
            legacyHttp: gmHttp, storageForage: storageManager.forage, localStorage: globalThis.localStorage,
            layer: vendors.layer, hostAdapter, hostAdapters: { javdb: javdbHostAdapter, javbus: javbusHostAdapter }, site: siteContext.site, route, disabled, localOrigins: localOriginSettings.origins,
        });
        const settingsSnapshot = await context.services.settings.load();
        const legacySortMethod = localStorage.getItem("jhs_sortMethod");
        if (settingsSnapshot.sortMethod == null && ["default", "rateCount", "date"].includes(legacySortMethod || "")) {
            await context.services.settings.set("sortMethod", legacySortMethod);
        }
        const legacyFoldCategory = localStorage.getItem("jhs_foldCategory");
        if (settingsSnapshot.foldCategoryCollapsed == null && ["yes", "no"].includes(legacyFoldCategory || "")) {
            await context.services.settings.set("foldCategoryCollapsed", legacyFoldCategory === "yes");
        }
        const legacyVideoMuted = localStorage.getItem("jhs_videoMuted");
        if (settingsSnapshot.videoMuted == null && ["yes", "no"].includes(legacyVideoMuted || "")) {
            await context.services.settings.set("videoMuted", legacyVideoMuted === "yes");
        }
        const logger = initializeLoggerRuntime(context.rootScope);
        initializeThemeRuntime(context.rootScope);
        initializeUiAccessibility(context.rootScope);
        context.services.diagnostics.setBrowserMetadata({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            ...(globalThis.__jhsBrowserTestMetadata ?? {}),
        });
        Object.assign(globalThis, logger);
        if (localOriginSettings.notice) globalThis.show.info(localOriginSettings.notice);
        const pluginManager = new PluginManager({ diagnostics: context.services.diagnostics });
        for (const manifest of integrationManifests) context.registries.integrations.register(manifest);
        for (const manifest of featureManifests) context.registries.features.register(manifest);
        registerSitePlugins(pluginManager, context.registries.features, siteContext.site);
        await context.registries.features.start();
        attachCompatibilityFacade({
            pluginManager, utils, gmHttp, storageManager, stateService, jhsEventBus,
            clog: globalThis.clog, show: globalThis.show, loading: globalThis.loading,
        }, globalThis.unsafeWindow);
        window.isDetailPage = route === "detail";
        window.isListPage = route === "list";
        await runDataMigrations(storageManager);
        await stateService.recoverPendingTransaction();
        await Promise.all([pluginManager.processCss(), applyTheme()]);
        if (r && /(^|;)\s*locale\s*=\s*en\s*($|;)/i.test(document.cookie)) globalThis.show.error("请切换到中文语言下才可正常使用本脚本", { duration: -1 });
        await pluginManager.processPlugins();
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
