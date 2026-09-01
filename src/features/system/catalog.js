// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { SettingsCoreController } from "./settings/settings-core-controller.js";
import { ResponsiveShellBottomBarController } from "./responsive-shell-bottom-bar-controller.js";

export const systemFeatureManifests = Object.freeze([
    defineFeature({
        id: "settings", kind: "system", disableable: false, failurePolicy: "degraded", sites: [], routes: [], startup: "eager",
        requires: [PORT.host, PORT.style, SERVICE.diagnostics, SERVICE.profile, SERVICE.webdav, SERVICE.dialog, SERVICE.storage, SERVICE.legacyStorage, SERVICE.settings, SERVICE.http, SERVICE.offline, SERVICE.magnet, SERVICE.movie, SERVICE.state, SERVICE.translation, SERVICE.eventBus, SERVICE.screenshot, SERVICE.ui, REGISTRY.settings, REGISTRY.feature], contributes: ["settings.core"], providesCommands: ["settings.open"],
        activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const controller = new SettingsCoreController({
                host: deps[PORT.host], diagnostics: deps[SERVICE.diagnostics], profile: deps[SERVICE.profile], webdav: deps[SERVICE.webdav],
                dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], legacyStorage: deps[SERVICE.legacyStorage], settings: deps[SERVICE.settings],
                http: deps[SERVICE.http], offline: deps[SERVICE.offline], magnet: deps[SERVICE.magnet], movie: deps[SERVICE.movie], state: deps[SERVICE.state],
                translation: deps[SERVICE.translation], eventBus: deps[SERVICE.eventBus], settingsRegistry: deps[REGISTRY.settings], features: deps[REGISTRY.feature],
                screenshot: deps[SERVICE.screenshot], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope,
            });
            const css = await controller.initCss();
            const release = css ? deps[PORT.style].register("jhs-settings-core", css) : null;
            release && runtime.scope.addCleanup(release);
            await controller.start();
            return { api: controller.getApi(), commands: { "settings.open": (/** @type {any} */ ...args) => controller.openSettingDialog(...args) }, dispose: () => controller.dispose() };
        },
    }),
    defineFeature({
        id: "diagnostics", kind: "system", disableable: false, failurePolicy: "degraded", sites: [], routes: [], startup: "eager",
        requires: [SERVICE.diagnostics], contributes: [], providesCommands: ["diagnostics.export"],
        activate: (/** @type {any} */ deps) => ({ commands: { "diagnostics.export": () => deps[SERVICE.diagnostics].exportSnapshot() } }),
    }),
    defineFeature({
        id: "responsive-shell", kind: "system", disableable: false, failurePolicy: "degraded", sites: [], routes: [], startup: "eager",
        requires: [PORT.host, PORT.style, SERVICE.settings, SERVICE.profile, SERVICE.legacyStorage, SERVICE.ui, REGISTRY.feature], contributes: ["responsive-shell.bottom-bar"], providesCommands: [], activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
            const controller = new ResponsiveShellBottomBarController({
                hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], profile: deps[SERVICE.profile], legacyStorage: deps[SERVICE.legacyStorage],
                features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], scope: runtime.scope,
            });
            const css = await controller.initCss();
            const release = css ? deps[PORT.style].register("jhs-responsive-shell", css) : null;
            release && runtime.scope.addCleanup(release);
            await controller.start();
            return { profile: deps[SERVICE.profile].current(), dispose: () => controller.dispose() };
        },
    }),
]);
