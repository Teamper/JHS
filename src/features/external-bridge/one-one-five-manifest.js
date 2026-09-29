// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "one-one-five", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "detail"], startup: "idle",
    requires: [PORT.host, SERVICE.dialog, SERVICE.settings, SERVICE.events, SERVICE.offline, SERVICE.notifications, SERVICE.domUi, SERVICE.diagnostics],
    contributes: ["external-bridge.115-match"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "external-bridge.115-match";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [] };
        const { OneOneFiveMatchController } = await import("./one-one-five-match-controller.js");
        /** @type {InstanceType<typeof OneOneFiveMatchController> | null} */ let controller = null;
        let releaseCompatibilityBean = () => {};
        try {
            controller = new OneOneFiveMatchController({
                document, window, route: runtime.route, host: deps[PORT.host], offline: deps[SERVICE.offline],
                settings: deps[SERVICE.settings], events: deps[SERVICE.events], dialog: deps[SERVICE.dialog],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], scope: runtime.scope,
                diagnostics: deps[SERVICE.diagnostics],
            });
            if (!controller.start()) throw new Error("115 matching controller did not start");
            runtime.scope.addCleanup(() => controller?.dispose());
            const release = runtime.registerCompatibilityBean?.("OneOneFiveMatchPlugin", controller);
            if (typeof release === "function") releaseCompatibilityBean = release;
            runtime.scope.addCleanup(() => releaseCompatibilityBean());
            return { activeContributions: [id] };
        } catch (error) {
            releaseCompatibilityBean();
            controller?.dispose();
            runtime.diagnostics.recordError({ source: "one-one-five-feature", featureId: "one-one-five", contributionId: id, message: error instanceof Error ? error.message : String(error) });
            return { activeContributions: [] };
        }
    },
});
