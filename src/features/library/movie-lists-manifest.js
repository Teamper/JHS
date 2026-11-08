// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { MovieListsController, MOVIE_LISTS_STYLES } from "./movie-lists-controller.js";

export default defineFeature({
    id:"movie-lists", kind:"feature", disableable:true, sites:["javdb","javbus"], routes:[], startup:"eager",
    requires:[PORT.host, PORT.style, SERVICE.javdbLists, SERVICE.dialog, SERVICE.domUi], contributes:[], providesCommands:["library.lists.open"],
    activate:async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-movie-lists",MOVIE_LISTS_STYLES));
        const controller = new MovieListsController({host:deps[PORT.host], service:deps[SERVICE.javdbLists], dialog:deps[SERVICE.dialog], ui:deps[SERVICE.domUi], scope:runtime.scope});
        controller.start();
        runtime.scope.addCleanup(() => { void deps[SERVICE.javdbLists].stopAll(); });
        return {commands:{"library.lists.open":(/** @type {any[]} */ movies) => controller.open(movies)}};
    },
});
