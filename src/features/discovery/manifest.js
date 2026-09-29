// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT } from "../../contracts/tokens.js";

export default defineFeature({
    id: "discovery", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "eager",
    requires: [PORT.host], contributes: ["discovery.hit-show"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (!runtime.enabledContributions.includes("discovery.hit-show")) return { activeContributions: [] };
        const { HitShowController } = await import("./hit-show-controller.js");
        const controller = new HitShowController({ hostAdapter: deps[PORT.host], scope: runtime.scope });
        try {
            const active = controller.start();
            return { activeContributions: active ? ["discovery.hit-show"] : [], dispose: () => controller.dispose() };
        } catch (error) {
            controller.dispose();
            throw error;
        }
    },
});
