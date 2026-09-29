// @ts-check

import { PORT, REGISTRY, SERVICE } from "../contracts/tokens.js";
import { BrowserNavigationAdapter } from "../platform/browser/browser-navigation-adapter.js";
import { BrowserStyleAdapter } from "../platform/browser/browser-style-adapter.js";
import { IndexedDbStorageAdapter } from "../platform/userscript/indexeddb-storage-adapter.js";
import { LayerDialogAdapter } from "../platform/userscript/layer-dialog-adapter.js";
import { UserscriptHttpAdapter } from "../platform/userscript/userscript-http-adapter.js";
import { CacheService } from "../services/cache-service.js";
import { ActressInfoService } from "../services/actress-info-service.js";
import { DiagnosticsService } from "../services/diagnostics-service.js";
import { DialogService } from "../services/dialog-service.js";
import { ExternalUrlPolicy } from "../services/external-url-policy.js";
import { HttpService } from "../services/http-service.js";
import { ImageSearchService } from "../services/image-search-service.js";
import { NavigationService } from "../services/navigation-service.js";
import { MagnetService } from "../services/magnet-service.js";
import { MovieIdentityService } from "../services/movie-identity-service.js";
import { OfflineService } from "../services/offline-service.js";
import { OfflineSubmissionReceiptService } from "../services/offline-submission-receipt-service.js";
import { ProfileService } from "../services/profile-service.js";
import { RelatedService } from "../services/related-service.js";
import { ReviewService } from "../services/review-service.js";
import { ScreenshotService } from "../services/screenshot-service.js";
import { TranslationService } from "../services/translation-service.js";
import { SubtitleService } from "../services/subtitle-service.js";
import { AccountService } from "../services/account-service.js";
import { SettingsService } from "../services/settings-service.js";
import { StorageService } from "../services/storage-service.js";
import { WebDavService } from "../services/webdav-service.js";
import { BusImageLayoutService } from "../services/bus-image-layout-service.js";
import { CredentialService } from "../services/credential-service.js";
import { Pan123CredentialService } from "../services/pan123-credential-service.js";
import { ClipboardService } from "../services/clipboard-service.js";
import { ResourceSettingsService } from "../services/resource-settings-service.js";
import { DomUiService } from "../services/dom-ui-service.js";
import { TitleKeywordService } from "../services/title-keyword-service.js";
import { LibraryStatsService } from "../services/library-stats-service.js";
import { StyleRegistry } from "../services/style-registry.js";
import { CommandRegistry } from "./command-registry.js";
import { DependencyContainer } from "./dependency-container.js";
import { FeatureRuntime } from "./feature-runtime.js";
import { ProviderRegistry } from "./provider-registry.js";
import { IntegrationRegistry } from "./integration-registry.js";
import { SettingsRegistry } from "./settings-registry.js";
import { registerDefaultSettings } from "./settings-catalog.js";
import { LifecycleScope } from "../core/lifecycle-scope.js";
import { parseDetailPage } from "../integrations/host-list/parser.js";

/** @param {{gmRequest: (options: Record<string, any>) => any, gmGetValue: (key: string, fallback?: unknown) => unknown, gmSetValue: (key: string, value: unknown) => void, gmDeleteValue?: (key: string) => void, legacyHttp?: any, legacyStorage?: any, legacyUtils?: any, copyToClipboard?: (label: string, value: unknown) => Promise<boolean>, eventBus?: any, storageMutationCoordinator?: any, storageForage: any, localStorage: Storage, layer: any, stateService: any, hostAdapter?: any, hostAdapters?: {javdb?: any, javbus?: any}, disabled?: string[], site?: string, route?: string, localOrigins?: string[]}} runtime */
export function createAppContext(runtime) {
    const diagnostics = new DiagnosticsService({ legacyHttp: runtime.legacyHttp });
    const rootScope = new LifecycleScope("app:root", { onChange: (snapshot) => diagnostics.updateScope(snapshot) });
    const container = new DependencyContainer(diagnostics);
    const navigationPort = new BrowserNavigationAdapter();
    const httpPort = new UserscriptHttpAdapter(runtime.gmRequest);
    const storagePort = new IndexedDbStorageAdapter(runtime.storageForage, runtime.localStorage, runtime.gmGetValue, runtime.gmSetValue, runtime.gmDeleteValue);
    const dialogPort = new LayerDialogAdapter(runtime.layer);
    const stylePort = new BrowserStyleAdapter();
    const urlPolicy = new ExternalUrlPolicy({ localOrigins: runtime.localOrigins });
    const navigation = new NavigationService(navigationPort);
    const storage = new StorageService(storagePort);
    const cache = new CacheService({ diagnostics, storage });
    const dialog = new DialogService(dialogPort);
    const styles = new StyleRegistry(stylePort);
    const settingsRegistry = new SettingsRegistry();
    registerDefaultSettings(settingsRegistry);
    const settings = new SettingsService(storage, { mutationCoordinator: runtime.storageMutationCoordinator, afterPersist: async (_snapshot, changedNames) => {
        runtime.legacyStorage?.invalidateSettingCache?.();
        await runtime.eventBus?.emit?.("settings-changed", { changedNames, source: "service" });
    }, normalizers: settingsRegistry.normalizers() });
    const notifications = Object.freeze({
        error: (/** @type {string} */ message, /** @type {Record<string, unknown>} */ options = {}) => (/** @type {any} */ (globalThis)).show?.error?.(message, options),
        info: (/** @type {string} */ message) => (/** @type {any} */ (globalThis)).show?.info?.(message),
        ok: (/** @type {string} */ message, /** @type {Record<string, unknown>} */ options = {}) => (/** @type {any} */ (globalThis)).show?.ok?.(message, options),
        debug: (/** @type {string} */ message, /** @type {unknown} */ error) => (/** @type {any} */ (globalThis)).clog?.debug?.(message, error),
    });
    const resourceSettings = new ResourceSettingsService({
        getSetting: async (/** @type {string} */ key, /** @type {unknown} */ fallback) => {
            const snapshot = settings.snapshot();
            return Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] : fallback;
        },
        saveSettingItem: (/** @type {string} */ key, /** @type {unknown} */ value) => settings.set(key, value),
        updateSetting: (/** @type {any} */ mutator) => settings.update(mutator),
    });
    const clipboard = new ClipboardService(runtime.copyToClipboard);
    const domUi = new DomUiService(
        /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$,
        runtime.legacyUtils,
        (image) => /** @type {any} */ (globalThis).showImageViewer?.(image),
        () => /** @type {any} */ (globalThis).loading?.(),
        (config) => {
            const factory = /** @type {any} */ (globalThis).ImageHoverPreview;
            if (typeof factory !== "function") throw new Error("图片悬浮预览尚未加载");
            return new factory(config);
        },
        /** @type {any} */ (globalThis).Tabulator,
    );
    const titleKeywords = new TitleKeywordService(runtime.legacyStorage);
    const http = new HttpService(httpPort, urlPolicy, { diagnostics, cache, settings });
    diagnostics.setNetworkController(http);
    const credential = new CredentialService(storage, runtime.localStorage);
    const pan123Credential = new Pan123CredentialService(storage, notifications);
    const webdav = new WebDavService(http, credential, settings);
    rootScope.listen(settings, "settings.changed", (/** @type {any} */ event) => {
        const names = /** @type {string[] | undefined} */ (event.detail?.names) ?? [];
        if (!names.includes("trustedLocalOrigins")) return;
        const trusted = settings.snapshot().trustedLocalOrigins;
        urlPolicy.replaceLocalOrigins(Array.isArray(trusted) ? trusted : []);
    });
    if (runtime.eventBus) rootScope.addCleanup(runtime.eventBus.on("settings-changed", async (/** @type {any} */ _payload, /** @type {any} */ event) => {
        // Remote tabs must refresh; local legacy writes (source === "legacy") also refresh because they bypassed
        // this SettingsService. Local service writes already updated the snapshot, so they are skipped.
        const remote = event.originId !== runtime.eventBus.originId;
        const localLegacy = event.originId === runtime.eventBus.originId && event.payload?.source === "legacy";
        if (!remote && !localLegacy) return;
        runtime.legacyStorage?.invalidateSettingCache?.();
        await settings.refresh();
    }));
    if (typeof window !== "undefined") {
        rootScope.listen(window, "pageshow", async () => {
            // BFCache restores the page without re-running bootstrap; re-read
            // settings so any change made in another tab/surface is reflected.
            runtime.legacyStorage?.invalidateSettingCache?.();
            await settings.refresh();
        });
    }
    const profile = new ProfileService({ scope: rootScope, settings });
    const commands = new CommandRegistry();
    const providers = new ProviderRegistry(diagnostics);
    const integrations = new IntegrationRegistry(container, diagnostics);
    const movie = new MovieIdentityService(integrations);
    const actressInfo = new ActressInfoService(integrations, cache);
    const imageSearch = new ImageSearchService(integrations);
    const review = new ReviewService(integrations);
    const related = new RelatedService(integrations);
    const magnet = new MagnetService(providers, integrations);
    const screenshot = new ScreenshotService(providers, integrations);
    const translation = new TranslationService(integrations, storage);
    const subtitle = new SubtitleService(integrations);
    const account = new AccountService(integrations);
    const offline = new OfflineService(providers, integrations);
    const offlineSubmissionReceipts = new OfflineSubmissionReceiptService(runtime.localStorage);
    const busImageLayout = new BusImageLayoutService();
    const libraryStats = new LibraryStatsService({ storage: runtime.legacyStorage, state: runtime.stateService });
    const hostListParser = Object.freeze({ parseDetailPage });

    container
        .register(PORT.navigation, navigationPort).register(PORT.http, httpPort).register(PORT.storage, storagePort)
        .register(PORT.dialog, dialogPort).register(PORT.style, stylePort)
        .register(SERVICE.diagnostics, diagnostics).register(SERVICE.urlPolicy, urlPolicy)
        .register(SERVICE.navigation, navigation).register(SERVICE.http, http).register(SERVICE.storage, storage)
        .register(SERVICE.legacyStorage, runtime.legacyStorage).register(SERVICE.legacyUtils, runtime.legacyUtils).register(SERVICE.webdav, webdav)
        .register(SERVICE.credential, credential)
        .register(SERVICE.pan123Credential, pan123Credential)
          .register(SERVICE.dialog, dialog).register(SERVICE.settings, settings).register(SERVICE.resourceSettings, resourceSettings).register(SERVICE.notifications, notifications).register(SERVICE.clipboard, clipboard).register(SERVICE.domUi, domUi).register(SERVICE.cache, cache).register(SERVICE.profile, profile)
        .register(SERVICE.state, runtime.stateService).register(SERVICE.titleKeywords, titleKeywords).register(SERVICE.storageMutation, runtime.storageMutationCoordinator).register(SERVICE.busImageLayout, busImageLayout).register(SERVICE.events, runtime.eventBus).register(SERVICE.libraryStats, libraryStats)
        .register(SERVICE.movie, movie).register(SERVICE.actressInfo, actressInfo).register(SERVICE.imageSearch, imageSearch).register(SERVICE.review, review).register(SERVICE.related, related).register(SERVICE.magnet, magnet)
        .register(SERVICE.screenshot, screenshot).register(SERVICE.offline, offline).register(SERVICE.offlineSubmissionReceipts, offlineSubmissionReceipts)
        .register(SERVICE.translation, translation).register(SERVICE.subtitle, subtitle).register(SERVICE.account, account).register(SERVICE.hostListParser, hostListParser)
        .register(REGISTRY.command, commands).register(REGISTRY.provider, providers).register(REGISTRY.integration, integrations).register(REGISTRY.settings, settingsRegistry);
    if (runtime.hostAdapter) container.register(PORT.host, runtime.hostAdapter);
    if (runtime.hostAdapters?.javdb) container.register(PORT.javdbHost, runtime.hostAdapters.javdb);
    if (runtime.hostAdapters?.javbus) container.register(PORT.javbusHost, runtime.hostAdapters.javbus);

    const features = new FeatureRuntime({ container, commands, diagnostics, disabled: runtime.disabled, site: runtime.site, route: runtime.route });
    container.register(REGISTRY.feature, features);
    return Object.freeze({ rootScope, container, ports: Object.freeze({ navigationPort, httpPort, storagePort, dialogPort, stylePort }), services: Object.freeze({ diagnostics, urlPolicy, navigation, http, storage, legacyStorage: runtime.legacyStorage, legacyUtils: runtime.legacyUtils, webdav, credential, pan123Credential, dialog, styles, settings, resourceSettings, notifications, clipboard, domUi, titleKeywords, cache, profile, state: runtime.stateService, storageMutation: runtime.storageMutationCoordinator, busImageLayout, movie, actressInfo, imageSearch, review, related, magnet, screenshot, translation, subtitle, account, offline, offlineSubmissionReceipts, hostListParser }), registries: Object.freeze({ commands, providers, integrations, settings: settingsRegistry, features }) });
}
