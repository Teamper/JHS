// @ts-check

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
export function defineFeature(manifest) {
    requireNonEmptyString(manifest.id, "Feature id");
    if (!FEATURE_KINDS.has(String(manifest.kind))) throw new TypeError("Feature kind must be system or feature");
    if (!STARTUP_MODES.has(String(manifest.startup))) throw new TypeError("Feature startup mode is invalid");
    for (const field of ["sites", "routes", "contributes", "providesCommands"]) requireUniqueStrings(manifest[field], field);
    if (manifest.legacyApiAliases !== undefined) requireUniqueStrings(manifest.legacyApiAliases, "legacyApiAliases");
    requireUniqueTokens(manifest.requires, "requires");
    if (typeof manifest.activate !== "function") throw new TypeError("Feature activate must be a function");
    if (typeof manifest.disableable !== "boolean") throw new TypeError("Feature disableable must be explicit");
    if (manifest.kind === "system" && manifest.disableable !== false) throw new TypeError("System features cannot be disableable");
    return Object.freeze({ ...manifest });
}

/** @param {Record<string, unknown>} manifest */
export function defineContribution(manifest) {
    requireNonEmptyString(manifest.id, "Contribution id");
    requireNonEmptyString(manifest.featureId, "Contribution featureId");
    requireNonEmptyString(manifest.legacyPluginId, "Contribution legacyPluginId");
    requireUniqueStrings(manifest.sites, "sites");
    requireUniqueTokens(manifest.requires, "requires");
    if (typeof manifest.plugin !== "function") throw new TypeError("Contribution plugin must be a class");
    if (!manifest.order || typeof manifest.order !== "object") throw new TypeError("Contribution order must be explicit");
    if (manifest.managedRoutes !== undefined) requireUniqueStrings(manifest.managedRoutes, "managedRoutes");
    return Object.freeze({ ...manifest, sites: Object.freeze([...(/** @type {unknown[]} */ (manifest.sites))]), order: Object.freeze({ ...manifest.order }), ...(manifest.managedRoutes === undefined ? {} : { managedRoutes: Object.freeze([...(/** @type {unknown[]} */ (manifest.managedRoutes))]) }) });
}

/** @param {Record<string, unknown>} manifest */
export function defineIntegration(manifest) {
    requireNonEmptyString(manifest.id, "Integration id");
    if (!TRUST_CLASSES.has(String(manifest.trustClass))) throw new TypeError("Integration trustClass is invalid");
    if (!QUALITY_LEVELS.has(String(manifest.quality))) throw new TypeError("Integration quality is invalid");
    requireUniqueStrings(manifest.hosts, "hosts");
    requireUniqueStrings(manifest.capabilities, "capabilities");
    requireUniqueTokens(manifest.requires, "requires");
    const hosts = /** @type {unknown[]} */ (manifest.hosts);
    const capabilities = /** @type {unknown[]} */ (manifest.capabilities);
    if (hosts.length === 0 || capabilities.length === 0) throw new TypeError("Integration hosts and capabilities cannot be empty");
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
    return Object.freeze({ ...manifest });
}
