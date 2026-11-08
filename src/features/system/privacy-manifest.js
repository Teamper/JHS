// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { PrivacyController } from "./privacy-controller.js";
import { PRIVACY_STYLES } from "../../ui/settings/privacy-controls.js";

export default defineFeature({
    id: "privacy", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.privacy, SERVICE.settings, SERVICE.domUi, SERVICE.dialog, SERVICE.notifications],
    contributes: [], providesCommands: ["privacy.toggle", "privacy.bind-reveal"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-privacy", PRIVACY_STYLES));
        const controller = new PrivacyController({ host: deps[PORT.host], privacy: deps[SERVICE.privacy], settings: deps[SERVICE.settings], scope: runtime.scope, ui: deps[SERVICE.domUi], dialog: deps[SERVICE.dialog], notifications: deps[SERVICE.notifications] });
        await controller.start();
        return { commands: {
            "privacy.toggle": () => controller.toggle(),
            "privacy.bind-reveal": (/** @type {HTMLElement} */ button, /** @type {any} */ scope) => controller.bindReveal(button, scope),
        } };
    },
});
