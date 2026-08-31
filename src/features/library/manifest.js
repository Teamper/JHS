// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { LibraryController } from "./library-controller.js";

export default defineFeature({
    id: "library", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "detail", "other"], startup: "eager",
    requires: [PORT.host, SERVICE.storage, SERVICE.settings, SERVICE.eventBus, SERVICE.storageMutation],
    contributes: ["library.history", "library.keyword-filter", "library.state-actions", "library.blacklist", "library.favorite-actresses"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const historyPlugin = runtime.enabledContributions.includes("library.history")
            ? runtime.resolveLegacyPlugin?.("HistoryPlugin")
            : null;
        const statePlugin = runtime.enabledContributions.includes("library.state-actions")
            ? runtime.resolveLegacyPlugin?.("WantAndWatchedVideosPlugin")
            : null;
        const blacklistPlugin = runtime.enabledContributions.includes("library.blacklist")
            ? runtime.resolveLegacyPlugin?.("BlacklistPlugin")
            : null;
        const favoritePlugin = runtime.enabledContributions.includes("library.favorite-actresses")
            ? runtime.resolveLegacyPlugin?.("FavoriteActressesPlugin")
            : null;
        const controller = new LibraryController({ historyPlugin, statePlugin, blacklistPlugin, favoritePlugin, keywordFilterEnabled: runtime.enabledContributions.includes("library.keyword-filter"), hostAdapter: deps[PORT.host], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], eventBus: deps[SERVICE.eventBus], storageMutation: deps[SERVICE.storageMutation], route: runtime.route, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
