// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { IdentityController } from "./identity-controller.js";

export default defineFeature({
    id: "identity", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [SERVICE.movie, SERVICE.dialog, SERVICE.storage, SERVICE.imageSearch, SERVICE.actressInfo, SERVICE.settings],
    contributes: ["identity.javdb-navigation", "identity.javbus-navigation", "identity.image-search", "identity.actress-info"],
    providesCommands: [],
    activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
        const javdbNavigationPlugin = runtime.enabledContributions.includes("identity.javdb-navigation")
            ? runtime.resolveLegacyPlugin?.("NavBarPlugin")
            : null;
        const javbusNavigationPlugin = runtime.enabledContributions.includes("identity.javbus-navigation")
            ? runtime.resolveLegacyPlugin?.("BusNavBarPlugin")
            : null;
        const imageSearchPlugin = runtime.enabledContributions.includes("identity.image-search")
            ? runtime.resolveLegacyPlugin?.("SearchByImagePlugin")
            : null;
        const actressInfoPlugin = runtime.enabledContributions.includes("identity.actress-info")
            ? runtime.resolveLegacyPlugin?.("ActressInfoPlugin")
            : null;
        const controller = new IdentityController({ javdbNavigationPlugin, javbusNavigationPlugin, imageSearchPlugin, actressInfoPlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
