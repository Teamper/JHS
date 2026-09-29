// @ts-check

import { countPendingNewVideos } from "../core/new-video-model.js";

/** Read-only statistics snapshot over the stable 6.5.1 storage contract. */
export class LibraryStatsService {
    /** @param {{storage: any, state: any}} dependencies */
    constructor(dependencies) { this.storage = dependencies.storage; this.state = dependencies.state; }

    async loadSnapshot() {
        const [cars, actresses, blacklist, activity] = await Promise.all([
            this.storage.getCarList(),
            this.storage.getFavoriteActressList(),
            this.storage.getBlacklist(),
            this.state.getActivityLog(),
        ]);
        return Object.freeze({ cars, actresses, blacklist, activity });
    }

    async getPendingNewVideoTotal(now = Date.now()) {
        const [actresses, carMap, decisions] = await Promise.all([
            this.storage.getFavoriteActressList(),
            this.state.getCarMap(),
            this.state.getNewVideoDecisions(),
        ]);
        return countPendingNewVideos(actresses, carMap, decisions, now);
    }
}
