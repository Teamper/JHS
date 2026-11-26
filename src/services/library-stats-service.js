// @ts-check

import { countPendingNewVideos } from "../core/new-video-model.js";

/** Read-only statistics snapshot over the stable 6.5.1 storage contract. */
export class LibraryStatsService {
    /** @param {{state: any}} dependencies */
    constructor(dependencies) { this.state = dependencies.state; }

    async loadSnapshot() {
        const [cars, actresses, blacklist, activity] = await Promise.all([
            this.state.getCarList(),
            this.state.getFavoriteActressList(),
            this.state.getBlacklist(),
            this.state.getActivityLog(),
        ]);
        return Object.freeze({ cars, actresses, blacklist, activity });
    }

    async getPendingNewVideoTotal(now = Date.now()) {
        const [actresses, carMap, decisions] = await Promise.all([
            this.state.getFavoriteActressList(),
            this.state.getCarMap(),
            this.state.getNewVideoDecisions(),
        ]);
        return countPendingNewVideos(actresses, carMap, decisions, now);
    }
}
