// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { TranslationToolsController } from "./translation-tools-controller.js";
import { TRANSLATION_SETTINGS_STYLES } from "../../ui/settings/translation-connections.js";

export default defineFeature({
    id: "translation-tools", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.settings, SERVICE.translation, SERVICE.privacy, SERVICE.dialog, SERVICE.domUi],
    contributes: [], providesCommands: ["translation.selection"],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("translation-tools", TRANSLATION_SETTINGS_STYLES));
        const tools = new TranslationToolsController({ host: deps[PORT.host], service: deps[SERVICE.translation], settings: deps[SERVICE.settings], privacy: deps[SERVICE.privacy], dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi], scope: runtime.scope, configure: () => runtime.executeCommand("translation.configure") });
        tools.start();
        return { commands: { "translation.selection": (/** @type {any[]} */ movies) => tools.open(movies) } };
    },
});
