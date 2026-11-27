// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { SettingsEntryController } from "./settings-entry-controller.js";

export default defineFeature({
        id: "settings-entry", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "eager", optionalRequires: [SERVICE.taskExecution],
        requires: [PORT.style, PORT.host, SERVICE.profile, SERVICE.dialog, SERVICE.storage, SERVICE.settings, SERVICE.settingsTools, SERVICE.keywordRules, SERVICE.http, SERVICE.offline, SERVICE.magnet, SERVICE.movie, SERVICE.state, SERVICE.translation, SERVICE.mediaLibrary, SERVICE.busImageLayout, SERVICE.events, SERVICE.domUi, SERVICE.clog, SERVICE.notifications], contributes: ["settings.core"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const pageDocument = deps[PORT.host].document;
            const pageWindow = pageDocument.defaultView;
            const { SettingPlugin } = await import("./settings-controller.js");
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
                const css = adapter.initEntryCss();
                if (css) runtime.scope.addCleanup(deps[PORT.style].register("jhs-settings-feature", css));
            } catch (error) {
                runtime.diagnostics.recordError({ source: "settings-entry", message: error instanceof Error ? error.message : String(error) });
                deps[SERVICE.clog].error?.("设置界面样式加载失败", error);
            }
            let fullStylesPromise = /** @type {Promise<void> | null} */ (null);
            adapter.fullSettingsStyleLoader = () => fullStylesPromise ??= (async () => {
                const css = adapter.initCss();
                runtime.scope.assertActive();
                if (css) runtime.scope.addCleanup(deps[PORT.style].register("jhs-full-settings-feature", css));
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
    });
