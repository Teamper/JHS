import { detectSite } from "../core/site-context.js";
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

const DEFAULT_JAVDB_PLUGINS = [
    ListPagePlugin, AutoPagePlugin, Fc2Plugin, FoldCategoryPlugin, ListPageButtonPlugin,
    HistoryPlugin, SettingPlugin, NavBarPlugin, HitShowPlugin, Top250Plugin,
    SearchByImagePlugin, CoverButtonPlugin, Fc2By123AvPlugin, DetailPagePlugin, DetailWorkspacePlugin, ReviewPlugin,
    RelatedPlugin, DetailPageButtonPlugin, HighlightMagnetPlugin, PreviewVideoPlugin, FilterTitleKeywordPlugin,
    ActressInfoPlugin, OtherSitePlugin, TranslatePlugin, WantAndWatchedVideosPlugin,
    MagnetHubPlugin, ScreenShotPlugin, BlacklistPlugin, FavoriteActressesPlugin, NewVideoPlugin,
    TaskPlugin, StatsPlugin, MobileBottomBarPlugin
    , OneOneFiveMatchPlugin, UnifiedOfflinePlugin, CompatibilityEnhancementsPlugin
];

const DEFAULT_JAVBUS_PLUGINS = [
    ListPagePlugin, ListPageButtonPlugin, SettingPlugin,
    HistoryPlugin, AutoPagePlugin, SearchByImagePlugin, BusNavBarPlugin, CoverButtonPlugin,
    BusImgPlugin, BusDetailPagePlugin, DetailWorkspacePlugin, DetailPageButtonPlugin, ReviewPlugin,
    FilterTitleKeywordPlugin, HighlightMagnetPlugin, BusPreviewVideoPlugin, MagnetHubPlugin, ScreenShotPlugin,
    OtherSitePlugin, TranslatePlugin, BlacklistPlugin, TaskPlugin, StatsPlugin, MobileBottomBarPlugin
    , OneOneFiveMatchPlugin, UnifiedOfflinePlugin, CompatibilityEnhancementsPlugin
];

const DEFAULT_SHARED_PLUGIN_RULES = [
    {
        shouldRegister: context => context.isJavDB || context.isJavBus || context.is123Pan,
        plugins: [ OneTwoThreeOfflinePlugin ]
    },
    {
        shouldRegister: context => context.isJavTrailers,
        plugins: [ JavTrailersPlugin ]
    },
    {
        shouldRegister: context => context.isSubtitleCat,
        plugins: [ SubTitleCatPlugin ]
    }
];

function registerPluginGroup(pluginManager, plugins) {
    plugins.forEach((pluginClass => pluginManager.register(pluginClass)));
}

export function registerSitePlugins(pluginManager, locationLike = window.location) {
    pluginManager.setDependencyDeclarations(LEGACY_PLUGIN_DEPENDENCY_MAP);
    const context = detectSite(locationLike);
    DEFAULT_SHARED_PLUGIN_RULES.forEach((rule => {
        rule.shouldRegister(context) && registerPluginGroup(pluginManager, rule.plugins);
    }));
    context.isJavDB && registerPluginGroup(pluginManager, DEFAULT_JAVDB_PLUGINS);
    context.isJavBus && registerPluginGroup(pluginManager, DEFAULT_JAVBUS_PLUGINS);
}
