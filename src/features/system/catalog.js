// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";

export const systemFeatureManifests = Object.freeze([
    defineFeature({
        id: "settings", kind: "system", disableable: false, sites: [], routes: [], startup: "on-command",
        requires: [SERVICE.diagnostics], contributes: ["settings.core"], providesCommands: ["settings.open"],
        activate: () => ({ commands: { "settings.open": () => document.querySelector("#setting-btn, #mini-setting-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true })) } }),
    }),
    defineFeature({
        id: "diagnostics", kind: "system", disableable: false, sites: [], routes: [], startup: "eager",
        requires: [SERVICE.diagnostics], contributes: [], providesCommands: ["diagnostics.export"],
        activate: (/** @type {any} */ deps) => ({ commands: { "diagnostics.export": () => deps[SERVICE.diagnostics].exportSnapshot() } }),
    }),
    defineFeature({
        id: "responsive-shell", kind: "system", disableable: false, sites: [], routes: [], startup: "eager",
        requires: [SERVICE.profile], contributes: ["responsive-shell.bottom-bar"], providesCommands: [], activate: (/** @type {any} */ deps) => ({ profile: deps[SERVICE.profile].current() }),
    }),
    defineFeature({
        id: "stats", kind: "system", disableable: false, sites: ["javdb", "javbus"], routes: [], startup: "idle",
        requires: [SERVICE.diagnostics], contributes: ["stats.dashboard"], providesCommands: [],
        activate: (/** @type {any} */ deps) => ({ diagnostics: deps[SERVICE.diagnostics] }),
    }),
]);
