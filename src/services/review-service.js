// @ts-check

export class ReviewService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(integrations) { this.integrations = integrations; }
    /** @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope, page?: number, limit?: number}} [options] */
    async list(movieRef, options = {}) {
        for (const manifest of this.integrations.list("movie.reviews")) {
            const adapter = this.integrations.getAdapter(manifest.id);
            if (typeof adapter.listReviews === "function") return adapter.listReviews(movieRef, options);
        }
        return [];
    }
}
