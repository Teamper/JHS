// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { StatsController } from "./stats-controller.js";

export default defineFeature({
    id: "stats", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "idle",
    requires: [SERVICE.diagnostics, SERVICE.dialog, SERVICE.movie, SERVICE.state, REGISTRY.feature], contributes: ["stats.dashboard"], providesCommands: [],
    activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
        const plugin = runtime.resolveLegacyPlugin?.("StatsPlugin");
        const controller = new StatsController({ statsPlugin: plugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
