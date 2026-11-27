// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
/** Configuration belongs to Settings, so disabling a page capability cannot hide its configuration. */
export default defineFeature({
    id: "enhancement-settings", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "on-command",
    requires: [], contributes: [], providesCommands: ["translation.configure", "media.configure", "privacy.configure"],
    activate: (_deps, /** @type {any} */ runtime) => {
        const open = (/** @type {string} */ kind) => runtime.executeCommand("settings.open", { translation: "translation-connections-panel", media: "media-connections-panel", privacy: "privacy-preferences-panel" }[kind]);
        return { commands: {
            "translation.configure": () => open("translation"),
            "media.configure": () => open("media"),
            "privacy.configure": () => open("privacy"),
        } };
    },
});
