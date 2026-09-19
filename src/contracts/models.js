// @ts-check

export const ACTRESS_TYPE = Object.freeze({ censored: "censored", uncensored: "uncensored" });

/** @param {Record<string, unknown>} value */
export function defineMovieRef(value) {
    if (typeof value.carNum !== "string" || !value.carNum) throw new TypeError("MovieRef.carNum is required");
    return Object.freeze({ ...value });
}

/** @param {Record<string, unknown>} value */
export function defineMovieDetail(value) {
    if (typeof value.carNum !== "string" || !value.carNum) throw new TypeError("MovieDetail.carNum is required");
    return Object.freeze({ ...value });
}
