// @ts-check

import { defineContribution } from "../contracts/manifests.js";
import { PORT, SERVICE } from "../contracts/tokens.js";
import { LEGACY_PLUGIN_DEPENDENCY_MAP } from "./dependency-map.js";
import { ActressInfoPlugin } from "./avatar/actress-info.js";
import { SearchByImagePlugin } from "./avatar/search-by-image.js";
import { SettingPlugin } from "./backup/setting.js";
import { BlacklistPlugin } from "./blacklist/blacklist.js";
import { FilterTitleKeywordPlugin } from "./blacklist/filter-title-keyword.js";
import { Fc2By123AvPlugin } from "./external-search/fc2-by-123av.js";
import { Fc2Plugin } from "./external-search/fc2.js";
import { HitShowPlugin } from "./external-search/hit-show.js";
import { JavTrailersPlugin } from "./external-search/javtrailers.js";
import { MagnetHubPlugin } from "./external-search/magnet-hub.js";
import { OtherSitePlugin } from "./external-search/other-site.js";
import { RelatedPlugin } from "./external-search/related.js";
import { ReviewPlugin } from "./external-search/review.js";
import { Top250Plugin } from "./external-search/top250.js";
import { FavoriteActressesPlugin } from "./favorite/favorite-actresses.js";
import { BusImgPlugin } from "./image-viewer/bus-img.js";
import { BusPreviewVideoPlugin } from "./image-viewer/bus-preview-video.js";
import { CoverButtonPlugin } from "./image-viewer/cover-button.js";
import { PreviewVideoPlugin } from "./image-viewer/preview-video.js";
import { ScreenShotPlugin } from "./image-viewer/screenshot.js";
import { NewVideoPlugin } from "./new-video/new-video.js";
import { TaskPlugin } from "./new-video/task.js";
import { UnifiedOfflinePlugin } from "./offline/unified-offline.js";
import { OneOneFiveMatchPlugin } from "./one-one-five/plugins.js";
import { OneTwoThreeOfflinePlugin } from "./one-two-three/offline.js";
import { StatsPlugin } from "./stats/stats.js";
import { AutoPagePlugin } from "./status/auto-page.js";
import { BusDetailPagePlugin } from "./status/bus-detail-page.js";
import { BusNavBarPlugin } from "./status/bus-nav-bar.js";
import { CompatibilityEnhancementsPlugin } from "./status/compat-enhancements.js";
import { DetailPageButtonPlugin } from "./status/detail-page-button.js";
import { DetailPagePlugin } from "./status/detail-page.js";
import { DetailWorkspacePlugin } from "./status/detail-workspace.js";
import { FoldCategoryPlugin } from "./status/fold-category.js";
import { HighlightMagnetPlugin } from "./status/highlight-magnet.js";
import { HistoryPlugin } from "./status/history.js";
import { ListPageButtonPlugin } from "./status/list-page-button.js";
import { ListPagePlugin } from "./status/list-page.js";
import { MobileBottomBarPlugin } from "./status/mobile-bottom-bar.js";
import { NavBarPlugin } from "./status/nav-bar.js";
import { WantAndWatchedVideosPlugin } from "./status/want-and-watched-videos.js";
import { SubTitleCatPlugin } from "./subtitle/subtitle-cat.js";
import { TranslatePlugin } from "./translate/translate.js";

const manifest = (id, featureId, plugin, sites, order, requires = []) => defineContribution({
    id, featureId, legacyPluginId: plugin.legacyPluginId ?? plugin.name, plugin, sites, order, requires,
});

export const legacyContributionManifests = Object.freeze([
    manifest("list.core", "list", ListPagePlugin, ["javdb", "javbus"], { javdb: 1, javbus: 1 }, [PORT.host, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.state]),
    manifest("list.auto-page", "list", AutoPagePlugin, ["javdb", "javbus"], { javdb: 2, javbus: 5 }, [SERVICE.http]),
    manifest("detail.fc2-owned", "detail", Fc2Plugin, ["javdb"], { javdb: 3 }, [SERVICE.movie, SERVICE.magnet, SERVICE.dialog, SERVICE.translation, SERVICE.settings, SERVICE.storage, SERVICE.screenshot, SERVICE.review, SERVICE.related, SERVICE.state]),
    manifest("list.fold-category", "list", FoldCategoryPlugin, ["javdb"], { javdb: 4 }, [SERVICE.settings]),
    manifest("list.actions", "list", ListPageButtonPlugin, ["javdb", "javbus"], { javdb: 5, javbus: 2 }, [SERVICE.settings]),
    manifest("library.history", "library", HistoryPlugin, ["javdb", "javbus"], { javdb: 6, javbus: 4 }, [SERVICE.dialog, SERVICE.movie, SERVICE.settings, SERVICE.state]),
    manifest("settings.core", "settings", SettingPlugin, ["javdb", "javbus"], { javdb: 7, javbus: 3 }, [PORT.host, SERVICE.diagnostics, SERVICE.webdav, SERVICE.dialog, SERVICE.storage, SERVICE.settings, SERVICE.http, SERVICE.offline, SERVICE.magnet, SERVICE.movie, SERVICE.state]),
    manifest("identity.javdb-navigation", "identity", NavBarPlugin, ["javdb"], { javdb: 8 }, [SERVICE.movie]),
    manifest("discovery.hit-show", "discovery", HitShowPlugin, ["javdb"], { javdb: 9 }, [PORT.host, SERVICE.movie, SERVICE.settings, SERVICE.cache]),
    manifest("discovery.top250", "discovery", Top250Plugin, ["javdb"], { javdb: 10 }, [PORT.host, SERVICE.dialog, SERVICE.account]),
    manifest("identity.image-search", "identity", SearchByImagePlugin, ["javdb", "javbus"], { javdb: 11, javbus: 6 }, [SERVICE.dialog, SERVICE.storage, SERVICE.imageSearch]),
    manifest("detail.cover-state-actions", "detail", CoverButtonPlugin, ["javdb", "javbus"], { javdb: 12, javbus: 8 }, [SERVICE.storage, SERVICE.settings, SERVICE.movie, SERVICE.state]),
    manifest("detail.fc2-lookup", "detail", Fc2By123AvPlugin, ["javdb"], { javdb: 13 }, [PORT.host, SERVICE.movie, SERVICE.translation, SERVICE.settings]),
    manifest("detail.javdb-native", "detail", DetailPagePlugin, ["javdb"], { javdb: 14 }),
    manifest("detail.workspace", "detail", DetailWorkspacePlugin, ["javdb", "javbus"], { javdb: 15, javbus: 11 }, [PORT.host]),
    manifest("detail.reviews", "detail", ReviewPlugin, ["javdb", "javbus"], { javdb: 16, javbus: 13 }, [PORT.host, SERVICE.review, SERVICE.movie, SERVICE.settings, SERVICE.storage]),
    manifest("detail.related", "detail", RelatedPlugin, ["javdb"], { javdb: 17 }, [PORT.host, SERVICE.related, SERVICE.settings]),
    manifest("detail.page-state-actions", "detail", DetailPageButtonPlugin, ["javdb", "javbus"], { javdb: 18, javbus: 12 }, [SERVICE.movie, SERVICE.dialog, SERVICE.subtitle, SERVICE.state]),
    manifest("detail.native-magnets", "detail", HighlightMagnetPlugin, ["javdb", "javbus"], { javdb: 19, javbus: 15 }, [PORT.host, SERVICE.settings]),
    manifest("detail.javdb-preview", "detail", PreviewVideoPlugin, ["javdb"], { javdb: 20 }, [SERVICE.storage, SERVICE.settings, SERVICE.movie]),
    manifest("library.keyword-filter", "library", FilterTitleKeywordPlugin, ["javdb", "javbus"], { javdb: 21, javbus: 14 }),
    manifest("identity.actress-info", "identity", ActressInfoPlugin, ["javdb"], { javdb: 22 }, [SERVICE.actressInfo]),
    manifest("detail.external-sites", "detail", OtherSitePlugin, ["javdb", "javbus"], { javdb: 23, javbus: 19 }, [PORT.host, SERVICE.movie, SERVICE.storage]),
    manifest("external-bridge.translation", "external-bridge", TranslatePlugin, ["javdb", "javbus"], { javdb: 24, javbus: 20 }, [SERVICE.translation, SERVICE.settings]),
    manifest("library.state-actions", "library", WantAndWatchedVideosPlugin, ["javdb"], { javdb: 25 }, [SERVICE.http, SERVICE.state]),
    manifest("detail.external-magnets", "detail", MagnetHubPlugin, ["javdb", "javbus"], { javdb: 26, javbus: 17 }, [SERVICE.storage, SERVICE.http, SERVICE.magnet]),
    manifest("detail.screenshot", "detail", ScreenShotPlugin, ["javdb", "javbus"], { javdb: 27, javbus: 18 }, [SERVICE.screenshot]),
    manifest("library.blacklist", "library", BlacklistPlugin, ["javdb", "javbus"], { javdb: 28, javbus: 21 }, [SERVICE.dialog, SERVICE.storage, SERVICE.http, SERVICE.state]),
    manifest("library.favorite-actresses", "library", FavoriteActressesPlugin, ["javdb"], { javdb: 29 }),
    manifest("discovery.new-video", "discovery", NewVideoPlugin, ["javdb"], { javdb: 30 }, [SERVICE.dialog, SERVICE.storage, SERVICE.actressInfo, SERVICE.movie, SERVICE.state]),
    manifest("discovery.scheduler", "discovery", TaskPlugin, ["javdb", "javbus"], { javdb: 31, javbus: 22 }, [SERVICE.storage, SERVICE.http, SERVICE.actressInfo, SERVICE.movie]),
    manifest("stats.dashboard", "stats", StatsPlugin, ["javdb", "javbus"], { javdb: 32, javbus: 23 }, [SERVICE.diagnostics, SERVICE.dialog, SERVICE.movie, SERVICE.state]),
    manifest("responsive-shell.bottom-bar", "responsive-shell", MobileBottomBarPlugin, ["javdb", "javbus"], { javdb: 33, javbus: 24 }, [PORT.host, SERVICE.settings, SERVICE.profile]),
    manifest("external-bridge.115-match", "external-bridge", OneOneFiveMatchPlugin, ["javdb", "javbus"], { javdb: 34, javbus: 25 }, [PORT.host, SERVICE.dialog, SERVICE.offline]),
    manifest("external-bridge.offline", "external-bridge", UnifiedOfflinePlugin, ["javdb", "javbus"], { javdb: 35, javbus: 26 }, [PORT.host, SERVICE.dialog, SERVICE.offline, SERVICE.state]),
    manifest("compatibility.enhancements", "compatibility", CompatibilityEnhancementsPlugin, ["javdb", "javbus"], { javdb: 36, javbus: 27 }, [SERVICE.state]),
    manifest("identity.javbus-navigation", "identity", BusNavBarPlugin, ["javbus"], { javbus: 7 }),
    manifest("detail.javbus-images", "detail", BusImgPlugin, ["javbus"], { javbus: 9 }),
    manifest("detail.javbus-native", "detail", BusDetailPagePlugin, ["javbus"], { javbus: 10 }),
    manifest("detail.javbus-preview", "detail", BusPreviewVideoPlugin, ["javbus"], { javbus: 16 }, [SERVICE.settings, SERVICE.storage, SERVICE.movie]),
    manifest("external-bridge.123pan", "external-bridge", OneTwoThreeOfflinePlugin, ["javdb", "javbus", "123pan"], { javdb: 0, javbus: 0, "123pan": 1 }, [SERVICE.storage]),
    manifest("external-bridge.javtrailers", "external-bridge", JavTrailersPlugin, ["javtrailers"], { javtrailers: 1 }),
    manifest("external-bridge.subtitle", "external-bridge", SubTitleCatPlugin, ["subtitlecat"], { subtitlecat: 1 }),
]);

const contributionIds = new Set();
const legacyPluginIds = new Set();
for (const contribution of legacyContributionManifests) {
    if (contributionIds.has(contribution.id)) throw new Error(`Duplicate contribution id: ${contribution.id}`);
    if (legacyPluginIds.has(contribution.legacyPluginId)) throw new Error(`Duplicate legacy plugin contribution: ${contribution.legacyPluginId}`);
    contributionIds.add(contribution.id);
    legacyPluginIds.add(contribution.legacyPluginId);
}

/** @param {import("../core/plugin-manager.js").PluginManager} pluginManager @param {import("../app/feature-runtime.js").FeatureRuntime} featureRuntime @param {string} site */
export function registerSitePlugins(pluginManager, featureRuntime, site) {
    pluginManager.setDependencyDeclarations(LEGACY_PLUGIN_DEPENDENCY_MAP);
    pluginManager.setCatalogDescriptors(legacyContributionManifests
        .filter((item) => item.sites.includes(site))
        .map((item) => ({ name: item.legacyPluginId, disableable: featureRuntime.isFeatureDisableable(item.featureId) })));
    legacyContributionManifests
        .filter((item) => item.sites.includes(site) && featureRuntime.isContributionEnabled(item.featureId, item.id, item.legacyPluginId))
        .sort((left, right) => Number(left.order[site]) - Number(right.order[site]))
        .forEach((item) => {
            const dependencies = featureRuntime.resolveDeclaredDependencies(item.requires);
            const runtimeServices = {};
            runtimeServices.scope = () => featureRuntime.getContributionScope(item.featureId, item.id, item.legacyPluginId);
            const runtimeNames = new Map([
                [PORT.host, "host"], [SERVICE.diagnostics, "diagnostics"], [SERVICE.review, "review"],
                [SERVICE.related, "related"], [SERVICE.movie, "movie"], [SERVICE.magnet, "magnet"],
                [SERVICE.settings, "settings"], [SERVICE.cache, "cache"], [SERVICE.http, "http"],
                [SERVICE.profile, "profile"],
                [SERVICE.actressInfo, "actressInfo"],
                [SERVICE.imageSearch, "imageSearch"],
                [SERVICE.screenshot, "screenshot"],
                [SERVICE.translation, "translation"],
                [SERVICE.subtitle, "subtitle"],
                [SERVICE.account, "account"],
                [SERVICE.webdav, "webdav"],
                [SERVICE.storage, "storage"],
                [SERVICE.state, "state"],
                [SERVICE.offline, "offline"],
                [SERVICE.dialog, "dialog"],
            ]);
            for (const token of item.requires) {
                const name = runtimeNames.get(token);
                if (!name) throw new Error(`Legacy contribution ${item.id} has no runtime name for ${String(token)}`);
                runtimeServices[name] = dependencies[token];
            }
            pluginManager.register(item.plugin, runtimeServices, { disableable: featureRuntime.isFeatureDisableable(item.featureId) });
        });
}
