// @ts-check

export class ScreenshotService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers @param {import("../app/integration-registry.js").IntegrationRegistry | null} [integrations] */
    constructor(providers, integrations = null) { this.providers = providers; this.integrations = integrations; }
    /** @param {Record<string, unknown>} movieRef @param {Record<string, unknown>} [context] */
    async resolve(movieRef, context = {}) {
        for (const provider of await this.providers.getAvailable("screenshot", context)) {
            try {
                const result = await provider.resolve(movieRef, context);
                this.providers.updateHealth(provider.id, { ok: true });
                if (result) return result;
            } catch (error) { this.providers.updateHealth(provider.id, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
        }
        for (const manifest of this.integrations?.list("movie.images") ?? []) {
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.getImages !== "function") continue;
            const result = await adapter.getImages(movieRef, context);
            if (Array.isArray(result) && result.length) return result;
        }
        return null;
    }
}
