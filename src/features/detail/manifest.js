// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { DetailController } from "./detail-controller.js";
import { RelatedController } from "./related-controller.js";
import { ReviewController } from "./review-controller.js";
import { ScreenshotController } from "./screenshot-controller.js";
import { JAVBUS_PREVIEW_STYLES, JavBusPreviewController } from "./javbus-preview-controller.js";
import { DETAIL_MAGNET_FILTER_STYLES, MagnetFilterController } from "./magnet-filter-controller.js";
import { JAVDB_PREVIEW_STYLES, JavDbPreviewController } from "./javdb-preview-controller.js";
import { DetailPageActionsController } from "./detail-page-actions-controller.js";

/** @param {any} runtime @param {string} contributionId @param {() => Promise<boolean> | boolean} start */
async function startOptionalDetailContribution(runtime, contributionId, start) {
    try {
        return await start() ? contributionId : null;
    } catch (error) {
        runtime.diagnostics.recordError({ source: "detail-feature", featureId: "detail", contributionId, message: error instanceof Error ? error.message : String(error) });
        return null;
    }
}

export default defineFeature({
    id: "detail", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movie, SERVICE.review, SERVICE.related, SERVICE.magnet, SERVICE.screenshot, SERVICE.state, SERVICE.events, SERVICE.domUi, SERVICE.settings, SERVICE.notifications, SERVICE.storage, SERVICE.clipboard, SERVICE.dialog, SERVICE.subtitle],
    contributes: ["detail.javdb-native", "detail.workspace", "detail.page-state-actions", "detail.javdb-preview", "detail.javbus-preview", "detail.reviews", "detail.related", "detail.native-magnets", "detail.screenshot"],
    providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (runtime.route === "owned-detail") {
            return { activeContributions: [], dispose: () => {} };
        }
        const pageActionsController = runtime.route === "detail" && runtime.enabledContributions.includes("detail.page-state-actions")
            ? new DetailPageActionsController({
                hostAdapter: deps[PORT.host], route: runtime.route, scope: runtime.scope,
                settings: deps[SERVICE.settings], dialog: deps[SERVICE.dialog], subtitle: deps[SERVICE.subtitle],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], events: deps[SERVICE.events], diagnostics: runtime.diagnostics,
            })
            : null;
        const pageActions = pageActionsController?.getFeatureStateActionsAdapter() ?? null;
        const workspaceUi = runtime.enabledContributions.includes("detail.workspace") ? deps[SERVICE.domUi] : null;
        const featureActivatedContributions = new Set(["detail.native-magnets", "detail.javdb-preview", "detail.javbus-preview", "detail.reviews", "detail.related", "detail.screenshot"]);
        const controllerContributions = runtime.enabledContributions.filter((/** @type {string} */ id) => !featureActivatedContributions.has(id));
        const controller = new DetailController({
            hostAdapter: deps[PORT.host], scope: runtime.scope, enabledContributions: controllerContributions,
            state: deps[SERVICE.state], settings: deps[SERVICE.settings], diagnostics: runtime.diagnostics,
            movie: deps[SERVICE.movie], ui: deps[SERVICE.domUi],
            pageActions, workspaceUi, styles: deps[PORT.style], eventBus: deps[SERVICE.events],
            onWorkspaceError: (error) => runtime.diagnostics.recordError({ source: "detail-feature", featureId: "detail", contributionId: "detail.workspace", message: error instanceof Error ? error.message : String(error) }),
        });
        let releasePageActionsBean = () => {};
        if (pageActionsController) {
            const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("DetailPageButtonPlugin", pageActionsController);
            if (typeof releaseCompatibilityBean === "function") {
                releasePageActionsBean = releaseCompatibilityBean;
                runtime.scope.addCleanup(releaseCompatibilityBean);
            }
        }
        const result = controller.start();
        /** @type {string[]} */ const activeContributions = [...result.activeContributions];
        if (runtime.enabledContributions.includes("detail.screenshot")) {
            try {
                const screenshotController = new ScreenshotController({
                    document, window, hostAdapter: deps[PORT.host], route: runtime.route, settings: deps[SERVICE.settings], screenshot: deps[SERVICE.screenshot],
                    styles: deps[PORT.style], ui: deps[SERVICE.domUi], diagnostics: runtime.diagnostics, scope: runtime.scope,
                });
                if (screenshotController.start()) activeContributions.push("detail.screenshot");
            } catch (error) {
                runtime.diagnostics.recordError({ source: "detail-feature", featureId: "detail", contributionId: "detail.screenshot", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("detail.native-magnets")) {
            let releaseStyle = () => {};
            try {
                releaseStyle = deps[PORT.style].register("jhs-detail-magnet-filter-feature", DETAIL_MAGNET_FILTER_STYLES);
                const magnetFilter = new MagnetFilterController({
                    document, hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], events: deps[SERVICE.events], scope: runtime.scope,
                });
                if (magnetFilter.start()) {
                    const consumers = ["DetailPageButtonPlugin", "MobileBottomBarPlugin"]
                        .map((name) => runtime.resolveCompatibilityBean?.(name))
                        .filter(Boolean);
                    for (const consumer of consumers) consumer.attachFeatureMagnetFilterAdapter?.(magnetFilter.compatibilityAdapter);
                    runtime.scope.addCleanup(() => {
                        for (const consumer of consumers) consumer.detachFeatureMagnetFilterAdapter?.(magnetFilter.compatibilityAdapter);
                    });
                    runtime.scope.addCleanup(releaseStyle);
                    activeContributions.push("detail.native-magnets");
                } else releaseStyle();
            } catch (error) {
                releaseStyle();
                runtime.diagnostics.recordError({ source: "detail-feature", featureId: "detail", contributionId: "detail.native-magnets", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (pageActionsController) {
            try {
                if (!pageActionsController.start()) {
                    const index = activeContributions.indexOf("detail.page-state-actions");
                    if (index >= 0) activeContributions.splice(index, 1);
                    releasePageActionsBean();
                }
            } catch (error) {
                const index = activeContributions.indexOf("detail.page-state-actions");
                if (index >= 0) activeContributions.splice(index, 1);
                releasePageActionsBean();
                runtime.diagnostics.recordError({ source: "detail-feature", featureId: "detail", contributionId: "detail.page-state-actions", message: error instanceof Error ? error.message : String(error) });
            }
        }
        const optionalStarts = [];
        if (runtime.enabledContributions.includes("detail.javdb-preview")) optionalStarts.push(startOptionalDetailContribution(runtime, "detail.javdb-preview", async () => {
            let releaseStyle = () => {};
            try {
                releaseStyle = deps[PORT.style].register("jhs-detail-javdb-preview-feature", JAVDB_PREVIEW_STYLES);
                const previewController = new JavDbPreviewController({
                    settings: deps[SERVICE.settings], events: deps[SERVICE.events], scope: runtime.scope,
                    storage: deps[SERVICE.storage], movie: deps[SERVICE.movie], dialog: deps[SERVICE.dialog],
                    hostAdapter: deps[PORT.host], route: runtime.route,
                    detailActions: runtime.resolveCompatibilityBean?.("DetailPageButtonPlugin") ?? null,
                });
                if (!(await previewController.start())) { releaseStyle(); return false; }
                runtime.scope.addCleanup(releaseStyle);
                const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("PreviewVideoPlugin", previewController);
                if (typeof releaseCompatibilityBean === "function") runtime.scope.addCleanup(releaseCompatibilityBean);
                return true;
            } catch (error) {
                releaseStyle();
                throw error;
            }
        }));
        if (runtime.enabledContributions.includes("detail.javbus-preview")) optionalStarts.push(startOptionalDetailContribution(runtime, "detail.javbus-preview", async () => {
            let releaseStyle = () => {};
            try {
                releaseStyle = deps[PORT.style].register("jhs-detail-javbus-preview-feature", JAVBUS_PREVIEW_STYLES);
                const previewController = new JavBusPreviewController({
                    document, window, hostAdapter: deps[PORT.host], route: runtime.route,
                    settings: deps[SERVICE.settings], events: deps[SERVICE.events], storage: deps[SERVICE.storage],
                    movie: deps[SERVICE.movie], ui: { ...deps[SERVICE.domUi], notifications: deps[SERVICE.notifications] },
                    diagnostics: runtime.diagnostics, scope: runtime.scope,
                });
                if (!previewController.start()) { releaseStyle(); return false; }
                runtime.scope.addCleanup(releaseStyle);
                return true;
            } catch (error) {
                releaseStyle();
                throw error;
            }
        }));
        if (runtime.enabledContributions.includes("detail.related")) optionalStarts.push(startOptionalDetailContribution(runtime, "detail.related", async () => {
            const relatedController = new RelatedController({
                document, hostAdapter: deps[PORT.host], route: runtime.route, related: deps[SERVICE.related],
                settings: deps[SERVICE.settings], ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics, scope: runtime.scope,
            });
            return relatedController.start();
        }));
        if (runtime.enabledContributions.includes("detail.reviews")) optionalStarts.push(startOptionalDetailContribution(runtime, "detail.reviews", async () => {
            const reviewController = new ReviewController({
                document, window, hostAdapter: deps[PORT.host], route: runtime.route, review: deps[SERVICE.review], movie: deps[SERVICE.movie],
                settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], ui: deps[SERVICE.domUi], clipboard: deps[SERVICE.clipboard],
                notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics, scope: runtime.scope,
            });
            return reviewController.start();
        }));
        for (const contributionId of await Promise.all(optionalStarts)) {
            if (contributionId) activeContributions.push(contributionId);
        }
        return { activeContributions, dispose: () => controller.dispose() };
    },
});
