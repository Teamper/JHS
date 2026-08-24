// @ts-check

import { assessMagnetQuality } from "../core/magnet-quality.js";

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
    getBuiltInSources() {
        return (this.integrations?.list("magnet.search") ?? []).flatMap((manifest) => {
            const adapter = this.integrations?.getAdapter(manifest.id);
            return typeof adapter?.getSources === "function" ? adapter.getSources() : [];
        });
    }
    /** @param {string} sourceId @param {string} keyword @param {Record<string, any>} [context] */
    async searchSource(sourceId, keyword, context = {}) {
        for (const manifest of this.integrations?.list("magnet.search") ?? []) {
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (adapter?.getSources?.().some((/** @type {{id: string}} */ source) => source.id === sourceId)) return adapter.search(sourceId, keyword, context);
        }
        return [];
    }
    /** @param {string} sourceId @param {string} keyword @param {Record<string, any>} [context] */
    getSourceTargetUrl(sourceId, keyword, context = {}) {
        for (const manifest of this.integrations?.list("magnet.search") ?? []) {
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (adapter?.getSources?.().some((/** @type {{id: string}} */ source) => source.id === sourceId)) return adapter.targetUrl(sourceId, keyword, context);
        }
        return null;
    }
    /** @param {Parameters<typeof assessMagnetQuality>[0]} magnet */
    assess(magnet) { return assessMagnetQuality(magnet); }
}
