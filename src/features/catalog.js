// @ts-check

import detail from "./detail/manifest.js";
import identity from "./identity/manifest.js";
import library from "./library/manifest.js";
import list from "./list/manifest.js";
import { legacyCapabilityManifests } from "./legacy-capabilities.js";
import { systemFeatureManifests } from "./system/catalog.js";

export const featureManifests = Object.freeze([...systemFeatureManifests, detail, list, library, identity, ...legacyCapabilityManifests.filter((manifest) => ![ "list", "library", "identity" ].includes(String(manifest.id))) ]);
