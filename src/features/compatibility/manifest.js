// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { CompatibilityController } from "./compatibility-controller.js";

export default defineFeature({
    id: "compatibility", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.state, SERVICE.notifications, SERVICE.domUi],
    contributes: ["compatibility.enhancements"], providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (!runtime.enabledContributions.includes("compatibility.enhancements")) return { activeContributions: [] };
        const controller = new CompatibilityController({
            document, window, location, site: runtime.site, route: runtime.route,
            host: deps[PORT.host], style: deps[PORT.style], state: deps[SERVICE.state],
            notifications: deps[SERVICE.notifications], ui: deps[SERVICE.domUi],
            scope: runtime.scope, diagnostics: runtime.diagnostics,
        });
        try {
            controller.start();
            return { activeContributions: ["compatibility.enhancements"], dispose: () => controller.dispose() };
        } catch (error) {
            controller.dispose();
            runtime.diagnostics.recordError({ source: "compatibility-feature", featureId: "compatibility", contributionId: "compatibility.enhancements", message: error instanceof Error ? error.message : String(error) });
            return { activeContributions: [] };
        }
    },
});
