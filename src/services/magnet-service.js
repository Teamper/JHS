// @ts-check

export class MagnetService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers @param {import("../app/integration-registry.js").IntegrationRegistry | null} [integrations] */
    constructor(providers, integrations = null) { this.providers = providers; this.integrations = integrations; }
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
    /** @param {Record<string, unknown>} movieRef @param {Record<string, any>} [context] */
    async listNative(movieRef, context = {}) {
        const providerId = typeof movieRef.providerId === "string" ? movieRef.providerId : "javdb";
        const manifest = (this.integrations?.list("movie.magnets") ?? []).find((item) => item.id === providerId);
        if (!manifest) return [];
        const adapter = this.integrations?.getAdapter(manifest.id);
        return typeof adapter?.listMagnets === "function" ? adapter.listMagnets(movieRef, context) : [];
    }
}
