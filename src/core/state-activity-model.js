// @ts-check
import { normalizeCarNum } from "./constants.js";
import { assertMovieStateEligible } from "./movie-identity.js";

/** @typedef {Record<string, any>} StateRecord */

const ACTIVITY_SOFT_LIMIT = 1e3, ACTIVITY_HARD_LIMIT = 1e4, ACTIVITY_RETENTION_MS = 30 * 864e5;

/** @param {any} value @returns {any} */
export function cloneStateValue(value) {
    return null == value ? value : JSON.parse(JSON.stringify(value));
}

/** @param {any} value @returns {string | undefined} */
export function stableStateValue(value) {
    if (null === value || "object" != typeof value) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStateValue).join(",")}]`;
    return `{${Object.keys(value).sort().map((key => `${JSON.stringify(key)}:${stableStateValue(value[key])}`)).join(",")}}`;
}

/** @param {any} value @returns {Promise<string>} */
export async function hashState(value) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("当前环境不支持状态冲突归档哈希");
    const bytes = new TextEncoder().encode(stableStateValue(value));
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte => byte.toString(16).padStart(2, "0"))).join("");
}

/** @param {StateRecord} value @param {string} path @returns {any} */
export function getStatePath(value, path) {
    return path.split(".").reduce(((current, key) => current?.[key]), value);
}

/** @param {StateRecord} value @param {string} path @param {any} next */
export function setStatePath(value, path, next) {
    const keys = path.split("."), last = keys.pop(), target = keys.reduce(((current, key) => current[key] ||= {}), value);
    if (!last) return;
    void 0 === next ? delete target[last] : target[last] = cloneStateValue(next);
}

/** @param {Array<string | null>} values @returns {string[]} */
export function uniqueStateKeys(values) {
    return [ ...new Set(values.filter((/** @returns {value is string} */ value => "string" === typeof value && !!value))) ];
}

/** @param {string[]} keys @param {StateRecord} options */
export function assertStateMutationEligible(keys, options) {
    if (!keys.length) assertMovieStateEligible(null);
    keys.forEach(assertMovieStateEligible);
    if (options.record) assertMovieStateEligible({ carNum: keys[0], ...options.record });
    if (Array.isArray(options.records)) options.records.forEach(assertMovieStateEligible);
}

/** @param {unknown} value */
function effectActressIdentity(value) { return typeof value === "string" && value.trim() || typeof value === "number" && Number.isFinite(value) ? String(value) : null; }

/** Build once per locked snapshot; clone only the effects of the requested movies.
 * @param {StateRecord[]} actresses @param {StateRecord} decisions @param {Iterable<string>} targets */
export function createNewVideoEffectReader(actresses, decisions, targets) {
    const requested = new Set(targets);
    /** @type {Map<string | null, number>} */ const counts = new Map();
    for (const actress of actresses) { const id = effectActressIdentity(actress.starId); counts.set(id, (counts.get(id) || 0) + 1); }
    /** @type {Map<string, StateRecord[]>} */ const occurrences = new Map();
    actresses.forEach((actress, actressIndex) => (actress.newVideoList || []).forEach((/** @type {any} */ item, /** @type {number} */ itemIndex) => {
        const key = normalizeCarNum(typeof item === "string" ? item : item.carNum);
        if (!key || !requested.has(key)) return;
        const id = effectActressIdentity(actress.starId), entries = occurrences.get(key) || [];
        entries.push({ starId: id !== null && counts.get(id) === 1 ? actress.starId : null, actressIndex, itemIndex, item });
        occurrences.set(key, entries);
    }));
    return (/** @type {unknown} */ carNum) => {
        const key = /** @type {string} */ (normalizeCarNum(carNum));
        return { actressItems: (occurrences.get(key) || []).map(entry => ({ ...entry, item: cloneStateValue(entry.item) })), decision: cloneStateValue(decisions[key] || null) };
    };
}

/** @param {StateRecord[]} actresses @param {StateRecord} entry */
function findEffectActress(actresses, entry) {
    const id = effectActressIdentity(entry.starId);
    if (id === null) return null;
    const matches = actresses.filter((actress) => effectActressIdentity(actress.starId) === id);
    return matches.length === 1 ? matches[0] : null;
}

/** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {unknown} carNum @param {StateRecord} effect @param {StateRecord | null} [expectedDecision] */
export function canRestoreNewVideoEffect(actresses, decisions, carNum, effect, expectedDecision = null) {
    const key = /** @type {string} */ (normalizeCarNum(carNum));
    if (stableStateValue(decisions[key] || null) !== stableStateValue(expectedDecision)) return !1;
    return (/** @type {StateRecord[]} */ (effect.actressItems)).every((entry => {
        const actress = findEffectActress(actresses, entry);
        return actress != null && !(actress.newVideoList || []).some((/** @type {any} */ item) => normalizeCarNum("string" == typeof item ? item : item.carNum) === key);
    }));
}

/** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {unknown} carNum @param {StateRecord} effect */
export function restoreNewVideoEffect(actresses, decisions, carNum, effect) {
    (/** @type {StateRecord[]} */ (effect.actressItems)).forEach((entry => {
        const actress = findEffectActress(actresses, entry);
        if (!actress) return;
        const list = [ ...(actress.newVideoList || []) ], index = Math.min(entry.itemIndex, list.length);
        list.splice(index, 0, cloneStateValue(entry.item)), actress.newVideoList = list;
    }));
    const key = /** @type {string} */ (normalizeCarNum(carNum));
    effect.decision ? decisions[key] = cloneStateValue(effect.decision) : delete decisions[key];
}

/** @param {StateRecord | null | undefined} log @param {number} [now] @returns {StateRecord} */
export function pruneActivityLog(log, now = Date.now()) {
    const result = { entries: Array.isArray(log?.entries) ? log.entries : [], trackingStartedAt: log?.trackingStartedAt || new Date(now).toISOString(), coverageStart: log?.coverageStart || null, truncatedAt: log?.truncatedAt || null };
    const cutoff = now - ACTIVITY_RETENTION_MS;
    /** @type {StateRecord[]} */
    const recent = [];
    /** @type {StateRecord[]} */
    const older = [];
    result.entries.forEach((entry => (Date.parse(entry.createdAt) >= cutoff || "pending" === entry.commitState ? recent : older).push(entry)));
    older.sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id), "en"))), recent.sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id), "en")));
    const olderAllowance = Math.max(0, ACTIVITY_SOFT_LIMIT - recent.length);
    result.entries = [ ...older.slice(-olderAllowance), ...recent ].sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id), "en")));
    if (result.entries.length > ACTIVITY_HARD_LIMIT) {
        const pending = result.entries.filter((entry => "pending" === entry.commitState)), committed = result.entries.filter((entry => "pending" !== entry.commitState));
        const committedAllowance = Math.max(0, ACTIVITY_HARD_LIMIT - pending.length);
        result.entries = [ ...(committedAllowance ? committed.slice(-committedAllowance) : []), ...pending ].sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id), "en")));
        result.truncatedAt = new Date(now).toISOString(), result.coverageStart = result.entries[0]?.createdAt || result.truncatedAt;
    }
    return result;
}
