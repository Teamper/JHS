/**
 * Transitional dependency declarations for legacy plugins.
 *
 * New Features use manifest tokens. Legacy plugins receive only the plugin
 * instances declared here so that internal code cannot use PluginManager as
 * an unrestricted service locator during the 6.5 migration.
 */
export const LEGACY_PLUGIN_DEPENDENCY_MAP = Object.freeze({
    AutoPagePlugin: ["ListPagePlugin"],
    BlacklistPlugin: ["TaskPlugin", "SettingPlugin", "ListPagePlugin"],
    BusNavBarPlugin: ["SearchByImagePlugin"],
    CompatibilityEnhancementsPlugin: ["ListPagePlugin"],
    CoverButtonPlugin: ["ListPagePlugin", "ScreenShotPlugin", "OtherSitePlugin"],
    DetailPageButtonPlugin: ["DetailWorkspacePlugin", "MagnetHubPlugin", "HighlightMagnetPlugin"],
    Fc2By123AvPlugin: ["OtherSitePlugin", "Fc2Plugin"],
    Fc2Plugin: [
        "DetailPageButtonPlugin", "MagnetHubPlugin", "FilterTitleKeywordPlugin", "OtherSitePlugin",
        "Fc2By123AvPlugin", "TOP250Plugin",
        "HighlightMagnetPlugin", "ReviewPlugin", "RelatedPlugin"
    ],
    HistoryPlugin: ["UnifiedOfflinePlugin", "ListPagePlugin", "Fc2Plugin"],
    HitShowPlugin: ["ListPageButtonPlugin", "ListPagePlugin", "CoverButtonPlugin"],
    ListPageButtonPlugin: ["NewVideoPlugin", "BlacklistPlugin", "ListPagePlugin"],
    ListPagePlugin: [
        "HistoryPlugin", "ListPageButtonPlugin", "CoverButtonPlugin", "AutoPagePlugin",
        "BusImgPlugin", "Fc2Plugin"
    ],
    MobileBottomBarPlugin: [
        "ListPagePlugin", "DetailPageButtonPlugin", "ListPageButtonPlugin",
        "NewVideoPlugin", "BlacklistPlugin", "SettingPlugin"
    ],
    NavBarPlugin: ["SearchByImagePlugin"],
    NewVideoPlugin: ["TaskPlugin", "SettingPlugin", "OtherSitePlugin"],
    PreviewVideoPlugin: ["DetailPageButtonPlugin"],
    SettingPlugin: [
        "CoverButtonPlugin", "TaskPlugin", "OtherSitePlugin", "ListPagePlugin", "TranslatePlugin",
        "ActressInfoPlugin", "ScreenShotPlugin", "NewVideoPlugin", "BlacklistPlugin", "BusImgPlugin"
    ],
    StatsPlugin: ["OtherSitePlugin", "NewVideoPlugin", "ListPagePlugin"],
    TaskPlugin: ["OtherSitePlugin", "BlacklistPlugin", "ListPagePlugin"],
    TOP250Plugin: ["HitShowPlugin"],
    UnifiedOfflinePlugin: ["OneTwoThreeOfflinePlugin", "ListPagePlugin"]
});
// @ts-check
