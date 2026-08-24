// @ts-check

import { normalizeMovieCarNum } from "../core/movie-identity.js";

export class MovieIdentityService {
    /** @param {unknown} value */
    normalize(value) { return normalizeMovieCarNum(value); }
    /** @param {...unknown} candidates */
    firstValid(...candidates) {
        for (const candidate of candidates) {
            const carNum = this.normalize(candidate);
            if (carNum) return carNum;
        }
        return null;
    }
}
