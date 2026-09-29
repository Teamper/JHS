// @ts-check

import { selectLatestPublishTime, shouldSkipStopped } from "../../core/feature-helpers.js";

/** Converts discovered actor titles into the existing 6.5.1 actress record shape. */
export class NewVideoScanController {
    /** @param {{state: any, titleKeywords: any, actressInfo: any, scope: any, logger: any, getTimestamp: () => string, onNewItems: (name: string, count: number) => void}} options */
    constructor(options) {
        this.state = options.state;
        this.titleKeywords = options.titleKeywords;
        this.actressInfo = options.actressInfo;
        this.scope = options.scope;
        this.logger = options.logger;
        this.getTimestamp = options.getTimestamp;
        this.onNewItems = options.onNewItems;
        this.disposed = false;
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
        const movies = await this.actressInfo.movies("javdb", { actorId: starId, baseUrl: options.baseUrl }, { scope: this.scope, ttlMs: 0 });
        this.assertActive();
        return this.parseActorMovies(movies, starId, name, titleKeywords, blacklistSet);
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
            networkFailed: 0, aborted: 0, skippedInterval: 0, skippedStopped: 0, fatal: false,
        };
        /** @type {any[]} */
        const eligible = [];
        for (const actress of sorted) {
            if (!options.force && actress.lastCheckTime && options.isUnnecessaryCheck(actress.lastCheckTime, options.intervalHours)) result.skippedInterval++;
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
                    result.networkFailed++;
                    this.logger?.error?.("检测演员信息发生网络错误:", url, error);
                    if (eligible.length - nextIndex > 0) await options.sleep(options.sleepMs);
                    continue;
                }
                try {
                    await this.parseActorMovies(movies, starId, name, titleKeywords, blacklistSet);
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
        if (!items.length) {
            const saved = await this.state.updateFavoriteActress({ starId, lastCheckTime: this.getTimestamp(), newVideoList: [] });
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
        const [carMap, decisions] = await Promise.all([this.state.getCarMap(), this.state.getNewVideoDecisions()]);
        this.assertActive();
        const freshItems = candidates.filter((item) => !carMap.has(item.carNum));
        const fresh = freshItems.filter((item) => decisions[item.carNum]?.action !== "dismissed");
        const saved = await this.state.updateFavoriteActress({
            starId, lastCheckTime: this.getTimestamp(), newVideoList: freshItems,
            lastPublishTime: selectLatestPublishTime(publishTimes),
        });
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

    dispose() {
        this.disposed = true;
    }

    assertActive() {
        if (this.disposed) throw Object.assign(new Error("New-video scan is closed"), { name: "AbortError" });
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
