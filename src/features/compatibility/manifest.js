// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { CompatibilityController } from "./compatibility-controller.js";

export default defineFeature({
    id: "compatibility", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [SERVICE.state, REGISTRY.feature],
    contributes: ["compatibility.enhancements"], providesCommands: [],
    activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
        const plugin = runtime.enabledContributions.includes("compatibility.enhancements")
            ? runtime.resolveLegacyPlugin?.("CompatibilityEnhancementsPlugin")
            : null;
        const controller = new CompatibilityController({ plugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
