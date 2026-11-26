// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { Fc2CatalogController } from "./fc2-catalog-controller.js";

export default defineFeature({
    id: "fc2-catalog", kind: "feature", disableable: true,
    sites: ["javdb"], routes: [], startup: "idle",
    requires: [PORT.host, SERVICE.movie, SERVICE.domUi, SERVICE.notifications, SERVICE.diagnostics],
    contributionRoutes: ["list", "detail", "owned-detail"],
    contributes: ["detail.fc2-lookup"], providesCommands: ["fc2-catalog.ensure"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "detail.fc2-lookup";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [], commands: { "fc2-catalog.ensure": () => null } };
        const unavailable = { "fc2-catalog.ensure": () => null };
        /** @type {Fc2CatalogController | null} */ let controller = null;
        try {
            const listPage = runtime.getCapability?.("list.core");
            controller = new Fc2CatalogController({
                document, window, site: runtime.site, route: runtime.route, hostAdapter: deps[PORT.host],
                movie: deps[SERVICE.movie], ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications],
                diagnostics: deps[SERVICE.diagnostics], scope: runtime.scope,
                processAddedItems: typeof listPage?.processAddedItems === "function" ? (items) => listPage.processAddedItems(items) : undefined,
            });
            if (!(await controller.start())) return { activeContributions: [], commands: unavailable };
            runtime.inspect?.(id, controller);
            runtime.provideCapability?.(id, controller);
            return { activeContributions: [id], commands: { "fc2-catalog.ensure": () => controller } };
        } catch (error) {
            controller?.dispose();
            runtime.diagnostics.recordError({ source: "fc2-catalog-feature", featureId: "fc2-catalog", contributionId: id, message: error instanceof Error ? error.message : String(error) });
            return { activeContributions: [], commands: unavailable };
        }
    },
});
