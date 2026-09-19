// @ts-check

export class SubtitleService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(integrations) { this.integrations = integrations; }

    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async search(providerId, movieRef, options = {}) {
        const manifest = this.integrations.list("subtitle.search").find((item) => item.id === providerId);
        if (!manifest) return [];
        const adapter = this.integrations.getAdapter(manifest.id);
        return typeof adapter?.search === "function" ? adapter.search(movieRef, options) : [];
    }

    /** @param {string} providerId @param {Record<string, unknown>} subtitle @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async download(providerId, subtitle, options = {}) {
        const manifest = this.integrations.list("subtitle.download").find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Subtitle provider is unavailable: ${providerId}`);
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.download !== "function") throw new TypeError(`Subtitle download is unavailable: ${providerId}`);
        return adapter.download(subtitle, options);
    }
}
