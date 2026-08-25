// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, PORT, SERVICE } from "../../contracts/tokens.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { createJavDbSignature } from "./signature.js";
import { JhsError } from "../../core/jhs-error.js";

const API_ORIGIN = "https://jdforrepam.com";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http @param {() => string} sign @param {{parseActorMovies?: (html: string, baseUrl: string) => any, parseActorCollection?: (html: string, baseUrl: string) => any} | null} hostAdapter */
export function createJavDbAdapter(http, sign = createJavDbSignature, hostAdapter = null) {
    /** @param {string} baseUrl */
    const hostPolicy = (baseUrl) => {
        const origin = new URL(baseUrl).origin, hostname = new URL(baseUrl).hostname, builtin = hostname === "javdb.com" || hostname.endsWith(".javdb.com");
        return builtin ? { trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: origin } : { trustClass: "custom-public", expectedOrigin: origin };
    };
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
        contracts: ["MovieRef", "MovieDetail", "Actor", "Magnet", "Review", "RelatedList", "AccountSession"],
        actorPlaceholderUrl: () => "https://c0.jdbstatic.com/images/actor_unknow.jpg",
        /** @param {{username: string, password: string}} credentials @param {{scope?: any}} [options] */
        async login(credentials, options = {}) {
            const url = new URL("/api/v1/sessions", API_ORIGIN);
            Object.entries({
                username: credentials.username, password: credentials.password,
                device_uuid: "04b9534d-5118-53de-9f87-2ddded77111e", device_name: "iPhone", device_model: "iPhone",
                platform: "ios", system_version: "17.4", app_version: "official", app_version_number: "1.9.29", app_channel: "official",
            }).forEach(([key, value]) => url.searchParams.set(key, value));
            const response = await http.request({
                providerId: "javdb", method: "POST", url: url.href, responseType: "json", cacheScope: "none",
                headers: { "user-agent": "Dart/3.5 (dart:io)", "accept-language": "zh-TW", "content-type": "multipart/form-data; boundary=--dio-boundary-2210433284", jdsignature: sign() },
                urlPolicy: { trustClass: "builtin-public", hosts: ["jdforrepam.com"] },
            }, options.scope);
            const payload = response.data;
            if (payload?.success === 0) return Object.freeze({ success: false, token: null, message: String(payload.message || "登录失败") });
            if (payload?.success !== 1 || typeof payload?.data?.token !== "string") throw new JhsError("INVALID_RESPONSE", String(payload?.message || "JavDB 登录响应无效"), { source: "javdb" });
            return Object.freeze({ success: true, token: payload.data.token, message: String(payload.message || "") });
        },
        /** @param {{actorId: string, baseUrl?: string}} actorRef @param {{scope?: any, ttlMs?: number}} [options] */
        async listActorMovies(actorRef, options = {}) {
            const baseUrl = new URL(actorRef.baseUrl || "https://javdb.com").origin, url = new URL(`/actors/${encodeURIComponent(actorRef.actorId)}?t=d`, baseUrl);
            const response = await http.request({
                providerId: "javdb-host", method: "GET", url: url.href, responseType: "text", cacheScope: options.ttlMs === 0 ? "none" : "public", ttlMs: options.ttlMs ?? 300_000,
                urlPolicy: hostPolicy(baseUrl),
            }, options.scope);
            if (typeof hostAdapter?.parseActorMovies !== "function") throw new TypeError("JavDB HostAdapter parser is unavailable");
            return hostAdapter.parseActorMovies(response.data, response.finalUrl || url.href);
        },
        /** @param {{baseUrl?: string, pageUrl?: string}} query @param {{scope?: any}} [options] */
        async listActorCollection(query, options = {}) {
            const baseUrl = new URL(query.baseUrl || "https://javdb.com").origin, url = new URL(query.pageUrl || "/users/collection_actors", baseUrl);
            const response = await http.request({
                providerId: "javdb-host", method: "GET", url: url.href, responseType: "text", cacheScope: "none", urlPolicy: hostPolicy(baseUrl),
            }, options.scope);
            if (typeof hostAdapter?.parseActorCollection !== "function") throw new TypeError("JavDB HostAdapter collection parser is unavailable");
            return hostAdapter.parseActorCollection(response.data, response.finalUrl || url.href);
        },
        /** @param {{actorId: string, baseUrl?: string, csrfToken: string}} actorRef @param {{scope?: any}} [options] */
        async uncollectActor(actorRef, options = {}) {
            const baseUrl = new URL(actorRef.baseUrl || "https://javdb.com").origin, url = new URL(`/actors/${encodeURIComponent(actorRef.actorId)}/uncollect`, baseUrl);
            const response = await http.request({
                providerId: "javdb-host", method: "POST", url: url.href, body: "null", responseType: "text", cacheScope: "none",
                headers: { "Content-Type": "application/json", "x-csrf-token": actorRef.csrfToken }, urlPolicy: hostPolicy(baseUrl),
            }, options.scope);
            return Object.freeze({ success: typeof response.data === "string" && response.data.includes("removeClass") });
        },
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
            const coverUrl = movie.cover_url ? String(movie.cover_url).replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com") : "";
            return Object.freeze({
                movieId: String(movie.id || movieId), carNum: normalizeMovieCarNum(movie.number),
                title: String(movie.title || movie.origin_title || ""),
                originalTitle: String(movie.origin_title || movie.title || ""),
                coverUrl: coverUrl || null,
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
    id: "javdb", trustClass: "builtin-public", hosts: ["javdb.com", "jdforrepam.com", "c0.jdbstatic.com"],
    capabilities: ["movie.search", "movie.detail", "movie.magnets", "movie.ranking", "movie.state", "movie.reviews", "movie.related", "actor.lookup", "actor.movies", "actor.collection", "actor.uncollect", "actor.avatar-placeholder", "account.login"],
    requires: [SERVICE.http, PORT.javdbHost],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http], hostAdapter: dependencies[PORT.javdbHost] }),
    createAdapter: (/** @type {any} */ client) => createJavDbAdapter(client.http, createJavDbSignature, client.hostAdapter), createHostAdapter: null,
    cachePolicy: { "movie.search": "none", "movie.detail": CACHE.externalDetail, "movie.magnets": "public-1d", "movie.ranking": "public-1d", "movie.state": "none", "movie.reviews": "public-1d", "movie.related": "public-1d", "actor.lookup": "none", "actor.movies": "public-5m", "actor.collection": "none", "actor.uncollect": "none", "actor.avatar-placeholder": "none", "account.login": "none" }, quality: "silver",
});
