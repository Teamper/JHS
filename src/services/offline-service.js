// @ts-check

export class OfflineService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(providers, integrations) { this.providers = providers; this.integrations = integrations; }
    /** @param {string} integrationId @param {unknown} resource @param {Record<string, any>} [context] */
    submitWithIntegration(integrationId, resource, context = {}) {
        const adapter = this.integrations.getAdapter(integrationId);
        if (typeof adapter.submit !== "function") throw new TypeError(`Integration ${integrationId} does not support offline submission`);
        return adapter.submit(resource, context);
    }
    /** @param {string} integrationId */
    getIntegrationHomeUrl(integrationId) {
        const adapter = this.integrations.getAdapter(integrationId);
        if (typeof adapter.homeUrl !== "string") throw new TypeError(`Integration ${integrationId} does not declare a home URL`);
        return adapter.homeUrl;
    }
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
