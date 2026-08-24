// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { createJavDbSignature } from "./signature.js";

const API_ORIGIN = "https://jdforrepam.com";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http @param {() => string} sign */
export function createJavDbAdapter(http, sign = createJavDbSignature) {
    /** @param {string} path @param {Record<string, unknown>} query @param {{scope?: any, ttlMs?: number}} options @param {Record<string, string>} [headers] */
    const request = async (path, query, options = {}, headers = {}) => {
        const url = new URL(path, API_ORIGIN);
        Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));
        const response = await http.request({
            providerId: "javdb", method: "GET", url: url.href, responseType: "json",
            headers: { jdSignature: sign(), ...headers }, cacheScope: "public", ttlMs: options.ttlMs ?? 86_400_000,
            urlPolicy: { trustClass: "builtin-public", hosts: ["jdforrepam.com"] },
        }, options.scope);
        return response.data;
    };
    return Object.freeze({
        contracts: ["MovieRef", "MovieDetail", "Actor", "Magnet", "Review", "RelatedList"],
        /** @param {Record<string, unknown>} movieRef @param {{scope?: any}} [options] */
        async resolveMovie(movieRef, options = {}) {
            const carNum = normalizeMovieCarNum(movieRef.carNum);
            if (!carNum) return null;
            const payload = await request("/api/v2/search", { q: carNum, page: 1, type: "movie", limit: 20, movie_type: "all", from_recent: "false", movie_filter_by: "all", movie_sort_by: "relevance" }, { ...options, ttlMs: 604_800_000 }, { "user-agent": "Dart/3.5 (dart:io)", "accept-language": "zh-TW", host: "jdforrepam.com" });
            if (!Array.isArray(payload?.data?.movies)) throw new Error(payload?.message || "JavDB search response is invalid");
            const match = payload.data.movies.find((/** @type {any} */ movie) => normalizeMovieCarNum(movie.number) === carNum);
            return match?.id ? Object.freeze({ carNum, movieId: String(match.id), providerId: "javdb" }) : null;
        },
        /** @param {Record<string, unknown>} movieRef @param {{scope?: any}} [options] */
        async getDetail(movieRef, options = {}) {
            const movieId = String(movieRef.movieId || "").trim();
            if (!movieId) throw new TypeError("JavDB movie id is required");
            const payload = await request(`/api/v4/movies/${encodeURIComponent(movieId)}`, {}, { ...options, ttlMs: 604_800_000 });
            const movie = payload?.data?.movie;
            if (!movie?.number) throw new Error(payload?.message || "JavDB detail response is invalid");
            const imageUrls = Array.isArray(movie.preview_images) ? movie.preview_images.map((/** @type {any} */ image) => String(image.large_url || "").replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com")).filter(Boolean) : [];
            return Object.freeze({
                movieId: String(movie.id || movieId), carNum: normalizeMovieCarNum(movie.number), title: String(movie.origin_title || movie.title || ""),
                actors: Array.isArray(movie.actors) ? movie.actors.map((/** @type {any} */ actor) => Object.freeze({ id: String(actor.id), name: String(actor.name || ""), gender: Number(actor.gender) })) : [],
                duration: Number(movie.duration) || null, score: Number(movie.score) || 0, releaseDate: movie.release_date || null,
                watchedCount: Number(movie.watched_count) || 0, imageUrls: Object.freeze(imageUrls), providerId: "javdb",
            });
        },
        /** @param {Record<string, unknown>} movieRef @param {{scope?: any}} [options] */
        async listMagnets(movieRef, options = {}) {
            const movieId = String(movieRef.movieId || "").trim();
            if (!movieId) return [];
            const payload = await request(`/api/v1/movies/${encodeURIComponent(movieId)}/magnets`, {}, options);
            if (!Array.isArray(payload?.data?.magnets)) throw new Error(payload?.message || "JavDB magnet response is invalid");
            return payload.data.magnets.map((/** @type {any} */ item) => Object.freeze({
                hash: String(item.hash || ""), title: String(item.name || ""), hasHdTag: Boolean(item.hd), hasSubtitleTag: Boolean(item.cnsub),
                createdAt: item.created_at || null, seeders: Number(item.seeders) || 0, sizeMb: Number(item.size) || 0,
                fileCount: Number(item.files_count) || 0, providerId: "javdb",
            }));
        },
        /** @param {{period?: string, filter?: string, scope?: any}} [options] */
        async listRankings(options = {}) {
            const payload = await request("/api/v1/rankings/playback", { period: options.period || "daily", filter_by: options.filter || "high_score" }, options);
            if (!Array.isArray(payload?.data?.movies)) throw new Error(payload?.message || "JavDB ranking response is invalid");
            return payload.data.movies.map((/** @type {any} */ movie) => Object.freeze({
                movieId: String(movie.id), carNum: normalizeMovieCarNum(movie.number), title: String(movie.origin_title || ""),
                coverUrl: String(movie.cover_url || "").replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com"), releaseDate: movie.release_date || null,
                hasSubtitle: Boolean(movie.has_cnsub), magnetCount: Number(movie.magnets_count) || 0, newMagnets: Boolean(movie.new_magnets), providerId: "javdb",
            }));
        },
        /** @param {Record<string, unknown>} movieRef @param {{scope?: any, page?: number, limit?: number}} [options] */
        async listReviews(movieRef, options = {}) {
            const movieId = String(movieRef.movieId || "").trim();
            if (!movieId) return [];
            const payload = await request(`/api/v1/movies/${encodeURIComponent(movieId)}/reviews`, { page: options.page ?? 1, sort_by: "hotly", limit: options.limit ?? 20 }, options);
            if (!Array.isArray(payload?.data?.reviews)) throw new Error(payload?.message || "JavDB review response is invalid");
            return payload.data.reviews.map((/** @type {any} */ review) => Object.freeze({
                author: String(review.username || "匿名用户"), content: String(review.content || ""),
                score: Number(review.score) || 0, createdAt: review.created_at || null,
                likes: Number(review.likes_count) || 0,
            }));
        },
        /** @param {Record<string, unknown>} movieRef @param {{scope?: any, page?: number, limit?: number}} [options] */
        async listRelated(movieRef, options = {}) {
            const movieId = String(movieRef.movieId || "").trim();
            if (!movieId) return [];
            const payload = await request("/api/v1/lists/related", { movie_id: movieId, page: options.page ?? 1, limit: options.limit ?? 20 }, options);
            if (!Array.isArray(payload?.data?.lists)) throw new Error(payload?.message || "JavDB related response is invalid");
            return payload.data.lists.map((/** @type {any} */ item) => Object.freeze({
                id: String(item.id), name: String(item.name || "未命名清单"), movieCount: Number(item.movies_count) || 0,
                collectionCount: Number(item.collections_count) || 0, viewCount: Number(item.views_count) || 0,
                createdAt: item.created_at || null,
            }));
        },
    });
}

export default defineIntegration({
    id: "javdb", trustClass: "builtin-public", hosts: ["javdb.com", "jdforrepam.com"],
    capabilities: ["movie.search", "movie.detail", "movie.magnets", "movie.ranking", "movie.state", "movie.reviews", "movie.related", "actor.lookup"],
    requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createJavDbAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.detail": CACHE.externalDetail, "movie.magnets": "public-1d", "movie.ranking": "public-1d", "movie.reviews": "public-1d", "movie.related": "public-1d" }, quality: "silver",
});
