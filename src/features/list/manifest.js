// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { ListController } from "./list-controller.js";

export default defineFeature({
    id: "list", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "other"], startup: "eager",
    requires: [PORT.host, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.state, SERVICE.settings],
    contributes: ["list.core", "list.auto-page", "list.fold-category", "list.actions"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        // Disabling the historical ListPagePlugin id disables only list.core;
        // other list contributions must retain their previous optional behavior.
        if (!runtime.enabledContributions.includes("list.core")) return { dispose: () => {} };
        const legacyPlugin = runtime.resolveLegacyPlugin?.("ListPagePlugin");
        const autoPagePlugin = runtime.enabledContributions.includes("list.auto-page")
            ? runtime.resolveLegacyPlugin?.("AutoPagePlugin")
            : null;
        const foldCategoryPlugin = runtime.enabledContributions.includes("list.fold-category")
            ? runtime.resolveLegacyPlugin?.("FoldCategoryPlugin")
            : null;
        const actionsPlugin = runtime.enabledContributions.includes("list.actions")
            ? runtime.resolveLegacyPlugin?.("ListPageButtonPlugin")
            : null;
        if (!legacyPlugin) throw new Error("List feature requires the ListPagePlugin compatibility adapter");
        const controller = new ListController({ legacyPlugin, autoPagePlugin, foldCategoryPlugin, actionsPlugin, hostAdapter: deps[PORT.host], scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
