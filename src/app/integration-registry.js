// @ts-check

import { defineIntegration } from "../contracts/manifests.js";

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
            const dependencies = this.container.resolveDeclared(manifest.requires);
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
