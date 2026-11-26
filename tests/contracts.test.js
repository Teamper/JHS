import { describe, expect, it } from "vitest";
import { featureManifests } from "../src/features/catalog.js";
import { integrationManifests } from "../src/app/integration-catalog.js";
import { SERVICE } from "../src/contracts/tokens.js";

const FEATURE_KINDS = new Set(["system", "feature"]);
const STARTUP_MODES = new Set(["eager", "idle", "on-command", "on-demand"]);
const TRUST_CLASSES = new Set(["builtin-public", "custom-public", "user-local"]);
const QUALITY_LEVELS = new Set(["bronze", "silver"]);

/** @param {unknown} value @param {string} field */
function requireNonEmptyString(value, field) {
    if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${field} must be a non-empty string`);
}

/** @param {unknown} value @param {string} field */
function requireArray(value, field) {
    if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
}

/** @param {unknown} value @param {string} field */
function requireUniqueStrings(value, field) {
    requireArray(value, field);
    const items = /** @type {unknown[]} */ (value);
    for (const item of items) requireNonEmptyString(item, `${field} item`);
    if (new Set(items).size !== items.length) throw new TypeError(`${field} cannot contain duplicates`);
}

/** @param {unknown} value @param {string} field */
function requireUniqueTokens(value, field) {
    requireArray(value, field);
    const items = /** @type {unknown[]} */ (value);
    if (items.some((item) => typeof item !== "symbol")) throw new TypeError(`${field} must contain dependency tokens`);
    if (new Set(items).size !== items.length) throw new TypeError(`${field} cannot contain duplicate tokens`);
}

/** @param {Record<string, unknown>} manifest */
function validateFeatureManifest(manifest) {
    requireNonEmptyString(manifest.id, "Feature id");
    if (!FEATURE_KINDS.has(String(manifest.kind))) throw new TypeError("Feature kind must be system or feature");
    if (!STARTUP_MODES.has(String(manifest.startup))) throw new TypeError("Feature startup mode is invalid");
    for (const field of ["sites", "routes", "contributes", "providesCommands"]) requireUniqueStrings(manifest[field], field);
    requireUniqueTokens(manifest.requires, "requires");
    requireUniqueTokens(manifest.optionalRequires ?? [], "optionalRequires");
    if ((/** @type {symbol[]} */ (manifest.requires)).some((token) => (/** @type {symbol[]} */ (manifest.optionalRequires ?? [])).includes(token))) throw new TypeError("Feature requires and optionalRequires cannot overlap");
    if (manifest.requiresFeaturesByRoute !== undefined) {
        if (!manifest.requiresFeaturesByRoute || typeof manifest.requiresFeaturesByRoute !== "object" || Array.isArray(manifest.requiresFeaturesByRoute)) throw new TypeError("requiresFeaturesByRoute must be a route-to-feature map");
        for (const [route, featureIds] of Object.entries(/** @type {Record<string, unknown>} */ (manifest.requiresFeaturesByRoute))) {
            requireUniqueStrings(featureIds, `requiresFeaturesByRoute.${route}`);
        }
    }
    if (manifest.configurationDependencies !== undefined) requireUniqueStrings(manifest.configurationDependencies, "configurationDependencies");
    if (typeof manifest.activate !== "function") throw new TypeError("Feature activate must be a function");
    if (typeof manifest.disableable !== "boolean") throw new TypeError("Feature disableable must be explicit");
    if (manifest.kind === "system" && manifest.disableable !== false) throw new TypeError("System features cannot be disableable");
}

/** @param {Record<string, unknown>} manifest */
function validateIntegrationManifest(manifest) {
    requireNonEmptyString(manifest.id, "Integration id");
    if (!TRUST_CLASSES.has(String(manifest.trustClass))) throw new TypeError("Integration trustClass is invalid");
    if (!QUALITY_LEVELS.has(String(manifest.quality))) throw new TypeError("Integration quality is invalid");
    requireUniqueStrings(manifest.hosts, "hosts");
    requireUniqueStrings(manifest.capabilities, "capabilities");
    requireUniqueTokens(manifest.requires, "requires");
    const hosts = /** @type {unknown[]} */ (manifest.hosts);
    const capabilities = /** @type {unknown[]} */ (manifest.capabilities);
    if (hosts.length === 0 && manifest.trustClass !== "user-local" || capabilities.length === 0) throw new TypeError("Public Integration hosts and all capabilities cannot be empty");
    for (const host of hosts) {
        const value = String(host);
        if (value !== value.toLowerCase() || new URL(`https://${value}`).hostname !== value) throw new TypeError(`Integration host is invalid: ${value}`);
    }
    if (manifest.cachePolicy === undefined) throw new TypeError("Integration cachePolicy must be explicit");
    if (manifest.cachePolicy !== "none") {
        if (!manifest.cachePolicy || typeof manifest.cachePolicy !== "object" || Array.isArray(manifest.cachePolicy)) throw new TypeError("Integration cachePolicy must be none or a capability map");
        const policy = /** @type {Record<string, unknown>} */ (manifest.cachePolicy);
        const missing = capabilities.filter((capability) => !Object.hasOwn(policy, String(capability)));
        const extra = Object.keys(policy).filter((capability) => !capabilities.includes(capability));
        if (missing.length || extra.length) throw new TypeError(`Integration cachePolicy mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
        for (const [capability, value] of Object.entries(policy)) requireNonEmptyString(value, `cachePolicy.${capability}`);
    }
    if (typeof manifest.createClient !== "function" || typeof manifest.createAdapter !== "function") {
        throw new TypeError("Integration client and adapter factories are required");
    }
    if (manifest.createHostAdapter !== null && typeof manifest.createHostAdapter !== "function") {
        throw new TypeError("Integration createHostAdapter must be a function or explicit null");
    }
}

describe("bundled manifest contracts", () => {
    it.each(featureManifests)("validates Feature $id", (manifest) => validateFeatureManifest(manifest));
    it.each(integrationManifests)("validates Integration $id", (manifest) => validateIntegrationManifest(manifest));

    it("rejects malformed integration declarations before delivery", () => {
        expect(() => validateIntegrationManifest({ id: "bad", trustClass: "builtin-public", hosts: [], capabilities: [], requires: [], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {} })).toThrow();
        expect(() => validateIntegrationManifest({ id: "bad-host", trustClass: "builtin-public", hosts: ["HTTPS://EXAMPLE.COM"], capabilities: ["movie.detail"], requires: [], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {} })).toThrow(/host is invalid/);
        expect(() => validateIntegrationManifest({ id: "bad-cache", trustClass: "builtin-public", hosts: ["example.com"], capabilities: ["movie.detail", "movie.images"], requires: [], cachePolicy: { "movie.detail": "none" }, quality: "bronze", createClient() {}, createAdapter() {} })).toThrow(/cachePolicy mismatch/);
        expect(() => validateIntegrationManifest({ id: "bad-deps", trustClass: "builtin-public", hosts: ["example.com"], capabilities: ["movie.detail"], requires: [SERVICE.http, SERVICE.http], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {} })).toThrow(/duplicate tokens/);
        expect(() => validateIntegrationManifest({ id: "bad-host-adapter", trustClass: "builtin-public", hosts: ["example.com"], capabilities: ["movie.detail"], requires: [], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {}, createHostAdapter: undefined })).toThrow(/createHostAdapter/);
    });
});
