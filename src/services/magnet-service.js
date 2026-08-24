// @ts-check

export class MagnetService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers */
    constructor(providers) { this.providers = providers; }
    /** @param {Record<string, unknown>} movieRef @param {Record<string, unknown>} [context] */
    async search(movieRef, context = {}) {
        const results = [];
        for (const provider of await this.providers.getAvailable("magnet", context)) {
            try {
                const items = await provider.search(movieRef, context);
                this.providers.updateHealth(provider.id, { ok: true });
                if (Array.isArray(items)) results.push(...items);
            } catch (error) { this.providers.updateHealth(provider.id, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
        }
        return results;
    }
}
