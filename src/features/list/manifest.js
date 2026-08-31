// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { ListController } from "./list-controller.js";

export default defineFeature({
    id: "list", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "other"], startup: "eager",
    legacyApiAliases: ["ListPagePlugin"],
    requires: [PORT.host, PORT.style, SERVICE.translation, SERVICE.http, SERVICE.legacyStorage, SERVICE.state, SERVICE.settings, SERVICE.eventBus, SERVICE.ui, REGISTRY.feature],
    contributes: ["list.core", "list.auto-page", "list.fold-category", "list.actions", "list.fc2-navigation", "list.cover-state-actions", "list.javbus-images", "list.fc2-lookup"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        // Disabling list.core disables the List Feature while optional contributions retain their own switches.
        if (!runtime.enabledContributions.includes("list.core")) return { dispose: () => {} };
        const autoPagePlugin = runtime.enabledContributions.includes("list.auto-page")
            ? runtime.resolveLegacyContribution?.("list.auto-page")
            : null;
        const foldCategoryPlugin = runtime.enabledContributions.includes("list.fold-category")
            ? runtime.resolveLegacyContribution?.("list.fold-category")
            : null;
        const actionsPlugin = runtime.enabledContributions.includes("list.actions")
            ? runtime.resolveLegacyContribution?.("list.actions")
            : null;
        const fc2NavigationPlugin = runtime.enabledContributions.includes("list.fc2-navigation")
            ? runtime.resolveLegacyContribution?.("list.fc2-navigation")
            : null;
        const coverPlugin = runtime.enabledContributions.includes("list.cover-state-actions")
            ? runtime.resolveLegacyContribution?.("list.cover-state-actions")
            : null;
        const fc2LookupPlugin = runtime.enabledContributions.includes("list.fc2-lookup")
            ? runtime.resolveLegacyContribution?.("list.fc2-lookup")
            : null;
        const busImgPlugin = runtime.enabledContributions.includes("list.javbus-images")
            ? runtime.resolveLegacyContribution?.("list.javbus-images")
            : null;
        const controller = new ListController(/** @type {any} */ ({ features: deps[REGISTRY.feature], busImgPlugin, autoPagePlugin, foldCategoryPlugin, actionsPlugin, fc2NavigationPlugin, coverPlugin, fc2LookupPlugin, hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.legacyStorage], eventBus: deps[SERVICE.eventBus], http: deps[SERVICE.http], stateService: deps[SERVICE.state], translation: deps[SERVICE.translation], styles: deps[PORT.style], ui: deps[SERVICE.ui], scope: runtime.scope }));
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
