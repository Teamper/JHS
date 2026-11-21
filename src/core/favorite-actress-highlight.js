// @ts-check

import { _ } from "./constants.js";
import { cleanActressName } from "./actress-measurements.js";
import { normalizeMovieCarNum } from "./movie-identity.js";

const NAME_SPLIT_RE = /[\s,，、/|()（）·・]+/u;
const HAS_NAME_DELIM_RE = /[\s,，、/|()（）·・]/u;
const REGEXP_SPECIAL_RE = /[.*+?^${}()|[\]\\]/gu;

/** @param {string} value */
function escapeRegExp(value) {
    return value.replace(REGEXP_SPECIAL_RE, "\\$&");
}

/** @param {unknown} value */
function cleanActorAlias(value) {
    return cleanActressName(value);
}

/**
 * Resolve border width, color, and enablement shared by detail and poster-wall actress highlights.
 * @param {Record<string, any> | null | undefined} settings
 * @returns {{ enabled: boolean, width: number, color: string }}
 */
export function resolveFavoriteActressHighlightStyle(settings) {
    const enabled = (settings?.enableFavoriteActresses ?? _) === _;
    const rawWidth = Number(settings?.highlightedTagNumber);
    const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
    const rawColor = typeof settings?.highlightedTagColor === "string" ? settings.highlightedTagColor.trim() : "";
    const color = /^#[\da-f]{3,8}$/iu.test(rawColor) ? rawColor : "var(--jhs-danger)";
    return { enabled, width, color };
}

/**
 * Build a local read-only index from favorite_actresses for zero-network poster-wall highlighting.
 * @param {any[]} [actresses]
 */
export function buildFavoriteActressWorkIndex(actresses = []) {
    /** @type {Map<string, string[]>} */
    const carNumToNames = new Map();
    /** @type {Map<string, string>} */
    const starIdToName = new Map();
    /** @type {Map<string, string[]>} */
    const tokenToNames = new Map();
    /** @type {{ regex: RegExp, displayName: string }[]} */
    const phraseMatchers = [];
    /** @type {Set<string>} */
    const seenPhraseKeys = new Set();

    const addMappedName = (/** @type {Map<string, string[]>} */ map, /** @type {string} */ key, /** @type {string} */ displayName) => {
        if (!key || !displayName) return;
        const list = map.get(key);
        if (list) {
            if (!list.includes(displayName)) list.push(displayName);
        } else {
            map.set(key, [displayName]);
        }
    };

    for (const actress of Array.isArray(actresses) ? actresses : []) {
        if (!actress || typeof actress !== "object") continue;
        const starId = String(actress.starId || "").trim();
        const displayName = cleanActorAlias(actress.name) || starId;
        if (!displayName) continue;
        if (starId && !starIdToName.has(starId)) {
            starIdToName.set(starId, displayName);
        }
        for (const item of Array.isArray(actress.newVideoList) ? actress.newVideoList : []) {
            const rawCarNum = typeof item === "string" ? item : item?.carNum;
            const normalized = normalizeMovieCarNum(rawCarNum);
            if (normalized) addMappedName(carNumToNames, normalized, displayName);
        }
        const rawAliases = [
            actress.name,
            ...(Array.isArray(actress.allName)
                ? actress.allName
                : typeof actress.allName === "string"
                    ? actress.allName.split(/[,，、]/u)
                    : []),
        ];
        for (const rawAlias of rawAliases) {
            const alias = cleanActorAlias(rawAlias);
            if (alias.length < 2) continue;
            const lower = alias.toLowerCase();
            if (!HAS_NAME_DELIM_RE.test(lower)) {
                addMappedName(tokenToNames, lower, displayName);
            } else {
                const dedupeKey = `${lower}\0${displayName}`;
                if (seenPhraseKeys.has(dedupeKey)) continue;
                seenPhraseKeys.add(dedupeKey);
                phraseMatchers.push({
                    regex: new RegExp(`(?:^|[\\s,，、/|()（）·・])${escapeRegExp(lower)}(?=$|[\\s,，、/|()（）·・])`, "u"),
                    displayName,
                });
            }
        }
    }

    return Object.freeze({
        hasActresses: starIdToName.size > 0 || carNumToNames.size > 0 || tokenToNames.size > 0 || phraseMatchers.length > 0,
        carNumToNames,
        starIdToName,
        tokenToNames,
        phraseMatchers,
    });
}

/**
 * Match collected actresses for one list/poster-wall card using local data only.
 * @param {{ carNum?: string, recordNames?: string, cardNames?: string, cardStarIds?: string[] }} card
 * @param {ReturnType<typeof buildFavoriteActressWorkIndex> | null | undefined} index
 * @returns {string[]}
 */
export function matchCollectedActressesForWork(card, index) {
    if (!index?.hasActresses) return [];
    /** @type {string[]} */
    const matched = [];
    const appendName = (/** @type {string} */ name) => {
        if (name && !matched.includes(name)) matched.push(name);
    };

    for (const starId of Array.isArray(card?.cardStarIds) ? card.cardStarIds : []) {
        const hit = index.starIdToName.get(String(starId || "").trim());
        if (hit) appendName(hit);
    }

    const normalizedCarNum = normalizeMovieCarNum(card?.carNum);
    if (normalizedCarNum) {
        const byCarNum = index.carNumToNames.get(normalizedCarNum);
        if (byCarNum) {
            for (const name of byCarNum) appendName(name);
        }
    }

    const nameTexts = [card?.recordNames, card?.cardNames]
        .map((value) => cleanActorAlias(value).toLowerCase())
        .filter(Boolean);
    for (const text of nameTexts) {
        for (const token of text.split(NAME_SPLIT_RE)) {
            if (token.length < 2) continue;
            const hits = index.tokenToNames.get(token);
            if (hits) {
                for (const name of hits) appendName(name);
            }
        }
        for (const entry of index.phraseMatchers) {
            if (entry.regex.test(text)) appendName(entry.displayName);
        }
    }

    return matched;
}
