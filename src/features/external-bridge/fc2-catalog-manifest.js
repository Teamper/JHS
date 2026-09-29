// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { Fc2CatalogController } from "./fc2-catalog-controller.js";

export default defineFeature({
    id: "fc2-catalog", kind: "feature", disableable: true,
    sites: ["javdb"], routes: [], startup: "idle",
    requires: [PORT.host, SERVICE.movie, SERVICE.domUi, SERVICE.notifications, SERVICE.diagnostics],
    contributes: ["detail.fc2-lookup"], providesCommands: ["fc2-catalog.ensure"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "detail.fc2-lookup";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [], commands: { "fc2-catalog.ensure": () => null } };
        const unavailable = { "fc2-catalog.ensure": () => null };
        /** @type {Fc2CatalogController | null} */ let controller = null;
        let detachConsumer = () => {};
        let unregisterCompatibilityBean = () => {};
        try {
            const listPage = runtime.resolveCompatibilityBean?.("ListPagePlugin");
            controller = new Fc2CatalogController({
                document, window, site: runtime.site, route: runtime.route, hostAdapter: deps[PORT.host],
                movie: deps[SERVICE.movie], ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications],
                diagnostics: deps[SERVICE.diagnostics], scope: runtime.scope,
                processAddedItems: typeof listPage?.processAddedItems === "function" ? (items) => listPage.processAddedItems(items) : undefined,
            });
            if (!(await controller.start())) return { activeContributions: [], commands: unavailable };
            const fc2Enabled = runtime.isContributionEnabled("fc2-workspace", "detail.fc2-owned", "Fc2Plugin");
            const fc2 = fc2Enabled ? await runtime.executeCommand("detail.fc2.workspace") : null;
            fc2?.attachFeature123AvAdapter?.(controller);
            let consumerDetached = false;
            detachConsumer = () => {
                if (consumerDetached) return;
                consumerDetached = true;
                fc2?.detachFeature123AvAdapter?.(controller);
            };
            runtime.scope.addCleanup(detachConsumer);
            const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("Fc2By123AvPlugin", controller);
            let beanReleased = false;
            unregisterCompatibilityBean = () => {
                if (beanReleased) return;
                beanReleased = true;
                if (typeof releaseCompatibilityBean === "function") releaseCompatibilityBean();
            };
            runtime.scope.addCleanup(unregisterCompatibilityBean);
            return { activeContributions: [id], commands: { "fc2-catalog.ensure": () => controller } };
        } catch (error) {
            controller?.dispose();
            detachConsumer();
            unregisterCompatibilityBean();
            runtime.diagnostics.recordError({ source: "fc2-catalog-feature", featureId: "fc2-catalog", contributionId: id, message: error instanceof Error ? error.message : String(error) });
            return { activeContributions: [], commands: unavailable };
        }
    },
});
