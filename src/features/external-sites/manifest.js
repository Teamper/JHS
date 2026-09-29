// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "external-sites", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.movie, SERVICE.storage, SERVICE.settings, SERVICE.events, SERVICE.domUi, SERVICE.notifications],
    contributes: ["detail.external-sites"], providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const contributionId = "detail.external-sites";
        if (!runtime.enabledContributions.includes(contributionId)) return { activeContributions: [] };
        /** @type {import("./other-sites-controller.js").OtherSitesController | null} */ let controller = null;
        let releaseStyle = () => {};
        let releaseCompatibilityBean = () => {};
        let detachConsumers = () => {};
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
            const consumers = ["SettingPlugin"]
                .map((name) => runtime.resolveCompatibilityBean?.(name))
                .filter(Boolean);
            if (runtime.isContributionEnabled("fc2-workspace", "detail.fc2-owned", "Fc2Plugin")) {
                const fc2 = await runtime.executeCommand("detail.fc2.workspace");
                if (fc2) consumers.push(fc2);
            }
            for (const consumer of consumers) consumer.attachFeatureExternalSitesAdapter?.(controller);
            let consumersDetached = false;
            detachConsumers = () => {
                if (consumersDetached) return;
                consumersDetached = true;
                for (const consumer of consumers) consumer.detachFeatureExternalSitesAdapter?.(controller);
            };
            runtime.scope.addCleanup(releaseStyle);
            runtime.scope.addCleanup(() => controller?.dispose());
            runtime.scope.addCleanup(detachConsumers);
            const release = runtime.registerCompatibilityBean?.("OtherSitePlugin", controller);
            if (typeof release === "function") releaseCompatibilityBean = release;
            runtime.scope.addCleanup(() => releaseCompatibilityBean());
            return { activeContributions: [contributionId] };
        } catch (error) {
            releaseCompatibilityBean();
            detachConsumers();
            controller?.dispose();
            releaseStyle();
            runtime.diagnostics.recordError({ source: "external-sites-feature", featureId: "external-sites", contributionId, message: error instanceof Error ? error.message : String(error) });
            return { activeContributions: [] };
        }
    },
});
