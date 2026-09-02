// @ts-check

import { normalizeCarNum } from "./constants.js";

/** @typedef {"native-detail"|"list-item"|"fc2-dialog"|"new-video"|"history"|"settings"|"modal"|"other"} MovieSurface */
/** @typedef {{ carNum: string, movieId?: string|null, title?: string, actress?: string, publishTime?: string, source?: string, detailUrl?: string, surface?: MovieSurface, [key: string]: unknown }} MovieContext */

/** Normalize a context while preserving metadata supplied by the owning surface. */
/** @param {unknown} value @param {MovieSurface} [surface] @returns {MovieContext|null} */
export function normalizeMovieContext(value, surface = "other") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = /** @type {Record<string, unknown>} */ (value);
    const carNum = normalizeCarNum(raw.carNum);
    if (!carNum) return null;
    return Object.freeze({
        ...raw,
        carNum,
        movieId: typeof raw.movieId === "string" && raw.movieId.trim() ? raw.movieId.trim() : null,
        surface: /** @type {MovieSurface} */ (raw.surface || surface),
    });
}

/** Build a context from a record-like value. */
/** @param {Record<string, unknown>} value @param {MovieSurface} [surface] */
export function createMovieContext(value, surface = "other") {
    const context = normalizeMovieContext(value, surface);
    if (!context) throw new TypeError("Movie context requires a valid carNum");
    return context;
}

/** Read the nearest context stored by an owned surface. */
/** @param {unknown} start @returns {MovieContext|null} */
export function readOwnedMovieContext(start) {
    let node = /** @type {any} */ (start)?.nodeType ? /** @type {any} */ (start) : /** @type {any} */ (start)?.[0] || null;
    while (node) {
        const jquery = typeof (/** @type {any} */ (globalThis)).$ === "function" ? (/** @type {any} */ (globalThis)).$(node) : null;
        const stored = jquery?.data?.("jhsMovieContext") || node.__jhsMovieContext;
        const context = normalizeMovieContext(stored);
        if (context) return context;
        node = node.parentElement || null;
    }
    return null;
}

/** Resolve identity in a deterministic order and report legacy fallback usage. */
/** @param {{ explicitContext?: unknown, trigger?: unknown, ownedResolver?: (() => unknown)|null, listResolver?: (() => unknown)|null, nativeResolver?: (() => unknown)|null, legacyResolver?: (() => unknown)|null, logger?: ((message: string, context?: unknown) => void)|null }} options */
export function resolveMovieContext(options = {}) {
    const explicit = normalizeMovieContext(options.explicitContext);
    if (explicit) return { context: explicit, source: "explicit" };
    const owned = normalizeMovieContext(options.ownedResolver?.() ?? readOwnedMovieContext(options.trigger), "other");
    if (owned) return { context: owned, source: owned.surface === "fc2-dialog" ? "fc2-workspace" : "owned-surface" };
    const list = normalizeMovieContext(options.listResolver?.(), "list-item");
    if (list) return { context: list, source: "list-item" };
    const native = normalizeMovieContext(options.nativeResolver?.(), "native-detail");
    if (native) return { context: native, source: "native-detail" };
    const legacy = normalizeMovieContext(options.legacyResolver?.(), "other");
    if (legacy) {
        options.logger?.("movie-context source=legacy-fallback", legacy);
        return { context: legacy, source: "legacy-fallback" };
    }
    return { context: null, source: "missing" };
}
