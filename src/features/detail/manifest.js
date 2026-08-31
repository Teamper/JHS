// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { DetailController } from "./detail-controller.js";

export default defineFeature({
    id: "detail", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager",
    requires: [PORT.host, SERVICE.movie, SERVICE.review, SERVICE.related, SERVICE.magnet, SERVICE.screenshot, SERVICE.ui],
    contributes: ["detail.javdb-native", "detail.javbus-native", "detail.workspace", "detail.fc2-owned", "detail.page-state-actions", "detail.javdb-preview", "detail.javbus-preview", "detail.reviews", "detail.related", "detail.native-magnets", "detail.external-magnets", "detail.screenshot", "detail.external-sites"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const fc2Plugin = runtime.enabledContributions.includes("detail.fc2-owned")
            ? runtime.resolveLegacyContribution?.("detail.fc2-owned")
            : null;
        if (runtime.route === "owned-detail") {
            const controller = new DetailController({ hostAdapter: deps[PORT.host], fc2Plugin, ownedDetail: true, scope: runtime.scope, enabledContributions: runtime.enabledContributions });
            return controller.start().then(() => ({ dispose: () => controller.dispose() }));
        }
        const nativeContribution = deps[PORT.host].site === "javbus" ? "detail.javbus-native" : "detail.javdb-native";
        const nativePlugin = runtime.enabledContributions.includes(nativeContribution)
            ? runtime.resolveLegacyContribution?.(nativeContribution)
            : null;
        const workspacePlugin = runtime.enabledContributions.includes("detail.workspace")
            ? runtime.resolveLegacyContribution?.("detail.workspace")
            : null;
        const reviewPlugin = runtime.enabledContributions.includes("detail.reviews")
            ? runtime.resolveLegacyContribution?.("detail.reviews")
            : null;
        const relatedPlugin = runtime.enabledContributions.includes("detail.related")
            ? runtime.resolveLegacyContribution?.("detail.related")
            : null;
        const pageActionsPlugin = runtime.enabledContributions.includes("detail.page-state-actions")
            ? runtime.resolveLegacyContribution?.("detail.page-state-actions")
            : null;
        const screenshotPlugin = runtime.enabledContributions.includes("detail.screenshot")
            ? runtime.resolveLegacyContribution?.("detail.screenshot")
            : null;
        const magnetPlugin = runtime.enabledContributions.includes("detail.native-magnets")
            ? runtime.resolveLegacyContribution?.("detail.native-magnets")
            : null;
        const previewContribution = deps[PORT.host].site === "javbus" ? "detail.javbus-preview" : "detail.javdb-preview";
        const previewPlugin = runtime.enabledContributions.includes(previewContribution)
            ? runtime.resolveLegacyContribution?.(previewContribution)
            : null;
        const externalSitesPlugin = runtime.enabledContributions.includes("detail.external-sites")
            ? runtime.resolveLegacyContribution?.("detail.external-sites")
            : null;
        const controller = new DetailController({ hostAdapter: deps[PORT.host], fc2Plugin, nativePlugin, workspacePlugin, reviewPlugin, relatedPlugin, pageActionsPlugin, magnetPlugin, previewPlugin, externalSitesPlugin, screenshotPlugin, scope: runtime.scope, enabledContributions: runtime.enabledContributions });
        return controller.start().then(() => ({ dispose: () => controller.dispose() }));
    },
});
