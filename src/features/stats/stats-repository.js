// @ts-check

import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";

/**
 * 全库统计的冻结语义：
 * - total 包含屏蔽记录；blocked 为手动屏蔽数；unblocked = total - blocked。
 * - 收藏/下载/已看均区分 raw（含屏蔽）与 effective（未屏蔽）；状态率一律使用
 *   effective / unblocked，屏蔽记录不得进入状态 numerator。
 * - pending = 无任何状态（无状态即未鉴定；屏蔽本身是一种状态，天然排除）。
 * @param {Array<Record<string, any>>} cars
 */
export function computeLibraryStats(cars) {
    let total = 0, blocked = 0, favoriteRaw = 0, favoriteEffective = 0,
        downloadedRaw = 0, downloadedEffective = 0, watchedRaw = 0, watchedEffective = 0, pending = 0;
    for (const car of cars ?? []) {
        const flags = normalizeStateFlags(car?.stateFlags);
        total++;
        const isBlocked = flags.blocked === true;
        isBlocked && blocked++;
        const unblocked = !isBlocked;
        if (flags.favorite) { favoriteRaw++; unblocked && favoriteEffective++; }
        if (flags.downloaded) { downloadedRaw++; unblocked && downloadedEffective++; }
        if (flags.watched) { watchedRaw++; unblocked && watchedEffective++; }
        !hasAnyState(flags) && pending++;
    }
    const unblocked = total - blocked;
    return Object.freeze({
        total, blocked, unblocked,
        favoriteRaw, favoriteEffective,
        downloadedRaw, downloadedEffective,
        watchedRaw, watchedEffective,
        pending,
    });
}

export class StatsRepository {
    /** @param {{storage: any, state: any}} dependencies */
    constructor(dependencies) { this.storage = dependencies.storage; this.state = dependencies.state; }

    async loadLibrarySnapshot() {
        /** @param {string} method @param {string} key */
        const read = (method, key) => typeof this.storage?.[method] === "function" ? this.storage[method]() : this.storage?.get?.(key);
        const [cars, actresses, blacklist, activity] = await Promise.all([
            read("getCarList", "car_list"),
            read("getFavoriteActressList", "favorite_actresses"),
            read("getBlacklist", "blacklist"),
            this.state.getActivityLog(),
        ]);
        return Object.freeze({
            cars: Array.isArray(cars) ? cars : [],
            actresses: Array.isArray(actresses) ? actresses : [],
            blacklist: Array.isArray(blacklist) ? blacklist : [],
            activity: activity && typeof activity === "object" ? activity : { entries: [] },
        });
    }
}
