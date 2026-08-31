// @ts-check

const BLACKLIST_KEY = "blacklist";
const BLACKLIST_CAR_LIST_KEY = "blacklist_car_list";

/** Own blacklist persistence and invalidate legacy readers through the shared event bus. */
export class BlacklistRepository {
    /** @param {{storage: any, state?: any, eventBus?: any, mutation?: any}} dependencies */
    constructor(dependencies) {
        this.storage = dependencies.storage;
        this.state = dependencies.state;
        this.eventBus = dependencies.eventBus;
        this.mutation = dependencies.mutation;
        this.queue = Promise.resolve();
    }

    /** @param {string} key */
    async readArray(key) {
        const value = await this.storage?.get?.(key);
        return Array.isArray(value) ? value : [];
    }

    /** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
    runExclusive(operation) {
        if (this.mutation?.runExclusive) return this.mutation.runExclusive(operation);
        const run = this.queue.then(operation, operation);
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }

    async list() { return this.readArray(BLACKLIST_KEY); }
    async listCars() { return this.readArray(BLACKLIST_CAR_LIST_KEY); }

    /** @param {Record<string, any>} record */
    add(record) {
        return this.runExclusive(async () => {
            if (!record?.starId) throw new Error("缺失starId");
            if (!record?.name) throw new Error("缺失name");
            if (!record?.role) throw new Error("缺失role");
            const list = await this.list(), existing = list.find((item) => item.starId === record.starId);
            if (existing) Object.assign(existing, { url: record.url, role: record.role, movieType: record.movieType });
            else list.push({ starId: record.starId, name: record.name, allName: record.allName || [ record.name ], createTime: /** @type {any} */ (globalThis).utils?.getNowStr?.() ?? new Date().toISOString(), role: record.role, movieType: record.movieType, url: record.url });
            await this.storage.set(BLACKLIST_KEY, list);
            return { changed: !existing };
        }).then(async (result) => {
            await this.emitChanged({ changed: result.changed });
            return result;
        });
    }

    /** @param {string} starId */
    remove(starId) {
        return this.runExclusive(async () => {
            const [blacklist, cars] = await Promise.all([this.list(), this.listCars()]);
            const nextBlacklist = blacklist.filter((item) => item.starId !== starId), nextCars = cars.filter((item) => item.starId !== starId);
            if (nextBlacklist.length !== blacklist.length) await this.storage.set(BLACKLIST_KEY, nextBlacklist);
            if (nextCars.length !== cars.length) await this.storage.set(BLACKLIST_CAR_LIST_KEY, nextCars);
            return { changed: nextBlacklist.length !== blacklist.length || nextCars.length !== cars.length, removedCars: cars.filter((item) => item.starId === starId).map((item) => item.carNum) };
        }).then(async (result) => {
            if (!result.changed) return result;
            result.removedCars.length && await this.state?.removeFromNewVideoList?.(result.removedCars, "blacklist-removed");
            await this.emitChanged();
            return result;
        });
    }

    /** @param {Record<string, any>[]} records */
    saveCars(records) {
        return this.runExclusive(async () => {
            const existing = await this.listCars(), seen = new Set(existing.map((item) => item.carNum)), added = [];
            const next = [ ...existing ];
            for (const record of records || []) {
                if (!record?.carNum || seen.has(record.carNum)) continue;
                seen.add(record.carNum), next.push(record), added.push(record.carNum);
            }
            if (!added.length) return { changed: [] };
            await this.storage.set(BLACKLIST_CAR_LIST_KEY, next);
            return { changed: added };
        }).then(async (result) => {
            if (!result.changed.length) return result;
            await this.state?.removeFromNewVideoList?.(result.changed, "blacklist-car-removed");
            await this.emitChanged({ carNums: result.changed });
            return result;
        });
    }

    async emitChanged(payload = {}) {
        await this.eventBus?.emit?.("blacklist-rules-changed", payload);
    }
}
