// @ts-check

import { A, D, escapeHtml, normalizeCarNum } from "./constants.js";
import { cleanActressName, isSameActressProfile, normalizeActressProfileData, readVerifiedActressProfile } from "./actress-measurements.js";
import { assertMovieStateEligible, getMovieStateEligibility } from "./movie-identity.js";
import { throwIfAborted } from "./jhs-error.js";
import { formatUiDateTime } from "./ui-date-time.js";

/** @typedef {Record<string, any>} Actress */
/** @typedef {import("../services/storage-service.js").StorageService} StorageService */
/** @typedef {{error?: Function, log?: Function, html?: Function}} Logger */

const ACTRESSES = "favorite_actresses";
const UNCENSORED_SUFFIX = "(無碼)";

/** Use the same comparison for legacy strings and newer queue records. @param {any} value @returns {string|undefined} */
function signature(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${signature(value[key])}`).join(",")}}`;
}

/** Carry existing legacy entries unchanged and drop runtime evidence from persisted records.
 * @param {any[]} records @param {any[]} previous */
function prepareNewVideos(records, previous) {
    const unchanged = previous.map(signature);
    return records.map(record => {
        if (!getMovieStateEligibility(record).eligible) {
            const index = unchanged.indexOf(signature(record));
            if (index < 0) assertMovieStateEligible(record);
            unchanged.splice(index, 1);
        }
        if (!record || typeof record !== "object") return record;
        const { stateEligibility: _evidence, ...saved } = record;
        return saved;
    });
}

/** @param {any} item */
const videoKey = item => normalizeCarNum(typeof item === "string" ? item : item?.carNum);
/** @param {any[]} scanned @param {any[]} previous @param {Record<string, any>} decisions @param {boolean} keepUnseen */
function mergeScan(scanned, previous, decisions, keepUnseen) {
    const entries = new Map(), queued = new Set(previous.map(videoKey));
    for (const item of scanned) {
        const key = videoKey(item);
        if (key && (decisions[key]?.action !== "dismissed" || queued.has(key))) entries.set(key, item);
    }
    for (const item of previous) {
        const retained = item?.retainedAfterRebind === true;
        if (!keepUnseen && !retained) continue;
        const key = videoKey(item);
        if (!key) continue;
        const fresh = entries.get(key);
        entries.set(key, fresh ? { ...(typeof item === "object" ? item : {}), ...fresh, ...(retained ? { retainedAfterRebind: true } : {}) } : item);
    }
    return [...entries.values()];
}

/** @param {any} value @returns {any[]} */
const list = value => Array.isArray(value) ? value : [];
/** @param {unknown} left @param {unknown} right */
const latestDate = (left, right) => [left, right].map(value => String(value || "").trim()).filter(Boolean).sort().at(-1) || "";

/** @param {unknown} left @param {unknown} right */
function mergeRemark(left, right) {
    const first = String(left || "").trim(), second = String(right || "").trim();
    if (!first) return second;
    if (!second || first.includes(second)) return first;
    if (second.includes(first)) return second;
    return `${first}；${second}`;
}

/** StateService holds the shared mutation lock for every write. */
export class FavoriteActressRepository {
    /** @param {Pick<StorageService, "get"|"set">} storage @param {Logger} [logger] @param {() => string} [clock] */
    constructor(storage, logger, clock = () => formatUiDateTime(new Date())) {
        this.storage = storage;
        this.logger = logger;
        this.clock = clock;
    }

    /** @returns {Promise<Actress[]>} */
    async read() { return list(await this.storage.get(ACTRESSES)); }

    /** @param {Actress[]} actresses */
    async add(actresses) {
        const current = await this.read();
        let changed = 0;
        for (const input of actresses) {
            const { starId, avatar, lastCheckTime, lastPublishTime } = input;
            if (!starId) throw new Error("缺失starId");
            if (!input.name) throw new Error("缺失name");
            const names = input.allName || [input.name];
            const actressType = input.actressType || (input.name.includes(UNCENSORED_SUFFIX) || names.some((/** @type {string} */ name) => name.includes(UNCENSORED_SUFFIX)) ? A : D);
            const name = input.name.replace(UNCENSORED_SUFFIX, "");
            const allName = names.map((/** @type {string} */ name) => name.replace(UNCENSORED_SUFFIX, ""));
            const existing = current.find(item => item.starId === starId);
            if (existing) {
                if (!existing.avatar?.includes("https") && avatar) {
                    existing.avatar = avatar;
                    this.logger?.html?.(`<span>补全演员头像: ${escapeHtml(name)}</span>`);
                    changed++;
                }
                if (!existing.actressType && actressType) {
                    existing.actressType = actressType;
                    this.logger?.html?.(`<span>补全演员类别: ${escapeHtml(name)} ${escapeHtml(actressType)}</span>`);
                    changed++;
                }
                if (existing.name?.includes(UNCENSORED_SUFFIX)) {
                    Object.assign(existing, { name, allName });
                    this.logger?.html?.(`<span>更正演员名字: ${escapeHtml(name)} ${escapeHtml(allName)}</span>`);
                    changed++;
                }
                continue;
            }
            const now = this.clock();
            current.push({ starId, name, allName, avatar, lastCheckTime, lastPublishTime, createDate: now, updateDate: now, actressType });
            this.logger?.html?.(`<span>同步JavDB已收藏的演员: ${escapeHtml(name)}</span>`);
            changed++;
        }
        if (changed) await this.storage.set(ACTRESSES, current);
        else this.logger?.log?.("信息已记录, 无需要进行同步收藏的演员");
        return changed;
    }

    /** @param {Actress} input @param {{scan?: boolean, keepUnseen?: boolean, signal?: AbortSignal}} [options] */
    async update(input, { scan = false, keepUnseen = false, signal } = {}) {
        throwIfAborted(signal);
        const { starId, newVideoList } = input;
        if (!starId) throw new Error("缺失starId");
        const current = await this.read(), existing = current.find(item => item.starId === starId);
        if (!existing) { this.logger?.error?.("未找到演员信息", starId, input.name); return false; }
        if ((scan || newVideoList != null) && !Array.isArray(newVideoList)) throw new TypeError("新作品列表必须为数组");
        const next = { ...existing };
        if (Object.hasOwn(input, "actressProfile")) {
            const profile = normalizeActressProfileData(input.actressProfile);
            if (profile) next.actressProfile = profile;
            else if (input.actressProfile === null) delete next.actressProfile;
            if (profile || input.actressProfile === null) delete next.actressProfileVerifiedUrl;
        }
        for (const field of ["name", "allName", "avatar", "lastCheckTime", "lastPublishTime", "remark"]) {
            if (input[field]) next[field] = input[field];
        }
        if (input.actressType != null) next.actressType = input.actressType;
        if (newVideoList) {
            const previous = list(existing.newVideoList);
            const videos = scan ? mergeScan(newVideoList, previous, await this.storage.get("new_video_decisions") || {}, keepUnseen) : newVideoList;
            next.newVideoList = prepareNewVideos(videos, previous);
        }
        next.updateDate = this.clock();
        throwIfAborted(signal);
        await this.storage.set(ACTRESSES, current.map(item => item === existing ? next : item));
        return true;
    }

    /** @param {Array<{starId: string, actressProfile: Actress}>} updates */
    async updateProfiles(updates) {
        const profiles = new Map();
        for (const entry of updates) {
            const starId = String(entry?.starId || "").trim(), profile = normalizeActressProfileData(entry?.actressProfile);
            if (starId && profile) profiles.set(starId, profile);
        }
        if (!profiles.size) return 0;
        const current = await this.read(), now = this.clock();
        let changed = 0;
        const next = current.map(actress => {
            const profile = profiles.get(String(actress?.starId || "").trim());
            if (!profile) return actress;
            const updated = { ...actress, actressProfile: profile, actressProfileVerifiedUrl: profile.url };
            if (!readVerifiedActressProfile(updated) || isSameActressProfile(readVerifiedActressProfile(actress), profile)) return actress;
            changed++;
            return { ...updated, updateDate: now };
        });
        if (changed) await this.storage.set(ACTRESSES, next);
        return changed;
    }

    /** @param {unknown} starId */
    async remove(starId) {
        const current = await this.read(), next = current.filter(item => item.starId !== starId);
        if (next.length === current.length) {
            this.logger?.error?.(`移除演员失败, ${starId} 不存在`);
            return false;
        }
        await this.storage.set(ACTRESSES, next);
        return true;
    }

    /** @param {Actress} payload */
    async rebind(payload) {
        const fromStarId = String(payload.fromStarId || "").trim(), toStarId = String(payload.toStarId || "").trim();
        if (!fromStarId || !toStarId) throw new Error("缺失starId");
        const name = cleanActressName(payload.name), names = list(payload.allName).map(name => cleanActressName(name)).filter(Boolean);
        if (fromStarId === toStarId) {
            const ok = await this.update({ starId: toStarId, name, allName: names.length ? names : undefined, avatar: payload.avatar, actressType: payload.actressType });
            const actress = ok ? (await this.read()).find(item => item.starId === toStarId) ?? null : null;
            return { ok, merged: false, actress };
        }
        const current = await this.read();
        const source = current.find(item => item.starId === fromStarId), target = current.find(item => item.starId === toStarId);
        if (!source) return { ok: false, merged: false, actress: null };
        const previous = [...list(target?.newVideoList), ...list(source.newVideoList)];
        const retained = new Set([...list(target?.newVideoList).filter(item => item?.retainedAfterRebind === true), ...list(source.newVideoList)].map(videoKey));
        const byCar = new Map();
        for (const item of previous) {
            const key = videoKey(item), existing = byCar.get(key);
            if (key && (!existing || (typeof existing === "string" && typeof item === "object"))) byCar.set(key, item);
        }
        const newVideoList = prepareNewVideos([...byCar.values()], previous).map(item => retained.has(videoKey(item))
            ? { ...(typeof item === "string" ? { carNum: item } : item), retainedAfterRebind: true }
            : item);
        const allName = [...new Set([name, ...names, target?.allName, target?.name, source.allName, source.name].flat().map(name => cleanActressName(name)).filter(Boolean))];
        const verifiedProfile = readVerifiedActressProfile(target) || readVerifiedActressProfile(source);
        const profile = verifiedProfile || normalizeActressProfileData(target?.actressProfile) || normalizeActressProfileData(source.actressProfile);
        /** @type {Actress} */
        const actress = {
            ...(target ?? source),
            starId: toStarId, name: name || target?.name || source.name,
            allName: allName.length ? allName : (target ?? source).allName,
            avatar: payload.avatar || target?.avatar || source.avatar,
            actressType: payload.actressType || target?.actressType || source.actressType,
            lastCheckTime: null, newVideoList, updateDate: this.clock(),
        };
        if (target) {
            actress.remark = mergeRemark(target.remark, source.remark);
            actress.lastPublishTime = latestDate(target.lastPublishTime, source.lastPublishTime) || target.lastPublishTime || source.lastPublishTime;
        }
        if (profile) actress.actressProfile = profile;
        else delete actress.actressProfile;
        if (verifiedProfile) actress.actressProfileVerifiedUrl = verifiedProfile.url;
        else delete actress.actressProfileVerifiedUrl;
        const next = target ? current.filter(item => item !== source).map(item => item === target ? actress : item)
            : current.map(item => item === source ? actress : item);
        await this.storage.set(ACTRESSES, next);
        return { ok: true, merged: Boolean(target), actress };
    }
}
