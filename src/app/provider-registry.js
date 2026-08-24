// @ts-check

export class ProviderRegistry {
    /** @param {import("../services/diagnostics-service.js").DiagnosticsService | null} [diagnostics] */
    constructor(diagnostics = null) {
        /** @type {Map<string, Record<string, any>>} */
        this.providers = new Map();
        /** @type {Map<string, Record<string, unknown>>} */
        this.health = new Map();
        this.diagnostics = diagnostics;
    }

    /** @param {Record<string, any>} provider */
    register(provider) {
        if (!provider || typeof provider.id !== "string" || !Array.isArray(provider.capabilities)) {
            throw new TypeError("Provider requires id and capabilities");
        }
        if (this.providers.has(provider.id)) throw new Error(`Duplicate provider: ${provider.id}`);
        this.providers.set(provider.id, Object.freeze({ priority: 0, enabled: true, ...provider }));
        return provider;
    }

    /** @param {string} id */
    get(id) {
        return this.providers.get(id) ?? null;
    }

    /** @param {string} capability */
    list(capability) {
        return [...this.providers.values()]
            .filter((provider) => provider.enabled !== false && provider.capabilities.includes(capability))
            .sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0));
    }

    /** @param {string} capability @param {unknown} context */
    async getAvailable(capability, context) {
        const result = [];
        for (const provider of this.list(capability)) {
            if (typeof provider.isAvailable !== "function" || await provider.isAvailable(context)) result.push(provider);
        }
        return result;
    }

    /** @param {string} id @param {Record<string, unknown>} result */
    updateHealth(id, result) {
        if (!this.providers.has(id)) throw new Error(`Unknown provider: ${id}`);
        this.health.set(id, Object.freeze({ ...result, updatedAt: Date.now() }));
        this.diagnostics?.updateProvider(id, result);
    }

    /** @param {string} id */
    getHealth(id) {
        return this.health.get(id) ?? null;
    }
}
