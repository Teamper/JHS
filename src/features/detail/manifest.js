// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { DetailController } from "./detail-controller.js";

export default defineFeature({
    id: "detail", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager",
    requires: [PORT.host, SERVICE.movie, SERVICE.review, SERVICE.related, SERVICE.magnet, SERVICE.screenshot],
    contributes: ["detail.javdb-native", "detail.javbus-native", "detail.workspace", "detail.fc2-owned", "detail.fc2-navigation", "detail.fc2-lookup", "detail.cover-state-actions", "detail.page-state-actions", "detail.javdb-preview", "detail.javbus-images", "detail.javbus-preview", "detail.reviews", "detail.related", "detail.native-magnets", "detail.external-magnets", "detail.screenshot", "detail.external-sites"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        if (runtime.route === "owned-detail") return { dispose: () => {} };
        const nativeContribution = deps[PORT.host].site === "javbus" ? "detail.javbus-native" : "detail.javdb-native";
        const nativePlugin = runtime.enabledContributions.includes(nativeContribution)
            ? runtime.resolveLegacyPlugin?.(deps[PORT.host].site === "javbus" ? "BusDetailPagePlugin" : "DetailPagePlugin")
            : null;
        const workspacePlugin = runtime.enabledContributions.includes("detail.workspace")
            ? runtime.resolveLegacyPlugin?.("DetailWorkspacePlugin")
            : null;
        const reviewPlugin = runtime.enabledContributions.includes("detail.reviews")
            ? runtime.resolveLegacyPlugin?.("ReviewPlugin")
            : null;
        const relatedPlugin = runtime.enabledContributions.includes("detail.related")
            ? runtime.resolveLegacyPlugin?.("RelatedPlugin")
            : null;
        const screenshotPlugin = runtime.enabledContributions.includes("detail.screenshot")
            ? runtime.resolveLegacyPlugin?.("ScreenShotPlugin")
            : null;
        const controller = new DetailController({ hostAdapter: deps[PORT.host], nativePlugin, workspacePlugin, reviewPlugin, relatedPlugin, screenshotPlugin, scope: runtime.scope, enabledContributions: runtime.enabledContributions });
        return controller.start().then(() => ({ dispose: () => controller.dispose() }));
    },
});
