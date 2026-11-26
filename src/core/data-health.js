// @ts-check

import { B, P } from "./constants.js";
import { dedupeByKey, groupDuplicateItems } from "./storage-index.js";
import { formatUiDateTime } from "./ui-date-time.js";

/** @typedef {Record<string, any>} Row */
/** @typedef {{type: string, message: string, count: number}} HealthIssue */
/** @typedef {Pick<import("../services/storage-service.js").StorageService, "get"|"set">} DataStore */

const KEYS = ["car_list", "favorite_actresses", "blacklist", "blacklist_car_list"];
/** @param {Pick<DataStore, "get">} storage @returns {Promise<Row[][]>} */
function readDomains(storage) {
    return Promise.all(KEYS.map(async key => {
        const value = await storage.get(key);
        return Array.isArray(value) ? value : [];
    }));
}
/** @param {any} work */
const carNum = work => typeof work === "string" ? work : work?.carNum;

/** @param {Pick<DataStore, "get">} storage */
export async function inspectDataHealth(storage) {
    const [cars, actresses, blacklist, blockedCars] = await readDomains(storage);
    const knownCars = new Set(cars.filter(item => item?.carNum).map(item => item.carNum));
    const blockedActors = new Set(blacklist.filter(item => item?.starId).map(item => item.starId));
    /** @type {HealthIssue[]} */ const fixable = [];
    /** @type {HealthIssue[]} */ const readonly = [];
    /** @param {HealthIssue[]} group @param {string} type @param {string} message @param {number} count */
    const record = (group, type, message, count) => { if (count) group.push({ type, message, count }); };
    record(fixable, "duplicate-car", "重复番号记录", groupDuplicateItems(cars, "carNum").length);
    record(fixable, "duplicate-actress", "重复收藏演员", groupDuplicateItems(actresses, "starId").length);
    record(fixable, "duplicate-blacklist", "重复黑名单演员", groupDuplicateItems(blacklist, "starId").length);
    record(fixable, "legacy-fields", "旧字段残留",
        cars.filter(item => item?.actress).length + blockedCars.filter(item => item?.actress).length
        + actresses.filter(item => item && Object.hasOwn(item, "dbId")).length
        + blacklist.filter(item => item && ("key" in item || "recordTime" in item || "isActor" in item)).length);
    const allActors = [...actresses, ...blacklist];
    record(fixable, "invalid-all-name", "演员别名不是数组", allActors.filter(item => item?.name && !Array.isArray(item.allName)).length);
    record(fixable, "stored-new-video", "新作品列表中已有鉴定记录", actresses.reduce((count, actress) =>
        count + (Array.isArray(actress?.newVideoList) ? actress.newVideoList.filter(work => knownCars.has(carNum(work))).length : 0), 0));
    record(readonly, "missing-url", "影片链接缺失，请确认来源", cars.filter(item => item?.carNum && !item.url).length);
    record(readonly, "missing-star-id", "演员信息缺失，请确认身份", allActors.filter(item => item && !item.starId).length);
    record(readonly, "orphan-blacklist-car", "黑名单影片找不到关联演员", blockedCars.filter(item => item?.starId && !blockedActors.has(item.starId)).length);
    return {
        checkedAt: formatUiDateTime(new Date()),
        totals: { carList: cars.length, favoriteActresses: actresses.length, blacklist: blacklist.length, blacklistCarList: blockedCars.length },
        fixable, readonly,
    };
}

/** The backup service owns the mutation lock and version check. @param {DataStore} storage */
export async function repairDataHealth(storage) {
    const [cars, actresses, blacklist, blockedCars] = await readDomains(storage);
    const uniqueCars = dedupeByKey(cars, "carNum"), uniqueActresses = dedupeByKey(actresses, "starId"), uniqueBlacklist = dedupeByKey(blacklist, "starId");
    let fixedGroups = Number(uniqueCars.changed) + Number(uniqueActresses.changed) + Number(uniqueBlacklist.changed);
    /** @param {Row} movie @param {boolean} [blocked] */
    const normalizeMovie = (movie, blocked = false) => {
        if (!movie) return movie;
        const legacyTitle = movie.actress !== undefined, legacyType = blocked && Object.hasOwn(movie, "type");
        if (!legacyTitle && !legacyType) return movie;
        const next = { ...movie };
        if (legacyTitle) { next.names = next.actress; delete next.actress; }
        if (legacyType) delete next.type;
        fixedGroups++;
        return next;
    };
    const nextCars = uniqueCars.list.map(item => normalizeMovie(item));
    const nextBlockedCars = blockedCars.map(item => normalizeMovie(item, true));
    const knownCars = new Set(nextCars.filter(item => item?.carNum).map(item => item.carNum));
    /** @param {Row} actor @param {boolean} blocked */
    const normalizeActor = (actor, blocked) => {
        if (!actor) return actor;
        const next = { ...actor };
        const invalidAliases = next.name && !Array.isArray(next.allName);
        const retired = blocked ? ["isActor", "recordTime", "key"].filter(key => Object.hasOwn(next, key)) : ["dbId"].filter(key => Object.hasOwn(next, key));
        if (retired.includes("isActor")) next.role ||= next.isActor ? B : P;
        if (retired.includes("recordTime")) next.createTime ||= next.recordTime;
        if (retired.includes("dbId")) next.starId ||= next.dbId;
        for (const key of retired) delete next[key];
        if (invalidAliases) next.allName = [next.allName || next.name];
        if (retired.length || invalidAliases) fixedGroups++;
        if (!blocked && Array.isArray(next.newVideoList)) {
            const queue = next.newVideoList.filter(item => !knownCars.has(carNum(item)));
            if (queue.length !== next.newVideoList.length) {
                next.newVideoList = queue;
                fixedGroups++;
            }
        }
        return next;
    };
    const repaired = [nextCars, uniqueActresses.list.map(item => normalizeActor(item, false)),
        uniqueBlacklist.list.map(item => normalizeActor(item, true)), nextBlockedCars];
    for (const [index, key] of KEYS.entries()) await storage.set(key, repaired[index]);
    return { fixedGroups, report: await inspectDataHealth(storage) };
}
