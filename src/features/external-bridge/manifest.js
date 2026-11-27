// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { ResourceSettingsService } from "../../services/resource-settings-service.js";

export default defineFeature({
    id: "external-bridge", kind: "feature", disableable: true,
    sites: ["javdb", "javbus", "123pan", "javtrailers", "subtitlecat"], routes: [], startup: "eager",
    requires: [PORT.style, SERVICE.notifications, SERVICE.clog, SERVICE.storage, SERVICE.http, SERVICE.magnet, SERVICE.clipboard, SERVICE.domUi, SERVICE.dialog, SERVICE.offline, SERVICE.state, SERVICE.settings, SERVICE.events],
    optionalRequires: [PORT.host],
    contributionAvailability: {
        "external-bridge.offline": { sites: ["javdb", "javbus"], routes: ["detail", "list", "owned-detail"] },
        "external-bridge.123pan": { sites: ["javdb", "javbus", "123pan"] },
        "external-bridge.javtrailers": { sites: ["javtrailers"] },
        "external-bridge.subtitle": { sites: ["subtitlecat"] },
        "detail.external-magnets": { sites: ["javdb", "javbus"] },
    },
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
                    offline: deps[SERVICE.offline].api, submissionReceipts: deps[SERVICE.offline].receipts, dialog: deps[SERVICE.dialog], state: deps[SERVICE.state], settings: deps[SERVICE.settings],
                    styles: deps[PORT.style], events: deps[SERVICE.events], pan123Credential: deps[SERVICE.offline].pan123Credential,
                    ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics, scope: runtime.scope,
                });
                if (controller.start()) {
                    runtime.provideCapability?.("external-bridge.offline", controller);
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
            let unregisterCompatibilityBean = () => {};
            try {
                const { MAGNET_HUB_STYLES, MagnetHubController } = await import("./magnet-hub-controller.js");
                const controller = new MagnetHubController({
                    storage: deps[SERVICE.storage], http: deps[SERVICE.http], magnet: deps[SERVICE.magnet],
                    scope: runtime.scope, site: runtime.site, jquery: deps[SERVICE.domUi].jquery,
                    clipboard: deps[SERVICE.clipboard], diagnostics: runtime.diagnostics, resourceSettings: new ResourceSettingsService(deps[SERVICE.settings]),
                });
                const removeStyle = deps[PORT.style].register("jhs-detail-external-magnets-feature", MAGNET_HUB_STYLES);
                let styleRemoved = false;
                releaseStyle = () => { if (styleRemoved) return; styleRemoved = true; removeStyle(); };
                runtime.scope.addCleanup(releaseStyle);
                const releaseCompatibilityBean = runtime.registerCompatibilityBean?.("MagnetHubPlugin", controller);
                let compatibilityBeanReleased = false;
                unregisterCompatibilityBean = () => {
                    if (compatibilityBeanReleased) return;
                    compatibilityBeanReleased = true;
                    if (typeof releaseCompatibilityBean === "function") releaseCompatibilityBean();
                };
                runtime.scope.addCleanup(unregisterCompatibilityBean);
                runtime.provideCapability?.("detail.external-magnets", controller);
                activeContributions.push("detail.external-magnets");
            } catch (error) {
                releaseStyle();
                unregisterCompatibilityBean();
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "detail.external-magnets", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("external-bridge.123pan")) {
            try {
                deps[SERVICE.offline].pan123Credential.startTokenSync(runtime.scope);
                activeContributions.push("external-bridge.123pan");
            } catch (error) {
                runtime.diagnostics.recordError({ source: "external-bridge-feature", featureId: "external-bridge", contributionId: "external-bridge.123pan", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("external-bridge.javtrailers")) {
            try {
                const { JavTrailersController } = await import("./javtrailers-controller.js");
                const logger = deps[SERVICE.clog];
                const controller = new JavTrailersController({ scope: runtime.scope, warnPlayback: logger.warn.bind(logger) });
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
