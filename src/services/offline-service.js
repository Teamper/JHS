// @ts-check

export class OfflineService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers */
    constructor(providers) { this.providers = providers; }
    /** @param {Record<string, unknown>} resource @param {Record<string, unknown>} [context] */
    async submit(resource, context = {}) {
        const providers = await this.providers.getAvailable("offline", context);
        const failures = [];
        for (const provider of providers) {
            try {
                const result = await provider.submit(resource, context);
                this.providers.updateHealth(provider.id, { ok: true });
                return result;
            } catch (error) {
                failures.push(error);
                this.providers.updateHealth(provider.id, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
        }
        throw new AggregateError(failures, providers.length ? "所有离线 Provider 均失败" : "没有可用的离线 Provider");
    }
}
