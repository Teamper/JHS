// @ts-check

import { collectActressLookupNames } from "../core/actress-measurements.js";
import { CACHE_TTL } from "../core/cache-policy.js";
import { JhsError, isAbortError, isNotFoundError, isTransientBlockError } from "../core/jhs-error.js";

/** @param {unknown} name */
function normalizeLookupName(name) {
    const trimmed = String(name ?? "").trim();
    return trimmed === "三上悠亞" ? "三上悠亜" : trimmed;
}

export class ActressInfoService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations @param {import("./cache-service.js").CacheService} cache */
    constructor(integrations, cache) { this.integrations = integrations; this.cache = cache; }

    /** @param {string} name */
    profileUrl(name) {
        for (const manifest of this.integrations.list("person.actress-info")) {
            const adapter = this.integrations.getAdapter(manifest.id);
            if (typeof adapter.profileUrl === "function") return adapter.profileUrl(name);
        }
        return "";
    }

    /** @param {string} name @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async lookup(name, options = {}) {
        const normalized = normalizeLookupName(name);
        if (!normalized) return null;
        const key = `actress-info:v2:${normalized}`;
        const cached = await this.cache.get("actress-info", key, { scope: "public" });
        if (cached.hit) return cached.value;
        const generation = this.cache.generation("actress-info");
        for (const manifest of this.integrations.list("person.actress-info")) {
            const adapter = this.integrations.getAdapter(manifest.id);
            if (typeof adapter.lookup !== "function") continue;
            try {
                const result = await adapter.lookup(normalized, options);
                await this.cache.set("actress-info", key, result ?? null, {
                    scope: "public",
                    ttlMs: result ? CACHE_TTL.actressInfo : CACHE_TTL.actressInfoNegative,
                    negative: !result,
                    generation,
                });
                return result ?? null;
            } catch (error) {
                if (isAbortError(error)) throw error;
                if (isNotFoundError(error)) {
                    await this.cache.set("actress-info", key, null, {
                        scope: "public",
                        ttlMs: CACHE_TTL.actressInfoNegative,
                        negative: true,
                        generation,
                    });
                    return null;
                }
                throw error;
            }
        }
        return null;
    }

    /** @param {string | string[]} names @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async lookupAny(names, options = {}) {
        /** @type {string[]} */
        const candidates = [];
        const seen = new Set();
        for (const raw of collectActressLookupNames(names)) {
            const candidate = normalizeLookupName(raw);
            if (!candidate || seen.has(candidate)) continue;
            seen.add(candidate);
            candidates.push(candidate);
        }
        for (const candidate of candidates) {
            if (options.scope?.signal?.aborted) {
                throw new JhsError("ABORTED", "请求已取消", { source: "actress-info", cause: options.scope.signal.reason });
            }
            try {
                const info = await this.lookup(candidate, options);
                if (info) return { info, matchedName: candidate };
            } catch (error) {
                if (isAbortError(error) || isTransientBlockError(error)) throw error;
                if (isNotFoundError(error)) continue;
                throw error;
            }
        }
        return null;
    }
    /** @param {string} providerId @param {Record<string, any>} actorRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope, ttlMs?: number}} [options] */
    async movies(providerId, actorRef, options = {}) {
        const manifest = this.integrations.list("actor.movies").find((item) => item.id === providerId);
        if (!manifest) return [];
        const adapter = this.integrations.getAdapter(manifest.id);
        return typeof adapter?.listActorMovies === "function" ? adapter.listActorMovies(actorRef, options) : [];
    }
    /** @param {string} providerId @param {Record<string, any>} query @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async collection(providerId, query, options = {}) {
        const manifest = this.integrations.list("actor.collection").find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Actor collection provider is unavailable: ${providerId}`);
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.listActorCollection !== "function") throw new TypeError(`Actor collection is unavailable: ${providerId}`);
        return adapter.listActorCollection(query, options);
    }
    /** @param {string} providerId @param {Record<string, any>} query @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async searchActors(providerId, query, options = {}) {
        const manifest = this.integrations.list("actor.search").find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Actor search provider is unavailable: ${providerId}`);
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.searchActors !== "function") throw new TypeError(`Actor search is unavailable: ${providerId}`);
        return adapter.searchActors(query, options);
    }
    /** @param {string} providerId @param {Record<string, any>} actorRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async uncollect(providerId, actorRef, options = {}) {
        const manifest = this.integrations.list("actor.uncollect").find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Actor provider is unavailable: ${providerId}`);
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.uncollectActor !== "function") throw new TypeError(`Actor uncollect is unavailable: ${providerId}`);
        return adapter.uncollectActor(actorRef, options);
    }
    getAvatarSources() {
        return Object.freeze(this.integrations.list("person.avatar-search").flatMap((manifest) => {
            const adapter = this.integrations.getAdapter(manifest.id);
            return typeof adapter?.getSources === "function" ? adapter.getSources() : [];
        }));
    }
    /** @param {string[]} names @param {string} sourceId @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async searchAvatars(names, sourceId, options = {}) {
        for (const manifest of this.integrations.list("person.avatar-search")) {
            const adapter = this.integrations.getAdapter(manifest.id);
            if (adapter?.getSources?.().some((/** @type {{id: string}} */ source) => source.id === sourceId)) return adapter.searchAvatars(names, { ...options, sourceId });
        }
        return [];
    }
    /** @param {string} providerId */
    placeholderUrl(providerId) {
        const adapter = this.integrations.getAdapter(providerId);
        return typeof adapter?.actorPlaceholderUrl === "function" ? adapter.actorPlaceholderUrl() : "";
    }
}
