// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { Fc2OwnedPageController } from "./fc2-owned-page-controller.js";
import { Fc2WorkspaceService } from "./fc2-workspace-service.js";
import { FC2_WORKSPACE_STYLES } from "../../ui/detail/fc2-workspace-styles.js";
import { DETAIL_SHORTCUT_STYLES, DetailShortcutController } from "./detail-shortcut-controller.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

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

        const want = deps[SERVICE.account].want;
        const service = new Fc2WorkspaceService({
            runtimeServices: {
                want, movie: deps[SERVICE.movie], magnet: deps[SERVICE.magnet], dialog: deps[SERVICE.dialog],
                account: deps[SERVICE.account], credential: deps[SERVICE.credential], translation: deps[SERVICE.translation],
                settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], screenshot: deps[SERVICE.screenshot],
                review: deps[SERVICE.review], related: deps[SERVICE.related], state: deps[SERVICE.state],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], logger: deps[SERVICE.clog],
                ensureFc2Catalog: () => runtime.executeCommand("fc2-catalog.ensure"),
                scope: () => Promise.resolve(runtime.scope),
                mountShortcuts: (/** @type {any} */ context) => {
                    if (!runtime.isContributionEnabled("detail", "detail.shortcuts", "DetailShortcutPlugin")) return;
                    const scope = new LifecycleScope("fc2-detail-shortcuts");
                    const releaseOwner = runtime.scope.addCleanup(() => scope.dispose());
                    scope.addCleanup(releaseOwner);
                    context.addObserver({ disconnect: () => scope.dispose() });
                    const shortcuts = new DetailShortcutController({ root: context.root[0], settings: deps[SERVICE.settings], scope, isActive: () => context.isAlive() });
                    if (shortcuts.start()) {
                        scope.addCleanup(deps[PORT.style].register(`jhs-fc2-shortcuts-${context.namespace}`, DETAIL_SHORTCUT_STYLES));
                        runtime.diagnostics.setContribution("detail.shortcuts", true);
                    }
                },
            },
            resolveDependency: (name) => runtime.resolveCompatibilityBean(name),
        });
        runtime.scope.listen(deps[SERVICE.credential], "credentials.changed", (/** @type {any} */ event) => { if (event.detail?.key === "jhs_appAuthorization") service.refreshWantAccounts(); });
        runtime.scope.addCleanup(() => service.disposeWantContexts());
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
