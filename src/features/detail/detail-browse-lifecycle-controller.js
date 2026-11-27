// @ts-check

import { C, _ } from "../../core/constants.js";
import { isAbortError } from "../../core/jhs-error.js";
import { getMovieStateEligibility } from "../../core/movie-identity.js";

export class DetailBrowseLifecycleController {
    /** @param {{settings: {snapshot: () => Record<string, unknown>}, state: Pick<import("../../core/state-service.js").StateService,"removeFromNewVideoList">, scope: import("../../core/lifecycle-scope.js").LifecycleScope, onError?: (error: unknown) => void}} options */
    constructor(options) {
        this.settings = options.settings;
        this.state = options.state;
        this.scope = options.scope;
        this.onError = options.onError ?? null;
    }

    /** @param {{carNum?: string | null} | null} movieRef */
    async start(movieRef) {
        try {
            this.scope.assertActive();
            const enabled = this.settings.snapshot().autoRemoveNewVideoMarkAfterBrowse ?? C;
            if (enabled !== _) return false;
            const carNum = movieRef?.carNum;
            if (!carNum || !getMovieStateEligibility(movieRef).eligible) return false;
            await this.state.removeFromNewVideoList([carNum], "browse", { signal: this.scope.signal });
            return true;
        } catch (error) {
            if (this.scope.disposed && isAbortError(error)) return false;
            if (!this.onError) throw error;
            this.onError(error);
            return false;
        }
    }
}
