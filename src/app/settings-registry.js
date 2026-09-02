// @ts-check

const VALID_EFFECTS = new Set(["live", "nextNavigation", "manual"]);
const VALID_TYPES = new Set(["boolean", "select", "number", "text", "password", "json"]);
const VALID_SURFACES = new Set(["full", "quick"]);

/** @typedef {"live"|"nextNavigation"|"manual"} SettingEffect */
/** @typedef {{ key: string, owner: string, label: string, description?: string, type: string, defaultValue?: unknown, effect?: SettingEffect, surfaces?: string[], validate?: (value: unknown) => boolean, contribution?: string } & Record<string, any>} SettingDescriptor */

/** Normalize a raw descriptor into the canonical SettingDescriptor shape. */
/** @param {Record<string, any>} descriptor */
export function normalizeSettingDescriptor(descriptor) {
    if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) throw new TypeError("Setting descriptor must be an object");
    const key = String(descriptor.key ?? descriptor.id ?? "");
    if (!key) throw new TypeError("Setting descriptor requires key (or id)");
    if (!descriptor.owner) throw new TypeError(`Setting descriptor requires owner: ${key}`);
    const type = String(descriptor.type ?? (descriptor.defaultValue != null ? typeof descriptor.defaultValue === "boolean" ? "boolean" : "text" : "text"));
    if (!VALID_TYPES.has(type)) throw new TypeError(`Setting descriptor has invalid type: ${key} (${type})`);
    const effect = descriptor.effect ?? "live";
    if (!VALID_EFFECTS.has(effect)) throw new TypeError(`Setting descriptor has invalid effect: ${key} (${effect})`);
    const surfaces = Array.isArray(descriptor.surfaces) ? [...new Set(descriptor.surfaces)].filter((name) => VALID_SURFACES.has(name)) : [];
    if (descriptor.surfaces != null && !Array.isArray(descriptor.surfaces)) throw new TypeError(`Setting descriptor surfaces must be an array: ${key}`);
    return Object.freeze({
        ...descriptor,
        key,
        owner: String(descriptor.owner),
        label: String(descriptor.label ?? descriptor.key ?? key),
        description: descriptor.description == null ? "" : String(descriptor.description),
        type,
        effect,
        surfaces: Object.freeze(surfaces),
        validate: typeof descriptor.validate === "function" ? descriptor.validate : null,
        normalize: typeof descriptor.normalize === "function" ? descriptor.normalize : null,
        contribution: descriptor.contribution == null ? undefined : String(descriptor.contribution),
    });
}

export class SettingsRegistry {
    constructor() { this.descriptors = new Map(); }

    /** Register one canonical setting descriptor. */
    /** @param {Record<string, any>} descriptor */
    register(descriptor) {
        const normalized = normalizeSettingDescriptor(descriptor);
        if (this.descriptors.has(normalized.key)) throw new Error(`Duplicate setting descriptor: ${normalized.key}`);
        this.descriptors.set(normalized.key, normalized);
        return this;
    }

    /** @param {{ surfaces?: string[], disabledContributions?: Set<string> }} [options] */
    list(options = {}) {
        const surfaces = options.surfaces;
        return [...this.descriptors.values()].filter((descriptor) => {
            if (descriptor.contribution && options.disabledContributions?.has(descriptor.contribution)) return false;
            if (surfaces && surfaces.length) {
                if (!descriptor.surfaces.includes(surfaces[0]) && !surfaces.some((name) => descriptor.surfaces.includes(name))) return false;
            }
            return true;
        });
    }

    /** @param {string} key */
    get(key) { return this.descriptors.get(key) ?? null; }

    /** @param {string} key @param {unknown} value */
    isValid(key, value) {
        const descriptor = this.descriptors.get(key);
        if (!descriptor) return true;
        if (typeof descriptor.validate === "function") return descriptor.validate(value) === true;
        return true;
    }

    /** Return the canonical normalizers for SettingsService persistence. */
    normalizers() {
        return Object.fromEntries([...this.descriptors.values()].filter((descriptor) => typeof descriptor.normalize === "function").map((descriptor) => [descriptor.key, descriptor.normalize]));
    }
}
