// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { PersonalRatingController } from "./personal-rating-controller.js";
import { PERSONAL_RATING_STYLES } from "../../ui/library/personal-rating.js";

export default defineFeature({
    id: "personal-ratings", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.state, SERVICE.events, SERVICE.dialog, SERVICE.domUi], contributes: [], providesCommands: ["library.rating.open"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-personal-ratings", PERSONAL_RATING_STYLES));
        const controller = new PersonalRatingController({ host: deps[PORT.host], state: deps[SERVICE.state], events: deps[SERVICE.events], dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi], scope: runtime.scope });
        await controller.start();
        return { commands: { "library.rating.open": (/** @type {any[]} */ movies) => controller.open(movies) } };
    },
});
