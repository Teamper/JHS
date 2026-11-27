// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { MovieSelectionController, MOVIE_SELECTION_STYLES } from "./movie-selection-controller.js";

export default defineFeature({
    id: "movie-selection", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movieSelection, SERVICE.domUi, SERVICE.state, SERVICE.clipboard], contributes: [], providesCommands: ["selection.toggle"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-movie-selection", MOVIE_SELECTION_STYLES));
        const controller = new MovieSelectionController({ host:deps[PORT.host], service:deps[SERVICE.movieSelection], ui:deps[SERVICE.domUi], state:deps[SERVICE.state], clipboard:deps[SERVICE.clipboard],
            scope:runtime.scope, available:runtime.isCommandAvailable, execute:(name,movies) => runtime.executeCommand(name,movies) });
        controller.start();
        return { commands: { "selection.toggle": () => controller.toggle() } };
    },
});
