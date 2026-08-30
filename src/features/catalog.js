// @ts-check

import detail from "./detail/manifest.js";
import list from "./list/manifest.js";
import { legacyCapabilityManifests } from "./legacy-capabilities.js";
import { systemFeatureManifests } from "./system/catalog.js";

export const featureManifests = Object.freeze([...systemFeatureManifests, detail, list, ...legacyCapabilityManifests.filter((manifest) => manifest.id !== "list")]);
