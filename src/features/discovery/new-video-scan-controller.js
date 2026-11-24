// @ts-check

import { isMissingActorSource } from "./actor-source-health.js";
import { collectActressLookupNames, isSameActressProfile, normalizeActressProfileData, readVerifiedActressProfile } from "../../core/actress-measurements.js";
import { CACHE_TTL } from "../../core/cache-policy.js";
import { PROFILE_BACKFILL_LOCK_KEY, isNetworkBlockedError, selectLatestPublishTime, shouldSkipStopped } from "../../core/feature-helpers.js";
import { isAbortError, isTransientBlockError } from "../../core/jhs-error.js";
import { getMovieStateEligibility, normalizeMovieCarNum } from "../../core/movie-identity.js";

const PROFILE_ATTEMPTS_KEY = "jhs_actress_profile_attempts_v1";
const PROFILE_ATTEMPTS_SCHEMA = 3;

/** @param {unknown} [cause] */
function createScanAbortError(cause) {
    return Object.assign(new Error("New-video scan is closed"), { name: "AbortError", code: "ABORTED", cause });
}

/** @param {number} ms @param {AbortSignal | undefined} signal */
function sleepAbortable(ms, signal) {
    if (signal?.aborted) return Promise.reject(createScanAbortError(signal.reason));
    if (!(ms > 0)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(createScanAbortError(signal?.reason));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener?.("abort", onAbort);
            resolve(undefined);
        }, ms);
        signal?.addEventListener?.("abort", onAbort, { once: true });
    });
}

/** Converts discovered actor titles into the existing 6.5.1 actress record shape. */
export class NewVideoScanController {
    /** @param {{state: any, titleKeywords?: any, actressInfo?: any, scope?: any, logger?: any, getTimestamp: () => string, backgroundWork?: any, sourceHealth?: any, storage?: any, events?: any, jquery?: ((selector: any) => any) | null, window?: (Window & typeof globalThis) | null, preserveNewVideo?: boolean, onNewItems: (name: string, count: number) => void}} options */
    constructor(options) {
        this.state = options.state;
        this.titleKeywords = options.titleKeywords;
        this.actressInfo = options.actressInfo;
        this.scope = options.scope;
        this.backgroundWork = options.backgroundWork;
        this.preserveNewVideo = options.preserveNewVideo === true;
        this.sourceHealth = options.sourceHealth;
        this.storage = options.storage ?? null;
        this.events = options.events ?? null;
        this.jquery = options.jquery ?? null;
        this.window = options.window ?? null;
        this.logger = options.logger;
        this.getTimestamp = options.getTimestamp;
        this.onNewItems = options.onNewItems;
        this.disposed = false;
        /** @type {Set<() => void>} */ this.visibilityWaits = new Set();
        /** @type {Map<string, number>} */ this.fallbackProfileAttempts = new Map();
        /** @type {Map<string, number>} */ this.profileAttemptEpochs = new Map();
    }

    /** Fetch and persist one actor's manual scan through the same feature-owned write path. */
    /** @param {{starId: string, name: string}} actress @param {{baseUrl: string, onActorStart?: (actress: any, url: string) => void}} options */
    async scanActress(actress, options) {
        this.assertActive();
        const { starId, name } = actress, url = `${options.baseUrl}/actors/${starId}?t=d`;
        const [titleKeywords, blacklistCars] = await Promise.all([
            this.titleKeywords.getAll(), this.state.getBlacklistCarList(),
        ]);
        this.assertActive();
        const blacklistSet = new Set(blacklistCars.map((/** @type {any} */ item) => item.carNum));
        options.onActorStart?.(actress, url);
        try {
            const movies = await this.actressInfo.movies("javdb", { actorId: starId, baseUrl: options.baseUrl }, { scope: this.scope, ttlMs: 0 });
            this.assertActive();
            const result = await this.parseActorMovies(movies, starId, name, titleKeywords, blacklistSet);
            this.sourceHealth?.clear(options.baseUrl, starId);
            return result;
        } catch (error) {
            if (isMissingActorSource(error)) this.sourceHealth?.unavailable(options.baseUrl, actress);
            throw error;
        }
    }

    /** Fetch every saved-actress page and persist only after pagination validates completely. */
    /** @param {{baseUrl: string, startUrl: string, onPage?: (url: string, page: number) => void}} options */
    async syncFavoriteActresses(options) {
        this.assertActive();
        const expected = new URL("/users/collection_actors", options.baseUrl);
        /** @type {URL | null} */
        let currentUrl = new URL(options.startUrl, options.baseUrl);
        const visitedUrls = new Set();
        /** @type {any[]} */
        const actors = [];
        let pages = 0;

        while (currentUrl) {
            this.assertActive();
            if (currentUrl.origin !== expected.origin || currentUrl.pathname !== expected.pathname) {
                throw markCollectionParseError(new Error(`收藏演员分页地址越界: ${currentUrl.href}`));
            }
            if (visitedUrls.has(currentUrl.href)) {
                throw markCollectionParseError(new Error(`收藏演员分页循环: ${currentUrl.href}`));
            }
            if (pages >= 200) throw markCollectionParseError(new Error("收藏演员分页超过 200 页"));

            /** @type {string} */
            const pageUrl = currentUrl.href;
            visitedUrls.add(pageUrl);
            pages++;
            this.logger?.log?.(`正在抓取页面: ${pageUrl}`);
            options.onPage?.(pageUrl, pages);

            let parsed;
            try {
                parsed = await this.actressInfo.collection("javdb", { baseUrl: options.baseUrl, pageUrl }, { scope: this.scope });
                this.assertActive();
                if (parsed?.state !== "valid" || !Array.isArray(parsed.actors)) {
                    throw markCollectionParseError(new Error(`收藏演员页面无效: ${parsed?.state ?? "invalid"}`));
                }
                if (parsed.isEmpty && parsed.nextUrl) {
                    throw markCollectionParseError(new Error("收藏演员空页面包含下一页"));
                }
            } catch (error) {
                if (this.disposed || /** @type {any} */ (error)?.name === "AbortError") throw error;
                const taskError = markCollectionError(error);
                this.logger?.error?.(`抓取 ${pageUrl} 时发生错误，停止本轮同步:`, taskError);
                throw taskError;
            }

            actors.push(...parsed.actors);
            try {
                currentUrl = parsed.nextUrl ? new URL(parsed.nextUrl, pageUrl) : null;
            } catch (error) {
                throw markCollectionParseError(error);
            }
        }

        this.assertActive();
        if (actors.length) await this.state.addFavoriteActressList(actors);
        return { actors, pages };
    }

    /** Run the feature-owned actor scan while preserving the legacy scheduler result contract. */
    /** @param {{baseUrl: string, concurrency: number, sleepMs: number, intervalHours: number, ruleHours: number, force: boolean, isUnnecessaryCheck: (date: string, interval: number) => boolean, isNetworkBlocked: (error: unknown) => boolean, sleep: (ms: number) => Promise<unknown>, onActorStart?: (actress: any, url: string) => void}} options */
    async scanActresses(options) {
        this.assertActive();
        const actresses = await this.state.getFavoriteActressList();
        this.assertActive();
        const sorted = sortActresses(actresses), result = {
            actressCount: sorted.length, eligibleCount: 0, success: 0, parseFailed: 0,
            networkFailed: 0, unavailable: 0, skippedUnavailable: 0, aborted: 0, skippedInterval: 0, skippedStopped: 0, fatal: false,
        };
        /** @type {any[]} */
        const eligible = [];
        for (const actress of sorted) {
            if (!options.force && this.sourceHealth?.isDeferred(options.baseUrl, actress.starId)) result.skippedUnavailable++;
            else if (!options.force && actress.lastCheckTime && options.isUnnecessaryCheck(actress.lastCheckTime, options.intervalHours)) result.skippedInterval++;
            else if (shouldSkipStopped(actress.lastPublishTime, options.ruleHours)) result.skippedStopped++;
            else eligible.push(actress);
        }
        result.eligibleCount = eligible.length;
        this.logger?.html?.(`<span class="jhs-task-emphasis">检测最新作品, 总任务数: ${eligible.length}, 并发限制:${options.concurrency}, 请求间隔时间:${options.sleepMs}ms</span>`);
        if (!eligible.length) return { ...result, blockedError: null };

        const [titleKeywords, blacklistCars] = await Promise.all([
            this.titleKeywords.getAll(), this.state.getBlacklistCarList(),
        ]);
        this.assertActive();
        const blacklistSet = new Set(blacklistCars.map((/** @type {any} */ item) => item.carNum));
        let nextIndex = 0, stopWorkers = false, blockedError = null;
        const workerCount = Math.max(1, Math.min(options.concurrency, eligible.length));
        const workers = Array.from({ length: workerCount }, async () => {
            while (!stopWorkers && !this.disposed) {
                const index = nextIndex++;
                if (index >= eligible.length) return;
                if (!options.force) { await this.waitForVisible(); await this.backgroundWork?.waitForTurn({ signal: this.scope.signal }); }
                this.assertActive();
                const actress = eligible[index], { name, starId } = actress, url = `${options.baseUrl}/actors/${starId}?t=d`;
                let movies;
                try {
                    this.assertActive();
                    options.onActorStart?.(actress, url);
                    movies = await this.actressInfo.movies("javdb", { actorId: starId, baseUrl: options.baseUrl }, { scope: this.scope, ttlMs: 0 });
                    this.assertActive();
                } catch (error) {
                    const taskError = /** @type {any} */ (error);
                    if (this.disposed || taskError?.name === "AbortError") throw error;
                    if (options.isNetworkBlocked(taskError)) {
                        result.networkFailed++;
                        stopWorkers = true;
                        throw error;
                    }
                    if (isMissingActorSource(taskError)) {
                        this.sourceHealth?.unavailable(options.baseUrl, actress);
                        result.unavailable++;
                    } else result.networkFailed++;
                    this.logger?.error?.("检测演员来源失败:", url, error);
                    if (eligible.length - nextIndex > 0) await options.sleep(options.sleepMs);
                    continue;
                }
                try {
                    await this.parseActorMovies(movies, starId, name, titleKeywords, blacklistSet);
                    this.sourceHealth?.clear(options.baseUrl, starId);
                    result.success++;
                } catch (error) {
                    const taskError = /** @type {any} */ (error);
                    if (this.disposed || taskError?.name === "AbortError") throw error;
                    result.parseFailed++;
                    this.logger?.error?.("解析或保存演员作品失败:", url, error);
                }
                if (eligible.length - nextIndex > 0) await options.sleep(options.sleepMs);
            }
            this.assertActive();
        });
        const settled = await Promise.allSettled(workers);
        const failure = settled.find((item) => item.status === "rejected");
        if (failure?.status === "rejected") {
            if (!options.isNetworkBlocked(failure.reason)) throw failure.reason;
            blockedError = failure.reason;
            result.fatal = true;
            result.aborted = Math.max(0, eligible.length - result.success - result.parseFailed - result.networkFailed);
            this.logger?.warn?.(`网络阻断，本轮停止，未执行 ${result.aborted}`);
        }
        this.assertActive();
        return { ...result, blockedError };
    }

    /** @param {any[]} items @param {string} starId @param {string} name @param {string[]} titleKeywords @param {Set<string>} blacklistSet */
    async parseActorMovies(items, starId, name, titleKeywords, blacklistSet) {
        this.assertActive();
        if (items.some(item => !getMovieStateEligibility(item).eligible)) throw Object.assign(new Error("部分影片番号无法确认，本次未更新检测结果"), { code: "INCOMPLETE_MOVIE_IDENTITY" });
        if (!items.length) {
            const saved = await this.state.updateFavoriteActress({ starId, lastCheckTime: this.getTimestamp(), newVideoList: [] }, { scan: true });
            if (saved === false) throw new Error("演员记录已不存在");
            return 0;
        }

        const publishTimes = items.map((item) => item.publishTime).filter(Boolean);
        const candidates = items.filter((item) => {
            if (!item.carNum || blacklistSet.has(item.carNum)) return false;
            return !titleKeywords.some((keyword) => item.title?.includes(keyword) || item.carNum.includes(keyword));
        }).map((item) => ({
            carNum: item.carNum, coverUrl: item.coverUrl || "", title: item.title || "", publishTime: item.publishTime || "",
            score: Number(item.score) || 0, voteCount: Number(item.voteCount) || 0, url: item.url || "",
        }));
        const [carMap, decisions, actresses] = await Promise.all([
            this.state.getCarMap(), this.state.getNewVideoDecisions(),
            this.preserveNewVideo ? this.state.getFavoriteActressList() : [],
        ]);
        this.assertActive();
        const previous = actresses.find((/** @type {any} */ actress) => actress.starId === starId);
        const queued = new Set((previous?.newVideoList || []).map((/** @type {any} */ entry) =>
            normalizeMovieCarNum(typeof entry === "string" ? entry : entry.carNum)));
        const freshItems = candidates.filter((item) => !carMap.has(item.carNum) || queued.has(normalizeMovieCarNum(item.carNum)));
        const fresh = freshItems.filter((item) => !carMap.has(item.carNum) && decisions[item.carNum]?.action !== "dismissed");
        const saved = await this.state.updateFavoriteActress({
            starId, lastCheckTime: this.getTimestamp(), newVideoList: freshItems,
            lastPublishTime: selectLatestPublishTime(publishTimes),
        }, { scan: true });
        if (saved === false) throw new Error("演员记录已不存在");
        if (!this.disposed && fresh.length) {
            try { this.onNewItems(name, fresh.length); }
            catch (error) {
                try { this.logger?.warn?.("新作品扫描结果已保存，但提示通知失败", error); }
                catch { /* 已保存的扫描结果不受诊断输出影响。 */ }
            }
        }
        return fresh.length;
    }

    /** @returns {Map<string, number>} */
    readProfileAttempts() {
        if (typeof this.storage?.getLocal !== "function") return new Map(this.fallbackProfileAttempts);
        try {
            const raw = this.storage.getLocal(PROFILE_ATTEMPTS_KEY);
            if (!raw) return new Map();
            const parsed = JSON.parse(raw);
            if (parsed?.schema !== PROFILE_ATTEMPTS_SCHEMA || !parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
                return new Map();
            }
            const map = new Map();
            for (const [starId, ts] of Object.entries(parsed.entries)) {
                const key = String(starId || "").trim();
                const value = Number(ts);
                if (key && Number.isFinite(value) && value > 0) map.set(key, value);
            }
            return map;
        } catch (error) {
            this.logger?.warn?.("读取演员资料冷却缓存失败，已重置:", error);
            return new Map();
        }
    }

    /** @param {Record<string, number>} entries */
    _saveProfileAttempts(entries) {
        if (typeof this.storage?.setLocal === "function") {
            try {
                this.storage.setLocal(PROFILE_ATTEMPTS_KEY, JSON.stringify({ schema: PROFILE_ATTEMPTS_SCHEMA, entries }));
            } catch (error) {
                try { this.logger?.warn?.("保存演员资料冷却缓存失败，已忽略:", error); }
                catch { /* 本地冷却缓存写入失败不应覆盖已提交的业务写入。 */ }
            }
        } else {
            this.fallbackProfileAttempts = new Map(Object.entries(entries).map(([k, v]) => [k, Number(v)]));
        }
    }

    /** @param {Map<string, number>} attempts @param {Set<string> | { validStarIds?: Set<string>, pruneIds?: Set<string> }} [filter] */
    writeProfileAttempts(attempts, filter) {
        const validStarIds = filter instanceof Set ? filter : filter?.validStarIds ?? null;
        const pruneIds = filter instanceof Set ? null : filter?.pruneIds ?? null;
        // 先读存储里的最新快照，避免把并发 clearProfileAttempts 删掉的条目
        // 通过整 key 覆写的方式复活；并仅清理确认的孤儿键，避免陈旧快照误删并发新增收藏。
        const merged = this.readProfileAttempts();
        if (pruneIds) {
            for (const id of pruneIds) merged.delete(id);
        }
        for (const [starId, ts] of attempts.entries()) {
            if ((validStarIds && !validStarIds.has(starId)) || !Number.isFinite(ts) || ts <= 0) continue;
            merged.set(starId, ts);
        }
        /** @type {Record<string, number>} */
        const entries = {};
        for (const [starId, ts] of merged.entries()) {
            if (validStarIds && !validStarIds.has(starId)) continue;
            entries[starId] = ts;
        }
        this._saveProfileAttempts(entries);
    }

    /** @param {string | string[]} starIds */
    clearProfileAttempts(starIds) {
        const ids = (Array.isArray(starIds) ? starIds : [starIds]).map((id) => String(id || "").trim()).filter(Boolean);
        if (!ids.length) return;
        for (const id of ids) {
            this.profileAttemptEpochs.set(id, (this.profileAttemptEpochs.get(id) ?? 0) + 1);
        }
        const attempts = this.readProfileAttempts();
        let changed = false;
        for (const id of ids) {
            if (attempts.delete(id)) changed = true;
        }
        if (!changed) return;
        this._saveProfileAttempts(Object.fromEntries(attempts.entries()));
    }

    /** Check whether the local profile-attempt schema has not yet been initialized for this version. */
    needsProfileBackfillInit() {
        if (typeof this.storage?.getLocal !== "function") return false;
        try {
            const raw = this.storage.getLocal(PROFILE_ATTEMPTS_KEY);
            if (!raw) return true;
            const parsed = JSON.parse(raw);
            return parsed?.schema !== PROFILE_ATTEMPTS_SCHEMA
                || !parsed.entries
                || typeof parsed.entries !== "object"
                || Array.isArray(parsed.entries);
        } catch {
            return true;
        }
    }

    /**
     * Coordinate profile backfill under the shared Web Lock with status updates and commit notifications.
     * @param {Record<string, any>} [options]
     * @param {{ signal?: AbortSignal, isDisposed?: () => boolean, isListPage?: () => boolean }} [caller]
     */
    async triggerProfileBackfill(options = {}, caller = {}) {
        const isDisposed = () => this.disposed || Boolean(this.scope?.disposed) || Boolean(caller.isDisposed?.());
        if (isDisposed()) return null;
        const { requireListPage = false, waitForLock, onProgress: callerOnProgress, ...backfillOptions } = options || {};
        const hostWindow = this.window ?? (typeof globalThis !== "undefined" ? (globalThis.window ?? globalThis) : null);
        const isListPage = () => typeof caller.isListPage === "function"
            ? Boolean(caller.isListPage())
            : Boolean(/** @type {any} */ (hostWindow)?.isListPage);
        if (requireListPage && !isListPage()) return null;

        const isTargeted = (Array.isArray(backfillOptions.starIds) && backfillOptions.starIds.length > 0)
            || backfillOptions.force === true
            || backfillOptions.refresh === true;
        const shouldWaitForLock = waitForLock === true || (waitForLock === undefined && isTargeted);

        const signals = /** @type {AbortSignal[]} */ ([caller.signal, this.scope?.signal].filter(Boolean));
        const mergedController = signals.length > 1 ? new AbortController() : null;
        /** @type {Array<() => void>} */
        const signalCleanups = [];
        if (mergedController) {
            for (const item of signals) {
                if (item.aborted) {
                    mergedController.abort(item.reason);
                    break;
                }
                const forward = () => mergedController.abort(item.reason);
                item.addEventListener?.("abort", forward, { once: true });
                signalCleanups.push(() => item.removeEventListener?.("abort", forward));
            }
        }
        const signal = mergedController ? mergedController.signal : signals[0];
        if (signal?.aborted) {
            for (const cleanup of signalCleanups) cleanup();
            return null;
        }

        const setStatus = (/** @type {string} */ message) => {
            try { this.jquery?.("#checkNewVideoMsg")?.text?.(message); }
            catch { /* 状态栏更新失败不影响补齐主流程。 */ }
        };
        const runWithPresentation = async () => {
            let committedCount = 0;
            /** @type {{ total: number, updated: number, unchanged: number, failed: number, rateLimited: number } | null} */
            let summary = null;
            let completed = false;
            try {
                summary = await this.backfillFavoriteProfiles({
                    ...backfillOptions,
                    onBatchCommitted: (count) => {
                        if (Number.isFinite(count) && count > 0) committedCount += count;
                    },
                    onProgress: (progress) => {
                        setStatus(`正在补齐演员资料 (${progress.processed}/${progress.total})…`);
                        if (typeof callerOnProgress === "function") callerOnProgress(progress);
                    },
                });
                completed = true;
                if (summary && summary.total > 0) {
                    setStatus(
                        `演员资料补齐：更新 ${summary.updated}，未变 ${summary.unchanged}，失败 ${summary.failed}${summary.rateLimited ? `，限流 ${summary.rateLimited}` : ""}`
                    );
                }
                return summary;
            } catch (error) {
                if (!isNetworkBlockedError(error)) setStatus("演员资料补齐失败");
                throw error;
            } finally {
                const updatedCount = completed ? Number(summary?.updated || 0) : committedCount;
                if (updatedCount > 0) {
                    try {
                        await this.events?.emit?.("new-video-changed", { reason: "favorite-profile-backfill", carNums: [] });
                    } catch (notifyError) {
                        try { this.logger?.warn?.("演员身材资料补齐状态已记录，但结束通知失败", notifyError); }
                        catch { /* 已提交的资料补齐不受诊断输出影响。 */ }
                    }
                }
            }
        };

        const locks = /** @type {any} */ (hostWindow)?.navigator?.locks;
        const requestLock = locks?.request;
        try {
            if (typeof requestLock !== "function") return await runWithPresentation();
            const lockOptions = shouldWaitForLock ? (signal ? { signal } : {}) : { ifAvailable: true };
            return await requestLock.call(locks, PROFILE_BACKFILL_LOCK_KEY, lockOptions, async (/** @type {unknown} */ lock) => {
                if (!lock || isDisposed() || signal?.aborted || (requireListPage && !isListPage())) return null;
                return await runWithPresentation();
            });
        } catch (error) {
            if (isNetworkBlockedError(error)) {
                const reason = error instanceof Error ? error.message : String(error);
                this.logger?.warn?.(`演员身材资料补齐已停止: ${reason}`);
            } else {
                this.logger?.error?.("演员身材资料补齐出现错误:", error);
            }
            return null;
        } finally {
            for (const cleanup of signalCleanups) cleanup();
        }
    }

    /**
     * Backfill missing or expired Wikipedia actress profiles for favorite actresses without touching unchanged records.
     * @param {{ now?: number, concurrency?: number, delayMs?: number, starIds?: string[], force?: boolean, refresh?: boolean, commitBatchSize?: number, onBatchCommitted?: (count: number) => void, onProgress?: (progress: { processed: number, total: number, updated: number, unchanged: number, failed: number, rateLimited: number }) => void }} [options]
     * @returns {Promise<{ total: number, updated: number, unchanged: number, failed: number, rateLimited: number }>}
     */
    async backfillFavoriteProfiles({ now = Date.now(), concurrency = 2, delayMs = 150, starIds, force = false, refresh = false, commitBatchSize = 10, onBatchCommitted, onProgress } = {}) {
        this.assertActive();
        if (this.scope?.signal?.aborted) throw createScanAbortError(this.scope.signal.reason);
        const actresses = await this.state.getFavoriteActressList();
        this.assertActive();
        if (this.scope?.signal?.aborted) throw createScanAbortError(this.scope.signal.reason);

        const list = Array.isArray(actresses) ? actresses : [];
        const validStarIds = new Set(list.map((/** @type {any} */ item) => String(item?.starId || "").trim()).filter(Boolean));
        const targetStarIds = Array.isArray(starIds) && starIds.length
            ? new Set(starIds.map((id) => String(id || "").trim()).filter(Boolean))
            : null;
        const attempts = this.readProfileAttempts();
        /** @type {Set<string>} */
        const orphanIds = new Set();
        for (const starId of attempts.keys()) {
            if (!validStarIds.has(starId)) orphanIds.add(starId);
        }
        // pendingUpdates 只收集本轮 backfill 修改过的条目，避免把 backfill 开头
        // 读到的 attempts 老快照里的脏数据（并发 clearProfileAttempts 删掉的条目）
        // 通过整 key 覆写复活。
        /** @type {Map<string, number>} */
        const pendingUpdates = new Map();
        /** @type {Map<string, number>} */
        const itemStartEpochs = new Map();

        /** @type {Array<{ actress: any, starId: string, currentProfile: ReturnType<typeof normalizeActressProfileData> }>} */
        const dueList = [];
        for (const actress of list) {
            const starId = String(actress?.starId || "").trim();
            if (!starId) continue;
            if (targetStarIds && !targetStarIds.has(starId)) continue;
            const currentProfile = readVerifiedActressProfile(actress);
            const cooldown = currentProfile?.url ? CACHE_TTL.actressInfo : CACHE_TTL.actressInfoNegative;
            const lastAttempt = attempts.get(starId) ?? 0;
            const due = force || lastAttempt <= 0 || (now - lastAttempt) >= cooldown;
            if (due) dueList.push({ actress, starId, currentProfile });
        }

        if (!dueList.length) {
            if (orphanIds.size || (!targetStarIds && this.needsProfileBackfillInit())) {
                this.writeProfileAttempts(pendingUpdates, { pruneIds: orphanIds });
            }
            return { total: 0, updated: 0, unchanged: 0, failed: 0, rateLimited: 0 };
        }

        const total = dueList.length;
        let nextIndex = 0;
        let processed = 0;
        let updated = 0;
        let unchanged = 0;
        let failed = 0;
        let rateLimited = 0;
        let stopWorkers = false;
        let flushFailed = false;
        let attemptsDirty = orphanIds.size > 0;
        let attemptsWriteAttempted = false;
        /** @type {Array<{ starId: string, actressProfile: NonNullable<ReturnType<typeof normalizeActressProfileData>> }>} */
        const profileUpdates = [];
        const batchSize = Math.max(1, Math.trunc(Number(commitBatchSize) || 10));
        /** @type {Promise<void>} */
        let flushChain = Promise.resolve();
        const lookupOptions = refresh ? { scope: this.scope, refresh: true } : { scope: this.scope };

        /** @param {Array<{ starId: string, actressProfile: NonNullable<ReturnType<typeof normalizeActressProfileData>> }>} batch */
        const commitBatch = async (batch) => {
            let persistedUpdated = 0;
            if (typeof this.state.batchUpdateFavoriteActressProfiles === "function") {
                const committed = await this.state.batchUpdateFavoriteActressProfiles(batch);
                persistedUpdated = typeof committed === "number" && Number.isFinite(committed)
                    ? Math.max(0, Math.min(committed, batch.length))
                    : batch.length;
            } else if (typeof this.state.updateFavoriteActress === "function") {
                for (const item of batch) {
                    const ok = await this.state.updateFavoriteActress(item);
                    if (ok !== false) persistedUpdated += 1;
                }
            }
            if (persistedUpdated > 0) onBatchCommitted?.(persistedUpdated);
            if (persistedUpdated < batch.length) {
                const skipped = batch.length - persistedUpdated;
                unchanged += skipped;
                updated = Math.max(0, updated - skipped);
            }
        };

        const flushProgress = (forceFlush = false) => {
            const next = flushChain.then(async () => {
                if (flushFailed) return;
                const isEpochValid = (/** @type {string} */ starId) =>
                    (this.profileAttemptEpochs.get(starId) ?? 0) === (itemStartEpochs.get(starId) ?? 0);
                /** @type {Array<{ starId: string, actressProfile: NonNullable<ReturnType<typeof normalizeActressProfileData>> }>} */
                let batch = [];
                if (profileUpdates.length && (forceFlush || profileUpdates.length >= batchSize)) {
                    const drained = profileUpdates.splice(0, profileUpdates.length);
                    let staleCount = 0;
                    for (const item of drained) {
                        if (isEpochValid(item.starId)) batch.push(item);
                        else staleCount += 1;
                    }
                    if (staleCount > 0) {
                        updated = Math.max(0, updated - staleCount);
                        unchanged += staleCount;
                    }
                }
                if (batch.length) {
                    try { await commitBatch(batch); }
                    catch (error) {
                        flushFailed = true;
                        stopWorkers = true;
                        updated = Math.max(0, updated - batch.length);
                        profileUpdates.unshift(...batch);
                        throw error;
                    }
                    for (const item of batch) {
                        if (isEpochValid(item.starId)) {
                            pendingUpdates.set(item.starId, now);
                            attemptsDirty = true;
                        }
                    }
                }
                if (attemptsDirty && (batch.length || forceFlush)) {
                    attemptsDirty = false;
                    for (const starId of [...pendingUpdates.keys()]) {
                        if (!isEpochValid(starId)) pendingUpdates.delete(starId);
                    }
                    if (pendingUpdates.size || orphanIds.size) {
                        attemptsWriteAttempted = true;
                        this.writeProfileAttempts(pendingUpdates, { pruneIds: orphanIds });
                    }
                    orphanIds.clear();
                    pendingUpdates.clear();
                }
            });
            flushChain = next.catch(() => {});
            return next;
        };

        const workerCount = Math.max(1, Math.min(Math.trunc(Number(concurrency) || 1), total));
        const workers = Array.from({ length: workerCount }, async () => {
            while (!stopWorkers && !this.disposed && !this.scope?.signal?.aborted) {
                const index = nextIndex++;
                if (index >= total) return;
                await this.waitForVisible();
                await this.backgroundWork?.waitForTurn?.({ signal: this.scope?.signal });
                this.assertActive();
                if (this.scope?.signal?.aborted) throw createScanAbortError(this.scope.signal.reason);
                if (stopWorkers) return;

                const { actress, starId, currentProfile } = dueList[index];
                const startEpoch = this.profileAttemptEpochs.get(starId) ?? 0;
                itemStartEpochs.set(starId, startEpoch);
                const names = collectActressLookupNames(actress?.name, actress?.allName);
                let shouldFlushBatch = false;
                try {
                    /** @type {any} */
                    let result = null;
                    if (names.length) {
                        if (typeof this.actressInfo?.lookupAny === "function") {
                            result = await this.actressInfo.lookupAny(names, lookupOptions);
                        } else if (typeof this.actressInfo?.lookup === "function") {
                            for (const candidate of names) {
                                const info = await this.actressInfo.lookup(candidate, lookupOptions);
                                if (info) {
                                    result = { info, matchedName: candidate };
                                    break;
                                }
                            }
                        }
                    }
                    this.assertActive();
                    if (this.scope?.signal?.aborted) throw createScanAbortError(this.scope.signal.reason);
                    if (flushFailed) return;
                    const rawInfo = result && typeof result === "object" && "info" in result ? result.info : result;
                    const matchedName = result && typeof result === "object" && "matchedName" in result
                        ? result.matchedName
                        : (rawInfo?.matchedName || names[0] || "");
                    const nextProfile = rawInfo
                        ? normalizeActressProfileData({ ...rawInfo, matchedName })
                        : null;
                    if ((this.profileAttemptEpochs.get(starId) ?? 0) !== startEpoch) {
                        unchanged += 1;
                    } else if (nextProfile && !isSameActressProfile(currentProfile, nextProfile)) {
                        profileUpdates.push({ starId, actressProfile: nextProfile });
                        updated += 1;
                        shouldFlushBatch = profileUpdates.length >= batchSize;
                    } else {
                        pendingUpdates.set(starId, now);
                        attemptsDirty = true;
                        unchanged += 1;
                    }
                } catch (error) {
                    if (isAbortError(error) || this.disposed || this.scope?.signal?.aborted) {
                        stopWorkers = true;
                        throw error;
                    }
                    if (isTransientBlockError(error)) {
                        stopWorkers = true;
                        rateLimited += 1;
                        this.logger?.warn?.("演员身材资料补齐触发限流，本轮停止", error);
                    } else {
                        failed += 1;
                        this.logger?.warn?.("演员身材资料补齐失败:", starId, error);
                    }
                }
                if (shouldFlushBatch && !flushFailed) {
                    try {
                        await flushProgress(false);
                    } catch (flushError) {
                        stopWorkers = true;
                        throw flushError;
                    }
                }
                processed += 1;
                try {
                    onProgress?.({ processed, total, updated, unchanged, failed, rateLimited });
                } catch (progressError) {
                    this.logger?.warn?.("演员资料补齐进度回调失败", progressError);
                }
                if (!stopWorkers && delayMs > 0 && nextIndex < total) {
                    await sleepAbortable(delayMs, this.scope?.signal);
                }
            }
            this.assertActive();
        });

        const settled = await Promise.allSettled(workers);
        const failure = settled.find((item) => item.status === "rejected");
        if (failure?.status === "rejected") {
            if (!this.disposed && isAbortError(failure.reason) && !flushFailed && (profileUpdates.length > 0 || attemptsDirty)) {
                try { await flushProgress(true); }
                catch (flushError) { this.logger?.warn?.("中断前保存已补齐的演员资料失败:", flushError); }
            }
            throw failure.reason;
        }
        this.assertActive();
        if (this.scope?.signal?.aborted) throw createScanAbortError(this.scope.signal.reason);

        await flushProgress(true);
        if (!attemptsWriteAttempted && !targetStarIds && this.needsProfileBackfillInit()) {
            this.writeProfileAttempts(pendingUpdates, { pruneIds: orphanIds });
        }
        return { total, updated, unchanged, failed, rateLimited };
    }

    async waitForVisible() {
        const doc = globalThis.document;
        if (!doc?.hidden) return;
        await new Promise((resolve, reject) => {
            const cleanup = () => {
                this.visibilityWaits.delete(abort);
                doc.removeEventListener("visibilitychange", check);
                this.scope?.signal?.removeEventListener?.("abort", abort);
            };
            const check = () => { if (!doc.hidden) { cleanup(); resolve(undefined); } };
            const abort = () => { cleanup(); reject(new DOMException("Scan disposed", "AbortError")); };
            this.visibilityWaits.add(abort);
            doc.addEventListener("visibilitychange", check);
            this.scope?.signal?.addEventListener?.("abort", abort, { once: true });
            if (this.scope?.disposed || this.disposed) abort(); else check();
        });
    }

    dispose() {
        for (const abort of this.visibilityWaits) abort();
        this.disposed = true;
        this.profileAttemptEpochs.clear();
        this.fallbackProfileAttempts.clear();
    }

    assertActive() {
        if (this.disposed) throw Object.assign(new Error("New-video scan is closed"), { name: "AbortError", code: "ABORTED" });
    }
}

const COLLECTION_NETWORK_CODES = new Set([
    "NETWORK_ERROR", "TIMEOUT", "AUTH_REQUIRED", "RATE_LIMITED", "CF_BLOCKED", "CIRCUIT_OPEN", "ABORTED",
]);

/** Keep the task adapter's established error categories for its retry UI. @param {unknown} error */
function markCollectionError(error) {
    const source = /** @type {any} */ (error);
    const marked = source instanceof Error ? source : new Error(String(source));
    if (COLLECTION_NETWORK_CODES.has(source?.code)) /** @type {any} */ (marked)._taskNetwork = true;
    else if (!Object.prototype.hasOwnProperty.call(marked, "_taskParse")) /** @type {any} */ (marked)._taskParse = true;
    return marked;
}

/** @param {unknown} error */
function markCollectionParseError(error) {
    const marked = error instanceof Error ? error : new Error(String(error));
    /** @type {any} */ (marked)._taskParse = true;
    return marked;
}

/** Match the legacy sort order, including missing publish times at the end. @param {any[]} actresses */
function sortActresses(actresses) {
    /** @type {any[]} */ const withPublishTime = [];
    /** @type {any[]} */ const withoutPublishTime = [];
    for (const actress of actresses) (null == actress.lastPublishTime ? withoutPublishTime : withPublishTime).push(actress);
    withPublishTime.sort((left, right) => {
        const countDifference = (right.newVideoList?.length ?? 0) - (left.newVideoList?.length ?? 0);
        if (countDifference) return countDifference;
        const leftTime = new Date(left.lastPublishTime), rightTime = new Date(right.lastPublishTime);
        const dateDifference = !Number.isNaN(leftTime.getTime()) && !Number.isNaN(rightTime.getTime())
            ? rightTime.getTime() - leftTime.getTime()
            : String(right.lastPublishTime).localeCompare(String(left.lastPublishTime));
        return dateDifference;
    });
    return [...withPublishTime, ...withoutPublishTime];
}
