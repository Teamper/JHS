// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { DetailController } from "./detail-controller.js";
import { DetailBusNativeController } from "./detail-bus-native-controller.js";
import { DetailNativeController } from "./detail-native-controller.js";
import { DetailRelatedController } from "./detail-related-controller.js";
import { DetailReviewsController } from "./detail-reviews-controller.js";
import { DetailScreenshotController } from "./detail-screenshot-controller.js";
import { DetailWorkspaceController } from "./detail-workspace-controller.js";
import { DetailExternalMagnetsController } from "./detail-external-magnets-controller.js";
import { DetailNativeMagnetsController } from "./detail-native-magnets-controller.js";
import { DetailExternalSitesController } from "./detail-external-sites-controller.js";
import { DetailJavBusPreviewController } from "./detail-javbus-preview-controller.js";
import { DetailPageStateActionsController } from "./detail-page-state-actions-controller.js";
import { DetailJavDbPreviewController } from "./detail-javdb-preview-controller.js";

export default defineFeature({
    id: "detail", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movie, SERVICE.fc2Lookup, SERVICE.fc2OwnedDetail, SERVICE.review, SERVICE.related, SERVICE.magnet, SERVICE.screenshot, SERVICE.settings, SERVICE.storage, SERVICE.eventBus, SERVICE.http, SERVICE.dialog, SERVICE.subtitle, SERVICE.state, SERVICE.translation, SERVICE.ui, REGISTRY.feature],
    contributes: ["detail.javdb-native", "detail.javbus-native", "detail.workspace", "detail.fc2-owned", "detail.page-state-actions", "detail.javdb-preview", "detail.javbus-preview", "detail.reviews", "detail.related", "detail.native-magnets", "detail.external-magnets", "detail.screenshot", "detail.external-sites"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const createFc2Controller = (/** @type {any} */ fc2Lookup) => runtime.enabledContributions.includes("detail.fc2-owned")
            ? deps[SERVICE.fc2OwnedDetail].create({
                hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], magnet: deps[SERVICE.magnet], dialog: deps[SERVICE.dialog],
                translation: deps[SERVICE.translation], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage],
                screenshot: deps[SERVICE.screenshot], review: deps[SERVICE.review], related: deps[SERVICE.related], state: deps[SERVICE.state],
                features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope, fc2Lookup,
            })
            : null;
        const fc2Lookup = runtime.enabledContributions.includes("detail.fc2-owned")
            ? deps[SERVICE.fc2Lookup]
            : null;
        const fc2Plugin = createFc2Controller(fc2Lookup);
        if (runtime.route === "owned-detail") {
            const externalMagnetsController = runtime.enabledContributions.includes("detail.external-magnets")
                ? new DetailExternalMagnetsController({ storage: deps[SERVICE.storage], http: deps[SERVICE.http], magnet: deps[SERVICE.magnet], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
                : null;
            const externalSitesController = runtime.enabledContributions.includes("detail.external-sites")
                ? new DetailExternalSitesController({ hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
                : null;
            externalMagnetsController?.start?.();
            externalSitesController?.start?.();
            const controller = new DetailController({ hostAdapter: deps[PORT.host], fc2Plugin, fc2Lookup, externalMagnetsController, externalSitesPlugin: externalSitesController, isolateContribution: runtime.isolateContribution, ownedDetail: true, scope: runtime.scope, enabledContributions: runtime.enabledContributions });
            return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
        }
        const nativeContribution = deps[PORT.host].site === "javbus" ? "detail.javbus-native" : "detail.javdb-native";
        const nativeController = runtime.enabledContributions.includes(nativeContribution)
            ? deps[PORT.host].site === "javdb"
                ? new DetailNativeController({ hostAdapter: deps[PORT.host], scope: runtime.scope })
                : new DetailBusNativeController({ hostAdapter: deps[PORT.host], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const workspaceController = runtime.enabledContributions.includes("detail.workspace")
            ? new DetailWorkspaceController({ hostAdapter: deps[PORT.host], styles: deps[PORT.style], eventBus: deps[SERVICE.eventBus], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const reviewController = runtime.enabledContributions.includes("detail.reviews")
            ? new DetailReviewsController({ hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], review: deps[SERVICE.review], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const relatedController = runtime.enabledContributions.includes("detail.related")
            ? new DetailRelatedController({ hostAdapter: deps[PORT.host], related: deps[SERVICE.related], settings: deps[SERVICE.settings], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const pageActionsPlugin = runtime.enabledContributions.includes("detail.page-state-actions")
            ? new DetailPageStateActionsController({ hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], dialog: deps[SERVICE.dialog], subtitle: deps[SERVICE.subtitle], state: deps[SERVICE.state], settings: deps[SERVICE.settings], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const screenshotController = runtime.enabledContributions.includes("detail.screenshot")
            ? new DetailScreenshotController({ hostAdapter: deps[PORT.host], screenshot: deps[SERVICE.screenshot], settings: deps[SERVICE.settings], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const externalMagnetsController = runtime.enabledContributions.includes("detail.external-magnets")
            ? new DetailExternalMagnetsController({ storage: deps[SERVICE.storage], http: deps[SERVICE.http], magnet: deps[SERVICE.magnet], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const nativeMagnetsController = runtime.enabledContributions.includes("detail.native-magnets")
            ? new DetailNativeMagnetsController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], eventBus: deps[SERVICE.eventBus], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const externalSitesController = runtime.enabledContributions.includes("detail.external-sites")
            ? new DetailExternalSitesController({ hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const javBusPreviewController = deps[PORT.host].site === "javbus" && runtime.enabledContributions.includes("detail.javbus-preview")
            ? new DetailJavBusPreviewController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], movie: deps[SERVICE.movie], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const previewContribution = deps[PORT.host].site === "javbus" ? "detail.javbus-preview" : "detail.javdb-preview";
        const previewPlugin = deps[PORT.host].site === "javbus" ? javBusPreviewController : runtime.enabledContributions.includes(previewContribution)
            ? new DetailJavDbPreviewController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], movie: deps[SERVICE.movie], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope, detailActions: pageActionsPlugin })
            : null;
        const externalSitesPlugin = externalSitesController;
        externalMagnetsController?.start?.();
        externalSitesController?.start?.();
        const controller = new DetailController({ hostAdapter: deps[PORT.host], fc2Plugin, fc2Lookup, nativeController, workspaceController, reviewController, relatedController, pageActionsPlugin, magnetPlugin: nativeMagnetsController, externalMagnetsController, previewPlugin, externalSitesPlugin, screenshotController, isolateContribution: runtime.isolateContribution, scope: runtime.scope, enabledContributions: runtime.enabledContributions });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
