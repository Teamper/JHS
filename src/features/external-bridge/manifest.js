// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { ExternalBridgeController } from "./external-bridge-controller.js";
import { JavTrailersController } from "./javtrailers-controller.js";
import { SubtitleCatController } from "./subtitle-cat-controller.js";
import { ExternalBridgeTranslationController } from "./translation-controller.js";
import { OneOneFiveMatchController } from "./one-one-five-controller.js";
import { OneTwoThreeAuthController } from "./one-two-three-controller.js";
import { UnifiedOfflineController } from "./unified-offline-controller.js";

export default defineFeature({
    id: "external-bridge", kind: "feature", disableable: true, sites: ["javdb", "javbus", "123pan", "javtrailers", "subtitlecat"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.dialog, SERVICE.offline, SERVICE.state, SERVICE.storage, SERVICE.translation, SERVICE.settings, SERVICE.eventBus, REGISTRY.feature],
    contributes: ["external-bridge.translation", "external-bridge.115-match", "external-bridge.offline", "external-bridge.123pan", "external-bridge.javtrailers", "external-bridge.subtitle"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const translationController = runtime.enabledContributions.includes("external-bridge.translation") && ["detail", "list"].includes(runtime.route)
            ? new ExternalBridgeTranslationController({ document: globalThis.document, window: globalThis.window, route: runtime.route, settings: deps[SERVICE.settings], translation: deps[SERVICE.translation], features: deps[REGISTRY.feature], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const supportedHost = ["javdb", "javbus"].includes(deps[PORT.host]?.site);
        const oneOneFiveController = runtime.enabledContributions.includes("external-bridge.115-match") && supportedHost
            ? new OneOneFiveMatchController({ document: globalThis.document, window: globalThis.window, route: runtime.route, hostAdapter: deps[PORT.host], offline: deps[SERVICE.offline], dialog: deps[SERVICE.dialog], settings: deps[SERVICE.settings], eventBus: deps[SERVICE.eventBus], scope: runtime.scope })
            : null;
        const oneTwoThreeController = runtime.enabledContributions.includes("external-bridge.123pan")
            ? new OneTwoThreeAuthController({ document: globalThis.document, window: globalThis.window, storage: deps[SERVICE.storage], scope: runtime.scope })
            : null;
        const offlineController = runtime.enabledContributions.includes("external-bridge.offline") && supportedHost
            ? new UnifiedOfflineController({ document: globalThis.document, window: globalThis.window, route: runtime.route, hostAdapter: deps[PORT.host], offline: deps[SERVICE.offline], dialog: deps[SERVICE.dialog], state: deps[SERVICE.state], settings: deps[SERVICE.settings], styles: deps[PORT.style], eventBus: deps[SERVICE.eventBus], oneTwoThreeController, scope: runtime.scope })
            : null;
        const javTrailersController = runtime.enabledContributions.includes("external-bridge.javtrailers")
            ? new JavTrailersController({ document: globalThis.document, window: globalThis.window, scope: runtime.scope })
            : null;
        const subtitleController = runtime.enabledContributions.includes("external-bridge.subtitle")
            ? new SubtitleCatController({ document: globalThis.document, window: globalThis.window, scope: runtime.scope })
            : null;
        const controller = new ExternalBridgeController({ translationController, oneOneFiveController, offlineController, oneTwoThreeController, javTrailersController, subtitleController, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
