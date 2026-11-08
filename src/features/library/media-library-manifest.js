// @ts-check
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { MediaLibraryController } from "./media-library-controller.js";
import { MEDIA_LIBRARY_STYLES } from "../../ui/settings/media-connections.js";

export default defineFeature({
    id: "media-library", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.mediaLibrary, SERVICE.settings, SERVICE.dialog, SERVICE.domUi], contributes: [], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-media-library", MEDIA_LIBRARY_STYLES));
        const controller = new MediaLibraryController({ host: deps[PORT.host], service: deps[SERVICE.mediaLibrary], scope: runtime.scope, settings: deps[SERVICE.settings], dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi] });
        await controller.start();
        return {};
    },
});
