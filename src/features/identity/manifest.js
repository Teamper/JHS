// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "identity", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movie, SERVICE.navigation, SERVICE.notifications, SERVICE.clipboard, SERVICE.dialog, SERVICE.storage, SERVICE.imageSearch, SERVICE.settings],
    contributes: ["identity.javdb-navigation", "identity.javbus-navigation", "identity.image-search", "detail.javbus-native"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const enabled = runtime.enabledContributions;
        const activeContributions = [...enabled];
        let searchImage = null;
        if (enabled.includes("identity.image-search")) {
            let releaseStyle = () => {};
            let controller = null;
            try {
                const { ImageSearchController, IMAGE_SEARCH_CSS } = await import("./image-search-controller.js");
                controller = new ImageSearchController({
                    document, window, dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], imageSearch: deps[SERVICE.imageSearch],
                    notifications: deps[SERVICE.notifications], settings: deps[SERVICE.settings],
                    onError: (error) => runtime.diagnostics.recordError({ source: "identity-image-search", featureId: "identity", contributionId: "identity.image-search", message: error instanceof Error ? error.message : String(error) }),
                });
                releaseStyle = deps[PORT.style].register("feature-identity-image-search", IMAGE_SEARCH_CSS);
                runtime.scope.addCleanup(releaseStyle);
                controller.start(runtime.scope);
                searchImage = controller;
            } catch (error) {
                controller?.dispose();
                releaseStyle();
                runtime.diagnostics.recordError({ source: "identity-feature", featureId: "identity", contributionId: "identity.image-search", message: error instanceof Error ? error.message : String(error) });
                activeContributions.splice(activeContributions.indexOf("identity.image-search"), 1);
            }
        }

        if (enabled.includes("detail.javbus-native")) {
            let controller = null;
            try {
                const { JavBusNativeController } = await import("./javbus-native-controller.js");
                controller = new JavBusNativeController({ document, location, isDetailPage: runtime.route === "detail", clipboard: deps[SERVICE.clipboard] });
                controller.start(runtime.scope);
            } catch (error) {
                controller?.dispose();
                runtime.diagnostics.recordError({ source: "identity-feature", featureId: "identity", contributionId: "detail.javbus-native", message: error instanceof Error ? error.message : String(error) });
                activeContributions.splice(activeContributions.indexOf("detail.javbus-native"), 1);
            }
        }

        if (enabled.includes("identity.javdb-navigation")) {
            let releaseStyle = () => {};
            let controller = null;
            try {
                const { JavDbNavigationController, JAVDB_NAVIGATION_CSS } = await import("./javdb-navigation-controller.js");
                controller = new JavDbNavigationController({
                    document, location, movie: deps[SERVICE.movie], navigation: deps[SERVICE.navigation],
                    searchImage, notifications: deps[SERVICE.notifications], jquery: /** @type {any} */ (globalThis).jQuery,
                    onError: (error) => runtime.diagnostics.recordError({ source: "identity-navigation-links", featureId: "identity", contributionId: "identity.javdb-navigation", message: error instanceof Error ? error.message : String(error) }),
                });
                releaseStyle = deps[PORT.style].register("feature-identity-javdb-navigation", JAVDB_NAVIGATION_CSS);
                runtime.scope.addCleanup(releaseStyle);
                controller.start(runtime.scope);
            } catch (error) {
                controller?.dispose();
                releaseStyle();
                runtime.diagnostics.recordError({ source: "identity-feature", featureId: "identity", contributionId: "identity.javdb-navigation", message: error instanceof Error ? error.message : String(error) });
                activeContributions.splice(activeContributions.indexOf("identity.javdb-navigation"), 1);
            }
        }

        if (enabled.includes("identity.javbus-navigation")) {
            let controller = null;
            try {
                const { BusNavigationController } = await import("./bus-navigation-controller.js");
                controller = new BusNavigationController({
                    document,
                    openImageSearch: typeof searchImage?.open === "function" ? () => searchImage.open() : null,
                });
                controller.start(runtime.scope);
            } catch (error) {
                controller?.dispose();
                runtime.diagnostics.recordError({ source: "identity-feature", featureId: "identity", contributionId: "identity.javbus-navigation", message: error instanceof Error ? error.message : String(error) });
                activeContributions.splice(activeContributions.indexOf("identity.javbus-navigation"), 1);
            }
        }
        return { activeContributions };
    },
});
