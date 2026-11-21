// @ts-check

export const CUP_FILTER_OPTIONS = Object.freeze(["A", "B", "C", "D", "E", "F", "G", "H+"]);

const ACTRESS_TAG_RE = /[（(](?:無碼|无码|有碼|有码)[)）]/gu;
const BRACKET_NOTE_RE = /\[[^\]]*\]/gu;
const WHITESPACE_RE = /\s+/gu;
const SPLIT_NAMES_RE = /[,，、]/u;
const ARROW_SPLIT_RE = /(?:→|->|⇒|➡)/u;
const CUP_PLACEHOLDER_WORDS_RE = /\b(?:N\/A|NA|NONE|NULL|UNKNOWN|TBD|TBA|CM|KG|CUP)\b/giu;
const THREE_SIZE_PREFIX_RE = /(?<![A-Z])[BWH](?=\s*[:：\-]?\s*\d)/giu;
const CUP_NON_VALUE_RE = /^(?:不明|非公開|非公表|未公開|未公表|なし|無|無し|秘密|未知|暂无|暫無|[-―—?？\s])+$/u;
const CUP_LETTER_RE = /(?<![A-Z])([A-Z])(?![A-Z\d])/iu;
const ACTRESS_PROFILE_FIELDS = Object.freeze(/** @type {const} */ ([
    "url",
    "birthday",
    "age",
    "height",
    "weight",
    "threeSizeText",
    "braSize",
    "matchedName",
]));
const CUP_OPTION_SET = new Set(CUP_FILTER_OPTIONS);

/**
 * Strip censorship tags like `(無碼)`/`(有碼)` and optionally bracketed notes `[...]`.
 * @param {unknown} value
 * @param {{ stripBrackets?: boolean }} [options]
 * @returns {string}
 */
export function cleanActressName(value, { stripBrackets = false } = {}) {
    let text = String(value ?? "").replace(ACTRESS_TAG_RE, " ");
    if (stripBrackets) text = text.replace(BRACKET_NOTE_RE, " ");
    return text.replace(WHITESPACE_RE, " ").trim();
}

/**
 * Safely clone an actor DOM element, strip JHS state badges, and read clean text.
 * @param {Element | { textContent?: string | null, cloneNode?: (deep?: boolean) => any } | null | undefined} element
 * @returns {string}
 */
export function readCleanActorElementText(element) {
    if (!element) return "";
    if (typeof element.cloneNode === "function") {
        const clone = element.cloneNode(true);
        if (clone && typeof clone.querySelectorAll === "function") {
            for (const badge of clone.querySelectorAll(".jhs-actress-state-container, .jhs-badge")) {
                if (typeof badge.remove === "function") badge.remove();
                else badge.parentNode?.removeChild?.(badge);
            }
        }
        return String(clone?.textContent ?? "").replace(WHITESPACE_RE, " ").trim();
    }
    return String(element.textContent ?? "").replace(WHITESPACE_RE, " ").trim();
}

/**
 * Recursively flatten string/array actress name sources, split on commas, clean, and deduplicate preserving order.
 * @param {...unknown} sources
 * @returns {string[]}
 */
export function collectActressLookupNames(...sources) {
    /** @type {string[]} */
    const result = [];
    /** @type {Set<string>} */
    const seen = new Set();
    /** @param {unknown} item */
    const visit = (item) => {
        if (item == null) return;
        if (Array.isArray(item)) {
            for (const entry of item) visit(entry);
            return;
        }
        if (typeof item !== "string") return;
        for (const part of item.split(SPLIT_NAMES_RE)) {
            const cleaned = cleanActressName(part, { stripBrackets: true });
            if (!cleaned || seen.has(cleaned)) continue;
            seen.add(cleaned);
            result.push(cleaned);
        }
    };
    for (const source of sources) visit(source);
    return result;
}

/**
 * Parse height in centimeters within [100, 230].
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseHeightCm(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 100 && value <= 230 ? value : null;
    }
    if (typeof value !== "string") return null;
    const stripped = value.replace(BRACKET_NOTE_RE, " ").trim();
    if (!stripped) return null;
    const segments = stripped.split(ARROW_SPLIT_RE).map((part) => part.trim()).filter(Boolean);
    const segment = segments.at(-1) ?? "";
    if (!segment) return null;
    const cmMatch = segment.match(/(\d+(?:\.\d+)?)\s*cm\b/iu);
    const numMatch = cmMatch ?? segment.match(/^\s*(\d+(?:\.\d+)?)\s*$/u);
    if (!numMatch) return null;
    const parsed = Number.parseFloat(numMatch[1]);
    return Number.isFinite(parsed) && parsed >= 100 && parsed <= 230 ? parsed : null;
}

/**
 * Parse age in years within [15, 99].
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseAgeYears(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 15 && value <= 99 ? Math.trunc(value) : null;
    }
    if (typeof value !== "string") return null;
    const stripped = value.replace(BRACKET_NOTE_RE, " ").trim();
    if (!stripped) return null;
    const segments = stripped.split(ARROW_SPLIT_RE).map((part) => part.trim()).filter(Boolean);
    const segment = segments.at(-1) ?? "";
    if (!segment) return null;
    const unitMatch = segment.match(/(\d{1,3})\s*(?:岁|歳|years?|y\.?o\.?)/iu);
    const numMatch = unitMatch ?? segment.match(/^\s*(\d{1,3})\s*$/u);
    if (!numMatch) return null;
    const parsed = Number.parseInt(numMatch[1], 10);
    return Number.isFinite(parsed) && parsed >= 15 && parsed <= 99 ? parsed : null;
}

/**
 * Parse cup letter A..Z after stripping footnotes, arrows, and placeholder words.
 * @param {unknown} value
 * @returns {string | null}
 */
export function parseCupLetter(value) {
    if (typeof value !== "string") return null;
    const stripped = value.replace(BRACKET_NOTE_RE, " ").trim();
    if (!stripped) return null;
    const segments = stripped.split(ARROW_SPLIT_RE).map((part) => part.trim()).filter(Boolean);
    const segment = (segments.at(-1) ?? "")
        .replace(CUP_PLACEHOLDER_WORDS_RE, " ")
        .replace(THREE_SIZE_PREFIX_RE, " ")
        .trim();
    if (!segment || CUP_NON_VALUE_RE.test(segment)) return null;
    const match = segment.match(CUP_LETTER_RE);
    return match ? match[1].toUpperCase() : null;
}

/**
 * @typedef {{ heightCm: number | null, ageYears: number | null, cup: string | null }} ParsedMeasurements
 */

/**
 * Extract normalized measurements from a profile or measurement object.
 * @param {Record<string, any> | null | undefined} source
 * @returns {ParsedMeasurements}
 */
export function parseActressMeasurements(source) {
    if (!source || typeof source !== "object") {
        return { heightCm: null, ageYears: null, cup: null };
    }
    const heightCm = source.heightCm != null ? parseHeightCm(source.heightCm) : parseHeightCm(source.height);
    const ageYears = source.ageYears != null ? parseAgeYears(source.ageYears) : parseAgeYears(source.age);
    const cup = source.cup != null
        ? parseCupLetter(source.cup)
        : (parseCupLetter(source.braSize) ?? parseCupLetter(source.threeSizeText));
    return { heightCm, ageYears, cup };
}

/**
 * Read parsed measurements from a stored favorite actress record.
 * @param {Record<string, any> | null | undefined} actress
 * @returns {ParsedMeasurements | null}
 */
export function readStoredActressMeasurements(actress) {
    const profile = readVerifiedActressProfile(actress);
    if (!profile) return null;
    return parseActressMeasurements(profile);
}

/**
 * Format body measurements into a concise display string.
 * @param {Record<string, any> | null | undefined} source
 * @returns {string}
 */
export function formatBodyMeasurements(source) {
    if (!source || typeof source !== "object") return "";
    const target = Object.hasOwn(source, "actressProfile")
        ? readVerifiedActressProfile(source)
        : source;
    if (!target) return "";
    const parsed = parseActressMeasurements(target);
    /** @type {string[]} */
    const parts = [];
    if (parsed.heightCm !== null) parts.push(`${parsed.heightCm}cm`);
    if (parsed.cup) parts.push(`${parsed.cup}杯`);
    const threeSize = typeof target.threeSizeText === "string"
        ? target.threeSizeText.replace(BRACKET_NOTE_RE, " ").replace(WHITESPACE_RE, " ").trim()
        : "";
    if (threeSize) parts.push(threeSize);
    if (parsed.ageYears !== null) parts.push(`${parsed.ageYears}岁`);
    return parts.join(" · ");
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseFilterBound(value) {
    if (value === null || value === undefined || typeof value === "boolean") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * @param {unknown} rawCup
 * @returns {string | null}
 */
function normalizeCupOption(rawCup) {
    if (typeof rawCup !== "string") return null;
    const token = rawCup.trim().toUpperCase();
    if (!token) return null;
    if (CUP_OPTION_SET.has(token)) return token;
    if (/^[H-Z]$/u.test(token)) return "H+";
    return null;
}

/**
 * @typedef {{ heightMin: number | null, heightMax: number | null, ageMin: number | null, ageMax: number | null, cups: readonly string[] }} NormalizedBodyFilter
 */

/**
 * Normalize raw body filter inputs.
 * @param {Record<string, any> | null | undefined} rawFilter
 * @returns {NormalizedBodyFilter}
 */
export function normalizeBodyFilter(rawFilter) {
    const heightMin = parseFilterBound(rawFilter?.heightMin);
    const heightMax = parseFilterBound(rawFilter?.heightMax);
    const ageMin = parseFilterBound(rawFilter?.ageMin);
    const ageMax = parseFilterBound(rawFilter?.ageMax);
    const rawCups = Array.isArray(rawFilter?.cups) || rawFilter?.cups instanceof Set
        ? [...rawFilter.cups]
        : typeof rawFilter?.cups === "string"
            ? rawFilter.cups.split(SPLIT_NAMES_RE)
            : [];
    const cupSet = new Set();
    for (const item of rawCups) {
        const option = normalizeCupOption(item);
        if (option) cupSet.add(option);
    }
    const cups = CUP_FILTER_OPTIONS.filter((option) => cupSet.has(option));
    return Object.freeze({ heightMin, heightMax, ageMin, ageMax, cups: Object.freeze(cups) });
}

/**
 * Return true when any body filter criterion is active.
 * @param {Record<string, any> | null | undefined} rawFilter
 * @returns {boolean}
 */
export function hasActiveBodyFilter(rawFilter) {
    const filter = normalizeBodyFilter(rawFilter);
    return filter.heightMin !== null
        || filter.heightMax !== null
        || filter.ageMin !== null
        || filter.ageMax !== null
        || filter.cups.length > 0;
}

/**
 * Build a reusable predicate matching measurements against a body filter.
 * @param {Record<string, any> | null | undefined} rawFilter
 * @returns {(measurements: Record<string, any> | null | undefined) => boolean}
 */
export function createBodyFilterMatcher(rawFilter) {
    const filter = normalizeBodyFilter(rawFilter);
    if (!hasActiveBodyFilter(filter)) return () => true;
    const cupSet = new Set(filter.cups);
    return (measurements) => {
        if (!measurements || typeof measurements !== "object") return false;
        const parsed = parseActressMeasurements(measurements);
        if (filter.heightMin !== null && (parsed.heightCm === null || parsed.heightCm < filter.heightMin)) return false;
        if (filter.heightMax !== null && (parsed.heightCm === null || parsed.heightCm > filter.heightMax)) return false;
        if (filter.ageMin !== null && (parsed.ageYears === null || parsed.ageYears < filter.ageMin)) return false;
        if (filter.ageMax !== null && (parsed.ageYears === null || parsed.ageYears > filter.ageMax)) return false;
        if (cupSet.size > 0) {
            if (!parsed.cup) return false;
            const bucket = parsed.cup >= "H" ? "H+" : parsed.cup;
            if (!cupSet.has(bucket)) return false;
        }
        return true;
    };
}

/**
 * Match one measurement record against a body filter.
 * @param {Record<string, any> | null | undefined} measurements
 * @param {Record<string, any> | null | undefined} filter
 * @returns {boolean}
 */
export function matchesBodyFilter(measurements, filter) {
    return createBodyFilterMatcher(filter)(measurements);
}

/**
 * @typedef {{ url: string, birthday: string, age: string, height: string, weight: string, threeSizeText: string, braSize: string, matchedName: string }} ActressProfileData
 */

/**
 * Whitelist the 8 display string fields and validate an http/https URL (dropping volatile fields like `fetchedAt`).
 * @param {unknown} profile
 * @returns {Readonly<ActressProfileData> | null}
 */
export function normalizeActressProfileData(profile) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
    const record = /** @type {Record<string, unknown>} */ (profile);
    if (typeof record.url !== "string") return null;
    const rawUrl = record.url.trim();
    if (!rawUrl) return null;
    /** @type {URL} */
    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return null;
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return null;
    const readStr = (/** @type {string} */ key) => (typeof record[key] === "string" ? record[key].trim() : "");
    return Object.freeze({
        url: parsedUrl.href,
        birthday: readStr("birthday"),
        age: readStr("age"),
        height: readStr("height"),
        weight: readStr("weight"),
        threeSizeText: readStr("threeSizeText"),
        braSize: readStr("braSize"),
        matchedName: readStr("matchedName"),
    });
}

/** @param {unknown} name */
export function normalizeActressLookupName(name) {
    const cleaned = cleanActressName(String(name ?? "").normalize("NFKC").replace(/_/g, " "), { stripBrackets: true });
    return cleaned === "三上悠亞" ? "三上悠亜" : cleaned;
}

/** @param {URL} url */
export function isJapaneseWikipediaArticle(url) {
    return url.origin === "https://ja.wikipedia.org" && !url.username && !url.password
        && !url.search && url.pathname.startsWith("/wiki/") && url.pathname.length > 6;
}

/** @param {Record<string, any> | null | undefined} actress */
export function readVerifiedActressProfile(actress) {
    const profile = normalizeActressProfileData(actress?.actressProfile);
    if (!profile || profile.url !== actress?.actressProfileVerifiedUrl || !isJapaneseWikipediaArticle(new URL(profile.url))) return null;
    const matchedName = normalizeActressLookupName(profile.matchedName);
    return collectActressLookupNames(actress.name, actress.allName).some(name => normalizeActressLookupName(name) === matchedName)
        ? profile : null;
}

/**
 * Deep-compare two actress profiles after normalization.
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function isSameActressProfile(left, right) {
    const a = normalizeActressProfileData(left);
    const b = normalizeActressProfileData(right);
    if (a === null || b === null) return a === b;
    return ACTRESS_PROFILE_FIELDS.every((field) => a[field] === b[field]);
}
