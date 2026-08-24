// @ts-check

export class TranslationService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(integrations) { this.integrations = integrations; }

    /** @param {string} text @param {{sourceLanguage?: string, targetLanguage?: string, scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async translate(text, options = {}) {
        const manifest = this.integrations.list("text.translate")[0];
        if (!manifest) throw new TypeError("Translation provider is unavailable");
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.translate !== "function") throw new TypeError(`Translation operation is unavailable: ${manifest.id}`);
        return adapter.translate(text, options);
    }
}
