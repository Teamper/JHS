// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "actress-info", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "idle",
    requires: [PORT.style, SERVICE.actressInfo, SERVICE.settings],
    contributes: ["identity.actress-info"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "identity.actress-info";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [] };
        const { ActressInfoController, INFO_TAG_CSS } = await import("./actress-info-controller.js");
        const controller = new ActressInfoController({
            document, location, service: deps[SERVICE.actressInfo], settings: deps[SERVICE.settings],
            scope: runtime.scope, diagnostics: runtime.diagnostics,
        });
        const releaseStyle = deps[PORT.style].register("feature-actress-info", INFO_TAG_CSS);
        runtime.scope.addCleanup(releaseStyle);
        controller.start();
        return { activeContributions: [id], dispose: () => controller.dispose() };
    },
});
