// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "external-sites", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movie, SERVICE.storage, SERVICE.settings, SERVICE.events, SERVICE.domUi, SERVICE.notifications],
    contributionRoutes: ["detail", "owned-detail"],
    contributes: ["detail.external-sites"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const contributionId = "detail.external-sites";
        if (!runtime.enabledContributions.includes(contributionId)) return { activeContributions: [] };
        /** @type {import("./other-sites-controller.js").OtherSitesController | null} */ let controller = null;
        let releaseStyle = () => {};
        try {
            const { OtherSitesController } = await import("./other-sites-controller.js");
            controller = new OtherSitesController({
                document, window, jquery: deps[SERVICE.domUi].jquery, hostAdapter: deps[PORT.host],
                movie: deps[SERVICE.movie], storage: deps[SERVICE.storage], settings: deps[SERVICE.settings],
                events: deps[SERVICE.events], scope: runtime.scope, ui: deps[SERVICE.domUi],
                notifications: deps[SERVICE.notifications], site: runtime.site, route: runtime.route,
            });
            const css = await controller.initCss();
            if (css) releaseStyle = deps[PORT.style].register("jhs-detail-external-sites-feature", css.replace(/^\s*<style>|<\/style>\s*$/g, ""));
            if (!controller.start()) throw new Error("External sites controller did not start");
            runtime.scope.addCleanup(releaseStyle);
            runtime.scope.addCleanup(() => controller?.dispose());
            runtime.inspect?.("detail.external-sites", controller);
            runtime.provideCapability?.("detail.external-sites", controller);
            return { activeContributions: [contributionId] };
        } catch (error) {
            controller?.dispose();
            releaseStyle();
            runtime.diagnostics.recordError({ source: "external-sites-feature", featureId: "external-sites", contributionId, message: error instanceof Error ? error.message : String(error) });
            return { activeContributions: [] };
        }
    },
});
