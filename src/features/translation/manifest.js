// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { ExternalBridgeTranslationController } from "./translation-controller.js";

export default defineFeature({
    id: "translation", kind: "feature", disableable: true,
    sites: ["javdb", "javbus"], routes: ["list", "detail"], startup: "eager",
    requiresFeaturesByRoute: { list: ["list"] },
    requires: [PORT.host, PORT.style, SERVICE.settings, SERVICE.translation],
    contributes: ["external-bridge.translation"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (!runtime.enabledContributions.includes("external-bridge.translation")) return { activeContributions: [] };
        try {
            const listAdapter = runtime.route === "list" ? runtime.resolveCompatibilityBean?.("ListPagePlugin") : null;
            const legacyList = listAdapter?.ensureDelegate?.() ?? listAdapter;
            /** @type {{attachFeatureListTranslationAdapter: (adapter: any) => void, detachFeatureListTranslationAdapter: (adapter: any) => void} | null} */
            const listTranslation = legacyList ? Object.freeze({
                attachFeatureListTranslationAdapter: (adapter) => legacyList.attachFeatureListTranslationAdapter?.(adapter),
                detachFeatureListTranslationAdapter: (adapter) => legacyList.detachFeatureListTranslationAdapter?.(adapter),
            }) : null;
            const controller = new ExternalBridgeTranslationController({
                document, window, route: runtime.route, hostAdapter: deps[PORT.host], listPage: listTranslation,
                settings: deps[SERVICE.settings], translation: deps[SERVICE.translation], styles: deps[PORT.style],
                diagnostics: runtime.diagnostics, scope: runtime.scope,
            });
            if (!controller.start()) return { activeContributions: [] };
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
