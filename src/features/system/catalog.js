// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { openSettingsUi, registerSettingsUiOwner } from "../../core/settings-ui-owner.js";
import { SettingsEffectsController } from "./settings-effects-controller.js";
import { SettingsEntryController } from "./settings-entry-controller.js";

export const systemFeatureManifests = Object.freeze([
    defineFeature({
        id: "settings-effects", kind: "system", disableable: false, sites: [], routes: [], startup: "eager",
        requires: [SERVICE.diagnostics, SERVICE.settings, SERVICE.profile, SERVICE.busImageLayout, SERVICE.clog], optionalRequires: [PORT.host], contributes: [], providesCommands: [],
        activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const controller = new SettingsEffectsController({
                settings: deps[SERVICE.settings], profile: deps[SERVICE.profile], imageLayout: deps[SERVICE.busImageLayout], hostAdapter: deps[PORT.host],
                diagnostics: deps[SERVICE.diagnostics], logger: deps[SERVICE.clog], scope: runtime.scope,
            });
            controller.start();
            return { activeContributions: [] };
        },
    }),
    defineFeature({
        id: "settings-entry", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "eager",
        requires: [PORT.style, PORT.host, SERVICE.diagnostics, SERVICE.profile, SERVICE.webdav, SERVICE.dialog, SERVICE.storage, SERVICE.settings, SERVICE.cache, SERVICE.http, SERVICE.offline, SERVICE.magnet, SERVICE.movie, SERVICE.state, SERVICE.translation, SERVICE.busImageLayout, REGISTRY.settings, SERVICE.legacyStorage, SERVICE.legacyUtils, SERVICE.events, SERVICE.domUi, SERVICE.clog, SERVICE.notifications], contributes: ["settings.core"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const pageDocument = deps[PORT.host].document;
            const pageWindow = pageDocument.defaultView;
            const compatibilityBean = runtime.resolveCompatibilityBean("SettingPlugin");
            /** @type {any} */ let adapter = null;
            if (compatibilityBean?.createFeatureService && compatibilityBean?.connect) {
                adapter = compatibilityBean.createFeatureService({
                    runtimeServices: {
                        host: deps[PORT.host], diagnostics: deps[SERVICE.diagnostics], profile: deps[SERVICE.profile], webdav: deps[SERVICE.webdav],
                        dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], cache: deps[SERVICE.cache],
                        http: deps[SERVICE.http], offline: deps[SERVICE.offline], magnet: deps[SERVICE.magnet], movie: deps[SERVICE.movie],
                        state: deps[SERVICE.state], translation: deps[SERVICE.translation], busImageLayout: deps[SERVICE.busImageLayout],
                        settingsRegistry: deps[REGISTRY.settings], scope: () => runtime.scope,
                    },
                    capabilities: Object.fromEntries(["ListPagePlugin", "NewVideoPlugin", "BlacklistPlugin", "TaskPlugin"].map((name) => [name, runtime.resolveCompatibilityBean(name)])),
                    jquery: deps[SERVICE.domUi].jquery, utilities: deps[SERVICE.legacyUtils], notifications: deps[SERVICE.notifications],
                    logger: deps[SERVICE.clog], legacyStorage: deps[SERVICE.legacyStorage], events: deps[SERVICE.events], domUi: deps[SERVICE.domUi],
                    document: pageDocument, window: pageWindow, site: runtime.site, route: runtime.route,
                });
                compatibilityBean.connect(adapter);
                runtime.scope.addCleanup(() => compatibilityBean.disconnect(adapter));
            }
            try {
                const css = await adapter?.initCss?.();
                if (css) runtime.scope.addCleanup(deps[PORT.style].register("jhs-settings-feature", css.replace(/^\s*<style>|<\/style>\s*$/g, "")));
            } catch (error) {
                runtime.diagnostics.recordError({ source: "settings-entry", message: error instanceof Error ? error.message : String(error) });
                deps[SERVICE.clog].error?.("设置界面样式加载失败", error);
            }
            const controller = new SettingsEntryController({
                document: pageDocument, scope: runtime.scope,
                initializeSurface: () => adapter?.activateFeatureSurface?.(runtime.scope, deps[SERVICE.profile]),
                executeCommand: (command) => runtime.executeCommand(command),
                closeQuickSettings: () => adapter?.disposeQuickSettings?.(),
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
        requires: [SERVICE.diagnostics], contributes: [], providesCommands: ["settings.open"],
        activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
            const adapter = runtime.resolveCompatibilityBean("SettingPlugin");
            const cleanup = typeof adapter?.openSettingDialog === "function"
                ? registerSettingsUiOwner((panel) => adapter.openSettingDialog(panel))
                : () => {};
            runtime.scope.addCleanup(cleanup);
            return { commands: { "settings.open": (/** @type {string | undefined} */ panel) => openSettingsUi(panel) } };
        },
    }),
    defineFeature({
        id: "diagnostics", kind: "system", disableable: false, sites: [], routes: [], startup: "on-command",
        requires: [SERVICE.diagnostics], contributes: [], providesCommands: ["diagnostics.export"],
        activate: (/** @type {any} */ deps) => ({ commands: { "diagnostics.export": () => deps[SERVICE.diagnostics].exportSnapshot() } }),
    }),
    defineFeature({
        id: "responsive-shell", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "idle",
        requires: [PORT.host, PORT.style, SERVICE.clog, SERVICE.domUi, SERVICE.notifications, SERVICE.profile, SERVICE.settings, SERVICE.state],
        contributes: ["responsive-shell.bottom-bar"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const id = "responsive-shell.bottom-bar";
            if (!runtime.enabledContributions.includes(id)) return { activeContributions: [] };
            const { RESPONSIVE_SHELL_CAPABILITIES, ResponsiveShellController } = await import("./responsive-shell-controller.js");
            const bridge = runtime.resolveCompatibilityBean("MobileBottomBarPlugin");
            if (!bridge) throw new Error("Responsive shell compatibility bridge is unavailable");
            const capabilities = Object.fromEntries(RESPONSIVE_SHELL_CAPABILITIES.map((name) => [name, runtime.resolveCompatibilityBean(name) ?? null]));
            const controller = new ResponsiveShellController({
                jquery: deps[SERVICE.domUi].jquery, window, document,
                profile: deps[SERVICE.profile], settings: deps[SERVICE.settings], host: deps[PORT.host],
                state: deps[SERVICE.state], logger: deps[SERVICE.clog], notifications: deps[SERVICE.notifications], capabilities,
                openNewVideo: () => runtime.executeCommand("new-video.open"),
            });
            let releaseStyles = () => {};
            try {
                releaseStyles = deps[PORT.style].register("feature-responsive-shell", await controller.initCss());
                runtime.scope.addCleanup(releaseStyles);
                bridge.attachController(controller);
                runtime.scope.addCleanup(() => bridge.detachController(controller));
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
        requires: [SERVICE.libraryStats, SERVICE.diagnostics, SERVICE.notifications, SERVICE.movie, SERVICE.settings, SERVICE.dialog, SERVICE.events, SERVICE.domUi, PORT.style],
        contributes: ["stats.dashboard"], providesCommands: [],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const { StatsController } = await import("./stats-controller.js");
            const controller = new StatsController({
                document,
                libraryStats: deps[SERVICE.libraryStats], diagnostics: deps[SERVICE.diagnostics], notifications: deps[SERVICE.notifications],
                movie: deps[SERVICE.movie], settings: deps[SERVICE.settings], dialog: deps[SERVICE.dialog],
                events: deps[SERVICE.events], ui: deps[SERVICE.domUi], styles: deps[PORT.style], scope: runtime.scope,
                getPendingNewVideoTotal: async () => {
                    if (!runtime.isContributionEnabled("new-video", "discovery.new-video", "NewVideoPlugin")) return 0;
                    try { return await deps[SERVICE.libraryStats].getPendingNewVideoTotal(); }
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
