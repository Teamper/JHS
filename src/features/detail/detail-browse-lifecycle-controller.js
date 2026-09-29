// @ts-check

import { C, _ } from "../../core/constants.js";

export class DetailBrowseLifecycleController {
    /** @param {{settings: {snapshot: () => Record<string, unknown>}, state: {removeFromNewVideoList: (carNums: string[], reason: string) => Promise<unknown>}, scope: import("../../core/lifecycle-scope.js").LifecycleScope, onError?: (error: unknown) => void}} options */
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
            if (!carNum) return false;
            await this.state.removeFromNewVideoList([carNum], "browse");
            return true;
        } catch (error) {
            this.onError?.(error);
            return false;
        }
    }
}
