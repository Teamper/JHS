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

/** @param {Record<string, unknown>} manifest */
export function defineFeature(manifest) {
    requireNonEmptyString(manifest.id, "Feature id");
    if (!FEATURE_KINDS.has(String(manifest.kind))) throw new TypeError("Feature kind must be system or feature");
    if (!STARTUP_MODES.has(String(manifest.startup))) throw new TypeError("Feature startup mode is invalid");
    for (const field of ["sites", "routes", "requires", "contributes", "providesCommands"]) requireArray(manifest[field], field);
    if (typeof manifest.activate !== "function") throw new TypeError("Feature activate must be a function");
    if (manifest.kind === "system" && manifest.disableable !== false) throw new TypeError("System features cannot be disableable");
    return Object.freeze({ ...manifest });
}

/** @param {Record<string, unknown>} manifest */
export function defineIntegration(manifest) {
    requireNonEmptyString(manifest.id, "Integration id");
    if (!TRUST_CLASSES.has(String(manifest.trustClass))) throw new TypeError("Integration trustClass is invalid");
    if (!QUALITY_LEVELS.has(String(manifest.quality))) throw new TypeError("Integration quality is invalid");
    for (const field of ["hosts", "capabilities", "requires"]) requireArray(manifest[field], field);
    const hosts = /** @type {unknown[]} */ (manifest.hosts);
    const capabilities = /** @type {unknown[]} */ (manifest.capabilities);
    if (hosts.length === 0 || capabilities.length === 0) throw new TypeError("Integration hosts and capabilities cannot be empty");
    if (manifest.cachePolicy === undefined) throw new TypeError("Integration cachePolicy must be explicit");
    if (typeof manifest.createClient !== "function" || typeof manifest.createAdapter !== "function") {
        throw new TypeError("Integration client and adapter factories are required");
    }
    return Object.freeze({ ...manifest });
}
