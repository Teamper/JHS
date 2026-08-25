// @ts-check

import { normalizeMovieCarNum } from "../core/movie-identity.js";

export class MovieIdentityService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry | null} [integrations] */
    constructor(integrations = null) { this.integrations = integrations; }
    /** @param {unknown} value */
    normalize(value) { return normalizeMovieCarNum(value); }
    /** @param {...unknown} candidates */
    firstValid(...candidates) {
        for (const candidate of candidates) {
            const carNum = this.normalize(candidate);
            if (carNum) return carNum;
        }
        return null;
    }
    /** @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async resolve(movieRef, options = {}) {
        const carNum = this.normalize(movieRef.carNum);
        if (!carNum) return null;
        const candidates = this.integrations?.list("movie.search") ?? [];
        const providerId = typeof movieRef.providerId === "string" ? movieRef.providerId : null;
        const ordered = providerId
            ? candidates.filter((manifest) => manifest.id === providerId)
            : [...candidates].sort((left, right) => Number(right.id === "javdb") - Number(left.id === "javdb"));
        for (const manifest of ordered) {
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.resolveMovie !== "function") continue;
            const resolved = await adapter.resolveMovie({ ...movieRef, carNum }, options);
            if (resolved) return resolved;
        }
        return Object.freeze({ ...movieRef, carNum });
    }
    /** @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async detail(movieRef, options = {}) {
        const candidates = this.integrations?.list("movie.detail") ?? [];
        const providerId = typeof movieRef.providerId === "string" ? movieRef.providerId : movieRef.movieId ? "javdb" : null;
        const ordered = providerId ? candidates.filter((manifest) => manifest.id === providerId) : candidates;
        for (const manifest of ordered) {
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.getDetail === "function") return adapter.getDetail(movieRef, options);
        }
        return null;
    }
    /** @param {{period?: string, filter?: string, scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async rankings(options = {}) {
        for (const manifest of this.integrations?.list("movie.ranking") ?? []) {
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.listRankings === "function") return adapter.listRankings(options);
        }
        return [];
    }
    /** @param {string} providerId @param {Record<string, unknown>} query @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async catalog(providerId, query = {}, options = {}) {
        const manifest = (this.integrations?.list("movie.catalog") ?? []).find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Movie catalog provider is unavailable: ${providerId}`);
        const adapter = this.integrations?.getAdapter(manifest.id);
        if (typeof adapter?.listCatalog !== "function") throw new TypeError(`Movie catalog operation is unavailable: ${providerId}`);
        return adapter.listCatalog(query, options);
    }
    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async people(providerId, movieRef, options = {}) {
        const manifest = (this.integrations?.list("movie.credits") ?? []).find((item) => item.id === providerId);
        if (!manifest) return Object.freeze({ actors: Object.freeze([]), seller: null });
        const adapter = this.integrations?.getAdapter(manifest.id);
        return typeof adapter?.getPeople === "function" ? adapter.getPeople(movieRef, options) : Object.freeze({ actors: Object.freeze([]), seller: null });
    }
    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async images(providerId, movieRef, options = {}) {
        const manifest = (this.integrations?.list("movie.images") ?? []).find((item) => item.id === providerId);
        if (!manifest) return [];
        const adapter = this.integrations?.getAdapter(manifest.id);
        return typeof adapter?.getImages === "function" ? adapter.getImages(movieRef, options) : [];
    }
    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async preview(providerId, movieRef, options = {}) {
        const manifest = (this.integrations?.list("movie.preview") ?? []).find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Movie preview provider is unavailable: ${providerId}`);
        const adapter = this.integrations?.getAdapter(manifest.id);
        if (typeof adapter?.getPreviewForMovie !== "function") throw new TypeError(`Movie preview operation is unavailable: ${providerId}`);
        return adapter.getPreviewForMovie(movieRef, options);
    }
    /** @param {Record<string, unknown>} movieRef @param {string[]} providerIds */
    sourceUrls(movieRef, providerIds) {
        return Object.freeze(providerIds.map((providerId) => {
            try {
                const adapter = this.integrations?.getAdapter(providerId);
                const url = typeof adapter?.detailUrl === "function" ? adapter.detailUrl(movieRef) : null;
                return url ? Object.freeze({ providerId, url }) : null;
            } catch { return null; }
        }).filter(Boolean));
    }
    /** @param {string} providerId @param {Record<string, unknown>} movieRef */
    searchUrl(providerId, movieRef) {
        try {
            const adapter = this.integrations?.getAdapter(providerId);
            return typeof adapter?.searchUrl === "function" ? adapter.searchUrl(movieRef) : null;
        } catch { return null; }
    }
    /** @param {string} providerId */
    providerOrigin(providerId) {
        try {
            const adapter = this.integrations?.getAdapter(providerId);
            return typeof adapter?.origin === "function" ? adapter.origin() : null;
        } catch { return null; }
    }
    /** @param {string} providerId @param {string} url */
    matchesProviderUrl(providerId, url) {
        try {
            const adapter = this.integrations?.getAdapter(providerId);
            return typeof adapter?.matchesUrl === "function" && adapter.matchesUrl(url);
        } catch { return false; }
    }
    /** @param {Record<string, any>} [settings] */
    externalSites(settings = {}) {
        const manifest = (this.integrations?.list("movie.external-sites") ?? [])[0], adapter = manifest && this.integrations?.getAdapter(manifest.id);
        return typeof adapter?.getSites === "function" ? adapter.getSites(settings) : [];
    }
    /** @param {string} siteId @param {string} carNum @param {{settings?: Record<string, any>, scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async searchExternalSite(siteId, carNum, options = {}) {
        const manifest = (this.integrations?.list("movie.external-sites") ?? [])[0], adapter = manifest && this.integrations?.getAdapter(manifest.id);
        if (typeof adapter?.searchSite !== "function") return Object.freeze({ searchUrl: "", matches: Object.freeze([]) });
        return adapter.searchSite(siteId, carNum, options);
    }
    externalNavigationLinks() {
        const manifest = (this.integrations?.list("navigation.external") ?? [])[0], adapter = manifest && this.integrations?.getAdapter(manifest.id);
        return typeof adapter?.getNavigationLinks === "function" ? adapter.getNavigationLinks() : [];
    }
}
