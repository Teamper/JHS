// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { StatsController } from "./stats-controller.js";

export default defineFeature({
    id: "stats", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "idle",
    requires: [SERVICE.diagnostics, SERVICE.dialog, SERVICE.movie, SERVICE.storage, SERVICE.state, REGISTRY.feature], contributes: ["stats.dashboard"], providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const controller = new StatsController({ diagnostics: deps[SERVICE.diagnostics], dialog: deps[SERVICE.dialog], movie: deps[SERVICE.movie], storage: deps[SERVICE.storage], state: deps[SERVICE.state], features: deps[REGISTRY.feature], route: runtime.route, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
