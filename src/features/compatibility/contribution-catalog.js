// @ts-check

import { defineContribution } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { ListPagePluginAdapter } from "../../compat/list-page-adapter.js";
import { RelatedCompatibilityBean, ReviewCompatibilityBean } from "../../compat/detail-panel-beans.js";
import { ResponsiveShellBridge } from "../../compat/responsive-shell-bridge.js";
import { RelatedPanel } from "../../ui/detail/related-panel.js";
import { ReviewPanel } from "../../ui/detail/review-panel.js";
import { BlacklistCompatibilityBean } from "../../compat/blacklist-compatibility-bean.js";
import { HistoryCompatibilityBean } from "../../compat/history-compatibility-bean.js";
import { SettingsCompatibilityBean } from "../../compat/settings-compatibility-bean.js";
import { SettingPlugin } from "../../plugins/backup/setting.js";

import { TaskCompatibilityBean } from "../../compat/task-compatibility-bean.js";
import { NewVideoCompatibilityBean } from "../../compat/new-video-compatibility-bean.js";

/** @param {string} id @param {string} featureId @param {any} plugin @param {string[]} sites @param {Record<string, number>} order @param {symbol[]} [requires] @param {{legacyPluginId?: string, executionOwner?: string, lifecycleOwner?: string, runtimeCapabilities?: Record<string, any>, routes?: string[], surfaces?: string[]}} [options] */
const manifest = (id, featureId, plugin, sites, order, requires = [], options = {}) => {
    const legacyPluginId = options.legacyPluginId ?? plugin?.legacyPluginId;
    if (!legacyPluginId) throw new Error(`Contribution ${id} must declare its stable legacyPluginId`);
    return /** @type {Record<string, any>} */ (defineContribution({
        id, featureId, legacyPluginId, plugin,
        executionOwner: options.executionOwner ?? "feature", lifecycleOwner: options.lifecycleOwner, sites, order, requires,
        runtimeCapabilities: options.runtimeCapabilities ?? {},
        routes: options.routes ?? (featureId === "detail" ? ["detail", "owned-detail"] : []),
        surfaces: options.surfaces ?? (featureId === "detail" ? ["detail-page"] : []),
    }));
};

/** @type {ReadonlyArray<Record<string, any>>} */
export const compatibilityContributionCatalog = Object.freeze([
    manifest("list.core", "list", null, ["javdb", "javbus"], { javdb: 1, javbus: 1 }, [PORT.host, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.state, SERVICE.settings, SERVICE.busImageLayout], { executionOwner: "feature", lifecycleOwner: "feature", legacyPluginId: "ListPagePlugin" }),
    manifest("list.auto-page", "list", null, ["javdb", "javbus"], { javdb: 2, javbus: 5 }, [], { executionOwner: "feature", legacyPluginId: "AutoPagePlugin" }),
    manifest("detail.fc2-owned", "fc2-workspace", null, ["javdb"], { javdb: 3 }, [], { legacyPluginId: "Fc2Plugin", executionOwner: "feature", lifecycleOwner: "feature", routes: ["list", "detail", "owned-detail"], surfaces: ["list-card", "detail-page"] }),
    manifest("detail.fc2-navigation", "list", null, ["javdb"], { javdb: 4 }, [], { executionOwner: "feature", legacyPluginId: "Fc2NavigationPlugin", routes: ["list"], surfaces: ["list-card"] }),
    manifest("list.fold-category", "list", null, ["javdb"], { javdb: 5 }, [], { executionOwner: "feature", legacyPluginId: "FoldCategoryPlugin" }),
    manifest("list.actions", "list", null, ["javdb", "javbus"], { javdb: 5, javbus: 2 }, [], { executionOwner: "feature", legacyPluginId: "ListPageButtonPlugin" }),
    manifest("library.history", "library", null, ["javdb", "javbus"], { javdb: 6, javbus: 4 }, [SERVICE.dialog, SERVICE.movie, SERVICE.settings, SERVICE.state, SERVICE.storage, SERVICE.profile], { executionOwner: "feature", legacyPluginId: "HistoryPlugin", lifecycleOwner: "feature" }),
    manifest("settings.core", "settings-entry", null, ["javdb", "javbus"], { javdb: 7, javbus: 3 }, [PORT.host, SERVICE.diagnostics, SERVICE.profile, SERVICE.webdav, SERVICE.dialog, SERVICE.storage, SERVICE.settings, SERVICE.cache, SERVICE.http, SERVICE.offline, SERVICE.magnet, SERVICE.movie, SERVICE.state, SERVICE.translation, SERVICE.busImageLayout, REGISTRY.settings], { executionOwner: "feature", legacyPluginId: "SettingPlugin", lifecycleOwner: "feature" }),
    manifest("identity.javdb-navigation", "identity", null, ["javdb"], { javdb: 8 }, [PORT.style, SERVICE.movie, SERVICE.navigation, SERVICE.notifications], { executionOwner: "feature", legacyPluginId: "NavBarPlugin" }),
    manifest("discovery.hit-show", "discovery", null, ["javdb"], { javdb: 9 }, [], { executionOwner: "feature", legacyPluginId: "HitShowPlugin" }),
    manifest("discovery.top250", "ranking", null, ["javdb"], { javdb: 10 }, [], { executionOwner: "feature", legacyPluginId: "TOP250Plugin" }),
    manifest("identity.image-search", "identity", null, ["javdb", "javbus"], { javdb: 11, javbus: 6 }, [], { executionOwner: "feature", legacyPluginId: "SearchByImagePlugin" }),
    manifest("detail.cover-state-actions", "list", null, ["javdb", "javbus"], { javdb: 12, javbus: 8 }, [], { executionOwner: "feature", legacyPluginId: "CoverButtonPlugin", routes: ["list"], surfaces: ["list-card"] }),
    manifest("detail.fc2-lookup", "fc2-catalog", null, ["javdb"], { javdb: 13 }, [], { executionOwner: "feature", legacyPluginId: "Fc2By123AvPlugin", routes: ["list", "detail", "owned-detail"], surfaces: ["list-card", "detail-page"] }),
    manifest("detail.javdb-native", "detail", null, ["javdb"], { javdb: 14 }, [], { executionOwner: "feature", legacyPluginId: "DetailPagePlugin" }),
    manifest("detail.workspace", "detail", null, ["javdb", "javbus"], { javdb: 15, javbus: 11 }, [], { executionOwner: "feature", legacyPluginId: "DetailWorkspacePlugin" }),
    manifest("detail.reviews", "detail", null, ["javdb", "javbus"], { javdb: 16, javbus: 13 }, [PORT.host, SERVICE.review, SERVICE.movie, SERVICE.settings, SERVICE.storage, SERVICE.domUi, SERVICE.clipboard, SERVICE.notifications, SERVICE.diagnostics], { executionOwner: "feature", legacyPluginId: "ReviewPlugin" }),
    manifest("detail.related", "detail", null, ["javdb"], { javdb: 17 }, [PORT.host, SERVICE.related, SERVICE.settings, SERVICE.domUi, SERVICE.notifications, SERVICE.diagnostics], { executionOwner: "feature", legacyPluginId: "RelatedPlugin" }),
    manifest("detail.page-state-actions", "detail", null, ["javdb", "javbus"], { javdb: 18, javbus: 12 }, [], { executionOwner: "feature", legacyPluginId: "DetailPageButtonPlugin" }),
    manifest("detail.native-magnets", "detail", null, ["javdb", "javbus"], { javdb: 19, javbus: 15 }, [], { executionOwner: "feature", legacyPluginId: "HighlightMagnetPlugin" }),
    manifest("detail.javdb-preview", "detail", null, ["javdb"], { javdb: 20 }, [], { executionOwner: "feature", legacyPluginId: "PreviewVideoPlugin" }),
    manifest("library.keyword-filter", "library", null, ["javdb", "javbus"], { javdb: 21, javbus: 14 }, [SERVICE.settings, SERVICE.titleKeywords, SERVICE.domUi, SERVICE.events], { executionOwner: "feature", legacyPluginId: "FilterTitleKeywordPlugin", routes: ["list", "detail", "owned-detail"], surfaces: ["list-page", "detail-page"] }),
    manifest("identity.actress-info", "actress-info", null, ["javdb"], { javdb: 22 }, [], { executionOwner: "feature", legacyPluginId: "ActressInfoPlugin" }),
    manifest("detail.external-sites", "external-sites", null, ["javdb", "javbus"], { javdb: 23, javbus: 19 }, [], { executionOwner: "feature", legacyPluginId: "OtherSitePlugin", routes: ["detail", "owned-detail"], surfaces: ["detail-page"] }),
    manifest("external-bridge.translation", "translation", null, ["javdb", "javbus"], { javdb: 24, javbus: 20 }, [], { executionOwner: "feature", legacyPluginId: "TranslatePlugin", routes: ["list", "detail"], surfaces: ["list-page", "detail-page"] }),
    manifest("library.state-actions", "library", null, ["javdb"], { javdb: 25 }, [], { executionOwner: "feature", legacyPluginId: "WantAndWatchedVideosPlugin", routes: ["list"], surfaces: ["list-page"] }),
    manifest("detail.external-magnets", "external-bridge", null, ["javdb", "javbus"], { javdb: 26, javbus: 17 }, [], { executionOwner: "feature", legacyPluginId: "MagnetHubPlugin", routes: [], surfaces: [] }),
    manifest("detail.screenshot", "detail", null, ["javdb", "javbus"], { javdb: 27, javbus: 18 }, [], { executionOwner: "feature", legacyPluginId: "ScreenShotPlugin", routes: ["list", "detail"], surfaces: ["list-page", "detail-page"] }),
    manifest("library.blacklist", "library", null, ["javdb", "javbus"], { javdb: 28, javbus: 21 }, [], { executionOwner: "feature", legacyPluginId: "BlacklistPlugin", routes: ["list"], surfaces: ["list-page"] }),
    manifest("library.favorite-actresses", "library", null, ["javdb"], { javdb: 29 }, [], { executionOwner: "feature", legacyPluginId: "FavoriteActressesPlugin" }),
    manifest("discovery.new-video", "new-video", null, ["javdb"], { javdb: 30 }, [], { executionOwner: "feature", legacyPluginId: "NewVideoPlugin", lifecycleOwner: "feature" }),
    manifest("discovery.scheduler", "scheduler", null, ["javdb", "javbus"], { javdb: 31, javbus: 22 }, [], { executionOwner: "feature", legacyPluginId: "TaskPlugin", lifecycleOwner: "feature" }),
    manifest("stats.dashboard", "stats", null, ["javdb", "javbus"], { javdb: 32, javbus: 23 }, [], { executionOwner: "feature", legacyPluginId: "StatsPlugin" }),
    manifest("responsive-shell.bottom-bar", "responsive-shell", null, ["javdb", "javbus"], { javdb: 33, javbus: 24 }, [], { executionOwner: "feature", legacyPluginId: "MobileBottomBarPlugin" }),
    manifest("external-bridge.115-match", "one-one-five", null, ["javdb", "javbus"], { javdb: 34, javbus: 25 }, [], { executionOwner: "feature", legacyPluginId: "OneOneFiveMatchPlugin", routes: ["list", "detail"], surfaces: ["list-page", "detail-page"] }),
    manifest("external-bridge.offline", "external-bridge", null, ["javdb", "javbus"], { javdb: 35, javbus: 26 }, [], { executionOwner: "feature", lifecycleOwner: "feature", legacyPluginId: "UnifiedOfflinePlugin", routes: ["detail", "list"], surfaces: ["detail-page", "list-page"] }),
    manifest("compatibility.enhancements", "compatibility", null, ["javdb", "javbus"], { javdb: 36, javbus: 27 }, [SERVICE.state, SERVICE.notifications, SERVICE.domUi, PORT.host, PORT.style], { executionOwner: "feature", legacyPluginId: "CompatibilityEnhancementsPlugin" }),
    manifest("identity.javbus-navigation", "identity", null, ["javbus"], { javbus: 7 }, [], { executionOwner: "feature", legacyPluginId: "BusNavBarPlugin" }),
    manifest("detail.javbus-images", "list", null, ["javbus"], { javbus: 9 }, [], { executionOwner: "feature", legacyPluginId: "BusImgPlugin", routes: ["list"], surfaces: ["list-page"] }),
    manifest("detail.javbus-native", "identity", null, ["javbus"], { javbus: 10 }, [SERVICE.clipboard], { executionOwner: "feature", legacyPluginId: "BusDetailPagePlugin" }),
    manifest("detail.javbus-preview", "detail", null, ["javbus"], { javbus: 16 }, [], { executionOwner: "feature", legacyPluginId: "BusPreviewVideoPlugin" }),
    manifest("external-bridge.123pan", "external-bridge", null, ["javdb", "javbus", "123pan"], { javdb: 0, javbus: 0, "123pan": 1 }, [], { executionOwner: "feature", legacyPluginId: "OneTwoThreeOfflinePlugin" }),
    manifest("external-bridge.javtrailers", "external-bridge", null, ["javtrailers"], { javtrailers: 1 }, [], { executionOwner: "feature", legacyPluginId: "JavTrailersPlugin" }),
    manifest("external-bridge.subtitle", "external-bridge", null, ["subtitlecat"], { subtitlecat: 1 }, [], { executionOwner: "feature", legacyPluginId: "SubTitleCatPlugin" }),
]);

const contributionIds = new Set();
const legacyPluginIds = new Set();
for (const contribution of compatibilityContributionCatalog) {
    if (contributionIds.has(contribution.id)) throw new Error(`Duplicate contribution id: ${contribution.id}`);
    if (legacyPluginIds.has(contribution.legacyPluginId)) throw new Error(`Duplicate legacy plugin contribution: ${contribution.legacyPluginId}`);
    contributionIds.add(contribution.id);
    legacyPluginIds.add(contribution.legacyPluginId);
}

/** Register only compatibility lookup beans; FeatureRuntime owns all behavior. @param {import("../../core/compatibility-bean-registry.js").CompatibilityBeanRegistry} compatibilityBeans @param {import("../../app/feature-runtime.js").FeatureRuntime} featureRuntime @param {string} site */
export function registerSiteCompatibility(compatibilityBeans, featureRuntime, site) {
    featureRuntime.setContributionCatalog?.(compatibilityContributionCatalog);
    featureRuntime.setCompatibilityBeanResolver?.((name) => compatibilityBeans.lookupCompatibilityBean(name));
    featureRuntime.setCompatibilityBeanRegistrar?.((name, bean) => {
        compatibilityBeans.registerCompatibilityBean(name, bean);
        return () => compatibilityBeans.unregisterCompatibilityBean(name, bean);
    });
    compatibilityBeans.registerCompatibilityBean("MobileBottomBarPlugin", new ResponsiveShellBridge());
    if (featureRuntime.isContributionEnabled("list", "list.core", "ListPagePlugin")) {
        compatibilityBeans.registerCompatibilityBean("ListPagePlugin", new ListPagePluginAdapter());
    }
    if (featureRuntime.isContributionEnabled("scheduler", "discovery.scheduler", "TaskPlugin")) {
        compatibilityBeans.registerCompatibilityBean("TaskPlugin", new TaskCompatibilityBean());
    }
    if (featureRuntime.isContributionEnabled("library", "library.history", "HistoryPlugin")) {
        compatibilityBeans.registerCompatibilityBean("HistoryPlugin", new HistoryCompatibilityBean((command, ...args) => featureRuntime.commands.execute(command, ...args)));
    }
    if (featureRuntime.route === "list" && featureRuntime.isContributionEnabled("library", "library.blacklist", "BlacklistPlugin")) {
        compatibilityBeans.registerCompatibilityBean("BlacklistPlugin", new BlacklistCompatibilityBean({
            executeCommand: (command, ...args) => featureRuntime.commands.execute(command, ...args),
            getSubjectInfo: () => featureRuntime.commands.execute("library.blacklist.subject-info"),
            batchAllVideos: (name, options = {}) => {
                const list = compatibilityBeans.lookupCompatibilityBean("ListPagePlugin");
                if (typeof list?.batchSaveAllVideos !== "function") throw new Error("List Feature 批处理控制器尚未就绪");
                return list.batchSaveAllVideos({ kind: "actor", displayName: name, recordName: name }, "filter", options);
            },
        }));
    }
    if (featureRuntime.isContributionEnabled("settings-entry", "settings.core", "SettingPlugin")) {
        compatibilityBeans.registerCompatibilityBean("SettingPlugin", new SettingsCompatibilityBean(
            (options) => new SettingPlugin(options),
        ));
    }
    if (featureRuntime.isContributionEnabled("new-video", "discovery.new-video", "NewVideoPlugin")) {
        compatibilityBeans.registerCompatibilityBean("NewVideoPlugin", new NewVideoCompatibilityBean(
            (command, ...args) => featureRuntime.commands.execute(command, ...args),
            (options) => import("../../plugins/new-video/new-video.js").then(({ NewVideoWorkspaceService }) => new NewVideoWorkspaceService(/** @type {ConstructorParameters<typeof NewVideoWorkspaceService>[0]} */ (options))),
        ));
    }
    compatibilityBeans.setCatalogDescriptors(compatibilityContributionCatalog
        .filter((item) => item.sites.includes(site))
        .map((item) => ({ name: item.legacyPluginId, disableable: featureRuntime.isFeatureDisableable(item.featureId) })));
    if (featureRuntime.isContributionEnabled("detail", "detail.reviews", "ReviewPlugin")) {
        const dependencies = featureRuntime.resolveDeclaredDependencies([PORT.host, SERVICE.review, SERVICE.movie, SERVICE.settings, SERVICE.storage]);
        const ui = featureRuntime.resolveDeclaredDependencies([SERVICE.domUi])[SERVICE.domUi];
        const support = featureRuntime.resolveDeclaredDependencies([SERVICE.clipboard, SERVICE.notifications, SERVICE.diagnostics]);
        compatibilityBeans.registerCompatibilityBean("ReviewPlugin", new ReviewCompatibilityBean({
            host: dependencies[PORT.host], review: dependencies[SERVICE.review], movie: dependencies[SERVICE.movie],
            settings: dependencies[SERVICE.settings], storage: dependencies[SERVICE.storage],
            getScope: () => featureRuntime.getScope("detail"),
            showPanel: (movieId, target, options) => new ReviewPanel({
                review: dependencies[SERVICE.review], settings: dependencies[SERVICE.settings], storage: dependencies[SERVICE.storage],
                scope: () => featureRuntime.getScope("detail"), jquery: ui.jquery, ui,
                document: globalThis.document, window: globalThis.window,
                clipboard: support[SERVICE.clipboard], notifications: support[SERVICE.notifications], diagnostics: support[SERVICE.diagnostics],
            }).show(movieId, target, options),
        }));
    }
    if (featureRuntime.isContributionEnabled("detail", "detail.related", "RelatedPlugin")) {
        const dependencies = featureRuntime.resolveDeclaredDependencies([PORT.host, SERVICE.related, SERVICE.settings, SERVICE.notifications, SERVICE.diagnostics]);
        const ui = featureRuntime.resolveDeclaredDependencies([SERVICE.domUi])[SERVICE.domUi];
        compatibilityBeans.registerCompatibilityBean("RelatedPlugin", new RelatedCompatibilityBean({
            host: dependencies[PORT.host], related: dependencies[SERVICE.related], settings: dependencies[SERVICE.settings],
            getScope: () => featureRuntime.getScope("detail"), jquery: ui.jquery,
            showPanel: (target, movieId, options) => new RelatedPanel({
                related: dependencies[SERVICE.related], settings: dependencies[SERVICE.settings],
                scope: () => featureRuntime.getScope("detail"), jquery: ui.jquery, formatDate: ui.formatDate,
                document: globalThis.document, notifications: dependencies[SERVICE.notifications], diagnostics: dependencies[SERVICE.diagnostics],
            }).show(target, movieId, options),
        }));
    }
}
