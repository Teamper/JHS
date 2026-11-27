// @ts-check

import { escapeHtml, normalizeCarNum } from "./constants.js";
import { assertMovieStateEligible } from "./movie-identity.js";
import { legacyActionToFlag } from "./state-model.js";

/** @typedef {Record<string, any>} RecordData */
/** @typedef {Pick<import("../services/storage-service.js").StorageService, "get"|"set">} DataStore */
/** @typedef {{key: string, before: RecordData[], after: RecordData[]}} Change */

const ACTORS = "blacklist", MOVIES = "blacklist_car_list", FAVORITES = "favorite_actresses";

/** StateService holds the mutation lock for all writes. */
export class BlacklistRepository {
    /** @param {DataStore} storage @param {{now: () => string, origin: () => string, logger?: {log?: Function, warn?: Function, html?: Function}, notifications?: {error?: Function}}} options */
    constructor(storage, { now, origin, logger, notifications }) {
        this.storage = storage;
        this.now = now;
        this.origin = origin;
        this.logger = logger;
        this.notifications = notifications;
    }

    /** @param {string} key @returns {Promise<RecordData[]>} */
    async readList(key) {
        const value = await this.storage.get(key);
        return Array.isArray(value) ? value : [];
    }

    readActors() { return this.readList(ACTORS); }
    readMovies() { return this.readList(MOVIES); }

    /** @param {RecordData} input */
    async addActor(input) {
        const { starId, name, allName, role, movieType, url } = input;
        if (!starId) throw new Error("缺失starId");
        if (!name) throw new Error("缺失name");
        if (!role) throw new Error("缺失role");
        const actors = await this.readActors(), actor = actors.find(item => item.starId === starId);
        if (actor) {
            Object.assign(actor, { url, role, movieType });
            this.logger?.log?.("更新黑名单演员信息", actor);
        } else {
            const added = { starId, name, allName: allName || [name], createTime: this.now(), role, movieType, url };
            actors.push(added);
            this.logger?.log?.("增加黑名单演员信息", added);
        }
        await this.storage.set(ACTORS, actors);
    }

    /** @param {RecordData} input */
    async updateActor(input) {
        if (!input?.starId) throw new Error("参数不全");
        const actors = await this.readActors(), actor = actors.find(item => item.starId === input.starId);
        if (!actor) throw new Error(`未找到黑名单演员信息:${input.name} ${input.starId}`);
        if (input.checkTime) actor.checkTime = input.checkTime;
        if (input.lastPublishTime) actor.lastPublishTime = input.lastPublishTime;
        await this.storage.set(ACTORS, actors);
    }

    /** @param {RecordData} input @param {string} carNum */
    buildMovie(input, carNum) {
        const { url, names, actionType, publishTime, starId } = input;
        if (!url) {
            this.notifications?.error?.("请输入链接");
            throw new Error("url为空!");
        }
        if (!legacyActionToFlag(actionType)) {
            this.notifications?.error?.("操作无法完成，请反馈给作者");
            throw new Error("actionType错误, 请联系作者更正: " + actionType);
        }
        const now = this.now();
        return {
            carNum, url: url.includes("http") ? url : this.origin() + url,
            names: names && names.trim(), status: actionType, createDate: now, updateDate: now, publishTime,
            ...(starId ? { starId } : {}),
        };
    }

    /** @param {RecordData[]} inputs */
    async addMovies(inputs) {
        inputs.forEach(assertMovieStateEligible);
        const actors = await this.readActors();
        const excluded = new Map(actors.map(actor => [actor.starId, new Set(actor.excludedCarNums || [])]));
        const movies = await this.readMovies(), known = new Set(movies.map(item => normalizeCarNum(item.carNum)));
        const added = [];
        for (const input of inputs) {
            const carNum = normalizeCarNum(input.carNum);
            if (!carNum) throw new Error("番号无效");
            if (known.has(carNum) || excluded.get(input.starId)?.has(carNum)) continue;
            added.push(this.buildMovie(input, carNum));
            known.add(carNum);
        }
        if (!added.length) return { changed: [], removedNewVideos: [] };

        const changed = added.map(item => item.carNum), targets = new Set(changed), removedNewVideos = new Set();
        const actresses = await this.readList(FAVORITES);
        const nextActresses = actresses.map(actress => {
            if (!Array.isArray(actress.newVideoList)) return actress;
            const newVideoList = actress.newVideoList.filter(item => {
                const key = normalizeCarNum(typeof item === "string" ? item : item?.carNum);
                if (!key || !targets.has(key)) return true;
                removedNewVideos.add(key);
                return false;
            });
            return { ...actress, newVideoList };
        });
        const changes = [{ key: MOVIES, before: movies, after: [...movies, ...added] }];
        if (removedNewVideos.size) changes.push({ key: FAVORITES, before: actresses, after: nextActresses });
        await this.persist(changes, "批量屏蔽失败且自动回滚不完整");
        for (const movie of added) {
            try { this.logger?.html?.(`屏蔽演员番号: <span>${escapeHtml(movie.names)} ${escapeHtml(movie.carNum)}</span>`); }
            catch (error) {
                try { this.logger?.warn?.("屏蔽记录已保存，但操作提示显示失败", error); }
                catch { /* The writes have committed. */ }
            }
        }
        return { changed, removedNewVideos: [...removedNewVideos] };
    }

    /** @param {string} starId */
    async removeActor(starId) { return this.removeActors([starId]); }

    /** @param {string[]} ids */
    async removeActors(ids) {
        const targets = new Set(ids);
        const [actors, movies] = await Promise.all([this.readActors(), this.readMovies()]);
        const nextActors = actors.filter(item => !targets.has(item.starId)), nextMovies = movies.filter(item => !targets.has(item.starId));
        const removedCarRecords = movies.length - nextMovies.length, removedActor = actors.length !== nextActors.length;
        const changes = [];
        if (removedCarRecords) changes.push({ key: MOVIES, before: movies, after: nextMovies });
        if (removedActor) changes.push({ key: ACTORS, before: actors, after: nextActors });
        await this.persist(changes, "移除黑名单失败且自动回滚不完整");
        return { removedActor, removedCarRecords };
    }

    /** @param {string} starId @param {string} carNum */
    async removeMovie(starId, carNum) {
        const [actors, movies] = await Promise.all([this.readActors(), this.readMovies()]);
        const after = movies.filter(movie => movie.starId !== starId || movie.carNum !== carNum);
        if (after.length === movies.length) return false;
        const nextActors = actors.map(actor => actor.starId === starId
            ? { ...actor, excludedCarNums: [...new Set([...(actor.excludedCarNums || []), carNum])] } : actor);
        await this.persist([{ key: MOVIES, before: movies, after }, { key: ACTORS, before: actors, after: nextActors }], "解除番号屏蔽失败");
        return true;
    }

    /** Retain the original blobs for a storage failure after partial persistence.
     * @param {Change[]} changes @param {string} message */
    async persist(changes, message) {
        const attempted = [];
        try {
            for (const change of changes) {
                attempted.push(change);
                await this.storage.set(change.key, change.after);
            }
        } catch (error) {
            const rollbackErrors = [];
            for (const change of attempted.reverse()) {
                try { await this.storage.set(change.key, change.before); }
                catch (rollbackError) { rollbackErrors.push(rollbackError); }
            }
            if (rollbackErrors.length) throw Object.assign(new Error(message, { cause: error }), { rollbackErrors });
            throw error;
        }
    }
}
