export const LEGACY_PLUGIN_CONTRIBUTION_MAP = Object.freeze({
    ReviewPlugin: "detail.reviews",
    RelatedPlugin: "detail.related",
    ScreenShotPlugin: "detail.screenshot",
    ScreenshotPlugin: "detail.screenshot",
    MagnetHubPlugin: "detail.external-magnets",
    PreviewVideoPlugin: "detail.gallery",
    CoverButtonPlugin: "detail.state-actions",
    DetailPageButtonPlugin: "detail.state-actions",
    HighlightMagnetPlugin: "detail.native-magnets",
    OtherSitePlugin: "detail.external-sites",
    SubTitleCatPlugin: "detail.subtitle",
});

/** @param {unknown} value */
export function migrateDisabledPlugins(value) {
    const input = Array.isArray(value) ? value : [];
    const mapping = /** @type {Record<string, string>} */ (LEGACY_PLUGIN_CONTRIBUTION_MAP);
    return [...new Set(input.filter((id) => typeof id === "string").map((id) => mapping[id] ?? id))];
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
