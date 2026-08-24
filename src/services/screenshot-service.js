// @ts-check

export class ScreenshotService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers */
    constructor(providers) { this.providers = providers; }
    /** @param {Record<string, unknown>} movieRef @param {Record<string, unknown>} [context] */
    async resolve(movieRef, context = {}) {
        for (const provider of await this.providers.getAvailable("screenshot", context)) {
            try {
                const result = await provider.resolve(movieRef, context);
                this.providers.updateHealth(provider.id, { ok: true });
                if (result) return result;
            } catch (error) { this.providers.updateHealth(provider.id, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
        }
        return null;
    }
}
