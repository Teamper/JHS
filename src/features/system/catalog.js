// @ts-check

import { parseDisabledPlugins } from "../../core/legacy-plugin-contributions.js";
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { openSettingsUi, registerSettingsUiOwner } from "../../core/settings-ui-owner.js";
import { LibraryStatsService } from "../../services/library-stats-service.js";
import { SettingsEffectsController } from "./settings-effects-controller.js";
import { SettingsEntryController } from "./settings-entry-controller.js";

export const systemFeatureManifests = Object.freeze([
    defineFeature({
        id: "webdav-sync", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "eager",
        requires: [SERVICE.settingsTools, PORT.host], contributes: [], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            /** @type {import("../../contracts/webdav-sync.js").WebDavSync} */
            const service = deps[SERVICE.settingsTools].webdavSync;
            await service.initialize();
            service.start(runtime.scope, deps[PORT.host].document);
            return { activeContributions: [] };
        },
    }),
    defineFeature({
        id: "settings-effects", kind: "system", disableable: false, sites: [], routes: [], startup: "eager",
        requires: [SERVICE.settings, SERVICE.profile, SERVICE.busImageLayout, SERVICE.clog], optionalRequires: [PORT.host], contributes: [], providesCommands: [],
        activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const controller = new SettingsEffectsController({
                settings: deps[SERVICE.settings], profile: deps[SERVICE.profile], imageLayout: deps[SERVICE.busImageLayout], hostAdapter: deps[PORT.host],
                diagnostics: runtime.diagnostics, logger: deps[SERVICE.clog], scope: runtime.scope,
            });
            controller.start();
            return { activeContributions: [] };
        },
    }),
    defineFeature({
        id: "settings-entry", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "eager", optionalRequires: [SERVICE.taskExecution],
        requires: [PORT.style, PORT.host, SERVICE.profile, SERVICE.dialog, SERVICE.storage, SERVICE.settings, SERVICE.settingsTools, SERVICE.keywordRules, SERVICE.http, SERVICE.offline, SERVICE.magnet, SERVICE.movie, SERVICE.state, SERVICE.translation, SERVICE.mediaLibrary, SERVICE.busImageLayout, SERVICE.events, SERVICE.domUi, SERVICE.clog, SERVICE.notifications], contributes: ["settings.core"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const pageDocument = deps[PORT.host].document;
            const pageWindow = pageDocument.defaultView;
            const { SettingPlugin } = await import("../settings/settings-controller.js");
            const adapter = new SettingPlugin({
                runtimeServices: {
                    ...deps[SERVICE.settingsTools], host: deps[PORT.host], diagnostics: runtime.diagnostics, profile: deps[SERVICE.profile],
                    dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], keywordRules: deps[SERVICE.keywordRules],
                    http: deps[SERVICE.http], offline: deps[SERVICE.offline].api, magnet: deps[SERVICE.magnet], movie: deps[SERVICE.movie],
                    state: deps[SERVICE.state], translation: deps[SERVICE.translation], mediaLibrary: deps[SERVICE.mediaLibrary], busImageLayout: deps[SERVICE.busImageLayout],
                    scope: () => runtime.scope,
                },
                readListPage: () => runtime.getCapability?.("list.core"),
                readNewVideo: () => runtime.getCapability?.("discovery.new-video"),
                readTask: () => deps[SERVICE.taskExecution] ?? runtime.getCapability?.("discovery.scheduler"),
                readCoverButtons: () => runtime.getCapability?.("detail.cover-state-actions"),
                readExternalSites: () => runtime.getCapability?.("detail.external-sites"),
                readBlacklist: () => runtime.getCapability?.("library.blacklist"),
                jquery: deps[SERVICE.domUi].jquery, utilities: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications],
                logger: deps[SERVICE.clog], events: deps[SERVICE.events], domUi: deps[SERVICE.domUi],
                document: pageDocument, window: pageWindow, site: runtime.site, route: runtime.route,
            });
            runtime.onCapabilityChanged("discovery.scheduler", () => adapter.renderTaskStatuses());
            runtime.provideCapability?.("settings.core", adapter);
            const release = runtime.registerCompatibilityBean?.("SettingPlugin", adapter);
            if (release) runtime.scope.addCleanup(release);
            try {
                const css = await adapter.initEntryCss();
                if (css) runtime.scope.addCleanup(deps[PORT.style].register("jhs-settings-feature", css.replace(/^\s*<style>|<\/style>\s*$/g, "")));
            } catch (error) {
                runtime.diagnostics.recordError({ source: "settings-entry", message: error instanceof Error ? error.message : String(error) });
                deps[SERVICE.clog].error?.("设置界面样式加载失败", error);
            }
            let fullStylesPromise = /** @type {Promise<void> | null} */ (null);
            adapter.fullSettingsStyleLoader = () => fullStylesPromise ??= (async () => {
                const css = await adapter.initCss();
                runtime.scope.assertActive();
                if (css) runtime.scope.addCleanup(deps[PORT.style].register("jhs-full-settings-feature", css.replace(/^\s*<style>|<\/style>\s*$/g, "")));
            })().catch(error => { fullStylesPromise = null; throw error; });
            const controller = new SettingsEntryController({
                document: pageDocument, scope: runtime.scope,
                initializeSurface: () => adapter.activateFeatureSurface(runtime.scope, deps[SERVICE.profile]),
                executeCommand: (command) => runtime.executeCommand(command),
                closeQuickSettings: () => adapter.disposeQuickSettings(),
                lowZIndex: () => deps[SERVICE.clog].lowZIndex?.(),
                onError: (error) => {
                    runtime.diagnostics.recordError({ source: "settings-entry", message: error instanceof Error ? error.message : String(error) });
                    deps[SERVICE.clog].error?.("设置中心打开失败", error);
                    deps[SERVICE.notifications].error?.("设置中心打开失败");
                },
            });
            controller.start();
            return { activeContributions: ["settings.core"] };
        },
    }),
    defineFeature({
        id: "settings", kind: "system", disableable: false, sites: [], routes: [], startup: "on-command",
        requires: [], contributes: [], providesCommands: ["settings.open"],
        activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
            const adapter = runtime.getCapability?.("settings.core");
            const cleanup = typeof adapter?.openSettingDialog === "function"
                ? registerSettingsUiOwner((panel) => adapter.openSettingDialog(panel))
                : () => {};
            runtime.scope.addCleanup(cleanup);
            return { commands: { "settings.open": (/** @type {string | undefined} */ panel) => openSettingsUi(panel) } };
        },
    }),
    defineFeature({
        id: "diagnostics", kind: "system", disableable: false, sites: [], routes: [], startup: "on-command",
        requires: [], contributes: [], providesCommands: ["diagnostics.export"],
        activate: (_deps, /** @type {any} */ runtime) => ({ commands: { "diagnostics.export": () => runtime.diagnostics.exportSnapshot() } }),
    }),
    defineFeature({
        id: "responsive-shell", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "idle",
        requires: [PORT.host, PORT.style, SERVICE.clog, SERVICE.domUi, SERVICE.notifications, SERVICE.profile, SERVICE.settings, SERVICE.state, SERVICE.privacy, SERVICE.movieSelection],
        contributes: ["responsive-shell.bottom-bar"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const id = "responsive-shell.bottom-bar";
            if (!runtime.enabledContributions.includes(id)) return { activeContributions: [] };
            const { ResponsiveShellController } = await import("./responsive-shell-controller.js");
            const controller = new ResponsiveShellController({
                jquery: deps[SERVICE.domUi].jquery, window, document,
                profile: deps[SERVICE.profile], settings: deps[SERVICE.settings], host: deps[PORT.host],
                state: deps[SERVICE.state], logger: deps[SERVICE.clog], notifications: deps[SERVICE.notifications],
                capabilities: {
                    get listPage() { return runtime.getCapability("list.core"); },
                    get listActions() { return runtime.getCapability("list.actions"); },
                    get settings() { return runtime.getCapability("settings.core"); },
                    get detailActions() { return runtime.getCapability("detail.page-state-actions"); },
                },
                privacyActions: { available: () => runtime.isCommandAvailable("privacy.toggle"), enabled: () => deps[SERVICE.privacy].enabled, toggle: () => runtime.executeCommand("privacy.toggle"), configure: () => runtime.executeCommand("privacy.configure"), bindReveal: (/** @type {HTMLElement} */ button, /** @type {any} */ scope) => runtime.executeCommand("privacy.bind-reveal", button, scope) },
                mediaActions: { available: () => runtime.isCommandAvailable("media.configure") && !parseDisabledPlugins(deps[SERVICE.settings].snapshot().disabledPlugins).includes("media-library"), configure: () => runtime.executeCommand("media.configure") },
                openNewVideo: () => runtime.executeCommand("new-video.open"),
                magnetActions: {
                    filterAvailable: () => Boolean(runtime.getCapability("detail.native-magnets")),
                    hubAvailable: () => Boolean(runtime.getCapability("detail.external-magnets")),
                },
                newVideoAvailable: () => runtime.isContributionEnabled("new-video", "discovery.new-video", "NewVideoPlugin"),
                blacklist: {
                    available: () => runtime.isContributionEnabled("library", "library.blacklist", "BlacklistPlugin"),
                    open: () => runtime.executeCommand("library.blacklist.open"),
                },
                history: {
                    available: () => runtime.isContributionEnabled("library", "library.history", "HistoryPlugin"),
                    open: () => runtime.executeCommand("library.history.open"),
                },
                getPageActions: async () => {
                    const actions = await runtime.executeCommand("list.get-page-actions");
                    const count = deps[SERVICE.movieSelection].values().length;
                    for (const [command, label] of [["selection.toggle", "进入 / 退出选择"], ["library.rating.open", "为所选影片评分"], ["translation.selection", "翻译所选影片"], ["library.lists.open", "管理清单与恢复"]]) {
                        if (runtime.isCommandAvailable(command)) actions.push({ id: "enhancement-" + command, label, group: "batch", enabled: command === "selection.toggle" || command === "library.lists.open" || count > 0 });
                    }
                    return actions;
                },
                executePageAction: (action) => action.startsWith("enhancement-") ? runtime.executeCommand(action.slice(12), deps[SERVICE.movieSelection].values()) : runtime.executeCommand("list.execute-page-action", action),
            });
            let releaseStyles = () => {};
            try {
                releaseStyles = deps[PORT.style].register("feature-responsive-shell", await controller.initCss());
                runtime.scope.addCleanup(releaseStyles);
                controller.start(runtime.scope);
                return { activeContributions: [id], dispose: () => controller.dispose() };
            } catch (error) {
                controller.dispose();
                releaseStyles();
                runtime.diagnostics.recordError({ source: "responsive-shell-feature", featureId: "responsive-shell", contributionId: id, message: error instanceof Error ? error.message : String(error) });
                return { activeContributions: [] };
            }
        },
    }),
    defineFeature({
        id: "stats", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "idle",
        requires: [SERVICE.state, SERVICE.notifications, SERVICE.movie, SERVICE.settings, SERVICE.dialog, SERVICE.events, SERVICE.domUi, PORT.style],
        contributes: ["stats.dashboard"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const { StatsController } = await import("./stats-controller.js");
            const libraryStats = new LibraryStatsService({ state: deps[SERVICE.state] });
            const controller = new StatsController({
                document,
                libraryStats, diagnostics: runtime.diagnostics, notifications: deps[SERVICE.notifications],
                movie: deps[SERVICE.movie], settings: deps[SERVICE.settings], dialog: deps[SERVICE.dialog],
                events: deps[SERVICE.events], ui: deps[SERVICE.domUi], styles: deps[PORT.style], scope: runtime.scope,
                getPendingNewVideoTotal: async () => {
                    if (!runtime.isContributionEnabled("new-video", "discovery.new-video", "NewVideoPlugin")) return 0;
                    try { return await libraryStats.getPendingNewVideoTotal(); }
                    catch (error) {
                        runtime.diagnostics.recordError({ source: "stats-feature", featureId: "stats", contributionId: "stats.dashboard", message: error instanceof Error ? error.message : String(error) });
                        return 0;
                    }
                },
                getCurrentPageSummary: async () => {
                    if (!runtime.isContributionEnabled("list", "list.core", "ListPagePlugin")) return { blockedItems: 0 };
                    try { return await runtime.executeCommand("list.current-page-summary") ?? { blockedItems: 0 }; }
                    catch (error) {
                        runtime.diagnostics.recordError({ source: "stats-feature", featureId: "stats", contributionId: "stats.dashboard", message: error instanceof Error ? error.message : String(error) });
                        return { blockedItems: 0 };
                    }
                },
                setQuickFilter: async (filter) => {
                    if (!runtime.isContributionEnabled("list", "list.core", "ListPagePlugin")) return;
                    try { await runtime.executeCommand("list.set-quick-filter", filter); }
                    catch (error) {
                        runtime.diagnostics.recordError({ source: "stats-feature", featureId: "stats", contributionId: "stats.dashboard", message: error instanceof Error ? error.message : String(error) });
                    }
                },
                openNewVideo: () => runtime.executeCommand("new-video.open"),
            });
            try {
                controller.start();
                return { activeContributions: ["stats.dashboard"], dispose: () => controller.dispose() };
            } catch (error) {
                controller.dispose();
                runtime.diagnostics.recordError({ source: "stats-feature", featureId: "stats", contributionId: "stats.dashboard", message: error instanceof Error ? error.message : String(error) });
                return { activeContributions: [] };
            }
        },
    }),
]);
