// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { ListController } from "./list-controller.js";

export default defineFeature({
    id: "list", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "other"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.state, SERVICE.settings, SERVICE.eventBus],
    contributes: ["list.core", "list.auto-page", "list.fold-category", "list.actions", "list.fc2-navigation", "list.cover-state-actions", "list.javbus-images", "list.fc2-lookup"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        // Disabling the historical ListPagePlugin id disables only list.core;
        // other list contributions must retain their previous optional behavior.
        if (!runtime.enabledContributions.includes("list.core")) return { dispose: () => {} };
        const legacyPluginAdapter = runtime.resolveLegacyPlugin?.("ListPagePlugin");
        const legacyPlugin = legacyPluginAdapter?.ensureDelegate?.({ scope: () => Promise.resolve(runtime.scope) }) ?? legacyPluginAdapter;
        const autoPagePlugin = runtime.enabledContributions.includes("list.auto-page")
            ? runtime.resolveLegacyPlugin?.("AutoPagePlugin")
            : null;
        const foldCategoryPlugin = runtime.enabledContributions.includes("list.fold-category")
            ? runtime.resolveLegacyPlugin?.("FoldCategoryPlugin")
            : null;
        const actionsPlugin = runtime.enabledContributions.includes("list.actions")
            ? runtime.resolveLegacyPlugin?.("ListPageButtonPlugin")
            : null;
        const fc2NavigationPlugin = runtime.enabledContributions.includes("list.fc2-navigation")
            ? runtime.resolveLegacyPlugin?.("Fc2NavigationPlugin")
            : null;
        const coverPlugin = runtime.enabledContributions.includes("list.cover-state-actions")
            ? runtime.resolveLegacyPlugin?.("CoverButtonPlugin")
            : null;
        const fc2LookupPlugin = runtime.enabledContributions.includes("list.fc2-lookup")
            ? runtime.resolveLegacyPlugin?.("Fc2By123AvPlugin")
            : null;
        const controller = new ListController({ legacyPlugin, autoPagePlugin, foldCategoryPlugin, actionsPlugin, fc2NavigationPlugin, coverPlugin, fc2LookupPlugin, hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], eventBus: deps[SERVICE.eventBus], http: deps[SERVICE.http], stateService: deps[SERVICE.state], styles: deps[PORT.style], scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
