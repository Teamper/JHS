// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { Fc2OwnedPageController } from "./fc2-owned-page-controller.js";
import { Fc2WorkspaceService } from "./fc2-workspace-service.js";
import { FC2_WORKSPACE_STYLES } from "../../ui/detail/fc2-workspace-styles.js";

const contributionId = "detail.fc2-owned";
const commandId = "detail.fc2.workspace";

export default defineFeature({
    id: "fc2-workspace", kind: "feature", disableable: true,
    sites: ["javdb"], routes: ["list", "detail", "owned-detail"], startup: "eager",
    requires: [PORT.style, SERVICE.movie, SERVICE.magnet, SERVICE.dialog, SERVICE.account, SERVICE.credential, SERVICE.translation, SERVICE.settings, SERVICE.storage, SERVICE.screenshot, SERVICE.review, SERVICE.related, SERVICE.state, SERVICE.domUi, SERVICE.notifications, SERVICE.clog],
    contributes: [contributionId], providesCommands: [commandId],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (!runtime.enabledContributions.includes(contributionId)) {
            return { activeContributions: [], commands: { [commandId]: () => null } };
        }

        const service = new Fc2WorkspaceService({
            runtimeServices: {
                movie: deps[SERVICE.movie], magnet: deps[SERVICE.magnet], dialog: deps[SERVICE.dialog],
                account: deps[SERVICE.account], credential: deps[SERVICE.credential], translation: deps[SERVICE.translation],
                settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], screenshot: deps[SERVICE.screenshot],
                review: deps[SERVICE.review], related: deps[SERVICE.related], state: deps[SERVICE.state],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], logger: deps[SERVICE.clog],
                ensureFc2Catalog: () => runtime.executeCommand("fc2-catalog.ensure"),
                scope: () => Promise.resolve(runtime.scope),
            },
            resolveDependency: (name) => runtime.resolveCompatibilityBean(name),
        });
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-fc2-workspace-feature", FC2_WORKSPACE_STYLES));
        const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("Fc2Plugin", service);
        if (typeof releaseCompatibilityBean === "function") runtime.scope.addCleanup(releaseCompatibilityBean);

        /** @type {Fc2OwnedPageController | null} */ let pageController = null;
        if (runtime.route === "owned-detail") {
            const controller = new Fc2OwnedPageController({
                document, window, location, scope: runtime.scope, adapter: service,
                onError: (error) => runtime.diagnostics.recordError({
                    source: "fc2-workspace-feature", featureId: "fc2-workspace", contributionId,
                    message: error instanceof Error ? error.message : String(error),
                }),
            });
            pageController = controller;
            try {
                if (!(await controller.start())) pageController = null;
            } catch (error) {
                controller.dispose();
                pageController = null;
                runtime.diagnostics.recordError({
                    source: "fc2-workspace-feature", featureId: "fc2-workspace", contributionId,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return {
            activeContributions: [contributionId],
            commands: { [commandId]: () => service },
            dispose: () => pageController?.dispose(),
        };
    },
});
