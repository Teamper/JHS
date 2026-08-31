// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { IdentityController } from "./identity-controller.js";
import { IdentityBusNavigationController } from "./identity-bus-navigation-controller.js";
import { IdentityImageSearchController } from "./identity-image-search-controller.js";
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
        const javbusNavigationController = runtime.enabledContributions.includes("identity.javbus-navigation") && deps[PORT.host].site === "javbus"
            ? new IdentityBusNavigationController({ hostAdapter: deps[PORT.host], scope: runtime.scope })
            : null;
        const imageSearchController = runtime.enabledContributions.includes("identity.image-search")
            ? new IdentityImageSearchController({ dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], imageSearch: deps[SERVICE.imageSearch], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const actressInfoPlugin = runtime.enabledContributions.includes("identity.actress-info")
            ? runtime.resolveLegacyPlugin?.("ActressInfoPlugin")
            : null;
        const controller = new IdentityController({ javdbNavigationController, javbusNavigationController, imageSearchController, actressInfoPlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
