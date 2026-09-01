// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { BlacklistController } from "./blacklist-controller.js";
import { HistoryController } from "./history-controller.js";
import { LibraryController } from "./library-controller.js";

export default defineFeature({
    id: "library", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb", "javbus"], routes: ["list", "detail", "other"], startup: "eager",
    requires: [PORT.host, PORT.dialog, PORT.style, SERVICE.storage, SERVICE.settings, SERVICE.eventBus, SERVICE.storageMutation, SERVICE.state, SERVICE.http, SERVICE.movie, SERVICE.ui, REGISTRY.feature],
    contributes: ["library.history", "library.keyword-filter", "library.state-actions", "library.blacklist", "library.favorite-actresses"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const historyController = runtime.enabledContributions.includes("library.history")
            ? new HistoryController({ hostAdapter: deps[PORT.host], dialog: deps[PORT.dialog], movie: deps[SERVICE.movie], settings: deps[SERVICE.settings], state: deps[SERVICE.state], storage: deps[SERVICE.storage], styles: deps[PORT.style], features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const blacklistController = runtime.enabledContributions.includes("library.blacklist")
            ? new BlacklistController({ hostAdapter: deps[PORT.host], dialog: deps[PORT.dialog], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], state: deps[SERVICE.state], http: deps[SERVICE.http], eventBus: deps[SERVICE.eventBus], mutation: deps[SERVICE.storageMutation], features: deps[REGISTRY.feature], styles: deps[PORT.style], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const controller = new LibraryController({ historyController, blacklistController, keywordFilterEnabled: runtime.enabledContributions.includes("library.keyword-filter"), stateImportEnabled: runtime.enabledContributions.includes("library.state-actions"), favoriteActressesEnabled: runtime.enabledContributions.includes("library.favorite-actresses"), hostAdapter: deps[PORT.host], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], eventBus: deps[SERVICE.eventBus], storageMutation: deps[SERVICE.storageMutation], state: deps[SERVICE.state], http: deps[SERVICE.http], route: runtime.route, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
