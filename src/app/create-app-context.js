// @ts-check

import { PORT, REGISTRY, SERVICE } from "../contracts/tokens.js";
import { BrowserNavigationAdapter } from "../platform/browser/browser-navigation-adapter.js";
import { BrowserStyleAdapter } from "../platform/browser/browser-style-adapter.js";
import { createClipboardWriter, downloadFile } from "../platform/browser/file-actions.js";
import { isMobileMode } from "../core/dom-actions.js";
import { createPageDialogs } from "../platform/browser/page-dialogs.js";
import { getDialogArea } from "../core/dialog-shell.js";
import { DialogEscController } from "../core/dialog-esc-controller.js";
import { LayerDialogAdapter } from "../platform/userscript/layer-dialog-adapter.js";
import { UserscriptHttpAdapter } from "../platform/userscript/userscript-http-adapter.js";
import { CacheService } from "../services/cache-service.js";
import { KeywordRulesService } from "../services/keyword-rules-service.js";
import { PortableBackupService } from "../services/portable-backup-service.js";
import { ActressInfoService } from "../services/actress-info-service.js";
import { DiagnosticsService } from "../services/diagnostics-service.js";
import { ExternalUrlPolicy } from "../services/external-url-policy.js";
import { HttpService } from "../services/http-service.js";
import { MagnetService } from "../services/magnet-service.js";
import { MovieIdentityService } from "../services/movie-identity-service.js";
import { OneOneFiveMatchService } from "../services/one-one-five-match-service.js";
import { OfflineService } from "../services/offline-service.js";
import { OfflineSubmissionReceiptService } from "../services/offline-submission-receipt-service.js";
import { MediaLibraryService } from "../services/media-library-service.js";
import { JavDbListService } from "../services/javdb-list-service.js";
import { MOVIE_SELECTION_KEY, MovieSelectionService } from "../services/movie-selection-service.js";
import { PrivacyService } from "../services/privacy-service.js";
import { ProfileService } from "../services/profile-service.js";
import { ScreenshotService } from "../services/screenshot-service.js";
import { TranslationService } from "../services/translation-service.js";
import { SubtitleUploadService } from "../services/subtitle-upload-service.js";
import { SubtitleService } from "../services/subtitle-service.js";
import { AccountService } from "../services/account-service.js";
import { SettingsService } from "../services/settings-service.js";
import { WebDavService } from "../services/webdav-service.js";
import { WebDavSyncService } from "../services/webdav-sync-service.js";
import { WebDavSharedProfile } from "../services/webdav-shared-profile.js";
import { WebDavSyncStore } from "../core/webdav-sync-store.js";
import { PersonalPreferencesService } from "../services/personal-preferences-service.js";
import { StateService } from "../core/state-service.js";
import { StorageMutationCoordinator } from "../core/storage-mutation-coordinator.js";
import { BusImageLayoutService } from "../services/bus-image-layout-service.js";
import { JavDbWantService } from "../services/javdb-want-service.js";
import { bindJavDbWantService } from "../core/javdb-api.js";
import { CredentialService } from "../services/credential-service.js";
import { OfflineTaskQueryService } from "../services/offline-task-query-service.js";
import { Pan123CredentialService } from "../services/pan123-credential-service.js";
import { ResourceSettingsService } from "../services/resource-settings-service.js";
import { DomUiService } from "../services/dom-ui-service.js";
import { CommandRegistry } from "./command-registry.js";
import { DependencyContainer } from "./dependency-container.js";
import { FeatureRuntime } from "./feature-runtime.js";
import { ProviderRegistry } from "./provider-registry.js";
import { IntegrationRegistry } from "./integration-registry.js";
import { SettingsRegistry } from "./settings-registry.js";
import { registerDefaultSettings } from "./settings-catalog.js";
import { ComputationBudget } from "../core/cooperative-work.js";
import { SyncComputation } from "../services/sync-computation-service.js";
import { createSyncWorker } from "../platform/userscript/sync-worker-factory.js";
import { BackgroundWork } from "../core/background-work.js";
import { LifecycleScope } from "../core/lifecycle-scope.js";

/** @typedef {{clog: any, show?: {error?: Function, info?: Function, ok?: Function}, loading?: () => {close?: () => void}, showImageViewer?: (source: string | Element, alt?: string, options?: Record<string, any>) => unknown, ImageHoverPreview?: new (config: Record<string, unknown>) => any}} FeedbackRuntime */

/** @param {{createFeedback?: (scope: LifecycleScope) => FeedbackRuntime, vendors?: {$?: (value: any) => any, Tabulator?: any}, gmRequest: (options: Record<string, any>) => any, storage: import("../services/storage-service.js").StorageService, dialogEsc?: DialogEscController, eventBus?: any, storageMutationCoordinator?: StorageMutationCoordinator, localStorage: Storage, layer: any, hostAdapter?: any, hostAdapters?: {javdb?: any, javbus?: any}, disabled?: string[], site?: string, route?: string, localOrigins?: string[], platform?: Record<string, any>}} runtime */
export function createAppContext(runtime) {
    const diagnostics = new DiagnosticsService();
    const rootScope = new LifecycleScope("app:root", { onChange: (snapshot) => diagnostics.updateScope(snapshot) });
    const feedback = runtime.createFeedback?.(rootScope) ?? { clog: console };
    const platform = runtime.platform ?? {};
    const backgroundWork = platform.backgroundWork ?? new BackgroundWork({ document: runtime.hostAdapter?.document ?? document, window, scope: rootScope });
    const container = new DependencyContainer(diagnostics);
    const navigation = platform.navigation ?? new BrowserNavigationAdapter();
    const httpPort = platform.http ?? new UserscriptHttpAdapter(runtime.gmRequest);
    const { storage } = runtime, storagePort = storage.port;
    const mutationCoordinator = runtime.storageMutationCoordinator ?? new StorageMutationCoordinator();
    const dialogEsc = runtime.dialogEsc ?? new DialogEscController({
        jquery: runtime.vendors?.$ ?? (() => { throw new Error("页面 UI 依赖尚未加载"); }),
        close: id => runtime.layer.close(id), document,
    });
    dialogEsc.logger = feedback.clog;
    rootScope.addCleanup(() => dialogEsc.dispose());
    /** @type {import("../contracts/ports.js").DialogPort} */
    const dialog = platform.createDialog?.(dialogEsc) ?? platform.dialog ?? new LayerDialogAdapter(runtime.layer, { getDialogArea });
    const styles = new BrowserStyleAdapter();
    const urlPolicy = new ExternalUrlPolicy({ localOrigins: runtime.localOrigins });
    const cache = new CacheService({ diagnostics, storage, mutationCoordinator, thirdPartyMutations: platform.thirdPartyMutations });
    const settingsRegistry = new SettingsRegistry();
    registerDefaultSettings(settingsRegistry);
    const validateSetting = (/** @type {string} */ key, /** @type {any} */ value) => settingsRegistry.validateSync(key, value);
    const settings = platform.settings ?? new SettingsService(storage, { mutationCoordinator, logger: feedback.clog, afterPersist: async (_snapshot, changedNames) => {
        await runtime.eventBus?.emit?.("settings-changed", { changedNames, source: "service" });
    }, normalizers: settingsRegistry.normalizers() });
    const notifications = Object.freeze({
        error: (/** @type {string} */ message, /** @type {Record<string, unknown>} */ options = {}) => feedback.show?.error?.(message, options),
        info: (/** @type {string} */ message) => feedback.show?.info?.(message),
        ok: (/** @type {string} */ message, /** @type {Record<string, unknown>} */ options = {}) => feedback.show?.ok?.(message, options),
        debug: (/** @type {string} */ message, /** @type {unknown} */ error) => feedback.clog.debug?.(message, error),
    });
    if (runtime.eventBus && !runtime.eventBus.errorReporter) runtime.eventBus.errorReporter = (/** @type {unknown} */ error) => feedback.clog.error("[JHS] event listener failed:", error);
    const resourceSettings = new ResourceSettingsService(settings);
    const clipboard = { copyText: createClipboardWriter(notifications, feedback.clog) };
    feedback.clog.copyText ??= clipboard.copyText;
    const mobile = () => isMobileMode(settings.snapshot().mobileMode);
    const pageDialogs = createPageDialogs({ dialog, navigation, esc: dialogEsc, settings, isMobileMode: mobile, logger: feedback.clog });
    const { ImageHoverPreview } = feedback;
    const domUi = new DomUiService(
        runtime.vendors?.$,
        { ...pageDialogs, navigation,
            isMobileMode: mobile,
            setupEscClose: dialogEsc.setupEscClose.bind(dialogEsc),
            releaseEscClose: dialogEsc.releaseEscClose.bind(dialogEsc),
            download: platform.download ?? ((/** @type {BlobPart | Blob} */ data, /** @type {string} */ filename) => {
                notifications.info("开始请求下载...");
                downloadFile(data, filename);
            }),
        },
        feedback.showImageViewer,
        feedback.loading,
        ImageHoverPreview && (config => new ImageHoverPreview(config)),
        runtime.vendors?.Tabulator,
    );
    const http = new HttpService(httpPort, urlPolicy, { diagnostics, cache, settings });
    diagnostics.setNetworkController(http);
    const privacy = new PrivacyService({ storage, settings });
    rootScope.addCleanup(() => privacy.dispose());
    const credential = platform.credential ?? new CredentialService(storage, runtime.localStorage);
    rootScope.addCleanup(() => credential.dispose());
    const pan123Credential = new Pan123CredentialService(storage, notifications);
    const webdav = new WebDavService(http, credential, settings);
    mutationCoordinator.diagnostics = diagnostics;
    const computation = new SyncComputation({ createWorker: platform.createWorker ?? createSyncWorker, diagnostics });
    rootScope.addCleanup(() => computation.dispose());
    const syncState = platform.syncState ?? new WebDavSyncStore({
        computation, storage, coordinator: mutationCoordinator, settings, events: runtime.eventBus,
        validateSetting, diagnostics, backgroundWork, recoverState: () => state.recoverPendingTransactionWithoutLock(),
    });
    const state = platform.state ?? new StateService(storage, runtime.eventBus ?? {}, mutationCoordinator, { sync: syncState, logger: feedback.clog, notifications });
    if (!platform.state) state.computation = new ComputationBudget({ diagnostics });
    rootScope.addCleanup(() => syncState.dispose());
    for (const type of ["car-state-changed", "offline-history-changed", "actress-changed", "settings-changed"]) {
        const unsubscribe = runtime.eventBus?.on?.(type, (/** @type {any} */ _payload, /** @type {any} */ event) => {
            if (!platform.state && type === "car-state-changed" && event.originId !== runtime.eventBus.originId) state.clearCommittedListSnapshot();
            syncState.requestReconciliation();
        });
        if (unsubscribe) rootScope.addCleanup(unsubscribe);
    }
    mutationCoordinator.observer = syncState;
    mutationCoordinator.beforeMutation = syncState.recoverBeforeMutation;
    storage.beforeWrite = key => syncState.capture(key);
    const keywordRules = platform.keywordRules ?? new KeywordRulesService({ storage, coordinator: mutationCoordinator, state });
    const backup = platform.backup ?? new PortableBackupService({
        storage, coordinator: mutationCoordinator, state, sync: syncState, settings, logger: feedback.clog,
    });
    const sharedProfile = new WebDavSharedProfile({ credential, storage, origin: globalThis.location?.origin || "", readLegacy: () => settings.runExclusive(() => webdav.readProfileWithoutLock()) });
    webdav.sharedProfile = sharedProfile;
    const preferences = new PersonalPreferencesService(settings, runtime.localStorage, message => notifications.error(message));
    storage.preferences = preferences;
    /** @type {import("../contracts/webdav-sync.js").WebDavSync} */
    const webdavSync = platform.webdavSync ?? new WebDavSyncService({ computation, diagnostics, backgroundWork, webdav, shared: sharedProfile, store: syncState, settings, backup, urlPolicy, preferences, validateSetting });
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
        await settings.refresh();
    }));
    if (typeof window !== "undefined") {
        rootScope.listen(window, "pageshow", async () => {
            // BFCache restores the page without re-running bootstrap; re-read
            // settings so any change made in another tab/surface is reflected.
            await settings.refresh();
        });
    }
    const profile = new ProfileService({ scope: rootScope, settings });
    const commands = new CommandRegistry();
    const providers = new ProviderRegistry(diagnostics);
    const integrations = new IntegrationRegistry(container, diagnostics);
    const mediaLibrary = new MediaLibraryService({ integrations, credential, storage, settings, urlPolicy });
    rootScope.addCleanup(() => mediaLibrary.dispose());
    const javdbLists = new JavDbListService({ integrations, storage, context: () => runtime.hostAdapter?.getWebAccountContext?.() });
    rootScope.addCleanup(() => { void javdbLists.dispose(); });
    const movieSelection = new MovieSelectionService({ origin: window.location.origin, read: () => window.sessionStorage.getItem(MOVIE_SELECTION_KEY), write: value => window.sessionStorage.setItem(MOVIE_SELECTION_KEY, value) });
    const movie = new MovieIdentityService(integrations);
    const actressInfo = new ActressInfoService(integrations, cache);
    const review = { list: (/** @type {Record<string, unknown>} */ movieRef, /** @type {Record<string, any>} */ options = {}) => integrations.invokeList("movie.reviews", "listReviews", movieRef, options) };
    const related = { list: (/** @type {Record<string, unknown>} */ movieRef, /** @type {Record<string, any>} */ options = {}) => integrations.invokeList("movie.related", "listRelated", movieRef, options) };
    const magnet = new MagnetService(providers, integrations);
    const screenshot = new ScreenshotService(providers, integrations, diagnostics);
    const translation = new TranslationService(integrations, storage, {credential,settings,urlPolicy,diagnostics,enabled:true,googleOnly:platform.googleTranslationOnly});
    rootScope.addCleanup(() => translation.dispose());
    const subtitle = new SubtitleService(integrations);
    const account = new AccountService(integrations, javdbLists);
    const javdbWant = new JavDbWantService({ http, credential, invalidate: id => cache.deleteThirdPartyCacheEntry(`movie-detail:${id}`) });
    account.want = javdbWant;
    rootScope.addCleanup(bindJavDbWantService(javdbWant));
    rootScope.addCleanup(() => javdbWant.dispose());
    const offline = new OfflineService(providers, integrations);
    const offlineTasks = new OfflineTaskQueryService({ offline, storage, settings, token: () => pan123Credential.getStoredToken() });
    const one115Match = new OneOneFiveMatchService(offline);
    const subtitleUpload = new SubtitleUploadService({ offline, storage, matching: one115Match, events: runtime.eventBus });
    const offlineSubmissionReceipts = platform.receipts ?? new OfflineSubmissionReceiptService(runtime.localStorage);
    const busImageLayout = new BusImageLayoutService();

    container
        .register(PORT.style, styles)
        .register(SERVICE.clog, feedback.clog).register(SERVICE.http, http).register(SERVICE.storage, storage)
        .register(SERVICE.settingsTools, Object.freeze({ webdav, webdavSync, cache, backup, resourceSettings, settingsRegistry }))
        .register(SERVICE.credential, credential).register(SERVICE.privacy, privacy).register(SERVICE.mediaLibrary, mediaLibrary)
        .register(SERVICE.javdbLists, javdbLists).register(SERVICE.movieSelection, movieSelection)
        .register(SERVICE.dialog, dialog).register(SERVICE.settings, settings).register(SERVICE.notifications, notifications)
        .register(SERVICE.clipboard, clipboard).register(SERVICE.domUi, domUi).register(SERVICE.keywordRules, keywordRules).register(SERVICE.profile, profile)
        .register(SERVICE.state, state).register(SERVICE.storageMutation, mutationCoordinator).register(SERVICE.busImageLayout, busImageLayout).register(SERVICE.events, runtime.eventBus)
        .register(SERVICE.movie, movie).register(SERVICE.actressInfo, actressInfo).register(SERVICE.detailContent, Object.freeze({ review, related })).register(SERVICE.magnet, magnet)
        .register(SERVICE.screenshot, screenshot).register(SERVICE.offline, Object.freeze({ api: offline, match: one115Match, receipts: offlineSubmissionReceipts, pan123Credential, tasks: offlineTasks }))
        .register(SERVICE.translation, translation).register(SERVICE.subtitle, Object.freeze({ search: subtitle, upload: subtitleUpload })).register(SERVICE.account, account)
        .register(REGISTRY.integration, integrations);
    if (runtime.hostAdapter) container.register(PORT.host, runtime.hostAdapter);
    if (platform.taskExecution) container.register(SERVICE.taskExecution, platform.taskExecution);
    if (runtime.hostAdapters?.javdb) container.register(PORT.javdbHost, runtime.hostAdapters.javdb);
    if (runtime.hostAdapters?.javbus) container.register(PORT.javbusHost, runtime.hostAdapters.javbus);

    const features = new FeatureRuntime({ backgroundWork, container, commands, diagnostics, disabled: runtime.disabled, site: runtime.site, route: runtime.route, enabledFeatures: platform.enabledFeatures });

    rootScope.listen(settings, "settings.changed", event => {
        const names = /** @type {any} */ (event).detail?.names || [];
        if (names.some((/** @type {string} */ name) => ["disabledPlugins", "enableSubtitle115Upload", "enableMediaLibrary"].includes(name))) {
            void features.reconcileConfiguration(settings.snapshot()).catch(error => diagnostics.recordError(error));
        }
    });
    return Object.freeze({ rootScope, feedback, container, ports: Object.freeze({ navigationPort: navigation, httpPort, storagePort, dialogPort: dialog, stylePort: styles }), services: Object.freeze({ backgroundWork, diagnostics, urlPolicy, navigation, http, storage, webdav, webdavSync, privacy, mediaLibrary, javdbLists, movieSelection, credential, pan123Credential, dialog, styles, settings, resourceSettings, notifications, clipboard, domUi, cache, keywordRules, backup, syncState, profile, state, storageMutation: mutationCoordinator, busImageLayout, movie, actressInfo, review, related, magnet, screenshot, translation, subtitle, subtitleUpload, account, offline, one115Match, offlineSubmissionReceipts }), registries: Object.freeze({ commands, providers, integrations, settings: settingsRegistry, features }) });
}
