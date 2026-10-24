// @ts-check

const SIMPLE_CAR_PREFIXES = new Set(["ABC", "ABP", "ADN", "ATID", "BF", "CAWD", "DLDSS", "DVAJ", "FSDSS", "HEYZO", "HMN", "IPX", "IPZZ", "JUQ", "JUL", "JUX", "MEYD", "MIAA", "MIDE", "MIDV", "MIMK", "MIRD", "NIMA", "PRED", "RBD", "SDDE", "SONE", "SSIS", "SSNI", "STARS", "URE", "VEC", "WAAA", "WANZ", "XVSR"]);

/** @param {unknown} value */
export function normalizeMovieCarNum(value) {
    if (typeof value !== "string") return null;
    let carNum = value.trim();
    if (!carNum || ["undefined", "null"].includes(carNum.toLowerCase())) return null;
    carNum = carNum.normalize("NFKC").replace(/[‐‑‒–—―﹘﹣－]/g, "-").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();
    const match = carNum.match(/^([A-Z]{2,8})(\d{2,7})$/);
    return match && SIMPLE_CAR_PREFIXES.has(match[1]) ? `${match[1]}-${match[2]}` : carNum || null;
}

/** @typedef {{eligible: boolean, reason: null | "missing" | "label-only" | "prefix-only" | "conflicting"}} MovieStateEligibility */

/** Runtime evidence only; this does not change legacy normalization or stored identities. @param {any} value @returns {MovieStateEligibility} */
export function getMovieStateEligibility(value) {
    const carNum = normalizeMovieCarNum(typeof value === "string" ? value : value?.carNum);
    if (!carNum || /^(?:N\/?A|NONE|UNKNOWN|UNDEFINED|NULL|未知|暂无|无|[-?]+)$/i.test(carNum)) return { eligible: false, reason: "missing" };
    if (SIMPLE_CAR_PREFIXES.has(carNum) || /^FC2(?:-?PPV)?$/.test(carNum)) return { eligible: false, reason: "prefix-only" };
    if (!/\d/.test(carNum)) return { eligible: false, reason: "label-only" };
    if (value?.stateEligibility?.eligible === false) {
        const reason = value.stateEligibility.reason;
        return { eligible: false, reason: ["missing", "label-only", "prefix-only", "conflicting"].includes(reason) ? reason : "conflicting" };
    }
    return { eligible: true, reason: null };
}

/** @param {any} value @returns {MovieStateEligibility} */
export function assertMovieStateEligible(value) {
    const eligibility = getMovieStateEligibility(value);
    if (!eligibility.eligible) throw Object.assign(new Error(eligibility.reason === "conflicting" ? "影片番号信息存在冲突，暂不能更改状态" : "影片番号不完整，暂不能更改状态"), { code: "UNRELIABLE_MOVIE_IDENTITY" });
    return eligibility;
}

/** Extracts an id only from an explicit JavDB-style detail path. */
export function extractJavDbMovieId(/** @type {unknown} */ value, /** @type {string} */ baseUrl = "https://javdb.com") {
    try { return new URL(String(value || ""), baseUrl).pathname.match(/^\/v\/([^/]+)\/?$/)?.[1] || null; } catch { return null; }
}

export { normalizeMovieCarNum as normalizeCarNum };
