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

function registerSitePlugins(pluginManager, locationLike = window.location) {
    const context = detectSite(locationLike);
    DEFAULT_SHARED_PLUGIN_RULES.forEach((rule => {
        rule.shouldRegister(context) && registerPluginGroup(pluginManager, rule.plugins);
    }));
    context.isJavDB && registerPluginGroup(pluginManager, DEFAULT_JAVDB_PLUGINS);
    context.isJavBus && registerPluginGroup(pluginManager, DEFAULT_JAVBUS_PLUGINS);
}
