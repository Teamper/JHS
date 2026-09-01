// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { DiscoveryController } from "./discovery-controller.js";
import { HitShowController } from "./hit-show-controller.js";
import { Top250Controller } from "./top250-controller.js";
import { NewVideoController } from "./new-video-controller.js";
import { TaskController } from "./task-controller.js";
import { openSettingsUi } from "../../core/settings-ui-owner.js";

export default defineFeature({
    id: "discovery", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, SERVICE.movie, SERVICE.settings, SERVICE.cache, SERVICE.dialog, SERVICE.account, SERVICE.storage, SERVICE.legacyStorage, SERVICE.actressInfo, SERVICE.state, SERVICE.http, SERVICE.eventBus, SERVICE.ui, REGISTRY.feature],
    contributes: ["discovery.hit-show", "discovery.top250", "discovery.new-video", "discovery.scheduler"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const hitShowController = runtime.enabledContributions.includes("discovery.hit-show") && deps[PORT.host]?.site === "javdb"
            ? new HitShowController({ document: globalThis.document, window: globalThis.window, hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], settings: deps[SERVICE.settings], storage: deps[SERVICE.legacyStorage], features: deps[REGISTRY.feature], eventBus: deps[SERVICE.eventBus], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const top250Controller = runtime.enabledContributions.includes("discovery.top250") && deps[PORT.host]?.site === "javdb"
            ? new Top250Controller({ document: globalThis.document, window: globalThis.window, hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], dialog: deps[SERVICE.dialog], account: deps[SERVICE.account], storage: deps[SERVICE.storage], features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const newVideoController = deps[PORT.host]?.site === "javdb" && runtime.enabledContributions.includes("discovery.new-video")
            ? new NewVideoController({ document: globalThis.document, window: globalThis.window, settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], legacyStorage: deps[SERVICE.legacyStorage], dialog: deps[SERVICE.dialog], actressInfo: deps[SERVICE.actressInfo], movie: deps[SERVICE.movie], state: deps[SERVICE.state], eventBus: deps[SERVICE.eventBus], settingPlugin: { openSettingDialog: openSettingsUi }, ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const taskController = runtime.enabledContributions.includes("discovery.scheduler")
            ? new TaskController({
                document: globalThis.document,
                window: globalThis.window,
                storage: deps[SERVICE.storage],
                legacyStorage: deps[SERVICE.legacyStorage],
                http: deps[SERVICE.http],
                actressInfo: deps[SERVICE.actressInfo],
                movie: deps[SERVICE.movie],
                features: deps[REGISTRY.feature],
                settings: deps[SERVICE.settings],
                eventBus: deps[SERVICE.eventBus],
                ui: deps[SERVICE.ui],
                scope: runtime.scope,
            })
            : null;
        const controller = new DiscoveryController({ hitShowController, top250Controller, newVideoController, taskController, ui: deps[SERVICE.ui], scope: runtime.scope });
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
