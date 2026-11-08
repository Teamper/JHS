// @ts-check

import mediaLibrary from "./library/media-library-manifest.js";
import personalRatings from "./library/personal-rating-manifest.js";
import movieSelection from "./library/movie-selection-manifest.js";
import movieLists from "./library/movie-lists-manifest.js";
import privacy from "./system/privacy-manifest.js";
import subtitleWorkspace from "./detail/subtitle-workspace-manifest.js";
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
import translationTools from "./translation/tools-manifest.js";
import enhancementSettings from "./system/enhancement-settings-manifest.js";
import translation from "./translation/manifest.js";
import externalSites from "./external-sites/manifest.js";
import { systemFeatureManifests } from "./system/catalog.js";

export const featureManifests = Object.freeze([...systemFeatureManifests, enhancementSettings, translationTools, mediaLibrary, personalRatings, movieSelection, movieLists, privacy, subtitleWorkspace, detail, fc2Workspace, list, library, identity, actressInfo, discovery, ranking, newVideoFeature, schedulerFeature, translation, externalBridge, fc2Catalog, oneOneFive, externalSites, compatibility]);
