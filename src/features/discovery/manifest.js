// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { DiscoveryController } from "./discovery-controller.js";

export default defineFeature({
    id: "discovery", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, SERVICE.movie, SERVICE.settings, SERVICE.cache, SERVICE.dialog, SERVICE.account, SERVICE.storage, SERVICE.actressInfo, SERVICE.state, SERVICE.http, REGISTRY.feature],
    contributes: ["discovery.hit-show", "discovery.top250", "discovery.new-video", "discovery.scheduler"],
    providesCommands: [],
    activate: (/** @type {any} */ _deps, /** @type {any} */ runtime) => {
        const hitShowPlugin = runtime.enabledContributions.includes("discovery.hit-show")
            ? runtime.resolveLegacyPlugin?.("HitShowPlugin")
            : null;
        const top250Plugin = runtime.enabledContributions.includes("discovery.top250")
            ? runtime.resolveLegacyPlugin?.("TOP250Plugin")
            : null;
        const newVideoPlugin = runtime.enabledContributions.includes("discovery.new-video")
            ? runtime.resolveLegacyPlugin?.("NewVideoPlugin")
            : null;
        const taskPlugin = runtime.enabledContributions.includes("discovery.scheduler")
            ? runtime.resolveLegacyPlugin?.("TaskPlugin")
            : null;
        const controller = new DiscoveryController({ hitShowPlugin, top250Plugin, newVideoPlugin, taskPlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
