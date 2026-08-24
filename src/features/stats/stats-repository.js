// @ts-check

export class StatsRepository {
    /** @param {{storage: any, state: any}} dependencies */
    constructor(dependencies) { this.storage = dependencies.storage; this.state = dependencies.state; }

    async loadLibrarySnapshot() {
        const [cars, actresses, blacklist, activity] = await Promise.all([
            this.storage.getCarList(),
            this.storage.getFavoriteActressList(),
            this.storage.getBlacklist(),
            this.state.getActivityLog(),
        ]);
        return Object.freeze({ cars, actresses, blacklist, activity });
    }
}
