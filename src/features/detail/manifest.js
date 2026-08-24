// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { DetailController } from "./detail-controller.js";

export default defineFeature({
    id: "detail", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["detail"], startup: "eager",
    requires: [PORT.host, SERVICE.movie, SERVICE.review, SERVICE.related, SERVICE.magnet, SERVICE.screenshot],
    contributes: ["detail.javdb-native", "detail.javbus-native", "detail.workspace", "detail.fc2-owned", "detail.fc2-lookup", "detail.cover-state-actions", "detail.page-state-actions", "detail.javdb-preview", "detail.javbus-images", "detail.javbus-preview", "detail.reviews", "detail.related", "detail.native-magnets", "detail.external-magnets", "detail.screenshot", "detail.external-sites"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const controller = new DetailController({ hostAdapter: deps[PORT.host], scope: runtime.scope, enabledContributions: runtime.enabledContributions });
        controller.start();
        return { dispose: () => controller.dispose() };
    },
});
