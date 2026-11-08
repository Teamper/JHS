// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { ENHANCEMENT_SETTINGS_STYLES, openEnhancementSettings } from "../../ui/settings/enhancement-settings.js";

/** Configuration belongs to Settings, so disabling a page capability cannot hide its configuration. */
export default defineFeature({
    id: "enhancement-settings", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "on-command",
    requires: [PORT.host, PORT.style, SERVICE.settings, SERVICE.translation, SERVICE.privacy, SERVICE.mediaLibrary, SERVICE.dialog, SERVICE.domUi, SERVICE.notifications],
    contributes: [], providesCommands: ["translation.configure", "media.configure", "privacy.configure"],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("enhancement-settings", ENHANCEMENT_SETTINGS_STYLES));
        const common = { document: deps[PORT.host].document, settings: deps[SERVICE.settings], dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi], scope: runtime.scope,
            translation: deps[SERVICE.translation], media: deps[SERVICE.mediaLibrary] };
        const views = new Map();
        const open = async (/** @type {string} */ kind) => {
            if (views.has(kind)) return;
            const pending = openEnhancementSettings(kind, common);
            views.set(kind, pending);
            try { (await pending).addCleanup(() => views.delete(kind)); }
            catch (error) { views.delete(kind); throw error; }
        };
        return { commands: {
            "translation.configure": () => open("translation"),
            "media.configure": () => open("media"),
            "privacy.configure": () => open("privacy"),
        } };
    },
});
