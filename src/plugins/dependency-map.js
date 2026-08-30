// @ts-check

/**
 * Transitional optional-availability declarations for legacy plugins.
 *
 * New Features use manifest tokens. Legacy plugins receive only the plugin
 * instances declared here so that internal code cannot use PluginManager as
 * an unrestricted service locator during the 6.5 migration. Every production
 * call site uses getOptionalDependency(); these edges do not define startup
 * ordering and may therefore be cyclic. The hard legacy dependency graph is
 * intentionally empty and enforced by architecture-runtime.test.js.
 */
export const LEGACY_PLUGIN_DEPENDENCY_MAP = Object.freeze({
    AutoPagePlugin: [],
    BlacklistPlugin: ["TaskPlugin", "SettingPlugin"],
    BusNavBarPlugin: ["SearchByImagePlugin"],
    CompatibilityEnhancementsPlugin: [],
    CoverButtonPlugin: ["ScreenShotPlugin"],
    DetailPageButtonPlugin: ["DetailWorkspacePlugin", "MagnetHubPlugin", "HighlightMagnetPlugin"],
    Fc2NavigationPlugin: ["Fc2Plugin"],
    Fc2Plugin: [
        "DetailPageButtonPlugin", "MagnetHubPlugin", "OtherSitePlugin",
        "Fc2By123AvPlugin", "TOP250Plugin", "ScreenShotPlugin"
    ],
    HistoryPlugin: ["UnifiedOfflinePlugin", "Fc2Plugin"],
    HitShowPlugin: ["ListPageButtonPlugin", "CoverButtonPlugin"],
    ListPageButtonPlugin: ["NewVideoPlugin"],
    ListPagePlugin: [
        "ListPageButtonPlugin", "CoverButtonPlugin", "AutoPagePlugin",
        "BusImgPlugin", "Fc2Plugin"
    ],
    MobileBottomBarPlugin: [
        "DetailPageButtonPlugin", "ListPageButtonPlugin",
        "NewVideoPlugin", "SettingPlugin", "HighlightMagnetPlugin", "MagnetHubPlugin"
    ],
    NavBarPlugin: ["SearchByImagePlugin"],
    NewVideoPlugin: ["TaskPlugin", "SettingPlugin"],
    PreviewVideoPlugin: ["DetailPageButtonPlugin"],
    SettingPlugin: [
        "CoverButtonPlugin", "TaskPlugin", "OtherSitePlugin", "TranslatePlugin",
        "ActressInfoPlugin", "ScreenShotPlugin", "NewVideoPlugin", "BusImgPlugin"
    ],
    StatsPlugin: ["NewVideoPlugin"],
    TaskPlugin: [],
    TranslatePlugin: [],
    TOP250Plugin: ["HitShowPlugin", "ListPageButtonPlugin"],
    UnifiedOfflinePlugin: ["OneTwoThreeOfflinePlugin"]
});
// @ts-check
