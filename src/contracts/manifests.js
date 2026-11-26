// @ts-check

/** @typedef {{sites?: string[], routes?: string[]}} ContributionAvailability */
/** @typedef {object} FeatureManifest
 * @property {string} id
 * @property {'system' | 'feature'} kind
 * @property {boolean} disableable
 * @property {'eager' | 'idle' | 'on-command' | 'on-demand'} startup
 * @property {string[]} sites
 * @property {string[]} routes
 * @property {symbol[]} requires
 * @property {symbol[]} [optionalRequires]
 * @property {string[]} contributes
 * @property {string[]} providesCommands
 * @property {Record<string, ContributionAvailability>} [contributionAvailability]
 * @property {string[]} [contributionRoutes]
 * @property {Record<string, string[]>} [requiresFeaturesByRoute]
 * @property {string[]} [configurationDependencies]
 * @property {(deps: any, runtime: any) => any} activate
 */
/** @typedef {object} IntegrationManifest
 * @property {string} id
 * @property {'builtin-public' | 'custom-public' | 'user-local'} trustClass
 * @property {'bronze' | 'silver'} quality
 * @property {string[]} hosts
 * @property {string[]} capabilities
 * @property {symbol[]} requires
 * @property {'none' | Record<string, string>} cachePolicy
 * @property {(deps: any) => any} createClient
 * @property {(client: any, deps: any) => any} createAdapter
 * @property {((...args: any[]) => any) | null} createHostAdapter
 */

/** @template {FeatureManifest} T @param {T} manifest */
export function defineFeature(manifest) { return manifest; }

/** @template {IntegrationManifest} T @param {T} manifest */
export function defineIntegration(manifest) { return manifest; }
