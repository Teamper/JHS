// @ts-check

export class AccountService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(integrations) { this.integrations = integrations; }

    /** @param {string} providerId @param {{username: string, password: string}} credentials @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async login(providerId, credentials, options = {}) {
        const manifest = this.integrations.list("account.login").find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Account provider is unavailable: ${providerId}`);
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.login !== "function") throw new TypeError(`Account login is unavailable: ${providerId}`);
        return adapter.login(credentials, options);
    }
}
