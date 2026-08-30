// @ts-check

import detail from "./detail/manifest.js";
import discovery from "./discovery/manifest.js";
import externalBridge from "./external-bridge/manifest.js";
import identity from "./identity/manifest.js";
import library from "./library/manifest.js";
import list from "./list/manifest.js";
import compatibility from "./compatibility/manifest.js";
import stats from "./stats/manifest.js";
import { legacyCapabilityManifests } from "./legacy-capabilities.js";
import { systemFeatureManifests } from "./system/catalog.js";

export const featureManifests = Object.freeze([...systemFeatureManifests, stats, detail, list, library, identity, externalBridge, discovery, compatibility, ...legacyCapabilityManifests.filter((manifest) => ![ "list", "library", "identity", "external-bridge", "discovery", "compatibility", "stats" ].includes(String(manifest.id))) ]);
