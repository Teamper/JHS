// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { DiscoveryController } from "./discovery-controller.js";
import { HitShowController } from "./hit-show-controller.js";
import { Top250Controller } from "./top250-controller.js";

export default defineFeature({
    id: "discovery", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, SERVICE.movie, SERVICE.settings, SERVICE.cache, SERVICE.dialog, SERVICE.account, SERVICE.storage, SERVICE.actressInfo, SERVICE.state, SERVICE.http, SERVICE.eventBus, REGISTRY.feature],
    contributes: ["discovery.hit-show", "discovery.top250", "discovery.new-video", "discovery.scheduler"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const hitShowController = runtime.enabledContributions.includes("discovery.hit-show") && deps[PORT.host]?.site === "javdb"
            ? new HitShowController({ document: globalThis.document, window: globalThis.window, hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], features: deps[REGISTRY.feature], listActions: runtime.resolveLegacyPlugin?.("ListPageButtonPlugin"), coverActions: runtime.resolveLegacyPlugin?.("CoverButtonPlugin"), eventBus: deps[SERVICE.eventBus], scope: runtime.scope })
            : null;
        const top250Controller = runtime.enabledContributions.includes("discovery.top250") && deps[PORT.host]?.site === "javdb"
            ? new Top250Controller({ document: globalThis.document, window: globalThis.window, hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], dialog: deps[SERVICE.dialog], account: deps[SERVICE.account], storage: deps[SERVICE.storage], listActions: runtime.resolveLegacyPlugin?.("ListPageButtonPlugin"), scope: runtime.scope })
            : null;
        const newVideoPlugin = runtime.enabledContributions.includes("discovery.new-video")
            ? runtime.resolveLegacyPlugin?.("NewVideoPlugin")
            : null;
        const taskPlugin = runtime.enabledContributions.includes("discovery.scheduler")
            ? runtime.resolveLegacyPlugin?.("TaskPlugin")
            : null;
        const controller = new DiscoveryController({ hitShowController, top250Controller, newVideoPlugin, taskPlugin, scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
