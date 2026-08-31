// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { IdentityController } from "./identity-controller.js";
import { IdentityNavigationController } from "./identity-navigation-controller.js";

export default defineFeature({
    id: "identity", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movie, SERVICE.dialog, SERVICE.storage, SERVICE.imageSearch, SERVICE.actressInfo, SERVICE.settings],
    contributes: ["identity.javdb-navigation", "identity.javbus-navigation", "identity.image-search", "identity.actress-info"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const javdbNavigationController = runtime.enabledContributions.includes("identity.javdb-navigation") && deps[PORT.host].site === "javdb"
            ? new IdentityNavigationController({ hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], styles: deps[PORT.style], scope: runtime.scope })
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
        const controller = new IdentityController({ javdbNavigationController, javbusNavigationPlugin, imageSearchPlugin, actressInfoPlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
