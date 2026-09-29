// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "external-bridge", kind: "feature", disableable: true,
    sites: ["javdb", "javbus", "123pan", "javtrailers", "subtitlecat"], routes: [], startup: "eager",
    requires: [PORT.style, SERVICE.notifications, SERVICE.pan123Credential, SERVICE.storage, SERVICE.http, SERVICE.magnet, SERVICE.resourceSettings, SERVICE.clipboard, SERVICE.domUi, SERVICE.diagnostics, SERVICE.dialog, SERVICE.offline, SERVICE.offlineSubmissionReceipts, SERVICE.state, SERVICE.settings, SERVICE.events],
    optionalRequires: [PORT.host],
    contributes: ["external-bridge.offline", "external-bridge.123pan", "external-bridge.javtrailers", "external-bridge.subtitle", "detail.external-magnets"],
    providesCommands: [],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        /** @type {string[]} */ const activeContributions = [];
        if (runtime.enabledContributions.includes("external-bridge.offline")) {
            /** @type {import("./unified-offline-controller.js").UnifiedOfflineController|null} */ let controller = null;
            try {
                const { UnifiedOfflineController } = await import("./unified-offline-controller.js");
                controller = new UnifiedOfflineController({
                    document, window, route: runtime.route, site: runtime.site, hostAdapter: deps[PORT.host],
                    offline: deps[SERVICE.offline], submissionReceipts: deps[SERVICE.offlineSubmissionReceipts], dialog: deps[SERVICE.dialog], state: deps[SERVICE.state], settings: deps[SERVICE.settings],
                    styles: deps[PORT.style], events: deps[SERVICE.events], pan123Credential: deps[SERVICE.pan123Credential],
                    ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], diagnostics: deps[SERVICE.diagnostics], scope: runtime.scope,
                });
                if (controller.start()) {
                    const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("UnifiedOfflinePlugin", controller);
                    if (typeof releaseCompatibilityBean === "function") runtime.scope.addCleanup(releaseCompatibilityBean);
                    activeContributions.push("external-bridge.offline");
                }
            } catch (error) {
                controller?.dispose();
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "external-bridge.offline", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("detail.external-magnets")) {
            let releaseStyle = () => {};
            let detachConsumers = () => {};
            let unregisterCompatibilityBean = () => {};
            try {
                const { MAGNET_HUB_STYLES, MagnetHubController } = await import("./magnet-hub-controller.js");
                const controller = new MagnetHubController({
                    storage: deps[SERVICE.storage], http: deps[SERVICE.http], magnet: deps[SERVICE.magnet],
                    scope: runtime.scope, site: runtime.site, jquery: deps[SERVICE.domUi].jquery,
                    clipboard: deps[SERVICE.clipboard], diagnostics: deps[SERVICE.diagnostics], resourceSettings: deps[SERVICE.resourceSettings],
                });
                const removeStyle = deps[PORT.style].register("jhs-detail-external-magnets-feature", MAGNET_HUB_STYLES);
                let styleRemoved = false;
                releaseStyle = () => { if (styleRemoved) return; styleRemoved = true; removeStyle(); };
                runtime.scope.addCleanup(releaseStyle);
                const consumers = ["DetailPageButtonPlugin", "MobileBottomBarPlugin"]
                    .map((name) => runtime.resolveCompatibilityBean?.(name))
                    .filter(Boolean);
                if (runtime.isContributionEnabled("fc2-workspace", "detail.fc2-owned", "Fc2Plugin")) {
                    const fc2 = await runtime.executeCommand("detail.fc2.workspace");
                    if (fc2) consumers.push(fc2);
                }
                for (const consumer of consumers) consumer.attachFeatureMagnetHubAdapter?.(controller);
                let consumersDetached = false;
                detachConsumers = () => {
                    if (consumersDetached) return;
                    consumersDetached = true;
                    for (const consumer of consumers) consumer.detachFeatureMagnetHubAdapter?.(controller);
                };
                runtime.scope.addCleanup(detachConsumers);
                const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("MagnetHubPlugin", controller);
                let compatibilityBeanReleased = false;
                unregisterCompatibilityBean = () => {
                    if (compatibilityBeanReleased) return;
                    compatibilityBeanReleased = true;
                    if (typeof releaseCompatibilityBean === "function") releaseCompatibilityBean();
                };
                runtime.scope.addCleanup(unregisterCompatibilityBean);
                activeContributions.push("detail.external-magnets");
            } catch (error) {
                releaseStyle();
                detachConsumers();
                unregisterCompatibilityBean();
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "detail.external-magnets", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("external-bridge.123pan")) {
            try {
                deps[SERVICE.pan123Credential].startTokenSync(runtime.scope);
                activeContributions.push("external-bridge.123pan");
            } catch (error) {
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "external-bridge.123pan", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("external-bridge.javtrailers")) {
            try {
                const { JavTrailersController } = await import("./javtrailers-controller.js");
                const controller = new JavTrailersController({ scope: runtime.scope });
                if (controller.start()) activeContributions.push("external-bridge.javtrailers");
            } catch (error) {
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "external-bridge.javtrailers", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("external-bridge.subtitle")) {
            try {
                const { SubtitleCatController } = await import("./subtitlecat-controller.js");
                new SubtitleCatController({ scope: runtime.scope, notifications: deps[SERVICE.notifications] }).start();
                activeContributions.push("external-bridge.subtitle");
            } catch (error) {
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "external-bridge.subtitle", message: error instanceof Error ? error.message : String(error) });
            }
        }
        return { activeContributions };
    },
});
