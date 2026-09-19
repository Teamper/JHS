// @ts-check

import { defineIntegration } from "../contracts/manifests.js";
import { SERVICE } from "../contracts/tokens.js";

export const CACHE_POLICIES = Object.freeze({
    none: { cacheScope: "none", ttlMs: 0 },
    "public-1d": { cacheScope: "public", ttlMs: 86_400_000 },
    "public-5m": { cacheScope: "public", ttlMs: 300_000 },
    "public-7d": { cacheScope: "public", ttlMs: 604_800_000 },
    "external-detail-v1": { cacheScope: "public", ttlMs: 604_800_000, cacheNamespace: "external-detail-v1" },
    "screenshot-7d": { cacheScope: "public", ttlMs: 604_800_000, cacheNamespace: "screenshot" },
    "session-configured": { cacheScope: "session", ttlMs: 3_600_000 },
    "source-configured": { cacheScope: "public", ttlMs: 21_600_000, cacheNamespace: "source", getOnly: true },
});

/** @param {Record<string, any>} manifest @param {string} capability @param {Record<string, any>} [options] */
export function resolveIntegrationCachePolicy(manifest, capability, options = {}) {
    const declared = manifest.cachePolicy === "none" ? "none" : manifest.cachePolicy?.[capability];
    const policy = /** @type {Record<string, any>} */ ({ ...(CACHE_POLICIES[/** @type {keyof typeof CACHE_POLICIES} */ (declared)] || CACHE_POLICIES.none) });
    if (policy.getOnly && String(options.method || "GET").toUpperCase() !== "GET") return Object.freeze({ cacheScope: "none", ttlMs: 0 });
    delete policy.getOnly;
    if (declared === "session-configured") /** @type {any} */ (policy).sessionScopeId = String(options.sessionScopeId || `${manifest.id}-session`);
    return Object.freeze(policy);
}

/** Build the only HTTP entrypoint an integration adapter may use. */
/** @param {any} http @param {Record<string, any>} manifest */
export function createIntegrationRequestFacade(http, manifest) {
    const policyFor = (/** @type {string} */ capability, /** @type {Record<string, any>} */ options = {}) => {
        return resolveIntegrationCachePolicy(manifest, capability, options);
    };
    const inferCapability = (/** @type {Record<string, any>} */ options) => {
        if (options.capability && manifest.capabilities.includes(options.capability)) return options.capability;
        if (manifest.capabilities.length === 1) return manifest.capabilities[0];
        const provider = String(options.providerId || "");
        return manifest.capabilities.find((/** @type {string} */ item) => provider.includes(String(item).split(".").pop() || "")) || manifest.capabilities[0];
    };
    return Object.freeze({
        request(/** @type {any} */ capabilityOrOptions, /** @type {any} */ optionsOrScope, /** @type {any} */ maybeScope) {
            const explicit = typeof capabilityOrOptions === "string";
            const capability = explicit ? capabilityOrOptions : inferCapability(capabilityOrOptions);
            const options = explicit ? (optionsOrScope || {}) : (capabilityOrOptions || {});
            const scope = explicit ? maybeScope : optionsOrScope;
            if (!manifest.capabilities.includes(capability)) throw new TypeError(`Integration ${manifest.id} does not declare capability ${capability}`);
            const policy = policyFor(capability, options);
            const transport = { ...options, ...policy };
            delete transport.capability;
            return http.request(transport, scope);
        },
    });
}

export class IntegrationRegistry {
    /** @param {import("./dependency-container.js").DependencyContainer} container @param {import("../services/diagnostics-service.js").DiagnosticsService} diagnostics */
    constructor(container, diagnostics) {
        this.container = container;
        this.diagnostics = diagnostics;
        /** @type {Map<string, Record<string, any>>} */
        this.manifests = new Map();
        /** @type {Map<string, any>} */
        this.adapters = new Map();
    }

    /** @param {Record<string, any>} manifest */
    register(manifest) {
        try {
            const validated = /** @type {Record<string, any>} */ (defineIntegration(manifest));
            if (this.manifests.has(validated.id)) throw new Error(`Duplicate integration: ${validated.id}`);
            this.manifests.set(validated.id, validated);
        } catch (error) {
            this.diagnostics.recordError(error);
            throw error;
        }
    }

    /** @param {string} capability */
    list(capability) { return [...this.manifests.values()].filter((manifest) => manifest.capabilities.includes(capability)); }

    /** @param {string} id */
    getAdapter(id) {
        const cached = this.adapters.get(id);
        if (cached) return cached;
        const manifest = this.manifests.get(id);
        if (!manifest) throw new Error(`Unknown integration: ${id}`);
        try {
            const declared = this.container.resolveDeclared(manifest.requires);
            const dependencies = Object.create(null);
            for (const token of manifest.requires) Object.defineProperty(dependencies, token, { value: token === SERVICE.http ? createIntegrationRequestFacade(declared[token], manifest) : declared[token], enumerable: true });
            Object.freeze(dependencies);
            const client = manifest.createClient(dependencies);
            const adapter = manifest.createAdapter(client, dependencies);
            this.adapters.set(id, adapter);
            return adapter;
        } catch (error) {
            this.diagnostics.recordError(error);
            throw error;
        }
    }
}
