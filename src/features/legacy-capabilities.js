// @ts-check

import { defineFeature } from "../contracts/manifests.js";

/** @param {string} id @param {string[]} sites @param {string[]} contributes */
const feature = (id, sites, contributes) => defineFeature({
    id, kind: "feature", disableable: true, sites, routes: [], startup: "eager",
    requires: [], contributes, providesCommands: [], activate: () => ({}),
});

export const legacyCapabilityManifests = Object.freeze([
    feature("list", ["javdb", "javbus"], ["list.core", "list.auto-page", "list.fold-category", "list.actions"]),
    feature("library", ["javdb", "javbus"], ["library.history", "library.keyword-filter", "library.state-actions", "library.blacklist", "library.favorite-actresses"]),
    feature("discovery", ["javdb", "javbus"], ["discovery.hit-show", "discovery.top250", "discovery.new-video", "discovery.scheduler"]),
    feature("external-bridge", ["javdb", "javbus", "123pan", "javtrailers", "subtitlecat"], ["external-bridge.translation", "external-bridge.115-match", "external-bridge.offline", "external-bridge.123pan", "external-bridge.javtrailers", "external-bridge.subtitle"]),
    feature("identity", ["javdb", "javbus"], ["identity.javdb-navigation", "identity.javbus-navigation", "identity.image-search", "identity.actress-info"]),
    feature("compatibility", ["javdb", "javbus"], ["compatibility.enhancements"]),
]);
