// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT } from "../../contracts/tokens.js";

export default defineFeature({
    id: "ranking", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "eager",
    requires: [PORT.host, PORT.style],
    contributes: ["discovery.top250"],
    providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (!runtime.enabledContributions.includes("discovery.top250")) return { activeContributions: [] };
        const { Top250Controller } = await import("./top250-controller.js");
        const controller = new Top250Controller({ hostAdapter: deps[PORT.host], styles: deps[PORT.style], scope: runtime.scope });
        try {
            controller.start();
            return { activeContributions: ["discovery.top250"], dispose: () => controller.dispose() };
        } catch (error) {
            controller.dispose();
            throw error;
        }
    },
});
