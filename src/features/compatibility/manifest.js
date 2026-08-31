// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { CompatibilityController } from "./compatibility-controller.js";

export default defineFeature({
    id: "compatibility", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.storage, SERVICE.state, REGISTRY.feature],
    contributes: ["compatibility.enhancements"], providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const controller = new CompatibilityController({ hostAdapter: deps[PORT.host], styles: deps[PORT.style], storage: deps[SERVICE.storage], state: deps[SERVICE.state], features: deps[REGISTRY.feature], route: runtime.route, enabled: runtime.enabledContributions.includes("compatibility.enhancements"), scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
