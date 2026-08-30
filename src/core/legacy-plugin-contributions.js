// @ts-check

export const LEGACY_PLUGIN_CONTRIBUTION_MAP = Object.freeze({
    ListPagePlugin: "list.core",
    AutoPagePlugin: "list.auto-page",
    Fc2Plugin: "detail.fc2-owned",
    Fc2NavigationPlugin: "list.fc2-navigation",
    "detail.fc2-navigation": "list.fc2-navigation",
    FoldCategoryPlugin: "list.fold-category",
    ListPageButtonPlugin: "list.actions",
    HistoryPlugin: "library.history",
    SettingPlugin: "settings.core",
    NavBarPlugin: "identity.javdb-navigation",
    BusNavBarPlugin: "identity.javbus-navigation",
    HitShowPlugin: "discovery.hit-show",
    TOP250Plugin: "discovery.top250",
    SearchByImagePlugin: "identity.image-search",
    Fc2By123AvPlugin: "list.fc2-lookup",
    "detail.fc2-lookup": "list.fc2-lookup",
    DetailPagePlugin: "detail.javdb-native",
    BusDetailPagePlugin: "detail.javbus-native",
    DetailWorkspacePlugin: "detail.workspace",
    ReviewPlugin: "detail.reviews",
    RelatedPlugin: "detail.related",
    ScreenShotPlugin: "detail.screenshot",
    ScreenshotPlugin: "detail.screenshot",
    MagnetHubPlugin: "detail.external-magnets",
    PreviewVideoPlugin: "detail.javdb-preview",
    CoverButtonPlugin: "list.cover-state-actions",
    "detail.cover-state-actions": "list.cover-state-actions",
    DetailPageButtonPlugin: "detail.page-state-actions",
    HighlightMagnetPlugin: "detail.native-magnets",
    OtherSitePlugin: "detail.external-sites",
    SubTitleCatPlugin: "external-bridge.subtitle",
    FilterTitleKeywordPlugin: "library.keyword-filter",
    ActressInfoPlugin: "identity.actress-info",
    TranslatePlugin: "external-bridge.translation",
    WantAndWatchedVideosPlugin: "library.state-actions",
    BlacklistPlugin: "library.blacklist",
    FavoriteActressesPlugin: "library.favorite-actresses",
    NewVideoPlugin: "discovery.new-video",
    TaskPlugin: "discovery.scheduler",
    MobileBottomBarPlugin: "responsive-shell.bottom-bar",
    OneOneFiveMatchPlugin: "external-bridge.115-match",
    UnifiedOfflinePlugin: "external-bridge.offline",
    CompatibilityEnhancementsPlugin: "compatibility.enhancements",
    BusImgPlugin: "list.javbus-images",
    "detail.javbus-images": "list.javbus-images",
    BusPreviewVideoPlugin: "detail.javbus-preview",
    OneTwoThreeOfflinePlugin: "external-bridge.123pan",
    JavTrailersPlugin: "external-bridge.javtrailers",
});

const LEGACY_SHARED_CONTRIBUTION_MAP = Object.freeze({
    "detail.subtitle": ["external-bridge.subtitle"],
    "detail.native": ["detail.javdb-native", "detail.javbus-native"],
    "detail.state-actions": ["list.cover-state-actions", "detail.page-state-actions"],
    "detail.gallery": ["detail.javdb-preview", "list.javbus-images", "detail.javbus-preview"],
});

/** @param {unknown} value */
export function migrateDisabledPlugins(value) {
    const input = Array.isArray(value) ? value : [];
    const mapping = /** @type {Record<string, string>} */ (LEGACY_PLUGIN_CONTRIBUTION_MAP);
    const shared = /** @type {Record<string, string[]>} */ (LEGACY_SHARED_CONTRIBUTION_MAP);
    return [...new Set(input.filter((id) => typeof id === "string").flatMap((id) => shared[id] ?? [mapping[id] ?? id]))];
}

/** @param {string} pluginName */
export function disabledIdForPlugin(pluginName) {
    return /** @type {Record<string, string>} */ (LEGACY_PLUGIN_CONTRIBUTION_MAP)[pluginName] ?? pluginName;
}

/** @param {unknown} serialized */
export function parseDisabledPlugins(serialized) {
    try {
        const value = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
        return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
    } catch {
        return [];
    }
}
// @ts-check
