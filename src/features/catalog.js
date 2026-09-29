// @ts-check

import detail from "./detail/manifest.js";
import fc2Workspace from "./detail/fc2-workspace-manifest.js";
import externalBridge from "./external-bridge/manifest.js";
import fc2Catalog from "./external-bridge/fc2-catalog-manifest.js";
import oneOneFive from "./external-bridge/one-one-five-manifest.js";
import actressInfo from "./identity/actress-info-manifest.js";
import identity from "./identity/manifest.js";
import compatibility from "./compatibility/manifest.js";
import discovery from "./discovery/manifest.js";
import library from "./library/manifest.js";
import list from "./list/manifest.js";
import ranking from "./discovery/ranking-manifest.js";
import { newVideoFeature, schedulerFeature } from "./discovery/new-video-manifests.js";
import translation from "./translation/manifest.js";
import externalSites from "./external-sites/manifest.js";
import { systemFeatureManifests } from "./system/catalog.js";

export const featureManifests = Object.freeze([...systemFeatureManifests, detail, fc2Workspace, list, library, identity, actressInfo, discovery, ranking, newVideoFeature, schedulerFeature, translation, externalBridge, fc2Catalog, oneOneFive, externalSites, compatibility]);
