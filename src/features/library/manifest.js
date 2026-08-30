// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { LibraryController } from "./library-controller.js";

export default defineFeature({
    id: "library", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "detail", "other"], startup: "eager",
    requires: [],
    contributes: ["library.history", "library.keyword-filter", "library.state-actions", "library.blacklist", "library.favorite-actresses"],
    providesCommands: [],
    activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
        const historyPlugin = runtime.enabledContributions.includes("library.history")
            ? runtime.resolveLegacyPlugin?.("HistoryPlugin")
            : null;
        const statePlugin = runtime.enabledContributions.includes("library.state-actions")
            ? runtime.resolveLegacyPlugin?.("WantAndWatchedVideosPlugin")
            : null;
        const controller = new LibraryController({ historyPlugin, statePlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
