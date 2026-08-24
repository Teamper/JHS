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

export { normalizeMovieCarNum as normalizeCarNum };
