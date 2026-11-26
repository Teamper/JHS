// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { ExternalBridgeTranslationController } from "./translation-controller.js";

export default defineFeature({
    id: "translation", kind: "feature", disableable: true,
    sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requiresFeaturesByRoute: { list: ["list"] },
    requires: [PORT.host, PORT.style, SERVICE.settings, SERVICE.translation, SERVICE.privacy, SERVICE.dialog, SERVICE.domUi],
    contributes: ["external-bridge.translation"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (!runtime.enabledContributions.includes("external-bridge.translation")) return { activeContributions: [] };
        try {
            const controller = new ExternalBridgeTranslationController({
                document, window, route: runtime.route, hostAdapter: deps[PORT.host],
                settings: deps[SERVICE.settings], translation: deps[SERVICE.translation], styles: deps[PORT.style],
                diagnostics: runtime.diagnostics, scope: runtime.scope, privacy:deps[SERVICE.privacy],
            });
            controller.start();
            if (runtime.route === "list") runtime.provideCapability?.("external-bridge.translation", controller);
            return { activeContributions: ["external-bridge.translation"] };
        } catch (error) {
            runtime.diagnostics.recordError({
                source: "translation-feature", featureId: "translation", contributionId: "external-bridge.translation",
                message: error instanceof Error ? error.message : String(error),
            });
            return { activeContributions: [] };
        }
    },
});
