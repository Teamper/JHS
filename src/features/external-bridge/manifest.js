// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { ExternalBridgeController } from "./external-bridge-controller.js";

export default defineFeature({
    id: "external-bridge", kind: "feature", disableable: true, sites: ["javdb", "javbus", "123pan", "javtrailers", "subtitlecat"], routes: [], startup: "eager",
    requires: [SERVICE.dialog, SERVICE.offline, SERVICE.state, SERVICE.storage, SERVICE.translation, SERVICE.settings, REGISTRY.feature],
    contributes: ["external-bridge.translation", "external-bridge.115-match", "external-bridge.offline", "external-bridge.123pan", "external-bridge.javtrailers", "external-bridge.subtitle"],
    providesCommands: [],
    activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
        const translationPlugin = runtime.enabledContributions.includes("external-bridge.translation")
            ? runtime.resolveLegacyPlugin?.("TranslatePlugin")
            : null;
        const oneOneFivePlugin = runtime.enabledContributions.includes("external-bridge.115-match")
            ? runtime.resolveLegacyPlugin?.("OneOneFiveMatchPlugin")
            : null;
        const unifiedOfflinePlugin = runtime.enabledContributions.includes("external-bridge.offline")
            ? runtime.resolveLegacyPlugin?.("UnifiedOfflinePlugin")
            : null;
        const oneTwoThreePlugin = runtime.enabledContributions.includes("external-bridge.123pan")
            ? runtime.resolveLegacyPlugin?.("OneTwoThreeOfflinePlugin")
            : null;
        const javTrailersPlugin = runtime.enabledContributions.includes("external-bridge.javtrailers")
            ? runtime.resolveLegacyPlugin?.("JavTrailersPlugin")
            : null;
        const subtitlePlugin = runtime.enabledContributions.includes("external-bridge.subtitle")
            ? runtime.resolveLegacyPlugin?.("SubTitleCatPlugin")
            : null;
        const controller = new ExternalBridgeController({ translationPlugin, oneOneFivePlugin, unifiedOfflinePlugin, oneTwoThreePlugin, javTrailersPlugin, subtitlePlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
